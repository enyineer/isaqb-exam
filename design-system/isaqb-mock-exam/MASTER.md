# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** iSAQB CPSA-F Mock Exam
**Generated:** 2026-03-12 21:10:00
**Category:** Educational Web Application

---

## Global Rules

### Color Palette

The app uses a **themeable color system** with four color schemes and light/dark mode support. Colors are defined via CSS custom properties with a two-tier indirection: `--theme-*` variables hold the actual values, and Tailwind-exposed `--color-*` variables reference them.

#### Color Themes

| Theme | Primary | Primary Light | Primary Dark | Accent | Accent Light |
|-------|---------|---------------|--------------|--------|--------------|
| **Ocean** (default) | `#1e40af` | `#3b82f6` | `#1e3a8a` | `#0ea5e9` | `#7dd3fc` |
| Forest | `#166534` | `#22c55e` | `#14532d` | `#10b981` | `#6ee7b7` |
| Sunset | `#c2410c` | `#f97316` | `#9a3412` | `#f59e0b` | `#fcd34d` |
| Violet | `#6d28d9` | `#8b5cf6` | `#5b21b6` | `#a855f7` | `#c4b5fd` |

#### Surface Colors (Light Mode)

| Role | Value | CSS Variable |
|------|-------|--------------|
| Surface | `#ffffff` | `--theme-surface` |
| Surface Alt | `#f1f5f9` | `--theme-surface-alt` |
| Surface Hover | `#e2e8f0` | `--theme-surface-hover` |
| Text | `#0f172a` | `--theme-text` |
| Text Muted | `#64748b` | `--theme-text-muted` |
| Text Inverse | `#f8fafc` | `--theme-text-inverse` |
| Border | `#cbd5e1` | `--theme-border` |
| Background | `#f8fafc` | `--theme-bg` |

#### Surface Colors (Dark Mode — class `.dark`)

| Role | Value | CSS Variable |
|------|-------|--------------|
| Surface | `#1e293b` | `--theme-surface` |
| Surface Alt | `#0f172a` | `--theme-surface-alt` |
| Surface Hover | `#334155` | `--theme-surface-hover` |
| Text | `#f1f5f9` | `--theme-text` |
| Text Muted | `#94a3b8` | `--theme-text-muted` |
| Border | `#334155` | `--theme-border` |
| Background | `#0f172a` | `--theme-bg` |

#### Status & Indicator Colors

| Role | Value | CSS Variable |
|------|-------|--------------|
| Success | `#16a34a` | `--color-success` |
| Error | `#dc2626` | `--color-error` |
| Warning | `#d97706` | `--color-warning` |
| Indicator Too Few | `#38bdf8` | `--color-indicator-too-few` |
| Indicator Correct | theme primary | `--color-indicator-correct` |
| Indicator Too Many | `#ef4444` | `--color-indicator-too-many` |

### Typography

- **Heading Font:** Outfit (weights 300–700)
- **Body Font:** Work Sans (weights 300–700)
- **Mood:** Professional, clean, educational, modern, approachable
- **Font Host:** Privacy-friendly Coolify proxy (`api.fonts.coollabs.io`)

**CSS Import:**
```css
@import url('https://api.fonts.coollabs.io/css2?family=Outfit:wght@300;400;500;600;700&family=Work+Sans:wght@300;400;500;600;700&display=swap');
```

**Font Assignment:**
```css
--font-heading: 'Outfit', system-ui, sans-serif;
--font-body: 'Work Sans', system-ui, sans-serif;
```

### CSS Framework

- **Tailwind CSS v4** via `@import "tailwindcss"` with `@theme` directive
- Custom components defined in `index.css` alongside Tailwind utilities

---

## Component Specs

### Option Cards (Answer Selection)

```css
.option-card {
  cursor: pointer;
  border: 2px solid var(--theme-border);
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  transition: all 0.2s ease;
  background: var(--theme-surface);
}

.option-card:hover {
  border-color: var(--theme-primary-light);
  background: var(--theme-surface-hover);
}

.option-card:focus-visible {
  outline: 3px solid var(--theme-primary-light);
  outline-offset: 2px;
}

.option-card[aria-checked="true"],
.option-card.selected {
  border-color: var(--theme-primary);
  background: color-mix(in srgb, var(--theme-primary) 8%, var(--theme-surface));
  box-shadow: 0 0 0 1px var(--theme-primary);
}
```

### Category Buttons (Pill Buttons)

```css
.category-btn {
  cursor: pointer;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
  border: 2px solid var(--theme-border);
  background: var(--theme-surface);
  color: var(--theme-text);
  transition: all 0.2s ease;
}

.category-btn.active {
  background: var(--theme-primary);
  color: white;
  border-color: var(--theme-primary);
}
```

### Page Transitions

- **Page enter:** Fade + slide up (`translateY(8px)`, 300ms ease-out)
- **Question forward:** Slide in from right (`translateX(30px)`, 300ms ease-out)
- **Question back:** Slide in from left (`translateX(-30px)`, 300ms ease-out)
- **Question exit:** Slide out in opposite direction (250ms ease-in)

### Custom Scrollbar

- Width: 8px (vertical), 4px (horizontal with `.scrollbar-thin`)
- Track: `--theme-bg-alt`
- Thumb: `--theme-border`, rounded 4px
- Supports `scrollbar-width: thin` for Firefox

---

## Style Guidelines

**Style:** Clean Educational UI

**Keywords:** Professional, accessible, clean, modern, educational, certification, exam, responsive

**Best For:** Educational platforms, exam preparation, quiz apps, certification tools

**Key Effects:** Subtle transitions (200ms ease), theme-aware color mixing (`color-mix()`), directional slide animations for question navigation

### Design Principles

1. **Theme-aware** — All colors reference CSS variables so color themes and dark mode work automatically
2. **Accessible** — Focus-visible outlines, skip links, keyboard navigation, `prefers-reduced-motion` respected
3. **Consistent** — Option cards and category buttons use the same border/hover/active pattern
4. **Privacy-first** — Self-hosted analytics, privacy-friendly font proxy (no Google Fonts direct)

---

## Anti-Patterns (Do NOT Use)

- ❌ **Google Fonts directly** — Use `api.fonts.coollabs.io` proxy
- ❌ **Hardcoded colors** — Always use theme CSS variables
- ❌ **Emojis as icons** — Use SVG icons (Lucide React)
- ❌ **Missing cursor:pointer** — All clickable elements must have `cursor: pointer`
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150–300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use Lucide React SVGs)
- [ ] All colors use theme CSS variables, not hardcoded hex
- [ ] `cursor: pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150–300ms)
- [ ] Text contrast 4.5:1 minimum in both light and dark mode
- [ ] Focus-visible states for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Fonts loaded via `api.fonts.coollabs.io` (not Google Fonts)
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
- [ ] Print styles work correctly (`@media print`)
