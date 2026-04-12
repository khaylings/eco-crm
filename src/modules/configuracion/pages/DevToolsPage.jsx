/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: DevToolsPage.jsx
 * Módulo:  Configuracion
 * ============================================================
 */

import { useState } from 'react'
import { db } from '../../../firebase/config'
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  writeBatch, serverTimestamp,
} from 'firebase/firestore'

const EMPRESAS_PRUEBA = [
  { nombre: 'Distribuidora ABC S.A.', ruc: '3-101-123456', sector: 'Comercial', telefono: '2222-1111', correo: 'info@abc.com', provincia: 'San José', direccion: '150m norte del parque central' },
  { nombre: 'Hotel Montaña Verde', ruc: '3-101-654321', sector: 'Hotelero', telefono: '2233-4455', correo: 'gerencia@montanaverde.com', provincia: 'Alajuela', direccion: 'Carretera principal km 12' },
  { nombre: 'Clínica MediSalud', ruc: '3-101-789012', sector: 'Salud', telefono: '2244-5566', correo: 'admin@medisalud.com', provincia: 'Heredia', direccion: 'Centro Médico Heredia, piso 2' },
]

const SEDES_PRUEBA = {
  'Distribuidora ABC S.A.': [
    { nombre: 'Sede Central', provincia: 'San José', direccion: 'Calle 10, Avenida 2', telefono: '2222-1111', responsable: 'Carlos Mora' },
    { nombre: 'Sucursal Alajuela', provincia: 'Alajuela', direccion: 'Av. Principal 45', telefono: '2233-2222', responsable: 'María López' },
  ],
  'Hotel Montaña Verde': [{ nombre: 'Edificio Principal', provincia: 'Alajuela', direccion: 'Km 12 carretera norte', telefono: '2233-4455', responsable: 'Juan Pérez' }],
  'Clínica MediSalud': [{ nombre: 'Torre Médica', provincia: 'Heredia', direccion: 'Centro Médico, Piso 2', telefono: '2244-5566', responsable: 'Dra. Ana Solís' }],
}

const CONTACTOS_PRUEBA = [
  { nombre: 'Carlos Mora', tipo: 'empresa', cargo: 'Gerente General', telefono: '8801-1111', whatsapp: '50688011111', correo: 'carlos@abc.com', provincia: 'San José' },
  { nombre: 'María López', tipo: 'empresa', cargo: 'Jefa de Operaciones', telefono: '8802-2222', whatsapp: '50688022222', correo: 'maria@abc.com', provincia: 'Alajuela' },
  { nombre: 'Juan Pérez', tipo: 'empresa', cargo: 'Administrador', telefono: '8803-3333', whatsapp: '50688033333', correo: 'juan@montanaverde.com', provincia: 'Alajuela' },
  { nombre: 'Dra. Ana Solís', tipo: 'empresa', cargo: 'Directora Médica', telefono: '8804-4444', whatsapp: '50688044444', correo: 'ana@medisalud.com', provincia: 'Heredia' },
  { nombre: 'Roberto Jiménez', tipo: 'persona', telefono: '8805-5555', whatsapp: '50688055555', correo: 'roberto@gmail.com', provincia: 'San José' },
]

const ORIGENES_PRUEBA        = ['WhatsApp', 'Referido', 'Redes sociales', 'Sitio web', 'Llamada entrante', 'Visita en sitio']
const COLUMNAS_PRUEBA        = [
  { nombre: 'Nuevo lead',        orden: 0, color: '#185FA5' },
  { nombre: 'Contactado',        orden: 1, color: '#534AB7' },
  { nombre: 'Propuesta enviada', orden: 2, color: '#854F0B' },
  { nombre: 'Negociación',       orden: 3, color: '#3B6D11' },
  { nombre: 'Ganado',            orden: 4, color: '#27500A' },
  { nombre: 'Perdido',           orden: 5, color: '#791F1F' },
]
const TIPOS_EQUIPO_PRUEBA    = ['Mini Split', 'Cassette', 'Piso techo', 'Chiller', 'Fan Coil', 'Manejadora']
const SECTORES_PRUEBA        = ['Comercial', 'Industrial', 'Residencial', 'Hotelero', 'Salud', 'Educación']
const TIPOS_SERVICIO_PRUEBA  = ['Instalación', 'Mantenimiento preventivo', 'Mantenimiento correctivo', 'Reparación', 'Diagnóstico']
const ESTADOS_EQUIPO_PRUEBA  = ['Operativo', 'En mantenimiento', 'Fuera de servicio', 'En garantía']

