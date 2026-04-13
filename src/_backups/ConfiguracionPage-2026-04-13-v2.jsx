/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: ConfiguracionPage.jsx
 * Módulo:  Configuracion
 * ============================================================
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../../../firebase/config'
import { doc, getDoc, setDoc, collection, getDocs, addDoc, deleteDoc, updateDoc, orderBy, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../../../firebase/firestore'
import { useEmpresa } from '../../../context/EmpresaContext'
import { useAuth } from '../../../context/AuthContext'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const SECCIONES = [
  { id: 'empresa',    label: 'Empresa' },
  { id: 'usuarios',   label: 'Usuarios' },
  { id: 'roles',      label: 'Roles y permisos' },
  { id: 'conexiones', label: 'Conexiones' },
  { id: 'plantillas', label: 'Plantillas' },
  { id: 'catalogos',  label: 'Catálogos' },
  { id: 'cuentas',    label: 'Cuentas' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'operaciones', label: '🛠️ Operaciones' },
  { id: 'bot',        label: '🤖 Bot de Ayuda' },
  { id: 'devtools',   label: 'Dev Tools' },
]

const iSt = { border:'1px solid #d0d8d0', borderRadius:'var(--eco-radius,6px)', padding:'8px 10px', fontSize:12, color:'#1a1a1a', background:'#fff', width:'100%', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }

function Field({ label, required, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <label style={{ fontSize:10, fontWeight:600, color:'#5c6b5c', textTransform:'uppercase', letterSpacing:'.5px' }}>
        {label}{required && <span style={{ color:'#cc3333', marginLeft:2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function G2({ children }) { return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>{children}</div> }

function Btn({ onClick, disabled, children, outline, color }) {
  const bg = outline ? '#fff' : (color||'var(--eco-primary)')
  const cl = outline ? (color||'var(--eco-primary)') : '#fff'
  return <button onClick={onClick} disabled={disabled} style={{ background:bg, color:cl, border:`1px solid ${color||'var(--eco-primary)'}`, borderRadius:'var(--eco-radius,6px)', padding:'7px 18px', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', opacity:disabled?.7:1 }}>{children}</button>
}

function SaveRow({ onSave, guardando, guardado, msg }) {
  return (
    <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:10, paddingTop:14, borderTop:'1px solid #eee', marginTop:16 }}>
      {(guardado||msg) && <span style={{ fontSize:12, color:guardado?'#1a6e3c':'#cc3333' }}>{msg||'✓ Guardado'}</span>}
      <Btn onClick={onSave} disabled={guardando}>{guardando?'Guardando...':'Guardar cambios'}</Btn>
    </div>
  )
}

function SubTitle({ children }) {
  return <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:14, paddingBottom:8, borderBottom:'1px solid #eee' }}>{children}</div>
}

function Toggle({ value, onChange }) {
  return <button onClick={()=>onChange(!value)} style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer', background:value?'var(--eco-primary)':'#ccc', position:'relative', transition:'background .2s', padding:0, flexShrink:0 }}><div style={{ width:18, height:18, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left:value?23:3, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }} /></button>
}

function SubNav({ grupo, subs, activo, onChange }) {
  return (
    <nav style={{ width:160, flexShrink:0, borderRight:'1px solid #d0d8d0', padding:'8px 0', background:'#fafafa' }}>
      <div style={{ fontSize:9, color:'#aaa', textTransform:'uppercase', letterSpacing:'.7px', padding:'8px 14px 4px' }}>{grupo}</div>
      {subs.map(s => (
        <button key={s.id} onClick={()=>onChange(s.id)} style={{ width:'100%', textAlign:'left', padding:'8px 14px', fontSize:12, color:activo===s.id?'var(--eco-primary)':'#5c6b5c', background:activo===s.id?'var(--eco-primary-light)':'transparent', border:'none', borderLeft:`3px solid ${activo===s.id?'var(--eco-primary)':'transparent'}`, cursor:'pointer', fontWeight:activo===s.id?500:400, fontFamily:'inherit' }}>{s.label}</button>
      ))}
    </nav>
  )
}

function Modal({ onClose, children, width=460 }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:10, width, maxHeight:'90vh', overflowY:'auto', border:'1px solid #d0d8d0' }}>{children}</div>
    </div>
  )
}

// ─── Catálogo genérico ────────────────────────────────────────────────────────
function Catalogo({ coleccion, titulo, defaults }) {
  const [items,setItems] = useState([])
  const [nuevo,setNuevo] = useState('')
  const [cargando,setCargando] = useState(true)
  const cargar = async () => { setCargando(true); const snap=await getDocs(query(collection(db,coleccion),orderBy('nombre'))); setItems(snap.docs.map(d=>({id:d.id,...d.data()}))); setCargando(false) }
  useEffect(()=>{ cargar() },[coleccion])
  const agregar = async () => { if(!nuevo.trim()||items.find(i=>i.nombre.toLowerCase()===nuevo.toLowerCase())) return; await addDoc(collection(db,coleccion),{nombre:nuevo.trim()}); setNuevo(''); cargar() }
  const eliminar = async id => { await deleteDoc(doc(db,coleccion,id)); cargar() }
  const cargarDef = async () => { const ex=items.map(i=>i.nombre.toLowerCase()); for(const d of(defaults||[])) { if(!ex.includes(d.toLowerCase())) await addDoc(collection(db,coleccion),{nombre:d}) } cargar() }
  return (
    <div style={{ marginBottom:28 }}>
      <SubTitle>{titulo}</SubTitle>
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input value={nuevo} onChange={e=>setNuevo(e.target.value)} placeholder="Agregar..." style={{...iSt,flex:1}} onKeyDown={e=>e.key==='Enter'&&agregar()} />
        <Btn onClick={agregar}>+ Agregar</Btn>
        {items.length===0&&defaults?.length>0&&<Btn onClick={cargarDef} outline>↓ Predeterminados</Btn>}
      </div>
      {cargando?<div style={{color:'#aaa',fontSize:12}}>Cargando...</div>:(
        <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
          {items.length===0?<div style={{color:'#bbb',fontSize:12,fontStyle:'italic'}}>Sin elementos aún.</div>
            :items.map(item=>(
              <div key={item.id} style={{ display:'flex', alignItems:'center', gap:6, background:'#fff', border:'1px solid #d0d8d0', borderRadius:20, padding:'4px 12px', fontSize:12 }}>
                <span>{item.nombre}</span>
                <button onClick={()=>eliminar(item.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#bbb', fontSize:14, padding:0, lineHeight:1 }}>×</button>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab Observaciones ────────────────────────────────────────────────────────
function TabObservaciones({ docFirestore }) {
  const [plantillas, setPlantillas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [formNombre, setFormNombre] = useState('')
  const [formTexto, setFormTexto] = useState('')
  const [editId, setEditId] = useState(null)

  const inp = { width:'100%', padding:'8px 10px', border:'1px solid #d0d8d0', borderRadius:6, fontSize:12, background:'#fff', color:'#1a1a1a', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }
  const lbl = { fontSize:10, fontWeight:600, color:'#5c6b5c', textTransform:'uppercase', letterSpacing:'.5px', display:'block', marginBottom:4, marginTop:12 }

  useEffect(() => { cargar() }, [docFirestore])

  const cargar = async () => {
    setCargando(true)
    try {
      const snap = await getDoc(doc(db, 'configuracion', docFirestore))
      if (snap.exists()) setPlantillas(snap.data().plantillasObservaciones || [])
    } catch(e) { console.error(e) }
    finally { setCargando(false) }
  }

  const guardarFirestore = async (nuevas) => {
    setGuardando(true)
    try {
      await setDoc(doc(db, 'configuracion', docFirestore), { plantillasObservaciones: nuevas }, { merge: true })
      setPlantillas(nuevas)
      setMsg('✓ Guardado')
      setTimeout(() => setMsg(''), 2000)
    } catch(e) { setMsg('Error al guardar') }
    finally { setGuardando(false) }
  }

  const limpiarForm = () => { setFormNombre(''); setFormTexto(''); setEditId(null) }
  const iniciarEdicion = (p) => { setEditId(p.id); setFormNombre(p.nombre); setFormTexto(p.texto) }

  const guardarPlantilla = async () => {
    if (!formNombre.trim() || !formTexto.trim()) return
    let nuevas
    if (editId) {
      nuevas = plantillas.map(p => p.id === editId ? { ...p, nombre: formNombre.trim(), texto: formTexto.trim() } : p)
    } else {
      nuevas = [...plantillas, { id: 'plt_' + Date.now(), nombre: formNombre.trim(), texto: formTexto.trim() }]
    }
    await guardarFirestore(nuevas)
    limpiarForm()
  }

  const duplicarPlantilla = async (p) => {
    const copia = { ...p, id: 'plt_' + Date.now(), nombre: p.nombre + ' (copia)' }
    await guardarFirestore([...plantillas, copia])
  }

  const eliminarPlantilla = async (id) => {
    if (!window.confirm('¿Eliminar esta plantilla?')) return
    await guardarFirestore(plantillas.filter(p => p.id !== id))
    if (editId === id) limpiarForm()
  }

  if (cargando) return <div style={{padding:40,textAlign:'center',color:'#aaa',fontSize:13}}>Cargando...</div>

  return (
    <div style={{ display:'flex', gap:24 }}>
      <div style={{ width:460, flexShrink:0 }}>
        <div style={{ background:'#fff', border:'1px solid #d0d8d0', borderRadius:10, padding:20, position:'sticky', top:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            {editId ? 'Editar plantilla' : 'Nueva plantilla'}
            {editId && <button onClick={limpiarForm} style={{ fontSize:11, color:'#888', background:'none', border:'none', cursor:'pointer', padding:'2px 8px', borderRadius:5 }}>+ Nueva</button>}
          </div>
          <label style={lbl}>Nombre</label>
          <input style={inp} placeholder="Ej: Condiciones estándar..." value={formNombre} onChange={e => setFormNombre(e.target.value)} />
          <label style={{ ...lbl, marginTop:12 }}>Texto</label>
          <textarea style={{ ...inp, resize:'vertical', minHeight:180, lineHeight:1.7 }} value={formTexto} onChange={e => setFormTexto(e.target.value)} />
          <div style={{ display:'flex', gap:8, marginTop:16 }}>
            {editId && <button onClick={limpiarForm} style={{ flex:1, padding:'8px', border:'1px solid #d0d8d0', borderRadius:6, fontSize:12, cursor:'pointer', background:'#f5f5f5', color:'#555', fontFamily:'inherit' }}>Cancelar</button>}
            <button onClick={guardarPlantilla} disabled={!formNombre.trim() || !formTexto.trim() || guardando}
              style={{ flex:2, padding:'8px 16px', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:(!formNombre.trim()||!formTexto.trim())?'not-allowed':'pointer', background:(!formNombre.trim()||!formTexto.trim())?'#e0e0e0':'var(--eco-primary)', color:(!formNombre.trim()||!formTexto.trim())?'#aaa':'#fff', fontFamily:'inherit' }}>
              {guardando ? 'Guardando...' : editId ? '✓ Guardar' : '+ Crear'}
            </button>
          </div>
          {msg && <div style={{ marginTop:10, padding:'6px 10px', borderRadius:6, background:msg.startsWith('✓')?'#EAF3DE':'#FCEBEB', color:msg.startsWith('✓')?'#2e7d32':'#A32D2D', fontSize:12, textAlign:'center' }}>{msg}</div>}
        </div>
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:14 }}>Plantillas — {plantillas.length}</div>
        {plantillas.length === 0 && <div style={{ background:'#fff', border:'1px solid #d0d8d0', borderRadius:10, padding:'32px 20px', textAlign:'center', color:'#aaa', fontSize:12 }}><div style={{ fontSize:28, marginBottom:8, opacity:0.4 }}>📝</div>Sin plantillas aún.</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {plantillas.map(p => (
            <div key={p.id} style={{ background:editId===p.id?'#EAF3DE':'#fff', border:`1px solid ${editId===p.id?'#8BC34A':'#e0e8e0'}`, borderRadius:8, padding:'12px 16px', cursor:'pointer' }} onClick={() => iniciarEdicion(p)}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontWeight:600, fontSize:13 }}>{editId===p.id?'✎ ':''}{p.nombre}</span>
                <div style={{ display:'flex', gap:4 }}>
                  <button onClick={e=>{e.stopPropagation();duplicarPlantilla(p)}} style={{ background:'none', border:'1px solid #d0d8d0', borderRadius:5, cursor:'pointer', color:'#888', fontSize:11, padding:'2px 8px', fontFamily:'inherit' }}>⎘</button>
                  <button onClick={e=>{e.stopPropagation();eliminarPlantilla(p.id)}} style={{ background:'none', border:'none', cursor:'pointer', color:'#ccc', fontSize:16, padding:'2px 4px' }} onMouseEnter={e=>e.currentTarget.style.color='#A32D2D'} onMouseLeave={e=>e.currentTarget.style.color='#ccc'}>×</button>
                </div>
              </div>
              <div style={{ fontSize:11, color:'#888', lineHeight:1.5, whiteSpace:'pre-wrap', maxHeight:64, overflow:'hidden' }}>{p.texto}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── EMPRESA ──────────────────────────────────────────────────────────────────
const MONEDAS = [{value:'CRC',label:'CRC — Colón ₡'},{value:'USD',label:'USD — Dólar $'},{value:'EUR',label:'EUR — Euro €'},{value:'MXN',label:'MXN — Peso mexicano'},{value:'COP',label:'COP — Peso colombiano'},{value:'ARS',label:'ARS — Peso argentino'},{value:'BRL',label:'BRL — Real brasileño'},{value:'GTQ',label:'GTQ — Quetzal'},{value:'GBP',label:'GBP — Libra £'}]

function EmpresaBasicos({ empresa }) {
  const [form,setForm] = useState({razonSocial:'',nombreComercial:'',cedulaJuridica:'',actividadEconomica:'',telefono:'',email:'',sitioWeb:'',pais:'',direccion:'',slogan:'',moneda:'CRC',monedaSecundaria:'',regimen:''})
  const [guardando,setGuardando] = useState(false); const [guardado,setGuardado] = useState(false)
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  useEffect(()=>{ if(empresa) setForm(f=>({...f,...empresa})) },[empresa])
  const guardar = async()=>{ setGuardando(true); await setDoc(doc(db,'configuracion','empresa'),form,{merge:true}); setGuardando(false); setGuardado(true); setTimeout(()=>setGuardado(false),3000) }
  return (
    <div>
      <SubTitle>Datos básicos</SubTitle>
      <G2>
        <Field label="Razón Social" required><input value={form.razonSocial} onChange={e=>set('razonSocial',e.target.value)} style={iSt} /></Field>
        <Field label="Nombre Comercial"><input value={form.nombreComercial} onChange={e=>set('nombreComercial',e.target.value)} style={iSt} /></Field>
        <Field label="Cédula Jurídica"><input value={form.cedulaJuridica} onChange={e=>set('cedulaJuridica',e.target.value)} placeholder="3-101-XXXXXX" style={iSt} /></Field>
        <Field label="Actividad Económica"><input value={form.actividadEconomica} onChange={e=>set('actividadEconomica',e.target.value)} style={iSt} /></Field>
        <Field label="Teléfono"><input value={form.telefono} onChange={e=>set('telefono',e.target.value)} style={iSt} /></Field>
        <Field label="Email"><input value={form.email} onChange={e=>set('email',e.target.value)} style={iSt} /></Field>
        <Field label="Sitio Web"><input value={form.sitioWeb} onChange={e=>set('sitioWeb',e.target.value)} style={iSt} /></Field>
        <Field label="País"><input value={form.pais} onChange={e=>set('pais',e.target.value)} style={iSt} /></Field>
        <div style={{gridColumn:'1/-1'}}><Field label="Dirección"><input value={form.direccion} onChange={e=>set('direccion',e.target.value)} style={iSt} /></Field></div>
        <div style={{gridColumn:'1/-1'}}><Field label="Slogan"><input value={form.slogan} onChange={e=>set('slogan',e.target.value)} style={iSt} /></Field></div>
        <Field label="Moneda principal"><select value={form.moneda} onChange={e=>set('moneda',e.target.value)} style={iSt}>{MONEDAS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>
        <Field label="Moneda secundaria"><select value={form.monedaSecundaria} onChange={e=>set('monedaSecundaria',e.target.value)} style={iSt}><option value="">— Sin moneda secundaria —</option>{MONEDAS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>
        <Field label="Régimen Tributario"><select value={form.regimen} onChange={e=>set('regimen',e.target.value)} style={iSt}><option value="">-- Seleccionar --</option><option value="simplificado">Régimen Simplificado</option><option value="traditional">Régimen Tradicional</option></select></Field>
      </G2>
      <SaveRow onSave={guardar} guardando={guardando} guardado={guardado} />
    </div>
  )
}

function LogoSlot({ label, hint, value, onChange }) {
  const fileRef=useRef(); const [preview,setPreview]=useState(value||null); const [uploading,setUploading]=useState(false); const [ok,setOk]=useState(false)
  useEffect(()=>{ if(value&&value!==preview) setPreview(value) },[value])
  const CAMPO_MAP = {'Logo principal':'logoPrincipal','Logo secundario':'logoSecundario','Isotipo':'isotipo','Favicon':'favicon'}
  const handleFile = async e => {
    const file=e.target.files[0]; if(!file) return; setPreview(URL.createObjectURL(file)); setUploading(true)
    try { const r=ref(storage,`empresa/logos/${label.replace(/\s+/g,'_')}_${Date.now()}`); await uploadBytes(r,file); const url=await getDownloadURL(r); onChange(url); setPreview(url); const campo=CAMPO_MAP[label]||label.replace(/\s+/g,'_').toLowerCase(); await setDoc(doc(db,'configuracion','empresa'),{[campo]:url},{merge:true}); setOk(true); setTimeout(()=>setOk(false),3000) } catch(err){console.error(err)} finally{setUploading(false)}
  }
  return (
    <div>
      <div style={{fontSize:12,fontWeight:500,color:'#1a1a1a',marginBottom:2}}>{label}</div>
      <div style={{fontSize:10,color:'#888',marginBottom:8,lineHeight:1.4}}>{hint}</div>
      <div onClick={()=>fileRef.current.click()} style={{border:'1.5px dashed #d0d8d0',borderRadius:8,height:80,display:'flex',alignItems:'center',justifyContent:'center',background:'#f7f9f7',cursor:'pointer',overflow:'hidden',marginBottom:6}} onMouseEnter={e=>e.currentTarget.style.borderColor='var(--eco-primary)'} onMouseLeave={e=>e.currentTarget.style.borderColor='#d0d8d0'}>
        {preview?<img src={preview} alt={label} style={{maxHeight:64,maxWidth:'90%',objectFit:'contain'}} />:<span style={{fontSize:11,color:'#aaa'}}>{uploading?'Subiendo...':'Click para cargar'}</span>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFile} />
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <Btn onClick={()=>fileRef.current.click()} outline>{uploading?'Subiendo...':preview?'Cambiar':'Seleccionar'}</Btn>
        {ok&&<span style={{fontSize:11,color:'#1a6e3c'}}>✓ Guardado</span>}
      </div>
    </div>
  )
}

function EmpresaLogos({ empresa }) {
  const [logos,setLogos]=useState({logoPrincipal:'',logoSecundario:'',isotipo:'',favicon:''})
  useEffect(()=>{ if(empresa) setLogos({logoPrincipal:empresa.logoPrincipal||'',logoSecundario:empresa.logoSecundario||'',isotipo:empresa.isotipo||'',favicon:empresa.favicon||''}) },[empresa])
  return (
    <div>
      <SubTitle>Logos e imágenes</SubTitle>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <LogoSlot label="Logo principal" hint="Horizontal con nombre. Se usa en cotizaciones." value={logos.logoPrincipal} onChange={url=>setLogos(l=>({...l,logoPrincipal:url}))} />
        <LogoSlot label="Logo secundario" hint="Versión alternativa para fondos distintos." value={logos.logoSecundario} onChange={url=>setLogos(l=>({...l,logoSecundario:url}))} />
        <LogoSlot label="Isotipo" hint="Símbolo solo, sin texto." value={logos.isotipo} onChange={url=>setLogos(l=>({...l,isotipo:url}))} />
        <LogoSlot label="Favicon" hint="PNG 32×32 px. Ícono de pestaña." value={logos.favicon} onChange={url=>setLogos(l=>({...l,favicon:url}))} />
      </div>
    </div>
  )
}

function EmpresaDocumentos({ empresa }) {
  const [form,setForm]=useState({numeroPyme:'',ccss:'',representanteLegal:'',cedulaRepresentante:'',licenciaCFIA:'',cuentaIBAN:'',piePagina:''})
  const [guardando,setGuardando]=useState(false); const [guardado,setGuardado]=useState(false)
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  useEffect(()=>{ if(empresa) setForm(f=>({...f,...empresa})) },[empresa])
  const guardar=async()=>{ setGuardando(true); await setDoc(doc(db,'configuracion','empresa'),form,{merge:true}); setGuardando(false); setGuardado(true); setTimeout(()=>setGuardado(false),3000) }
  return (
    <div>
      <SubTitle>Datos documentos</SubTitle>
      <G2>
        <Field label="Número PYME"><input value={form.numeroPyme} onChange={e=>set('numeroPyme',e.target.value)} style={iSt} /></Field>
        <Field label="Inscripción CCSS"><input value={form.ccss} onChange={e=>set('ccss',e.target.value)} style={iSt} /></Field>
        <Field label="Representante Legal"><input value={form.representanteLegal} onChange={e=>set('representanteLegal',e.target.value)} style={iSt} /></Field>
        <Field label="Cédula Representante"><input value={form.cedulaRepresentante} onChange={e=>set('cedulaRepresentante',e.target.value)} style={iSt} /></Field>
        <Field label="Licencia CFIA"><input value={form.licenciaCFIA} onChange={e=>set('licenciaCFIA',e.target.value)} style={iSt} /></Field>
        <Field label="Cuenta IBAN"><input value={form.cuentaIBAN} onChange={e=>set('cuentaIBAN',e.target.value)} placeholder="CR00 0000..." style={iSt} /></Field>
        <div style={{gridColumn:'1/-1'}}><Field label="Pie de página en cotizaciones"><textarea value={form.piePagina} onChange={e=>set('piePagina',e.target.value)} rows={3} style={{...iSt,resize:'vertical'}} /></Field></div>
      </G2>
      <SaveRow onSave={guardar} guardando={guardando} guardado={guardado} />
    </div>
  )
}

function EmpresaApariencia() {
  const [primaryColor,setPrimaryColor]=useState('#1a3a5c'); const [radius,setRadius]=useState('0'); const [guardado,setGuardado]=useState(false)
  const COLORES=['#1a3a5c','#0F6E56','#534AB7','#854F0B','#A32D2D','#185FA5','#2e7d32','#5F5E5A','#993C1D']
  const aplicarColor=col=>{ setPrimaryColor(col); document.documentElement.style.setProperty('--eco-primary',col); document.documentElement.style.setProperty('--eco-primary-light',col+'22') }
  const aplicarRadius=r=>{ setRadius(r); document.documentElement.style.setProperty('--eco-radius',r+'px') }
  const guardar=async()=>{ await setDoc(doc(db,'configuracion','estetica'),{primaryColor,radius},{merge:true}); setGuardado(true); setTimeout(()=>setGuardado(false),2500) }
  return (
    <div>
      <SubTitle>Apariencia</SubTitle>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:10}}>Color principal</div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
          {COLORES.map(col=><div key={col} onClick={()=>aplicarColor(col)} style={{width:36,height:36,borderRadius:'50%',background:col,cursor:'pointer',border:primaryColor===col?'3px solid #1a1a1a':'3px solid transparent',transition:'border .15s'}} />)}
          <input type="color" value={primaryColor} onChange={e=>aplicarColor(e.target.value)} style={{width:36,height:36,border:'1px solid #d0d8d0',borderRadius:'50%',cursor:'pointer',padding:2}} />
          <span style={{fontSize:12,color:'#888',fontFamily:'monospace'}}>{primaryColor}</span>
        </div>
      </div>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:10}}>Radio de bordes</div>
        <div style={{display:'flex',gap:8}}>
          {[{val:'0',label:'Recto'},{val:'6',label:'Suave'},{val:'12',label:'Redondeado'}].map(op=>(
            <button key={op.val} onClick={()=>aplicarRadius(op.val)} style={{padding:'8px 20px',borderRadius:parseInt(op.val)+'px',fontSize:12,border:radius===op.val?'2px solid #1a1a1a':'1px solid #d0d8d0',background:radius===op.val?'#1a1a1a':'#fff',color:radius===op.val?'#fff':'#1a1a1a',cursor:'pointer',fontFamily:'inherit'}}>{op.label}</button>
          ))}
        </div>
      </div>
      <SaveRow onSave={guardar} guardado={guardado} />
    </div>
  )
}

function PaginaEmpresa() {
  const {empresa}=useEmpresa(); const [sub,setSub]=useState(()=>localStorage.getItem('cfg_empresa_sub')||'basicos')
  const cambiarSub = (id) => { setSub(id); localStorage.setItem('cfg_empresa_sub',id) }
  const subs=[{id:'basicos',label:'Datos básicos'},{id:'logos',label:'Logos e imágenes'},{id:'documentos',label:'Datos documentos'},{id:'apariencia',label:'Apariencia'}]
  return (
    <div style={{display:'flex',height:'100%'}}>
      <SubNav grupo="Empresa" subs={subs} activo={sub} onChange={cambiarSub} />
      <div style={{flex:1,padding:'24px 28px',overflowY:'auto',background:'#f4f6f4'}}>
        {sub==='basicos'    && <EmpresaBasicos empresa={empresa} />}
        {sub==='logos'      && <EmpresaLogos empresa={empresa} />}
        {sub==='documentos' && <EmpresaDocumentos empresa={empresa} />}
        {sub==='apariencia' && <EmpresaApariencia />}
      </div>
    </div>
  )
}

// ─── USUARIOS ─────────────────────────────────────────────────────────────────
const ROLES_LISTA = ['Super Administrador','Administrador','Supervisor','Vendedor','Técnico','Solo lectura']
const ROL_COLOR = {'Super Administrador':'#7c1d1d','Administrador':'#1a6e3c','Supervisor':'#185FA5','Vendedor':'#854F0B','Técnico':'#534AB7','Solo lectura':'#5F5E5A'}
function genPass() { const c='ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!'; return Array.from({length:12},()=>c[Math.floor(Math.random()*c.length)]).join('') }

function PaginaUsuarios() {
  const authCtx=useAuth(); const yo=authCtx.usuario||authCtx.currentUser||null; const miUID=yo?.uid; const miRol=yo?.rol
  const esAdmin=miRol==='Super Administrador'||miRol==='Administrador'
  const [usuarios,setUsuarios]=useState([]); const [buscador,setBuscador]=useState('')
  const [modal,setModal]=useState(false); const [editando,setEditando]=useState(null)
  const [form,setForm]=useState({nombre:'',email:'',rol:'Supervisor',activo:true,password:''}); const [errModal,setErrModal]=useState('')
  const [guardando,setGuardando]=useState(false)
  const [resetTarget,setResetTarget]=useState(null); const [resetPass,setResetPass]=useState(''); const [resetVer,setResetVer]=useState(''); const [resetOk,setResetOk]=useState(false); const [resetErr,setResetErr]=useState(''); const [resetLoading,setResetLoading]=useState(false)
  const [perfilNombre,setPerfilNombre]=useState(yo?.nombre||''); const [perfilMsg,setPerfilMsg]=useState(''); const [passActual,setPassActual]=useState(''); const [passNueva,setPassNueva]=useState(''); const [passConfirm,setPassConfirm]=useState(''); const [passMsg,setPassMsg]=useState('')

  const cargar=async()=>{ const snap=await getDocs(collection(db,'usuarios')); setUsuarios(snap.docs.map(d=>({id:d.id,...d.data()}))) }
  useEffect(()=>{ cargar() },[])

  const abrirCrear=()=>{ setEditando(null); setForm({nombre:'',email:'',rol:'Supervisor',activo:true,password:''}); setErrModal(''); setModal(true) }
  const abrirEditar=u=>{ setEditando(u); setForm({nombre:u.nombre||'',email:u.email||'',rol:u.rol||'Supervisor',activo:u.activo!==false,password:''}); setErrModal(''); setModal(true) }

  const guardar=async()=>{
    if(!form.nombre.trim()||!form.email.trim()){setErrModal('Nombre y email son obligatorios');return}
    if(!editando&&form.password.length<6){setErrModal('La contraseña debe tener al menos 6 caracteres');return}
    setGuardando(true); setErrModal('')
    try {
      if(editando){ await updateDoc(doc(db,'usuarios',editando.id),{nombre:form.nombre,rol:form.rol,activo:form.activo}) }
      else { const auth=getAuth(); const cred=await createUserWithEmailAndPassword(auth,form.email,form.password); await setDoc(doc(db,'usuarios',cred.user.uid),{nombre:form.nombre,email:form.email,rol:form.rol,activo:form.activo,creadoEn:new Date().toISOString()}) }
      await cargar(); setModal(false)
    } catch(e){ setErrModal(e.code==='auth/email-already-in-use'?'Ese email ya está registrado.':'Error: '+e.message) }
    setGuardando(false)
  }

  const ejecutarReset=async()=>{
    if(!resetPass.trim()||resetPass.length<6){setResetErr('Mínimo 6 caracteres');return}
    if(resetPass!==resetVer){setResetErr('Las contraseñas no coinciden');return}
    setResetLoading(true); setResetErr('')
    try { const fns=getFunctions(); const fn=httpsCallable(fns,'cambiarPasswordUsuario'); await fn({targetUID:resetTarget.id,nuevaPassword:resetPass}); setResetOk(true) }
    catch(e){ setResetErr(e.message||'Error al cambiar la contraseña') }
    setResetLoading(false)
  }

  const guardarPerfil=async()=>{ await updateDoc(doc(db,'usuarios',miUID),{nombre:perfilNombre}); setPerfilMsg('✓ Guardado'); setTimeout(()=>setPerfilMsg(''),3000) }

  const cambiarPassPerfil=async()=>{
    if(passNueva!==passConfirm){setPassMsg('Las contraseñas no coinciden');return}
    if(passNueva.length<6){setPassMsg('Mínimo 6 caracteres');return}
    try { const {user}=authCtx; const cred=EmailAuthProvider.credential(user.email,passActual); await reauthenticateWithCredential(user,cred); await updatePassword(user,passNueva); setPassActual(''); setPassNueva(''); setPassConfirm(''); setPassMsg('✓ Contraseña actualizada') }
    catch{ setPassMsg('Contraseña actual incorrecta') }
  }

  const lista=usuarios.filter(u=>(u.nombre||'').toLowerCase().includes(buscador.toLowerCase())||(u.email||'').toLowerCase().includes(buscador.toLowerCase()))

  return (
    <div style={{padding:'24px 28px',overflowY:'auto',flex:1}}>
      <SubTitle>Mi perfil</SubTitle>
      <div style={{background:'#fff',border:'1px solid #e0e8e0',borderRadius:8,padding:16,marginBottom:28}}>
        <div style={{display:'flex',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize:11,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>Nombre</div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input value={perfilNombre} onChange={e=>setPerfilNombre(e.target.value)} style={{...iSt,flex:1}} />
              <Btn onClick={guardarPerfil}>Guardar</Btn>
              {perfilMsg&&<span style={{fontSize:11,color:'#1a6e3c'}}>{perfilMsg}</span>}
            </div>
          </div>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize:11,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:4}}>Cambiar contraseña</div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <input type="password" placeholder="Contraseña actual" value={passActual} onChange={e=>setPassActual(e.target.value)} style={iSt} />
              <input type="password" placeholder="Nueva contraseña" value={passNueva} onChange={e=>setPassNueva(e.target.value)} style={iSt} />
              <input type="password" placeholder="Confirmar nueva" value={passConfirm} onChange={e=>setPassConfirm(e.target.value)} style={iSt} />
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <Btn onClick={cambiarPassPerfil}>Actualizar</Btn>
                {passMsg&&<span style={{fontSize:11,color:passMsg.startsWith('✓')?'#1a6e3c':'#cc3333'}}>{passMsg}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <SubTitle>Usuarios del sistema</SubTitle>
        <div style={{display:'flex',gap:8}}>
          <input placeholder="Buscar..." value={buscador} onChange={e=>setBuscador(e.target.value)} style={{...iSt,width:180}} />
          {esAdmin&&<Btn onClick={abrirCrear}>+ Nuevo usuario</Btn>}
        </div>
      </div>
      <div style={{background:'#fff',border:'1px solid #e0e8e0',borderRadius:8,overflow:'hidden',marginBottom:28}}>
        <div style={{display:'grid',gridTemplateColumns:'2fr 2fr 1.5fr 0.8fr 1.5fr',padding:'10px 16px',background:'#f5f8f5',borderBottom:'1px solid #e0e8e0',fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'.04em'}}>
          <span>Nombre</span><span>Email</span><span>Rol</span><span>Estado</span><span style={{textAlign:'right'}}>Acciones</span>
        </div>
        {lista.length===0&&<div style={{padding:24,textAlign:'center',color:'#aaa',fontSize:13}}>Sin usuarios</div>}
        {lista.map((u,i)=>(
          <div key={u.id} style={{display:'grid',gridTemplateColumns:'2fr 2fr 1.5fr 0.8fr 1.5fr',padding:'11px 16px',alignItems:'center',borderBottom:i<lista.length-1?'1px solid #f0f4f0':'none',background:u.id===miUID?'#f9fff9':'#fff'}}>
            <div style={{fontSize:13,fontWeight:600,color:'#1a1a1a'}}>{u.nombre}{u.id===miUID&&<span style={{fontSize:10,color:'#1a6e3c',marginLeft:4}}>(tú)</span>}</div>
            <div style={{fontSize:12,color:'#555'}}>{u.email}</div>
            <span style={{fontSize:11,fontWeight:600,padding:'2px 10px',borderRadius:20,background:(ROL_COLOR[u.rol]||'#888')+'18',color:ROL_COLOR[u.rol]||'#888',border:`1px solid ${(ROL_COLOR[u.rol]||'#888')}40`,display:'inline-block'}}>{u.rol}</span>
            <span style={{fontSize:11,fontWeight:600,borderRadius:20,padding:'2px 10px',display:'inline-block',color:u.activo!==false?'#1a6e3c':'#999',background:u.activo!==false?'#e8f5e9':'#f0f0f0'}}>{u.activo!==false?'Activo':'Inactivo'}</span>
            <div style={{display:'flex',gap:5,justifyContent:'flex-end',flexWrap:'wrap'}}>
              {esAdmin&&u.id!==miUID&&<button onClick={()=>abrirEditar(u)} style={{fontSize:11,fontWeight:600,border:'1px solid #d0d8d0',borderRadius:5,padding:'3px 10px',cursor:'pointer',background:'#fff'}}>Editar</button>}
              {u.id!==miUID&&<button onClick={()=>{setResetTarget(u);setResetPass('');setResetVer('');setResetOk(false);setResetErr('')}} style={{fontSize:11,fontWeight:600,border:'1px solid #185FA5',borderRadius:5,padding:'3px 10px',cursor:'pointer',background:'#fff',color:'#185FA5'}}>🔑</button>}
            </div>
          </div>
        ))}
      </div>
      {modal&&(
        <Modal onClose={()=>setModal(false)}>
          <div style={{padding:'18px 24px',borderBottom:'1px solid #eee',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <h3 style={{margin:0,fontSize:15,fontWeight:700}}>{editando?'Editar usuario':'Nuevo usuario'}</h3>
            <button onClick={()=>setModal(false)} style={{background:'none',border:'none',fontSize:18,cursor:'pointer',color:'#888'}}>✕</button>
          </div>
          <div style={{padding:24,display:'flex',flexDirection:'column',gap:12}}>
            <Field label="Nombre completo *"><input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} style={iSt} /></Field>
            {!editando&&<Field label="Email *"><input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={iSt} /></Field>}
            {!editando&&<Field label="Contraseña inicial *"><input type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} style={iSt} placeholder="Mínimo 6 caracteres" /></Field>}
            <Field label="Rol"><select value={form.rol} onChange={e=>setForm(f=>({...f,rol:e.target.value}))} style={iSt}>{ROLES_LISTA.map(r=><option key={r}>{r}</option>)}</select></Field>
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer'}}><input type="checkbox" checked={form.activo} onChange={e=>setForm(f=>({...f,activo:e.target.checked}))} />Usuario activo</label>
            {errModal&&<div style={{background:'#fdecea',border:'1px solid #e53935',borderRadius:6,padding:'8px 12px',fontSize:12,color:'#c62828'}}>{errModal}</div>}
          </div>
          <div style={{padding:'14px 24px',borderTop:'1px solid #eee',display:'flex',justifyContent:'flex-end',gap:10}}>
            <Btn onClick={()=>setModal(false)} outline>Cancelar</Btn>
            <Btn onClick={guardar} disabled={guardando}>{guardando?'Guardando...':editando?'Guardar cambios':'Crear usuario'}</Btn>
          </div>
        </Modal>
      )}
      {resetTarget&&(
        <Modal onClose={()=>setResetTarget(null)}>
          <div style={{padding:'18px 24px',borderBottom:'1px solid #eee',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <h3 style={{margin:0,fontSize:15,fontWeight:700}}>Cambiar contraseña — {resetTarget.nombre}</h3>
            <button onClick={()=>setResetTarget(null)} style={{background:'none',border:'none',fontSize:18,cursor:'pointer',color:'#888'}}>✕</button>
          </div>
          <div style={{padding:24}}>
            {!resetOk?(
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <button onClick={()=>{const p=genPass();setResetPass(p);setResetVer(p)}} style={{background:'#f0f7f0',border:'1px dashed #4caf50',borderRadius:8,padding:'10px',cursor:'pointer',fontSize:13,color:'#1a6e3c',fontWeight:600,fontFamily:'inherit'}}>✨ Generar contraseña aleatoria</button>
                <Field label="Nueva contraseña"><input type="password" value={resetPass} onChange={e=>{setResetPass(e.target.value);setResetErr('')}} style={iSt} placeholder="Mínimo 6 caracteres" /></Field>
                <Field label="Confirmar contraseña"><input type="password" value={resetVer} onChange={e=>{setResetVer(e.target.value);setResetErr('')}} style={{...iSt,borderColor:resetVer&&resetPass!==resetVer?'#e53935':'#d0d8d0'}} /></Field>
                {resetErr&&<div style={{background:'#fdecea',border:'1px solid #e53935',borderRadius:6,padding:'8px 12px',fontSize:12,color:'#c62828'}}>{resetErr}</div>}
                <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
                  <Btn onClick={()=>setResetTarget(null)} outline>Cancelar</Btn>
                  <Btn onClick={ejecutarReset} disabled={resetLoading} color="#185FA5">{resetLoading?'Cambiando...':'Cambiar contraseña'}</Btn>
                </div>
              </div>
            ):(
              <div style={{textAlign:'center',padding:'10px 0 20px'}}>
                <div style={{fontSize:48,marginBottom:12}}>✅</div>
                <p style={{fontSize:15,fontWeight:700,color:'#1a6e3c'}}>¡Contraseña cambiada!</p>
                <button onClick={()=>setResetTarget(null)} style={{marginTop:16,background:'#1a6e3c',color:'#fff',border:'none',borderRadius:8,padding:'8px 24px',fontSize:13,cursor:'pointer'}}>Listo</button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── ROLES ────────────────────────────────────────────────────────────────────
const MODULOS_R = [
  {key:'inicio',label:'Inicio'},
  {key:'crm',label:'CRM / Leads',subs:['Ver leads','Ver leads de todos los vendedores','Crear lead','Editar lead','Reasignar lead a otro vendedor','Marcar como Perdido','Eliminar lead']},
  {key:'chats',label:'Chats WA',subs:['Ver chats','Ver chats de todos los vendedores','Enviar mensajes','Asignar/reasignar conversación','Solicitar ayuda en conversación','Crear lead desde chat']},
  {key:'contactos',label:'Contactos',subs:['Ver','Crear','Editar','Eliminar']},
  {key:'ventas',label:'Cotizaciones',subs:['Ver cotizaciones','Ver cotizaciones de todos','Ver precios y costos','Crear cotización','Editar cotización','Aprobar cotización manualmente','Enviar enlace al cliente','Eliminar cotización']},
  {key:'inventario',label:'Inventario',subs:['Ver productos','Ver costos de productos','Ver stock','Agregar producto','Editar producto','Ajustar stock manualmente','Eliminar producto']},
  {key:'calendario',label:'Calendario',subs:['Ver eventos','Ver eventos de todos','Crear evento','Editar evento','Eliminar evento']},
  {key:'configuracion',label:'Configuración',subs:['Mi Empresa','Usuarios','Roles','Catálogos','Estética','Conectores WhatsApp']},
]
const CRITICOS=['Marcar como Perdido','Eliminar lead','Eliminar cotización','Eliminar producto','Eliminar evento']
const VISIBILIDAD=['Ver leads de todos los vendedores','Ver chats de todos los vendedores','Ver cotizaciones de todos','Ver eventos de todos','Ver costos de productos','Ver precios y costos']
const ROLES_DEF=[
  {nombre:'Administrador',color:'#1a6e3c',permisos:Object.fromEntries(MODULOS_R.flatMap(m=>[[m.key,true],...(m.subs||[]).map(s=>[`${m.key}_${s}`,true])]))},
  {nombre:'Supervisor',color:'#185FA5',permisos:Object.fromEntries(MODULOS_R.flatMap(m=>[[m.key,true],...(m.subs||[]).map(s=>[`${m.key}_${s}`,!['crm_Eliminar lead','ventas_Eliminar cotización'].includes(`${m.key}_${s}`)])]))},
  {nombre:'Vendedor',color:'#854F0B',permisos:{inicio:true,crm:true,'crm_Ver leads':true,'crm_Crear lead':true,'crm_Editar lead':true,chats:true,'chats_Ver chats':true,'chats_Enviar mensajes':true,contactos:true,'contactos_Ver':true,'contactos_Crear':true,ventas:true,'ventas_Ver cotizaciones':true,'ventas_Crear cotización':true,'ventas_Editar cotización':true,inventario:true,'inventario_Ver productos':true,calendario:true,'calendario_Ver eventos':true,'calendario_Crear evento':true}},
  {nombre:'Técnico',color:'#534AB7',permisos:{inicio:true,crm:true,'crm_Ver leads':true,contactos:true,'contactos_Ver':true,calendario:true,'calendario_Ver eventos':true,'calendario_Editar evento':true,inventario:true,'inventario_Ver productos':true}},
  {nombre:'Solo lectura',color:'#5F5E5A',permisos:{inicio:true,crm:true,'crm_Ver leads':true,contactos:true,'contactos_Ver':true,ventas:true,'ventas_Ver cotizaciones':true,inventario:true,'inventario_Ver productos':true,calendario:true,'calendario_Ver eventos':true}},
]

function PaginaRoles() {
  const authCtx=useAuth(); const yo=authCtx.usuario||authCtx.currentUser||null; const miRol=yo?.rol||''
  const esAdmin=miRol==='Super Administrador'||miRol==='Administrador'
  const [roles,setRoles]=useState([]); const [rolActivo,setRolActivo]=useState(null); const [permisos,setPermisos]=useState({}); const [guardando,setGuardando]=useState(false); const [msg,setMsg]=useState('')
  const [nuevoRol,setNuevoRol]=useState(''); const [editandoNombre,setEditandoNombre]=useState(null); const [nombreEditado,setNombreEditado]=useState('')
  const cargar=async()=>{ const snap=await getDocs(collection(db,'roles')); if(snap.empty){for(const r of ROLES_DEF) await addDoc(collection(db,'roles'),r); const s2=await getDocs(collection(db,'roles')); const d=s2.docs.map(d=>({id:d.id,...d.data()})); setRoles(d); setRolActivo(d[0]); setPermisos(d[0]?.permisos||{}) } else { const d=snap.docs.map(d=>({id:d.id,...d.data()})); setRoles(d); setRolActivo(d[0]); setPermisos(d[0]?.permisos||{}) } }
  useEffect(()=>{ cargar() },[])
  const seleccionar=r=>{ setRolActivo(r); setPermisos(r.permisos||{}); setMsg('') }
  const toggleMod=key=>{ if(!esAdmin) return; setPermisos(p=>({...p,[key]:!p[key]})) }
  const toggleSub=(mk,s)=>{ if(!esAdmin) return; const k=`${mk}_${s}`; setPermisos(p=>({...p,[k]:!p[k]})) }
  const guardar=async()=>{ setGuardando(true); await setDoc(doc(db,'roles',rolActivo.id),{...rolActivo,permisos},{merge:true}); setMsg('✓ Guardado'); setGuardando(false); setTimeout(()=>setMsg(''),2500) }
  const agregarRol=async()=>{ if(!nuevoRol.trim()) return; await addDoc(collection(db,'roles'),{nombre:nuevoRol.trim(),color:'#888',permisos:{}}); setNuevoRol(''); cargar() }
  const guardarNombreRol=async(id)=>{ if(!nombreEditado.trim()){setEditandoNombre(null);return}; await setDoc(doc(db,'roles',id),{nombre:nombreEditado.trim()},{merge:true}); setEditandoNombre(null); cargar() }
  const eliminarRol=async(id)=>{ const r=roles.find(r=>r.id===id); if(r?.nombre==='Administrador'||r?.nombre==='Super Administrador') return; if(!confirm('¿Eliminar rol?')) return; await deleteDoc(doc(db,'roles',id)); cargar() }
  const esRolAdmin=rolActivo?.nombre==='Administrador'||rolActivo?.nombre==='Super Administrador'
  return (
    <div style={{display:'flex',height:'100%'}}>
      <div style={{width:210,flexShrink:0,borderRight:'1px solid #d0d8d0',padding:'8px 0',background:'#fafafa'}}>
        <div style={{fontSize:9,color:'#aaa',textTransform:'uppercase',letterSpacing:'.7px',padding:'8px 14px 4px'}}>Roles</div>
        {roles.map(r=>(
          <div key={r.id} onClick={()=>seleccionar(r)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',cursor:'pointer',fontSize:12,color:rolActivo?.id===r.id?'var(--eco-primary)':'#1a1a1a',background:rolActivo?.id===r.id?'var(--eco-primary-light)':'transparent',borderLeft:`3px solid ${rolActivo?.id===r.id?'var(--eco-primary)':'transparent'}`}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:r.color||'#888',flexShrink:0}} />{r.nombre}
          </div>
        ))}
        {esAdmin&&(
          <div style={{padding:'8px 10px',borderTop:'1px solid #eee',marginTop:6}}>
            <div style={{display:'flex',gap:4}}>
              <input value={nuevoRol} onChange={e=>setNuevoRol(e.target.value)} onKeyDown={e=>e.key==='Enter'&&agregarRol()} placeholder="Nuevo rol..." style={{flex:1,border:'1px solid #d0d8d0',borderRadius:4,padding:'4px 8px',fontSize:11,outline:'none',fontFamily:'inherit'}} />
              <button onClick={agregarRol} style={{padding:'4px 8px',background:'var(--eco-primary)',color:'#fff',border:'none',borderRadius:4,fontSize:10,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>+ Crear</button>
            </div>
          </div>
        )}
      </div>
      <div style={{flex:1,padding:'20px 24px',overflowY:'auto',background:'#f4f6f4'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:600,color:'#1a1a1a'}}>Permisos — {rolActivo?.nombre}</div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {msg&&<span style={{fontSize:12,color:'#1a6e3c'}}>{msg}</span>}
            {!esRolAdmin&&esAdmin&&<Btn onClick={guardar} disabled={guardando}>{guardando?'Guardando...':'Guardar permisos'}</Btn>}
          </div>
        </div>
        {esRolAdmin?(
          <div style={{background:'#f0f7f0',border:'1px solid #c8dcc8',borderRadius:8,padding:'14px 18px',fontSize:13,color:'#2e5e2e'}}>Este rol tiene acceso total al sistema.</div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {MODULOS_R.map(mod=>(
              <div key={mod.key} style={{background:'#fff',border:'1px solid #e0e8e0',borderRadius:8,overflow:'hidden'}}>
                <div style={{padding:'9px 14px',display:'flex',alignItems:'center',gap:8}}>
                  <input type="checkbox" checked={!!permisos[mod.key]} onChange={()=>toggleMod(mod.key)} style={{accentColor:'var(--eco-primary)',cursor:'pointer'}} />
                  <span style={{fontSize:13,fontWeight:600,color:'#1a1a1a'}}>{mod.label}</span>
                  {mod.subs&&<span style={{marginLeft:'auto',fontSize:10,color:'#aaa'}}>{mod.subs.filter(s=>!!permisos[`${mod.key}_${s}`]).length}/{mod.subs.length}</span>}
                </div>
                {mod.subs&&permisos[mod.key]&&(
                  <div style={{padding:'6px 14px 10px 36px',display:'flex',flexWrap:'wrap',gap:5,borderTop:'1px solid #f0f4f0'}}>
                    {mod.subs.map(sub=>{
                      const critico=CRITICOS.includes(sub); const vis=VISIBILIDAD.includes(sub)
                      return <label key={sub} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,cursor:'pointer',padding:'2px 7px',borderRadius:5,color:critico?'#991B1B':vis?'#1e40af':'#555',background:critico?'#FFF5F5':vis?'#EFF6FF':'transparent',border:critico?'0.5px solid #FCA5A5':vis?'0.5px solid #BFDBFE':'none'}}>
                        <input type="checkbox" checked={!!permisos[`${mod.key}_${sub}`]} onChange={()=>toggleSub(mod.key,sub)} style={{accentColor:critico?'#991B1B':'var(--eco-primary)',cursor:'pointer'}} />{sub}
                      </label>
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CUENTAS EMAIL ────────────────────────────────────────────────────────────
const SMTP_PUERTOS = [
  { value: 465, label: '465 — SSL (recomendado)' },
  { value: 587, label: '587 — TLS/STARTTLS' },
  { value: 25,  label: '25 — Sin cifrado' },
]

function FormCuentaEmail({ inicial, onGuardado, onCancelar }) {
  const fns = getFunctions()
  const fnGuardar = httpsCallable(fns, 'guardarCuentaEmail')
  const [form, setForm] = useState(inicial || { nombre:'', email:'', smtpHost:'', smtpPuerto:465, smtpUsuario:'', smtpPassword:'', activo:true })
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [mostrarPass, setMostrarPass] = useState(false)
  const esEdicion = !!inicial?.id
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const guardar = async () => {
    if (!form.nombre || !form.email || !form.smtpHost || !form.smtpUsuario) {
      setMsg({ tipo: 'error', texto: 'Completá todos los campos obligatorios.' }); return
    }
    if (!esEdicion && !form.smtpPassword) {
      setMsg({ tipo: 'error', texto: 'La contraseña SMTP es obligatoria.' }); return
    }
    setGuardando(true); setMsg(null)
    try {
      const payload = { ...form }
      if (esEdicion) payload.id = inicial.id
      await fnGuardar(payload)
      setMsg({ tipo: 'ok', texto: '✓ Cuenta guardada.' })
      setTimeout(() => onGuardado(), 800)
    } catch (e) {
      setMsg({ tipo: 'error', texto: e.message || 'Error al guardar.' })
    } finally { setGuardando(false) }
  }

  const inp = { width:'100%', padding:'7px 10px', border:'1px solid #d0d8d0', borderRadius:6, fontSize:12, background:'#fff', color:'#1a1a1a', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }
  const lbl = { fontSize:10, fontWeight:700, color:'#5c6b5c', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4, display:'block' }

  return (
    <div style={{ background:'#F0F7FF', border:'1px solid #B3D4F5', borderRadius:9, padding:18, marginTop:14 }}>
      <div style={{ fontSize:13, fontWeight:600, color:'#185FA5', marginBottom:14 }}>
        {esEdicion ? '✏️ Editar cuenta' : '➕ Nueva cuenta de email'}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <div><label style={lbl}>Nombre *</label><input style={inp} placeholder="ej: Ventas" value={form.nombre} onChange={e=>set('nombre',e.target.value)} /></div>
        <div><label style={lbl}>Email *</label><input style={inp} placeholder="ventas@dominio.com" value={form.email} onChange={e=>set('email',e.target.value)} /></div>
        <div><label style={lbl}>Servidor SMTP *</label><input style={inp} placeholder="mail.dominio.com" value={form.smtpHost} onChange={e=>set('smtpHost',e.target.value)} /></div>
        <div><label style={lbl}>Puerto SMTP *</label>
          <select style={inp} value={form.smtpPuerto} onChange={e=>set('smtpPuerto',Number(e.target.value))}>
            {SMTP_PUERTOS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Usuario SMTP *</label><input style={inp} placeholder="ventas@dominio.com" value={form.smtpUsuario} onChange={e=>set('smtpUsuario',e.target.value)} autoComplete="off" /></div>
        <div>
          <label style={lbl}>Contraseña {esEdicion ? '(vacío = no cambiar)' : '*'}</label>
          <div style={{ display:'flex', gap:6 }}>
            <input style={inp} type={mostrarPass?'text':'password'} placeholder={esEdicion?'••••••••':'Contraseña del email'} value={form.smtpPassword} onChange={e=>set('smtpPassword',e.target.value)} autoComplete="new-password" />
            <button onClick={()=>setMostrarPass(v=>!v)} style={{ padding:'0 10px', border:'1px solid #d0d8d0', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:13, flexShrink:0 }}>{mostrarPass?'🙈':'👁'}</button>
          </div>
        </div>
      </div>
      {msg && <div style={{ padding:'8px 12px', borderRadius:6, fontSize:12, marginBottom:10, background:msg.tipo==='ok'?'#EAF3DE':'#FCEBEB', color:msg.tipo==='ok'?'#3B6D11':'#A32D2D' }}>{msg.texto}</div>}
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <Btn onClick={onCancelar} outline>Cancelar</Btn>
        <Btn onClick={guardar} disabled={guardando}>{guardando?'Guardando...':'Guardar cuenta'}</Btn>
      </div>
    </div>
  )
}

function SeccionEmailConfig() {
  const fns = getFunctions()
  const fnListar   = httpsCallable(fns, 'listarCuentasEmail')
  const fnEliminar = httpsCallable(fns, 'eliminarCuentaEmail')
  const fnProbar   = httpsCallable(fns, 'probarSmtp')

  const [cuentas, setCuentas]         = useState([])
  const [cargando, setCargando]       = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando]       = useState(null)
  const [probando, setProbando]       = useState(null)
  const [confirmElim, setConfirmElim] = useState(null)
  const [eliminando, setEliminando]   = useState(null)
  const [msg, setMsg]                 = useState(null)

  const cargar = async () => {
    setCargando(true)
    try { const res = await fnListar(); setCuentas(res.data.cuentas || []) }
    catch (e) { setMsg({ tipo:'error', texto:'Error al cargar: ' + e.message }) }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [])

  const probar = async (id) => {
    setProbando(id); setMsg(null)
    try { const res = await fnProbar({ cuentaId:id }); setMsg({ tipo:'ok', texto: res.data.mensaje }) }
    catch (e) { setMsg({ tipo:'error', texto:'✗ ' + e.message }) }
    finally { setProbando(null) }
  }

  const eliminar = async (id) => {
    setEliminando(id)
    try { await fnEliminar({ id }); setConfirmElim(null); await cargar() }
    catch (e) { setMsg({ tipo:'error', texto:'Error: ' + e.message }) }
    finally { setEliminando(null) }
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <SubTitle>Cuentas de Email (SMTP)</SubTitle>
        <Btn onClick={() => { setMostrarForm(true); setEditando(null) }}>+ Agregar cuenta</Btn>
      </div>

      {msg && (
        <div style={{ padding:'9px 14px', borderRadius:7, fontSize:12, marginBottom:14, background:msg.tipo==='ok'?'#EAF3DE':'#FCEBEB', color:msg.tipo==='ok'?'#3B6D11':'#A32D2D', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          {msg.texto}
          <button onClick={()=>setMsg(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:'inherit' }}>✕</button>
        </div>
      )}

      {cargando ? (
        <div style={{ color:'#aaa', fontSize:13 }}>Cargando...</div>
      ) : cuentas.length === 0 && !mostrarForm ? (
        <div style={{ textAlign:'center', padding:'30px 0', color:'#aaa' }}>
          <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
          <div style={{ fontSize:13 }}>No hay cuentas configuradas. Agregá la primera.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {cuentas.map(c => (
            <div key={c.id} style={{ border:'1px solid #e0e8e0', borderRadius:8, padding:'12px 16px', background:'#fff' }}>
              {editando?.id === c.id ? (
                <FormCuentaEmail inicial={editando} onGuardado={() => { setEditando(null); cargar() }} onCancelar={() => setEditando(null)} />
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:180 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontWeight:600, fontSize:13 }}>{c.nombre}</span>
                      <span style={{ fontSize:10, fontWeight:600, padding:'1px 8px', borderRadius:10, background:c.activo?'#EAF3DE':'#f5f5f5', color:c.activo?'#3B6D11':'#999' }}>{c.activo?'Activa':'Inactiva'}</span>
                      {c.tienePassword && <span style={{ fontSize:10, padding:'1px 8px', borderRadius:10, background:'#E6F1FB', color:'#185FA5' }}>🔒 Clave guardada</span>}
                    </div>
                    <div style={{ fontSize:12, color:'#666', marginTop:2 }}>{c.email}</div>
                    <div style={{ fontSize:11, color:'#aaa', marginTop:1 }}>{c.smtpHost}:{c.smtpPuerto}</div>
                  </div>
                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    <button onClick={()=>probar(c.id)} disabled={probando===c.id} style={{ fontSize:11, padding:'4px 12px', border:'none', borderRadius:6, cursor:'pointer', background:'#EAF3DE', color:'#3B6D11', fontFamily:'inherit', opacity:probando===c.id?0.6:1 }}>
                      {probando===c.id?'...':'⚡ Probar'}
                    </button>
                    <button onClick={()=>setEditando(c)} style={{ fontSize:11, padding:'4px 12px', border:'1px solid #d0d8d0', borderRadius:6, cursor:'pointer', background:'#fff', fontFamily:'inherit' }}>Editar</button>
                    {confirmElim === c.id ? (
                      <>
                        <button onClick={()=>eliminar(c.id)} disabled={eliminando===c.id} style={{ fontSize:11, padding:'4px 12px', border:'none', borderRadius:6, cursor:'pointer', background:'#FCEBEB', color:'#A32D2D', fontFamily:'inherit' }}>{eliminando===c.id?'...':'Confirmar'}</button>
                        <button onClick={()=>setConfirmElim(null)} style={{ fontSize:11, padding:'4px 10px', border:'1px solid #d0d8d0', borderRadius:6, cursor:'pointer', background:'#fff', fontFamily:'inherit' }}>✕</button>
                      </>
                    ) : (
                      <button onClick={()=>setConfirmElim(c.id)} style={{ fontSize:11, padding:'4px 12px', border:'1px solid #fca5a5', borderRadius:6, cursor:'pointer', background:'#fff', color:'#A32D2D', fontFamily:'inherit' }}>Eliminar</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {mostrarForm && !editando && (
        <FormCuentaEmail onGuardado={() => { setMostrarForm(false); cargar() }} onCancelar={() => setMostrarForm(false)} />
      )}

      <div style={{ marginTop:18, padding:'12px 16px', background:'#FFFBF0', border:'1px solid #F0D080', borderRadius:8 }}>
        <div style={{ fontSize:11, fontWeight:600, color:'#854F0B', marginBottom:6 }}>📋 Datos SMTP desde cPanel</div>
        <ol style={{ fontSize:11, color:'#666', margin:0, paddingLeft:18, lineHeight:1.9 }}>
          <li>Ingresá a cPanel → <strong>Cuentas de correo electrónico</strong></li>
          <li>Clic en <strong>Conectar dispositivos</strong> junto a la cuenta</li>
          <li>Servidor SMTP: <code>mail.tudominio.com</code></li>
          <li>Puerto <strong>465</strong> (SSL) — Usuario = email completo</li>
        </ol>
      </div>
    </div>
  )
}

// ─── CONEXIONES ───────────────────────────────────────────────────────────────
const DEFAULT_BOT={activo:false,mensajeBienvenida:'Hola 👋 Bienvenido. Soy el asistente virtual.',preguntaNombre:'¿Cuál es tu nombre completo?',preguntaServicio:'¿Qué tipo de servicio necesitás?\n\n1. Instalación\n2. Mantenimiento\n3. Reparación\n4. Cotización\n5. Otro',preguntaUbicacion:'¿En qué zona estás ubicado?',preguntaUrgencia:'¿Qué tan urgente es?\n\n1. Urgente\n2. Esta semana\n3. Sin prisa',mensajeHandoff:'¡Gracias! Un agente te atenderá pronto 🙌',delaySt:60,delayPorCaracter:40,delayMax:4000,horarioActivo:false,horarioInicio:'08:00',horarioFin:'18:00',diasActivos:['lun','mar','mie','jue','vie'],mensajeFueraHorario:'Estamos fuera de horario. Te atendemos lunes a viernes 8am-6pm 📝',crearLeadAuto:true}
const DIAS=[{key:'lun',label:'Lun'},{key:'mar',label:'Mar'},{key:'mie',label:'Mié'},{key:'jue',label:'Jue'},{key:'vie',label:'Vie'},{key:'sab',label:'Sáb'},{key:'dom',label:'Dom'}]

function BotConfig() {
  const [config,setConfig]=useState(DEFAULT_BOT); const [guardando,setGuardando]=useState(false); const [guardado,setGuardado]=useState(false); const [cargando,setCargando]=useState(true)
  const set=(k,v)=>setConfig(p=>({...p,[k]:v}))
  useEffect(()=>{ getDoc(doc(db,'config/bot')).then(snap=>{ if(snap.exists()) setConfig({...DEFAULT_BOT,...snap.data()}); setCargando(false) }) },[])
  const guardar=async()=>{ setGuardando(true); await setDoc(doc(db,'config/bot'),config); setGuardando(false); setGuardado(true); setTimeout(()=>setGuardado(false),2500) }
  const toggleDia=dia=>{ const dias=config.diasActivos.includes(dia)?config.diasActivos.filter(d=>d!==dia):[...config.diasActivos,dia]; set('diasActivos',dias) }
  if(cargando) return <div style={{color:'#aaa',fontSize:13}}>Cargando...</div>
  return (
    <div>
      <SubTitle>Bot WhatsApp</SubTitle>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#fff',border:'1px solid #e0e8e0',borderRadius:8,padding:'14px 16px',marginBottom:12}}>
        <div><div style={{fontSize:13,fontWeight:500}}>Bot activo</div><div style={{fontSize:11,color:'#888',marginTop:2}}>Responde automáticamente a mensajes nuevos</div></div>
        <Toggle value={config.activo} onChange={v=>set('activo',v)} />
      </div>
      {[{key:'mensajeBienvenida',label:'Mensaje de bienvenida',rows:2},{key:'preguntaNombre',label:'Pregunta de nombre',rows:1},{key:'preguntaServicio',label:'Menú de servicios',rows:5},{key:'preguntaUbicacion',label:'Pregunta de ubicación',rows:1},{key:'preguntaUrgencia',label:'Pregunta de urgencia',rows:4},{key:'mensajeHandoff',label:'Mensaje de traspaso al agente',rows:2}].map(f=>(
        <div key={f.key} style={{marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:5}}>{f.label}</div>
          <textarea value={config[f.key]} onChange={e=>set(f.key,e.target.value)} rows={f.rows} style={{...iSt,resize:'vertical',lineHeight:1.6}} />
        </div>
      ))}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#fff',border:'1px solid #e0e8e0',borderRadius:8,padding:'14px 16px',marginBottom:12}}>
        <div><div style={{fontSize:13,fontWeight:500}}>Respetar horario de oficina</div><div style={{fontSize:11,color:'#888',marginTop:2}}>Fuera de horario envía aviso y no continúa el flujo</div></div>
        <Toggle value={config.horarioActivo} onChange={v=>set('horarioActivo',v)} />
      </div>
      {config.horarioActivo&&(
        <div style={{background:'#fff',border:'1px solid #e0e8e0',borderRadius:8,padding:'14px 16px',marginBottom:12}}>
          <div style={{display:'flex',gap:12,marginBottom:12}}>
            <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:5}}>Hora inicio</div><input type="time" value={config.horarioInicio} onChange={e=>set('horarioInicio',e.target.value)} style={iSt} /></div>
            <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:5}}>Hora fin</div><input type="time" value={config.horarioFin} onChange={e=>set('horarioFin',e.target.value)} style={iSt} /></div>
          </div>
          <div style={{fontSize:11,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:6}}>Días activos</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
            {DIAS.map(d=><button key={d.key} onClick={()=>toggleDia(d.key)} style={{padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit',border:'0.5px solid #d0d8d0',background:config.diasActivos.includes(d.key)?'var(--eco-primary)':'#fff',color:config.diasActivos.includes(d.key)?'#fff':'#555'}}>{d.label}</button>)}
          </div>
          <div style={{fontSize:11,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:5}}>Mensaje fuera de horario</div>
          <textarea value={config.mensajeFueraHorario} onChange={e=>set('mensajeFueraHorario',e.target.value)} rows={2} style={{...iSt,resize:'vertical'}} />
        </div>
      )}
      <SaveRow onSave={guardar} guardando={guardando} guardado={guardado} />
    </div>
  )
}

function PaginaConexiones() {
  const navigate=useNavigate()
  const [sub,setSub]=useState(()=>localStorage.getItem('cfg_con_sub')||'whatsapp')
  const cambiarSub = (id) => { setSub(id); localStorage.setItem('cfg_con_sub',id) }
  const subs=[{id:'whatsapp',label:'WhatsApp'},{id:'bot',label:'Bot WhatsApp'},{id:'email',label:'📧 Email'}]
  return (
    <div style={{display:'flex',height:'100%'}}>
      <SubNav grupo="Conexiones" subs={subs} activo={sub} onChange={cambiarSub} />
      <div style={{flex:1,padding:'24px 28px',overflowY:'auto',background:'#f4f6f4'}}>
        {sub==='whatsapp'&&(
          <div>
            <SubTitle>WhatsApp Business</SubTitle>
            <p style={{fontSize:13,color:'#666',marginBottom:16}}>Conectá tu número de WhatsApp Business para enviar y recibir mensajes desde el CRM.</p>
            <button onClick={()=>navigate('/configuracion/conectores/whatsapp')} style={{background:'#25D366',color:'#fff',border:'none',borderRadius:8,padding:'10px 24px',fontSize:13,fontWeight:500,cursor:'pointer'}}>💬 Configurar WhatsApp →</button>
          </div>
        )}
        {sub==='bot'&&<BotConfig />}
        {sub==='email'&&<SeccionEmailConfig />}
      </div>
    </div>
  )
}

// ─── CATÁLOGOS ────────────────────────────────────────────────────────────────
const CONS_DOCS=[{key:'prefijoCotizacion',label:'Cotizaciones',default:'CTO'},{key:'prefijoProyecto',label:'Proyectos',default:'PRY'},{key:'prefijoCotProyecto',label:'Cotiz. Proyecto',default:'CP'},{key:'prefijoOrdenCompra',label:'Órdenes Compra',default:'OC'},{key:'prefijoOrdenTrabajo',label:'Órdenes Trabajo',default:'OT'}]

function Consecutivos() {
  const [valores,setValores]=useState({}); const [inicio,setInicio]=useState({}); const [guardando,setGuardando]=useState(false); const [guardado,setGuardado]=useState(false)
  useEffect(()=>{ getDoc(doc(db,'config','consecutivos')).then(snap=>{ if(snap.exists()){const d=snap.data();setValores(d);const ini={};CONS_DOCS.forEach(doc=>{ini[doc.key+'_inicio']=d[doc.key+'_inicio']||1});setInicio(ini)} else{const def={};const ini={};CONS_DOCS.forEach(d=>{def[d.key]=d.default;ini[d.key+'_inicio']=1});setValores(def);setInicio(ini)} }) },[])
  const guardar=async()=>{ setGuardando(true); await setDoc(doc(db,'config','consecutivos'),{...valores,...inicio}); setGuardando(false); setGuardado(true); setTimeout(()=>setGuardado(false),2500) }
  return (
    <div style={{marginBottom:28}}>
      <SubTitle>Consecutivos</SubTitle>
      <div style={{background:'#e3f2fd',border:'1px solid #90caf9',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#1565c0',marginBottom:14}}>
        Ejemplo: prefijo <strong>CTO</strong> con inicio en <strong>5</strong> → documentos numerados <strong>CTO-005, CTO-006...</strong>
      </div>
      {CONS_DOCS.map(d=>(
        <div key={d.key} style={{background:'#fff',border:'1px solid #e0e8e0',borderRadius:8,padding:'12px 16px',marginBottom:8,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:120,fontSize:13,fontWeight:500}}>{d.label}</div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div><div style={{fontSize:9,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:3}}>Prefijo</div><input value={valores[d.key]||d.default} onChange={e=>setValores(v=>({...v,[d.key]:e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,'')}))} maxLength={10} style={{...iSt,width:80,textAlign:'center',fontFamily:'monospace',fontWeight:700,color:'#2e7d32',fontSize:14}} /></div>
            <div><div style={{fontSize:9,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:3}}>Empieza en</div><input type="number" min={1} value={inicio[d.key+'_inicio']||1} onChange={e=>setInicio(v=>({...v,[d.key+'_inicio']:parseInt(e.target.value)||1}))} style={{...iSt,width:80,textAlign:'center',fontFamily:'monospace',fontWeight:700,color:'#1a3a5c',fontSize:14}} /></div>
            <div style={{fontSize:12,color:'#888',marginTop:16}}>→ <strong style={{fontFamily:'monospace',color:'#1a1a1a'}}>{valores[d.key]||d.default}-{String(inicio[d.key+'_inicio']||1).padStart(3,'0')}</strong></div>
          </div>
        </div>
      ))}
      <SaveRow onSave={guardar} guardando={guardando} guardado={guardado} />
    </div>
  )
}

function PaginaCatalogos() {
  const [sub,setSub]=useState(()=>localStorage.getItem('cfg_cat_sub')||'crm')
  const cambiarSub = (id) => { setSub(id); localStorage.setItem('cfg_cat_sub',id) }
  const subs=[{id:'crm',label:'Catálogo CRM'},{id:'productos',label:'Catálogo Productos'},{id:'activos',label:'Catálogo Activos'}]
  return (
    <div style={{display:'flex',height:'100%'}}>
      <SubNav grupo="Catálogos" subs={subs} activo={sub} onChange={cambiarSub} />
      <div style={{flex:1,padding:'24px 28px',overflowY:'auto',background:'#f4f6f4'}}>
        {sub==='crm'&&<><Catalogo coleccion="catalogo_origenes" titulo="Orígenes de leads" defaults={['WhatsApp','Redes sociales','Referido','Llamada entrante','Web / formulario','Visita en sitio']} /><Catalogo coleccion="catalogo_sectores" titulo="Sectores / industrias" defaults={['Comercial','Industrial','Residencial','Hotelero','Salud','Educación','Gobierno','Tecnología']} /></>}
        {sub==='productos'&&<><Consecutivos /><Catalogo coleccion="catalogo_etiquetas_producto" titulo="Etiquetas de producto" defaults={['Técnico','Cliente final','Proyecto','Mayorista','Interno']} /></>}
        {sub==='activos'&&<><Catalogo coleccion="catalogo_tipos_equipo" titulo="Tipos de equipo AC" defaults={['Mini Split','Cassette','Piso techo','Ventana','Chiller','Fan Coil','VRF','Otro']} /><Catalogo coleccion="catalogo_estados_equipo" titulo="Estados de equipo" defaults={['Operativo','En mantenimiento','Fuera de servicio','En garantía','Por revisar']} /><Catalogo coleccion="catalogo_tipos_servicio" titulo="Tipos de servicio" defaults={['Instalación','Mantenimiento preventivo','Mantenimiento correctivo','Reparación','Diagnóstico','Garantía']} /></>}
      </div>
    </div>
  )
}

// ─── PLANTILLAS ───────────────────────────────────────────────────────────────
const TAB_STYLE = (activo) => ({
  padding:'8px 20px', border:'none',
  borderBottom: activo ? '2px solid var(--eco-primary)' : '2px solid transparent',
  background:'none', cursor:'pointer', fontSize:13,
  fontWeight: activo ? 600 : 400,
  color: activo ? 'var(--eco-primary)' : '#666',
  fontFamily:'inherit', marginBottom:-1
})

function PlantillaCotizacionPreview() {
  const navigate=useNavigate()
  const [tab,setTab]=useState('plantillas')
  const [plantillas,setPlantillas]=useState([])
  const [portadas,setPortadas]=useState([])
  const [predPortada,setPredPortada]=useState(null)
  const [predPlantilla,setPredPlantilla]=useState(null)
  const [terminosCot,setTerminosCot]=useState('')
  const [terminosProy,setTerminosProy]=useState('')
  const [guardandoTerminos,setGuardandoTerminos]=useState(false)
  const [guardadoTerminos,setGuardadoTerminos]=useState(false)
  const [subiendoPortada,setSubiendoPortada]=useState(false)
  const portadaInputRef = useRef(null)
  const [modalNueva,setModalNueva]=useState(false)
  const [nombreNueva,setNombreNueva]=useState('')

  const PLANTILLAS_DEFAULT = [{id:'clasica',nombre:'Clásica'},{id:'moderna',nombre:'Moderna'},{id:'ejecutiva',nombre:'Ejecutiva'}]
  const TABS=[{id:'plantillas',label:'Plantillas'},{id:'portadas',label:'Portadas'},{id:'terminos',label:'Términos'},{id:'observaciones',label:'Observaciones'}]

  useEffect(()=>{ cargarDatos() },[])

  const cargarDatos = async () => {
    const snap = await getDoc(doc(db,'configuracion','plantilla_cotizacion'))
    if(snap.exists()){
      const d=snap.data()
      setPortadas(d.portadas||[]); setPredPortada(d.predeterminada||null); setPredPlantilla(d.plantillaBase||'clasica')
      setTerminosCot(d.terminosCotizacion||d.config?.textoTerminos||''); setTerminosProy(d.terminosProyecto||'')
      const personalizadas = d.plantillasPersonalizadas||[]
      const tieneEco = personalizadas.some(p=>p.id==='eco')
      if(!tieneEco) { setPlantillas([{id:'eco',nombre:'Eco Ingeniería',base:'eco'},...personalizadas]) }
      else { setPlantillas(personalizadas) }
    } else { setPlantillas([{id:'eco',nombre:'Eco Ingeniería',base:'eco'}]) }
  }

  const marcarPredPortada = async id => { setPredPortada(id); await setDoc(doc(db,'configuracion','plantilla_cotizacion'),{predeterminada:id},{merge:true}) }
  const marcarPredPlantilla = async id => { setPredPlantilla(id); await setDoc(doc(db,'configuracion','plantilla_cotizacion'),{plantillaBase:id},{merge:true}) }
  const quitarPortadaPred = async () => { setPredPortada(null); await setDoc(doc(db,'configuracion','plantilla_cotizacion'),{predeterminada:null},{merge:true}) }

  const subirPortada = async e => {
    const file=e.target.files[0]; if(!file) return; setSubiendoPortada(true)
    try { const r=ref(storage,`portadas/cotizacion/portada_${Date.now()}`); await uploadBytes(r,file); const url=await getDownloadURL(r); const id=`portada_${Date.now()}`; const nuevas=[...portadas,{id,url,nombre:file.name.replace(/\.[^.]+$/,'')}]; setPortadas(nuevas); await setDoc(doc(db,'configuracion','plantilla_cotizacion'),{portadas:nuevas},{merge:true}) } catch(e){console.error(e)} finally{setSubiendoPortada(false)}
  }

  const eliminarPortada = async id => { const nuevas=portadas.filter(p=>p.id!==id); setPortadas(nuevas); if(predPortada===id) setPredPortada(null); await setDoc(doc(db,'configuracion','plantilla_cotizacion'),{portadas:nuevas,predeterminada:predPortada===id?null:predPortada},{merge:true}) }
  const guardarTerminos = async () => { setGuardandoTerminos(true); await setDoc(doc(db,'configuracion','plantilla_cotizacion'),{terminosCotizacion:terminosCot,terminosProyecto:terminosProy},{merge:true}); setGuardandoTerminos(false); setGuardadoTerminos(true); setTimeout(()=>setGuardadoTerminos(false),2500) }

  const crearPlantilla=async()=>{ if(!nombreNueva.trim()) return; const nueva={id:`custom_${Date.now()}`,nombre:nombreNueva.trim(),base:'clasica'}; const nuevas=[...plantillas,nueva]; setPlantillas(nuevas); setNombreNueva(''); setModalNueva(false); await setDoc(doc(db,'configuracion','plantilla_cotizacion'),{plantillasPersonalizadas:nuevas},{merge:true}) }
  const duplicarPlantilla=async(p)=>{ let w=[]; try { const s=await getDoc(doc(db,'configuracion','plantilla_cotizacion')); if(s.exists()){const d=s.data();if(p.id.startsWith('custom_')){const o=(d.plantillasPersonalizadas||[]).find(x=>x.id===p.id);w=o?.widgets||[]}else{w=d.plantillasConfig?.[p.id]?.widgets||[]}} } catch(e){} const c={...p,id:`custom_${Date.now()}`,nombre:`${p.nombre} (copia)`,widgets:w}; const n=[...plantillas,c]; setPlantillas(n); await setDoc(doc(db,'configuracion','plantilla_cotizacion'),{plantillasPersonalizadas:n},{merge:true}) }
  const eliminarPlantillaPersonalizada=async(id)=>{ const n=plantillas.filter(p=>p.id!==id); setPlantillas(n); if(predPlantilla===id){setPredPlantilla('clasica');await setDoc(doc(db,'configuracion','plantilla_cotizacion'),{plantillaBase:'clasica'},{merge:true})} await setDoc(doc(db,'configuracion','plantilla_cotizacion'),{plantillasPersonalizadas:n},{merge:true}) }
  const duplicarPredeterminada=async(p)=>{ let w=[]; try { const s=await getDoc(doc(db,'configuracion','plantilla_cotizacion')); if(s.exists()) w=s.data().plantillasConfig?.[p.id]?.widgets||[] } catch(e){} const c={id:`custom_${Date.now()}`,nombre:`${p.nombre} (copia)`,base:p.id,widgets:w}; const n=[...plantillas,c]; setPlantillas(n); await setDoc(doc(db,'configuracion','plantilla_cotizacion'),{plantillasPersonalizadas:n},{merge:true}) }

  return (
    <div>
      {modalNueva&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.35)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={()=>setModalNueva(false)}><div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:10,padding:24,width:380,border:'1px solid #d0d8d0'}}><div style={{fontSize:15,fontWeight:600,marginBottom:16}}>Nueva plantilla</div><input value={nombreNueva} onChange={e=>setNombreNueva(e.target.value)} placeholder="Nombre de la plantilla" onKeyDown={e=>e.key==='Enter'&&crearPlantilla()} style={{width:'100%',border:'1px solid #d0d8d0',borderRadius:7,padding:'8px 10px',fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:16}} autoFocus /><div style={{display:'flex',justifyContent:'flex-end',gap:8}}><button onClick={()=>setModalNueva(false)} style={{padding:'7px 16px',border:'1px solid #d0d8d0',borderRadius:7,cursor:'pointer',background:'#fff',fontSize:12,fontFamily:'inherit'}}>Cancelar</button><button onClick={crearPlantilla} style={{padding:'7px 20px',border:'none',borderRadius:7,cursor:'pointer',background:'var(--eco-primary)',color:'#fff',fontSize:12,fontWeight:500,fontFamily:'inherit'}}>Crear</button></div></div></div>)}
      <div style={{display:'flex',gap:0,borderBottom:'1px solid #e0e8e0',marginBottom:20}}>{TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={TAB_STYLE(tab===t.id)}>{t.label}</button>)}</div>
      {tab==='plantillas'&&(<div><SubTitle>Plantillas predeterminadas</SubTitle><div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:24}}>{PLANTILLAS_DEFAULT.map(p=>(<div key={p.id} style={{background:'#fff',border:'1px solid #e0e8e0',borderRadius:8,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:8,height:8,borderRadius:'50%',background:predPlantilla===p.id?'var(--eco-primary)':'#ddd'}} /><span style={{fontSize:13,fontWeight:500}}>{p.nombre}</span>{predPlantilla===p.id&&<span style={{fontSize:10,padding:'1px 8px',borderRadius:10,background:'var(--eco-primary-light)',color:'var(--eco-primary)',fontWeight:600}}>Predeterminada</span>}</div><div style={{display:'flex',gap:8}}><button onClick={()=>marcarPredPlantilla(p.id)} style={{fontSize:11,padding:'4px 12px',border:'1px solid #d0d8d0',borderRadius:6,cursor:'pointer',background:predPlantilla===p.id?'var(--eco-primary)':'#fff',color:predPlantilla===p.id?'#fff':'#555',fontFamily:'inherit'}}>{predPlantilla===p.id?'✓ Predeterminada':'Usar como predeterminada'}</button><button onClick={()=>duplicarPredeterminada(p)} style={{fontSize:11,padding:'4px 12px',border:'1px solid #d0d8d0',borderRadius:6,cursor:'pointer',background:'#fff',color:'#555',fontFamily:'inherit'}}>Duplicar</button><button onClick={()=>navigate(`/configuracion/plantilla-cotizacion?id=${p.id}`)} style={{fontSize:11,padding:'4px 12px',border:'1px solid #d0d8d0',borderRadius:6,cursor:'pointer',background:'#fff',color:'#555',fontFamily:'inherit'}}>Editar →</button></div></div>))}</div><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><SubTitle>Plantillas personalizadas</SubTitle><button onClick={()=>setModalNueva(true)} style={{fontSize:12,padding:'6px 16px',border:'none',borderRadius:7,cursor:'pointer',background:'var(--eco-primary)',color:'#fff',fontFamily:'inherit',fontWeight:500}}>+ Nueva plantilla</button></div>{plantillas.length===0?<div style={{background:'#f9fbf9',border:'1px dashed #d0d8d0',borderRadius:8,padding:'24px',textAlign:'center',color:'#aaa',fontSize:13}}>No hay plantillas personalizadas.</div>:<div style={{display:'flex',flexDirection:'column',gap:8}}>{plantillas.map(p=>(<div key={p.id} style={{background:'#fff',border:'1px solid #e0e8e0',borderRadius:8,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:8,height:8,borderRadius:'50%',background:predPlantilla===p.id?'var(--eco-primary)':'#ddd'}} /><span style={{fontSize:13,fontWeight:500}}>{p.nombre}</span>{predPlantilla===p.id&&<span style={{fontSize:10,padding:'1px 8px',borderRadius:10,background:'var(--eco-primary-light)',color:'var(--eco-primary)',fontWeight:600}}>Predeterminada</span>}</div><div style={{display:'flex',gap:8}}><button onClick={()=>marcarPredPlantilla(p.id)} style={{fontSize:11,padding:'4px 12px',border:'1px solid #d0d8d0',borderRadius:6,cursor:'pointer',background:predPlantilla===p.id?'var(--eco-primary)':'#fff',color:predPlantilla===p.id?'#fff':'#555',fontFamily:'inherit'}}>{predPlantilla===p.id?'✓ Predeterminada':'Usar como predeterminada'}</button><button onClick={()=>duplicarPlantilla(p)} style={{fontSize:11,padding:'4px 12px',border:'1px solid #d0d8d0',borderRadius:6,cursor:'pointer',background:'#fff',color:'#555',fontFamily:'inherit'}}>Duplicar</button><button onClick={()=>navigate(`/configuracion/plantilla-cotizacion?id=${p.id}`)} style={{fontSize:11,padding:'4px 12px',border:'1px solid #d0d8d0',borderRadius:6,cursor:'pointer',background:'#fff',color:'#555',fontFamily:'inherit'}}>Editar →</button><button onClick={()=>eliminarPlantillaPersonalizada(p.id)} style={{fontSize:11,padding:'4px 12px',border:'1px solid #fca5a5',borderRadius:6,cursor:'pointer',background:'#fff',color:'#A32D2D',fontFamily:'inherit'}}>Eliminar</button></div></div>))}</div>}</div>)}
      {tab==='portadas'&&(<div><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><div><SubTitle>Portadas</SubTitle><p style={{fontSize:12,color:'#888',marginTop:-10}}>Formato carta (1275×1650px) · PNG o JPG</p></div><div style={{display:'flex',gap:8}}>{predPortada&&<button onClick={quitarPortadaPred} style={{fontSize:12,padding:'6px 14px',border:'1px solid #d0d8d0',borderRadius:7,cursor:'pointer',background:'#fff',color:'#888',fontFamily:'inherit'}}>Sin portada predeterminada</button>}<input ref={portadaInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={subirPortada} /><button onClick={()=>portadaInputRef.current?.click()} disabled={subiendoPortada} style={{fontSize:12,padding:'6px 16px',border:'none',borderRadius:7,cursor:'pointer',background:'var(--eco-primary)',color:'#fff',fontFamily:'inherit',fontWeight:500}}>{subiendoPortada?'Subiendo...':'+ Subir portada'}</button></div></div>{portadas.length===0?<div onClick={()=>portadaInputRef.current?.click()} style={{border:'2px dashed #d0d8d0',borderRadius:10,padding:40,textAlign:'center',cursor:'pointer',color:'#aaa'}}><div style={{fontSize:32,marginBottom:8}}>🖼</div><div style={{fontSize:13}}>No hay portadas</div></div>:<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:12}}>{portadas.map(p=>(<div key={p.id} style={{border:`2px solid ${predPortada===p.id?'var(--eco-primary)':'#e0e0e0'}`,borderRadius:8,overflow:'hidden',background:'#fff',position:'relative'}}>{predPortada===p.id&&<div style={{position:'absolute',top:6,left:6,background:'var(--eco-primary)',color:'#fff',fontSize:9,fontWeight:600,padding:'2px 8px',borderRadius:10,zIndex:2}}>Predeterminada</div>}<button onClick={()=>eliminarPortada(p.id)} style={{position:'absolute',top:6,right:6,width:22,height:22,borderRadius:4,border:'none',background:'#A32D2D',color:'#fff',cursor:'pointer',fontSize:12,zIndex:2}}>×</button><img src={p.url} alt={p.nombre} style={{width:'100%',aspectRatio:'3/4',objectFit:'cover',display:'block'}} /><div style={{padding:'8px 10px',borderTop:'0.5px solid #eee'}}><div style={{fontSize:11,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:4}}>{p.nombre}</div>{predPortada!==p.id&&<button onClick={()=>marcarPredPortada(p.id)} style={{width:'100%',padding:'4px',border:'0.5px solid #d0d8d0',borderRadius:5,background:'transparent',cursor:'pointer',fontSize:10,color:'#666',fontFamily:'inherit'}}>Marcar predeterminada</button>}</div></div>))}</div>}</div>)}
      {tab==='terminos'&&(<div><div style={{display:'flex',flexDirection:'column',gap:20}}><div><SubTitle>Términos — Cotización</SubTitle><textarea value={terminosCot} onChange={e=>setTerminosCot(e.target.value)} rows={8} style={{width:'100%',border:'1px solid #d0d8d0',borderRadius:8,padding:'10px 12px',fontSize:12,fontFamily:'inherit',outline:'none',resize:'vertical',lineHeight:1.8,boxSizing:'border-box'}} /></div><div><SubTitle>Términos — Proyecto</SubTitle><textarea value={terminosProy} onChange={e=>setTerminosProy(e.target.value)} rows={8} style={{width:'100%',border:'1px solid #d0d8d0',borderRadius:8,padding:'10px 12px',fontSize:12,fontFamily:'inherit',outline:'none',resize:'vertical',lineHeight:1.8,boxSizing:'border-box'}} /></div><div style={{display:'flex',alignItems:'center',gap:12}}><button onClick={guardarTerminos} disabled={guardandoTerminos} style={{background:'var(--eco-primary)',color:'#fff',border:'none',borderRadius:8,padding:'8px 24px',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>{guardandoTerminos?'Guardando...':'Guardar términos'}</button>{guardadoTerminos&&<span style={{fontSize:12,color:'#1a6e3c'}}>✓ Guardado</span>}</div></div></div>)}
      {tab==='observaciones'&&(<div><p style={{fontSize:12,color:'#888',marginBottom:20}}>Textos predefinidos para el campo Observaciones de cotizaciones.</p><TabObservaciones docFirestore="plantilla_cotizacion" /></div>)}
    </div>
  )
}

function PlantillaProyectoPreview() {
  const navigate=useNavigate()
  const [tab,setTab]=useState('plantillas')
  const [portadas,setPortadas]=useState([]); const [predPortada,setPredPortada]=useState(null); const [predPlantilla,setPredPlantilla]=useState('clasica')
  const [terminosProy,setTerminosProy]=useState(''); const [guardandoTerminos,setGuardandoTerminos]=useState(false); const [guardadoTerminos,setGuardadoTerminos]=useState(false)
  const [subiendoPortada,setSubiendoPortada]=useState(false); const [plantillas,setPlantillas]=useState([]); const [modalNueva,setModalNueva]=useState(false); const [nombreNueva,setNombreNueva]=useState('')
  const portadaInputRef=useRef(null)
  const PLANTILLAS_DEFAULT=[{id:'clasica',nombre:'Clásica'},{id:'moderna',nombre:'Moderna'},{id:'ejecutiva',nombre:'Ejecutiva'},{id:'eco',nombre:'Eco Ingeniería'}]
  const TABS=[{id:'plantillas',label:'Plantillas'},{id:'portadas',label:'Portadas'},{id:'terminos',label:'Términos'},{id:'observaciones',label:'Observaciones'}]
  useEffect(()=>{ cargarDatos() },[])
  const cargarDatos=async()=>{ const snap=await getDoc(doc(db,'configuracion','plantilla_proyecto')); if(snap.exists()){const d=snap.data();setPortadas(d.portadas||[]);setPredPortada(d.predeterminada||null);setPredPlantilla(d.plantillaBase||'clasica');setTerminosProy(d.terminosProyecto||'');setPlantillas(d.plantillasPersonalizadas||[])} }
  const crearPlantillaProy=async()=>{ if(!nombreNueva.trim()) return; const n={id:`custom_${Date.now()}`,nombre:nombreNueva.trim(),base:'clasica'}; const ns=[...plantillas,n]; setPlantillas(ns); setNombreNueva(''); setModalNueva(false); await setDoc(doc(db,'configuracion','plantilla_proyecto'),{plantillasPersonalizadas:ns},{merge:true}) }
  const duplicarPlantillaProy=async(p)=>{ let w=[]; try{const s=await getDoc(doc(db,'configuracion','plantilla_proyecto'));if(s.exists()){const d=s.data();if(p.id.startsWith('custom_')){const o=(d.plantillasPersonalizadas||[]).find(x=>x.id===p.id);w=o?.widgets||[]}else{w=d.plantillasConfig?.[p.id]?.widgets||[]}}}catch(e){}; const c={...p,id:`custom_${Date.now()}`,nombre:`${p.nombre} (copia)`,widgets:w}; const ns=[...plantillas,c]; setPlantillas(ns); await setDoc(doc(db,'configuracion','plantilla_proyecto'),{plantillasPersonalizadas:ns},{merge:true}) }
  const eliminarPlantillaProy=async(id)=>{ const ns=plantillas.filter(p=>p.id!==id); setPlantillas(ns); if(predPlantilla===id){setPredPlantilla('clasica');await setDoc(doc(db,'configuracion','plantilla_proyecto'),{plantillaBase:'clasica'},{merge:true})} await setDoc(doc(db,'configuracion','plantilla_proyecto'),{plantillasPersonalizadas:ns},{merge:true}) }
  const duplicarPredProy=async(p)=>{ let w=[]; try{const s=await getDoc(doc(db,'configuracion','plantilla_proyecto'));if(s.exists()) w=s.data().plantillasConfig?.[p.id]?.widgets||[]}catch(e){}; const c={id:`custom_${Date.now()}`,nombre:`${p.nombre} (copia)`,base:p.id,widgets:w}; const ns=[...plantillas,c]; setPlantillas(ns); await setDoc(doc(db,'configuracion','plantilla_proyecto'),{plantillasPersonalizadas:ns},{merge:true}) }
  const marcarPredPortada=async id=>{ setPredPortada(id); await setDoc(doc(db,'configuracion','plantilla_proyecto'),{predeterminada:id},{merge:true}) }
  const quitarPortadaPred=async()=>{ setPredPortada(null); await setDoc(doc(db,'configuracion','plantilla_proyecto'),{predeterminada:null},{merge:true}) }
  const marcarPredPlantilla=async id=>{ setPredPlantilla(id); await setDoc(doc(db,'configuracion','plantilla_proyecto'),{plantillaBase:id},{merge:true}) }
  const subirPortada=async e=>{ const file=e.target.files[0]; if(!file) return; setSubiendoPortada(true); try{const r=ref(storage,`portadas/proyecto/portada_${Date.now()}`);await uploadBytes(r,file);const url=await getDownloadURL(r);const id=`portada_${Date.now()}`;const ns=[...portadas,{id,url,nombre:file.name.replace(/\.[^.]+$/,'')}];setPortadas(ns);await setDoc(doc(db,'configuracion','plantilla_proyecto'),{portadas:ns},{merge:true})}catch(e){console.error(e)}finally{setSubiendoPortada(false)} }
  const eliminarPortada=async id=>{ const ns=portadas.filter(p=>p.id!==id); setPortadas(ns); if(predPortada===id) setPredPortada(null); await setDoc(doc(db,'configuracion','plantilla_proyecto'),{portadas:ns,predeterminada:predPortada===id?null:predPortada},{merge:true}) }
  const guardarTerminos=async()=>{ setGuardandoTerminos(true); await setDoc(doc(db,'configuracion','plantilla_proyecto'),{terminosProyecto:terminosProy},{merge:true}); setGuardandoTerminos(false); setGuardadoTerminos(true); setTimeout(()=>setGuardadoTerminos(false),2500) }
  return (
    <div>
      {modalNueva&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.35)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={()=>setModalNueva(false)}><div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:10,padding:24,width:380,border:'1px solid #d0d8d0'}}><div style={{fontSize:15,fontWeight:600,marginBottom:16}}>Nueva plantilla de proyecto</div><input value={nombreNueva} onChange={e=>setNombreNueva(e.target.value)} placeholder="Nombre" onKeyDown={e=>e.key==='Enter'&&crearPlantillaProy()} style={{width:'100%',border:'1px solid #d0d8d0',borderRadius:7,padding:'8px 10px',fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:16}} autoFocus /><div style={{display:'flex',justifyContent:'flex-end',gap:8}}><button onClick={()=>setModalNueva(false)} style={{padding:'7px 16px',border:'1px solid #d0d8d0',borderRadius:7,cursor:'pointer',background:'#fff',fontSize:12,fontFamily:'inherit'}}>Cancelar</button><button onClick={crearPlantillaProy} style={{padding:'7px 20px',border:'none',borderRadius:7,cursor:'pointer',background:'var(--eco-primary)',color:'#fff',fontSize:12,fontWeight:500,fontFamily:'inherit'}}>Crear</button></div></div></div>)}
      <div style={{display:'flex',gap:0,borderBottom:'1px solid #e0e8e0',marginBottom:20}}>{TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={TAB_STYLE(tab===t.id)}>{t.label}</button>)}</div>
      {tab==='plantillas'&&(<div><SubTitle>Plantillas predeterminadas</SubTitle><div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:24}}>{PLANTILLAS_DEFAULT.map(p=>(<div key={p.id} style={{background:'#fff',border:'1px solid #e0e8e0',borderRadius:8,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:8,height:8,borderRadius:'50%',background:predPlantilla===p.id?'var(--eco-primary)':'#ddd'}} /><span style={{fontSize:13,fontWeight:500}}>{p.nombre}</span>{predPlantilla===p.id&&<span style={{fontSize:10,padding:'1px 8px',borderRadius:10,background:'var(--eco-primary-light)',color:'var(--eco-primary)',fontWeight:600}}>Predeterminada</span>}</div><div style={{display:'flex',gap:8}}><button onClick={()=>marcarPredPlantilla(p.id)} style={{fontSize:11,padding:'4px 12px',border:'1px solid #d0d8d0',borderRadius:6,cursor:'pointer',background:predPlantilla===p.id?'var(--eco-primary)':'#fff',color:predPlantilla===p.id?'#fff':'#555',fontFamily:'inherit'}}>{predPlantilla===p.id?'✓ Predeterminada':'Usar como predeterminada'}</button><button onClick={()=>duplicarPredProy(p)} style={{fontSize:11,padding:'4px 12px',border:'1px solid #d0d8d0',borderRadius:6,cursor:'pointer',background:'#fff',color:'#555',fontFamily:'inherit'}}>Duplicar</button><button onClick={()=>navigate(`/configuracion/plantilla-proyecto?id=${p.id}`)} style={{fontSize:11,padding:'4px 12px',border:'1px solid #d0d8d0',borderRadius:6,cursor:'pointer',background:'#fff',color:'#555',fontFamily:'inherit'}}>Editar →</button></div></div>))}</div><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><SubTitle>Plantillas personalizadas</SubTitle><button onClick={()=>setModalNueva(true)} style={{fontSize:12,padding:'6px 16px',border:'none',borderRadius:7,cursor:'pointer',background:'var(--eco-primary)',color:'#fff',fontFamily:'inherit',fontWeight:500}}>+ Nueva plantilla</button></div>{plantillas.length===0?<div style={{background:'#f9fbf9',border:'1px dashed #d0d8d0',borderRadius:8,padding:'24px',textAlign:'center',color:'#aaa',fontSize:13}}>No hay plantillas personalizadas.</div>:<div style={{display:'flex',flexDirection:'column',gap:8}}>{plantillas.map(p=>(<div key={p.id} style={{background:'#fff',border:'1px solid #e0e8e0',borderRadius:8,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:8,height:8,borderRadius:'50%',background:predPlantilla===p.id?'var(--eco-primary)':'#ddd'}} /><span style={{fontSize:13,fontWeight:500}}>{p.nombre}</span>{predPlantilla===p.id&&<span style={{fontSize:10,padding:'1px 8px',borderRadius:10,background:'var(--eco-primary-light)',color:'var(--eco-primary)',fontWeight:600}}>Predeterminada</span>}</div><div style={{display:'flex',gap:8}}><button onClick={()=>marcarPredPlantilla(p.id)} style={{fontSize:11,padding:'4px 12px',border:'1px solid #d0d8d0',borderRadius:6,cursor:'pointer',background:predPlantilla===p.id?'var(--eco-primary)':'#fff',color:predPlantilla===p.id?'#fff':'#555',fontFamily:'inherit'}}>{predPlantilla===p.id?'✓ Predeterminada':'Usar como predeterminada'}</button><button onClick={()=>duplicarPlantillaProy(p)} style={{fontSize:11,padding:'4px 12px',border:'1px solid #d0d8d0',borderRadius:6,cursor:'pointer',background:'#fff',color:'#555',fontFamily:'inherit'}}>Duplicar</button><button onClick={()=>navigate(`/configuracion/plantilla-proyecto?id=${p.id}`)} style={{fontSize:11,padding:'4px 12px',border:'1px solid #d0d8d0',borderRadius:6,cursor:'pointer',background:'#fff',color:'#555',fontFamily:'inherit'}}>Editar →</button><button onClick={()=>eliminarPlantillaProy(p.id)} style={{fontSize:11,padding:'4px 12px',border:'1px solid #fca5a5',borderRadius:6,cursor:'pointer',background:'#fff',color:'#A32D2D',fontFamily:'inherit'}}>Eliminar</button></div></div>))}</div>}</div>)}
      {tab==='portadas'&&(<div><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><div><SubTitle>Portadas</SubTitle><p style={{fontSize:12,color:'#888',marginTop:-10}}>1275×1650px · PNG o JPG</p></div><div style={{display:'flex',gap:8}}>{predPortada&&<button onClick={quitarPortadaPred} style={{fontSize:12,padding:'6px 14px',border:'1px solid #d0d8d0',borderRadius:7,cursor:'pointer',background:'#fff',color:'#888',fontFamily:'inherit'}}>Sin portada predeterminada</button>}<input ref={portadaInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={subirPortada} /><button onClick={()=>portadaInputRef.current?.click()} disabled={subiendoPortada} style={{fontSize:12,padding:'6px 16px',border:'none',borderRadius:7,cursor:'pointer',background:'var(--eco-primary)',color:'#fff',fontFamily:'inherit',fontWeight:500}}>{subiendoPortada?'Subiendo...':'+ Subir portada'}</button></div></div>{portadas.length===0?<div onClick={()=>portadaInputRef.current?.click()} style={{border:'2px dashed #d0d8d0',borderRadius:10,padding:40,textAlign:'center',cursor:'pointer',color:'#aaa'}}><div style={{fontSize:32,marginBottom:8}}>🖼</div>No hay portadas</div>:<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:12}}>{portadas.map(p=>(<div key={p.id} style={{border:`2px solid ${predPortada===p.id?'var(--eco-primary)':'#e0e0e0'}`,borderRadius:8,overflow:'hidden',background:'#fff',position:'relative'}}>{predPortada===p.id&&<div style={{position:'absolute',top:6,left:6,background:'var(--eco-primary)',color:'#fff',fontSize:9,fontWeight:600,padding:'2px 8px',borderRadius:10,zIndex:2}}>Predeterminada</div>}<button onClick={()=>eliminarPortada(p.id)} style={{position:'absolute',top:6,right:6,width:22,height:22,borderRadius:4,border:'none',background:'#A32D2D',color:'#fff',cursor:'pointer',fontSize:12,zIndex:2}}>×</button><img src={p.url} alt={p.nombre} style={{width:'100%',aspectRatio:'3/4',objectFit:'cover',display:'block'}} /><div style={{padding:'8px 10px',borderTop:'0.5px solid #eee'}}><div style={{fontSize:11,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:4}}>{p.nombre}</div>{predPortada!==p.id&&<button onClick={()=>marcarPredPortada(p.id)} style={{width:'100%',padding:'4px',border:'0.5px solid #d0d8d0',borderRadius:5,background:'transparent',cursor:'pointer',fontSize:10,color:'#666',fontFamily:'inherit'}}>Marcar predeterminada</button>}</div></div>))}</div>}</div>)}
      {tab==='terminos'&&(<div><SubTitle>Términos — Proyecto</SubTitle><textarea value={terminosProy} onChange={e=>setTerminosProy(e.target.value)} rows={10} style={{width:'100%',border:'1px solid #d0d8d0',borderRadius:8,padding:'10px 12px',fontSize:12,fontFamily:'inherit',outline:'none',resize:'vertical',lineHeight:1.8,boxSizing:'border-box'}} /><div style={{display:'flex',alignItems:'center',gap:12,marginTop:12}}><button onClick={guardarTerminos} disabled={guardandoTerminos} style={{background:'var(--eco-primary)',color:'#fff',border:'none',borderRadius:8,padding:'8px 24px',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>{guardandoTerminos?'Guardando...':'Guardar términos'}</button>{guardadoTerminos&&<span style={{fontSize:12,color:'#1a6e3c'}}>✓ Guardado</span>}</div></div>)}
      {tab==='observaciones'&&(<div><p style={{fontSize:12,color:'#888',marginBottom:20}}>Textos predefinidos para el campo Observaciones de proyectos.</p><TabObservaciones docFirestore="plantilla_proyecto" /></div>)}
    </div>
  )
}

// ─── PLANTILLAS WHATSAPP ──────────────────────────────────────────────────────
function PlantillasWhatsApp() {
  const authCtx = useAuth()
  const yo = authCtx.usuario || authCtx.currentUser || null
  const miRol = yo?.rol || ''
  const esAdmin = miRol === 'Super Administrador' || miRol === 'Administrador'
  const [plantillas,setPlantillas]=useState([]); const [cargando,setCargando]=useState(true); const [modalEditar,setModalEditar]=useState(null); const [modalElim,setModalElim]=useState(null); const [modalAprobElim,setModalAprobElim]=useState(null); const [notifsPend,setNotifsPend]=useState([])
  const [formNombre,setFormNombre]=useState(''); const [formTexto,setFormTexto]=useState(''); const [formCategoria,setFormCategoria]=useState('general'); const [formObs,setFormObs]=useState(''); const [guardando,setGuardando]=useState(false); const [msg,setMsg]=useState('')
  const CATEGORIAS=['general','bienvenida','seguimiento','cotización','soporte','cierre']
  const CAT_COLOR={general:'#5F5E5A',bienvenida:'#0F6E56',seguimiento:'#185FA5',cotización:'#854F0B',soporte:'#A32D2D',cierre:'#534AB7'}
  useEffect(()=>{ cargar() },[])
  useEffect(()=>{ if(!esAdmin||!yo?.uid) return; const q=query(collection(db,'notificaciones'),where('tipo','==','eliminacion_plantilla_wa'),where('procesada','==',false)); return onSnapshot(q,snap=>{setNotifsPend(snap.docs.map(d=>({id:d.id,...d.data()})))}) },[esAdmin,yo?.uid])
  const cargar=async()=>{ setCargando(true); try{const snap=await getDoc(doc(db,'configuracion','plantillas_wa')); if(snap.exists()) setPlantillas(snap.data().plantillas||[])}catch(e){console.error(e)}finally{setCargando(false)} }
  const guardarFirestore=async(nuevas)=>{ await setDoc(doc(db,'configuracion','plantillas_wa'),{plantillas:nuevas},{merge:true}); setPlantillas(nuevas) }
  const abrirNueva=()=>{ setFormNombre('');setFormTexto('');setFormCategoria('general');setModalEditar('nueva') }
  const abrirEditar=(p)=>{ setFormNombre(p.nombre);setFormTexto(p.texto);setFormCategoria(p.categoria||'general');setModalEditar(p) }
  const guardarPlantilla=async()=>{ if(!formNombre.trim()||!formTexto.trim()) return; setGuardando(true); let nuevas; if(modalEditar==='nueva'){nuevas=[...plantillas,{id:`wa_${Date.now()}`,nombre:formNombre.trim(),texto:formTexto.trim(),categoria:formCategoria,creadoEn:new Date().toISOString()}]}else{nuevas=plantillas.map(p=>p.id===modalEditar.id?{...p,nombre:formNombre.trim(),texto:formTexto.trim(),categoria:formCategoria}:p)}; await guardarFirestore(nuevas); setModalEditar(null); setMsg('✓ Guardado'); setTimeout(()=>setMsg(''),2000); setGuardando(false) }
  const duplicar=async(p)=>{ const copia={...p,id:`wa_${Date.now()}`,nombre:`${p.nombre} (copia)`}; await guardarFirestore([...plantillas,copia]) }
  const solicitarEliminar=(p)=>{ if(esAdmin){if(window.confirm(`¿Eliminar la plantilla "${p.nombre}"?`)){const nuevas=plantillas.filter(x=>x.id!==p.id);guardarFirestore(nuevas)}}else{setFormObs('');setModalElim(p)} }
  const enviarSolicitudEliminar=async()=>{ if(!formObs.trim()||!modalElim) return; setGuardando(true); try{const snapUsuarios=await getDocs(collection(db,'usuarios')); const admins=snapUsuarios.docs.map(d=>({uid:d.id,...d.data()})).filter(u=>u.rol==='Super Administrador'||u.rol==='Administrador'); for(const admin of admins){await addDoc(collection(db,'notificaciones'),{destinatarioId:admin.uid,tipo:'eliminacion_plantilla_wa',titulo:`Solicitud de eliminación — ${modalElim.nombre}`,cuerpo:`${yo?.nombre||'Un usuario'} solicita eliminar la plantilla WA "${modalElim.nombre}"`,meta:{plantillaId:modalElim.id,plantillaNombre:modalElim.nombre,solicitante:yo?.nombre||yo?.email,observacion:formObs.trim()},procesada:false,leida:false,vendedorId:yo?.uid,creadoEn:serverTimestamp()})}; setModalElim(null); setMsg('✓ Solicitud enviada al administrador'); setTimeout(()=>setMsg(''),3000)}catch(e){console.error(e)}finally{setGuardando(false)} }
  const aprobarEliminar=async(notif)=>{ const nuevas=plantillas.filter(p=>p.id!==notif.meta?.plantillaId); await guardarFirestore(nuevas); await updateDoc(doc(db,'notificaciones',notif.id),{procesada:true,leida:true,resultado:'aprobado'}); if(notif.vendedorId){await addDoc(collection(db,'notificaciones'),{destinatarioId:notif.vendedorId,tipo:'general',titulo:`Plantilla eliminada — ${notif.meta?.plantillaNombre}`,cuerpo:'Tu solicitud fue aprobada. La plantilla fue eliminada.',leida:false,creadoEn:serverTimestamp()})}; setModalAprobElim(null); setMsg('✓ Plantilla eliminada'); setTimeout(()=>setMsg(''),2000) }
  const rechazarEliminar=async(notif,motivo)=>{ await updateDoc(doc(db,'notificaciones',notif.id),{procesada:true,leida:true,resultado:'rechazado',motivoRechazo:motivo}); if(notif.vendedorId){await addDoc(collection(db,'notificaciones'),{destinatarioId:notif.vendedorId,tipo:'general',titulo:`Solicitud rechazada — ${notif.meta?.plantillaNombre}`,cuerpo:`Tu solicitud fue rechazada. Motivo: ${motivo}`,leida:false,creadoEn:serverTimestamp()})}; setModalAprobElim(null) }
  const inp2={width:'100%',padding:'8px 10px',border:'1px solid #d0d8d0',borderRadius:6,fontSize:13,background:'#fff',color:'#1a1a1a',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}
  return (
    <div>
      {modalEditar&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={e=>e.target===e.currentTarget&&setModalEditar(null)}><div style={{background:'#fff',borderRadius:12,width:'90%',maxWidth:500,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}><div style={{padding:'16px 20px',borderBottom:'1px solid #eee',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontWeight:700,fontSize:15}}>{modalEditar==='nueva'?'+ Nueva plantilla WA':'Editar plantilla'}</span><button onClick={()=>setModalEditar(null)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#aaa'}}>×</button></div><div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}><div><label style={{fontSize:10,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.5px',display:'block',marginBottom:4}}>Nombre</label><input value={formNombre} onChange={e=>setFormNombre(e.target.value)} style={inp2} placeholder="Ej: Bienvenida inicial..." autoFocus /></div><div><label style={{fontSize:10,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.5px',display:'block',marginBottom:4}}>Categoría</label><select value={formCategoria} onChange={e=>setFormCategoria(e.target.value)} style={{...inp2,fontSize:12}}>{CATEGORIAS.map(cat=><option key={cat} value={cat}>{cat.charAt(0).toUpperCase()+cat.slice(1)}</option>)}</select></div><div><label style={{fontSize:10,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.5px',display:'block',marginBottom:4}}>Texto del mensaje</label><textarea value={formTexto} onChange={e=>setFormTexto(e.target.value)} rows={6} style={{...inp2,resize:'vertical',lineHeight:1.7}} /><div style={{fontSize:10,color:'#aaa',marginTop:4}}>Variables: <code style={{background:'#f0f4f8',padding:'1px 5px',borderRadius:3}}>{'{{nombre}}'}</code> · <code style={{background:'#f0f4f8',padding:'1px 5px',borderRadius:3}}>{'{{empresa}}'}</code> · <code style={{background:'#f0f4f8',padding:'1px 5px',borderRadius:3}}>{'{{vendedor}}'}</code></div></div>{formTexto&&(<div style={{background:'#f0f4f8',borderRadius:8,padding:'10px 14px'}}><div style={{fontSize:10,fontWeight:600,color:'#888',marginBottom:6,textTransform:'uppercase',letterSpacing:'.5px'}}>Preview</div><div style={{fontSize:13,color:'#1a1a1a',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{formTexto.replace(/\{\{nombre\}\}/g,'Juan Pérez').replace(/\{\{empresa\}\}/g,'Eco Ingeniería CR').replace(/\{\{vendedor\}\}/g,yo?.nombre||'Vendedor')}</div></div>)}</div><div style={{padding:'14px 20px',borderTop:'1px solid #eee',display:'flex',justifyContent:'flex-end',gap:8}}><Btn onClick={()=>setModalEditar(null)} outline>Cancelar</Btn><Btn onClick={guardarPlantilla} disabled={guardando||!formNombre.trim()||!formTexto.trim()}>{guardando?'Guardando...':modalEditar==='nueva'?'Crear plantilla':'Guardar cambios'}</Btn></div></div></div>)}
      {modalElim&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={e=>e.target===e.currentTarget&&setModalElim(null)}><div style={{background:'#fff',borderRadius:12,width:'90%',maxWidth:440,boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}><div style={{padding:'16px 20px',borderBottom:'1px solid #eee',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontWeight:700,fontSize:15,color:'#A32D2D'}}>🗑 Solicitar eliminación</span><button onClick={()=>setModalElim(null)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#aaa'}}>×</button></div><div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}><div style={{background:'#f8f9fb',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#555'}}><strong>{modalElim.nombre}</strong><br/><span style={{fontSize:11,color:'#888'}}>{modalElim.texto?.slice(0,80)}...</span></div><div><label style={{fontSize:10,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.5px',display:'block',marginBottom:4}}>Motivo *</label><textarea value={formObs} onChange={e=>setFormObs(e.target.value)} rows={3} style={{...inp2,resize:'vertical'}} placeholder="Explicá por qué querés eliminar..." /></div><div style={{fontSize:11,color:'#888',background:'#FFF8E1',padding:'8px 12px',borderRadius:6,border:'1px solid #FFE082'}}>⚠️ Requiere aprobación del Administrador.</div></div><div style={{padding:'14px 20px',borderTop:'1px solid #eee',display:'flex',justifyContent:'flex-end',gap:8}}><Btn onClick={()=>setModalElim(null)} outline>Cancelar</Btn><Btn onClick={enviarSolicitudEliminar} disabled={guardando||!formObs.trim()} color="#A32D2D">{guardando?'Enviando...':'Enviar solicitud'}</Btn></div></div></div>)}
      {modalAprobElim&&<ModalAprobacionEliminacionWA notif={modalAprobElim} onAprobar={()=>aprobarEliminar(modalAprobElim)} onRechazar={(motivo)=>rechazarEliminar(modalAprobElim,motivo)} onCerrar={()=>setModalAprobElim(null)} />}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><div><SubTitle>Plantillas de WhatsApp</SubTitle>{msg&&<span style={{fontSize:12,color:msg.startsWith('✓')?'#1a6e3c':'#A32D2D'}}>{msg}</span>}</div><Btn onClick={abrirNueva}>+ Nueva plantilla</Btn></div>
      {esAdmin&&notifsPend.length>0&&(<div style={{background:'#FAEEDA',border:'1px solid #FAC775',borderRadius:8,padding:'12px 16px',marginBottom:16}}><div style={{fontSize:12,fontWeight:600,color:'#854F0B',marginBottom:8}}>⏳ Solicitudes pendientes ({notifsPend.length})</div>{notifsPend.map(n=>(<div key={n.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:'0.5px solid #FAC775'}}><div><span style={{fontSize:13,fontWeight:500}}>{n.meta?.plantillaNombre}</span><span style={{fontSize:11,color:'#888',marginLeft:8}}>por {n.meta?.solicitante}</span></div><Btn onClick={()=>setModalAprobElim(n)} color="#854F0B">Revisar</Btn></div>))}</div>)}
      {cargando?<div style={{color:'#aaa',fontSize:13,textAlign:'center',padding:40}}>Cargando...</div>:plantillas.length===0?(<div style={{background:'#f9fbf9',border:'1px dashed #d0d8d0',borderRadius:10,padding:'40px 20px',textAlign:'center',color:'#aaa'}}><div style={{fontSize:36,marginBottom:8}}>💬</div><div style={{fontSize:13}}>No hay plantillas aún</div></div>):(<div style={{display:'flex',flexDirection:'column',gap:10}}>{plantillas.map(p=>(<div key={p.id} style={{background:'#fff',border:'1px solid #e0e8e0',borderRadius:10,padding:'14px 16px'}}><div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}><div style={{flex:1,minWidth:0}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}><span style={{fontWeight:600,fontSize:14,color:'#1a1a1a'}}>{p.nombre}</span><span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:10,background:(CAT_COLOR[p.categoria]||'#888')+'18',color:CAT_COLOR[p.categoria]||'#888',border:`1px solid ${(CAT_COLOR[p.categoria]||'#888')}40`}}>{p.categoria||'general'}</span></div><div style={{fontSize:12,color:'#555',lineHeight:1.7,whiteSpace:'pre-wrap',maxHeight:80,overflow:'hidden'}}>{p.texto}</div><div style={{fontSize:10,color:'#bbb',marginTop:4}}>{p.texto.length} caracteres</div></div><div style={{display:'flex',gap:6,flexShrink:0}}><button onClick={()=>abrirEditar(p)} style={{fontSize:11,padding:'4px 10px',border:'1px solid #d0d8d0',borderRadius:6,cursor:'pointer',background:'#fff',color:'#555',fontFamily:'inherit'}}>✎ Editar</button><button onClick={()=>duplicar(p)} style={{fontSize:11,padding:'4px 10px',border:'1px solid #d0d8d0',borderRadius:6,cursor:'pointer',background:'#fff',color:'#555',fontFamily:'inherit'}}>⎘ Duplicar</button><button onClick={()=>solicitarEliminar(p)} style={{fontSize:11,padding:'4px 10px',border:'1px solid #fca5a5',borderRadius:6,cursor:'pointer',background:'#fff',color:'#A32D2D',fontFamily:'inherit'}}>{esAdmin?'🗑 Eliminar':'🗑 Solicitar eliminación'}</button></div></div></div>))}</div>)}
    </div>
  )
}

function ModalAprobacionEliminacionWA({ notif, onAprobar, onRechazar, onCerrar }) {
  const [motivo,setMotivo]=useState(''); const [procesando,setProcesando]=useState(false); const meta=notif.meta||{}
  const handleAprobar=async()=>{ setProcesando(true); await onAprobar(); setProcesando(false) }
  const handleRechazar=async()=>{ if(!motivo.trim()) return; setProcesando(true); await onRechazar(motivo); setProcesando(false) }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',backdropFilter:'blur(4px)',zIndex:10001,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>e.target===e.currentTarget&&onCerrar()}>
      <div style={{background:'#fff',borderRadius:14,width:'95%',maxWidth:480,boxShadow:'0 20px 60px rgba(0,0,0,.25)'}}>
        <div style={{padding:'16px 20px',borderBottom:'0.5px solid rgba(0,0,0,.08)',display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{fontSize:15,fontWeight:700,color:'#A32D2D'}}>🗑 Solicitud de eliminación</div><button onClick={onCerrar} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#aaa'}}>×</button></div>
        <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
          <div style={{background:'#f8f9fb',borderRadius:10,padding:'12px 14px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>{[['Plantilla',meta.plantillaNombre],['Solicitado por',meta.solicitante]].map(([lbl,val])=>(<div key={lbl}><p style={{fontSize:10,color:'#aaa',textTransform:'uppercase',letterSpacing:'.5px',margin:'0 0 2px'}}>{lbl}</p><p style={{fontSize:12,fontWeight:500,margin:0}}>{val||'—'}</p></div>))}</div>
          {meta.observacion&&(<div style={{padding:'10px 14px',background:'#FAEEDA',border:'0.5px solid #FAC775',borderRadius:8}}><div style={{fontSize:10,color:'#854F0B',textTransform:'uppercase',letterSpacing:'.5px',fontWeight:600,marginBottom:4}}>Motivo del solicitante</div><div style={{fontSize:13,color:'#5c3a00',lineHeight:1.5}}>{meta.observacion}</div></div>)}
          <div style={{padding:'8px 12px',background:'#FCEBEB',border:'0.5px solid #fca5a5',borderRadius:7,fontSize:12,color:'#A32D2D',fontWeight:500}}>⚠️ Si aprobás, la plantilla será <strong>eliminada permanentemente</strong>.</div>
          <div><label style={{fontSize:11,fontWeight:600,color:'#888',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:4,display:'block'}}>Observación (requerida para rechazar)</label><textarea rows={2} value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Motivo del rechazo..." style={{width:'100%',padding:'8px 11px',border:'0.5px solid rgba(0,0,0,.18)',borderRadius:7,fontSize:13,outline:'none',resize:'vertical',fontFamily:'inherit',boxSizing:'border-box'}} /></div>
        </div>
        <div style={{padding:'12px 20px',borderTop:'0.5px solid rgba(0,0,0,.08)',display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button onClick={onCerrar} style={{padding:'8px 14px',border:'0.5px solid rgba(0,0,0,.15)',borderRadius:7,fontSize:13,cursor:'pointer',background:'#f5f5f5',fontFamily:'inherit'}}>Cancelar</button>
          <button onClick={handleRechazar} disabled={procesando||!motivo.trim()} style={{padding:'8px 16px',border:'none',borderRadius:7,fontSize:13,fontWeight:500,cursor:procesando||!motivo.trim()?'not-allowed':'pointer',background:procesando||!motivo.trim()?'#f0f0f0':'#FAEEDA',color:procesando||!motivo.trim()?'#bbb':'#854F0B',fontFamily:'inherit'}}>Rechazar solicitud</button>
          <button onClick={handleAprobar} disabled={procesando} style={{padding:'8px 20px',border:'none',borderRadius:7,fontSize:13,fontWeight:600,cursor:procesando?'not-allowed':'pointer',background:procesando?'#e0e0e0':'#A32D2D',color:procesando?'#aaa':'#fff',fontFamily:'inherit'}}>{procesando?'Eliminando...':'🗑 Aprobar y eliminar'}</button>
        </div>
      </div>
    </div>
  )
}

function PaginaPlantillas() {
  const [sub,setSub]=useState(()=>localStorage.getItem('cfg_plt_sub')||'cotizacion')
  const cambiarSub = (id) => { setSub(id); localStorage.setItem('cfg_plt_sub',id) }
  const subs=[{id:'cotizacion',label:'Cotización'},{id:'proyecto',label:'Proyecto'},{id:'whatsapp',label:'💬 WhatsApp'}]
  return (
    <div style={{display:'flex',height:'100%'}}>
      <SubNav grupo="Plantillas" subs={subs} activo={sub} onChange={cambiarSub} />
      <div style={{flex:1,padding:'24px 28px',overflowY:'auto',background:'#f4f6f4'}}>
        {sub==='cotizacion' && <PlantillaCotizacionPreview />}
        {sub==='proyecto'   && <PlantillaProyectoPreview />}
        {sub==='whatsapp'   && <PlantillasWhatsApp />}
      </div>
    </div>
  )
}

// ─── BOT DE AYUDA ─────────────────────────────────────────────────────────────
function PaginaBot() {
  const [secciones,setSecciones]=useState([]); const [cargando,setCargando]=useState(true); const [guardando,setGuardando]=useState(false); const [msg,setMsg]=useState(''); const [editId,setEditId]=useState(null); const [formNombre,setFormNombre]=useState(''); const [formContenido,setFormContenido]=useState(''); const [formEmoji,setFormEmoji]=useState('📋')
  const EMOJIS=['📋','📦','⚙️','🔧','📍','💰','🛡️','📞','🚗','⏱️','🏗️','📝','❄️','🔌','🏠','🌐']
  const inp={width:'100%',padding:'8px 10px',border:'1px solid #d0d8d0',borderRadius:6,fontSize:12,background:'#fff',color:'#1a1a1a',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}
  const lbl={fontSize:10,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.5px',display:'block',marginBottom:4,marginTop:12}
  useEffect(()=>{ cargar() },[])
  const cargar=async()=>{ setCargando(true); try{const snap=await getDoc(doc(db,'configuracion','bot')); if(snap.exists()) setSecciones(snap.data().secciones||[])}catch(e){console.error(e)}finally{setCargando(false)} }
  const guardarFirestore=async(nuevas)=>{ setGuardando(true); try{await setDoc(doc(db,'configuracion','bot'),{secciones:nuevas},{merge:true}); setSecciones(nuevas); setMsg('✓ Guardado'); setTimeout(()=>setMsg(''),2500)}catch(e){setMsg('Error al guardar')}finally{setGuardando(false)} }
  const limpiarForm=()=>{ setFormNombre('');setFormContenido('');setFormEmoji('📋');setEditId(null) }
  const iniciarEdicion=(s)=>{ setEditId(s.id);setFormNombre(s.nombre);setFormContenido(s.contenido);setFormEmoji(s.emoji||'📋') }
  const guardarSeccion=async()=>{ if(!formNombre.trim()||!formContenido.trim()) return; let nuevas; if(editId){nuevas=secciones.map(s=>s.id===editId?{...s,nombre:formNombre.trim(),contenido:formContenido.trim(),emoji:formEmoji}:s)}else{nuevas=[...secciones,{id:'sec_'+Date.now(),nombre:formNombre.trim(),contenido:formContenido.trim(),emoji:formEmoji}]}; await guardarFirestore(nuevas); limpiarForm() }
  const eliminarSeccion=async(id)=>{ if(!window.confirm('¿Eliminar esta sección?')) return; await guardarFirestore(secciones.filter(s=>s.id!==id)); if(editId===id) limpiarForm() }
  const moverSeccion=async(idx,dir)=>{ const nuevas=[...secciones]; const dest=idx+dir; if(dest<0||dest>=nuevas.length) return; [nuevas[idx],nuevas[dest]]=[nuevas[dest],nuevas[idx]]; await guardarFirestore(nuevas) }
  if(cargando) return <div style={{padding:40,textAlign:'center',color:'#aaa',fontSize:13}}>Cargando...</div>
  return (
    <div style={{padding:'24px 28px',overflowY:'auto',flex:1,background:'#f4f6f4'}}>
      <SubTitle>Base de conocimiento del Bot</SubTitle>
      <div style={{background:'#E6F1FB',border:'1px solid #B3D4F5',borderRadius:8,padding:'12px 16px',fontSize:12,color:'#0C447C',marginBottom:20}}>💡 El Bot Eco Ingeniería CR usa estas secciones para responder preguntas de tu negocio.</div>
      <div style={{display:'flex',gap:24}}>
        <div style={{width:420,flexShrink:0}}>
          <div style={{background:'#fff',border:'1px solid #d0d8d0',borderRadius:10,padding:20,position:'sticky',top:0}}>
            <div style={{fontSize:13,fontWeight:600,color:'#1a1a1a',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between'}}>{editId?'Editar sección':'Nueva sección'}{editId&&<button onClick={limpiarForm} style={{fontSize:11,color:'#888',background:'none',border:'none',cursor:'pointer',padding:'2px 8px',borderRadius:5}}>+ Nueva</button>}</div>
            <label style={lbl}>Ícono</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>{EMOJIS.map(e=>(<button key={e} onClick={()=>setFormEmoji(e)} style={{width:32,height:32,borderRadius:6,border:`2px solid ${formEmoji===e?'var(--eco-primary)':'#e0e0e0'}`,background:formEmoji===e?'var(--eco-primary-light)':'#fff',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>{e}</button>))}</div>
            <label style={lbl}>Nombre de la sección</label>
            <input style={inp} placeholder="Ej: Zonas de cobertura..." value={formNombre} onChange={e=>setFormNombre(e.target.value)} />
            <label style={{...lbl,marginTop:12}}>Contenido</label>
            <textarea style={{...inp,resize:'vertical',minHeight:200,lineHeight:1.7}} value={formContenido} onChange={e=>setFormContenido(e.target.value)} />
            <div style={{fontSize:10,color:'#aaa',marginTop:4,marginBottom:16}}>Podés usar listas, precios, horarios, lo que necesitás.</div>
            <div style={{display:'flex',gap:8}}>
              {editId&&<button onClick={limpiarForm} style={{flex:1,padding:'8px',border:'1px solid #d0d8d0',borderRadius:6,fontSize:12,cursor:'pointer',background:'#f5f5f5',color:'#555',fontFamily:'inherit'}}>Cancelar</button>}
              <button onClick={guardarSeccion} disabled={!formNombre.trim()||!formContenido.trim()||guardando} style={{flex:2,padding:'8px 16px',border:'none',borderRadius:6,fontSize:12,fontWeight:600,cursor:(!formNombre.trim()||!formContenido.trim())?'not-allowed':'pointer',background:(!formNombre.trim()||!formContenido.trim())?'#e0e0e0':'var(--eco-primary)',color:(!formNombre.trim()||!formContenido.trim())?'#aaa':'#fff',fontFamily:'inherit'}}>{guardando?'Guardando...':editId?'✓ Guardar cambios':'+ Agregar sección'}</button>
            </div>
            {msg&&<div style={{marginTop:10,padding:'6px 10px',borderRadius:6,background:msg.startsWith('✓')?'#EAF3DE':'#FCEBEB',color:msg.startsWith('✓')?'#2e7d32':'#A32D2D',fontSize:12,textAlign:'center'}}>{msg}</div>}
          </div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600,color:'#1a1a1a',marginBottom:14}}>Secciones <span style={{marginLeft:8,fontSize:11,fontWeight:400,color:'#999'}}>{secciones.length} sección{secciones.length!==1?'es':''}</span></div>
          {secciones.length===0&&(<div style={{background:'#fff',border:'1px solid #d0d8d0',borderRadius:10,padding:'32px 20px',textAlign:'center',color:'#aaa',fontSize:12}}><div style={{fontSize:36,marginBottom:8}}>🤖</div>No hay secciones aún.</div>)}
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {secciones.map((s,idx)=>(<div key={s.id} style={{background:editId===s.id?'#EAF3DE':'#fff',border:`1px solid ${editId===s.id?'#8BC34A':'#e0e8e0'}`,borderRadius:8,padding:'12px 16px'}}><div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}><div style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',flex:1}} onClick={()=>iniciarEdicion(s)}><span style={{fontSize:18}}>{s.emoji||'📋'}</span><span style={{fontWeight:600,fontSize:13,color:editId===s.id?'#2e7d32':'#1a1a1a'}}>{editId===s.id?'✎ ':''}{s.nombre}</span></div><div style={{display:'flex',gap:4,alignItems:'center',flexShrink:0}}><button onClick={()=>moverSeccion(idx,-1)} disabled={idx===0} style={{background:'none',border:'1px solid #d0d8d0',borderRadius:5,cursor:idx===0?'not-allowed':'pointer',color:'#888',fontSize:12,padding:'2px 7px',fontFamily:'inherit',opacity:idx===0?0.4:1}}>↑</button><button onClick={()=>moverSeccion(idx,1)} disabled={idx===secciones.length-1} style={{background:'none',border:'1px solid #d0d8d0',borderRadius:5,cursor:idx===secciones.length-1?'not-allowed':'pointer',color:'#888',fontSize:12,padding:'2px 7px',fontFamily:'inherit',opacity:idx===secciones.length-1?0.4:1}}>↓</button><button onClick={()=>iniciarEdicion(s)} style={{background:'none',border:'1px solid #d0d8d0',borderRadius:5,cursor:'pointer',color:'#185FA5',fontSize:11,padding:'2px 8px',fontFamily:'inherit'}}>Editar</button><button onClick={()=>eliminarSeccion(s.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#ccc',fontSize:16,lineHeight:1,padding:'2px 4px',borderRadius:4}} onMouseEnter={e=>e.currentTarget.style.color='#A32D2D'} onMouseLeave={e=>e.currentTarget.style.color='#ccc'}>×</button></div></div><div style={{fontSize:11,color:'#888',lineHeight:1.5,marginTop:6,marginLeft:26,whiteSpace:'pre-wrap',maxHeight:60,overflow:'hidden'}}>{s.contenido}</div><div style={{fontSize:10,color:'#bbb',marginTop:4,marginLeft:26}}>{s.contenido.length} caracteres</div></div>))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── CUENTAS (Bancos + Créditos) ─────────────────────────────────────────────
function PaginaCuentas() {
  const [cuentas,setCuentas]=useState([])
  const [creditos,setCreditos]=useState([])
  const [movimientos,setMovimientos]=useState([])
  const [gruposTdc,setGruposTdc]=useState([])
  const [nuevoGrupo,setNuevoGrupo]=useState('')
  const [loading,setLoading]=useState(true)
  const [editando,setEditando]=useState(null)
  const [creando,setCreando]=useState(null) // 'banco' | 'credito' | null

  const TIPOS_CUENTA=['Cuenta corriente','Cuenta de ahorros','Tarjeta de crédito','Tarjeta débito','Caja chica','Otro']
  const MONEDAS=['CRC','USD']
  const lblSt={fontSize:10,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.5px',display:'block',marginBottom:4}

  const fmt=(n,mon='USD')=>mon==='USD'
    ?'$'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
    :'₡'+Number(n||0).toLocaleString('es-CR',{minimumFractionDigits:0})

  useEffect(()=>{
    const u1=onSnapshot(collection(db,'cuentas_bancarias'),snap=>{
      setCuentas(snap.docs.map(d=>({id:d.id,...d.data()})))
      setLoading(false)
    })
    const u2=onSnapshot(collection(db,'creditos_bancarios'),snap=>{
      setCreditos(snap.docs.map(d=>({id:d.id,...d.data()})))
    })
    const u3=onSnapshot(collection(db,'movimientos_bancarios'),snap=>{
      setMovimientos(snap.docs.map(d=>({id:d.id,...d.data()})))
    })
    const u4=onSnapshot(collection(db,'grupos_tdc'),snap=>{
      setGruposTdc(snap.docs.map(d=>({id:d.id,...d.data()})))
    })
    return ()=>{u1();u2();u3();u4()}
  },[])

  // Saldo calculado por cuenta
  const saldoPorCuenta={}
  cuentas.forEach(c=>{saldoPorCuenta[c.id]=Number(c.saldoInicial||0)})
  movimientos.forEach(m=>{
    if(m.tipo==='ingreso') saldoPorCuenta[m.cuentaId]=(saldoPorCuenta[m.cuentaId]||0)+Number(m.monto)
    if(m.tipo==='egreso')  saldoPorCuenta[m.cuentaId]=(saldoPorCuenta[m.cuentaId]||0)-Number(m.monto)
    if(m.tipo==='transferencia'){
      saldoPorCuenta[m.cuentaId]=(saldoPorCuenta[m.cuentaId]||0)-Number(m.monto)
      saldoPorCuenta[m.cuentaDestinoId]=(saldoPorCuenta[m.cuentaDestinoId]||0)+Number(m.monto)
    }
  })

  const guardarEdicionCuenta=async(id,campo,valor)=>{
    await updateDoc(doc(db,'cuentas_bancarias',id),{[campo]:valor,actualizadoEn:serverTimestamp()})
  }
  const eliminarCuenta=async(id)=>{
    if(!confirm('¿Eliminar esta cuenta bancaria? Los movimientos asociados NO se borrarán.')) return
    await deleteDoc(doc(db,'cuentas_bancarias',id))
  }
  const guardarEdicionCredito=async(id,campo,valor)=>{
    await updateDoc(doc(db,'creditos_bancarios',id),{[campo]:valor,actualizadoEn:serverTimestamp()})
  }
  const eliminarCredito=async(id)=>{
    if(!confirm('¿Eliminar este crédito? Los pagos asociados NO se borrarán.')) return
    await deleteDoc(doc(db,'creditos_bancarios',id))
  }

  const crearGrupoTdc=async(nombre)=>{
    if(!nombre.trim()) return
    await addDoc(collection(db,'grupos_tdc'),{nombre:nombre.trim(),creadoEn:serverTimestamp()})
    setNuevoGrupo('')
  }
  const eliminarGrupoTdc=async(id)=>{
    if(!confirm('¿Eliminar este grupo TDC?')) return
    await deleteDoc(doc(db,'grupos_tdc',id))
  }

  // ─── Formulario nueva cuenta bancaria ──────
  // Grupos TDC existentes
  // gruposTdc viene del state

  const FormNuevaCuenta=()=>{
    const [f,setF]=useState({nombre:'',tipo:'Cuenta corriente',moneda:'USD',ultimos4:'',saldoInicial:0,color:'#185FA5',activa:true,limiteTdc:'',grupoTdc:'',fechaCorte:'',fechaPago:'',monedaLimite:'USD'})
    const [guardando,setGuardando]=useState(false)
    const up=(k,v)=>setF(x=>({...x,[k]:v}))
    const esTDC=f.tipo==='Tarjeta de crédito'
    const guardar=async()=>{
      if(!f.nombre.trim()) return
      if(esTDC&&(!f.limiteTdc||Number(f.limiteTdc)<=0)) return
      setGuardando(true)
      const data={...f,saldoInicial:Number(f.saldoInicial),limiteTdc:Number(f.limiteTdc||0),creadoEn:serverTimestamp()}
      if(!esTDC){delete data.limiteTdc;delete data.grupoTdc;delete data.fechaCorte;delete data.fechaPago;delete data.monedaLimite}
      await addDoc(collection(db,'cuentas_bancarias'),data)
      setGuardando(false); setCreando(null)
    }
    return (
      <div style={{background:'#fff',border:'2px solid var(--eco-primary,#1a3a5c)',borderRadius:8,padding:'16px 20px',marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <span style={{fontSize:14,fontWeight:600,color:'var(--eco-primary,#1a3a5c)'}}>Nueva cuenta</span>
          <button onClick={()=>setCreando(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:'#aaa'}}>×</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
          <div style={{gridColumn:'1/-1'}}>
            <label style={lblSt}>Nombre de la cuenta *</label>
            <input style={iSt} placeholder="Ej: Visa BAC Principal" value={f.nombre} onChange={e=>up('nombre',e.target.value)} autoFocus/>
          </div>
          <div>
            <label style={lblSt}>Tipo de cuenta</label>
            <select style={iSt} value={f.tipo} onChange={e=>up('tipo',e.target.value)}>{TIPOS_CUENTA.map(t=><option key={t}>{t}</option>)}</select>
          </div>
          {!esTDC&&<div>
            <label style={lblSt}>Moneda</label>
            <select style={iSt} value={f.moneda} onChange={e=>up('moneda',e.target.value)}>{MONEDAS.map(m=><option key={m}>{m}</option>)}</select>
          </div>}
          <div>
            <label style={lblSt}>Últimos 4 dígitos</label>
            <input style={iSt} maxLength={4} placeholder="0000" value={f.ultimos4} onChange={e=>up('ultimos4',e.target.value.replace(/\D/g,'').slice(0,4))}/>
          </div>
          <div>
            <label style={lblSt}>{esTDC?'Saldo actual adeudado (USD)':`Saldo inicial (${f.moneda})`}</label>
            <input style={iSt} type="number" step="0.01" value={f.saldoInicial} onChange={e=>up('saldoInicial',e.target.value)}/>
          </div>
          <div>
            <label style={lblSt}>Color</label>
            <input type="color" value={f.color} onChange={e=>up('color',e.target.value)} style={{width:40,height:32,border:'none',borderRadius:6,cursor:'pointer'}}/>
          </div>
        </div>
        {/* Campos TDC */}
        {esTDC&&(
          <div style={{background:'#fef5f5',border:'1px solid #f0d0d0',borderRadius:8,padding:12,marginTop:12}}>
            <p style={{fontSize:10,fontWeight:600,color:'#A32D2D',textTransform:'uppercase',letterSpacing:'.5px',margin:'0 0 10px'}}>Configuración TDC</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
              <div>
                <label style={lblSt}>Límite de crédito *</label>
                <input style={iSt} type="number" min="0" step="0.01" placeholder="0.00" value={f.limiteTdc} onChange={e=>up('limiteTdc',e.target.value)}/>
              </div>
              <div>
                <label style={lblSt}>Moneda del límite</label>
                <select style={iSt} value={f.monedaLimite} onChange={e=>up('monedaLimite',e.target.value)}>{MONEDAS.map(m=><option key={m}>{m}</option>)}</select>
              </div>
              <div>
                <label style={lblSt}>Día de corte</label>
                <input style={iSt} type="number" min="1" max="31" placeholder="15" value={f.fechaCorte} onChange={e=>up('fechaCorte',Number(e.target.value))}/>
              </div>
              <div>
                <label style={lblSt}>Día de pago</label>
                <input style={iSt} type="number" min="1" max="31" placeholder="5" value={f.fechaPago} onChange={e=>up('fechaPago',Number(e.target.value))}/>
              </div>
              <div>
                <label style={lblSt}>Grupo TDC (compartido)</label>
                <select style={iSt} value={f.grupoTdc} onChange={e=>up('grupoTdc',e.target.value)}>
                  <option value="">Sin grupo (independiente)</option>
                  {gruposTdc.map(g=><option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
              </div>
            </div>
            <p style={{fontSize:10,color:'#aaa',marginTop:8}}>Las tarjetas con el mismo grupo comparten el límite. Dejá vacío si es independiente.</p>
          </div>
        )}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:14}}>
          <button onClick={()=>setCreando(null)} style={{padding:'7px 14px',border:'1px solid #d0d8d0',borderRadius:6,fontSize:12,cursor:'pointer',background:'#fff',fontFamily:'inherit'}}>Cancelar</button>
          <button onClick={guardar} disabled={guardando||!f.nombre.trim()} style={{padding:'7px 18px',border:'none',borderRadius:6,fontSize:12,fontWeight:500,cursor:guardando?'not-allowed':'pointer',background:guardando?'#e0e0e0':'var(--eco-primary,#1a3a5c)',color:guardando?'#aaa':'#fff',fontFamily:'inherit'}}>
            {guardando?'Creando...':'Crear cuenta'}
          </button>
        </div>
      </div>
    )
  }

  // ─── Formulario nuevo crédito bancario ──────
  const FormNuevoCredito=()=>{
    const [f,setF]=useState({nombre:'',cuentaVinculadaId:'',montoOriginal:'',tasaInteres:'',plazoMeses:'',fechaInicio:new Date().toISOString().split('T')[0],moneda:'USD',notas:''})
    const [guardando,setGuardando]=useState(false)
    const up=(k,v)=>setF(x=>({...x,[k]:v}))

    const P=Number(f.montoOriginal),r=Number(f.tasaInteres)/100/12,n=Number(f.plazoMeses)
    const cuotaMensual=(P&&r&&n)?(P*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1):0

    const guardar=async()=>{
      if(!f.nombre.trim()||!P||!r||!n) return
      setGuardando(true)
      await addDoc(collection(db,'creditos_bancarios'),{...f,montoOriginal:P,tasaInteres:Number(f.tasaInteres),plazoMeses:n,cuotaMensual,estado:'activo',creadoEn:serverTimestamp()})
      setGuardando(false); setCreando(null)
    }
    return (
      <div style={{background:'#fff',border:'2px solid #854F0B',borderRadius:8,padding:'16px 20px',marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <span style={{fontSize:14,fontWeight:600,color:'#854F0B'}}>Nuevo crédito bancario</span>
          <button onClick={()=>setCreando(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:'#aaa'}}>×</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
          <div style={{gridColumn:'1/-1'}}>
            <label style={lblSt}>Nombre del crédito *</label>
            <input style={iSt} placeholder="Ej: Préstamo vehículo BCR" value={f.nombre} onChange={e=>up('nombre',e.target.value)} autoFocus/>
          </div>
          <div>
            <label style={lblSt}>Moneda</label>
            <select style={iSt} value={f.moneda} onChange={e=>up('moneda',e.target.value)}>{MONEDAS.map(m=><option key={m}>{m}</option>)}</select>
          </div>
          <div>
            <label style={lblSt}>Cuenta vinculada</label>
            <select style={iSt} value={f.cuentaVinculadaId} onChange={e=>up('cuentaVinculadaId',e.target.value)}>
              <option value="">Seleccionar...</option>
              {cuentas.map(c=><option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>)}
            </select>
          </div>
          <div>
            <label style={lblSt}>Monto original ({f.moneda}) *</label>
            <input style={iSt} type="number" min="0" step="0.01" placeholder="0.00" value={f.montoOriginal} onChange={e=>up('montoOriginal',e.target.value)}/>
          </div>
          <div>
            <label style={lblSt}>Tasa interés anual (%) *</label>
            <input style={iSt} type="number" min="0" step="0.01" placeholder="12.5" value={f.tasaInteres} onChange={e=>up('tasaInteres',e.target.value)}/>
          </div>
          <div>
            <label style={lblSt}>Plazo (meses) *</label>
            <input style={iSt} type="number" min="1" step="1" placeholder="36" value={f.plazoMeses} onChange={e=>up('plazoMeses',e.target.value)}/>
          </div>
          <div>
            <label style={lblSt}>Fecha de inicio</label>
            <input style={iSt} type="date" value={f.fechaInicio} onChange={e=>up('fechaInicio',e.target.value)}/>
          </div>
          <div>
            <label style={lblSt}>Notas</label>
            <input style={iSt} placeholder="Observaciones..." value={f.notas} onChange={e=>up('notas',e.target.value)}/>
          </div>
        </div>
        {cuotaMensual>0&&(
          <div style={{background:'#fef8ee',border:'1px solid #edd6a8',borderRadius:8,padding:10,marginTop:12,display:'flex',gap:20,fontSize:12}}>
            <div><span style={{color:'#aaa',fontSize:10,textTransform:'uppercase'}}>Cuota mensual</span><br/><strong style={{color:'#854F0B'}}>{fmt(cuotaMensual,f.moneda)}</strong></div>
            <div><span style={{color:'#aaa',fontSize:10,textTransform:'uppercase'}}>Total a pagar</span><br/><strong>{fmt(cuotaMensual*n,f.moneda)}</strong></div>
            <div><span style={{color:'#aaa',fontSize:10,textTransform:'uppercase'}}>Total intereses</span><br/><strong style={{color:'#A32D2D'}}>{fmt(cuotaMensual*n-P,f.moneda)}</strong></div>
          </div>
        )}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:14}}>
          <button onClick={()=>setCreando(null)} style={{padding:'7px 14px',border:'1px solid #d0d8d0',borderRadius:6,fontSize:12,cursor:'pointer',background:'#fff',fontFamily:'inherit'}}>Cancelar</button>
          <button onClick={guardar} disabled={guardando||!f.nombre.trim()||!P} style={{padding:'7px 18px',border:'none',borderRadius:6,fontSize:12,fontWeight:500,cursor:guardando?'not-allowed':'pointer',background:guardando?'#e0e0e0':'#854F0B',color:guardando?'#aaa':'#fff',fontFamily:'inherit'}}>
            {guardando?'Creando...':'Crear crédito'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{padding:'24px 28px',overflowY:'auto',flex:1}}>
      <SubTitle>Cuentas</SubTitle>
      <p style={{fontSize:12,color:'#888',marginBottom:16}}>Creá y administrá cuentas bancarias y créditos. Estas cuentas alimentan el módulo de Bancos — el disponible se calcula según los ingresos y egresos registrados.</p>

      {/* Botones crear */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        <button onClick={()=>setCreando('banco')} style={{padding:'8px 16px',border:'none',borderRadius:7,fontSize:12,fontWeight:500,cursor:'pointer',background:'var(--eco-primary,#1a3a5c)',color:'#fff',fontFamily:'inherit'}}>+ Cuenta bancaria</button>
        <button onClick={()=>setCreando('credito')} style={{padding:'8px 16px',border:'none',borderRadius:7,fontSize:12,fontWeight:500,cursor:'pointer',background:'#854F0B',color:'#fff',fontFamily:'inherit'}}>+ Crédito bancario</button>
      </div>

      {/* Formularios de creación */}
      {creando==='banco'&&<FormNuevaCuenta/>}
      {creando==='credito'&&<FormNuevoCredito/>}

      {loading?(
        <p style={{color:'#999',fontSize:13}}>Cargando...</p>
      ):(
        <>
          {/* ─── GRUPOS TDC ──── */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:12,fontWeight:600,color:'#555',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:10,height:10,borderRadius:'50%',background:'#A32D2D',display:'inline-block'}}/>
              Grupos TDC ({gruposTdc.length})
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
              <input style={{...iSt,width:220}} placeholder="Nombre del grupo (ej: Visa BAC)" value={nuevoGrupo} onChange={e=>setNuevoGrupo(e.target.value)} onKeyDown={e=>e.key==='Enter'&&crearGrupoTdc(nuevoGrupo)}/>
              <button onClick={()=>crearGrupoTdc(nuevoGrupo)} disabled={!nuevoGrupo.trim()} style={{padding:'7px 14px',border:'none',borderRadius:6,fontSize:12,fontWeight:500,cursor:!nuevoGrupo.trim()?'not-allowed':'pointer',background:!nuevoGrupo.trim()?'#e0e0e0':'#A32D2D',color:!nuevoGrupo.trim()?'#aaa':'#fff',fontFamily:'inherit',whiteSpace:'nowrap'}}>+ Crear grupo</button>
            </div>
            {gruposTdc.length===0?(
              <p style={{fontSize:12,color:'#aaa',margin:0}}>Sin grupos. Las tarjetas sin grupo tienen límite independiente.</p>
            ):(
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {gruposTdc.map(g=>{
                  const tarjetasEnGrupo=cuentas.filter(c=>c.grupoTdc===g.id).length
                  return (
                    <div key={g.id} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 12px',background:'#fff',border:'1px solid #e0e8e0',borderRadius:20,fontSize:12}}>
                      <span style={{fontWeight:500}}>{g.nombre}</span>
                      <span style={{fontSize:10,color:'#aaa'}}>{tarjetasEnGrupo} tarjeta{tarjetasEnGrupo!==1?'s':''}</span>
                      <button onClick={()=>eliminarGrupoTdc(g.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#ccc',fontSize:14,padding:0,lineHeight:1}} onMouseEnter={e=>e.currentTarget.style.color='#A32D2D'} onMouseLeave={e=>e.currentTarget.style.color='#ccc'}>×</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ─── CUENTAS BANCARIAS ──── */}
          <div style={{marginBottom:24}}>
            <div style={{fontSize:12,fontWeight:600,color:'#555',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:10,height:10,borderRadius:'50%',background:'var(--eco-primary,#1a3a5c)',display:'inline-block'}}/>
              Cuentas bancarias ({cuentas.length})
            </div>
            {cuentas.length===0?(
              <div style={{background:'#fff',border:'1px solid #e0e8e0',borderRadius:8,padding:'20px',textAlign:'center',color:'#999',fontSize:12}}>No hay cuentas bancarias. Creá la primera con el botón de arriba.</div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {cuentas.map(c=>{
                  const saldo=saldoPorCuenta[c.id]||0
                  return (
                    <div key={c.id} style={{background:'#fff',border:'1px solid #e0e8e0',borderRadius:8,padding:'14px 18px'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <span style={{width:8,height:8,borderRadius:'50%',background:c.color||'#185FA5',flexShrink:0}}/>
                          <div>
                            <span style={{fontSize:13,fontWeight:600}}>{c.nombre}</span>
                            <span style={{fontSize:11,color:'#888',marginLeft:8}}>{c.tipo}{c.tipo==='Tarjeta de crédito'?' · ₡+$':' · '+c.moneda}{c.ultimos4?' · ••••'+c.ultimos4:''}</span>
                          </div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          {c.tipo==='Tarjeta de crédito'?(
                            <><span style={{fontSize:15,fontWeight:700,color:'#A32D2D'}}>{fmt(c.limiteTdc||0,c.monedaLimite||'USD')}</span><span style={{fontSize:10,color:'#aaa'}}>límite{c.grupoTdc?' · grupo: '+c.grupoTdc:''}</span></>
                          ):(
                            <><span style={{fontSize:15,fontWeight:700,color:saldo<0?'#A32D2D':'#1a1a1a'}}>{fmt(saldo,c.moneda)}</span><span style={{fontSize:10,color:'#aaa'}}>disponible</span></>
                          )}
                          <button onClick={()=>setEditando(editando===c.id?null:c.id)} style={{padding:'3px 10px',border:'1px solid #d0d8d0',borderRadius:5,fontSize:11,cursor:'pointer',background:editando===c.id?'#f0f4f8':'#fff',fontFamily:'inherit',color:'#555'}}>
                            {editando===c.id?'Cerrar':'Editar'}
                          </button>
                          <button onClick={()=>eliminarCuenta(c.id)} style={{padding:'3px 10px',border:'1px solid #e8d0d0',borderRadius:5,fontSize:11,cursor:'pointer',background:'#fff',fontFamily:'inherit',color:'#A32D2D'}}>×</button>
                        </div>
                      </div>
                      {editando===c.id&&(
                        <div style={{borderTop:'1px solid #e0e8e0',paddingTop:12,marginTop:12}}>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10}}>
                            <div>
                              <label style={lblSt}>Nombre</label>
                              <input style={iSt} defaultValue={c.nombre} onBlur={e=>e.target.value!==c.nombre&&guardarEdicionCuenta(c.id,'nombre',e.target.value)}/>
                            </div>
                            <div>
                              <label style={lblSt}>Tipo</label>
                              <select style={iSt} defaultValue={c.tipo} onChange={e=>guardarEdicionCuenta(c.id,'tipo',e.target.value)}>{TIPOS_CUENTA.map(t=><option key={t}>{t}</option>)}</select>
                            </div>
                            {c.tipo!=='Tarjeta de crédito'&&<div>
                              <label style={lblSt}>Moneda</label>
                              <select style={iSt} defaultValue={c.moneda} onChange={e=>guardarEdicionCuenta(c.id,'moneda',e.target.value)}>{MONEDAS.map(m=><option key={m}>{m}</option>)}</select>
                            </div>}
                            <div>
                              <label style={lblSt}>Últimos 4</label>
                              <input style={iSt} maxLength={4} defaultValue={c.ultimos4} onBlur={e=>guardarEdicionCuenta(c.id,'ultimos4',e.target.value.replace(/\D/g,'').slice(0,4))}/>
                            </div>
                            <div>
                              <label style={lblSt}>{c.tipo==='Tarjeta de crédito'?'Saldo adeudado':'Saldo inicial'}</label>
                              <input style={iSt} type="number" step="0.01" defaultValue={c.saldoInicial} onBlur={e=>guardarEdicionCuenta(c.id,'saldoInicial',Number(e.target.value))}/>
                            </div>
                            <div>
                              <label style={lblSt}>Color</label>
                              <input type="color" defaultValue={c.color||'#185FA5'} onChange={e=>guardarEdicionCuenta(c.id,'color',e.target.value)} style={{width:40,height:32,border:'none',borderRadius:6,cursor:'pointer'}}/>
                            </div>
                            <div>
                              <label style={lblSt}>Estado</label>
                              <select style={iSt} defaultValue={c.activa!==false?'true':'false'} onChange={e=>guardarEdicionCuenta(c.id,'activa',e.target.value==='true')}>
                                <option value="true">Activa</option>
                                <option value="false">Inactiva</option>
                              </select>
                            </div>
                          </div>
                          {/* Campos TDC inline */}
                          {c.tipo==='Tarjeta de crédito'&&(
                            <div style={{background:'#fef5f5',border:'1px solid #f0d0d0',borderRadius:8,padding:10,marginTop:10}}>
                              <p style={{fontSize:10,fontWeight:600,color:'#A32D2D',margin:'0 0 8px',textTransform:'uppercase',letterSpacing:'.5px'}}>Configuración TDC</p>
                              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                                <div>
                                  <label style={lblSt}>Límite</label>
                                  <input style={iSt} type="number" step="0.01" defaultValue={c.limiteTdc} onBlur={e=>guardarEdicionCuenta(c.id,'limiteTdc',Number(e.target.value))}/>
                                </div>
                                <div>
                                  <label style={lblSt}>Moneda límite</label>
                                  <select style={iSt} defaultValue={c.monedaLimite||'USD'} onChange={e=>guardarEdicionCuenta(c.id,'monedaLimite',e.target.value)}>{MONEDAS.map(m=><option key={m}>{m}</option>)}</select>
                                </div>
                                <div>
                                  <label style={lblSt}>Día corte</label>
                                  <input style={iSt} type="number" min="1" max="31" defaultValue={c.fechaCorte} onBlur={e=>guardarEdicionCuenta(c.id,'fechaCorte',Number(e.target.value))}/>
                                </div>
                                <div>
                                  <label style={lblSt}>Día pago</label>
                                  <input style={iSt} type="number" min="1" max="31" defaultValue={c.fechaPago} onBlur={e=>guardarEdicionCuenta(c.id,'fechaPago',Number(e.target.value))}/>
                                </div>
                                <div>
                                  <label style={lblSt}>Grupo TDC</label>
                                  <select style={iSt} defaultValue={c.grupoTdc||''} onChange={e=>guardarEdicionCuenta(c.id,'grupoTdc',e.target.value)}>
                                    <option value="">Sin grupo</option>
                                    {gruposTdc.map(g=><option key={g.id} value={g.id}>{g.nombre}</option>)}
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ─── CRÉDITOS BANCARIOS ──── */}
          <div>
            <div style={{fontSize:12,fontWeight:600,color:'#555',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:10,height:10,borderRadius:'50%',background:'#854F0B',display:'inline-block'}}/>
              Créditos bancarios ({creditos.length})
            </div>
            {creditos.length===0?(
              <div style={{background:'#fff',border:'1px solid #e0e8e0',borderRadius:8,padding:'20px',textAlign:'center',color:'#999',fontSize:12}}>No hay créditos registrados. Creá el primero con el botón de arriba.</div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {creditos.map(cr=>{
                  const cuota=cr.cuotaMensual||0
                  const cuentaV=cuentas.find(c=>c.id===cr.cuentaVinculadaId)
                  return (
                    <div key={cr.id} style={{background:'#fff',border:'1px solid #e0e8e0',borderRadius:8,padding:'14px 18px'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div>
                          <span style={{fontSize:13,fontWeight:600}}>{cr.nombre}</span>
                          <span style={{fontSize:11,color:'#888',marginLeft:8}}>{cr.moneda} · {cr.plazoMeses}m · {cr.tasaInteres}%</span>
                          {cr.estado&&<span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:cr.estado==='activo'?'#EAF3DE':cr.estado==='liquidado'?'#f0f0f0':'#FAEEDA',color:cr.estado==='activo'?'#3B6D11':cr.estado==='liquidado'?'#888':'#854F0B',fontWeight:500,marginLeft:8}}>{cr.estado}</span>}
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontSize:14,fontWeight:700,color:'#854F0B'}}>{fmt(cuota,cr.moneda)}<span style={{fontSize:10,color:'#aaa',fontWeight:400}}>/mes</span></div>
                            <div style={{fontSize:10,color:'#aaa'}}>Monto: {fmt(cr.montoOriginal,cr.moneda)}{cuentaV?' · Cuenta: '+cuentaV.nombre:''}</div>
                          </div>
                          <button onClick={()=>setEditando(editando===('cr_'+cr.id)?null:'cr_'+cr.id)} style={{padding:'3px 10px',border:'1px solid #d0d8d0',borderRadius:5,fontSize:11,cursor:'pointer',background:editando===('cr_'+cr.id)?'#f0f4f8':'#fff',fontFamily:'inherit',color:'#555'}}>
                            {editando===('cr_'+cr.id)?'Cerrar':'Editar'}
                          </button>
                          <button onClick={()=>eliminarCredito(cr.id)} style={{padding:'3px 10px',border:'1px solid #e8d0d0',borderRadius:5,fontSize:11,cursor:'pointer',background:'#fff',fontFamily:'inherit',color:'#A32D2D'}}>×</button>
                        </div>
                      </div>
                      {editando===('cr_'+cr.id)&&(
                        <div style={{borderTop:'1px solid #e0e8e0',paddingTop:12,marginTop:12,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                          <div>
                            <label style={lblSt}>Nombre</label>
                            <input style={iSt} defaultValue={cr.nombre} onBlur={e=>e.target.value!==cr.nombre&&guardarEdicionCredito(cr.id,'nombre',e.target.value)}/>
                          </div>
                          <div>
                            <label style={lblSt}>Cuenta vinculada</label>
                            <select style={iSt} defaultValue={cr.cuentaVinculadaId||''} onChange={e=>guardarEdicionCredito(cr.id,'cuentaVinculadaId',e.target.value)}>
                              <option value="">Ninguna</option>
                              {cuentas.map(c=><option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={lblSt}>Tasa interés (%)</label>
                            <input style={iSt} type="number" step="0.01" defaultValue={cr.tasaInteres} onBlur={e=>{const v=Number(e.target.value);if(v!==cr.tasaInteres)guardarEdicionCredito(cr.id,'tasaInteres',v)}}/>
                          </div>
                          <div>
                            <label style={lblSt}>Fecha inicio</label>
                            <input style={iSt} type="date" defaultValue={cr.fechaInicio} onBlur={e=>e.target.value!==cr.fechaInicio&&guardarEdicionCredito(cr.id,'fechaInicio',e.target.value)}/>
                          </div>
                          <div>
                            <label style={lblSt}>Estado</label>
                            <select style={iSt} defaultValue={cr.estado||'activo'} onChange={e=>guardarEdicionCredito(cr.id,'estado',e.target.value)}>
                              <option value="activo">Activo</option>
                              <option value="pausado">Pausado</option>
                              <option value="liquidado">Liquidado</option>
                            </select>
                          </div>
                          <div style={{gridColumn:'1/-1'}}>
                            <label style={lblSt}>Notas</label>
                            <input style={iSt} defaultValue={cr.notas||''} placeholder="Observaciones..." onBlur={e=>guardarEdicionCredito(cr.id,'notas',e.target.value)}/>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── PROVEEDORES ─────────────────────────────────────────────────────────────
function PaginaProveedores() {
  const [proveedores,setProveedores]=useState([])
  const [loading,setLoading]=useState(true)
  const [editando,setEditando]=useState(null)
  const [creando,setCreando]=useState(false)
  const [busqueda,setBusqueda]=useState('')
  const lblSt={fontSize:10,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.5px',display:'block',marginBottom:4}

  useEffect(()=>{
    const unsub=onSnapshot(query(collection(db,'proveedores'),orderBy('nombreComercial')),snap=>{
      setProveedores(snap.docs.map(d=>({id:d.id,...d.data()})))
      setLoading(false)
    })
    return unsub
  },[])

  const guardar=async(form)=>{
    if(editando){
      await updateDoc(doc(db,'proveedores',editando.id),{...form,actualizadoEn:serverTimestamp()})
      setEditando(null)
    }else{
      await addDoc(collection(db,'proveedores'),{...form,productos:[],creadoEn:serverTimestamp()})
      setCreando(false)
    }
  }

  const eliminar=async(id)=>{
    if(!confirm('¿Eliminar este proveedor?')) return
    await deleteDoc(doc(db,'proveedores',id))
  }

  const filtrados=proveedores.filter(p=>{
    if(!busqueda) return true
    const q=busqueda.toLowerCase()
    return p.nombreComercial?.toLowerCase().includes(q)||p.contacto?.toLowerCase().includes(q)||p.email?.toLowerCase().includes(q)
  })

  const FormProveedor=({prov,onCancel})=>{
    const [f,setF]=useState({
      nombreComercial:prov?.nombreComercial||'',razonSocial:prov?.razonSocial||'',cedula:prov?.cedula||'',
      contacto:prov?.contacto||'',telefono:prov?.telefono||'',telContacto:prov?.telContacto||'',
      email:prov?.email||'',direccion:prov?.direccion||'',notas:prov?.notas||'',activo:prov?.activo??true
    })
    const [guardando,setGuardando]=useState(false)
    const up=(k,v)=>setF(x=>({...x,[k]:v}))
    const handleGuardar=async()=>{
      if(!f.nombreComercial.trim()) return
      setGuardando(true)
      await guardar(f)
      setGuardando(false)
    }
    return (
      <div style={{background:'#fff',border:'2px solid var(--eco-primary,#1a3a5c)',borderRadius:8,padding:'16px 20px',marginBottom:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <span style={{fontSize:14,fontWeight:600,color:'var(--eco-primary,#1a3a5c)'}}>{prov?'Editar proveedor':'Nuevo proveedor'}</span>
          <button onClick={onCancel} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:'#aaa'}}>×</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
          <div>
            <label style={lblSt}>Nombre comercial *</label>
            <input style={iSt} value={f.nombreComercial} onChange={e=>up('nombreComercial',e.target.value)} autoFocus placeholder="Distribuidora ABC"/>
          </div>
          <div>
            <label style={lblSt}>Razón social</label>
            <input style={iSt} value={f.razonSocial} onChange={e=>up('razonSocial',e.target.value)}/>
          </div>
          <div>
            <label style={lblSt}>Cédula / RUC</label>
            <input style={iSt} value={f.cedula} onChange={e=>up('cedula',e.target.value)}/>
          </div>
          <div>
            <label style={lblSt}>Contacto</label>
            <input style={iSt} value={f.contacto} onChange={e=>up('contacto',e.target.value)} placeholder="Nombre persona"/>
          </div>
          <div>
            <label style={lblSt}>Teléfono empresa</label>
            <input style={iSt} value={f.telefono} onChange={e=>up('telefono',e.target.value)}/>
          </div>
          <div>
            <label style={lblSt}>Tel. contacto</label>
            <input style={iSt} value={f.telContacto} onChange={e=>up('telContacto',e.target.value)}/>
          </div>
          <div>
            <label style={lblSt}>Email</label>
            <input style={iSt} value={f.email} onChange={e=>up('email',e.target.value)} type="email"/>
          </div>
          <div>
            <label style={lblSt}>Dirección</label>
            <input style={iSt} value={f.direccion} onChange={e=>up('direccion',e.target.value)}/>
          </div>
          <div>
            <label style={lblSt}>Estado</label>
            <select style={iSt} value={f.activo?'true':'false'} onChange={e=>up('activo',e.target.value==='true')}>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <label style={lblSt}>Notas</label>
            <input style={iSt} value={f.notas} onChange={e=>up('notas',e.target.value)} placeholder="Condiciones, tiempos de entrega..."/>
          </div>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:14}}>
          <button onClick={onCancel} style={{padding:'7px 14px',border:'1px solid #d0d8d0',borderRadius:6,fontSize:12,cursor:'pointer',background:'#fff',fontFamily:'inherit'}}>Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando||!f.nombreComercial.trim()} style={{padding:'7px 18px',border:'none',borderRadius:6,fontSize:12,fontWeight:500,cursor:guardando?'not-allowed':'pointer',background:guardando?'#e0e0e0':'var(--eco-primary,#1a3a5c)',color:guardando?'#aaa':'#fff',fontFamily:'inherit'}}>
            {guardando?'Guardando...':(prov?'Guardar':'Crear proveedor')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{padding:'24px 28px',overflowY:'auto',flex:1}}>
      <SubTitle>Proveedores</SubTitle>
      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:16}}>
        <button onClick={()=>{setCreando(true);setEditando(null)}} style={{padding:'8px 16px',border:'none',borderRadius:7,fontSize:12,fontWeight:500,cursor:'pointer',background:'var(--eco-primary,#1a3a5c)',color:'#fff',fontFamily:'inherit'}}>+ Nuevo proveedor</button>
        <input style={{...iSt,width:220}} placeholder="Buscar proveedor..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}/>
        <span style={{marginLeft:'auto',fontSize:11,color:'#aaa'}}>{filtrados.length} proveedor{filtrados.length!==1?'es':''}</span>
      </div>

      {creando&&<FormProveedor prov={null} onCancel={()=>setCreando(false)}/>}

      {loading?(
        <p style={{color:'#999',fontSize:13}}>Cargando...</p>
      ):filtrados.length===0?(
        <div style={{background:'#fff',border:'1px solid #e0e8e0',borderRadius:8,padding:'30px 20px',textAlign:'center',color:'#999',fontSize:12}}>
          {proveedores.length===0?'No hay proveedores registrados.':'Sin resultados.'}
        </div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {filtrados.map(p=>(
            <div key={p.id} style={{background:'#fff',border:'1px solid #e0e8e0',borderRadius:8,padding:'12px 16px'}}>
              {editando?.id===p.id?(
                <FormProveedor prov={p} onCancel={()=>setEditando(null)}/>
              ):(
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0}}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:p.activo!==false?'#3B6D11':'#ccc',flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <span style={{fontSize:13,fontWeight:600}}>{p.nombreComercial}</span>
                      <span style={{fontSize:11,color:'#888',marginLeft:8}}>
                        {[p.contacto,p.telefono,p.email].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,flexShrink:0}}>
                    <button onClick={()=>setEditando(p)} style={{padding:'3px 10px',border:'1px solid #d0d8d0',borderRadius:5,fontSize:11,cursor:'pointer',background:'#fff',fontFamily:'inherit',color:'#555'}}>Editar</button>
                    <button onClick={()=>eliminar(p.id)} style={{padding:'3px 10px',border:'1px solid #e8d0d0',borderRadius:5,fontSize:11,cursor:'pointer',background:'#fff',fontFamily:'inherit',color:'#A32D2D'}}>×</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── OPERACIONES ──────────────────────────────────────────────────────────────
function PaginaOperaciones() {
  const [columnas, setColumnas] = useState([])
  const [roles, setRoles] = useState([])
  const [config, setConfig] = useState({ columnasOperacionesIds: [] })
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    getDocs(query(collection(db, 'pipeline_columnas'), orderBy('orden'))).then(snap => {
      setColumnas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    getDocs(collection(db, 'roles')).then(snap => {
      setRoles(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    getDoc(doc(db, 'configuracion', 'operaciones')).then(snap => {
      if (snap.exists()) {
        const data = snap.data()
        const ids = data.columnasOperacionesIds || (data.columnaOperacionesId ? [data.columnaOperacionesId] : [])
        setConfig({ ...data, columnasOperacionesIds: ids })
      }
    })
  }, [])

  const toggleColumna = (id) => {
    const ids = config.columnasOperacionesIds || []
    setConfig({ ...config, columnasOperacionesIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] })
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      await setDoc(doc(db, 'configuracion', 'operaciones'), { columnasOperacionesIds: config.columnasOperacionesIds, rolNotificacion: config.rolNotificacion || '' }, { merge: true })
      setMsg('✓ Guardado')
      setTimeout(() => setMsg(''), 2500)
    } catch (e) { setMsg('Error al guardar') }
    finally { setGuardando(false) }
  }

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
      <SubTitle>Configuración de Operaciones</SubTitle>
      <div style={{ background: '#fff', border: '1px solid #e0e8e0', borderRadius: 10, padding: '20px 24px', maxWidth: 500 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 8 }}>
            Columnas del pipeline para operaciones
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {columnas.map(c => {
              const sel = (config.columnasOperacionesIds || []).includes(c.id)
              return (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: sel ? '#E6F1FB' : '#fafafa', border: `1px solid ${sel ? '#93C5FD' : '#e8e8e8'}`, transition: 'all .1s' }}>
                  <input type="checkbox" checked={sel} onChange={() => toggleColumna(c.id)} style={{ accentColor: 'var(--eco-primary, #185FA5)', width: 14, height: 14, cursor: 'pointer' }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: sel ? 600 : 400, color: '#1a1a1a' }}>{c.nombre}</span>
                    <span style={{ fontSize: 10, color: '#aaa', marginLeft: 8 }}>orden: {c.orden}</span>
                  </div>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color || '#ccc' }} />
                </label>
              )
            })}
          </div>
          <p style={{ fontSize: 11, color: '#aaa', marginTop: 8 }}>
            Los leads que estén en cualquiera de estas columnas aparecerán en el módulo de Operaciones.
          </p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 6 }}>
            Rol que recibe notificaciones de operaciones
          </label>
          <select
            value={config.rolNotificacion || ''}
            onChange={e => setConfig({ ...config, rolNotificacion: e.target.value })}
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #d0d8d0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
          >
            <option value="">— Seleccionar rol —</option>
            {roles.map(r => (
              <option key={r.id} value={r.nombre}>{r.nombre}</option>
            ))}
          </select>
          <p style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>
            Todos los usuarios con este rol recibirán notificación cuando un lead entre a operaciones.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={guardar} disabled={guardando} style={{ padding: '8px 20px', border: 'none', borderRadius: 7, background: 'var(--eco-primary, #1a3a5c)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: guardando ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
          {msg && <span style={{ fontSize: 12, color: msg.startsWith('✓') ? '#3B6D11' : '#A32D2D', fontWeight: 500 }}>{msg}</span>}
        </div>
      </div>
    </div>
  )
}

// ─── DEV TOOLS ────────────────────────────────────────────────────────────────
function PaginaDevTools() {
  const navigate=useNavigate()
  return (
    <div style={{padding:'24px 28px',overflowY:'auto',flex:1}}>
      <SubTitle>Dev Tools</SubTitle>
      <div style={{background:'#fff8e1',border:'1px solid #ffe082',borderRadius:8,padding:'14px 18px',marginBottom:20,fontSize:13,color:'#7c5a00'}}>⚠️ Estas herramientas son para desarrollo y pruebas. Úsalas con cuidado en producción.</div>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div style={{background:'#fff',border:'1px solid #e0e8e0',borderRadius:8,padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div><div style={{fontSize:13,fontWeight:600,color:'#1a1a1a'}}>Configuración avanzada</div><div style={{fontSize:12,color:'#888',marginTop:3}}>Opciones adicionales de desarrollo y reset de datos</div></div>
          <button onClick={()=>navigate('/configuracion/devtools')} style={{background:'#f0f4f8',border:'1px solid #c5d1dc',borderRadius:7,padding:'8px 16px',fontSize:12,cursor:'pointer',fontFamily:'inherit',color:'#333'}}>Abrir Dev Tools completo →</button>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ConfiguracionPage() {
  const navigate=useNavigate()
  const [seccion,setSeccion]=useState(()=>localStorage.getItem('cfg_seccion')||'empresa')
  const cambiarSeccion=(id)=>{setSeccion(id);localStorage.setItem('cfg_seccion',id)}
  return (
    <div style={{display:'flex',height:'100%',fontFamily:'inherit',background:'#f4f6f4'}}>
      <div style={{width:180,flexShrink:0,background:'#fff',borderRight:'1px solid #d0d8d0',overflowY:'auto',padding:'10px 0'}}>
        <div style={{fontSize:9,fontWeight:700,color:'#aaa',textTransform:'uppercase',letterSpacing:'.8px',padding:'8px 14px 6px'}}>Configuración</div>
        {SECCIONES.map(s=>(
          <button key={s.id} onClick={()=>s.link?navigate(s.link):cambiarSeccion(s.id)} style={{width:'100%',textAlign:'left',padding:'9px 14px',background:seccion===s.id?'var(--eco-primary-light)':'transparent',borderLeft:`3px solid ${seccion===s.id?'var(--eco-primary)':'transparent'}`,border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:12,color:seccion===s.id?'var(--eco-primary)':'#5c6b5c',fontWeight:seccion===s.id?500:400,display:'flex',alignItems:'center',justifyContent:'space-between'}}
            onMouseEnter={e=>{if(seccion!==s.id)e.currentTarget.style.background='#f5f7f5'}}
            onMouseLeave={e=>{if(seccion!==s.id)e.currentTarget.style.background='transparent'}}>
            {s.label}
            {s.link&&<svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="#bbb" strokeWidth="1.5" style={{flexShrink:0}}><path d="M6 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3M9 1h6v6M15 1L8 8"/></svg>}
          </button>
        ))}
      </div>
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {seccion==='empresa'    && <PaginaEmpresa />}
        {seccion==='usuarios'   && <PaginaUsuarios />}
        {seccion==='roles'      && <PaginaRoles />}
        {seccion==='conexiones' && <PaginaConexiones />}
        {seccion==='plantillas' && <PaginaPlantillas />}
        {seccion==='catalogos'  && <PaginaCatalogos />}
        {seccion==='cuentas'    && <PaginaCuentas />}
        {seccion==='proveedores' && <PaginaProveedores />}
        {seccion==='operaciones' && <PaginaOperaciones />}
        {seccion==='bot'        && <PaginaBot />}
        {seccion==='devtools'   && <PaginaDevTools />}
      </div>
    </div>
  )
}