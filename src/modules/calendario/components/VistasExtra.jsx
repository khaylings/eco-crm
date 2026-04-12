/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: VistasExtra.jsx
 * Módulo:  Calendario
 * ============================================================
 */

import { sameDay, isInRange, formatDayFull } from '../utils/fechas';

// ─── VISTA DÍA ───────────────────────────────────
export function VistaDia({ currentDate, eventos, onEventClick }) {
  const dayEvs = eventos.filter(ev => isInRange(ev, currentDate));

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%' }}>
      <div style={{
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
        marginBottom: 12,
      }}>
        {formatDayFull(currentDate)}
      </div>

      {dayEvs.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 0',
          color: 'var(--color-text-tertiary)',
          fontSize: 13,
        }}>
          Sin eventos este día
        </div>
      ) : (
        dayEvs.map(ev => (
          <div
            key={ev.id}
            onClick={() => onEventClick(ev)}
            style={{
              display: 'flex',
              gap: 12,
              padding: 10,
              borderRadius: 8,
              marginBottom: 6,
              cursor: 'pointer',
              border: '0.5px solid var(--color-border-tertiary)',
              transition: 'background 0.1s',
            }}
            className="day-event-row"
          >
            <div style={{ width: 4, background: ev.color || '#378ADD', borderRadius: 2, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                {ev.esIncidencia && '⚑ '}{ev.titulo}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                {ev.hora || 'Todo el día'} · {ev.cliente} · {ev.tecnico}
              </div>
              {!ev.aprobado && (
                <span style={{
                  background: '#FEF3C7',
                  color: '#92400E',
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 10,
                  marginTop: 2,
                  display: 'inline-block',
                }}>
                  Sin aprobación
                </span>
              )}
            </div>
          </div>
        ))
      )}
      <style>{`.day-event-row:hover { background: var(--color-background-secondary); }`}</style>
    </div>
  );
}

// ─── VISTA AGENDA ─────────────────────────────────
export function VistaAgenda({ eventos, onEventClick }) {
  const sorted = [...eventos].sort((a, b) => (a.fechaInicio || '').localeCompare(b.fechaInicio || ''));

  // Agrupar por fecha de inicio
  const grouped = {};
  sorted.forEach(ev => {
    const key = ev.fechaInicio || 'sin-fecha';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ev);
  });

  if (Object.keys(grouped).length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
        No hay eventos próximos
      </div>
    );
  }

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%' }}>
      {Object.entries(grouped).map(([dt, evs]) => {
        const d = dt === 'sin-fecha' ? null : new Date(dt.replace(/-/g, '/'));
        const label = d ? formatDayFull(d) : 'Sin fecha asignada';

        return (
          <div key={dt} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              paddingBottom: 6,
              borderBottom: '0.5px solid var(--color-border-tertiary)',
              marginBottom: 8,
            }}>
              {label}
            </div>
            {evs.map(ev => (
              <div
                key={ev.id}
                onClick={() => onEventClick(ev)}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: 8,
                  borderRadius: 8,
                  marginBottom: 4,
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                className="agenda-row"
              >
                <div style={{ width: 4, background: ev.color || '#378ADD', borderRadius: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
                    {ev.esIncidencia && '⚑ '}{ev.titulo}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    {ev.cliente} · {ev.tecnico}
                    {!ev.aprobado && ' · Sin aprobación'}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
                  {ev.hora || 'Todo el día'}
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <style>{`.agenda-row:hover { background: var(--color-background-secondary); }`}</style>
    </div>
  );
}

// ─── PANEL SIN FECHA ─────────────────────────────
export function PanelSinFecha({ eventos, onClose, onDragStart }) {
  const sinFecha = eventos.filter(ev => !ev.fechaInicio);

  return (
    <div style={{
      width: 180,
      borderRight: '0.5px solid var(--color-border-tertiary)',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-background-primary)',
      flexShrink: 0,
    }}>
      <div style={{
        padding: '10px 12px',
        borderBottom: '0.5px solid var(--color-border-tertiary)',
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        Sin fecha
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--color-text-secondary)', lineHeight: 1 }}
        >
          ×
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {sinFecha.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '20px 0' }}>
            Sin pendientes
          </div>
        ) : (
          sinFecha.map(ev => (
            <div
              key={ev.id}
              draggable
              onDragStart={e => onDragStart(e, ev)}
              style={{
                padding: '6px 8px',
                borderRadius: 6,
                marginBottom: 4,
                cursor: 'grab',
                fontSize: 11,
                borderLeft: `3px solid ${ev.color || '#888'}`,
                color: 'var(--color-text-secondary)',
                background: 'var(--color-background-secondary)',
                userSelect: 'none',
              }}
            >
              {ev.titulo}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
