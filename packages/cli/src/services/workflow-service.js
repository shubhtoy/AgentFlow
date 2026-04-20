'use strict';

const path = require('path');
const fs = require('fs');
const { ok, fail, ErrorCode } = require('@agentflow/core/services/types');
const { validatePath } = require('../svc-utils/validate-path');
const { atomicWrite } = require('../svc-utils/file-io');

/**
 * Create a WorkflowService bound to a service context.
 * @param {{ rootDir: string, logger: object, brandConfig: object }} ctx
 * @returns {object} WorkflowService
 */
function createWorkflowService(ctx) {
  const { rootDir, logger } = ctx;

  // Lazy-require parser to avoid circular deps at module load
  const getParser = () => require('../parser');

  /**
   * Build a TreeNode structure by walking the .agentflow/ directory.
   * Annotates nodes with resourceType, isPrimary, isNodeDir, isReservedDir.
   */
  function buildTree(dirPath, root) {
    const { classifyResource, identifyPrimaryFile } = getParser();
    const { isReservedDir, RESOURCE_TYPE_MAP } = require('@agentflow/core/taxonomy');
    const ARTIFACT = new Set(['output']);
    const name = path.basename(dirPath);
    const relPath = path.relative(root, dirPath);
    const node = { name, path: relPath || '.', type: 'directory', children: [] };

    const depth = relPath.split(path.sep).filter(Boolean).length;
    if (depth === 1 && isReservedDir(name)) {
      node.isReservedDir = true;
    }
    if (ARTIFACT.has(name)) {
      node.isArtifactDir = true;
    }

    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return node;
    }

    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    const mdFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.md'));
    const subdirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '_archive');

    const isNodeDir = mdFiles.length > 0 && !node.isReservedDir && !node.isArtifactDir && relPath !== '' && relPath !== '.';
    if (isNodeDir) {
      node.isNodeDir = true;
    }

    let parsedFiles = null;
    if (isNodeDir && mdFiles.length > 0) {
      try {
        parsedFiles = mdFiles.map((f) => {
          const fp = path.join(dirPath, f.name);
          const { parseMarkdownFile } = getParser();
          const parsed = parseMarkdownFile(fp, 'metadata-only');
          return { ...parsed, _basename: f.name };
        });
        const primary = identifyPrimaryFile(parsedFiles);
        if (primary) {
          primary._isPrimary = true;
        }
      } catch {
        parsedFiles = null;
      }
    }

    for (const sub of subdirs) {
      node.children.push(buildTree(path.join(dirPath, sub.name), root));
    }

    for (const f of mdFiles) {
      const filePath = path.join(dirPath, f.name);
      const fileRelPath = path.relative(root, filePath);
      const fileNode = { name: f.name, path: fileRelPath, type: 'file' };

      if (parsedFiles) {
        const parsed = parsedFiles.find((p) => p._basename === f.name);
        if (parsed) {
          const rt = classifyResource(parsed, dirPath);
          if (rt) fileNode.resourceType = rt;
          if (parsed._isPrimary) fileNode.isPrimary = true;
        }
      } else if (node.isReservedDir) {
        const rt = RESOURCE_TYPE_MAP[name];
        if (rt) fileNode.resourceType = rt;
      }

      node.children.push(fileNode);
    }

    const otherFiles = entries.filter((e) => e.isFile() && !e.name.endsWith('.md'));
    for (const f of otherFiles) {
      const fileRelPath = path.relative(root, path.join(dirPath, f.name));
      node.children.push({ name: f.name, path: fileRelPath, type: 'file' });
    }

    return node;
  }

  return {
    /**
     * GET /api/data — parse root and return full workflow graph.
     */
    getData() {
      try {
        const { parseRoot } = getParser();
        const data = parseRoot(rootDir);
        return ok(data);
      } catch (err) {
        logger.error({ err }, 'WorkflowService.getData failed');
        return fail(ErrorCode.UNKNOWN, err.message);
      }
    },

    /**
     * POST /api/save — validate paths, write files, re-parse.
     * @param {Array<{ path: string, content: string }>} edits
     */
    save(edits) {
      try {
        for (const edit of edits) {
          const check = validatePath(edit.path, rootDir);
          if (!check.valid) {
            return fail(ErrorCode.PATH_TRAVERSAL, `Invalid path: ${edit.path} — ${check.error}`, 400);
          }
          atomicWrite(check.resolved, edit.content);
        }
        const { parseRoot } = getParser();
        return ok(parseRoot(rootDir));
      } catch (err) {
        if (err && err.success === false) return err; // already a ServiceResult
        logger.error({ err }, 'WorkflowService.save failed');
        return fail(ErrorCode.FS_WRITE_ERROR, err.message);
      }
    },

    /**
     * POST /api/create — create a new file.
     * @param {string} filePath — relative path within rootDir
     * @param {string} content
     */
    create(filePath, content) {
      try {
        const check = validatePath(filePath, rootDir);
        if (!check.valid) {
          return fail(ErrorCode.PATH_TRAVERSAL, `Invalid path: ${filePath} — ${check.error}`, 400);
        }
        fs.mkdirSync(path.dirname(check.resolved), { recursive: true });
        atomicWrite(check.resolved, content || '');
        const { parseRoot } = getParser();
        return ok(parseRoot(rootDir));
      } catch (err) {
        if (err && err.success === false) return err;
        logger.error({ err }, 'WorkflowService.create failed');
        return fail(ErrorCode.FS_WRITE_ERROR, err.message);
      }
    },

    /**
     * POST /api/delete — delete a file or directory.
     * @param {string} filePath — relative path within rootDir
     */
    delete(filePath) {
      try {
        const check = validatePath(filePath, rootDir);
        if (!check.valid) {
          return fail(ErrorCode.PATH_TRAVERSAL, `Invalid path: ${filePath} — ${check.error}`, 400);
        }
        if (fs.existsSync(check.resolved)) {
          fs.rmSync(check.resolved, { recursive: true });
        }
        const { parseRoot } = getParser();
        return ok(parseRoot(rootDir));
      } catch (err) {
        if (err && err.success === false) return err;
        logger.error({ err }, 'WorkflowService.delete failed');
        return fail(ErrorCode.FS_WRITE_ERROR, err.message);
      }
    },

    /**
     * POST /api/move — rename/move a file or directory.
     * @param {string} from — relative path
     * @param {string} to — relative path
     */
    move(from, to) {
      try {
        const fromCheck = validatePath(from, rootDir);
        if (!fromCheck.valid) {
          return fail(ErrorCode.PATH_TRAVERSAL, `Invalid source path: ${from} — ${fromCheck.error}`, 400);
        }
        const toCheck = validatePath(to, rootDir);
        if (!toCheck.valid) {
          return fail(ErrorCode.PATH_TRAVERSAL, `Invalid destination path: ${to} — ${toCheck.error}`, 400);
        }
        if (!fs.existsSync(fromCheck.resolved)) {
          return fail(ErrorCode.FILE_NOT_FOUND, `Source not found: ${from}`, 404);
        }
        fs.mkdirSync(path.dirname(toCheck.resolved), { recursive: true });
        fs.renameSync(fromCheck.resolved, toCheck.resolved);
        return ok(buildTree(rootDir, rootDir));
      } catch (err) {
        if (err && err.success === false) return err;
        logger.error({ err }, 'WorkflowService.move failed');
        return fail(ErrorCode.FS_WRITE_ERROR, err.message);
      }
    },

    /**
     * GET /api/tree — return directory tree.
     */
    getTree() {
      try {
        return ok(buildTree(rootDir, rootDir));
      } catch (err) {
        logger.error({ err }, 'WorkflowService.getTree failed');
        return fail(ErrorCode.UNKNOWN, err.message);
      }
    },
  };
}

module.exports = { createWorkflowService };
