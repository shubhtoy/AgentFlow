const fc = require('fast-check');
const { nameArb } = require('./refs.gen.js');

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Arbitrary for an optional string field. */
const optStringArb = fc.option(nameArb, { nil: undefined });

/** Arbitrary for an optional positive integer. */
const optIntArb = fc.option(fc.integer({ min: 1, max: 10000 }), { nil: undefined });

/** Arbitrary for an optional boolean. */
const optBoolArb = fc.option(fc.boolean(), { nil: undefined });

/** Arbitrary for a description string (slightly longer than name). */
const descriptionArb = fc
  .array(fc.stringMatching(/^[a-z]{2,8}$/), { minLength: 2, maxLength: 6 })
  .map((words) => words.join(' '));

/** Arbitrary for a tags array. */
const tagsArb = fc.array(nameArb, { minLength: 0, maxLength: 4 });

/** Arbitrary for a parameters object. */
const parametersArb = fc
  .array(
    fc.record({
      key: nameArb,
      type: fc.constantFrom('string', 'number', 'boolean', 'object'),
      description: fc.option(descriptionArb, { nil: undefined }),
      required: fc.option(fc.boolean(), { nil: undefined }),
    }),
    { minLength: 1, maxLength: 3 },
  )
  .map((params) => {
    const obj = {};
    for (const p of params) {
      const def = { type: p.type };
      if (p.description !== undefined) def.description = p.description;
      if (p.required !== undefined) def.required = p.required;
      obj[p.key] = def;
    }
    return obj;
  });

/** Strip undefined values from an object. */
function stripUndefined(obj) {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v;
  }
  return result;
}

// ─── TOOL generators ──────────────────────────────────────────────────────────

const TOOL_TYPES = ['builtin', 'script', 'mcp', 'package'];

/**
 * Valid tool frontmatter.
 * - `name` is always present (required).
 * - `type` determines which conditional fields are included.
 */
const validToolFmArb = fc
  .record({
    name: nameArb,
    toolType: fc.constantFrom(...TOOL_TYPES),
    command: nameArb,
    mcp: nameArb,
    package: nameArb,
    description: fc.option(descriptionArb, { nil: undefined }),
    builtin_mapping: fc.option(nameArb, { nil: undefined }),
    parameters: fc.option(parametersArb, { nil: undefined }),
  })
  .map(({ name, toolType, command, mcp, package: pkg, description, builtin_mapping, parameters }) => {
    const fm = { name };
    if (toolType !== 'builtin') fm.type = toolType;
    // else type defaults to builtin, can be omitted or explicit
    if (toolType === 'builtin') {
      // Randomly include or omit the explicit type field — both are valid
      fm.type = 'builtin';
    }
    if (toolType === 'script') fm.command = command;
    if (toolType === 'mcp') fm.mcp = mcp;
    if (toolType === 'package') fm.package = pkg;
    if (description !== undefined) fm.description = description;
    if (builtin_mapping !== undefined) fm.builtin_mapping = builtin_mapping;
    if (parameters !== undefined) fm.parameters = parameters;
    return {
      frontmatter: fm,
      resourceType: 'tool',
      isValid: true,
    };
  });

/**
 * Invalid tool frontmatter.
 * Produces one of several violation strategies.
 */
const invalidToolFmArb = fc
  .record({
    strategy: fc.constantFrom(
      'missing_name',
      'wrong_name_type',
      'invalid_tool_type',
      'script_missing_command',
      'mcp_missing_mcp',
      'package_missing_package',
      'wrong_command_type',
    ),
    name: nameArb,
    command: nameArb,
  })
  .map(({ strategy, name, command }) => {
    let fm;
    let violations;

    switch (strategy) {
      case 'missing_name':
        fm = { type: 'builtin' };
        violations = [{ field: 'name', reason: 'missing required field' }];
        break;
      case 'wrong_name_type':
        fm = { name: 42, type: 'builtin' };
        violations = [{ field: 'name', reason: 'wrong type: expected string' }];
        break;
      case 'invalid_tool_type':
        fm = { name, type: 'invalid-type' };
        violations = [{ field: 'type', reason: 'invalid enum value' }];
        break;
      case 'script_missing_command':
        fm = { name, type: 'script' };
        violations = [{ field: 'command', reason: 'missing required field for script type' }];
        break;
      case 'mcp_missing_mcp':
        fm = { name, type: 'mcp' };
        violations = [{ field: 'mcp', reason: 'missing required field for mcp type' }];
        break;
      case 'package_missing_package':
        fm = { name, type: 'package' };
        violations = [{ field: 'package', reason: 'missing required field for package type' }];
        break;
      case 'wrong_command_type':
        fm = { name, type: 'script', command: 123 };
        violations = [{ field: 'command', reason: 'wrong type: expected string' }];
        break;
    }

    return {
      frontmatter: fm,
      resourceType: 'tool',
      isValid: false,
      violations,
    };
  });

