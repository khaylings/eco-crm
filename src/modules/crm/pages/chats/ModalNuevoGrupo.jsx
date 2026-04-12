// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: src/modules/crm/pages/chats/ModalNuevoGrupo.jsx
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Avatar, sel } from './ChatComponents'

export default function ModalNuevoGrupo({ usuarios, onCrear, onCerrar, usuarioActual }) {
  const [tipo,      setTipo]      = useState('individual')
  const [nombre,    setNombre]    = useState('')
  const [miembros,  setMiembros]  = useState([usuarioActual?.uid].filter(Boolean))
  const [guardando, setGuardando] = useState(false)

  const otrosUsuarios  = usuarios.filter(u => u.uid !== usuarioActual?.uid)
  const seleccionadoUid = tipo === 'individual' ? miembros.find(uid => uid !== usuarioActual?.uid) : null
  const puedeCrear     = tipo === 'individual' ? !!seleccionadoUid : (nombre.trim() && miembros.length >= 2)

  const toggleMiembro = (uid) => {
    if (uid === usuarioActual?.uid) return
    if (tipo === 'individual') { setMiembros([usuarioActual?.uid, uid]) }
    else { setMiembros(prev => prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]) }
  }

  const crear = async () => {
    if (!puedeCrear) return
    setGuardando(true)
    if (tipo === 'individual') {
      const otro = otrosUsuarios.find(u => u.uid === seleccionadoUid)
      await onCrear({ nombre: otro?.nombre || otro?.email || 'Chat', miembros, individual: true })
    } else {
      await onCrear({ nombre: nombre.trim(), miembros, individual: false })
    }
    setGuardando(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', backdropFilter:'blur(3px)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background:'#fff', borderRadius:14, width:'90%', maxWidth:420, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding:'14px 18px', borderBottom:'0.5px solid rgba(0,0,0,.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontWeight:600, fontSize:14 }}>Nuevo chat interno</span>
          <button onClick={onCerrar} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#aaa' }}>×</button>
        </div>
        <div style={{ padding:'14px 18px 0', display:'flex', gap:8 }}>
          {[{ key:'individual', label:'👤 Individual', desc:'Chat con una persona' }, { key:'grupal', label:'👥 Grupal', desc:'Chat con varios' }].map(t => (
            <button key={t.key} onClick={() => { setTipo(t.key); setMiembros([usuarioActual?.uid].filter(Boolean)); setNombre('') }}
              style={{ flex:1, padding:'10px 12px', borderRadius:10, cursor:'pointer', fontFamily:'inherit', textAlign:'center', border:`2px solid ${tipo===t.key?'#0F6E56':'#e0e0e0'}`, background:tipo===t.key?'#f0faf6':'#fafafa', color:tipo===t.key?'#0F6E56':'#888' }}>
              <div style={{ fontSize:13, fontWeight:600 }}>{t.label}</div>
              <div style={{ fontSize:10, marginTop:2, opacity:0.7 }}>{t.desc}</div>
            </button>
          ))}
        </div>
        <div style={{ padding:18, display:'flex', flexDirection:'column', gap:14 }}>
          {tipo === 'grupal' && (
            <div>
              <label style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'.5px', display:'block', marginBottom:4 }}>Nombre del grupo</label>
              <input style={{ ...sel, fontSize:13 }} placeholder="Ej: Equipo ventas..." value={nombre} onChange={e => setNombre(e.target.value)} autoFocus />
            </div>
          )}
          <div>
            <label style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'.5px', display:'block', marginBottom:8 }}>
              {tipo === 'individual' ? 'Elegí con quién hablar' : 'Miembros del grupo'}
            </label>
            <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:240, overflowY:'auto' }}>
              {otrosUsuarios.map(u => {
                const selec = miembros.includes(u.uid)
                return (
                  <div key={u.uid} onClick={() => toggleMiembro(u.uid)}
                    style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', padding:'8px 12px', borderRadius:8, background:selec?'#f0faf6':'#fafafa', border:`0.5px solid ${selec?'#0F6E56':'transparent'}` }}>
                    {tipo === 'grupal'
                      ? <input type="checkbox" checked={selec} onChange={() => {}} style={{ accentColor:'#0F6E56', flexShrink:0, pointerEvents:'none' }} />
                      : <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${selec?'#0F6E56':'#ccc'}`, background:selec?'#0F6E56':'transparent', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {selec && <div style={{ width:7, height:7, borderRadius:'50%', background:'#fff' }} />}
                        </div>
                    }
                    <Avatar nombre={u.nombre || u.email} foto={u.fotoURL} size={28} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:'#1a1a1a' }}>{u.nombre || u.email}</div>
                      {u.rol && <div style={{ fontSize:10, color:'#aaa' }}>{u.rol}</div>}
                    </div>
                    {selec && <span style={{ color:'#0F6E56', fontSize:14, fontWeight:700 }}>✓</span>}
                  </div>
                )
              })}
            </div>
          </div>
          {tipo === 'grupal' && miembros.length < 2 && <p style={{ fontSize:11, color:'#A32D2D', margin:0 }}>Seleccioná al menos un miembro.</p>}
        </div>
        <div style={{ padding:'12px 18px', borderTop:'0.5px solid rgba(0,0,0,.08)', display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onCerrar} style={{ padding:'7px 14px', border:'0.5px solid rgba(0,0,0,.15)', borderRadius:7, fontSize:12, cursor:'pointer', background:'#f5f5f5', fontFamily:'inherit' }}>Cancelar</button>
          <button onClick={crear} disabled={guardando || !puedeCrear}
            style={{ padding:'7px 18px', border:'none', borderRadius:7, fontSize:12, fontWeight:500, cursor:guardando||!puedeCrear?'not-allowed':'pointer', background:!puedeCrear?'#e0e0e0':'#0F6E56', color:!puedeCrear?'#aaa':'#fff', fontFamily:'inherit' }}>
            {guardando ? 'Creando...' : tipo === 'individual' ? 'Iniciar chat' : 'Crear grupo'}
          </button>
        </div>
      </div>
    </div>
  )
}
