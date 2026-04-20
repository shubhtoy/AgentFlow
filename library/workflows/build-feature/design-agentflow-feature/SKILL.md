---
name: design-agentflow-feature
type: sub-workflow
description: Delegates to the agent-builder workflow when the feature involves designing AgentFlow workflows
workflow: agent-builder
---

# Design AgentFlow Feature

This node delegates execution to the **agent-builder** sub-workflow when the feature being built involves designing or scaffolding an AgentFlow workflow, agent workspace, or workflow-based system.

## When to enter

The design gate determines this feature involves AgentFlow workflow design — for example:
- Building a new agent workflow or multi-step pipeline
- Designing node graphs, routing logic, or sub-workflow composition
- Scaffolding an AgentFlow workspace with resources, capabilities, and instructions

If the feature is standard software (API, UI, backend logic), skip this node and proceed directly to plan-tasks.

## Context passed in

The parent workflow provides:
- The approved requirements document from gather-requirements ({{<< output.gather-requirements}})
- The approved design from create-design ({{<< output.create-design}})
- Shared resources: {{instructions/prompt-engineering}}, {{instructions/task-decomposition}}
- Capabilities: {{capabilities/read-code}}, {{capabilities/write-file}}, {{capabilities/file-search}}

## Expected outcome

A fully scaffolded AgentFlow workspace with:
- Workflow AGENTS.md with node graph and edges
- Node SKILL.md files with proper instructions
- Referenced resources (instructions, capabilities, runbooks)
- Validated structure (no broken refs, proper frontmatter)

Control returns to the parent workflow at plan-tasks for any remaining non-AgentFlow implementation work.

## Workflow definition

{{workflows/agent-builder}}

## Next

→ {{-> nodes/verify-feature}}
