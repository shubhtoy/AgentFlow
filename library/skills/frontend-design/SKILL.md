---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with bold aesthetic direction. Design thinking before coding. Anti-AI-slop aesthetics with intentional typography, color, spacing, and animation.
---

# Frontend Design

## Philosophy

Most AI-generated UIs look the same: rounded corners, pastel gradients, generic sans-serif fonts, card-based layouts with drop shadows. This is AI slop. It signals "nobody designed this."

Distinctive interfaces require intentional decisions. Every visual choice — typeface, color, spacing, motion — must serve the content and the user. Design thinking comes before code.

## Design Thinking Phase

Before writing any markup or styles, answer these questions:

### 1. Who Is the User?

- What is their technical sophistication?
- What device and context are they using? (desktop focus, mobile-first, kiosk, dashboard)
- What is their emotional state? (stressed, exploring, transacting, monitoring)
- What accessibility needs must be met?

### 2. What Is the Core Action?

Every interface has one primary action. Identify it:

- A form: the submit button
- A dashboard: the key metric
- A list: the item selection
- An article: the reading flow

Everything else is secondary. Design the hierarchy to make the primary action unmissable.

### 3. What Is the Brand Personality?

Choose 2-3 adjectives that define the aesthetic:

| Personality | Visual Expression |
|------------|-------------------|
| **Technical** | Monospace type, high contrast, dense information, minimal decoration |
| **Warm** | Rounded shapes, warm palette, generous whitespace, friendly copy |
| **Premium** | Restrained palette, fine typography, ample negative space, subtle motion |
| **Playful** | Bold color, asymmetric layouts, animated interactions, expressive type |
| **Utilitarian** | System fonts, compact layout, visible borders, no decoration |

## Typography

Typography is the single most impactful design decision. Get this right and the rest follows.

### Hierarchy

Establish exactly 4-5 type sizes. No more.

```
Display:  2.5-4rem    — Hero headlines only
Heading:  1.5-2rem    — Section titles
Subhead:  1.125-1.25rem — Subsection titles
Body:     1rem        — Primary content
Small:    0.875rem    — Captions, metadata, secondary info
```

### Font Selection

- **One typeface is enough.** Use weight and size for hierarchy, not multiple fonts.
- **Two typefaces maximum.** One for headings, one for body. They must contrast (serif + sans, geometric + humanist).
- **System fonts are fine.** `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` is fast and familiar.
- **If choosing a custom font, be intentional.** Inter for neutral clarity. JetBrains Mono for code. Fraunces for editorial warmth. Not "whatever Google Fonts suggests."

### Line Length and Spacing

- **Line length:** 45-75 characters per line. Use `max-width: 65ch` on text containers.
- **Line height:** 1.5-1.7 for body text. 1.1-1.3 for headings.
- **Paragraph spacing:** Use `margin-bottom` equal to the line height.

## Color

### Build a Palette

Start with 3 colors:

1. **Primary** — The brand color. Used for CTAs, links, active states.
2. **Neutral** — The background/text spectrum. 5-7 shades from near-white to near-black.
3. **Accent** — Sparingly used for alerts, highlights, badges.

### Contrast Requirements

- Body text: minimum 4.5:1 contrast ratio (WCAG AA)
- Large text (18px+): minimum 3:1
- Interactive elements: minimum 3:1 against adjacent colors
- Never rely on color alone to convey meaning — use icons, patterns, or text labels

### Anti-Slop Color Rules

- Do not use pastel gradients as backgrounds
- Do not use more than 3 hues on a single screen
- Do not use opacity/transparency as a substitute for choosing a real color
- Dark mode is not "invert everything" — redesign the palette for dark backgrounds

## Spacing

### Use a Scale

Pick a base unit (4px or 8px) and derive all spacing from it:

```
4px   — Tight: between icon and label
8px   — Compact: between related elements
16px  — Standard: between form fields, list items
24px  — Relaxed: between sections within a card
32px  — Loose: between cards, major sections
48px  — Spacious: between page sections
64px+ — Dramatic: hero sections, page margins
```

### Spacing Principles

