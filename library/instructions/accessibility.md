---
name: accessibility
description: WCAG 2.1 AA compliance — semantic HTML, ARIA, keyboard navigation, color contrast, screen reader testing
domain: frontend
tags:
  - accessibility
  - a11y
  - wcag
  - frontend
---

# Accessibility

Build for everyone. Target WCAG 2.1 AA compliance as the minimum standard.

## Semantic HTML First

- Use the correct HTML element for its purpose: `<button>` for actions, `<a>` for navigation, `<nav>` for navigation regions
- Use heading hierarchy (`h1` → `h2` → `h3`) — never skip levels
- Use `<main>`, `<header>`, `<footer>`, `<aside>`, `<section>` for page landmarks
- Use `<ul>`/`<ol>` for lists, `<table>` for tabular data
- Don't use `<div>` or `<span>` when a semantic element exists

## ARIA Labels

- Add `aria-label` or `aria-labelledby` to interactive elements without visible text
- Use `aria-describedby` for supplementary descriptions (error messages, help text)
- Use `aria-live` regions for dynamic content updates (notifications, loading states)
- Use `role` attributes only when no semantic HTML element fits
- Don't add ARIA to elements that already have implicit roles — it's redundant

## Keyboard Navigation

- Every interactive element must be reachable via Tab key
- Use logical tab order — match the visual reading order
- Provide visible focus indicators on all focusable elements (never `outline: none` without replacement)
- Support Escape to close modals, dropdowns, and overlays
- Support Enter/Space to activate buttons and links
- Trap focus inside modals — don't let Tab escape to background content
- Provide skip links for repetitive navigation

## Color and Contrast

- Text contrast ratio: minimum 4.5:1 for normal text, 3:1 for large text (18px+ or 14px+ bold)
- Don't use color as the only way to convey information (add icons, text, or patterns)
- Test with color blindness simulators (protanopia, deuteranopia, tritanopia)
- Ensure UI is usable in high-contrast mode and forced-colors mode

## Images and Media

- Every `<img>` needs an `alt` attribute — descriptive for content images, empty (`alt=""`) for decorative
- Provide captions or transcripts for video and audio content
- Don't autoplay media with sound
- Ensure animations respect `prefers-reduced-motion`

## Forms

- Every input needs a visible `<label>` associated via `for`/`id`
- Group related inputs with `<fieldset>` and `<legend>`
- Show error messages inline, associated with the input via `aria-describedby`
- Don't rely solely on placeholder text as labels — it disappears on focus

## Testing Checklist

1. Navigate the entire page using only the keyboard
2. Test with a screen reader (VoiceOver, NVDA, or JAWS)
3. Run automated checks (axe, Lighthouse accessibility audit)
4. Verify color contrast with a contrast checker tool
5. Test at 200% zoom — layout should remain usable
6. Test with `prefers-reduced-motion: reduce` enabled
