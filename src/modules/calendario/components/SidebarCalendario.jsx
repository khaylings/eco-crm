/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: SidebarCalendario.jsx
 * Módulo:  Calendario
 * ============================================================
 */

import MiniCalendario from './MiniCalendario';

export default function SidebarCalendario({
  currentDate,
  onChangeDate,
  onChangeMonth,
  tiposServicio,
  tecnicos,
  filtrosConfig,
  filtrosActivos,
  onToggleFiltro,
  onNuevoEvento,
}) {
  return (
    <div style={{
      width: 220,
      borderRight: '0.5px solid var(--color-border-tertiary)',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-background-secondary)',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Botón nuevo evento */}
      <div style={{ padding: 12, borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
        <button
          onClick={onNuevoEvento}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: '#378ADD',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            justifyContent: 'center',
          }}
        >
          + Nuevo evento
        </button>
      </div>

      {/* Mini calendario */}
      <MiniCalendario
        currentDate={currentDate}
        onChangeDate={onChangeDate}
        onChangeMonth={onChangeMonth}
      />

      {/* Filtros */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        {/* Tipos de servicio */}
        <FilterGroup title="Tipo de servicio">
          {tiposServicio.map(ts => (
            <FilterChip
              key={ts.id}
              label={ts.nombre}
              color={ts.color || '#888'}
              checked={filtrosActivos.tiposServicio?.[ts.id] !== false}
              onChange={v => onToggleFiltro('tiposServicio', ts.id, v)}
            />
          ))}
        </FilterGroup>

        {/* Filtros configurables */}
        {filtrosConfig.length > 0 && (
          <FilterGroup title="Filtros rápidos">
            {filtrosConfig.map(f => (
              <FilterChip
                key={f.id}
                label={f.nombre}
                color={f.color || '#6B7280'}
                checked={filtrosActivos.custom?.[f.id] !== false}
                onChange={v => onToggleFiltro('custom', f.id, v)}
              />
            ))}
          </FilterGroup>
        )}

        {/* Filtros estáticos del sistema */}
        <FilterGroup title="Estado">
          <FilterChip
            label="Sin aprobación"
            color="#F59E0B"
            checked={filtrosActivos.sinAprobacion !== false}
            onChange={v => onToggleFiltro('sinAprobacion', null, v)}
          />
          <FilterChip
            label="Incidencias"
            color="#EF4444"
            checked={filtrosActivos.incidencias !== false}
            onChange={v => onToggleFiltro('incidencias', null, v)}
          />
          <FilterChip
            label="Sin asignar"
            color="#6B7280"
            checked={filtrosActivos.sinAsignar !== false}
            onChange={v => onToggleFiltro('sinAsignar', null, v)}
          />
        </FilterGroup>

        {/* Técnicos */}
        {tecnicos.length > 0 && (
          <FilterGroup title="Técnico">
            {tecnicos.map((t, i) => {
              const colors = ['#534AB7', '#0F6E56', '#993C1D', '#185FA5', '#993556'];
              const color = colors[i % colors.length];
              return (
                <FilterChip
                  key={t.id}
                  label={t.nombre || t.email}
                  color={color}
                  checked={filtrosActivos.tecnicos?.[t.id] !== false}
                  onChange={v => onToggleFiltro('tecnicos', t.id, v)}
                />
              );
            })}
          </FilterGroup>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 500,
        color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: 6,
        marginTop: 12,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function FilterChip({ label, color, checked, onChange }) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 0',
      cursor: 'pointer',
      fontSize: 12,
      color: 'var(--color-text-secondary)',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ width: 12, height: 12, cursor: 'pointer', accentColor: color }}
      />
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </label>
  );
}