const COLECCIONES_DISPONIBLES = [
  { key: 'empresas',                    label: 'Empresas y sedes',              icon: '🏢', grupo: 'Clientes' },
  { key: 'contactos',                   label: 'Contactos',                     icon: '👤', grupo: 'Clientes' },
  { key: 'activos',                     label: 'Activos (equipos AC)',           icon: '❄️', grupo: 'Clientes' },
  { key: 'leads',                       label: 'Leads y notas',                 icon: '📋', grupo: 'CRM' },
  { key: 'pipeline_columnas',           label: 'Columnas del pipeline',         icon: '📊', grupo: 'CRM' },
  { key: 'conversaciones',              label: 'Conversaciones WhatsApp',       icon: '💬', grupo: 'CRM' },
  { key: 'cotizaciones',                label: 'Cotizaciones',                  icon: '📄', grupo: 'Comercial' },
  { key: 'productos',                   label: 'Productos',                     icon: '📦', grupo: 'Comercial' },
  { key: 'proveedores',                 label: 'Proveedores',                   icon: '🏭', grupo: 'Comercial' },
  { key: 'movimientosInventario',       label: 'Movimientos de inventario',     icon: '📥', grupo: 'Comercial' },
  { key: 'eventos',                     label: 'Eventos del calendario',        icon: '📅', grupo: 'Operaciones' },
  { key: 'catalogo_origenes',           label: 'Catálogo: Orígenes',            icon: '📡', grupo: 'Catálogos' },
  { key: 'catalogo_tipos_equipo',       label: 'Catálogo: Tipos de equipo',     icon: '🔧', grupo: 'Catálogos' },
  { key: 'catalogo_sectores',           label: 'Catálogo: Sectores',            icon: '🏭', grupo: 'Catálogos' },
  { key: 'catalogo_estados_equipo',     label: 'Catálogo: Estados equipo',      icon: '⚙️', grupo: 'Catálogos' },
  { key: 'catalogo_tipos_servicio',     label: 'Catálogo: Tipos servicio',      icon: '📋', grupo: 'Catálogos' },
  { key: 'catalogo_etiquetas_producto', label: 'Catálogo: Etiquetas producto',  icon: '🏷️', grupo: 'Catálogos' },
  { key: 'catalogo_tipos_proveedor',    label: 'Catálogo: Tipos proveedor',     icon: '🏢', grupo: 'Catálogos' },
]

async function eliminarColeccion(col, setLog) {
  const log = (msg) => setLog(prev => [...prev, msg])
  try {
    if (col === 'empresas') {
      const snap = await getDocs(collection(db, 'empresas'))
      for (const d of snap.docs) {
        const sedes = await getDocs(collection(db, 'empresas', d.id, 'sedes'))
        const b = writeBatch(db); sedes.docs.forEach(s => b.delete(s.ref)); await b.commit()
      }
    }
    if (col === 'activos') {
      const snap = await getDocs(collection(db, 'activos'))
      for (const d of snap.docs) {
        const sv = await getDocs(collection(db, 'activos', d.id, 'servicios'))
        const b = writeBatch(db); sv.docs.forEach(s => b.delete(s.ref)); await b.commit()
      }
    }
    if (col === 'leads') {
      const snap = await getDocs(collection(db, 'leads'))
      for (const d of snap.docs) {
        const notas = await getDocs(collection(db, 'leads', d.id, 'notas'))
        const b = writeBatch(db); notas.docs.forEach(n => b.delete(n.ref)); await b.commit()
      }
    }
    if (col === 'conversaciones') {
      const snap = await getDocs(collection(db, 'conversaciones'))
      for (const d of snap.docs) {
        const msgs = await getDocs(collection(db, 'conversaciones', d.id, 'mensajes'))
        const b = writeBatch(db); msgs.docs.forEach(m => b.delete(m.ref)); await b.commit()
      }
    }
    const snap = await getDocs(collection(db, col))
    const b = writeBatch(db); snap.docs.forEach(d => b.delete(d.ref)); await b.commit()
    log(`   ✓ ${col} — ${snap.size} documentos eliminados`)
  } catch (e) {
    log(`   ⚠ Error en ${col}: ${e.message}`)
  }
}

