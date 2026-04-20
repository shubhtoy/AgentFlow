/**
 * Model Registry — reads from models.json, resolves to AI SDK model instances.
 *
 * All providers use OpenAI-compatible API via @ai-sdk/openai with custom baseURL:
 *   - openai, anthropic, google: native AI SDK adapters
 *   - deepseek, x-ai, mistral: OpenAI-compatible via createOpenAI({ baseURL })
 *   - :free models: routed through OpenRouter (OpenAI-compatible)
 *
 * No dynamic imports. No initChatModel. No LangChain dependency for model creation.
 */

import catalog from './models.json'
import { resolveKey } from './key-store'

// ── Types ──

export interface ModelDef {
  id: string
  label: string
  provider: string
  providerName: string
  description?: string
  contextLength?: number
  maxCompletionTokens?: number
  modality?: string
  supportsTool?: boolean
  pricing?: { prompt: string; completion: string }
  free?: boolean
  tags?: string[]
  knowledgeCutoff?: string
}

export type ModelFilter = {
  provider?: string
  free?: boolean
  tag?: string
  search?: string
  supportsTool?: boolean
}

// ── Catalog ──

const ALL_MODELS: ModelDef[] = catalog.models as ModelDef[]
const PROVIDERS: Record<string, string> = catalog.providers

export function getAllModels(): ModelDef[] { return ALL_MODELS }
export function getProviders(): Record<string, string> { return PROVIDERS }
export function getProviderName(key: string): string { return PROVIDERS[key] || key }


// ── Filtering ──

export function filterModels(f: ModelFilter): ModelDef[] {
  return ALL_MODELS.filter(m => {
    if (f.provider && m.provider !== f.provider) return false
    if (f.free !== undefined && m.free !== f.free) return false
    if (f.tag && !(m.tags || []).includes(f.tag)) return false
    if (f.supportsTool !== undefined && m.supportsTool !== f.supportsTool) return false
    if (f.search) {
      const q = f.search.toLowerCase()
      if (!m.label.toLowerCase().includes(q) && !m.id.toLowerCase().includes(q)) return false
    }
    return true
  })
}

// ── Selection persistence ──

let _selectedModel = 'auto'

export function getSelectedModel(): string { return _selectedModel }
export function setSelectedModel(id: string) { _selectedModel = id }

// ── Provider availability ──

const PROVIDER_KEY_MAP: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  'x-ai': 'XAI_API_KEY',
  mistralai: 'MISTRAL_API_KEY',
}

export function getAvailableProviders(sessionId?: string): string[] {
  const available: string[] = []
  for (const [provider, envKey] of Object.entries(PROVIDER_KEY_MAP)) {
    if (resolveKey(envKey, sessionId)) available.push(provider)
  }
  if (resolveKey('OPENROUTER_API_KEY', sessionId)) available.push('openrouter')
  return available
}

// ── Model resolution ──

const AUTO_PRIORITY = ['openai/gpt-4o', 'anthropic/claude-sonnet-4', 'google/gemini-2.5-flash']

export function resolveModel(sessionId?: string): string {
  const selected = getSelectedModel()
  if (selected !== 'auto') return selected
  for (const id of AUTO_PRIORITY) {
    const provider = id.split('/')[0]
    const envKey = PROVIDER_KEY_MAP[provider]
    if (envKey && resolveKey(envKey, sessionId)) return id
  }
  if (resolveKey('OPENROUTER_API_KEY', sessionId)) return 'google/gemini-2.5-flash:free'
  return AUTO_PRIORITY[0]
}

// ── Chat model creation (LangChain initChatModel) ──

let _initChatModel: Function | null = null

export async function createChatModel(modelId: string, opts: { temperature?: number; sessionId?: string } = {}) {
  if (!_initChatModel) {
    _initChatModel = (await import('langchain/chat_models/universal')).initChatModel
  }

  const [provider, ...rest] = modelId.split('/')
  const modelName = rest.join('/')
  const isFree = modelId.endsWith(':free')
  const temperature = opts.temperature ?? 0.3

  // Free models go through OpenRouter (OpenAI-compatible)
  if (isFree) {
    return _initChatModel(modelId, {
      modelProvider: 'openai',
      temperature,
      apiKey: resolveKey('OPENROUTER_API_KEY', opts.sessionId) || '',
      configuration: { baseURL: 'https://openrouter.ai/api/v1' },
    })
  }

  const providerConfig: Record<string, { modelProvider: string; envKey: string; baseURL?: string }> = {
    openai:    { modelProvider: 'openai',    envKey: 'OPENAI_API_KEY' },
    anthropic: { modelProvider: 'anthropic', envKey: 'ANTHROPIC_API_KEY' },
    google:    { modelProvider: 'google-genai', envKey: 'GOOGLE_API_KEY' },
    deepseek:  { modelProvider: 'openai',    envKey: 'DEEPSEEK_API_KEY', baseURL: 'https://api.deepseek.com/v1' },
    'x-ai':    { modelProvider: 'openai',    envKey: 'XAI_API_KEY',      baseURL: 'https://api.x.ai/v1' },
    mistralai: { modelProvider: 'openai',    envKey: 'MISTRAL_API_KEY',  baseURL: 'https://api.mistral.ai/v1' },
  }

  const cfg = providerConfig[provider]
  if (!cfg) {
    // Fallback: try OpenRouter
    return _initChatModel(modelId, {
      modelProvider: 'openai',
      temperature,
      apiKey: resolveKey('OPENROUTER_API_KEY', opts.sessionId) || '',
      configuration: { baseURL: 'https://openrouter.ai/api/v1' },
    })
  }

  const initOpts: Record<string, any> = {
    modelProvider: cfg.modelProvider,
    temperature,
    apiKey: resolveKey(cfg.envKey, opts.sessionId) || '',
  }
  if (cfg.baseURL) {
    initOpts.configuration = { baseURL: cfg.baseURL }
  }

  return _initChatModel(modelName, initOpts)
}
