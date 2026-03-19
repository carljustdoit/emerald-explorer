# Emerald Explorer Design System Reference

When working on UI changes in this project, follow these design patterns and CSS conventions exactly.

---

## Color Modes

Two modes controlled by the presence of `solo-mode` class on `<body>` (set in `App.jsx`):

### Light Mode — Parenting / Family (default)
```css
--bg-primary: #f5f3ef        /* warm beige page background */
--bg-secondary: #ece9e3      /* slightly darker sections */
--accent-primary: #2d6a4f    /* forest green — buttons, active states, headers */
--text-strong: #1a1a1a       /* near-black body text */
--text-muted: #8a8780        /* taupe — labels, captions, secondary */
--glass-border: rgba(0,0,0,0.07)
/* Glass card background: rgba(255,255,255,0.72) + backdrop-filter: blur(24px) saturate(180%) */
```

### Dark Mode — Solo / Personal (.solo-mode on body)
```css
--solo-bg: #0c0f1a           /* deep navy page background */
--solo-accent: #c8e66e       /* lime green — buttons, active states */
--solo-text-strong: #e8e6e1  /* off-white body text */
--solo-text-muted: #6b7280   /* muted labels */
/* Glass card background: rgba(20,24,37,0.82) + backdrop-filter: blur(24px) saturate(180%) */
```

Always write dark-mode overrides using `.solo-mode .your-class { }` — never use `@media (prefers-color-scheme)`.

---

## Typography

| Use | Font | Weight | Size |
|-----|------|--------|------|
| Page titles (`<h1>`) | Outfit | 700–800 | 28px |
| Section headers (`<h2>`) | Outfit | 700 | 24px |
| Card titles | Outfit | 600 | 16–18px |
| Section labels (caps) | Inter | 600 | 12px, letter-spacing: 0.04em, text-transform: uppercase |
| Body / descriptions | Inter | 400–500 | 14–15px |
| Captions / meta | Inter | 500 | 11–13px |

Letter-spacing on headings: `-0.01em` to `-0.03em` (tight, never loose).

---

## Glass Cards

The `.glass` utility class is the standard card surface. Apply it to any section container:

```css
.glass {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(0, 0, 0, 0.07);
}
.solo-mode .glass {
  background: rgba(20, 24, 37, 0.82);
  border-color: rgba(255, 255, 255, 0.06);
}
```

Never use solid white or dark backgrounds for cards — always glass.

---

## Border Radius

```css
--radius-xl: 20px   /* main cards, map containers, large sections */
--radius-lg: 14px   /* sub-sections, inner panels */
--radius-md: 10px   /* buttons, tags, pills */
--radius-sm: 8px    /* small chips */
```

---

## Spacing

- Page gap between sections: `24px`
- Section internal padding: `20px 24px`
- Card internal gap: `14–16px`
- Item gap in lists: `20–28px`
- Bottom page padding: `100px` (clears fixed bottom nav)

---

## Buttons

### Primary action button
```css
background: var(--accent-primary);
color: white;
border: none;
border-radius: var(--radius-md);
padding: 10px 20px;
font-size: 14px;
font-weight: 600;
transition: var(--transition-smooth);

/* solo-mode override */
.solo-mode → background: var(--solo-accent); color: black;
```

### Outlined / ghost button
```css
background: transparent;
border: 1px solid var(--accent-primary);
color: var(--accent-primary);
border-radius: var(--radius-md);

/* solo-mode override */
.solo-mode → border-color: var(--solo-accent); color: var(--solo-accent);
```

### Category / filter pill buttons
```css
padding: 8px 16px;
border-radius: 12px;
border: 1px solid var(--glass-border);
background: rgba(0,0,0,0.03);
color: var(--text-muted);
font-size: 13px;
font-weight: 500;
white-space: nowrap;

/* Active state */
.active → background: var(--accent-primary); color: white; border-color: var(--accent-primary);
/* solo-mode active → background: var(--solo-accent); color: black; */
```

---

## Transitions

```css
--transition-smooth: all 0.35s cubic-bezier(0.16, 1, 0.3, 1)  /* elastic — card reveals, panel slides */
--transition-fast:   all 0.2s ease                              /* quick interactions — button hover */
```

Always use `var(--transition-smooth)` for layout/visibility changes and `var(--transition-fast)` for hover micro-interactions.

---

## Section Header Pattern

Accent-colored icon + label used at the top of every section:

```jsx
<div className="section-header">
  <IconName size={16} />
  <span>Section Title</span>
</div>
```
```css
.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--accent-primary);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin-bottom: 16px;
}
.solo-mode .section-header { color: var(--solo-accent); }
```

---

## Icons

Use **Lucide React** exclusively. Standard sizes:
- Section headers: `size={16}`
- Navigation: `size={22}`
- Inline with text: `size={12}–{14}`
- Standalone action icons: `size={18}–{20}`

---

## Navigation

Fixed bottom bar (`z-index: 1000`), glassmorphic, safe-area-inset aware. Routes:
- `/` — Home
- `/discovery` — Discover
- `/settings` — Settings
- `/admin` — Admin (admin role only)

Do not add top navigation. All navigation lives at the bottom.

---

## Map Style

- Tile layer: CartoDB Voyager — `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`
- Map height: `300px` in cards
- Border radius on map container: `16px`
- `scrollWheelZoom={false}` always
- Route line: solid, `weight={4}`, `opacity={0.85}`, color `#2d6a4f` (light) / `#c8e66e` (solo)
- Auto-zoom via `MapController` component using `useMap()` + `fitBounds`

---

## Inline Styles vs CSS

All component styles are written as `<style>` blocks inside the component JSX (not external `.css` files or CSS modules). Follow this pattern:

```jsx
const MyComponent = () => {
  return (
    <div className="my-component">
      ...
      <style>{`
        .my-component { ... }
        .solo-mode .my-component { ... }
      `}</style>
    </div>
  );
};
```

Global CSS variables and the `.glass` utility live in `src/index.css`.

---

## Do Not

- Do not use `text-transform: uppercase` on titles or headings (removed intentionally)
- Do not use `@media (prefers-color-scheme)` — modes are class-based
- Do not use external component libraries (Material UI, Tailwind, etc.)
- Do not use solid colored card backgrounds — always glass
- Do not add top navigation or sidebars
- Do not use emojis in UI text
