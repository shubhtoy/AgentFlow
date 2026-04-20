const fc = require('fast-check');
const { nameArb } = require('./refs.gen.js');
const { titleArb, paragraphArb, serializeFrontmatter } = require('./markdown.gen.js');
const {
  validToolFmArb,
  validSkillFmArb,
  validTemplateFmArb,
  validInteractionFmArb,
  validMemoryFmArb,
  validNodeFmArb,
  validAgentsFmArb,
} = require('./frontmatter.gen.js');

// ─── Constants ────────────────────────────────────────────────────────────────

const RESERVED_DIRS = ['instructions', 'capabilities', 'runbooks', 'memory', 'hooks'];

const RESERVED_DIR_FM_MAP = {
  instructions: validSkillFmArb,
  capabilities: validToolFmArb,
  runbooks: validInteractionFmArb,
  memory: validMemoryFmArb,
  hooks: validMemoryFmArb,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a simple markdown body with a title and paragraph. */
const simpleBodyArb = fc
  .record({ title: titleArb, para: paragraphArb })
  .map(({ title, para }) => `# ${title}\n\n${para}\n`);

/** Generate a markdown file with optional frontmatter. */
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

/** Generate a node markdown file (with valid node frontmatter). */
function nodeFileArb(overrides = {}) {
  return fc
    .record({
      fm: validNodeFmArb,
      body: simpleBodyArb,
    })
    .map(({ fm, body }) => {
      const merged = { ...fm.frontmatter, ...overrides };
      const fmBlock = Object.keys(merged).length > 0
        ? serializeFrontmatter(merged)
        : '';
      return { content: fmBlock + body, resourceType: 'node' };
    });
}

/** Generate an AGENTS.md descriptor file. */
const agentsFileArb = fc
  .record({ fm: validAgentsFmArb, body: simpleBodyArb })
  .map(({ fm, body }) => {
    const fmBlock = serializeFrontmatter(fm.frontmatter);
    return { content: fmBlock + body, resourceType: 'agents' };
  });

// ─── Reserved directory file entries ──────────────────────────────────────────

/**
 * Generate file entries for a single reserved directory.
 * Returns array of { path, content, resourceType }.
 */
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

/**
 * Generate a single-file node directory.
 * The sole .md file becomes the primary.
 */
function singleFileNodeArb(dirPath) {
  return nodeFileArb().map((file) => ({
    files: [{ path: `${dirPath}/SKILL.md`, content: file.content, resourceType: 'node' }],
    dirPath,
  }));
}

/**
 * Generate a multi-file node directory.
 * One file gets primary:true, others are context files.
 */
function multiFileNodeArb(dirPath) {
  return fc
    .record({
      primaryFile: nodeFileArb({ primary: true }),
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
            { path: `${dirPath}/main.md`, content: primaryFile.content, resourceType: 'node' },
          ];
          const seen = new Set(['main']);
          for (const { name, body } of contextEntries) {
            const uniqueName = seen.has(name) ? `${name}-ctx` : name;
            seen.add(uniqueName);
            files.push({
              path: `${dirPath}/${uniqueName}.md`,
              content: body,
              resourceType: null,
            });
          }
          return { files, dirPath };
        }),
    );
}

/**
 * Generate a node directory (single or multi-file).
 */
function nodeDirArb(dirPath) {
  return fc.oneof(singleFileNodeArb(dirPath), multiFileNodeArb(dirPath));
}

// ─── Workflow entries ─────────────────────────────────────────────────────────

/**
 * Generate a workflow directory with AGENTS.md and node subdirectories.
 * Returns { files, nodeDirectories, workflowName }.
 */
const workflowArb = fc
  .record({
    workflowName: nameArb,
    nodeCount: fc.integer({ min: 1, max: 5 }),
  })
  .chain(({ workflowName, nodeCount }) =>
    fc
      .record({
        agentsFile: agentsFileArb,
        nodeNames: fc.array(nameArb, { minLength: nodeCount, maxLength: nodeCount }),
      })
      .chain(({ agentsFile, nodeNames }) => {
        // Deduplicate node names
        const uniqueNames = [...new Set(nodeNames)];
        if (uniqueNames.length === 0) uniqueNames.push('default-node');

        const nodeArbs = uniqueNames.map((nodeName) =>
          nodeDirArb(`${workflowName}/${nodeName}`),
        );

        return fc.tuple(...nodeArbs).map((nodeResults) => {
          const files = [
            {
              path: `${workflowName}/AGENTS.md`,
              content: agentsFile.content,
              resourceType: 'agents',
            },
          ];
          const nodeDirectories = [];

          for (const nodeResult of nodeResults) {
            files.push(...nodeResult.files);
            nodeDirectories.push(nodeResult.dirPath);
          }

          return { files, nodeDirectories, workflowName };
        });
      }),
  );

// ─── Sub-workflow entries ─────────────────────────────────────────────────────

/**
 * Generate a workflow with a nested sub-workflow node.
 * The sub-workflow node contains its own AGENTS.md and child nodes.
 */
