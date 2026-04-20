'use strict';

const fs = require('fs');
const path = require('path');
const { ok, fail, ErrorCode } = require('@agentflow/core/services/types');
const { CANONICAL_CATEGORIES } = require('@agentflow/core/taxonomy');

/**
 * Create an ExportService for multi-format workspace export.
 * @param {{ rootDir: string, logger: object }} ctx
 */
function createExportService(ctx) {
  const { rootDir, logger } = ctx;

  /**
   * Walk a directory recursively and return a file map.
   * @param {string} dir
   * @param {string} base — base for relative paths
   * @returns {Record<string, string>}
   */
  function walkDir(dir, base) {
    const fileMap = {};
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(base, fullPath);
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      if (relPath.includes('/output/') || relPath.startsWith('output/')) continue;
      if (entry.isDirectory()) {
        Object.assign(fileMap, walkDir(fullPath, base));
      } else {
        try {
          fileMap[relPath] = fs.readFileSync(fullPath, 'utf8');
        } catch (_) { /* skip binary/unreadable */ }
      }
    }
    return fileMap;
  }

  /**
   * Build a graph summary from the parsed workspace.
   */
  function buildGraphSummary(graph) {
    const workflows = {};
    for (const [id, wf] of Object.entries(graph.workflows || {})) {
      const nodes = {};
      for (const [nid, n] of Object.entries(wf.nodes || {})) {
        nodes[nid] = { name: n.name || nid, type: n.nodeType || 'step' };
      }
      workflows[id] = {
        name: wf.name || id,
        nodes,
        edges: (wf.edges || []).map(e => ({ from: e.from, to: e.to, condition: e.condition?.raw })),
        entryPoints: wf.entryPoints || [],
      };
    }
    const resources = {};
    for (const cat of CANONICAL_CATEGORIES) {
      resources[cat] = Object.keys(graph[cat] || {});
    }
    return { workflows, resources };
  }

  return {
    /**
     * Export workspace in the specified format.
     * @param {{ format: string, workflowId?: string, outputPath?: string }} options
     */
    async exportWorkspace(options = {}) {
      const { format = 'json', workflowId, outputPath } = options;

      try {
        const fileMap = walkDir(rootDir, rootDir);
        if (Object.keys(fileMap).length === 0) {
          return fail(ErrorCode.INVALID_INPUT, 'No files found in workspace', 400);
        }

        // If workflowId specified, filter to that workflow's files
        let filteredMap = fileMap;
        if (workflowId) {
          filteredMap = {};
          for (const [p, content] of Object.entries(fileMap)) {
            // Include workflow-specific files + shared resources
            const isSharedResource = CANONICAL_CATEGORIES.some(cat => p.startsWith(cat + '/'));
            if (p.startsWith(workflowId + '/') || p === 'AGENTS.md' || isSharedResource) {
              filteredMap[p] = content;
            }
          }
        }

        // Parse graph for metadata
        let graph = null;
        try {
          const { parseRoot } = require('../parser');
          graph = parseRoot(rootDir);
        } catch (_) { /* graph summary is optional */ }

        switch (format) {
          case 'json': {
            const bundle = {
              version: '1.0.0',
              exportedAt: new Date().toISOString(),
              source: {
                name: graph?.identity?.name || path.basename(rootDir),
                agentflowVersion: '2.0.0',
              },
              files: filteredMap,
              graph: graph ? buildGraphSummary(graph) : null,
            };
            return ok({ data: JSON.stringify(bundle, null, 2), contentType: 'application/json' });
          }

          case 'zip': {
            const JSZip = require('jszip');
            const zip = new JSZip();
            for (const [p, content] of Object.entries(filteredMap)) {
              zip.file(p, content);
            }
            const buffer = await zip.generateAsync({ type: 'nodebuffer' });
            return ok({ data: buffer, contentType: 'application/zip' });
          }

          case 'dir': {
            if (!outputPath) {
              return fail(ErrorCode.INVALID_INPUT, 'outputPath required for dir format', 400);
            }
            for (const [p, content] of Object.entries(filteredMap)) {
              const fullPath = path.join(outputPath, p);
              fs.mkdirSync(path.dirname(fullPath), { recursive: true });
              fs.writeFileSync(fullPath, content, 'utf8');
            }
            return ok({ path: outputPath, fileCount: Object.keys(filteredMap).length });
          }

          case 'share': {
            const compact = {
              v: 1,
              n: graph?.identity?.name || path.basename(rootDir),
              f: filteredMap,
              m: { t: new Date().toISOString(), c: Object.keys(filteredMap).length },
            };
            const json = JSON.stringify(compact);
            const warnings = [];
            if (json.length > 1024 * 1024) {
              warnings.push(`Shareable format is ${Math.round(json.length / 1024)}KB — may be too large for URL sharing`);
            }
            return ok({ data: json, contentType: 'application/json', warnings });
          }

          default:
            return fail(ErrorCode.INVALID_INPUT, `Unknown format: ${format}`, 400);
        }
      } catch (err) {
        logger.error({ err }, 'ExportService.exportWorkspace failed');
        return fail(ErrorCode.UNKNOWN, err.message);
      }
    },
  };
}

module.exports = { createExportService };
