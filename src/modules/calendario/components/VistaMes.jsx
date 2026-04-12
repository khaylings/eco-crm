/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: VistaMes.jsx
 * Módulo:  Calendario
 * ============================================================
 */

import { useRef } from 'react';
import { getMonthDays, sameDay, isInRange, isMultiday, strToDate, dateToStr } from '../utils/fechas';

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function VistaMes({ currentDate, eventos, onEventClick, onCellClick, onDropEvent }) {
  const today = new Date();
  const days = getMonthDays(currentDate);
  const dragRef = useRef(null);

  function handleDragStart(e, evento) {
    dragRef.current = evento;
    e.stopPropagation();
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('cal-drag-over');
  }

  function handleDragLeave(e) {
    e.currentTarget.classList.remove('cal-drag-over');
  }

  function handleDrop(e, day) {
    e.preventDefault();
    e.currentTarget.classList.remove('cal-drag-over');
    if (dragRef.current) {
      onDropEvent(dragRef.current, dateToStr(day));
      dragRef.current = null;
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: '100%' }}>
      {/* Headers */}
      {DAY_NAMES.map(d => (
        <div key={d} style={{
          padding: '6px',
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
          textAlign: 'center',
          fontWeight: 500,
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          position: 'sticky',
          top: 0,
          background: 'var(--color-background-primary)',
          zIndex: 2,
        }}>
          {d}
        </div>
      ))}

      {/* Cells */}
      {days.map((day, i) => {
        const isOther = day.getMonth() !== currentDate.getMonth();
        const isToday = sameDay(day, today);
        const dayEvs = eventos.filter(ev => isInRange(ev, day));

        return (
          <div
            key={i}
            className="cal-month-cell"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, day)}
            onClick={() => onCellClick(dateToStr(day))}
            style={{
              borderRight: '0.5px solid var(--color-border-tertiary)',
              borderBottom: '0.5px solid var(--color-border-tertiary)',
              padding: 4,
              minHeight: 90,
              cursor: 'pointer',
              opacity: isOther ? 0.45 : 1,
              position: 'relative',
              transition: 'background 0.1s',
            }}
          >
            {/* Número del día */}
            <div style={{
              fontSize: 12,
              fontWeight: 500,
              color: isToday ? '#fff' : 'var(--color-text-secondary)',
              background: isToday ? '#378ADD' : 'transparent',
              borderRadius: '50%',
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 2,
            }}>
              {day.getDate()}
            </div>

            {/* Eventos */}
            {dayEvs.slice(0, 3).map(ev => {
              const multi = isMultiday(ev);
              const isStart = multi ? sameDay(strToDate(ev.fechaInicio), day) : true;
              const isEnd = multi ? sameDay(strToDate(ev.fechaFin), day) : true;

              return (
                <EventChip
                  key={ev.id}
                  ev={ev}
                  isMulti={multi}
                  isStart={isStart}
                  isEnd={isEnd}
                  onDragStart={e => handleDragStart(e, ev)}
                  onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                />
              );
            })}
            {dayEvs.length > 3 && (
              <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', padding: '1px 4px' }}>
                +{dayEvs.length - 3} más
              </div>
            )}
          </div>
        );
      })}

      <style>{`
        .cal-month-cell:hover { background: var(--color-background-secondary); }
        .cal-drag-over { background: var(--color-background-info) !important; outline: 2px dashed #378ADD; outline-offset: -2px; }
      `}</style>
    </div>
  );
}

function EventChip({ ev, isMulti, isStart, isEnd, onDragStart, onClick }) {
  const borderRadius = isMulti
    ? isStart && isEnd
      ? 3
      : isStart
        ? '3px 0 0 3px'
        : isEnd
          ? '0 3px 3px 0'
          : 0
    : 3;

  const marginLeft = isMulti && !isStart ? -4 : 0;
  const marginRight = isMulti && !isEnd ? -4 : 0;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      title={ev.titulo}
      style={{
        padding: '2px 5px',
        borderRadius,
        fontSize: 10,
        marginBottom: 1,
        marginLeft,
        marginRight,
        cursor: 'grab',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: '#fff',
        background: ev.color || '#378ADD',
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        transition: 'opacity 0.1s',
        userSelect: 'none',
      }}
    >
      {ev.esIncidencia && <span style={{ fontSize: 9 }}>⚑</span>}
      {!ev.aprobado && <span style={{ fontSize: 9, opacity: 0.85 }}>!</span>}
      {(isStart || !isMulti) && ev.hora && (
        <span style={{ opacity: 0.85, fontSize: 9 }}>{ev.hora}</span>
      )}
      {(isStart || !isMulti) && ev.titulo}
    </div>
  );
}
