/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: PanelOT.jsx
 * Módulo:  Calendario
 * ============================================================
 */

import { useState, useRef, useEffect } from 'react';

const STATUS_FLOW = [
  { key: 'pendiente', label: 'Pendiente', bg: '#FEF3C7', color: '#92400E' },
  { key: 'asignado', label: 'Asignado', bg: '#DBEAFE', color: '#1E40AF' },
  { key: 'en_proceso', label: 'En proceso', bg: '#EDE9FE', color: '#5B21B6' },
  { key: 'resuelto', label: 'Resuelto', bg: '#D1FAE5', color: '#065F46' },
];

const INCIDENCIA_STATUS = [
  { key: 'reportada', label: 'Reportada', bg: '#FEE2E2', color: '#991B1B' },
  { key: 'asignada', label: 'Asignada', bg: '#DBEAFE', color: '#1E40AF' },
  { key: 'resuelta', label: 'Resuelta', bg: '#D1FAE5', color: '#065F46' },
];

export default function PanelOT({ evento, onClose, onActualizar }) {
  const [tab, setTab] = useState('detalle');
  const [mensajes, setMensajes] = useState([
    { id: 1, autor: 'Carlos V.', texto: 'El cliente pregunta si llego antes de las 9am, ¿confirmo?', mio: false, hora: '8:14am' },
    { id: 2, autor: 'Andrea M.', texto: 'Sí, confirmale para las 8:30, tenemos el equipo listo.', mio: true, hora: '8:20am' },
  ]);
  const [msgInput, setMsgInput] = useState('');
  const [incidenciaDesc, setIncidenciaDesc] = useState(evento?.incidenciaDesc || '');
  const [incidenciaCierre, setIncidenciaCierre] = useState(evento?.incidenciaCierre || '');
  const [incidenciaStatus, setIncidenciaStatus] = useState(evento?.incidenciaStatus || 'reportada');
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [mensajes, tab]);

  function enviarMensaje() {
    if (!msgInput.trim()) return;
    setMensajes(prev => [...prev, {
      id: Date.now(),
      autor: 'Yo',
      texto: msgInput,
      mio: true,
      hora: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }),
    }]);
    setMsgInput('');
  }

  if (!evento) {
    return (
      <div style={panelStyle}>
        <PanelHeader title="Orden de Trabajo" onClose={onClose} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontSize: 13, padding: 20, textAlign: 'center' }}>
          Seleccioná un evento del calendario para ver su Orden de Trabajo
        </div>
      </div>
    );
  }

  const statusActual = evento.statusOT || 'pendiente';

  return (
    <div style={panelStyle}>
      <PanelHeader title={`OT — ${evento.titulo}`} onClose={onClose} />

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--color-border-tertiary)', flexShrink: 0 }}>
        {['detalle', 'chat', 'incidencia'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: 11,
              textAlign: 'center',
              cursor: 'pointer',
              color: tab === t ? '#378ADD' : 'var(--color-text-secondary)',
              borderBottom: tab === t ? '2px solid #378ADD' : '2px solid transparent',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid #378ADD' : '2px solid transparent',
            }}
          >
            {t === 'detalle' ? 'Detalle' : t === 'chat' ? 'Chat interno' : 'Incidencia'}
            {t === 'incidencia' && evento.esIncidencia && (
              <span style={{ marginLeft: 4, background: '#FEE2E2', color: '#991B1B', borderRadius: 8, fontSize: 9, padding: '1px 4px' }}>!</span>
            )}
          </button>
        ))}
      </div>

      {/* DETALLE */}
      {tab === 'detalle' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          <Section label="Estado OT">
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {STATUS_FLOW.map(s => (
                <button
                  key={s.key}
                  onClick={() => onActualizar(evento.id, { statusOT: s.key })}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    background: s.bg,
                    color: s.color,
                    border: statusActual === s.key ? `1.5px solid ${s.color}` : '1px solid transparent',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Section>

          <Section label="Cliente">{evento.cliente || '—'}</Section>
          <Section label="Técnico asignado">{evento.tecnico || '—'}</Section>

          <Section label="Tipo de servicio">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {evento.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: evento.color, display: 'inline-block' }} />}
              {evento.tipoServicio || '—'}
            </div>
          </Section>

          <Section label="Fecha y hora">
            {evento.fechaInicio}
            {evento.fechaFin && evento.fechaFin !== evento.fechaInicio && ` → ${evento.fechaFin}`}
            {evento.hora && ` · ${evento.hora}`}
          </Section>

          <Section label="Descripción / trabajo a realizar">
            <div style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '6px 8px', fontSize: 12, color: 'var(--color-text-primary)' }}>
              {evento.descripcion || 'Sin descripción'}
            </div>
          </Section>

          {evento.activos?.length > 0 && (
            <Section label="Activos">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {evento.activos.map((a, i) => (
                  <span key={i} style={{ padding: '3px 8px', background: 'var(--color-background-secondary)', borderRadius: 12, fontSize: 11, color: 'var(--color-text-secondary)', border: '0.5px solid var(--color-border-tertiary)' }}>
                    📦 {a}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {evento.vinculado && (
            <Section label="Vinculado a">
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 500,
                background: `${evento.color}22`,
                color: evento.color,
                border: `0.5px solid ${evento.color}44`,
                cursor: 'pointer',
              }}>
                🔗 {evento.vinculado.label}
              </span>
            </Section>
          )}

          <Section label="Acciones rápidas">
            <button
              onClick={() => alert('Abriendo WhatsApp...')}
              style={actionBtnStyle('#1D9E75', '#E1F5EE')}
            >
              💬 Escribir al cliente (WhatsApp)
            </button>
            <button
              onClick={() => setTab('incidencia')}
              style={actionBtnStyle('var(--color-text-secondary)', 'var(--color-background-secondary)')}
            >
              ⚑ Reportar incidencia
            </button>
          </Section>
        </div>
      )}

      {/* CHAT INTERNO */}
      {tab === 'chat' && (
        <>
          <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {mensajes.map(msg => (
              <div key={msg.id} style={{
                display: 'flex',
                flexDirection: msg.mio ? 'row-reverse' : 'row',
                gap: 8,
                marginBottom: 12,
              }}>
                <div style={{
                  width: 24, height: 24,
                  borderRadius: '50%',
                  background: msg.mio ? '#D1FAE5' : '#DBEAFE',
                  color: msg.mio ? '#065F46' : '#1E40AF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 500, flexShrink: 0,
                }}>
                  {msg.autor.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{
                    background: msg.mio ? '#378ADD' : 'var(--color-background-secondary)',
                    color: msg.mio ? '#fff' : 'var(--color-text-primary)',
                    borderRadius: msg.mio ? '8px 0 8px 8px' : '0 8px 8px 8px',
                    padding: '6px 8px',
                    fontSize: 11,
                    maxWidth: 200,
                  }}>
                    {msg.texto}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2, textAlign: msg.mio ? 'right' : 'left' }}>
                    {msg.autor} · {msg.hora}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '8px 12px', borderTop: '0.5px solid var(--color-border-tertiary)', flexShrink: 0 }}>
            <input
              value={msgInput}
              onChange={e => setMsgInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviarMensaje()}
              placeholder="Mensaje interno..."
              style={{ flex: 1, padding: '6px 8px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, fontSize: 12, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' }}
            />
            <button
              onClick={enviarMensaje}
              style={{ padding: '6px 10px', background: '#378ADD', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}
            >
              →
            </button>
          </div>
        </>
      )}

      {/* INCIDENCIA */}
      {tab === 'incidencia' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          <Section label="Estado de incidencia">
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {INCIDENCIA_STATUS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setIncidenciaStatus(s.key)}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    background: s.bg,
                    color: s.color,
                    border: incidenciaStatus === s.key ? `1.5px solid ${s.color}` : '1px solid transparent',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Section>

          <Section label="Responsable">
            <div style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '6px 8px', fontSize: 12, color: 'var(--color-text-primary)' }}>
              {evento.tecnico || '—'}
            </div>
          </Section>

          <Section label="Descripción de la incidencia">
            <textarea
              value={incidenciaDesc}
              onChange={e => setIncidenciaDesc(e.target.value)}
              placeholder="Describí la incidencia..."
              style={{ width: '100%', padding: '6px 8px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, fontSize: 12, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', resize: 'vertical', minHeight: 70, boxSizing: 'border-box' }}
            />
          </Section>

          <Section label="Cómo se resolvió">
            <textarea
              value={incidenciaCierre}
              onChange={e => setIncidenciaCierre(e.target.value)}
              placeholder="Observación de cierre..."
              style={{ width: '100%', padding: '6px 8px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, fontSize: 12, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', resize: 'vertical', minHeight: 70, boxSizing: 'border-box' }}
            />
          </Section>

          <button
            onClick={() => {
              onActualizar(evento.id, { incidenciaDesc, incidenciaCierre, incidenciaStatus: 'resuelta', esIncidencia: true });
              setIncidenciaStatus('resuelta');
            }}
            style={{ width: '100%', padding: 8, borderRadius: 8, fontSize: 12, cursor: 'pointer', background: '#D1FAE5', color: '#065F46', border: '0.5px solid #6EE7B7', fontWeight: 500 }}
          >
            ✓ Marcar como resuelta
          </button>
        </div>
      )}
    </div>
  );
}

function PanelHeader({ title, onClose }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </h3>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 16, flexShrink: 0, marginLeft: 8 }}>×</button>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>{children}</div>
    </div>
  );
}

const panelStyle = {
  width: 300,
  borderLeft: '0.5px solid var(--color-border-tertiary)',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--color-background-primary)',
  flexShrink: 0,
};

function actionBtnStyle(color, bg) {
  return {
    width: '100%',
    padding: 7,
    borderRadius: 8,
    fontSize: 12,
    cursor: 'pointer',
    background: bg,
    color,
    border: `0.5px solid ${color}`,
    marginBottom: 4,
    textAlign: 'left',
  };
}