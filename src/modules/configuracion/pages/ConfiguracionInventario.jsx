/**
 * ============================================================
 * ECO-CRM — Sistema de Gestión Empresarial
 * Archivo: ConfiguracionInventario.jsx
 * Módulo:  Configuracion
 * ============================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../firebase/firestore";
import { useEmpresa } from "../../../context/EmpresaContext";

const FS = {
  async getAll(col) {
    try { const s = await getDocs(collection(db, col)); return s.docs.map((d) => ({ _id: d.id, ...d.data() })); }
    catch (e) { console.error(e); return []; }
  },
  async add(col, data) {
    try { const r = await addDoc(collection(db, col), { ...data, _ts: serverTimestamp() }); return r.id; }
    catch (e) { console.error(e); return null; }
  },
  async update(col, id, data) {
    try { await updateDoc(doc(db, col, id), data); return true; }
    catch (e) { console.error(e); return false; }
  },
  async remove(col, id) {
    try { await deleteDoc(doc(db, col, id)); return true; }
    catch (e) { console.error(e); return false; }
  },
};

const G = {
  green: "#2e8b2e", blue: "#1B5FAA", red: "#d32f2f",
  border: "#d0e4d0", bg: "#f8fdf8", text: "#1a2e1a", muted: "#4a7a4a",
};
const inputSt = {
  background: G.bg, border: `1.5px solid ${G.border}`, borderRadius: 6,
  padding: "8px 12px", color: G.text, fontFamily: "inherit",
  fontSize: 13, outline: "none", width: "100%",
};
const btn = (v = "green", sm) => ({
  padding: sm ? "4px 10px" : "7px 14px", borderRadius: 6,
  fontFamily: "inherit", fontSize: sm ? 11 : 13, fontWeight: 500,
  cursor: "pointer", border: "none",
  display: "inline-flex", alignItems: "center", gap: 6,
  ...(v === "green"  ? { background: G.green, color: "#fff" } :
      v === "gray"   ? { background: "#f5f5f5", color: "#555", border: "1.5px solid #ddd" } :
      v === "red"    ? { background: "rgba(211,47,47,.1)", color: G.red, border: "1px solid rgba(211,47,47,.3)" } :
      v === "orange" ? { background: "rgba(230,126,0,.1)", color: "#7a4200", border: "1.5px solid rgba(230,126,0,.3)" } : {}),
});

function Toast({ msg, tipo, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, background: "#fff", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 500, boxShadow: "0 8px 32px rgba(0,0,0,.15)", border: `1px solid ${tipo === "ok" ? G.green : G.red}`, borderLeft: `4px solid ${tipo === "ok" ? G.green : G.red}` }}>
      {tipo === "ok" ? "✓ " : "❌ "}{msg}
    </div>
  );
}

function SectionCard({ icon, title, subtitle, children }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${G.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 24, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${G.border}`, background: G.bg, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: G.text }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: G.muted, marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LISTAS DE PRECIO — componente especial con "predeterminada"
// ─────────────────────────────────────────────────────────────────
function ListaRow({ lista, onSave, onDelete, onSetPredeterminada, monedaPrincipal, monedaSecundaria }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState({ ...lista });
  const [saving, setSaving]   = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(lista._id, draft);
    setSaving(false);
    setEditing(false);
  };

  const MONEDAS_OPCIONES = [
    { value: monedaPrincipal, label: `${monedaPrincipal} — Principal` },
    ...(monedaSecundaria ? [{ value: monedaSecundaria, label: `${monedaSecundaria} — Secundaria` }] : []),
  ];

  return (
    <tr style={{ borderBottom: `1px solid #f0f5f0` }}
      onMouseEnter={(e) => e.currentTarget.style.background = "#f5fbf5"}
      onMouseLeave={(e) => e.currentTarget.style.background = ""}>

      {/* Predeterminada */}
      <td style={{ padding: "8px 14px", textAlign: "center", width: 50 }}>
        {lista.predeterminada ? (
          <span title="Lista predeterminada" style={{ fontSize: 16 }}>⭐</span>
        ) : (
          <button title="Marcar como predeterminada" onClick={() => onSetPredeterminada(lista._id)}
            style={{ background: "none", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer", padding: "2px 6px", fontSize: 11, color: "#aaa" }}>
            ☆
          </button>
        )}
      </td>

      {/* Nombre */}
      <td style={{ padding: "8px 14px" }}>
        {editing
          ? <input style={{ ...inputSt, padding: "5px 8px" }} value={draft.nombre} onChange={(e) => setDraft(d => ({ ...d, nombre: e.target.value }))} />
          : <span style={{ fontSize: 13, fontWeight: lista.predeterminada ? 700 : 400 }}>{lista.nombre}</span>}
      </td>

      {/* Moneda */}
      <td style={{ padding: "8px 14px", width: 160 }}>
        {editing ? (
          <select style={{ ...inputSt, padding: "5px 8px" }} value={draft.moneda || monedaPrincipal}
            onChange={(e) => setDraft(d => ({ ...d, moneda: e.target.value }))}>
            {MONEDAS_OPCIONES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        ) : (
          <span style={{ fontSize: 12, fontFamily: "monospace", background: "rgba(27,95,170,.08)", color: G.blue, padding: "2px 8px", borderRadius: 4 }}>
            {lista.moneda || monedaPrincipal}
          </span>
        )}
      </td>

      {/* Descripción */}
      <td style={{ padding: "8px 14px" }}>
        {editing
          ? <input style={{ ...inputSt, padding: "5px 8px" }} value={draft.descripcion || ""} onChange={(e) => setDraft(d => ({ ...d, descripcion: e.target.value }))} placeholder="Descripción opcional" />
          : <span style={{ fontSize: 12, color: G.muted }}>{lista.descripcion || "—"}</span>}
      </td>

      {/* Acciones */}
      <td style={{ padding: "8px 14px" }}>
        <div style={{ display: "flex", gap: 5 }}>
          {editing ? (
            <>
              <button style={btn("green", true)} onClick={handleSave} disabled={saving}>{saving ? "…" : "✓ Guardar"}</button>
              <button style={btn("gray", true)} onClick={() => { setDraft({ ...lista }); setEditing(false); }}>Cancelar</button>
            </>
          ) : (
            <>
              <button style={btn("gray", true)} onClick={() => setEditing(true)}>✏️</button>
              {!lista.predeterminada && <button style={btn("red", true)} onClick={() => onDelete(lista._id, lista.nombre)}>🗑️</button>}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function ListaAddRow({ onAdd, monedaPrincipal, monedaSecundaria }) {
  const [draft, setDraft] = useState({ nombre: "", moneda: monedaPrincipal, descripcion: "" });
  const [saving, setSaving] = useState(false);

  const MONEDAS_OPCIONES = [
    { value: monedaPrincipal, label: `${monedaPrincipal} — Principal` },
    ...(monedaSecundaria ? [{ value: monedaSecundaria, label: `${monedaSecundaria} — Secundaria` }] : []),
  ];

  const handleAdd = async () => {
    if (!draft.nombre.trim()) { alert("El nombre es obligatorio"); return; }
    setSaving(true);
    await onAdd(draft);
    setDraft({ nombre: "", moneda: monedaPrincipal, descripcion: "" });
    setSaving(false);
  };

  return (
    <tr style={{ background: "#f0faf0", borderTop: `2px solid ${G.border}` }}>
      <td style={{ padding: "8px 14px", textAlign: "center" }}>
        <span style={{ color: "#ccc", fontSize: 14 }}>—</span>
      </td>
      <td style={{ padding: "8px 14px" }}>
        <input style={{ ...inputSt, padding: "5px 8px" }} placeholder="Nombre de la lista" value={draft.nombre} onChange={(e) => setDraft(d => ({ ...d, nombre: e.target.value }))} />
      </td>
      <td style={{ padding: "8px 14px" }}>
        <select style={{ ...inputSt, padding: "5px 8px" }} value={draft.moneda} onChange={(e) => setDraft(d => ({ ...d, moneda: e.target.value }))}>
          {MONEDAS_OPCIONES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </td>
      <td style={{ padding: "8px 14px" }}>
        <input style={{ ...inputSt, padding: "5px 8px" }} placeholder="Descripción opcional" value={draft.descripcion} onChange={(e) => setDraft(d => ({ ...d, descripcion: e.target.value }))} />
      </td>
      <td style={{ padding: "8px 14px" }}>
        <button style={btn("green", true)} onClick={handleAdd} disabled={saving}>{saving ? "…" : "+ Agregar"}</button>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────
// TABLA GENÉRICA (para categorías)
// ─────────────────────────────────────────────────────────────────
function InlineRow({ item, fields, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState({ ...item });
  const [saving, setSaving]   = useState(false);
  const handleSave = async () => { setSaving(true); await onSave(item._id, draft); setSaving(false); setEditing(false); };
  return (
    <tr style={{ borderBottom: `1px solid #f0f5f0` }} onMouseEnter={(e) => e.currentTarget.style.background = "#f5fbf5"} onMouseLeave={(e) => e.currentTarget.style.background = ""}>
      {fields.map((f) => (
        <td key={f.key} style={{ padding: "8px 14px" }}>
          {editing
            ? <input style={{ ...inputSt, padding: "5px 8px" }} value={draft[f.key] || ""} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} />
            : <span style={{ fontSize: 13 }}>{item[f.key] || <span style={{ color: "#bbb" }}>—</span>}</span>}
        </td>
      ))}
      <td style={{ padding: "8px 14px" }}>
        <div style={{ display: "flex", gap: 5 }}>
          {editing ? (
            <><button style={btn("green", true)} onClick={handleSave} disabled={saving}>{saving ? "…" : "✓ Guardar"}</button><button style={btn("gray", true)} onClick={() => { setDraft({ ...item }); setEditing(false); }}>Cancelar</button></>
          ) : (
            <><button style={btn("gray", true)} onClick={() => setEditing(true)}>✏️</button><button style={btn("red", true)} onClick={() => onDelete(item._id, item[fields[0].key])}>🗑️</button></>
          )}
        </div>
      </td>
    </tr>
  );
}

function AddRow({ fields, onAdd }) {
  const init = fields.reduce((acc, f) => ({ ...acc, [f.key]: "" }), {});
  const [draft, setDraft] = useState(init);
  const [saving, setSaving] = useState(false);
  const handleAdd = async () => {
    if (!draft[fields[0].key]?.trim()) { alert(`El campo "${fields[0].label}" es obligatorio`); return; }
    setSaving(true); await onAdd(draft); setDraft(init); setSaving(false);
  };
  return (
    <tr style={{ background: "#f0faf0", borderTop: `2px solid ${G.border}` }}>
      {fields.map((f) => (
        <td key={f.key} style={{ padding: "8px 14px" }}>
          <input style={{ ...inputSt, padding: "5px 8px" }} placeholder={f.placeholder || f.label} value={draft[f.key] || ""} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} />
        </td>
      ))}
      <td style={{ padding: "8px 14px" }}>
        <button style={btn("green", true)} onClick={handleAdd} disabled={saving}>{saving ? "…" : "+ Agregar"}</button>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
export default function ConfiguracionInventario() {
  const { empresa } = useEmpresa();
  const monedaPrincipal   = empresa?.moneda            || "CRC";
  const monedaSecundaria  = empresa?.monedaSecundaria  || "";

  const [categorias, setCategorias] = useState([]);
  const [listas,     setListas]     = useState([]);
  const [impuestos,  setImpuestos]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [toast,      setToast]      = useState(null);

  const showToast = (msg, tipo = "ok") => setToast({ msg, tipo });

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [cats, ls, imps] = await Promise.all([
      FS.getAll("categorias"),
      FS.getAll("listasPrecios"),
      FS.getAll("impuestosConfig"),
    ]);
    setCategorias(cats);

    // Si no hay ninguna lista, crear la predeterminada automáticamente
    if (ls.length === 0) {
      const id = await FS.add("listasPrecios", {
        nombre: "Precio",
        moneda: monedaPrincipal,
        descripcion: "Lista de precio predeterminada",
        predeterminada: true,
      });
      if (id) {
        setListas([{ _id: id, nombre: "Precio", moneda: monedaPrincipal, descripcion: "Lista de precio predeterminada", predeterminada: true }]);
      }
    } else {
      setListas(ls);
    }

    setImpuestos(imps);
    setLoading(false);
  }, [monedaPrincipal]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── CATEGORÍAS ──
  const handleAddCat = async (draft) => {
    if (categorias.some((c) => c.nombre.toLowerCase() === draft.nombre.toLowerCase())) { alert("Ya existe esa categoría"); return; }
    const newId = await FS.add("categorias", { nombre: draft.nombre, descripcion: draft.descripcion || "" });
    if (newId) { setCategorias((prev) => [...prev, { _id: newId, ...draft }]); showToast("Categoría creada ✓"); }
  };
  const handleSaveCat = async (id, draft) => {
    await FS.update("categorias", id, draft);
    setCategorias((prev) => prev.map((c) => c._id === id ? { ...c, ...draft } : c));
    showToast("Categoría actualizada ✓");
  };
  const handleDeleteCat = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar la categoría "${nombre}"?`)) return;
    await FS.remove("categorias", id);
    setCategorias((prev) => prev.filter((c) => c._id !== id));
    showToast("Eliminada ✓");
  };

  // ── LISTAS DE PRECIO ──
  const handleAddLista = async (draft) => {
    if (listas.some((l) => l.nombre.toLowerCase() === draft.nombre.toLowerCase())) { alert("Ya existe esa lista"); return; }
    const esPrimera = listas.length === 0;
    const newId = await FS.add("listasPrecios", { ...draft, predeterminada: esPrimera });
    if (newId) { setListas((prev) => [...prev, { _id: newId, ...draft, predeterminada: esPrimera }]); showToast("Lista creada ✓"); }
  };
  const handleSaveLista = async (id, draft) => {
    await FS.update("listasPrecios", id, draft);
    setListas((prev) => prev.map((l) => l._id === id ? { ...l, ...draft } : l));
    showToast("Lista actualizada ✓");
  };
  const handleDeleteLista = async (id, nombre) => {
    const lista = listas.find(l => l._id === id);
    if (lista?.predeterminada) { alert("No podés eliminar la lista predeterminada. Marcá otra como predeterminada primero."); return; }
    if (!window.confirm(`¿Eliminar la lista "${nombre}"?`)) return;
    await FS.remove("listasPrecios", id);
    setListas((prev) => prev.filter((l) => l._id !== id));
    showToast("Eliminada ✓");
  };
  const handleSetPredeterminada = async (id) => {
    // Quitar predeterminada de todas y poner en la seleccionada
    const updates = listas.map(async (l) => {
      const esPred = l._id === id;
      if (l.predeterminada !== esPred) await FS.update("listasPrecios", l._id, { predeterminada: esPred });
    });
    await Promise.all(updates);
    setListas((prev) => prev.map((l) => ({ ...l, predeterminada: l._id === id })));
    showToast("Lista predeterminada actualizada ✓");
  };

  // ── IMPUESTOS ──
  const handleAddImp = async (draft) => {
    const tasa = parseFloat(draft.tasa);
    if (isNaN(tasa) || tasa < 0) { alert("Ingresá una tasa válida"); return; }
    if (impuestos.some((i) => parseFloat(i.tasa) === tasa)) { alert("Ya existe un impuesto con esa tasa"); return; }
    const newId = await FS.add("impuestosConfig", { nombre: draft.nombre, tasa, activo: true });
    if (newId) { setImpuestos((prev) => [...prev, { _id: newId, nombre: draft.nombre, tasa, activo: true }]); showToast("Impuesto creado ✓"); }
  };
  const handleSaveImp = async (id, draft) => {
    const tasa = parseFloat(draft.tasa);
    const data = { nombre: draft.nombre, tasa: isNaN(tasa) ? 0 : tasa, activo: draft.activo !== false };
    await FS.update("impuestosConfig", id, data);
    setImpuestos((prev) => prev.map((i) => i._id === id ? { ...i, ...data } : i));
    showToast("Impuesto actualizado ✓");
  };
  const handleDeleteImp = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar el impuesto "${nombre}"?`)) return;
    await FS.remove("impuestosConfig", id);
    setImpuestos((prev) => prev.filter((i) => i._id !== id));
    showToast("Eliminado ✓");
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: 60, color: G.muted, fontFamily: "inherit" }}>
      <div style={{ fontSize: 32, marginBottom: 12, opacity: .4 }}>⏳</div>Cargando configuración…
    </div>
  );

  const listaPred = listas.find(l => l.predeterminada);

  return (
    <div style={{ fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif" }}>
      <style>{`input:focus, select:focus { border-color:#2e8b2e !important; box-shadow:0 0 0 3px rgba(46,139,46,.1); outline:none; }`}</style>

      <div style={{ background: "#f0f7f0", border: `1px solid ${G.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 24, fontSize: 13, color: G.muted }}>
        ⚙️ <strong>Configuración de Inventario</strong> — Los cambios aquí afectan inmediatamente a todo el módulo de productos.
      </div>

      {/* ── CATEGORÍAS ── */}
      <SectionCard icon="🏷️" title="Categorías de Productos" subtitle="Agrupaciones para filtrar y organizar el catálogo">
        <div style={{ border: `1px solid ${G.border}`, borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: G.bg }}>
                {["Nombre", "Descripción", ""].map((h) => (
                  <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: ".8px", color: "#666", fontWeight: 600, borderBottom: `1px solid ${G.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categorias.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: "center", padding: 24, color: "#aaa", fontSize: 13 }}>Sin categorías — usá el formulario de abajo</td></tr>
              )}
              {categorias.map((item) => (
                <InlineRow key={item._id} item={item}
                  fields={[
                    { key: "nombre",      label: "Nombre",      placeholder: "Ej: Material Eléctrico" },
                    { key: "descripcion", label: "Descripción", placeholder: "Descripción opcional" },
                  ]}
                  onSave={handleSaveCat} onDelete={handleDeleteCat} />
              ))}
              <AddRow
                fields={[
                  { key: "nombre",      label: "Nombre",      placeholder: "Ej: Material Eléctrico" },
                  { key: "descripcion", label: "Descripción", placeholder: "Descripción opcional" },
                ]}
                onAdd={handleAddCat} />
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: G.muted }}>
          💡 {categorias.length} categoría{categorias.length !== 1 ? "s" : ""} creada{categorias.length !== 1 ? "s" : ""}
        </div>
      </SectionCard>

      {/* ── LISTAS DE PRECIO ── */}
      <SectionCard icon="💰" title="Listas de Precio de Venta" subtitle="Precios diferenciados por tipo de cliente">

        {/* Info moneda */}
        <div style={{ marginBottom: 14, padding: "10px 14px", background: "rgba(27,95,170,.06)", borderRadius: 8, border: "1px solid rgba(27,95,170,.2)", fontSize: 12, color: G.blue }}>
          💱 Moneda principal: <strong>{monedaPrincipal}</strong>
          {monedaSecundaria && <> · Moneda secundaria: <strong>{monedaSecundaria}</strong></>}
          {" "}— Configurable en <strong>Mi Empresa → Datos básicos</strong>
        </div>

        {/* Lista predeterminada actual */}
        {listaPred && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fffbeb", borderRadius: 8, border: "1px solid #f59e0b", fontSize: 12, color: "#7c5100", display: "flex", alignItems: "center", gap: 8 }}>
            ⭐ Lista predeterminada: <strong>{listaPred.nombre}</strong> ({listaPred.moneda || monedaPrincipal}) — se usa como precio principal en cotizaciones
          </div>
        )}

        <div style={{ border: `1px solid ${G.border}`, borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: G.bg }}>
                {["⭐", "Nombre", "Moneda", "Descripción", ""].map((h) => (
                  <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: ".8px", color: "#666", fontWeight: 600, borderBottom: `1px solid ${G.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listas.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "#aaa", fontSize: 13 }}>Sin listas — usá el formulario de abajo</td></tr>
              )}
              {listas.map((lista) => (
                <ListaRow key={lista._id} lista={lista}
                  onSave={handleSaveLista}
                  onDelete={handleDeleteLista}
                  onSetPredeterminada={handleSetPredeterminada}
                  monedaPrincipal={monedaPrincipal}
                  monedaSecundaria={monedaSecundaria} />
              ))}
              <ListaAddRow onAdd={handleAddLista} monedaPrincipal={monedaPrincipal} monedaSecundaria={monedaSecundaria} />
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: G.muted }}>
          💡 {listas.length} lista{listas.length !== 1 ? "s" : ""} — marcá la ⭐ para elegir cuál es la predeterminada. La lista predeterminada no se puede eliminar.
        </div>

        {listas.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {listas.map((l) => (
              <div key={l._id} style={{ background: l.predeterminada ? "rgba(46,139,46,.1)" : "rgba(27,95,170,.08)", color: l.predeterminada ? G.green : G.blue, border: `1.5px solid ${l.predeterminada ? "rgba(46,139,46,.3)" : "rgba(27,95,170,.2)"}`, borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 600 }}>
                {l.predeterminada ? "⭐ " : ""}{l.nombre} ({l.moneda || monedaPrincipal})
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── IMPUESTOS ── */}
      <SectionCard icon="🧾" title="Tasas de Impuesto (IVA)" subtitle="Tasas configurables para compras y ventas">
        <div style={{ marginBottom: 14, background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#7c5100" }}>
          ⚠️ Estas son las tasas disponibles para seleccionar en cada producto. En cada transacción se puede cambiar según corresponda.
        </div>
        <div style={{ border: `1px solid ${G.border}`, borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: G.bg }}>
                {["Nombre / Descripción", "Tasa (%)", "Estado", ""].map((h) => (
                  <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: ".8px", color: "#666", fontWeight: 600, borderBottom: `1px solid ${G.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {impuestos.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: 20, color: "#aaa", fontSize: 13 }}>Sin impuestos configurados</td></tr>
              )}
              {impuestos.sort((a, b) => (b.tasa || 0) - (a.tasa || 0)).map((imp) => (
                <ImpuestoRow key={imp._id} imp={imp} onSave={handleSaveImp} onDelete={handleDeleteImp} />
              ))}
              <ImpuestoAddRow onAdd={handleAddImp} />
            </tbody>
          </table>
        </div>
      </SectionCard>

      {toast && <Toast msg={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}

function ImpuestoRow({ imp, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState({ nombre: imp.nombre, tasa: imp.tasa, activo: imp.activo !== false });
  const [saving,  setSaving]  = useState(false);
  const handleSave = async () => { setSaving(true); await onSave(imp._id, draft); setSaving(false); setEditing(false); };
  return (
    <tr style={{ borderBottom: `1px solid #f0f5f0` }} onMouseEnter={(e) => e.currentTarget.style.background = "#f5fbf5"} onMouseLeave={(e) => e.currentTarget.style.background = ""}>
      <td style={{ padding: "8px 14px" }}>
        {editing ? <input style={{ ...inputSt, padding: "5px 8px" }} value={draft.nombre} onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))} />
          : <span style={{ fontSize: 13, fontWeight: 500 }}>{imp.nombre}</span>}
      </td>
      <td style={{ padding: "8px 14px" }}>
        {editing ? <input style={{ ...inputSt, padding: "5px 8px", width: 90, fontFamily: "monospace" }} type="number" min="0" max="100" step="0.01" value={draft.tasa} onChange={(e) => setDraft((d) => ({ ...d, tasa: e.target.value }))} />
          : <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: imp.tasa === 0 ? "#888" : "#1a2e1a" }}>{imp.tasa}%</span>}
      </td>
      <td style={{ padding: "8px 14px" }}>
        {editing ? (
          <select style={{ ...inputSt, padding: "5px 8px", width: 120 }} value={draft.activo ? "true" : "false"} onChange={(e) => setDraft((d) => ({ ...d, activo: e.target.value === "true" }))}>
            <option value="true">Activo</option><option value="false">Inactivo</option>
          </select>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: imp.activo !== false ? "rgba(46,139,46,.12)" : "rgba(100,100,100,.1)", color: imp.activo !== false ? "#1a5c1a" : "#444" }}>
            {imp.activo !== false ? "Activo" : "Inactivo"}
          </span>
        )}
      </td>
      <td style={{ padding: "8px 14px" }}>
        <div style={{ display: "flex", gap: 5 }}>
          {editing ? (
            <><button style={btn("green", true)} onClick={handleSave} disabled={saving}>{saving ? "…" : "✓ Guardar"}</button><button style={btn("gray", true)} onClick={() => { setDraft({ nombre: imp.nombre, tasa: imp.tasa, activo: imp.activo !== false }); setEditing(false); }}>Cancelar</button></>
          ) : (
            <><button style={btn("gray", true)} onClick={() => setEditing(true)}>✏️</button><button style={btn("red", true)} onClick={() => onDelete(imp._id, `${imp.nombre} (${imp.tasa}%)`)}>🗑️</button></>
          )}
        </div>
      </td>
    </tr>
  );
}

