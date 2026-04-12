// src/templates.ts — HTML page generators
import { Item, Quadrant, Ring, QUADRANT_NAMES, RINGS, RING_LABELS, RING_DESCRIPTIONS } from './types.js';

/** CSS ring color via variable defined in style.css */
const ringColor = (ring: Ring) => `var(--${ring})`;

// ── Utilitaires ───────────────────────────────────────────────────────────────

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sharedHead(base: string): string {
  return `<link rel="icon" href="${base}/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${base}/style.css">`;
}

function header(base: string, extra = ''): string {
  return `<header role="banner">
  <a class="logo" href="${base}/" aria-label="Tech Radar — Home">
    <span class="logo-icon" aria-hidden="true">◉</span>
    <span class="logo-text">Tech Radar</span>
  </a>
  ${extra}
</header>`;
}

function badge(ring: Ring): string {
  return `<span class="badge badge-${ring}">${RING_LABELS[ring]}</span>`;
}

function badgeQ(quadrant: Quadrant): string {
  return `<span class="badge badge-q">${escHtml(QUADRANT_NAMES[quadrant])}</span>`;
}

function tagsHtml(tags: string[]): string {
  if (!tags.length) return '';
  return `<ul class="tags" role="list" aria-label="Tags">${tags.map(t => `<li class="tag" role="listitem">${escHtml(t)}</li>`).join('')}</ul>`;
}

// ── Page d'accueil (radar interactif) ────────────────────────────────────────

export function renderIndexPage(items: Item[], base: string): string {
  const legend = ([...RINGS] as Ring[])
    .map(r => `
      <div class="leg-card" role="listitem" tabindex="0"
           data-tooltip="${escHtml(RING_DESCRIPTIONS[r])}"
           aria-label="${escHtml(RING_LABELS[r])}: ${escHtml(RING_DESCRIPTIONS[r])}">
        <span class="leg-dot" style="background:${ringColor(r)}" aria-hidden="true"></span>
        <span class="leg-name" style="color:${ringColor(r)}">${escHtml(RING_LABELS[r])}</span>
      </div>`)
    .join('');

  const tabs = `
    <nav class="nav-tabs" aria-label="Filter by quadrant">
      <button class="nav-tab active" data-q="all">All (${items.length})</button>
      ${([...Object.entries(QUADRANT_NAMES)] as [Quadrant, string][])
        .map(([q, name]) => `<button class="nav-tab" data-q="${q}">${escHtml(name)}</button>`)
        .join('')}
    </nav>
    <search>
      <div class="search-wrap">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" focusable="false">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input id="search-input" class="search-input" type="search"
               placeholder="Search among ${items.length} items…" autocomplete="off"
               aria-label="Search technologies">
      </div>
    </search>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tech Radar — Coda</title>
<meta name="description" content="Coda's tech radar — ${items.length} technologies assessed">
${sharedHead(base)}
</head>
<body>
<a href="#radar" class="skip-link">Skip to radar</a>
${header(base, tabs)}

<main id="main-content">
  <div class="radar-area">
    <div class="legend" role="list" aria-label="Ring descriptions">${legend}</div>
    <div class="radar-wrap">
      <svg id="radar" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg"
           role="group" aria-label="Interactive tech radar — click or press Enter on a blip to view details"></svg>
    </div>
  </div>
  <aside id="sidebar" class="sidebar hidden" aria-hidden="true" aria-label="Item details">
    <div class="sidebar-head">
      <span id="sidebar-label" class="sidebar-label">Items</span>
      <button id="sidebar-close" class="sidebar-close" aria-label="Close panel">✕</button>
    </div>
    <div id="sidebar-body" class="sidebar-body" aria-live="polite" aria-atomic="false"></div>
  </aside>
</main>

<div id="tip" role="tooltip" aria-hidden="true">
  <div class="tip-name"></div>
  <div class="tip-meta"></div>
</div>

<script src="${base}/fuse.min.js"></script>
<script src="${base}/client.js" defer></script>
</body>
</html>`;
}

// ── Item detail page ──────────────────────────────────────────────────────────

