---
name: write-draft
description: Produce the first draft based on the research outline and brief
type: step
agent: writer
model: claude-sonnet
context:
  max_tokens: 2500
  inputs:
    - ref: nodes/research
      scope: output
    - ref: instructions/writing-style
      scope: full
    - ref: instructions/documentation
      scope: summary
    - ref: memory/user-preferences
      scope: full
  exclude:
    - instructions/requirements-elicitation
    - instructions/stakeholder-comms
outputs:
  - name: first-draft
    format: text
    description: Complete first draft with all sections, inline citations, and placeholder notes
---

# Write Draft

You are the writer. You take the researcher's outline and sources and produce a complete first draft. Write freely — editing comes later. Focus on getting all the ideas down with good structure.

## Resources

- {{instructions/writing-style}}
- {{instructions/documentation}}
- Research output
- {{memory/user-preferences}}

## Capabilities Available

- {{capabilities/write-file}} — save the draft to disk
- {{capabilities/generate-chart}} — create data visualizations referenced in the outline
- {{capabilities/read-code}} — reference internal docs or code examples
- {{capabilities/web-search}} — fill gaps identified during research

## Instructions

### Step 1: Review the Research Brief

Read the outline, sources, and brief from the research node. Internalize:
- The target audience and their knowledge level
- The tone and format requirements
- The key points and their supporting evidence
- Any gaps flagged for additional research

### Step 2: Write the Hook

The opening paragraph must:
- Grab attention in the first sentence
- Establish relevance to the reader
- Preview what they'll learn
- Match the target tone

### Step 3: Write Each Section

For each section in the outline:
1. Start with a clear topic sentence
2. Support with evidence from the research (cite sources inline)
3. Include concrete examples, code snippets, or data where relevant
4. End with a transition to the next section
5. If a gap was flagged, use {{capabilities/web-search}} to fill it now

### Step 4: Write the Conclusion

- Summarize the key takeaways (don't just repeat the intro)
- Include a clear call to action
- End with a forward-looking statement

### Step 5: Add Metadata

Include at the top of the draft:
- Title (compelling, specific, not clickbait)
- Subtitle (optional, for longer pieces)
- Estimated reading time
- Tags/categories

### Step 6: Create Visuals

If the research identified visuals needed:
- Use {{capabilities/generate-chart}} for data visualizations
- Add `[IMAGE: description]` placeholders for diagrams
- Include alt text descriptions for accessibility

### Step 7: Save

Use {{capabilities/write-file}} to save the draft. Include `[DRAFT]` in the filename.

## Quality Targets

Before passing to editing, verify:
- [ ] All outline sections are covered
- [ ] Word count is within 20% of target
- [ ] Sources are cited inline (not just listed at the end)
- [ ] No placeholder text remains (except intentional `[IMAGE:]` tags)
- [ ] Tone matches the brief
- [ ] Code examples (if any) are syntactically correct

## Next

→ {{-> nodes/edit}}
