import { useEffect, useState } from 'react'

const COLORS = ['#E24B4A','#185FA5','#3B6D11','#EF9F27','#534AB7','#0F6E56','#993C1D','#D4537E']

export default function Confetti({ duracion = 4000 }) {
  const [piezas] = useState(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      size: 6 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      drift: -20 + Math.random() * 40,
      dur: 2 + Math.random() * 2,
    }))
  )
  const [visible, setVisible] = useState(true)
  useEffect(() => { const t = setTimeout(() => setVisible(false), duracion); return () => clearTimeout(t) }, [duracion])
  if (!visible) return null

  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10010, overflow: 'hidden' }}>
        {piezas.map(p => (
          <div key={p.id} style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: -20,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            borderRadius: 1,
            animation: `confetti-fall ${p.dur}s ease-in ${p.delay}s forwards`,
            transform: `translateX(${p.drift}px)`,
          }} />
        ))}
      </div>
    </>
  )
}
