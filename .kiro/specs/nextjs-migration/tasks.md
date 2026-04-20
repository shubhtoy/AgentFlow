# Next.js Migration Tasks

## Phase 0: Cleanup (delete dead code first)
- [x] Delete `agentflow/src/copilotkit-server.js`
- [x] Delete `agentflow/src/routes/copilotkit-routes.js`
- [x] Delete `agentflow/src/services/agent-chat-service.js`
- [x] Delete `agentflow/src/services/agent-config-service.js`
- [x] Delete `ui/src/components/OrchestratorChat.tsx`
- [x] Delete `ui/src/components/chat/ChatMode.tsx`
- [x] Delete `ui/src/components/agent/` (StreamProvider, Thread, MessageInput, ToolCallCard, SetupForm)
- [x] Delete `ui/src/App.tsx`

## Phase 1: Scaffold Next.js app
- [x] Create `next-app/` with `package.json`
- [x] Create `next-app/next.config.ts`
- [x] Create `next-app/tsconfig.json`
- [x] Create `next-app/postcss.config.mjs`
- [x] Create `next-app/app/layout.tsx`
- [x] Create `next-app/app/globals.css`
- [x] Create `next-app/app/page.tsx`

## Phase 2: Move client-side code
- [x] Copy all components, store, hooks, utils, extensions, themes, lib
- [x] Create `next-app/components/Playground.tsx` with "use client"

## Phase 3: Move backend services
- [x] Copy services, branding, errors, schemas, parser, mcp

## Phase 5: CopilotKit integration
- [x] Create `next-app/app/api/copilotkit/route.ts`
- [x] Update CopilotProvider for V1 with Next.js

## Phase 2: Move client-side code
- [ ] Copy `ui/src/store.ts` → `next-app/lib/store.ts`
- [ ] Copy `ui/src/api.ts` → `next-app/lib/api.ts`
- [ ] Copy `ui/src/types.ts` → `next-app/lib/types.ts`
- [ ] Copy `ui/src/constants.ts` → `next-app/lib/constants.ts`
- [ ] Copy `ui/src/panelRegistry.ts` → `next-app/lib/panelRegistry.ts`
- [ ] Copy `ui/src/theme.ts` → `next-app/lib/theme.ts`
- [ ] Copy `ui/src/store/` → `next-app/lib/store/`
- [ ] Copy `ui/src/utils/` → `next-app/lib/utils/`
- [ ] Copy `ui/src/lib/` → `next-app/lib/`
- [ ] Copy `ui/src/hooks/` → `next-app/hooks/`
- [ ] Copy `ui/src/extensions/` → `next-app/extensions/`
- [ ] Copy `ui/src/themes/` → `next-app/themes/`
- [ ] Copy `ui/src/components/` → `next-app/components/` (add "use client" to all)
- [ ] Create `next-app/components/Playground.tsx` (from playground.tsx, add "use client")

## Phase 3: Move backend services
- [ ] Copy `agentflow/src/services/` → `next-app/lib/services/`
- [ ] Copy `agentflow/src/branding.js` → `next-app/lib/branding.js`
- [ ] Copy `agentflow/src/errors.js` → `next-app/lib/errors.js`
- [ ] Copy `agentflow/src/schemas/` → `next-app/lib/schemas/`
- [ ] Copy `agentflow/src/mcp/` → `next-app/lib/mcp/`
- [ ] Copy `agentflow/src/parser.js` → `next-app/lib/parser.js`
- [ ] Create `next-app/lib/service-context.ts` (singleton service layer, replaces Fastify createServiceLayer)

