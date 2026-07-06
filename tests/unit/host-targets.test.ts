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

describe('alwaysOnChannel.isAlwaysOn — the #13 guardrail predicate', () => {
  it('kiro: inclusion:always is flagged, anything else is not', () => {
    const { isAlwaysOn } = HOST_TARGET_REGISTRY.kiro.alwaysOnChannel;
    expect(isAlwaysOn({ inclusion: 'always' })).toBe(true);
    expect(isAlwaysOn({ inclusion: 'manual' })).toBe(false);
    expect(isAlwaysOn({})).toBe(false);
  });

  it('cursor: alwaysApply:true is flagged, false/absent is not', () => {
    const { isAlwaysOn } = HOST_TARGET_REGISTRY.cursor.alwaysOnChannel;
    expect(isAlwaysOn({ alwaysApply: true })).toBe(true);
    expect(isAlwaysOn({ alwaysApply: false })).toBe(false);
    expect(isAlwaysOn({})).toBe(false);
  });

  it('claude-code: on-demand files never register as always-on', () => {
    const { isAlwaysOn } = HOST_TARGET_REGISTRY['claude-code'].alwaysOnChannel;
    expect(isAlwaysOn({})).toBe(false);
    expect(isAlwaysOn({ anything: 'goes' })).toBe(false);
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
