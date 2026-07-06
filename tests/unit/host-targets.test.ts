import { describe, it, expect } from 'vitest';
import {
  HOST_TARGET_REGISTRY, SUPPORTED_HOST_IDS, getHostTarget,
} from '../../packages/core/src/host-targets.js';

describe('host target registry', () => {
  it('SUPPORTED_HOST_IDS lists exactly the 3 verified hosts', () => {
    expect(SUPPORTED_HOST_IDS.sort()).toEqual(['claude-code', 'cursor', 'kiro']);
  });

  it('every entry has a non-empty L0 path and MCP config path', () => {
    for (const id of SUPPORTED_HOST_IDS) {
      const target = HOST_TARGET_REGISTRY[id];
      expect(target.l0.path.length).toBeGreaterThan(0);
      expect(target.mcpConfig.path.length).toBeGreaterThan(0);
      expect(target.id).toBe(id);
    }
  });

  it('kiro L0 is root AGENTS.md, MCP config is .kiro/settings/mcp.json', () => {
    const kiro = HOST_TARGET_REGISTRY.kiro;
    expect(kiro.l0.path).toBe('AGENTS.md');
    expect(kiro.mcpConfig.path).toBe('.kiro/settings/mcp.json');
  });

  it('cursor L0 is a rules file, MCP config is .cursor/mcp.json', () => {
    const cursor = HOST_TARGET_REGISTRY.cursor;
    expect(cursor.l0.path).toBe('.cursor/rules/00-index.mdc');
    expect(cursor.mcpConfig.path).toBe('.cursor/mcp.json');
  });

  it('claude-code L0 is root CLAUDE.md, MCP config is .mcp.json', () => {
    const claude = HOST_TARGET_REGISTRY['claude-code'];
    expect(claude.l0.path).toBe('CLAUDE.md');
    expect(claude.mcpConfig.path).toBe('.mcp.json');
  });
});

describe('alwaysOnChannel.isAlwaysOn — ported from rulesync (#59)', () => {
  it('kiro: ABSENT inclusion frontmatter is eager (the real Kiro default, not a boolean flag)', () => {
    const { isAlwaysOn } = HOST_TARGET_REGISTRY.kiro.alwaysOnChannel;
    expect(isAlwaysOn({})).toBe(true); // no frontmatter at all -> Kiro treats as always-on
    expect(isAlwaysOn({ inclusion: 'always' })).toBe(true); // explicit, equally eager
  });

  it('kiro: fileMatch / manual are on-demand', () => {
    const { isAlwaysOn } = HOST_TARGET_REGISTRY.kiro.alwaysOnChannel;
    expect(isAlwaysOn({ inclusion: 'fileMatch', fileMatchPattern: '**/*.ts' })).toBe(false);
    expect(isAlwaysOn({ inclusion: 'manual' })).toBe(false);
  });

  it('cursor: alwaysApply:true is flagged; absent/false is not (explicit boolean, no absence trap)', () => {
    const { isAlwaysOn } = HOST_TARGET_REGISTRY.cursor.alwaysOnChannel;
    expect(isAlwaysOn({ alwaysApply: true })).toBe(true);
    expect(isAlwaysOn({ alwaysApply: false })).toBe(false);
    expect(isAlwaysOn({})).toBe(false); // absent means on-demand for Cursor (unlike Kiro)
  });

  it('claude-code: eagerness is positional (isRootFile), not a frontmatter key', () => {
    const { isAlwaysOn } = HOST_TARGET_REGISTRY['claude-code'].alwaysOnChannel;
    expect(isAlwaysOn({}, true)).toBe(true); // the root CLAUDE.md file itself
    expect(isAlwaysOn({}, false)).toBe(false); // a .claude/rules/*.md modular file
    expect(isAlwaysOn({ anything: 'goes' }, false)).toBe(false); // no frontmatter key overrides position
    expect(isAlwaysOn({})).toBe(false); // isRootFile defaults to false when omitted
  });
});

describe('getHostTarget', () => {
  it('returns the entry for a known host id', () => {
    expect(getHostTarget('kiro')?.label).toBe('Kiro');
    expect(getHostTarget('cursor')?.label).toBe('Cursor');
    expect(getHostTarget('claude-code')?.label).toBe('Claude Code');
  });

  it('returns null for an unsupported host id', () => {
    expect(getHostTarget('windsurf')).toBeNull();
    expect(getHostTarget('kiro-ide')).toBeNull();
    expect(getHostTarget('')).toBeNull();
  });
});