## Phase 4: Convert API routes (Fastify → Next.js)
- [ ] `GET /api/data` → `next-app/app/api/data/route.ts`
- [ ] `GET /api/tree` → `next-app/app/api/tree/route.ts`
- [ ] `POST /api/save` → `next-app/app/api/save/route.ts`
- [ ] `POST /api/create` → `next-app/app/api/create/route.ts`
- [ ] `POST /api/delete` → `next-app/app/api/delete/route.ts`
- [ ] `POST /api/move` → `next-app/app/api/move/route.ts`
- [ ] `GET /api/brand` → `next-app/app/api/brand/route.ts`
- [ ] `GET /api/validate` → `next-app/app/api/validate/route.ts`
- [ ] `GET /api/orchestrator/info` → `next-app/app/api/orchestrator/info/route.ts`
- [ ] `GET /api/orchestrator/context` → `next-app/app/api/orchestrator/context/route.ts`
- [ ] `POST /api/dry-run` → `next-app/app/api/dry-run/route.ts`
- [ ] `POST /api/tokens` → `next-app/app/api/tokens/route.ts`
- [ ] `POST /api/export` → `next-app/app/api/export/route.ts`
- [ ] `POST /api/import` → `next-app/app/api/import/route.ts`
- [ ] `GET /api/git/status` → `next-app/app/api/git/status/route.ts`
- [ ] `POST /api/git/init` → `next-app/app/api/git/init/route.ts`
- [ ] `POST /api/git/sync` → `next-app/app/api/git/sync/route.ts`
- [ ] `GET /api/git/scan` → `next-app/app/api/git/scan/route.ts`
- [ ] `GET /api/git/conflicts` → `next-app/app/api/git/conflicts/route.ts`
- [ ] `POST /api/git/resolve` → `next-app/app/api/git/resolve/route.ts`
- [ ] `GET /api/git/config` → `next-app/app/api/git/config/route.ts`
- [ ] `PUT /api/git/config` → `next-app/app/api/git/config/route.ts` (same file, PUT handler)
- [ ] `GET /api/git/auth-info` → `next-app/app/api/git/auth-info/route.ts`
- [ ] `POST /api/git/auth-setup` → `next-app/app/api/git/auth-setup/route.ts`
- [ ] `GET /api/library` → `next-app/app/api/library/route.ts`
- [ ] `POST /api/library/add` → `next-app/app/api/library/add/route.ts`
- [ ] `POST /api/builder/create` → `next-app/app/api/builder/create/route.ts`
- [ ] `GET /api/mcp/tools` → `next-app/app/api/mcp/tools/route.ts`
- [ ] `GET /api/mcp/config` → `next-app/app/api/mcp/config/route.ts`
- [ ] `POST /api/mcp/toggle` → `next-app/app/api/mcp/toggle/route.ts`
- [ ] `POST /api/mcp/remove` → `next-app/app/api/mcp/remove/route.ts`
- [ ] `GET /api/mcp/search` → `next-app/app/api/mcp/search/route.ts`
- [ ] `POST /api/mcp/add` → `next-app/app/api/mcp/add/route.ts`
- [ ] `POST /api/mcp/discover` → `next-app/app/api/mcp/discover/route.ts`
- [ ] `GET /api/config/mode` → `next-app/app/api/config/mode/route.ts`
- [ ] `GET /api/hook/*` → `next-app/app/api/hook/[...path]/route.ts`
- [ ] `GET /api/instruction/*` → `next-app/app/api/instruction/[...path]/route.ts`
- [ ] `GET /api/template/*` → `next-app/app/api/template/[...path]/route.ts`

## Phase 5: CopilotKit V2 integration
- [ ] `POST /api/copilotkit` → `next-app/app/api/copilotkit/route.ts` (LangGraph agent)
- [ ] Update `next-app/components/copilot/CopilotProvider.tsx` to use `CopilotKitProvider` from v2
- [ ] Update `next-app/components/copilot/CopilotActions.tsx` to use v2 hooks
- [ ] Update `next-app/components/copilot/CopilotReadables.tsx` to use v2 hooks

## Phase 6: Wire up & test
- [ ] Update root `package.json` scripts to use `next-app/`
- [ ] Update `src/cli.js` to point to `next-app/` instead of `ui/`
- [ ] Test all API routes work
- [ ] Test UI renders correctly
- [ ] Test CopilotKit chat works

## Phase 7: Cleanup
- [ ] Delete `ui/` directory
- [ ] Delete `agentflow/` directory (services moved to next-app/lib/)
- [ ] Update root `package.json` dependencies (merge ui deps)
- [ ] Final cleanup of dead imports
