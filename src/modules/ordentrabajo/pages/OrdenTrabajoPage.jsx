/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: OrdenTrabajoPage.jsx
 * Módulo:  OrdenTrabajo
 * ============================================================
 */

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useEmpresa } from '../../../context/EmpresaContext';

const COLUMNAS = [
  { key: 'pendiente', label: 'Pendiente', bg: '#FEF3C7', color: '#92400E', border: '#F59E0B' },
  { key: 'asignado', label: 'Asignado', bg: '#DBEAFE', color: '#1E40AF', border: '#93C5FD' },
  { key: 'en_proceso', label: 'En proceso', bg: '#EDE9FE', color: '#5B21B6', border: '#C4B5FD' },
  { key: 'resuelto', label: 'Resuelto', bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7' },
];

export default function OrdenTrabajoPage() {
  const { empresa } = useEmpresa();
  const [eventos, setEventos] = useState([]);
  const [otSeleccionada, setOtSeleccionada] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTecnico, setFiltroTecnico] = useState('');

  useEffect(() => {
    if (!empresa?.id) return;
    const q = query(collection(db, 'empresas', empresa.id, 'eventos'));
    const unsub = onSnapshot(q, snap => {
      setEventos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [empresa?.id]);

  async function moverColumna(eventoId, nuevoStatus) {
    if (!empresa?.id) return;
    await updateDoc(doc(db, 'empresas', empresa.id, 'eventos', eventoId), {
      statusOT: nuevoStatus,
      actualizadoEn: serverTimestamp(),
    });
  }

  const tecnicosList = [...new Set(eventos.map(e => e.tecnico).filter(Boolean))];

  const filtrados = eventos.filter(ev => {
    const texto = busqueda.toLowerCase();
    const matchBusqueda = !busqueda ||
      ev.titulo?.toLowerCase().includes(texto) ||
      ev.cliente?.toLowerCase().includes(texto);
    const matchTecnico = !filtroTecnico || ev.tecnico === filtroTecnico;
    return matchBusqueda && matchTecnico;
  });

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', background: 'var(--color-background-tertiary)' }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '0.5px solid var(--color-border-tertiary)',
        background: 'var(--color-background-primary)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}>
        <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
          Órdenes de Trabajo
        </h1>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por título o cliente..."
          style={{
            padding: '6px 10px',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 8,
            fontSize: 12,
            background: 'var(--color-background-secondary)',
            color: 'var(--color-text-primary)',
            width: 220,
          }}
        />
        <select
          value={filtroTecnico}
          onChange={e => setFiltroTecnico(e.target.value)}
          style={{
            padding: '6px 10px',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 8,
            fontSize: 12,
            background: 'var(--color-background-secondary)',
            color: 'var(--color-text-primary)',
          }}
        >
          <option value="">Todos los técnicos</option>
          {tecnicosList.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          {filtrados.length} órdenes
        </div>
      </div>

      {/* Kanban */}
      <div style={{ flex: 1, overflowX: 'auto', display: 'flex', gap: 12, padding: 16 }}>
        {COLUMNAS.map(col => {
          const colEventos = filtrados.filter(ev => (ev.statusOT || 'pendiente') === col.key);
          return (
            <div
              key={col.key}
              style={{
                width: 260,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                const id = e.dataTransfer.getData('eventoId');
                if (id) moverColumna(id, col.key);
              }}
            >
              {/* Columna header */}
              <div style={{
                padding: '6px 10px',
                borderRadius: 8,
                background: col.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: col.color }}>{col.label}</span>
                <span style={{
                  fontSize: 11,
                  background: 'rgba(255,255,255,0.6)',
                  color: col.color,
                  borderRadius: 10,
                  padding: '1px 7px',
                  fontWeight: 500,
                }}>
                  {colEventos.length}
                </span>
              </div>

              {/* Tarjetas */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colEventos.map(ev => (
                  <OTCard
                    key={ev.id}
                    ev={ev}
                    onClick={() => setOtSeleccionada(ev)}
                    isSelected={otSeleccionada?.id === ev.id}
                  />
                ))}
                {colEventos.length === 0 && (
                  <div style={{
                    padding: 20,
                    textAlign: 'center',
                    color: 'var(--color-text-tertiary)',
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px dashed var(--color-border-tertiary)',
                  }}>
                    Sin órdenes
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Panel de detalle OT al hacer clic */}
      {otSeleccionada && (
        <OTDetalle ev={otSeleccionada} onClose={() => setOtSeleccionada(null)} onActualizar={moverColumna} />
      )}
    </div>
  );
}

function OTCard({ ev, onClick, isSelected }) {
  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData('eventoId', ev.id)}
      onClick={onClick}
      style={{
        background: 'var(--color-background-primary)',
        border: isSelected
          ? '1.5px solid #378ADD'
          : '0.5px solid var(--color-border-tertiary)',
        borderLeft: `3px solid ${ev.color || '#378ADD'}`,
        borderRadius: 8,
        padding: '10px 10px 10px 8px',
        cursor: 'pointer',
        transition: 'box-shadow 0.1s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
          {ev.esIncidencia && <span style={{ color: '#DC2626', marginRight: 3 }}>⚑</span>}
          {ev.titulo}
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>
        {ev.cliente}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
          {ev.fechaInicio || 'Sin fecha'}{ev.hora ? ` · ${ev.hora}` : ''}
        </div>
        {ev.tecnico && (
          <div style={{
            fontSize: 10,
            background: 'var(--color-background-secondary)',
            padding: '2px 6px',
            borderRadius: 10,
            color: 'var(--color-text-secondary)',
          }}>
            {ev.tecnico}
          </div>
        )}
      </div>

      {!ev.aprobado && (
        <div style={{ marginTop: 4 }}>
          <span style={{ fontSize: 10, background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: 10 }}>
            Sin aprobación
          </span>
        </div>
      )}
    </div>
  );
}

function OTDetalle({ ev, onClose, onActualizar }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      right: 0,
      width: 320,
      maxHeight: '70vh',
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: '12px 0 0 0',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ev.titulo}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--color-text-secondary)', flexShrink: 0, marginLeft: 8 }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        <Row label="Cliente">{ev.cliente}</Row>
        <Row label="Técnico">{ev.tecnico || '—'}</Row>
        <Row label="Fecha">{ev.fechaInicio}{ev.hora ? ` · ${ev.hora}` : ''}</Row>
        <Row label="Descripción">{ev.descripcion || '—'}</Row>
        {ev.vinculado && <Row label="Vinculado a">{ev.vinculado.label}</Row>}
        {ev.esIncidencia && ev.incidenciaDesc && <Row label="Incidencia">{ev.incidenciaDesc}</Row>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
          <button
            onClick={() => alert('Abriendo WhatsApp...')}
            style={{ padding: '7px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: '#E1F5EE', color: '#1D9E75', border: '0.5px solid #1D9E75', textAlign: 'left' }}
          >
            💬 Escribir al cliente
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 500, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-primary)', background: 'var(--color-background-secondary)', borderRadius: 6, padding: '5px 7px' }}>{children}</div>
    </div>
  );
}
