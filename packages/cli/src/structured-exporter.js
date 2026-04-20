'use strict';

const { resolveToPath } = require('@agentflow/core/exporter');
const { collectWorkflowFiles, toFileMap } = require('@agentflow/core/transport/collect-files');

/**
 * Export raw — preserves original content, no ref resolution.
 */
function exportRaw(graph, workflowId) {
  if (!graph) return {};
  if (workflowId && !graph.workflows?.[workflowId]) return {};
  return toFileMap(collectWorkflowFiles(graph, workflowId));
}

/**
 * Export parsed — resolves {{ref}} tokens to relative file path links.
 */
function exportParsed(graph, workflowId) {
  if (!graph) return {};
  if (workflowId && !graph.workflows?.[workflowId]) return {};

  const collected = collectWorkflowFiles(graph, workflowId);

  function resolve(file, exportPath) {
    if (!file) return '';
    const raw = file.rawContent || file.content || '';
    const refs = file.refs || [];
    if (refs.length === 0) return raw;

    const path = require('path');
    const fileDir = path.dirname(exportPath || file.relativePath || '');

    let result = raw;
    const sorted = [...refs]
      .filter((r) => r.offset != null)
      .sort((a, b) => b.offset - a.offset);

    for (const ref of sorted) {
      const token = `{{${ref.raw}}}`;
      const idx = result.indexOf(token);
      if (idx === -1) continue;
      const { text, error } = resolveToPath(ref, graph);
      let replacement;
      if (error) {
        replacement = text;
      } else {
        const relTarget = path.relative(fileDir, text).replace(/\\/g, '/');
        if (ref.semanticType === 'edge') {
          const label = ref.condition ? `→ ${ref.name} | ${ref.condition}` : `→ ${ref.name}`;
          replacement = `[${label}](${relTarget})`;
        } else if (ref.semanticType === 'data_flow') {
          replacement = text;
        } else {
          replacement = `[${ref.name}](${relTarget})`;
        }
      }
      result = result.slice(0, idx) + replacement + result.slice(idx + token.length);
    }
    return result;
  }

  // Build file map with resolved refs
  const files = {};

  if (collected.descriptor) {
    files[collected.descriptor.path] = resolve(collected.descriptor.file, collected.descriptor.path);
  }

  for (const [, wf] of Object.entries(collected.workflows)) {
    if (wf.descriptor) files[wf.descriptor.path] = resolve(wf.descriptor.file, wf.descriptor.path);
    for (const node of wf.nodes) {
      if (node.primary) files[node.primary.path] = resolve(node.primary.file, node.primary.path);
      for (const cf of node.contextFiles) files[cf.path] = resolve(cf.file, cf.path);
    }
  }

  for (const [, items] of Object.entries(collected.resources)) {
    for (const [, item] of Object.entries(items)) {
      files[item.path] = resolve(item.file, item.path);
    }
  }

  for (const [path, content] of Object.entries(collected.customFiles)) {
    files[path] = content;
  }

  if (collected.mcp) {
    files['mcp.json'] = JSON.stringify({ mcpServers: collected.mcp }, null, 2);
  }

  // Resolve {{$var}} template variables
  const { resolveTemplateVars } = require('@agentflow/core/transport/default-export');
  for (const [p, content] of Object.entries(files)) {
    if (typeof content === 'string' && content.includes('{{$')) {
      files[p] = resolveTemplateVars(content, graph, files);
    }
  }

  return files;
}

module.exports = { exportRaw, exportParsed };
