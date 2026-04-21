---
type: condition
name: explain-needed
check: The user's request is a question about a concept, pattern, library, or general topic — not about modifying code
---

# Explain Needed

Evaluates whether the user's request is asking for an explanation rather than a code change.

**True when:** The request is a question about concepts, patterns, libraries, or general topics with no code modification needed.
**False when:** The request involves writing, modifying, debugging, or refactoring code.
