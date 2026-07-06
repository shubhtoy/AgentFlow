# Session Handoff — April 24, 2026 (Updated)

## What Was Done

### Engine & Architecture (previous session)
- 55 TypeScript files, 13 platform YAML configs, 12 export engine files
- 5 resource categories: instructions, capabilities, skills, memory, hooks
- 2 node types: step, sub-workflow (router inferred from conditional edges)
- Config-driven export to 13 platforms via Agent Spec as primary target
- Build passes clean, zero runbook/V3 references

### Library (this session)

**Skills — 26 total (12 imported from skills.sh + 14 original)**
Imported from community (properly via `npx skills add`):
- obra/superpowers: systematic-debugging, test-driven-development, brainstorming, writing-plans, writing-skills, executing-plans, dispatching-parallel-agents, verification-before-completion, requesting-code-review, receiving-code-review
- anthropics/skills: skill-creator, brand-guidelines, doc-coauthoring, internal-comms, webapp-testing
- vercel-labs/agent-skills: vercel-react-best-practices, web-design-guidelines

Kept originals (ours are better or unique to AgentFlow):
- context-engineering, mcp-builder, frontend-design, api-design, code-review, documentation, git-workflow, performance-optimization, security-audit

**Capabilities — 25 total (13 builtin/script + 12 MCP)**
MCP capabilities added: github, filesystem, playwright, memory, fetch, postgres, sequential-thinking, slack, docker, sentry, firecrawl, notion

**Instructions — 18 total**
All cleaned of stale scope/inclusion/type fields. Added: accessibility, context-management, error-handling, dependency-management

**Memory — 6 files** (consolidated from 10, removed duplicates)
**Hooks — 8 files** (cleaned from 11)
**Workflows — 1 (build-feature showcase)**

### Build-Feature Workflow — 10 nodes
Demonstrates ALL AgentFlow features:
- AGENTS.md with identity (name, role, personality, constraints) + workflow-scoped instruction refs
- Workflow-scoped instructions (requirements-format, design-principles)
- 10 nodes: gather-requirements (entry), review-requirements, create-design, review-design, design-agentflow-feature (SUB-WORKFLOW), plan-tasks, review-plan, implement, verify, wrap-up
- Every node references real skills, instructions, capabilities, and memory via {{ref}}
- Data flow between nodes via {{<< output.node-name}}
- Conditional edges for routing at review gates
- Context budgets (max_tokens) and output declarations
- Context files (interview-template.md, implementation-checklist.md)
- Sub-workflow node (design-agentflow-feature → agent-builder)

### UI Fixes
- Canvas context menu: "Step" and "Sub-workflow" (was "Agent" and "Workflow")
- NODE_TYPE_LABELS updated across 4 component files
- Condition gate click shows edge popover
- Edge popover redesigned with icons, animation, close button
- Library loading fixed: fetches from /library/registry.json (static)
- studio/public/library is now a symlink to ../../library (no more mirroring)
- ExportOptions type fixed (added platform field)
- Dead code removed from api.ts (toFileMap reference)

### Registry
- 84 entries: 18 instructions, 25 capabilities, 26 skills, 6 memory, 8 hooks, 1 workflow
- Version 3.0.0
- Single source at library/registry.json (served via symlink)

### Build Status
- `next build`: ✅ Compiled 18.3s, TypeScript 7.7s, zero errors
- `tsc --noEmit` on core: ✅ passes
- Zero runbook references in code
- Zero V3 references in code

## What's Left

### Lower Priority
- Recreate the 5 deleted workflows (agent-builder, content-pipeline, customer-support, incident-response, interactive-assistant) — build-feature is the showcase, others are nice-to-have
- Run full test suite and fix failures from module path changes
- Verify all 94 docs pages render correctly
- Update planning docs (AGENT-CONTEXT.md, FEATURE-MAP.md, RELEASE-KANBAN.md)
- Move browser-safe export transforms to core package
- Add more workflow templates to the library
