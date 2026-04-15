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
  doc, getDoc, updateDoc, addDoc, collection, getDocs, where,
  serverTimestamp, query, orderBy, onSnapshot, runTransaction,
} from "firebase/firestore";
import { db } from "../../../firebase/config";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DateInput from "../../../shared/components/DateInput";

function SortableRow({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <tr ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, background: isDragging ? '#f0f4f8' : undefined }} {...attributes}>
      <td style={{ width: 28, textAlign: 'center', cursor: 'grab', color: '#ccc', fontSize: 14, padding: '0 4px' }} {...listeners}>⠿</td>
      {children}
    </tr>
  );
}

import { fmt as fmtMoneda, simbolo } from '../../../lib/formatMoneda'
const sym = (mon) => simbolo(mon);
const fmtN = (n, mon) => fmtMoneda(n, mon).replace(/^[$₡]/, '');

const IVA_OPCIONES = [
  { label: "13%", value: 13 },
  { label: "4%",  value: 4  },
  { label: "2%",  value: 2  },
  { label: "1%",  value: 1  },
  { label: "0%",  value: 0  },
];

const calcLinea = (p, ivaPctGlobal = 13) => {
  const precio   = Number(p.precioVentaItem ?? p.precio ?? 0);
  const costo    = Number(p.costoItem ?? p.costo ?? 0);
  const cant     = Number(p.cantidad || 1);
  const descPct  = p.descTipo === "%" ? Number(p.desc || 0) : 0;
  const descMonto= p.descTipo === "$" ? Number(p.desc || 0) : 0;
  const base     = precio * cant;
  const descTotal= descPct > 0 ? base * (descPct / 100) : descMonto * cant;
  const neto     = base - descTotal;
  const ivaPct   = Number(ivaPctGlobal) / 100;
  const imp      = neto * ivaPct;
  const margen   = (precio - costo) * cant;
  return { base, neto, imp, total: neto + imp, margen };
};

