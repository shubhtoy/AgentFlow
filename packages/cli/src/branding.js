'use strict';

const fs = require('fs');
const path = require('path');
const { brandConfigSchema } = require('@agentflow/core/schemas/brand-schemas');

const DEFAULTS = Object.freeze({ name: 'AgentFlow', dir: '.agentflow', cli: 'agentflow' });

/**
 * Load brand configuration with precedence: env vars > config file > defaults.
 * Invalid config file → log warning, use defaults (non-fatal).
 * Invalid env vars → throw at startup (fatal).
 * @param {string} [rootDir] - Absolute path to the .agentflow directory (config file is looked up in its parent)
 * @returns {Readonly<object>} Frozen BrandConfig
 */
function loadBrandConfig(rootDir) {
  const config = { ...DEFAULTS };

  // Step 1: Try config file in parent of rootDir (or cwd)
  const baseDir = rootDir ? path.dirname(rootDir) : process.cwd();
  const configPath = path.join(baseDir, 'agentflow.config.json');
  try {
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const parsed = brandConfigSchema.safeParse(raw);
      if (parsed.success) {
        Object.assign(config, parsed.data);
      } else {
        console.warn(`[branding] Invalid config file at ${configPath}, using defaults`);
      }
    }
  } catch (err) {
    console.warn(`[branding] Failed to read ${configPath}: ${err.message}`);
  }

  // Step 2: Overlay env vars (highest precedence)
  if (process.env.AGENTFLOW_BRAND_NAME) config.name = process.env.AGENTFLOW_BRAND_NAME;
  if (process.env.AGENTFLOW_DIR) config.dir = process.env.AGENTFLOW_DIR;
  if (process.env.AGENTFLOW_CLI) config.cli = process.env.AGENTFLOW_CLI;

  // Step 3: Validate final config — env var errors are fatal
  const validated = brandConfigSchema.parse(config);
  return Object.freeze(validated);
}

module.exports = { DEFAULTS, loadBrandConfig };
