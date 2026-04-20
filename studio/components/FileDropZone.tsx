'use client'

import { useCallback, useState, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileDropZoneProps {
  onFiles: (files: File[]) => void
  maxSize?: number
  className?: string
  compact?: boolean
  overlay?: boolean
  disabled?: boolean
}

export function FileDropZone({
  onFiles,
  maxSize = 10 * 1024 * 1024,
  className,
  compact,
  overlay,
  disabled,
}: FileDropZoneProps) {
  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) onFiles(accepted)
  }, [onFiles])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    maxSize,
    disabled,
    noClick: overlay,
  })

  // Overlay mode: transparent layer that only intercepts drag events
  if (overlay) {
    // getRootProps adds drag handlers; noClick prevents click interference
    const rootProps = getRootProps()

    // Track document-level drag to break the pointer-events-none deadlock
    const [draggingOverWindow, setDraggingOverWindow] = useState(false)
    const dragCounter = useRef(0)
    useEffect(() => {
      if (disabled) return
      const enter = (e: DragEvent) => {
        if (e.dataTransfer?.types?.includes('Files')) {
          dragCounter.current++
          setDraggingOverWindow(true)
        }
      }
      const leave = () => {
        dragCounter.current--
        if (dragCounter.current <= 0) { dragCounter.current = 0; setDraggingOverWindow(false) }
      }
      const drop = () => { dragCounter.current = 0; setDraggingOverWindow(false) }
      document.addEventListener('dragenter', enter)
      document.addEventListener('dragleave', leave)
      document.addEventListener('drop', drop)
      return () => {
        document.removeEventListener('dragenter', enter)
        document.removeEventListener('dragleave', leave)
        document.removeEventListener('drop', drop)
      }
    }, [disabled])

    const active = draggingOverWindow || isDragActive

    return (
      <>
        <div
          {...rootProps}
          className={cn(
            'absolute inset-0 z-50 transition-all duration-200',
            active
              ? 'bg-primary/10 backdrop-blur-[2px] border-2 border-dashed border-primary/40 rounded-xl'
              : 'pointer-events-none',
            isDragReject && 'border-destructive/40 bg-destructive/10',
            className,
          )}
          onClick={undefined}
          onKeyDown={undefined}
        >
          <input {...getInputProps()} />
          {active && (
            <div className="flex flex-col items-center justify-center h-full gap-2 pointer-events-none">
              {isDragReject ? (
                <>
                  <AlertCircle className="w-8 h-8 text-destructive/60" />
                  <p className="text-sm text-destructive/80">File too large</p>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-primary/60 animate-bounce" />
                  <p className="text-sm text-primary/80 font-medium">Drop to import</p>
                </>
              )}
            </div>
          )}
        </div>
      </>
    )
  }

  // Compact mode: small inline target
  if (compact) {
    return (
      <div
        {...getRootProps()}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
          'text-muted-foreground hover:text-foreground hover:bg-muted/50',
          isDragActive && 'bg-primary/10 text-primary',
          isDragReject && 'bg-destructive/10 text-destructive',
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
      >
        <input {...getInputProps()} />
        <Upload size={14} />
        <span className="text-xs">{isDragActive ? 'Drop here' : 'Import files'}</span>
      </div>
    )
  }

  // Default: proper upload screen
  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex flex-col items-center justify-center gap-4 p-10 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200',
        'border-border/40 hover:border-border text-muted-foreground hover:text-foreground',
        isDragActive && 'border-primary/50 bg-primary/5 text-primary scale-[1.01]',
        isDragReject && 'border-destructive/50 bg-destructive/5 text-destructive',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <input {...getInputProps()} />

      {/* Icon */}
      <div className={cn(
        'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
        isDragActive ? 'bg-primary/10' : 'bg-muted/50',
        isDragReject && 'bg-destructive/10',
      )}>
        {isDragReject ? (
          <AlertCircle className="w-6 h-6 text-destructive/70" />
        ) : (
          <Upload className={cn('w-6 h-6', isDragActive && 'animate-bounce')} />
        )}
      </div>

      {/* Text */}
      <div className="text-center space-y-1">
        <p className="text-sm font-medium">
          {isDragReject ? 'File too large' : isDragActive ? 'Drop to import' : 'Drop files here'}
        </p>
        <p className="text-xs text-muted-foreground/60">
          or <span className="text-primary/80 underline underline-offset-2">browse from your computer</span>
        </p>
      </div>

      {/* Supported types hint */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
        {['.md', '.json', '.yaml', '.py', '.ts', '.csv', '.pdf', '.zip'].map(t => (
          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground/50 font-mono">{t}</span>
        ))}
        <span className="text-[10px] text-muted-foreground/40">+ any file</span>
      </div>

      <p className="text-[10px] text-muted-foreground/40">Up to 10 MB per file</p>
    </div>
  )
}
