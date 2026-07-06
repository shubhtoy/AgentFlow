# AgentFlow v2 — Critical Review

A senior engineering and business analysis review of the AgentFlow v2 idea, architecture, and implementation plan. This document evaluates whether the core concept is sound, whether the execution plan will deliver on it, and where the critical risks lie.

**Scope reviewed:** agentflow-v2 spec (requirements, design, tasks), ui-overhaul spec, ui-redesign-material spec, git-integration spec, authoring guide, library, examples, and context dump.

---

## 1. What AgentFlow Is

AgentFlow is a declarative, markdown-based DSL for defining AI agent workflows. The core bet:

- Folder structure is the architecture
- `{{ref}}` syntax with semantic prefixes encodes graph relationships
- YAML frontmatter provides optional typed metadata
- The whole thing is platform-agnostic — any AI system can consume the output

The system includes a parser, validator, exporter, pretty-printer, library manager, CLI, HTTP API, and a React-based visual editor.

---

## 2. What's Genuinely Good

### 2.1 Directory-as-architecture

The principle that your folder layout *is* your workflow architecture is sound and developer-friendly. It's inspectable with `ls`, version-controllable with git, and requires zero tooling to read. This is the strongest design decision in the project.

### 2.2 Five-layer context model

The layered approach to context management (Identity → Routing → Contract → References → Artifacts) with token budgets per layer is the right mental framework for LLM context management. Very few projects in this space think about context as a scarce resource. This is a genuine insight.

### 2.3 Progressive strictness

Frontmatter is optional. Any `.md` file dropped into the workspace works immediately. Validation is permissive by default, strict only when opted into. This is the correct DX gradient — low barrier to entry, structure when you want it.

### 2.4 Parser design

Path-first, name-second ref resolution is clean. The classification priority (frontmatter type → directory inference → untyped) is intuitive. The metadata-only parsing mode for progressive disclosure is well-thought-out.

### 2.5 Engineering rigor

The design document contains 32 formal correctness properties with requirement traceability. The testing strategy uses property-based tests (fast-check) alongside unit tests. The round-trip property (parse → pretty-print → parse equivalence) is the kind of thing that prevents subtle bugs. This is senior-level engineering discipline.

---

## 3. Critical Problems

### 3.1 No runtime execution model — the fatal gap

The entire system is designed to *define* agent workflows. But there is no mechanism to *execute* them.

The design says the output is "consumable by any AI system." But how? Who interprets the graph at runtime? Two possible models exist, and neither is addressed:

1. **The LLM reads the graph and self-navigates.** The agent loads AGENTS.md, understands the workflow structure, and decides which node to activate next. This requires the LLM to reliably follow multi-step procedural instructions, make correct routing decisions at branch points, and maintain state across long workflows. Current LLMs are unreliable at all three.

2. **An orchestrator loads nodes one at a time.** An external runtime reads the graph, determines the current node, loads only that node's context into the LLM prompt, collects the output, evaluates routing conditions, and advances to the next node. This would actually work — but it doesn't exist in the project.

Without a reference runtime, AgentFlow is a spec that nobody can reliably execute. This is the single most important thing to build, and it's not in any of the specs.

**Recommendation:** Build a minimal orchestrator (even 200 lines of Node.js) that walks the graph, loads one node at a time, calls an LLM API, evaluates conditions, and advances. This proves the format works. Everything else is secondary.

### 3.2 Target audience is undefined

The authoring guide opens with token budget optimization — a concern for AI infrastructure engineers. The UI specs describe drag-and-drop narrative scaffolding with slash commands — a concern for non-technical users.

These audiences want fundamentally different things:

| Audience | Wants | Doesn't want |
|----------|-------|--------------|
| Infra/platform engineer | Lean text format, CLI, git workflow, linting | Visual editors, drag-and-drop |
| Product/less-technical user | Visual builder, templates, no syntax | Token budgets, ref syntax, YAML |

The current plan tries to serve both and risks satisfying neither. The text format is too complex for casual users (four ref syntax types, frontmatter schemas, context budget sections). The visual editor is too heavy for power users who just want to edit markdown.

**Recommendation:** Declare the primary audience explicitly. If it's developers/infra engineers, kill the visual editor and ship a CLI-first tool. If it's broader users, simplify the format dramatically and lead with the visual builder.

### 3.3 Scope is 10x too large for validation

The project currently includes:

| System | Status |
|--------|--------|
| Markdown parser with custom ref syntax | Built |
| Frontmatter schema validation | Built |
| Graph builder from parsed refs | Built |
| JSON export | Built |
| Structured directory export (YAML/MD) | Built |
| Pretty-printer (round-trip) | Built |
| Library manager (registry, search, install) | Built |
| CLI (9+ commands) | Built |
| HTTP API server (8+ endpoints) | Built |
| React SPA with graph canvas | Built |
| Custom tiptap extensions (ref chips, slash commands, narrative blocks) | Built |
| Drag-and-drop (edges, resources, IO compatibility) | Built |
| Git integration (clone, sync, conflict resolution, mono-repo) | Built |
| Token calculator and dry-run system | Built |
| Theme support (light/dark/system) | Built |
| Material Design 3 redesign | Spec'd |
| Undo/redo system | Spec'd |
| Command palette | Built |

