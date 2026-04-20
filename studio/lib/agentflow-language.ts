// Monaco custom language definition for AgentFlow markdown
// Extends markdown with {{ref}}, {{->ref}}, {{<<ref}}, {{$var}}, {{ref|cond}} and YAML frontmatter

const TEMPLATE_VARS: Record<string, string> = {
  $workflows: 'Replaced with the list of available workflows at export time',
  $resources: 'Replaced with the list of bundled resources at export time',
  $directory: 'Replaced with the directory structure guide at export time',
  $execution: 'Replaced with execution instructions at export time',
}

const REF_CATEGORIES = ['instructions', 'capabilities', 'runbooks', 'memory'] as const

let _registered = false
let _getRefNames: (() => string[]) | null = null

export function registerAgentFlowLanguage(
  monaco: any,
  getRefNames?: () => string[],
) {
  // Update the ref callback if provided
  if (getRefNames) _getRefNames = getRefNames

  // Register language only once
  if (_registered) return
  _registered = true

  monaco.languages.register({ id: 'agentflow', extensions: ['.md'], aliases: ['AgentFlow'] })

  // Tell Monaco that {{...}} is a single word so autocomplete filtering works
  monaco.languages.setLanguageConfiguration('agentflow', {
    wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)|\{\{[^}]*\}?\}?/,
  })

  monaco.languages.setMonarchTokensProvider('agentflow', {
    defaultToken: '',
    tokenPostfix: '.agentflow',

    // Shared helpers
    escapes: /\\(?:[\\`*_{}[\]()#+\-.!|])/,

    tokenizer: {
      root: [
        // YAML frontmatter (only at document start — Monarch processes line-by-line so we match --- at line start)
        [/^---\s*$/, 'agentflow-frontmatter', '@frontmatter'],

        // AgentFlow tokens — must come before general markdown so {{ is captured
        [/\{\{/, { token: '@rematch', next: '@agentflowToken' }],

        // Markdown: fenced code blocks
        [/^\s*```\s*(\w+)?\s*$/, { token: 'string', next: '@codeblock' }],

        // Markdown: headings
        [/^#{1,6}\s/, 'keyword'],

        // Markdown: horizontal rule
        [/^\s*([-*_])\s*\1\s*\1(\s*\1)*\s*$/, 'keyword'],

        // Markdown: blockquote
        [/^\s*>+/, 'comment'],

        // Markdown: list markers
        [/^\s*([-*+]|\d+\.)\s/, 'keyword'],

        // Markdown: bold + italic
        [/\*\*\*[^*]+\*\*\*/, 'strong'],
        [/\*\*[^*]+\*\*/, 'strong'],
        [/\*[^*]+\*/, 'emphasis'],
        [/_[^_]+_/, 'emphasis'],

        // Markdown: inline code
        [/`[^`]+`/, 'string'],

        // Markdown: links & images
        [/!?\[[^\]]*\]\([^)]*\)/, 'string.link'],
        [/!?\[[^\]]*\]\[[^\]]*\]/, 'string.link'],

        // Escape sequences
        [/@escapes/, 'string.escape'],
      ],

      // AgentFlow token sub-state: handles all {{...}} variants
      agentflowToken: [
        // {{$variable}}
        [/\{\{\$[\w]+\}\}/, { token: 'agentflow-template-var', next: '@pop' }],
        // {{->ref/name}}
        [/\{\{->/, { token: 'agentflow-ref-out', next: '@refOutBody' }],
        // {{<<ref/name}}
        [/\{\{<</, { token: 'agentflow-ref-in', next: '@refInBody' }],
        // {{ref/name|condition}} or {{ref/name}}
        [/\{\{/, { token: 'agentflow-ref', next: '@refBody' }],
      ],

      refBody: [
        [/[^}|]+/, 'agentflow-ref'],
        [/\|/, { token: 'agentflow-condition', next: '@refCondition' }],
        [/\}\}/, { token: 'agentflow-ref', next: '@popall' }],
      ],

      refCondition: [
        [/[^}]+/, 'agentflow-condition'],
        [/\}\}/, { token: 'agentflow-ref', next: '@popall' }],
      ],

      refOutBody: [
        [/[^}|]+/, 'agentflow-ref-out'],
        [/\|/, { token: 'agentflow-condition', next: '@refCondition' }],
        [/\}\}/, { token: 'agentflow-ref-out', next: '@popall' }],
      ],

      refInBody: [
        [/[^}|]+/, 'agentflow-ref-in'],
        [/\|/, { token: 'agentflow-condition', next: '@refCondition' }],
        [/\}\}/, { token: 'agentflow-ref-in', next: '@popall' }],
      ],

      frontmatter: [
        [/^---\s*$/, 'agentflow-frontmatter', '@pop'],
        [/.*/, 'agentflow-frontmatter'],
      ],

      codeblock: [
        [/^\s*```\s*$/, { token: 'string', next: '@pop' }],
        [/.*/, 'string'],
      ],
    },
  } as any)

  // ── Completion provider ──────────────────────────────────────────────

  monaco.languages.registerCompletionItemProvider('agentflow', {
    triggerCharacters: ['{'],

    provideCompletionItems(model: any, position: any) {
      const line = model.getLineContent(position.lineNumber)
      const textBefore = line.substring(0, position.column - 1)

      const lastOpen = textBefore.lastIndexOf('{{')
      if (lastOpen === -1) return { suggestions: [] }

      const afterOpen = textBefore.substring(lastOpen)
      if (afterOpen.includes('}}')) return { suggestions: [] }

      const typed = afterOpen.substring(2) // what user typed after {{

      // Replace range: from {{ to cursor (inclusive of the braces)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: lastOpen + 1, // include {{
        endColumn: position.column,
      }

      const CompletionItemKind = monaco.languages.CompletionItemKind
      const suggestions: any[] = []

      for (const [varName, desc] of Object.entries(TEMPLATE_VARS)) {
        suggestions.push({
          label: '{{' + varName + '}}',
          kind: CompletionItemKind.Variable,
          insertText: '{{' + varName + '}}',
          detail: 'Template variable',
          documentation: desc,
          range,
          sortText: '0' + varName,
        })
      }

      const refs = _getRefNames?.() ?? []
      for (const ref of refs) {
        suggestions.push({
          label: '{{' + ref + '}}',
          kind: CompletionItemKind.Reference,
          insertText: '{{' + ref + '}}',
          detail: ref.split('/')[0],
          range,
          sortText: '1' + ref,
        })
      }

      return { suggestions, incomplete: true }
    },
  })

  // ── Hover provider ───────────────────────────────────────────────────

  monaco.languages.registerHoverProvider('agentflow', {
    provideHover(model: any, position: any) {
      const line = model.getLineContent(position.lineNumber)
      const re = /\{\{([^}]+)\}\}/g
      let match: RegExpExecArray | null

      while ((match = re.exec(line)) !== null) {
        const start = match.index + 1 // 1-based
        const end = start + match[0].length
        if (position.column >= start && position.column <= end) {
          const inner = match[1].trim()
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: match.index + 1,
            endColumn: match.index + 1 + match[0].length,
          }

          // Template variable
          if (inner.startsWith('$')) {
            const desc = TEMPLATE_VARS[inner] ?? 'Dynamic value resolved at export time'
            return { range, contents: [{ value: `**Template variable** \`${inner}\`\n\n${desc}` }] }
          }

          // Directional refs
          let prefix = ''
          let refPath = inner
          if (inner.startsWith('->')) { prefix = '→ Outgoing ref: '; refPath = inner.slice(2).trim() }
          else if (inner.startsWith('<<')) { prefix = '⇠ Incoming ref: '; refPath = inner.slice(2).trim() }

          // Conditional
          const pipeIdx = refPath.indexOf('|')
          let condition = ''
          if (pipeIdx !== -1) { condition = refPath.slice(pipeIdx + 1).trim(); refPath = refPath.slice(0, pipeIdx).trim() }

          let value = `**${prefix || 'Reference: '}**\`${refPath}\``
          if (condition) value += `\n\nCondition: \`${condition}\``

          return { range, contents: [{ value }] }
        }
      }

      return null
    },
  })
}
