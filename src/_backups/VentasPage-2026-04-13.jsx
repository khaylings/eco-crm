/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: VentasPage.jsx
 * Módulo:  Ventas
 * ============================================================
 */

import React, { useState, useEffect } from "react";
import {
  collection, getDocs, addDoc, serverTimestamp,
  query, orderBy, doc, getDoc, updateDoc, runTransaction
} from "firebase/firestore";
import { db } from "../../../firebase/config";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { usePermisos } from "../../../hooks/usePermisos";

const ESTADOS = ["Todos", "Borrador", "Enviada", "Vista", "Aceptada", "Rechazada"];

const estadoColor = {
  Borrador:  { bg: "#F1EFE8", color: "#5F5E5A" },
  Enviada:   { bg: "#E6F1FB", color: "#185FA5" },
  Vista:     { bg: "#EEEDFE", color: "#3C3489" },
  Aceptada:  { bg: "#EAF3DE", color: "#3B6D11" },
  Rechazada: { bg: "#FCEBEB", color: "#A32D2D" },
};

const fmt = (n, mon) =>
  mon === "USD"
    ? "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "₡" + Number(n || 0).toLocaleString("es-CR");

const tiempoRelativo = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `hace ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
};

// ── Genera número consecutivo con transacción Firestore ─────────────────────
async function generarConsecutivo(prefixKey, defaultPrefix) {
  const configRef  = doc(db, "config", "consecutivos");
  const counterRef = doc(db, "config", "contadores");

  return await runTransaction(db, async (tx) => {
    const configSnap  = await tx.get(configRef);
    const counterSnap = await tx.get(counterRef);

    const prefijo   = configSnap.exists() ? (configSnap.data()[prefixKey] || defaultPrefix) : defaultPrefix;
    const contadores = counterSnap.exists() ? counterSnap.data() : {};
    const actual    = Number(contadores[prefixKey] || 0) + 1;

    tx.set(counterRef, { ...contadores, [prefixKey]: actual }, { merge: true });

    const num = String(actual).padStart(3, "0");
    return `${prefijo}-${num}`;
  });
}

export default function VentasPage() {
  const { currentUser } = useAuth();
  const { puede, esSuperiorOAdmin, usuario } = usePermisos();
  const navigate = useNavigate();

  const puedeCrearCot    = puede("ventas", "Crear cotización");
  const puedeVerTodas    = puede("ventas", "Ver cotizaciones de todos");
  const puedeVerPrecios  = puede("ventas", "Ver precios y costos");
  const puedeEliminarCot = puede("ventas", "Eliminar cotización");
  const puedeCrearFact   = puede("facturas", "Crear factura desde cotización aprobada");

  const [cotizaciones, setCotizaciones] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [busqueda, setBusqueda]         = useState("");
  const [verSoloMias, setVerSoloMias]   = useState(!puedeVerTodas);
  const [creando, setCreando]           = useState(false);
  const [errorMsg, setErrorMsg]         = useState(null);
  const [creandoFact, setCreandoFact]   = useState(null);

  useEffect(() => { cargarCotizaciones(); }, []);

  const cargarCotizaciones = async () => {
    try {
      const q = query(collection(db, "cotizaciones"), orderBy("creadoEn", "desc"));
      const snap = await getDocs(q);
      setCotizaciones(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const nuevaCotizacion = async () => {
    if (!puedeCrearCot) return;
    setCreando(true);
    try {
      const numero = await generarConsecutivo("prefijoCotizacion", "CTO");
      // Cargar términos predeterminados de la plantilla
      let terminosDefault = "";
      try {
        const pltSnap = await getDoc(doc(db, "configuracion", "plantilla_cotizacion"));
        if (pltSnap.exists()) terminosDefault = pltSnap.data().terminosCotizacion || "";
      } catch {}
      const ref = await addDoc(collection(db, "cotizaciones"), {
        numero,
        estado: "Borrador",
        moneda: "USD",
        tasa: 519.50,
        tasaAuto: true,
        clienteId: null,
        clienteNombre: "",
        facturarEmpresa: false,
        empresaNombre: "",
        empresaCedula: "",
        contactoNombre: "",
        vendedorId: usuario?.uid || currentUser?.uid || null,
        vendedorNombre: usuario?.nombre || currentUser?.displayName || "",
        opciones: [{ id: "A", nombre: "Opción A", productos: [], productosOpcionales: [] }],
        opcionActiva: "A",
        descuentoGlobal: 0,
        descuentoGlobalTipo: "%",
        observaciones: "",
        terminos: terminosDefault,
        fichasTecnicas: [],
        fechaEmision: new Date().toISOString().split("T")[0],
        fechaVencimiento: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        vistoPorCliente: false,
        vistoCuando: null,
        aceptada: false,
        aceptadaPor: null,
        firmaNombre: "",
        firmaCedula: "",
        facturaId: null,
        creadoEn: serverTimestamp(),
      });
      navigate(`/ventas/cotizacion/${ref.id}`);
    } catch (e) {
      console.error(e);
    } finally {
      setCreando(false);
    }
  };

  // ── Crear factura desde cotización ────────────────────────────────────────
  const crearFactura = async (e, cot) => {
    e.stopPropagation();
    setErrorMsg(null);

    if (!puedeCrearFact) {
      setErrorMsg({ cotId: cot.id, texto: "No tenés permiso para crear facturas." });
      return;
    }
    if (!esSuperiorOAdmin && cot.vendedorId && cot.vendedorId !== usuario?.uid) {
      setErrorMsg({ cotId: cot.id, texto: "Solo el vendedor asignado puede facturar esta cotización." });
      return;
    }
    if (cot.estado !== "Aceptada") {
      setErrorMsg({ cotId: cot.id, texto: `No se puede facturar: la cotización está en estado "${cot.estado}". Solo se puede facturar desde una cotización Aceptada.` });
      return;
    }
    if (cot.facturaId) {
      setErrorMsg({ cotId: cot.id, texto: "Esta cotización ya tiene una factura generada." });
      return;
    }

    setCreandoFact(cot.id);
    try {
      // Calcular totales de la opción activa
      const op   = cot.opciones?.find(o => o.id === cot.opcionActiva) || cot.opciones?.[0];
      const sub  = (op?.productos || []).reduce((acc, p) => acc + (Number(p.precio) * Number(p.cantidad || 1)), 0);
      const desc = cot.descuentoGlobalTipo === "%"
        ? sub * (Number(cot.descuentoGlobal || 0) / 100)
        : Number(cot.descuentoGlobal || 0);
      const base   = sub - desc;
      const imp    = base * 0.13;
      const total  = base + imp;

      // Número consecutivo real desde Firestore
      const numero = await generarConsecutivo("prefijoFactura", "FAC");

      const factRef = await addDoc(collection(db, "facturas"), {
        numero,
        cotizacionId:     cot.id,
        cotizacionNumero: cot.numero,
        proyectoId:       null,
        proyectoNumero:   null,
        clienteId:        cot.clienteId,
        clienteNombre:    cot.clienteNombre,
        facturarEmpresa:  cot.facturarEmpresa,
        empresaNombre:    cot.empresaNombre,
        empresaCedula:    cot.empresaCedula,
        contactoNombre:   cot.contactoNombre,
        vendedorId:       cot.vendedorId,
        vendedorNombre:   cot.vendedorNombre,
        moneda:           cot.moneda,
        tasa:             cot.tasa,
        opciones:         cot.opciones,
        opcionActiva:     cot.opcionActiva,
        descuentoGlobal:      cot.descuentoGlobal,
        descuentoGlobalTipo:  cot.descuentoGlobalTipo,
        subtotal:  sub,
        descuento: desc,
        base,
        impuesto:  imp,
        total,
        // Estado inicial — se calcula automático en FacturacionPage
        estado:      "Sin Pagar",
        pagos:       [],
        totalPagado: 0,
        saldo:       total,
        observaciones:    cot.observaciones || "",
        fechaEmision:     new Date().toISOString().split("T")[0],
        fechaVencimiento: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        creadoEn: serverTimestamp(),
      });

      // Vincular factura en la cotización
      await updateDoc(doc(db, "cotizaciones", cot.id), { facturaId: factRef.id });

      navigate(`/facturacion/${factRef.id}`);
    } catch (err) {
      console.error("Error creando factura:", err);
      setErrorMsg({ cotId: cot.id, texto: "Error al crear la factura. Intentá de nuevo." });
    } finally {
      setCreandoFact(null);
    }
  };

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtradas = cotizaciones.filter(c => {
    const esPropia = c.vendedorId === usuario?.uid || !c.vendedorId;
    if (!puedeVerTodas && !esPropia) return false;
    if (puedeVerTodas && verSoloMias && !esPropia) return false;
    if (filtroEstado !== "Todos" && c.estado !== filtroEstado) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (!c.clienteNombre?.toLowerCase().includes(q) &&
          !c.numero?.toLowerCase().includes(q) &&
          !c.empresaNombre?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const calcularTotal = (c) => {
    const op   = c.opciones?.find(o => o.id === c.opcionActiva) || c.opciones?.[0];
    if (!op) return 0;
    const sub  = (op.productos || []).reduce((acc, p) => acc + (Number(p.precio) * Number(p.cantidad || 1)), 0);
    const desc = c.descuentoGlobalTipo === "%" ? sub * (Number(c.descuentoGlobal || 0) / 100) : Number(c.descuentoGlobal || 0);
    return (sub - desc) * 1.13;
  };

  const s = {
    page:       { padding: "24px 28px", minHeight: "100vh", background: "var(--eco-bg, #f5f6f8)" },
    card:       { background: "#fff", border: "0.5px solid rgba(0,0,0,.08)", borderRadius: 10, overflow: "hidden" },
    toolbar:    { display: "flex", gap: 10, alignItems: "center", padding: "12px 16px", borderBottom: "0.5px solid rgba(0,0,0,.06)", flexWrap: "wrap" },
    inp:        { padding: "7px 12px", border: "0.5px solid rgba(0,0,0,.15)", borderRadius: 7, fontSize: 13, outline: "none", background: "#fff", color: "inherit", fontFamily: "inherit" },
    th:         { padding: "10px 14px", textAlign: "left", fontWeight: 500, fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: ".5px", borderBottom: "0.5px solid rgba(0,0,0,.06)", background: "#fafafa" },
    td:         { padding: "11px 14px", borderBottom: "0.5px solid rgba(0,0,0,.05)", color: "#222", verticalAlign: "middle" },
    btnPrimary: { padding: "8px 18px", background: "var(--eco-primary, #1a3a5c)", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" },
    btnSm:      { padding: "4px 12px", border: "0.5px solid rgba(0,0,0,.15)", borderRadius: 6, fontSize: 12, cursor: "pointer", background: "#fff", fontFamily: "inherit" },
    btnFact:    { padding: "4px 10px", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: "pointer", background: "#EAF3DE", color: "#3B6D11", fontFamily: "inherit" },
    btnFactDis: { padding: "4px 10px", border: "0.5px solid #ddd", borderRadius: 6, fontSize: 11, cursor: "not-allowed", background: "#f5f5f5", color: "#bbb", fontFamily: "inherit" },
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <p style={{ fontSize: 20, fontWeight: 500, color: "var(--eco-primary, #1a3a5c)", margin: 0 }}>Cotizaciones</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {puedeVerTodas && (
            <select value={verSoloMias ? "mias" : "todas"} onChange={e => setVerSoloMias(e.target.value === "mias")} style={{ ...s.inp, fontSize: 12 }}>
              <option value="todas">Todas</option>
              <option value="mias">Mis cotizaciones</option>
            </select>
          )}
          {puedeCrearCot && (
            <button style={s.btnPrimary} onClick={nuevaCotizacion} disabled={creando}>
              {creando ? "Creando..." : "+ Nueva cotización"}
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div style={s.card}>
        <div style={s.toolbar}>
          <input
            style={{ ...s.inp, width: 220 }}
            placeholder="Buscar por cliente o número..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ESTADOS.map(e => (
              <button key={e} onClick={() => setFiltroEstado(e)} style={{
                ...s.btnSm,
                background:  filtroEstado === e ? "var(--eco-primary, #1a3a5c)" : "#fff",
                color:       filtroEstado === e ? "#fff" : "#555",
                borderColor: filtroEstado === e ? "transparent" : "rgba(0,0,0,.15)",
              }}>{e}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#999", fontSize: 13 }}>Cargando...</div>
        ) : filtradas.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#999", fontSize: 13 }}>
            {cotizaciones.length === 0 ? "No hay cotizaciones aún. Creá la primera." : "Sin resultados para ese filtro."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={s.th}>#</th>
                <th style={s.th}>Cliente / Empresa</th>
                <th style={s.th}>Vendedor</th>
                <th style={s.th}>Moneda</th>
                {puedeVerPrecios && <th style={s.th}>Total</th>}
                <th style={s.th}>Estado</th>
                <th style={s.th}>Visto</th>
                <th style={s.th}>Vence</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(c => {
                const est           = estadoColor[c.estado] || estadoColor.Borrador;
                const total         = calcularTotal(c);
                const yaFacturada   = !!c.facturaId;
                const puedeFacturar = puedeCrearFact && c.estado === "Aceptada" && !yaFacturada &&
                  (esSuperiorOAdmin || c.vendedorId === usuario?.uid);
                const mostrarError  = errorMsg?.cotId === c.id;

                return (
                  <React.Fragment key={c.id}>
                    <tr style={{ cursor: "pointer" }}
                      onClick={() => navigate(`/ventas/cotizacion/${c.id}`)}
                      onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
                      onMouseLeave={e => e.currentTarget.style.background = ""}
                    >
                      <td style={{ ...s.td, color: "#888", fontSize: 12, fontFamily: "monospace" }}>{c.numero}</td>
                      <td style={s.td}>
                        <p style={{ fontWeight: 500, margin: 0, marginBottom: c.empresaNombre ? 2 : 0 }}>{c.clienteNombre || "—"}</p>
                        {c.facturarEmpresa && c.empresaNombre && <p style={{ fontSize: 11, color: "#888", margin: 0 }}>{c.empresaNombre}</p>}
                      </td>
                      <td style={{ ...s.td, color: "#666" }}>{c.vendedorNombre || "—"}</td>
                      <td style={s.td}>
                        <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: c.moneda === "USD" ? "#E6F1FB" : "#FAEEDA", color: c.moneda === "USD" ? "#185FA5" : "#854F0B" }}>
                          {c.moneda}
                        </span>
                      </td>
                      {puedeVerPrecios && <td style={{ ...s.td, fontWeight: 500 }}>{fmt(total, c.moneda)}</td>}
                      <td style={s.td}>
                        <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: est.bg, color: est.color }}>
                          {c.estado}
                        </span>
                      </td>
                      <td style={{ ...s.td, fontSize: 12, color: c.vistoPorCliente ? "#639922" : "#bbb" }}>
                        {c.vistoPorCliente ? tiempoRelativo(c.vistoCuando) : "Sin abrir"}
                      </td>
                      <td style={{ ...s.td, fontSize: 12, color: "#888" }}>{c.fechaVencimiento || "—"}</td>
                      <td style={s.td} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <button style={s.btnSm} onClick={() => navigate(`/ventas/cotizacion/${c.id}`)}>
                            {c.estado === "Borrador" ? "Editar" : "Ver"}
                          </button>
                          {puedeCrearFact && (
                            yaFacturada ? (
                              <button
                                style={{ ...s.btnFactDis, background: "#E6F1FB", color: "#185FA5", cursor: "pointer", border: "none" }}
                                onClick={e => { e.stopPropagation(); navigate(`/facturacion/${c.facturaId}`) }}
                                title="Ver factura generada"
                              >Ver factura</button>
                            ) : puedeFacturar ? (
                              <button
                                style={{ ...s.btnFact, opacity: creandoFact === c.id ? 0.6 : 1 }}
                                disabled={creandoFact === c.id}
                                onClick={e => crearFactura(e, c)}
                              >
                                {creandoFact === c.id ? "..." : "Facturar"}
                              </button>
                            ) : (
                              <button
                                style={s.btnFactDis}
                                onClick={e => {
                                  e.stopPropagation();
                                  setErrorMsg({ cotId: c.id, texto: c.estado !== "Aceptada"
                                    ? `Requiere estado Aceptada (actual: ${c.estado})`
                                    : "Sin permiso para facturar." })
                                }}
                              >Facturar</button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                    {mostrarError && (
                      <tr>
                        <td colSpan={puedeVerPrecios ? 9 : 8} style={{ padding: "0 14px 10px", background: "#fff" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#FCEBEB", border: "0.5px solid #F7C1C1", borderRadius: 7, fontSize: 12, color: "#A32D2D" }}>
                            <span style={{ fontWeight: 600 }}>⚠</span>
                            <span>{errorMsg.texto}</span>
                            <button onClick={() => setErrorMsg(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#A32D2D", fontSize: 14 }}>✕</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}