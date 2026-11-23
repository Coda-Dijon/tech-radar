// src/client.ts — interactive radar, search, navigation (browser)
// Compiled + bundled by esbuild at build time; data is injected
// via `define: { __RADAR_DATA__: JSON.stringify(items) }` in build.ts.

import type { Item, Quadrant, Ring } from './types.js';
import { QUADRANTS, RINGS, QUADRANT_NAMES, RING_LABELS, RING_SHORT_LABELS, RING_R } from './types.js';

/** Resolves a ring color from CSS variables defined in style.css */
const ringColor = (ring: string) => `var(--${ring})`;

// Provided by esbuild define — never fetched from the network
declare const __RADAR_DATA__: Item[];

// ── Zoom viewBox ──────────────────────────────────────────────────────────────

type ViewBox = [number, number, number, number];

const DEFAULT_VIEWBOX: ViewBox = [0, 0, 800, 800];

// Each quadrant occupies one of the 4 corners of the 800×800 SVG (center at 400,400).
// A 10px padding is added so labels and axes have breathing room.
const QUADRANT_VIEWBOX: Record<Quadrant, ViewBox> = {
  'languages-frameworks': [390,  -10, 420, 420], // haut-droite
  'platforms':            [-10,  -10, 420, 420], // haut-gauche
  'techniques':           [-10,  390, 420, 420], // bas-gauche
  'tools':                [390,  390, 420, 420], // bas-droite
};

let rafId: number | null = null;

function animateViewBox(target: ViewBox, duration = 420): void {
  const svg = document.getElementById('radar') as unknown as SVGSVGElement;
  const vb  = svg.viewBox.baseVal;
  const from: ViewBox = [vb.x, vb.y, vb.width, vb.height];
  const t0  = performance.now();

  if (rafId !== null) cancelAnimationFrame(rafId);

  function frame(now: number): void {
    const p = Math.min((now - t0) / duration, 1);
    // ease in-out cubic
    const e = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
    const next = from.map((f, i) => f + (target[i]! - f) * e) as ViewBox;
    svg.setAttribute('viewBox', next.join(' '));
    rafId = p < 1 ? requestAnimationFrame(frame) : null;
  }

  rafId = requestAnimationFrame(frame);
}

// ── Global state ─────────────────────────────────────────────────────────────

let activeQ:    Quadrant | null = null;
let activeItem: Item     | null = null;
let searchQuery = '';
let searchMode  = false;

// ── Blip positioning (even distribution, no overlap) ─────────────────────────

function simpleHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const QUADRANT_ANGLES: Record<Quadrant, [number, number]> = {
  'languages-frameworks': [-Math.PI / 2, 0],
  'platforms':            [-Math.PI,     -Math.PI / 2],
  'techniques':           [Math.PI / 2,   Math.PI],
  'tools':                [0,             Math.PI / 2],
};

/** Ring band backgrounds, inner → outer (adopt = 45 % lime over white). */
const RING_BG = ['#eef9b0', '#f2f2f2', '#ffffff', '#f2f2f2'] as const;

/** Minimum distance (px) between a blip centre and the ring labels on the positive x-axis. */
const AXIS_CLEARANCE = 17;

const RING_BOUNDS: Record<Ring, [number, number]> = {
  adopt:  [25, 90],
  'can-use': [112, 188],
  assess: [212, 288],
  hold:   [312, 370],
};

/**
 * Precompute blip positions for all items.
 * Per quadrant+ring group, items are sorted alphabetically, split between an
 * inner and an outer radial track (proportionally to their radius), then
 * distributed evenly across the angular span of their track. A tiny hash-based jitter breaks
 * perfect alignment without causing collisions.
 */
