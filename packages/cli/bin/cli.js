#!/usr/bin/env node
require('tsx/cjs');
const { program } = require('commander');
const path = require('path');
const fs = require('fs');

// Lazy loaders — modules are required on first use, not at startup.
// This lets `agentflow --help` work even if some modules aren't built yet.
const srcDir = path.join(__dirname, '..', 'src');
const lazy = (id) => { let m; return new Proxy({}, { get(_, k) { m ??= typeof id === 'function' ? id() : require(id); return m[k]; } }); };
const lazyMod = (id) => { let m; return () => (m ??= require(id)); };

const core = {
  get validate() { return require('@agentflow/core/validator').validate; },
  get taxonomy() { return require('@agentflow/core/taxonomy'); },
  get parserCore() { return require('@agentflow/core/parser-core'); },
  get registryClient() { return require('@agentflow/core/mcp/registry-client'); },
};

const cli = {
  get resolveRoot() { return require(path.join(srcDir, 'utils', 'resolve-root')).resolveRoot; },
  get parseRoot() { return require(path.join(srcDir, 'parser')).parseRoot; },
  get library() { return require(path.join(srcDir, 'library')); },
  get serializeGraph() { return require(path.join(srcDir, 'pretty-printer')).serializeGraph; },
  get gitManager() { return require(path.join(srcDir, 'git', 'git-manager')); },
  get repoScanner() { return require(path.join(srcDir, 'git', 'repo-scanner')); },
  get syncEngine() { return require(path.join(srcDir, 'git', 'sync-engine')); },
  get configManager() { return require(path.join(srcDir, 'git', 'config-manager')); },
  get mcpConfig() { return require(path.join(srcDir, 'mcp', 'config-manager')); },
  get discoverTools() { return require(path.join(srcDir, 'mcp', 'server-lifecycle')).discoverTools; },
  get scaffoldTools() { return require(path.join(srcDir, 'mcp', 'tool-scaffolder')).scaffoldTools; },
  get unifiedSearch() { return require(path.join(srcDir, 'mcp', 'unified-search')).unifiedSearch; },
  get branding() { return require(path.join(srcDir, 'branding')); },
  get structuredExporter() { return require(path.join(srcDir, 'structured-exporter')); },
};

const brandConfig = cli.branding.loadBrandConfig();

program.name(brandConfig.cli).description('Parse and visualize agent workflows').version('0.1.0');

/* ------------------------------------------------------------------ */
/*  parse [dir]                                                        */
/* ------------------------------------------------------------------ */

program
  .command('parse')
  .description('Parse and output JSON')
  .argument('[dir]', 'workspace directory', brandConfig.dir)
  .option('-o, --output <file>', 'output file')
  .option('--metadata-only', 'parse metadata only (frontmatter + title)')
  .action((dir, opts) => {
    const rootDir = path.resolve(dir);
    const mode = opts.metadataOnly ? 'metadata-only' : 'full';
    const graph = cli.parseRoot(rootDir, mode);
    const json = JSON.stringify(graph, null, 2);
    if (opts.output) {
      fs.writeFileSync(opts.output, json);
      console.log(`Written to ${opts.output}`);
    } else {
      console.log(json);
    }
  });

/* ------------------------------------------------------------------ */
/*  validate [dir]                                                     */
/* ------------------------------------------------------------------ */

program
  .command('validate')
  .description('Validate workflow references and schemas')
  .argument('[dir]', 'workspace directory', brandConfig.dir)
  .option('--strict', 'treat warnings as errors')
  .action((dir, opts) => {
    const rootDir = path.resolve(dir);
    const graph = cli.parseRoot(rootDir);
    const result = core.validate(graph, { strict: !!opts.strict });
    const errors = result.errors || [];
    const warnings = result.warnings || [];

    if (warnings.length) {
      warnings.forEach((w) => console.log(`⚠ ${w.message || w}`));
    }
    if (errors.length) {
      errors.forEach((e) => console.log(`✗ ${e.message || e}`));
      console.log(`\n${errors.length} error(s) found`);
      process.exit(1);
    }
    if (!errors.length && !warnings.length) {
      console.log('✓ All references valid');
    } else if (!errors.length) {
      console.log(`\n✓ No errors (${warnings.length} warning(s))`);
    }
    process.exit(0);
  });

/* ------------------------------------------------------------------ */
/*  export [dir]                                                       */
/* ------------------------------------------------------------------ */

