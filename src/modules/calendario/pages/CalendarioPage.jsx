/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: CalendarioPage.jsx
 * Módulo:  Calendario
 * ============================================================
 */

import { useState, useRef } from 'react';
import SidebarCalendario from '../components/SidebarCalendario';
import VistaMes from '../components/VistaMes';
import VistaSemana from '../components/VistaSemana';
import { VistaDia, VistaAgenda, PanelSinFecha } from '../components/VistasExtra';
import ModalEvento from '../components/ModalEvento';
import PanelOT from '../components/PanelOT';
import { useCalendario } from '../hooks/useCalendario';
import {
  formatMonthYear, getWeekDays, formatDayFull,
  strToDate, dateToStr, getDiffDays, addDays
} from '../utils/fechas';

const VISTAS = ['mes', 'semana', 'dia', 'agenda', 'sin-fecha'];

export default function CalendarioPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [vistaActual, setVistaActual] = useState('mes');
  const [mostrarSinFecha, setMostrarSinFecha] = useState(false);
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [panelOTAbierto, setPanelOTAbierto] = useState(false);
  const [fechaInicialModal, setFechaInicialModal] = useState('');
  const [filtrosActivos, setFiltrosActivos] = useState({ tiposServicio: {}, tecnicos: {}, custom: {} });
  const ndDragRef = useRef(null);

  const {
    eventos,
    tiposServicio,
    tecnicos,
    filtrosConfig,
    crearEvento,
    actualizarEvento,
    eliminarEvento,
    moverEvento,
  } = useCalendario();

  // ─── Filtrado ──────────────────────────────────
  const eventosFiltrados = eventos.filter(ev => {
    // Tipo de servicio
    if (ev.tipoServicioId && filtrosActivos.tiposServicio[ev.tipoServicioId] === false) return false;
    // Técnico
    if (ev.tecnicoId && filtrosActivos.tecnicos[ev.tecnicoId] === false) return false;
    return true;
  });

  function toggleFiltro(grupo, id, value) {
    setFiltrosActivos(prev => {
      if (id === null) {
        return { ...prev, [grupo]: value };
      }
      return {
        ...prev,
        [grupo]: { ...(prev[grupo] || {}), [id]: value },
      };
    });
  }

  // ─── Navegación ────────────────────────────────
  function navigate(dir) {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (vistaActual === 'mes') return new Date(d.getFullYear(), d.getMonth() + dir, 1);
      if (vistaActual === 'semana') { d.setDate(d.getDate() + dir * 7); return d; }
      d.setDate(d.getDate() + dir);
      return d;
    });
  }

  function getTitleLabel() {
    if (vistaActual === 'mes') return formatMonthYear(currentDate);
    if (vistaActual === 'semana') {
      const days = getWeekDays(currentDate);
      const from = days[0], to = days[6];
      return `${from.getDate()} ${from.toLocaleDateString('es-CR', { month: 'short' })} – ${to.getDate()} ${to.toLocaleDateString('es-CR', { month: 'short', year: 'numeric' })}`;
    }
    if (vistaActual === 'dia') return formatDayFull(currentDate);
    if (vistaActual === 'agenda') return 'Agenda';
    return 'Sin fecha';
  }

  // ─── Eventos del calendario ────────────────────
  function handleEventClick(ev) {
    setEventoSeleccionado(ev);
    setModalAbierto(true);
  }

  function handleCellClick(dateStr) {
    setEventoSeleccionado(null);
    setFechaInicialModal(dateStr);
    setModalAbierto(true);
  }

  function handleNuevoEvento() {
    setEventoSeleccionado(null);
    setFechaInicialModal(dateToStr(currentDate));
    setModalAbierto(true);
  }

  async function handleGuardar(data) {
    try {
      if (eventoSeleccionado) {
        await actualizarEvento(eventoSeleccionado.id, data);
      } else {
        await crearEvento(data);
      }
      setModalAbierto(false);
      setEventoSeleccionado(null);
    } catch (err) {
      console.error('Error al guardar evento:', err);
    }
  }

  async function handleEliminar(id) {
    if (!window.confirm('¿Eliminar este evento?')) return;
    await eliminarEvento(id);
    setModalAbierto(false);
    setEventoSeleccionado(null);
  }

  async function handleDropEvent(evento, nuevaFechaStr) {
    const duracion = getDiffDays(evento.fechaInicio, evento.fechaFin || evento.fechaInicio);
    if (duracion > 0) {
      const ok = window.confirm(
        `¿Mover "${evento.titulo}" al ${nuevaFechaStr}?\n` +
        `El evento tiene ${duracion} día(s) de duración. Se ajustará la fecha fin automáticamente.`
      );
      if (!ok) return;
    }
    const nuevaFechaFin = addDays(nuevaFechaStr, duracion);
    await moverEvento(evento.id, nuevaFechaStr, nuevaFechaFin);
  }

  function handleDragNDStart(e, ev) {
    ndDragRef.current = ev;
  }

  function handleVerOT(ev) {
    setEventoSeleccionado(ev);
    setModalAbierto(false);
    setPanelOTAbierto(true);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--color-background-tertiary)', overflow: 'hidden' }}>

      {/* Sidebar izquierdo */}
      <SidebarCalendario
        currentDate={currentDate}
        onChangeDate={d => setCurrentDate(d)}
        onChangeMonth={dir => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + dir, 1))}
        tiposServicio={tiposServicio}
        tecnicos={tecnicos}
        filtrosConfig={filtrosConfig}
        filtrosActivos={filtrosActivos}
        onToggleFiltro={toggleFiltro}
        onNuevoEvento={handleNuevoEvento}
      />

      {/* Panel sin fecha */}
      {mostrarSinFecha && (
        <PanelSinFecha
          eventos={eventosFiltrados}
          onClose={() => setMostrarSinFecha(false)}
          onDragStart={handleDragNDStart}
        />
      )}

      {/* Área principal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-background-primary)' }}>

        {/* Header del calendario */}
        <div style={{
          height: 52,
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 12,
          flexShrink: 0,
        }}>
          {/* Navegación */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <NavBtn onClick={() => navigate(-1)}>‹</NavBtn>
            <NavBtn onClick={() => setCurrentDate(new Date())}>Hoy</NavBtn>
            <NavBtn onClick={() => navigate(1)}>›</NavBtn>
          </div>

          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', minWidth: 180 }}>
            {getTitleLabel()}
          </div>

          {/* Vistas */}
          <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
            {[
              { key: 'mes', label: 'Mes' },
              { key: 'semana', label: 'Semana' },
              { key: 'dia', label: 'Día' },
              { key: 'agenda', label: 'Agenda' },
            ].map(v => (
              <button
                key={v.key}
                onClick={() => setVistaActual(v.key)}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  borderRadius: 8,
                  cursor: 'pointer',
                  border: '0.5px solid var(--color-border-tertiary)',
                  background: vistaActual === v.key ? '#378ADD' : 'none',
                  color: vistaActual === v.key ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                {v.label}
              </button>
            ))}
            <button
              onClick={() => setMostrarSinFecha(p => !p)}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                borderRadius: 8,
                cursor: 'pointer',
                border: '0.5px solid var(--color-border-tertiary)',
                background: mostrarSinFecha ? 'var(--color-background-info)' : 'none',
                color: mostrarSinFecha ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
              }}
            >
              Sin fecha
            </button>
          </div>

          {/* Botón OT */}
          <button
            onClick={() => setPanelOTAbierto(p => !p)}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              borderRadius: 8,
              cursor: 'pointer',
              border: '0.5px solid var(--color-border-tertiary)',
              background: panelOTAbierto ? '#378ADD' : 'none',
              color: panelOTAbierto ? '#fff' : 'var(--color-text-secondary)',
            }}
          >
            OT
          </button>
        </div>

        {/* Cuerpo del calendario */}
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {vistaActual === 'mes' && (
            <VistaMes
              currentDate={currentDate}
              eventos={eventosFiltrados}
              onEventClick={handleEventClick}
              onCellClick={handleCellClick}
              onDropEvent={handleDropEvent}
            />
          )}
          {vistaActual === 'semana' && (
            <VistaSemana
              currentDate={currentDate}
              eventos={eventosFiltrados}
              onEventClick={handleEventClick}
              onDropEvent={handleDropEvent}
            />
          )}
          {vistaActual === 'dia' && (
            <VistaDia
              currentDate={currentDate}
              eventos={eventosFiltrados}
              onEventClick={handleEventClick}
            />
          )}
          {vistaActual === 'agenda' && (
            <VistaAgenda
              eventos={eventosFiltrados}
              onEventClick={handleEventClick}
            />
          )}

          {/* Modal de evento */}
          {modalAbierto && (
            <ModalEvento
              evento={eventoSeleccionado}
              tiposServicio={tiposServicio}
              tecnicos={tecnicos}
              fechaInicial={fechaInicialModal}
              onClose={() => setModalAbierto(false)}
              onGuardar={handleGuardar}
              onEliminar={handleEliminar}
              onVerOT={handleVerOT}
            />
          )}
        </div>
      </div>

      {/* Panel OT */}
      {panelOTAbierto && (
        <PanelOT
          evento={eventoSeleccionado}
          onClose={() => setPanelOTAbierto(false)}
          onActualizar={actualizarEvento}
        />
      )}
    </div>
  );
}

function NavBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 8,
        cursor: 'pointer',
        color: 'var(--color-text-primary)',
        padding: '4px 8px',
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}
