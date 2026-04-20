import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Separator } from './ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import {
  Settings, Key, Cpu, Palette, Sun, Moon, Monitor,
  Check, Loader2, X, GitBranch, Sparkles, ExternalLink,
} from 'lucide-react'
import { useAppStore } from '@/store'
import { toast } from 'sonner'
import type { ThemeMode } from '@/lib/types'

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

interface KeyStatus { set: boolean; masked: string }

const API_KEYS = [
  { key: 'OPENROUTER_API_KEY', label: 'OpenRouter', hint: 'Unlocks all free models', url: 'https://openrouter.ai/keys', primary: true },
  { key: 'OPENAI_API_KEY', label: 'OpenAI', hint: 'GPT-4o, o3, o4-mini', url: 'https://platform.openai.com/api-keys' },
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic', hint: 'Claude Sonnet, Opus', url: 'https://console.anthropic.com/settings/keys' },
  { key: 'GOOGLE_API_KEY', label: 'Google', hint: 'Gemini 2.5 Pro/Flash', url: 'https://aistudio.google.com/apikey' },
  { key: 'MISTRAL_API_KEY', label: 'Mistral', hint: 'Mistral Large, Codestral', url: 'https://console.mistral.ai/api-keys' },
  { key: 'DEEPSEEK_API_KEY', label: 'DeepSeek', hint: 'DeepSeek Chat, R1', url: 'https://platform.deepseek.com/api_keys' },
  { key: 'XAI_API_KEY', label: 'xAI', hint: 'Grok 3', url: 'https://console.x.ai' },
  { key: 'TAVILY_API_KEY', label: 'Tavily', hint: 'Web search (1000 free/mo)', url: 'https://app.tavily.com/home' },
]

// localStorage keys for git
const LS_GIT_TOKEN = 'agentflow:gitToken'

