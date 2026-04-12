/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: CotizacionForm.jsx
 * Módulo:  Ventas
 * ============================================================
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc, getDoc, updateDoc, collection, getDocs,
  serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { db } from "../../../firebase/config";

const sym = (mon) => mon === "USD" ? "$" : "₡";
const fmtN = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const IVA_OPCIONES = [
  { label: "13%", value: 13 },
  { label: "4%",  value: 4  },
  { label: "2%",  value: 2  },
  { label: "1%",  value: 1  },
  { label: "0%",  value: 0  },
];

const calcLinea = (p) => {
  const precio   = Number(p.precio || 0);
  const cant     = Number(p.cantidad || 1);
  const descPct  = p.descTipo === "%" ? Number(p.desc || 0) : 0;
  const descMonto= p.descTipo === "$" ? Number(p.desc || 0) : 0;
  const base     = precio * cant;
  const descTotal= descPct > 0 ? base * (descPct / 100) : descMonto * cant;
  const neto     = base - descTotal;
  const ivaPct   = Number(p.ivaPct ?? 13) / 100;
  const imp      = neto * ivaPct;
  return { base, neto, imp, total: neto + imp };
};

const calcOpcion = (op, descGlobal, descGlobalTipo) => {
  const prods    = (op.productos || []);
  const subtotal = prods.reduce((a, p) => a + calcLinea(p).neto, 0);
  const descG    = descGlobalTipo === "%" ? subtotal * (Number(descGlobal || 0) / 100) : Number(descGlobal || 0);
  const base     = subtotal - descG;
  const iva      = prods.reduce((a, p) => {
    const calc  = calcLinea(p);
    return a + calc.imp;
  }, 0);
  // Recalc iva after global discount proportionally
  const ivaReal  = base > 0 && subtotal > 0 ? iva * (base / subtotal) : 0;
  return { subtotal, descG, base, iva: ivaReal, total: base + ivaReal };
};

const COLS_DEFAULT = { costo: true, margen: true, margenp: true, udm: false, plazo: false, subtotsin: false, totcon: true, imppct: false, iva: true };
const genId = () => Math.random().toString(36).slice(2, 8);

