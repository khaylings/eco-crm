# ECO-CRM v3 — Usuarios, Roles y Perfil

## Archivos incluidos

```
MiPerfil.jsx   → src/modules/configuracion/pages/MiPerfil.jsx
Usuarios.jsx   → src/modules/configuracion/pages/Usuarios.jsx
Roles.jsx      → src/modules/configuracion/pages/Roles.jsx
```

---

## PASO 1 — Copiar archivos

Copia los 3 archivos a:
```
C:\Users\airec\CRM\eco-crm\src\modules\configuracion\pages\
```

---

## PASO 2 — Agregar rutas en src/router/index.jsx

Agrega estos imports:
```jsx
import MiPerfil from '../modules/configuracion/pages/MiPerfil'
import Usuarios from '../modules/configuracion/pages/Usuarios'
import Roles from '../modules/configuracion/pages/Roles'
```

Agrega estas rutas dentro del bloque de configuracion:
```jsx
<Route path="configuracion/perfil" element={<MiPerfil />} />
<Route path="configuracion/usuarios" element={<Usuarios />} />
<Route path="configuracion/roles" element={<Roles />} />
```

---

## PASO 3 — Agregar en CatalogoLeads.jsx

En el array SECCIONES agrega estos items con link:
```jsx
{ key: 'perfil',   label: 'Mi Perfil',   icon: '👤', desc: 'Foto y datos personales',     link: '/configuracion/perfil' },
{ key: 'usuarios', label: 'Usuarios',    icon: '👥', desc: 'Gestión de usuarios del sistema', link: '/configuracion/usuarios' },
{ key: 'roles',    label: 'Roles',       icon: '🔑', desc: 'Permisos por módulo',          link: '/configuracion/roles' },
```

---

## PASO 4 — Firebase Storage para fotos de perfil

En src/firebase/config.js asegúrate de exportar storage:
```js
import { getStorage } from 'firebase/storage'
export const storage = getStorage(app)
```

---

## PASO 5 — Deploy

```cmd
npm run build
firebase deploy --only hosting
```
