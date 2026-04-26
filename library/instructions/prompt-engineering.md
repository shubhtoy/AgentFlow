---
name: prompt-engineering
description: Techniques for writing effective LLM prompts and agent instructions
domain: ai-engineering
tags:
  - prompts
  - llm
  - agent-design
---

# Prompt Engineering

Techniques for writing effective prompts for LLMs and agent instructions.

## Principles

### Be Specific
- State exactly what you want, not what you don't want
- Include format requirements (JSON, markdown, bullet points)
- Provide examples of desired output when the format is non-obvious
- Specify edge cases and how to handle them

### Provide Context
- Give the model the information it needs to answer correctly
- Include relevant code, schemas, or documentation inline
- State assumptions explicitly
- Front-load the most important context — models attend more to the beginning

### Structure for Clarity
- Use numbered steps for sequential processes
- Use headers to separate distinct sections
- Put the most important instruction first
- Use XML tags or markdown headers to delineate sections
- Keep instructions at the same level of abstraction within a section

### Constrain the Output
- Specify length limits when relevant
- Define the output schema if structured output is needed
- List what to include AND what to exclude
- Provide a concrete example of the expected output format

## For Agent Instructions (SKILL.md)
- Lead with the goal — what should be true when this node completes?
- Reference capabilities inline where they're used, not in a separate list
- Include "do not" constraints to prevent common mistakes
- Add a Context Budget section with token estimates for every ref
- Exclude refs that belong to other nodes explicitly
- Write instructions as if the agent has no memory of previous nodes
- Test instructions by reading them cold — would a new person understand?

## Anti-Patterns
- Vague instructions ("make it good", "be thorough", "be creative")
- Contradictory constraints that force the model to guess priority
- Loading too much context — every token costs reasoning capacity
- Not specifying output format, then complaining about the format
- Repeating the same instruction multiple times (wastes tokens, adds confusion)
- Using negation without a positive alternative ("don't use X" → "use Y instead of X")
