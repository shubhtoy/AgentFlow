'use strict';

const { createWorkflowService } = require('./workflow-service');
const { createValidationService } = require('./validation-service');
const { createTemplateService } = require('./template-service');
const { createOrchestratorService } = require('./orchestrator-service');
const { createGitService } = require('./git-service');
const { createMCPBridge } = require('./mcp-bridge');
const { createAgentConfigService } = require('./agent-config-service');
const { createAgentChatService } = require('./agent-chat-service');
const { createExportService } = require('./export-service');
const { createImportService } = require('./import-service');

/**
 * Create the full service layer with shared context.
 * @param {{ rootDir: string, logger: object, brandConfig: object }} ctx
 */
function createServiceLayer(ctx) {
  const mcpBridge = createMCPBridge(ctx);
  const agentConfig = createAgentConfigService(ctx);
  const agentChat = createAgentChatService({ ...ctx, mcpBridge });

  return {
    workflow: createWorkflowService(ctx),
    validation: createValidationService(ctx),
    template: createTemplateService(ctx),
    orchestrator: createOrchestratorService(ctx),
    git: createGitService(ctx),
    mcpBridge,
    agentConfig,
    agentChat,
    exportSvc: createExportService(ctx),
    importSvc: createImportService(ctx),
  };
}

module.exports = { createServiceLayer };
