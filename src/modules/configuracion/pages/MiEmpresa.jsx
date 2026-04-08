import { useState, useEffect } from 'react'
import { useEmpresa } from '../../../context/EmpresaContext'
import { useAuth } from '../../../context/AuthContext'
import { storage } from '../../../firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

export default function MiEmpresa() {
  const { empresa, guardarEmpresa } = useEmpresa()
  const { rol } = useAuth()
  const [form, setForm] = useState({
    nombre: '', razonSocial: '', cedula: '', telefono: '',
    email: '', sitioWeb: '', direccion: '', regimenFiscal: '',
    moneda: 'CRC', condicionesPago: '', logoUrl: '', logoSecundarioUrl: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [subiendo, setSubiendo] = useState(false)

  useEffect(() => {
    if (empresa) setForm((prev) => ({ ...prev, ...empresa }))
  }, [empresa])

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleLogo = async (e, campo) => {
    const file = e.target.files[0]
    if (!file) return
    setSubiendo(true)
    try {
      const storageRef = ref(storage, `empresa/${campo}_${Date.now()}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      setForm((prev) => ({ ...prev, [campo]: url }))
    } catch { setMensaje('Error al subir imagen') }
    finally { setSubiendo(false) }
  }

  const handleGuardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      await guardarEmpresa(form)
      setMensaje('✅ Datos guardados correctamente')
    } catch { setMensaje('❌ Error al guardar') }
    finally { setGuardando(false) }
  }

  const esAdmin = rol === 'admin'

  const campo = (label, name, type = 'text', opciones = null) => (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#1a3a5c', marginBottom: '0.3rem' }}>
        {label}
      </label>
      {opciones ? (
        <select name={name} value={form[name]} onChange={handleChange} disabled={!esAdmin}
          style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1.5px solid #dde3ed', borderRadius: '8px', fontSize: '0.9rem', background: '#fff' }}>
          {opciones.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type} name={name} value={form[name]} onChange={handleChange} disabled={!esAdmin}
          style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1.5px solid #dde3ed', borderRadius: '8px', fontSize: '0.9rem', background: esAdmin ? '#fff' : '#f5f5f5' }} />
      )}
    </div>
  )

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.8rem', color: '#1a3a5c', marginBottom: '0.25rem' }}>Mi Empresa</h1>
      <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.9rem' }}>
        {esAdmin ? 'Edita los datos de tu empresa.' : 'Solo administradores pueden editar.'}
      </p>

      <form onSubmit={handleGuardar}>

        {/* DATOS GENERALES */}
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e5799', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '2px solid #f0f4f8' }}>
            📋 Datos Generales
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
            {campo('Nombre de la empresa', 'nombre')}
            {campo('Razón social / Nombre legal', 'razonSocial')}
            {campo('Cédula jurídica', 'cedula')}
            {campo('Teléfono principal', 'telefono', 'tel')}
            {campo('Email corporativo', 'email', 'email')}
            {campo('Sitio web', 'sitioWeb', 'url')}
          </div>
          {campo('Dirección completa', 'direccion')}
        </div>

        {/* IDENTIDAD VISUAL */}
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e5799', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '2px solid #f0f4f8' }}>
            🎨 Identidad Visual
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {['logoUrl', 'logoSecundarioUrl'].map((campo, i) => (
              <div key={campo}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#1a3a5c', marginBottom: '0.5rem' }}>
                  {i === 0 ? 'Logo principal' : 'Logo secundario (opcional)'}
                </label>
                {form[campo] && (
                  <img src={form[campo]} alt="preview"
                    style={{ height: '60px', objectFit: 'contain', marginBottom: '0.5rem', border: '1px solid #eee', borderRadius: '8px', padding: '4px', display: 'block' }} />
                )}
                {esAdmin && (
                  <input type="file" accept="image/*" onChange={(e) => handleLogo(e, campo)}
                    style={{ fontSize: '0.82rem' }} />
                )}
                {subiendo && <p style={{ fontSize: '0.8rem', color: '#1e5799' }}>Subiendo...</p>}
              </div>
            ))}
          </div>
        </div>

        {/* DATOS FISCALES */}
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e5799', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '2px solid #f0f4f8' }}>
            🧾 Datos Fiscales
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
            {campo('Régimen fiscal', 'regimenFiscal')}
            {campo('Moneda principal', 'moneda', 'text', [
              { value: 'CRC', label: '₡ Colón costarricense (CRC)' },
              { value: 'USD', label: '$ Dólar estadounidense (USD)' },
            ])}
          </div>
          {campo('Condiciones de pago por defecto', 'condicionesPago')}
        </div>

        {mensaje && (
          <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem',
            backgroundColor: mensaje.includes('✅') ? '#f0fff4' : '#fff0f0',
            color: mensaje.includes('✅') ? '#2e7d32' : '#c62828',
            border: `1px solid ${mensaje.includes('✅') ? '#a5d6a7' : '#ffcdd2'}`,
            fontSize: '0.9rem' }}>
            {mensaje}
          </div>
        )}

        {esAdmin && (
          <button type="submit" disabled={guardando}
            style={{ padding: '0.85rem 2rem', backgroundColor: guardando ? '#93afd4' : '#1e5799',
              color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem',
              fontWeight: 600, cursor: guardando ? 'not-allowed' : 'pointer' }}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        )}
      </form>
    </div>
  )
}