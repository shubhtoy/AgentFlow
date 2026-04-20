'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'

const THEMES: Record<string, { color: string; light: Record<string, string>; dark: Record<string, string> }> = {
  emerald: {
    color: 'hsl(168,70%,40%)',
    light: {
      '--color-fd-background': 'hsl(165,45%,96%)', '--color-fd-foreground': 'hsl(165,40%,18%)',
      '--color-fd-primary': 'hsl(168,70%,40%)', '--color-fd-primary-foreground': 'hsl(168,100%,12%)',
      '--color-fd-border': 'hsla(168,40%,70%,0.5)', '--color-fd-ring': 'hsl(168,70%,40%)',
      '--color-fd-accent': 'hsl(165,50%,90%)', '--color-fd-accent-foreground': 'hsl(168,70%,20%)',
      '--color-fd-muted': 'hsl(165,40%,92%)', '--color-fd-muted-foreground': 'hsl(165,30%,45%)',
      '--color-fd-secondary': 'hsl(168,45%,88%)', '--color-fd-secondary-foreground': 'hsl(168,60%,18%)',
      '--color-fd-card': 'hsl(165,45%,94%)', '--color-fd-card-foreground': 'hsl(165,40%,18%)',
      '--color-fd-popover': 'hsl(165,45%,97%)', '--color-fd-popover-foreground': 'hsl(165,40%,18%)',
    },
    dark: {
      '--color-fd-background': 'hsl(200,30%,7%)', '--color-fd-foreground': 'hsl(168,40%,88%)',
      '--color-fd-primary': 'hsl(168,70%,60%)', '--color-fd-primary-foreground': 'hsl(200,40%,8%)',
      '--color-fd-border': 'hsla(168,40%,35%,0.35)', '--color-fd-ring': 'hsl(168,70%,60%)',
      '--color-fd-accent': 'hsl(200,30%,18%)', '--color-fd-accent-foreground': 'hsl(168,70%,75%)',
      '--color-fd-muted': 'hsl(200,30%,12%)', '--color-fd-muted-foreground': 'hsl(168,25%,65%)',
      '--color-fd-secondary': 'hsl(200,30%,16%)', '--color-fd-secondary-foreground': 'hsl(168,40%,88%)',
      '--color-fd-card': 'hsl(200,30%,10%)', '--color-fd-card-foreground': 'hsl(168,40%,88%)',
      '--color-fd-popover': 'hsl(200,30%,8%)', '--color-fd-popover-foreground': 'hsl(168,40%,88%)',
    },
  },
  ocean: {
    color: 'hsl(210,80%,50%)',
    light: {
      '--color-fd-background': 'hsl(0,0%,98%)', '--color-fd-foreground': 'hsl(0,0%,3.9%)',
      '--color-fd-primary': 'hsl(210,80%,20.2%)', '--color-fd-primary-foreground': 'hsl(0,0%,98%)',
      '--color-fd-border': 'hsl(220,50%,89.8%)', '--color-fd-ring': 'hsl(220,100%,63.9%)',
      '--color-fd-accent': 'hsl(220,50%,94.1%)', '--color-fd-accent-foreground': 'hsl(0,0%,9%)',
      '--color-fd-muted': 'hsl(220,90%,96.1%)', '--color-fd-muted-foreground': 'hsl(0,0%,45.1%)',
      '--color-fd-secondary': 'hsl(220,90%,96.1%)', '--color-fd-secondary-foreground': 'hsl(0,0%,9%)',
      '--color-fd-card': 'hsl(220,50%,98%)', '--color-fd-card-foreground': 'hsl(0,0%,3.9%)',
      '--color-fd-popover': 'hsl(0,0%,98%)', '--color-fd-popover-foreground': 'hsl(0,0%,15.1%)',
    },
    dark: {
      '--color-fd-background': 'hsl(220,60%,8%)', '--color-fd-foreground': 'hsl(220,60%,94.5%)',
      '--color-fd-primary': 'hsl(205,100%,85%)', '--color-fd-primary-foreground': 'hsl(0,0%,9%)',
      '--color-fd-border': 'hsla(220,50%,50%,0.2)', '--color-fd-ring': 'hsl(205,100%,85%)',
      '--color-fd-accent': 'hsl(220,40%,20%)', '--color-fd-accent-foreground': 'hsl(220,80%,90%)',
      '--color-fd-muted': 'hsl(220,50%,10%)', '--color-fd-muted-foreground': 'hsl(220,30%,65%)',
      '--color-fd-secondary': 'hsl(220,50%,20%)', '--color-fd-secondary-foreground': 'hsl(220,80%,90%)',
      '--color-fd-card': 'hsla(220,56%,15%,0.4)', '--color-fd-card-foreground': 'hsl(220,60%,94.5%)',
      '--color-fd-popover': 'hsl(220,50%,10%)', '--color-fd-popover-foreground': 'hsl(220,60%,94.5%)',
    },
  },
  purple: {
    color: 'hsl(270,100%,52%)',
    light: {
      '--color-fd-background': 'hsl(256,100%,96%)', '--color-fd-foreground': 'hsl(256,60%,26%)',
      '--color-fd-primary': 'hsl(270,100%,52%)', '--color-fd-primary-foreground': 'hsl(270,100%,20%)',
      '--color-fd-border': 'hsla(270,40%,80%,0.5)', '--color-fd-ring': 'hsl(270,100%,52%)',
      '--color-fd-accent': 'hsl(270,40%,88%)', '--color-fd-accent-foreground': 'hsl(270,100%,20%)',
      '--color-fd-muted': 'hsl(256,60%,94%)', '--color-fd-muted-foreground': 'hsl(256,50%,50%)',
      '--color-fd-secondary': 'hsl(270,60%,90%)', '--color-fd-secondary-foreground': 'hsl(256,60%,10%)',
      '--color-fd-card': 'hsl(256,60%,92%)', '--color-fd-card-foreground': 'hsl(256,100%,20%)',
      '--color-fd-popover': 'hsl(256,60%,96%)', '--color-fd-popover-foreground': 'hsl(256,100%,20%)',
    },
    dark: {
      '--color-fd-background': 'hsl(256,20%,6%)', '--color-fd-foreground': 'hsl(256,60%,90%)',
      '--color-fd-primary': 'hsl(270,100%,86%)', '--color-fd-primary-foreground': 'hsl(256,60%,6%)',
      '--color-fd-border': 'hsla(270,50%,40%,0.3)', '--color-fd-ring': 'hsl(270,100%,86%)',
      '--color-fd-accent': 'hsl(256,23%,22%)', '--color-fd-accent-foreground': 'hsl(270,40%,86%)',
      '--color-fd-muted': 'hsl(256,23%,10%)', '--color-fd-muted-foreground': 'hsl(256,50%,75%)',
      '--color-fd-secondary': 'hsl(270,23%,20%)', '--color-fd-secondary-foreground': 'hsl(256,60%,90%)',
      '--color-fd-card': 'hsl(256,23%,10%)', '--color-fd-card-foreground': 'hsl(256,60%,90%)',
      '--color-fd-popover': 'hsl(256,23%,6%)', '--color-fd-popover-foreground': 'hsl(256,60%,90%)',
    },
  },
  ruby: {
    color: 'hsl(348,85%,45%)',
    light: {
      '--color-fd-background': 'hsl(0,0%,98%)', '--color-fd-foreground': 'hsl(350,45%,14%)',
      '--color-fd-primary': 'hsl(348,85%,45%)', '--color-fd-primary-foreground': 'hsl(0,0%,100%)',
      '--color-fd-border': 'hsla(348,40%,60%,0.25)', '--color-fd-ring': 'hsl(348,85%,45%)',
      '--color-fd-accent': 'hsl(348,70%,95%)', '--color-fd-accent-foreground': 'hsl(348,70%,22%)',
      '--color-fd-muted': 'hsl(0,0%,94%)', '--color-fd-muted-foreground': 'hsl(348,25%,42%)',
      '--color-fd-secondary': 'hsl(348,55%,92%)', '--color-fd-secondary-foreground': 'hsl(348,50%,20%)',
      '--color-fd-card': 'hsl(0,0%,100%)', '--color-fd-card-foreground': 'hsl(350,45%,14%)',
      '--color-fd-popover': 'hsl(0,0%,100%)', '--color-fd-popover-foreground': 'hsl(350,45%,14%)',
    },
    dark: {
      '--color-fd-background': 'hsl(350,30%,6%)', '--color-fd-foreground': 'hsl(350,30%,92%)',
      '--color-fd-primary': 'hsl(348,90%,62%)', '--color-fd-primary-foreground': 'hsl(350,30%,8%)',
      '--color-fd-border': 'hsla(348,40%,45%,0.25)', '--color-fd-ring': 'hsl(348,90%,62%)',
      '--color-fd-accent': 'hsl(348,35%,16%)', '--color-fd-accent-foreground': 'hsl(348,70%,82%)',
      '--color-fd-muted': 'hsl(350,25%,11%)', '--color-fd-muted-foreground': 'hsl(348,25%,65%)',
      '--color-fd-secondary': 'hsl(348,30%,14%)', '--color-fd-secondary-foreground': 'hsl(350,30%,92%)',
      '--color-fd-card': 'hsl(350,30%,9%)', '--color-fd-card-foreground': 'hsl(350,30%,92%)',
      '--color-fd-popover': 'hsl(350,30%,8%)', '--color-fd-popover-foreground': 'hsl(350,30%,92%)',
    },
  },
  dusk: {
    color: 'hsl(340,40%,48%)',
    light: {
      '--color-fd-background': 'hsl(250,20%,92%)', '--color-fd-foreground': 'hsl(220,20%,30%)',
      '--color-fd-primary': 'hsl(340,40%,48%)', '--color-fd-primary-foreground': 'hsl(240,80%,20%)',
      '--color-fd-border': 'hsl(240,40%,90%)', '--color-fd-ring': 'hsl(340,40%,48%)',
      '--color-fd-accent': 'hsl(250,30%,90%)', '--color-fd-accent-foreground': 'hsl(250,20%,20%)',
      '--color-fd-muted': 'hsl(240,30%,94%)', '--color-fd-muted-foreground': 'hsl(240,10%,50%)',
      '--color-fd-secondary': 'hsl(250,40%,94%)', '--color-fd-secondary-foreground': 'hsl(240,40%,10%)',
      '--color-fd-card': 'hsl(250,20%,92%)', '--color-fd-card-foreground': 'hsl(250,20%,20%)',
      '--color-fd-popover': 'hsl(250,40%,96%)', '--color-fd-popover-foreground': 'hsl(250,40%,20%)',
    },
    dark: {
      '--color-fd-background': 'hsl(220,15%,6%)', '--color-fd-foreground': 'hsl(220,15%,87%)',
      '--color-fd-primary': 'hsl(340,100%,90%)', '--color-fd-primary-foreground': 'hsl(240,40%,4%)',
      '--color-fd-border': 'hsl(220,15%,15%)', '--color-fd-ring': 'hsl(340,100%,90%)',
      '--color-fd-accent': 'hsl(250,20%,15%)', '--color-fd-accent-foreground': 'hsl(340,5%,90%)',
      '--color-fd-muted': 'hsl(220,20%,15%)', '--color-fd-muted-foreground': 'hsl(220,15%,60%)',
      '--color-fd-secondary': 'hsl(240,20%,15%)', '--color-fd-secondary-foreground': 'hsl(250,20%,90%)',
      '--color-fd-card': 'hsl(240,20%,5%)', '--color-fd-card-foreground': 'hsl(240,15%,87%)',
      '--color-fd-popover': 'hsl(240,20%,5%)', '--color-fd-popover-foreground': 'hsl(250,20%,90%)',
    },
  },
  catppuccin: {
    color: 'hsl(266,85%,58%)',
    light: {
      '--color-fd-background': 'hsl(220,23%,95%)', '--color-fd-foreground': 'hsl(234,16%,35%)',
      '--color-fd-primary': 'hsl(266,85%,58%)', '--color-fd-primary-foreground': 'hsl(220,22%,92%)',
      '--color-fd-border': 'hsl(223,16%,83%)', '--color-fd-ring': 'hsl(267,84%,81%)',
      '--color-fd-accent': 'hsl(223,16%,83%)', '--color-fd-accent-foreground': 'hsl(234,16%,35%)',
      '--color-fd-muted': 'hsl(220,22%,92%)', '--color-fd-muted-foreground': 'hsl(233,10%,47%)',
      '--color-fd-secondary': 'hsl(220,22%,92%)', '--color-fd-secondary-foreground': 'hsl(234,16%,35%)',
      '--color-fd-card': 'hsl(220,22%,92%)', '--color-fd-card-foreground': 'hsl(234,16%,35%)',
      '--color-fd-popover': 'hsl(220,22%,92%)', '--color-fd-popover-foreground': 'hsl(234,16%,35%)',
    },
    dark: {
      '--color-fd-background': 'hsl(240,21%,15%)', '--color-fd-foreground': 'hsl(226,64%,88%)',
      '--color-fd-primary': 'hsl(267,84%,81%)', '--color-fd-primary-foreground': 'hsl(240,23%,9%)',
      '--color-fd-border': 'hsl(237,16%,23%)', '--color-fd-ring': 'hsl(267,84%,81%)',
      '--color-fd-accent': 'hsl(237,16%,23%)', '--color-fd-accent-foreground': 'hsl(226,64%,88%)',
      '--color-fd-muted': 'hsl(240,21%,12%)', '--color-fd-muted-foreground': 'hsl(228,24%,72%)',
      '--color-fd-secondary': 'hsl(240,21%,12%)', '--color-fd-secondary-foreground': 'hsl(226,64%,88%)',
      '--color-fd-card': 'hsl(240,21%,12%)', '--color-fd-card-foreground': 'hsl(226,64%,88%)',
      '--color-fd-popover': 'hsl(240,23%,9%)', '--color-fd-popover-foreground': 'hsl(226,64%,88%)',
    },
  },
  black: {
    color: 'hsl(0,0%,9%)',
    light: {
      '--color-fd-background': 'hsl(0,0%,98%)', '--color-fd-foreground': 'hsl(0,0%,3.9%)',
      '--color-fd-primary': 'hsl(0,0%,9%)', '--color-fd-primary-foreground': 'hsl(0,0%,98%)',
      '--color-fd-border': 'hsla(0,0%,60%,0.2)', '--color-fd-ring': 'hsl(0,0%,63.9%)',
      '--color-fd-accent': 'hsl(0,0%,94.1%)', '--color-fd-accent-foreground': 'hsl(0,0%,9%)',
      '--color-fd-muted': 'hsl(0,0%,96.1%)', '--color-fd-muted-foreground': 'hsl(0,0%,45.1%)',
      '--color-fd-secondary': 'hsl(0,0%,96.1%)', '--color-fd-secondary-foreground': 'hsl(0,0%,9%)',
      '--color-fd-card': 'hsl(0,0%,99.7%)', '--color-fd-card-foreground': 'hsl(0,0%,3.9%)',
      '--color-fd-popover': 'hsl(0,0%,100%)', '--color-fd-popover-foreground': 'hsl(0,0%,15.1%)',
    },
    dark: {
      '--color-fd-background': 'hsl(0,0%,2%)', '--color-fd-foreground': 'hsl(0,0%,98%)',
      '--color-fd-primary': 'hsl(0,0%,98%)', '--color-fd-primary-foreground': 'hsl(0,0%,9%)',
      '--color-fd-border': 'hsl(0,0%,50%,0.2)', '--color-fd-ring': 'hsl(0,0%,34.9%)',
      '--color-fd-accent': 'hsl(0,0%,15%)', '--color-fd-accent-foreground': 'hsl(0,0%,100%)',
      '--color-fd-muted': 'hsl(0,0%,8%)', '--color-fd-muted-foreground': 'hsl(0,0%,60%)',
      '--color-fd-secondary': 'hsl(0,0%,12.9%)', '--color-fd-secondary-foreground': 'hsl(0,0%,98%)',
      '--color-fd-card': 'hsl(0,0%,4%)', '--color-fd-card-foreground': 'hsl(0,0%,98%)',
      '--color-fd-popover': 'hsl(0,0%,4%)', '--color-fd-popover-foreground': 'hsl(0,0%,98%)',
    },
  },
  aspen: {
    color: 'hsl(80,60%,40%)',
    light: {
      '--color-fd-background': 'hsl(75,45%,96%)', '--color-fd-foreground': 'hsl(75,35%,18%)',
      '--color-fd-primary': 'hsl(80,60%,40%)', '--color-fd-primary-foreground': 'hsl(80,100%,16%)',
      '--color-fd-border': 'hsla(80,35%,70%,0.5)', '--color-fd-ring': 'hsl(80,60%,40%)',
      '--color-fd-accent': 'hsl(75,50%,90%)', '--color-fd-accent-foreground': 'hsl(80,60%,22%)',
      '--color-fd-muted': 'hsl(75,40%,92%)', '--color-fd-muted-foreground': 'hsl(75,25%,45%)',
      '--color-fd-secondary': 'hsl(80,45%,88%)', '--color-fd-secondary-foreground': 'hsl(80,50%,18%)',
      '--color-fd-card': 'hsl(75,45%,94%)', '--color-fd-card-foreground': 'hsl(75,35%,18%)',
      '--color-fd-popover': 'hsl(75,45%,97%)', '--color-fd-popover-foreground': 'hsl(75,35%,18%)',
    },
    dark: {
      '--color-fd-background': 'hsl(80,25%,7%)', '--color-fd-foreground': 'hsl(75,35%,88%)',
      '--color-fd-primary': 'hsl(80,60%,55%)', '--color-fd-primary-foreground': 'hsl(80,35%,8%)',
      '--color-fd-border': 'hsla(80,35%,35%,0.35)', '--color-fd-ring': 'hsl(80,60%,55%)',
      '--color-fd-accent': 'hsl(80,25%,18%)', '--color-fd-accent-foreground': 'hsl(80,60%,75%)',
      '--color-fd-muted': 'hsl(80,25%,12%)', '--color-fd-muted-foreground': 'hsl(75,25%,65%)',
      '--color-fd-secondary': 'hsl(80,25%,16%)', '--color-fd-secondary-foreground': 'hsl(75,35%,88%)',
      '--color-fd-card': 'hsl(80,25%,10%)', '--color-fd-card-foreground': 'hsl(75,35%,88%)',
      '--color-fd-popover': 'hsl(80,25%,8%)', '--color-fd-popover-foreground': 'hsl(75,35%,88%)',
    },
  },
  vitepress: {
    color: 'hsl(226,55%,45%)',
    light: {
      '--color-fd-background': 'hsl(0,0%,100%)', '--color-fd-foreground': 'hsl(240,6%,25%)',
      '--color-fd-primary': 'hsl(226,55%,45%)', '--color-fd-primary-foreground': 'hsl(0,0%,98%)',
      '--color-fd-border': 'hsl(0,0%,89.8%)', '--color-fd-ring': 'hsl(0,0%,63.9%)',
      '--color-fd-accent': 'hsl(0,0%,94.1%)', '--color-fd-accent-foreground': 'hsl(240,6%,25%)',
      '--color-fd-muted': 'hsl(0,0%,96.1%)', '--color-fd-muted-foreground': 'hsl(240,6%,50%)',
      '--color-fd-secondary': 'hsl(240,6%,97%)', '--color-fd-secondary-foreground': 'hsl(0,0%,9%)',
      '--color-fd-card': 'hsl(0,0%,100%)', '--color-fd-card-foreground': 'hsl(0,0%,3.9%)',
      '--color-fd-popover': 'hsl(0,0%,100%)', '--color-fd-popover-foreground': 'hsl(0,0%,15.1%)',
    },
    dark: {
      '--color-fd-background': 'hsl(240,7%,11%)', '--color-fd-foreground': 'hsl(60,100%,98%)',
      '--color-fd-primary': 'hsl(234,100%,83%)', '--color-fd-primary-foreground': 'hsl(240,7%,11%)',
      '--color-fd-border': 'hsl(240,4%,19%)', '--color-fd-ring': 'hsl(234,100%,83%)',
      '--color-fd-accent': 'hsl(0,0%,15%)', '--color-fd-accent-foreground': 'hsl(0,0%,100%)',
      '--color-fd-muted': 'hsl(0,0%,13%)', '--color-fd-muted-foreground': 'hsl(240,4%,65%)',
      '--color-fd-secondary': 'hsl(240,4%,9%)', '--color-fd-secondary-foreground': 'hsl(60,100%,98%)',
      '--color-fd-card': 'hsl(240,7%,11%)', '--color-fd-card-foreground': 'hsl(60,100%,98%)',
      '--color-fd-popover': 'hsl(240,7%,11%)', '--color-fd-popover-foreground': 'hsl(60,100%,98%)',
    },
  },
}