program
  .command('export')
  .description(`Export workspace in multiple formats`)
  .argument('[dir]', 'workspace directory', brandConfig.dir)
  .option('-o, --output <path>', 'output path (file or directory)')
  .option('-w, --workflow <name>', 'workflow to export (omit for full workspace)')
  .option('-f, --format <format>', 'export format: json, zip, dir, share, raw, parsed')
  .option('--platform <name>', 'target platform (kiro, cursor, claude-code, vscode-copilot, windsurf, agent-spec)')
  .action(async (dir, opts) => {
    const rootDir = path.resolve(dir);

    // Platform-specific export via export engine
    if (opts.platform) {
      try {
        const { exportForPlatform, toAgentSpec } = require(path.join(srcDir, 'export'));
        const graph = cli.parseRoot(rootDir);
        let files;
        if (opts.platform === 'agent-spec') {
          const spec = toAgentSpec(graph);
          files = { 'agent-spec.json': JSON.stringify(spec, null, 2) };
        } else {
          files = exportForPlatform(graph, opts.platform);
        }
        if (!Object.keys(files).length) { console.error(`\u2717 Export produced no files for platform "${opts.platform}".`); process.exit(1); }
        const outDir = opts.output || path.join('export', opts.platform);
        for (const [filePath, content] of Object.entries(files)) {
          const fullPath = path.join(outDir, filePath);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, content);
        }
        console.log(`\u2713 Exported to ${opts.platform} format in ${outDir}/ (${Object.keys(files).length} files)`);
      } catch (err) { console.error(`\u2717 ${err.message}`); process.exit(1); }
      return;
    }

    // Default export (no --platform, no --format) — list available platforms
    if (!opts.format) {
      try {
        const { listPlatforms } = require(path.join(srcDir, 'export'));
        const platforms = listPlatforms();
        if (!platforms.length) { console.error('\u2717 No platform configs found.'); process.exit(1); }
        console.log('Available platforms:\n' + platforms.map(p => `  ${p}`).join('\n'));
        console.log('\nUsage: export [dir] --platform <name>');
      } catch (err) { console.error(`\u2717 ${err.message}`); process.exit(1); }
      return;
    }

    // Legacy formats: raw/parsed (single workflow export via structured-exporter)
    if (opts.format === 'raw' || opts.format === 'parsed') {
      const graph = cli.parseRoot(rootDir);
      const workflowIds = Object.keys(graph.workflows || {});
      let workflowId = opts.workflow;
      if (!workflowId) {
        if (workflowIds.length === 1) workflowId = workflowIds[0];
        else if (workflowIds.length === 0) { console.error('No workflows found.'); process.exit(1); }
        else { console.error(`Multiple workflows found. Use --workflow <name>: ${workflowIds.join(', ')}`); process.exit(1); }
      }
      const files = opts.format === 'parsed' ? cli.structuredExporter.exportParsed(graph, workflowId) : cli.structuredExporter.exportRaw(graph, workflowId);
      const wfName = (graph.workflows[workflowId] || {}).name || workflowId;
      const suffix = opts.format === 'parsed' ? '-parsed' : '';
      const outDir = opts.output || path.join('export', `${wfName}${suffix}`);
      for (const [filePath, content] of Object.entries(files)) {
        const fullPath = path.join(outDir, filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content);
      }
      console.log(`Exported ${opts.format} to ${outDir}/ (${Object.keys(files).length} files)`);
      return;
    }

    // New multi-format export via ExportService
    try {
      const { createExportService } = require(path.join(srcDir, 'services', 'export-service'));
      const svc = createExportService({ rootDir, logger: { error: () => {} } });
      const result = await svc.exportWorkspace({
        format: opts.format,
        workflowId: opts.workflow || undefined,
        outputPath: opts.output || (opts.format === 'dir' ? path.join('export', 'workspace') : undefined),
      });

      if (!result.success) {
        console.error(`✗ ${result.error.message}`);
        process.exit(1);
      }

      switch (opts.format) {
        case 'json': {
          const outPath = opts.output || 'workspace-export.json';
          fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
          fs.writeFileSync(outPath, result.data.data, 'utf8');
          console.log(`✓ Exported JSON bundle to ${outPath}`);
          break;
        }
        case 'zip': {
          const outPath = opts.output || 'workspace-export.zip';
          fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
          fs.writeFileSync(outPath, result.data.data);
          console.log(`✓ Exported ZIP archive to ${outPath}`);
          break;
        }
        case 'dir': {
          console.log(`✓ Exported to ${result.data.path}/ (${result.data.fileCount} files)`);
          break;
        }
        case 'share': {
          if (opts.output) {
            fs.writeFileSync(opts.output, result.data.data, 'utf8');
            console.log(`✓ Exported shareable format to ${opts.output}`);
          } else {
            process.stdout.write(result.data.data);
          }
          if (result.data.warnings?.length) {
            result.data.warnings.forEach((w) => console.error(`⚠ ${w}`));
          }
          break;
        }
      }
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  });

/* ------------------------------------------------------------------ */
/*  import --from <source>                                             */
/* ------------------------------------------------------------------ */

