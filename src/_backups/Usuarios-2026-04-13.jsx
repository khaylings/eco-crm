import { useState, useEffect } from 'react'
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db } from '../../../firebase/firestore'
import { useAuth } from '../../../context/AuthContext'

// ─── Roles ────────────────────────────────────────────────────────────────────
const ROLES_BASE = ['Super Administrador', 'Administrador', 'Supervisor', 'Vendedor', 'Técnico', 'Solo lectura']

const ROL_COLORES = {
  'Super Administrador': '#7c1d1d',
  'Administrador':       '#1a6e3c',
  'Supervisor':          '#185FA5',
  'Vendedor':            '#854F0B',
  'Técnico':             '#534AB7',
  'Solo lectura':        '#5F5E5A',
}

const ROL_NIVEL = {
  'Super Administrador': 100,
  'Administrador':        50,
  'Supervisor':           30,
  'Vendedor':             20,
  'Técnico':              15,
  'Solo lectura':          5,
}

function generarPasswordAleatoria() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const inputSt = {
  border: '1.5px solid #d0d8d0', borderRadius: 6, padding: '8px 10px',
  fontSize: 12, color: '#1a1a1a', background: '#fff', width: '100%',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}

const btnSt = (color = '#1a6e3c', outline = false) => ({
  background: outline ? '#fff' : color,
  color: outline ? color : '#fff',
  border: `1px solid ${outline ? '#c8d8c8' : color}`,
  borderRadius: 7, padding: '8px 18px', fontSize: 13,
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
})

function Modal({ onClose, children, width = 480 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 10, width,
        border: '1.5px solid #c8d8c8', overflow: 'hidden',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ title, onClose }) {
  return (
    <div style={{ padding: '18px 24px', borderBottom: '1px solid #e8f0e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>{title}</h3>
      <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
    </div>
  )
}

function RolBadge({ rol }) {
  const color = ROL_COLORES[rol] || '#5F5E5A'
  return (
    <span style={{
      background: color + '18', color, border: `1px solid ${color}40`,
      borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
      display: 'inline-block', whiteSpace: 'nowrap',
    }}>{rol}</span>
  )
}

function Avatar({ nombre, size = 34 }) {
  const letra = (nombre || '?')[0].toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: '#d4e8d4',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.38, color: '#1a6e3c', flexShrink: 0,
    }}>{letra}</div>
  )
}

