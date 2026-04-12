/**
 * ============================================================
 * Eco Ingeniería CR — Sistema de Gestión Empresarial
 * Copyright (c) 2024 Eco Ingeniería CR. Todos los derechos reservados.
 *
 * Archivo: BotAyuda.jsx
 * Módulo:  Shared
 * ============================================================
 */

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'

// ── Documentación del sistema embebida como contexto ─────────────────────────
const SYSTEM_PROMPT = `Eres el asistente de ayuda de Eco Ingeniería CR. Tu nombre es "Bot Eco Ingeniería CR". Eres amable, directo y respondés en español.

Tu misión es ayudar a los usuarios del CRM con cualquier pregunta sobre el sistema y también con preguntas generales de negocio.

## DOCUMENTACIÓN COMPLETA DEL SISTEMA

### STACK TECNOLÓGICO
- Frontend: React + Vite
- Base de datos: Firebase Firestore (tiempo real)
- Autenticación: Firebase Auth
- Archivos: Firebase Storage
- Hosting: eco-crm-da4eb.web.app
- WhatsApp: WasenderAPI (webhook activo)
- Deploy local: C:\\Users\\airec\\CRM\\eco-crm

### MÓDULOS DEL SISTEMA

**1. AUTENTICACIÓN Y SEGURIDAD**
Roles disponibles:
- Super Administrador: acceso total, puede eliminar otros admins, cambiar cualquier rol
- Administrador: gestión completa excepto eliminar otros admins
- Supervisor: permisos configurables, ve datos de todos los vendedores
- Vendedor: solo ve sus conversaciones y leads asignados

Permisos granulares por módulo (configurables en Configuración > Roles):
- CRM: ver, crear, editar, eliminar, ver_todos, reasignar
- Chats: ver, responder, ver_todos, asignar
- Cotizaciones: ver, crear, editar, eliminar, ver_precios, ver_todas, aprobar, enviar
- Facturas: ver, crear, registrar_pago, eliminar, ver_todas, ver_montos
- Productos/Inventario: ver, crear, editar, eliminar, ver_costos, ver_inventario, ajustar_stock
- Compras: ver, crear, editar, aprobar, eliminar
- Bancos: ver, registrar_movimiento, editar, eliminar

Para reiniciar contraseña: Configuración > Usuarios > botón "Reiniciar contraseña" envía email automático.

**2. DASHBOARD / INICIO**
Métricas en tiempo real desde Firestore:
- Leads activos (colección leads, no están en etapa Cerrado)
- Ventas del mes (cotizaciones aceptadas del mes actual)
- Cotizaciones pendientes (estado Enviada o En revisión)
- Chats sin responder (sin respuesta del agente)
- Eventos de hoy (colección calendario)
- Facturas por cobrar (estado Enviada o Parcial)

El dashboard también muestra:
- Pipeline visual de leads por etapa
- Leads recientes con el vendedor asignado
- Actividad reciente del equipo (nuevos leads, cotizaciones enviadas/cerradas)
- Los colores de actividad son estables por vendedor

Widget de tasas: muestra compra/venta del dólar. Se actualiza en Configuración > Conectores > Tasas. Admin y Supervisor pueden editarlo haciendo clic en el widget del header.

Pista de Carreras: panel gamificado de comisiones por vendedor. La foto del vendedor es el avatar en la pista. La meta mensual y porcentajes de comisión se configuran en Configuración > Roles. Se alimenta de las facturas aprobadas.

**3. CHATS DE WHATSAPP**
- Conversaciones llegan via webhook de WasenderAPI a Firestore (colección: conversaciones)
- El agente responde desde el CRM sin salir de la plataforma
- Los vendedores solo ven sus conversaciones asignadas
- Solicitar ayuda: un vendedor puede pedir apoyo de otro agente
- Crear contacto desde el chat: botón en panel lateral, soporta Persona Física y Jurídica
- Si es Jurídica se pide nombre de empresa además de los datos personales
- Al guardar el contacto, el nombre se sincroniza automáticamente en el chat
- Cotizar desde el chat: botón de acción rápida que crea cotización asociada al lead
- Grupos internos del equipo: comunicación interna, colección chats_internos

**4. CRM — KANBAN Y LEADS**
- Tablero Kanban con etapas arrastrables (etapas editables en Configuración > Catálogos)
- Los leads se arrastran entre etapas
- Vendedores ven solo sus leads; admin ve todos con filtro por usuario
- Crear lead: botón "+" en el tablero

Ficha del Lead (vista 360°) — pestañas:
- General: nombre, empresa, etapa, fuente, asignado, etiquetas, prioridad
- Contactos: contactos asociados con soporte para múltiples sedes
- Sedes: ubicaciones físicas del cliente, cada sede tiene dirección, contactos y activos propios
- Activos: equipos instalados (equipos AC, maquinaria) vinculados a sedes
- Chats WA: historial de conversaciones vinculadas al lead
- Chat interno: canal privado del equipo sobre este lead
- Cotizaciones: lista de cotizaciones con navegación directa (clic → abre la cotización)
- Proyectos: lista de proyectos vinculados con acceso de un clic
- Notas: texto libre para notas internas

Datos de facturación por entidad:
- Persona Física: nombre fiscal, cédula, email, teléfono, dirección fiscal, IBAN, notas
- Empresa Jurídica: razón social, cédula jurídica/RUC/NIT, régimen tributario, dirección fiscal, email, teléfono, IBAN, condición de pago

**5. COTIZACIONES**
Crear cotización desde: módulo Cotizaciones (menú Comercial) o desde el chat (acción rápida) o desde la ficha del lead (pestaña Cotizaciones).

Campos principales:
- Número: automático con prefijo configurable (ej: COT-001) — configurable en Configuración > Consecutivos
- Cliente/Lead: vincula la cotización a un lead del CRM
- Moneda: CRC o USD (tasa de cambio del día se aplica automáticamente)
- Condición de pago: configurable por cotización
- Productos: se seleccionan del catálogo de inventario, el precio se llena automáticamente
- Productos opcionales: el cliente puede activar/desactivar ítems en el portal público
- Opciones A/B/C: hasta 3 opciones distintas para que el cliente elija
- Descuento: por ítem en porcentaje
- IVA: configurable, se aplica sobre el subtotal
- Observaciones: texto libre con plantillas predefinidas (se configuran en Configuración > Plantilla Cotización > tab Observaciones)
- Fichas técnicas: adjuntos de los productos aparecen automáticamente

Portal público del cliente (enlace único):
1. Si hay múltiples opciones → el cliente elige cuál prefiere
2. El cliente activa/desactiva opcionales, el total se recalcula en tiempo real
3. Al aceptar → firma digital con nombre
4. El vendedor recibe notificación instantánea
5. La cotización cambia a "Aceptada" y queda bloqueada

Estados de cotización: Borrador → Enviada → En revisión → Aceptada / Rechazada → Facturada

Plantilla visual (Configuración > Plantilla Cotización):
- Editor visual tipo Canva con widgets arrastrables
- Header y footer personalizables (logos, textos, líneas)
- Portadas intercambiables desde galería
- Bloques de contenido reordenables (tabla, observaciones, totales, términos)
- Plantillas de observaciones: banco de textos reutilizables

**6. PROYECTOS**
Similar a cotizaciones pero orientado a propuestas de trabajo por fases.
- Consecutivos independientes (ej: PRY-001)
- Secciones especiales: Alcance del proyecto, Fases de ejecución
- Plantilla visual propia en Configuración > Plantilla Proyectos
- Portal público con firma digital igual que cotizaciones
- Plantillas de observaciones propias

**7. INVENTARIO**
Tres tipos de productos:
- Producto físico: tiene stock, se descuenta por venta y por salida en servicio
- Servicio: sin stock, tiene tiempo estimado y score de dificultad
- Desagregado: conjunto de productos/servicios, el costo se calcula automáticamente sumando componentes

Campos de productos: nombre, código/SKU, categoría, precio de costo, precio de venta, IVA, va a inventario, stock actual, tiempo estimado (servicios), score (servicios), ficha técnica, adjuntos, componentes (desagregados).

Importación masiva desde Excel:
- Descargar plantilla desde el módulo (botón "Plantilla")
- Hay dos plantillas: Productos/Servicios y Desagregados
- Al importar, el sistema reporta qué componentes no se encontraron

Movimientos de inventario: salida por venta, salida por servicio, entrada manual. Cada producto tiene historial de entradas y salidas.

Categorías de productos: configurables en Configuración > Catálogos.

**8. FACTURACIÓN**
Regla fundamental: la factura SIEMPRE nace de una cotización en estado "Aceptada". No se puede facturar sin cotización aprobada.

Flujo:
1. Cliente acepta cotización con firma digital
2. Cotización cambia a "Aceptada" automáticamente
3. Vendedor asignado (o usuario con permiso facturas.crear) crea la factura
4. Se envía la factura al cliente
5. Se registran pagos/abonos manualmente
6. Estado cambia automáticamente según pagos

Estados de factura: Borrador → Enviada → Parcialmente pagada → Pagada / Incobrable

Pagos y abonos:
- Una cotización genera exactamente UNA factura
- La factura puede tener múltiples pagos hasta cubrir el total
- El saldo pendiente se calcula automáticamente
- Permiso facturas.registrar_pago controla quién puede registrar abonos
- Permiso facturas.eliminar requiere asignación explícita
- Los montos solo son visibles con permiso facturas.ver_montos

**9. COMPRAS**
Órdenes de compra:
- Número automático configurable (ej: OC-001)
- Se selecciona proveedor del catálogo
- Plantilla visual editable igual que cotizaciones
- Estados: Borrador, Enviada, Recibida, Cancelada

Proveedores: catálogo con datos de contacto, historial de órdenes, datos de facturación.

Gastos recurrentes: gastos fijos periódicos (alquiler, salarios, servicios). Frecuencia: mensual, quincenal, semanal, anual. Se integran en el flujo de caja de Finanzas.

**10. BANCOS Y FINANZAS**
Bancos: movimientos en CRC y USD, tipos ingreso/egreso/transferencia, saldo automático por cuenta y moneda.

Módulo de Finanzas — solo visible para Administradores y Super Administradores. Tiene 10 pestañas:

1. Dashboard financiero: posición financiera neta, cuadrante CxC/CxP/Activos/Pasivos, alertas automáticas
2. Estado de Resultados: toggle mensual/anual, ingresos (pagos de facturas) vs gastos (órdenes pagadas), utilidad y margen
3. Balance General: inventario con método PEPS, activos/pasivos/patrimonio, alertas con botón inline para meter precio
4. CxC (Cuentas por Cobrar): facturas pendientes con opción de abono parcial directo desde esta vista
5. CxP (Cuentas por Pagar): órdenes con crédito pendiente, barra de progreso, botón Abonar
6. Compras: todas las órdenes de compra con filtros + botón Nueva Orden (Compras vive dentro de Finanzas, no en menú separado)
7. Proveedores: CRUD completo inline sin salir de Finanzas
8. Gastos Recurrentes: vista por urgencia con botón "Registrar período"
9. Deudas: préstamos informales (ej: "le debo a papá ₡500,000 para el alquiler"). Campos: descripción, acreedor, tipo (empresa_debe/yo_debo), monto, moneda, fecha, usado_para, estado (pendiente/pagado). Con abonos parciales y barra de progreso
10. Flujo de Caja: histórico real (pagos registrados) + proyección futura (CxC pendiente vs CxP pendiente), todo en USD

Nota: El módulo de Compras (/compras) desapareció del menú principal — ahora vive dentro de Finanzas. Las rutas /compras/* siguen funcionando internamente.

**11. CALENDARIO**
Vistas: Mes, Semana, Día, Sin fecha (tareas sin fecha definida).
- Eventos arrastrables entre días y dentro del mismo día
- Soporte para eventos por horas, días completos, días no continuos
- Múltiples etiquetas de color por evento
- Asignación de técnicos o usuarios
- Etiquetas configurables en Configuración > Catálogos > Etiquetas

**12. CONFIGURACIÓN**
Solo Admin y Super Admin tienen acceso completo.

Mi Empresa: nombre, razón social, cédula, teléfono, dirección, logo (se sube a Firebase Storage), datos que se usan en documentos.

Usuarios: lista completa, crear usuarios (genera cuenta en Firebase Auth), cambiar roles, reiniciar contraseñas. El Super Admin puede eliminar otros administradores.

Roles y Permisos: crear/editar roles, matriz de permisos granulares, configurar meta mensual y comisiones (afecta la Pista de Carreras).

Plantillas visuales (editor tipo Canva):
- Header/footer con widgets arrastrables: logos, textos, líneas, imágenes
- Portadas: galería de imágenes en formato carta
- Bloques de contenido reordenables
- Plantillas de observaciones: banco de textos predefinidos
- Disponible para: Cotizaciones, Proyectos, Órdenes de Compra

Consecutivos: prefijo y número inicial editable para cada tipo de documento (COT, PRY, FAC, OC).

Catálogos y Etiquetas: categorías de productos, etapas del CRM, etiquetas del calendario, fuentes de leads, listas de precios.

Contactos (sección en Configuración): gestión de campos de facturación dinámicos por tipo de entidad. Podés agregar, editar, reordenar y eliminar campos para Persona Física y Persona Jurídica. Estos campos los leen automáticamente ChatContactoPanel, ContactoForm y EmpresaForm.

Conectores:
- WhatsApp (WasenderAPI): hasta 3 números Business, ver estado de sesión, conectar/desconectar, ver QR
- Tasas de cambio (BCCR): tasa USD/CRC del día
- IA — Anthropic: configuración de API Key para Claude (en desarrollo)

**13. SISTEMA DE DISEÑO**
Variables CSS globales que se alimentan desde Firestore (configuración/empresa):
- --eco-primary: color principal de botones y acentos
- --eco-primary-light: versión suave del color principal
- --eco-border: color de bordes
- --eco-radius: radio de esquinas

Todo el CRM adopta la paleta de colores configurada en Mi Empresa.

**14. COMANDOS FRECUENTES**
- Desarrollo local: cd C:\\Users\\airec\\CRM\\eco-crm && npm run dev → http://localhost:5173
- Compilar: npm run build
- Deploy: firebase deploy --only hosting
- Limpiar caché: rmdir /s /q node_modules\\.vite

**15. IA YA INTEGRADA**
El bot de ayuda (Bot Eco Ingeniería CR) ya está activo en el header del CRM (botón ?). Llama a la API de Anthropic con claude-haiku y tiene toda la documentación del sistema como contexto. Cualquier usuario puede usarlo.

La API Key se configura en el archivo .env como VITE_ANTHROPIC_API_KEY.

**16. PENDIENTES**
- Check de facturada/sin facturar en lista de cotizaciones
- Historial unificado del cliente (consolidar todos los leads, chats, facturas y proyectos)
- IA en el CRM: resumen de chat WhatsApp, asistente de redacción WA, pre-llenado de cotización desde texto libre, redacción por comando de voz
- Portal público de proyectos: falta crear la vista pública equivalente a CotizacionPublica.jsx para proyectos
- Bot de ayuda IA: ya integrado en el header (ícono ?) con documentación del sistema completa
- Análisis de planos: página donde se sube un plano y la IA sugiere ubicaciones, medidas y cotización de equipos AC
- Check facturada/sin facturar: indicador visual en lista de cotizaciones

---

## INSTRUCCIONES DE COMPORTAMIENTO

1. Respondé SIEMPRE en español
2. Sé directo y concreto — respondé lo que preguntaron
3. Si la pregunta es sobre el sistema, usá la documentación de arriba
4. Si la pregunta es de negocio general (ventas, gestión, finanzas, etc.), respondé con tu conocimiento
5. Si no sabés algo específico del sistema que no está documentado, decilo claramente
6. Usá emojis con moderación para hacer las respuestas más legibles
7. Para preguntas técnicas de "cómo hacer X", dá pasos numerados
8. Máximo 300 palabras por respuesta a menos que el tema lo requiera`

