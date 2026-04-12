/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: ThemeContext.jsx
 * Módulo:  Context
 * ============================================================
 */

import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

const PALETAS = {
  bosque:    { primary: '#1a6e3c', secondary: '#d4eed9', name: 'Bosque' },
  oceano:    { primary: '#185FA5', secondary: '#deeaf7', name: 'Océano' },
  indigo:    { primary: '#534AB7', secondary: '#ebebfc', name: 'Índigo' },
  terracota: { primary: '#993C1D', secondary: '#f5e5dd', name: 'Terracota' },
  rosa:      { primary: '#993556', secondary: '#f5e0e9', name: 'Rosa' },
  carbon:    { primary: '#5F5E5A', secondary: '#eeeee8', name: 'Carbón' },
  esmeralda: { primary: '#0F6E56', secondary: '#d8f0e9', name: 'Esmeralda' },
  ambar:     { primary: '#BA7517', secondary: '#f7ecda', name: 'Ámbar' },
}

const FORMAS = {
  cuadrado:   0,
  suave:      5,
  redondeado: 16,
}

const DENSIDADES = {
  compacta:  { base: 6,  font: 12 },
  normal:    { base: 9,  font: 13 },
  espaciada: { base: 12, font: 14 },
}

const DEFAULTS = {
  paleta: 'bosque',
  primary: '#1a6e3c',
  secondary: '#d4eed9',
  forma: 'cuadrado',
  densidad: 'normal',
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function darken(hex, amount = 0.15) {
  const { r, g, b } = hexToRgb(hex)
  return `rgb(${Math.max(0, Math.floor(r * (1 - amount)))}, ${Math.max(0, Math.floor(g * (1 - amount)))}, ${Math.max(0, Math.floor(b * (1 - amount)))})`
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('eco-crm-theme')
      return saved ? JSON.parse(saved) : DEFAULTS
    } catch {
      return DEFAULTS
    }
  })

  useEffect(() => {
    const root = document.documentElement
    const { primary, secondary, forma, densidad } = theme

    root.style.setProperty('--eco-primary', primary)
    root.style.setProperty('--eco-primary-dark', darken(primary, 0.12))
    root.style.setProperty('--eco-primary-light', secondary)
    root.style.setProperty('--eco-primary-mid', darken(primary, -0.15))
    root.style.setProperty('--eco-radius', `${FORMAS[forma] ?? 0}px`)

    const den = DENSIDADES[densidad] ?? DENSIDADES.normal
    root.style.setProperty('--eco-pad', `${den.base}px`)
    root.style.setProperty('--eco-font-base', `${den.font}px`)

    try {
      localStorage.setItem('eco-crm-theme', JSON.stringify(theme))
    } catch {}
  }, [theme])

  const aplicarTema = (updates) => setTheme(prev => ({ ...prev, ...updates }))

  const aplicarPaleta = (key) => {
    const pal = PALETAS[key]
    if (pal) aplicarTema({ paleta: key, primary: pal.primary, secondary: pal.secondary })
  }

  return (
    <ThemeContext.Provider value={{ theme, aplicarTema, aplicarPaleta, PALETAS, FORMAS, DENSIDADES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