// ─── SKILL generators ─────────────────────────────────────────────────────────

/**
 * Valid skill frontmatter. All fields are optional.
 */
const validSkillFmArb = fc
  .record({
    name: fc.option(nameArb, { nil: undefined }),
    description: fc.option(descriptionArb, { nil: undefined }),
    domain: fc.option(nameArb, { nil: undefined }),
    max_tokens: fc.option(fc.integer({ min: 1, max: 100000 }), { nil: undefined }),
    tags: fc.option(tagsArb, { nil: undefined }),
  })
  .map((fields) => ({
    frontmatter: stripUndefined(fields),
    resourceType: 'skill',
    isValid: true,
  }));

/**
 * Invalid skill frontmatter.
 */
const invalidSkillFmArb = fc
  .constantFrom(
    'wrong_name_type',
    'wrong_max_tokens_type',
    'wrong_tags_type',
    'wrong_description_type',
  )
  .map((strategy) => {
    let fm;
    let violations;

    switch (strategy) {
      case 'wrong_name_type':
        fm = { name: 123 };
        violations = [{ field: 'name', reason: 'wrong type: expected string' }];
        break;
      case 'wrong_max_tokens_type':
        fm = { max_tokens: 'not-a-number' };
        violations = [{ field: 'max_tokens', reason: 'wrong type: expected integer' }];
        break;
      case 'wrong_tags_type':
        fm = { tags: 'not-an-array' };
        violations = [{ field: 'tags', reason: 'wrong type: expected array of strings' }];
        break;
      case 'wrong_description_type':
        fm = { description: true };
        violations = [{ field: 'description', reason: 'wrong type: expected string' }];
        break;
    }

    return {
      frontmatter: fm,
      resourceType: 'skill',
      isValid: false,
      violations,
    };
  });

// ─── TEMPLATE generators ─────────────────────────────────────────────────────

/**
 * Valid template frontmatter. `name` and `check` are required.
 */
const validTemplateFmArb = fc
  .record({
    name: nameArb,
    check: descriptionArb,
    type: fc.option(fc.constantFrom('condition', 'guard', 'filter'), { nil: undefined }),
  })
  .map(({ name, check, type }) => {
    const fm = { name, check };
    if (type !== undefined) fm.type = type;
    return {
      frontmatter: fm,
      resourceType: 'template',
      isValid: true,
    };
  });

/**
 * Invalid template frontmatter.
 */
const invalidTemplateFmArb = fc
  .record({
    strategy: fc.constantFrom(
      'missing_name',
      'missing_check',
      'missing_both',
      'wrong_name_type',
      'wrong_check_type',
    ),
    name: nameArb,
    check: descriptionArb,
  })
  .map(({ strategy, name, check }) => {
    let fm;
    let violations;

    switch (strategy) {
      case 'missing_name':
        fm = { check };
        violations = [{ field: 'name', reason: 'missing required field' }];
        break;
      case 'missing_check':
        fm = { name };
        violations = [{ field: 'check', reason: 'missing required field' }];
        break;
      case 'missing_both':
        fm = {};
        violations = [
          { field: 'name', reason: 'missing required field' },
          { field: 'check', reason: 'missing required field' },
        ];
        break;
      case 'wrong_name_type':
        fm = { name: 99, check };
        violations = [{ field: 'name', reason: 'wrong type: expected string' }];
        break;
      case 'wrong_check_type':
        fm = { name, check: false };
        violations = [{ field: 'check', reason: 'wrong type: expected string' }];
        break;
    }

    return {
      frontmatter: fm,
      resourceType: 'template',
      isValid: false,
      violations,
    };
  });

// ─── INTERACTION generators ───────────────────────────────────────────────────

const INTERACTION_TYPES = ['approval', 'freeform', 'choice', 'confirm'];

/**
 * Valid interaction frontmatter. `name` and `type` are required.
 */