function ImpuestoAddRow({ onAdd }) {
  const [draft, setDraft] = useState({ nombre: "", tasa: "" });
  const [saving, setSaving] = useState(false);
  const handleAdd = async () => {
    if (!draft.nombre.trim()) { alert("Ingresá el nombre del impuesto"); return; }
    setSaving(true); await onAdd(draft); setDraft({ nombre: "", tasa: "" }); setSaving(false);
  };
  return (
    <tr style={{ background: "#f0faf0", borderTop: `2px solid ${G.border}` }}>
      <td style={{ padding: "8px 14px" }}>
        <input style={{ ...inputSt, padding: "5px 8px" }} placeholder="Ej: IVA Tarifa General" value={draft.nombre} onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))} />
      </td>
      <td style={{ padding: "8px 14px" }}>
        <input style={{ ...inputSt, padding: "5px 8px", width: 90, fontFamily: "monospace" }} type="number" min="0" max="100" step="0.01" placeholder="13" value={draft.tasa} onChange={(e) => setDraft((d) => ({ ...d, tasa: e.target.value }))} />
      </td>
      <td style={{ padding: "8px 14px" }}><span style={{ fontSize: 12, color: "#aaa" }}>Activo por defecto</span></td>
      <td style={{ padding: "8px 14px" }}>
        <button style={btn("green", true)} onClick={handleAdd} disabled={saving}>{saving ? "…" : "+ Agregar"}</button>
      </td>
    </tr>
  );
}