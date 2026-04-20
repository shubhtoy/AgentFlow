# Tasks — Protocol Layer

- [x] 1. Create protocol adapter base classes (`src/protocols/protocol-adapter.js`)
- [x] 2. Create MCPAdapter wrapping existing McpToolManager (`src/protocols/mcp-adapter.js`)
- [x] 3. Create stub adapters for A2A, ACP, ANP, AG-UI, A2UI, UCP, AP2 (`src/protocols/stubs/`)
- [x] 4. Create config schema with Zod validation (`src/protocols/config-schema.js`)
- [x] 5. Create ProtocolRegistry (`src/protocols/protocol-registry.js`)
- [x] 6. Create UnifiedToolProvider (`src/protocols/unified-tool-provider.js`)
- [x] 7. Create index re-exports (`src/protocols/index.js`)
- [x] 8. Add protocol API routes to server.js (`GET /api/protocols`, `POST /api/protocols/:name/toggle`, `GET /api/protocols/:name/health`)
- [x] 9. Create ProtocolPanel UI component (`ui/src/components/ProtocolPanel.tsx`)
