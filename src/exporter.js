'use strict';

const { resolveRef } = require('./parser');

/* ------------------------------------------------------------------ */
/*  resolveForExport(ref, graph)                                       */
/*  Per-type resolution strategy for export.                           */
/* ------------------------------------------------------------------ */

/**
 * Resolve a single ref for export output.
 *
 * Returns { text, error? } where:
 * - Edge_Ref        → node id string (the target node identifier)
 * - Conditional_Edge_Ref → node id string (condition resolved separately on edges)
 * - Mention_Ref     → inline markdown body of the target resource
 * - Data_Flow_Ref   → `[output from: nodeName]` placeholder
 * - Unresolved      → `[UNRESOLVED: {{original}}]` marker + error object
 *
 * Uses path-first, name-second resolution order via resolveRef from parser.
 *
 * @param {object} ref   - A Ref object
 * @param {object} graph - A WorkflowGraph
 * @returns {{ text: string, error?: object }}
 */
function resolveForExport(ref, graph) {
  if (!ref || !graph) {
    const raw = (ref && ref.raw) || '';
    return {
      text: `[UNRESOLVED: {{${raw}}}]`,
      error: {
        type: 'unresolved_ref',
        source: '',
        ref: raw,
        message: `Could not resolve ref: {{${raw}}}`,
      },
    };
  }

  // Template variables ({{$var}}) — preserve as-is, resolved at export time
  const original = ref.raw || '';
  if (original.startsWith('$')) {
    return { text: `{{${original}}}` };
  }
  const resolved = resolveRef(ref, graph);

  if (!resolved || !resolved.target) {
    return {
      text: `[UNRESOLVED: {{${original}}}]`,
      error: {
        type: 'unresolved_ref',
        source: '',
        ref: original,
        message: `Could not resolve ref: {{${original}}}`,
      },
    };
  }

  // --- Edge refs (plain and conditional) ---
  if (ref.semanticType === 'edge') {
    const target = resolved.target;
    return { text: target.id || target.name || original };
  }

  // --- Data flow refs → placeholder ---
  if (ref.semanticType === 'data_flow') {
    return { text: `[output from: ${ref.name || ''}]` };
  }

  // --- Mention refs → inline markdown body of target ---
  return { text: resolved.target.content || '' };
}

/**
 * Resolve a single ref to its file path (not content).
 *
 * Returns { text, error? } where:
 * - Edge_Ref        → target file's relativePath
 * - Mention_Ref     → target file's relativePath
 * - Data_Flow_Ref   → `[output from: nodeName]`
 * - Unresolved      → `[UNRESOLVED: {{original}}]`
 *
 * @param {object} ref   - A Ref object
 * @param {object} graph - A WorkflowGraph
 * @returns {{ text: string, error?: object }}
 */
function resolveToPath(ref, graph) {
  if (!ref || !graph) {
    const raw = (ref && ref.raw) || '';
    return {
      text: `[UNRESOLVED: {{${raw}}}]`,
      error: {
        type: 'unresolved_ref',
        source: '',
        ref: raw,
        message: `Could not resolve ref: {{${raw}}}`,
      },
    };
  }

  const original = ref.raw || '';
  const resolved = resolveRef(ref, graph);

  if (!resolved || !resolved.target) {
    return {
      text: `[UNRESOLVED: {{${original}}}]`,
      error: {
        type: 'unresolved_ref',
        source: '',
        ref: original,
        message: `Could not resolve ref: {{${original}}}`,
      },
    };
  }

  // Data flow refs → placeholder (no file to point to)
  if (ref.semanticType === 'data_flow') {
    return { text: `[output from: ${ref.name || ''}]` };
  }

  // Everything else → the target's relative file path
  const target = resolved.target;
  const filePath = target.relativePath || target.filePath || target.id || target.name || original;
  return { text: filePath };
}

/* ------------------------------------------------------------------ */
/*  Content resolution helpers                                         */
/* ------------------------------------------------------------------ */

