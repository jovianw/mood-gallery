import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useMemo } from 'react'

/** A KaTeX-rendered equation. `display` puts it on its own line. */
export function Math({ tex, display = false }: { tex: string; display?: boolean }) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html' }),
    [tex, display],
  )
  return display ? (
    <div className="eq" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className="eq-inline" dangerouslySetInnerHTML={{ __html: html }} />
  )
}
