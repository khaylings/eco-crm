/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: ModalEvento.jsx
 * Módulo:  Calendario
 * ============================================================
 */

import { useState, useEffect } from 'react';

export default function ModalEvento({
  evento,
  tiposServicio,
  tecnicos,
  fechaInicial,
  onClose,
  onGuardar,
  onEliminar,
  onVerOT,
}) {
  const isNew = !evento;
  const [form, setForm] = useState({
    titulo: '',
    fechaInicio: fechaInicial || '',
    fechaFin: fechaInicial || '',
    hora: '',
    duracionHoras: 1,
    cliente: '',
    clienteId: '',
    tipoServicioId: '',
    tecnico: '',
    tecnicoId: '',
    descripcion: '',
    aprobado: false,
    esIncidencia: false,
    activos: [],
    vinculadoTipo: '',
    vinculadoId: '',
    vinculadoLabel: '',
  });

  useEffect(() => {
    if (evento) {
      setForm({
        titulo: evento.titulo || '',
        fechaInicio: evento.fechaInicio || '',
        fechaFin: evento.fechaFin || evento.fechaInicio || '',
        hora: evento.hora || '',
        duracionHoras: evento.duracionHoras || 1,
        cliente: evento.cliente || '',
        clienteId: evento.clienteId || '',
        tipoServicioId: evento.tipoServicioId || '',
        tecnico: evento.tecnico || '',
        tecnicoId: evento.tecnicoId || '',
        descripcion: evento.descripcion || '',
        aprobado: evento.aprobado || false,
        esIncidencia: evento.esIncidencia || false,
        activos: evento.activos || [],
        vinculadoTipo: evento.vinculado?.tipo || '',
        vinculadoId: evento.vinculado?.id || '',
        vinculadoLabel: evento.vinculado?.label || '',
      });
    }
  }, [evento]);

  const tipoSeleccionado = tiposServicio.find(ts => ts.id === form.tipoServicioId);
  const colorEvento = tipoSeleccionado?.color || '#378ADD';

  function handleChange(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleGuardar() {
    const data = {
      ...form,
      color: colorEvento,
      vinculado: form.vinculadoId
        ? { tipo: form.vinculadoTipo, id: form.vinculadoId, label: form.vinculadoLabel }
        : null,
    };
    onGuardar(data);
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--color-background-primary)',
        borderRadius: 12,
        border: '0.5px solid var(--color-border-tertiary)',
        width: 420,
        maxHeight: '85vh',
        overflowY: 'auto',
        padding: 20,
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {tipoSeleccionado && (
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: colorEvento }} />
            )}
            <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
              {isNew ? 'Nuevo evento' : evento.titulo}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--color-text-secondary)' }}>×</button>
        </div>

        {/* Badges de estado (solo en edición) */}
        {!isNew && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {!evento.aprobado && <Badge color="#F59E0B" bg="#FEF3C7">! Sin aprobación</Badge>}
            {evento.esIncidencia && <Badge color="#DC2626" bg="#FEE2E2">⚑ Incidencia</Badge>}
          </div>
        )}

        {/* Formulario */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Título">
            <input
              value={form.titulo}
              onChange={e => handleChange('titulo', e.target.value)}
              placeholder="Ej: Mantenimiento Carla - Los Yoses"
              style={inputStyle}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Fecha inicio">
              <input type="date" value={form.fechaInicio} onChange={e => handleChange('fechaInicio', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Fecha fin">
              <input type="date" value={form.fechaFin} onChange={e => handleChange('fechaFin', e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Hora">
              <input type="time" value={form.hora} onChange={e => handleChange('hora', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Duración (horas)">
              <input type="number" min="0.5" max="24" step="0.5" value={form.duracionHoras} onChange={e => handleChange('duracionHoras', parseFloat(e.target.value))} style={inputStyle} />
            </Field>
          </div>

          <Field label="Tipo de servicio">
            <select value={form.tipoServicioId} onChange={e => handleChange('tipoServicioId', e.target.value)} style={inputStyle}>
              <option value="">Seleccionar tipo...</option>
              {tiposServicio.map(ts => (
                <option key={ts.id} value={ts.id}>{ts.nombre}</option>
              ))}
            </select>
          </Field>

          <Field label="Cliente / Lead">
            <input
              value={form.cliente}
              onChange={e => handleChange('cliente', e.target.value)}
              placeholder="Nombre del cliente"
              style={inputStyle}
            />
          </Field>

          <Field label="Técnico asignado">
            <select value={form.tecnicoId} onChange={e => {
              const t = tecnicos.find(x => x.id === e.target.value);
              handleChange('tecnicoId', e.target.value);
              handleChange('tecnico', t?.nombre || '');
            }} style={inputStyle}>
              <option value="">Sin asignar</option>
              {tecnicos.map(t => (
                <option key={t.id} value={t.id}>{t.nombre || t.email}</option>
              ))}
            </select>
          </Field>

          <Field label="Descripción / trabajo a realizar">
            <textarea
              value={form.descripcion}
              onChange={e => handleChange('descripcion', e.target.value)}
              placeholder="Describí el trabajo..."
              style={{ ...inputStyle, height: 70, resize: 'vertical' }}
            />
          </Field>

          {/* Vinculación */}
          <Field label="Vincular a">
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={form.vinculadoTipo}
                onChange={e => handleChange('vinculadoTipo', e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              >
                <option value="">Sin vinculación</option>
                <option value="Lead">Lead</option>
                <option value="Cotización">Cotización</option>
                <option value="Factura">Factura</option>
                <option value="Venta">Venta</option>
              </select>
              {form.vinculadoTipo && (
                <input
                  value={form.vinculadoId}
                  onChange={e => handleChange('vinculadoId', e.target.value)}
                  placeholder="ID..."
                  style={{ ...inputStyle, width: 90 }}
                />
              )}
            </div>
          </Field>

          {/* Checkboxes */}
          <div style={{ display: 'flex', gap: 20 }}>
            <CheckField
              label="Aprobado por cliente"
              checked={form.aprobado}
              onChange={v => handleChange('aprobado', v)}
            />
            <CheckField
              label="Es incidencia"
              checked={form.esIncidencia}
              onChange={v => handleChange('esIncidencia', v)}
            />
          </div>
        </div>

        {/* Acciones */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginTop: 20,
          paddingTop: 16,
          borderTop: '0.5px solid var(--color-border-tertiary)',
        }}>
          {!isNew && (
            <button onClick={() => onVerOT(evento)} style={{ ...btnStyle, flex: 1 }}>
              Ver OT
            </button>
          )}
          <button onClick={handleGuardar} style={{ ...btnStyle, flex: 2, background: '#378ADD', color: '#fff', borderColor: '#378ADD' }}>
            {isNew ? 'Crear evento' : 'Guardar cambios'}
          </button>
          {!isNew && (
            <button onClick={() => onEliminar(evento.id)} style={{ ...btnStyle, color: '#DC2626', borderColor: '#DC2626' }}>
              Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function CheckField({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ cursor: 'pointer' }} />
      {label}
    </label>
  );
}

function Badge({ color, bg, children }) {
  return (
    <span style={{ background: bg, color, fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>
      {children}
    </span>
  );
}

const inputStyle = {
  width: '100%',
  padding: '6px 8px',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 8,
  fontSize: 12,
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  boxSizing: 'border-box',
};

const btnStyle = {
  padding: '7px 12px',
  borderRadius: 8,
  fontSize: 12,
  cursor: 'pointer',
  border: '0.5px solid var(--color-border-tertiary)',
  background: 'none',
  color: 'var(--color-text-primary)',
};