function computeBlipPositions(items: Item[]): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>();

  for (const q of QUADRANTS) {
    for (const ring of RINGS) {
      const group = items
        .filter(it => it.quadrant === q && it.ring === ring)
        .sort((a, b) => a.title.localeCompare(b.title));

      if (!group.length) continue;

      const [angStart, angEnd] = QUADRANT_ANGLES[q];
      const [rMin, rMax]       = RING_BOUNDS[ring];
      const n   = group.length;
      const span = angEnd - angStart;

      // Two radial tracks (30 % / 70 % of the band). Items are shared between them
      // in proportion to each track's radius, so the shorter inner arc gets fewer blips.
      const trackR = (frac: number) => rMin + frac * (rMax - rMin);
      const nIn    = n === 1 ? 0 : Math.round(n * trackR(0.3) / (trackR(0.3) + trackR(0.7)));
      const isInner = (i: number) => Math.floor((i + 1) * nIn / n) > Math.floor(i * nIn / n);
      const counters = { inner: 0, outer: 0 };

      group.forEach((item, i) => {
        const inner  = isInner(i);
        const k      = inner ? counters.inner++ : counters.outer++;
        const nTrack = inner ? nIn : n - nIn;
        const track  = n === 1 ? 0.5 : (inner ? 0.3 : 0.7);
        // ±4 % jitter so items don't line up perfectly
        const jitter = ((simpleHash(`${item.title}|${item.quadrant}`) % 100) / 100 - 0.5) * 0.08;
        const rFrac  = Math.max(0.05, Math.min(0.95, track + jitter));
        const r      = trackR(rFrac);

        // Angular padding: 10 % of the span on each side, widened on the side that
        // touches the positive x-axis so blips keep AXIS_CLEARANCE px from the ring labels
        const labelPad = Math.min(0.35, AXIS_CLEARANCE / (r * Math.abs(span)));
        const padStart = Math.max(0.10, angStart === 0 ? labelPad : 0);
        const padEnd   = Math.max(0.10, angEnd   === 0 ? labelPad : 0);
        const t     = (k + 0.5) / nTrack;
        const angle = angStart + (padStart + t * (1 - padStart - padEnd)) * span;

        map.set(`${item.slug}|${item.quadrant}`, { x: r * Math.cos(angle), y: r * Math.sin(angle) });
      });
    }
  }

  return map;
}

// Recomputed whenever renderRadar() is called (items set is stable between renders)
let blipPositions = computeBlipPositions(__RADAR_DATA__);

