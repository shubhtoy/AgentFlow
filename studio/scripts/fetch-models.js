#!/usr/bin/env node
/**
 * Fetch models from OpenRouter API → write lib/copilot/models.json
 *
 * Filters using API metadata only — no hardcoded model lists.
 * Criteria:
 *   - Major providers only (by provider slug)
 *   - Must support text input + text output
 *   - Not expired
 *   - Skip embedding-only, image-gen-only, audio-only models
 *   - Skip tiny context (<4k) models
 *   - Deduplicate: if a model has both paid + free variant, keep both
 *
 * Usage: npm run fetch-models
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

// ── Major providers we care about ──

const PROVIDERS = {
  openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google',
  groq: 'Groq',
  'meta-llama': 'Meta', mistralai: 'Mistral', deepseek: 'DeepSeek',
  qwen: 'Qwen', 'x-ai': 'xAI', nvidia: 'NVIDIA', nousresearch: 'Nous',
  microsoft: 'Microsoft', liquid: 'Liquid', arcee_ai: 'Arcee',
  stepfun: 'StepFun', minimax: 'MiniMax',
}
// Also match slug variants from OpenRouter
const SLUG_ALIASES = { 'arcee-ai': 'arcee_ai' }
const KNOWN = new Set([...Object.keys(PROVIDERS), ...Object.keys(SLUG_ALIASES)])

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'agentflow' } }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
        catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

function computeTags(m) {
  const tags = []
  if (m.free) tags.push('free')
  const ctx = m.contextLength || 0
  if (ctx >= 1_000_000) tags.push('1M')
  else if (ctx >= 200_000) tags.push('200k+')
  else if (ctx >= 128_000) tags.push('128k')
  else if (ctx >= 32_000) tags.push('32k')
  if (m.modality && m.modality.includes('image')) tags.push('vision')
  if (m.supportsTool) tags.push('tools')
  const id = (m.id || '').toLowerCase()
  if (id.includes('reason') || /\bo[34]/.test(id) || id.includes('-r1')) tags.push('reasoning')
  if (id.includes('flash') || id.includes('mini') || id.includes('nano') || id.includes('lite')) tags.push('fast')
  if (id.includes('coder') || id.includes('code')) tags.push('code')
  return tags
}

function parse(m) {
  const rawProvider = m.id.split('/')[0]
  const provider = SLUG_ALIASES[rawProvider] || rawProvider
  const isFree = m.pricing && m.pricing.prompt === '0' && m.pricing.completion === '0'
  const def = {
    id: m.id,
    label: (m.name || m.id).replace(/\s*\(free\)\s*/gi, ''),
    provider,
    providerName: PROVIDERS[provider] || provider,
    description: (m.description || '').split('\n')[0].slice(0, 160) || undefined,
    contextLength: m.context_length || undefined,
    maxCompletionTokens: m.top_provider?.max_completion_tokens || undefined,
    modality: m.architecture?.modality || undefined,
    supportsTool: (m.supported_parameters || []).includes('tools'),
    pricing: m.pricing ? { prompt: m.pricing.prompt || '0', completion: m.pricing.completion || '0' } : undefined,
    free: isFree || false,
    knowledgeCutoff: m.knowledge_cutoff || undefined,
  }
  def.tags = computeTags(def)
  return def
}

// ── Metadata-based filtering ──

function shouldKeep(m) {
  const provider = m.id.split('/')[0]
  const resolvedProvider = SLUG_ALIASES[provider] || provider
  if (!KNOWN.has(resolvedProvider) && !KNOWN.has(provider)) return false

  // Not expired
  if (m.expiration_date && new Date(m.expiration_date) < new Date()) return false

  // Must accept text input
  const inMods = m.architecture?.input_modalities || []
  if (!inMods.includes('text')) return false

  // Must produce text output
  const outMods = m.architecture?.output_modalities || []
  if (!outMods.includes('text')) return false

  // Skip image-only output (image generators)
  if (outMods.length === 1 && outMods[0] === 'image') return false

  // Skip tiny context
  if (m.context_length && m.context_length < 4096) return false

  // Skip models with only audio output
  if (outMods.length === 1 && outMods[0] === 'audio') return false

  return true
}

// ── Sort: provider order, then by context length desc, free after paid ──

function sortModels(models) {
  const provOrder = Object.keys(PROVIDERS)
  return models.sort((a, b) => {
    // Provider order
    const ai = provOrder.indexOf(a.provider)
    const bi = provOrder.indexOf(b.provider)
    if (ai !== bi) return ai - bi
    // Paid before free within same provider
    if (a.free !== b.free) return a.free ? 1 : -1
    // Larger context first
    return (b.contextLength || 0) - (a.contextLength || 0)
  })
}

async function main() {
  console.log('Fetching from OpenRouter...')
  const data = await get('https://openrouter.ai/api/v1/models')
  const raw = data.data || []
  console.log(`  Total on OpenRouter: ${raw.length}`)

  const kept = sortModels(raw.filter(shouldKeep).map(parse))
  const free = kept.filter(m => m.free)
  const paid = kept.filter(m => !m.free)

  console.log(`  Kept: ${kept.length} (${paid.length} paid, ${free.length} free)`)
  for (const [p, name] of Object.entries(PROVIDERS)) {
    const ms = kept.filter(m => m.provider === p)
    if (!ms.length) continue
    const f = ms.filter(m => m.free).length
    console.log(`    ${name}: ${ms.length - f} paid, ${f} free`)
  }

  // Collect all unique tags
  const allTags = new Set()
  for (const m of kept) (m.tags || []).forEach(t => allTags.add(t))

  const output = {
    _generated: new Date().toISOString(),
    _source: 'https://openrouter.ai/api/v1/models',
    _total: kept.length,
    _free: free.length,
    _paid: paid.length,
    providers: Object.fromEntries(
      Object.keys(PROVIDERS).filter(k => kept.some(m => m.provider === k)).map(k => [k, PROVIDERS[k]])
    ),
    tags: [...allTags].sort(),
    models: kept,
  }

  const outPath = path.join(__dirname, '..', 'lib', 'copilot', 'models.json')
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2))
  console.log(`\nWrote ${outPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
