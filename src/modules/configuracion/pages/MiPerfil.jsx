/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: MiPerfil.jsx
 * Módulo:  Configuracion
 * ============================================================
 */

import { useState, useRef } from 'react'
import { updatePassword, updateEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { doc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db } from '../../../firebase/firestore'
import { useAuth } from '../../../context/AuthContext'
import auth from '../../../firebase/auth'

function SectionCard({ title, icon, children }) {
  return (
    <div style={{ background: '#fff', border: '1.5px solid var(--eco-primary-light)', borderRadius: 8, marginBottom: 14 }}>
      <div style={{ padding: '11px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 8, background: '#f9fbf9' }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>{title}</span>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )
}

const inputStyle = (focused) => ({
  border: `1.5px solid ${focused ? 'var(--eco-primary)' : '#d0d8d0'}`,
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 12,
  color: '#1a1a1a',
  background: focused ? '#f7fbf8' : '#fff',
  width: '100%',
  outline: 'none',
  fontFamily: 'inherit',
})

function Input({ label, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 10, fontWeight: 500, color: '#5c6b5c', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</label>
      <input {...props} style={inputStyle(focused)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
    </div>
  )
}

export default function MiPerfil() {
  const { user, usuario } = useAuth()
  const fotoRef = useRef()

  const [nombre, setNombre] = useState(usuario?.nombre || '')
  const [email, setEmail] = useState(usuario?.email || '')
  const [fotoURL, setFotoURL] = useState(usuario?.fotoURL || '')
  const [fotoPreview, setFotoPreview] = useState(usuario?.fotoURL || '')
  const [subiendoFoto, setSubiendoFoto] = useState(false)

  const [passActual, setPassActual] = useState('')
  const [passNueva, setPassNueva] = useState('')
  const [passConfirm, setPassConfirm] = useState('')

  const [msgPerfil, setMsgPerfil] = useState('')
  const [msgPass, setMsgPass] = useState('')
  const [guardando, setGuardando] = useState(false)

  const handleFoto = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFotoPreview(URL.createObjectURL(file))
    setSubiendoFoto(true)
    try {
      const { ref: storageRef, uploadBytes: ub, getDownloadURL: gdl } = await import('firebase/storage')
      const { storage } = await import('../../../firebase/config')
      const r = storageRef(storage, `usuarios/${user.uid}/foto_${Date.now()}`)
      await uploadBytes(r, file)
      const url = await getDownloadURL(r)
      setFotoURL(url)
    } catch (err) {
      console.error(err)
    } finally {
      setSubiendoFoto(false)
    }
  }

  const guardarPerfil = async () => {
    setGuardando(true)
    setMsgPerfil('')
    try {
      await updateDoc(doc(db, 'usuarios', user.uid), { nombre, fotoURL })
      setMsgPerfil('✓ Perfil actualizado')
    } catch (err) {
      setMsgPerfil('Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const cambiarPassword = async () => {
    if (passNueva !== passConfirm) { setMsgPass('Las contraseñas no coinciden'); return }
    if (passNueva.length < 6) { setMsgPass('Mínimo 6 caracteres'); return }
    setMsgPass('')
    try {
      const credential = EmailAuthProvider.credential(user.email, passActual)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, passNueva)
      setPassActual(''); setPassNueva(''); setPassConfirm('')
      setMsgPass('✓ Contraseña actualizada')
    } catch (err) {
      setMsgPass('Contraseña actual incorrecta')
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 500, color: '#1a1a1a', margin: 0 }}>Mi Perfil</h2>
        <p style={{ fontSize: 12, color: '#5c6b5c', marginTop: 3 }}>Información personal y configuración de acceso</p>
      </div>

      {/* FOTO Y NOMBRE */}
      <SectionCard title="Información personal" icon={
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="#1a6e3c" strokeWidth="1.5"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="#1a6e3c" strokeWidth="1.5"/></svg>
      }>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--eco-primary-light)',
              border: '2.5px solid var(--eco-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', fontSize: 24, fontWeight: 500, color: 'var(--eco-primary)',
            }}>
              {fotoPreview
                ? <img src={fotoPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (nombre?.charAt(0)?.toUpperCase() || 'A')
              }
            </div>
            <button
              onClick={() => fotoRef.current.click()}
              style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 24, height: 24, borderRadius: '50%',
                background: 'var(--eco-primary)', border: '2px solid #fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#fff" strokeWidth="2"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#fff" strokeWidth="2"/></svg>
            </button>
            <input ref={fotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFoto} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{nombre || 'Sin nombre'}</div>
            <div style={{ fontSize: 11, color: '#8a9e8a', marginTop: 2 }}>{usuario?.email}</div>
            <div style={{
              display: 'inline-block', marginTop: 6,
              background: 'var(--eco-primary-light)', color: 'var(--eco-primary)',
              fontSize: 10, fontWeight: 500, padding: '2px 10px', borderRadius: 10,
            }}>
              {usuario?.rol || 'Administrador'}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <Input label="Nombre completo" value={nombre} onChange={e => setNombre(e.target.value)} />
          <Input label="Correo electrónico" value={email} disabled style={{ opacity: .6 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
          {msgPerfil && <span style={{ fontSize: 12, color: 'var(--eco-primary)' }}>{msgPerfil}</span>}
          <button
            onClick={guardarPerfil}
            disabled={guardando}
            style={{ background: 'var(--eco-primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </SectionCard>

      {/* CONTRASEÑA */}
      <SectionCard title="Cambiar contraseña" icon={
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#1a6e3c" strokeWidth="1.5"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="#1a6e3c" strokeWidth="1.5"/></svg>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          <Input label="Contraseña actual" type="password" value={passActual} onChange={e => setPassActual(e.target.value)} />
          <Input label="Nueva contraseña" type="password" value={passNueva} onChange={e => setPassNueva(e.target.value)} />
          <Input label="Confirmar nueva contraseña" type="password" value={passConfirm} onChange={e => setPassConfirm(e.target.value)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
          {msgPass && <span style={{ fontSize: 12, color: msgPass.startsWith('✓') ? 'var(--eco-primary)' : '#cc3333' }}>{msgPass}</span>}
          <button
            onClick={cambiarPassword}
            style={{ background: 'var(--eco-primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
          >
            Actualizar contraseña
          </button>
        </div>
      </SectionCard>
    </div>
  )
}
