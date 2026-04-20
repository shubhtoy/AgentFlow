'use strict';

function normalizeField(value) {
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === 'string')) return value.map((s) => s.trim()).filter((s) => s.length > 0);
    return null;
  }
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  return null;
}

function parseIOContract(frontmatter) {
  if (!frontmatter) return null;
  const inputs = normalizeField(frontmatter.inputs);
  const outputs = normalizeField(frontmatter.outputs);
  if (inputs === null && outputs === null) return null;
  return { inputs: inputs ?? [], outputs: outputs ?? [] };
}

function checkCompatibility(sourceOutputs, targetInputs, strict = false) {
  if (!sourceOutputs || !targetInputs) return { compatible: true, mismatches: [] };
  const mismatches = [];
  for (const input of targetInputs.inputs) {
    if (!sourceOutputs.outputs.includes(input)) {
      mismatches.push(`Source outputs [${sourceOutputs.outputs.join(', ')}] but target expects [${input}]`);
    }
  }
  if (mismatches.length === 0) return { compatible: true, mismatches: [] };
  return { compatible: !strict, mismatches };
}

module.exports = { parseIOContract, checkCompatibility };
