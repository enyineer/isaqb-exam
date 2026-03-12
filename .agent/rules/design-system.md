---
trigger: model_decision
description: This rule should be applied whenever you're creating or updating UI components.
---

# Design System Rule

Before creating or modifying any UI component, you **MUST** read and follow the design system at `design-system/isaqb-mock-exam/MASTER.md`.

## Requirements

1. **Read first** — Open and review `MASTER.md` before writing any component code
2. **Use theme variables** — All colors must use `--theme-*` CSS variables, never hardcoded hex values
3. **Use correct fonts** — Outfit for headings, Work Sans for body, loaded via `api.fonts.coollabs.io`
4. **Follow component patterns** — Reuse `.option-card`, `.category-btn`, and other established component classes
5. **Check page overrides** — If `design-system/pages/[page-name].md` exists, its rules take precedence over `MASTER.md`