This is a full product, not a v2 of a POC. The core hypothesis — "can agents reliably follow markdown-defined workflows?" — remains unvalidated despite all this work. Every feature built before answering that question is a bet that the answer is yes.

**Recommendation:** Freeze feature development. Build the minimal runtime. Run the `build-feature` example end-to-end with a real LLM. Fix what breaks. Then decide what to build next based on what you learn.

### 3.4 Three contradictory UI visions

Three separate UI specs exist:

| Spec | Layout | Typography | Components | Panels |
|------|--------|------------|------------|--------|
| ui-overhaul | 3-panel fixed | Inter | Tailwind + custom | Floating overlays |
| ui-redesign-material | CSS Grid docked | Roboto | MUI v6 | Docked + drawer |
| CONTEXT-DUMP | Canvas-first | Inter | Tailwind | Floating + blur |

The Material Design spec explicitly calls out "floating panel chaos" as a problem with the current UI — then the CONTEXT-DUMP spec goes back to floating panels. The first spec uses Inter font and Tailwind; the second switches to Roboto and MUI.

This indicates the UI vision hasn't converged. Implementation work done against earlier specs will be thrown away when the next redesign lands.

**Recommendation:** Pick one direction and delete the other specs. If unsure, defer the UI entirely — the CLI and format are the core value.

### 3.5 The ref syntax is over-engineered

Four ref types with syntax-prefix-based semantic classification:

```
{{category/name}}                          → mention (load this resource)
{{-> category/name}}                       → edge (go here next)
{{-> category/name | templates/condition}} → conditional edge (go here IF)
{{<< output.nodeName}}                     → data flow (read previous output)
```

The distinction between mention and edge matters for graph construction but not for agent execution. The agent needs to know "what resources do I have?" and "where do I go next?" — not the graph-theoretic classification of each reference.

The conditional edge syntax is particularly heavy: `{{-> nodes/plan-tasks | templates/design-approved}}` requires a separate template file containing a `check` field. That's three levels of indirection for what could be:

```
{{-> nodes/plan-tasks}} (when: user approved the design)
```

Or even simpler — just put the condition inline in the node's "Next" section as prose. The LLM can evaluate "did the user approve?" without a formal template.

**Recommendation:** Consider simplifying to two ref types: `{{resource}}` (load this) and `{{-> node}}` (go here). Conditions can be inline text in the routing section. This cuts the parser complexity in half and makes authoring easier.

### 3.6 Context budgets are aspirational, not enforced

The authoring guide specifies token budgets per layer and per node:

> Layer 0 + Layer 1 + one active Layer 2 + its resolved Layer 3 refs should fit in ~5k-8k tokens.

Node SKILL.md files include context budget sections:

> This node costs ~3500 tokens fully loaded.

But nothing enforces these budgets. The `max_tokens` frontmatter field is metadata with no runtime effect. The "Do not resolve {{instructions/technical-design}} — belongs to a later node" instruction is a suggestion to the LLM, not a constraint.

Without enforcement, budgets will drift. Authors will add refs without updating estimates. Nodes will grow beyond their budgets. The progressive disclosure model breaks down.

**Recommendation:** If budgets matter (and they should), build enforcement into the runtime. The orchestrator should count tokens when assembling context and warn/error when a node exceeds its budget. The validator should compute actual token counts (using tiktoken or similar) and compare against declared budgets.

### 3.7 The library is untested hypotheses

The library contains 20 skills, 23 tools, 17 templates, 9 interactions, 4 memory types, and 5 workflows. None have been validated against real agent execution.

The skills read like human process documents:

> "Phase 1: Detect → Phase 2: Triage → Phase 3: Investigate → Phase 4: Mitigate"

An LLM reading this will produce reasonable-sounding output. But does the `systematic-debugging` skill actually make an agent debug better than without it? Does the `requirements-elicitation` skill produce better requirements? These are empirical questions with no data.

Building a large library before validating the format is premature optimization. You're creating inventory for a store that hasn't opened.

**Recommendation:** Cut the library to the `build-feature` workflow and its direct dependencies. Run it. Measure quality. Iterate on those specific skills until they demonstrably improve agent output. Then expand.

### 3.8 Git integration is premature

Git integration (clone, sync, conflict resolution, mono-repo support, agentic repos) is a feature for a mature product with a user base that needs collaboration. Building it now, before the core format is validated, is building distribution infrastructure for a product that doesn't have product-market fit yet.

**Recommendation:** Remove entirely. Users can use git directly on their `.agentflow/` directories. Revisit when you have users asking for it.

---

## 4. Architecture Risks

### 4.1 The parser is the wrong bottleneck to optimize

The parser is well-engineered with formal correctness properties, property-based tests, and round-trip guarantees. But parsing is not the hard problem. The hard problem is: given a parsed graph, how do you reliably execute it with an LLM?

