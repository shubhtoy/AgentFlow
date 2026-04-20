'use strict';

/**
 * Default export — produces a self-contained directory format.
 *
 * Template variables ({{$var}}) in AGENTS.md are resolved at export time:
 *   {{$workflows}}  → bullet list of available workflows
 *   {{$resources}}  → bullet list of bundled resource categories
 *   {{$directory}}  → directory structure explanation
 *   {{$execution}}  → how-to-execute instructions
 *
 * If the user removes a {{$var}} from their AGENTS.md, that section
 * is simply not included — no forced injection.
 */

const { collectWorkflowFiles, toFileMap } = require('./collect-files');

/* ------------------------------------------------------------------ */
/*  Template variable definitions                                      */
/* ------------------------------------------------------------------ */

const TEMPLATE_VARS = {
  $workflows(graph) {
    const entries = Object.entries(graph.workflows || {});
    if (!entries.length) return '';
    return entries
      .map(([id, wf]) => `- **${wf.name || id}** — ${wf.description || 'No description'}`)
      .join('\n');
  },

  $resources(_graph, files) {
    const cats = ['instructions', 'capabilities', 'runbooks', 'memory'];
    const lines = [];
    for (const cat of cats) {
      const items = Object.keys(files)
        .filter(f => f.startsWith(cat + '/') && f.endsWith('.md'))
        .map(f => f.replace(cat + '/', '').replace('.md', ''));
      if (items.length) lines.push(`- **${cat}/** — ${items.join(', ')}`);
    }
    return lines.join('\n');
  },

  $directory() {
    return `- \`AGENTS.md\` — this file; your base identity and instructions
- \`<workflow>/AGENTS.md\` — workflow-level identity, constraints, and node list
- \`<workflow>/<node>/SKILL.md\` — instructions for a single step; this is what you execute
- \`instructions/*.md\` — reusable knowledge; only load when a node references them
- \`capabilities/*.md\` — tool definitions; only load when a node references them
- \`runbooks/*.md\` — conditions and procedures; only load when evaluating a routing decision
- \`memory/*.md\` — persistent context; load at the start of a workflow, update as you go
- \`hooks/*.json\` — event-driven automations (if present)
- \`mcp.json\` — MCP server configuration (if present)`;
  },

  $execution() {
    return `1. Read this file first. This is your base identity.
2. Pick a workflow. Read its \`<workflow>/AGENTS.md\` for role, constraints, and the node list.
3. Start at the entry node. Read **only** that node's \`SKILL.md\`.
4. Load resources **on demand** — when a node's SKILL.md references a file path like \`instructions/code-search.md\`, load that file at that point. Do NOT preload all instructions, capabilities, or runbooks upfront.
5. Complete the step. Produce any outputs the node defines.
6. Follow edges to the next node. For conditional edges, load the referenced runbook to evaluate the condition.
7. At review gates, present your work and wait for user approval before continuing.
8. Repeat until the workflow terminates.

**Important:** Only the current node's SKILL.md and its referenced resources should be in your active context. Prior nodes' details can be summarized or dropped.`;
  },
};

function resolveTemplateVars(content, graph, files) {
  if (!content) return content || '';
  return content.replace(/\{\{\$(\w+)\}\}/g, (match, name) => {
    const resolver = TEMPLATE_VARS['$' + name];
    if (!resolver) return match;
    return resolver(graph, files) || '';
  });
}

/* ------------------------------------------------------------------ */
/*  defaultExport                                                      */
/* ------------------------------------------------------------------ */

