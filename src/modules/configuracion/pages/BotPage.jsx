/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: BotPage.jsx
 * Módulo:  Configuracion
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { db } from '../../../firebase/config'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const BOT_DOC = 'config/bot'

const DEFAULT_CONFIG = {
  activo: false,
  mensajeBienvenida: 'Hola 👋 Bienvenido a ECO Air Conditioning. Soy el asistente virtual, te voy a ayudar en un momento.',
  preguntaNombre: '¿Cuál es tu nombre completo?',
  preguntaServicio: '¿Qué tipo de servicio necesitás?\n\n1. Instalación de equipo\n2. Mantenimiento preventivo\n3. Reparación / diagnóstico\n4. Cotización\n5. Otro',
  preguntaUbicacion: '¿En qué provincia o zona estás ubicado?',
  preguntaUrgencia: '¿Qué tan urgente es tu solicitud?\n\n1. Urgente (hoy o mañana)\n2. Esta semana\n3. Sin prisa',
  mensajeHandoff: '¡Gracias! 🙌 Un agente te atenderá en breve. Nuestro horario es de lunes a viernes de 8am a 6pm.',
  delaySt: 60,
  delayPorCaracter: 40,
  delayMin: 1500,
  delayMax: 4000,
  horarioActivo: false,
  horarioInicio: '08:00',
  horarioFin: '18:00',
  diasActivos: ['lun', 'mar', 'mie', 'jue', 'vie'],
  mensajeFueraHorario: 'Estamos fuera de horario. Te atendemos de lunes a viernes de 8am a 6pm. Tu mensaje quedó registrado 📝',
  crearLeadAuto: true,
}