- **Group related items tightly.** Unrelated items get more space.
- **Whitespace is not wasted space.** It creates hierarchy and breathing room.
- **Consistent spacing is more important than perfect spacing.** Use the scale.
- **Padding inside containers should be proportional to the container size.**

## Layout

### Choose a Layout Strategy

- **Single column** — Articles, forms, settings. Max-width centered.
- **Sidebar + content** — Dashboards, admin panels, documentation.
- **Grid** — Card collections, galleries, product listings.
- **Split screen** — Comparison views, editor + preview.

### Responsive Approach

1. Design for the primary device first (usually mobile or desktop — pick one)
2. Define 2-3 breakpoints maximum: `640px`, `1024px`, `1440px`
3. Use CSS Grid or Flexbox — not both in the same component
4. Stack columns on mobile. Do not shrink desktop layouts into illegibility.

## Animation and Motion

### Purpose-Driven Motion

Every animation must serve one of these purposes:

1. **Feedback** — Confirm an action occurred (button press, form submit)
2. **Orientation** — Show where something came from or went to (page transition, modal open)
3. **Focus** — Draw attention to a change (notification, error state)
4. **Delight** — Reward completion (success animation, progress celebration) — use sparingly

### Motion Guidelines

- **Duration:** 150-300ms for micro-interactions. 300-500ms for transitions. Never exceed 1s.
- **Easing:** Use `ease-out` for entrances, `ease-in` for exits, `ease-in-out` for state changes. Never use `linear` for UI motion.
- **Respect preferences:** Always check `prefers-reduced-motion` and disable non-essential animation.
- **Animate transforms and opacity only.** Animating layout properties (width, height, margin) causes jank.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Component Design

### Buttons

- Primary action: filled, high contrast
- Secondary action: outlined or ghost
- Destructive action: red/danger color, requires confirmation
- Disabled state: reduced opacity + `cursor: not-allowed` + `aria-disabled`
- Loading state: spinner or skeleton, disable interaction

### Forms

- Labels above inputs, not beside (better for scanning and mobile)
- Visible focus indicators on all interactive elements
- Inline validation on blur, not on every keystroke
- Error messages adjacent to the field, not in a toast
- Required fields marked with `*` and `aria-required`

### Tables

- Align numbers to the right
- Align text to the left
- Use zebra striping OR horizontal rules, not both
- Make columns sortable if the data is comparable
- Truncate long content with `text-overflow: ellipsis` and a tooltip

## Accessibility Checklist

- [ ] All images have `alt` text (decorative images use `alt=""`)
- [ ] All interactive elements are keyboard accessible
- [ ] Focus order follows visual order
- [ ] Color is not the only indicator of state
- [ ] Contrast ratios meet WCAG AA minimums
- [ ] Form inputs have associated labels
- [ ] Error messages are announced to screen readers
- [ ] Motion respects `prefers-reduced-motion`
- [ ] Touch targets are at least 44x44px on mobile
- [ ] Page has a logical heading hierarchy (h1 > h2 > h3)

## Anti-AI-Slop Checklist

Before shipping, verify your interface does NOT have:

- [ ] Generic card layouts with identical border-radius and drop shadows
- [ ] Pastel gradient backgrounds with no design rationale
- [ ] More than 2 typefaces
- [ ] Decorative illustrations that add no information
- [ ] "Powered by AI" badges or sparkle emojis
- [ ] Rounded avatars in a grid as the hero section
- [ ] Glassmorphism or neumorphism used as the primary design language
- [ ] Animations on every element
- [ ] A color palette that looks like every other SaaS landing page

## Implementation Order

1. **Content first** — Write the actual content. Real words, not lorem ipsum.
2. **HTML structure** — Semantic markup with proper heading hierarchy.
3. **Typography** — Set the type scale, line heights, and font.
4. **Layout** — Position elements with Grid/Flexbox.
5. **Color** — Apply the palette.
6. **Spacing** — Apply the spacing scale.
7. **Interactivity** — Add hover states, focus styles, transitions.
8. **Responsive** — Adapt for other screen sizes.
9. **Polish** — Micro-interactions, loading states, empty states, error states.
