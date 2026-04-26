---
name: authoring-guide-index
scope: global
inclusion: auto
description: Master index for the AgentFlow Authoring Guide — links to all 20 parts
tags:
  - guide
  - authoring
  - index
---

# The AgentFlow Authoring Guide

A complete, practical guide to designing, writing, and validating AI agent workflows in AgentFlow — from your first `AGENTS.md` to production-ready multi-phase pipelines.

> **The golden rule:** Every token loaded is a token the model can't use for reasoning. Your folder structure *is* the architecture. Design it like a budget.

## Parts

1. [What AgentFlow Is](01-what-agentflow-is.md) — Philosophy, principles, consumption levels
2. [Core Concepts](02-core-concepts.md) — Workspaces, identity, workflows, nodes, resources, references, budgets
3. [Directory Layout & File Conventions](03-directory-layout.md) — Structure, reserved directories, file conventions
4. [The Five-Layer Context Model](04-context-layers.md) — The cache-inspired layering system
5. [Reference Syntax](05-reference-syntax.md) — Mentions, edges, conditional edges, data flow
6. [Writing Your Root AGENTS.md](06-root-agents-md.md) — Identity, frontmatter, body structure
7. [Designing Workflows](07-designing-workflows.md) — Workflow descriptors, node summaries, routing maps
8. [Writing Nodes (SKILL.md)](08-writing-nodes.md) — Steps, routers, sub-workflows, context budgets
9. [Resource Authoring](09-resource-authoring.md) — Capabilities, instructions, skills, memory
10. [Hooks & Event Automation](10-hooks.md) — Events, conditions, actions, pre-shipped hooks
11. [MCP Integration](11-mcp-integration.md) — Server config, capability linking, defaults
12. [The Pre-Shipped Library](12-library.md) — Capabilities, instructions, skills, hooks, memory, workflows
13. [Graph Design Patterns](13-graph-patterns.md) — Linear, review gates, rejection loops, iteration
14. [Validation & Quality](14-validation.md) — Checks, severity levels, common errors
15. [Branding & Customization](15-branding.md) — Config file, env vars, schema
16. [Import, Export & Sharing](16-import-export.md) — Formats, import sources, dry run
17. [Complete Worked Example](17-worked-example.md) — A full code-review workflow from scratch
18. [Authoring Checklist](18-checklist.md) — Workspace, workflow, node, resource, and hook checklists
19. [Taxonomy Migration](19-taxonomy-migration.md) — Old → new directory and ref syntax mapping
20. [Builder / Scaffolding](20-builder-scaffolding.md) — Conversational workspace generation

## See Also

- [architecture.md](../architecture.md) — Architectural philosophy
- [authoring-cheatsheet.md](../authoring-cheatsheet.md) — Condensed quick-reference
- [taxonomy-reference.md](../taxonomy-reference.md) — Full taxonomy details
