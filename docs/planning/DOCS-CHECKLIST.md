# Docs Content Improvement Checklist

> Generated 2026-04-23. Per-page audit of all 94 MDX docs pages.

## Available Components (globally registered, no imports needed)

| Component | Use for |
|-----------|---------|
| `<Callout type="info/warn/error">` | Tips, warnings, important notes |
| `<Steps>` + `<Step>` | Numbered procedures |
| `<Tabs>` + `<Tab>` | Multi-platform, multi-language content |
| `<Files>` + `<File>` + `<Folder>` | Directory structures |
| `<Accordion>` + `<Accordions>` | Collapsible FAQ/details |
| `<TypeTable>` | Schema/API type docs |
| `<Cards>` + `<Card>` | Navigation link grids |
| `<ImageZoom>` | Zoomable images |
| `<InlineTOC>` | Inline table of contents |
| `<Banner>` | Announcements |
| ` ```mermaid ` | Diagrams (auto-converted by remarkMdxMermaid) |
| `:::note` / `:::warning` / `:::danger` | Admonition directives (remarkAdmonition) |
| `:::steps` | Step directive syntax (remarkSteps) |
| npm install commands | Auto npm/yarn/pnpm/bun tabs (remarkNpm) |

---

## P0 — Broken / Misleading

- [ ] **contributing/architecture.mdx** — `<Files>` tree shows flat `src/` but codebase is `packages/core` + `packages/cli` monorepo. Rewrite completely.
- [ ] **contributing/docs.mdx** — Near-empty (1.7KB). Must document all components, plugins, writing patterns with examples.
- [ ] **contributing/development-setup.mdx** — Clone URL inconsistent, paths reference old `src/` structure.
- [ ] **contributing/parser-validator.mdx** — References `src/validator.js` instead of `packages/core/src/validator.js`.
- [ ] **guides/ci-cd.mdx** — Broken link: `/docs/guides/troubleshooting` → should be `/docs/troubleshooting`.
- [ ] **troubleshooting/faq.mdx** — Broken link: `/docs/guides/importing` → should be `/docs/guides/import-from-platform`.
- [ ] **troubleshooting/faq.mdx** — Uses `--target` flag but CLI uses `--platform`. Inconsistent.

## P1 — Component Upgrades

- [ ] **reference/cli.mdx** — Flat table, no examples. Convert to `<Tabs>` by category (Core/Git/MCP/Library/Studio) with usage examples.
- [ ] **reference/validation-rules.mdx** — Flat table of 23 rules. Group by category using `<Tabs>` or `<Accordions>`.
- [ ] **reference/shortcuts.mdx** — Flat table. Group by context using `<Tabs>` (Global/Canvas/Editor).
- [ ] **reference/fidelity.mdx** — Should use `<TypeTable>` for fidelity categories.
- [ ] **getting-started/installation.mdx** — Project structure is plain code block → convert to `<Files>`. Install commands should use remarkNpm auto-tabs.
- [ ] **authoring/cheatsheet.mdx** — 16KB, no components. Use `<Tabs>` or `<Accordions>` to manage length.
- [ ] **contributing/release-process.mdx** — No components. Use `<Steps>` for release procedure.
- [ ] **contributing/studio-components.mdx** — No components. Use `<TypeTable>` for component props.

## P2 — Consistency & Polish

- [ ] Unify GitHub clone URL across all pages (github.com/shubhtoy/agentflow)
- [ ] Unify CLI flag naming (`--platform` not `--target`) across all pages
- [ ] Verify all `<DocsPlayground>` / `<ComponentPreview>` instances render without JS errors
- [ ] Audit all cross-page links for 404s (2 broken found so far)
- [ ] **concepts/selective-context.mdx** — "Context Engineering Strategies" subsection could use `<Tabs>` for scannability
- [ ] **concepts/directory-as-architecture.mdx** — Framework comparison table could be an `<Accordion>`
- [ ] **concepts/references.mdx** — Should use `<TypeTable>` for the 5 ref types
- [ ] **concepts/resources.mdx** — Should use `<Tabs>` for the 5 resource categories
- [ ] **concepts/export.mdx** — Should use `<Tabs>` for export formats
- [ ] **concepts/identity.mdx** — Should use `<Tabs>` for workspace vs workflow identity
- [ ] **authoring/writing-resources.mdx** — Should use `<Tabs>` for resource types + `<TypeTable>` for frontmatter
- [ ] **authoring/hooks.mdx** — Should use `<TypeTable>` for hook schema fields
- [ ] **authoring/patterns.mdx** — Should use `mermaid` for pattern diagrams
- [ ] **authoring/mcp.mdx** — Should use `<Steps>` and `<Tabs>` for transport types
- [ ] **authoring/library.mdx** — Should use `<Steps>` for install/contribute flow
- [ ] **guides/debugging-workflows.mdx** — Should use `<Accordions>` for error categories
- [ ] **guides/git-integration.mdx** — Should use `<Steps>` and `<Callout type="warn">` for conflicts
- [ ] **guides/import-from-platform.mdx** — Should use `<Tabs>` for source platforms
- [ ] **guides/custom-platform.mdx** — Should use `<Steps>` for creation process
- [ ] **studio/frontmatter.mdx** — Should use `<TypeTable>` for form field types
- [ ] **studio/git.mdx** — Should use `<Steps>` for git workflows, update for new Git Panel design
- [ ] **studio/export-dialog.mdx** — Should use `<Tabs>` for format options
- [ ] **contributing/platform-configs.mdx** — Should use `<TypeTable>` for config schema
- [ ] **reference/platform-configs.mdx** — Should use `<Tabs>` for each platform
- [ ] **reference/branding.mdx** — Should use `<TypeTable>` for config fields

## Pages Already Good ✅

These pages use components well and need no changes:
- index.mdx, getting-started/quickstart.mdx, getting-started/studio-tour.mdx
- concepts/index.mdx, concepts/workspaces.mdx, concepts/nodes.mdx
- concepts/directory-as-architecture.mdx, concepts/selective-context.mdx
- authoring/writing-nodes.mdx, authoring/directory-layout.mdx
- guides/first-workflow.mdx, guides/export-to-claude.mdx, guides/using-mcp-servers.mdx
- studio/index.mdx, studio/canvas.mdx, studio/editor.mdx, studio/copilot.mdx
- reference/frontmatter-schema.mdx, reference/node-types.mdx, reference/export-formats.mdx
- troubleshooting/common-errors.mdx, troubleshooting/faq.mdx (after link fixes)

---

*Last updated: 2026-04-23*
