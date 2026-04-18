# Async Copilot — Design System

**Source**: extracted from `docs/design/variant-exports/01-landing/index.html` (Tailwind v3.4.17 compiled output). Cross-checked with 02-new-case, 03-live-triage-run, 04-completed-run, 05-runs-list, 06-samples.

**Style DNA**: monochrome workspace aesthetic — black/white/gray base, surgical red for urgency/escalation, amber/green for status chips. Generous whitespace, precise typographic rhythm, subtle grid background on marketing surfaces.

---

## 1. Colors

### Base palette (Tailwind gray scale — used as-is)

| Token | Tailwind | Hex | Usage |
|---|---|---|---|
| `surface` | `bg-gray-50` | `#F9FAFB` | Page background |
| `surface-elevated` | `bg-white` | `#FFFFFF` | Cards, modals, header |
| `border-subtle` | `border-gray-200` | `#E5E7EB` | Default borders, dividers |
| `border-strong` | `border-gray-400` | `#9CA3AF` | Hover states on borders |
| `text-muted` | `text-gray-500` | `#6B7280` | Secondary text, nav inactive |
| `text-secondary` | `text-gray-600` | `#4B5563` | Body paragraphs |
| `text-primary` | `text-gray-900` | `#111827` | Main content |
| `text-strong` | `text-gray-950` | `#030712` | Headlines |

### Brand / interactive

| Token | Tailwind | Hex | Usage |
|---|---|---|---|
| `brand` | `bg-black` | `#000000` | Primary CTAs, logo mark |
| `brand-hover` | `hover:bg-gray-800` | `#1F2937` | Primary CTA hover |
| `selection-bg` | `selection:bg-gray-200` | `#E5E7EB` | Text selection |

### Semantic / status

| Token | Tailwind | Hex | Usage |
|---|---|---|---|
| `danger` | `text-red-600` / `bg-red-600` | `#DC2626` | Urgency high, escalation, critical actions |
| `danger-subtle` | `bg-red-50` / `border-red-200` | `#FEF2F2` / `#FECACA` | Destructive zones, escalation callouts |
| `warning` | `text-amber-600` / `bg-amber-100` | `#D97706` / `#FEF3C7` | Medium urgency, waiting states |
| `success` | `text-green-600` / `bg-green-100` | `#16A34A` / `#DCFCE7` | Resolved, approved, passing checks |
| `info` | `text-blue-600` / `bg-blue-100` | `#2563EB` / `#DBEAFE` | System processing, active runs |

**Decision for MVP**: urgency uses **red** everywhere (plan-mandated consolidation — no amber/red drift across screens).

---

## 2. Typography

### Font families (via `next/font/google`)

```ts
// next/font/google imports
import { Inter, JetBrains_Mono } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-sans' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-mono' })
```

| Family | Usage | Tailwind class |
|---|---|---|
| **Inter** | All UI text, headings, body | `font-sans` |
| **JetBrains Mono** | Section labels (CASE CONTEXT, VISIBLE TRIAGE), IDs (CASE-8924, INV-9823), code-like values, status chips | `font-mono` |

### Type scale (Tailwind defaults + one custom)

| Role | Class | Size | Usage |
|---|---|---|---|
| Display | `text-5xl md:text-6xl lg:text-[64px]` | 48 → 60 → 64 | Hero H1 |
| H1 | `text-4xl` → `lg:text-4xl` | 36 / 40 lh | Screen titles |
| H2 | `text-2xl` | 24 | Section titles |
| H3 | `text-xl` | 20 | Card titles |
| Body L | `text-lg md:text-xl` | 18 / 20 | Hero subcopy |
| Body | `text-base` | 16 | Default |
| Body S | `text-sm` | 14 | Nav, secondary info, buttons |
| Caption | `text-xs` | 12 | Meta, section labels, chips |

### Weights

- `font-normal` (400) — body
- `font-medium` (500) — buttons, nav, status chips
- `font-semibold` (600) — headlines, H1/H2
- `font-bold` (700) — logo wordmark, emphasis

### Tracking & leading

- Headlines: `tracking-tight leading-[1.1]` (hero), `leading-tight` (H1/H2)
- Body: default
- Monospace labels: `tracking-wider uppercase text-xs` (e.g. `CASE CONTEXT`)

---

## 3. Spacing & layout

### Scale

Use Tailwind default spacing (4px base). Common values:
- `gap-2` (8px), `gap-4` (16px), `gap-6` (24px), `gap-8` (32px), `gap-12` (48px)
- Card padding: `p-6` (24px) common, `p-8` (32px) for hero sections
- Section vertical rhythm: `py-20` (80px), `py-32` (128px) for hero

### Containers

| Token | Class | Use |
|---|---|---|
| Marketing narrow | `max-w-4xl mx-auto` | Hero text, narrow content |
| Marketing wide | `max-w-7xl mx-auto` | Full header/grid width |
| App content | `max-w-6xl mx-auto` | Intake form, detail pages |
| Signature 3-col | custom grid | Live triage lockup |

### Grids

- Marketing features: `grid md:grid-cols-3 gap-8`
- Signature screen (left/center/right): custom CSS grid, see Unit 6 plan
- Forms: `grid sm:grid-cols-2 gap-6`

