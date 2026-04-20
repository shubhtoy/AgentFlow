'use strict';

const { z } = require('zod');

const ExportRuleSchema = z.object({
  source: z.string(),
  target: z.string().nullable(),
  type: z.enum(['single-file', 'glob-copy', 'glob-transform', 'merge-into', 'passthrough', 'skip']),
  fidelity: z.enum(['native', 'on-demand', 'translated', 'preserved', 'direct', 'transform', 'lossy', 'skip']),
  note: z.string().optional(),
  transform: z.string().optional(),
  exclude: z.array(z.string()).optional(),
  mergeTarget: z.string().optional(),
  contextMode: z.enum(['always-loaded', 'on-demand']).optional(),
  sourceFilter: z.record(z.string()).optional(),
});

// v1 backward compat alias
const MappingRuleSchema = ExportRuleSchema;

const ImportRuleSchema = z.object({
  platformPath: z.string(),
  agentflowTarget: z.string(),
  type: z.enum(['single-file', 'glob-transform', 'extract-from', 'passthrough']),
  fidelity: z.enum(['native', 'on-demand', 'translated', 'preserved', 'direct', 'transform', 'lossy', 'skip']),
  reverseTransform: z.string().optional(),
  note: z.string().optional(),
});

const PlatformConfigSchema = z.object({
  name: z.string().min(1),
  displayName: z.string(),
  version: z.string().default('1.0.0'),
  tier: z.enum(['ide', 'runtime']).optional(),
  capabilities: z.array(z.enum(['export', 'import'])),
  memoryHandling: z.enum(['prefer-native', 'supplementary', 'none']).optional(),
  detectMarkers: z.array(z.string()).optional(),
  exportRules: z.array(ExportRuleSchema),
  importRules: z.array(z.union([ImportRuleSchema, MappingRuleSchema])).optional(),
});

// v1 backward compat alias
const PlatformMappingConfigSchema = PlatformConfigSchema;

module.exports = { ExportRuleSchema, ImportRuleSchema, PlatformConfigSchema, MappingRuleSchema, PlatformMappingConfigSchema };
