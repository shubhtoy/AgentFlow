---
name: select-resources
description: Pick instructions, capabilities, and skills the workflow needs
context:
  inputs: [output.intent]
outputs:
  - name: resources
    format: markdown
    description: Selected resources with rationale for each
---

# Select Resources

Based on {{<< output.intent}}, select the resources this workflow will reference.

## Process

1. Browse available instructions — which rules/conventions apply?
2. Browse available capabilities — which tools will nodes need?
3. Browse available skills — which packaged expertise is relevant?
4. For each selected resource, note which node(s) will reference it and why

{{-> design-nodes | resources selected}}
