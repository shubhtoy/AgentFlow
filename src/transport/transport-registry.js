'use strict';

/**
 * TransportRegistry — register, get, list platform adapters.
 * Rejects duplicate names.
 */
class TransportRegistry {
  constructor() {
    this._adapters = new Map();
  }

  register(adapter) {
    if (this._adapters.has(adapter.name)) {
      throw new Error(`Platform adapter "${adapter.name}" is already registered`);
    }
    this._adapters.set(adapter.name, adapter);
  }

  get(name) {
    return this._adapters.get(name) || null;
  }

  list() {
    return Array.from(this._adapters.values()).map(a => ({
      name: a.name,
      displayName: a.displayName,
      version: a.version,
      capabilities: a.capabilities,
    }));
  }

  supports(name) {
    return this._adapters.has(name);
  }

  has(name) {
    return this._adapters.has(name);
  }

  filterByCapability(capability) {
    return Array.from(this._adapters.values()).filter(a => a.capabilities.includes(capability));
  }
}

module.exports = { TransportRegistry };
