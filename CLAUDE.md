# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start development server (Vite)
npm run build     # Production build → dist/
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

**Firebase Emulators** (defined in firebase.json):
- Auth: 9099, Functions: 5001, Firestore: 8080, Hosting: 5000
- Run with: `firebase emulators:start`

**Deploy:**
```bash
firebase deploy --only hosting   # Deploy frontend
firebase deploy --only functions # Deploy Cloud Functions (functions2/)
```

## Architecture Overview

**Stack:** React 18 SPA + Vite + Firebase (Firestore, Auth, Storage) + Tailwind CSS v4

### State Management

Three React contexts wrap the entire app (see `src/App.jsx`):
- **AuthContext** (`src/context/AuthContext.jsx`) — Firebase auth user + extended Firestore profile from `/usuarios/{uid}`. Exposes `{ user, usuario, cerrarSesion, loading }`.
- **EmpresaContext** (`src/context/EmpresaContext.jsx`) — Company settings from `/configuracion/empresa`. Exposes `{ empresa, guardarEmpresa, cargarEmpresa }`.
- **ThemeContext** (`src/context/ThemeContext.jsx`) — CSS-variable-based theming with 8 palettes, 3 border-radius styles, 3 densities. Persisted to localStorage as `eco-crm-theme`.

### Routing

Defined in `src/router/index.jsx`. All routes except `/login` and `/cotizacion/:id` are guarded by `RutaProtegida`. The main layout (`src/shared/layouts/MainLayout.jsx`) wraps all authenticated routes.

Key route groups:
- `/crm`, `/chats`, `/contactos`, `/empresas` — CRM & communication
- `/ventas/*`, `/compras/*`, `/facturacion/*` — Sales cycle
- `/inventario`, `/activos/:id?` — Inventory & assets
- `/bancos`, `/finanzas` — Finance
- `/calendario`, `/ordenes-trabajo`, `/proyectos/*` — Operations
- `/configuracion/*` — Settings (connectors, users, roles, templates, dev tools)

### Module Structure

`src/modules/<module>/` follows this pattern:
```
pages/       # Route-level page components
components/  # Module-specific UI components
hooks/       # Module-specific custom hooks
utils/       # Module-specific utilities (some modules)
```

### Firebase Layer

- `src/firebase/config.js` — Initializes Firebase, exports `db` (Firestore) and `storage`
- `src/firebase/auth.js` — Exports `auth` instance
- `src/firebase/firestore.js` — Re-exports db and storage
- `src/firebase/calendario.js`, `contactos.js`, `leads.js` — Module-specific Firestore helpers
- `src/firestore.rules` — Security rules with role-based access (`isAdmin()`, `isSupervisorOrAdmin()`, `sameEmpresa()` helpers)
- `functions2/` — Firebase Cloud Functions backend

### Key Services & Utilities

- `src/lib/crypto.js` — AES-256 encryption (uses `VITE_CRYPTO_SECRET`)
- `src/lib/secureConfig.js` — Secure config management
- `src/hooks/usePermisos.js` — Role-based permission checks
- `src/services/wasenderService.js` — WhatsApp integration
- `src/services/notificaciones.js` — Notification service
- `src/shared/layouts/BotAyuda.jsx` — AI assistant widget
- `src/shared/layouts/ChatWidget.jsx` — Real-time chat (Socket.io)

### Styling

- Tailwind CSS v4 with PostCSS
- Global CSS custom properties in `src/index.css` (e.g., `--eco-primary`, `--eco-pad`, `--eco-font-base`)
- Theme system applies variables to `:root` via ThemeContext
- Fonts: DM Sans (body) and Syne (headings) from Google Fonts

### Environment Variables

All Firebase vars are prefixed `VITE_FIREBASE_*`. See `.env.example` for the full list. Additional vars:
- `VITE_CRYPTO_SECRET` — AES-256 key (32+ chars)
- `VITE_APP_ENV`, `VITE_APP_VERSION`

### Firestore Data Model (key collections)

- `/usuarios/{uid}` — User profiles with `role` field (`admin`, `supervisor`, or other)
- `/configuracion/empresa` — Global company settings
- `/leads`, `/contactos`, `/empresas`, `/productos` — Core CRM data
- `/cotizaciones`, `/inventario`, `/calendario`, `/proveedores` — Operational data
- `/configuracion_segura/*` — Admin-only encrypted config