function blipPos(item: Item): { x: number; y: number } {
  return blipPositions.get(`${item.slug}|${item.quadrant}`) ?? { x: 0, y: 0 };
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

const NS = 'http://www.w3.org/2000/svg';

function svgEl<T extends SVGElement>(
  tag: string,
  attrs: Record<string, string>,
  parent?: SVGElement | null,
): T {
  const el = document.createElementNS(NS, tag) as T;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent?.appendChild(el);
  return el;
}

// ── Rendu du radar ────────────────────────────────────────────────────────────

function renderRadar(): void {
  const svg = document.getElementById('radar') as unknown as SVGSVGElement;
  svg.replaceChildren();
  const g = svgEl<SVGGElement>('g', { transform: 'translate(400,400)' }, svg);

  // Anneaux (du plus grand au plus petit)
  ;([...RINGS] as Ring[]).reverse().forEach((ring, i) => {
    const ri = RINGS.length - 1 - i;
    svgEl('circle', {
      r: String(RING_R[ri]),
      fill: RING_BG[ri]!,
      stroke: '#0a0a0a', 'stroke-width': '2',
    }, g);
  });

  // Quadrant axes
  svgEl('line', { x1: '-385', y1: '0', x2: '385', y2: '0', stroke: '#0a0a0a', 'stroke-width': '2' }, g);
  svgEl('line', { x1: '0', y1: '-385', x2: '0', y2: '385', stroke: '#0a0a0a', 'stroke-width': '2' }, g);

  // Labels des anneaux (sur l'axe x positif)
  ;([...RINGS] as Ring[]).forEach((ring, i) => {
    const inner = i === 0 ? 0 : RING_R[i - 1];
    const mid   = (inner + RING_R[i]) / 2;
    const t = svgEl<SVGTextElement>('text', {
      x: String(mid), y: '0', 'text-anchor': 'middle', 'dominant-baseline': 'central',
      fill: '#0a0a0a',
      'font-size': '11', 'font-weight': '700', 'letter-spacing': '1.5',
      'font-family': "'Atkinson Hyperlegible Mono Variable',ui-monospace,monospace",
      // Halo in the ring's background colour masks the axis line behind the label
      stroke: RING_BG[i]!, 'stroke-width': '6', 'paint-order': 'stroke', 'stroke-linejoin': 'miter',
    }, g);
    t.textContent = RING_SHORT_LABELS[ring].toUpperCase();
  });

  // Quadrant labels — positioned outside the outermost ring (r=380) at each corner diagonal
  // distance from centre ≈ 295√2 ≈ 417, safely within the 800×800 viewBox
  const qLabels: { q: Quadrant; x: number; y: number; anchor: string; lines: string[] }[] = [
    { q: 'languages-frameworks', x:  325, y: -325, anchor: 'middle', lines: ['Languages &', 'Frameworks'] },
    { q: 'platforms',            x: -325, y: -325, anchor: 'middle', lines: ['Platforms'] },
    { q: 'techniques',           x: -325, y:  325, anchor: 'middle', lines: ['Techniques'] },
    { q: 'tools',                x:  325, y:  325, anchor: 'middle', lines: ['Tools'] },
  ];

  for (const { q, x, y, anchor, lines } of qLabels) {
    const isActive = !activeQ || activeQ === q;
    const ariaLabel = activeQ === q
      ? `Reset filter — ${QUADRANT_NAMES[q]}`
      : `Zoom to ${QUADRANT_NAMES[q]}`;
    const labelG = svgEl<SVGGElement>('g', {
      cursor: 'pointer',
      role: 'button',
      tabindex: '0',
      'aria-label': ariaLabel,
      'aria-pressed': String(activeQ === q),
    }, g);
    const activate = () => setActiveQ(activeQ === q ? null : q);
    labelG.addEventListener('click', activate);
    labelG.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
    // Offset multi-line labels so the block is centred on y
    const offsetY = -(lines.length - 1) * 17 / 2;
    lines.forEach((line, pi) => {
      const t = svgEl<SVGTextElement>('text', {
        x: String(x), y: String(y + offsetY + pi * 17), 'text-anchor': anchor,
        fill: isActive ? '#0a0a0a' : '#b3b3b3',
        'font-size': '17', 'font-weight': '700',
        'font-family': "'Lexend Variable',system-ui,sans-serif",
      }, labelG);
      t.textContent = line;
    });
  }

  // Active blips only (the viewBox zoom visually hides other quadrants)
  const visibleItems = __RADAR_DATA__.filter(d => !activeQ || d.quadrant === activeQ);

  for (const item of visibleItems) {
    const pos   = blipPos(item);
    const isSel = activeItem?.slug === item.slug && activeItem?.quadrant === item.quadrant;

    if (isSel) {
      svgEl('circle', {
        cx: String(pos.x), cy: String(pos.y), r: '15',
        fill: 'none', stroke: '#0a0a0a', 'stroke-width': '2', 'stroke-dasharray': '4,3',
      }, g);
    }

    const blipG = svgEl<SVGGElement>('g', {
      transform: `translate(${pos.x},${pos.y})`,
      cursor: 'pointer',
      role: 'button',
      tabindex: '0',
      'aria-label': `${item.title} — ${RING_LABELS[item.ring as Ring]}, ${QUADRANT_NAMES[item.quadrant]}`,
      'aria-pressed': String(isSel),
    }, g);
    svgEl('circle', {
      r: isSel ? '9' : '7',
      fill: ringColor(item.ring),
      stroke: '#0a0a0a', 'stroke-width': isSel ? '2.5' : '1.5',
    }, blipG);

    blipG.addEventListener('click',        () => showDetail(item));
    blipG.addEventListener('mouseenter',   (e) => showTooltip(e as MouseEvent, item));
    blipG.addEventListener('mouseleave',   hideTooltip);
    blipG.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDetail(item); }
    });
  }
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function showTooltip(e: MouseEvent, item: Item): void {
  const tip = document.getElementById('tip')!;
  tip.querySelector<HTMLElement>('.tip-name')!.textContent = item.title;
  tip.querySelector<HTMLElement>('.tip-meta')!.textContent =
    `${QUADRANT_NAMES[item.quadrant]} · ${RING_LABELS[item.ring]}`;
  tip.style.display = 'block';
  positionTooltip(e);
}

function positionTooltip(e: MouseEvent): void {
  const tip = document.getElementById('tip')!;
  tip.style.left = `${Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8)}px`;
  tip.style.top  = `${Math.max(e.clientY - 10, 8)}px`;
}

