import type { IOContract, CompatibilityResult } from '@/lib/types'

/**
 * Normalize a single field value into a string array.
 * Accepts: string[] | comma-separated string | unknown.
 * Returns string[] or null if the value is not usable.
 */
function normalizeField(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    // Every element must be a string
    if (value.every((v): v is string => typeof v === 'string')) {
      return value.map((s) => s.trim()).filter((s) => s.length > 0)
    }
    return null
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }
  return null
}

/**
 * Parse IO contract from a frontmatter object.
 * Returns an IOContract if at least one of inputs/outputs is a valid array of strings.
 * Returns null if neither field is present or both are malformed.
 */
export function parseIOContract(
  frontmatter: Record<string, unknown> | undefined | null,
): IOContract | null {
  if (!frontmatter) return null

  const inputs = normalizeField(frontmatter.inputs)
  const outputs = normalizeField(frontmatter.outputs)

  // If neither field produced a valid array, there's no contract
  if (inputs === null && outputs === null) return null

  return {
    inputs: inputs ?? [],
    outputs: outputs ?? [],
  }
}

/**
 * Check compatibility between a source's outputs and a target's inputs.
 *
 * - Advisory mode (strict=false, default): always returns compatible=true,
 *   but includes mismatch descriptions as warnings.
 * - Strict mode (strict=true): returns compatible=false when any mismatch exists.
 * - When either contract is null (no IO contract declared), the check is skipped
 *   and the result is fully compatible with no mismatches.
 */
export function checkCompatibility(
  sourceOutputs: IOContract | null,
  targetInputs: IOContract | null,
  strict: boolean = false,
): CompatibilityResult {
  // Skip check when no IO contract declared on either side
  if (!sourceOutputs || !targetInputs) {
    return { compatible: true, mismatches: [] }
  }

  const mismatches: string[] = []

  for (const input of targetInputs.inputs) {
    if (!sourceOutputs.outputs.includes(input)) {
      mismatches.push(
        `Source outputs [${sourceOutputs.outputs.join(', ')}] but target expects [${input}]`,
      )
    }
  }

  if (mismatches.length === 0) {
    return { compatible: true, mismatches: [] }
  }

  // Advisory mode: allow operation, return warnings
  // Strict mode: reject on mismatch
  return {
    compatible: !strict,
    mismatches,
  }
}
