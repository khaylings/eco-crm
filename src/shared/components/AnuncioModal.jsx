/**
 * AnuncioModal.jsx
 * Modal que muestra anuncios del Super Admin a todos los usuarios al entrar al CRM.
 * Se marca como leído por usuario para no volver a mostrarse.
 * Incluye reacciones con emojis.
 */

import { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'

const REACCIONES = ['👍', '❤️', '🎉', '🚀', '👏']

export default function AnuncioModal() {
  const { usuario } = useAuth()
  const [anuncio, setAnuncio] = useState(null)
  const [visible, setVisible] = useState(false)
  const [reaccionada, setReaccionada] = useState(null)

  useEffect(() => {
    if (!usuario?.uid) return
    const q = query(collection(db, 'anuncios'), orderBy('creadoEn', 'desc'))
    return onSnapshot(q, snap => {
      const anuncios = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // Buscar el último anuncio activo que el usuario NO ha leído
      const noLeido = anuncios.find(a =>
        a.activo !== false && !(a.leidoPor || []).includes(usuario.uid)
      )
      if (noLeido) {
        setAnuncio(noLeido)
        setVisible(true)
        // Verificar si ya reaccionó
        const reacciones = noLeido.reacciones || {}
        const yaReacciono = Object.entries(reacciones).find(([emoji, uids]) => (uids || []).includes(usuario.uid))
        setReaccionada(yaReacciono ? yaReacciono[0] : null)
      }
    })
  }, [usuario?.uid])

  const reaccionar = async (emoji) => {
    if (!anuncio) return
    const ref = doc(db, 'anuncios', anuncio.id)
    if (reaccionada === emoji) {
      // Quitar reacción
      await updateDoc(ref, { [`reacciones.${emoji}`]: arrayRemove(usuario.uid) })
      setReaccionada(null)
    } else {
      // Quitar reacción anterior si había
      if (reaccionada) {
        await updateDoc(ref, { [`reacciones.${reaccionada}`]: arrayRemove(usuario.uid) })
      }
      // Agregar nueva
      await updateDoc(ref, { [`reacciones.${emoji}`]: arrayUnion(usuario.uid) })
      setReaccionada(emoji)
    }
  }

  const marcarLeido = async () => {
    if (!anuncio) return
    await updateDoc(doc(db, 'anuncios', anuncio.id), {
      leidoPor: arrayUnion(usuario.uid)
    })
    setVisible(false)
    setAnuncio(null)
  }

  if (!visible || !anuncio) return null

  // Contar reacciones totales
  const reacciones = anuncio.reacciones || {}
  const totalReacciones = Object.values(reacciones).reduce((acc, arr) => acc + (arr?.length || 0), 0)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '90%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden', position: 'relative' }}>
        {/* Botón cerrar */}
        <button onClick={marcarLeido} style={{ position: 'absolute', top: 12, right: 12, zIndex: 1, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.2)', color: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        {/* Header con gradiente */}
        <div style={{ background: 'linear-gradient(135deg, #1a3a5c 0%, #185FA5 100%)', padding: '24px 28px', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {anuncio.autorFoto
              ? <img src={anuncio.autorFoto} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,.3)' }} />
              : <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, border: '2px solid rgba(255,255,255,.3)' }}>
                  {(anuncio.autorNombre || '?')[0]?.toUpperCase()}
                </div>
            }
            <div>
              <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 500 }}>Anuncio de</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{anuncio.autorNombre || 'Administrador'}</div>
            </div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 16, lineHeight: 1.3 }}>
            {anuncio.titulo || 'Nueva actualización'}
          </div>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: '20px 28px', maxHeight: 300, overflowY: 'auto' }}>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: '#333', whiteSpace: 'pre-wrap' }}>
            {anuncio.mensaje}
          </div>
          {anuncio.version && (
            <div style={{ marginTop: 12, fontSize: 11, color: '#aaa', fontWeight: 500 }}>
              Versión {anuncio.version}
            </div>
          )}
        </div>

        {/* Reacciones */}
        <div style={{ padding: '0 28px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {REACCIONES.map(emoji => {
            const count = (reacciones[emoji] || []).length
            const seleccionado = reaccionada === emoji
            return (
              <button key={emoji} onClick={() => reaccionar(emoji)} style={{
                padding: '4px 10px', borderRadius: 20, border: seleccionado ? '2px solid #185FA5' : '1px solid #e0e0e0',
                background: seleccionado ? '#EEF3FA' : '#f8f9fb', cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
                transform: seleccionado ? 'scale(1.1)' : 'scale(1)', transition: 'all .15s',
              }}>
                {emoji}
                {count > 0 && <span style={{ fontSize: 11, color: '#555', fontWeight: 600 }}>{count}</span>}
              </button>
            )
          })}
          {totalReacciones > 0 && (
            <span style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}>{totalReacciones} reacciones</span>
          )}
        </div>

        <div style={{ height: 12 }} />
      </div>
    </div>
  )
}
