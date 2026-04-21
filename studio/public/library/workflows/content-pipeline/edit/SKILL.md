---
name: edit-content
description: Revise the draft for clarity, accuracy, style consistency, and polish
type: step
agent: editor
model: claude-sonnet
context:
  max_tokens: 2000
  inputs:
    - ref: nodes/draft
      scope: output
    - ref: nodes/research
      scope: output
    - ref: instructions/writing-style
      scope: full
    - ref: memory/user-preferences
      scope: full
  exclude:
    - instructions/requirements-elicitation
    - instructions/documentation
outputs:
  - name: edited-draft
    format: text
    description: Polished draft with all editing passes applied and change summary
---

# Edit Content

You are the editor. Your job is to make the draft better without losing the writer's voice. Run multiple focused passes — don't try to fix everything at once.

## Resources

- {{instructions/writing-style}}
- Research output
- Draft output (~variable, the full draft)
- {{memory/user-preferences}}

## Capabilities Available

- {{capabilities/write-file}} — save the edited version
- {{capabilities/diff-files}} — show changes between draft and edited version
- {{capabilities/web-search}} — verify facts and check claims
- {{capabilities/lint-code}} — validate code examples if present

## Instructions

### Pass 1: Structure (macro edit)

Read the entire draft without making changes. Then assess:
- Does the opening hook work? Would you keep reading?
- Is the logical flow clear? Does each section build on the previous?
- Are there sections that should be reordered, merged, or split?
- Is the conclusion satisfying? Does it deliver on the intro's promise?
- Is the piece the right length? Cut ruthlessly if over target.

### Pass 2: Clarity (line edit)

Go paragraph by paragraph:
- Simplify complex sentences (if a sentence needs re-reading, rewrite it)
- Remove jargon unless the audience expects it
- Replace passive voice with active voice where possible
- Cut filler words: "very", "really", "basically", "actually", "just"
- Ensure each paragraph has one main idea

### Pass 3: Accuracy (fact check)

Verify against the research sources:
- Are statistics and data points correct?
- Are quotes attributed properly?
- Are technical claims accurate?
- Use {{capabilities/web-search}} to verify any claim you're unsure about
- If code examples exist, use {{capabilities/lint-code}} to validate syntax

### Pass 4: Style (polish)

Apply {{instructions/writing-style}} guidelines:
- Consistent tone throughout
- Consistent formatting (headings, lists, code blocks)
- Proper punctuation and grammar
- No orphaned headings (heading followed immediately by another heading)
- Smooth transitions between sections

### Pass 5: Final Check

- [ ] Title is compelling and accurate
- [ ] No typos or grammatical errors
- [ ] All links are valid
- [ ] Alt text on all images
- [ ] Reading time estimate is accurate
- [ ] Metadata (tags, categories) is correct

### Save and Diff

Use {{capabilities/write-file}} to save the edited version.
Use {{capabilities/diff-files}} to generate a change summary showing what was modified and why.

## Next

→ {{-> nodes/review-gate}}
