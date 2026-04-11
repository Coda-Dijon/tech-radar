// build.ts — Tech Radar static site generator orchestrator
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { marked } from 'marked';
import { z } from 'zod';
import { transformSync, buildSync } from 'esbuild';
import { QUADRANTS, RINGS, type Item, type Quadrant } from './src/types.js';
import { renderIndexPage, renderItemPage, renderQuadrantPage } from './src/templates.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const VALIDATE_ONLY = process.argv.includes('--validate-only');

/** Root-relative base path for the deployed site, e.g. "/tech-radar" (no trailing slash).
 *  Set via BASE_URL env var. Defaults to '' (served at domain root). */
const BASE_PATH = (process.env.BASE_URL ?? '').replace(/\/$/, '');

// ── Schema Zod ────────────────────────────────────────────────────────────────

const ItemSchema = z.object({
  title:    z.string().min(1, 'title est requis'),
  ring:     z.enum(RINGS,     { errorMap: () => ({ message: `ring must be one of: ${RINGS.join(' | ')}` }) }),
  quadrant: z.enum(QUADRANTS, { errorMap: () => ({ message: `quadrant must be one of: ${QUADRANTS.join(' | ')}` }) }),
  tags:     z.array(z.string()).default([]),
  // gray-matter parses YAML dates as Date objects — normalize to YYYY-MM-DD string
  date: z.union([z.string(), z.date()])
    .transform(d => d instanceof Date ? d.toISOString().split('T')[0] : d)
    .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format')),
  description: z.string().min(1, 'description est requise'),
});

type BuildError = { file: string; message: string };

// ── Utilitaires Markdown ──────────────────────────────────────────────────────

/**
 * Rewrite relative image src/srcset attributes in an HTML string to root-relative
 * paths using the item's URL as base. Absolute URLs and root-relative paths are
 * left untouched.
 *
 * Example: src="img/foo.png" + baseUrl="/tools/vite/" → src="/tools/vite/img/foo.png"
 */
function absolutifyImagePaths(html: string, baseUrl: string): string {
  return html
    // <img src="...">
    .replace(/(<img\b[^>]*?\bsrc=")(?!https?:\/\/|\/\/|\/)([^"]+)(")/gi,
      (_, pre, path, post) => `${pre}${baseUrl}${path}${post}`)
    // <source src="..."> / <source srcset="...">
    .replace(/(<source\b[^>]*?\bsrc(?:set)?=")(?!https?:\/\/|\/\/|\/)([^"]+)(")/gi,
      (_, pre, path, post) => `${pre}${baseUrl}${path}${post}`);
}

// ── Lecture du contenu Markdown ───────────────────────────────────────────────

function readAllContent(): { items: Item[]; errors: BuildError[] } {
  const items:  Item[]       = [];
  const errors: BuildError[] = [];

  for (const quadrant of QUADRANTS) {
    const dir = join(__dirname, 'content', quadrant);
    if (!existsSync(dir)) continue;

    for (const file of readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
      const filePath = join(dir, file);
      const raw = readFileSync(filePath, 'utf-8');

      let parsed: matter.GrayMatterFile<string>;
      try {
        parsed = matter(raw);
      } catch (e) {
        errors.push({ file: filePath, message: `YAML parse error: ${(e as Error).message}` });
        continue;
      }

      const result = ItemSchema.safeParse(parsed.data);
      if (!result.success) {
        for (const err of result.error.errors) {
          errors.push({ file: filePath, message: `${err.path.join('.') || 'frontmatter'} — ${err.message}` });
        }
        continue;
      }

      const slug    = basename(file, '.md');
      const itemUrl = `${BASE_PATH}/${quadrant}/${slug}/`;
      const rawBody = marked(parsed.content ?? '') as string;
      items.push({
        ...result.data,
        slug,
        body:    absolutifyImagePaths(rawBody, itemUrl),
        bodyRaw: parsed.content ?? '',
        url:     itemUrl,
      });
    }
  }

  return { items, errors };
}

// ── Compilation & minification ────────────────────────────────────────────────

function compileCSS(): string {
  const src = readFileSync(join(__dirname, 'src/style.css'), 'utf-8');
  return transformSync(src, { loader: 'css', minify: true }).code;
}

function compileClientTS(items: Item[]): string {
  // esbuild bundles src/client.ts → minified JS
  // Data is injected via define to avoid any network fetch
  const result = buildSync({
    entryPoints: [join(__dirname, 'src/client.ts')],
    bundle:      true,
    minify:      true,
    target:      'es2020',
    platform:    'browser',
    format:      'iife',
    write:       false,
    define: {
      __RADAR_DATA__: JSON.stringify(items),
    },
  });
  return result.outputFiles[0]!.text;
}

// ── Système de fichiers ───────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function write(filePath: string, content: string): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, 'utf-8');
}

function copyFile(src: string, dest: string): void {
  ensureDir(dirname(dest));
  writeFileSync(dest, readFileSync(src));
}