async function cargarDatosPrueba(setLog) {
  const log = (msg) => setLog(prev => [...prev, msg])
  log('🚀 Iniciando carga de datos de prueba...')

  log('📡 Catálogos...')
  for (const o of ORIGENES_PRUEBA)       await addDoc(collection(db, 'catalogo_origenes'),       { nombre: o })
  for (const t of TIPOS_EQUIPO_PRUEBA)   await addDoc(collection(db, 'catalogo_tipos_equipo'),   { nombre: t })
  for (const s of SECTORES_PRUEBA)       await addDoc(collection(db, 'catalogo_sectores'),       { nombre: s })
  for (const e of ESTADOS_EQUIPO_PRUEBA) await addDoc(collection(db, 'catalogo_estados_equipo'), { nombre: e })
  for (const t of TIPOS_SERVICIO_PRUEBA) await addDoc(collection(db, 'catalogo_tipos_servicio'), { nombre: t })

  log('📊 Pipeline...')
  const columnasIds = {}
  for (const col of COLUMNAS_PRUEBA) {
    const ref = await addDoc(collection(db, 'pipeline_columnas'), { ...col, creadoEn: serverTimestamp() })
    columnasIds[col.nombre] = ref.id
  }

  log('🏢 Empresas y sedes...')
  const empresasIds = {}
  const sedesIds    = {}
  for (const emp of EMPRESAS_PRUEBA) {
    const ref = await addDoc(collection(db, 'empresas'), { ...emp, creadoEn: serverTimestamp() })
    empresasIds[emp.nombre] = ref.id
    for (const sede of (SEDES_PRUEBA[emp.nombre] || [])) {
      const sr = await addDoc(collection(db, 'empresas', ref.id, 'sedes'), { ...sede, creadoEn: serverTimestamp() })
      sedesIds[`${emp.nombre}_${sede.nombre}`] = { id: sr.id, empresaId: ref.id }
    }
  }

  log('❄️ Activos...')
  const activosDatos = [
    { tipo: 'Mini Split', marca: 'Carrier',  modelo: 'XP21',    capacidadBTU: '12000',  nroSerie: 'CAR-2023-001', estado: 'Operativo',        fechaInstalacion: '2023-03-15', empresa: 'Distribuidora ABC S.A.', sede: 'Sede Central'      },
    { tipo: 'Cassette',   marca: 'Daikin',   modelo: 'FCAG36',  capacidadBTU: '36000',  nroSerie: 'DAI-2022-045', estado: 'En mantenimiento', fechaInstalacion: '2022-06-10', empresa: 'Hotel Montaña Verde',    sede: 'Edificio Principal' },
    { tipo: 'Chiller',    marca: 'Trane',    modelo: 'RTAC120', capacidadBTU: '120000', nroSerie: 'TRA-2021-008', estado: 'Operativo',        fechaInstalacion: '2021-01-05', empresa: 'Clínica MediSalud',      sede: 'Torre Médica'       },
  ]
  for (const a of activosDatos) {
    const empresaId = empresasIds[a.empresa]
    const sedeData  = sedesIds[`${a.empresa}_${a.sede}`]
    await addDoc(collection(db, 'activos'), { ...a, empresaId, sedeId: sedeData?.id || '', creadoEn: serverTimestamp() })
  }

  log('👤 Contactos...')
  const empABC     = empresasIds['Distribuidora ABC S.A.']
  const empHotel   = empresasIds['Hotel Montaña Verde']
  const empClinica = empresasIds['Clínica MediSalud']
  const contactosDatos = [
    { ...CONTACTOS_PRUEBA[0], empresaId: empABC,     empresaNombre: 'Distribuidora ABC S.A.', sedeId: sedesIds['Distribuidora ABC S.A._Sede Central']?.id,     sedeNombre: 'Sede Central'      },
    { ...CONTACTOS_PRUEBA[1], empresaId: empABC,     empresaNombre: 'Distribuidora ABC S.A.', sedeId: sedesIds['Distribuidora ABC S.A._Sucursal Alajuela']?.id, sedeNombre: 'Sucursal Alajuela' },
    { ...CONTACTOS_PRUEBA[2], empresaId: empHotel,   empresaNombre: 'Hotel Montaña Verde' },
    { ...CONTACTOS_PRUEBA[3], empresaId: empClinica, empresaNombre: 'Clínica MediSalud' },
    { ...CONTACTOS_PRUEBA[4] },
  ]
  for (const c of contactosDatos) await addDoc(collection(db, 'contactos'), { ...c, creadoEn: serverTimestamp() })

  log('📋 Leads...')
  const leadsDatos = [
    { nombre: 'Mantenimiento preventivo ABC',     origen: 'WhatsApp',        prioridad: 'Alta',  estado: 'abierto', columnaId: columnasIds['Nuevo lead'],        empresaId: empABC     },
    { nombre: 'Instalación nuevos equipos Hotel', origen: 'Referido',        prioridad: 'Media', estado: 'abierto', columnaId: columnasIds['Propuesta enviada'], empresaId: empHotel   },
    { nombre: 'Revisión chiller clínica',         origen: 'Llamada entrante',prioridad: 'Alta',  estado: 'abierto', columnaId: columnasIds['Negociación'],       empresaId: empClinica },
  ]
  for (const lead of leadsDatos) await addDoc(collection(db, 'leads'), { ...lead, creadoEn: serverTimestamp() })

  log('✅ ¡Datos cargados! ' + `${EMPRESAS_PRUEBA.length} empresas · ${contactosDatos.length} contactos · ${leadsDatos.length} leads`)
}

