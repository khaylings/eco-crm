// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: src/modules/crm/pages/chats/TabResumenIA.jsx
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../../../firebase/config'
import { formatFecha } from './helpers'
import { GEMINI_KEY } from './constants'

export default function TabResumenIA({ chatActivo, mensajes, tipoActivo }) {
  const [resumen,   setResumen]   = useState(null)
  const [generando, setGenerando] = useState(false)
  const [error,     setError]     = useState(null)
  const [guardado,  setGuardado]  = useState(null)

  useEffect(() => {
    setResumen(null); setError(null)
    const col = tipoActivo === 'wa' ? 'conversaciones' : 'chats_internos'
    getDoc(doc(db, col, chatActivo.id)).then(snap => {
      if (snap.exists() && snap.data().resumenIA) {
        setResumen(snap.data().resumenIA)
        setGuardado(snap.data().resumenIAFecha)
      }
    })
  }, [chatActivo.id])

  const generarResumen = async () => {
    if (!GEMINI_KEY) { setError('Configurá VITE_GEMINI_API_KEY en el .env'); return }
    if (mensajes.length === 0) { setError('No hay mensajes para resumir'); return }
    setGenerando(true); setError(null)
    try {
      const transcripcion = mensajes.map(m => {
        const quien = m.fromMe ? (m.autorNombre || 'Agente') : (chatActivo.nombre || 'Cliente')
        return `[${formatFecha(m.timestamp)}] ${quien}: ${m.body || '[media]'}`
      }).join('\n')

      const prompt = `Eres un asistente de CRM. Analizá la siguiente conversación de ${tipoActivo === 'wa' ? 'WhatsApp' : 'chat interno'} y generá un resumen ejecutivo en español con este formato exacto:

**RESUMEN EJECUTIVO**
[2-3 oraciones resumiendo de qué se trató la conversación]

**PUNTOS CLAVE**
- [punto 1]
- [punto 2]
- [punto 3]

**TONO DEL CLIENTE**
[positivo / neutral / negativo / interesado / indeciso] — [1 oración explicando por qué]

**PRÓXIMOS PASOS SUGERIDOS**
- [acción 1]
- [acción 2]

**DATOS IMPORTANTES MENCIONADOS**
[precios, fechas, productos, ubicaciones u otros datos relevantes. Si no hay, escribí "Ninguno"]

CONVERSACIÓN:
${transcripcion}`

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 1024, temperature: 0.4 } }) }
      )
      if (!res.ok) { const err = await res.json(); throw new Error(err?.error?.message || `Error ${res.status}`) }
      const data  = await res.json()
      const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar el resumen.'
      setResumen(texto)
      const col   = tipoActivo === 'wa' ? 'conversaciones' : 'chats_internos'
      const fecha = new Date().toISOString()
      await updateDoc(doc(db, col, chatActivo.id), { resumenIA: texto, resumenIAFecha: fecha })
      setGuardado(fecha)
    } catch(e) { setError(e.message || 'Error al conectar con la IA') }
    finally { setGenerando(false) }
  }

  const renderTexto = (texto) => texto.split('\n').map((linea, i) => {
    if (linea.startsWith('**') && linea.endsWith('**'))
      return <div key={i} style={{ fontWeight:700, fontSize:12, color:'#185FA5', marginTop:12, marginBottom:4, textTransform:'uppercase', letterSpacing:'.5px' }}>{linea.replace(/\*\*/g,'')}</div>
    if (linea.startsWith('- '))
      return <div key={i} style={{ fontSize:13, color:'#333', paddingLeft:12, marginBottom:3, lineHeight:1.5 }}>• {linea.slice(2)}</div>
    if (linea.trim() === '') return <div key={i} style={{ height:4 }} />
    return <div key={i} style={{ fontSize:13, color:'#333', lineHeight:1.6, marginBottom:2 }}>{linea}</div>
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'12px 14px', borderBottom:'1px solid #e8edf5', background:'#fafbfd', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#1a1a1a' }}>🤖 Resumen con IA</div>
          <button onClick={generarResumen} disabled={generando}
            style={{ padding:'6px 14px', border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:generando?'not-allowed':'pointer', fontFamily:'inherit', background:generando?'#e0e0e0':'var(--eco-primary, #185FA5)', color:generando?'#aaa':'#fff' }}>
            {generando ? '⟳ Analizando...' : resumen ? '↺ Regenerar' : '✨ Generar resumen'}
          </button>
        </div>
        {guardado && <div style={{ fontSize:10, color:'#bbb' }}>Último: {new Date(guardado).toLocaleString('es-CR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>}
        <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>{mensajes.length} mensajes · Gemini AI</div>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'14px' }}>
        {error && <div style={{ padding:'10px 14px', background:'#FCEBEB', border:'0.5px solid #f09595', borderRadius:8, color:'#A32D2D', fontSize:12, marginBottom:12 }}>⚠️ {error}</div>}
        {!resumen && !generando && !error && (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'#bbb' }}>
            <div style={{ fontSize:36, marginBottom:10 }}>🤖</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:6 }}>No hay resumen todavía</div>
            <div style={{ fontSize:12, color:'#bbb' }}>Hacé clic en "Generar resumen" para analizar la conversación</div>
          </div>
        )}
        {generando && (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'#bbb' }}>
            <div style={{ fontSize:36, marginBottom:10 }}>🧠</div>
            <div style={{ fontSize:13, color:'#888' }}>Analizando {mensajes.length} mensajes...</div>
          </div>
        )}
        {resumen && !generando && (
          <div style={{ background:'#fff', border:'0.5px solid #e0e8e0', borderRadius:10, padding:'14px 16px' }}>
            {renderTexto(resumen)}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
