'use strict';

const { PlatformMappingConfigSchema } = require('./schemas');
const { PlatformAdapter } = require('./platform-adapter');
const { deepMerge } = require('./utils');

/**
 * AdapterFactory — creates PlatformAdapter instances from configs.
 *
 * Two modes:
 *   new AdapterFactory(builtInDir, userDir)  — reads JSON from disk (Node/CLI)
 *   AdapterFactory.fromConfigs(configs)      — accepts pre-loaded objects (browser)
 */
class AdapterFactory {
  constructor(builtInDir, userDir) {
    this.builtInDir = builtInDir;
    this.userDir = userDir || null;
    this._preloaded = null;
  }

  /** Create factory from pre-loaded config objects (no fs needed) */
  static fromConfigs(configs) {
    const factory = new AdapterFactory(null, null);
    factory._preloaded = configs; // Array of parsed JSON objects
    return factory;
  }

  loadAll() {
    if (this._preloaded) return this._loadFromConfigs(this._preloaded);
    return this._loadFromDisk();
  }

  _loadFromConfigs(configs) {
    const adapters = [];
    for (const config of configs) {
      const parsed = PlatformMappingConfigSchema.safeParse(config);
      if (!parsed.success) {
        console.warn(`Invalid platform config "${config.name || '?'}": ${parsed.error.message}`);
        continue;
      }
      adapters.push(new PlatformAdapter(parsed.data));
    }
    return adapters;
  }

  _loadFromDisk() {
    /* eslint-disable no-eval */
    const path = eval("require")('path');
    const fs = eval("require")('fs');

    const adapters = [];
    const builtInConfigs = this._scanDir(this.builtInDir, path, fs);
    const userConfigs = this.userDir ? this._scanDir(this.userDir, path, fs) : [];

    const allNames = new Set([
      ...builtInConfigs.map(c => c.name),
      ...userConfigs.map(c => c.name),
    ]);

    for (const name of allNames) {
      const builtIn = builtInConfigs.find(c => c.name === name);
      const user = userConfigs.find(c => c.name === name);

      let config;
      try {
        if (builtIn && user) {
          config = deepMerge(
            JSON.parse(fs.readFileSync(builtIn.path, 'utf8')),
            JSON.parse(fs.readFileSync(user.path, 'utf8'))
          );
        } else {
          config = JSON.parse(fs.readFileSync((user || builtIn).path, 'utf8'));
        }
      } catch (err) {
        console.warn(`Failed to read platform config "${name}": ${err.message}`);
        continue;
      }

      const parsed = PlatformMappingConfigSchema.safeParse(config);
      if (!parsed.success) {
        console.warn(`Invalid platform config "${name}": ${parsed.error.message}`);
        continue;
      }
      adapters.push(new PlatformAdapter(parsed.data));
    }
    return adapters;
  }

  registerAll(registry) {
    for (const adapter of this.loadAll()) registry.register(adapter);
    return this;
  }

  _scanDir(dir, path, fs) {
    if (!dir || !fs.existsSync(dir)) return [];
    try {
      return fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => ({ name: path.basename(f, '.json'), path: path.join(dir, f) }));
    } catch { return []; }
  }
}

module.exports = { AdapterFactory };