/**
 * Replace all ref tokens in content with their export-resolved forms.
 * - Mention refs   → target's markdown body
 * - Data flow refs → [output from: nodeName]
 * - Edge refs      → left as-is by default (structural), or resolved if resolveEdges is true
 * - Unresolved     → [UNRESOLVED: {{original}}]
 *
 * Preserves ${env:VARIABLE_NAME} tokens as-is.
 *
 * @param {string}   content - Markdown content
 * @param {object[]} refs    - Array of Ref objects with offsets
 * @param {object}   graph   - WorkflowGraph
 * @param {object}   [opts]  - Options
 * @param {boolean}  [opts.resolveEdges=false] - Whether to resolve edge refs too
 * @returns {{ resolved: string, errors: object[] }}
 */
function resolveContentRefs(content, refs, graph, opts) {
  const errors = [];
  if (!content || !refs || refs.length === 0) return { resolved: content || '', errors };
  const resolveEdges = opts && opts.resolveEdges;

  let result = content;

  // Sort refs by offset descending so replacements don't shift positions
  const sorted = [...refs]
    .filter((r) => r.offset != null)
    .sort((a, b) => b.offset - a.offset);

  for (const ref of sorted) {
    // Reconstruct the original token from the raw field
    const token = `{{${ref.raw}}}`;
    const idx = result.indexOf(token);
    if (idx === -1) continue;

    // Edge refs are structural — skip unless resolveEdges is set
    if (ref.semanticType === 'edge' && !resolveEdges) continue;

    const { text, error } = resolveForExport(ref, graph);
    if (error) errors.push(error);
    result = result.slice(0, idx) + text + result.slice(idx + token.length);
  }

  return { resolved: result, errors };
}

/* ------------------------------------------------------------------ */
/*  Export helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Build an ExportNode from a NodeDef.
 *
 * @param {string}   nodeId        - Node identifier
 * @param {object}   node          - NodeDef
 * @param {object}   graph         - WorkflowGraph
 * @param {object[]} workflowEdges - All edges in the workflow
 * @returns {{ exportNode: object, errors: object[] }}
 */
function buildExportNode(nodeId, node, graph, workflowEdges) {
  const primary = node.primaryFile || {};
  const contextFiles = node.contextFiles || [];
  const nodeErrors = [];

  // Resolve content refs in primary file
  const { resolved: resolvedContent, errors: primaryErrors } = resolveContentRefs(
    primary.content || '',
    primary.refs || [],
    graph
  );
  for (const err of primaryErrors) {
    err.source = err.source || primary.filePath || nodeId;
    nodeErrors.push(err);
  }

  // Resolve content refs in each context file
  const contextContent = [];
  for (const cf of contextFiles) {
    const { resolved, errors: cfErrors } = resolveContentRefs(
      cf.content || '',
      cf.refs || [],
      graph
    );
    contextContent.push(resolved);
    for (const err of cfErrors) {
      err.source = err.source || cf.filePath || nodeId;
      nodeErrors.push(err);
    }
  }

  // Compute outgoing edges for this node
  const outgoingEdges = workflowEdges
    .filter((e) => e.from === nodeId)
    .map((e) => e.to);

  const exportNode = {
    id: nodeId,
    name: node.name || '',
    description: node.description || undefined,
    type: node.nodeType || 'step',
    content: resolvedContent,
    contextContent,
    frontmatter: primary.frontmatter || {},
    summary: {
      name: node.name || '',
      description: node.description || undefined,
      type: node.nodeType || 'step',
      outgoingEdges,
    },
  };

  // MWP-inspired: include context budget if declared
  if (node.contextBudget) {
    exportNode.contextBudget = node.contextBudget;
  }

  // MWP-inspired: include output declarations if declared
  if (node.outputDeclarations) {
    exportNode.outputDeclarations = node.outputDeclarations;
  }

  // MWP-inspired: include discovered artifacts from output/ directory
  if (node.artifacts && node.artifacts.length > 0) {
    exportNode.artifacts = node.artifacts;
  }

  return { exportNode, errors: nodeErrors };
}

/**
 * Build an ExportEdge from an EdgeDef, resolving condition template.
 */