const validInteractionFmArb = fc
  .record({
    name: nameArb,
    type: fc.constantFrom(...INTERACTION_TYPES),
    timeout: fc.option(fc.integer({ min: 1, max: 3600 }), { nil: undefined }),
  })
  .map(({ name, type, timeout }) => {
    const fm = { name, type };
    if (timeout !== undefined) fm.timeout = timeout;
    return {
      frontmatter: fm,
      resourceType: 'interaction',
      isValid: true,
    };
  });

/**
 * Invalid interaction frontmatter.
 */
const invalidInteractionFmArb = fc
  .record({
    strategy: fc.constantFrom(
      'missing_name',
      'missing_type',
      'missing_both',
      'invalid_type_enum',
      'wrong_name_type',
      'wrong_timeout_type',
    ),
    name: nameArb,
  })
  .map(({ strategy, name }) => {
    let fm;
    let violations;

    switch (strategy) {
      case 'missing_name':
        fm = { type: 'approval' };
        violations = [{ field: 'name', reason: 'missing required field' }];
        break;
      case 'missing_type':
        fm = { name };
        violations = [{ field: 'type', reason: 'missing required field' }];
        break;
      case 'missing_both':
        fm = {};
        violations = [
          { field: 'name', reason: 'missing required field' },
          { field: 'type', reason: 'missing required field' },
        ];
        break;
      case 'invalid_type_enum':
        fm = { name, type: 'invalid-interaction' };
        violations = [{ field: 'type', reason: 'invalid enum value' }];
        break;
      case 'wrong_name_type':
        fm = { name: 42, type: 'approval' };
        violations = [{ field: 'name', reason: 'wrong type: expected string' }];
        break;
      case 'wrong_timeout_type':
        fm = { name, type: 'confirm', timeout: 'slow' };
        violations = [{ field: 'timeout', reason: 'wrong type: expected integer' }];
        break;
    }

    return {
      frontmatter: fm,
      resourceType: 'interaction',
      isValid: false,
      violations,
    };
  });

// ─── MEMORY generators ───────────────────────────────────────────────────────

/**
 * Valid memory frontmatter. All fields are optional.
 */
const validMemoryFmArb = fc
  .record({
    name: fc.option(nameArb, { nil: undefined }),
    description: fc.option(descriptionArb, { nil: undefined }),
    editable: fc.option(fc.boolean(), { nil: undefined }),
  })
  .map((fields) => ({
    frontmatter: stripUndefined(fields),
    resourceType: 'memory',
    isValid: true,
  }));

/**
 * Invalid memory frontmatter.
 */
const invalidMemoryFmArb = fc
  .constantFrom(
    'wrong_name_type',
    'wrong_editable_type',
    'wrong_description_type',
  )
  .map((strategy) => {
    let fm;
    let violations;

    switch (strategy) {
      case 'wrong_name_type':
        fm = { name: [] };
        violations = [{ field: 'name', reason: 'wrong type: expected string' }];
        break;
      case 'wrong_editable_type':
        fm = { editable: 'yes' };
        violations = [{ field: 'editable', reason: 'wrong type: expected boolean' }];
        break;
      case 'wrong_description_type':
        fm = { description: 42 };
        violations = [{ field: 'description', reason: 'wrong type: expected string' }];
        break;
    }

    return {
      frontmatter: fm,
      resourceType: 'memory',
      isValid: false,
      violations,
    };
  });

// ─── NODE generators ──────────────────────────────────────────────────────────

const NODE_TYPES = ['step', 'router', 'sub-workflow'];

/**
 * Valid node frontmatter. All fields are optional.
 */
const validNodeFmArb = fc
  .record({
    name: fc.option(nameArb, { nil: undefined }),
    description: fc.option(descriptionArb, { nil: undefined }),
    type: fc.option(fc.constantFrom(...NODE_TYPES), { nil: undefined }),
    agent: fc.option(nameArb, { nil: undefined }),
    model: fc.option(nameArb, { nil: undefined }),
    entry: fc.option(fc.boolean(), { nil: undefined }),
    primary: fc.option(fc.boolean(), { nil: undefined }),
  })
  .map((fields) => ({
    frontmatter: stripUndefined(fields),
    resourceType: 'node',
    isValid: true,
  }));

/**
 * Invalid node frontmatter.
 */