The project has invested heavily in parse-time correctness (32 formal properties) and almost nothing in execution-time correctness. What properties should hold during execution? For example:

- "The agent shall not skip a review gate"
- "The agent shall not load context from a node it hasn't reached yet"
- "The agent shall terminate the implement loop when all tasks are marked complete"

These are the properties that matter for the product to work, and none of them are specified.

### 4.2 The export format may not be what consumers need

The export produces a self-contained JSON bundle (or structured directory) with all refs resolved inline. But different consumers need different things:

- An orchestrator runtime needs the graph topology and node content separately (to load one node at a time)
- A human reviewer needs the resolved narrative (to read the workflow as a story)
- A debugging tool needs the raw refs preserved (to trace resolution)

The current export format tries to serve all three and may serve none optimally. The structured export (graph.yaml + nodes/*.md + resources/*.yaml) is closer to what an orchestrator needs, but it resolves refs inline in node content, which means the orchestrator can't do lazy resolution.

### 4.3 Sub-workflows add complexity without proven value

Sub-workflow nodes (type: `sub-workflow`) with recursive parsing add significant complexity to the parser, validator, exporter, and UI. But the examples don't use them. The `build-feature` workflow is flat — no nesting.

If the primary workflow doesn't need nesting, it's likely that most workflows won't either. Sub-workflows can be added later when a real use case demands them.

---

## 5. Business Analysis

### 5.1 Competitive landscape

The agent workflow space is crowded and moving fast:

| Tool | Approach | Status |
|------|----------|--------|
| LangGraph | Python code-defined graphs with state machines | Production, large community |
| CrewAI | Role-based agent teams with task delegation | Production, growing |
| AutoGen | Multi-agent conversation patterns | Microsoft-backed, production |
| Rivet | Visual node-based AI workflow editor | Open source, visual-first |
| Flowise | Drag-and-drop LLM flow builder | Open source, low-code |
| n8n AI | Workflow automation with AI nodes | Production, large user base |

AgentFlow's differentiator is "markdown-native, directory-based, platform-agnostic." That's a real niche — none of the above use markdown as the primary authoring format. But it's a niche that appeals to a specific audience (developers who want version-controllable, inspectable workflow definitions), and that audience is small compared to the visual-builder market.

### 5.2 The platform-agnostic bet

"Consumable by any AI system" is the stated goal. But in practice, every AI system has its own execution model, tool-calling conventions, and state management. A workflow defined in AgentFlow would need an adapter for each target platform.

This is similar to how OpenAPI specs are "consumable by any HTTP client" — true in theory, but every client still needs generated code or a runtime adapter. The spec alone isn't enough.

Without at least one working adapter (e.g., "here's how to run an AgentFlow workflow with Claude/GPT/Gemini"), the platform-agnostic claim is theoretical.

### 5.3 What would make this valuable

The highest-value version of AgentFlow is:

1. A simple, well-documented format for defining agent workflows as markdown
2. A CLI that validates and exports workflows
3. A reference runtime that executes workflows against at least one LLM provider
4. 3-5 battle-tested workflow templates that demonstrably improve agent output
5. Documentation showing before/after: "here's what the agent does without a workflow, here's what it does with one"

That's a weekend project for the core, plus a few weeks of iteration on the workflows. Everything else — the visual editor, the library, git integration, theme support, undo/redo — is growth-stage work that should come after validation.

---

## 6. Prioritized Recommendations

### Tier 1 — Do immediately (validates the core hypothesis)

1. Build a minimal orchestrator runtime (~200-500 lines) that walks the graph and calls an LLM
2. Run the `build-feature` workflow end-to-end against a real codebase with a real LLM
3. Document what works and what breaks
4. Fix the format based on what you learn

### Tier 2 — Do next (makes the tool usable)

5. Simplify ref syntax to two types (resource reference + edge)
6. Add token counting to the validator (actual counts vs. declared budgets)
7. Cut the library to validated workflows only
8. Pick one UI direction or defer the UI entirely

### Tier 3 — Do later (growth features)

9. Visual editor (once the format is stable)
10. Expanded library (once workflows are validated)
11. Git integration (once you have users)
12. Platform adapters for specific LLM providers

### Tier 4 — Reconsider

13. Sub-workflow recursion (no proven use case)
14. IO contract compatibility checking (premature)
15. Narrative scaffolding (nice-to-have, not essential)
16. Multiple export formats (one is enough until users ask)

---

## 7. Summary

AgentFlow has a genuinely good core idea: markdown-native, directory-based agent workflow definitions with context budget awareness. The engineering quality is high — formal properties, property-based tests, clean parser design.

But the project has expanded far beyond what's needed to validate the core hypothesis. There's no runtime, no proof that agents can follow these workflows, and the scope includes three UI redesigns, git integration, and a 60+ item library — none of which matter if the format doesn't work in practice.

The single most important next step is building a minimal runtime and running a real workflow end-to-end. Everything else should wait until that works.
