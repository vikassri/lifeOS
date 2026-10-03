'use client'
import { useRef, useCallback, useState } from 'react'
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  Code, FileCode, Quote, List, ListOrdered, CheckSquare,
  Link2, Minus, Table, Eye, Pencil, Columns2,
} from 'lucide-react'
import { MarkdownRenderer } from './MarkdownRenderer'

// ── Types ─────────────────────────────────────────────────────────────────────
type ViewMode = 'write' | 'preview' | 'split'

interface MarkdownEditorProps {
  value:       string
  onChange:    (v: string) => void
  placeholder?: string
  minHeight?:  string   // e.g. '320px'
  name?:       string   // hidden input name for form submission
}

// ── Toolbar button definitions ────────────────────────────────────────────────
interface ToolbarAction {
  icon:    React.FC<{ className?: string }>
  label:   string
  shortcut?: string
  action:  (ta: HTMLTextAreaElement) => void
}

/** Wrap selected text (or insert placeholder) with prefix/suffix. */
function wrap(ta: HTMLTextAreaElement, pre: string, suf: string, placeholder = '') {
  const start = ta.selectionStart
  const end   = ta.selectionEnd
  const sel   = ta.value.slice(start, end) || placeholder
  const next  = ta.value.slice(0, start) + pre + sel + suf + ta.value.slice(end)
  setNativeValue(ta, next)
  ta.setSelectionRange(start + pre.length, start + pre.length + sel.length)
  ta.focus()
}

/** Prefix each selected line. */
function prefixLines(ta: HTMLTextAreaElement, prefix: string) {
  const start = ta.selectionStart
  const end   = ta.selectionEnd
  const lines = ta.value.slice(start, end).split('\n')
  const replaced = lines.map(l => `${prefix}${l}`).join('\n')
  const next = ta.value.slice(0, start) + replaced + ta.value.slice(end)
  setNativeValue(ta, next)
  ta.setSelectionRange(start, start + replaced.length)
  ta.focus()
}

/** Insert text at cursor. */
function insert(ta: HTMLTextAreaElement, text: string) {
  const start = ta.selectionStart
  const next  = ta.value.slice(0, start) + text + ta.value.slice(ta.selectionEnd)
  setNativeValue(ta, next)
  ta.setSelectionRange(start + text.length, start + text.length)
  ta.focus()
}

/** React-compatible programmatic value setter (triggers onChange). */
function setNativeValue(el: HTMLTextAreaElement, value: string) {
  const proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
  proto?.set?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

const TOOLBAR: (ToolbarAction | 'sep')[] = [
  {
    icon: Heading1, label: 'Heading 1', shortcut: '',
    action: ta => prefixLines(ta, '# '),
  },
  {
    icon: Heading2, label: 'Heading 2',
    action: ta => prefixLines(ta, '## '),
  },
  {
    icon: Heading3, label: 'Heading 3',
    action: ta => prefixLines(ta, '### '),
  },
  'sep',
  {
    icon: Bold, label: 'Bold', shortcut: 'Ctrl+B',
    action: ta => wrap(ta, '**', '**', 'bold text'),
  },
  {
    icon: Italic, label: 'Italic', shortcut: 'Ctrl+I',
    action: ta => wrap(ta, '_', '_', 'italic text'),
  },
  {
    icon: Strikethrough, label: 'Strikethrough',
    action: ta => wrap(ta, '~~', '~~', 'strikethrough'),
  },
  'sep',
  {
    icon: Code, label: 'Inline code', shortcut: 'Ctrl+`',
    action: ta => wrap(ta, '`', '`', 'code'),
  },
  {
    icon: FileCode, label: 'Code block',
    action: ta => insert(ta, '\n```\n\n```\n'),
  },
  {
    icon: Quote, label: 'Blockquote',
    action: ta => prefixLines(ta, '> '),
  },
  'sep',
  {
    icon: List, label: 'Bullet list',
    action: ta => prefixLines(ta, '- '),
  },
  {
    icon: ListOrdered, label: 'Numbered list',
    action: ta => prefixLines(ta, '1. '),
  },
  {
    icon: CheckSquare, label: 'Task list',
    action: ta => prefixLines(ta, '- [ ] '),
  },
  'sep',
  {
    icon: Link2, label: 'Link', shortcut: 'Ctrl+K',
    action: ta => {
      const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd)
      wrap(ta, '[', '](url)', sel || 'link text')
    },
  },
  {
    icon: Table, label: 'Table',
    action: ta => insert(ta,
      '\n| Column 1 | Column 2 | Column 3 |\n| -------- | -------- | -------- |\n| Cell     | Cell     | Cell     |\n',
    ),
  },
  {
    icon: Minus, label: 'Horizontal rule',
    action: ta => insert(ta, '\n---\n'),
  },
]

