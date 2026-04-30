/**
 * Variable token validation.
 */

const VALID_VAR_REGEX = /\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g
const ALL_VAR_REGEX = /\$\{env:([^}]*)\}/g

export function validateVariables(content: string): { message: string; token: string }[] {
  if (!content || typeof content !== 'string') return []
  const errors: { message: string; token: string }[] = []
  const validPositions = new Set<number>()

  VALID_VAR_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = VALID_VAR_REGEX.exec(content)) !== null) {
    validPositions.add(match.index)
  }

  ALL_VAR_REGEX.lastIndex = 0
  while ((match = ALL_VAR_REGEX.exec(content)) !== null) {
    if (!validPositions.has(match.index)) {
      errors.push({ message: `Malformed variable token: ${match[0]}`, token: match[0] })
    }
  }
  return errors
}