// ── Modal plantillas observaciones ───────────────────────────────────────────
function ModalPlantillas({ plantillas, onSeleccionar, onCerrar }) {
  const [seleccionado, setSeleccionado] = useState(null);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", backdropFilter:"blur(3px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background:"#fff", borderRadius:14, width:"95%", maxWidth:580, maxHeight:"80vh", display:"flex", flexDirection:"column", boxShadow:"0 20px 60px rgba(0,0,0,.2)", border:"0.5px solid #e0e0e0" }}>
        <div style={{ padding:"16px 20px", borderBottom:"0.5px solid rgba(0,0,0,.08)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:15, fontWeight:600, color:"#1a1a1a" }}>Plantillas de observaciones</div>
            <div style={{ fontSize:11, color:"#999", marginTop:2 }}>Seleccioná una plantilla para cargarla. Podés editarla después.</div>
          </div>
          <button onClick={onCerrar} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#aaa", lineHeight:1, padding:"4px 8px" }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:16, display:"flex", flexDirection:"column", gap:8 }}>
          {plantillas.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 20px", color:"#aaa" }}>
              <div style={{ fontSize:32, marginBottom:10, opacity:0.3 }}>📝</div>
              <div style={{ fontSize:13, marginBottom:6 }}>No hay plantillas creadas.</div>
              <div style={{ fontSize:11 }}>Configuración → Plantilla Cotización → Observaciones</div>
            </div>
          ) : plantillas.map(p => (
            <div key={p.id} onClick={() => setSeleccionado(p.id === seleccionado ? null : p.id)}
              style={{ border:`1.5px solid ${seleccionado === p.id ? "var(--eco-primary,#1a3a5c)" : "rgba(0,0,0,.1)"}`, borderRadius:10, padding:"12px 16px", cursor:"pointer", background:seleccionado === p.id ? "rgba(26,58,92,.04)" : "#fff", transition:"all .15s" }}>
              <div style={{ fontWeight:600, fontSize:13, color:seleccionado === p.id ? "var(--eco-primary,#1a3a5c)" : "#1a1a1a", marginBottom:6 }}>
                {seleccionado === p.id ? "✓ " : ""}{p.nombre}
              </div>
              <div style={{ fontSize:12, color:"#666", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{p.texto}</div>
            </div>
          ))}
        </div>
        {plantillas.length > 0 && (
          <div style={{ padding:"12px 20px", borderTop:"0.5px solid rgba(0,0,0,.08)", display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={onCerrar} style={{ padding:"8px 16px", border:"0.5px solid rgba(0,0,0,.15)", borderRadius:7, fontSize:13, cursor:"pointer", background:"#f5f5f5", color:"#555" }}>Cancelar</button>
            <button onClick={() => { if(seleccionado) { const p = plantillas.find(x => x.id === seleccionado); if(p) onSeleccionar(p.texto); }}}
              disabled={!seleccionado}
              style={{ padding:"8px 20px", border:"none", borderRadius:7, fontSize:13, fontWeight:500, cursor:seleccionado?"pointer":"not-allowed", background:seleccionado?"var(--eco-primary,#1a3a5c)":"#e0e0e0", color:seleccionado?"#fff":"#aaa" }}>
              Insertar texto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CotizacionForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [cot, setCot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [contactos, setContactos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [etiquetas, setEtiquetas] = useState([]);
  const [listas, setListas] = useState([]);
  const [listaPredId, setListaPredId] = useState(null);
  const [filtroEtiqueta, setFiltroEtiqueta] = useState("");
  const [busqContacto, setBusqContacto] = useState("");
  const [showContactos, setShowContactos] = useState(false);
  const [busqProducto, setBusqProducto] = useState({});
  const [showProducto, setShowProducto] = useState({});
  const [cols, setCols] = useState(COLS_DEFAULT);
  const [showCols, setShowCols] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [alertaEmpresa, setAlertaEmpresa] = useState(false);
  const [portadas, setPortadas] = useState([]);
  const [plantillaConfig, setPlantillaConfig] = useState(null);
  const [showSelectorFichas, setShowSelectorFichas] = useState(false);
  const [plantillasObs, setPlantillasObs] = useState([]);
  const [showModalPlantillas, setShowModalPlantillas] = useState(false);

  useEffect(() => { cargarTodo(); }, [id]);

  const cargarTodo = async () => {
    try {
      const [cotSnap, contSnap, prodSnap, etSnap, pltSnap, listasSnap] = await Promise.all([
        getDoc(doc(db, "cotizaciones", id)),
        getDocs(query(collection(db, "contactos"), orderBy("nombre"))),
        getDocs(query(collection(db, "productos"), orderBy("nombre"))),
        getDocs(collection(db, "catalogo_etiquetas_producto")),
        getDoc(doc(db, "configuracion", "plantilla_cotizacion")),
        getDocs(collection(db, "listasPrecios")),
      ]);

      if (cotSnap.exists()) setCot({ id: cotSnap.id, ...cotSnap.data() });
      setContactos(contSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setProductos(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.esVenta !== false));
      setEtiquetas(etSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Lista de precios predeterminada
      const listasDocs = listasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setListas(listasDocs);
      const pred = listasDocs.find(l => l.predeterminada);
      if (pred) setListaPredId(pred.id);

      if (pltSnap.exists()) {
        const pd = pltSnap.data();
        setPlantillaConfig(pd);
        setPortadas(pd.portadas || []);
        setPlantillasObs(pd.plantillasObservaciones || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const guardar = useCallback(async (datos) => {
    if (!datos) return;
    setGuardando(true);
    try { await updateDoc(doc(db, "cotizaciones", id), { ...datos, actualizadoEn: serverTimestamp() }); }
    catch (e) { console.error(e); }
    finally { setGuardando(false); }
  }, [id]);

  const upd = (campo, valor) => { setCot(c => ({ ...c, [campo]: valor })); guardar({ [campo]: valor }); };

  const updOpcion = (opId, campo, valor) => {
    const ops = cot.opciones.map(o => o.id === opId ? { ...o, [campo]: valor } : o);
    setCot({ ...cot, opciones: ops });
    guardar({ opciones: ops });
  };

  const selContacto = (c) => {
    const payload = { clienteId: c.id, clienteNombre: c.nombre, contactoNombre: c.nombre, facturarEmpresa: false, empresaId: c.empresaId || null, empresaNombre: c.empresaNombre || "", empresaCedula: c.empresaCedula || "" };
    setCot(prev => ({ ...prev, ...payload }));
    guardar(payload);
    setShowContactos(false); setBusqContacto(c.nombre);
    if (c.empresaId || c.empresaNombre) setAlertaEmpresa(true);
  };

  const setFacturacion = (tipo) => {
    const facturarEmpresa = tipo === "empresa";
    setCot({ ...cot, facturarEmpresa }); guardar({ facturarEmpresa }); setAlertaEmpresa(false);
  };

  // ── Precio desde lista predeterminada ──
  const getPrecioProducto = (prod) => {
    const mon = cot?.moneda || "USD";
    // Si hay lista predeterminada, usar su precio
    if (listaPredId && prod.preciosLista && prod.preciosLista[listaPredId] != null) {
      const precioLista = Number(prod.preciosLista[listaPredId]);
      // Si la moneda es CRC y el precio está en USD, convertir
      // (asumimos precios en lista en la moneda de la lista)
      const lista = listas.find(l => l.id === listaPredId);
      if (lista?.moneda === "USD" && mon === "CRC") {
        return precioLista; // se convierte al mostrar con tasa
      }
      return precioLista;
    }
    // Fallback: primer precio disponible en preciosLista
    if (prod.preciosLista) {
      const vals = Object.values(prod.preciosLista).filter(v => v > 0);
      if (vals.length > 0) return Number(vals[0]);
    }
    return prod.precio || 0;
  };

  const agregarProducto = (opId, prod) => {
    const op = cot.opciones.find(o => o.id === opId);
    const precio = getPrecioProducto(prod);
    const linea = {
      _lid: genId(),
      productoId: prod.id,
      nombre: prod.nombre,
      descripcion: prod.descripcion || "",
      costo: prod.precioCompra || 0,
      precio,
      cantidad: 1,
      desc: 0,
      descTipo: "%",
      ivaPct: 13,  // IVA por defecto 13% — el usuario puede cambiarlo por línea
      fichaId: prod.fichaId || null,
      fichaNombre: prod.fichaNombre || "",
    };
    const prods = [...(op.productos || []), linea];
    const adjuntosProducto = prod.adjuntos || [];
    if (adjuntosProducto.length > 0) {
      const fichasActuales = cot.fichasTecnicas || [];
      const fichasNuevas = adjuntosProducto.filter(adj => !fichasActuales.some(f => f.url === adj.url));
      if (fichasNuevas.length > 0) {
        const fichasActualizadas = [...fichasActuales, ...fichasNuevas];
        const ops = cot.opciones.map(o => o.id === opId ? { ...o, productos: prods } : o);
        setCot(c => ({ ...c, opciones: ops, fichasTecnicas: fichasActualizadas }));
        guardar({ opciones: ops, fichasTecnicas: fichasActualizadas });
        setShowProducto(p => ({ ...p, [opId]: false })); setBusqProducto(p => ({ ...p, [opId]: "" }));
        return;
      }
    }
    updOpcion(opId, "productos", prods);
    setShowProducto(p => ({ ...p, [opId]: false })); setBusqProducto(p => ({ ...p, [opId]: "" }));
  };

  const agregarOpcional = (opId, prod) => {
    const op = cot.opciones.find(o => o.id === opId);
    const precio = getPrecioProducto(prod);
    updOpcion(opId, "productosOpcionales", [...(op.productosOpcionales || []), { _lid: genId(), productoId: prod.id, nombre: prod.nombre, precio, activo: false }]);
  };

  const updLinea = (opId, lid, campo, valor) => {
    const op = cot.opciones.find(o => o.id === opId);
    updOpcion(opId, "productos", op.productos.map(p => p._lid === lid ? { ...p, [campo]: valor } : p));
  };

  const elimLinea = (opId, lid) => {
    const op = cot.opciones.find(o => o.id === opId);
    updOpcion(opId, "productos", op.productos.filter(p => p._lid !== lid));
  };

  const agregarOpcion = () => {
    const ids = ["A","B","C","D","E"];
    const next = ids.find(i => !cot.opciones.map(o => o.id).includes(i));
    if (!next) return;
    upd("opciones", [...cot.opciones, { id: next, nombre: `Opción ${next}`, productos: [], productosOpcionales: [] }]);
  };

  const eliminarOpcion = (opId) => {
    if (cot.opciones.length <= 1) return;
    const ops = cot.opciones.filter(o => o.id !== opId);
    setCot({ ...cot, opciones: ops, opcionActiva: ops[0].id });
    guardar({ opciones: ops, opcionActiva: ops[0].id });
  };

  const duplicarOpcion = (opId) => {
    const ids = ["A","B","C","D","E"];
    const next = ids.find(i => !cot.opciones.map(o => o.id).includes(i));
    if (!next) return;
    const origen = cot.opciones.find(o => o.id === opId);
    const copia = { ...origen, id: next, nombre: `Opción ${next}`, productos: (origen.productos || []).map(p => ({ ...p, _lid: genId() })), productosOpcionales: (origen.productosOpcionales || []).map(p => ({ ...p, _lid: genId() })) };
    const ops = [...cot.opciones, copia];
    setCot({ ...cot, opciones: ops, opcionActiva: next });
    guardar({ opciones: ops, opcionActiva: next });
  };

  const copiarEnlace = () => { navigator.clipboard.writeText(`${window.location.origin}/cotizacion/${id}`); setCopiado(true); setTimeout(() => setCopiado(false), 2000); };
  const marcarEnviada = async () => { setEnviando(true); await guardar({ estado: "Enviada", enviadoEn: serverTimestamp() }); setCot(c => ({ ...c, estado: "Enviada" })); setEnviando(false); copiarEnlace(); };

  const productosFiltrados = (busq) => {
    const q = (busq || "").toLowerCase();
    return productos.filter(p => p.nombre?.toLowerCase().includes(q) && (!filtroEtiqueta || (p.etiquetas || []).includes(filtroEtiqueta))).slice(0, 8);
  };

  const getAdjuntosDisponibles = () => {
    const todos = [];
    (cot?.opciones || []).forEach(op => {
      (op.productos || []).forEach(linea => {
        const prod = productos.find(p => p.id === linea.productoId);
        if (prod?.adjuntos?.length > 0) prod.adjuntos.forEach(adj => { if (!todos.some(a => a.url === adj.url)) todos.push({ ...adj, _prodNombre: prod.nombre }); });
      });
    });
    return todos;
  };

  if (loading) return <div style={{ padding:40, textAlign:"center", color:"#999" }}>Cargando cotización...</div>;
  if (!cot) return <div style={{ padding:40, color:"#c00" }}>Cotización no encontrada.</div>;

  const opActiva = cot.opciones.find(o => o.id === cot.opcionActiva) || cot.opciones[0];
  const totales = opActiva ? calcOpcion(opActiva, cot.descuentoGlobal, cot.descuentoGlobalTipo) : {};
  const mon = cot.moneda || "USD";
  const tasa = Number(cot.tasa || 519.5);
  const monContraria = mon === "USD" ? "CRC" : "USD";
  const contactosFiltrados = contactos.filter(c => c.nombre?.toLowerCase().includes(busqContacto.toLowerCase()));
  const adjuntosDisponibles = getAdjuntosDisponibles();
  const fichasActuales = cot.fichasTecnicas || [];

  const estadoColors = { Borrador:{ bg:"#F1EFE8", color:"#5F5E5A" }, Enviada:{ bg:"#E6F1FB", color:"#185FA5" }, Vista:{ bg:"#EEEDFE", color:"#3C3489" }, Aceptada:{ bg:"#EAF3DE", color:"#3B6D11" }, Rechazada:{ bg:"#FCEBEB", color:"#A32D2D" } };
  const ec = estadoColors[cot.estado] || estadoColors.Borrador;

  const s = {
    page:       { padding:"20px 24px", minHeight:"100vh", background:"var(--eco-bg,#f5f6f8)", fontSize:13 },
    topbar:     { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 },
    card:       { background:"#fff", border:"0.5px solid rgba(0,0,0,.08)", borderRadius:10, padding:"16px 18px", marginBottom:14 },
    lbl:        { fontSize:10, fontWeight:500, color:"#999", textTransform:"uppercase", letterSpacing:".5px", marginBottom:3, display:"block" },
    inp:        { width:"100%", padding:"7px 10px", border:"0.5px solid rgba(0,0,0,.15)", borderRadius:7, fontSize:13, outline:"none", background:"#fff", color:"inherit" },
    miniInp:    { padding:"4px 6px", border:"0.5px solid rgba(0,0,0,.15)", borderRadius:5, fontSize:12, outline:"none", background:"#fff", color:"inherit", fontFamily:"inherit" },
    btn:        { padding:"6px 14px", border:"0.5px solid rgba(0,0,0,.15)", borderRadius:7, fontSize:12, cursor:"pointer", background:"#fff", fontFamily:"inherit" },
    btnPrimary: { padding:"7px 16px", background:"var(--eco-primary,#1a3a5c)", color:"#fff", border:"none", borderRadius:7, fontSize:13, fontWeight:500, cursor:"pointer" },
    grid4:      { display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12 },
    divider:    { border:"none", borderTop:"0.5px solid rgba(0,0,0,.06)", margin:"14px 0" },
    th:         { padding:"9px 10px", textAlign:"left", fontWeight:600, fontSize:10, color:"#888", textTransform:"uppercase", letterSpacing:".4px", borderBottom:"1px solid #eef0f4", background:"#f8f9fb", whiteSpace:"nowrap" },
    td:         { padding:"10px 10px", borderBottom:"0.5px solid #f0f2f5", verticalAlign:"middle", fontSize:13, color:"#1a1a1a" },
  };

  return (
    <div style={s.page}>

      {showModalPlantillas && (
        <ModalPlantillas plantillas={plantillasObs}
          onSeleccionar={(texto) => { upd("observaciones", texto); setShowModalPlantillas(false); }}
          onCerrar={() => setShowModalPlantillas(false)} />
      )}

      {/* TOPBAR */}
      <div style={s.topbar}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button style={{ ...s.btn, padding:"5px 10px" }} onClick={() => navigate("/ventas")}>← Volver</button>
          <span style={{ fontSize:15, fontWeight:600, color:"var(--eco-primary,#1a3a5c)" }}>{cot.numero}</span>
          <span style={{ display:"inline-flex", padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600, background:ec.bg, color:ec.color }}>{cot.estado}</span>
          {guardando && <span style={{ fontSize:11, color:"#bbb" }}>Guardando...</span>}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={s.btn} onClick={() => window.open(`/cotizacion/${id}`, "_blank")}>Vista previa</button>
          <button style={s.btn} onClick={copiarEnlace}>{copiado ? "¡Copiado!" : "Copiar enlace"}</button>
          {cot.estado === "Borrador" && (
            <button style={s.btnPrimary} onClick={marcarEnviada} disabled={enviando}>
              {enviando ? "Enviando..." : "Marcar enviada + copiar enlace"}
            </button>
          )}
        </div>
      </div>

      {/* ENCABEZADO */}
      <div style={s.card}>
        {alertaEmpresa && cot.empresaNombre && (
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 13px", borderRadius:8, background:"#FAEEDA", color:"#854F0B", fontSize:12, marginBottom:10 }}>
            <span>Este contacto representa a <strong>{cot.empresaNombre}</strong> — ¿a nombre de quién cotizás?</span>
            <div style={{ display:"flex", gap:6, marginLeft:"auto" }}>
              <button style={{ ...s.btn, fontSize:11 }} onClick={() => setFacturacion("personal")}>Personal</button>
              <button style={{ ...s.btn, fontSize:11, background:"#FAEEDA", color:"#854F0B", borderColor:"transparent" }} onClick={() => setFacturacion("empresa")}>Empresa — {cot.empresaNombre}</button>
            </div>
          </div>
        )}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:12 }}>
          <div style={{ position:"relative" }}>
            <label style={s.lbl}>Contacto</label>
            <input style={s.inp} value={busqContacto || cot.clienteNombre}
              onChange={e => { setBusqContacto(e.target.value); setShowContactos(true); }}
              onFocus={() => setShowContactos(true)} placeholder="Buscar contacto..." />
            {showContactos && busqContacto && (
              <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#fff", border:"0.5px solid rgba(0,0,0,.15)", borderRadius:8, zIndex:50, maxHeight:200, overflowY:"auto", marginTop:3 }}>
                {contactosFiltrados.slice(0, 8).map(c => (
                  <div key={c.id} style={{ padding:"8px 12px", cursor:"pointer", borderBottom:"0.5px solid rgba(0,0,0,.05)", fontSize:13 }} onMouseDown={() => selContacto(c)}>
                    <p style={{ fontWeight:500 }}>{c.nombre}</p>
                    {c.empresaNombre && <p style={{ fontSize:11, color:"#888" }}>{c.empresaNombre}</p>}
                  </div>
                ))}
                {contactosFiltrados.length === 0 && <div style={{ padding:"10px 12px", color:"#999", fontSize:12 }}>Sin resultados</div>}
              </div>
            )}
          </div>
          <div>
            <label style={s.lbl}>Facturar a</label>
            {cot.facturarEmpresa && cot.empresaNombre ? (
              <div style={{ background:"#FAEEDA", borderRadius:7, padding:"7px 12px", fontSize:12 }}>
                <p style={{ fontWeight:500, color:"#854F0B" }}>{cot.empresaNombre}</p>
                {cot.empresaCedula && <p style={{ color:"#a06030", fontSize:11 }}>Cédula jurídica: {cot.empresaCedula}</p>}
                <p style={{ color:"#a06030", fontSize:11 }}>Contacto: {cot.contactoNombre}</p>
                <button style={{ ...s.btn, fontSize:10, padding:"2px 8px", marginTop:4 }} onClick={() => setAlertaEmpresa(true)}>Cambiar</button>
              </div>
            ) : (
              <div style={{ background:"#f5f6f8", borderRadius:7, padding:"7px 12px", fontSize:12 }}>
                <p style={{ fontWeight:500 }}>{cot.clienteNombre || "—"}</p>
                <p style={{ color:"#888", fontSize:11 }}>Cliente personal</p>
                {cot.empresaNombre && <button style={{ ...s.btn, fontSize:10, padding:"2px 8px", marginTop:4 }} onClick={() => setAlertaEmpresa(true)}>Cotizar a empresa</button>}
              </div>
            )}
          </div>
        </div>
        <div style={s.grid4}>
          <div>
            <label style={s.lbl}>Moneda</label>
            <select style={s.inp} value={mon} onChange={e => upd("moneda", e.target.value)}>
              <option value="USD">USD — Dólar</option>
              <option value="CRC">CRC — Colón</option>
            </select>
          </div>
          <div>
            <label style={s.lbl}>Tasa CRC/USD</label>
            <input style={{ ...s.inp, width:90 }} value={cot.tasa} onChange={e => upd("tasa", e.target.value)} />
          </div>
          <div>
            <label style={s.lbl}>Fecha emisión</label>
            <input style={s.inp} type="date" value={cot.fechaEmision} onChange={e => upd("fechaEmision", e.target.value)} />
          </div>
          <div>
            <label style={s.lbl}>Vencimiento</label>
            <input style={s.inp} type="date" value={cot.fechaVencimiento} onChange={e => upd("fechaVencimiento", e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop:10, padding:"7px 12px", borderRadius:7, background:"#E6F1FB", color:"#185FA5", fontSize:12 }}>
          Cotización en {mon} — equivalente aprox. en {monContraria} (tasa ₡{tasa.toFixed(2)}).
        </div>
      </div>

      {/* ── CARD DE PRODUCTOS + OPCIONALES ── */}
      <div style={s.card}>

        {/* Selector de opciones */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div style={{ display:"flex", gap:4, alignItems:"center", flexWrap:"wrap" }}>
            {cot.opciones.map(op => {
              const activa = cot.opcionActiva === op.id;
              return (
                <div key={op.id} style={{ display:"flex", alignItems:"center", borderRadius:8, overflow:"hidden", border:`1.5px solid ${activa ? "var(--eco-primary,#1a3a5c)" : "#dee2e8"}`, background:activa ? "var(--eco-primary,#1a3a5c)" : "#fff" }}>
                  <button onClick={() => upd("opcionActiva", op.id)} style={{ padding:"6px 16px", fontSize:13, border:"none", cursor:"pointer", background:"transparent", color:activa ? "#fff" : "#555", fontWeight:activa ? 600 : 400, fontFamily:"inherit" }}>
                    {op.nombre}
                  </button>
                  {cot.opciones.length > 1 && <>
                    <button title="Duplicar" onClick={() => duplicarOpcion(op.id)} style={{ padding:"6px 8px", fontSize:12, border:"none", borderLeft:`1px solid ${activa ? "rgba(255,255,255,.2)" : "#dee2e8"}`, cursor:"pointer", background:"transparent", color:activa ? "rgba(255,255,255,.7)" : "#185FA5", fontFamily:"inherit" }}>⎘</button>
                    <button title="Eliminar" onClick={() => eliminarOpcion(op.id)} style={{ padding:"6px 8px", fontSize:14, border:"none", borderLeft:`1px solid ${activa ? "rgba(255,255,255,.2)" : "#dee2e8"}`, cursor:"pointer", background:"transparent", color:activa ? "rgba(255,255,255,.55)" : "#E24B4A", fontFamily:"inherit" }}>×</button>
                  </>}
                </div>
              );
            })}
            {cot.opciones.length < 5 && (
              <button style={{ padding:"6px 14px", border:"1.5px dashed #c8cdd6", borderRadius:8, fontSize:12, cursor:"pointer", background:"transparent", color:"#999", fontFamily:"inherit" }} onClick={agregarOpcion}>+ Opción</button>
            )}
          </div>
          <div style={{ position:"relative" }}>
            <button style={{ ...s.btn, fontSize:12, display:"flex", alignItems:"center", gap:6 }} onClick={() => setShowCols(v => !v)}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="1" width="6" height="14" rx="1.5"/><rect x="9" y="1" width="6" height="14" rx="1.5"/></svg>
              Columnas
            </button>
            {showCols && (
              <div style={{ position:"absolute", right:0, top:"110%", background:"#fff", border:"0.5px solid rgba(0,0,0,.12)", borderRadius:10, zIndex:30, minWidth:210, padding:"8px 0", boxShadow:"0 8px 24px rgba(0,0,0,.1)" }}>
                {[
                  { key:"costo",    lbl:"Costo interno" },
                  { key:"margen",   lbl:"Margen $" },
                  { key:"margenp",  lbl:"Margen %" },
                  { key:"iva",      lbl:"IVA por línea" },
                  { key:"subtotsin",lbl:"Subtotal sin IVA" },
                  { key:"totcon",   lbl:"Total con IVA" },
                  { key:"udm",      lbl:"Unidad de medida" },
                  { key:"plazo",    lbl:"Plazo de entrega" },
                  { key:"imppct",   lbl:"IVA %" },
                ].map(({ key, lbl }) => (
                  <label key={key} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 14px", fontSize:12, cursor:"pointer" }}>
                    <input type="checkbox" checked={cols[key]} onChange={e => setCols(c => ({ ...c, [key]: e.target.checked }))} style={{ accentColor:"var(--eco-primary,#1a3a5c)", width:13, height:13 }} />
                    {lbl}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {opActiva && (<>

          {/* ── Tabla de productos incluidos ── */}
          <div style={{ borderRadius:8, overflow:"hidden", border:"1px solid #eaecf2" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...s.th, width:36, paddingLeft:12 }}></th>
                  <th style={s.th}>Producto / Descripción</th>
                  <th style={{ ...s.th, textAlign:"center", width:70 }}>Cant.</th>
                  {cols.costo   && <th style={{ ...s.th, color:"#185FA5" }}>Costo</th>}
                  <th style={s.th}>Precio {mon}</th>
                  {cols.margen  && <th style={{ ...s.th, color:"#3B6D11" }}>Margen $</th>}
                  {cols.margenp && <th style={{ ...s.th, color:"#3B6D11" }}>Margen %</th>}
                  <th style={s.th}>Desc.</th>
                  {cols.iva     && <th style={{ ...s.th, textAlign:"center" }}>IVA</th>}
                  {cols.totcon  && <th style={{ ...s.th, textAlign:"right", paddingRight:14 }}>Total c/IVA</th>}
                  <th style={{ ...s.th, width:36 }}></th>
                </tr>
              </thead>
              <tbody>
                {(opActiva.productos || []).length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ padding:"32px 16px", textAlign:"center", color:"#c0c4cc", fontSize:12, background:"#fafbfc" }}>
                      Sin productos — buscá en el catálogo debajo para agregar
                    </td>
                  </tr>
                ) : (opActiva.productos || []).map((p, idx) => {
                  const calc = calcLinea(p);
                  const precioUSD = mon === "CRC" ? Number(p.precio || 0) / tasa : Number(p.precio || 0);
                  const costoUSD  = Number(p.costo || 0);
                  const margenAbs = precioUSD - costoUSD;
                  const margenPct = precioUSD > 0 ? Math.round((margenAbs / precioUSD) * 100) : 0;
                  const costoMon  = mon === "CRC" ? costoUSD * tasa : costoUSD;
                  const totalMon  = mon === "CRC" ? calc.total * tasa : calc.total;
                  const ivaPct    = p.ivaPct ?? 13;
                  return (
                    <tr key={p._lid} style={{ background: idx % 2 === 0 ? "#fff" : "#fafbfc" }}>
                      <td style={{ ...s.td, textAlign:"center", paddingLeft:12 }}>
                        <input type="checkbox" defaultChecked style={{ width:13, height:13, accentColor:"var(--eco-primary,#1a3a5c)", cursor:"pointer" }} />
                      </td>
                      <td style={s.td}>
                        <div style={{ fontWeight:500 }}>{p.nombre}</div>
                        {p.descripcion && <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>{p.descripcion}</div>}
                      </td>
                      <td style={{ ...s.td, textAlign:"center" }}>
                        <input style={{ ...s.miniInp, width:52, textAlign:"center" }} value={p.cantidad} onChange={e => updLinea(opActiva.id, p._lid, "cantidad", e.target.value)} />
                      </td>
                      {cols.costo   && <td style={{ ...s.td, color:"#bbb", fontSize:12 }}>{sym(mon)}{fmtN(costoMon)}</td>}
                      <td style={s.td}>
                        <input style={{ ...s.miniInp, width:84 }} value={p.precio} onChange={e => updLinea(opActiva.id, p._lid, "precio", e.target.value)} />
                      </td>
                      {cols.margen  && <td style={{ ...s.td, color:"#3B6D11", fontWeight:500 }}>${fmtN(margenAbs)}</td>}
                      {cols.margenp && <td style={{ ...s.td, color: margenPct >= 0 ? "#3B6D11" : "#E24B4A", fontWeight:500 }}>{margenPct}%</td>}
                      <td style={s.td}>
                        <div style={{ display:"flex", gap:3, alignItems:"center" }}>
                          <input style={{ ...s.miniInp, width:40, textAlign:"center" }} value={p.desc || 0} onChange={e => updLinea(opActiva.id, p._lid, "desc", e.target.value)} />
                          <select style={{ ...s.miniInp, width:42, padding:"4px 3px" }} value={p.descTipo || "%"} onChange={e => updLinea(opActiva.id, p._lid, "descTipo", e.target.value)}>
                            <option>%</option><option>$</option>
                          </select>
                        </div>
                      </td>
                      {cols.iva && (
                        <td style={{ ...s.td, textAlign:"center" }}>
                          <select
                            style={{ ...s.miniInp, width:58, padding:"4px 5px", textAlign:"center", fontWeight:600, color: ivaPct === 0 ? "#888" : "#185FA5", background: ivaPct === 0 ? "#f5f5f5" : "#E6F1FB", border:`1px solid ${ivaPct === 0 ? "#ddd" : "#b8d6f5"}`, borderRadius:6 }}
                            value={ivaPct}
                            onChange={e => updLinea(opActiva.id, p._lid, "ivaPct", Number(e.target.value))}>
                            {IVA_OPCIONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                      )}
                      {cols.totcon && <td style={{ ...s.td, textAlign:"right", paddingRight:14, fontWeight:700, color:"var(--eco-primary,#1a3a5c)" }}>{sym(mon)}{fmtN(totalMon)}</td>}
                      <td style={{ ...s.td, textAlign:"center" }}>
                        <button style={{ background:"none", border:"none", cursor:"pointer", color:"#ddd", fontSize:16, lineHeight:1, padding:"2px 4px", borderRadius:4 }}
                          onMouseEnter={e => e.currentTarget.style.color="#E24B4A"}
                          onMouseLeave={e => e.currentTarget.style.color="#ddd"}
                          onClick={() => elimLinea(opActiva.id, p._lid)}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Buscador productos */}
          <div style={{ display:"flex", gap:8, alignItems:"center", marginTop:10, marginBottom:16, flexWrap:"wrap" }}>
            <div style={{ display:"flex", gap:4, alignItems:"center" }}>
              <span style={{ fontSize:11, color:"#bbb", fontWeight:500 }}>Catálogo:</span>
              <button onClick={() => setFiltroEtiqueta("")} style={{ padding:"3px 10px", borderRadius:20, fontSize:11, cursor:"pointer", border:`1px solid ${!filtroEtiqueta ? "var(--eco-primary,#1a3a5c)" : "rgba(0,0,0,.12)"}`, background:!filtroEtiqueta ? "var(--eco-primary,#1a3a5c)" : "#fff", color:!filtroEtiqueta ? "#fff" : "#666", fontFamily:"inherit" }}>Todos</button>
              {etiquetas.map(et => (
                <button key={et.id} onClick={() => setFiltroEtiqueta(filtroEtiqueta === et.nombre ? "" : et.nombre)}
                  style={{ padding:"3px 10px", borderRadius:20, fontSize:11, cursor:"pointer", border:`1px solid ${filtroEtiqueta === et.nombre ? "var(--eco-primary,#1a3a5c)" : "rgba(0,0,0,.12)"}`, background:filtroEtiqueta === et.nombre ? "var(--eco-primary,#1a3a5c)" : "#fff", color:filtroEtiqueta === et.nombre ? "#fff" : "#666", fontFamily:"inherit" }}>
                  {et.nombre}
                </button>
              ))}
            </div>
            <div style={{ position:"relative" }}>
              <input style={{ ...s.inp, width:240, fontSize:12 }} placeholder="+ Buscar producto para agregar..."
                value={busqProducto[opActiva.id] || ""}
                onChange={e => { setBusqProducto(p => ({ ...p, [opActiva.id]: e.target.value })); setShowProducto(p => ({ ...p, [opActiva.id]: true })); }}
                onFocus={() => setShowProducto(p => ({ ...p, [opActiva.id]: true }))} />
              {showProducto[opActiva.id] && (busqProducto[opActiva.id] || "").length > 0 && (
                <div style={{ position:"absolute", top:"100%", left:0, background:"#fff", border:"0.5px solid rgba(0,0,0,.12)", borderRadius:10, zIndex:50, minWidth:300, maxHeight:220, overflowY:"auto", marginTop:4, boxShadow:"0 8px 24px rgba(0,0,0,.1)" }}>
                  {productosFiltrados(busqProducto[opActiva.id]).map(p => {
                    const precioMostrar = getPrecioProducto(p);
                    return (
                      <div key={p.id} style={{ padding:"9px 14px", cursor:"pointer", borderBottom:"0.5px solid rgba(0,0,0,.05)" }} onMouseDown={() => agregarProducto(opActiva.id, p)}>
                        <div style={{ fontWeight:500, fontSize:13, color:"#1a1a1a" }}>{p.nombre}</div>
                        <div style={{ display:"flex", gap:6, alignItems:"center", marginTop:2 }}>
                          <span style={{ color:"#888", fontSize:11 }}>
                            {precioMostrar > 0 ? `${sym("USD")}${fmtN(precioMostrar)}` : "Sin precio"} · {p.tipo || "Producto"}
                          </span>
                          {(p.etiquetas||[]).map(e => <span key={e} style={{ fontSize:10, padding:"1px 6px", borderRadius:10, background:"#EEEDFE", color:"#534AB7" }}>{e}</span>)}
                          {(p.adjuntos||[]).length > 0 && <span style={{ fontSize:10, padding:"1px 6px", borderRadius:10, background:"#E6F1FB", color:"#185FA5" }}>📎 {p.adjuntos.length}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {productosFiltrados(busqProducto[opActiva.id]).length === 0 && <div style={{ padding:"12px 14px", color:"#999", fontSize:12 }}>Sin resultados</div>}
                </div>
              )}
            </div>
          </div>

          {/* ── Sección opcionales ── */}
          <div style={{ background:"#FFFDF5", border:"1.5px solid #EDD98A", borderRadius:10, overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid #F0E4A0", background:"#FFF9E6" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:24, height:24, borderRadius:6, background:"#F5A623", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:"#fff", fontWeight:700, flexShrink:0 }}>✦</div>
                <div>
                  <span style={{ fontSize:13, fontWeight:600, color:"#7A5200" }}>Productos opcionales</span>
                  <span style={{ fontSize:11, color:"#B8960C", marginLeft:8 }}>El cliente puede activarlos en su portal</span>
                </div>
              </div>
              <div style={{ position:"relative" }}>
                <input style={{ ...s.inp, width:220, fontSize:12, border:"1px solid #E4CC7A", background:"#fff", borderRadius:7 }}
                  placeholder="+ Agregar producto opcional..."
                  value={busqProducto[opActiva.id+"_opt"] || ""}
                  onChange={e => { setBusqProducto(p => ({ ...p, [opActiva.id+"_opt"]: e.target.value })); setShowProducto(p => ({ ...p, [opActiva.id+"_opt"]: true })); }}
                  onFocus={() => setShowProducto(p => ({ ...p, [opActiva.id+"_opt"]: true }))} />
                {showProducto[opActiva.id+"_opt"] && (busqProducto[opActiva.id+"_opt"]||"").length > 0 && (
                  <div style={{ position:"absolute", top:"100%", right:0, background:"#fff", border:"0.5px solid rgba(0,0,0,.12)", borderRadius:10, zIndex:50, minWidth:280, maxHeight:200, overflowY:"auto", marginTop:4, boxShadow:"0 8px 24px rgba(0,0,0,.1)" }}>
                    {productosFiltrados(busqProducto[opActiva.id+"_opt"]).map(p => (
                      <div key={p.id} style={{ padding:"9px 14px", cursor:"pointer", borderBottom:"0.5px solid rgba(0,0,0,.05)" }} onMouseDown={() => agregarOpcional(opActiva.id, p)}>
                        <div style={{ fontWeight:500, fontSize:13 }}>{p.nombre}</div>
                        <div style={{ fontSize:11, color:"#888" }}>{sym("USD")}{fmtN(getPrecioProducto(p))}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {(opActiva.productosOpcionales || []).length === 0 ? (
              <div style={{ textAlign:"center", padding:"20px 16px", color:"#C9A84C", fontSize:12 }}>
                Agregá productos opcionales que el cliente podrá elegir incluir
              </div>
            ) : (
              <div>
                {opActiva.productosOpcionales.map((p, i) => {
                  const precioMon = mon === "CRC" ? Number(p.precio) * tasa : Number(p.precio);
                  return (
                    <div key={p._lid || i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px", borderBottom: i < opActiva.productosOpcionales.length - 1 ? "0.5px solid #EDD98A" : "none", background: i % 2 === 0 ? "#FFFDF5" : "#FFFBEA" }}>
                      <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", flexShrink:0, minWidth:100 }}>
                        <input type="checkbox" checked={p.activo}
                          onChange={e => {
                            const opts = opActiva.productosOpcionales.map((x, j) => j === i ? { ...x, activo: e.target.checked } : x);
                            updOpcion(opActiva.id, "productosOpcionales", opts);
                          }}
                          style={{ width:15, height:15, accentColor:"#D4A017", cursor:"pointer" }} />
                        <span style={{ fontSize:11, fontWeight:600, color: p.activo ? "#7A5200" : "#B8960C" }}>
                          {p.activo ? "✓ Activo" : "Opcional"}
                        </span>
                      </label>
                      <div style={{ flex:1, fontWeight:500, fontSize:13, color:"#1a1a1a" }}>{p.nombre}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:"#7A5200", minWidth:90, textAlign:"right" }}>{sym(mon)}{fmtN(precioMon)}</div>
                      <button style={{ background:"none", border:"none", cursor:"pointer", color:"#ddd", fontSize:16, lineHeight:1, padding:"2px 4px", borderRadius:4 }}
                        onMouseEnter={e => e.currentTarget.style.color="#E24B4A"}
                        onMouseLeave={e => e.currentTarget.style.color="#ddd"}
                        onClick={() => updOpcion(opActiva.id, "productosOpcionales", opActiva.productosOpcionales.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </>)}

        <div style={s.divider} />

        {/* ── Observaciones + Totales ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 260px", gap:16 }}>
          <div>
            {/* Fichas técnicas */}
            <p style={{ fontSize:12, fontWeight:500, marginBottom:8, color:"#444" }}>Fichas técnicas y documentos</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
              {fichasActuales.map((f, i) => (
                <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", border:"0.5px solid rgba(0,0,0,.15)", borderRadius:20, fontSize:12, background:"#f5f6f8" }}>
                  📄 {f.nombre}
                  <button style={{ background:"none", border:"none", cursor:"pointer", color:"#c00", fontSize:13 }} onClick={() => upd("fichasTecnicas", fichasActuales.filter((_, j) => j !== i))}>×</button>
                </span>
              ))}
            </div>
            <div style={{ position:"relative", display:"inline-block" }}>
              <button style={{ ...s.btn, fontSize:11, padding:"4px 12px", borderStyle:"dashed", display:"flex", alignItems:"center", gap:5 }} onClick={() => setShowSelectorFichas(v => !v)}>
                📎 Agregar ficha técnica
                {adjuntosDisponibles.filter(a => !fichasActuales.some(f => f.url === a.url)).length > 0 && (
                  <span style={{ background:"#E6F1FB", color:"#185FA5", borderRadius:10, fontSize:10, padding:"1px 6px", fontWeight:600 }}>
                    {adjuntosDisponibles.filter(a => !fichasActuales.some(f => f.url === a.url)).length} disponibles
                  </span>
                )}
              </button>
              {showSelectorFichas && (
                <div style={{ position:"absolute", top:"110%", left:0, background:"#fff", border:"0.5px solid rgba(0,0,0,.12)", borderRadius:10, zIndex:50, minWidth:320, maxHeight:260, overflowY:"auto", boxShadow:"0 8px 24px rgba(0,0,0,.1)", padding:"8px 0" }}>
                  <div style={{ padding:"6px 12px 8px", fontSize:11, fontWeight:600, color:"#999", textTransform:"uppercase", letterSpacing:".5px", borderBottom:"0.5px solid rgba(0,0,0,.06)" }}>Adjuntos disponibles</div>
                  {adjuntosDisponibles.length === 0 ? (
                    <div style={{ padding:"16px 12px", fontSize:12, color:"#999", textAlign:"center" }}>Sin adjuntos en los productos de esta cotización</div>
                  ) : adjuntosDisponibles.map((adj, i) => {
                    const ya = fichasActuales.some(f => f.url === adj.url);
                    return (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderBottom:"0.5px solid rgba(0,0,0,.04)", background:ya?"#f5f6f8":"#fff" }}>
                        <div style={{ width:28, height:28, borderRadius:6, background:"#FCEBEB", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>📄</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{adj.nombre}</div>
                          <div style={{ fontSize:10, color:"#aaa" }}>{adj._prodNombre}</div>
                        </div>
                        {ya ? <span style={{ fontSize:11, color:"#3B6D11", fontWeight:500 }}>✓ Incluida</span>
                          : <button style={{ ...s.btn, fontSize:11, padding:"3px 10px", background:"#E6F1FB", color:"#185FA5", borderColor:"transparent" }}
                              onClick={() => { upd("fichasTecnicas", [...fichasActuales, adj]); setShowSelectorFichas(false); }}>+ Agregar</button>}
                      </div>
                    );
                  })}
                  <div style={{ padding:"8px 12px", borderTop:"0.5px solid rgba(0,0,0,.06)" }}>
                    <button style={{ ...s.btn, fontSize:11, width:"100%" }} onClick={() => setShowSelectorFichas(false)}>Cerrar</button>
                  </div>
                </div>
              )}
            </div>

            {/* Observaciones */}
            <div style={{ marginTop:14 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                <p style={{ fontSize:12, fontWeight:500, margin:0, color:"#444" }}>Observaciones <span style={{ color:"#aaa", fontWeight:400, fontSize:11 }}>(visibles al cliente)</span></p>
                <button onClick={() => setShowModalPlantillas(true)} style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 12px", border:"0.5px solid rgba(0,0,0,.12)", borderRadius:6, fontSize:11, cursor:"pointer", background:plantillasObs.length > 0 ? "#E6F1FB" : "#f5f5f5", color:plantillasObs.length > 0 ? "#185FA5" : "#999", fontWeight:500 }}>
                  📋 Insertar plantilla
                  {plantillasObs.length > 0 && <span style={{ background:"#185FA5", color:"#fff", borderRadius:10, fontSize:10, padding:"1px 6px", fontWeight:600 }}>{plantillasObs.length}</span>}
                </button>
              </div>
              <textarea style={{ ...s.inp, resize:"vertical", fontSize:12 }} rows={4}
                placeholder="Condiciones especiales, notas de instalación, garantías..."
                value={cot.observaciones || ""} onChange={e => upd("observaciones", e.target.value)} />
            </div>

            <p style={{ fontSize:12, fontWeight:500, marginBottom:6, marginTop:14, color:"#444" }}>Términos y condiciones</p>
            <textarea style={{ ...s.inp, resize:"vertical", fontSize:12 }} rows={4}
              placeholder="Términos específicos para esta cotización..."
              value={cot.terminos !== undefined ? cot.terminos : (plantillaConfig?.config?.textoTerminos || "")}
              onChange={e => upd("terminos", e.target.value)} />

            {portadas.length > 0 && (
              <div style={{ marginTop:14 }}>
                <p style={{ fontSize:12, fontWeight:500, marginBottom:8, color:"#444" }}>Portada del documento</p>
                <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
                  <div onClick={() => upd("portadaId", null)} style={{ border:`2px solid ${!cot.portadaId ? "var(--eco-primary,#1a3a5c)" : "#e0e0e0"}`, borderRadius:6, padding:"8px 14px", cursor:"pointer", fontSize:12, color:!cot.portadaId?"var(--eco-primary,#1a3a5c)":"#888", background:!cot.portadaId?"#f0f4f8":"#fff", fontWeight:!cot.portadaId?500:400 }}>Sin portada</div>
                  {portadas.map(p => (
                    <div key={p.id} onClick={() => upd("portadaId", p.id)} style={{ border:`2px solid ${cot.portadaId===p.id?"var(--eco-primary,#1a3a5c)":"#e0e0e0"}`, borderRadius:6, overflow:"hidden", cursor:"pointer", width:64, flexShrink:0 }}>
                      <img src={p.url} alt={p.nombre} style={{ width:"100%", aspectRatio:"3/4", objectFit:"cover", display:"block" }} />
                      {cot.portadaId===p.id && <div style={{ background:"var(--eco-primary,#1a3a5c)", color:"#fff", fontSize:9, textAlign:"center", padding:2 }}>✓</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Totales */}
          <div>
            <div style={{ background:"#f8f9fb", borderRadius:10, padding:16, border:"1px solid #eaecf0" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#bbb", textTransform:"uppercase", letterSpacing:".6px", marginBottom:14 }}>Resumen financiero</div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:13 }}>
                <span style={{ color:"#888" }}>Subtotal</span>
                <span style={{ fontWeight:500 }}>{sym(mon)}{fmtN(mon==="CRC" ? totales.subtotal*tasa : totales.subtotal)}</span>
              </div>
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, color:"#999", marginBottom:5 }}>Descuento global</div>
                <div style={{ display:"flex", gap:6 }}>
                  <input style={{ ...s.miniInp, flex:1 }} value={cot.descuentoGlobal||0} onChange={e => upd("descuentoGlobal", e.target.value)} />
                  <select style={{ ...s.miniInp, width:50, padding:"4px 3px" }} value={cot.descuentoGlobalTipo||"%"} onChange={e => upd("descuentoGlobalTipo", e.target.value)}>
                    <option>%</option><option>$</option>
                  </select>
                </div>
                {totales.descG > 0 && <p style={{ fontSize:11, color:"#E24B4A", marginTop:4 }}>− {sym(mon)}{fmtN(mon==="CRC"?totales.descG*tasa:totales.descG)}</p>}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:13 }}>
                <span style={{ color:"#888" }}>IVA</span>
                <span>{sym(mon)}{fmtN(mon==="CRC"?totales.iva*tasa:totales.iva)}</span>
              </div>
              <div style={{ borderTop:"1.5px solid #e0e4ea", paddingTop:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontWeight:700, fontSize:16, color:"var(--eco-primary,#1a3a5c)" }}>
                  <span>Total {mon}</span>
                  <span>{sym(mon)}{fmtN(mon==="CRC"?totales.total*tasa:totales.total)}</span>
                </div>
              </div>
              <div style={{ marginTop:12, border:"0.5px dashed rgba(0,0,0,.12)", borderRadius:8, padding:"8px 10px", background:"#fff" }}>
                <p style={{ fontSize:10, fontWeight:500, color:"#bbb", textTransform:"uppercase", letterSpacing:".5px", marginBottom:4 }}>Equiv. {monContraria}</p>
                <p style={{ fontSize:14, fontWeight:600, color:"#555" }}>
                  {mon==="USD" ? `₡${Math.round(totales.total*tasa).toLocaleString("es-CR")}` : `$${fmtN(totales.total/tasa)}`}
                </p>
                <p style={{ fontSize:10, color:"#bbb", marginTop:2 }}>Tasa ₡{tasa.toFixed(2)} / USD</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}