export default function DevToolsPage() {
  const [log,          setLog]          = useState([])
  const [cargando,     setCargando]     = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [textoConfirm, setTextoConfirm] = useState('')
  const [seleccionadas,setSeleccionadas]= useState(new Set())

  const grupos = [...new Set(COLECCIONES_DISPONIBLES.map(c => c.grupo))]

  const toggleCol    = (key) => setSeleccionadas(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  const toggleGrupo  = (grupo) => {
    const cols  = COLECCIONES_DISPONIBLES.filter(c => c.grupo === grupo).map(c => c.key)
    const todas = cols.every(k => seleccionadas.has(k))
    setSeleccionadas(prev => { const n = new Set(prev); cols.forEach(k => todas ? n.delete(k) : n.add(k)); return n })
  }
  const seleccionarTodo   = () => setSeleccionadas(new Set(COLECCIONES_DISPONIBLES.map(c => c.key)))
  const deseleccionarTodo = () => setSeleccionadas(new Set())

  const handleCargar = async () => {
    setCargando(true); setLog([])
    try { await cargarDatosPrueba(setLog) }
    catch (e) { setLog(prev => [...prev, `❌ Error: ${e.message}`]) }
    setCargando(false)
  }

  const handleReset = async () => {
    if (textoConfirm !== 'RESETEAR' || seleccionadas.size === 0) return
    setCargando(true); setLog([]); setConfirmReset(false); setTextoConfirm('')
    try {
      setLog(['🗑️ Iniciando reset...'])
      for (const key of seleccionadas) await eliminarColeccion(key, setLog)
      setLog(prev => [...prev, '✅ Reset completado.'])
      setSeleccionadas(new Set())
    } catch (e) { setLog(prev => [...prev, `❌ Error: ${e.message}`]) }
    setCargando(false)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--eco-text, #1a1a1a)', margin: 0 }}>
          Herramientas de desarrollo
        </h2>
        <p style={{ fontSize: 12, color: 'var(--eco-muted, #888)', margin: '4px 0 0' }}>
          Solo para pruebas — no usar en producción con datos reales
        </p>
      </div>

      {/* Cargar datos prueba */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--eco-text, #1a1a1a)', marginBottom: 3 }}>
              Cargar datos de prueba
            </div>
            <div style={{ fontSize: 12, color: 'var(--eco-muted, #888)' }}>
              3 empresas, sedes, activos, 5 contactos, 3 leads y catálogos
            </div>
          </div>
          <button onClick={handleCargar} disabled={cargando} style={{ ...btnPrimario, opacity: cargando ? 0.6 : 1 }}>
            {cargando ? 'Cargando...' : '▶ Cargar datos'}
          </button>
        </div>
      </div>

      {/* Reset selectivo */}
      <div style={{ ...card, borderColor: '#F7C1C1' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#A32D2D', marginBottom: 4 }}>
          ⚠ Reset selectivo
        </div>
        <div style={{ fontSize: 12, color: 'var(--eco-muted, #888)', marginBottom: 14 }}>
          Elegí qué colecciones eliminar. Esta acción no se puede deshacer.
        </div>

        <div style={{ border: '0.5px solid #F7C1C1', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#fdf5f5', borderBottom: '0.5px solid #F7C1C1' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#A32D2D', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              {seleccionadas.size} de {COLECCIONES_DISPONIBLES.length} seleccionadas
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={seleccionarTodo}   style={btnMini}>Seleccionar todo</button>
              <button onClick={deseleccionarTodo} style={btnMini}>Limpiar</button>
            </div>
          </div>

          {grupos.map(grupo => {
            const cols          = COLECCIONES_DISPONIBLES.filter(c => c.grupo === grupo)
            const todasMarcadas = cols.every(c => seleccionadas.has(c.key))
            const algunaMarcada = cols.some(c => seleccionadas.has(c.key))
            return (
              <div key={grupo}>
                <div onClick={() => toggleGrupo(grupo)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: '#fafafa', borderBottom: '0.5px solid #F7C1C1', cursor: 'pointer' }}>
                  <input type="checkbox" checked={todasMarcadas}
                    ref={el => { if (el) el.indeterminate = algunaMarcada && !todasMarcadas }}
                    onChange={() => toggleGrupo(grupo)} onClick={e => e.stopPropagation()}
                    style={{ accentColor: '#A32D2D', width: 13, height: 13 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '.5px' }}>{grupo}</span>
                </div>
                {cols.map(col => (
                  <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px 7px 28px', borderBottom: '0.5px solid #fce8e8', cursor: 'pointer', background: seleccionadas.has(col.key) ? '#fff5f5' : '#fff' }}>
                    <input type="checkbox" checked={seleccionadas.has(col.key)} onChange={() => toggleCol(col.key)}
                      style={{ accentColor: '#A32D2D', width: 13, height: 13 }} />
                    <span style={{ fontSize: 13 }}>{col.icon}</span>
                    <span style={{ fontSize: 12, color: seleccionadas.has(col.key) ? '#A32D2D' : 'var(--eco-text, #1a1a1a)', fontWeight: seleccionadas.has(col.key) ? 500 : 400 }}>
                      {col.label}
                    </span>
                  </label>
                ))}
              </div>
            )
          })}
        </div>

        {!confirmReset ? (
          <button onClick={() => seleccionadas.size > 0 && setConfirmReset(true)}
            disabled={cargando || seleccionadas.size === 0}
            style={{ ...btnDanger, opacity: seleccionadas.size === 0 ? 0.4 : 1 }}>
            🗑️ Resetear {seleccionadas.size > 0 ? `(${seleccionadas.size} colecciones)` : '— seleccioná colecciones'}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: '#A32D2D', margin: 0 }}>
              Escribí <strong>RESETEAR</strong> para confirmar la eliminación de {seleccionadas.size} colecciones:
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={textoConfirm} onChange={e => setTextoConfirm(e.target.value)} placeholder="RESETEAR"
                style={{ flex: 1, padding: '7px 12px', border: '1.5px solid #F7C1C1', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
              <button onClick={handleReset} disabled={textoConfirm !== 'RESETEAR' || cargando}
                style={{ ...btnDanger, opacity: textoConfirm !== 'RESETEAR' ? 0.4 : 1 }}>Confirmar</button>
              <button onClick={() => { setConfirmReset(false); setTextoConfirm('') }} style={btnMini}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div style={{ background: '#1a1a2e', borderRadius: 10, padding: '14px 16px', marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
            Log de operaciones
          </div>
          {log.map((l, i) => (
            <div key={i} style={{ fontSize: 12, fontFamily: 'monospace', lineHeight: 1.8,
              color: l.startsWith('✅') || l.startsWith('   ✓') ? '#97C459'
                   : l.startsWith('❌') ? '#F09595'
                   : l.startsWith('⚠') ? '#FAC775'
                   : '#c8d3f5' }}>
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const card = {
  background: '#fff', border: '0.5px solid var(--eco-border, #d0d8d0)',
  borderRadius: 'var(--eco-radius, 0px)', padding: '16px 18px', marginBottom: 16,
}
const btnPrimario = {
  padding: '7px 16px', background: 'var(--eco-primary, #1a3a5c)', color: '#fff',
  border: 'none', borderRadius: 'var(--eco-radius, 0px)', fontSize: 12,
  fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 16,
}
const btnDanger = {
  padding: '7px 16px', background: '#A32D2D', color: '#fff',
  border: 'none', borderRadius: 'var(--eco-radius, 0px)', fontSize: 12,
  fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
}
const btnMini = {
  padding: '4px 10px', background: '#fff', color: '#555',
  border: '0.5px solid #ddd', borderRadius: 6, fontSize: 11,
  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
}