program
  .command('import')
  .description('Import a workspace from ZIP, JSON file, URL, or platform config')
  .option('--from <source>', 'source: file path (ZIP/JSON) or URL')
  .option('--platform <name>', 'source platform (kiro, cursor, claude-code, vscode-copilot, windsurf)')
  .option('--auto-detect', 'auto-detect source platform')
  .option('--source <dir>', 'source directory for platform import')
  .option('--overwrite', 'overwrite existing files')
  .option('--dry-run', 'preview only, do not write files')
  .option('-t, --target <dir>', 'target directory', brandConfig.dir)
  .action(async (opts) => {
    // Platform-specific import
    if (opts.platform || opts.autoDetect) {
      try {
        const { TransportRegistry } = require(path.join(srcDir, 'transport', 'transport-registry'));
        const { AdapterFactory } = require(path.join(srcDir, 'transport', 'adapter-factory'));
        const { ImportPipeline, detectPlatform } = require(path.join(srcDir, 'transport', 'import-pipeline'));
        const sourceDir = opts.source ? path.resolve(opts.source) : process.cwd();
        let platformName = opts.platform;
        if (opts.autoDetect) {
          platformName = detectPlatform(sourceDir);
          if (!platformName) { console.error('\u2717 Could not auto-detect platform'); process.exit(1); }
          console.log(`Detected platform: ${platformName}`);
        }
        const { glob } = require('glob');
        const sourceFiles = {};
        const files = glob.sync('**/*', { cwd: sourceDir, nodir: true, dot: true });
        for (const f of files) sourceFiles[f] = fs.readFileSync(path.join(sourceDir, f), 'utf8');
        const registry = new TransportRegistry();
        const factory = new AdapterFactory(path.join(srcDir, 'transport', 'platforms'));
        factory.registerAll(registry);
        const pipeline = new ImportPipeline(registry);
        const result = await pipeline.import(platformName, sourceFiles, { dryRun: !!opts.dryRun });
        if (!result.ok) { console.error(`\u2717 ${result.error}`); process.exit(1); }
        if (opts.dryRun) {
          console.log('(dry run \u2014 no files written)');
        } else {
          const targetDir = opts.target ? path.resolve(opts.target) : path.resolve('.agentflow');
          for (const [filePath, content] of Object.entries(result.data.files)) {
            const fullPath = path.join(targetDir, filePath);
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, content);
          }
          console.log(`\u2713 Imported from ${platformName} (${Object.keys(result.data.files).length} files)`);
        }
        if (result.data.warnings?.length) result.data.warnings.forEach(w => console.log(`  \u26a0 ${w}`));
      } catch (err) { console.error(`\u2717 ${err.message}`); process.exit(1); }
      return;
    }

    // Legacy import via --from
    if (!opts.from) {
      console.error('\u2717 Provide --from <source>, --platform <name>, or --auto-detect');
      process.exit(1);
    }
    try {
      const { createImportService } = require(path.join(srcDir, 'services', 'import-service'));
      const targetRoot = path.resolve(opts.target);
      const svc = createImportService({ rootDir: targetRoot, logger: { error: () => {} } });
      const importOpts = { overwrite: !!opts.overwrite, dryRun: !!opts.dryRun };
      let result;

      if (opts.from.startsWith('http://') || opts.from.startsWith('https://')) {
        result = await svc.importFromUrl(opts.from, targetRoot, importOpts);
      } else {
        const filePath = path.resolve(opts.from);
        if (!fs.existsSync(filePath)) {
          console.error(`✗ File not found: ${filePath}`);
          process.exit(1);
        }
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.zip') {
          const buffer = fs.readFileSync(filePath);
          result = await svc.importFromZip(buffer, targetRoot, importOpts);
        } else {
          // Assume JSON (bundle or shareable format)
          const json = fs.readFileSync(filePath, 'utf8');
          result = svc.importFromClipboard(json, targetRoot, importOpts);
        }
      }

      if (!result.success) {
        console.error(`✗ ${result.error.message}`);
        process.exit(1);
      }

      if (opts.dryRun) console.log('(dry run — no files written)');
      const d = result.data;
      console.log(`✓ ${d.filesWritten.length} file(s) written`);
      if (d.skipped?.length) console.log(`  ${d.skipped.length} file(s) skipped (already exist)`);
      if (d.warnings?.length) d.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  });

/* ------------------------------------------------------------------ */
/*  graph [dir]                                                        */
/* ------------------------------------------------------------------ */

program
  .command('graph')
  .description('Print ASCII graph representation')
  .argument('[dir]', 'workspace directory', brandConfig.dir)
  .action((dir) => {
    const rootDir = path.resolve(dir);
    const graph = cli.parseRoot(rootDir);
    const lines = [];

    for (const wfId of Object.keys(graph.workflows || {})) {
      const wf = graph.workflows[wfId];
      if (Object.keys(graph.workflows).length > 1) {
        lines.push(`# ${wf.name || wfId}`);
      }
      for (const edge of wf.edges || []) {
        const from = `[${edge.from}]`;
        const to = `[${edge.to}]`;
        if (edge.condition) {
          const condName = edge.condition.split('/').pop();
          lines.push(`${from} --> ${to} (when: ${condName})`);
        } else {
          lines.push(`${from} --> ${to}`);
        }
      }
    }

    if (!lines.length) {
      console.log('(no edges)');
    } else {
      console.log(lines.join('\n'));
    }
  });

/* ------------------------------------------------------------------ */
/*  init [dir]                                                         */
/* ------------------------------------------------------------------ */

program
  .command('init')
  .description(`Scaffold a new ${brandConfig.name} workspace`)
  .argument('[dir]', 'directory', brandConfig.dir)
  .action((dir) => {
    const base = path.resolve(dir);
    for (const d of core.taxonomy.RESERVED_DIRS) {
      fs.mkdirSync(path.join(base, d), { recursive: true });
    }
    fs.writeFileSync(
      path.join(base, 'AGENTS.md'),
      [
        '---',
        'type: agents',
        'name: my-workspace',
        'description: My AgentFlow workspace',
        '---',
        '',
        'You are an AI assistant operating inside an AgentFlow workspace. When a workflow is active, you follow it step by step. When no workflow is active, you help with whatever the user needs.',
        '',
        '## Available Workflows',
        '',
        '{{$workflows}}',
        '',
        '## How to Execute',
        '',
        '{{$execution}}',
        '',
        '## Directory Structure',
        '',
        '{{$directory}}',
        '',
        '## Principles',
        '',
        '- Read before you act. Understand the node and prior context first.',
        '- Plan before multi-step work. Outline your approach, especially for code changes.',
        '- Ask when uncertain. A clarifying question beats a wrong assumption.',
        '- One thing at a time. Complete the current step before moving on.',
        '',
        '## Safety',
        '',
        '- Never skip nodes or jump ahead.',
        '- No destructive actions (file deletion, force push, data drops) without explicit confirmation.',
        '- Stay within the scope defined by the current node.',
        '- If something fails twice, stop and explain what you tried.',
        '',
        '## Bundled Resources',
        '',
        '{{$resources}}',
        '',
      ].join('\n'),
    );
    console.log(`✓ Initialized ${brandConfig.name} workspace at ${base}`);
  });

