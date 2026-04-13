import { useRef } from 'react'

const fmtDMY = (iso) => iso ? iso.split('-').reverse().join('/') : ''

export default function DateInput({ value, onChange, style, ...props }) {
  const ref = useRef()
  return (
    <div style={{ position: 'relative', ...style }} onClick={() => ref.current?.showPicker?.()}>
      <input
        ref={ref}
        type="date"
        value={value || ''}
        onChange={onChange}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
        {...props}
      />
      <div style={{ padding: '7px 10px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: 7, fontSize: 13, background: '#fff', color: value ? 'inherit' : '#aaa', cursor: 'pointer', userSelect: 'none' }}>
        {value ? fmtDMY(value) : 'dd/mm/aaaa'}
      </div>
    </div>
  )
}