export function renderItemPage(item: Item, allItems: Item[], base: string): string {
  const related = allItems
    .filter(i => i.quadrant === item.quadrant && i.slug !== item.slug)
    .slice(0, 4);

  const relatedHtml = related.length ? `
  <nav class="related" aria-label="More in ${escHtml(QUADRANT_NAMES[item.quadrant])}">
    <h2 class="related-title">More in ${escHtml(QUADRANT_NAMES[item.quadrant])}</h2>
    <ul class="related-grid" role="list">
      ${related.map(r => `
      <li role="listitem">
        <a href="${r.url}" class="related-card">
          <div class="related-card-title">${escHtml(r.title)}</div>
          <div class="related-card-meta" style="color:${ringColor(r.ring)}">${escHtml(RING_LABELS[r.ring])}</div>
        </a>
      </li>`).join('')}
    </ul>
  </nav>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(item.title)} — Tech Radar Coda</title>
<meta name="description" content="${escHtml(item.description)}">
${sharedHead(base)}
<style>body{display:block;height:auto;min-height:100dvh;overflow-y:auto}main{display:block}</style>
</head>
<body>
${header(base)}
<main>
<article class="page-wrap" aria-labelledby="item-title">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="${base}/">Radar</a><span class="bc-sep" aria-hidden="true">›</span>
    <a href="${base}/${item.quadrant}/">${escHtml(QUADRANT_NAMES[item.quadrant])}</a><span class="bc-sep" aria-hidden="true">›</span>
    <span aria-current="page">${escHtml(item.title)}</span>
  </nav>
  <h1 id="item-title" class="detail-title">${escHtml(item.title)}</h1>
  <div class="detail-meta">
    ${badge(item.ring)}
    ${badgeQ(item.quadrant)}
    <span class="badge badge-date"><time datetime="${escHtml(item.date)}">${escHtml(item.date)}</time></span>
  </div>
  ${tagsHtml(item.tags)}
  <p class="detail-desc">${escHtml(item.description)}</p>
  <div class="detail-body">${item.body}</div>
  ${relatedHtml}
</article>
</main>
</body>
</html>`;
}

// ── Quadrant index page ───────────────────────────────────────────────────────

export function renderQuadrantPage(quadrant: Quadrant, allItems: Item[], base: string): string {
  const items = allItems.filter(i => i.quadrant === quadrant);
  const name  = QUADRANT_NAMES[quadrant];
  const count = items.length;

  const ringGroups = ([...RINGS] as Ring[]).map(ring => {
    const rItems = items.filter(i => i.ring === ring);
    if (!rItems.length) return '';
    const groupId = `ring-${ring}`;
    return `<section class="q-ring-group" aria-labelledby="${groupId}">
      <h2 id="${groupId}" class="q-ring-title ${ring}">
        ${escHtml(RING_LABELS[ring])} — ${rItems.length} item${rItems.length > 1 ? 's' : ''}
      </h2>
      <ul class="q-grid" role="list">
        ${rItems.map(item => `
        <li role="listitem">
          <a href="${item.url}" class="q-card">
            <div class="q-card-title">${escHtml(item.title)}</div>
            <div class="q-card-desc">${escHtml(item.description)}</div>
            ${item.tags.length ? `<ul class="q-card-tags" role="list" aria-label="Tags">${item.tags.map(t => `<li class="q-card-tag" role="listitem">${escHtml(t)}</li>`).join('')}</ul>` : ''}
          </a>
        </li>`).join('')}
      </ul>
    </section>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(name)} — Tech Radar Coda</title>
<meta name="description" content="${count} technologies assessed in ${escHtml(name)}">
${sharedHead(base)}
<style>body{display:block;height:auto;min-height:100dvh;overflow-y:auto}main{display:block}</style>
</head>
<body>
${header(base)}
<main>
  <header class="qpage-header">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="${base}/">Radar</a><span class="bc-sep" aria-hidden="true">›</span>
      <span aria-current="page">${escHtml(name)}</span>
    </nav>
    <h1 class="qpage-title">${escHtml(name)}</h1>
    <p class="qpage-desc">${count} ${count > 1 ? 'technologies' : 'technology'} assessed</p>
  </header>
  <div class="qpage-content">${ringGroups}</div>
</main>
</body>
</html>`;
}