function defaultExport(graph, options = {}) {
  // 1. Collect files using shared logic
  const collected = collectWorkflowFiles(graph, options.workflowId);
  const files = toFileMap(collected);

  // 2. Resolve {{ref}} in workflow files (AGENTS.md, SKILL.md)
  for (const [, wf] of Object.entries(collected.workflows)) {
    if (wf.descriptor) files[wf.descriptor.path] = resolveRefs(files[wf.descriptor.path] || '', graph);
    for (const node of wf.nodes) {
      if (node.primary) files[node.primary.path] = resolveRefs(files[node.primary.path] || '', graph);
    }
  }

  // 3. Process root AGENTS.md — resolve graph refs, strip unresolved, keep $vars
  let identityContent = collected.descriptor?.content || '';
  identityContent = resolveRefs(identityContent, graph);
  identityContent = identityContent.replace(/\{\{(?!\$)[^}]+\}\}/g, '');

  // 4. Resolve unresolved refs from library (self-contained export)
  if (options.includeLibrary !== false) {
    try {
      const fs = eval("require")('fs');
      const path = eval("require")('path');
      const libraryDir = options.libraryDir || path.resolve('library');
      if (fs.existsSync(libraryDir)) {
        const allContent = Object.values(files).join('\n');
        const missing = new Set();

        const refRe = /\{\{(?!->)(?!<<)(?!\$)([^}]+)\}\}/g;
        let m;
        while ((m = refRe.exec(allContent)) !== null) {
          const trimmed = m[1].trim();
          if (!trimmed.includes('/')) continue;
          const [cat, name] = trimmed.split('/', 2);
          missing.add(`${cat}/${name}.md`);
        }

        const pathRe = /\b(instructions|capabilities|runbooks|memory)\/([a-z0-9-]+)\.md\b/g;
        while ((m = pathRe.exec(allContent)) !== null) {
          missing.add(`${m[1]}/${m[2]}.md`);
        }

        for (const filePath of missing) {
          if (files[filePath]) continue;
          const libPath = path.join(libraryDir, filePath);
          if (fs.existsSync(libPath) && fs.statSync(libPath).isFile()) {
            files[filePath] = fs.readFileSync(libPath, 'utf8');
          }
        }
      }
    } catch (_) { /* library resolution is best-effort */ }
  }

  // 5. Enrich workflow AGENTS.md with resource summary
  for (const [wfId, wf] of Object.entries(collected.workflows)) {
    const key = wf.descriptor?.path;
    if (!key || !files[key]) continue;
    const wfRefs = { instructions: new Set(), capabilities: new Set(), runbooks: new Set(), memory: new Set() };
    for (const node of wf.nodes) {
      if (!node.primary?.file) continue;
      for (const ref of (node.primary.file.allRefs || node.primary.file.refs || [])) {
        if (ref.category in wfRefs) wfRefs[ref.category].add(ref.name);
      }
    }
    const lines = [];
    for (const [cat, names] of Object.entries(wfRefs)) {
      if (names.size) lines.push(`- **${cat}/** — ${[...names].join(', ')}`);
    }
    if (lines.length) {
      files[key] = files[key].trimEnd() + `\n\n## Resources Used\n\n${lines.join('\n')}\n`;
    }
  }

  // 6. Resolve {{$var}} template variables in root AGENTS.md (last — $resources needs final file map)
  files['AGENTS.md'] = resolveTemplateVars(identityContent, graph, files);

  return { ok: true, data: { files } };
}

/**
 * Resolve {{ref}} graph refs to file path references.
 * Skips edge refs (->), data flow refs (<<), and template vars ($).
 */
function resolveRefs(content, graph) {
  if (!content || typeof content !== 'string') return content || '';
  return content.replace(/\{\{([^}]+)\}\}/g, (match, ref) => {
    const trimmed = ref.trim();
    if (trimmed.startsWith('->') || trimmed.startsWith('$')) return match;

    // Resolve data flow refs: {{<< output.nodeName}}
    if (trimmed.startsWith('<<')) {
      const inner = trimmed.slice(2).trim();
      if (inner.startsWith('output.')) {
        const sourceNodeId = inner.slice(7);
        if (graph) {
          for (const wf of Object.values(graph.workflows || {})) {
            const node = wf.nodes?.[sourceNodeId];
            if (node?.outputDeclarations?.length) {
              return node.outputDeclarations[0].name;
            }
          }
        }
        return sourceNodeId;
      }
      return match;
    }

    return trimmed.includes('.') ? trimmed : `${trimmed}.md`;
  });
}

module.exports = { defaultExport, resolveRefs, resolveTemplateVars, TEMPLATE_VARS };
