---
name: design-agentflow-feature
description: Delegates to the agent-builder workflow when the feature involves designing AgentFlow workflows
type: sub-workflow
workflow: agent-builder
context:
  inputs: [output.gather-requirements]
outputs:
  - name: design
    format: markdown
    description: AgentFlow workflow design with nodes, edges, and resource references
---

# Design AgentFlow Feature

This node delegates to the **agent-builder** workflow when the feature being built is itself an AgentFlow workflow (nodes, edges, resources, AGENTS.md).

## When This Node Activates

The review-design gate routes here instead of create-design when the requirements indicate the feature is an AgentFlow workflow — for example:
- Building a new workflow template
- Designing an agent pipeline
- Creating a multi-step automation

## What the Sub-workflow Does

The agent-builder workflow specializes in:
1. Extracting intent from requirements
2. Selecting appropriate resources (instructions, capabilities, skills)
3. Designing the node graph with edges and conditions
4. Generating the `.agentflow/` file structure

## Input

Receives {{<< output.gather-requirements}} — the approved requirements document from the gather phase.

## Output

Produces `output.design` — a complete AgentFlow workflow design that the plan-tasks node can decompose into implementation tasks.
