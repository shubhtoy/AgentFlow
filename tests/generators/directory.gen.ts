const fc = require('fast-check');
const { nameArb } = require('./refs.gen.js');
const { titleArb, paragraphArb, serializeFrontmatter } = require('./markdown.gen.js');
const {
  validToolFmArb,
  validSkillFmArb,
  validMemoryFmArb,
  validNodeFmArb,
  validAgentsFmArb,
} = require('./frontmatter.gen.js');

// ─── Constants ────────────────────────────────────────────────────────────────

const RESERVED_DIRS = ['instructions', 'capabilities', 'skills', 'memory', 'hooks'];

const RESERVED_DIR_FM_MAP = {
  instructions: validSkillFmArb,
  capabilities: validToolFmArb,
  skills: validSkillFmArb,
  memory: validMemoryFmArb,
  hooks: validMemoryFmArb,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const simpleBodyArb = fc
  .record({ title: titleArb, para: paragraphArb })
  .map(({ title, para }) => `# ${title}\n\n${para}\n`);

function mdFileArb(fmArb) {
  return fc
    .record({ fm: fmArb, body: simpleBodyArb })
    .map(({ fm, body }) => {
      const fmBlock = Object.keys(fm.frontmatter).length > 0
        ? serializeFrontmatter(fm.frontmatter)
        : '';
      return { content: fmBlock + body, resourceType: fm.resourceType };
    });
}

function nodeFileArb(overrides = {}) {
  return fc
    .record({ fm: validNodeFmArb, body: simpleBodyArb })
    .map(({ fm, body }) => {
      const merged = { ...fm.frontmatter, ...overrides };
      const fmBlock = Object.keys(merged).length > 0
        ? serializeFrontmatter(merged)
        : '';
      return { content: fmBlock + body, resourceType: 'node' };
    });
}

const agentsFileArb = fc
  .record({ fm: validAgentsFmArb, body: simpleBodyArb })
  .map(({ fm, body }) => {
    const fmBlock = serializeFrontmatter(fm.frontmatter);
    return { content: fmBlock + body, resourceType: 'agents' };
  });

// ─── Reserved directory file entries ──────────────────────────────────────────

function reservedDirFilesArb(dirName, count = { min: 0, max: 3 }) {
  const fmArb = RESERVED_DIR_FM_MAP[dirName];
  return fc
    .array(
      fc.record({ fileName: nameArb, file: mdFileArb(fmArb) }),
      { minLength: count.min, maxLength: count.max },
    )
    .map((entries) => {
      const seen = new Set();
      const files = [];
      for (const { fileName, file } of entries) {
        const uniqueName = seen.has(fileName) ? `${fileName}-dup` : fileName;
        seen.add(uniqueName);
        files.push({
          path: `${dirName}/${uniqueName}.md`,
          content: file.content,
          resourceType: file.resourceType,
        });
      }
      return files;
    });
}

// ─── Node directory entries ───────────────────────────────────────────────────

function singleFileNodeArb(dirPath) {
  return nodeFileArb().map((file) => ({
    files: [{ path: `${dirPath}/SKILL.md`, content: file.content, resourceType: 'node' }],
    dirPath,
  }));
}

function multiFileNodeArb(dirPath) {
  return fc
    .record({
      primaryFile: nodeFileArb(),
      contextCount: fc.integer({ min: 1, max: 3 }),
    })
    .chain(({ primaryFile, contextCount }) =>
      fc
        .array(
          fc.record({ name: nameArb, body: simpleBodyArb }),
          { minLength: contextCount, maxLength: contextCount },
        )
        .map((contextEntries) => {
          const files = [
            { path: `${dirPath}/SKILL.md`, content: primaryFile.content, resourceType: 'node' },
          ];
          const seen = new Set(['SKILL']);
          for (const { name, body } of contextEntries) {
            const uniqueName = seen.has(name) ? `${name}-ctx` : name;
            seen.add(uniqueName);
            files.push({ path: `${dirPath}/${uniqueName}.md`, content: body, resourceType: null });
          }
          return { files, dirPath };
        }),
    );
}

function nodeDirArb(dirPath) {
  return fc.oneof(singleFileNodeArb(dirPath), multiFileNodeArb(dirPath));
}

// ─── Workflow entries ─────────────────────────────────────────────────────────

const workflowArb = fc
  .record({ workflowName: nameArb, nodeCount: fc.integer({ min: 1, max: 5 }) })
  .chain(({ workflowName, nodeCount }) =>
    fc
      .record({ agentsFile: agentsFileArb, nodeNames: fc.array(nameArb, { minLength: nodeCount, maxLength: nodeCount }) })
      .chain(({ agentsFile, nodeNames }) => {
        const uniqueNames = [...new Set(nodeNames)];
        if (uniqueNames.length === 0) uniqueNames.push('default-node');
        const nodeArbs = uniqueNames.map((n) => nodeDirArb(`${workflowName}/${n}`));
        return fc.tuple(...nodeArbs).map((nodeResults) => {
          const files = [{ path: `${workflowName}/AGENTS.md`, content: agentsFile.content, resourceType: 'agents' }];
          const nodeDirectories = [];
          for (const nr of nodeResults) { files.push(...nr.files); nodeDirectories.push(nr.dirPath); }
          return { files, nodeDirectories, workflowName };
        });
      }),
  );

// ─── Tree assemblers ──────────────────────────────────────────────────────────

const simpleTreeArb = fc
  .record({ rootAgents: agentsFileArb, workflow: workflowArb, reservedDirCount: fc.integer({ min: 1, max: 3 }) })
  .chain(({ rootAgents, workflow, reservedDirCount }) => {
    const selectedDirs = RESERVED_DIRS.slice(0, reservedDirCount);
    const reservedArbs = selectedDirs.map((dir) => reservedDirFilesArb(dir, { min: 1, max: 2 }));
    return fc.tuple(...reservedArbs).map((reservedResults) => {
      const files = [{ path: 'AGENTS.md', content: rootAgents.content, resourceType: 'agents' }];
      const reservedDirectories = [];
      for (let i = 0; i < selectedDirs.length; i++) {
        if (reservedResults[i].length > 0) { files.push(...reservedResults[i]); reservedDirectories.push(selectedDirs[i]); }
      }
      files.push(...workflow.files);
      return { files, nodeDirectories: workflow.nodeDirectories, reservedDirectories, workflows: [workflow.workflowName] };
    });
  });

const complexTreeArb = fc
  .record({ rootAgents: agentsFileArb, workflow1: workflowArb, workflow2: workflowArb })
  .chain(({ rootAgents, workflow1, workflow2 }) => {
    const name2 = workflow2.workflowName === workflow1.workflowName ? `${workflow2.workflowName}-extra` : workflow2.workflowName;
    const wf2Files = name2 !== workflow2.workflowName
      ? workflow2.files.map((f) => ({ ...f, path: f.path.replace(workflow2.workflowName, name2) }))
      : workflow2.files;
    const reservedArbs = RESERVED_DIRS.map((dir) => reservedDirFilesArb(dir, { min: 0, max: 3 }));
    return fc.tuple(...reservedArbs).map((reservedResults) => {
      const files = [{ path: 'AGENTS.md', content: rootAgents.content, resourceType: 'agents' }];
      const reservedDirectories = [];
      for (let i = 0; i < RESERVED_DIRS.length; i++) {
        if (reservedResults[i].length > 0) { files.push(...reservedResults[i]); reservedDirectories.push(RESERVED_DIRS[i]); }
      }
      files.push(...workflow1.files, ...wf2Files);
      return {
        files,
        nodeDirectories: [...workflow1.nodeDirectories, ...workflow2.nodeDirectories],
        reservedDirectories,
        workflows: [workflow1.workflowName, name2],
      };
    });
  });

const directoryTreeArb = fc.oneof(simpleTreeArb, complexTreeArb);

module.exports = {
  directoryTreeArb,
  simpleTreeArb,
  complexTreeArb,
  RESERVED_DIRS,
  reservedDirFilesArb,
  nodeDirArb,
  workflowArb,
  agentsFileArb,
};
