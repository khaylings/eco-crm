/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: PlantillaCotizacion.jsx
 * Módulo:  Configuracion
 * ============================================================
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db } from '../../../firebase/firestore'
import { storage } from '../../../firebase/config'

// ── Defaults por tipo de widget ───────────────────────────────────────────────
const WIDGET_DEFAULTS = {
  logo_principal:  { w:160, h:60,  bg:'transparent', opacity:1,   label:'Logo principal',  color:'#185FA5', fontSize:14, fontWeight:'500', borderWidth:0, borderColor:'#d0d8d0', borderRadius:4,  text:'' },
  logo_secundario: { w:120, h:50,  bg:'transparent', opacity:1,   label:'Logo secundario', color:'#0F6E56', fontSize:12, fontWeight:'400', borderWidth:0, borderColor:'#d0d8d0', borderRadius:4,  text:'' },
  isotipo:         { w:60,  h:60,  bg:'transparent', opacity:0.1, label:'Isotipo',          color:'#854F0B', fontSize:12, fontWeight:'400', borderWidth:0, borderColor:'#d0d8d0', borderRadius:50, text:'' },
  nombre_empresa:  { w:220, h:50,  bg:'transparent', opacity:1,   label:'Nombre empresa',   color:'#1a3a5c', fontSize:16, fontWeight:'500', borderWidth:0, borderColor:'#d0d8d0', borderRadius:4,  text:'Nombre de la empresa' },
  datos_empresa:   { w:200, h:80,  bg:'transparent', opacity:1,   label:'Datos empresa',    color:'#555555', fontSize:11, fontWeight:'400', borderWidth:0, borderColor:'#d0d8d0', borderRadius:4,  text:'Cédula: X-XXX-XXXXXX\nTel: +506 XXXX-XXXX\nEmail: empresa@mail.com' },
  numero_cot:      { w:200, h:36,  bg:'#f0f4f8',    opacity:1,   label:'N° cotización',    color:'#185FA5', fontSize:15, fontWeight:'500', borderWidth:0, borderColor:'#d0d8d0', borderRadius:4,  text:'COT-000001' },
  fechas:          { w:200, h:50,  bg:'transparent', opacity:1,   label:'Fechas',           color:'#555555', fontSize:11, fontWeight:'400', borderWidth:0, borderColor:'#d0d8d0', borderRadius:4,  text:'Fecha: 01/01/2026\nVence: 08/01/2026' },
  datos_cliente:   { w:220, h:80,  bg:'#f8fafc',    opacity:1,   label:'Datos cliente',    color:'#333333', fontSize:12, fontWeight:'400', borderWidth:1, borderColor:'#e0e8f0', borderRadius:6,  text:'Cliente: Nombre\nEmpresa: S.A.\nCédula: X-XXX' },
  imagen:          { w:200, h:120, bg:'#f5f5f5',    opacity:1,   label:'Imagen',           color:'#aaaaaa', fontSize:12, fontWeight:'400', borderWidth:1, borderColor:'#dddddd', borderRadius:4,  text:'' },
  separador:       { w:595, h:3,   bg:'#1a3a5c',    opacity:1,   label:'Separador',        color:'#1a3a5c', fontSize:12, fontWeight:'400', borderWidth:0, borderColor:'#d0d8d0', borderRadius:0,  text:'' },
  fondo:           { w:595, h:100, bg:'#dde8f0',    opacity:1,   label:'Bloque de fondo',  color:'#dde8f0', fontSize:12, fontWeight:'400', borderWidth:0, borderColor:'#d0d8d0', borderRadius:0,  text:'' },
  texto_libre:     { w:200, h:40,  bg:'transparent', opacity:1,   label:'Texto libre',      color:'#1a1a1a', fontSize:14, fontWeight:'400', borderWidth:0, borderColor:'#d0d8d0', borderRadius:4,  text:'Texto aquí' },
  opciones_tabs:   { w:300, h:36,  bg:'#1a3a5c',    opacity:1,   label:'Selector opciones',color:'#ffffff', fontSize:12, fontWeight:'500', borderWidth:0, borderColor:'#d0d8d0', borderRadius:6,  text:'', gap:6, marginTop:0, marginBottom:8, align:'left' },
  tabla:           { w:547, h:130, bg:'#ffffff',     opacity:1,   label:'Tabla productos',  color:'#1a3a5c', fontSize:11, fontWeight:'400', borderWidth:1, borderColor:'#e0e0e0', borderRadius:4,  text:'', marginTop:0, marginBottom:8, align:'left' },
  totales:         { w:220, h:90,  bg:'#f0f4f8',    opacity:1,   label:'Totales',          color:'#185FA5', fontSize:13, fontWeight:'500', borderWidth:1, borderColor:'#d0e0f0', borderRadius:6,  text:'', marginTop:0, marginBottom:8, align:'right', alignV:'top' },
  observaciones:   { w:307, h:80,  bg:'transparent', opacity:1,   label:'Observaciones',    color:'#555555', fontSize:11, fontWeight:'400', borderWidth:0, borderColor:'#d0d8d0', borderRadius:4,  text:'Observaciones de la cotización...', marginTop:0, marginBottom:8, align:'left' },
  terminos:        { w:547, h:80,  bg:'transparent', opacity:1,   label:'Términos',         color:'#555555', fontSize:11, fontWeight:'400', borderWidth:0, borderColor:'#d0d8d0', borderRadius:4,  text:'· Validez: 15 días\n· Pago: 60% anticipo' },
  info_cotizacion: { w:547, h:70,  bg:'transparent', opacity:1,   label:'Info cotización',  color:'#555555', fontSize:11, fontWeight:'400', borderWidth:0, borderColor:'#e0e8f0', borderRadius:6,  text:'' },
  vendedor:        { w:200, h:30,  bg:'transparent', opacity:1,   label:'Vendedor',         color:'#555555', fontSize:11, fontWeight:'400', borderWidth:0, borderColor:'#d0d8d0', borderRadius:4,  text:'Vendedor: Nombre' },
  paginacion:      { w:120, h:20,  bg:'transparent', opacity:1,   label:'Paginación',       color:'#888888', fontSize:9,  fontWeight:'400', borderWidth:0, borderColor:'#d0d8d0', borderRadius:0,  text:'Página {{pagina}} de {{totalPaginas}}' },
  telefono_empresa:{ w:140, h:20,  bg:'transparent', opacity:1,   label:'Teléfono',         color:'#888888', fontSize:9,  fontWeight:'400', borderWidth:0, borderColor:'#d0d8d0', borderRadius:0,  text:'+506 XXXX-XXXX' },
  email_empresa:   { w:160, h:20,  bg:'transparent', opacity:1,   label:'Email',            color:'#888888', fontSize:9,  fontWeight:'400', borderWidth:0, borderColor:'#d0d8d0', borderRadius:0,  text:'info@empresa.com' },
  web_empresa:     { w:160, h:20,  bg:'transparent', opacity:1,   label:'Sitio web',        color:'#888888', fontSize:9,  fontWeight:'400', borderWidth:0, borderColor:'#d0d8d0', borderRadius:0,  text:'www.empresa.com' },
}

const CONTENT_TYPES = ['opciones_tabs','tabla','observaciones','totales','terminos']

