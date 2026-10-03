'use client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'

interface MarkdownRendererProps {
  content:    string
  className?: string
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`md-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // ── Headings ──────────────────────────────────────────────────────
          h1: ({ children }) => (
            <h1 className="mb-4 mt-6 border-b border-zinc-700 pb-2 text-2xl font-semibold text-zinc-100 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-5 border-b border-zinc-700/50 pb-1 text-xl font-semibold text-zinc-100">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-lg font-semibold text-zinc-100">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-2 mt-3 text-base font-semibold text-zinc-200">{children}</h4>
          ),
          h5: ({ children }) => (
            <h5 className="mb-1 mt-2 text-sm font-semibold text-zinc-200">{children}</h5>
          ),
          h6: ({ children }) => (
            <h6 className="mb-1 mt-2 text-xs font-semibold text-zinc-400">{children}</h6>
          ),

          // ── Paragraph ─────────────────────────────────────────────────────
          p: ({ children }) => (
            <p className="mb-4 leading-7 text-zinc-300 last:mb-0">{children}</p>
          ),

          // ── Inline elements ───────────────────────────────────────────────
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-100">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-zinc-300">{children}</em>
          ),
          del: ({ children }) => (
            <del className="text-zinc-500 line-through">{children}</del>
          ),

          // ── Links ─────────────────────────────────────────────────────────
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline underline-offset-2 hover:text-blue-300 transition-colors"
            >
              {children}
            </a>
          ),

          // ── Lists ─────────────────────────────────────────────────────────
          ul: ({ children }) => (
            <ul className="mb-4 ml-6 list-disc space-y-1 text-zinc-300 [&_ul]:mb-0 [&_ul]:mt-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 ml-6 list-decimal space-y-1 text-zinc-300 [&_ol]:mb-0 [&_ol]:mt-1">
              {children}
            </ol>
          ),
          li: ({ children, node }) => {
            // GFM task list items have a checkbox as first child
            const raw = node as { properties?: { className?: string[] } }
            const isTask = raw?.properties?.className?.includes('task-list-item')
            return (
              <li className={`leading-7 ${isTask ? 'list-none -ml-6' : ''}`}>
                {children}
              </li>
            )
          },

          // ── Blockquote ────────────────────────────────────────────────────
          blockquote: ({ children }) => (
            <blockquote className="mb-4 border-l-4 border-zinc-600 pl-4 text-zinc-400 italic">
              {children}
            </blockquote>
          ),

          // ── Horizontal rule ───────────────────────────────────────────────
          hr: () => <hr className="my-6 border-zinc-700" />,

          // ── Inline code ───────────────────────────────────────────────────
          code: ({ children, className: cls }) => {
            const isBlock = cls?.startsWith('language-')
            if (isBlock) return <code className={cls}>{children}</code>
            return (
              <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[0.85em] text-emerald-300">
                {children}
              </code>
            )
          },

          // ── Code block ────────────────────────────────────────────────────
          pre: ({ children }) => (
            <pre className="mb-4 overflow-x-auto rounded-lg border border-zinc-700 bg-zinc-950 p-4 text-sm">
              {children}
            </pre>
          ),

          // ── Table ─────────────────────────────────────────────────────────
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto rounded-lg border border-zinc-700">
              <table className="w-full border-collapse text-sm text-zinc-300">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-zinc-700 bg-zinc-800/50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left font-semibold text-zinc-100">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-t border-zinc-700/50 px-4 py-2">{children}</td>
          ),

          // ── Images ───────────────────────────────────────────────────────
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt ?? ''}
              className="my-4 max-w-full rounded-lg border border-zinc-700"
            />
          ),

          // ── Checkbox inputs in task lists ─────────────────────────────────
          input: ({ type, checked }) =>
            type === 'checkbox' ? (
              <input
                type="checkbox"
                checked={checked}
                readOnly
                className="mr-2 accent-emerald-500"
              />
            ) : null,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
