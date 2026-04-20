'use strict';

const path = require('path');
const fs = require('fs');
const { FidelityReporter } = require('@agentflow/core/transport/fidelity-reporter');
const { isPathSafe } = require('@agentflow/core/transport/utils');

/**
 * Import from a platform format into AgentFlow workspace format.
 */
async function importFromPlatform(platformName, sourceFiles, options, transportRegistry) {
  const adapter = transportRegistry.get(platformName);
  if (!adapter) {
    return { ok: false, error: `Unknown platform: ${platformName}` };
  }
  if (!adapter.capabilities.includes('import')) {
    return { ok: false, error: `Platform "${platformName}" does not support import` };
  }

  const validation = adapter.validateImportSource(sourceFiles);

  try {
    const result = await adapter.importWorkspace(sourceFiles, options);

    // Path safety validation
    for (const filePath of Object.keys(result.files)) {
      if (path.isAbsolute(filePath) || filePath.includes('..')) {
        return { ok: false, error: `Adapter produced invalid path: ${filePath}` };
      }
    }

    return {
      ok: true,
      data: {
        files: result.files,
        warnings: [...(validation.warnings || []), ...(result.warnings || [])],
        mappingReport: adapter.getMappingInfo(),
      },
    };
  } catch (err) {
    return { ok: false, error: `Import from ${platformName} failed: ${err.message}` };
  }
}

/**
 * Auto-detect which platform a project directory belongs to.
 * Checks for platform-specific marker files.
 * Returns platform name or null.
 */
function detectPlatform(projectDir) {
  const markers = {
    'kiro': ['.kiro/steering'],
    'cursor': ['.cursor/rules', '.cursorrules'],
    'claude-code': ['CLAUDE.md', '.claude'],
    'vscode-copilot': ['.github/copilot-instructions.md', '.github/instructions'],
    'windsurf': ['.windsurf/rules', '.windsurfrules'],
    'openclaw': ['SOUL.md', 'HEARTBEAT.md', '.openclaw'],
  };

  let bestMatch = null;
  let bestScore = 0;

  for (const [platform, paths] of Object.entries(markers)) {
    let score = 0;
    for (const p of paths) {
      try {
        if (fs.existsSync(path.join(projectDir, p))) score++;
      } catch { /* ignore */ }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = platform;
    }
  }

  return bestMatch;
}

/**
 * ImportPipeline — orchestrates import with fidelity reporting,
 * dryRun support, and AGENTS.md validation.
 */
class ImportPipeline {
  constructor(registry) {
    this.registry = registry;
    this.reporter = new FidelityReporter();
  }

  async import(platformName, sourceFiles, options = {}) {
    const result = await importFromPlatform(platformName, sourceFiles, options, this.registry);
    if (!result.ok) return result;

    const warnings = [...(result.data.warnings || [])];

    // Check for AGENTS.md in output
    const hasAgents = Object.keys(result.data.files).some(p => p === 'AGENTS.md' || p.endsWith('/AGENTS.md'));
    if (!hasAgents) {
      warnings.push('AGENTS.md not present in import result');
    }

    // Validate all output paths
    for (const filePath of Object.keys(result.data.files)) {
      if (!isPathSafe(filePath)) {
        return { ok: false, error: `Unsafe output path: ${filePath}` };
      }
    }

    // Build fidelity report
    const entries = (result.data.mappingReport.importMappings || []).map(m => ({
      source: m.source,
      target: m.target || '—',
      fidelity: this._normalizeFidelity(m.fidelity),
      note: m.note || '',
    }));
    const report = this.reporter.build(platformName, 'import', entries);

    return {
      ok: true,
      data: {
        files: options.dryRun ? {} : result.data.files,
        warnings,
        fidelityReport: report,
        dryRun: !!options.dryRun,
      },
    };
  }

  _normalizeFidelity(f) {
    const map = { direct: 'native', transform: 'translated', lossy: 'translated', skip: 'preserved' };
    return map[f] || f;
  }
}

module.exports = { importFromPlatform, detectPlatform, ImportPipeline };