const PANEL_SECTIONS = {
  header: {
    label: 'Header',
    groups: [
      { label: 'Logos', items: [{type:'logo_principal',label:'Logo principal'},{type:'logo_secundario',label:'Logo secundario'},{type:'isotipo',label:'Isotipo'},{type:'imagen',label:'Imagen'}] },
      { label: 'Empresa', items: [{type:'nombre_empresa',label:'Nombre empresa'},{type:'datos_empresa',label:'Datos empresa'}] },
      { label: 'Cotización', items: [{type:'numero_cot',label:'N° cotización'},{type:'fechas',label:'Fechas'},{type:'datos_cliente',label:'Datos cliente'}] },
      { label: 'Diseño', items: [{type:'separador',label:'Separador'},{type:'fondo',label:'Bloque fondo'},{type:'texto_libre',label:'Texto libre'}] },
    ]
  },
  content: {
    label: 'Contenido',
    groups: [
      { label: 'Datos', items: [{type:'numero_cot',label:'N° cotización'},{type:'info_cotizacion',label:'Info cotización (cliente + fechas)'},{type:'fechas',label:'Fechas y vendedor'},{type:'datos_cliente',label:'Datos cliente'},{type:'vendedor',label:'Vendedor'}] },
      { label: 'Bloques', items: [{type:'opciones_tabs',label:'Selector opciones'},{type:'tabla',label:'Tabla productos'},{type:'observaciones',label:'Observaciones'},{type:'totales',label:'Totales'},{type:'terminos',label:'Términos'}] },
      { label: 'Diseño', items: [{type:'separador',label:'Separador'},{type:'texto_libre',label:'Texto libre'}] },
    ]
  },
  footer: {
    label: 'Footer',
    groups: [
      { label: 'Logos', items: [{type:'logo_principal',label:'Logo principal'},{type:'logo_secundario',label:'Logo secundario'},{type:'isotipo',label:'Isotipo'}] },
      { label: 'Empresa', items: [{type:'nombre_empresa',label:'Nombre empresa'},{type:'datos_empresa',label:'Datos empresa'},{type:'telefono_empresa',label:'Teléfono'},{type:'email_empresa',label:'Email'},{type:'web_empresa',label:'Sitio web'}] },
      { label: 'Paginación', items: [{type:'paginacion',label:'Página X de Y'}] },
      { label: 'Diseño', items: [{type:'separador',label:'Separador'},{type:'texto_libre',label:'Texto libre'},{type:'fondo',label:'Fondo color'}] },
    ]
  },
}

const safeColor = (c) => {
  if (!c || c === 'transparent') return '#ffffff'
  if (c.startsWith('#') && c.length === 4) return '#' + c[1]+c[1]+c[2]+c[2]+c[3]+c[3]
  return c
}

function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, cursor: 'grab' }
  return <div ref={setNodeRef} style={style} {...attributes} {...listeners}>{children}</div>
}

function WidgetContent({ w, empresa }) {
  const txt = { color:w.color, fontSize:w.fontSize, fontWeight:w.fontWeight, lineHeight:1.45, whiteSpace:'pre-wrap', padding:'4px 8px', width:'100%' }
  if (w.type==='separador') return <div style={{width:'100%',height:'100%',background:w.color}} />
  if (w.type==='fondo') return <div style={{width:'100%',height:'100%',background:w.bg||w.color}} />
  if (w.type==='logo_principal') return empresa?.logoPrincipal
    ? <img src={empresa.logoPrincipal} alt="Logo" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}} />
    : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'#e8f0fe',color:'#185FA5',fontSize:w.fontSize,fontWeight:'500'}}>LOGO</div>
  if (w.type==='logo_secundario') return empresa?.logoSecundario
    ? <img src={empresa.logoSecundario} alt="Logo2" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}} />
    : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'#EAF3DE',color:'#3B6D11',fontSize:w.fontSize,fontWeight:'500'}}>LOG2</div>
  if (w.type==='isotipo') return empresa?.isotipo
    ? <img src={empresa.isotipo} alt="Isotipo" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}} />
    : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'#FAEEDA',color:'#854F0B',borderRadius:'50%',fontSize:w.fontSize}}>ISO</div>
  if (w.type==='imagen') return w.imageUrl
    ? <img src={w.imageUrl} alt="img" style={{width:'100%',height:'100%',objectFit:w.objectFit||'cover',objectPosition:`${w.imgPosX??50}% ${w.imgPosY??50}%`,display:'block'}} />
    : <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#aaaaaa',fontSize:11,gap:4}}><div style={{fontSize:22}}>▨</div><div>Imagen</div></div>
  if (w.type==='tabla') return (
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:w.fontSize}}>
      <thead><tr style={{background:w.color,color:'#ffffff'}}>
        {['Descripción','Cant.','Precio unit.','Importe'].map(h=>(
          <th key={h} style={{padding:'5px 8px',textAlign:h==='Descripción'?'left':'right',fontSize:w.fontSize,fontWeight:500}}>{h}</th>
        ))}
      </tr></thead>
      <tbody>{[['Producto / servicio de ejemplo','1','$000.00','$000.00'],['Instalación y mano de obra','1','$000.00','$000.00']].map((row,i)=>(
        <tr key={i} style={{background:i%2===0?'#f8fafc':'#ffffff'}}>
          {row.map((cell,j)=><td key={j} style={{padding:'4px 8px',textAlign:j===0?'left':'right',borderBottom:'1px solid #f0f4f8',color:'#333333',fontSize:w.fontSize}}>{cell}</td>)}
        </tr>
      ))}</tbody>
    </table>
  )
  if (w.type==='totales') return (
    <div style={{width:'100%',padding:'8px 12px'}}>
      {[['Sin impuestos','$0,000.00'],['IVA 13%','$000.00']].map(([lbl,val])=>(
        <div key={lbl} style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:w.fontSize-1,color:'#666666'}}><span>{lbl}</span><span>{val}</span></div>
      ))}
      <div style={{display:'flex',justifyContent:'space-between',borderTop:`2px solid ${w.color}`,paddingTop:6,fontSize:w.fontSize,fontWeight:500,color:w.color}}><span>Total</span><span>$0,000.00</span></div>
    </div>
  )
  if (w.type==='opciones_tabs') return (
    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',gap:w.gap??6,padding:'0 4px'}}>
      {['Opción A','Opción B'].map((lbl,i)=>(
        <div key={i} style={{padding:`4px 14px`,fontSize:w.fontSize,fontWeight:w.fontWeight,borderRadius:w.borderRadius,background:i===0?w.bg:'transparent',color:i===0?w.color:w.bg,border:`1.5px solid ${w.bg}`,cursor:'default',userSelect:'none'}}>{lbl}</div>
      ))}
    </div>
  )
  if (w.type==='info_cotizacion') return (
    <div style={{width:'100%',display:'flex',gap:12,padding:'4px 8px',fontSize:w.fontSize,color:w.color,lineHeight:1.6}}>
      <div style={{flex:1}}>
        <div>Nombre: Juan Pérez</div>
        <div>Empresa: Distribuidora ABC S.A.</div>
        <div>Sede: Sede Central</div>
      </div>
      <div style={{flex:1,textAlign:'right'}}>
        <div>Fecha: 01/01/2026</div>
        <div>Vence: 08/01/2026</div>
        <div>Vendedor: Nombre</div>
      </div>
    </div>
  )
  if (w.type==='vendedor') return <div style={txt}>Vendedor: Nombre del vendedor</div>
  if (w.type==='telefono_empresa') return <div style={txt}>{empresa?.telefono || '+506 XXXX-XXXX'}</div>
  if (w.type==='email_empresa') return <div style={txt}>{empresa?.email || empresa?.correo || 'info@empresa.com'}</div>
  if (w.type==='web_empresa') return <div style={txt}>{empresa?.sitioWeb || 'www.empresa.com'}</div>
  if (w.type==='paginacion') return <div style={txt}>Página 1 de 1</div>
  return <div style={txt}>{w.text||''}</div>
}

