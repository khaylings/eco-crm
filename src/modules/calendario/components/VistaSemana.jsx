/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: VistaSemana.jsx
 * Módulo:  Calendario
 * ============================================================
 */

import { useRef } from 'react';
import { getWeekDays, sameDay, isInRange, strToDate, dateToStr } from '../utils/fechas';

const HOURS = Array.from({ length: 15 }, (_, i) => i + 6); // 6am - 20pm
const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HOUR_HEIGHT = 60;

export default function VistaSemana({ currentDate, eventos, onEventClick, onDropEvent }) {
  const today = new Date();
  const weekDays = getWeekDays(currentDate);
  const dragRef = useRef(null);

  function handleDragStart(e, ev) {
    dragRef.current = ev;
    e.stopPropagation();
  }

  function handleDrop(e, day) {
    e.preventDefault();
    if (dragRef.current) {
      onDropEvent(dragRef.current, dateToStr(day));
      dragRef.current = null;
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflowY: 'auto' }}>
      {/* Columna de horas */}
      <div style={{ width: 50, flexShrink: 0, borderRight: '0.5px solid var(--color-border-tertiary)' }}>
        <div style={{ height: 52 }} />
        {HOURS.map(h => (
          <div key={h} style={{
            height: HOUR_HEIGHT,
            borderBottom: '0.5px solid var(--color-border-tertiary)',
            fontSize: 10,
            color: 'var(--color-text-tertiary)',
            textAlign: 'right',
            padding: '2px 6px 0 0',
          }}>
            {h}:00
          </div>
        ))}
      </div>

      {/* Columnas de días */}
      {weekDays.map((day, di) => {
        const isToday = sameDay(day, today);
        const dayEvs = eventos.filter(ev => isInRange(ev, day) && ev.hora);

        return (
          <div
            key={di}
            style={{
              flex: 1,
              borderRight: '0.5px solid var(--color-border-tertiary)',
              position: 'relative',
              minWidth: 0,
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDrop(e, day)}
          >
            {/* Header del día */}
            <div style={{
              height: 52,
              borderBottom: '0.5px solid var(--color-border-tertiary)',
              padding: '6px',
              textAlign: 'center',
              position: 'sticky',
              top: 0,
              background: 'var(--color-background-primary)',
              zIndex: 2,
            }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                {DAY_NAMES[di]}
              </div>
              <div style={{
                fontSize: 14,
                fontWeight: 500,
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: isToday ? '#378ADD' : 'transparent',
                color: isToday ? '#fff' : 'var(--color-text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}>
                {day.getDate()}
              </div>
            </div>

            {/* Slots de horas */}
            {HOURS.map(h => (
              <div
                key={h}
                style={{
                  height: HOUR_HEIGHT,
                  borderBottom: '0.5px solid var(--color-border-tertiary)',
                  cursor: 'pointer',
                }}
                className="week-hour-slot"
              />
            ))}

            {/* Eventos posicionados */}
            {dayEvs.map(ev => {
              const [hh, mm] = (ev.hora || '9:00').split(':').map(Number);
              const top = 52 + (hh - 6) * HOUR_HEIGHT + (mm / 60) * HOUR_HEIGHT;
              const durH = ev.duracionHoras || 1;
              const height = durH * HOUR_HEIGHT - 2;

              return (
                <div
                  key={ev.id}
                  draggable
                  onDragStart={e => handleDragStart(e, ev)}
                  onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                  style={{
                    position: 'absolute',
                    left: 2,
                    right: 2,
                    top,
                    height: Math.max(height, 22),
                    background: ev.color || '#378ADD',
                    borderRadius: 3,
                    padding: '2px 5px',
                    fontSize: 11,
                    color: '#fff',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    zIndex: 1,
                    boxSizing: 'border-box',
                  }}
                >
                  {ev.esIncidencia && <span style={{ fontSize: 9 }}>⚑ </span>}
                  <strong style={{ fontSize: 10 }}>{ev.hora}</strong> {ev.titulo}
                </div>
              );
            })}
          </div>
        );
      })}

      <style>{`.week-hour-slot:hover { background: var(--color-background-secondary); }`}</style>
    </div>
  );
}
