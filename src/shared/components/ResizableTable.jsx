import { useState, useRef, useCallback } from 'react'

export default function ResizableTable({ columns, children, thStyle = {}, tableStyle = {} }) {
  const [widths, setWidths] = useState(() => columns.map(c => c.width || 120))
  const resizing = useRef(null)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = useCallback((e, idx) => {
    e.preventDefault()
    resizing.current = idx
    startX.current = e.clientX
    startW.current = widths[idx]

    const onMove = (ev) => {
      if (resizing.current === null) return
      const diff = ev.clientX - startX.current
      setWidths(prev => {
        const next = [...prev]
        next[resizing.current] = Math.max(50, startW.current + diff)
        return next
      })
    }

    const onUp = () => {
      resizing.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [widths])

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: widths.reduce((s, w) => s + w, 0), ...tableStyle }}>
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={col.key || idx} style={{ ...thStyle, width: widths[idx], position: 'relative', userSelect: 'none', ...col.thStyle }}>
                {col.label}
                <div
                  onMouseDown={e => onMouseDown(e, idx)}
                  style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', background: 'transparent', zIndex: 1 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#185FA5'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                />
              </th>
            ))}
          </tr>
        </thead>
        {children}
      </table>
    </div>
  )
}
