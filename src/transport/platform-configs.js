// Auto-generated — do not edit. Run: node scripts/bundle-platform-configs.js
module.exports = [
  {
    "name": "agent-spec",
    "displayName": "Agent Spec (Oracle Open Agent Spec)",
    "version": "2.1.0",
    "tier": "runtime",
    "capabilities": [
      "export"
    ],
    "exportRules": [
      {
        "source": "identity",
        "target": "agent-spec.json",
        "type": "single-file",
        "fidelity": "native",
        "transform": "graph-to-agent-spec",
        "note": "Full graph exported as Agent Spec JSON"
      },
      {
        "source": "hooks/*",
        "target": "hooks/{name}.json",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "json-passthrough",
        "note": "Hooks exported as native platform hooks"
      },
      {
        "source": "memory/*",
        "target": "memory/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "customFiles",
        "target": "{name}",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      }
    ],
    "importRules": []
  },
  {
    "name": "claude-code",
    "displayName": "Claude Code",
    "version": "2.1.0",
    "tier": "ide",
    "capabilities": [
      "export",
      "import"
    ],
    "detectMarkers": [
      "CLAUDE.md",
      ".claude"
    ],
    "exportRules": [
      {
        "source": "identity",
        "target": "CLAUDE.md",
        "type": "single-file",
        "fidelity": "native",
        "transform": "identity-to-claude-md",
        "contextMode": "always-loaded"
      },
      {
        "source": "instructions/*",
        "target": "CLAUDE.md",
        "type": "merge-into",
        "fidelity": "native",
        "transform": "instructions-append-to-claude-md",
        "mergeTarget": "CLAUDE.md",
        "contextMode": "always-loaded",
        "sourceFilter": {
          "scope": "global"
        }
      },
      {
        "source": "instructions/*",
        "target": ".claude/agents/{name}.md",
        "type": "glob-copy",
        "fidelity": "translated",
        "transform": "markdown-passthrough",
        "contextMode": "on-demand",
        "sourceFilter": {
          "scope": "workflow"
        }
      },
      {
        "source": "hooks/*",
        "target": ".claude/settings.json",
        "type": "merge-into",
        "fidelity": "native",
        "transform": "hooks-to-claude-settings",
        "note": "Hooks exported as native platform hooks"
      },
      {
        "source": "protocols.mcp",
        "target": ".mcp.json",
        "type": "single-file",
        "fidelity": "translated",
        "transform": "mcp-remap"
      },
      {
        "source": "capabilities/*",
        "target": "capabilities/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "runbooks/*",
        "target": "runbooks/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "memory/*",
        "target": "memory/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "workflows/*",
        "target": "{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "customFiles",
        "target": "{name}",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      }
    ],
    "importRules": [
      {
        "source": "CLAUDE.md",
        "target": "AGENTS.md",
        "type": "single-file",
        "fidelity": "native",
        "transform": "claude-md-to-identity"
      },
      {
        "source": ".mcp.json",
        "target": "mcp.json",
        "type": "single-file",
        "fidelity": "translated",
        "transform": "mcp-reverse"
      }
    ]
  },
  {
    "name": "cursor",
    "displayName": "Cursor",
    "version": "2.1.0",
    "tier": "ide",
    "capabilities": [
      "export",
      "import"
    ],
    "detectMarkers": [
      ".cursor/rules",
      ".cursorrules"
    ],
    "exportRules": [
      {
        "source": "identity",
        "target": "AGENTS.md",
        "type": "single-file",
        "fidelity": "native",
        "transform": "markdown-passthrough",
        "contextMode": "always-loaded",
        "note": "AGENTS.md supported natively by Cursor"
      },
      {
        "source": "instructions/*",
        "target": ".cursor/rules/{name}.mdc",
        "type": "glob-transform",
        "fidelity": "native",
        "transform": "md-to-mdc-agent-requested",
        "contextMode": "on-demand"
      },
      {
        "source": "hooks/*",
        "target": ".cursor/hooks.json",
        "type": "merge-into",
        "fidelity": "native",
        "transform": "hooks-to-claude-settings",
        "note": "Hooks exported as native platform hooks"
      },
      {
        "source": "protocols.mcp",
        "target": ".cursor/mcp.json",
        "type": "single-file",
        "fidelity": "translated",
        "transform": "mcp-remap"
      },
      {
        "source": "capabilities/*",
        "target": "capabilities/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "runbooks/*",
        "target": "runbooks/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "memory/*",
        "target": "memory/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "workflows/*",
        "target": "{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "customFiles",
        "target": "{name}",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      }
    ],
    "importRules": [
      {
        "source": "AGENTS.md",
        "target": "AGENTS.md",
        "type": "single-file",
        "fidelity": "native",
        "transform": "markdown-passthrough"
      },
      {
        "source": ".cursor/rules/*.mdc",
        "target": "instructions/{name}.md",
        "type": "glob-transform",
        "fidelity": "native",
        "transform": "mdc-to-md"
      },
      {
        "source": ".cursor/mcp.json",
        "target": "mcp.json",
        "type": "single-file",
        "fidelity": "translated",
        "transform": "mcp-reverse"
      }
    ]
  },
  {
    "name": "kiro",
    "displayName": "Kiro",
    "version": "2.1.0",
    "tier": "ide",
    "capabilities": [
      "export",
      "import"
    ],
    "detectMarkers": [
      ".kiro/steering",
      ".kiro/settings"
    ],
    "exportRules": [
      {
        "source": "identity",
        "target": ".kiro/steering/identity.md",
        "type": "single-file",
        "fidelity": "native",
        "transform": "identity-to-kiro-steering",
        "contextMode": "always-loaded"
      },
      {
        "source": "instructions/*",
        "target": ".kiro/steering/{name}.md",
        "type": "glob-transform",
        "fidelity": "native",
        "transform": "identity-to-kiro-steering",
        "contextMode": "on-demand"
      },
      {
        "source": "hooks/*",
        "target": ".kiro/hooks/{name}.json",
        "type": "glob-copy",
        "fidelity": "native",
        "transform": "json-passthrough",
        "note": "Hooks exported as native platform hooks"
      },
      {
        "source": "protocols.mcp",
        "target": ".kiro/settings/mcp.json",
        "type": "single-file",
        "fidelity": "translated",
        "transform": "mcp-remap"
      },
      {
        "source": "capabilities/*",
        "target": "capabilities/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "runbooks/*",
        "target": "runbooks/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "memory/*",
        "target": "memory/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "workflows/*",
        "target": "{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "customFiles",
        "target": "{name}",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      }
    ],
    "importRules": [
      {
        "source": ".kiro/steering/identity.md",
        "target": "AGENTS.md",
        "type": "single-file",
        "fidelity": "native",
        "transform": "kiro-instructions-to-identity"
      },
      {
        "source": ".kiro/steering/*.md",
        "target": "instructions/{name}.md",
        "type": "glob-copy",
        "fidelity": "native",
        "transform": "ensure-instruction-frontmatter",
        "exclude": [
          "identity.md"
        ]
      },
      {
        "source": ".kiro/hooks/*.json",
        "target": "hooks/{name}.json",
        "type": "glob-copy",
        "fidelity": "translated",
        "transform": "json-passthrough"
      },
      {
        "source": ".kiro/settings/mcp.json",
        "target": "mcp.json",
        "type": "single-file",
        "fidelity": "translated",
        "transform": "mcp-reverse"
      }
    ]
  },
  {
    "name": "openclaw",
    "displayName": "OpenClaw",
    "version": "2.1.0",
    "tier": "ide",
    "capabilities": [
      "export",
      "import"
    ],
    "detectMarkers": [
      "SOUL.md",
      "HEARTBEAT.md",
      ".openclaw"
    ],
    "exportRules": [
      {
        "source": "identity",
        "target": "AGENTS.md",
        "type": "single-file",
        "fidelity": "native",
        "transform": "markdown-passthrough",
        "contextMode": "always-loaded",
        "note": "AGENTS.md is native to OpenClaw"
      },
      {
        "source": "instructions/*",
        "target": "instructions/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough",
        "contextMode": "on-demand"
      },
      {
        "source": "hooks/*",
        "target": "hooks/{name}/HOOK.md",
        "type": "glob-transform",
        "fidelity": "translated",
        "transform": "hooks-to-openclaw-hook-md",
        "note": "Hooks exported as native platform hooks"
      },
      {
        "source": "protocols.mcp",
        "target": "config.json",
        "type": "single-file",
        "fidelity": "translated",
        "transform": "mcp-remap",
        "note": "MCP config mapped to OpenClaw config.json"
      },
      {
        "source": "capabilities/*",
        "target": "capabilities/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "runbooks/*",
        "target": "runbooks/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "memory/*",
        "target": "memory/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "workflows/*",
        "target": "{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "customFiles",
        "target": "{name}",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      }
    ],
    "importRules": [
      {
        "source": "AGENTS.md",
        "target": "AGENTS.md",
        "type": "single-file",
        "fidelity": "native",
        "transform": "markdown-passthrough"
      },
      {
        "source": "config.json",
        "target": "mcp.json",
        "type": "single-file",
        "fidelity": "translated",
        "transform": "mcp-reverse"
      }
    ]
  },
  {
    "name": "vscode-copilot",
    "displayName": "VS Code (Copilot)",
    "version": "2.1.0",
    "tier": "ide",
    "capabilities": [
      "export",
      "import"
    ],
    "detectMarkers": [
      ".github/copilot-instructions.md",
      ".github/instructions"
    ],
    "exportRules": [
      {
        "source": "identity",
        "target": "AGENTS.md",
        "type": "single-file",
        "fidelity": "native",
        "transform": "markdown-passthrough",
        "contextMode": "always-loaded"
      },
      {
        "source": "instructions/*",
        "target": ".github/copilot-instructions.md",
        "type": "merge-into",
        "fidelity": "native",
        "transform": "instructions-to-copilot-instructions",
        "mergeTarget": ".github/copilot-instructions.md",
        "contextMode": "always-loaded",
        "sourceFilter": {
          "scope": "global"
        }
      },
      {
        "source": "instructions/*",
        "target": ".github/instructions/{name}.instructions.md",
        "type": "glob-copy",
        "fidelity": "translated",
        "transform": "markdown-passthrough",
        "contextMode": "on-demand",
        "sourceFilter": {
          "scope": "workflow"
        }
      },
      {
        "source": "hooks/*",
        "target": ".github/hooks/agentflow-hooks.json",
        "type": "merge-into",
        "fidelity": "native",
        "transform": "hooks-to-claude-settings",
        "note": "Hooks exported as native platform hooks"
      },
      {
        "source": "protocols.mcp",
        "target": ".vscode/mcp.json",
        "type": "single-file",
        "fidelity": "translated",
        "transform": "mcp-remap"
      },
      {
        "source": "capabilities/*",
        "target": "capabilities/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "runbooks/*",
        "target": "runbooks/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "memory/*",
        "target": "memory/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "workflows/*",
        "target": "{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "customFiles",
        "target": "{name}",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      }
    ],
    "importRules": [
      {
        "source": "AGENTS.md",
        "target": "AGENTS.md",
        "type": "single-file",
        "fidelity": "native",
        "transform": "markdown-passthrough"
      },
      {
        "source": ".github/copilot-instructions.md",
        "target": "AGENTS.md",
        "type": "merge-into",
        "fidelity": "native",
        "transform": "copilot-instructions-to-identity",
        "mergeTarget": "AGENTS.md"
      },
      {
        "source": ".github/hooks/*.json",
        "target": "hooks/{name}.json",
        "type": "glob-copy",
        "fidelity": "native",
        "transform": "json-passthrough"
      },
      {
        "source": ".vscode/mcp.json",
        "target": "mcp.json",
        "type": "single-file",
        "fidelity": "translated",
        "transform": "mcp-reverse"
      }
    ]
  },
  {
    "name": "windsurf",
    "displayName": "Windsurf",
    "version": "2.1.0",
    "tier": "ide",
    "capabilities": [
      "export",
      "import"
    ],
    "detectMarkers": [
      ".windsurf/rules",
      ".windsurfrules"
    ],
    "exportRules": [
      {
        "source": "identity",
        "target": ".windsurf/rules/identity.md",
        "type": "single-file",
        "fidelity": "native",
        "transform": "identity-to-windsurf-rule",
        "contextMode": "always-loaded"
      },
      {
        "source": "instructions/*",
        "target": ".windsurf/rules/{name}.md",
        "type": "glob-copy",
        "fidelity": "native",
        "transform": "markdown-passthrough",
        "contextMode": "on-demand"
      },
      {
        "source": "hooks/*",
        "target": ".windsurf/hooks.json",
        "type": "merge-into",
        "fidelity": "native",
        "transform": "hooks-to-windsurf",
        "note": "Hooks exported as native platform hooks"
      },
      {
        "source": "protocols.mcp",
        "target": ".windsurf/mcp.json",
        "type": "single-file",
        "fidelity": "translated",
        "transform": "mcp-remap"
      },
      {
        "source": "capabilities/*",
        "target": "capabilities/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "runbooks/*",
        "target": "runbooks/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "memory/*",
        "target": "memory/{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "workflows/*",
        "target": "{name}.md",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      },
      {
        "source": "customFiles",
        "target": "{name}",
        "type": "glob-copy",
        "fidelity": "preserved",
        "transform": "markdown-passthrough"
      }
    ],
    "importRules": [
      {
        "source": ".windsurf/rules/identity.md",
        "target": "AGENTS.md",
        "type": "single-file",
        "fidelity": "native",
        "transform": "markdown-passthrough"
      },
      {
        "source": ".windsurf/rules/*.md",
        "target": "instructions/{name}.md",
        "type": "glob-copy",
        "fidelity": "native",
        "transform": "markdown-passthrough",
        "exclude": [
          "identity.md"
        ]
      },
      {
        "source": ".windsurf/mcp.json",
        "target": "mcp.json",
        "type": "single-file",
        "fidelity": "translated",
        "transform": "mcp-reverse"
      }
    ]
  }
];