// ── Sugerencias por rol ───────────────────────────────────────────────────────
const SUGERENCIAS_POR_ROL = {
  'Vendedor': [
    '¿Cómo creo una cotización desde el chat?',
    '¿Cómo actualizo la etapa de un lead?',
    '¿Cómo registro una nota en un lead?',
    '¿Cómo veo mis comisiones del mes?',
    '¿Cómo agrego un contacto desde WhatsApp?',
    '¿Cómo solicito ayuda de otro agente?',
  ],
  'Supervisor': [
    '¿Cómo veo las cotizaciones de todos los vendedores?',
    '¿Cómo filtro los leads por vendedor?',
    '¿Cómo funciona la pista de carreras?',
    '¿Cómo veo las facturas pendientes del equipo?',
    '¿Cómo reasigno un lead a otro vendedor?',
    '¿Qué métricas muestra el dashboard?',
  ],
  'Administrador': [
    '¿Cómo configuro los permisos de un rol?',
    '¿Cómo configuro los consecutivos?',
    '¿Cómo edito la plantilla de cotización?',
    '¿Cómo registro un pago parcial en una factura?',
    '¿Cómo importo productos desde Excel?',
    '¿Cómo conecto WhatsApp Business?',
  ],
  'Super Administrador': [
    '¿Cómo creo un nuevo usuario?',
    '¿Cómo cambio el rol de un usuario?',
    '¿Cómo configuro las tasas de cambio?',
    '¿Cómo edito la plantilla visual de cotización?',
    '¿Cómo gestiono el módulo de Finanzas?',
    '¿Cómo configuro los consecutivos del sistema?',
  ],
  'default': [
    '¿Cómo creo una cotización?',
    '¿Cómo uso el módulo de chats?',
    '¿Cómo registro un pago en una factura?',
    '¿Cómo importo productos desde Excel?',
    '¿Dónde configuro los consecutivos?',
    '¿Cómo funciona la pista de carreras?',
  ],
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function BotAyuda({ onCerrar }) {
  const { usuario } = useAuth()
  const rol = usuario?.rol || 'default'
  const nombre = usuario?.nombre?.split(' ')[0] || ''
  const sugerencias = SUGERENCIAS_POR_ROL[rol] || SUGERENCIAS_POR_ROL['default']

  const saludo = rol === 'Vendedor'
    ? `¡Hola ${nombre}! 👋 Soy el Bot de Eco Ingeniería CR. Puedo ayudarte con tus leads, cotizaciones y chats. ¿En qué te ayudo?`
    : rol === 'Supervisor'
    ? `¡Hola ${nombre}! 👋 Soy el Bot de Eco Ingeniería CR. Puedo ayudarte con métricas del equipo, reportes y gestión. ¿En qué te ayudo?`
    : rol === 'Administrador' || rol === 'Super Administrador'
    ? `¡Hola ${nombre}! 👋 Soy el Bot de Eco Ingeniería CR. Tengo acceso a toda la documentación técnica del sistema. ¿En qué te ayudo?`
    : '¡Hola! 👋 Soy el Bot de Eco Ingeniería CR. ¿En qué te puedo ayudar?'

  const [mensajes, setMensajes]   = useState([
    { rol: 'asistente', texto: saludo }
  ])
  const [input,    setInput]      = useState('')
  const [cargando, setCargando]   = useState(false)
  const [error,    setError]      = useState(null)
  const bottomRef  = useRef()
  const inputRef   = useRef()
  const geminiKey  = import.meta.env.VITE_GEMINI_API_KEY

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, cargando])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const enviar = async (texto) => {
    const pregunta = (texto || input).trim()
    if (!pregunta || cargando) return
    setInput('')
    setError(null)

    const nuevosMensajes = [...mensajes, { rol: 'usuario', texto: pregunta }]
    setMensajes(nuevosMensajes)
    setCargando(true)

    try {
      const historial = nuevosMensajes.map(m => ({
        role: m.rol === 'usuario' ? 'user' : 'assistant',
        content: m.texto,
      }))

      const systemConRol = SYSTEM_PROMPT + `

## USUARIO ACTUAL
Nombre: ${usuario?.nombre || 'Usuario'}
Rol: ${rol}

Adaptá tus respuestas al nivel de acceso y necesidades de este rol. Si es Vendedor, enfocate en su trabajo diario. Si es Supervisor, en métricas y equipo. Si es Admin o Super Admin, podés entrar en detalles técnicos de configuración.`

      // Convertir historial al formato Gemini
      const contenidos = historial.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }))

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemConRol }] },
            contents: contenidos,
            generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
          }),
        }
      )

      if (!geminiRes.ok) {
        const err = await geminiRes.json()
        throw new Error(err?.error?.message || `Error ${geminiRes.status}`)
      }

      const geminiData = await geminiRes.json()
      const respuesta = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'No pude generar una respuesta.'
      setMensajes(prev => [...prev, { rol: 'asistente', texto: respuesta }])
    } catch (e) {
      console.error('Bot error:', e)
      setError(e.message || 'Error al conectar con el asistente.')
    } finally {
      setCargando(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
  }

  const limpiar = () => {
    setMensajes([{ rol: "asistente", texto: saludo }])
    setError(null)
    setInput('')
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, right: 0,
      width: 420, height: '88vh', maxHeight: 680,
      background: '#fff', borderRadius: '14px 0 0 0',
      boxShadow: '0 -4px 40px rgba(0,0,0,.18)',
      border: '0.5px solid rgba(0,0,0,.1)',
      display: 'flex', flexDirection: 'column',
      zIndex: 10002, overflow: 'hidden',
      fontFamily: 'inherit',
    }}>

      {/* ── Header ── */}
      <div style={{ background: 'var(--eco-primary, #185FA5)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            🤖
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>Bot Eco Ingeniería CR</div>
            <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 11 }}>
              {cargando ? 'Escribiendo...' : 'Listo para ayudarte'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={limpiar} title="Nueva conversación"
            style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
          <button onClick={onCerrar} title="Cerrar"
            style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}>
            ×
          </button>
        </div>
      </div>

      {/* ── Mensajes ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {mensajes.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.rol === 'usuario' ? 'flex-end' : 'flex-start' }}>
            {m.rol === 'asistente' && (
              <div style={{ fontSize: 10, color: '#aaa', marginBottom: 3, marginLeft: 8 }}>Bot Eco Ingeniería CR</div>
            )}
            <div style={{
              maxWidth: '85%',
              padding: '10px 13px',
              borderRadius: m.rol === 'usuario' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: m.rol === 'usuario' ? 'var(--eco-primary, #185FA5)' : '#f4f6f9',
              color: m.rol === 'usuario' ? '#fff' : '#1a1a1a',
              fontSize: 13,
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {m.texto}
            </div>
          </div>
        ))}

        {cargando && (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ padding: '10px 14px', background: '#f4f6f9', borderRadius: '14px 14px 14px 4px', display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#bbb', animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 13px', background: '#FCEBEB', borderRadius: 10, color: '#A32D2D', fontSize: 12, border: '0.5px solid #f09595' }}>
            ⚠️ {error}
            <div style={{ marginTop: 6, fontSize: 11, color: '#666' }}>
                Verificá que <code style={{ background: '#f5f5f5', padding: '1px 5px', borderRadius: 3 }}>VITE_GEMINI_API_KEY</code> esté en el archivo .env
              </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Sugerencias (solo al inicio) ── */}
      {mensajes.length === 1 && (
        <div style={{ padding: '0 14px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {sugerencias.map((s, i) => (
            <button key={i} onClick={() => enviar(s)}
              style={{ padding: '5px 10px', background: '#f0f4f9', border: '0.5px solid #d0d8e0', borderRadius: 14, fontSize: 11, color: '#185FA5', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ── */}
      <div style={{ padding: '10px 12px', borderTop: '0.5px solid #eee', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0, background: '#fafafa' }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribí tu pregunta..."
          rows={1}
          style={{
            flex: 1, padding: '9px 12px', border: '0.5px solid #d0d8d0', borderRadius: 10,
            fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit',
            background: '#fff', color: '#1a1a1a', lineHeight: 1.45,
            maxHeight: 100, overflowY: 'auto',
          }}
          onInput={e => {
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
          }}
        />
        <button onClick={() => enviar()} disabled={!input.trim() || cargando}
          style={{
            width: 36, height: 36, borderRadius: 10, border: 'none', cursor: !input.trim() || cargando ? 'not-allowed' : 'pointer',
            background: !input.trim() || cargando ? '#e0e0e0' : 'var(--eco-primary, #185FA5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s',
          }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={!input.trim() || cargando ? '#aaa' : '#fff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  )
}