function PropsPanel({ widget, onChange, onDelete, onUploadImage, onSubirCapa, onBajarCapa, section }) {
  if (!widget) return (
    <div style={{padding:16,color:'#aaaaaa',fontSize:12,textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',height:'100%'}}>
      Seleccioná un widget para editar sus propiedades
    </div>
  )
  const w = widget
  const lbl = {fontSize:10,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.5px',display:'block',marginBottom:4,marginTop:10}
  const inp = {width:'100%',padding:'5px 8px',border:'0.5px solid #d0d8d0',borderRadius:5,fontSize:11,background:'#ffffff',color:'#1a1a1a',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}
  const row = {display:'flex',gap:6,alignItems:'center'}
  const rangeRow = (label,key,min,max,step=1,suffix='') => (
    <div>
      <span style={lbl}>{label}</span>
      <div style={row}>
        <input type="range" min={min} max={max} step={step} value={w[key]||0}
          onChange={e=>onChange(key,key==='opacity'?parseFloat(e.target.value):Number(e.target.value))} style={{flex:1}} />
        <span style={{fontSize:10,color:'#888888',minWidth:32}}>{key==='opacity'?Math.round((w[key]||0)*100)+'%':(w[key]||0)+suffix}</span>
      </div>
    </div>
  )
  const isContent = CONTENT_TYPES.includes(w.type)
  const isDesign = ['separador','fondo'].includes(w.type)
  const isLogo = ['logo_principal','logo_secundario','isotipo'].includes(w.type)
  return (
    <div style={{padding:'10px 12px',overflowY:'auto',flex:1}}>
      <div style={{fontSize:12,fontWeight:600,color:'#1a1a1a',marginBottom:10,paddingBottom:8,borderBottom:'0.5px solid #eeeeee'}}>{w.label}</div>
      {!isContent && <>{rangeRow('Posición X','x',0,560)}{rangeRow('Posición Y','y',0,800)}</>}
      {rangeRow('Ancho','w',20,595)}
      {w.type==='separador'?rangeRow('Grosor','h',1,30,'px'):rangeRow('Alto','h',10,400)}
      {rangeRow('Opacidad','opacity',0.05,1,0.05)}
      {rangeRow('Radio bordes','borderRadius',0,50,'px')}
      {!isDesign && !isLogo && w.type!=='imagen' && (
        <div>
          <span style={lbl}>Fondo</span>
          <div style={row}>
            <input type="color" value={safeColor(w.bg)} onChange={e=>onChange('bg',e.target.value)} style={{width:28,height:26,padding:1,cursor:'pointer',borderRadius:4,border:'0.5px solid #d0d8d0'}} />
            <button onClick={()=>onChange('bg','transparent')} style={{flex:1,padding:'4px',border:'0.5px solid #d0d8d0',borderRadius:5,background:'transparent',cursor:'pointer',fontSize:10,color:'#666666',fontFamily:'inherit'}}>Transparente</button>
          </div>
        </div>
      )}
      {w.type==='separador' && (
        <div><span style={lbl}>Color línea</span>
          <div style={row}>
            <input type="color" value={safeColor(w.color)} onChange={e=>{onChange('color',e.target.value);onChange('bg',e.target.value)}} style={{width:28,height:26,padding:1,cursor:'pointer',borderRadius:4,border:'0.5px solid #d0d8d0'}} />
            <input value={w.color} onChange={e=>{onChange('color',e.target.value);onChange('bg',e.target.value)}} style={{...inp,flex:1}} />
          </div>
        </div>
      )}
      {w.type==='fondo' && (
        <div><span style={lbl}>Color del bloque</span>
          <div style={row}>
            <input type="color" value={safeColor(w.bg)} onChange={e=>onChange('bg',e.target.value)} style={{width:28,height:26,padding:1,cursor:'pointer',borderRadius:4,border:'0.5px solid #d0d8d0'}} />
            <input value={w.bg} onChange={e=>onChange('bg',e.target.value)} style={{...inp,flex:1}} />
          </div>
        </div>
      )}
      {w.type!=='separador' && (
        <div><span style={lbl}>Borde</span>
          <div style={row}>
            <input type="range" min={0} max={8} value={w.borderWidth||0} onChange={e=>onChange('borderWidth',Number(e.target.value))} style={{flex:1}} />
            <input type="color" value={safeColor(w.borderColor)} onChange={e=>onChange('borderColor',e.target.value)} style={{width:28,height:26,padding:1,cursor:'pointer',borderRadius:4,border:'0.5px solid #d0d8d0'}} />
          </div>
        </div>
      )}
      {w.type==='imagen' && (
        <div>
          <span style={lbl}>Imagen</span>
          <button onClick={()=>onUploadImage(w.id)} style={{width:'100%',padding:'6px',border:'0.5px dashed #d0d8d0',borderRadius:5,background:'transparent',cursor:'pointer',fontSize:11,color:'#888888',fontFamily:'inherit'}}>{w.imageUrl?'Cambiar imagen':'+ Subir imagen'}</button>
          {w.imageUrl&&(<>
            <span style={lbl}>Modo de ajuste</span>
            <div style={{display:'flex',gap:4,marginBottom:4}}>
              {[['cover','Recortar'],['contain','Contener'],['fill','Estirar']].map(([val,l2])=>(
                <button key={val} onClick={()=>onChange('objectFit',val)} style={{flex:1,padding:'4px 2px',border:`0.5px solid ${(w.objectFit||'cover')===val?'#185FA5':'#d0d8d0'}`,borderRadius:5,background:(w.objectFit||'cover')===val?'#E6F1FB':'transparent',color:(w.objectFit||'cover')===val?'#0C447C':'#666666',fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>{l2}</button>
              ))}
            </div>
            <div style={{marginTop:6,padding:'8px',background:'#f8fafc',borderRadius:6,border:'0.5px solid #e0e8f0'}}>
              <span style={{...lbl,marginTop:0}}>Encuadre X</span>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <input type="range" min={0} max={100} value={w.imgPosX??50} onChange={e=>onChange('imgPosX',Number(e.target.value))} style={{flex:1}} />
                <span style={{fontSize:10,color:'#888888',minWidth:28}}>{w.imgPosX??50}%</span>
              </div>
              <span style={{...lbl,marginTop:6}}>Encuadre Y</span>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <input type="range" min={0} max={100} value={w.imgPosY??50} onChange={e=>onChange('imgPosY',Number(e.target.value))} style={{flex:1}} />
                <span style={{fontSize:10,color:'#888888',minWidth:28}}>{w.imgPosY??50}%</span>
              </div>
            </div>
            <button onClick={()=>onChange('imageUrl','')} style={{width:'100%',padding:'4px',border:'0.5px solid #ffcccc',borderRadius:5,background:'#fff8f8',cursor:'pointer',fontSize:10,color:'#cc3333',fontFamily:'inherit',marginTop:6}}>Quitar imagen</button>
          </>)}
        </div>
      )}
      {['texto_libre','nombre_empresa','datos_empresa','numero_cot','fechas','datos_cliente','observaciones','terminos','email_empresa','telefono_empresa','web_empresa','vendedor','paginacion','info_cotizacion'].includes(w.type) && (
        <div><span style={lbl}>Texto</span>
          <textarea value={w.text||''} onChange={e=>onChange('text',e.target.value)} rows={3} style={{...inp,resize:'vertical',lineHeight:1.5}} />
          <div style={{fontSize:9,color:'#aaa',marginTop:2}}>Si está vacío, se toma automáticamente del sistema.</div>
        </div>
      )}
      {!isDesign && !isLogo && w.type!=='imagen' && (
        <div>
          <span style={lbl}>Color texto</span>
          <div style={row}>
            <input type="color" value={safeColor(w.color)} onChange={e=>onChange('color',e.target.value)} style={{width:28,height:26,padding:1,cursor:'pointer',borderRadius:4,border:'0.5px solid #d0d8d0'}} />
            <input value={w.color} onChange={e=>onChange('color',e.target.value)} style={{...inp,flex:1}} />
          </div>
          {rangeRow('Tamaño fuente','fontSize',8,48,'px')}
          <span style={lbl}>Peso</span>
          <div style={row}>
            {[['400','Normal'],['500','Negrita']].map(([val,l2])=>(
              <button key={val} onClick={()=>onChange('fontWeight',val)} style={{flex:1,padding:'4px',border:`0.5px solid ${w.fontWeight===val?'#185FA5':'#d0d8d0'}`,borderRadius:5,background:w.fontWeight===val?'#E6F1FB':'transparent',color:w.fontWeight===val?'#0C447C':'#666666',fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:val}}>{l2}</button>
            ))}
          </div>
        </div>
      )}
      {w.type==='opciones_tabs' && (
        <div>
          <span style={lbl}>Color activo</span>
          <div style={row}>
            <input type="color" value={safeColor(w.bg)} onChange={e=>onChange('bg',e.target.value)} style={{width:28,height:26,padding:1,cursor:'pointer',borderRadius:4,border:'0.5px solid #d0d8d0'}} />
            <input value={w.bg} onChange={e=>onChange('bg',e.target.value)} style={{...inp,flex:1}} />
          </div>
          <span style={lbl}>Color texto activo</span>
          <div style={row}><input type="color" value={safeColor(w.color)} onChange={e=>onChange('color',e.target.value)} style={{width:28,height:26,padding:1,cursor:'pointer',borderRadius:4,border:'0.5px solid #d0d8d0'}} /></div>
          {rangeRow('Tamaño fuente','fontSize',8,18)}
          <span style={lbl}>Espaciado entre botones</span>
          <div style={row}>
            <input type="range" min={0} max={40} value={w.gap??6} onChange={e=>onChange('gap',Number(e.target.value))} style={{flex:1}} />
            <span style={{fontSize:10,color:'#888888',minWidth:28}}>{w.gap??6}px</span>
          </div>
        </div>
      )}
      {['tabla','totales'].includes(w.type) && (
        <div>
          <span style={lbl}>Color encabezado</span>
          <div style={row}>
            <input type="color" value={safeColor(w.color)} onChange={e=>onChange('color',e.target.value)} style={{width:28,height:26,padding:1,cursor:'pointer',borderRadius:4,border:'0.5px solid #d0d8d0'}} />
            <input value={w.color} onChange={e=>onChange('color',e.target.value)} style={{...inp,flex:1}} />
          </div>
          {rangeRow('Tamaño fuente','fontSize',8,16)}
        </div>
      )}
      {isContent && (
        <div style={{marginTop:14}}>
          <span style={{fontSize:10,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.5px',display:'block',marginBottom:6}}>Layout</span>
          <span style={lbl}>Margen superior</span>
          <div style={row}><input type="range" min={0} max={60} value={w.marginTop??0} onChange={e=>onChange('marginTop',Number(e.target.value))} style={{flex:1}} /><span style={{fontSize:10,color:'#888888',minWidth:28}}>{w.marginTop??0}px</span></div>
          <span style={lbl}>Margen inferior</span>
          <div style={row}><input type="range" min={0} max={60} value={w.marginBottom??8} onChange={e=>onChange('marginBottom',Number(e.target.value))} style={{flex:1}} /><span style={{fontSize:10,color:'#888888',minWidth:28}}>{w.marginBottom??8}px</span></div>
          <span style={lbl}>Alineación horizontal</span>
          <div style={{display:'flex',gap:4,marginBottom:4}}>
            {[['left','◀'],['center','▪'],['right','▶']].map(([val,l2])=>(
              <button key={val} onClick={()=>onChange('align',val)} style={{flex:1,padding:'4px 2px',border:`0.5px solid ${(w.align||'left')===val?'#185FA5':'#d0d8d0'}`,borderRadius:5,background:(w.align||'left')===val?'#E6F1FB':'#ffffff',color:(w.align||'left')===val?'#0C447C':'#666666',fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>{l2}</button>
            ))}
          </div>
          <span style={lbl}>Alineación vertical</span>
          <div style={{display:'flex',gap:4}}>
            {[['top','▲ Arr'],['middle','▪ Med'],['bottom','▼ Abj']].map(([val,l2])=>(
              <button key={val} onClick={()=>onChange('alignV',val)} style={{flex:1,padding:'4px 2px',border:`0.5px solid ${(w.alignV||'top')===val?'#185FA5':'#d0d8d0'}`,borderRadius:5,background:(w.alignV||'top')===val?'#E6F1FB':'#ffffff',color:(w.alignV||'top')===val?'#0C447C':'#666666',fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>{l2}</button>
            ))}
          </div>
        </div>
      )}
      {!isContent && (
        <div style={{marginTop:14}}>
          <span style={{fontSize:10,fontWeight:600,color:'#5c6b5c',textTransform:'uppercase',letterSpacing:'.5px',display:'block',marginBottom:6}}>Orden / Capa</span>
          <div style={{display:'flex',gap:6}}>
            <button onClick={onSubirCapa} style={{flex:1,padding:'5px',border:'0.5px solid #d0d8d0',borderRadius:5,background:'#ffffff',cursor:'pointer',fontSize:11,color:'#555555',fontFamily:'inherit'}}>↑ Adelante</button>
            <button onClick={onBajarCapa} style={{flex:1,padding:'5px',border:'0.5px solid #d0d8d0',borderRadius:5,background:'#ffffff',cursor:'pointer',fontSize:11,color:'#555555',fontFamily:'inherit'}}>↓ Atrás</button>
          </div>
        </div>
      )}
      <button onClick={onDelete} style={{width:'100%',marginTop:10,padding:'6px',border:'0.5px solid #fca5a5',borderRadius:5,background:'#fff8f8',cursor:'pointer',fontSize:11,color:'#A32D2D',fontFamily:'inherit'}}>
        {isContent ? 'Quitar bloque' : 'Eliminar widget'}
      </button>
    </div>
  )
}

// ── Tab: Plantillas de texto (observaciones) ──────────────────────────────────
function TabPlantillasTexto({ docPath }) {
  const [plantillas, setPlantillas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  // Form nueva plantilla
  const [formNombre, setFormNombre] = useState('')
  const [formTexto, setFormTexto] = useState('')
  const [editId, setEditId] = useState(null) // null = nueva, string = editar

  const inp = { width:'100%', padding:'7px 10px', border:'0.5px solid #d0d8d0', borderRadius:6, fontSize:12, background:'#ffffff', color:'#1a1a1a', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }
  const lbl = { fontSize:10, fontWeight:600, color:'#5c6b5c', textTransform:'uppercase', letterSpacing:'.5px', display:'block', marginBottom:4 }

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setCargando(true)
    try {
      const snap = await getDoc(doc(db, 'configuracion', docPath))
      if (snap.exists()) {
        setPlantillas(snap.data().plantillasObservaciones || [])
      }
    } catch(e) { console.error(e) }
    finally { setCargando(false) }
  }

  const guardar = async (nuevas) => {
    setGuardando(true)
    try {
      await setDoc(doc(db, 'configuracion', docPath), { plantillasObservaciones: nuevas }, { merge: true })
      setPlantillas(nuevas)
      setMsg('✓ Guardado')
      setTimeout(() => setMsg(''), 2000)
    } catch(e) { setMsg('Error al guardar') }
    finally { setGuardando(false) }
  }

  const limpiarForm = () => { setFormNombre(''); setFormTexto(''); setEditId(null) }

  const iniciarEdicion = (p) => {
    setEditId(p.id)
    setFormNombre(p.nombre)
    setFormTexto(p.texto)
  }

  const guardarPlantilla = async () => {
    if (!formNombre.trim() || !formTexto.trim()) return
    let nuevas
    if (editId) {
      nuevas = plantillas.map(p => p.id === editId ? { ...p, nombre: formNombre.trim(), texto: formTexto.trim() } : p)
    } else {
      const id = 'plt_' + Date.now()
      nuevas = [...plantillas, { id, nombre: formNombre.trim(), texto: formTexto.trim() }]
    }
    await guardar(nuevas)
    limpiarForm()
  }

  const eliminarPlantilla = async (id) => {
    if (!window.confirm('¿Eliminar esta plantilla?')) return
    await guardar(plantillas.filter(p => p.id !== id))
    if (editId === id) limpiarForm()
  }

  if (cargando) return <div style={{padding:40,textAlign:'center',color:'#aaa',fontSize:13}}>Cargando...</div>

  return (
    <div style={{ display:'flex', gap:24, padding:24, background:'#f4f6f4', flex:1, overflowY:'auto' }}>
      {/* Panel izquierdo: lista de plantillas */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:14 }}>
          Plantillas de observaciones
          <span style={{ marginLeft:8, fontSize:11, fontWeight:400, color:'#999' }}>
            {plantillas.length} plantilla{plantillas.length !== 1 ? 's' : ''}
          </span>
        </div>

        {plantillas.length === 0 && (
          <div style={{ background:'#fff', border:'0.5px solid #d0d8d0', borderRadius:10, padding:'32px 20px', textAlign:'center', color:'#aaa', fontSize:12 }}>
            <div style={{ fontSize:28, marginBottom:8, opacity:0.4 }}>📝</div>
            No hay plantillas creadas aún.<br />
            Usá el formulario de la derecha para agregar la primera.
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {plantillas.map(p => (
            <div key={p.id} style={{
              background: editId === p.id ? '#EAF3DE' : '#fff',
              border: `0.5px solid ${editId === p.id ? '#8BC34A' : '#d0d8d0'}`,
              borderRadius:10, padding:'12px 16px',
              cursor:'pointer',
              transition:'all .15s',
            }}
              onClick={() => iniciarEdicion(p)}
            >
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontWeight:600, fontSize:13, color: editId === p.id ? '#2e7d32' : '#1a1a1a' }}>
                  {editId === p.id ? '✎ ' : ''}{p.nombre}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); eliminarPlantilla(p.id) }}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'#ccc', fontSize:16, lineHeight:1, padding:'2px 4px', borderRadius:4 }}
                  onMouseEnter={e => e.currentTarget.style.color='#A32D2D'}
                  onMouseLeave={e => e.currentTarget.style.color='#ccc'}
                  title="Eliminar plantilla"
                >×</button>
              </div>
              <div style={{ fontSize:11, color:'#888', lineHeight:1.5, whiteSpace:'pre-wrap', maxHeight:60, overflow:'hidden', textOverflow:'ellipsis' }}>
                {p.texto}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel derecho: formulario */}
      <div style={{ width:340, flexShrink:0 }}>
        <div style={{ background:'#fff', border:'0.5px solid #d0d8d0', borderRadius:12, padding:20, position:'sticky', top:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            {editId ? 'Editar plantilla' : 'Nueva plantilla'}
            {editId && (
              <button onClick={limpiarForm} style={{ fontSize:11, color:'#888', background:'none', border:'none', cursor:'pointer', padding:'2px 8px', borderRadius:5 }}>
                + Nueva
              </button>
            )}
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Nombre de la plantilla</label>
            <input
              style={inp}
              placeholder="Ej: Condiciones estándar, Garantía 1 año..."
              value={formNombre}
              onChange={e => setFormNombre(e.target.value)}
            />
          </div>

          <div style={{ marginBottom:16 }}>
            <label style={lbl}>Texto de la observación</label>
            <textarea
              style={{ ...inp, resize:'vertical', minHeight:140, lineHeight:1.6 }}
              placeholder="Escribí el texto que se cargará en el campo de observaciones de la cotización. Es editable antes de guardar."
              value={formTexto}
              onChange={e => setFormTexto(e.target.value)}
            />
            <div style={{ fontSize:10, color:'#aaa', marginTop:4 }}>
              El texto se puede editar libremente en cada cotización después de insertarlo.
            </div>
          </div>

          <div style={{ display:'flex', gap:8 }}>
            {editId && (
              <button onClick={limpiarForm} style={{ flex:1, padding:'8px', border:'0.5px solid #d0d8d0', borderRadius:7, fontSize:12, cursor:'pointer', background:'#f5f5f5', color:'#555', fontFamily:'inherit' }}>
                Cancelar
              </button>
            )}
            <button
              onClick={guardarPlantilla}
              disabled={!formNombre.trim() || !formTexto.trim() || guardando}
              style={{ flex:2, padding:'8px 16px', border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor: (!formNombre.trim() || !formTexto.trim()) ? 'not-allowed' : 'pointer', background: (!formNombre.trim() || !formTexto.trim()) ? '#e0e0e0' : '#1a3a5c', color: (!formNombre.trim() || !formTexto.trim()) ? '#aaa' : '#fff', fontFamily:'inherit' }}
            >
              {guardando ? 'Guardando...' : editId ? '✓ Guardar cambios' : '+ Crear plantilla'}
            </button>
          </div>

          {msg && (
            <div style={{ marginTop:10, padding:'6px 10px', borderRadius:6, background: msg.startsWith('✓') ? '#EAF3DE' : '#FCEBEB', color: msg.startsWith('✓') ? '#2e7d32' : '#A32D2D', fontSize:12, textAlign:'center' }}>
              {msg}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PlantillaCotizacion() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const plantillaId = searchParams.get('id') || 'clasica'

  // Tab principal: 'disenio' | 'portadas' | 'textos' | 'plantillas_obs'
  const [mainTab, setMainTab] = useState('disenio')

  const [seccion, setSeccion] = useState('header')
  const [headerWidgets, setHeaderWidgets] = useState([])
  const [contentWidgets, setContentWidgets] = useState([])
  const [footerWidgets, setFooterWidgets] = useState([])
  const [headerH, setHeaderH] = useState(110)
  const [footerH, setFooterH] = useState(40)

  const [selectedId, setSelectedId] = useState(null)
  const [zoom, setZoom] = useState(0.72)
  const [gridOn, setGridOn] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [empresa, setEmpresa] = useState(null)
  const [draggingType, setDraggingType] = useState(null)
  const [todasPlantillas, setTodasPlantillas] = useState([])
  const [hayCambios, setHayCambios] = useState(false)

  const hojaRef = useRef()
  const imgInputRef = useRef()
  const imgTargetId = useRef(null)
  const selectedIdRef = useRef(null)
  const idCounter = useRef(100)

  const widgets = seccion==='header' ? headerWidgets : seccion==='footer' ? footerWidgets : contentWidgets
  const setWidgets = seccion==='header' ? setHeaderWidgets : seccion==='footer' ? setFooterWidgets : setContentWidgets

  useEffect(() => { cargar() }, [plantillaId])
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setContentWidgets(prev => {
      const oldIdx = prev.findIndex(w => w.id === active.id)
      const newIdx = prev.findIndex(w => w.id === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
    setHayCambios(true)
  }, [])

  const cargar = async () => {
    setSelectedId(null)
    setHayCambios(false)
    try {
      const [empSnap, pltSnap] = await Promise.all([
        getDoc(doc(db,'configuracion','empresa')),
        getDoc(doc(db,'configuracion','plantilla_cotizacion')),
      ])
      if (empSnap.exists()) setEmpresa(empSnap.data())
      if (pltSnap.exists()) {
        const d = pltSnap.data()
        const predefs = [{id:'clasica',nombre:'Clásica'},{id:'moderna',nombre:'Moderna'},{id:'ejecutiva',nombre:'Ejecutiva'}]
        const personalizadas = d.plantillasPersonalizadas||[]
        const tieneEco = personalizadas.some(p=>p.id==='eco')
        const todas = [...predefs,...(tieneEco?personalizadas:[{id:'eco',nombre:'Eco Ingeniería'},...personalizadas])]
        setTodasPlantillas(todas)
        let cfg = null
        if (plantillaId.startsWith('custom_')) {
          cfg = (personalizadas.find(p=>p.id===plantillaId))
        } else {
          cfg = d.plantillasConfig?.[plantillaId]
        }
        if (cfg) {
          if (cfg.headerWidgets) {
            setHeaderWidgets(cfg.headerWidgets||[])
            setContentWidgets(cfg.contentWidgets||[])
            setFooterWidgets(cfg.footerWidgets||[])
            setHeaderH(cfg.headerH||110)
            setFooterH(cfg.footerH||40)
            idCounter.current = Math.max(100,...[...(cfg.headerWidgets||[]),...(cfg.contentWidgets||[]),...(cfg.footerWidgets||[])].map(w=>w.id||0))+1
          } else if (cfg.widgets) {
            const hw = cfg.widgets.filter(w => !CONTENT_TYPES.includes(w.type) && w.y < 200)
            const fw = cfg.widgets.filter(w => !CONTENT_TYPES.includes(w.type) && w.y >= 550)
            const cwRaw = cfg.widgets.filter(w => CONTENT_TYPES.includes(w.type))
            const ORDER = ['opciones_tabs','tabla','observaciones','totales','terminos']
            const cw = cwRaw.length>0 ? [...cwRaw].sort((a,b)=>ORDER.indexOf(a.type)-ORDER.indexOf(b.type)) : getDefaultContent()
            setHeaderWidgets(hw)
            setContentWidgets(cw)
            setFooterWidgets(fw)
            idCounter.current = Math.max(100,...cfg.widgets.map(w=>w.id||0))+1
          }
        } else {
          setHeaderWidgets([])
          setContentWidgets(getDefaultContent())
          setFooterWidgets([])
        }
      }
      setHayCambios(false)
    } catch(e) { console.error(e) }
  }

  const getDefaultContent = () => {
    const W = (id,type,extras={}) => ({id,type,x:0,y:0,...WIDGET_DEFAULTS[type],...extras})
    return [W(50,'opciones_tabs'),W(51,'tabla'),W(52,'observaciones'),W(53,'totales'),W(54,'terminos')]
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      const cfg = { headerWidgets, contentWidgets, footerWidgets, headerH, footerH }
      if (plantillaId.startsWith('custom_')) {
        const snap = await getDoc(doc(db,'configuracion','plantilla_cotizacion'))
        const d = snap.exists()?snap.data():{}
        const lista = d.plantillasPersonalizadas||[]
        const idx = lista.findIndex(p=>p.id===plantillaId)
        const updated = {...(lista[idx]||{}),id:plantillaId,...cfg}
        const nuevas = idx>=0?lista.map((p,i)=>i===idx?updated:p):[...lista,updated]
        await setDoc(doc(db,'configuracion','plantilla_cotizacion'),{plantillasPersonalizadas:nuevas},{merge:true})
      } else {
        await setDoc(doc(db,'configuracion','plantilla_cotizacion'),{plantillasConfig:{[plantillaId]:cfg}},{merge:true})
      }
      setMsg('✓ Guardado')
      setHayCambios(false)
      setTimeout(()=>setMsg(''),2500)
    } catch(e) { setMsg('Error al guardar') }
    finally { setGuardando(false) }
  }

  const addWidget = useCallback((type, x=20, y=20) => {
    const def = WIDGET_DEFAULTS[type]; if (!def) return
    const id = ++idCounter.current
    const w = {id,type,x:Math.round(x),y:Math.round(y),...JSON.parse(JSON.stringify(def))}
    setWidgets(prev=>[...prev,w]); setSelectedId(id); setHayCambios(true)
  },[seccion])

  const updateWidget = useCallback((id,key,val) => {
    setWidgets(prev=>prev.map(w=>w.id===id?{...w,[key]:val}:w)); setHayCambios(true)
  },[seccion])

  const deleteWidget = useCallback(()=>{
    setWidgets(prev=>prev.filter(w=>w.id!==selectedIdRef.current)); setSelectedId(null); setHayCambios(true)
  },[seccion])

  const subirCapa = useCallback(()=>{
    const sid=selectedIdRef.current; if(!sid) return
    setWidgets(prev=>{ const i=prev.findIndex(w=>w.id===sid); if(i>=prev.length-1) return prev; const a=[...prev];[a[i],a[i+1]]=[a[i+1],a[i]];return a }); setHayCambios(true)
  },[seccion])

  const bajarCapa = useCallback(()=>{
    const sid=selectedIdRef.current; if(!sid) return
    setWidgets(prev=>{ const i=prev.findIndex(w=>w.id===sid); if(i<=0) return prev; const a=[...prev];[a[i-1],a[i]]=[a[i],a[i-1]];return a }); setHayCambios(true)
  },[seccion])

  const selectedWidget = widgets.find(w=>w.id===selectedId)||null

  const onDrop = e => {
    e.preventDefault()
    if (!draggingType||!hojaRef.current) return
    const rect = hojaRef.current.getBoundingClientRect()
    addWidget(draggingType,(e.clientX-rect.left)/zoom,(e.clientY-rect.top)/zoom)
    setDraggingType(null)
  }

  const onWidgetMouseDown = (e,id) => {
    if (e.target.dataset.resize) return
    e.preventDefault(); e.stopPropagation(); setSelectedId(id)
    if (CONTENT_TYPES.includes(widgets.find(x=>x.id===id)?.type)) return
    const w=widgets.find(x=>x.id===id); if(!w) return
    const sx=e.clientX,sy=e.clientY,ox=w.x,oy=w.y
    const onMove=e=>setWidgets(prev=>prev.map(pw=>pw.id===id?{...pw,x:Math.max(0,ox+(e.clientX-sx)/zoom),y:Math.max(0,oy+(e.clientY-sy)/zoom)}:pw))
    const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp)}
    document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp)
  }

  const onResizeMouseDown = (e,id) => {
    e.preventDefault(); e.stopPropagation()
    const w=widgets.find(x=>x.id===id); if(!w) return
    const sx=e.clientX,sy=e.clientY,sw=w.w,sh=w.h
    const onMove=e=>setWidgets(prev=>prev.map(pw=>pw.id===id?{...pw,w:Math.max(20,sw+(e.clientX-sx)/zoom),h:Math.max(6,sh+(e.clientY-sy)/zoom)}:pw))
    const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp)}
    document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp)
  }

  const onUploadImage = wid => { imgTargetId.current=wid; imgInputRef.current.click() }
  const handleImageFile = async e => {
    const file=e.target.files[0]; if(!file||!imgTargetId.current) return
    try {
      const r=ref(storage,`plantillas/imagenes/${imgTargetId.current}_${Date.now()}`)
      await uploadBytes(r,file)
      updateWidget(imgTargetId.current,'imageUrl',await getDownloadURL(r))
    } catch(err){console.error(err)}
    e.target.value=''
  }

  const NOMBRES = {clasica:'Clásica',moderna:'Moderna',ejecutiva:'Ejecutiva',eco:'Eco Ingeniería'}
  const panelSection = PANEL_SECTIONS[seccion]

  const MAIN_TABS = [
    { id:'disenio', label:'Diseño' },
    { id:'plantillas_obs', label:'✦ Plantillas de texto' },
  ]

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',fontFamily:'inherit',background:'#f4f6f4'}}>
      {/* TOPBAR */}
      <div style={{background:'#ffffff',borderBottom:'0.5px solid #d0d8d0',padding:'7px 14px',display:'flex',alignItems:'center',gap:8,flexShrink:0,flexWrap:'wrap'}}>
        {/* Tabs principales */}
        <div style={{display:'flex',gap:0,border:'0.5px solid #d0d8d0',borderRadius:6,overflow:'hidden'}}>
          {MAIN_TABS.map(t => (
            <button key={t.id} onClick={()=>setMainTab(t.id)}
              style={{padding:'4px 14px',fontSize:11,cursor:'pointer',border:'none',borderRight:'0.5px solid #d0d8d0',background:mainTab===t.id?'#1a3a5c':'#ffffff',color:mainTab===t.id?'#ffffff':'#666666',fontFamily:'inherit',fontWeight:mainTab===t.id?500:400}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Solo mostrar controles de diseño cuando estamos en tab Diseño */}
        {mainTab === 'disenio' && (<>
          <span style={{fontSize:12,fontWeight:500,color:'#1a1a1a',marginLeft:8}}>Plantilla:</span>
          <select value={plantillaId}
            onChange={e=>{if(hayCambios&&!window.confirm('¿Cambiar sin guardar?'))return;navigate('/configuracion/plantilla-cotizacion?id='+e.target.value)}}
            style={{fontSize:12,border:'0.5px solid #d0d8d0',borderRadius:5,padding:'3px 8px',background:'#ffffff',color:'#1a1a1a',fontFamily:'inherit',cursor:'pointer',outline:'none'}}>
            {todasPlantillas.length>0?todasPlantillas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>):<option value={plantillaId}>{NOMBRES[plantillaId]||'Personalizada'}</option>}
          </select>

          <div style={{display:'flex',gap:0,border:'0.5px solid #d0d8d0',borderRadius:6,overflow:'hidden',marginLeft:4}}>
            {[['header','↑ Header'],['content','≡ Contenido'],['footer','↓ Footer']].map(([s,l])=>(
              <button key={s} onClick={()=>{setSelectedId(null);setSeccion(s)}}
                style={{padding:'4px 12px',fontSize:11,cursor:'pointer',border:'none',borderRight:'0.5px solid #d0d8d0',background:seccion===s?'#1a3a5c':'#ffffff',color:seccion===s?'#ffffff':'#666666',fontFamily:'inherit',fontWeight:seccion===s?500:400}}>
                {l}
              </button>
            ))}
          </div>

          {seccion==='header' && (
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#666666'}}>
              <span>Alto header:</span>
              <input type="range" min={60} max={300} value={headerH} onChange={e=>{setHeaderH(Number(e.target.value));setHayCambios(true)}} style={{width:80}} />
              <span style={{minWidth:28}}>{headerH}px</span>
            </div>
          )}
          {seccion==='footer' && (
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#666666'}}>
              <span>Alto footer:</span>
              <input type="range" min={24} max={120} value={footerH} onChange={e=>{setFooterH(Number(e.target.value));setHayCambios(true)}} style={{width:80}} />
              <span style={{minWidth:28}}>{footerH}px</span>
            </div>
          )}

          <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
            {msg&&<span style={{fontSize:11,color:msg.startsWith('✓')?'#3B6D11':'#cc3333'}}>{msg}</span>}
            <button onClick={guardar} disabled={guardando}
              style={{fontSize:11,padding:'5px 16px',borderRadius:6,border:'none',background:'#1a3a5c',color:'#ffffff',cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>
              {guardando?'Guardando...':'Guardar plantilla'}
            </button>
          </div>
        </>)}

        {mainTab === 'plantillas_obs' && (
          <span style={{fontSize:12,color:'#888',marginLeft:4}}>
            Textos predefinidos para el campo Observaciones de cotizaciones
          </span>
        )}
      </div>

      {/* CONTENIDO SEGÚN TAB */}
      {mainTab === 'plantillas_obs' ? (
        <TabPlantillasTexto docPath="plantilla_cotizacion" />
      ) : (
        <div style={{display:'flex',flex:1,overflow:'hidden',minHeight:0}}>
          {/* Panel izquierdo */}
          <div style={{width:175,flexShrink:0,background:'#ffffff',borderRight:'0.5px solid #d0d8d0',overflowY:'auto'}}>
            {panelSection.groups.map(group=>(
              <div key={group.label}>
                <div style={{fontSize:9,fontWeight:600,color:'#888888',textTransform:'uppercase',letterSpacing:'.5px',padding:'7px 10px 4px',background:'#f9fbf9',borderBottom:'0.5px solid #eeeeee',borderTop:'0.5px solid #eeeeee'}}>{group.label}</div>
                <div style={{padding:'3px 6px'}}>
                  {group.items.map(item=>(
                    <div key={item.type} draggable onDragStart={()=>setDraggingType(item.type)}
                      onClick={()=>addWidget(item.type,20,20)}
                      style={{padding:'6px 8px',margin:'2px',border:'0.5px solid #d0d8d0',borderRadius:5,cursor:'grab',fontSize:11,color:'#1a1a1a',background:'#ffffff',display:'flex',alignItems:'center',gap:6,userSelect:'none'}}
                      onMouseEnter={e=>e.currentTarget.style.background='#f0f4f8'}
                      onMouseLeave={e=>e.currentTarget.style.background='#ffffff'}>
                      <span style={{color:'#cccccc',fontSize:11}}>⠿</span>{item.label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Centro — hoja */}
          <div style={{flex:1,background:'#e0e0dc',overflowY:'auto',display:'flex',flexDirection:'column',alignItems:'center',padding:'14px 14px 24px'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,background:'#ffffff',borderRadius:6,padding:'4px 10px',border:'0.5px solid #d0d8d0'}}>
              <button onClick={()=>setZoom(z=>Math.max(0.3,+(z-0.1).toFixed(1)))} style={{width:24,height:24,borderRadius:4,border:'0.5px solid #d0d8d0',background:'#ffffff',cursor:'pointer',fontSize:14,color:'#555555'}}>-</button>
              <span style={{fontSize:11,color:'#666666',minWidth:36,textAlign:'center'}}>{Math.round(zoom*100)}%</span>
              <button onClick={()=>setZoom(z=>Math.min(1.5,+(z+0.1).toFixed(1)))} style={{width:24,height:24,borderRadius:4,border:'0.5px solid #d0d8d0',background:'#ffffff',cursor:'pointer',fontSize:14,color:'#555555'}}>+</button>
              <div style={{width:1,height:16,background:'#dddddd'}} />
              <button onClick={()=>setGridOn(g=>!g)} style={{padding:'2px 8px',borderRadius:4,border:`0.5px solid ${gridOn?'#185FA5':'#d0d8d0'}`,background:gridOn?'#E6F1FB':'#ffffff',cursor:'pointer',fontSize:11,color:gridOn?'#185FA5':'#666666'}}>Grilla</button>
              {selectedId && seccion!=='content' && <>
                <button onClick={bajarCapa} style={{padding:'2px 8px',borderRadius:4,border:'0.5px solid #d0d8d0',background:'#ffffff',cursor:'pointer',fontSize:11,color:'#555555'}}>↓ Atrás</button>
                <button onClick={subirCapa} style={{padding:'2px 8px',borderRadius:4,border:'0.5px solid #d0d8d0',background:'#ffffff',cursor:'pointer',fontSize:11,color:'#555555'}}>↑ Adelante</button>
              </>}
              {widgets.length>0 && <button onClick={()=>{if(window.confirm('¿Limpiar sección?')){setWidgets([]);setSelectedId(null)}}} style={{padding:'2px 8px',borderRadius:4,border:'0.5px solid #fca5a5',background:'#fff8f8',cursor:'pointer',fontSize:11,color:'#A32D2D'}}>Limpiar</button>}
            </div>

            <div style={{transformOrigin:'top center',transform:`scale(${zoom})`,marginBottom:`${(842*(zoom-1))+24}px`}}>
              <div style={{width:595,minHeight:842,background:'#ffffff',boxShadow:'0 2px 20px rgba(0,0,0,.15)',fontFamily:'Inter,sans-serif',display:'flex',flexDirection:'column'}}>

                {/* HEADER */}
                <div ref={seccion==='header'?hojaRef:null}
                  style={{position:'relative',width:595,height:headerH,background:'#ffffff',outline:seccion==='header'?'2px solid #185FA5':'none',outlineOffset:-2,cursor:'default',overflow:'hidden'}}
                  onDragOver={seccion==='header'?e=>e.preventDefault():undefined}
                  onDrop={seccion==='header'?onDrop:undefined}
                  onMouseDown={seccion==='header'?(e=>{if(e.currentTarget===e.target)setSelectedId(null)}):undefined}>
                  {seccion==='header' && gridOn && <div style={{position:'absolute',inset:0,pointerEvents:'none',backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 19px,rgba(0,0,0,.05) 20px),repeating-linear-gradient(90deg,transparent,transparent 19px,rgba(0,0,0,.05) 20px)'}} />}
                  {seccion==='header' && headerWidgets.length===0 && <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none',color:'#cccccc',fontSize:12}}>← Arrastrá widgets al header</div>}
                  {headerWidgets.map((w,zi)=>(
                    <div key={w.id} style={{position:'absolute',left:w.x,top:w.y,width:w.w,height:w.h,opacity:w.opacity,outline:selectedId===w.id&&seccion==='header'?'2px solid #185FA5':'none',outlineOffset:1,cursor:seccion==='header'?'move':'default',userSelect:'none',zIndex:zi+1,isolation:'isolate'}}>
                      <div onMouseDown={seccion==='header'?(e=>onWidgetMouseDown(e,w.id)):undefined}
                        style={{width:'100%',height:'100%',background:w.type==='imagen'?'transparent':w.bg,borderRadius:w.borderRadius,border:w.borderWidth?`${w.borderWidth}px solid ${w.borderColor}`:'none',overflow:w.type==='imagen'?'hidden':'visible',display:'flex',alignItems:['tabla','totales'].includes(w.type)?'flex-start':'center',boxSizing:'border-box'}}>
                        <WidgetContent w={w} empresa={empresa} />
                      </div>
                      {selectedId===w.id && seccion==='header' && <div data-resize="1" onMouseDown={e=>onResizeMouseDown(e,w.id)} style={{position:'absolute',right:-4,bottom:-4,width:10,height:10,background:'#185FA5',borderRadius:2,cursor:'se-resize',zIndex:10}} />}
                    </div>
                  ))}
                </div>

                {/* CONTENIDO */}
                <div ref={seccion==='content'?hojaRef:null}
                  onDragOver={seccion==='content'?e=>e.preventDefault():undefined}
                  onDrop={seccion==='content'?onDrop:undefined}
                  style={{width:595,padding:'12px 24px',background:'#ffffff',flex:1,outline:seccion==='content'?'2px solid #185FA5':'none',outlineOffset:-2}}>
                  {seccion==='content' && contentWidgets.length===0 && <div style={{textAlign:'center',padding:20,color:'#cccccc',fontSize:12}}>← Usá el panel izquierdo para agregar bloques</div>}
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={contentWidgets.map(w=>w.id)} strategy={verticalListSortingStrategy}>
                      {contentWidgets.map((w,i)=>{
                        const prevW = contentWidgets[i-1]
                        const totW = contentWidgets.find(x=>x.type==='totales')
                        const obsW = contentWidgets.find(x=>x.type==='observaciones')
                        if (w.type==='totales' && prevW?.type==='observaciones') return null
                        const align = w.align || 'left'
                        const alignV = w.alignV || 'top'
                        const justifyContent = align==='center'?'center':align==='right'?'flex-end':'flex-start'
                        const alignItems = alignV==='middle'?'center':alignV==='bottom'?'flex-end':'flex-start'
                        const wrapStyle = { marginTop:w.marginTop??0, marginBottom:w.marginBottom??8, display:'flex', justifyContent, alignItems, minHeight:w.h||'auto' }
                        const isSelected = selectedId===w.id || (w.type==='observaciones' && (selectedId===w.id||selectedId===totW?.id))
                        if (w.type==='observaciones') {
                          return (
                            <SortableItem key={w.id} id={w.id}>
                              <div style={{...wrapStyle,outline:isSelected?'1px dashed #185FA5':'1px dashed transparent',outlineOffset:2,borderRadius:4}}>
                                <div style={{display:'flex',gap:12,width:'100%',alignItems:'flex-start'}}>
                                  <div onClick={e=>{e.stopPropagation();setSelectedId(w.id)}}
                                    style={{flex:1,minHeight:obsW?.h||80,padding:'6px 8px',background:obsW?.bg,borderRadius:obsW?.borderRadius,border:obsW?.borderWidth?`${obsW.borderWidth}px solid ${obsW.borderColor}`:'none',outline:selectedId===w.id?'2px solid #185FA5':'none',cursor:'pointer',fontSize:obsW?.fontSize,color:obsW?.color,whiteSpace:'pre-wrap',userSelect:'none'}}>
                                    {obsW?.text||'Observaciones...'}
                                  </div>
                                  {totW && (
                                    <div onClick={e=>{e.stopPropagation();setSelectedId(totW.id)}}
                                      style={{width:totW?.w||220,flexShrink:0,minHeight:totW?.h||90,background:totW?.bg,borderRadius:totW?.borderRadius,border:totW?.borderWidth?`${totW.borderWidth}px solid ${totW.borderColor}`:'none',outline:selectedId===totW.id?'2px solid #185FA5':'none',cursor:'pointer',userSelect:'none'}}>
                                      <WidgetContent w={totW} empresa={empresa} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </SortableItem>
                          )
                        }
                        return (
                          <SortableItem key={w.id} id={w.id}>
                            <div style={{...wrapStyle,outline:selectedId===w.id?'1px dashed #185FA5':'1px dashed transparent',outlineOffset:2,borderRadius:4}}>
                              <div onClick={e=>{e.stopPropagation();setSelectedId(w.id)}}
                                style={{width:w.w||'100%',outline:selectedId===w.id?'2px solid #185FA5':'none',borderRadius:w.borderRadius,minHeight:w.h,background:w.bg,border:w.borderWidth?`${w.borderWidth}px solid ${w.borderColor}`:'none',userSelect:'none'}}>
                                <WidgetContent w={w} empresa={empresa} />
                              </div>
                            </div>
                          </SortableItem>
                        )
                      })}
                    </SortableContext>
                  </DndContext>
                </div>

                {/* FOOTER */}
                <div ref={seccion==='footer'?hojaRef:null}
                  style={{position:'relative',width:595,height:footerH,background:'#ffffff',outline:seccion==='footer'?'2px solid #185FA5':'none',outlineOffset:-2,overflow:'hidden'}}
                  onDragOver={seccion==='footer'?e=>e.preventDefault():undefined}
                  onDrop={seccion==='footer'?onDrop:undefined}
                  onMouseDown={seccion==='footer'?(e=>{if(e.currentTarget===e.target)setSelectedId(null)}):undefined}>
                  {seccion==='footer' && footerWidgets.length===0 && <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none',color:'#cccccc',fontSize:12}}>← Arrastrá widgets al footer</div>}
                  {footerWidgets.map((w,zi)=>(
                    <div key={w.id} style={{position:'absolute',left:w.x,top:w.y,width:w.w,height:w.h,opacity:w.opacity,outline:selectedId===w.id&&seccion==='footer'?'2px solid #185FA5':'none',outlineOffset:1,cursor:seccion==='footer'?'move':'default',userSelect:'none',zIndex:zi+1,isolation:'isolate'}}>
                      <div onMouseDown={seccion==='footer'?(e=>onWidgetMouseDown(e,w.id)):undefined}
                        style={{width:'100%',height:'100%',background:w.type==='imagen'?'transparent':w.bg,borderRadius:w.borderRadius,border:w.borderWidth?`${w.borderWidth}px solid ${w.borderColor}`:'none',overflow:w.type==='imagen'?'hidden':'visible',display:'flex',alignItems:'center',boxSizing:'border-box'}}>
                        <WidgetContent w={w} empresa={empresa} />
                      </div>
                      {selectedId===w.id && seccion==='footer' && <div data-resize="1" onMouseDown={e=>onResizeMouseDown(e,w.id)} style={{position:'absolute',right:-4,bottom:-4,width:10,height:10,background:'#185FA5',borderRadius:2,cursor:'se-resize',zIndex:10}} />}
                    </div>
                  ))}
                </div>

              </div>
            </div>
          </div>

          {/* Panel derecho */}
          <div style={{width:216,flexShrink:0,background:'#ffffff',borderLeft:'0.5px solid #d0d8d0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{fontSize:9,fontWeight:600,color:'#888888',textTransform:'uppercase',letterSpacing:'.5px',padding:'8px 12px',background:'#f9fbf9',borderBottom:'0.5px solid #eeeeee',flexShrink:0}}>
              Propiedades — {seccion==='header'?'Header':seccion==='footer'?'Footer':'Contenido'}
            </div>
            <PropsPanel
              widget={selectedWidget}
              section={seccion}
              onChange={(key,val)=>{if(selectedId)updateWidget(selectedId,key,val)}}
              onDelete={deleteWidget}
              onUploadImage={onUploadImage}
              onSubirCapa={subirCapa}
              onBajarCapa={bajarCapa}
            />
          </div>
        </div>
      )}

      <input ref={imgInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleImageFile} />
    </div>
  )
}