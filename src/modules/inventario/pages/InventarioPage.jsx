/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: InventarioPage.jsx
 * Módulo:  Inventario
 * ============================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db } from "../../../firebase/config";
import { storage } from "../../../firebase/firestore";
import { useAuth } from "../../../context/AuthContext";

const FS = {
  async getAll(col) {
    try {
      const s = await getDocs(collection(db, col));
      return s.docs.map((d) => ({ _id: d.id, ...d.data() }));
    } catch (e) { console.error(e); return []; }
  },
  async add(col, data) {
    try {
      const r = await addDoc(collection(db, col), { ...data, _ts: serverTimestamp() });
      return r.id;
    } catch (e) { console.error(e); return null; }
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

import { fmt as fmtMoneda } from '../../../lib/formatMoneda'
const fmt = (n, mon) => fmtMoneda(n, mon || 'CRC');

const calcCostoDesagregado = (componentes, productos) =>
  componentes.reduce((sum, c) => {
    const p = productos.find((x) => x._id === c.productoId);
    return sum + (parseFloat(p?.precioCompra) || 0) * (parseFloat(c.cantidad) || 1);
  }, 0);

const stockDeProducto = (productoId, movimientos) =>
  movimientos
    .filter((m) => m.productoId === productoId)
    .reduce((sum, m) => {
      if (m.tipo === "entrada") return sum + (m.cantidad || 0);
      if (m.tipo === "venta" || m.tipo === "consumo") return sum - (m.cantidad || 0);
      if (m.tipo === "ajuste") return sum + (m.cantidad || 0);
      return sum;
    }, 0);

const G = {
  green: "#2e8b2e", greenLight: "#3a9e3a",
  blue: "#1B5FAA", red: "#d32f2f",
  border: "#d0e4d0", bg: "#f8fdf8",
  surface: "#ffffff", text: "#1a2e1a",
  muted: "#4a7a4a", faint: "#a0bca0",
};

const inputSt = {
  background: G.bg, border: `1.5px solid ${G.border}`, borderRadius: 6,
  padding: "9px 12px", color: G.text, fontFamily: "inherit",
  fontSize: 13, outline: "none", width: "100%", transition: "all .2s",
};

const btn = (v = "green", sm) => ({
  padding: sm ? "4px 10px" : "7px 14px",
  borderRadius: 6, fontFamily: "inherit",
  fontSize: sm ? 11 : 13, fontWeight: 500, cursor: "pointer",
  border: "none", display: "inline-flex", alignItems: "center",
  gap: 6, transition: "all .15s",
  ...(v === "green"  ? { background: G.green, color: "#fff" } :
      v === "gray"   ? { background: "#f5f5f5", color: "#555", border: "1.5px solid #ddd" } :
      v === "red"    ? { background: "rgba(211,47,47,.1)", color: G.red, border: "1px solid rgba(211,47,47,.3)" } :
      v === "blue"   ? { background: "rgba(27,95,170,.08)", color: G.blue, border: "1.5px solid rgba(27,95,170,.25)" } :
      v === "orange" ? { background: "rgba(230,126,0,.1)", color: "#7a4200", border: "1.5px solid rgba(230,126,0,.3)" } : {}),
});

const TABS_MAIN = [
  { id: "productos",   label: "Productos",   icon: "📦" },
  { id: "proveedores", label: "Proveedores", icon: "🏢" },
  { id: "movimientos", label: "Movimientos", icon: "📋" },
];

const IVA_OPCIONES = [
  { label: "13% — Tarifa general",          value: 13 },
  { label: "4%  — Servicios profesionales", value: 4  },
  { label: "2%  — Canasta básica reducida", value: 2  },
  { label: "1%  — Canasta básica",          value: 1  },
  { label: "Exento — 0%",                   value: 0  },
];

const TIPOS_PROV = ["Refrigeración","Eléctrico","Electromecánico","Soportería","Insumos","Ferretería","Tuberías","Herramientas","Gas","Servicios","Otros"];
const UNIDADES   = ["Unidad","Metro","Metro²","Metro³","Kg","Litro","Caja","Rollo","Par","Global","Hora"];

// ─────────────────────────────────────────────────────────────────
// IMPORTACIÓN MASIVA — leer Excel en el navegador con SheetJS CDN
// ─────────────────────────────────────────────────────────────────
async function leerExcel(file) {
  const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs");
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: "array" });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const todas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const headers = todas[2] || [];
  const datos = todas.slice(4);
  return datos.map(row =>
    Object.fromEntries(headers.map((h, i) => [String(h).trim(), row[i] ?? ""]))
  );
}

function parseBool(v)  { return String(v).trim().toUpperCase() === "TRUE"; }
function parseNum(v)   { return parseFloat(String(v).replace(",", ".")) || 0; }

function rowToProducto(row, proveedoresMap = {}, listaPredId = null) {
  const etiquetasRaw   = String(row.etiquetas   || "").trim();
  const proveedoresRaw = String(row.proveedores  || "").trim();
  const etiquetas = etiquetasRaw
    ? etiquetasRaw.split(",").map((e) => e.trim()).filter(Boolean)
    : [];
  const proveedoresIds = proveedoresRaw
    ? proveedoresRaw.split(",").map((n) => n.trim()).filter(Boolean)
        .map((nombre) => proveedoresMap[nombre.toLowerCase()])
        .filter(Boolean)
    : [];
  const ivaVenta  = parseNum(row.ivaVentaDefault);
  const ivaCompra = parseNum(row.ivaCompraDefault);
  const precioVenta = parseNum(row.precioVenta);
  const preciosLista = listaPredId && precioVenta > 0
    ? { [listaPredId]: precioVenta }
    : {};
  return {
    nombre:            String(row.nombre || "").trim(),
    tipo:              row.tipo || "Producto",
    sku:               String(row.sku || "").trim(),
    categoria:         String(row.categoria || "").trim(),
    unidad:            row.unidad || "Unidad",
    descripcion:       String(row.descripcion || "").trim(),
    notas:             String(row.notas || "").trim(),
    esVenta:           parseBool(row.esVenta !== "" ? row.esVenta : "TRUE"),
    esCompra:          parseBool(row.esCompra),
    rastrearStock:     parseBool(row.rastrearStock !== "" ? row.rastrearStock : "TRUE"),
    stockMinimo:       parseNum(row.stockMinimo),
    precioCompra:      parseNum(row.precioCompra),
    precioCompraModo:  "manual",
    ivaVentaDefault:   row.ivaVentaDefault !== "" ? ivaVenta : null,
    ivaVentaSelected:  row.ivaVentaDefault !== "" ? [ivaVenta] : [],
    ivaCompraDefault:  row.ivaCompraDefault !== "" ? ivaCompra : null,
    ivaCompraSelected: row.ivaCompraDefault !== "" ? [ivaCompra] : [],
    etiquetas,
    proveedores:       proveedoresIds,
    preciosLista,
    componentes:       [],
    adjuntos:          [],
    tiempo:            row.tipo === "Servicio" || row.tipo === "Desagregado" ? parseNum(row.tiempo) : null,
    score:             row.tipo === "Servicio" || row.tipo === "Desagregado" ? parseNum(row.score) : null,
  };
}

// ─────────────────────────────────────────────────────────────────
// COMPONENTES UI
// ─────────────────────────────────────────────────────────────────
function Toast({ msg, tipo, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: "#fff", borderRadius: 8, padding: "10px 18px",
      fontSize: 13, fontWeight: 500, boxShadow: "0 8px 32px rgba(0,0,0,.15)",
      color: G.text, border: `1px solid ${tipo === "ok" ? G.green : G.red}`,
      borderLeft: `4px solid ${tipo === "ok" ? G.green : G.red}`,
      animation: "slideUp .3s ease",
    }}>
      {tipo === "ok" ? "✓ " : "❌ "}{msg}
    </div>
  );
}

function Modal({ title, children, onClose, wide }) {
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.65)",
        backdropFilter: "blur(4px)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}>
      <div style={{
        background: G.surface, borderRadius: 14, padding: 26,
        width: wide ? 820 : 580, maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#999" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Fg({ label, full, children }) {
  return (
    <div style={{ gridColumn: full ? "1/-1" : undefined, display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</label>}
      {children}
    </div>
  );
}

function Badge({ children, color }) {
  const colors = {
    green:  { bg: "rgba(46,139,46,.12)",   text: "#1a5c1a" },
    blue:   { bg: "rgba(27,95,170,.12)",   text: "#0d3d6e" },
    orange: { bg: "rgba(230,126,0,.12)",   text: "#7a4200" },
    red:    { bg: "rgba(211,47,47,.12)",   text: "#8b1a1a" },
    gray:   { bg: "rgba(100,100,100,.1)",  text: "#444"    },
    purple: { bg: "rgba(110,40,190,.12)",  text: "#4a1a80" },
  };
  const c = colors[color] || colors.gray;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: c.bg, color: c.text }}>
      {children}
    </span>
  );
}

function Th({ children }) {
  return (
    <th style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: ".8px", color: "#666", fontWeight: 600, borderBottom: `1px solid ${G.border}`, whiteSpace: "nowrap", background: G.bg }}>
      {children}
    </th>
  );
}