/* ------------------------------------------------------------------ */
/*  add <type> <name>                                                  */
/* ------------------------------------------------------------------ */

program
  .command('add')
  .description('Install a resource from the library')
  .argument('<type>', 'resource type (workflow, instruction, capability, skill, memory)')
  .argument('<name>', 'resource name')
  .action((type, name) => {
    const registryPath = path.resolve('library', 'registry.json');
    if (!fs.existsSync(registryPath)) {
      console.error(`Library registry not found. Run \`${brandConfig.cli} library index\` first.`);
      process.exit(1);
    }
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    registry._libraryDir = path.resolve('library');
    try {
      cli.library.add(registry, type, name, path.resolve(brandConfig.dir));
      console.log(`✓ Added ${type} "${name}" to ${brandConfig.dir}/`);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  });

/* ------------------------------------------------------------------ */
/*  search <query>                                                     */
/* ------------------------------------------------------------------ */

program
  .command('search')
  .description('Search local library and MCP registry')
  .argument('<query>', 'search query')
  .option('--local-only', 'skip MCP registry')
  .option('--mcp-only', 'skip local library')
  .action(async (query, opts) => {
    try {
      let registry = { entries: [] };
      if (!opts.mcpOnly) {
        const registryPath = path.resolve('library', 'registry.json');
        if (fs.existsSync(registryPath)) {
          registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
        }
      }
      
      const results = await unifiedSearch(registry, query, {
        localOnly: !!opts.localOnly,
        mcpOnly: !!opts.mcpOnly,
      });
      
      if (!results.length) {
        console.log(`No results for "${query}".`);
        return;
      }
      
      for (const entry of results) {
        if (entry.source === 'local') {
          console.log(`  [local] [${entry.type}] ${entry.name} — ${entry.description || '(no description)'}`);
        } else {
          // MCP registry result
          const transports = [];
          for (const pkg of entry.packages || []) {
            if (pkg.transport && pkg.transport.type) transports.push(pkg.transport.type);
          }
          for (const remote of entry.remotes || []) {
            if (remote.type) transports.push(remote.type);
          }
          const transportStr = transports.length ? ` (${transports.join(', ')})` : '';
          console.log(`  [mcp] ${entry.name} — ${entry.description || '(no description)'}${transportStr}`);
        }
      }
      console.log(`\n${results.length} result(s)`);
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  });

/* ------------------------------------------------------------------ */
/*  library index                                                      */
/* ------------------------------------------------------------------ */

program
  .command('library')
  .description('Library management commands')
  .argument('<action>', 'action (index, list, search)')
  .argument('[query]', 'search query (for search action)')
  .option('--type <type>', 'filter by type (workflow, instruction, capability, skill, memory)')
  .option('--tags <tags>', 'filter by tags (comma-separated)')
  .action((action, query, opts) => {
    if (action === 'index') {
      const libraryDir = path.resolve('library');
      if (!fs.existsSync(libraryDir)) {
        console.error('library/ directory not found.');
        process.exit(1);
      }
      const registry = cli.library.index(libraryDir);
      const outPath = path.join(libraryDir, 'registry.json');
      fs.writeFileSync(outPath, JSON.stringify(registry, null, 2));
      console.log(`✓ Regenerated ${outPath} (${registry.entries.length} entries)`);
    } else if (action === 'list') {
      const registryPath = path.resolve('library', 'registry.json');
      if (!fs.existsSync(registryPath)) {
        console.error(`Library registry not found. Run \`${brandConfig.cli} library index\` first.`);
        process.exit(1);
      }
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
      let entries = registry.entries || [];
      if (opts.type) entries = entries.filter((e) => e.type === opts.type);
      if (opts.tags) {
        const tagList = opts.tags.split(',').map((t) => t.trim().toLowerCase());
        entries = entries.filter((e) => (e.tags || []).some((t) => tagList.includes(t.toLowerCase())));
      }
      if (entries.length === 0) {
        console.log('No items found.');
        return;
      }
      for (const e of entries) {
        const tags = (e.tags || []).slice(0, 3).join(', ');
        const tagStr = tags ? ` [${tags}]` : '';
        console.log(`  [${e.type}] ${e.name} — ${e.description || '(no description)'}${tagStr}`);
      }
      console.log(`\n${entries.length} item(s)`);
    } else if (action === 'search') {
      if (!query) {
        console.error('Usage: library search <query>');
        process.exit(1);
      }
      const registryPath = path.resolve('library', 'registry.json');
      if (!fs.existsSync(registryPath)) {
        console.error(`Library registry not found. Run \`${brandConfig.cli} library index\` first.`);
        process.exit(1);
      }
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
      let entries = registry.entries || [];
      if (opts.type) entries = entries.filter((e) => e.type === opts.type);
      const q = query.toLowerCase();
      entries = entries.filter((e) =>
        e.name.toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.tags || []).some((t) => t.toLowerCase().includes(q))
      );
      // Sort: exact name match first
      entries.sort((a, b) => {
        const aExact = a.name.toLowerCase() === q ? 0 : 1;
        const bExact = b.name.toLowerCase() === q ? 0 : 1;
        return aExact - bExact;
      });
      if (entries.length === 0) {
        console.log(`No results for "${query}".`);
        return;
      }
      for (const e of entries) {
        console.log(`  [${e.type}] ${e.name} — ${e.description || '(no description)'}`);
      }
      console.log(`\n${entries.length} result(s)`);
    } else {
      console.error(`Unknown library action: ${action}. Use: index, list, search`);
      process.exit(1);
    }
  });

/* ------------------------------------------------------------------ */
/*  dev [dir] — Start the studio                                       */
/* ------------------------------------------------------------------ */

program
  .command('dev')
  .description('Start the AgentFlow studio (alias: studio)')
  .argument('[dir]', 'workspace directory')
  .option('--agent', 'also start LangGraph runtime')
  .option('-p, --port <port>', 'studio port', '3000')
  .action((dir, opts) => {
    startStudio(dir, opts);
  });

program
  .command('studio')
  .description('Start the AgentFlow studio')
  .argument('[dir]', 'workspace directory')
  .option('--agent', 'also start LangGraph runtime')
  .option('-p, --port <port>', 'studio port', '3000')
  .action((dir, opts) => {
    startStudio(dir, opts);
  });

function findStudioDir() {
  // Walk up from the CLI bin to find the studio/ directory in the monorepo
  let dir = path.resolve(__dirname, '..');
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, 'studio');
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    dir = path.dirname(dir);
  }
  return null;
}

