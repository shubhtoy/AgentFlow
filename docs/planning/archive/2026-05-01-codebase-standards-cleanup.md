# Codebase Standards Cleanup — Design Spec

**Date:** 2026-05-01
**Status:** Draft
**Scope:** Fix 12 issues identified in code review — tooling, structure, hygiene

---

## Problem

Code review identified 12 issues across tooling, architecture, and hygiene. Most are low-risk mechanical fixes. The store duplication and oversized components are the highest-impact items but also the riskiest — those are scoped conservatively.

## Non-Goals

- Rewriting the monolith store (1021 lines, 295 references across 44 files). That's a separate project.
- Splitting the large components (Canvas 925 LOC, MCPPanel 886 LOC). Those need per-component design work.
- Adding full CI/CD pipeline. We add a basic GitHub Actions workflow only.

## Changes

### Phase 1: Tooling & Config Fixes (safe, no behavior change)

**1. Add root `tsconfig.json`**
Create a root tsconfig that references the workspace packages. Add a `typecheck` script to root `package.json`.

**2. Fix `packages/core/package.json` main field**
Change `"main": "src/parser-core.js"` → `"main": "src/parser-core.ts"` (it's a TS-first package consumed via workspace aliases).

**3. Fix `.gitignore`**
Add: `**/.DS_Store`, `.watchman-cookie-*`, `studio/.env.local`, `*.tsbuildinfo` (already there but confirm).

**4. Fix workspace dependency specifier**
Change `"@agentflow/core": "*"` → `"@agentflow/core": "workspace:*"` in cli and studio package.json. Same for `@agentflow/cli`.

**5. Add GitHub Actions CI**
Basic workflow: install, lint, typecheck, test on push/PR to main.

### Phase 2: Code Hygiene (low risk)

**6. Move planning docs to `docs/planning/`**
Move 9 root-level planning markdown files into `docs/planning/`. Update any internal links.

**7. Convert test files to TypeScript**
Rename `tests/**/*.test.js` → `tests/**/*.test.ts`. Update vitest config include pattern. Fix any type errors that surface.

### Phase 3: Store Cleanup (medium risk)

**8. Remove dead `useNewStore` / sliced store**
The `studio/store/` directory with `create-store.ts` and slices is an incomplete migration used by exactly 1 component (LibraryBrowser). Remove it:
- Migrate LibraryBrowser's 6 `useNewStore` calls to `useAppStore`
- Delete `studio/store/create-store.ts` and `studio/store/slices/`
- Simplify `studio/store/index.ts` to just re-export from `../store`

This eliminates the confusing dual-store pattern. A proper store decomposition is a separate future project.

### Phase 4: Validator Split (medium risk)

**9. Split `validator.ts` into modules**
The 721-line validator has clear internal sections. Split into:
- `validator/rules.ts` — rule definitions and RULE_MAP
- `validator/structure.ts` — entry point, reachability, sub-workflow checks
- `validator/references.ts` — ref resolution, data flow, condition checks
- `validator/schema.ts` — frontmatter schema validation
- `validator/mcp.ts` — MCP server/tool validation
- `validator/context.ts` — context budget validation
- `validator/index.ts` — barrel that composes all validators and exports `validate()`

Existing public API (`validate()`, `ValidationResult`, `ValidationIssue`, `Severity`) stays identical.

---

## What We're NOT Doing (and why)

| Item | Reason |
|------|--------|
| Splitting monolith store | 295 refs in 44 files. Needs its own spec with incremental migration plan. |
| Splitting large components | Each component (Canvas, MCPPanel, etc.) needs individual analysis of what to extract. |
| Pinning exact dependency versions | `package-lock.json` already pins. Changing to exact in `package.json` is a style choice, not a bug. |
| Converting studio components to TS strict | They already are TS. The issue was test files only. |

## Verification

- `npm run lint` passes
- `npm test` passes (all existing tests)
- `npm run typecheck` passes (new script)
- `npm run build` succeeds
- No behavior changes — all changes are structural/organizational
