/**
 * UserAvatar — Avatar reutilizable para todo el CRM
 * Muestra fotoURL si existe, o busca por uid, o iniciales con color consistente
 */
import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'

const COLORES = ['#185FA5','#534AB7','#0F6E56','#993C1D','#854F0B','#A32D2D','#3C3489','#3B6D11']

const colorFromName = (name = '') => {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORES[Math.abs(hash) % COLORES.length]
}

const iniciales = (name = '') => name.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase()).join('')

// Cache global para no repetir queries
const _cache = {}

export default function UserAvatar({ nombre, fotoURL, uid, size = 24, style = {} }) {
  const [foto, setFoto] = useState(fotoURL || null)

  useEffect(() => {
    if (fotoURL) { setFoto(fotoURL); return }
    if (!uid) return
    if (_cache[uid] !== undefined) { setFoto(_cache[uid]); return }
    getDoc(doc(db, 'usuarios', uid)).then(snap => {
      const url = snap.exists() ? (snap.data().fotoURL || null) : null
      _cache[uid] = url
      setFoto(url)
    }).catch(() => { _cache[uid] = null })
  }, [uid, fotoURL])

  if (foto) {
    return <img src={foto} alt={nombre} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...style }} />
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: colorFromName(nombre),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
      ...style,
    }}>
      {iniciales(nombre)}
    </div>
  )
}