function startStudio(dir, opts) {
  const { spawn } = require('child_process');
  const root = dir ? path.resolve(dir) : cli.resolveRoot();
  process.env.AGENTFLOW_ROOT = root;
  const studioDir = findStudioDir();

  if (!studioDir) {
    console.error('✗ Could not find the studio/ directory. Make sure you are in the agentflow monorepo.');
    process.exit(1);
  }

  console.log(`Starting AgentFlow Studio...`);
  console.log(`  Studio:    ${studioDir}`);
  console.log(`  Workspace: ${root}`);
  console.log(`  Port:      ${opts.port}`);
  console.log();

  if (opts.agent) {
    const { execSync } = require('child_process');
    try { execSync('npx concurrently --version', { stdio: 'ignore' }); } catch (_) {
      console.error('✗ Install concurrently: npm i -D concurrently');
      process.exit(1);
    }
    const nextCmd = `next dev --port ${opts.port}`;
    spawn('npx', ['concurrently', '-k', '-n', 'studio,agent', '-c', 'blue,green',
      `cd ${studioDir} && ${nextCmd}`,
      'sleep 2 && npx @langchain/langgraph-cli dev --no-browser --port 2024'
    ], { stdio: 'inherit', shell: true });
  } else {
    const args = ['dev', '--port', opts.port];
    spawn('npx', ['next', ...args], { cwd: studioDir, stdio: 'inherit', env: { ...process.env, AGENTFLOW_ROOT: root } });
  }
}

/* ------------------------------------------------------------------ */
/*  tokens [dir]                                                       */
/* ------------------------------------------------------------------ */

program
  .command('tokens')
  .description('Calculate context token estimates')
  .argument('[dir]', 'workspace directory', brandConfig.dir)
  .option('-w, --workflow <name>', 'workflow to analyze')
  .option('-n, --node <id>', 'specific node to analyze')
  .option('--path-to <id>', 'calculate tokens for flow path from entry to node')
  .option('-f, --file <path>', 'calculate tokens for a single file')
  .option('--full', 'calculate tokens for entire graph')
  .option('--no-shared', 'exclude shared resources')
  .option('--no-refs', 'exclude referenced resources per node')
  .option('--json', 'output raw JSON')
  .action((dir, opts) => {
    const rootDir = path.resolve(dir);
    const graph = cli.parseRoot(rootDir);

    let scope = 'workflow';
    const calcOpts = {
      workflowId: opts.workflow,
      includeShared: opts.shared !== false,
      includeRefs: opts.refs !== false,
    };

    if (opts.file) {
      scope = 'file';
      calcOpts.filePath = opts.file;
    } else if (opts.pathTo) {
      scope = 'path-to-node';
      calcOpts.nodeId = opts.pathTo;
    } else if (opts.node) {
      scope = 'node';
      calcOpts.nodeId = opts.node;
    } else if (opts.full) {
      scope = 'full';
    }

    calcOpts.scope = scope;
    const result = calculateTokens(graph, calcOpts);

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatTokenSummary(result));
    }

    if (result.error) process.exit(1);
  });

/* ------------------------------------------------------------------ */
/*  dry-run [dir]                                                      */
/* ------------------------------------------------------------------ */

program
  .command('dry-run')
  .description('Simulate workflow execution without running tools')
  .argument('[dir]', 'workspace directory', brandConfig.dir)
  .option('-w, --workflow <name>', 'workflow to simulate')
  .option('-b, --branch <name>', 'follow specific router branch')
  .option('--max-visits <n>', 'max visits per node (cycle protection)', '2')
  .option('--expand-sub-workflows', 'recurse into sub-workflows')
  .option('--no-tokens', 'skip token calculation per step')
  .option('--json', 'output raw JSON')
  .action((dir, opts) => {
    const rootDir = path.resolve(dir);
    const graph = cli.parseRoot(rootDir);

    const workflowIds = Object.keys(graph.workflows || {});
    let workflowId = opts.workflow;
    if (!workflowId) {
      if (workflowIds.length === 1) {
        workflowId = workflowIds[0];
      } else if (workflowIds.length === 0) {
        console.error('No workflows found.');
        process.exit(1);
      } else {
        console.error(`Multiple workflows found. Use --workflow <name>: ${workflowIds.join(', ')}`);
        process.exit(1);
      }
    }

    const result = dryRun(graph, workflowId, {
      branch: opts.branch || null,
      maxVisits: parseInt(opts.maxVisits, 10),
      expandSubWorkflows: !!opts.expandSubWorkflows,
      includeTokens: opts.tokens !== false,
    });

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatDryRunTrace(result));
    }

    if (result.error) process.exit(1);
  });

