/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: src/hooks/useSecureConfig.js
 * Módulo:  Hook para acceder a configuración segura en runtime
 *
 * CONFIDENCIAL — No loguear ni exponer los valores retornados.
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { loadSecureConfig } from '@/lib/secureConfig'

/**
 * Hook para cargar y acceder a la configuración segura del sistema.
 * Los datos se desencriptan en memoria y no se persisten.
 *
 * Uso:
 *   const { config, loading, error } = useSecureConfig()
 *   const apiKey = config?.wasender?.apiKey  // valor desencriptado
 */
export function useSecureConfig() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true

    loadSecureConfig()
      .then(cfg => {
        if (mounted) {
          setConfig(cfg)
          setLoading(false)
        }
      })
      .catch(err => {
        if (mounted) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { mounted = false }
  }, [])

  return { config, loading, error }
}