export function SettingsDialogContent({ onClose }: { onClose?: () => void }) {
  const themeMode = useAppStore(s => s.themeMode)
  const setThemeMode = useAppStore(s => s.setThemeMode)
  const autoSave = useAppStore(s => s.autoSave)
  const toggleAutoSave = useAppStore(s => s.toggleAutoSave)

  const [keyStatus, setKeyStatus] = useState<Record<string, KeyStatus>>({})
  const [keyValues, setKeyValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [serverMode, setServerMode] = useState<'default' | 'multi-user'>('default')
  const [gitToken, setGitToken] = useState('')

  // Load key status + server mode on open
  useEffect(() => {
    if (!open) return
    setDirty(false)
    setKeyValues({})
    fetch('/api/copilot/keys').then(r => r.json()).then(d => setKeyStatus(d.keys || {})).catch(() => {})
    fetch('/api/config/mode').then(r => r.json()).then(d => setServerMode(d.mode === 'multi-user' ? 'multi-user' : 'default')).catch(() => {})
    setGitToken(localStorage.getItem(LS_GIT_TOKEN) || '')
  }, [open])

  const updateKey = (key: string, val: string) => {
    setKeyValues(prev => ({ ...prev, [key]: val }))
    setDirty(true)
  }

  const handleSave = useCallback(async () => {
    // Only send keys that were actually edited
    const toSave = Object.fromEntries(
      Object.entries(keyValues).filter(([, v]) => v !== undefined)
    )
    if (Object.keys(toSave).length === 0 && !dirty) { onClose(); return }

    setSaving(true)
    try {
      if (Object.keys(toSave).length > 0) {
        const res = await fetch('/api/copilot/keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSave),
        })
        if (!res.ok) throw new Error('Failed to save')
      }
      localStorage.setItem(LS_GIT_TOKEN, gitToken)
      toast.success('Settings saved')
      onClose()
    } catch {
      toast.error('Failed to save settings')
    }
    setSaving(false)
  }, [keyValues, dirty, gitToken, onClose])

  return (
    <div className="sm:max-w-md p-0 gap-0 overflow-hidden border rounded-lg bg-background">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Settings size={16} className="text-primary" />
          <span className="text-sm font-semibold flex-1">Settings</span>
          <Button variant="ghost" size="icon" className="size-7" onClick={onClose}><X size={14} /></Button>
        </div>

        <Tabs defaultValue="keys" className="flex-1">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-9 px-4">
            <TabsTrigger value="keys" className="text-xs gap-1 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Key size={12} /> API Keys
            </TabsTrigger>
            <TabsTrigger value="appearance" className="text-xs gap-1 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Palette size={12} /> Appearance
            </TabsTrigger>
            {serverMode === 'multi-user' && (
              <TabsTrigger value="git" className="text-xs gap-1 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <GitBranch size={12} /> Git
              </TabsTrigger>
            )}
          </TabsList>

          {/* API Keys tab */}
          <TabsContent value="keys" className="mt-0 max-h-[400px] overflow-y-auto">
            {/* OpenRouter callout */}
            <div className="mx-4 mt-3 mb-2 rounded-lg bg-primary/5 border border-primary/20 p-3">
              <div className="flex items-start gap-2">
                <Sparkles size={14} className="text-primary mt-0.5 shrink-0" />
                <div className="text-[0.7rem] space-y-1">
                  <p className="font-medium text-foreground">Just want free models?</p>
                  <p className="text-muted-foreground">Set an OpenRouter API key (free, no credit card) to unlock 24+ free models from Meta, Google, Qwen, Mistral and more.</p>
                </div>
              </div>
            </div>

            <div className="px-4 pb-3 space-y-2.5">
              {API_KEYS.map(({ key, label, hint, url, primary }) => {
                const status = keyStatus[key]
                const edited = key in keyValues
                const currentVal = edited ? keyValues[key] : ''
                const isSet = edited ? !!currentVal : status?.set

                return (
                  <div key={key} className={`space-y-1 ${primary ? 'pb-2.5 border-b border-border/40' : ''}`}>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-medium flex-1">{label}</Label>
                      {isSet && !edited && (
                        <span className="flex items-center gap-0.5 text-[0.6rem] text-emerald-500">
                          <Check size={10} /> {status?.masked}
                        </span>
                      )}
                      <a href={url} target="_blank" rel="noopener" className="text-muted-foreground hover:text-foreground">
                        <ExternalLink size={10} />
                      </a>
                    </div>
                    <Input
                      type="password"
                      value={currentVal}
                      onChange={e => updateKey(key, e.target.value)}
                      placeholder={status?.set ? '••• (already set, type to replace)' : `Paste ${label} key...`}
                      className="h-7 text-[0.65rem] font-mono"
                    />
                    <p className="text-[0.55rem] text-muted-foreground">{hint}</p>
                  </div>
                )
              })}
            </div>

            <div className="px-4 pb-3">
              <p className="text-[0.55rem] text-muted-foreground">
                Keys are saved to .env.local on the server. They never leave your machine.
              </p>
            </div>
          </TabsContent>

          {/* Appearance tab */}
          <TabsContent value="appearance" className="p-4 space-y-4 mt-0">
            <div className="space-y-2">
              <Label className="text-xs">Theme</Label>
              <div className="flex gap-2">
                {THEME_OPTIONS.map(t => (
                  <Button key={t.value} variant={themeMode === t.value ? 'default' : 'outline'} size="sm"
                    onClick={() => setThemeMode(t.value)} className="flex-1 text-xs gap-1.5">
                    <t.icon size={13} /> {t.label}
                  </Button>
                ))}
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Auto-Save</Label>
                <p className="text-[0.65rem] text-muted-foreground">Save changes automatically after editing</p>
              </div>
              <Button variant={autoSave ? 'default' : 'outline'} size="sm" className="text-xs"
                onClick={toggleAutoSave}>
                {autoSave ? 'On' : 'Off'}
              </Button>
            </div>
          </TabsContent>

          {/* Git tab */}
          {serverMode === 'multi-user' && (
            <TabsContent value="git" className="p-4 space-y-4 mt-0">
              <div className="space-y-2">
                <Label className="text-xs">Git Token</Label>
                <div className="relative">
                  <Key size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input type="password" value={gitToken} onChange={e => { setGitToken(e.target.value); setDirty(true) }}
                    placeholder="ghp_... or glpat-..." className="pl-8 h-8 text-xs font-mono" />
                </div>
                <p className="text-[10px] text-muted-foreground">Stored in browser only.</p>
              </div>
            </TabsContent>
          )}
        </Tabs>

        <div className="flex justify-end gap-2 px-4 py-3 border-t">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs">
            {saving ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
            Save
          </Button>
        </div>
    </div>
  )
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent hideClose className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <SettingsDialogContent onClose={onClose} />
      </DialogContent>
    </Dialog>
  )
}
