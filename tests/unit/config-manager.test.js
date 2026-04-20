const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const {
  loadOrCreate,
  save,
  getDefaults,
  validate,
  validateRepoUniqueness,
  validateGlobPatterns,
  hasPathTraversal,
  VALID_CONFLICT_STRATEGIES,
  VALID_SYNC_DIRECTIONS,
  VALID_REPO_TYPES,
  VALID_ROLES,
} = require('../../src/git/config-manager');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentflow-cfg-'));
}

function removeTmpDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function tmpConfigPath(dir, filename = '.gitconfig.yaml') {
  return path.join(dir, filename);
}

/* ------------------------------------------------------------------ */
/*  getDefaults                                                        */
/* ------------------------------------------------------------------ */

describe('getDefaults', () => {
  it('returns the expected default structure', () => {
    const d = getDefaults();

    expect(d.version).toBe('1.0.0');
    expect(d.repos).toEqual([]);
    expect(d.syncRules.include).toEqual(['**/*.md', '**/*.yaml']);
    expect(d.syncRules.exclude).toEqual(['**/output/**', '**/node_modules/**']);
    expect(d.syncRules.resourceTypes).toEqual([]);
    expect(d.syncRules.syncDirection).toBe('bidirectional');
    expect(d.conflictStrategy).toBe('manual');
    expect(d.autoScan).toBe(true);
    expect(d.scanDepth).toBe(5);
  });

  it('returns a fresh object each call (no shared references)', () => {
    const a = getDefaults();
    const b = getDefaults();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.repos).not.toBe(b.repos);
    expect(a.syncRules).not.toBe(b.syncRules);
  });
});


/* ------------------------------------------------------------------ */
/*  Property 4: Config round-trip fidelity                             */
/* ------------------------------------------------------------------ */

describe('load/save round-trip fidelity (Property 4)', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTmpDir(); });
  afterEach(() => { removeTmpDir(tmpDir); });

  it('round-trips a default config without loss', () => {
    const original = getDefaults();
    const cfgPath = tmpConfigPath(tmpDir);

    save(original, cfgPath);
    const loaded = loadOrCreate(cfgPath);

    expect(loaded).toEqual(original);
  });

  it('round-trips a config with repo mappings', () => {
    const original = getDefaults();
    original.repos = [
      {
        name: 'team-shared',
        url: 'https://github.com/team/workflows.git',
        branch: 'main',
        localPath: '/tmp/workflows',
        repoType: 'private',
        role: 'agentic',
        agentflowPath: '.agentflow',
      },
    ];
    original.conflictStrategy = 'local_wins';
    original.autoScan = false;
    original.scanDepth = 3;

    const cfgPath = tmpConfigPath(tmpDir);
    save(original, cfgPath);
    const loaded = loadOrCreate(cfgPath);

    expect(loaded).toEqual(original);
  });

  it('round-trips custom sync rules', () => {
    const original = getDefaults();
    original.syncRules = {
      include: ['**/*.md'],
      exclude: ['**/draft/**'],
      resourceTypes: ['tool', 'skill'],
      syncDirection: 'pull_only',
    };

    const cfgPath = tmpConfigPath(tmpDir);
    save(original, cfgPath);
    const loaded = loadOrCreate(cfgPath);

    expect(loaded).toEqual(original);
  });

  it('round-trips multiple repo mappings', () => {
    const original = getDefaults();
    original.repos = [
      { name: 'alpha', url: 'https://a.git', branch: 'main', localPath: '/a', repoType: 'public', role: 'primary', agentflowPath: '.agentflow' },
      { name: 'beta', url: 'https://b.git', branch: 'dev', localPath: '/b', repoType: 'custom', role: 'shared', agentflowPath: 'custom/.agentflow' },
    ];

    const cfgPath = tmpConfigPath(tmpDir);
    save(original, cfgPath);
    const loaded = loadOrCreate(cfgPath);

    expect(loaded).toEqual(original);
  });
});


