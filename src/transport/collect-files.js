'use strict';

/**
 * Shared file-collection logic for all export formats.
 *
 * collectWorkflowFiles(graph, workflowId) returns a structured object
 * with all files needed for a workflow export. Each format (default, raw,
 * parsed) then transforms this into its output.
 */

/**
 * Collect all resource keys referenced by a workflow's nodes and descriptor.
 */
function collectReferencedKeys(workflow) {
  const keys = new Set();
  const collect = (refs) => {
    for (const ref of refs || []) {
      if (ref.category && ref.name) keys.add(`${ref.category}/${ref.name}`);
      if (ref.condition && ref.condition.includes('/')) keys.add(ref.condition);
    }
  };
  for (const node of Object.values(workflow.nodes || {})) {
    collect(node.allRefs);
  }
  if (workflow.descriptorFile) {
    collect(workflow.descriptorFile.refs || workflow.descriptorFile.allRefs);
  }
  return keys;
}

/**
 * Get raw content from a parsed file object.
 */
function rawContent(file) {
  if (!file) return '';
  if (typeof file === 'string') return file;
  return file.rawContent || file.content || '';
}

/**
 * Collect all files for a workflow export.
 *
 * @param {object} graph - Full parsed WorkflowGraph
 * @param {string} [workflowId] - Scope to a single workflow (optional)
 * @returns {object} Structured collection:
 *   - descriptor: { path, content, file } — workspace AGENTS.md
 *   - workflows: { [wfId]: { descriptor, nodes: [{ path, content, file, contextFiles }] } }
 *   - resources: { instructions, capabilities, runbooks, memory, hooks } — each { [name]: { path, content, file } }
 *   - customFiles: { [path]: content }
 *   - mcp: object | null
 */
function collectWorkflowFiles(graph, workflowId) {
  const result = {
    descriptor: null,
    workflows: {},
    resources: { instructions: {}, capabilities: {}, runbooks: {}, memory: {}, hooks: {} },
    customFiles: {},
    mcp: null,
  };

  if (!graph) return result;

  // Workspace descriptor
  if (graph.descriptorFile) {
    result.descriptor = {
      path: 'AGENTS.md',
      content: rawContent(graph.descriptorFile),
      file: graph.descriptorFile,
    };
  }

  // Determine which workflows to include
  const wfEntries = workflowId
    ? (graph.workflows?.[workflowId] ? [[workflowId, graph.workflows[workflowId]]] : [])
    : Object.entries(graph.workflows || {});

  // Collect referenced keys across all included workflows
  const allRefKeys = new Set();
  for (const [, wf] of wfEntries) {
    for (const key of collectReferencedKeys(wf)) allRefKeys.add(key);
  }

  // Always include global instructions
  for (const [k, v] of Object.entries(graph.instructions || {})) {
    if (v && v.scope === 'global') allRefKeys.add(`instructions/${k}`);
  }

  // Workflows
  for (const [wfId, wf] of wfEntries) {
    const wfPath = (relPath, fallback) => {
      if (!relPath) return fallback;
      if (relPath.startsWith(wfId + '/')) return relPath;
      return `${wfId}/${relPath}`;
    };

    const wfData = { descriptor: null, nodes: [] };

    if (wf.descriptorFile) {
      wfData.descriptor = {
        path: wfPath(wf.descriptorFile.relativePath, `${wfId}/AGENTS.md`),
        content: rawContent(wf.descriptorFile),
        file: wf.descriptorFile,
      };
    }

    for (const [nodeId, node] of Object.entries(wf.nodes || {})) {
      const nodeData = { id: nodeId, primary: null, contextFiles: [] };
      const pf = node.primaryFile;
      if (pf?.relativePath) {
        nodeData.primary = {
          path: wfPath(pf.relativePath, `${wfId}/${nodeId}/SKILL.md`),
          content: rawContent(pf),
          file: pf,
        };
      } else if (node.rawContent || node.content) {
        // Node has content directly (no primaryFile wrapper)
        nodeData.primary = {
          path: `${wfId}/${nodeId}/SKILL.md`,
          content: rawContent(node),
          file: node,
        };
      }
      for (const cf of node.contextFiles || []) {
        if (cf.relativePath) {
          nodeData.contextFiles.push({
            path: wfPath(cf.relativePath, ''),
            content: rawContent(cf),
            file: cf,
          });
        }
      }
      wfData.nodes.push(nodeData);
    }

    result.workflows[wfId] = wfData;
  }

  // Shared resources — scoped to referenced keys when exporting a single workflow,
  // include all when exporting the full workspace
  const CATEGORIES = ['instructions', 'capabilities', 'runbooks', 'memory', 'hooks'];
  for (const cat of CATEGORIES) {
    for (const [key, file] of Object.entries(graph[cat] || {})) {
      if (!workflowId || allRefKeys.has(`${cat}/${key}`)) {
        result.resources[cat][key] = {
          path: file.relativePath || `${cat}/${key}.md`,
          content: rawContent(file),
          file,
        };
      }
    }
  }

  // Custom files
  for (const [filePath, data] of Object.entries(graph.customFiles || {})) {
    result.customFiles[filePath] = rawContent(data);
  }

  // MCP config
  const mcp = graph.protocols?.mcp || graph.mcpServers;
  if (mcp && Object.keys(mcp).length > 0) {
    result.mcp = mcp;
  }

  return result;
}

/**
 * Flatten a collected result into a simple { path: content } file map.
 * Used by raw export and as a base for other formats.
 */
function toFileMap(collected) {
  const files = {};

  if (collected.descriptor) {
    files[collected.descriptor.path] = collected.descriptor.content;
  }

  for (const [, wf] of Object.entries(collected.workflows)) {
    if (wf.descriptor) files[wf.descriptor.path] = wf.descriptor.content;
    for (const node of wf.nodes) {
      if (node.primary) files[node.primary.path] = node.primary.content;
      for (const cf of node.contextFiles) files[cf.path] = cf.content;
    }
  }

  for (const [cat, items] of Object.entries(collected.resources)) {
    for (const [, item] of Object.entries(items)) {
      files[item.path] = item.content;
    }
  }

  for (const [path, content] of Object.entries(collected.customFiles)) {
    files[path] = content;
  }

  if (collected.mcp) {
    files['mcp.json'] = JSON.stringify({ mcpServers: collected.mcp }, null, 2);
  }

  return files;
}

module.exports = { collectWorkflowFiles, collectReferencedKeys, toFileMap, rawContent };