---

## 4. Radii

| Token | Tailwind | Usage |
|---|---|---|
| `rounded-sm` | 2px | Logo mark square |
| `rounded` | 4px | Buttons |
| `rounded-md` | 6px | Inputs |
| `rounded-lg` | 8px | Cards |
| `rounded-xl` | 12px | Hero mockup cards |
| `rounded-full` | — | Status chip dots, avatar |

---

## 5. Shadows

| Token | Tailwind | Usage |
|---|---|---|
| `shadow-sm` | subtle | Buttons, inputs, small cards |
| `shadow` | default | Dropdowns |
| `shadow-md` | elevated | Modals |
| `shadow-lg` | floating | Hero mockup stack |
| `shadow-none` | — | Reset |

---

## 6. Transitions

All interactive elements: `transition-colors duration-150` default, `duration-200` for hover-lift.

```
Buttons:  transition-colors duration-200 + hover:bg-X + hover:-translate-y-0.5
Links:    transition-colors duration-150 + hover:text-black
Cards:    transition-all duration-300 + hover:shadow-md
```

---

## 7. Custom utilities (keep these in `globals.css`)

```css
/* Subtle grid background — hero sections */
.bg-grid {
  background-image:
    linear-gradient(to right, #f3f4f6 1px, transparent 1px),
    linear-gradient(to bottom, #f3f4f6 1px, transparent 1px);
  background-size: 40px 40px;
}

/* Slim scrollbar in mockups */
.mockup-scroll::-webkit-scrollbar { width: 4px; }
.mockup-scroll::-webkit-scrollbar-track { background: transparent; }
.mockup-scroll::-webkit-scrollbar-thumb { background-color: #E5E7EB; border-radius: 20px; }

/* Font smoothing — body default */
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

---

## 8. Component recipes

### Primary button

```tsx
<button className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-black rounded hover:bg-gray-800 transition-colors shadow-sm">
  Open App
</button>
```

### Secondary button

```tsx
<button className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded hover:border-gray-400 transition-colors">
  View Demo Case
</button>
```

### Destructive button (escalation)

```tsx
<button className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors">
  Approve & Escalate to Tier 2
</button>
```

### Section label (monospace caption)

```tsx
<span className="font-mono text-xs uppercase tracking-wider text-gray-500">
  Case Context
</span>
```

### Status chip (green/success)

```tsx
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium font-mono uppercase tracking-wider text-green-700 bg-green-100 rounded">
  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
  Ready
</span>
```

### Status chip (red/escalation)

```tsx
<span className="inline-flex items-center px-2 py-0.5 text-xs font-medium font-mono uppercase tracking-wider text-red-700 bg-red-100 rounded">
  Escalation Required
</span>
```

### Card

```tsx
<div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
  …
</div>
```

### Input / textarea

```tsx
<textarea className="w-full px-4 py-3 text-sm text-gray-900 bg-white border border-gray-200 rounded-md focus:border-gray-400 focus:ring-0 focus:outline-none transition-colors" />
```

---

## 9. Icon library

**@phosphor-icons/react** — all weights available, but stick to 2 for consistency:
- **`regular`** (default) — most UI icons
- **`bold`** — nav, headers, primary emphasis

Size convention:
- Inline with text: match `em` (no explicit size)
- Standalone nav/button: `size={16}` or `size={20}`
- Hero / mockup: `size={24}`+

Commonly used in mockups (from 6 screens): `List`, `House`, `FileText`, `Lightning`, `CheckCircle`, `Warning`, `Clock`, `Envelope`, `User`, `ArrowRight`, `Copy`, `Pencil`, `PaperPlaneTilt`, `Gear`, `Bell`, `MagnifyingGlass`, `CaretDown`, `CheckSquare`, `XCircle`, `Info`, `Export`.

---

## 10. Accessibility baselines

- Minimum contrast: WCAG AA (all text ≥ 4.5:1 against background)
- Focus rings: `focus:ring-2 focus:ring-gray-900 focus:ring-offset-2` (not used in Variant mock, add during implementation)
- Semantic HTML: `<nav>`, `<main>`, `<section>`, `<button>` (not `<div onClick>`)
- `aria-label` on icon-only buttons

---

## 11. Plan-mandated copy fixes

Apply during portering of each screen — **these are not in current Variant HTML**:

| Screen | Original | Replace with |
|---|---|---|
| Landing | `Messy content in` | `Messy case in` |
| Landing | `Integrates seamlessly with Zendesk, Intercom, and Jira` | *(remove entirely)* |
| Landing | `Start Workspace Trial` | `Open Demo` |
| Landing | `Talk to Sales` | `Contact` |
| App nav | `Knowledge Base` item | *(remove — R21 out of scope)* |
| Completed run | `Approve Pack & Execute Actions` | `Approve Pack & Queue Actions` |
| Runs list | `Today's Digest` rail | *(remove — R21 out of scope)* |

---

**This document is the canonical reference for all UI decisions.** Every component built afterward must reference tokens/recipes here. If a screen needs a token not documented, add it here first, then use.
