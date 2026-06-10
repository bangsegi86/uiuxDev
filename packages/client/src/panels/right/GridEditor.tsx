import { useState } from 'react'
import type { NodeInstance } from '@uiux/shared'
import { useI18n } from '../../i18n/I18nContext'

export interface GridColumn {
  title: string
  width: number
  colSpan?: number
}

interface Props {
  node: NodeInstance
  updateProp: (id: string, key: string, value: unknown) => void
  checkpoint: () => void
}

/** Bespoke editor for the grid/table primitive: columns, rows, header spans. */
export function GridEditor({ node, updateProp, checkpoint }: Props) {
  const { t } = useI18n()
  const columns = (node.props.columns as GridColumn[] | undefined) ?? []
  const rowCount = (node.props.rowCount as number | undefined) ?? 0
  const [json, setJson] = useState('')
  const [jsonOpen, setJsonOpen] = useState(false)
  const [jsonErr, setJsonErr] = useState<string | null>(null)

  const setColumns = (cols: GridColumn[]) => {
    checkpoint()
    updateProp(node.id, 'columns', cols)
  }

  const updateCol = (i: number, patch: Partial<GridColumn>) => {
    const next = columns.map((c, idx) => (idx === i ? { ...c, ...patch } : c))
    setColumns(next)
  }

  const addColumn = () =>
    setColumns([...columns, { title: `Col ${columns.length + 1}`, width: 120, colSpan: 1 }])
  const removeColumn = (i: number) => setColumns(columns.filter((_, idx) => idx !== i))

  const setRows = (n: number) => {
    checkpoint()
    updateProp(node.id, 'rowCount', Math.max(0, n))
  }

  const openJson = () => {
    setJson(JSON.stringify(columns, null, 2))
    setJsonErr(null)
    setJsonOpen(true)
  }
  const applyJson = () => {
    try {
      const parsed = JSON.parse(json)
      if (!Array.isArray(parsed)) throw new Error('not an array')
      setColumns(parsed)
      setJsonOpen(false)
      setJsonErr(null)
    } catch {
      setJsonErr(t.invalidJson)
    }
  }

  return (
    <div className="grid-editor">
      <div className="grid-cols">
        {columns.map((c, i) => (
          <div className="grid-col-row" key={i}>
            <input
              className="grid-col-title"
              value={c.title}
              onChange={(e) => updateCol(i, { title: e.target.value })}
              placeholder={t.columnTitle}
            />
            <input
              className="grid-col-w"
              type="number"
              value={c.width}
              title={t.width}
              onChange={(e) => updateCol(i, { width: Number(e.target.value) })}
            />
            <input
              className="grid-col-span"
              type="number"
              min={1}
              value={c.colSpan ?? 1}
              title={t.colSpan}
              onChange={(e) => updateCol(i, { colSpan: Math.max(1, Number(e.target.value)) })}
            />
            <button className="icon-btn" title={t.delete} onClick={() => removeColumn(i)}>
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="grid-actions">
        <button onClick={addColumn}>＋ {t.addColumn}</button>
      </div>

      <label className="field inline">
        <span>{t.rows}</span>
        <input type="number" min={0} value={rowCount} onChange={(e) => setRows(Number(e.target.value))} />
      </label>
      <div className="grid-actions">
        <button onClick={() => setRows(rowCount + 1)}>＋ {t.addRow}</button>
        <button onClick={() => setRows(rowCount - 1)} disabled={rowCount <= 0}>
          － {t.removeRow}
        </button>
      </div>

      <button className="grid-json-toggle" onClick={jsonOpen ? () => setJsonOpen(false) : openJson}>
        {jsonOpen ? '▾' : '▸'} {t.editAsJson}
      </button>
      {jsonOpen && (
        <div className="grid-json">
          <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={8} />
          {jsonErr && <div className="auth-error">{jsonErr}</div>}
          <button className="primary" onClick={applyJson}>
            {t.apply}
          </button>
        </div>
      )}
    </div>
  )
}