const workflowWithSubArb = fc
  .record({
    workflowName: nameArb,
    subWorkflowNodeName: nameArb,
    regularNodeName: nameArb,
  })
  .chain(({ workflowName, subWorkflowNodeName, regularNodeName }) => {
    // Ensure unique names
    const subName = subWorkflowNodeName === regularNodeName
      ? `${subWorkflowNodeName}-sub`
      : subWorkflowNodeName;

    return fc
      .record({
        outerAgents: agentsFileArb,
        innerAgents: agentsFileArb,
        regularNode: nodeDirArb(`${workflowName}/${regularNodeName}`),
        innerNodeName: nameArb,
      })
      .chain(({ outerAgents, innerAgents, regularNode, innerNodeName }) =>
        nodeDirArb(`${workflowName}/${subName}/${innerNodeName}`).map((innerNode) => {
          const files = [
            {
              path: `${workflowName}/AGENTS.md`,
              content: outerAgents.content,
              resourceType: 'agents',
            },
            ...regularNode.files,
            {
              path: `${workflowName}/${subName}/AGENTS.md`,
              content: innerAgents.content,
              resourceType: 'agents',
            },
            ...innerNode.files,
          ];

          const nodeDirectories = [
            regularNode.dirPath,
            innerNode.dirPath,
          ];

          return {
            files,
            nodeDirectories,
            workflowName,
            subWorkflows: [`${workflowName}/${subName}`],
          };
        }),
      );
  });

// ─── Tree assemblers ──────────────────────────────────────────────────────────

/**
 * simpleTreeArb — Minimal tree: one workflow, a couple reserved dirs, root AGENTS.md.
 */
const simpleTreeArb = fc
  .record({
    rootAgents: agentsFileArb,
    workflow: workflowArb,
    reservedDirCount: fc.integer({ min: 1, max: 3 }),
  })
  .chain(({ rootAgents, workflow, reservedDirCount }) => {
    const selectedDirs = RESERVED_DIRS.slice(0, reservedDirCount);
    const reservedArbs = selectedDirs.map((dir) => reservedDirFilesArb(dir, { min: 1, max: 2 }));

    return fc.tuple(...reservedArbs).map((reservedResults) => {
      const files = [
        { path: 'AGENTS.md', content: rootAgents.content, resourceType: 'agents' },
      ];
      const reservedDirectories = [];

      for (let i = 0; i < selectedDirs.length; i++) {
        if (reservedResults[i].length > 0) {
          files.push(...reservedResults[i]);
          reservedDirectories.push(selectedDirs[i]);
        }
      }

      files.push(...workflow.files);

      return {
        files,
        nodeDirectories: workflow.nodeDirectories,
        reservedDirectories,
        workflows: [workflow.workflowName],
      };
    });
  });

/**
 * complexTreeArb — Tree with sub-workflows, multiple reserved dirs, multiple workflows.
 */
const complexTreeArb = fc
  .record({
    rootAgents: agentsFileArb,
    subWorkflow: workflowWithSubArb,
    extraWorkflow: workflowArb,
  })
  .chain(({ rootAgents, subWorkflow, extraWorkflow }) => {
    // Ensure workflow names are unique
    const extraName = extraWorkflow.workflowName === subWorkflow.workflowName
      ? `${extraWorkflow.workflowName}-extra`
      : extraWorkflow.workflowName;

    // Remap extra workflow paths if name changed
    const extraFiles = extraName !== extraWorkflow.workflowName
      ? extraWorkflow.files.map((f) => ({
          ...f,
          path: f.path.replace(extraWorkflow.workflowName, extraName),
        }))
      : extraWorkflow.files;
    const extraNodeDirs = extraName !== extraWorkflow.workflowName
      ? extraWorkflow.nodeDirectories.map((d) =>
          d.replace(extraWorkflow.workflowName, extraName),
        )
      : extraWorkflow.nodeDirectories;

    const reservedArbs = RESERVED_DIRS.map((dir) =>
      reservedDirFilesArb(dir, { min: 0, max: 3 }),
    );

    return fc.tuple(...reservedArbs).map((reservedResults) => {
      const files = [
        { path: 'AGENTS.md', content: rootAgents.content, resourceType: 'agents' },
      ];
      const reservedDirectories = [];

      for (let i = 0; i < RESERVED_DIRS.length; i++) {
        if (reservedResults[i].length > 0) {
          files.push(...reservedResults[i]);
          reservedDirectories.push(RESERVED_DIRS[i]);
        }
      }

      files.push(...subWorkflow.files);
      files.push(...extraFiles);

      const allNodeDirs = [
        ...subWorkflow.nodeDirectories,
        ...extraNodeDirs,
      ];

      const allWorkflows = [subWorkflow.workflowName, extraName];
      if (subWorkflow.subWorkflows) {
        allWorkflows.push(...subWorkflow.subWorkflows);
      }

      return {
        files,
        nodeDirectories: allNodeDirs,
        reservedDirectories,
        workflows: allWorkflows,
      };
    });
  });

/**
 * directoryTreeArb — General-purpose: randomly picks simple or complex tree.
 */
const directoryTreeArb = fc.oneof(simpleTreeArb, complexTreeArb);

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  directoryTreeArb,
  simpleTreeArb,
  complexTreeArb,
  // Building blocks for composition
  RESERVED_DIRS,
  reservedDirFilesArb,
  nodeDirArb,
  workflowArb,
  workflowWithSubArb,
  agentsFileArb,
};
