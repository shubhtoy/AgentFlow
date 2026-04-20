import { registerAgentFlowLanguage } from './agentflow-language'

export function registerAgentFlowTheme(monaco: any, getRefNames?: () => string[]) {
  monaco.editor.defineTheme("agentflow-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "71717a", fontStyle: "italic" },
      { token: "keyword", foreground: "a78bfa" },
      { token: "string", foreground: "22c55e" },
      { token: "number", foreground: "f59e0b" },
      { token: "type", foreground: "3b82f6" },
      { token: "agentflow-ref", foreground: "3b82f6", fontStyle: "bold" },
      { token: "agentflow-ref-out", foreground: "2dd4bf" },
      { token: "agentflow-ref-in", foreground: "f97316" },
      { token: "agentflow-template-var", foreground: "a78bfa" },
      { token: "agentflow-condition", foreground: "60a5fa" },
      { token: "agentflow-frontmatter", foreground: "71717a", fontStyle: "italic" },
      { token: "agentflow-frontmatter-key", foreground: "a78bfa" },
      { token: "agentflow-frontmatter-value", foreground: "22c55e" },
    ],
    colors: {
      "editor.background": "#18181b",
      "editor.foreground": "#e4e4e7",
      "editor.lineHighlightBackground": "#27272a50",
      "editor.selectionBackground": "#3b82f640",
      "editorCursor.foreground": "#3b82f6",
      "editorWidget.background": "#1c1c20",
      "editorWidget.border": "#3f3f46",
      "input.background": "#27272a",
      "input.border": "#3f3f46",
      "editorSuggestWidget.background": "#1c1c20",
      "editorSuggestWidget.border": "#3f3f46",
      "editorSuggestWidget.selectedBackground": "#27272a",
    },
  });

  monaco.editor.defineTheme("agentflow-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "a1a1aa", fontStyle: "italic" },
      { token: "keyword", foreground: "7c3aed" },
      { token: "string", foreground: "16a34a" },
      { token: "number", foreground: "d97706" },
      { token: "type", foreground: "2563eb" },
      { token: "agentflow-ref", foreground: "2563eb", fontStyle: "bold" },
      { token: "agentflow-ref-out", foreground: "0d9488" },
      { token: "agentflow-ref-in", foreground: "ea580c" },
      { token: "agentflow-template-var", foreground: "7c3aed" },
      { token: "agentflow-condition", foreground: "3b82f6" },
      { token: "agentflow-frontmatter", foreground: "a1a1aa", fontStyle: "italic" },
      { token: "agentflow-frontmatter-key", foreground: "7c3aed" },
      { token: "agentflow-frontmatter-value", foreground: "16a34a" },
    ],
    colors: {
      "editor.background": "#fafafa",
      "editor.foreground": "#18181b",
      "editor.lineHighlightBackground": "#f4f4f550",
      "editor.selectionBackground": "#2563eb20",
      "editorCursor.foreground": "#2563eb",
      "editorWidget.background": "#ffffff",
      "editorWidget.border": "#e4e4e7",
      "input.background": "#f4f4f5",
      "input.border": "#e4e4e7",
      "editorSuggestWidget.background": "#ffffff",
      "editorSuggestWidget.border": "#e4e4e7",
      "editorSuggestWidget.selectedBackground": "#f4f4f5",
    },
  });

  registerAgentFlowLanguage(monaco, getRefNames);
}