/* ------------------------------------------------------------------ */
/*  Property 5: Repo mapping uniqueness                                */
/* ------------------------------------------------------------------ */

describe('duplicate repo name rejection (Property 5)', () => {
  it('throws when two repos share the same name', () => {
    const repos = [
      { name: 'shared', url: 'https://a.git' },
      { name: 'shared', url: 'https://b.git' },
    ];

    expect(() => validateRepoUniqueness(repos)).toThrow(/Duplicate repo mapping name "shared"/);
  });

  it('allows repos with distinct names', () => {
    const repos = [
      { name: 'alpha', url: 'https://a.git' },
      { name: 'beta', url: 'https://b.git' },
    ];

    expect(() => validateRepoUniqueness(repos)).not.toThrow();
  });

  it('save rejects config with duplicate repo names', () => {
    const config = getDefaults();
    config.repos = [
      { name: 'dup', url: 'https://a.git' },
      { name: 'dup', url: 'https://b.git' },
    ];

    expect(() => save(config, '/tmp/never-written.yaml')).toThrow(/Duplicate repo mapping name/);
  });

  it('validate rejects config with duplicate repo names', () => {
    const config = getDefaults();
    config.repos = [
      { name: 'x', url: 'https://a.git' },
      { name: 'y', url: 'https://b.git' },
      { name: 'x', url: 'https://c.git' },
    ];

    expect(() => validate(config)).toThrow(/Duplicate repo mapping name "x"/);
  });

  it('handles empty and null repos arrays without error', () => {
    expect(() => validateRepoUniqueness([])).not.toThrow();
    expect(() => validateRepoUniqueness(null)).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  Path traversal rejection in glob patterns                          */
/* ------------------------------------------------------------------ */

describe('path traversal rejection in glob patterns', () => {
  it('detects ../ in a pattern', () => {
    expect(hasPathTraversal('../secret')).toBe(true);
    expect(hasPathTraversal('foo/../../bar')).toBe(true);
  });

  it('allows safe patterns', () => {
    expect(hasPathTraversal('**/*.md')).toBe(false);
    expect(hasPathTraversal('tools/**')).toBe(false);
  });

  it('validateGlobPatterns throws on include with traversal', () => {
    const rules = { include: ['../outside/**'], exclude: [] };
    expect(() => validateGlobPatterns(rules)).toThrow(/path traversal/);
  });

  it('validateGlobPatterns throws on exclude with traversal', () => {
    const rules = { include: ['**/*.md'], exclude: ['../../etc/passwd'] };
    expect(() => validateGlobPatterns(rules)).toThrow(/path traversal/);
  });

  it('validateGlobPatterns passes for safe patterns', () => {
    const rules = { include: ['**/*.md', '**/*.yaml'], exclude: ['**/output/**'] };
    expect(() => validateGlobPatterns(rules)).not.toThrow();
  });

  it('save rejects config with traversal in sync rules', () => {
    const config = getDefaults();
    config.syncRules.include.push('../../../etc/shadow');

    expect(() => save(config, '/tmp/never-written.yaml')).toThrow(/path traversal/);
  });
});


/* ------------------------------------------------------------------ */
/*  Malformed YAML handling (Error Scenario 5)                         */
/* ------------------------------------------------------------------ */

describe('malformed YAML handling (graceful fallback)', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTmpDir(); });
  afterEach(() => { removeTmpDir(tmpDir); });

  it('returns defaults when config file does not exist', () => {
    const cfgPath = tmpConfigPath(tmpDir, 'nonexistent.yaml');
    const config = loadOrCreate(cfgPath);

    expect(config).toEqual(getDefaults());
  });

  it('returns defaults when config file is empty', () => {
    const cfgPath = tmpConfigPath(tmpDir);
    fs.writeFileSync(cfgPath, '', 'utf-8');

    const config = loadOrCreate(cfgPath);
    expect(config).toEqual(getDefaults());
  });

  it('returns defaults when config file contains only null', () => {
    const cfgPath = tmpConfigPath(tmpDir);
    fs.writeFileSync(cfgPath, 'null\n', 'utf-8');

    const config = loadOrCreate(cfgPath);
    expect(config).toEqual(getDefaults());
  });

  it('throws on truly malformed YAML (bad syntax)', () => {
    const cfgPath = tmpConfigPath(tmpDir);
    fs.writeFileSync(cfgPath, ':\n  :\n    - [invalid', 'utf-8');

    expect(() => loadOrCreate(cfgPath)).toThrow(/Failed to parse config/);
  });

  it('fills in missing fields from defaults', () => {
    const cfgPath = tmpConfigPath(tmpDir);
    // Partial config — only version and conflictStrategy
    fs.writeFileSync(cfgPath, yaml.dump({ version: '1.0.0', conflictStrategy: 'local_wins' }), 'utf-8');

    const config = loadOrCreate(cfgPath);

    expect(config.version).toBe('1.0.0');
    expect(config.conflictStrategy).toBe('local_wins');
    // Defaults filled in
    expect(config.repos).toEqual([]);
    expect(config.syncRules.include).toEqual(['**/*.md', '**/*.yaml']);
    expect(config.autoScan).toBe(true);
    expect(config.scanDepth).toBe(5);
  });

  it('throws on invalid conflictStrategy in file', () => {
    const cfgPath = tmpConfigPath(tmpDir);
    fs.writeFileSync(cfgPath, yaml.dump({ conflictStrategy: 'yolo' }), 'utf-8');

    expect(() => loadOrCreate(cfgPath)).toThrow(/Invalid conflictStrategy/);
  });

  it('throws on invalid syncDirection in file', () => {
    const cfgPath = tmpConfigPath(tmpDir);
    fs.writeFileSync(cfgPath, yaml.dump({ syncRules: { syncDirection: 'sideways' } }), 'utf-8');

    expect(() => loadOrCreate(cfgPath)).toThrow(/Invalid syncDirection/);
  });
});

/* ------------------------------------------------------------------ */
/*  validate — additional coverage                                     */
/* ------------------------------------------------------------------ */

describe('validate', () => {
  it('throws on null config', () => {
    expect(() => validate(null)).toThrow(/non-null object/);
  });

  it('throws on non-object config', () => {
    expect(() => validate('string')).toThrow(/non-null object/);
  });

  it('throws on invalid repoType in a repo mapping', () => {
    const config = getDefaults();
    config.repos = [{ name: 'r', repoType: 'alien' }];
    expect(() => validate(config)).toThrow(/Invalid repoType "alien"/);
  });

  it('throws on invalid role in a repo mapping', () => {
    const config = getDefaults();
    config.repos = [{ name: 'r', role: 'boss' }];
    expect(() => validate(config)).toThrow(/Invalid role "boss"/);
  });

  it('accepts a fully valid config', () => {
    const config = getDefaults();
    config.repos = [
      { name: 'ok', url: 'https://x.git', repoType: 'public', role: 'primary' },
    ];
    expect(() => validate(config)).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  save — filesystem behavior                                         */
/* ------------------------------------------------------------------ */

describe('save', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTmpDir(); });
  afterEach(() => { removeTmpDir(tmpDir); });

  it('creates parent directories if they do not exist', () => {
    const cfgPath = path.join(tmpDir, 'nested', 'deep', '.gitconfig.yaml');
    const config = getDefaults();

    save(config, cfgPath);

    expect(fs.existsSync(cfgPath)).toBe(true);
    const loaded = loadOrCreate(cfgPath);
    expect(loaded).toEqual(config);
  });

  it('writes valid YAML that js-yaml can parse', () => {
    const cfgPath = tmpConfigPath(tmpDir);
    save(getDefaults(), cfgPath);

    const raw = fs.readFileSync(cfgPath, 'utf-8');
    const parsed = yaml.load(raw);

    expect(parsed).toBeDefined();
    expect(parsed.version).toBe('1.0.0');
  });
});