function hideTooltip(): void {
  document.getElementById('tip')!.style.display = 'none';
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function openSidebar(label: string): void {
  const sidebar = document.getElementById('sidebar')!;
  sidebar.classList.remove('hidden');
  sidebar.removeAttribute('aria-hidden');
  document.getElementById('sidebar-label')!.textContent = label;
}

function closeSidebar(): void {
  const sidebar = document.getElementById('sidebar')!;
  sidebar.classList.add('hidden');
  sidebar.setAttribute('aria-hidden', 'true');
  activeItem  = null;
  searchMode  = false;
}

function showDetail(item: Item): void {
  activeItem = item;
  searchMode = false;
  renderRadar();
  openSidebar('Detail');

  const tagsHtml = item.tags.length
    ? `<div class="tags">${item.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>`
    : '';

  document.getElementById('sidebar-body')!.innerHTML = `
    <div class="detail-title">${esc(item.title)}</div>
    <div class="detail-meta">
      <span class="badge badge-${item.ring}">${RING_LABELS[item.ring as Ring]}</span>
      <span class="badge badge-q">${esc(QUADRANT_NAMES[item.quadrant])}</span>
      <span class="badge badge-date">${esc(item.date)}</span>
    </div>
    ${tagsHtml}
    <p class="detail-desc">${esc(item.description)}</p>
    <div class="detail-body">${item.body}</div>
    <a href="${item.url}" class="detail-link">View full page →</a>
  `;
}

function showBrowse(quadrant: Quadrant | null): void {
  openSidebar(quadrant ? QUADRANT_NAMES[quadrant] : 'All items');
  const data = quadrant ? __RADAR_DATA__.filter(d => d.quadrant === quadrant) : __RADAR_DATA__;

  let html = '';
  for (const ring of [...RINGS] as Ring[]) {
    const items = data.filter(d => d.ring === ring);
    if (!items.length) continue;
    html += `<div class="ring-section">
      <div class="ring-title ${ring}" role="heading" aria-level="3">${esc(RING_LABELS[ring])} (${items.length})</div>
      <ul role="list" style="list-style:none;padding:0;margin:0">
        ${items.map(item => `
        <li role="listitem">
          <div class="item-row" tabindex="0" role="button"
               aria-label="${esc(item.title)}, ${esc(RING_LABELS[item.ring as Ring])}"
               data-slug="${esc(item.slug)}" data-q="${esc(item.quadrant)}">
            <span class="item-name">${esc(item.title)}</span>
            <span class="item-dot" aria-hidden="true" style="background:${ringColor(item.ring)}"></span>
          </div>
        </li>`).join('')}
      </ul>
    </div>`;
  }

  const body = document.getElementById('sidebar-body')!;
  body.innerHTML = html || '<div class="no-results">No items in this quadrant.</div>';

  body.querySelectorAll<HTMLElement>('.item-row').forEach(row => {
    const activate = () => {
      const item = __RADAR_DATA__.find(d => d.slug === row.dataset['slug'] && d.quadrant === row.dataset['q']);
      if (item) showDetail(item);
    };
    row.addEventListener('click', activate);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });
}

// ── Quadrant filter ───────────────────────────────────────────────────────────

function setActiveQ(q: Quadrant | null): void {
  activeQ = q;
  document.querySelectorAll<HTMLButtonElement>('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset['q'] === (q ?? 'all'));
  });
  if (!searchMode) {
    if (q) showBrowse(q);
    else   closeSidebar();
  }
  renderRadar();
  animateViewBox(q ? QUADRANT_VIEWBOX[q] : DEFAULT_VIEWBOX);
  updateURL();
}

// ── Fuse.js search ────────────────────────────────────────────────────────────

// Fuse is loaded from CDN before this script — declared here for TypeScript
interface FuseInstance<T> { search(q: string): Array<{ item: T }> }
declare const Fuse: new <T>(list: T[], opts: object) => FuseInstance<T>;

let fuse: FuseInstance<Item>;

function initSearch(): void {
  fuse = new Fuse(__RADAR_DATA__, {
    keys: ['title', 'description', 'tags', 'bodyRaw'],
    threshold: 0.35,
    includeScore: true,
    minMatchCharLength: 2,
  });
}

