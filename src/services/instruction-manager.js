'use strict';

const path = require('path');
const fs = require('fs');
const matter = require('gray-matter');

/**
 * Create an InstructionManager bound to a service context.
 * Manages instruction documents from `instructions/` dir under rootDir.
 * @param {{ rootDir: string, logger: object }} ctx
 * @returns {object} InstructionManager
 */
function createInstructionManager(ctx) {
  const { rootDir, logger } = ctx;
  const instructionsDir = path.join(rootDir, 'instructions');

  /** @type {Map<string, { name: string, inclusion: string, description: string, tags: string[], content: string }>} */
  let cache = new Map();

  /**
   * Parse a single instruction .md file into an InstructionDoc.
   */
  function parseFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    let frontmatter = {};
    let body = raw;
    try {
      const parsed = matter(raw);
      frontmatter = parsed.data || {};
      body = parsed.content;
    } catch (err) {
      logger.error({ err }, `Invalid frontmatter in ${filePath}`);
    }
    return {
      name: path.basename(filePath, '.md'),
      inclusion: frontmatter.inclusion || 'manual',
      description: frontmatter.description || '',
      tags: frontmatter.tags || [],
      content: body,
    };
  }

  return {
    /**
     * Load all instruction docs from disk, parse frontmatter, cache results.
     */
    loadAll() {
      cache.clear();
      if (!fs.existsSync(instructionsDir)) return;
      const files = fs.readdirSync(instructionsDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const doc = parseFile(path.join(instructionsDir, file));
        cache.set(doc.name, doc);
      }
    },

    /**
     * Get instruction context string for LLM injection.
     * @param {string[]|null} requestedNames — null = auto-only; array = auto + named
     * @returns {string}
     */
    getInstructionContext(requestedNames) {
      const docs = [];
      for (const doc of cache.values()) {
        const isAuto = doc.inclusion === 'auto';
        const isRequested = Array.isArray(requestedNames) && requestedNames.includes(doc.name);
        if (isAuto || isRequested) {
          docs.push(doc);
        }
      }
      return docs
        .map(d => `<instruction name="${d.name}">\n${d.content}\n</instruction>`)
        .join('\n\n');
    },

    /**
     * List all instruction docs with metadata.
     * @returns {Array<{ name: string, inclusion: string, description: string, tags: string[] }>}
     */
    list() {
      return Array.from(cache.values()).map(({ name, inclusion, description, tags }) => ({
        name, inclusion, description, tags,
      }));
    },

    /**
     * Add a new instruction doc.
     * @param {string} name — filename stem
     * @param {string} content — markdown body
     * @param {{ inclusion?: string, description?: string, tags?: string[] }} [options]
     */
    add(name, content, options = {}) {
      const fm = {
        inclusion: options.inclusion || 'manual',
        ...(options.description && { description: options.description }),
        ...(options.tags && options.tags.length > 0 && { tags: options.tags }),
      };
      const fileContent = matter.stringify(content, fm);
      fs.mkdirSync(instructionsDir, { recursive: true });
      fs.writeFileSync(path.join(instructionsDir, `${name}.md`), fileContent, 'utf8');
      // Update cache
      cache.set(name, {
        name,
        inclusion: fm.inclusion,
        description: fm.description || '',
        tags: fm.tags || [],
        content,
      });
    },

    /**
     * Remove an instruction doc.
     * @param {string} name — filename stem
     */
    remove(name) {
      const filePath = path.join(instructionsDir, `${name}.md`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      cache.delete(name);
    },
  };
}

module.exports = { createInstructionManager };
