import { describe, it, expect } from 'vitest';
import { checkPlacement, checkAllPlacements, PlacementViolationError } from '../../packages/core/src/export/placement-guardrail.js';
import { HOST_TARGET_REGISTRY } from '../../packages/core/src/host-targets.js';

describe('checkPlacement', () => {
  it('L0 is always exempt, regardless of frontmatter', () => {
    const kiro = HOST_TARGET_REGISTRY.kiro;
    // Even frontmatter that would be eager on an L1-L4 file must not flag L0 —
    // L0 being always-on is the point, not a violation.
    expect(checkPlacement({ relativePath: 'AGENTS.md', layer: 'L0', frontmatter: {} }, kiro)).toBeNull();
    expect(checkPlacement({ relativePath: 'AGENTS.md', layer: 'L0', frontmatter: { inclusion: 'always' } }, kiro)).toBeNull();
  });

  it('kiro: an L2 node file with no inclusion frontmatter violates (absent = eager)', () => {
    const kiro = HOST_TARGET_REGISTRY.kiro;
    const violation = checkPlacement({ relativePath: 'wf/step/SKILL.md', layer: 'L2', frontmatter: { name: 'step' } }, kiro);
    expect(violation).toBeInstanceOf(PlacementViolationError);
    expect(violation?.message).toContain('wf/step/SKILL.md');
    expect(violation?.message).toContain('L2');
    expect(violation?.message).toContain('Kiro');
  });

  it('kiro: an L2 node file with inclusion: fileMatch is fine (on-demand)', () => {
    const kiro = HOST_TARGET_REGISTRY.kiro;
    const result = checkPlacement(
      { relativePath: 'wf/step/SKILL.md', layer: 'L2', frontmatter: { name: 'step', inclusion: 'fileMatch' } },
      kiro,
    );
    expect(result).toBeNull();
  });

  it('cursor: an L3 reference with alwaysApply:true violates', () => {
    const cursor = HOST_TARGET_REGISTRY.cursor;
    const violation = checkPlacement(
      { relativePath: 'instructions/style.md', layer: 'L3', frontmatter: { alwaysApply: true } },
      cursor,
    );
    expect(violation).toBeInstanceOf(PlacementViolationError);
    expect(violation?.message).toContain('Cursor');
  });

  it('cursor: an L3 reference with no alwaysApply key is fine (absence is on-demand for Cursor)', () => {
    const cursor = HOST_TARGET_REGISTRY.cursor;
    expect(checkPlacement({ relativePath: 'instructions/style.md', layer: 'L3', frontmatter: {} }, cursor)).toBeNull();
  });

  it('claude-code: no non-root file can violate via frontmatter (positional host)', () => {
    const claude = HOST_TARGET_REGISTRY['claude-code'];
    // isRootFile is always false for a non-L0 candidate — checkPlacement never
    // passes true, so a Claude Code violation can never come from L1-L4 content.
    expect(checkPlacement({ relativePath: '.claude/rules/x.md', layer: 'L3', frontmatter: { anything: 'goes' } }, claude)).toBeNull();
  });

  it('an empty file (e.g. an output/ scaffold) is exempt regardless of host or layer', () => {
    const kiro = HOST_TARGET_REGISTRY.kiro;
    // Would violate (absent inclusion = eager on Kiro) if not empty — isEmpty
    // must suppress that, since a scaffold with no content loads nothing.
    expect(
      checkPlacement({ relativePath: 'wf/step/output/.gitkeep', layer: 'L4', frontmatter: {}, isEmpty: true }, kiro),
    ).toBeNull();
  });
});

describe('checkAllPlacements', () => {
  it('reports every violation in one pass, not just the first', () => {
    const violations = checkAllPlacements(
      [
        { relativePath: 'AGENTS.md', layer: 'L0', frontmatter: {} },
        { relativePath: 'wf/step/SKILL.md', layer: 'L2', frontmatter: { name: 'step' } }, // violates
        { relativePath: 'instructions/a.md', layer: 'L3', frontmatter: { inclusion: 'manual' } }, // fine
        { relativePath: 'instructions/b.md', layer: 'L3', frontmatter: {} }, // violates
      ],
      'kiro',
    );
    expect(violations).toHaveLength(2);
    expect(violations.map(v => v.relativePath)).toEqual(['wf/step/SKILL.md', 'instructions/b.md']);
  });

  it('returns an empty array when nothing violates', () => {
    const violations = checkAllPlacements(
      [
        { relativePath: 'AGENTS.md', layer: 'L0', frontmatter: {} },
        { relativePath: 'instructions/a.md', layer: 'L3', frontmatter: { inclusion: 'manual' } },
      ],
      'kiro',
    );
    expect(violations).toEqual([]);
  });

  it('throws on an unregistered host id (a caller bug, not a placement violation)', () => {
    expect(() => checkAllPlacements([], 'windsurf')).toThrow(/unknown host target/i);
  });
});
