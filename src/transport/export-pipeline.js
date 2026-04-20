'use strict';

const { FidelityReporter } = require('./fidelity-reporter');
const { isPathSafe } = require('./utils');

/**
 * Collect all resource keys referenced by a workflow — from its nodes
 * and its own AGENTS.md descriptor. Does NOT collect from the root
 * workspace descriptor.
 */
function collectReferencedKeys(workflowId, graph) {
  const keys = new Set();
  const wf = (graph.workflows || {})[workflowId];
  if (!wf) return keys;

  const collect = (refs) => {
    for (const ref of refs || []) {
      if (ref.category && ref.name) keys.add(`${ref.category}/${ref.name}`);
      if (ref.condition && ref.condition.includes('/')) keys.add(ref.condition);
    }
  };
  for (const node of Object.values(wf.nodes || {})) collect(node.allRefs);
  if (wf.descriptorFile) collect(wf.descriptorFile.refs);
  return keys;
}

/**
 * Build a scoped copy of the graph for a specific workflow.
 * Only includes resources referenced by that workflow + global instructions.
 * Strips customFiles, other workflows, and the root descriptor.
 */
function scopeGraph(workflowId, graph) {
  const keys = collectReferencedKeys(workflowId, graph);
  const wf = graph.workflows?.[workflowId];

  const filterCat = (cat) => {
    const src = graph[cat] || {};
    const out = {};
    for (const [k, v] of Object.entries(src)) {
      if (keys.has(`${cat}/${k}`)) out[k] = v;
    }
    return out;
  };

  // Start with only the active workflow's resources
  const scoped = {
    rootDir: graph.rootDir,
    descriptorFile: wf?.descriptorFile || graph.descriptorFile,
    identity: wf?.descriptorFile?.frontmatter?.identity || graph.identity,
    instructions: filterCat('instructions'),
    capabilities: filterCat('capabilities'),
    runbooks: filterCat('runbooks'),
    memory: filterCat('memory'),
    hooks: filterCat('hooks'),
    customFiles: {},
    workflows: wf ? { [workflowId]: wf } : {},
    allFiles: [],
  };

  // Always include global-scoped instructions (steering)
  for (const [k, v] of Object.entries(graph.instructions || {})) {
    if (v.scope === 'global') scoped.instructions[k] = v;
  }

  return scoped;
}

/**
 * Export an AgentFlow workspace to a target platform format.
 */
async function exportToPlatform(platformName, workspaceGraph, options, transportRegistry) {
  const adapter = transportRegistry.get(platformName);
  if (!adapter) {
    return { ok: false, error: `Unknown platform: ${platformName}` };
  }
  if (!adapter.capabilities.includes('export')) {
    return { ok: false, error: `Platform "${platformName}" does not support export` };
  }

  try {
    const wfIds = Object.keys(workspaceGraph.workflows || {});
    const activeWf = options?.workflowId || wfIds[0];

    // Scope the graph to the active workflow.
    // If the workflow has refs, only include referenced resources.
    // If it has no refs (simple workspace), include everything.
    let graph = workspaceGraph;
    if (activeWf) {
      const keys = collectReferencedKeys(activeWf, workspaceGraph);
      // Only scope if referenced keys actually resolve to real resources
      const matchedKeys = [...keys].filter(k => {
        const [cat, name] = k.split('/');
        return workspaceGraph[cat] && workspaceGraph[cat][name];
      });
      if (matchedKeys.length > 0) {
        graph = scopeGraph(activeWf, workspaceGraph);
      }
      // If no keys matched real resources, use the full graph (no scoping)
    }

    // Pass workflowId in options so resolveGraphSource can use it
    const exportOptions = { ...options, workflowId: activeWf };

    const result = await adapter.exportWorkspace(graph, exportOptions);

    // Path safety validation
    for (const filePath of Object.keys(result.files)) {
      if (/^(?:\/|[A-Za-z]:[\\/])/.test(filePath) || filePath.includes('..')) {
        return { ok: false, error: `Adapter produced invalid path: ${filePath}` };
      }
    }

    return {
      ok: true,
      data: {
        files: result.files,
        warnings: result.warnings || [],
        mappingReport: adapter.getMappingInfo(),
      },
    };
  } catch (err) {
    return { ok: false, error: `Export to ${platformName} failed: ${err.message}` };
  }
}

/**
 * ExportPipeline — orchestrates export with fidelity reporting.
 * Wraps the existing exportToPlatform function.
 */
class ExportPipeline {
  constructor(registry) {
    this.registry = registry;
    this.reporter = new FidelityReporter();
  }

  async export(platformName, graph, options = {}) {
    const result = await exportToPlatform(platformName, graph, options, this.registry);
    if (!result.ok) return result;

    const entries = (result.data.mappingReport.exportMappings || []).map(m => ({
      source: m.source,
      target: m.target || '—',
      fidelity: this._normalizeFidelity(m.fidelity),
      note: m.note || '',
    }));

    const report = this.reporter.build(platformName, 'export', entries);

    for (const filePath of Object.keys(result.data.files)) {
      if (!isPathSafe(filePath)) {
        return { ok: false, error: `Unsafe output path: ${filePath}` };
      }
    }

    return {
      ok: true,
      data: {
        ...result.data,
        fidelityReport: report,
      },
    };
  }

  _normalizeFidelity(f) {
    const map = { direct: 'native', transform: 'translated', lossy: 'translated', skip: 'preserved' };
    return map[f] || f;
  }
}

module.exports = { exportToPlatform, ExportPipeline };