const invalidNodeFmArb = fc
  .constantFrom(
    'invalid_type_enum',
    'wrong_name_type',
    'wrong_entry_type',
    'wrong_primary_type',
    'wrong_description_type',
  )
  .map((strategy) => {
    let fm;
    let violations;

    switch (strategy) {
      case 'invalid_type_enum':
        fm = { type: 'invalid-node-type' };
        violations = [{ field: 'type', reason: 'invalid enum value' }];
        break;
      case 'wrong_name_type':
        fm = { name: false };
        violations = [{ field: 'name', reason: 'wrong type: expected string' }];
        break;
      case 'wrong_entry_type':
        fm = { entry: 'yes' };
        violations = [{ field: 'entry', reason: 'wrong type: expected boolean' }];
        break;
      case 'wrong_primary_type':
        fm = { primary: 1 };
        violations = [{ field: 'primary', reason: 'wrong type: expected boolean' }];
        break;
      case 'wrong_description_type':
        fm = { description: 123 };
        violations = [{ field: 'description', reason: 'wrong type: expected string' }];
        break;
    }

    return {
      frontmatter: fm,
      resourceType: 'node',
      isValid: false,
      violations,
    };
  });

// ─── AGENTS DESCRIPTOR generators ────────────────────────────────────────────

/**
 * Valid agents descriptor frontmatter. `type: agents` is the identifier.
 */
const validAgentsFmArb = fc
  .record({
    name: fc.option(nameArb, { nil: undefined }),
    description: fc.option(descriptionArb, { nil: undefined }),
  })
  .map((fields) => {
    const fm = { type: 'agents' };
    if (fields.name !== undefined) fm.name = fields.name;
    if (fields.description !== undefined) fm.description = fields.description;
    return {
      frontmatter: fm,
      resourceType: 'agents',
      isValid: true,
    };
  });

/**
 * Invalid agents descriptor frontmatter.
 */
const invalidAgentsFmArb = fc
  .constantFrom(
    'missing_type',
    'wrong_type_value',
    'wrong_name_type',
    'wrong_description_type',
  )
  .map((strategy) => {
    let fm;
    let violations;

    switch (strategy) {
      case 'missing_type':
        fm = { name: 'my-workflow' };
        violations = [{ field: 'type', reason: 'missing required field' }];
        break;
      case 'wrong_type_value':
        fm = { type: 'not-agents' };
        violations = [{ field: 'type', reason: 'invalid enum value: must be "agents"' }];
        break;
      case 'wrong_name_type':
        fm = { type: 'agents', name: 42 };
        violations = [{ field: 'name', reason: 'wrong type: expected string' }];
        break;
      case 'wrong_description_type':
        fm = { type: 'agents', description: true };
        violations = [{ field: 'description', reason: 'wrong type: expected string' }];
        break;
    }

    return {
      frontmatter: fm,
      resourceType: 'agents',
      isValid: false,
      violations,
    };
  });

// ─── Combined generators ─────────────────────────────────────────────────────

/**
 * Any valid frontmatter across all resource types.
 */
const validFrontmatterArb = fc.oneof(
  validToolFmArb,
  validSkillFmArb,
  validTemplateFmArb,
  validInteractionFmArb,
  validMemoryFmArb,
  validNodeFmArb,
  validAgentsFmArb,
);

/**
 * Any invalid frontmatter across all resource types.
 */
const invalidFrontmatterArb = fc.oneof(
  invalidToolFmArb,
  invalidSkillFmArb,
  invalidTemplateFmArb,
  invalidInteractionFmArb,
  invalidMemoryFmArb,
  invalidNodeFmArb,
  invalidAgentsFmArb,
);

/**
 * Any frontmatter (valid or invalid) across all resource types.
 */
const anyFrontmatterArb = fc.oneof(validFrontmatterArb, invalidFrontmatterArb);

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Tool
  validToolFmArb,
  invalidToolFmArb,
  // Skill
  validSkillFmArb,
  invalidSkillFmArb,
  // Template
  validTemplateFmArb,
  invalidTemplateFmArb,
  // Interaction
  validInteractionFmArb,
  invalidInteractionFmArb,
  // Memory
  validMemoryFmArb,
  invalidMemoryFmArb,
  // Node
  validNodeFmArb,
  invalidNodeFmArb,
  // Agents descriptor
  validAgentsFmArb,
  invalidAgentsFmArb,
  // Combined
  validFrontmatterArb,
  invalidFrontmatterArb,
  anyFrontmatterArb,
  // Helpers (for composition in other generators)
  descriptionArb,
  tagsArb,
  parametersArb,
  stripUndefined,
  TOOL_TYPES,
  INTERACTION_TYPES,
  NODE_TYPES,
};