// ── Main component ────────────────────────────────────────────────────────────
export function MarkdownEditor({
  value, onChange, placeholder = 'Write with **Markdown**…', minHeight = '320px', name,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<ViewMode>('write')
  const taRef = useRef<HTMLTextAreaElement>(null)

  const applyAction = useCallback((action: ToolbarAction['action']) => {
    if (taRef.current) action(taRef.current)
  }, [])

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ctrl = e.ctrlKey || e.metaKey
    if (!ctrl) return
    const ta = taRef.current!
    switch (e.key) {
      case 'b': e.preventDefault(); wrap(ta, '**', '**', 'bold text');  break
      case 'i': e.preventDefault(); wrap(ta, '_',  '_',  'italic text'); break
      case 'k': e.preventDefault(); wrap(ta, '[',  '](url)', 'link text'); break
      case '`': e.preventDefault(); wrap(ta, '`',  '`',  'code');        break
    }
  }, [])

  // Tab → indent with 2 spaces instead of focus-jump
  const handleTab = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const ta = taRef.current!
    insert(ta, '  ')
  }, [])

  return (
    <div className="flex flex-col rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-0.5 border-b border-zinc-700 bg-zinc-800/50 px-2 py-1.5 flex-wrap">
        {TOOLBAR.map((item, i) =>
          item === 'sep' ? (
            <div key={`sep-${i}`} className="mx-1 h-4 w-px bg-zinc-700" />
          ) : (
            <button
              key={item.label}
              type="button"
              title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
              aria-label={item.label}
              onClick={() => applyAction(item.action)}
              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
            >
              <item.icon className="h-3.5 w-3.5" />
            </button>
          )
        )}

        {/* View mode tabs — pushed to the right */}
        <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-zinc-700 bg-zinc-800 p-0.5">
          {([
            ['write',   <Pencil   key="w" className="h-3 w-3" />, 'Write'],
            ['split',   <Columns2 key="s" className="h-3 w-3" />, 'Split'],
            ['preview', <Eye      key="p" className="h-3 w-3" />, 'Preview'],
          ] as [ViewMode, React.ReactNode, string][]).map(([m, icon, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                mode === m
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Editor / Preview pane ── */}
      <div className={`flex ${mode === 'split' ? 'divide-x divide-zinc-700' : ''}`} style={{ minHeight }}>
        {/* Write pane */}
        {(mode === 'write' || mode === 'split') && (
          <textarea
            ref={taRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => { handleKeyDown(e); handleTab(e) }}
            placeholder={placeholder}
            className="flex-1 resize-none bg-transparent px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none font-mono leading-relaxed"
            style={{ minHeight }}
            spellCheck
          />
        )}

        {/* Preview pane */}
        {(mode === 'preview' || mode === 'split') && (
          <div className="flex-1 overflow-y-auto px-4 py-3" style={{ minHeight }}>
            {value.trim()
              ? <MarkdownRenderer content={value} />
              : <p className="text-sm text-zinc-600 italic">Nothing to preview yet…</p>
            }
          </div>
        )}
      </div>

      {/* Char count */}
      <div className="flex items-center justify-between border-t border-zinc-700/50 px-3 py-1 text-[10px] text-zinc-600">
        <span>Markdown supported · GFM · <kbd className="bg-zinc-800 px-1 rounded">Ctrl+B</kbd> bold · <kbd className="bg-zinc-800 px-1 rounded">Ctrl+I</kbd> italic · <kbd className="bg-zinc-800 px-1 rounded">Ctrl+K</kbd> link</span>
        <span>{value.length} chars</span>
      </div>

      {/* Hidden input for form submission */}
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  )
}