function buildExportEdge(edge, graph) {
  const result = {
    from: edge.from,
    to: edge.to,
  };

  if (edge.condition) {
    // Resolve the condition template to get the check field
    const condRef = {
      raw: edge.condition,
      semanticType: 'mention',
      category: edge.condition.includes('/')
        ? edge.condition.split('/')[0]
        : edge.condition,
      name: edge.condition.includes('/')
        ? edge.condition.split('/').slice(1).join('/')
        : '',
    };
    const condResolved = resolveRef(condRef, graph);
    const check =
      condResolved && condResolved.target
        ? (condResolved.target.frontmatter || {}).check || ''
        : '';

    result.condition = {
      templateRef: edge.condition,
      check,
    };
  }

  return result;
}

/**
 * Build an ExportTool from a tool ParsedFile.
 * Uses toolType set by the parser (builtin, script, mcp, package).
 */
function buildExportTool(file) {
  const fm = file.frontmatter || {};
  const tool = {
    name: fm.name || '',
    description: fm.description || undefined,
    type: file.toolType || fm.type || 'builtin',
    content: file.content || '',
  };
  if (fm.command) tool.command = fm.command;
  if (fm.mcp) tool.mcp = fm.mcp;
  if (fm.package) tool.package = fm.package;
  if (fm.parameters) tool.parameters = fm.parameters;
  if (fm.builtin_mapping) tool.builtinMapping = fm.builtin_mapping;
  return tool;
}

/**
 * Build an ExportResource from a ParsedFile.
 */
function buildExportResource(file) {
  const fm = file.frontmatter || {};
  return {
    name: fm.name || '',
    description: fm.description || undefined,
    content: file.content || '',
    frontmatter: fm,
  };
}

/* ------------------------------------------------------------------ */
/*  collectErrors — gather unresolved refs across the workflow          */
/* ------------------------------------------------------------------ */

/**
 * Collect unresolved ref errors from all nodes in a workflow.
 */
function collectErrors(workflow, graph) {
  const errors = [];
  const nodes = workflow.nodes || {};

  for (const nodeId of Object.keys(nodes)) {
    const node = nodes[nodeId];
    const allRefs = node.allRefs || [];

    for (const ref of allRefs) {
      const resolved = resolveRef(ref, graph);

      if (!resolved || !resolved.target) {
        errors.push({
          type: 'unresolved_ref',
          source: (node.primaryFile || {}).filePath || nodeId,
          ref: ref.raw,
          message: `Unresolved ${ref.semanticType} ref: {{${ref.raw}}}`,
        });
      }

      // For conditional edges, also check the condition template
      if (ref.semanticType === 'edge' && ref.condition) {
        const condRef = {
          raw: ref.condition,
          semanticType: 'mention',
          category: ref.condition.includes('/')
            ? ref.condition.split('/')[0]
            : ref.condition,
          name: ref.condition.includes('/')
            ? ref.condition.split('/').slice(1).join('/')
            : '',
        };
        const condResolved = resolveRef(condRef, graph);
        if (!condResolved || !condResolved.target) {
          errors.push({
            type: 'unresolved_ref',
            source: (node.primaryFile || {}).filePath || nodeId,
            ref: ref.condition,
            message: `Unresolved condition template: {{${ref.condition}}}`,
          });
        }
      }
    }
  }

  return errors;
}

/* ------------------------------------------------------------------ */
/*  exportWorkflow(graph, workflowId) → ExportBundle                   */
/* ------------------------------------------------------------------ */

/**
 * Export a workflow as a self-contained ExportBundle.
 *
 * Builds:
 * - graph: nodes (resolved content, context content, summary) and edges (with conditions)
 * - resources: tools, skills, interactions, templates, memory
 * - metadata: workflow name, description, export timestamp, agentflow version
 * - entry_points: explicit/inferred flags
 * - errors: unresolved refs
 *
 * Preserves ${env:VARIABLE_NAME} tokens as-is.
 *
 * @param {object} graph      - WorkflowGraph from parser
 * @param {string} workflowId - Workflow identifier
 * @returns {object} ExportBundle
 */
