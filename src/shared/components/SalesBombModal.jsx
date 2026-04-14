/**
 * SalesBombModal — Celebración de ventas en tiempo real
 * Se monta en MainLayout y escucha ventas_celebraciones
 */
import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, getDoc, limit } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { crearNotificacion } from '../../services/notificaciones'
import Confetti from './Confetti'

// ── Sonidos con Web Audio API ──
function playVictorySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notas = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.4)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.15)
      osc.stop(ctx.currentTime + i * 0.15 + 0.4)
    })
    // Acorde final brillante
    setTimeout(() => {
      [1046.5, 1318.5, 1568].forEach(freq => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.2, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.8)
      })
    }, 600)
  } catch {}
}

function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notas = [440, 392, 349.23] // A4, G4, F4 — descendente
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.25)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.25 + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.25)
      osc.stop(ctx.currentTime + i * 0.25 + 0.3)
    })
  } catch {}
}

const EMOJIS = ['👍','🔥','🎉','❤️','👏','💪','🚀']

const colorFromName = (name = '') => {
  const colors = ['#185FA5','#534AB7','#0F6E56','#993C1D','#854F0B','#A32D2D','#3C3489','#3B6D11']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

const iniciales = (name = '') => name.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase()).join('')

export default function SalesBombModal({ usuario }) {
  const [celebracion, setCelebracion] = useState(null)
  const [config, setConfig] = useState(null)
  const [timer, setTimer] = useState(null)

  // Cargar config
  useEffect(() => {
    return onSnapshot(doc(db, 'configuracion', 'ventas_celebraciones'), snap => {
      setConfig(snap.exists() ? snap.data() : { activo: false })
    })
  }, [])

  // Escuchar celebraciones
  useEffect(() => {
    if (!config?.activo) return
    if (!usuario?.uid) return

    // Verificar rol
    const rolesQueVen = config.rolesQueVen || []
    // Super Administrador siempre ve las celebraciones
    if (usuario.rol !== 'Super Administrador' && rolesQueVen.length > 0 && !rolesQueVen.includes(usuario.rol)) return

    const q = query(collection(db, 'ventas_celebraciones'), orderBy('creadoEn', 'desc'), limit(1))
    return onSnapshot(q, snap => {
      if (snap.empty) return
      const d = snap.docs[0]
      const data = { id: d.id, ...d.data() }

      // Solo mostrar si fue creado en los últimos 30 segundos
      const ts = data.creadoEn?.toDate ? data.creadoEn.toDate().getTime() : data.creadoEn?.seconds ? data.creadoEn.seconds * 1000 : 0
      if (Date.now() - ts > 30000) return

      // No mostrar si ya lo vio
      if ((data.visto || []).includes(usuario.uid)) return

      setCelebracion(data)
      // Reproducir sonido
      if (data.tipo === 'ganada') playVictorySound()
      else playAlertSound()
    })
  }, [config, usuario?.uid, usuario?.rol])

  // Auto-cierre 15s
  useEffect(() => {
    if (!celebracion) return
    const t = setTimeout(() => cerrar(), 15000)
    setTimer(t)
    return () => clearTimeout(t)
  }, [celebracion?.id])

  const cerrar = useCallback(async () => {
    if (celebracion?.id && usuario?.uid) {
      await updateDoc(doc(db, 'ventas_celebraciones', celebracion.id), { visto: arrayUnion(usuario.uid) }).catch(() => {})
    }
    setCelebracion(null)
    if (timer) clearTimeout(timer)
  }, [celebracion, usuario, timer])

  const reaccionar = async (emoji) => {
    if (!celebracion?.id || !usuario?.uid) return
    const reacciones = celebracion.reacciones || {}
    const lista = reacciones[emoji] || []
    const yaReacciono = lista.includes(usuario.uid)

    if (yaReacciono) {
      await updateDoc(doc(db, 'ventas_celebraciones', celebracion.id), { [`reacciones.${emoji}`]: arrayRemove(usuario.uid) }).catch(() => {})
    } else {
      await updateDoc(doc(db, 'ventas_celebraciones', celebracion.id), { [`reacciones.${emoji}`]: arrayUnion(usuario.uid) }).catch(() => {})
      // Notificar al vendedor
      if (celebracion.vendedorId && celebracion.vendedorId !== usuario.uid) {
        crearNotificacion({
          destinatarioId: celebracion.vendedorId,
          tipo: 'general',
          titulo: `${emoji} ${usuario.nombre || 'Alguien'} reaccionó a tu venta`,
          cuerpo: '',
          link: '/',
        }).catch(() => {})
      }
    }
  }

  if (!celebracion) return null

  const esGanada = celebracion.tipo === 'ganada'
  const bgOverlay = esGanada ? 'rgba(0,0,0,.6)' : 'rgba(100,70,0,.5)'
  const cardBg = esGanada ? '#fff' : '#FFF8E1'
  const borderColor = esGanada ? '#3B6D11' : '#EF9F27'
  const avatarColor = colorFromName(celebracion.vendedorNombre)

  return (
    <>
      {esGanada && <Confetti />}
      <div style={{ position: 'fixed', inset: 0, background: bgOverlay, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn .3s ease' }} onClick={cerrar}>
        <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } } @keyframes scaleIn { from { transform: scale(0.8); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
        <div onClick={e => e.stopPropagation()} style={{ background: cardBg, borderRadius: 20, padding: '32px 40px', maxWidth: 380, width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.3)', border: `3px solid ${borderColor}`, animation: 'scaleIn .4s ease', position: 'relative' }}>

          {/* Botón cerrar */}
          <button onClick={cerrar} style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa', lineHeight: 1 }}>×</button>

          {/* Avatar */}
          <div style={{ margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {celebracion.vendedorAvatar
              ? <img src={celebracion.vendedorAvatar} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 12 }} />
              : <div style={{ width: 80, height: 80, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 28, fontWeight: 700 }}>{iniciales(celebracion.vendedorNombre)}</div>
            }
          </div>

          {/* Texto */}
          {esGanada ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>
                {celebracion.vendedorNombre}
              </div>
              <div style={{ fontSize: 16, color: '#3B6D11', fontWeight: 600, marginBottom: 20 }}>
                hizo una venta 🎉
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#854F0B', marginBottom: 6 }}>
                La venta de {celebracion.vendedorNombre}
              </div>
              <div style={{ fontSize: 14, color: '#854F0B', marginBottom: 6 }}>
                ha sido pausada
              </div>
              <div style={{ fontSize: 13, color: '#a08040', marginBottom: 20 }}>
                ¡Apoyo para recuperarla!
              </div>
            </>
          )}

          {/* Reacciones */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
            {EMOJIS.map(emoji => {
              const lista = celebracion.reacciones?.[emoji] || []
              const activo = lista.includes(usuario?.uid)
              return (
                <button key={emoji} onClick={() => reaccionar(emoji)} style={{
                  padding: '6px 12px', borderRadius: 20, border: activo ? '2px solid #185FA5' : '1.5px solid #e0e0e0',
                  background: activo ? '#E6F1FB' : '#fafafa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 16, fontFamily: 'inherit', transition: 'all .15s',
                }}>
                  {emoji}
                  {lista.length > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: activo ? '#185FA5' : '#888' }}>{lista.length}</span>}
                </button>
              )
            })}
          </div>

          {/* Timer visual */}
          <div style={{ marginTop: 16, fontSize: 10, color: '#bbb' }}>Se cierra automáticamente</div>
        </div>
      </div>
    </>
  )
}
