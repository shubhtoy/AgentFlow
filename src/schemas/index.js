'use strict';

const { z } = require('zod');

/** POST /api/save — array of { path, content } edits */
const saveSchema = z.object({
  edits: z.array(z.object({
    path: z.string().min(1),
    content: z.string(),
  })).min(1),
});

/** POST /api/create — single file creation */
const createSchema = z.object({
  path: z.string().min(1),
  content: z.string().default(''),
});

/** POST /api/delete — single file/dir deletion */
const deleteSchema = z.object({
  path: z.string().min(1),
});

/** POST /api/move — rename/move a file or directory */
const moveSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

/** POST /api/export — export a workflow */
const exportSchema = z.object({
  workflow: z.string().optional(),
  format: z.enum(['raw', 'parsed', 'platform']).optional(),
  preview: z.boolean().optional(),
});

/** POST /api/orchestrator/chat — LLM chat */
const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).min(1),
  provider: z.enum(['anthropic', 'openai']).optional(),
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
  apiKey: z.string().optional(),
});

/** POST /api/library/add — add from library */
const libraryAddSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1),
});

/** GET /api/validate — query params */
const validateQuerySchema = z.object({
  strict: z.enum(['true', 'false']).optional(),
});

// Builder schemas — only AgentScaffoldSchema needed for /api/builder/create
const { AgentScaffoldSchema } = require('./builder-schemas');

/** POST /api/builder/create — scaffold generation request */
const builderCreateSchema = z.object({
  scaffold: z.any(),
  targetDir: z.string().optional(),
});

module.exports = {
  saveSchema,
  createSchema,
  deleteSchema,
  moveSchema,
  exportSchema,
  chatSchema,
  libraryAddSchema,
  validateQuerySchema,
  // Builder schemas
  AgentScaffoldSchema,
  builderCreateSchema,
};
