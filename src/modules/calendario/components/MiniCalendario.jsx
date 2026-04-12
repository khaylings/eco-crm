/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: MiniCalendario.jsx
 * Módulo:  Calendario
 * ============================================================
 */

import { getMonthDays, formatMonthYear, sameDay, dateToStr } from '../utils/fechas';

const DAY_NAMES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function MiniCalendario({ currentDate, onChangeDate, onChangeMonth }) {
  const today = new Date();
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();
  const days = getMonthDays(currentDate);

  return (
    <div style={{ padding: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button
          onClick={() => onChangeMonth(-1)}
          style={navBtnStyle}
        >‹</button>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>
          {formatMonthYear(currentDate)}
        </span>
        <button
          onClick={() => onChangeMonth(1)}
          style={navBtnStyle}
        >›</button>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {DAY_NAMES.map((d, i) => (
          <div key={i} style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textAlign: 'center', paddingBottom: 3 }}>
            {d}
          </div>
        ))}
        {days.map((day, i) => {
          const isOther = day.getMonth() !== m;
          const isToday = sameDay(day, today);
          const isSelected = sameDay(day, currentDate);
          return (
            <div
              key={i}
              onClick={() => onChangeDate(day)}
              style={{
                fontSize: 11,
                textAlign: 'center',
                padding: '3px 2px',
                cursor: 'pointer',
                borderRadius: isToday || isSelected ? '50%' : 4,
                width: isToday || isSelected ? 20 : 'auto',
                height: isToday || isSelected ? 20 : 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: 'auto',
                background: isToday
                  ? '#378ADD'
                  : isSelected
                    ? 'var(--color-background-info)'
                    : 'transparent',
                color: isToday
                  ? '#fff'
                  : isSelected
                    ? 'var(--color-text-info)'
                    : isOther
                      ? 'var(--color-text-tertiary)'
                      : 'var(--color-text-secondary)',
              }}
            >
              {day.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const navBtnStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
  fontSize: 16,
  padding: '2px 4px',
  lineHeight: 1,
};