/* ------------------------------------------------------------------ */
/*  git — Git integration subcommands                                  */
/* ------------------------------------------------------------------ */

const git = program
  .command('git')
  .description(`Git integration commands for syncing ${brandConfig.dir} workspaces`);

/* ---- helpers ---- */

function deriveNameFromUrl(url) {
  const base = url.replace(/\.git$/, '').split('/').pop();
  return base || 'repo';
}

function formatScanResults(scanResult) {
  const lines = [];
  const { agentflowPaths, resources, workflows, stats, warnings } = scanResult;

  lines.push(`Scan complete in ${stats.scanDurationMs}ms`);
  lines.push(`  ${brandConfig.dir} dirs: ${agentflowPaths.length}`);
  for (const afPath of agentflowPaths) {
    lines.push(`    ${afPath}`);
  }

  lines.push(`  Resources: ${stats.totalResources}`);
  for (const type of core.taxonomy.CANONICAL_CATEGORIES) {
    const items = resources[type] || [];
    if (items.length > 0) {
      lines.push(`    ${type}: ${items.length}`);
      for (const r of items) {
        lines.push(`      - ${r.name} (${r.path})`);
      }
    }
  }

  if (workflows.length > 0) {
    lines.push(`  Workflows: ${stats.totalWorkflows}`);
    for (const wf of workflows) {
      lines.push(`    - ${wf.name} (${wf.nodeCount} nodes${wf.hasDescriptor ? ', has descriptor' : ''})`);
    }
  }

  for (const w of warnings) {
    lines.push(`  ⚠ ${w.message} (${w.path})`);
  }

  return lines.join('\n');
}

async function initializeRepo(repoUrl, options) {
  const config = configManager.loadOrCreate(options.configPath);
  const name = options.name || deriveNameFromUrl(repoUrl);

  // Check for duplicate repo name
  if (config.repos.some((r) => r.name === name)) {
    throw new Error(`Repo mapping "${name}" already exists`);
  }

  let targetDir;
  if (options.role === 'agentic') {
    targetDir = options.localPath || path.resolve('.agentflow-repos', name);
  } else if (options.role === 'shared') {
    targetDir = options.localPath || path.resolve('.agentflow-shared', name);
  } else {
    targetDir = options.localPath || process.cwd();
  }

  let gm;
  if (fs.existsSync(targetDir) && fs.existsSync(path.join(targetDir, '.git'))) {
    gm = gitManager.attach(targetDir);
    try { await gm.addRemote('agentflow', repoUrl); } catch (_) { /* remote may exist */ }
  } else {
    gm = await gitManager.clone(repoUrl, targetDir, options.branch);
  }

  const scanResult = repoScanner.scan(targetDir, config.scanDepth);

  const mapping = {
    name,
    url: repoUrl,
    branch: options.branch || 'main',
    localPath: targetDir,
    repoType: options.repoType || 'public',
    role: options.role || 'primary',
    agentflowPath: scanResult.agentflowPaths[0] || brandConfig.dir,
  };

  config.repos.push(mapping);
  cli.configManager.save(config, options.configPath);

  return { success: true, scanResult, mapping };
}

/* ---- git init ---- */

