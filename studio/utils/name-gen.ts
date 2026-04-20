/**
 * Docker-style random name generator for nodes and workflows.
 * Produces names like "bold-falcon", "calm-river", "swift-ember".
 */

const adjectives = [
  'bold', 'brave', 'bright', 'calm', 'clear', 'cool', 'crisp', 'deft',
  'eager', 'fair', 'fast', 'firm', 'fond', 'glad', 'grand', 'keen',
  'kind', 'lean', 'live', 'neat', 'noble', 'prime', 'pure', 'quick',
  'rapid', 'sharp', 'sleek', 'smart', 'solid', 'stark', 'steady', 'still',
  'stoic', 'sure', 'swift', 'tidy', 'true', 'vast', 'vivid', 'warm',
  'wise', 'witty', 'zen', 'agile', 'lucid', 'quiet', 'ready', 'vital',
]

const nouns = [
  'arc', 'beam', 'bolt', 'cape', 'cove', 'dawn', 'dune', 'echo',
  'edge', 'ember', 'fern', 'flare', 'flux', 'forge', 'frost', 'gate',
  'glow', 'grove', 'haze', 'helm', 'iris', 'jade', 'lake', 'leaf',
  'lens', 'loom', 'mesa', 'mist', 'moon', 'nest', 'node', 'opal',
  'orbit', 'palm', 'path', 'peak', 'pine', 'pond', 'pulse', 'reef',
  'ridge', 'river', 'sage', 'shard', 'shore', 'spark', 'spire', 'star',
  'stone', 'surge', 'tide', 'vale', 'vault', 'vine', 'wave', 'wind',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Generate a random name like "bold-falcon" */
export function generateName(): string {
  return `${pick(adjectives)}-${pick(nouns)}`
}

/** Generate a unique name with a short suffix to avoid collisions */
export function generateUniqueName(): string {
  const suffix = Math.random().toString(36).slice(2, 5)
  return `${pick(adjectives)}-${pick(nouns)}-${suffix}`
}
