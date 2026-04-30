import { describe, it, expect } from 'vitest'
import { parseIOContract, checkCompatibility } from '../../packages/core/src/utils/compatibility.js'

describe('parseIOContract', () => {
  it('returns null for null/undefined frontmatter', () => {
    expect(parseIOContract(null)).toBeNull()
    expect(parseIOContract(undefined)).toBeNull()
  })

  it('returns null when no inputs or outputs fields', () => {
    expect(parseIOContract({})).toBeNull()
    expect(parseIOContract({ name: 'test' })).toBeNull()
  })

  it('parses string arrays for inputs and outputs', () => {
    const result = parseIOContract({ inputs: ['raw_data', 'config'], outputs: ['result'] })
    expect(result).toEqual({ inputs: ['raw_data', 'config'], outputs: ['result'] })
  })

  it('parses comma-separated strings', () => {
    const result = parseIOContract({ inputs: 'raw_data, config', outputs: 'result, metadata' })
    expect(result).toEqual({ inputs: ['raw_data', 'config'], outputs: ['result', 'metadata'] })
  })

  it('trims whitespace from array entries', () => {
    const result = parseIOContract({ inputs: ['  raw_data  ', ' config '], outputs: ['result'] })
    expect(result).toEqual({ inputs: ['raw_data', 'config'], outputs: ['result'] })
  })

  it('filters out empty strings', () => {
    const result = parseIOContract({ inputs: ['raw_data', '', '  '], outputs: 'a,,b' })
    expect(result).toEqual({ inputs: ['raw_data'], outputs: ['a', 'b'] })
  })

  it('returns contract with empty inputs when only outputs declared', () => {
    const result = parseIOContract({ outputs: ['result'] })
    expect(result).toEqual({ inputs: [], outputs: ['result'] })
  })

  it('returns contract with empty outputs when only inputs declared', () => {
    const result = parseIOContract({ inputs: ['raw_data'] })
    expect(result).toEqual({ inputs: ['raw_data'], outputs: [] })
  })

  it('returns null for non-string array values (e.g. numbers)', () => {
    expect(parseIOContract({ inputs: [1, 2], outputs: [3] })).toBeNull()
  })

  it('returns null for non-string/non-array values', () => {
    expect(parseIOContract({ inputs: 42, outputs: true })).toBeNull()
  })

  it('handles mixed valid/invalid — one valid field is enough', () => {
    const result = parseIOContract({ inputs: ['valid'], outputs: 123 })
    expect(result).toEqual({ inputs: ['valid'], outputs: [] })
  })
})

describe('checkCompatibility', () => {
  it('returns compatible with no mismatches when source is null', () => {
    const result = checkCompatibility(null, { inputs: ['x'], outputs: [] })
    expect(result).toEqual({ compatible: true, mismatches: [] })
  })

  it('returns compatible with no mismatches when target is null', () => {
    const result = checkCompatibility({ inputs: [], outputs: ['x'] }, null)
    expect(result).toEqual({ compatible: true, mismatches: [] })
  })

  it('returns compatible with no mismatches when both are null', () => {
    const result = checkCompatibility(null, null)
    expect(result).toEqual({ compatible: true, mismatches: [] })
  })

  it('returns compatible when all target inputs are in source outputs', () => {
    const source = { inputs: [], outputs: ['result', 'metadata'] }
    const target = { inputs: ['result', 'metadata'], outputs: [] }
    const result = checkCompatibility(source, target)
    expect(result).toEqual({ compatible: true, mismatches: [] })
  })

  it('returns compatible when target has no inputs', () => {
    const source = { inputs: [], outputs: ['result'] }
    const target = { inputs: [], outputs: [] }
    const result = checkCompatibility(source, target)
    expect(result).toEqual({ compatible: true, mismatches: [] })
  })

  it('advisory mode: returns compatible=true with mismatches as warnings', () => {
    const source = { inputs: [], outputs: ['result'] }
    const target = { inputs: ['raw_data'], outputs: [] }
    const result = checkCompatibility(source, target, false)
    expect(result.compatible).toBe(true)
    expect(result.mismatches).toHaveLength(1)
    expect(result.mismatches[0]).toContain('raw_data')
  })

  it('strict mode: returns compatible=false on mismatch', () => {
    const source = { inputs: [], outputs: ['result'] }
    const target = { inputs: ['raw_data'], outputs: [] }
    const result = checkCompatibility(source, target, true)
    expect(result.compatible).toBe(false)
    expect(result.mismatches).toHaveLength(1)
    expect(result.mismatches[0]).toContain('raw_data')
  })

  it('defaults to advisory mode when strict is not provided', () => {
    const source = { inputs: [], outputs: ['a'] }
    const target = { inputs: ['b'], outputs: [] }
    const result = checkCompatibility(source, target)
    expect(result.compatible).toBe(true)
    expect(result.mismatches.length).toBeGreaterThan(0)
  })

  it('generates mismatch descriptions with specific field names', () => {
    const source = { inputs: [], outputs: ['result'] }
    const target = { inputs: ['raw_data', 'config'], outputs: [] }
    const result = checkCompatibility(source, target, true)
    expect(result.mismatches).toHaveLength(2)
    expect(result.mismatches[0]).toContain('raw_data')
    expect(result.mismatches[0]).toContain('result')
    expect(result.mismatches[1]).toContain('config')
  })

  it('reports only missing inputs, not extra outputs', () => {
    const source = { inputs: [], outputs: ['result', 'extra'] }
    const target = { inputs: ['result'], outputs: [] }
    const result = checkCompatibility(source, target)
    expect(result.mismatches).toHaveLength(0)
    expect(result.compatible).toBe(true)
  })
})
