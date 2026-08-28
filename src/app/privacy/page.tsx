/**
 * /privacy — the published privacy policy.
 *
 * Google Play requires a privacy policy at a stable public URL, declared in
 * Play Console AND linked inside the app. This route sits outside the (app)
 * group so it renders with no session — a Play reviewer, or anyone who has
 * not installed the app, has to be able to read it.
 *
 * The prose lives in ./policy.md rather than in JSX. It is a legal document
 * that will be edited by a human (and possibly a lawyer) long after this
 * component stops changing, and it should not require touching React to
 * update a sentence. It is read at build time, so there is no runtime cost.
 *
 * The renderer below deliberately covers only the subset of Markdown the
 * policy actually uses. A general-purpose parser would be a dependency and a
 * bigger surface for mangling a document that needs to render exactly as
 * written.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { ReactNode } from 'react'

export const metadata = {
  title: 'Privacy Policy — Eren',
  description: 'What Eren stores, who processes it, and how to have it deleted.',
}

function inline(text: string, keyBase: string): ReactNode[] {
  // Order matters: links first, then bold, so a bolded link survives.
  const out: ReactNode[] = []
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = `${keyBase}-${i++}`
    if (m[1]) {
      out.push(<a key={key} href={m[2]} style={S.link}>{m[1]}</a>)
    } else if (m[3]) {
      out.push(<strong key={key} style={S.strong}>{m[3]}</strong>)
    } else if (m[4]) {
      out.push(<code key={key} style={S.code}>{m[4]}</code>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function render(md: string): ReactNode[] {
  const lines = md.split('\n')
  const nodes: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) { i++; continue }

    if (line.startsWith('# '))  { nodes.push(<h1 key={key++} style={S.h1}>{inline(line.slice(2), `h1${key}`)}</h1>); i++; continue }
    if (line.startsWith('## ')) { nodes.push(<h2 key={key++} style={S.h2}>{inline(line.slice(3), `h2${key}`)}</h2>); i++; continue }
    if (line.startsWith('### ')){ nodes.push(<h3 key={key++} style={S.h3}>{inline(line.slice(4), `h3${key}`)}</h3>); i++; continue }
    if (/^---+$/.test(line.trim())) { nodes.push(<hr key={key++} style={S.hr} />); i++; continue }

    // Table: header row, separator, then body rows.
    if (line.trim().startsWith('|') && lines[i + 1]?.includes('---')) {
      const cells = (r: string) => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      const head = cells(line)
      i += 2
      const body: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) { body.push(cells(lines[i])); i++ }
      nodes.push(
        <div key={key++} style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>{head.map((h, n) => <th key={n} style={S.th}>{inline(h, `th${key}-${n}`)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((row, r) => (
                <tr key={r}>{row.map((c, n) => <td key={n} style={S.td}>{inline(c, `td${key}-${r}-${n}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    if (/^[-*] /.test(line.trim())) {
      const items: string[] = []
      while (i < lines.length && /^[-*] /.test(lines[i].trim())) { items.push(lines[i].trim().slice(2)); i++ }
      nodes.push(
        <ul key={key++} style={S.ul}>
          {items.map((it, n) => <li key={n} style={S.li}>{inline(it, `li${key}-${n}`)}</li>)}
        </ul>,
      )
      continue
    }

    // Paragraph: gather until a blank line or a block starter.
    const para: string[] = []
    while (
      i < lines.length && lines[i].trim() &&
      !/^(#{1,3} |[-*] |\||---+$)/.test(lines[i].trim())
    ) { para.push(lines[i].trim()); i++ }
    if (para.length) {
      nodes.push(<p key={key++} style={S.p}>{inline(para.join(' '), `p${key}`)}</p>)
    }
  }

  return nodes
}

export default function PrivacyPage() {
  const md = fs.readFileSync(path.join(process.cwd(), 'src/app/privacy/policy.md'), 'utf8')
  return (
    <main style={S.page}>
      <article style={S.card}>{render(md)}</article>
      <p style={S.footer}>
        <a href="/delete-account" style={S.link}>Delete your account</a>
      </p>
    </main>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(ellipse at top, #1f0f18 0%, #0a0a0c 60%, #050507 100%)',
    color: '#C9BFC5',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '36px 20px 72px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  card: { width: '100%', maxWidth: 680 },
  h1: { fontSize: 28, lineHeight: 1.2, color: '#E8E0D0', margin: '0 0 20px' },
  h2: { fontSize: 19, lineHeight: 1.3, color: '#E8E0D0', margin: '34px 0 10px' },
  h3: { fontSize: 15, lineHeight: 1.35, color: '#E8E0D0', margin: '24px 0 8px' },
  p:  { fontSize: 15, lineHeight: 1.65, margin: '0 0 14px' },
  ul: { margin: '0 0 16px', paddingLeft: 22 },
  li: { fontSize: 15, lineHeight: 1.65, margin: '0 0 7px' },
  hr: { border: 0, borderTop: '1px solid rgba(255,255,255,0.10)', margin: '30px 0' },
  strong: { color: '#E8E0D0', fontWeight: 600 },
  link: { color: '#f0a5c0' },
  code: {
    fontFamily: 'ui-monospace, Menlo, monospace',
    fontSize: '0.88em',
    background: 'rgba(255,255,255,0.06)',
    padding: '1px 5px',
  },
  tableWrap: { overflowX: 'auto', margin: '0 0 18px' },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 14 },
  th: {
    textAlign: 'left', padding: '8px 12px 8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.22)',
    color: '#E8E0D0', fontWeight: 600, verticalAlign: 'top',
  },
  td: {
    padding: '9px 12px 9px 0',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    verticalAlign: 'top', lineHeight: 1.55,
  },
  footer: { fontSize: 14, color: '#7A6C75', marginTop: 36 },
}
