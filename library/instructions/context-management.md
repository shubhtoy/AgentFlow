---
name: context-management
description: How to manage context budget, keep prompts tight, and use progressive disclosure
domain: ai-engineering
tags:
  - context
  - tokens
  - optimization
  - prompts
---

# Context Management

Every token in the context window costs reasoning capacity. Manage context deliberately — load what you need, when you need it, and nothing more.

## Core Principles

### Budget Awareness
- Know your context limit (L0 + L1 + L2 + L3 refs ≤ 8k tokens)
- Estimate token cost before loading: ~1 token per 4 chars (English), ~3 chars (code)
- Track cumulative usage — it's easy to overshoot without noticing
- Leave headroom for the model's reasoning and output generation

### Progressive Disclosure
- Start with summaries and signatures, not full content
- Load full details only when the task requires them
- Use `scope: signature` for capabilities you reference but don't deeply use
- Use `scope: summary` for instructions that provide background context
- Use `scope: full` only for the primary instruction driving the current node

### Load on Demand
- Don't dump everything into context "just in case"
- Reference resources inline where they're used, not in a preamble
- Exclude resources that belong to other workflow nodes
- If you need information from a previous node, use data flow refs (`{{<< output.node}}`)

## Practical Techniques

### Trim Aggressively
- Remove boilerplate, examples, and verbose explanations from loaded context
- Keep only the actionable parts of instructions
- Summarize long documents before loading them
- Strip comments and whitespace from code snippets when only structure matters

### Structure for Skimming
- Put the most important information first in every document
- Use headers so the model can skip irrelevant sections
- Use bullet points over paragraphs — they're more token-efficient
- Front-load constraints and rules before examples

### Avoid Context Pollution
- Don't load error messages, stack traces, or logs unless actively debugging
- Don't load test files when writing implementation (and vice versa)
- Don't load the full file when you only need one function
- Clear stale context between workflow stages

## Anti-Patterns
- Loading every instruction "because it might be useful"
- Including full file contents when a function signature would suffice
- Repeating the same information in multiple context layers
- Not specifying `exclude` in SKILL.md frontmatter — letting irrelevant refs leak in
- Treating context like storage instead of working memory
