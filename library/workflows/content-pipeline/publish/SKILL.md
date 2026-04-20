---
name: publish-content
description: Format, deliver, and distribute the final approved content
type: step
agent: publisher
model: claude-sonnet
context:
  max_tokens: 1500
  inputs:
    - ref: nodes/edit
      scope: output
    - ref: nodes/research
      scope: output
    - ref: instructions/stakeholder-comms
      scope: summary
    - ref: memory/project-context
      scope: full
  exclude:
    - instructions/writing-style
    - instructions/systematic-debugging
outputs:
  - name: publication-record
    format: json
    description: Publication details with URL, distribution channels, and metrics setup
---

# Publish Content

You are the publisher. The content is approved — now format it for the target platform, deliver it, and notify stakeholders.

## Resources

- {{instructions/stakeholder-comms}}
- {{memory/project-context}}
- Edited draft (~variable, the final content)

## Capabilities Available

- {{capabilities/write-file}} — save the final formatted version
- {{capabilities/call-api}} — publish to CMS, blog platform, or distribution API
- {{capabilities/send-notification}} — notify team and stakeholders
- {{capabilities/generate-docs}} — generate metadata and structured data

## Instructions

### Step 1: Format for Platform

Apply platform-specific formatting:
- **Blog**: Add frontmatter (title, date, author, tags, description), format images, add social sharing metadata
- **Documentation**: Add navigation links, version info, related pages
- **Email**: Convert to email-safe HTML, add unsubscribe link, preview text
- **Social**: Create platform-specific versions (Twitter/X thread, LinkedIn post, etc.)

### Step 2: Generate Metadata

Create:
- SEO meta description (150-160 characters)
- Open Graph tags (title, description, image)
- Structured data (JSON-LD if applicable)
- Canonical URL

### Step 3: Publish

Use {{capabilities/call-api}} to push to the target platform.
Use {{capabilities/write-file}} to save the final version locally as a record.

### Step 4: Distribute

Use {{capabilities/send-notification}} to:
- Notify the content team that the piece is live
- Share on internal channels
- Trigger any automated distribution (newsletter, social queue)

### Step 5: Record

Log the publication for tracking:

## Output Contract

```json
{
  "title": "The published title",
  "url": "https://...",
  "publishedAt": "ISO timestamp",
  "platform": "blog|docs|email|social",
  "wordCount": 1500,
  "distributionChannels": ["slack", "newsletter", "twitter"],
  "metadata": {
    "description": "SEO meta description",
    "tags": ["tag1", "tag2"],
    "author": "Author name"
  }
}
```
