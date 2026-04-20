'use strict';

const path = require('path');
const fs = require('fs');
const { ok, fail, ErrorCode } = require('@agentflow/core/services/types');
const { atomicWrite } = require('../svc-utils/file-io');
const { AgentScaffoldSchema } = require('@agentflow/core/schemas/builder-schemas');

/**
 * Create a ScaffoldGenService bound to a service context.
 * @param {{ rootDir: string, logger: object }} ctx
 */
function createScaffoldGenService(ctx) {
  const { logger } = ctx;

  /**
   * Generate YAML frontmatter string from an object.
   */
  function toFrontmatter(obj) {
    const lines = ['---'];
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        lines.push(`${key}: [${value.join(', ')}]`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
    lines.push('---');
    return lines.join('\n');
  }

  /**
   * Generate root AGENTS.md content.
   */
  function generateRootAgentsMd(scaffold) {
    const fm = toFrontmatter({
      type: 'agent',
      name: scaffold.name,
      description: scaffold.description,
    });

    const sections = [fm, ''];

    // Identity
    sections.push(`## Identity\n`);
    sections.push(`Name: ${scaffold.identity.name}`);
    sections.push(`Role: ${scaffold.identity.role}`);
    if (scaffold.identity.constraints.length > 0) {
      sections.push(`\nConstraints:`);
      for (const c of scaffold.identity.constraints) {
        sections.push(`- ${c}`);
      }
    }

    // Workflow discovery
    sections.push(`\n## Workflows\n`);
    sections.push(`{{workflows/${scaffold.name}}}`);

    // Capability refs
    if (scaffold.tools.length > 0) {
      sections.push(`\n## Capabilities\n`);
      for (const t of scaffold.tools) {
        sections.push(`{{capabilities/${t.name}}}`);
      }
    }

    // Instruction refs
    if (scaffold.skills.length > 0) {
      sections.push(`\n## Instructions\n`);
      for (const s of scaffold.skills) {
        sections.push(`{{instructions/${s}}}`);
      }
    }

    // Memory refs
    if (scaffold.memory && scaffold.memory.length > 0) {
      sections.push(`\n## Memory\n`);
      for (const m of scaffold.memory) {
        sections.push(`{{memory/${m}}}`);
      }
    }

    return sections.join('\n');
  }

  /**
   * Generate workflow AGENTS.md content.
   */
  function generateWorkflowAgentsMd(scaffold) {
    const fm = toFrontmatter({
      type: 'workflow',
      name: scaffold.name,
      pattern: scaffold.pattern,
    });

    const sections = [fm, ''];
    sections.push(`## Nodes\n`);
    for (const node of scaffold.nodes) {
      const entryTag = node.entry ? ' (entry)' : '';
      sections.push(`- **${node.name}**${entryTag} — ${node.description}`);
    }

    sections.push(`\n## Edges\n`);
    for (const edge of scaffold.edges) {
      const cond = edge.condition ? ` [${edge.condition}]` : '';
      sections.push(`- ${edge.from} → ${edge.to}${cond}`);
    }

    return sections.join('\n');
  }

  /**
   * Generate a node's SKILL.md content.
   */
  function generateNodeSkillMd(node) {
    const fmObj = {
      name: node.name,
      type: node.nodeType,
      entry: node.entry,
      'context.max_tokens': 4096,
    };
    const fm = toFrontmatter(fmObj);

    const sections = [fm, ''];
    sections.push(`## Instructions\n`);
    sections.push(node.instructions);

    // Capability refs
    if (node.tools.length > 0) {
      sections.push(`\n## Capabilities\n`);
      for (const t of node.tools) {
        sections.push(`{{capabilities/${t}}}`);
      }
    }

    // Instruction refs
    if (node.skills.length > 0) {
      sections.push(`\n## Instructions\n`);
      for (const s of node.skills) {
        sections.push(`{{instructions/${s}}}`);
      }
    }

    return sections.join('\n');
  }

  return {
    /**
     * Validate a scaffold against all rules.
     * @param {object} scaffold
     * @returns {{ success: boolean, data?: object, error?: object }}
     */
    validateScaffold(scaffold) {
      const zodResult = AgentScaffoldSchema.safeParse(scaffold);
      if (!zodResult.success) {
        return fail(ErrorCode.SCAFFOLD_INVALID, 'Schema validation failed', 422, zodResult.error.issues);
      }

      const s = zodResult.data;
      const errors = [];

      const entryNodes = s.nodes.filter(n => n.entry);
      if (entryNodes.length !== 1) {
        errors.push(`Expected exactly 1 entry node, found ${entryNodes.length}`);
      }

      const nodeIds = new Set(s.nodes.map(n => n.id));
      for (const edge of s.edges) {
        if (!nodeIds.has(edge.from)) errors.push(`Edge references unknown node: ${edge.from}`);
        if (!nodeIds.has(edge.to)) errors.push(`Edge references unknown node: ${edge.to}`);
      }

      for (const node of s.nodes) {
        if (node.nodeType === 'router') {
          if (node.tools.length > 0) errors.push(`Router node "${node.id}" must have zero tools`);
          if (node.skills.length > 0) errors.push(`Router node "${node.id}" must have zero skills`);
        }
      }

      for (const tool of s.tools) {
        if (tool.source === 'mcp' && !tool.mcpServer) {
          errors.push(`MCP tool "${tool.name}" must have mcpServer field`);
        }
      }

      if (errors.length > 0) {
        return fail(ErrorCode.SCAFFOLD_INVALID, 'Scaffold validation failed', 422, errors);
      }

      return ok({ ...s, _validated: true });
    },

    /**
     * Generate a complete .agentflow/ workspace from a validated scaffold.
     * @param {object} scaffold — ValidatedScaffold
     * @param {string} targetDir — Absolute path for the workspace
     * @returns {Promise<{ success: boolean, data?: object, error?: object }>}
     */
    async generateWorkspace(scaffold, targetDir) {
      const agentflowDir = path.join(targetDir, '.agentflow');

      try {
        // Create directory structure
        fs.mkdirSync(agentflowDir, { recursive: true });

        // Root AGENTS.md
        const rootContent = generateRootAgentsMd(scaffold);
        atomicWrite(path.join(agentflowDir, 'AGENTS.md'), rootContent);

        // Workflow directory + AGENTS.md
        const wfDir = path.join(agentflowDir, scaffold.name);
        fs.mkdirSync(wfDir, { recursive: true });
        atomicWrite(path.join(wfDir, 'AGENTS.md'), generateWorkflowAgentsMd(scaffold));

        // Node directories + SKILL.md
        for (const node of scaffold.nodes) {
          const nodeDir = path.join(wfDir, node.id);
          fs.mkdirSync(nodeDir, { recursive: true });
          atomicWrite(path.join(nodeDir, 'SKILL.md'), generateNodeSkillMd(node));
        }

        // Copy library resources
        const libraryDir = path.resolve(targetDir, 'library');
        const categories = ['capabilities', 'instructions', 'runbooks', 'memory'];
        for (const cat of categories) {
          const srcDir = path.join(libraryDir, cat);
          const destDir = path.join(agentflowDir, cat);
          if (!fs.existsSync(srcDir)) continue;

          let itemsToCopy = [];
          if (cat === 'capabilities') itemsToCopy = scaffold.tools.filter(t => t.source === 'library').map(t => t.name);
          else if (cat === 'instructions') itemsToCopy = scaffold.skills;
          else if (cat === 'runbooks') itemsToCopy = scaffold.interactions || [];
          else if (cat === 'memory') itemsToCopy = scaffold.memory || [];

          if (itemsToCopy.length === 0) continue;
          fs.mkdirSync(destDir, { recursive: true });

          for (const name of itemsToCopy) {
            const srcFile = path.join(srcDir, `${name}.md`);
            if (fs.existsSync(srcFile)) {
              fs.copyFileSync(srcFile, path.join(destDir, `${name}.md`));
            }
          }
        }

        // Generate template files for conditional edges
        for (const edge of scaffold.edges) {
          if (edge.condition) {
            const runbooksDir = path.join(agentflowDir, 'runbooks');
            fs.mkdirSync(runbooksDir, { recursive: true });
            const templateFile = path.join(runbooksDir, `${edge.condition}.md`);
            if (!fs.existsSync(templateFile)) {
              atomicWrite(templateFile, `---\nname: ${edge.condition}\nscope: condition\ntype: condition\ncheck: ${edge.condition}\n---\n`);
            }
          }
        }

        // Roundtrip verification
        try {
          const { parseRoot } = require('../parser');
          const { createValidationService } = require('./validation-service');
          const graph = parseRoot(agentflowDir);
          const validationSvc = createValidationService({ rootDir: agentflowDir, logger });
          const validationResult = validationSvc.validate();

          if (!validationResult.success) {
            // Rollback
            fs.rmSync(agentflowDir, { recursive: true, force: true });
            return fail(ErrorCode.SCAFFOLD_INVALID, 'Roundtrip verification failed', 422, validationResult.error);
          }

          return ok(graph);
        } catch (err) {
          // Roundtrip parse failed — rollback
          fs.rmSync(agentflowDir, { recursive: true, force: true });
          return fail(ErrorCode.SCAFFOLD_INVALID, `Roundtrip verification error: ${err.message}`, 422);
        }
      } catch (err) {
        // Cleanup on any error
        try { fs.rmSync(agentflowDir, { recursive: true, force: true }); } catch { /* ignore */ }
        logger.error({ err }, 'ScaffoldGenService.generateWorkspace failed');
        return fail(ErrorCode.FS_WRITE_ERROR, err.message);
      }
    },
  };
}

module.exports = { createScaffoldGenService };