git
  .command('init <repo-url>')
  .description(`Clone/attach a repo and scan its ${brandConfig.dir} structure`)
  .option('--name <name>', 'user-defined label for this repo')
  .option('--role <role>', 'repo role (primary, agentic, shared)', 'primary')
  .option('--branch <branch>', 'branch to sync', 'main')
  .option('--repo-type <type>', 'repo type (public, private, custom)', 'public')
  .action(async (repoUrl, opts) => {
    try {
      const result = await initializeRepo(repoUrl, {
        name: opts.name,
        role: opts.role,
        branch: opts.branch,
        repoType: opts.repoType,
      });
      console.log(`✓ Initialized repo "${result.mapping.name}"`);
      console.log(formatScanResults(result.scanResult));
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  });

/* ---- git scan ---- */

git
  .command('scan [dir]')
  .description(`Scan a directory for ${brandConfig.dir} structure`)
  .option('--depth <n>', 'max scan depth', '5')
  .action((dir, opts) => {
    try {
      const rootDir = path.resolve(dir || '.');
      const depth = parseInt(opts.depth, 10);
      const scanResult = repoScanner.scan(rootDir, depth);
      console.log(formatScanResults(scanResult));
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  });

/* ---- git sync ---- */

git
  .command('sync [repo-name]')
  .description(`Sync local ${brandConfig.dir} with remote`)
  .option('--direction <dir>', 'sync direction (push, pull, bidirectional)', 'bidirectional')
  .option('--dry-run', 'preview changes without executing')
  .action(async (repoName, opts) => {
    try {
      const config = configManager.loadOrCreate();
      const name = repoName || (config.repos[0] && config.repos[0].name);
      if (!name) {
        console.error(`✗ No repo configured. Run \`${brandConfig.cli} git init\` first.`);
        process.exit(1);
      }

      const directionMap = { push: 'push_only', pull: 'pull_only', bidirectional: 'bidirectional' };
      const direction = directionMap[opts.direction] || opts.direction;

      const result = await syncEngine.sync(config, name, direction, { dryRun: !!opts.dryRun });

      if (opts.dryRun) console.log('(dry run — no changes applied)');
      console.log(`✓ Sync ${result.direction}: ${result.filesAdded.length} added, ${result.filesModified.length} modified, ${result.filesDeleted.length} deleted`);
      if (result.conflicts.length > 0) {
        console.log(`  Conflicts: ${result.conflicts.length}`);
        for (const c of result.conflicts) {
          console.log(`    ${c.path} — ${c.resolution}`);
        }
      }
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  });

/* ---- git status ---- */

git
  .command('status [repo-name]')
  .description('Show repo and sync status')
  .action(async (repoName) => {
    try {
      const config = configManager.loadOrCreate();
      const name = repoName || (config.repos[0] && config.repos[0].name);
      if (!name) {
        console.error(`✗ No repo configured. Run \`${brandConfig.cli} git init\` first.`);
        process.exit(1);
      }

      const mapping = config.repos.find((r) => r.name === name);
      if (!mapping) {
        console.error(`✗ No repo mapping found for: ${name}`);
        process.exit(1);
      }

      const gm = gitManager.attach(mapping.localPath);
      const repoStatus = await gm.status();

      console.log(`Repo: ${mapping.name} (${mapping.role})`);
      console.log(`  URL:      ${mapping.url}`);
      console.log(`  Branch:   ${repoStatus.branch}`);
      console.log(`  Clean:    ${repoStatus.isClean ? 'yes' : 'no'}`);
      console.log(`  Remote:   ${repoStatus.hasRemote ? repoStatus.remoteUrl : 'none'}`);
      if (repoStatus.ahead || repoStatus.behind) {
        console.log(`  Ahead:    ${repoStatus.ahead}  Behind: ${repoStatus.behind}`);
      }
      if (repoStatus.modifiedFiles.length > 0) {
        console.log(`  Modified: ${repoStatus.modifiedFiles.join(', ')}`);
      }
      if (repoStatus.untrackedFiles.length > 0) {
        console.log(`  Untracked: ${repoStatus.untrackedFiles.join(', ')}`);
      }
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  });

/* ---- git resolve ---- */

git
  .command('resolve <path>')
  .description('Resolve a sync conflict')
  .option('--strategy <strategy>', 'resolution strategy (local_wins, remote_wins)', 'local_wins')
  .action(async (conflictPath, opts) => {
    try {
      const config = configManager.loadOrCreate();
      if (!config.repos.length) {
        console.error(`✗ No repo configured. Run \`${brandConfig.cli} git init\` first.`);
        process.exit(1);
      }

      const mapping = config.repos[0];
      const gm = gitManager.attach(mapping.localPath);
      const resolution = await syncEngine.resolveConflict(gm, conflictPath, opts.strategy);
      console.log(`✓ Resolved ${conflictPath} → ${resolution}`);
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  });

/* ---- git config ---- */

git
  .command('config')
  .description('View or edit git integration config')
  .option('--set <key=value>', 'set a config value')
  .option('--get <key>', 'get a config value')
  .option('--list', 'list all config values')
  .action((opts) => {
    try {
      const config = configManager.loadOrCreate();

      if (opts.list) {
        console.log(JSON.stringify(config, null, 2));
        return;
      }

      if (opts.get) {
        const keys = opts.get.split('.');
        let value = config;
        for (const k of keys) {
          if (value == null) break;
          value = value[k];
        }
        if (value === undefined) {
          console.error(`✗ Key "${opts.get}" not found`);
          process.exit(1);
        }
        console.log(typeof value === 'object' ? JSON.stringify(value, null, 2) : value);
        return;
      }

      if (opts.set) {
        const eqIdx = opts.set.indexOf('=');
        if (eqIdx === -1) {
          console.error('✗ Use --set key=value format');
          process.exit(1);
        }
        const key = opts.set.slice(0, eqIdx);
        const rawValue = opts.set.slice(eqIdx + 1);

        // Parse value: booleans, numbers, or string
        let value;
        if (rawValue === 'true') value = true;
        else if (rawValue === 'false') value = false;
        else if (!isNaN(rawValue) && rawValue !== '') value = Number(rawValue);
        else value = rawValue;

        const keys = key.split('.');
        let target = config;
        for (let i = 0; i < keys.length - 1; i++) {
          if (target[keys[i]] == null || typeof target[keys[i]] !== 'object') {
            target[keys[i]] = {};
          }
          target = target[keys[i]];
        }
        target[keys[keys.length - 1]] = value;

        cli.configManager.save(config);
        console.log(`✓ Set ${key} = ${rawValue}`);
        return;
      }

      // Default: show summary
      console.log(`Version: ${config.version}`);
      console.log(`Repos: ${config.repos.length}`);
      for (const r of config.repos) {
        console.log(`  - ${r.name} (${r.role}) → ${r.url}`);
      }
      console.log(`Conflict strategy: ${config.conflictStrategy}`);
      console.log(`Auto-scan: ${config.autoScan}`);
      console.log(`Scan depth: ${config.scanDepth}`);
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  });

/* ------------------------------------------------------------------ */
/*  run [dir] — execute a workflow with an LLM                         */
/* ------------------------------------------------------------------ */

program
  .command('run')
  .description('Execute a workflow end-to-end using an LLM')
  .argument('[dir]', 'workspace directory', brandConfig.dir)
  .requiredOption('-w, --workflow <id>', 'workflow to run (e.g. build-feature)')
  .option('-p, --provider <name>', 'LLM provider (anthropic, openai)', 'anthropic')
  .option('-m, --model <name>', 'model name override')
  .option('--prompt <text>', 'initial user prompt / feature request')
  .option('--max-steps <n>', 'max steps before stopping', '50')
  .option('--dry-run', 'print assembled context without calling LLM')
  .option('--verbose', 'print debug info')
  .action(async (dir, opts) => {
    console.error('✗ The `run` command is not yet available. Use `agentflow dev --agent` to test workflows via the studio.');
    process.exit(1);
  });

/* ------------------------------------------------------------------ */
/*  mcp — MCP server management subcommands                            */
/* ------------------------------------------------------------------ */

const mcp = program
  .command('mcp')
  .description('MCP server management commands');

/* ---- mcp search ---- */

mcp
  .command('search <query>')
  .description('Search the official MCP registry')
  .option('--limit <n>', 'max results', '20')
  .action(async (query, opts) => {
    try {
      const limit = parseInt(opts.limit, 10);
      const result = await core.registryClient.searchRegistry(query, { limit });
      const results = result.entries;

      if (!results.length) {
        console.log(`No results for "${query}".`);
        process.exit(0);
      }

      for (const entry of results) {
        const transports = [];
        for (const pkg of entry.packages || []) {
          if (pkg.transport && pkg.transport.type) {
            transports.push(pkg.transport.type);
          }
        }
        for (const remote of entry.remotes || []) {
          if (remote.type) {
            transports.push(remote.type);
          }
        }
        const transportStr = transports.length ? ` (${transports.join(', ')})` : '';
        console.log(`  ${entry.name} — ${entry.description || '(no description)'}${transportStr}`);
      }

      console.log(`\n${results.length} result(s)`);
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  });

/* ---- mcp add ---- */

function collectEnv(val, acc) {
  const eqIdx = val.indexOf('=');
  if (eqIdx === -1) {
    console.error(`✗ Invalid env format: "${val}". Use KEY=VALUE`);
    process.exit(1);
  }
  acc[val.slice(0, eqIdx)] = val.slice(eqIdx + 1);
  return acc;
}

mcp
  .command('add <server-name>')
  .description('Add an MCP server from the registry')
  .option('--required', 'mark server as required')
  .option('--env <KEY=VALUE...>', 'set environment variables', collectEnv, {})
  .action(async (serverName, opts) => {
    try {
      const entry = await core.registryClient.getServer(serverName);
      if (!entry) {
        console.error(`✗ Server "${serverName}" not found in registry`);
        process.exit(1);
      }
      const rootDir = path.resolve(brandConfig.dir);
      cli.mcpConfig.addServer(rootDir, serverName, entry, {
        required: !!opts.required,
        env: opts.env || {},
      });
      console.log(`✓ Added MCP server "${serverName}" to mcp.json`);
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  });

/* ---- mcp remove ---- */

mcp
  .command('remove <server-name>')
  .description('Remove an MCP server from mcp.json')
  .option('--remove-tools', 'also delete generated tool files')
  .action((serverName, opts) => {
    try {
      const rootDir = path.resolve(brandConfig.dir);
      cli.mcpConfig.removeServer(rootDir, serverName, { removeTools: !!opts.removeTools });
      console.log(`✓ Removed MCP server "${serverName}" from mcp.json`);
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  });

/* ---- mcp discover ---- */

mcp
  .command('discover <server-name>')
  .description('Discover tools from an MCP server and scaffold .md files')
  .option('--timeout <ms>', 'connection timeout', '30000')
  .option('--overwrite', 'overwrite existing tool files')
  .action(async (serverName, opts) => {
    try {
      const rootDir = path.resolve(brandConfig.dir);
      const config = loadMcpConfig(rootDir);
      const serverEntry = config.servers[serverName];
      if (!serverEntry) {
        console.error(`✗ Server "${serverName}" not found in mcp.json. Run \`${brandConfig.cli} mcp add ${serverName}\` first.`);
        process.exit(1);
      }
      console.log(`Starting server "${serverName}"... `);
      const tools = await discoverTools(serverEntry, { timeout: parseInt(opts.timeout, 10) });
      console.log(`Found ${tools.length} tool(s)`);
      const paths = scaffoldTools(rootDir, serverName, tools, { overwrite: !!opts.overwrite });
      console.log(`Scaffolded ${paths.length} tool file(s) in ${brandConfig.dir}/tools/`);
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  });

/* ---- mcp list ---- */

mcp
  .command('list')
  .description('List MCP servers configured in mcp.json')
  .action(() => {
    try {
      const rootDir = path.resolve(brandConfig.dir);
      const config = loadMcpConfig(rootDir);
      const servers = config.servers || {};
      const names = Object.keys(servers);

      if (names.length === 0) {
        console.log(`No MCP servers configured. Use \`${brandConfig.cli} mcp add <server-name>\` to add one.`);
        return;
      }

      for (const name of names) {
        const s = servers[name];
        const required = s.required ? 'required' : 'optional';
        const transport = s.command ? 'stdio' : s.url ? 'http' : 'unknown';
        const desc = s.description || '(no description)';
        console.log(`  ${name} — ${desc} [${required}, ${transport}]`);
      }
      console.log(`\n${names.length} server(s)`);
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  });

/* ------------------------------------------------------------------ */
/*  Parse CLI arguments                                                */
/* ------------------------------------------------------------------ */

program.parse();
