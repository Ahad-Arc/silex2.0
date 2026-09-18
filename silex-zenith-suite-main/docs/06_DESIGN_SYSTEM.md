# UI/UX Design System — Silex Zenith Suite

## 1. Design Philosophy & Vision

The **Silex Zenith Design System** is crafted to deliver a state-of-the-art, hyper-modern dark-mode interface with high visual polished precision. It combines sleek dark backdrops, subtle glassmorphism, glowing accent gradients, accessible typography, and fluid micro-animations.

---

## 2. Color Palette & Theme Tokens

The design system uses CSS custom properties defined in `src/styles.css` tailored for Tailwind CSS v4:

```css
:root {
  --background: 222.2 84% 4.9%; /* Deep Slate Dark */
  --foreground: 210 40% 98%; /* Pure White Text */
  --card: 222.2 84% 6.5%; /* Dark Card Container */
  --popover: 222.2 84% 6.5%; /* Popover Surface */
  --primary: 217.2 91.2% 59.8%; /* Vibrant Sapphire Accent */
  --primary-foreground: 222.2 47.4% 11.2%;
  --secondary: 217.2 32.6% 17.5%; /* Slate Surface */
  --muted: 217.2 32.6% 17.5%; /* Muted Borders & Fill */
  --accent: 217.2 32.6% 17.5%; /* Highlight Accent */
  --destructive: 0 62.8% 30.6%; /* Crimson Red Error */
  --border: 217.2 32.6% 17.5%; /* Subtle Border Stroke */
  --radius: 0.75rem; /* 12px Rounded Corners */
}
```

### Gradients & Accents

- **Hero Title Gradient**: `bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400`
- **Glass Panel**: `bg-slate-900/60 backdrop-blur-xl border border-slate-800/80`
- **Glow Effect**: `shadow-[0_0_25px_rgba(59,130,246,0.15)]`

---

## 3. Typography & Layout Standards

- **Primary Font**: Sans-serif (`Inter`, system-ui, sans-serif).
- **Monospace Font**: Monospace (`Fira Code`, `JetBrains Mono`) for IDs, financial amounts, and invoice codes.
- **Hierarchy**:
  - `Display H1`: `text-4xl font-extrabold tracking-tight sm:text-5xl`
  - `Section H2`: `text-2xl font-bold tracking-tight`
  - `Card Header H3`: `text-lg font-semibold`
  - `Body Standard`: `text-sm text-slate-300 leading-relaxed`
  - `Muted / Label`: `text-xs font-medium text-slate-400 uppercase tracking-wider`

---

## 4. Component Catalog & Layout Blueprints

### 4.1. Core Application Shell (`AppShell`)

Located in `src/components/silex/app-shell.tsx`:

- Collapsible sidebar with active route indicator pills.
- Workspace switcher dropdown with logo avatar and plan badge.
- Top command menu bar (`Cmd + K` trigger).
- Integrated persistent floating AI Dock.

### 4.2. Floating AI Dock (`AIDock`)

Located in `src/components/silex/ai-dock.tsx`:

- Floating action button at bottom-right corner.
- Expandable glass panel with conversation message list, streaming prompt input, and model badge.

### 4.3. UI Primitives (`src/components/ui/`)

- Built on top of Radix UI primitives:
  - `Button`: Primary, Secondary, Outline, Ghost, Danger with loading spinner states.
  - `Dialog` & `Sheet`: Accessible modal dialogs and slide-out drawers.
  - `DropdownMenu`: Contextual dropdown menus for actions.
  - `Table`: Responsive data tables with sortable column headers and empty state graphics.
  - `Badge`: Status badges (`active`, `pending`, `overdue`, `completed`).
