---
type: instruction
name: prompt-engineering
scope: workflow
domain: ai-engineering
description: Techniques for writing effective LLM prompts and agent instructions
tags:
  - prompts
  - llm
  - agent-design
narrativeTemplate:
  prefix: "Apply"
  suffix: "to craft the prompt"
---

# Prompt Engineering

Techniques for writing effective prompts for LLMs and agent instructions.

## Principles

### Be Specific
- State exactly what you want, not what you don't want
- Include format requirements (JSON, markdown, bullet points)
- Provide examples of desired output when the format is non-obvious

### Provide Context
- Give the model the information it needs to answer correctly
- Include relevant code, schemas, or documentation inline
- State assumptions explicitly

### Structure for Clarity
- Use numbered steps for sequential processes
- Use headers to separate distinct sections
- Put the most important instruction first

### Constrain the Output
- Specify length limits when relevant
- Define the output schema if structured output is needed
- List what to include AND what to exclude

## For Agent Instructions (SKILL.md)
- Lead with the goal — what should be true when this node completes?
- Reference capabilities inline where they're used, not in a separate list
- Include "do not" constraints to prevent common mistakes
- Add a Context Budget section with token estimates for every ref
- Exclude refs that belong to other nodes explicitly

## Anti-Patterns
- Vague instructions ("make it good", "be thorough")
- Contradictory constraints
- Loading too much context (every token costs reasoning capacity)
- Not specifying output format
