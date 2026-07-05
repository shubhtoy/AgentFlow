/**
 * I/O contract compatibility checking.
 */

export interface IOContract {
  inputs: string[]
  outputs: string[]
}

export interface CompatibilityResult {
  compatible: boolean
  mismatches: string[]
}

function normalizeField(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    if (value.every(v => typeof v === 'string')) {
      return (value as string[]).map(s => s.trim()).filter(s => s.length > 0)
    }
    return null
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
  }
  return null
}

export function parseIOContract(frontmatter: Record<string, unknown> | null): IOContract | null {
  if (!frontmatter) return null
  const inputs = normalizeField(frontmatter.inputs)
  const outputs = normalizeField(frontmatter.outputs)
  if (inputs === null && outputs === null) return null
  return { inputs: inputs ?? [], outputs: outputs ?? [] }
}

export function checkCompatibility(
  sourceOutputs: IOContract | null,
  targetInputs: IOContract | null,
  strict = false,
): CompatibilityResult {
  if (!sourceOutputs || !targetInputs) return { compatible: true, mismatches: [] }
  const mismatches: string[] = []
  for (const input of targetInputs.inputs) {
    if (!sourceOutputs.outputs.includes(input)) {
      mismatches.push(`Source outputs [${sourceOutputs.outputs.join(', ')}] but target expects [${input}]`)
    }
  }
  if (mismatches.length === 0) return { compatible: true, mismatches: [] }
  return { compatible: !strict, mismatches }
}