const THEME_NAMES = Object.keys(THEMES)
const STORAGE_KEY = 'fd-docs-theme'

function applyTheme(name: string) {
  const theme = THEMES[name]
  if (!theme) return
  const isDark = document.documentElement.classList.contains('dark')
  const vars = isDark ? theme.dark : theme.light
  for (const [k, v] of Object.entries(vars)) {
    document.documentElement.style.setProperty(k, v)
  }
}

export function ThemeSwitcher() {
  const [current, setCurrent] = useState('emerald')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && THEMES[saved]) {
      setCurrent(saved)
      applyTheme(saved)
    }
    const obs = new MutationObserver(() => {
      applyTheme(localStorage.getItem(STORAGE_KEY) || 'emerald')
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const select = (name: string) => {
    setCurrent(name)
    localStorage.setItem(STORAGE_KEY, name)
    applyTheme(name)
    setOpen(false)
  }

  return (
    <div className="relative px-3 py-3 border-t border-fd-border">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs
          text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-accent transition-colors"
      >
        <span
          className="size-3 rounded-full shrink-0 ring-1 ring-fd-border"
          style={{ background: THEMES[current].color }}
        />
        <span className="flex-1 text-left capitalize">{current}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-3 right-3 mb-1 z-50
            rounded-lg border border-fd-border bg-fd-popover shadow-lg
            max-h-52 overflow-y-auto py-1">
            {THEME_NAMES.map(name => (
              <button
                key={name}
                onClick={() => select(name)}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors capitalize ${
                  name === current
                    ? 'bg-fd-accent text-fd-accent-foreground font-medium'
                    : 'text-fd-popover-foreground hover:bg-fd-accent/50'
                }`}
              >
                <span
                  className="size-3 rounded-full shrink-0 ring-1 ring-fd-border"
                  style={{ background: THEMES[name].color }}
                />
                {name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