function IvaSelector({ selected = [], defaultTasa, onChange, onDefaultChange }) {
  return (
    <div style={{ border: `1.5px solid ${G.border}`, borderRadius: 8, overflow: "hidden" }}>
      {IVA_OPCIONES.map((t) => {
        const sel = selected.includes(t.value);
        return (
          <div key={t.value} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: `1px solid #f0f5f0`, background: sel ? "#f0faf0" : "#fff" }}>
            <input type="checkbox" checked={sel} style={{ accentColor: G.green, width: 15, height: 15, cursor: "pointer" }}
              onChange={(e) => {
                const next = e.target.checked ? [...selected, t.value] : selected.filter((v) => v !== t.value);
                onChange(next);
                if (!e.target.checked && defaultTasa === t.value) onDefaultChange(null);
              }} />
            <span style={{ flex: 1, fontSize: 13, fontFamily: "monospace" }}>{t.label}</span>
            {sel && (
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: G.green, cursor: "pointer" }}>
                <input type="radio" name={`iva-default-${t.value}`} checked={defaultTasa === t.value} style={{ accentColor: G.green }}
                  onChange={() => onDefaultChange(t.value)} />
                Predeterminado
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PreciosLista({ listas, precios = {}, onChange }) {
  if (!listas.length) return (
    <div style={{ padding: "12px 14px", fontSize: 12, color: "#999", background: G.bg, borderRadius: 8, border: `1px dashed ${G.border}` }}>
      Sin listas configuradas — creá en Configuración → Listas de Precio
    </div>
  );
  return (
    <div style={{ border: `1.5px solid ${G.border}`, borderRadius: 8, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", padding: "7px 12px", background: G.bg, borderBottom: `1px solid ${G.border}`, fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase" }}>
        <span>Lista</span><span style={{ textAlign: "right" }}>Precio venta (₡)</span>
      </div>
      {listas.map((l) => (
        <div key={l._id} style={{ display: "grid", gridTemplateColumns: "1fr 140px", padding: "7px 12px", borderBottom: `1px solid #f0f5f0`, alignItems: "center" }}>
          <span style={{ fontSize: 13 }}>{l.nombre}</span>
          <input type="number" step="0.01" min="0" value={precios[l._id] ?? ""}
            placeholder="0.00"
            onChange={(e) => onChange({ ...precios, [l._id]: parseFloat(e.target.value) || 0 })}
            style={{ ...inputSt, width: 130, textAlign: "right", fontFamily: "monospace", padding: "6px 10px" }} />
        </div>
      ))}
    </div>
  );
}

function ComponentesEditor({ componentes, productos, onChange }) {
  const elegibles = productos.filter((p) => p.tipo !== "Desagregado");
  const total     = calcCostoDesagregado(componentes, productos);
  const add       = () => onChange([...componentes, { productoId: "", cantidad: 1 }]);
  const remove    = (i) => onChange(componentes.filter((_, idx) => idx !== i));
  const upd       = (i, field, val) => { const n = [...componentes]; n[i] = { ...n[i], [field]: val }; onChange(n); };

  return (
    <div>
      <div style={{ border: `1.5px solid ${G.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 130px 36px", padding: "7px 12px", background: G.bg, borderBottom: `1px solid ${G.border}`, fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase" }}>
          <span>Componente</span><span>Cantidad</span><span style={{ textAlign: "right" }}>Subtotal costo</span><span />
        </div>
        {componentes.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#aaa" }}>Agregá los componentes de este producto ↓</div>
        )}
        {componentes.map((c, i) => {
          const prod = elegibles.find((p) => p._id === c.productoId);
          const sub  = (parseFloat(prod?.precioCompra) || 0) * (parseFloat(c.cantidad) || 1);
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 130px 36px", padding: "6px 12px", borderBottom: `1px solid #f0f5f0`, alignItems: "center", gap: 8 }}>
              <div>
                <select value={c.productoId} onChange={(e) => upd(i, "productoId", e.target.value)} style={{ ...inputSt, padding: "6px 8px" }}>
                  <option value="">— Seleccionar —</option>
                  {elegibles.map((p) => <option key={p._id} value={p._id}>{p.nombre}</option>)}
                </select>
                {prod && <div style={{ fontSize: 10, color: prod.rastrearStock ? G.green : G.faint, marginTop: 2 }}>{prod.rastrearStock ? "📦 Afecta inventario" : "🔧 Sin control de stock"}</div>}
              </div>
              <input type="number" min="0.001" step="0.001" value={c.cantidad}
                onChange={(e) => upd(i, "cantidad", parseFloat(e.target.value) || 1)}
                style={{ ...inputSt, padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }} />
              <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 13, color: G.green, fontWeight: 600 }}>{fmt(sub)}</div>
              <button onClick={() => remove(i)} style={{ background: "none", border: "none", cursor: "pointer", color: G.red, fontSize: 16 }}>✕</button>
            </div>
          );
        })}
        {componentes.length > 0 && (
          <div style={{ padding: "9px 12px", display: "flex", justifyContent: "flex-end", borderTop: `1px solid ${G.border}`, background: G.bg }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Costo total calculado: <span style={{ fontFamily: "monospace", color: G.green }}>{fmt(total)}</span></span>
          </div>
        )}
      </div>
      <button onClick={add} style={btn("blue", true)}>+ Agregar componente</button>
    </div>
  );
}

function EtiquetasSelector({ seleccionadas = [], etiquetasDisponibles = [], onChange }) {
  if (!etiquetasDisponibles.length) return (
    <div style={{ padding: "10px 14px", fontSize: 12, color: "#999", background: G.bg, borderRadius: 8, border: `1px dashed ${G.border}` }}>
      Sin etiquetas — configurá en Configuración → Etiquetas de producto
    </div>
  );
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {etiquetasDisponibles.map((et) => {
        const activa = seleccionadas.includes(et.nombre);
        return (
          <button key={et._id} type="button"
            onClick={() => {
              const next = activa ? seleccionadas.filter((e) => e !== et.nombre) : [...seleccionadas, et.nombre];
              onChange(next);
            }}
            style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500,
              cursor: "pointer", border: `1.5px solid ${activa ? G.blue : G.border}`,
              background: activa ? "rgba(27,95,170,.1)" : G.bg,
              color: activa ? G.blue : G.muted, transition: "all .15s",
            }}>
            {activa ? "✓ " : ""}{et.nombre}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TAB ADJUNTOS — subida a Firebase Storage
// ─────────────────────────────────────────────────────────────────
function TabAdjuntos({ adjuntos = [], onChange, productoId }) {
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError]       = useState("");

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tamaño máx 20MB
    if (file.size > 20 * 1024 * 1024) {
      setError("El archivo no puede superar 20 MB");
      return;
    }

    setError("");
    setSubiendo(true);
    setProgreso(0);

    try {
      // Path en Storage: productos/{productoId o timestamp}/{nombre}
      const folder = productoId || `temp_${Date.now()}`;
      const nombreLimpio = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storageRef = ref(storage, `productos/${folder}/${Date.now()}_${nombreLimpio}`);

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on("state_changed",
        (snapshot) => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setProgreso(pct);
        },
        (err) => {
          console.error(err);
          setError("Error al subir el archivo. Intentá de nuevo.");
          setSubiendo(false);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          const nuevoAdjunto = {
            nombre: file.name,
            url,
            tipo: file.type,
            tamano: file.size,
            storagePath: uploadTask.snapshot.ref.fullPath,
            subidoEn: new Date().toISOString(),
          };
          onChange([...adjuntos, nuevoAdjunto]);
          setSubiendo(false);
          setProgreso(0);
          // Limpiar input
          e.target.value = "";
        }
      );
    } catch (err) {
      console.error(err);
      setError("Error inesperado al subir el archivo.");
      setSubiendo(false);
    }
  };

  const eliminar = async (idx) => {
    const adj = adjuntos[idx];
    if (!window.confirm(`¿Eliminar "${adj.nombre}"?`)) return;
    // Intentar eliminar de Storage si tenemos el path
    if (adj.storagePath) {
      try {
        await deleteObject(ref(storage, adj.storagePath));
      } catch (e) {
        // Si falla (ya no existe), continuar igual
        console.warn("No se pudo eliminar de Storage:", e);
      }
    }
    onChange(adjuntos.filter((_, i) => i !== idx));
  };

  const fmtTamano = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const icono = (tipo) => {
    if (!tipo) return "📄";
    if (tipo.includes("pdf")) return "📕";
    if (tipo.includes("image")) return "🖼️";
    if (tipo.includes("spreadsheet") || tipo.includes("excel")) return "📊";
    if (tipo.includes("word") || tipo.includes("document")) return "📝";
    return "📄";
  };

  return (
    <div>
      {/* Zona de subida */}
      <div style={{
        border: `2px dashed ${subiendo ? G.green : G.border}`,
        borderRadius: 10, padding: "20px 24px",
        background: subiendo ? "rgba(46,139,46,.04)" : G.bg,
        textAlign: "center", marginBottom: 16,
        transition: "all .2s",
      }}>
        {subiendo ? (
          <div>
            <div style={{ fontSize: 13, color: G.green, fontWeight: 600, marginBottom: 10 }}>
              Subiendo... {progreso}%
            </div>
            <div style={{ height: 6, background: "#e0f0e0", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progreso}%`, background: G.green, borderRadius: 3, transition: "width .3s" }} />
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: .5 }}>📎</div>
            <div style={{ fontSize: 13, color: G.muted, marginBottom: 12 }}>
              PDF, imágenes, Excel, Word — máx. 20 MB
            </div>
            <label style={{
              ...btn("green"), cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Subir archivo
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.doc,.txt" onChange={handleFile} style={{ display: "none" }} />
            </label>
          </>
        )}
      </div>

      {error && (
        <div style={{ padding: "8px 12px", background: "rgba(211,47,47,.08)", border: "1px solid rgba(211,47,47,.2)", borderRadius: 8, fontSize: 12, color: G.red, marginBottom: 12 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Lista de adjuntos */}
      {adjuntos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "#aaa", fontSize: 13 }}>
          Sin adjuntos — subí fichas técnicas, manuales o imágenes del producto
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {adjuntos.map((adj, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", border: `1px solid ${G.border}`,
              borderRadius: 8, background: "#fff",
            }}>
              {/* Ícono */}
              <div style={{
                width: 36, height: 36, borderRadius: 7,
                background: adj.tipo?.includes("pdf") ? "#FCEBEB" : adj.tipo?.includes("image") ? "#EBF3FC" : "#F0F0F0",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, flexShrink: 0,
              }}>
                {icono(adj.tipo)}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: G.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {adj.nombre}
                </div>
                {adj.tamano && (
                  <div style={{ fontSize: 11, color: G.faint, marginTop: 2 }}>{fmtTamano(adj.tamano)}</div>
                )}
              </div>

              {/* Acciones */}
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <a
                  href={adj.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...btn("blue", true), textDecoration: "none" }}
                  title="Ver / Descargar"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Ver
                </a>
                <button style={btn("red", true)} onClick={() => eliminar(i)} title="Eliminar">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                  </svg>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adjuntos.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 11, color: G.faint }}>
          {adjuntos.length} archivo{adjuntos.length !== 1 ? "s" : ""} adjunto{adjuntos.length !== 1 ? "s" : ""} — estos aparecerán disponibles en la cotización cuando se incluya este producto
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MODAL SELECTOR — Producto/Servicio o Compuesto
// ─────────────────────────────────────────────────────────────────
function ModalSelectorTipo({ onClose, onSeleccionar }) {
  return (
    <Modal title="¿Qué querés importar?" onClose={onClose}>
      <div style={{ display: "flex", gap: 16, padding: "8px 0 16px" }}>
        <button onClick={() => onSeleccionar("simple")}
          style={{ flex: 1, padding: "24px 16px", borderRadius: 12, border: `2px solid ${G.border}`, background: G.bg, cursor: "pointer", textAlign: "center", transition: "all .15s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = G.green; e.currentTarget.style.background = "#f0faf0"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.background = G.bg; }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: G.text }}>Producto / Servicio</div>
          <div style={{ fontSize: 12, color: G.muted, marginTop: 4 }}>Bienes físicos y servicios simples</div>
        </button>
        <button onClick={() => onSeleccionar("compuesto")}
          style={{ flex: 1, padding: "24px 16px", borderRadius: 12, border: `2px solid ${G.border}`, background: G.bg, cursor: "pointer", textAlign: "center", transition: "all .15s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = G.blue; e.currentTarget.style.background = "#f0f5ff"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.background = G.bg; }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔧</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: G.text }}>Compuesto (Desagregado)</div>
          <div style={{ fontSize: 12, color: G.muted, marginTop: 4 }}>Kits con lista de materiales</div>
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
// MODAL SELECTOR — Plantilla
// ─────────────────────────────────────────────────────────────────
function ModalSelectorPlantilla({ onClose }) {
  return (
    <Modal title="¿Qué plantilla necesitás?" onClose={onClose}>
      <div style={{ display: "flex", gap: 16, padding: "8px 0 16px" }}>
        <a href="/plantilla_productos_eco_crm.xlsx" download style={{ flex: 1, textDecoration: "none" }}>
          <div style={{ padding: "24px 16px", borderRadius: 12, border: `2px solid ${G.border}`, background: G.bg, cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: G.text }}>Producto / Servicio</div>
            <div style={{ fontSize: 12, color: G.muted, marginTop: 4 }}>Incluye tiempo y Score para servicios</div>
          </div>
        </a>
        <a href="/plantilla_compuestos_eco_crm.xlsx" download style={{ flex: 1, textDecoration: "none" }}>
          <div style={{ padding: "24px 16px", borderRadius: 12, border: `2px solid ${G.border}`, background: G.bg, cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔧</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: G.text }}>Compuesto (Desagregado)</div>
            <div style={{ fontSize: 12, color: G.muted, marginTop: 4 }}>Con lista de materiales, tiempo y Score</div>
          </div>
        </a>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
// MODAL IMPORTAR COMPUESTOS
// ─────────────────────────────────────────────────────────────────
function ModalImportarCompuestos({ onClose, onImport }) {
  const [archivo,   setArchivo]   = useState(null);
  const [preview,   setPreview]   = useState([]);
  const [totalComp, setTotalComp] = useState(0);
  const [importing, setImporting] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error,     setError]     = useState("");
  const [noEncontrados, setNoEncontrados] = useState([]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setArchivo(file); setError(""); setResultado(null); setPreview([]); setNoEncontrados([]);
    try {
      const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs");
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: "array" });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const todas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const headers = todas[2] || [];
      const datos = todas.slice(4);
      const rows = datos.map(row => Object.fromEntries(headers.map((h, i) => [String(h).trim(), row[i] ?? ""])));
      const grupos = {};
      let nombreActual = "";
      rows.forEach(r => {
        const nombre = String(r.nombre_compuesto || "").trim();
        if (nombre) nombreActual = nombre;
        if (!nombreActual) return;
        if (!grupos[nombreActual]) grupos[nombreActual] = { rows: [], meta: r };
        grupos[nombreActual].rows.push(r);
      });
      const compuestos = Object.keys(grupos);
      setTotalComp(compuestos.length);
      setPreview(compuestos.slice(0, 5).map(n => ({
        nombre: n,
        categoria: grupos[n].meta.categoria || "—",
        precioVenta: grupos[n].meta.precio_venta || 0,
        tiempo: grupos[n].meta.tiempo || 0,
        score: grupos[n].meta.score || 0,
        nComponentes: grupos[n].rows.length,
      })));
    } catch (err) {
      setError("No se pudo leer el archivo. Asegurate de usar la plantilla de compuestos (.xlsx).");
    }
  };

  const handleImport = async () => {
    if (!archivo || totalComp === 0) return;
    setImporting(true);
    try {
      const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs");
      const buf  = await archivo.arrayBuffer();
      const wb   = XLSX.read(buf, { type: "array" });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const todas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const headers = todas[2] || [];
      const datos = todas.slice(4);
      const rows = datos.map(row => Object.fromEntries(headers.map((h, i) => [String(h).trim(), row[i] ?? ""])));
      const prodSnap = await getDocs(collection(db, "productos"));
      const prodMap = {};
      prodSnap.docs.forEach(d => {
        const nombre = (d.data().nombre || "").toLowerCase().trim();
        prodMap[nombre] = { id: d.id, precioCompra: d.data().precioCompra || 0 };
      });
      const listasSnap = await getDocs(collection(db, "listasPrecios"));
      let listaPredId = null;
      listasSnap.docs.forEach(d => { if (d.data().predeterminada) listaPredId = d.id; });
      const grupos = {};
      let nombreActual = "";
      rows.forEach(r => {
        const nombre = String(r.nombre_compuesto || "").trim();
        if (nombre) nombreActual = nombre;
        if (!nombreActual) return;
        if (!grupos[nombreActual]) grupos[nombreActual] = { rows: [], meta: r };
        grupos[nombreActual].rows.push(r);
      });
      let ok = 0, err = 0;
      const noEnc = [];
      for (const [nombre, grupo] of Object.entries(grupos)) {
        const meta = grupo.meta;
        const componentes = [];
        for (const r of grupo.rows) {
          const compNombre = String(r.componente || "").trim();
          if (!compNombre) continue;
          const prod = prodMap[compNombre.toLowerCase()];
          if (!prod) { noEnc.push(compNombre); continue; }
          componentes.push({ productoId: prod.id, cantidad: parseNum(r.cantidad) || 1 });
        }
        const precioVenta = parseNum(meta.precio_venta);
        const preciosLista = listaPredId && precioVenta > 0 ? { [listaPredId]: precioVenta } : {};
        const producto = {
          nombre, tipo: "Desagregado",
          categoria: String(meta.categoria || "").trim(),
          sku: "", unidad: "Global", descripcion: "", notas: "",
          esVenta: true, esCompra: false, rastrearStock: false, stockMinimo: 0,
          precioCompra: 0, precioCompraModo: "auto",
          ivaVentaDefault: 13, ivaVentaSelected: [13],
          ivaCompraDefault: null, ivaCompraSelected: [],
          etiquetas: [], proveedores: [], preciosLista, componentes, adjuntos: [],
          tiempo: parseNum(meta.tiempo) || null, score: parseNum(meta.score) || null,
        };
        const result = await FS.add("productos", producto);
        if (result) ok++; else err++;
      }
      const noEncUnicos = [...new Set(noEnc)];
      setNoEncontrados(noEncUnicos);
      setResultado({ ok, err });
      if (ok > 0) onImport(ok);
    } catch (e) {
      setError("Error durante la importación: " + e.message);
    }
    setImporting(false);
  };

  return (
    <Modal title="🔧 Importar Compuestos desde Excel" onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!resultado ? (
          <>
            <div style={{ background: G.bg, border: `1.5px dashed ${G.border}`, borderRadius: 10, padding: "24px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 13, color: G.muted, marginBottom: 14 }}>Seleccioná la plantilla de <strong>compuestos</strong> completada (.xlsx)</div>
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ fontSize: 13, fontFamily: "inherit", cursor: "pointer" }} />
            </div>
            {error && <div style={{ color: G.red, fontSize: 13, padding: "10px 14px", background: "rgba(211,47,47,.08)", borderRadius: 8 }}>⚠️ {error}</div>}
            {preview.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: G.muted, marginBottom: 8 }}>Vista previa — {totalComp} compuesto{totalComp !== 1 ? "s" : ""} detectado{totalComp !== 1 ? "s" : ""}:</div>
                <div style={{ border: `1px solid ${G.border}`, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 80px 70px 60px", padding: "7px 14px", background: G.bg, borderBottom: `1px solid ${G.border}`, fontSize: 11, fontWeight: 600, color: "#666", textTransform: "uppercase" }}>
                    <span>Nombre</span><span>Categoría</span><span>Componentes</span><span>Tiempo</span><span>Score</span>
                  </div>
                  {preview.map((p, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 80px 70px 60px", padding: "9px 14px", borderBottom: `1px solid #f0f5f0`, fontSize: 13, alignItems: "center" }}>
                      <span style={{ fontWeight: 600 }}>{p.nombre}</span>
                      <span style={{ fontSize: 12, color: G.muted }}>{p.categoria}</span>
                      <span style={{ fontSize: 12, textAlign: "center", color: G.blue }}>{p.nComponentes} mat.</span>
                      <span style={{ fontSize: 12, textAlign: "center", color: G.muted }}>{p.tiempo ? `${p.tiempo}h` : "—"}</span>
                      <span style={{ fontSize: 12, textAlign: "center", color: G.muted }}>{p.score || "—"}</span>
                    </div>
                  ))}
                  {totalComp > 5 && <div style={{ padding: "8px 14px", fontSize: 12, color: G.muted, background: G.bg, textAlign: "center" }}>… y {totalComp - 5} más</div>}
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
              <button style={btn("gray")} onClick={onClose}>Cancelar</button>
              <button style={btn("blue")} onClick={handleImport} disabled={!archivo || importing || totalComp === 0}>
                {importing ? `Importando… (${totalComp} compuestos)` : totalComp > 0 ? `Importar ${totalComp} compuesto${totalComp !== 1 ? "s" : ""}` : "Importar"}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "28px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>{resultado.err === 0 && noEncontrados.length === 0 ? "✅" : "⚠️"}</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>Importación completada</div>
            <div style={{ fontSize: 14, color: G.green, marginBottom: 6 }}>✓ {resultado.ok} compuesto{resultado.ok !== 1 ? "s" : ""} importado{resultado.ok !== 1 ? "s" : ""}</div>
            {resultado.err > 0 && <div style={{ fontSize: 13, color: G.red, marginBottom: 6 }}>✗ {resultado.err} compuesto{resultado.err !== 1 ? "s" : ""} con error</div>}
            {noEncontrados.length > 0 && (
              <div style={{ marginTop: 12, padding: "12px 16px", background: "rgba(211,47,47,.06)", borderRadius: 8, border: "1px solid rgba(211,47,47,.2)", textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: G.red, marginBottom: 8 }}>⚠️ {noEncontrados.length} componente{noEncontrados.length !== 1 ? "s" : ""} no encontrado{noEncontrados.length !== 1 ? "s" : ""}:</div>
                <div style={{ maxHeight: 160, overflowY: "auto" }}>
                  {noEncontrados.map((n, i) => <div key={i} style={{ fontSize: 12, color: G.red, padding: "2px 0", fontFamily: "monospace" }}>• {n}</div>)}
                </div>
                <div style={{ fontSize: 11, color: G.muted, marginTop: 8 }}>Verificá que estos productos existan en el inventario con el mismo nombre exacto.</div>
              </div>
            )}
            <button style={{ ...btn("green"), marginTop: 24 }} onClick={onClose}>Cerrar</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
// MODAL IMPORTAR
// ─────────────────────────────────────────────────────────────────
function ModalImportar({ onClose, onImport }) {
  const [archivo,    setArchivo]    = useState(null);
  const [preview,    setPreview]    = useState([]);
  const [totalRows,  setTotalRows]  = useState(0);
  const [importing,  setImporting]  = useState(false);
  const [resultado,  setResultado]  = useState(null);
  const [error,      setError]      = useState("");
  const [listaPredId,   setListaPredId]   = useState(null);
  const [listaPredSimbolo, setListaPredSimbolo] = useState("$");

  const SIMBOLOS = { USD: "$", CRC: "₡", EUR: "€", GBP: "£", MXN: "$", GTQ: "Q" };

  const SKIP_NOMBRES = [
    "nombre del producto o servicio",
    "nombre del producto",
    "descripción visible al cliente",
    "bien / servicio / desagregado",
    "bien/servicio/desagregado",
  ];
  const esFilaValida = (r) => {
    const nombre = String(r.nombre || "").trim().toLowerCase();
    return nombre.length > 0 && !SKIP_NOMBRES.some((s) => nombre.includes(s));
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setArchivo(file); setError(""); setResultado(null); setPreview([]);
    try {
      const listasSnap = await getDocs(collection(db, "listasPrecios"));
      let predId = null, predMoneda = "USD";
      listasSnap.docs.forEach((d) => { if (d.data().predeterminada) { predId = d.id; predMoneda = d.data().moneda || "USD"; } });
      setListaPredId(predId);
      setListaPredSimbolo(SIMBOLOS[predMoneda] || predMoneda);
      const rows = await leerExcel(file);
      const validas = rows.filter(esFilaValida);
      setTotalRows(validas.length);
      setPreview(validas.slice(0, 5).map((r) => rowToProducto(r, {}, predId)));
    } catch (err) {
      setError("No se pudo leer el archivo. Asegurate de usar la plantilla correcta (.xlsx).");
    }
  };

  const handleImport = async () => {
    if (!archivo || totalRows === 0) return;
    setImporting(true);
    try {
      const provSnap = await getDocs(collection(db, "proveedores"));
      const proveedoresMap = {};
      provSnap.docs.forEach((d) => { const nombre = d.data().nombreComercial || ""; proveedoresMap[nombre.toLowerCase()] = d.id; });
      const listasSnap2 = await getDocs(collection(db, "listasPrecios"));
      let predIdImport = listaPredId;
      if (!predIdImport) listasSnap2.docs.forEach((d) => { if (d.data().predeterminada) predIdImport = d.id; });
      const rows = await leerExcel(archivo);
      const validas = rows.filter(esFilaValida);
      let ok = 0, err = 0;
      for (const row of validas) {
        const producto = rowToProducto(row, proveedoresMap, predIdImport);
        if (!producto.nombre) { err++; continue; }
        const result = await FS.add("productos", producto);
        if (result) ok++; else err++;
      }
      setResultado({ ok, err });
      if (ok > 0) onImport(ok);
    } catch (e) {
      setError("Error durante la importación: " + e.message);
      setImporting(false);
    }
    setImporting(false);
  };

  const tipoColor = { Producto: "blue", Servicio: "green", Desagregado: "purple" };

  return (
    <Modal title="📥 Importar productos desde Excel" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!resultado ? (
          <>
            <div style={{ background: G.bg, border: `1.5px dashed ${G.border}`, borderRadius: 10, padding: "24px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 13, color: G.muted, marginBottom: 14 }}>Seleccioná el archivo <strong>.xlsx</strong> con la plantilla completada</div>
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ fontSize: 13, fontFamily: "inherit", cursor: "pointer" }} />
            </div>
            {error && <div style={{ color: G.red, fontSize: 13, padding: "10px 14px", background: "rgba(211,47,47,.08)", borderRadius: 8, border: `1px solid rgba(211,47,47,.2)` }}>⚠️ {error}</div>}
            {preview.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: G.muted, marginBottom: 8 }}>Vista previa — {totalRows} producto{totalRows !== 1 ? "s" : ""} detectado{totalRows !== 1 ? "s" : ""} (mostrando primeros {preview.length}):</div>
                <div style={{ border: `1px solid ${G.border}`, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 80px 80px", padding: "7px 14px", background: G.bg, borderBottom: `1px solid ${G.border}`, fontSize: 11, fontWeight: 600, color: "#666", textTransform: "uppercase" }}>
                    <span>Nombre</span><span>Tipo</span><span>Unidad</span><span style={{ textAlign: "right" }}>Costo</span><span style={{ textAlign: "right" }}>Precio</span>
                  </div>
                  {preview.map((p, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 80px 80px", padding: "9px 14px", borderBottom: `1px solid #f0f5f0`, fontSize: 13, alignItems: "center" }}>
                      <div><span style={{ fontWeight: 600 }}>{p.nombre}</span>{p.sku && <span style={{ fontSize: 11, color: G.faint, fontFamily: "monospace", marginLeft: 8 }}>{p.sku}</span>}</div>
                      <Badge color={tipoColor[p.tipo] || "gray"}>{p.tipo}</Badge>
                      <span style={{ fontSize: 12, color: G.muted }}>{p.unidad}</span>
                      <span style={{ textAlign: "right", fontFamily: "monospace", fontSize: 12, color: G.green }}>${parseFloat(p.precioCompra || 0).toFixed(2)}</span>
                      <span style={{ textAlign: "right", fontFamily: "monospace", fontSize: 12, color: G.blue }}>
                        {Object.values(p.preciosLista || {})[0] ? `${listaPredSimbolo}${Number(Object.values(p.preciosLista)[0]).toLocaleString("es-CR")}` : "—"}
                      </span>
                    </div>
                  ))}
                  {totalRows > 5 && <div style={{ padding: "8px 14px", fontSize: 12, color: G.muted, background: G.bg, textAlign: "center" }}>… y {totalRows - 5} producto{totalRows - 5 !== 1 ? "s" : ""} más</div>}
                </div>
                <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(27,95,170,.06)", borderRadius: 8, border: `1px solid rgba(27,95,170,.2)`, fontSize: 12, color: G.blue }}>
                  ℹ️ <strong>Productos compuestos (Desagregados)</strong> no se pueden importar por Excel — sus componentes se asignan manualmente en el sistema después de la importación.
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
              <button style={btn("gray")} onClick={onClose}>Cancelar</button>
              <button style={btn("green")} onClick={handleImport} disabled={!archivo || importing || totalRows === 0}>
                {importing ? `Importando… (${totalRows} productos)` : totalRows > 0 ? `Importar ${totalRows} producto${totalRows !== 1 ? "s" : ""}` : "Importar"}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "28px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>{resultado.err === 0 ? "✅" : "⚠️"}</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>Importación completada</div>
            <div style={{ fontSize: 14, color: G.green, marginBottom: 6 }}>✓ {resultado.ok} producto{resultado.ok !== 1 ? "s" : ""} importado{resultado.ok !== 1 ? "s" : ""} correctamente</div>
            {resultado.err > 0 && <div style={{ fontSize: 13, color: G.red, marginBottom: 6 }}>✗ {resultado.err} fila{resultado.err !== 1 ? "s" : ""} con error</div>}
            <div style={{ fontSize: 12, color: G.muted, marginTop: 8 }}>Recordá asignar precios de venta y componentes a los Desagregados desde el módulo.</div>
            <button style={{ ...btn("green"), marginTop: 24 }} onClick={onClose}>Cerrar</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
// MODAL PRODUCTO — con pestaña Adjuntos
// ─────────────────────────────────────────────────────────────────
function ModalProducto({ producto, productos, categorias, listas, etiquetas, proveedores, onClose, onSave }) {
  const isEdit    = !!producto?._id;
  const [activeTab, setActiveTab] = useState("general");
  const [saving,    setSaving]    = useState(false);
  const [form, setForm] = useState({
    nombre:           producto?.nombre           || "",
    tipo:             producto?.tipo             || "Producto",
    categoria:        producto?.categoria        || "",
    sku:              producto?.sku              || "",
    descripcion:      producto?.descripcion      || "",
    unidad:           producto?.unidad           || "Unidad",
    esVenta:          producto?.esVenta          ?? true,
    esCompra:         producto?.esCompra         ?? false,
    etiquetas:        producto?.etiquetas        || [],
    rastrearStock:    producto?.rastrearStock    ?? true,
    stockMinimo:      producto?.stockMinimo      || 0,
    precioCompra:     producto?.precioCompra     || 0,
    precioCompraModo: producto?.precioCompraModo || "manual",
    ivaVentaSelected: producto?.ivaVentaSelected || [],
    ivaVentaDefault:  producto?.ivaVentaDefault  ?? null,
    ivaCompraSelected:producto?.ivaCompraSelected|| [],
    ivaCompraDefault: producto?.ivaCompraDefault ?? null,
    preciosLista:     producto?.preciosLista     || {},
    componentes:      producto?.componentes      || [],
    adjuntos:         producto?.adjuntos         || [],   // ← NUEVO
    proveedores:      producto?.proveedores      || [],
    tiempo:           producto?.tiempo           ?? null,
    score:            producto?.score            ?? null,
    notas:            producto?.notas            || "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const costoAuto = calcCostoDesagregado(form.componentes, productos);
  useEffect(() => {
    if (form.tipo === "Desagregado" && form.precioCompraModo === "auto") set("precioCompra", costoAuto);
  }, [form.componentes, form.precioCompraModo, form.tipo]);

  const handleSave = async () => {
    if (!form.nombre.trim()) { alert("El nombre es obligatorio"); return; }
    setSaving(true);
    await onSave(isEdit ? producto._id : null, form);
    setSaving(false);
    onClose();
  };

  const prodTabs     = ["general", "precios", ...(form.tipo === "Desagregado" ? ["componentes"] : []), "adjuntos"];
  const prodTabLabel = { general: "General", precios: "Precios & IVA", componentes: "Componentes", adjuntos: "Adjuntos" };

  return (
    <Modal title={isEdit ? "✏️ Editar Producto" : "📦 Nuevo Producto"} onClose={onClose} wide>
      <div style={{ display: "flex", borderBottom: `1px solid ${G.border}`, marginBottom: 20, gap: 2 }}>
        {prodTabs.map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ ...btn("gray"), border: "none", borderRadius: 0, background: "none", borderBottom: `2px solid ${activeTab === t ? G.green : "transparent"}`, color: activeTab === t ? G.green : "#777", paddingBottom: 10, fontWeight: activeTab === t ? 600 : 400 }}>
            {prodTabLabel[t]}
            {t === "adjuntos" && form.adjuntos.length > 0 && (
              <span style={{ marginLeft: 5, background: G.blue, color: "#fff", borderRadius: 10, fontSize: 10, padding: "1px 6px" }}>
                {form.adjuntos.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "general" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Fg label="Nombre *" full><input style={inputSt} value={form.nombre} placeholder="Ej: Mini Split 12000 BTU" onChange={(e) => set("nombre", e.target.value)} /></Fg>
          <Fg label="Tipo de Producto *">
            <select style={inputSt} value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
              {["Producto", "Servicio", "Desagregado"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Fg>
          <Fg label="Categoría">
            <select style={inputSt} value={form.categoria} onChange={(e) => set("categoria", e.target.value)}>
              <option value="">— Sin categoría —</option>
              {categorias.map((c) => <option key={c._id} value={c.nombre}>{c.nombre}</option>)}
            </select>
          </Fg>
          <Fg label="Unidad de Medida">
            <select style={inputSt} value={form.unidad} onChange={(e) => set("unidad", e.target.value)}>
              {UNIDADES.map((u) => <option key={u}>{u}</option>)}
            </select>
          </Fg>
          <Fg label="Código / SKU"><input style={inputSt} value={form.sku} placeholder="Opcional" onChange={(e) => set("sku", e.target.value)} /></Fg>
          <Fg label="Stock Mínimo">
            <input style={{ ...inputSt, fontFamily: "monospace" }} type="number" min="0" value={form.stockMinimo} onChange={(e) => set("stockMinimo", parseFloat(e.target.value) || 0)} />
          </Fg>
          <Fg label="Disponible para" full>
            <div style={{ display: "flex", gap: 24, padding: "10px 14px", background: G.bg, borderRadius: 8, border: `1.5px solid ${G.border}` }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={form.esVenta} style={{ accentColor: G.green, width: 16, height: 16 }} onChange={(e) => set("esVenta", e.target.checked)} />
                <span>🛒 <strong>Venta</strong> — aparece al cotizar</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={form.esCompra} style={{ accentColor: G.blue, width: 16, height: 16 }} onChange={(e) => set("esCompra", e.target.checked)} />
                <span>📦 <strong>Compra</strong> — aparece en órdenes de compra</span>
              </label>
            </div>
          </Fg>
          <Fg label="Etiquetas de venta" full>
            <EtiquetasSelector seleccionadas={form.etiquetas} etiquetasDisponibles={etiquetas} onChange={(v) => set("etiquetas", v)} />
          </Fg>
          <Fg label="Rastrear Inventario" full>
            <div style={{ display: "flex", gap: 20 }}>
              {[[true, "Sí — controlar stock"], [false, "No — solo catálogo"]].map(([v, l]) => (
                <label key={String(v)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                  <input type="radio" checked={form.rastrearStock === v} style={{ accentColor: G.green }} onChange={() => set("rastrearStock", v)} />{l}
                </label>
              ))}
            </div>
          </Fg>
          <Fg label="Descripción" full><textarea style={{ ...inputSt, resize: "vertical", minHeight: 70 }} value={form.descripcion} placeholder="Descripción opcional..." onChange={(e) => set("descripcion", e.target.value)} /></Fg>
          <Fg label="Proveedores" full>
            {proveedores.length === 0 ? (
              <div style={{ padding: "10px 14px", fontSize: 12, color: "#999", background: G.bg, borderRadius: 8, border: `1px dashed ${G.border}` }}>Sin proveedores — creá en la pestaña Proveedores primero</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {proveedores.map((prov) => {
                  const activo = form.proveedores.includes(prov._id);
                  return (
                    <button key={prov._id} type="button"
                      onClick={() => { const next = activo ? form.proveedores.filter((id) => id !== prov._id) : [...form.proveedores, prov._id]; set("proveedores", next); }}
                      style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", border: `1.5px solid ${activo ? G.green : G.border}`, background: activo ? "rgba(46,139,46,.12)" : G.bg, color: activo ? G.green : G.muted, transition: "all .15s" }}>
                      {activo ? "✓ " : ""}{prov.nombreComercial}
                    </button>
                  );
                })}
              </div>
            )}
          </Fg>
          <Fg label="Notas internas" full><textarea style={{ ...inputSt, resize: "vertical", minHeight: 60 }} value={form.notas} placeholder="Solo visibles internamente..." onChange={(e) => set("notas", e.target.value)} /></Fg>
          {(form.tipo === "Servicio" || form.tipo === "Desagregado") && (
            <>
              <Fg label="Tiempo (horas de mano de obra)">
                <input style={{ ...inputSt, fontFamily: "monospace" }} type="number" min="0" step="0.25" placeholder="Ej: 2.5" value={form.tiempo ?? ""} onChange={(e) => set("tiempo", parseFloat(e.target.value) || null)} />
              </Fg>
              <Fg label="Score">
                <input style={{ ...inputSt, fontFamily: "monospace" }} type="number" min="0" step="1" placeholder="Ej: 10" value={form.score ?? ""} onChange={(e) => set("score", parseFloat(e.target.value) || null)} />
              </Fg>
            </>
          )}
        </div>
      )}

      {activeTab === "precios" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>💰 Precio de Compra (Costo) en USD</div>
            {form.tipo === "Desagregado" && (
              <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
                {[["auto", "Automático (suma componentes)"], ["manual", "Manual"]].map(([v, l]) => (
                  <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                    <input type="radio" checked={form.precioCompraModo === v} style={{ accentColor: G.green }} onChange={() => set("precioCompraModo", v)} />{l}
                  </label>
                ))}
              </div>
            )}
            <input type="number" step="0.01" min="0"
              disabled={form.tipo === "Desagregado" && form.precioCompraModo === "auto"}
              value={form.precioCompra}
              onChange={(e) => set("precioCompra", parseFloat(e.target.value) || 0)}
              style={{ ...inputSt, fontFamily: "monospace", width: 220, background: (form.tipo === "Desagregado" && form.precioCompraModo === "auto") ? "#f0f7f0" : G.bg }} />
            {form.tipo === "Desagregado" && form.precioCompraModo === "auto" && (
              <div style={{ fontSize: 11, color: G.muted, marginTop: 4 }}>Calculado desde componentes: {fmt(costoAuto)}</div>
            )}
          </div>
          <Fg label="IVA de Compra" full>
            <IvaSelector selected={form.ivaCompraSelected} defaultTasa={form.ivaCompraDefault} onChange={(v) => set("ivaCompraSelected", v)} onDefaultChange={(v) => set("ivaCompraDefault", v)} />
          </Fg>
          <Fg label="Precios de Venta por Lista de Cliente" full>
            <PreciosLista listas={listas} precios={form.preciosLista} onChange={(v) => set("preciosLista", v)} />
          </Fg>
          <Fg label="IVA de Venta" full>
            <IvaSelector selected={form.ivaVentaSelected} defaultTasa={form.ivaVentaDefault} onChange={(v) => set("ivaVentaSelected", v)} onDefaultChange={(v) => set("ivaVentaDefault", v)} />
          </Fg>
        </div>
      )}

      {activeTab === "componentes" && form.tipo === "Desagregado" && (
        <div>
          <div style={{ marginBottom: 12, fontSize: 13, color: G.muted, background: "#f0f7f0", borderRadius: 8, padding: "10px 14px" }}>
            Los componentes con <strong>📦 Afecta inventario</strong> descontarán su stock cuando se consuma este Desagregado.
          </div>
          <ComponentesEditor componentes={form.componentes} productos={productos} onChange={(v) => set("componentes", v)} />
        </div>
      )}

      {/* ── PESTAÑA ADJUNTOS ── */}
      {activeTab === "adjuntos" && (
        <TabAdjuntos
          adjuntos={form.adjuntos}
          onChange={(v) => set("adjuntos", v)}
          productoId={producto?._id}
        />
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 16, borderTop: `1px solid ${G.border}`, marginTop: 20 }}>
        <button style={btn("gray")} onClick={onClose}>Cancelar</button>
        <button style={btn("green")} onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : isEdit ? "Actualizar" : "Crear Producto"}</button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
// MODAL MOVIMIENTO
// ─────────────────────────────────────────────────────────────────
function ModalMovimiento({ productos, empleados, onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipo: "entrada", productoId: "", cantidad: 1, costo: 0,
    tecnicoId: "", tecnicoNombreLibre: "", nota: "",
    fecha: new Date().toISOString().slice(0, 10),
  });
  const set     = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const prodSel = productos.find((p) => p._id === form.productoId);

  const handleSave = async () => {
    if (!form.productoId) { alert("Seleccioná un producto"); return; }
    if (!form.cantidad || form.cantidad <= 0) { alert("La cantidad debe ser mayor a 0"); return; }
    if (form.tipo === "consumo" && !form.tecnicoId) { alert("Seleccioná a quién se entrega el material"); return; }
    setSaving(true);
    const tecnico      = empleados.find((e) => e._id === form.tecnicoId);
    const tecnicoNombre = form.tecnicoId === "__otro__" ? form.tecnicoNombreLibre : tecnico?.nombre || "";
    await onSave({ ...form, productoNombre: prodSel?.nombre || "", tecnicoNombre, _ts: undefined });
    setSaving(false);
    onClose();
  };

  const TIPOS_MOV = [
    { value: "entrada", icon: "📥", label: "Entrada",  desc: "Llegó mercancía a bodega" },
    { value: "consumo", icon: "🔧", label: "Consumo",  desc: "Material entregado a técnico" },
    { value: "ajuste",  icon: "⚖️", label: "Ajuste",   desc: "Corrección manual de stock" },
  ];

  return (
    <Modal title="📋 Registrar Movimiento de Inventario" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Fg label="Tipo de Movimiento" full>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {TIPOS_MOV.map((t) => (
              <div key={t.value} onClick={() => set("tipo", t.value)}
                style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer", border: `1.5px solid ${form.tipo === t.value ? G.green : G.border}`, background: form.tipo === t.value ? "#f0faf0" : G.bg, transition: "all .15s" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: form.tipo === t.value ? G.green : G.text }}>{t.icon} {t.label}</div>
                <div style={{ fontSize: 10, color: G.muted, marginTop: 3 }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </Fg>
        <Fg label="Producto *" full>
          <select style={inputSt} value={form.productoId} onChange={(e) => set("productoId", e.target.value)}>
            <option value="">— Seleccionar producto —</option>
            {productos.filter((p) => p.rastrearStock).map((p) => <option key={p._id} value={p._id}>{p.nombre}</option>)}
          </select>
          {prodSel && <div style={{ fontSize: 11, color: G.muted }}>Categoría: {prodSel.categoria || "—"} · Unidad: {prodSel.unidad || "Unidad"}</div>}
        </Fg>
        <Fg label={`Cantidad ${prodSel ? `(${prodSel.unidad || "Unidad"})` : ""}${form.tipo === "ajuste" ? " — negativo para bajar" : ""}`}>
          <input type="number" step="0.001" style={{ ...inputSt, fontFamily: "monospace" }} value={form.cantidad} onChange={(e) => set("cantidad", parseFloat(e.target.value) || 0)} />
        </Fg>
        {form.tipo === "entrada" && (
          <Fg label="Costo unitario (USD)">
            <input type="number" min="0" step="0.01" style={{ ...inputSt, fontFamily: "monospace" }} value={form.costo} onChange={(e) => set("costo", parseFloat(e.target.value) || 0)} />
          </Fg>
        )}
        {form.tipo === "consumo" && (
          <Fg label="Entregado a — técnico / pareja *" full>
            <select style={inputSt} value={form.tecnicoId} onChange={(e) => set("tecnicoId", e.target.value)}>
              <option value="">— Seleccionar —</option>
              {empleados.map((e) => <option key={e._id} value={e._id}>{e.nombre}{e.cargo ? ` — ${e.cargo}` : ""}</option>)}
              <option value="__otro__">✏️ Otro / escribir nombre</option>
            </select>
            {form.tecnicoId === "__otro__" && (
              <input style={{ ...inputSt, marginTop: 6 }} placeholder="Nombre del técnico o pareja" value={form.tecnicoNombreLibre} onChange={(e) => set("tecnicoNombreLibre", e.target.value)} />
            )}
          </Fg>
        )}
        <Fg label="Fecha">
          <input type="date" style={inputSt} value={form.fecha} onChange={(e) => set("fecha", e.target.value)} />
        </Fg>
        <Fg label="Nota" full>
          <textarea style={{ ...inputSt, resize: "vertical", minHeight: 60 }}
            placeholder={form.tipo === "consumo" ? "Ej: Para trabajo en Escazú" : form.tipo === "entrada" ? "Ej: Compra factura #123" : "Motivo del ajuste..."}
            value={form.nota} onChange={(e) => set("nota", e.target.value)} />
        </Fg>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 16, borderTop: `1px solid ${G.border}`, marginTop: 16 }}>
        <button style={btn("gray")} onClick={onClose}>Cancelar</button>
        <button style={btn("green")} onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Registrar"}</button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
// MODAL HISTORIAL
// ─────────────────────────────────────────────────────────────────
function ModalHistorial({ producto, movimientos, onClose }) {
  const movsProd = movimientos.filter((m) => m.productoId === producto._id).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const stock    = stockDeProducto(producto._id, movimientos);
  const entradas = movsProd.filter((m) => m.tipo === "entrada").reduce((s, m) => s + (m.cantidad || 0), 0);
  const salidas  = movsProd.filter((m) => m.tipo !== "entrada").reduce((s, m) => s + Math.abs(m.cantidad || 0), 0);
  const tipoInfo = {
    entrada: { label: "Entrada", color: "green",  icon: "📥" },
    venta:   { label: "Venta",   color: "blue",   icon: "🛒" },
    consumo: { label: "Consumo", color: "orange", icon: "🔧" },
    ajuste:  { label: "Ajuste",  color: "gray",   icon: "⚖️" },
  };
  return (
    <Modal title={`📊 Historial — ${producto.nombre}`} onClose={onClose} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Stock actual",  val: `${stock.toFixed(2)} ${producto.unidad || "u"}`,    color: stock < (producto.stockMinimo || 0) ? G.red : G.green },
          { label: "Total entrado", val: `${entradas.toFixed(2)} ${producto.unidad || "u"}`, color: G.blue  },
          { label: "Total salido",  val: `${salidas.toFixed(2)} ${producto.unidad || "u"}`,  color: G.muted },
        ].map((s) => (
          <div key={s.label} style={{ background: G.bg, border: `1.5px solid ${G.border}`, borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, color: G.muted, textTransform: "uppercase", letterSpacing: ".6px" }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: s.color, marginTop: 4 }}>{s.val}</div>
          </div>
        ))}
      </div>
      <div style={{ border: `1px solid ${G.border}`, borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Fecha","Tipo","Cantidad","Entregado a / Nota","Costo unit."].map((h) => <Th key={h}>{h}</Th>)}</tr></thead>
          <tbody>
            {movsProd.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "#aaa" }}>Sin movimientos</td></tr>}
            {movsProd.map((m, i) => {
              const info = tipoInfo[m.tipo] || tipoInfo.ajuste;
              return (
                <tr key={i} style={{ borderBottom: `1px solid #f0f5f0` }}>
                  <td style={{ padding: "9px 14px", fontSize: 12, fontFamily: "monospace" }}>{m.fecha || "—"}</td>
                  <td style={{ padding: "9px 14px" }}><Badge color={info.color}>{info.icon} {info.label}</Badge></td>
                  <td style={{ padding: "9px 14px", fontFamily: "monospace", fontWeight: 600, color: m.tipo === "entrada" ? G.green : G.red }}>
                    {m.tipo === "entrada" ? "+" : "-"}{Math.abs(m.cantidad)} {producto.unidad || ""}
                  </td>
                  <td style={{ padding: "9px 14px", fontSize: 12, color: G.muted }}>
                    {[m.tecnicoNombre && `👷 ${m.tecnicoNombre}`, m.nota].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 12 }}>{m.costo ? `$${parseFloat(m.costo).toFixed(2)}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button style={btn("gray")} onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
// MODAL PROVEEDOR
// ─────────────────────────────────────────────────────────────────
function ModalProveedor({ proveedor, onClose, onSave }) {
  const isEdit  = !!proveedor?._id;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombreComercial: proveedor?.nombreComercial || "",
    razonSocial:     proveedor?.razonSocial     || "",
    cedula:          proveedor?.cedula          || "",
    telefono:        proveedor?.telefono        || "",
    email:           proveedor?.email           || "",
    direccion:       proveedor?.direccion       || "",
    contacto:        proveedor?.contacto        || "",
    telContacto:     proveedor?.telContacto     || "",
    web:             proveedor?.web             || "",
    tipos:           proveedor?.tipos           || [],
    notas:           proveedor?.notas           || "",
    activo:          proveedor?.activo          ?? true,
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleTipo = (t) => {
    const next = form.tipos.includes(t) ? form.tipos.filter((x) => x !== t) : [...form.tipos, t];
    set("tipos", next);
  };

  const handleSave = async () => {
    if (!form.nombreComercial.trim()) { alert("El nombre comercial es obligatorio"); return; }
    setSaving(true);
    await onSave(isEdit ? proveedor._id : null, form);
    setSaving(false);
    onClose();
  };

  const Row = ({ label, field, placeholder, type }) => (
    <Fg label={label}>
      <input style={inputSt} type={type || "text"} value={form[field]} placeholder={placeholder} onChange={(e) => set(field, e.target.value)} />
    </Fg>
  );

  return (
    <Modal title={isEdit ? "✏️ Editar Proveedor" : "🏢 Nuevo Proveedor"} onClose={onClose} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Row label="Nombre Comercial *" field="nombreComercial" placeholder="Ej: Extralum" />
        <Row label="Razón Social / Legal"     field="razonSocial"  placeholder="Ej: Extralum S.A." />
        <Row label="Cédula Jurídica / Física" field="cedula"       placeholder="3-101-XXXXXX" />
        <Row label="Teléfono"                 field="telefono"     placeholder="2222-2222" />
        <Row label="Email"                    field="email"        placeholder="contacto@proveedor.com" type="email" />
        <Row label="Persona de Contacto"      field="contacto"     placeholder="Nombre del vendedor" />
        <Row label="Tel. Contacto Directo"    field="telContacto"  placeholder="8888-8888" />
        <Row label="Sitio Web"                field="web"          placeholder="https://proveedor.com" />
        <Fg label="Dirección" full>
          <input style={inputSt} value={form.direccion} placeholder="Provincia, cantón, dirección exacta" onChange={(e) => set("direccion", e.target.value)} />
        </Fg>
        <Fg label="Tipos de proveedor" full>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TIPOS_PROV.map((t) => {
              const activo = form.tipos.includes(t);
              return (
                <button key={t} type="button" onClick={() => toggleTipo(t)}
                  style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", border: `1.5px solid ${activo ? G.green : G.border}`, background: activo ? "rgba(46,139,46,.12)" : G.bg, color: activo ? G.green : G.muted, transition: "all .15s" }}>
                  {activo ? "✓ " : ""}{t}
                </button>
              );
            })}
          </div>
        </Fg>
        <Fg label="Estado">
          <select style={inputSt} value={form.activo ? "true" : "false"} onChange={(e) => set("activo", e.target.value === "true")}>
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </Fg>
        <Fg label="Notas" full>
          <textarea style={{ ...inputSt, resize: "vertical", minHeight: 70 }} value={form.notas}
            placeholder="Condiciones de pago, tiempo de entrega, etc." onChange={(e) => set("notas", e.target.value)} />
        </Fg>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 16, borderTop: `1px solid ${G.border}`, marginTop: 16 }}>
        <button style={btn("gray")} onClick={onClose}>Cancelar</button>
        <button style={btn("green")} onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : isEdit ? "Actualizar" : "Crear Proveedor"}</button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
// TAB PRODUCTOS
// ─────────────────────────────────────────────────────────────────
function TabProductos({ productos, movimientos, listas, proveedores, onEdit, onHistorial, onDelete, esAdmin, onImportar, onPlantilla }) {
  const [search,      setSearch]      = useState("");
  const [filtCat,     setFiltCat]     = useState("");
  const [filtTipo,    setFiltTipo]    = useState("");
  const [filtProv,    setFiltProv]    = useState("");
  const cats      = [...new Set(productos.map((p) => p.categoria).filter(Boolean))].sort();
  const tipoColor = { Producto: "blue", Servicio: "green", Desagregado: "purple" };
  const provMap = Object.fromEntries(proveedores.map((p) => [p._id, p.nombreComercial]));

  const filtered = productos.filter((p) => {
    const q = search.toLowerCase();
    return (!q || p.nombre?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
      && (!filtCat  || p.categoria === filtCat)
      && (!filtTipo || p.tipo === filtTipo)
      && (!filtProv || (p.proveedores || []).includes(filtProv));
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...inputSt, width: 200 }} placeholder="Buscar nombre o SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ ...inputSt, width: 180 }} value={filtCat} onChange={(e) => setFiltCat(e.target.value)}>
          <option value="">🏷️ Todas las categorías</option>
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select style={{ ...inputSt, width: 160 }} value={filtTipo} onChange={(e) => setFiltTipo(e.target.value)}>
          <option value="">📦 Todos los tipos</option>
          {["Producto", "Servicio", "Desagregado"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <select style={{ ...inputSt, width: 180 }} value={filtProv} onChange={(e) => setFiltProv(e.target.value)}>
          <option value="">🏢 Todos los proveedores</option>
          {proveedores.filter((p) => p.activo !== false).map((p) => <option key={p._id} value={p._id}>{p.nombreComercial}</option>)}
        </select>
        {esAdmin && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button style={btn("gray")} onClick={() => onPlantilla()} title="Descargar plantilla Excel">📄 Plantilla</button>
            <button style={btn("orange")} onClick={onImportar} title="Importar productos desde Excel">📥 Importar</button>
          </div>
        )}
      </div>
      <div style={{ border: `1px solid ${G.border}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{["Nombre / SKU","Tipo","Categoría","Proveedor(es)","Adjuntos","Stock","Acciones"].map((h) => <Th key={h}>{h}</Th>)}</tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#aaa" }}>
                <div style={{ fontSize: 28, marginBottom: 8, opacity: .3 }}>📦</div>Sin productos
              </td></tr>
            )}
            {filtered.map((p) => {
              const stock    = stockDeProducto(p._id, movimientos);
              const bajoMin  = p.rastrearStock && stock < (p.stockMinimo || 0);
              const provNombres = (p.proveedores || []).map((id) => provMap[id]).filter(Boolean);
              const nAdj = (p.adjuntos || []).length;
              return (
                <tr key={p._id} style={{ borderBottom: `1px solid #f0f5f0` }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f5fbf5"}
                  onMouseLeave={(e) => e.currentTarget.style.background = ""}>
                  <td style={{ padding: "9px 14px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.nombre}</div>
                    {p.sku && <div style={{ fontSize: 11, color: G.faint, fontFamily: "monospace" }}>{p.sku}</div>}
                    {(p.etiquetas || []).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                        {(p.etiquetas || []).map((e) => <Badge key={e} color="purple">{e}</Badge>)}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "9px 14px" }}><Badge color={tipoColor[p.tipo] || "gray"}>{p.tipo}</Badge></td>
                  <td style={{ padding: "9px 14px", fontSize: 13, color: G.muted }}>{p.categoria || "—"}</td>
                  <td style={{ padding: "9px 14px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {provNombres.length > 0
                        ? provNombres.map((n) => <Badge key={n} color="blue">{n}</Badge>)
                        : <span style={{ color: G.faint, fontSize: 11 }}>—</span>}
                    </div>
                  </td>
                  {/* Columna adjuntos */}
                  <td style={{ padding: "9px 14px" }}>
                    {nAdj > 0
                      ? <span style={{ fontSize: 11, fontWeight: 600, color: G.blue, background: "rgba(27,95,170,.1)", padding: "2px 8px", borderRadius: 4 }}>📎 {nAdj}</span>
                      : <span style={{ color: G.faint, fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ padding: "9px 14px" }}>
                    {p.rastrearStock
                      ? <span style={{ fontFamily: "monospace", fontWeight: 600, color: bajoMin ? G.red : G.text }}>
                          {stock.toFixed(2)} {p.unidad || ""}
                          {bajoMin && <span style={{ fontSize: 10, color: G.red, display: "block" }}>⚠️ mín: {p.stockMinimo}</span>}
                        </span>
                      : <span style={{ color: G.faint, fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: "9px 14px" }}>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button title="Historial" style={btn("blue", true)} onClick={() => onHistorial(p)}>📊</button>
                      <button title="Editar"    style={btn("gray", true)} onClick={() => onEdit(p)}>✏️</button>
                      <button title="Eliminar"  style={btn("red",  true)} onClick={() => onDelete(p)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TAB PROVEEDORES
// ─────────────────────────────────────────────────────────────────
function TabProveedores({ proveedores, onEdit, onDelete }) {
  const [search,    setSearch]    = useState("");
  const [filtTipo,  setFiltTipo]  = useState("");
  const todosLosTipos = [...new Set(proveedores.flatMap((p) => p.tipos || (p.tipo ? [p.tipo] : [])))].sort();
  const filtered = proveedores.filter((p) => {
    const q     = search.toLowerCase();
    const tipos = p.tipos || (p.tipo ? [p.tipo] : []);
    return (!q || p.nombreComercial?.toLowerCase().includes(q) || tipos.join(" ").toLowerCase().includes(q))
      && (!filtTipo || tipos.includes(filtTipo));
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...inputSt, width: 260 }} placeholder="Buscar proveedor..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ ...inputSt, width: 200 }} value={filtTipo} onChange={(e) => setFiltTipo(e.target.value)}>
          <option value="">🏷️ Todos los tipos</option>
          {todosLosTipos.map((t) => <option key={t}>{t}</option>)}
        </select>
        <span style={{ fontSize: 12, color: G.muted, marginLeft: 4 }}>{filtered.length} proveedor{filtered.length !== 1 ? "es" : ""}</span>
      </div>
      <div style={{ border: `1px solid ${G.border}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{["#","Nombre Comercial","Razón Social","Cédula","Contacto","Tipos","Estado","Acciones"].map((h) => <Th key={h}>{h}</Th>)}</tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#aaa" }}>
                <div style={{ fontSize: 28, marginBottom: 8, opacity: .3 }}>🏢</div>Sin proveedores
              </td></tr>
            )}
            {filtered.map((p, idx) => {
              const tipos = p.tipos || (p.tipo ? [p.tipo] : []);
              return (
                <tr key={p._id} style={{ borderBottom: `1px solid #f0f5f0` }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f5fbf5"}
                  onMouseLeave={(e) => e.currentTarget.style.background = ""}>
                  <td style={{ padding: "9px 14px", fontSize: 12, color: G.faint, fontWeight: 600, width: 40 }}>{idx + 1}</td>
                  <td style={{ padding: "9px 14px", fontWeight: 600, fontSize: 13 }}>{p.nombreComercial}</td>
                  <td style={{ padding: "9px 14px", fontSize: 12, color: G.muted }}>{p.razonSocial || "—"}</td>
                  <td style={{ padding: "9px 14px", fontSize: 12, fontFamily: "monospace" }}>{p.cedula || "—"}</td>
                  <td style={{ padding: "9px 14px", fontSize: 12 }}>
                    {p.contacto && <div>{p.contacto}</div>}
                    {p.telefono && <div style={{ color: G.muted }}>{p.telefono}</div>}
                    {p.email    && <div style={{ color: G.blue, fontSize: 11 }}>{p.email}</div>}
                  </td>
                  <td style={{ padding: "9px 14px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {tipos.length > 0 ? tipos.map((t) => <Badge key={t} color="blue">{t}</Badge>) : <span style={{ color: G.faint, fontSize: 11 }}>—</span>}
                    </div>
                  </td>
                  <td style={{ padding: "9px 14px" }}><Badge color={p.activo !== false ? "green" : "gray"}>{p.activo !== false ? "Activo" : "Inactivo"}</Badge></td>
                  <td style={{ padding: "9px 14px" }}>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button style={btn("gray", true)} onClick={() => onEdit(p)}>✏️</button>
                      <button style={btn("red",  true)} onClick={() => onDelete(p)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TAB MOVIMIENTOS
// ─────────────────────────────────────────────────────────────────
function TabMovimientos({ movimientos, productos }) {
  const [filtTipo, setFiltTipo] = useState("");
  const [search,   setSearch]   = useState("");
  const tipoInfo = {
    entrada: { label: "Entrada", color: "green",  icon: "📥" },
    venta:   { label: "Venta",   color: "blue",   icon: "🛒" },
    consumo: { label: "Consumo", color: "orange", icon: "🔧" },
    ajuste:  { label: "Ajuste",  color: "gray",   icon: "⚖️" },
  };
  const sorted   = [...movimientos].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const filtered = sorted.filter((m) => {
    const q = search.toLowerCase();
    return (!q || m.productoNombre?.toLowerCase().includes(q) || m.tecnicoNombre?.toLowerCase().includes(q) || m.nota?.toLowerCase().includes(q))
      && (!filtTipo || m.tipo === filtTipo);
  });
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input style={{ ...inputSt, width: 260 }} placeholder="Buscar producto, técnico, nota..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ ...inputSt, width: 190 }} value={filtTipo} onChange={(e) => setFiltTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(tipoInfo).map(([v, i]) => <option key={v} value={v}>{i.icon} {i.label}</option>)}
        </select>
      </div>
      <div style={{ border: `1px solid ${G.border}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Fecha","Tipo","Producto","Cantidad","Entregado a / Nota","Costo unit."].map((h) => <Th key={h}>{h}</Th>)}</tr></thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#aaa" }}>
                <div style={{ fontSize: 28, marginBottom: 8, opacity: .3 }}>📋</div>Sin movimientos
              </td></tr>
            )}
            {filtered.map((m, i) => {
              const info = tipoInfo[m.tipo] || tipoInfo.ajuste;
              const prod = productos.find((p) => p._id === m.productoId);
              return (
                <tr key={i} style={{ borderBottom: `1px solid #f0f5f0` }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f5fbf5"}
                  onMouseLeave={(e) => e.currentTarget.style.background = ""}>
                  <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 12 }}>{m.fecha || "—"}</td>
                  <td style={{ padding: "9px 14px" }}><Badge color={info.color}>{info.icon} {info.label}</Badge></td>
                  <td style={{ padding: "9px 14px", fontWeight: 600, fontSize: 13 }}>{m.productoNombre || "—"}</td>
                  <td style={{ padding: "9px 14px", fontFamily: "monospace", fontWeight: 600, color: m.tipo === "entrada" ? G.green : G.red }}>
                    {m.tipo === "entrada" ? "+" : "-"}{Math.abs(m.cantidad)} {prod?.unidad || ""}
                  </td>
                  <td style={{ padding: "9px 14px", fontSize: 12, color: G.muted }}>
                    {[m.tecnicoNombre && `👷 ${m.tecnicoNombre}`, m.nota].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 12 }}>{m.costo ? `$${parseFloat(m.costo).toFixed(2)}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────
export default function InventarioPage() {
  const { usuario }                   = useAuth();
  const esAdmin = usuario?.rol === "Super Administrador";

  const [tab,         setTab]         = useState("productos");
  const [productos,   setProductos]   = useState([]);
  const [categorias,  setCategorias]  = useState([]);
  const [listas,      setListas]      = useState([]);
  const [etiquetas,   setEtiquetas]   = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [empleados,   setEmpleados]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [toast,       setToast]       = useState(null);
  const [modal,       setModal]       = useState(null);

  const showToast  = (msg, tipo = "ok") => setToast({ msg, tipo });
  const closeModal = () => setModal(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [prods, cats, ls, provs, movs, emps, ets] = await Promise.all([
      FS.getAll("productos"),
      FS.getAll("categorias"),
      FS.getAll("listasPrecios"),
      FS.getAll("proveedores"),
      FS.getAll("movimientosInventario"),
      FS.getAll("empleados"),
      FS.getAll("catalogo_etiquetas_producto"),
    ]);
    setProductos(prods); setCategorias(cats); setListas(ls);
    setProveedores(provs); setMovimientos(movs); setEmpleados(emps);
    setEtiquetas(ets);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSaveProducto = async (id, form) => {
    if (id) {
      await FS.update("productos", id, form);
      setProductos((prev) => prev.map((p) => p._id === id ? { ...p, ...form } : p));
      showToast("Producto actualizado ✓");
    } else {
      const newId = await FS.add("productos", form);
      if (newId) { setProductos((prev) => [...prev, { _id: newId, ...form }]); showToast("Producto creado ✓"); }
    }
  };

  const handleSaveProveedor = async (id, form) => {
    if (id) {
      await FS.update("proveedores", id, form);
      setProveedores((prev) => prev.map((p) => p._id === id ? { ...p, ...form } : p));
      showToast("Proveedor actualizado ✓");
    } else {
      const newId = await FS.add("proveedores", form);
      if (newId) { setProveedores((prev) => [...prev, { _id: newId, ...form }]); showToast("Proveedor creado ✓"); }
    }
  };

  const handleSaveMovimiento = async (form) => {
    const { _ts, ...data } = form;
    const newId = await FS.add("movimientosInventario", data);
    if (newId) { setMovimientos((prev) => [...prev, { _id: newId, ...data }]); showToast("Movimiento registrado ✓"); }
  };

  const handleDelete = async (col, id, nombre) => {
    if (!window.confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
    await FS.remove(col, id);
    if (col === "productos")   setProductos  ((prev) => prev.filter((p) => p._id !== id));
    if (col === "proveedores") setProveedores((prev) => prev.filter((p) => p._id !== id));
    showToast("Eliminado ✓");
  };

  const bajoStock = productos.filter((p) => p.rastrearStock && stockDeProducto(p._id, movimientos) < (p.stockMinimo || 0)).length;
  const movsMes   = movimientos.filter((m) => {
    const now = new Date();
    return (m.fecha || "").startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  }).length;

  return (
    <div style={{ padding: "28px 32px", fontFamily: "'Space Grotesk','Segoe UI',sans-serif", background: "#f4f6f8", minHeight: "100vh" }}>
      <style>{`
        @keyframes slideUp { from { transform:translateY(60px);opacity:0 } to { transform:translateY(0);opacity:1 } }
        input:focus, select:focus, textarea:focus { border-color:#2e8b2e !important; box-shadow:0 0 0 3px rgba(46,139,46,.1); background:#fff !important; outline:none; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: G.text }}>📦 Inventario</div>
          <div style={{ fontSize: 13, color: G.muted, marginTop: 2 }}>Productos, proveedores y movimientos de stock</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(tab === "productos" || tab === "movimientos") && (
            <button style={btn("blue")} onClick={() => setModal({ type: "movimiento" })}>📋 Registrar Movimiento</button>
          )}
          {tab === "productos" && (
            <button style={btn("green")} onClick={() => setModal({ type: "producto" })}>+ Nuevo Producto</button>
          )}
          {tab === "proveedores" && (
            <button style={btn("green")} onClick={() => setModal({ type: "proveedor" })}>+ Nuevo Proveedor</button>
          )}
        </div>
      </div>

      {/* Estadísticas */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Productos",            val: productos.length,                                        icon: "📦", color: G.green },
          { label: "Bajo stock",           val: bajoStock,                                               icon: "⚠️", color: bajoStock > 0 ? G.red : G.faint },
          { label: "Proveedores activos",  val: proveedores.filter((p) => p.activo !== false).length,    icon: "🏢", color: G.blue  },
          { label: "Movimientos este mes", val: movsMes,                                                  icon: "📋", color: G.muted },
        ].map((s) => (
          <div key={s.label} style={{ background: "#fff", border: `1.5px solid ${G.border}`, borderRadius: 10, padding: "10px 16px", boxShadow: "0 2px 8px rgba(0,0,0,.06)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16, opacity: .7 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".6px", color: G.muted, fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: s.color }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, background: "#fff", border: `1px solid ${G.border}`, borderRadius: 10, padding: 4, width: "fit-content" }}>
        {TABS_MAIN.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ ...btn(tab === t.id ? "green" : "gray"), border: "none", borderRadius: 7, background: tab === t.id ? G.green : "transparent", color: tab === t.id ? "#fff" : G.muted, fontWeight: tab === t.id ? 600 : 400 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: G.muted }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: .4 }}>⏳</div>Cargando…
        </div>
      ) : (
        <>
          {tab === "productos" && (
            <TabProductos
              productos={productos}
              movimientos={movimientos}
              listas={listas}
              proveedores={proveedores}
              onEdit={(p) => setModal({ type: "producto", data: p })}
              onHistorial={(p) => setModal({ type: "historial", data: p })}
              onDelete={(p) => handleDelete("productos", p._id, p.nombre)}
              esAdmin={esAdmin}
              onImportar={() => setModal({ type: "elegir_importar" })}
              onPlantilla={() => setModal({ type: "elegir_plantilla" })}
            />
          )}
          {tab === "proveedores" && (
            <TabProveedores
              proveedores={proveedores}
              onEdit={(p) => setModal({ type: "proveedor", data: p })}
              onDelete={(p) => handleDelete("proveedores", p._id, p.nombreComercial)}
            />
          )}
          {tab === "movimientos" && (
            <TabMovimientos movimientos={movimientos} productos={productos} />
          )}
        </>
      )}

      {/* Modales */}
      {modal?.type === "elegir_plantilla"   && <ModalSelectorPlantilla onClose={closeModal} />}
      {modal?.type === "elegir_importar"    && <ModalSelectorTipo onClose={closeModal} onSeleccionar={(tipo) => { closeModal(); setModal({ type: tipo === "simple" ? "importar" : "importar_compuesto" }); }} />}
      {modal?.type === "importar_compuesto" && <ModalImportarCompuestos onClose={closeModal} onImport={async (cantidad) => { closeModal(); await loadAll(); showToast(`${cantidad} compuesto${cantidad !== 1 ? "s" : ""} importado${cantidad !== 1 ? "s" : ""} ✓`); }} />}
      {modal?.type === "producto"   && <ModalProducto   producto={modal.data} productos={productos} categorias={categorias} listas={listas} etiquetas={etiquetas} proveedores={proveedores} onClose={closeModal} onSave={handleSaveProducto} />}
      {modal?.type === "proveedor"  && <ModalProveedor  proveedor={modal.data} onClose={closeModal} onSave={handleSaveProveedor} />}
      {modal?.type === "movimiento" && <ModalMovimiento  productos={productos} empleados={empleados} onClose={closeModal} onSave={handleSaveMovimiento} />}
      {modal?.type === "historial"  && <ModalHistorial   producto={modal.data} movimientos={movimientos} onClose={closeModal} />}
      {modal?.type === "importar"   && (
        <ModalImportar
          onClose={closeModal}
          onImport={async (cantidad) => {
            closeModal();
            await loadAll();
            showToast(`${cantidad} producto${cantidad !== 1 ? "s" : ""} importado${cantidad !== 1 ? "s" : ""} ✓`);
          }}
        />
      )}

      {toast && <Toast msg={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}