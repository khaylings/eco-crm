/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: useCalendario.js
 * Módulo:  Hooks
 * ============================================================
 */

import { useState, useEffect, useCallback } from 'react';
import {
  suscribirEventos,
  suscribirTiposServicio,
  obtenerFiltros,
  crearEvento,
  actualizarEvento,
  eliminarEvento,
  moverEvento,
} from '../../../firebase/calendario';

export function useCalendario() {
  const [eventos, setEventos] = useState([]);
  const [tiposServicio, setTiposServicio] = useState([]);
  const [filtrosConfig, setFiltrosConfig] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Escucha eventos en tiempo real
  useEffect(() => {
    const unsub = suscribirEventos(data => {
      setEventos(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Escucha tipos de servicio en tiempo real
  useEffect(() => {
    const unsub = suscribirTiposServicio(data => {
      setTiposServicio(data);
    });
    return unsub;
  }, []);

  // Carga filtros configurables
  useEffect(() => {
    obtenerFiltros().then(setFiltrosConfig);
  }, []);

  const handleCrearEvento = useCallback(async (data) => {
    return crearEvento(data);
  }, []);

  const handleActualizarEvento = useCallback(async (id, data) => {
    return actualizarEvento(id, data);
  }, []);

  const handleEliminarEvento = useCallback(async (id) => {
    return eliminarEvento(id);
  }, []);

  const handleMoverEvento = useCallback(async (id, fechaInicio, fechaFin) => {
    return moverEvento(id, fechaInicio, fechaFin);
  }, []);

  return {
    eventos,
    tiposServicio,
    tecnicos,
    filtrosConfig,
    loading,
    crearEvento: handleCrearEvento,
    actualizarEvento: handleActualizarEvento,
    eliminarEvento: handleEliminarEvento,
    moverEvento: handleMoverEvento,
  };
}
