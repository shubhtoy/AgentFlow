# AgentFlow — Master Plan

**Status:** Planning locked · **Board:** https://github.com/users/shubhtoy/projects/4 · **Repo:** shubhtoy/AgentFlowTest
**Execution:** does not start until explicitly requested.

---

## What AgentFlow is

A visual authoring tool for AI agent workflows defined as directories of markdown. Author a
workflow graph → **export "compiles"** it to a portable, path-linked walkable directory plus a
per-host bootstrap, so any host agent (Kiro, Claude Code, Cursor, …) executes it step by step.

## Validated this session (real Kiro)

- **Directory-as-structure executes** — a fresh agent walks the node folders step by step, honors a human-approval gate, carries output forward. Confirmed on real Kiro.
- **`AGENTS.md` is auto-loaded** by hosts (Kiro confirmed; Linux Foundation standard, ~97k repos). The entry point is free — no custom mechanism.
- **Path-linked execution works** — `{{}}` is authoring-side; export resolves it to plain relative paths the agent just opens. No DSL to teach.
- **5-layer selectivity is preserved** — all target hosts allow on-demand arbitrary file read, so each layer loads at the right step. Only L0 is always-on.
- **Still unproven:** capability/tool binding (the agent used its own ambient tools in the test).

## Architecture

```
Author graph (studio)
      │  export "compiles"
      ▼
[ portable path-linked walkable directory ]  +  [ per-host L0 bootstrap ]  +  [ MCP/tool config ]
      │  host auto-loads L0 (AGENTS.md / CLAUDE.md / .cursor/rules)
      ▼
host agent walks the directory → L1–L4 load on demand → honors gates
```

### 5-layer context placement (the export's core rule)

| Layer | What | Placement | Loading |
|---|---|---|---|
| L0 Identity + contract | root AGENTS.md | always-on channel | always |
| L1 Workflow routing | workflow AGENTS.md | walkable dir | on-demand |
| L2 Node contract | SKILL.md + context files | walkable dir | on-demand (walk) |
| L3 Reference | instructions/capabilities/skills | walkable dir | on-demand (by path) |
| L4 Artifacts + memory | outputs, memory files | walkable dir | on-demand (at steps) |

**Hard rule:** never push L1–L4 or memory into an eager/always-on channel (Kiro `inclusion:always`, Claude `@import`/root CLAUDE.md, Cursor `alwaysApply:true`) — that flattens the layers and defeats the model.

## Engineering principles (Definition of Done for every task)

- Clean, readable code; **maximum reusability** (shared logic in core, no duplication).
- **Security reviewed** — no unauthenticated sensitive endpoints, no secret leakage, validated inputs.
- **Properly verified** — unit tests added per feature; build + typecheck + relevant tests green before "done".
- Match existing conventions; smallest correct change.

## Epics (see board for live status)

1. **Setup: Core Engine** `P0` — ref→path resolution, parser/graph hardening, validation
2. **Setup: Export / Compile Engine** `P0` — L0 contract gen, walkable-dir emitter, 5-layer rules + guardrail, native selectors
3. **Setup: Host Targets** `P0→P1` — Kiro, Claude Code, Cursor; rulesync/ruler as reference; fidelity checks
4. **Setup: Capabilities & MCP Binding** `P0` — capability test (highest risk), MCP config emission, binding strategy, memory
5. **Setup: MCP Execution Controller** `P2 later` — agent calls MCP for next step + options; enforced gates
6. **Setup: Packaging & Distribution** `P2 later` — OpenAPM-style install/versioning; Agent Spec runtime bridge (off critical path)
7. **Stabilization & Housekeeping** `P1` — fix 63 failing tests, library registry, stale docs, studio router-type dead code

**Critical path:** 1 → 2 → 3 (Kiro) → 4. Epics 5–6 later. Epic 7 runs alongside. Frontend/studio fixes are a follow-on track after the backend/export core.

## Key research conclusions (so they aren't relost)

- **The niche is empty:** nobody does graph/directory-as-orchestration + cross-host deployment. Flat-config tools (apm, rulesync, ruler) don't handle graphs; Agent Spec targets execution runtimes not IDEs; ICM is single-host; cc-sdd/Spec Kit use skills/commands not directory-walk.
- **Closest working blueprint = Amazon AIM** (internal): canonical agent-spec → per-host transform + MCP bundle + versioning. Microsoft `apm` is the closest public one but its agent primitive is a flat persona.
- **Reuse decision:** `rulesync`/`ruler`/`apm` = reference only, never a dependency (flat-file, no graph model). Borrow their per-host placement/format knowledge.
- **Agent Spec compliance (~31% today) is NOT on the critical path** — only needed for the runtime-framework bridge (LangGraph/WayFlow), not the validated IDE/directory-walk product.
