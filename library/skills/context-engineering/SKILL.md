---
name: context-engineering
description: Treat LLM context as a finite resource — minimal system prompts, token-efficient tools, progressive disclosure, compaction strategies, structured note-taking, and sub-agent architectures.
---

# Context Engineering

## The Problem

Every LLM has a finite context window. Every token you put in that window competes with every other token. Wasted context means worse outputs — the model attends to noise instead of signal.

Context engineering is the discipline of maximizing the value per token in the context window.

## The Five Strategies

### 1. Minimal System Prompts

The system prompt sets the agent's behavior. Every word in it is read on every turn. Make it count.

**Rules:**

- State the role and constraints in the fewest words possible
- Remove filler: "You are a helpful assistant that" → just state the constraints
- Move reference material out of the system prompt and into tools or resources
- Do not repeat instructions — state each rule once
- Use structured formats (lists, tables) over prose — they compress better

**Before (wasteful):**
```
You are a helpful coding assistant. You should always write clean,
well-documented code. When the user asks you to write code, you should
think carefully about the best approach and then provide a complete
implementation. You should also consider edge cases and error handling.
Make sure to follow best practices for the programming language being used.
```

**After (efficient):**
```
Write clean, complete code. Handle edge cases and errors.
Follow language best practices.
```

Same behavior, 80% fewer tokens.

### 2. Token-Efficient Tools

Tool definitions are injected into the context on every turn. Bloated tool schemas waste tokens continuously.

**Rules:**

- Keep tool descriptions to one sentence
- Keep parameter descriptions to one phrase
- Remove examples from schemas — put them in a reference resource instead
- Combine related tools when the parameter overlap is high
- Remove tools the agent won't need for the current task

**Before:**
```json
{
  "name": "search_database",
  "description": "This tool searches the database for records matching the given query. It supports full-text search across all indexed fields and returns results sorted by relevance. You can optionally filter by date range and limit the number of results returned.",
  "parameters": {
    "query": {
      "type": "string",
      "description": "The search query string. This should be a natural language query that describes what you're looking for. For example, 'users who signed up in January' or 'orders over $100'."
    }
  }
}
```

**After:**
```json
{
  "name": "search_database",
  "description": "Full-text search across indexed fields, sorted by relevance.",
  "parameters": {
    "query": { "type": "string", "description": "Search query" },
    "limit": { "type": "integer", "description": "Max results (default 20)" }
  }
}
```

### 3. Progressive Disclosure

Do not load everything upfront. Load information when the agent needs it.

**Levels:**

1. **Discovery** — Agent sees a list of available skills/tools with short descriptions
2. **Selection** — Agent picks the relevant skill based on the description
3. **Loading** — Full skill content is loaded into context only when selected
4. **Deep dive** — Reference materials are loaded only when the skill instructions say to

**Implementation patterns:**

- **Skill descriptions as an index:** The agent sees `name + description` for all skills. It loads the full SKILL.md only for the one it needs.
- **Tool pagination:** List endpoints return summaries. Detail endpoints return full records. The agent calls list first, then detail for specific items.
- **Lazy references:** SKILL.md says "See references/owasp-top-10.md for details." The agent loads it only if the task requires OWASP knowledge.

### 4. Compaction

As conversations grow, older context becomes less relevant. Compact it.

**Strategies:**

- **Summarize completed work.** After finishing a subtask, replace the detailed conversation with a one-paragraph summary of what was done and what was decided.
- **Drop intermediate reasoning.** The agent's chain-of-thought from 10 turns ago is rarely needed. Keep the conclusion, drop the reasoning.
- **Compress tool results.** A 500-line file read can often be summarized as "File X contains a React component that renders a user profile with 3 sections."
- **Prune failed attempts.** If the agent tried approach A and it failed, keep "Approach A failed because X" and drop the full attempt.

**Compaction triggers:**

- Context usage exceeds 60% of the window
- A subtask is completed
- The agent switches to a different topic
- Tool output exceeds a size threshold

### 5. Structured Note-Taking

The agent should maintain a scratchpad of key information extracted during the session.

**Format:**

```markdown
## Working Memory

### Current Task
[One sentence: what the agent is doing right now]

### Key Facts
- [Fact 1: discovered during exploration]
- [Fact 2: from user input]
- [Fact 3: from tool output]

### Decisions Made
- [Decision 1: chose X because Y]
- [Decision 2: rejected Z because W]

### Open Questions
- [Question 1: need to verify]
- [Question 2: blocked on user input]
```

This scratchpad is cheaper than re-reading the full conversation history. Update it after each significant step.

## Sub-Agent Architectures

For complex tasks, split work across multiple agents with separate context windows.

### Orchestrator Pattern

```
┌──────────────┐
│  Orchestrator │ ← Holds the plan, delegates subtasks
└──────┬───────┘
       │
  ┌────┼────┐
  ▼    ▼    ▼
┌───┐┌───┐┌───┐
│ A ││ B ││ C │  ← Sub-agents with focused context
└───┘└───┘└───┘
```

- Orchestrator maintains the high-level plan and tracks progress
- Sub-agents receive only the context needed for their subtask
- Sub-agents return a summary, not their full conversation
- Orchestrator compacts sub-agent results before proceeding

### When to Use Sub-Agents

- The task requires reading more files than fit in one context window
- Different subtasks need different tools (code agent vs. research agent)
- Subtasks are independent and can run in parallel
- The conversation has grown too long for effective reasoning

### Sub-Agent Context Rules

- Give each sub-agent the minimum context for its task
- Include: task description, relevant files, constraints
- Exclude: conversation history, unrelated files, other subtask details
- Require structured output: summary + result + any warnings

## Token Budget Planning

Before starting a complex task, estimate the token budget:

| Component | Typical Cost | Budget % |
|-----------|-------------|----------|
| System prompt | 200-500 tokens | 1-3% |
| Tool definitions | 100-300 per tool | 5-15% |
| Conversation history | Grows per turn | 20-40% |
| Tool results (file reads, searches) | 500-5000 per call | 20-40% |
| Agent reasoning | 200-1000 per turn | 10-20% |
| Working memory / scratchpad | 200-500 tokens | 2-5% |

If tool results dominate, use compaction aggressively. If conversation history dominates, summarize completed subtasks.

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **Kitchen sink system prompt** | Wastes tokens on every turn | Move reference material to tools/resources |
| **Reading entire files** | One file can consume 20% of context | Read targeted sections, use grep first |
| **Keeping full history** | Old turns crowd out new information | Summarize completed work |
| **Loading all tools** | Unused tools waste description tokens | Load tools relevant to the current phase |
| **Verbose tool output** | Raw JSON dumps fill context fast | Summarize or extract relevant fields |
| **No working memory** | Agent re-discovers facts it already found | Maintain a structured scratchpad |
| **Single mega-agent** | One agent tries to hold everything | Split into orchestrator + sub-agents |

## Context Engineering Checklist

- [ ] System prompt is under 500 tokens
- [ ] Tool descriptions are one sentence each
- [ ] Parameter descriptions are one phrase each
- [ ] Skills use progressive disclosure (description → full content → references)
- [ ] Completed subtasks are summarized, not preserved verbatim
- [ ] Tool results are compacted when they exceed a threshold
- [ ] Working memory scratchpad is maintained and updated
- [ ] Sub-agents are used when context exceeds 60% capacity
- [ ] Token budget is estimated before starting complex tasks
