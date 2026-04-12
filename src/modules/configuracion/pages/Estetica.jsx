/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: Estetica.jsx
 * Módulo:  Configuracion
 * ============================================================
 */

import { useState, useRef } from 'react'
import { useTheme } from '../../../context/ThemeContext'
import { db } from '../../../firebase/config'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { useAuth } from '../../../context/AuthContext'

const SEPARADORES = {
  ninguno:  { label: 'Ninguno',   valor: 'none' },
  suave:    { label: 'Suave',     valor: '1px solid rgba(0,0,0,0.06)' },
  normal:   { label: 'Normal',    valor: '1px solid rgba(0,0,0,0.12)' },
  marcado:  { label: 'Marcado',   valor: '1.5px solid rgba(0,0,0,0.18)' },
}

const TIPOGRAFIAS = {
  dm:      { label: 'DM Sans',     valor: "'DM Sans', system-ui, sans-serif" },
  inter:   { label: 'Inter',       valor: "'Inter', system-ui, sans-serif" },
  system:  { label: 'Sistema',     valor: "system-ui, -apple-system, sans-serif" },
}

export default function Estetica() {
  const { theme, aplicarTema, aplicarPaleta, PALETAS, FORMAS, DENSIDADES } = useTheme()
  const { user } = useAuth()
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [logo, setLogo] = useState(null)
  const [logoPreview, setLogoPreview] = useState(theme.logoUrl || null)
  const [separador, setSeparador] = useState(theme.separador || 'suave')
  const [tipografia, setTipografia] = useState(theme.tipografia || 'dm')
  const fileRef = useRef()

  const s = estilos(theme)

  const handleLogo = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setLogoPreview(ev.target.result)
      setLogo(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      const updates = { separador, tipografia }
      if (logo) updates.logoUrl = logo
      aplicarTema(updates)

      // Aplicar separador globalmente
      document.documentElement.style.setProperty('--eco-separator', SEPARADORES[separador]?.valor || 'none')
      document.documentElement.style.setProperty('--eco-font-family', TIPOGRAFIAS[tipografia]?.valor || "'DM Sans', sans-serif")

      // Guardar en Firestore
      await setDoc(doc(db, 'configuracion', 'estetica'), {
        ...theme,
        separador,
        tipografia,
        logoUrl: logo || theme.logoUrl || '',
        actualizadoPor: user?.uid,
        actualizadoEn: new Date().toISOString(),
      }, { merge: true })

      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
    } catch (err) {
      console.error('[LK-CRM] Error guardando estética:', err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <h2 style={s.titulo}>Estética del sistema</h2>
          <p style={s.subtitulo}>Personaliza colores, forma, tipografía y separadores</p>
        </div>
        <button onClick={guardar} disabled={guardando} style={s.btnGuardar}>
          {guardando ? 'Guardando...' : guardado ? '✓ Guardado' : 'Guardar cambios'}
        </button>
      </div>

      <div style={s.grid}>

        {/* ── Logo ── */}
        <Seccion titulo="Logo de la empresa">
          <div style={s.logoArea}>
            {logoPreview
              ? <img src={logoPreview} alt="Logo" style={s.logoImg} />
              : <div style={s.logoPlaceholder}>Sin logo</div>
            }
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => fileRef.current.click()} style={s.btnSec}>
                {logoPreview ? 'Cambiar logo' : 'Subir logo'}
              </button>
              {logoPreview && (
                <button onClick={() => { setLogoPreview(null); setLogo(null) }} style={s.btnDanger}>
                  Quitar logo
                </button>
              )}
              <p style={s.hint}>PNG o SVG · Fondo transparente recomendado</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleLogo} style={{ display: 'none' }} />
        </Seccion>

        {/* ── Paletas predefinidas ── */}
        <Seccion titulo="Paleta de colores">
          <div style={s.paletas}>
            {Object.entries(PALETAS).map(([key, pal]) => (
              <button
                key={key}
                onClick={() => aplicarPaleta(key)}
                style={{
                  ...s.paletaBtn,
                  outline: theme.paleta === key ? `2.5px solid ${pal.primary}` : 'none',
                  outlineOffset: 3,
                }}
                title={pal.name}
              >
                <span style={{ ...s.paletaCircle, background: pal.primary }} />
                <span style={{ ...s.paletaCircle, background: pal.secondary, marginLeft: -6 }} />
                <span style={s.paletaLabel}>{pal.name}</span>
              </button>
            ))}
          </div>

          {/* Color picker libre */}
          <div style={s.divider} />
          <p style={s.labelSec}>Color personalizado</p>
          <div style={s.colorRow}>
            <div style={s.colorItem}>
              <label style={s.colorLabel}>Primario</label>
              <div style={s.colorPreview}>
                <span style={{ ...s.colorSwatch, background: theme.primary }} />
                <input
                  type="color"
                  value={theme.primary}
                  onChange={e => aplicarTema({ paleta: 'custom', primary: e.target.value })}
                  style={s.colorInput}
                />
                <span style={s.colorHex}>{theme.primary}</span>
              </div>
            </div>
            <div style={s.colorItem}>
              <label style={s.colorLabel}>Secundario</label>
              <div style={s.colorPreview}>
                <span style={{ ...s.colorSwatch, background: theme.secondary }} />
                <input
                  type="color"
                  value={theme.secondary}
                  onChange={e => aplicarTema({ paleta: 'custom', secondary: e.target.value })}
                  style={s.colorInput}
                />
                <span style={s.colorHex}>{theme.secondary}</span>
              </div>
            </div>
            <div style={s.colorItem}>
              <label style={s.colorLabel}>Acento</label>
              <div style={s.colorPreview}>
                <span style={{ ...s.colorSwatch, background: theme.accent || theme.primary }} />
                <input
                  type="color"
                  value={theme.accent || theme.primary}
                  onChange={e => aplicarTema({ accent: e.target.value })}
                  style={s.colorInput}
                />
                <span style={s.colorHex}>{theme.accent || theme.primary}</span>
              </div>
            </div>
          </div>
        </Seccion>

        {/* ── Forma ── */}
        <Seccion titulo="Forma de los elementos">
          <div style={s.opcionesRow}>
            {Object.entries(FORMAS).map(([key, val]) => (
              <button
                key={key}
                onClick={() => aplicarTema({ forma: key })}
                style={{
                  ...s.opcionBtn,
                  borderColor: theme.forma === key ? theme.primary : 'var(--eco-border)',
                  background: theme.forma === key ? theme.secondary : '#fff',
                  color: theme.forma === key ? theme.primary : 'var(--eco-text)',
                }}
              >
                <div style={{
                  width: 28, height: 18,
                  border: `1.5px solid ${theme.forma === key ? theme.primary : '#aaa'}`,
                  borderRadius: val,
                  marginBottom: 4,
                }} />
                <span style={{ fontSize: 11, textTransform: 'capitalize' }}>{key}</span>
              </button>
            ))}
          </div>
        </Seccion>

        {/* ── Densidad ── */}
        <Seccion titulo="Densidad de la interfaz">
          <div style={s.opcionesRow}>
            {Object.entries(DENSIDADES).map(([key]) => (
              <button
                key={key}
                onClick={() => aplicarTema({ densidad: key })}
                style={{
                  ...s.opcionBtn,
                  borderColor: theme.densidad === key ? theme.primary : 'var(--eco-border)',
                  background: theme.densidad === key ? theme.secondary : '#fff',
                  color: theme.densidad === key ? theme.primary : 'var(--eco-text)',
                }}
              >
                <span style={{ fontSize: 11, textTransform: 'capitalize' }}>{key}</span>
              </button>
            ))}
          </div>
        </Seccion>

        {/* ── Separadores ── */}
        <Seccion titulo="Separadores y bordes">
          <div style={s.opcionesRow}>
            {Object.entries(SEPARADORES).map(([key, sep]) => (
              <button
                key={key}
                onClick={() => setSeparador(key)}
                style={{
                  ...s.opcionBtn,
                  borderColor: separador === key ? theme.primary : 'var(--eco-border)',
                  background: separador === key ? theme.secondary : '#fff',
                  color: separador === key ? theme.primary : 'var(--eco-text)',
                }}
              >
                <div style={{
                  width: 36,
                  height: 0,
                  borderTop: sep.valor === 'none' ? '1px dashed #ccc' : sep.valor,
                  marginBottom: 6,
                }} />
                <span style={{ fontSize: 11 }}>{sep.label}</span>
              </button>
            ))}
          </div>
        </Seccion>

        {/* ── Tipografía ── */}
        <Seccion titulo="Tipografía">
          <div style={s.opcionesRow}>
            {Object.entries(TIPOGRAFIAS).map(([key, tip]) => (
              <button
                key={key}
                onClick={() => setTipografia(key)}
                style={{
                  ...s.opcionBtn,
                  borderColor: tipografia === key ? theme.primary : 'var(--eco-border)',
                  background: tipografia === key ? theme.secondary : '#fff',
                  color: tipografia === key ? theme.primary : 'var(--eco-text)',
                  fontFamily: tip.valor,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 500 }}>Aa</span>
                <span style={{ fontSize: 11 }}>{tip.label}</span>
              </button>
            ))}
          </div>
        </Seccion>

        {/* ── Vista previa ── */}
        <Seccion titulo="Vista previa">
          <div style={{
            border: SEPARADORES[separador]?.valor !== 'none' ? SEPARADORES[separador]?.valor : '1px dashed #ddd',
            borderRadius: `${FORMAS[theme.forma] ?? 0}px`,
            padding: 16,
            background: '#fff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: SEPARADORES[separador]?.valor !== 'none' ? SEPARADORES[separador]?.valor : '1px dashed #ddd' }}>
              {logoPreview && <img src={logoPreview} style={{ height: 28, objectFit: 'contain' }} />}
              <span style={{ fontWeight: 600, color: theme.primary, fontFamily: TIPOGRAFIAS[tipografia]?.valor }}>LK-CRM</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={{ background: theme.primary, color: '#fff', border: 'none', borderRadius: `${FORMAS[theme.forma] ?? 0}px`, padding: '6px 14px', fontSize: 12, cursor: 'default', fontFamily: TIPOGRAFIAS[tipografia]?.valor }}>
                Botón primario
              </button>
              <button style={{ background: theme.secondary, color: theme.primary, border: `1px solid ${theme.primary}`, borderRadius: `${FORMAS[theme.forma] ?? 0}px`, padding: '6px 14px', fontSize: 12, cursor: 'default', fontFamily: TIPOGRAFIAS[tipografia]?.valor }}>
                Botón secundario
              </button>
              <span style={{ background: theme.accent || theme.primary, color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontFamily: TIPOGRAFIAS[tipografia]?.valor }}>
                Etiqueta
              </span>
            </div>
          </div>
        </Seccion>

      </div>
    </div>
  )
}

function Seccion({ titulo, children }) {
  return (
    <div style={{
      background: '#fff',
      border: '0.5px solid var(--eco-border)',
      borderRadius: 'var(--eco-radius, 0px)',
      padding: '16px 20px',
      marginBottom: 16,
    }}>
      <p style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '.6px',
        color: 'var(--eco-muted)',
        marginBottom: 14,
        paddingBottom: 10,
        borderBottom: '0.5px solid var(--eco-border)',
      }}>
        {titulo}
      </p>
      {children}
    </div>
  )
}

