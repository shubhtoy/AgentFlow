import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

const { resolveRoot } = require('../../packages/cli/src/utils/resolve-root.js');

describe('resolveRoot', () => {
  let savedEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    delete process.env.AGENTFLOW_ROOT;
    delete process.env._AGENTFLOW_CLI_ROOT;
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('AGENTFLOW_ROOT env var takes priority', () => {
    process.env.AGENTFLOW_ROOT = '/tmp/custom-root';
    expect(resolveRoot()).toBe(path.resolve('/tmp/custom-root'));
  });

  it('_AGENTFLOW_CLI_ROOT as fallback', () => {
    process.env._AGENTFLOW_CLI_ROOT = '/tmp/cli-root';
    expect(resolveRoot()).toBe(path.resolve('/tmp/cli-root'));
  });

  it('AGENTFLOW_ROOT wins over _AGENTFLOW_CLI_ROOT', () => {
    process.env.AGENTFLOW_ROOT = '/tmp/primary';
    process.env._AGENTFLOW_CLI_ROOT = '/tmp/secondary';
    expect(resolveRoot()).toBe(path.resolve('/tmp/primary'));
  });

  it('walk-up search finds .agentflow/ in ancestor', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-root-'));
    const agentflowDir = path.join(tmp, '.agentflow');
    const nested = path.join(tmp, 'a', 'b', 'c');
    fs.mkdirSync(agentflowDir);
    fs.mkdirSync(nested, { recursive: true });
    try {
      expect(resolveRoot(nested)).toBe(agentflowDir);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('defaults to cwd/.agentflow/ when nothing found', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-root-empty-'));
    // No .agentflow/ anywhere in tmp — walk-up will hit root and fall through
    try {
      expect(resolveRoot(tmp)).toBe(path.join(process.cwd(), '.agentflow'));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