function doSearch(q: string): void {
  searchQuery = q;
  if (!q) {
    searchMode = false;
    closeSidebar();
    renderRadar();
    return;
  }
  searchMode = true;
  activeItem = null;
  renderRadar();

  const results = fuse.search(q).slice(0, 20);
  openSidebar('Search');

  if (!results.length) {
    document.getElementById('sidebar-body')!.innerHTML =
      `<div class="no-results">No results for "${esc(q)}"</div>`;
    return;
  }

  const cards = results.map(({ item }) => `
    <li role="listitem">
      <div class="result-card" tabindex="0" role="button"
           aria-label="${esc(item.title)}, ${esc(RING_LABELS[item.ring as Ring])}, ${esc(QUADRANT_NAMES[item.quadrant])}"
           data-slug="${esc(item.slug)}" data-q="${esc(item.quadrant)}">
        <div class="result-title">${esc(item.title)}</div>
        <div class="result-desc">${esc(item.description)}</div>
        <div class="result-meta">
          <span class="badge badge-${item.ring}">${esc(RING_LABELS[item.ring as Ring])}</span>
          <span class="badge badge-q">${esc(QUADRANT_NAMES[item.quadrant])}</span>
        </div>
      </div>
    </li>`).join('');

  const body = document.getElementById('sidebar-body')!;
  body.innerHTML = `
    <p class="search-count" role="status">${results.length} result${results.length > 1 ? 's' : ''} for "${esc(q)}"</p>
    <ul class="result-list" role="list" aria-label="Search results" style="list-style:none;padding:0">${cards}</ul>
  `;

  body.querySelectorAll<HTMLElement>('.result-card').forEach(card => {
    const activate = () => {
      const item = __RADAR_DATA__.find(d => d.slug === card.dataset['slug'] && d.quadrant === card.dataset['q']);
      if (item) showDetail(item);
    };
    card.addEventListener('click', activate);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });
}

// ── URL state ─────────────────────────────────────────────────────────────────

function updateURL(): void {
  const p = new URLSearchParams();
  if (searchQuery) p.set('q', searchQuery);
  if (activeQ)     p.set('quadrant', activeQ);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function readURL(): void {
  const p    = new URLSearchParams(window.location.search);
  const q    = p.get('q') ?? '';
  const quad = p.get('quadrant') as Quadrant | null;
  if (q) {
    (document.getElementById('search-input') as HTMLInputElement).value = q;
    doSearch(q);
  } else if (quad && (QUADRANTS as readonly string[]).includes(quad)) {
    setActiveQ(quad);
  }
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderRadar();
  initSearch();

  document.addEventListener('mousemove', e => {
    if (document.getElementById('tip')!.style.display === 'block') positionTooltip(e as MouseEvent);
  });

  // Legend tooltips — #tip is position:fixed so it escapes overflow:hidden parents
  document.querySelectorAll<HTMLElement>('.leg-card[data-tooltip]').forEach(card => {
    card.addEventListener('mouseenter', (e) => {
      const tip = document.getElementById('tip')!;
      tip.querySelector<HTMLElement>('.tip-name')!.textContent =
        card.querySelector<HTMLElement>('.leg-name')?.textContent ?? '';
      tip.querySelector<HTMLElement>('.tip-meta')!.textContent = card.dataset['tooltip'] ?? '';
      tip.style.display = 'block';
      positionTooltip(e as MouseEvent);
    });
    card.addEventListener('mouseleave', hideTooltip);
  });

  document.getElementById('sidebar-close')!.addEventListener('click', () => {
    if (activeQ && !activeItem && !searchMode) {
      setActiveQ(null);
    } else {
      activeItem = null;
      searchMode = false;
      if (activeQ) showBrowse(activeQ);
      else         closeSidebar();
      renderRadar();
    }
  });

  document.querySelectorAll<HTMLButtonElement>('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const q = tab.dataset['q'] as Quadrant | 'all';
      setActiveQ(q === 'all' ? null : q);
    });
  });

  const inp = document.getElementById('search-input') as HTMLInputElement;
  let timer: ReturnType<typeof setTimeout>;
  inp.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { doSearch(inp.value.trim()); updateURL(); }, 200);
  });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { inp.value = ''; doSearch(''); updateURL(); }
  });

  readURL();
});
