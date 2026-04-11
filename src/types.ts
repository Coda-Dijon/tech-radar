// src/types.ts — types and constants shared between build (Node) and client (browser)

export const QUADRANTS = ['languages-frameworks', 'platforms', 'techniques', 'tools'] as const;
export const RINGS     = ['adopt', 'trial', 'assess', 'hold'] as const;

export type Quadrant = (typeof QUADRANTS)[number];
export type Ring     = (typeof RINGS)[number];

export interface Item {
  title:       string;
  ring:        Ring;
  quadrant:    Quadrant;
  tags:        string[];
  date:        string;
  description: string;
  slug:        string;
  body:        string;   // HTML rendu depuis Markdown
  bodyRaw:     string;   // raw Markdown (used for search indexing)
  url:         string;   // ex. /tools/vite/
}

export const QUADRANT_NAMES: Record<Quadrant, string> = {
  'languages-frameworks': 'Languages & Frameworks',
  'platforms':            'Platforms',
  'techniques':           'Techniques',
  'tools':                'Tools',
};


// Ring colors are defined in style.css as CSS custom properties:
// --adopt, --trial, --assess, --hold
// Use `var(--<ring>)` in templates and the SVG client.

export const RING_R = [100, 200, 300, 380] as const; // outer radius of each ring (px, on a 800×800 SVG)

/** Full display labels used in legend, badges and static pages */
export const RING_LABELS: Record<Ring, string> = {
  adopt:  'Adopt',
  trial:  'Can Use',
  assess: 'Assess',
  hold:   'Deprecated / Rejected',
};

/** Short labels used on the SVG radar rings where space is limited */
export const RING_SHORT_LABELS: Record<Ring, string> = {
  adopt:  'Adopt',
  trial:  'Can Use',
  assess: 'Assess',
  hold:   '[Depr]',
};

/** One-line description shown in the legend and quadrant pages */
export const RING_DESCRIPTIONS: Record<Ring, string> = {
  adopt:  'We have capacity to use these solutions, already deployed in production. First choices for new projects.',
  trial:  'Pertinence demonstrated. You can use it on your project but must justify not using the default choice.',
  assess: 'May bring value. Needs to be assessed and tested in our environment to confirm or reject this vision.',
  hold:   'For various reasons these solutions are no longer recommended — use only for maintenance of existing code.',
};