function estilos(theme) {
  return {
    page: { padding: '20px 24px', maxWidth: 760, margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12 },
    titulo: { fontSize: 17, fontWeight: 600, color: 'var(--eco-text)', marginBottom: 2 },
    subtitulo: { fontSize: 12, color: 'var(--eco-muted)' },
    grid: { display: 'flex', flexDirection: 'column' },
    btnGuardar: {
      background: theme.primary, color: '#fff', border: 'none',
      borderRadius: 'var(--eco-radius, 0px)', padding: '8px 20px',
      fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
    },
    btnSec: {
      background: '#fff', color: theme.primary,
      border: `1px solid ${theme.primary}`,
      borderRadius: 'var(--eco-radius, 0px)', padding: '6px 14px',
      fontSize: 12, cursor: 'pointer',
    },
    btnDanger: {
      background: '#fff', color: '#c0392b',
      border: '1px solid #c0392b',
      borderRadius: 'var(--eco-radius, 0px)', padding: '6px 14px',
      fontSize: 12, cursor: 'pointer',
    },
    logoArea: { display: 'flex', alignItems: 'center', gap: 20 },
    logoImg: { height: 56, maxWidth: 160, objectFit: 'contain', border: '0.5px solid var(--eco-border)', borderRadius: 4, padding: 4 },
    logoPlaceholder: { width: 100, height: 56, background: '#f4f4f4', border: '0.5px dashed #ccc', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#aaa' },
    hint: { fontSize: 10, color: 'var(--eco-hint)', margin: 0 },
    paletas: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    paletaBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', border: '0.5px solid var(--eco-border)', borderRadius: 20, background: '#fff', cursor: 'pointer', fontSize: 12 },
    paletaCircle: { width: 16, height: 16, borderRadius: '50%', border: '0.5px solid rgba(0,0,0,.1)', display: 'inline-block', flexShrink: 0 },
    paletaLabel: { fontSize: 11, color: 'var(--eco-text)' },
    divider: { height: '0.5px', background: 'var(--eco-border)', margin: '12px 0' },
    labelSec: { fontSize: 11, color: 'var(--eco-muted)', marginBottom: 10, fontWeight: 500 },
    colorRow: { display: 'flex', gap: 16, flexWrap: 'wrap' },
    colorItem: { display: 'flex', flexDirection: 'column', gap: 4 },
    colorLabel: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--eco-muted)' },
    colorPreview: { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', border: '0.5px solid var(--eco-border)', borderRadius: 'var(--eco-radius, 0px)', background: '#fafafa' },
    colorSwatch: { width: 20, height: 20, borderRadius: 4, border: '0.5px solid rgba(0,0,0,.1)', flexShrink: 0 },
    colorInput: { width: 24, height: 24, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 },
    colorHex: { fontSize: 11, color: 'var(--eco-muted)', fontFamily: 'monospace' },
    opcionesRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
    opcionBtn: {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      padding: '10px 16px', border: '1px solid', borderRadius: 'var(--eco-radius, 0px)',
      cursor: 'pointer', minWidth: 80, transition: 'all .15s',
    },
  }
}