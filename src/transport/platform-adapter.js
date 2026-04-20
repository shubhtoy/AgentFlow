'use strict';

const { TRANSFORMS } = require('./transforms');
const { resolveGraphSource, matchGlob, extractName, mergeIntoExisting } = require('./utils');

/**
 * PlatformAdapter — single generic class driven by a declarative JSON config.
 * No subclasses needed. Every platform is just a different config.
 */
class PlatformAdapter {
  constructor(config) {
    this.name = config.name;
    this.displayName = config.displayName;
    this.version = config.version;
    this.capabilities = config.capabilities;
    this.config = config;
  }

  async exportWorkspace(graph, options = {}) {
    const files = {};
    const warnings = [];

    for (const rule of this.config.exportRules) {
      if (rule.type === 'skip') {
        const src = resolveGraphSource(graph, rule.source, options);
        if (src && Object.keys(src).length > 0) {
          warnings.push(rule.note || `${rule.source}: skipped`);
        }
        continue;
      }

      let sourceData = resolveGraphSource(graph, rule.source, options);
      if (!sourceData) continue;

      // Apply sourceFilter — filter entries by metadata fields (e.g. scope, inclusion)
      if (rule.sourceFilter && typeof sourceData === 'object' && !Array.isArray(sourceData)) {
        const filtered = {};
        for (const [k, v] of Object.entries(sourceData)) {
          const match = Object.entries(rule.sourceFilter).every(([field, expected]) =>
            v && v[field] === expected
          );
          if (match) filtered[k] = v;
        }
        sourceData = Object.keys(filtered).length > 0 ? filtered : null;
        if (!sourceData) continue;
      }

      const transformFn = TRANSFORMS[rule.transform];
      if (!transformFn) {
        warnings.push(`Transform "${rule.transform}" not found — skipping ${rule.source}`);
        continue;
      }

      switch (rule.type) {
        case 'single-file': {
          const content = transformFn(sourceData, graph, options);
          if (content && rule.target) files[rule.target] = content;
          break;
        }
        case 'glob-copy':
        case 'glob-transform': {
          const entries = Object.entries(sourceData);
          for (const [name, data] of entries) {
            if (rule.exclude?.includes(`${name}.md`) || rule.exclude?.includes(`${name}.json`)) continue;
            const targetPath = rule.target.replace('{name}', name);
            files[targetPath] = transformFn(data, graph, options);
          }
          break;
        }
        case 'merge-into': {
          const merged = transformFn(sourceData, graph, options);
          if (merged) {
            const mergeKey = rule.mergeTarget || rule.target;
            if (mergeKey) files[mergeKey] = mergeIntoExisting(files[mergeKey], merged);
          }
          break;
        }
      }

      if (rule.fidelity === 'lossy' && rule.note) {
        warnings.push(rule.note);
      }
    }

    // Resolve {{$var}} and {{ref}} tokens in all output files
    const { resolveRefs, resolveTemplateVars } = require('./default-export');
    for (const [p, content] of Object.entries(files)) {
      if (typeof content === 'string' && content.includes('{{')) {
        files[p] = resolveTemplateVars(resolveRefs(content, graph), graph, files);
      }
    }

    return { files, warnings };
  }

  async importWorkspace(sourceFiles, options = {}) {
    const files = {};
    const warnings = [];

    for (const rule of (this.config.importRules || [])) {
      if (rule.type === 'skip') continue;

      const transformFn = TRANSFORMS[rule.transform];
      if (!transformFn) {
        warnings.push(`Transform "${rule.transform}" not found — skipping ${rule.source}`);
        continue;
      }

      switch (rule.type) {
        case 'single-file': {
          const content = sourceFiles[rule.source];
          if (!content) continue;
          const result = transformFn(content, sourceFiles, options);
          if (result && rule.target) files[rule.target] = result;
          break;
        }
        case 'glob-copy':
        case 'glob-transform': {
          const matched = matchGlob(sourceFiles, rule.source);
          for (const [sourcePath, content] of Object.entries(matched)) {
            const name = extractName(sourcePath, rule.source);
            if (rule.exclude?.includes(`${name}.md`) || rule.exclude?.includes(`${name}.json`)) continue;
            const targetPath = rule.target.replace('{name}', name);
            files[targetPath] = transformFn(content, sourceFiles, options);
          }
          break;
        }
        case 'merge-into': {
          const matched = matchGlob(sourceFiles, rule.source);
          const merged = transformFn(matched, sourceFiles, options);
          if (merged) {
            const mergeKey = rule.mergeTarget || rule.target;
            if (mergeKey) files[mergeKey] = mergeIntoExisting(files[mergeKey], merged);
          }
          break;
        }
      }

      if (rule.fidelity === 'lossy' && rule.note) {
        warnings.push(rule.note);
      }
    }

    return { files, warnings };
  }

  validateImportSource(sourceFiles) {
    const errors = [];
    const warnings = [];
    for (const rule of (this.config.importRules || [])) {
      if (rule.type === 'skip') continue;
      if (rule.type === 'single-file' && !sourceFiles[rule.source]) {
        warnings.push(`Expected source file "${rule.source}" not found`);
      }
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  getMappingInfo() {
    return {
      platform: this.name,
      exportMappings: this.config.exportRules.map(r => ({
        source: r.source, target: r.target, fidelity: r.fidelity, note: r.note,
      })),
      importMappings: (this.config.importRules || []).map(r => ({
        source: r.source, target: r.target, fidelity: r.fidelity, note: r.note,
      })),
    };
  }
}

module.exports = { PlatformAdapter };
