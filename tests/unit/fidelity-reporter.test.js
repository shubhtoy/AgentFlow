import { describe, it, expect } from 'vitest';
const { FidelityReporter, FIDELITY_ICONS } = require('../../packages/core/src/transport/fidelity-reporter.js');

const reporter = new FidelityReporter();

const mixedEntries = [
  { source: 'a', target: 'b', fidelity: 'native' },
  { source: 'c', target: 'd', fidelity: 'native' },
  { source: 'e', target: 'f', fidelity: 'on-demand' },
  { source: 'g', target: 'h', fidelity: 'translated' },
  { source: 'i', target: 'j', fidelity: 'translated' },
  { source: 'k', target: 'l', fidelity: 'translated' },
  { source: 'm', target: 'n', fidelity: 'preserved' },
];

const report = reporter.build('kiro', 'export', mixedEntries);

describe('FidelityReporter', () => {
  it('summary counts match entries per fidelity type', () => {
    expect(report.summary.native).toBe(2);
    expect(report.summary.onDemand).toBe(1);
    expect(report.summary.translated).toBe(3);
    expect(report.summary.preserved).toBe(1);
  });

  it('sum invariant: counts equal entries.length', () => {
    const { native, onDemand, translated, preserved } = report.summary;
    expect(native + onDemand + translated + preserved).toBe(report.entries.length);
  });

  it('zero skip entries', () => {
    for (const e of report.entries) {
      expect(e.fidelity).not.toBe('skip');
    }
  });

  it('markdown is non-empty and contains platform + direction', () => {
    expect(report.markdown.length).toBeGreaterThan(0);
    expect(report.markdown).toContain('kiro');
    expect(report.markdown).toContain('export');
  });

  it('markdown contains all fidelity icons', () => {
    for (const icon of Object.values(FIDELITY_ICONS)) {
      expect(report.markdown).toContain(icon);
    }
  });

  it('empty entries produces all-zero summary and valid markdown', () => {
    const empty = reporter.build('test', 'import', []);
    expect(empty.summary).toEqual({ native: 0, onDemand: 0, translated: 0, preserved: 0 });
    expect(empty.markdown.length).toBeGreaterThan(0);
  });

  it('report has all required fields', () => {
    for (const key of ['platform', 'direction', 'entries', 'summary', 'markdown']) {
      expect(report).toHaveProperty(key);
    }
  });
});