/** Recursively copy a directory tree from src to dest. Returns the count of copied files. */
function copyDirRecursive(src: string, dest: string): number {
  ensureDir(dest);
  let count = 0;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath  = join(src,  entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

/**
 * Extract locally-referenced image paths from Markdown source.
 * Ignores absolute URLs (http/https/protocol-relative) and root-relative paths (/...).
 */
function extractLocalImagePaths(markdown: string): string[] {
  const paths = new Set<string>();

  // Markdown syntax: ![alt](path) or ![alt](path "title")
  for (const m of markdown.matchAll(/!\[[^\]]*\]\(([^)"'\s]+)/g)) {
    const p = m[1]!;
    if (!p.startsWith('http') && !p.startsWith('//') && !p.startsWith('/')) paths.add(p);
  }

  // HTML <img src="path"> inside Markdown
  for (const m of markdown.matchAll(/<img[^>]+src=["']([^"']+)["']/g)) {
    const p = m[1]!;
    if (!p.startsWith('http') && !p.startsWith('//') && !p.startsWith('/')) paths.add(p);
  }

  return [...paths];
}

/**
 * Copy static assets to dist:
 *  • public/  → dist/                    (shared assets, referenced as /image.png)
 *  • images referenced in each item's Markdown → dist/<quadrant>/<slug>/
 *    resolved relative to the .md file's directory
 */
function copyAssets(dist: string, items: Item[]): number {
  let total = 0;

  // 1. Global public/ directory
  const publicDir = join(__dirname, 'public');
  if (existsSync(publicDir)) {
    total += copyDirRecursive(publicDir, dist);
  }

  // 2. Per-item: copy every locally-referenced image to the item's dist directory
  for (const item of items) {
    const mdDir      = join(__dirname, 'content', item.quadrant);          // markdown lives here
    const itemDist   = join(dist, item.quadrant, item.slug);               // item's output dir
    const imagePaths = extractLocalImagePaths(item.bodyRaw);

    for (const imgPath of imagePaths) {
      const src  = join(mdDir, imgPath);
      const dest = join(itemDist, imgPath);
      if (!existsSync(src)) {
        console.warn(`  ⚠ image not found: content/${item.quadrant}/${imgPath} (referenced in ${item.slug}.md)`);
        continue;
      }
      ensureDir(dirname(dest));
      copyFileSync(src, dest);
      total++;
    }
  }

  return total;
}

// ── Build principal ───────────────────────────────────────────────────────────

function build(): void {
  const t0 = Date.now();
  console.log('📡 Tech Radar — Build started\n');

  // 1. Lecture & validation
  const { items, errors } = readAllContent();

  if (errors.length > 0) {
    console.error('❌ Validation errors:\n');
    for (const err of errors) {
      console.error(`  ${err.file.replace(__dirname + '/', '')}\n    → ${err.message}\n`);
    }
    process.exit(1);
  }

  console.log(`  ✓ ${items.length} valid Markdown files`);

  if (VALIDATE_ONLY) {
    console.log('\n✅ Validation passed');
    return;
  }

  // 2. Compilation des assets
  process.stdout.write('  ⚡ CSS    ');
  const minCSS = compileCSS();
  const cssRaw = readFileSync(join(__dirname, 'src/style.css'), 'utf-8').length;
  process.stdout.write(`${(cssRaw / 1024).toFixed(1)} KB → ${(minCSS.length / 1024).toFixed(1)} KB\n`);

  process.stdout.write('  ⚡ Client ');
  const minJS = compileClientTS(items);
  process.stdout.write(`(bundled + minified) → ${(minJS.length / 1024).toFixed(1)} KB\n\n`);

  // 3. Page generation
  const dist = join(__dirname, 'dist');
  ensureDir(dist);

  copyFile(join(__dirname, 'src/favicon.svg'), join(dist, 'favicon.svg'));
  console.log('  ✓ dist/favicon.svg');

  const assetCount = copyAssets(dist, items);
  if (assetCount > 0) console.log(`  ✓ ${assetCount} static asset${assetCount > 1 ? 's' : ''} copied`);

  write(join(dist, 'index.html'), renderIndexPage(items, minCSS, minJS, BASE_PATH));
  console.log('  ✓ dist/index.html');

  write(join(dist, 'data.json'), JSON.stringify(items, null, 2));
  console.log('  ✓ dist/data.json');

  for (const item of items) {
    write(join(dist, item.quadrant, item.slug, 'index.html'), renderItemPage(item, items, minCSS, BASE_PATH));
    console.log(`  ✓ dist${item.url}index.html`);
  }

  for (const quadrant of QUADRANTS) {
    write(join(dist, quadrant, 'index.html'), renderQuadrantPage(quadrant as Quadrant, items, minCSS, BASE_PATH));
    console.log(`  ✓ dist/${quadrant}/index.html`);
  }

  // 4. Summary
  const byRing = Object.fromEntries(RINGS.map(r => [r, items.filter(i => i.ring === r).length]));
  console.log(`\n✅ ${items.length} items → dist/  (${Date.now() - t0}ms)`);
  console.log(`   ${RINGS.map(r => `${r} ${byRing[r]}`).join('  ·  ')}`);
}

build();