function Toggle({ value, onChange, disabled }) {
  return (
    <div onClick={() => !disabled && onChange(!value)} style={{
      width: 38, height: 22, borderRadius: 11,
      cursor: disabled ? 'not-allowed' : 'pointer',
      background: value ? '#1a6e3c' : '#ccc',
      position: 'relative', transition: 'background .2s',
      flexShrink: 0, opacity: disabled ? 0.4 : 1,
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: value ? 19 : 3,
        transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Usuarios() {
  const authCtx = useAuth()
  const yo      = authCtx.usuario || authCtx.currentUser || authCtx.user || null
  const miUID   = yo?.uid
  const miRol   = yo?.rol

  const esSuperAdmin       = miRol === 'Super Administrador'
  const puedeResetearOtros = esSuperAdmin || yo?.puedeResetearPassword === true
  const esAdmin            = esSuperAdmin || miRol === 'Administrador'

  const [usuarios, setUsuarios]         = useState([])
  const [buscador, setBuscador]         = useState('')
  const [guardando, setGuardando]       = useState(false)

  const [modalOpen, setModalOpen]       = useState(false)
  const [editando, setEditando]         = useState(null)
  const [form, setForm]                 = useState({ nombre: '', email: '', rol: 'Supervisor', activo: true, password: '' })
  const [errModal, setErrModal]         = useState('')

  const [resetTarget, setResetTarget]   = useState(null)
  const [resetPass, setResetPass]       = useState('')
  const [resetVerPass, setResetVerPass] = useState('')
  const [resetMostrar, setResetMostrar] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetOk, setResetOk]           = useState(false)
  const [resetErr, setResetErr]         = useState('')
  const [passCopiada, setPassCopiada]   = useState(false)

  const [eliminarTarget, setEliminarTarget] = useState(null)

  const cargarUsuarios = async () => {
    const snap = await getDocs(collection(db, 'usuarios'))
    setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }
  useEffect(() => { cargarUsuarios() }, [])

  const miNivel          = ROL_NIVEL[miRol] || 0
  const rolesDisponibles = ROLES_BASE.filter(r => ROL_NIVEL[r] < miNivel)

  const puedeEditar   = (u) => u.id !== miUID && miNivel > (ROL_NIVEL[u.rol] || 0)
  const puedeEliminar = (u) => esSuperAdmin && u.id !== miUID
  const puedeResetear = (u) => {
    if (u.id === miUID) return false
    if (!puedeResetearOtros) return false
    if (u.rol === 'Super Administrador' && !esSuperAdmin) return false
    return true
  }

  const abrirCrear = () => {
    setEditando(null)
    setForm({ nombre: '', email: '', rol: rolesDisponibles[0] || 'Solo lectura', activo: true, password: '' })
    setErrModal(''); setModalOpen(true)
  }

  const abrirEditar = (u) => {
    setEditando(u)
    setForm({ nombre: u.nombre || '', email: u.email || '', rol: u.rol || 'Solo lectura', activo: u.activo !== false, password: '' })
    setErrModal(''); setModalOpen(true)
  }

  const guardar = async () => {
    if (!form.nombre.trim() || !form.email.trim()) { setErrModal('Nombre y email son obligatorios.'); return }
    if (!editando && form.password.length < 6)     { setErrModal('La contraseña debe tener al menos 6 caracteres.'); return }
    setGuardando(true); setErrModal('')
    try {
      if (editando) {
        await updateDoc(doc(db, 'usuarios', editando.id), {
          nombre: form.nombre, rol: form.rol, activo: form.activo,
        })
      } else {
        const authInst = getAuth()
        const cred = await createUserWithEmailAndPassword(authInst, form.email, form.password)
        await setDoc(doc(db, 'usuarios', cred.user.uid), {
          nombre: form.nombre, email: form.email, rol: form.rol,
          activo: form.activo, creadoEn: new Date().toISOString(),
          puedeResetearPassword: false,
        })
      }
      await cargarUsuarios(); setModalOpen(false)
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') setErrModal('Ese email ya está registrado.')
      else if (e.code === 'auth/weak-password')   setErrModal('La contraseña debe tener al menos 6 caracteres.')
      else setErrModal('Error: ' + e.message)
    }
    setGuardando(false)
  }

  const togglePermisoReset = async (u) => {
    const nuevo = !(u.puedeResetearPassword === true)
    await updateDoc(doc(db, 'usuarios', u.id), { puedeResetearPassword: nuevo })
    await cargarUsuarios()
  }

  const abrirReset = (u) => {
    setResetTarget(u); setResetPass(''); setResetVerPass('')
    setResetMostrar(false); setResetOk(false); setResetErr(''); setPassCopiada(false)
  }

  const generarAleatoria = () => {
    const p = generarPasswordAleatoria()
    setResetPass(p); setResetVerPass(p); setResetErr('')
  }

  const copiarPass = () => {
    navigator.clipboard.writeText(resetPass).then(() => {
      setPassCopiada(true); setTimeout(() => setPassCopiada(false), 2500)
    })
  }

  const ejecutarReset = async () => {
    if (!resetPass.trim())            { setResetErr('Escribí una contraseña.'); return }
    if (resetPass.length < 6)         { setResetErr('Debe tener al menos 6 caracteres.'); return }
    if (resetPass !== resetVerPass)   { setResetErr('Las contraseñas no coinciden.'); return }
    setResetLoading(true); setResetErr('')
    try {
      const fns = getFunctions()
      const fn  = httpsCallable(fns, 'cambiarPasswordUsuario')
      await fn({ targetUID: resetTarget.id, nuevaPassword: resetPass })
      setResetOk(true)
    } catch (e) {
      setResetErr(e.message || 'Error al cambiar la contraseña.')
    }
    setResetLoading(false)
  }

  const eliminar = async () => {
    await deleteDoc(doc(db, 'usuarios', eliminarTarget.id))
    await cargarUsuarios(); setEliminarTarget(null)
  }

  const listaFiltrada = usuarios.filter(u =>
    (u.nombre || '').toLowerCase().includes(buscador.toLowerCase()) ||
    (u.email  || '').toLowerCase().includes(buscador.toLowerCase())
  )

  const cols = esSuperAdmin
    ? '2fr 2.2fr 1.5fr 0.8fr 1.1fr 1.7fr'
    : '2fr 2.2fr 1.5fr 0.8fr 1.7fr'

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1060, margin: '0 auto', fontFamily: 'inherit' }}>

      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>Usuarios del sistema</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>
            {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} registrado{usuarios.length !== 1 ? 's' : ''}
            {miRol && <span style={{ marginLeft: 8, fontSize: 11, color: ROL_COLORES[miRol] || '#666', fontWeight: 600 }}>· Tu rol: {miRol}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input placeholder="Buscar usuario..." value={buscador}
            onChange={e => setBuscador(e.target.value)} style={{ ...inputSt, width: 200 }} />
          {esAdmin && <button onClick={abrirCrear} style={btnSt('#1a6e3c')}>+ Nuevo usuario</button>}
        </div>
      </div>

      {/* Tabla */}
      <div style={{ background: '#fff', border: '1px solid #e0e8e0', borderRadius: 10, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: cols,
          padding: '10px 20px', background: '#f5f8f5',
          borderBottom: '1px solid #e0e8e0',
          fontSize: 11, fontWeight: 700, color: '#888',
          textTransform: 'uppercase', letterSpacing: '.04em',
        }}>
          <span>Usuario</span>
          <span>Email</span>
          <span>Rol</span>
          <span>Estado</span>
          {esSuperAdmin && <span style={{ textAlign: 'center' }}>Reset pass</span>}
          <span style={{ textAlign: 'right' }}>Acciones</span>
        </div>

        {listaFiltrada.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 13 }}>Sin usuarios</div>
        )}

        {listaFiltrada.map((u, i) => (
          <div key={u.id} style={{
            display: 'grid', gridTemplateColumns: cols,
            padding: '12px 20px', alignItems: 'center',
            borderBottom: i < listaFiltrada.length - 1 ? '1px solid #f0f4f0' : 'none',
            background: u.id === miUID ? '#f9fff9' : '#fff',
          }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar nombre={u.nombre} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                  {u.nombre}
                  {u.id === miUID && <span style={{ fontSize: 10, color: '#1a6e3c', marginLeft: 4 }}>(tú)</span>}
                </div>
              </div>
            </div>

            <span style={{ fontSize: 12, color: '#555' }}>{u.email}</span>

            <RolBadge rol={u.rol} />

            <span style={{
              fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '2px 10px', display: 'inline-block',
              color: u.activo !== false ? '#1a6e3c' : '#999',
              background: u.activo !== false ? '#e8f5e9' : '#f0f0f0',
            }}>{u.activo !== false ? 'Activo' : 'Inactivo'}</span>

            {esSuperAdmin && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                {u.id !== miUID && u.rol !== 'Super Administrador' ? (
                  <>
                    <Toggle value={u.puedeResetearPassword === true} onChange={() => togglePermisoReset(u)} />
                    <span style={{ fontSize: 9, color: u.puedeResetearPassword ? '#1a6e3c' : '#aaa' }}>
                      {u.puedeResetearPassword ? 'Con permiso' : 'Sin permiso'}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: '#ccc' }}>—</span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {puedeEditar(u) && (
                <button onClick={() => abrirEditar(u)} style={{
                  fontSize: 11, fontWeight: 600, border: '1px solid #c8d8c8',
                  borderRadius: 6, padding: '4px 10px', cursor: 'pointer', background: '#fff', color: '#1a1a1a',
                }}>Editar</button>
              )}
              {puedeResetear(u) && (
                <button onClick={() => abrirReset(u)} style={{
                  fontSize: 11, fontWeight: 600, border: '1px solid #185FA5',
                  borderRadius: 6, padding: '4px 10px', cursor: 'pointer', background: '#fff', color: '#185FA5',
                }}>🔑 Contraseña</button>
              )}
              {puedeEliminar(u) && (
                <button onClick={() => setEliminarTarget(u)} style={{
                  fontSize: 11, fontWeight: 600, border: '1px solid #e53935',
                  borderRadius: 6, padding: '4px 10px', cursor: 'pointer', background: '#fff', color: '#e53935',
                }}>Eliminar</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {esSuperAdmin && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, fontSize: 11, color: '#7c5a00' }}>
          <strong>Super Administrador:</strong> Usá el toggle <strong>Reset pass</strong> para dar o quitar permiso de cambiar contraseñas a usuarios específicos.
        </div>
      )}

      {/* ── MODAL CREAR / EDITAR ─────────────────────────────────────────────── */}
      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)}>
          <ModalHeader title={editando ? 'Editar usuario' : 'Nuevo usuario'} onClose={() => setModalOpen(false)} />
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Avatar nombre={form.nombre || editando?.nombre} size={56} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>NOMBRE COMPLETO *</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                style={{ ...inputSt, marginTop: 4 }} placeholder="Nombre completo" />
            </div>
            {!editando && (
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>EMAIL *</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  style={{ ...inputSt, marginTop: 4 }} placeholder="correo@empresa.com" type="email" />
              </div>
            )}
            {!editando && (
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>CONTRASEÑA INICIAL *</label>
                <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  style={{ ...inputSt, marginTop: 4 }} placeholder="Mínimo 6 caracteres" type="password" />
              </div>
            )}
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>ROL</label>
              <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
                style={{ ...inputSt, marginTop: 4 }}>
                {rolesDisponibles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
              Usuario activo
            </label>
            {errModal && (
              <div style={{ background: '#fdecea', border: '1px solid #e53935', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#c62828' }}>
                {errModal}
              </div>
            )}
          </div>
          <div style={{ padding: '14px 24px', borderTop: '1px solid #e8f0e8', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={() => setModalOpen(false)} style={btnSt('#1a6e3c', true)}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ ...btnSt('#1a6e3c'), opacity: guardando ? 0.7 : 1 }}>
              {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── MODAL RESET CONTRASEÑA ───────────────────────────────────────────── */}
      {resetTarget && (
        <Modal onClose={() => setResetTarget(null)}>
          <ModalHeader title={`Cambiar contraseña — ${resetTarget.nombre}`} onClose={() => setResetTarget(null)} />
          <div style={{ padding: '24px' }}>
            {!resetOk ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#f5f8f5', borderRadius: 8, border: '1px solid #e0e8e0' }}>
                  <Avatar nombre={resetTarget.nombre} size={42} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>{resetTarget.nombre}</div>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{resetTarget.email}</div>
                    <RolBadge rol={resetTarget.rol} />
                  </div>
                </div>
                <button onClick={generarAleatoria} style={{
                  background: '#f0f7f0', border: '1px dashed #4caf50', borderRadius: 8,
                  padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#1a6e3c',
                  fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: 'inherit', width: '100%', justifyContent: 'center',
                }}>✨ Generar contraseña aleatoria segura</button>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>NUEVA CONTRASEÑA</label>
                  <div style={{ position: 'relative', marginTop: 4 }}>
                    <input
                      value={resetPass}
                      onChange={e => { setResetPass(e.target.value); setResetErr('') }}
                      type={resetMostrar ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      style={{ ...inputSt, paddingRight: 72 }}
                    />
                    <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}>
                      <button onClick={() => setResetMostrar(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: 2 }}>
                        {resetMostrar ? '🙈' : '👁️'}
                      </button>
                      {resetPass && (
                        <button onClick={copiarPass} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: passCopiada ? '#1a6e3c' : '#888', padding: 2, fontFamily: 'inherit' }}>
                          {passCopiada ? '✅' : '📋'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>CONFIRMAR CONTRASEÑA</label>
                  <input
                    value={resetVerPass}
                    onChange={e => { setResetVerPass(e.target.value); setResetErr('') }}
                    type={resetMostrar ? 'text' : 'password'}
                    placeholder="Repetí la contraseña"
                    style={{ ...inputSt, marginTop: 4, borderColor: resetVerPass && resetPass !== resetVerPass ? '#e53935' : '#d0d8d0' }}
                  />
                  {resetVerPass && resetPass !== resetVerPass && (
                    <p style={{ fontSize: 11, color: '#e53935', margin: '3px 0 0' }}>Las contraseñas no coinciden</p>
                  )}
                </div>
                {resetErr && (
                  <div style={{ background: '#fdecea', border: '1px solid #e53935', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#c62828' }}>
                    {resetErr}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => setResetTarget(null)} style={btnSt('#1a6e3c', true)}>Cancelar</button>
                  <button onClick={ejecutarReset} disabled={resetLoading} style={{ ...btnSt('#185FA5'), opacity: resetLoading ? 0.7 : 1 }}>
                    {resetLoading ? 'Cambiando...' : 'Cambiar contraseña'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#1a6e3c', margin: '0 0 8px' }}>¡Contraseña cambiada!</p>
                <p style={{ fontSize: 13, color: '#666', margin: '0 0 6px' }}>
                  La contraseña de <strong>{resetTarget.nombre}</strong> fue actualizada correctamente.
                </p>
                <p style={{ fontSize: 12, color: '#888', margin: '0 0 24px' }}>Compartile la nueva contraseña de forma segura.</p>
                <button onClick={() => setResetTarget(null)} style={btnSt('#1a6e3c')}>Listo</button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── MODAL ELIMINAR ───────────────────────────────────────────────────── */}
      {eliminarTarget && (
        <Modal onClose={() => setEliminarTarget(null)} width={420}>
          <ModalHeader title="Eliminar usuario" onClose={() => setEliminarTarget(null)} />
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
            <p style={{ fontSize: 14, color: '#444', margin: '0 0 4px' }}>¿Eliminar a:</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: '0 0 8px' }}>{eliminarTarget.nombre}</p>
            <p style={{ fontSize: 12, color: '#888', margin: '0 0 24px' }}>
              Se elimina de Firestore. Para borrarlo de Firebase Auth también, hacelo desde la consola de Firebase.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setEliminarTarget(null)} style={btnSt('#1a6e3c', true)}>Cancelar</button>
              <button onClick={eliminar} style={btnSt('#e53935')}>Sí, eliminar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}