const DIAS = [
  { key: 'lun', label: 'Lun' },
  { key: 'mar', label: 'Mar' },
  { key: 'mie', label: 'Mié' },
  { key: 'jue', label: 'Jue' },
  { key: 'vie', label: 'Vie' },
  { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
]

export default function BotPage() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    getDoc(doc(db, BOT_DOC)).then(snap => {
      if (snap.exists()) setConfig({ ...DEFAULT_CONFIG, ...snap.data() })
      setCargando(false)
    })
  }, [])

  const set = (campo, valor) => setConfig(prev => ({ ...prev, [campo]: valor }))

  const toggleDia = (dia) => {
    const dias = config.diasActivos.includes(dia)
      ? config.diasActivos.filter(d => d !== dia)
      : [...config.diasActivos, dia]
    set('diasActivos', dias)
  }

  const guardar = async () => {
    setGuardando(true)
    await setDoc(doc(db, BOT_DOC), config)
    setGuardando(false)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2500)
  }

  if (cargando) return <div style={{ padding: 40, color: 'var(--color-text-tertiary)', fontSize: 14 }}>Cargando configuración...</div>

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>Bot de WhatsApp</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
            Flujo automático de bienvenida con traspaso a agente
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {guardado && <span style={{ fontSize: 12, color: 'var(--color-text-success)' }}>✓ Guardado</span>}
          <button onClick={guardar} disabled={guardando} style={btnPrimary}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Toggle principal */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Bot activo</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Cuando está activo responde automáticamente a mensajes nuevos
            </div>
          </div>
          <Toggle value={config.activo} onChange={v => set('activo', v)} />
        </div>
      </Card>

      {/* Flujo de mensajes */}
      <SectionTitle>Flujo de bienvenida</SectionTitle>
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12, marginTop: -8 }}>
        El bot sigue este orden: Bienvenida → Nombre → Servicio → Ubicación → Urgencia → Traspaso
      </p>

      <Card>
        <FlowStep numero={1} titulo="Mensaje de bienvenida" descripcion="Se envía al recibir el primer mensaje del contacto">
          <Textarea value={config.mensajeBienvenida} onChange={v => set('mensajeBienvenida', v)} rows={2} />
        </FlowStep>

        <Divider />

        <FlowStep numero={2} titulo="Pregunta de nombre" descripcion="El bot solicita el nombre completo del contacto">
          <Textarea value={config.preguntaNombre} onChange={v => set('preguntaNombre', v)} rows={1} />
        </FlowStep>

        <Divider />

        <FlowStep numero={3} titulo="Menú de servicios" descripcion="El bot presenta las opciones disponibles con numeración">
          <Textarea value={config.preguntaServicio} onChange={v => set('preguntaServicio', v)} rows={6} />
          <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
            Usá saltos de línea para separar las opciones. El cliente responde con el número.
          </p>
        </FlowStep>

        <Divider />

        <FlowStep numero={4} titulo="Pregunta de ubicación" descripcion="El bot solicita la provincia o zona del cliente">
          <Textarea value={config.preguntaUbicacion} onChange={v => set('preguntaUbicacion', v)} rows={1} />
        </FlowStep>

        <Divider />

        <FlowStep numero={5} titulo="Pregunta de urgencia" descripcion="El bot consulta qué tan urgente es la solicitud">
          <Textarea value={config.preguntaUrgencia} onChange={v => set('preguntaUrgencia', v)} rows={5} />
        </FlowStep>

        <Divider />

        <FlowStep numero={6} titulo="Mensaje de traspaso a agente" descripcion="Se envía al completar la validación. El chat pasa a un agente humano.">
          <Textarea value={config.mensajeHandoff} onChange={v => set('mensajeHandoff', v)} rows={2} />
        </FlowStep>
      </Card>

      {/* Lead automático */}
      <SectionTitle>Acciones al completar el flujo</SectionTitle>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Crear lead automáticamente</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Al completar la validación se crea un lead en el CRM con los datos recopilados
            </div>
          </div>
          <Toggle value={config.crearLeadAuto} onChange={v => set('crearLeadAuto', v)} />
        </div>
      </Card>

      {/* Delay anti-baneo */}
      <SectionTitle>Delay anti-baneo</SectionTitle>
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12, marginTop: -8 }}>
        El bot simula que está escribiendo antes de responder. El tiempo depende del largo del mensaje.
      </p>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <FieldNum
            label="Delay base (ms)"
            descripcion="Tiempo mínimo siempre"
            value={config.delaySt}
            onChange={v => set('delaySt', v)}
          />
          <FieldNum
            label="Ms por carácter"
            descripcion="Simula velocidad de escritura"
            value={config.delayPorCaracter}
            onChange={v => set('delayPorCaracter', v)}
          />
          <FieldNum
            label="Delay máximo (ms)"
            descripcion="Tope aunque el mensaje sea largo"
            value={config.delayMax}
            onChange={v => set('delayMax', v)}
          />
        </div>
        <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--color-background-secondary)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Ejemplo: mensaje de 80 caracteres → delay = {Math.min(config.delayMax, config.delaySt + 80 * config.delayPorCaracter)}ms ({((Math.min(config.delayMax, config.delaySt + 80 * config.delayPorCaracter)) / 1000).toFixed(1)}s)
        </div>
      </Card>

      {/* Horario */}
      <SectionTitle>Horario de atención</SectionTitle>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Respetar horario de oficina</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Fuera de horario el bot envía un mensaje de aviso y no continúa el flujo
            </div>
          </div>
          <Toggle value={config.horarioActivo} onChange={v => set('horarioActivo', v)} />
        </div>

        {config.horarioActivo && (
          <>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <Label>Hora inicio</Label>
                <input type="time" value={config.horarioInicio} onChange={e => set('horarioInicio', e.target.value)} style={inputSt} />
              </div>
              <div style={{ flex: 1 }}>
                <Label>Hora fin</Label>
                <input type="time" value={config.horarioFin} onChange={e => set('horarioFin', e.target.value)} style={inputSt} />
              </div>
            </div>

            <Label>Días activos</Label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              {DIAS.map(d => (
                <button key={d.key} onClick={() => toggleDia(d.key)} style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  border: '0.5px solid var(--color-border-secondary)',
                  background: config.diasActivos.includes(d.key) ? '#1a3a5c' : 'none',
                  color: config.diasActivos.includes(d.key) ? '#fff' : 'var(--color-text-secondary)',
                }}>
                  {d.label}
                </button>
              ))}
            </div>

            <Label>Mensaje fuera de horario</Label>
            <Textarea value={config.mensajeFueraHorario} onChange={v => set('mensajeFueraHorario', v)} rows={2} />
          </>
        )}
      </Card>

      {/* Vista previa del flujo */}
      <SectionTitle>Vista previa del flujo</SectionTitle>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { texto: config.mensajeBienvenida, lado: 'bot' },
            { texto: '(Cliente escribe su nombre)', lado: 'cliente', estilo: 'italic' },
            { texto: config.preguntaServicio, lado: 'bot' },
            { texto: '(Cliente elige una opción)', lado: 'cliente', estilo: 'italic' },
            { texto: config.preguntaUbicacion, lado: 'bot' },
            { texto: '(Cliente indica su zona)', lado: 'cliente', estilo: 'italic' },
            { texto: config.preguntaUrgencia, lado: 'bot' },
            { texto: '(Cliente indica urgencia)', lado: 'cliente', estilo: 'italic' },
            { texto: config.mensajeHandoff, lado: 'bot' },
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.lado === 'bot' ? 'flex-start' : 'flex-end' }}>
              <div style={{
                maxWidth: '75%', padding: '7px 11px', borderRadius: m.lado === 'bot' ? '12px 12px 12px 3px' : '12px 12px 3px 12px',
                background: m.lado === 'bot' ? 'var(--color-background-secondary)' : '#1a3a5c',
                color: m.lado === 'bot' ? 'var(--color-text-primary)' : '#fff',
                fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                border: m.lado === 'bot' ? '0.5px solid var(--color-border-tertiary)' : 'none',
                fontStyle: m.estilo || 'normal',
                opacity: m.estilo ? 0.6 : 1,
              }}>
                {m.lado === 'bot' && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 2 }}>Bot</span>}
                {m.texto}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ height: 40 }} />
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function Card({ children }) {
  return (
    <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }) {
  return <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '20px 0 8px' }}>{children}</h3>
}

function Divider() {
  return <div style={{ height: '0.5px', background: 'var(--color-border-tertiary)', margin: '14px 0' }} />
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>{children}</div>
}

function FlowStep({ numero, titulo, descripcion, children }) {
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#E6F1FB', color: '#0C447C', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
        {numero}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 2 }}>{titulo}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8 }}>{descripcion}</div>
        {children}
      </div>
    </div>
  )
}

function Textarea({ value, onChange, rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      style={{ ...inputSt, resize: 'vertical', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}
    />
  )
}

function FieldNum({ label, descripcion, value, onChange }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ ...inputSt, marginBottom: 4 }}
      />
      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{descripcion}</div>
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
      background: value ? '#1a3a5c' : 'var(--color-border-secondary)',
      position: 'relative', transition: 'background .2s', padding: 0,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: value ? 23 : 3,
        transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </button>
  )
}

const inputSt = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  border: '0.5px solid var(--color-border-secondary)', borderRadius: 8,
  background: 'var(--color-background-primary)', color: 'var(--color-text-primary)',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}

const btnPrimary = {
  padding: '8px 18px', background: '#1a3a5c', color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit',
}