const calcOpcion = (op, descGlobal, descGlobalTipo, ivaPctGlobal = 13) => {
  const prods      = (op.productos || []);
  const subtotal   = prods.reduce((a, p) => a + calcLinea(p, ivaPctGlobal).base, 0);
  const descLineas = prods.reduce((a, p) => { const c = calcLinea(p, ivaPctGlobal); return a + (c.base - c.neto); }, 0);
  const descG      = descGlobalTipo === "%" ? (subtotal - descLineas) * (Number(descGlobal || 0) / 100) : Number(descGlobal || 0);
  const iva        = prods.reduce((a, p) => a + calcLinea(p, ivaPctGlobal).imp, 0);
  const margenTotal= prods.reduce((a, p) => a + calcLinea(p, ivaPctGlobal).margen, 0);
  const total      = subtotal - descLineas - descG + iva;
  return { subtotal, descLineas, descG, iva, margenTotal, total };
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
  const [cotOriginal, setCotOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [hayCambios, setHayCambios] = useState(false);
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [copiado, setCopiado] = useState(false);
  const [alertaEmpresa, setAlertaEmpresa] = useState(false);
  const [portadas, setPortadas] = useState([]);
  const [plantillaConfig, setPlantillaConfig] = useState(null);
  const [showSelectorFichas, setShowSelectorFichas] = useState(false);
  const [plantillasObs, setPlantillasObs] = useState([]);
  const [showModalPlantillas, setShowModalPlantillas] = useState(false);
  const [confirmarMoneda, setConfirmarMoneda] = useState(null);
  const [editandoProducto, setEditandoProducto] = useState(null);
  const [formProducto, setFormProducto] = useState({});
  const [leadsContacto, setLeadsContacto] = useState([]);
  const [showLeads, setShowLeads] = useState(false);
  const [vendedores, setVendedores] = useState([]);
  const [aprobando, setAprobando] = useState(false);
  const [pasoAprobacion, setPasoAprobacion] = useState(0);
  const [opElegida, setOpElegida] = useState(null);
  const [opcionalesElegidos, setOpcionalesElegidos] = useState({});
  const [tasasGlobal, setTasasGlobal] = useState(null);

  // Cargar tasas globales desde configuracion/tasas
  useEffect(() => {
    return onSnapshot(doc(db, 'configuracion', 'tasas'), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setTasasGlobal({ compra: Number(d.compra || 0), venta: Number(d.venta || 0) });
      }
    });
  }, []);


  useEffect(() => { cargarTodo(); }, [id]);

  const cargarTodo = async () => {
    try {
      const [cotSnap, contSnap, prodSnap, etSnap, pltSnap, listasSnap, empSnap] = await Promise.all([
        getDoc(doc(db, "cotizaciones", id)),
        getDocs(query(collection(db, "contactos"), orderBy("nombre"))),
        getDocs(query(collection(db, "productos"), orderBy("nombre"))),
        getDocs(collection(db, "catalogo_etiquetas_producto")),
        getDoc(doc(db, "configuracion", "plantilla_cotizacion")),
        getDocs(collection(db, "listasPrecios")),
        getDocs(collection(db, "empleados")),
      ]);

      if (cotSnap.exists()) {
        const data = { id: cotSnap.id, ...cotSnap.data() };
        setCot(data);
        setCotOriginal(JSON.parse(JSON.stringify(data)));
      }
      setContactos(contSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setProductos(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.esVenta !== false));
      setEtiquetas(etSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setVendedores(empSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.activo !== false && e.asignableVentas && e.usuarioId));

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

  const guardar = useCallback(() => { setHayCambios(true); }, []);

  const guardarEnFirestore = async () => {
    if (!cot || !id) return;
    setGuardando(true);
    try {
      const { id: _id, ...datos } = cot;
      await updateDoc(doc(db, "cotizaciones", id), { ...datos, actualizadoEn: serverTimestamp() });
      setCotOriginal(JSON.parse(JSON.stringify(cot)));
      setHayCambios(false);
    } catch (e) { console.error(e); }
    finally { setGuardando(false); }
  };

  const cancelarCambios = () => {
    if (!cotOriginal) return;
    setCot(JSON.parse(JSON.stringify(cotOriginal)));
    setHayCambios(false);
  };

  const upd = (campo, valor) => { setCot(c => ({ ...c, [campo]: valor })); guardar(); };

  const cambiarMoneda = (nuevaMon) => {
    if (nuevaMon === mon) return;
    setConfirmarMoneda(nuevaMon);
  };

  const ejecutarCambioMoneda = (revertirModificados = false) => {
    const nuevaMon = confirmarMoneda;
    setConfirmarMoneda(null);
    const tasaUsar = nuevaMon === "CRC" ? tasaVenta : tasaCompra;
    const convertir = (productos) => (productos || []).map(p => {
      // Si tiene precio modificado y el usuario elige revertir → usar precio base
      if (p.precioModificado && revertirModificados) {
        return { ...p, precioVentaItem: p.precio, costoItem: p.costo, precioModificado: false };
      }
      const tl = tasaUsar;
      const precioConvertido = nuevaMon === "CRC"
        ? (Number(p.precioVentaItem ?? p.precio ?? 0) * tl).toFixed(2)
        : (Number(p.precioVentaItem ?? p.precio ?? 0) / tl).toFixed(2);
      const costoConvertido = nuevaMon === "CRC"
        ? (Number(p.costoItem ?? p.costo ?? 0) * tl).toFixed(2)
        : (Number(p.costoItem ?? p.costo ?? 0) / tl).toFixed(2);
      return { ...p, precio: precioConvertido, precioVentaItem: precioConvertido, costoItem: costoConvertido };
    });
    const opciones = cot.opciones.map(op => ({
      ...op,
      productos: convertir(op.productos),
      productosOpcionales: convertir(op.productosOpcionales),
    }));
    const payload = { moneda: nuevaMon, opciones };
    setCot(c => ({ ...c, ...payload }));
    guardar();
  };

  const iniciarAprobacion = () => {
    const opActual = cot.opciones.find(o => o.id === cot.opcionActiva) || cot.opciones[0];
    const pasos = [];
    if (cot.opciones.length > 1) pasos.push("opcion");
    if ((opActual?.productosOpcionales || []).length > 0) pasos.push("opcionales");
    pasos.push("confirmar");
    setPasosAprobacion(pasos);
    setPasoAprobacion(0);
    setOpElegida(cot.opcionActiva || cot.opciones[0]?.id);
    setOpcionalesElegidos({});
    setAprobando(true);
  };

  const [pasosAprobacion, setPasosAprobacion] = useState([]);

  const confirmarAprobacion = async () => {
    try {
      await updateDoc(doc(db, 'cotizaciones', id), {
        estado: "Aceptada", aceptada: true,
        opcionElegida: opElegida,
        opcionalesElegidos: opcionalesElegidos,
        aprobadaEn: serverTimestamp(),
      });
      setCot(prev => ({ ...prev, estado: "Aceptada", aceptada: true, opcionElegida: opElegida, opcionalesElegidos: opcionalesElegidos }));
      setAprobando(false);
    } catch (e) { console.error(e); }
  };

  const devolverBorrador = async () => {
    await updateDoc(doc(db, 'cotizaciones', id), { estado: "Borrador", aceptada: false, opcionElegida: null, opcionalesElegidos: null, aprobadaEn: null });
    setCot(prev => ({ ...prev, estado: "Borrador", aceptada: false }));
  };

  const pasarAFactura = async () => {
    if (cot.facturaId) { navigate(`/facturacion/${cot.facturaId}`); return; }
    try {
      const opFinal = cot.opciones?.find(o => o.id === (cot.opcionElegida || cot.opcionActiva)) || cot.opciones?.[0];
      // Usar los mismos cálculos que muestra la cotización
      const tots = calcOpcion(opFinal, cot.descuentoGlobal, cot.descuentoGlobalTipo, cot.ivaPct ?? 13);
      const sub = tots.subtotal;
      const descuento = tots.descLineas + tots.descG;
      const base = sub - descuento;
      const imp = tots.iva;
      const total = tots.total;

      // Consecutivo
      const configRef = doc(db, "config", "consecutivos");
      const counterRef = doc(db, "config", "contadores");
      const numero = await runTransaction(db, async (tx) => {
        const cs = await tx.get(configRef);
        const ct = await tx.get(counterRef);
        const prefijo = cs.exists() ? (cs.data().prefijoFactura || "FAC") : "FAC";
        const contadores = ct.exists() ? ct.data() : {};
        const actual = Number(contadores.prefijoFactura || 0) + 1;
        tx.set(counterRef, { ...contadores, prefijoFactura: actual }, { merge: true });
        return `${prefijo}-${String(actual).padStart(3, "0")}`;
      });

      const factRef = await addDoc(collection(db, "facturas"), {
        numero,
        cotizacionId: id,
        cotizacionNumero: cot.numero,
        clienteId: cot.clienteId,
        clienteNombre: cot.clienteNombre,
        facturarEmpresa: cot.facturarEmpresa,
        empresaNombre: cot.empresaNombre || "",
        empresaCedula: cot.empresaCedula || "",
        contactoNombre: cot.contactoNombre || "",
        leadId: cot.leadId || null,
        leadNombre: cot.leadNombre || "",
        vendedorId: cot.vendedorId || "",
        vendedorNombre: cot.vendedorNombre || "",
        moneda: cot.moneda,
        tasaVenta: tasaVenta || null,
        tasaCompra: tasaCompra || null,
        opciones: cot.opciones,
        opcionActiva: cot.opcionElegida || cot.opcionActiva,
        opcionalesElegidos: cot.opcionalesElegidos || {},
        descuentoGlobal: cot.descuentoGlobal,
        descuentoGlobalTipo: cot.descuentoGlobalTipo,
        subtotal: sub,
        descuento,
        base,
        impuesto: imp,
        total,
        estado: "Sin Pagar",
        pagos: [],
        totalPagado: 0,
        saldo: total,
        observaciones: cot.observaciones || "",
        fechaEmision: new Date().toISOString().split("T")[0],
        fechaVencimiento: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        creadoEn: serverTimestamp(),
      });

      await updateDoc(doc(db, 'cotizaciones', id), { facturaId: factRef.id, estado: "Facturada" });
      setCot(prev => ({ ...prev, facturaId: factRef.id, estado: "Facturada" }));

      // Celebración de venta — obtener avatar del vendedor
      let avatarVendedor = ''
      if (cot.vendedorId) {
        try { const uSnap = await getDoc(doc(db, 'usuarios', cot.vendedorId)); if (uSnap.exists()) avatarVendedor = uSnap.data().fotoURL || '' } catch {}
      }
      await addDoc(collection(db, "ventas_celebraciones"), {
        tipo: 'ganada',
        vendedorId: cot.vendedorId || '',
        vendedorNombre: cot.vendedorNombre || cot.clienteNombre || '',
        vendedorAvatar: avatarVendedor,
        facturaId: factRef.id,
        cotizacionId: id,
        monto: total,
        moneda: cot.moneda || 'USD',
        creadoEn: serverTimestamp(),
        reacciones: {},
        visto: [],
      }).catch(() => {})

      navigate(`/facturacion/${factRef.id}`);
    } catch (err) { console.error("Error creando factura:", err); alert("Error al crear factura: " + err.message); }
  };

  const updOpcion = (opId, campo, valor) => {
    const ops = cot.opciones.map(o => o.id === opId ? { ...o, [campo]: valor } : o);
    setCot({ ...cot, opciones: ops });
    guardar();
  };

  const selContacto = async (c) => {
    const payload = { clienteId: c.id, clienteNombre: c.nombre, contactoNombre: c.nombre, facturarEmpresa: false, empresaId: c.empresaId || null, empresaNombre: c.empresaNombre || "", empresaCedula: c.empresaCedula || "" };
    setCot(prev => ({ ...prev, ...payload }));
    guardar();
    setShowContactos(false); setBusqContacto(c.nombre);
    if (c.empresaId || c.empresaNombre) setAlertaEmpresa(true);
    // Cargar leads del contacto
    try {
      const snap = await getDocs(query(collection(db, 'leads'), where('contactoId', '==', c.id)));
      const leads = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => l.estado !== 'perdido');
      setLeadsContacto(leads);
      if (leads.length > 0) setShowLeads(true);
    } catch { setLeadsContacto([]); }
  };

  const selLead = (lead) => {
    const payload = { leadId: lead.id, leadNombre: lead.nombre || '' };
    setCot(prev => ({ ...prev, ...payload }));
    guardar();
    setShowLeads(false);
  };

  const setFacturacion = (tipo) => {
    const facturarEmpresa = tipo === "empresa";
    setCot({ ...cot, facturarEmpresa }); guardar(); setAlertaEmpresa(false);
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
    const costoBase = prod.precioCompra || prod.costo || 0;
    const linea = {
      _lid: genId(),
      productoId: prod.id,
      nombre: prod.nombre,
      descripcion: prod.descripcion || "",
      costo: costoBase,
      precio,
      costoItem: costoBase,
      precioVentaItem: precio,
      precioModificado: false,
      cantidad: 1,
      desc: 0,
      descTipo: "%",
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
        guardar();
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

  const reorderLineas = (opId, oldIndex, newIndex) => {
    const op = cot.opciones.find(o => o.id === opId);
    if (!op) return;
    const reordered = arrayMove(op.productos, oldIndex, newIndex);
    updOpcion(opId, "productos", reordered);
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
    guardar();
  };

  const duplicarOpcion = (opId) => {
    const ids = ["A","B","C","D","E"];
    const next = ids.find(i => !cot.opciones.map(o => o.id).includes(i));
    if (!next) return;
    const origen = cot.opciones.find(o => o.id === opId);
    const copia = { ...origen, id: next, nombre: `Opción ${next}`, productos: (origen.productos || []).map(p => ({ ...p, _lid: genId() })), productosOpcionales: (origen.productosOpcionales || []).map(p => ({ ...p, _lid: genId() })) };
    const ops = [...cot.opciones, copia];
    setCot({ ...cot, opciones: ops, opcionActiva: next });
    guardar();
  };

  const copiarEnlace = () => { navigator.clipboard.writeText(`${window.location.origin}/cotizacion/${id}`); setCopiado(true); setTimeout(() => setCopiado(false), 2000); };
  const marcarEnviada = async () => {
    setEnviando(true);
    try {
      // Guardar todo + marcar como enviada
      const { id: _id, ...datos } = { ...cot, estado: "Enviada", enviadoEn: serverTimestamp() };
      await updateDoc(doc(db, "cotizaciones", id), { ...datos, actualizadoEn: serverTimestamp() });
      setCot(c => ({ ...c, estado: "Enviada" }));
      setCotOriginal(JSON.parse(JSON.stringify({ ...cot, estado: "Enviada" })));
      setHayCambios(false);
    } catch (e) { console.error(e); }
    finally { setEnviando(false); }
    copiarEnlace();
  };

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
  const totales = opActiva ? calcOpcion(opActiva, cot.descuentoGlobal, cot.descuentoGlobalTipo, cot.ivaPct ?? 13) : {};
  const mon = cot.moneda || "USD";
  const tasaVenta = tasasGlobal?.venta || 0;
  const tasaCompra = tasasGlobal?.compra || 0;
  const tasa = mon === "CRC" ? tasaVenta : tasaCompra;
  const monContraria = mon === "USD" ? "CRC" : "USD";
  const getTasaLinea = (p) => Number(p.tasaIndividual || 0) || tasa;
  const contactosFiltrados = contactos.filter(c => c.nombre?.toLowerCase().includes(busqContacto.toLowerCase()));
  const adjuntosDisponibles = getAdjuntosDisponibles();
  const fichasActuales = cot.fichasTecnicas || [];

  const estadoColors = { Borrador:{ bg:"#F1EFE8", color:"#5F5E5A" }, Enviada:{ bg:"#E6F1FB", color:"#185FA5" }, Vista:{ bg:"#EEEDFE", color:"#3C3489" }, Aceptada:{ bg:"#EAF3DE", color:"#3B6D11" }, Rechazada:{ bg:"#FCEBEB", color:"#A32D2D" }, Facturada:{ bg:"#E6F1FB", color:"#185FA5" } };
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

      {aprobando && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", backdropFilter:"blur(3px)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={e => e.target === e.currentTarget && setAprobando(false)}>
          <div style={{ background:"#fff", borderRadius:14, width:"90%", maxWidth:500, boxShadow:"0 20px 60px rgba(0,0,0,.2)", overflow:"hidden" }}>
            {/* Stepper */}
            <div style={{ padding:"16px 20px", borderBottom:"1px solid #f0f2f5", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                {pasosAprobacion.map((p, i) => (
                  <div key={p} style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", background: i < pasoAprobacion ? "#EAF3DE" : i === pasoAprobacion ? "#1a3a5c" : "#eee", color: i < pasoAprobacion ? "#3B6D11" : i === pasoAprobacion ? "#fff" : "#aaa", fontSize:12, fontWeight:500 }}>
                      {i < pasoAprobacion ? "✓" : i + 1}
                    </div>
                    <span style={{ fontSize:12, color: i === pasoAprobacion ? "#1a3a5c" : "#aaa", fontWeight: i === pasoAprobacion ? 600 : 400 }}>
                      {p === "opcion" ? "Opción" : p === "opcionales" ? "Opcionales" : "Confirmar"}
                    </span>
                    {i < pasosAprobacion.length - 1 && <div style={{ width:20, height:1, background:"#ddd" }} />}
                  </div>
                ))}
              </div>
              <button onClick={() => setAprobando(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"#aaa", fontSize:18 }}>×</button>
            </div>

            <div style={{ padding:"20px" }}>
              {/* Paso: elegir opción */}
              {pasosAprobacion[pasoAprobacion] === "opcion" && (
                <div>
                  <p style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>¿Cuál opción se aprueba?</p>
                  <p style={{ color:"#888", fontSize:12, marginBottom:16 }}>Selecciona la opción elegida por el cliente.</p>
                  <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
                    {cot.opciones.map(o => {
                      const tot = calcOpcion(o, cot.descuentoGlobal, cot.descuentoGlobalTipo, cot.ivaPct ?? 13);
                      const sel = opElegida === o.id;
                      return (
                        <div key={o.id} onClick={() => setOpElegida(o.id)} style={{ border: sel ? "2px solid #0F6E56" : "1px solid #eaecf0", borderRadius:10, padding:"12px 16px", cursor:"pointer", background: sel ? "#f0faf6" : "#fff" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                              <div style={{ width:18, height:18, borderRadius:"50%", border: sel ? "5px solid #0F6E56" : "1.5px solid #ccc", flexShrink:0 }} />
                              <span style={{ fontWeight:500, fontSize:13 }}>{o.nombre}</span>
                            </div>
                            <span style={{ fontWeight:600, fontSize:14, color:"#0F6E56" }}>{sym(mon)}{fmtN(tot.total)}</span>
                          </div>
                          <div style={{ marginTop:6, marginLeft:28 }}>
                            {(o.productos || []).map((p, i) => <div key={i} style={{ fontSize:11, color:"#888", marginBottom:1 }}>{p.cantidad}x {p.nombre}</div>)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display:"flex", justifyContent:"flex-end" }}>
                    <button disabled={!opElegida} onClick={() => setPasoAprobacion(p => p + 1)} style={{ ...s.btnPrimary, background:"#0F6E56", opacity: opElegida ? 1 : 0.5 }}>Continuar →</button>
                  </div>
                </div>
              )}

              {/* Paso: productos opcionales */}
              {pasosAprobacion[pasoAprobacion] === "opcionales" && (() => {
                const opPaso = cot.opciones.find(o => o.id === opElegida) || cot.opciones[0];
                return (
                  <div>
                    <p style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>Productos opcionales</p>
                    <p style={{ color:"#888", fontSize:12, marginBottom:16 }}>Selecciona los adicionales que el cliente quiere incluir.</p>
                    <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
                      {(opPaso?.productosOpcionales || []).map((p, i) => {
                        const key = p._lid || p.nombre;
                        const activo = opcionalesElegidos[key];
                        return (
                          <div key={i} onClick={() => setOpcionalesElegidos(prev => ({ ...prev, [key]: !prev[key] }))} style={{ border: activo ? "2px solid #0F6E56" : "1px solid #eaecf0", borderRadius:10, padding:"12px 16px", cursor:"pointer", background: activo ? "#f0faf6" : "#fff", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                              <div style={{ width:18, height:18, borderRadius:4, border: activo ? "none" : "1.5px solid #ccc", background: activo ? "#0F6E56" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                                {activo && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                              </div>
                              <span style={{ fontWeight:500, fontSize:13 }}>{p.nombre}</span>
                            </div>
                            <span style={{ fontWeight:500, color:"#0F6E56", fontSize:13 }}>+ {sym(mon)}{fmtN(Number(p.precio || 0))}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <button onClick={() => setPasoAprobacion(p => p - 1)} style={s.btn}>← Atrás</button>
                      <button onClick={() => setPasoAprobacion(p => p + 1)} style={{ ...s.btnPrimary, background:"#0F6E56" }}>Continuar →</button>
                    </div>
                  </div>
                );
              })()}

              {/* Paso: confirmar */}
              {pasosAprobacion[pasoAprobacion] === "confirmar" && (() => {
                const opFinal = cot.opciones.find(o => o.id === opElegida) || cot.opciones[0];
                const totFinal = calcOpcion(opFinal, cot.descuentoGlobal, cot.descuentoGlobalTipo, cot.ivaPct ?? 13);
                const extraOpcionales = (opFinal?.productosOpcionales || []).filter(p => opcionalesElegidos[p._lid || p.nombre]).reduce((a, p) => a + Number(p.precio || 0), 0);
                return (
                  <div>
                    <p style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>Confirmar aprobación</p>
                    <div style={{ background:"#f8f9fb", borderRadius:8, padding:"14px 16px", marginBottom:16, fontSize:13 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                        <span style={{ color:"#888" }}>Opción</span>
                        <span style={{ fontWeight:600 }}>{opFinal?.nombre}</span>
                      </div>
                      {extraOpcionales > 0 && (
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                          <span style={{ color:"#888" }}>Opcionales</span>
                          <span style={{ fontWeight:500, color:"#0F6E56" }}>+ {sym(mon)}{fmtN(extraOpcionales)}</span>
                        </div>
                      )}
                      <div style={{ borderTop:"1px solid #e0e4ea", paddingTop:8, display:"flex", justifyContent:"space-between" }}>
                        <span style={{ fontWeight:700, color:"var(--eco-primary,#1a3a5c)" }}>Total</span>
                        <span style={{ fontWeight:700, fontSize:16, color:"var(--eco-primary,#1a3a5c)" }}>{sym(mon)}{fmtN(totFinal.total + extraOpcionales)}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:10 }}>
                      <button onClick={() => setPasoAprobacion(p => p - 1)} style={{ ...s.btn, flex:1 }}>← Atrás</button>
                      <button onClick={confirmarAprobacion} style={{ ...s.btnPrimary, flex:2, background:"#0F6E56" }}>✓ Aprobar cotización</button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal editar producto base */}
      {editandoProducto && (() => {
        const prod = productos.find(pr => pr.id === editandoProducto.productoId)
        if (!prod && !formProducto.nombre) {
          setFormProducto({ nombre: editandoProducto.nombre || '', descripcion: editandoProducto.descripcion || '', precioCompra: editandoProducto.costo || 0, precioVenta: editandoProducto.precio || 0 })
        } else if (prod && !formProducto.nombre) {
          setFormProducto({ nombre: prod.nombre || '', descripcion: prod.descripcion || '', precioCompra: prod.precioCompra || prod.costo || 0, precioVenta: prod.precioVenta || prod.precio || 0 })
        }
        return null
      })()}
      {editandoProducto && formProducto.nombre !== undefined && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", backdropFilter:"blur(3px)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={e => e.target === e.currentTarget && (() => { setEditandoProducto(null); setFormProducto({}) })()}>
          <div style={{ background:"#fff", borderRadius:14, width:"90%", maxWidth:440, boxShadow:"0 20px 60px rgba(0,0,0,.2)", overflow:"hidden" }}>
            <div style={{ padding:"16px 20px", borderBottom:"1px solid #f0f2f5", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>Editar producto base</div>
                <div style={{ fontSize:11, color:"#888" }}>Cambios se guardan en el catálogo de productos</div>
              </div>
              <button onClick={() => { setEditandoProducto(null); setFormProducto({}) }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#aaa" }}>×</button>
            </div>
            <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:12 }}>
              <div><label style={s.lbl}>Nombre</label><input style={s.inp} value={formProducto.nombre || ''} onChange={e => setFormProducto(f => ({...f, nombre: e.target.value}))} /></div>
              <div><label style={s.lbl}>Descripción</label><textarea style={{...s.inp, minHeight:50, resize:"vertical"}} value={formProducto.descripcion || ''} onChange={e => setFormProducto(f => ({...f, descripcion: e.target.value}))} /></div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div><label style={s.lbl}>Costo (USD)</label><input style={s.inp} type="number" step="0.01" value={formProducto.precioCompra || ''} onChange={e => setFormProducto(f => ({...f, precioCompra: e.target.value}))} /></div>
                <div><label style={s.lbl}>Precio venta (USD)</label><input style={s.inp} type="number" step="0.01" value={formProducto.precioVenta || ''} onChange={e => setFormProducto(f => ({...f, precioVenta: e.target.value}))} /></div>
              </div>
            </div>
            <div style={{ padding:"14px 20px", borderTop:"1px solid #f0f2f5", display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={() => { setEditandoProducto(null); setFormProducto({}) }} style={{ padding:"8px 16px", border:"1px solid #dde3ed", borderRadius:8, fontSize:12, cursor:"pointer", background:"#f5f5f5", fontFamily:"inherit" }}>Cancelar</button>
              <button onClick={async () => {
                if (!editandoProducto.productoId) return
                try {
                  await updateDoc(doc(db, 'productos', editandoProducto.productoId), {
                    nombre: formProducto.nombre, descripcion: formProducto.descripcion,
                    precioCompra: Number(formProducto.precioCompra || 0), precioVenta: Number(formProducto.precioVenta || 0),
                    precio: Number(formProducto.precioVenta || 0),
                  })
                  setProductos(prev => prev.map(pr => pr.id === editandoProducto.productoId ? {...pr, ...formProducto, precioCompra: Number(formProducto.precioCompra||0), precioVenta: Number(formProducto.precioVenta||0), precio: Number(formProducto.precioVenta||0)} : pr))
                  setEditandoProducto(null); setFormProducto({})
                } catch(err) { alert('Error: ' + err.message) }
              }} style={{ padding:"8px 20px", border:"none", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", background:"var(--eco-primary,#1a3a5c)", color:"#fff", fontFamily:"inherit" }}>
                Guardar en catálogo
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeads && leadsContacto.length > 0 && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", backdropFilter:"blur(3px)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={e => e.target === e.currentTarget && setShowLeads(false)}>
          <div style={{ background:"#fff", borderRadius:14, width:"90%", maxWidth:420, boxShadow:"0 20px 60px rgba(0,0,0,.2)", overflow:"hidden" }}>
            <div style={{ padding:"16px 20px", borderBottom:"1px solid #f0f2f5", display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:22 }}>📋</span>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>Seleccionar lead</div>
                <div style={{ fontSize:12, color:"#888" }}>Leads activos de {cot.clienteNombre}</div>
              </div>
            </div>
            <div style={{ padding:"10px 20px", maxHeight:300, overflowY:"auto" }}>
              {leadsContacto.map(lead => (
                <div key={lead.id} onClick={() => selLead(lead)}
                  style={{ padding:"12px 14px", cursor:"pointer", borderRadius:10, border:"1px solid #eaecf0", marginBottom:8, background:"#fafbfd" }}
                  onMouseEnter={e => e.currentTarget.style.background="#EEF3FA"} onMouseLeave={e => e.currentTarget.style.background="#fafbfd"}>
                  <div style={{ fontWeight:600, fontSize:13, color:"#1a1a1a", marginBottom:4 }}>{lead.nombre || "Lead sin nombre"}</div>
                  <div style={{ display:"flex", gap:8, fontSize:11, color:"#888" }}>
                    {lead.etapa && <span style={{ padding:"1px 8px", borderRadius:12, background:"#E6F1FB", color:"#185FA5", fontWeight:500 }}>{lead.etapa}</span>}
                    {lead.prioridad && <span>Prioridad: {lead.prioridad}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding:"14px 20px", borderTop:"1px solid #f0f2f5", display:"flex", justifyContent:"flex-end" }}>
              <button onClick={() => setShowLeads(false)} style={{ padding:"8px 16px", border:"1px solid #dde3ed", borderRadius:8, fontSize:12, cursor:"pointer", background:"#f5f5f5", fontFamily:"inherit" }}>Continuar sin lead</button>
            </div>
          </div>
        </div>
      )}

      {confirmarMoneda && (() => {
        const tieneModificados = cot.opciones.some(op => (op.productos || []).some(p => p.precioModificado))
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", backdropFilter:"blur(3px)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={e => e.target === e.currentTarget && setConfirmarMoneda(null)}>
            <div style={{ background:"#fff", borderRadius:14, width:"90%", maxWidth:420, boxShadow:"0 20px 60px rgba(0,0,0,.2)", overflow:"hidden" }}>
              <div style={{ padding:"16px 20px", borderBottom:"1px solid #f0f2f5", display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:22 }}>💱</span>
                <span style={{ fontWeight:700, fontSize:15 }}>Cambiar moneda</span>
              </div>
              <div style={{ padding:"18px 20px", fontSize:13, color:"#555", lineHeight:1.6 }}>
                <p style={{ margin:"0 0 10px" }}>Se convertirán los precios de <b>{mon}</b> a <b>{confirmarMoneda}</b>.</p>
                <p style={{ margin:"0 0 10px" }}>
                  Tasa: <b>₡{(confirmarMoneda === "CRC" ? tasaVenta : tasaCompra).toFixed(2)}</b>
                  {" "}({confirmarMoneda === "CRC" ? "venta" : "compra"})
                </p>
                {tieneModificados && (
                  <div style={{ background:"#FFF8E1", border:"1px solid #EDD98A", borderRadius:7, padding:"10px 12px", marginTop:10, fontSize:12, color:"#854F0B" }}>
                    ⚠️ Hay productos con precios modificados manualmente. Podés convertirlos o revertirlos al precio base del catálogo.
                  </div>
                )}
              </div>
              <div style={{ padding:"14px 20px", borderTop:"1px solid #f0f2f5", display:"flex", gap:8, justifyContent:"flex-end", flexWrap:"wrap" }}>
                <button onClick={() => setConfirmarMoneda(null)} style={{ padding:"8px 16px", border:"1px solid #dde3ed", borderRadius:8, fontSize:12, cursor:"pointer", background:"#f5f5f5", fontFamily:"inherit" }}>Cancelar</button>
                {tieneModificados && (
                  <button onClick={() => ejecutarCambioMoneda(true)} style={{ padding:"8px 16px", border:"1px solid #EDD98A", borderRadius:8, fontSize:12, fontWeight:500, cursor:"pointer", background:"#FFF8E1", color:"#854F0B", fontFamily:"inherit" }}>Revertir al base</button>
                )}
                <button onClick={() => ejecutarCambioMoneda(false)} style={{ padding:"8px 20px", border:"none", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", background:"var(--eco-primary,#1a3a5c)", color:"#fff", fontFamily:"inherit" }}>Convertir</button>
              </div>
            </div>
          </div>
        )
      })()}

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
          {hayCambios && <span style={{ fontSize:11, color:"#E65100", fontWeight:600 }}>● Sin guardar</span>}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {hayCambios && (
            <>
              <button style={{ ...s.btn, color:"#888" }} onClick={cancelarCambios}>Cancelar</button>
              <button style={{ ...s.btnPrimary, background:"#0F6E56" }} onClick={guardarEnFirestore} disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </>
          )}
          <button style={s.btn} onClick={() => window.open(`/cotizacion/${id}`, "_blank")}>Vista previa</button>
          <button style={s.btn} onClick={copiarEnlace}>{copiado ? "¡Copiado!" : "Copiar enlace"}</button>
          {cot.estado === "Borrador" && (
            <button style={s.btnPrimary} onClick={marcarEnviada} disabled={enviando}>
              {enviando ? "Enviando..." : "Marcar enviada + copiar enlace"}
            </button>
          )}
          {cot.estado !== "Aceptada" && cot.estado !== "Rechazada" && cot.estado !== "Facturada" && (
            <button style={{ ...s.btnPrimary, background:"#0F6E56" }} onClick={iniciarAprobacion}>
              ✓ Aprobar cotización
            </button>
          )}
          {cot.estado === "Aceptada" && (
            <>
              <button style={{ ...s.btn, color:"#854F0B", borderColor:"#EDD98A", background:"#FFFBF0" }} onClick={devolverBorrador}>
                ↩ Devolver a borrador
              </button>
              <button style={{ ...s.btnPrimary, background:"#185FA5" }} onClick={pasarAFactura}>
                📄 Pasar a factura
              </button>
            </>
          )}
          {cot.estado === "Facturada" && cot.facturaId && (
            <button style={{ ...s.btnPrimary, background:"#185FA5" }} onClick={() => navigate(`/facturacion/${cot.facturaId}`)}>
              📄 Ver factura
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
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:12 }}>
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
            <label style={s.lbl}>Lead vinculado</label>
            {cot.leadId ? (
              <div style={{ background:"#EAF3DE", borderRadius:7, padding:"7px 12px", fontSize:12, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontWeight:500, color:"#3B6D11" }}>{cot.leadNombre || "Lead"}</span>
                <button onClick={() => { upd("leadId", null); upd("leadNombre", ""); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#888", fontSize:14 }}>×</button>
              </div>
            ) : (
              <button onClick={async () => {
                if (!cot.clienteId) return;
                try {
                  const snap = await getDocs(query(collection(db, 'leads'), where('contactoId', '==', cot.clienteId)));
                  const leads = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => l.estado !== 'perdido');
                  setLeadsContacto(leads);
                  if (leads.length > 0) setShowLeads(true);
                } catch {}
              }} disabled={!cot.clienteId} style={{ ...s.inp, cursor: cot.clienteId ? "pointer" : "not-allowed", color:"#888", textAlign:"left", background: cot.clienteId ? "#fff" : "#f5f5f5" }}>
                {cot.clienteId ? "Seleccionar lead..." : "Primero elige contacto"}
              </button>
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
            <label style={s.lbl}>Vendedor</label>
            <select style={s.inp} value={cot.vendedorId || ""} onChange={e => {
              const emp = vendedores.find(v => v.usuarioId === e.target.value);
              upd("vendedorId", e.target.value);
              upd("vendedorNombre", emp ? `${emp.nombre || ""} ${emp.apellido || ""}`.trim() : "");
            }}>
              <option value="">— Seleccionar —</option>
              {vendedores.map(v => <option key={v.id} value={v.usuarioId}>{`${v.nombre || ""} ${v.apellido || ""}`.trim()}</option>)}
            </select>
          </div>
          <div>
            <label style={s.lbl}>Moneda</label>
            <select style={s.inp} value={mon} onChange={e => cambiarMoneda(e.target.value)}>
              <option value="USD">USD — Dólar</option>
              <option value="CRC">CRC — Colón</option>
            </select>
          </div>
          <div>
            <label style={s.lbl}>Fecha emisión</label>
            <DateInput value={cot.fechaEmision} onChange={e => upd("fechaEmision", e.target.value)} />
          </div>
          <div>
            <label style={s.lbl}>Vencimiento</label>
            <DateInput value={cot.fechaVencimiento} onChange={e => upd("fechaVencimiento", e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop:10, padding:"7px 12px", borderRadius:7, background:"#E6F1FB", color:"#185FA5", fontSize:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>Cotización en {mon} — Venta: ₡{tasaVenta.toFixed(2)} · Compra: ₡{tasaCompra.toFixed(2)} — {mon === "CRC" ? "Usa tasa venta" : "Usa tasa compra"}</span>
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

          {/* ── IVA global ── */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <span style={{ fontSize:11, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:".5px" }}>IVA aplicado:</span>
            {[{ v:13, l:"13%" }, { v:4, l:"4%" }, { v:0, l:"0%" }].map(o => (
              <button key={o.v} onClick={() => upd("ivaPct", o.v)} style={{ padding:"4px 12px", borderRadius:6, border:`1.5px solid ${(cot.ivaPct ?? 13) === o.v ? "#185FA5" : "#dde3ed"}`, background:(cot.ivaPct ?? 13) === o.v ? "#E6F1FB" : "#fff", color:(cot.ivaPct ?? 13) === o.v ? "#185FA5" : "#888", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>{o.l}</button>
            ))}
          </div>

          {/* ── Tabla de productos incluidos ── */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => {
            const { active, over } = e;
            if (active && over && active.id !== over.id) {
              const prods = opActiva.productos || [];
              const oldIdx = prods.findIndex(p => p._lid === active.id);
              const newIdx = prods.findIndex(p => p._lid === over.id);
              if (oldIdx !== -1 && newIdx !== -1) reorderLineas(opActiva.id, oldIdx, newIdx);
            }
          }}>
          <div style={{ borderRadius:8, overflow:"hidden", border:"1px solid #eaecf2" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...s.th, width:28 }}></th>
                  <th style={{ ...s.th, width:36, paddingLeft:12 }}></th>
                  <th style={s.th}>Producto / Descripción</th>
                  <th style={{ ...s.th, textAlign:"center", width:70 }}>Cant.</th>
                  <th style={{ ...s.th, color:"#185FA5" }}>Precio costo</th>
                  <th style={s.th}>Precio venta</th>
                  <th style={s.th}>Desc.</th>
                  {cols.margen && <th style={{ ...s.th, color:"#3B6D11" }}>Margen</th>}
                  {cols.totcon  && <th style={{ ...s.th, textAlign:"right", paddingRight:14 }}>Total c/IVA</th>}
                  <th style={{ ...s.th, width:36 }}></th>
                </tr>
              </thead>
              <SortableContext items={(opActiva.productos || []).map(p => p._lid)} strategy={verticalListSortingStrategy}>
              <tbody>
                {(opActiva.productos || []).length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ padding:"32px 16px", textAlign:"center", color:"#c0c4cc", fontSize:12, background:"#fafbfc" }}>
                      Sin productos — buscá en el catálogo debajo para agregar
                    </td>
                  </tr>
                ) : (opActiva.productos || []).map((p, idx) => {
                  const calc = calcLinea(p, cot.ivaPct ?? 13);
                  const costoItem = Number(p.costoItem ?? p.costo ?? 0);
                  const precioItem = Number(p.precioVentaItem ?? p.precio ?? 0);
                  return (
                    <SortableRow key={p._lid} id={p._lid}>
                      <td style={{ ...s.td, textAlign:"center", paddingLeft:12 }}>
                        <input type="checkbox" defaultChecked style={{ width:13, height:13, accentColor:"var(--eco-primary,#1a3a5c)", cursor:"pointer" }} />
                      </td>
                      <td style={s.td}>
                        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                          <span style={{ fontWeight:500 }}>{p.nombre}</span>
                          {p.productoId && <button onClick={e => { e.stopPropagation(); setEditandoProducto(p) }} style={{ background:"none", border:"none", cursor:"pointer", color:"#bbb", fontSize:12, padding:"0 2px" }} title="Editar producto base">→</button>}
                        </div>
                        {p.descripcion && <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>{p.descripcion}</div>}
                        {p.precioModificado && <div style={{ fontSize:9, color:"#E65100", marginTop:1 }}>Precio modificado</div>}
                      </td>
                      <td style={{ ...s.td, textAlign:"center" }}>
                        <input style={{ ...s.miniInp, width:52, textAlign:"center" }} value={p.cantidad} onChange={e => updLinea(opActiva.id, p._lid, "cantidad", e.target.value)} />
                      </td>
                      <td style={s.td}>
                        <input style={{ ...s.miniInp, width:84, color:"#185FA5" }} value={p.costoItem ?? p.costo ?? ''} onChange={e => { const v = e.target.value; const ops2 = cot.opciones.map(o => o.id === opActiva.id ? { ...o, productos: o.productos.map(pp => pp._lid === p._lid ? { ...pp, costoItem: v, precioModificado: true } : pp) } : o); setCot(c => ({ ...c, opciones: ops2 })); guardar() }} />
                      </td>
                      <td style={s.td}>
                        <input style={{ ...s.miniInp, width:84 }} value={p.precioVentaItem ?? p.precio ?? ''} onChange={e => { const v = e.target.value; const ops2 = cot.opciones.map(o => o.id === opActiva.id ? { ...o, productos: o.productos.map(pp => pp._lid === p._lid ? { ...pp, precioVentaItem: v, precio: v, precioModificado: true } : pp) } : o); setCot(c => ({ ...c, opciones: ops2 })); guardar() }} />
                      </td>
                      <td style={s.td}>
                        <div style={{ display:"flex", gap:3, alignItems:"center" }}>
                          <input style={{ ...s.miniInp, width:40, textAlign:"center" }} value={p.desc || 0} onChange={e => updLinea(opActiva.id, p._lid, "desc", e.target.value)} />
                          <select style={{ ...s.miniInp, width:42, padding:"4px 3px" }} value={p.descTipo || "%"} onChange={e => updLinea(opActiva.id, p._lid, "descTipo", e.target.value)}>
                            <option>%</option><option>$</option>
                          </select>
                        </div>
                      </td>
                      {cols.margen && <td style={{ ...s.td, color: calc.margen >= 0 ? "#3B6D11" : "#E24B4A", fontWeight:500 }}>{fmtN(calc.margen)}</td>}
                      {cols.totcon && <td style={{ ...s.td, textAlign:"right", paddingRight:14, fontWeight:700, color:"var(--eco-primary,#1a3a5c)" }}>{sym(mon)}{fmtN(calc.total)}</td>}
                      <td style={{ ...s.td, textAlign:"center" }}>
                        <button style={{ background:"none", border:"none", cursor:"pointer", color:"#ddd", fontSize:16, lineHeight:1, padding:"2px 4px", borderRadius:4 }}
                          onMouseEnter={e => e.currentTarget.style.color="#E24B4A"}
                          onMouseLeave={e => e.currentTarget.style.color="#ddd"}
                          onClick={() => elimLinea(opActiva.id, p._lid)}>✕</button>
                      </td>
                    </SortableRow>
                  );
                })}
              </tbody>
              </SortableContext>
            </table>
          </div>
          </DndContext>

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
                  const precioMon = Number(p.precio);
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
            <textarea style={{ ...s.inp, resize:"vertical", fontSize:12, minHeight:60 }}
              rows={Math.max(4, ((cot.terminos !== undefined ? cot.terminos : (plantillaConfig?.terminosCotizacion || plantillaConfig?.config?.textoTerminos || "")) || "").split('\n').length + 1)}
              placeholder="Términos específicos para esta cotización..."
              value={cot.terminos !== undefined ? cot.terminos : (plantillaConfig?.terminosCotizacion || plantillaConfig?.config?.textoTerminos || "")}
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
                <span style={{ fontWeight:500 }}>{sym(mon)}{fmtN(totales.subtotal)}</span>
              </div>
              {totales.descLineas > 0 && (
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:13 }}>
                  <span style={{ color:"#E24B4A" }}>Desc. por línea</span>
                  <span style={{ color:"#E24B4A" }}>− {sym(mon)}{fmtN(totales.descLineas)}</span>
                </div>
              )}
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, color:"#999", marginBottom:5 }}>Descuento global</div>
                <div style={{ display:"flex", gap:6 }}>
                  <input style={{ ...s.miniInp, flex:1 }} value={cot.descuentoGlobal||0} onChange={e => upd("descuentoGlobal", e.target.value)} />
                  <select style={{ ...s.miniInp, width:50, padding:"4px 3px" }} value={cot.descuentoGlobalTipo||"%"} onChange={e => upd("descuentoGlobalTipo", e.target.value)}>
                    <option>%</option><option>$</option>
                  </select>
                </div>
                {totales.descG > 0 && <p style={{ fontSize:11, color:"#E24B4A", marginTop:4 }}>− {sym(mon)}{fmtN(totales.descG)}</p>}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:13 }}>
                <span style={{ color:"#888" }}>IVA</span>
                <span>{sym(mon)}{fmtN(totales.iva)}</span>
              </div>
              <div style={{ borderTop:"1.5px solid #e0e4ea", paddingTop:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontWeight:700, fontSize:16, color:"var(--eco-primary,#1a3a5c)" }}>
                  <span>Total {mon}</span>
                  <span>{sym(mon)}{fmtN(totales.total)}</span>
                </div>
              </div>
              {cols.margen && totales.margenTotal != null && (
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:13, paddingTop:8, borderTop:"1px dashed #e0e4ea" }}>
                  <span style={{ color:"#3B6D11", fontWeight:600 }}>Margen total</span>
                  <span style={{ color: totales.margenTotal >= 0 ? "#3B6D11" : "#E24B4A", fontWeight:700 }}>{sym(mon)}{fmtN(totales.margenTotal)}</span>
                </div>
              )}
              <div style={{ marginTop:12, border:"0.5px dashed rgba(0,0,0,.12)", borderRadius:8, padding:"8px 10px", background:"#fff" }}>
                <p style={{ fontSize:10, fontWeight:500, color:"#bbb", textTransform:"uppercase", letterSpacing:".5px", marginBottom:4 }}>Equiv. {monContraria}</p>
                <p style={{ fontSize:14, fontWeight:600, color:"#555" }}>
                  {mon==="USD" ? `₡${Math.round(totales.total * tasaVenta).toLocaleString("es-CR")}` : `$${fmtN(totales.total / tasaCompra)}`}
                </p>
                <p style={{ fontSize:10, color:"#bbb", marginTop:2 }}>Venta: ₡{tasaVenta.toFixed(2)} · Compra: ₡{tasaCompra.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}