function exportWorkflow(graph, workflowId) {
  if (!graph) {
    return {
      graph: { nodes: {}, edges: [] },
      resources: { capabilities: {}, instructions: {}, runbooks: {}, memory: {} },
      metadata: { name: '', exportedAt: new Date().toISOString(), agentflowVersion: '2.0.0' },
      entry_points: [],
      errors: [{ type: 'validation_error', source: '', message: 'No graph provided' }],
    };
  }

  const workflows = graph.workflows || {};
  const workflow = workflows[workflowId];

  if (!workflow) {
    return {
      graph: { nodes: {}, edges: [] },
      resources: { capabilities: {}, instructions: {}, runbooks: {}, memory: {} },
      metadata: { name: workflowId || '', exportedAt: new Date().toISOString(), agentflowVersion: '2.0.0' },
      entry_points: [],
      errors: [{ type: 'validation_error', source: '', message: `Workflow "${workflowId}" not found` }],
    };
  }

  // --- Build graph nodes ---
  const exportNodes = {};
  const wfNodes = workflow.nodes || {};
  const wfEdges = workflow.edges || [];

  for (const nodeId of Object.keys(wfNodes)) {
    const { exportNode } = buildExportNode(nodeId, wfNodes[nodeId], graph, wfEdges);
    exportNodes[nodeId] = exportNode;
  }

  // --- Build graph edges ---
  const exportEdges = wfEdges.map((e) => buildExportEdge(e, graph));

  // --- Build resources (only those referenced by this workflow's nodes) ---
  const referencedKeys = new Set();
  const collectRefs = (refs) => {
    for (const ref of refs || []) {
      if (ref.category && ref.name) {
        referencedKeys.add(`${ref.category}/${ref.name}`);
      }
      // Conditional edges: "runbooks/design-approved" in the condition field
      if (ref.condition && ref.condition.includes('/')) {
        referencedKeys.add(ref.condition);
      }
    }
  };
  for (const node of Object.values(wfNodes)) {
    collectRefs(node.allRefs);
  }
  if (workflow.descriptorFile) {
    collectRefs(workflow.descriptorFile.refs);
  }

  const capabilities = {};
  for (const [key, file] of Object.entries(graph.capabilities || {})) {
    if (referencedKeys.has(`capabilities/${key}`)) {
      capabilities[key] = buildExportTool(file);
    }
  }

  const instructions = {};
  for (const [key, file] of Object.entries(graph.instructions || {})) {
    if (referencedKeys.has(`instructions/${key}`)) {
      instructions[key] = buildExportResource(file);
    }
  }

  const runbooks = {};
  for (const [key, file] of Object.entries(graph.runbooks || {})) {
    if (referencedKeys.has(`runbooks/${key}`)) {
      runbooks[key] = buildExportResource(file);
    }
  }

  const memory = {};
  for (const [key, file] of Object.entries(graph.memory || {})) {
    if (referencedKeys.has(`memory/${key}`)) {
      memory[key] = buildExportResource(file);
    }
  }

  // --- Build metadata ---
  const metadata = {
    name: workflow.name || workflowId || '',
    exportedAt: new Date().toISOString(),
    agentflowVersion: '2.0.0',
  };
  if (workflow.description) {
    metadata.description = workflow.description;
  }

  // Include workflow identity if available, otherwise workspace identity
  const wfIdentity = workflow.descriptorFile?.frontmatter?.identity;
  if (wfIdentity) {
    metadata.identity = wfIdentity;
  } else if (graph.identity) {
    metadata.identity = graph.identity;
  }

  // --- Build entry points ---
  const entryPoints = (workflow.entryPoints || []).map((epId) => {
    const node = wfNodes[epId];
    const ep = {
      nodeId: epId,
      name: node ? node.name || epId : epId,
      explicit: node ? node.entry === true : false,
    };
    if (node && node.description) {
      ep.description = node.description;
    }
    return ep;
  });

  // --- Collect errors ---
  const errors = collectErrors(workflow, graph);

  return {
    graph: {
      nodes: exportNodes,
      edges: exportEdges,
    },
    resources: {
      capabilities,
      instructions,
      runbooks,
      memory,
    },
    metadata,
    entry_points: entryPoints,
    errors,
  };
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

module.exports = { resolveForExport, resolveToPath, resolveContentRefs, exportWorkflow };
