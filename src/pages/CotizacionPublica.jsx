/**
 * ============================================================
 * LK-CRM — Sistema de Gestión Empresarial
 * Copyright (c) 2024 LK-CRM. Todos los derechos reservados.
 *
 * Archivo: CotizacionPublica.jsx
 * Módulo:  Pages
 * ============================================================
 */

import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, updateDoc, deleteField, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";

import { fmt as fmtMoneda, simbolo } from '../lib/formatMoneda'
const fmtN = (n, mon) => fmtMoneda(n, mon).replace(/^[$₡]/, '');
const sym = (mon) => simbolo(mon);

const calcLinea = (p) => {
  const precio = Number(p.precio || 0);
  const cant = Number(p.cantidad || 1);
  const descPct = p.descTipo === "%" ? Number(p.desc || 0) : 0;
  const descMonto = p.descTipo === "$" ? Number(p.desc || 0) : 0;
  const base = precio * cant;
  const descTotal = descPct > 0 ? base * (descPct / 100) : descMonto * cant;
  const neto = base - descTotal;
  return { neto, total: neto * 1.13 };
};

const calcTotalesOp = (op, cot, opts) => {
  if (!op) return { subtotal: 0, iva: 0, total: 0, descG: 0, base: 0 };
  const mon = cot.moneda || "USD";
  const tasa = Number(cot.tasa || 519.5);
  let subtotal = (op.productos || []).reduce((a, p) => {
    const precio = mon === "CRC" ? Number(p.precio || 0) * tasa : Number(p.precio || 0);
    return a + calcLinea({ ...p, precio }).neto;
  }, 0);
  (op.productosOpcionales || []).forEach(p => {
    const key = p._lid || p.nombre;
    if (opts?.[key]) {
      const precio = mon === "CRC" ? Number(p.precio || 0) * tasa : Number(p.precio || 0);
      subtotal += precio;
    }
  });
  const descG = cot.descuentoGlobalTipo === "%" ? subtotal * (Number(cot.descuentoGlobal || 0) / 100) : Number(cot.descuentoGlobal || 0);
  const base = subtotal - descG;
  const iva = base * 0.13;
  return { subtotal, descG, base, iva, total: base + iva };
};

const printStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: #f0f2f5; }
  .no-print { }
  .solo-print { display: none !important; }
  .print-footer { display: none; }
  .print-header { display: none; }
  .pagina-terminos { display: none; }
  @media print {
    @page { size: letter; margin: 0 0 85px 0; }
    body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    .no-print { display: none !important; }
    .solo-print { display: block !important; }
    .cot-print-wrapper { padding: 0 !important; margin: 0 !important; background: white !important; }
    .pagina-cot { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; transform: scale(1.371); transform-origin: top left; page-break-after: always; overflow: hidden; }
    .print-header { display: none !important; }
    .print-footer { display: none !important; }
    .contenido-opcion { overflow: hidden !important; }
    .pagina-terminos { display: flex !important; flex-direction: column !important; page-break-before: always; box-shadow: none !important; margin: 0 !important; transform: scale(1.371); transform-origin: top left; }
    .portada-page { page-break-after: always; }
    .panel-lateral-pub { display: none !important; }
  }
`;

// ── Renderizador de widget individual ────────────────────────────────────────
function WidgetRenderer({ w, empresa, cot, op, opcionales, setOpcionales, esPdf, totales, cambiarOpcionFn, zIdx=1, pagina, totalPaginas }) {
  const mon = cot?.moneda || "USD";
  const tasa = Number(cot?.tasa || 519.5);

  const txtStyle = {
    color: w.color, fontSize: w.fontSize, fontWeight: w.fontWeight,
    lineHeight: 1.45, whiteSpace: 'pre-wrap', padding: '4px 8px', width: '100%',
  };

  if (w.type === 'separador') return (
    <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, background: w.color, opacity: w.opacity, zIndex: zIdx }} />
  );

  if (w.type === 'fondo') return (
    <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, background: w.bg || w.color, opacity: w.opacity, borderRadius: w.borderRadius, zIndex: zIdx }} />
  );

  if (w.type === 'imagen') {
    if (!w.imageUrl) return null;
    return (
      <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, opacity: w.opacity, borderRadius: w.borderRadius, overflow: 'hidden', border: w.borderWidth ? `${w.borderWidth}px solid ${w.borderColor}` : 'none', zIndex: zIdx }}>
        <img src={w.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: w.objectFit || 'cover', objectPosition: `${w.imgPosX ?? 50}% ${w.imgPosY ?? 50}%`, display: 'block' }} />
      </div>
    );
  }

  if (w.type === 'logo_principal') return (
    <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, opacity: w.opacity, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', zIndex: zIdx }}>
      {empresa?.logoPrincipal
        ? <img src={empresa.logoPrincipal} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        : <div style={{ fontSize: w.fontSize, fontWeight: 700, color: w.color }}>{empresa?.razonSocial || 'Logo'}</div>
      }
    </div>
  );

  if (w.type === 'logo_secundario') return (
    <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, opacity: w.opacity, display: 'flex', alignItems: 'center', zIndex: zIdx }}>
      {empresa?.logoSecundario
        ? <img src={empresa.logoSecundario} alt="Logo2" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        : <div style={{ fontSize: w.fontSize, color: w.color }}>{empresa?.nombreComercial || ''}</div>
      }
    </div>
  );

  if (w.type === 'isotipo') return (
    <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, opacity: w.opacity, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: zIdx }}>
      {empresa?.isotipo && <img src={empresa.isotipo} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
    </div>
  );

  if (w.type === 'nombre_empresa') return (
    <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, opacity: w.opacity, background: w.bg, borderRadius: w.borderRadius, border: w.borderWidth ? `${w.borderWidth}px solid ${w.borderColor}` : 'none', display: 'flex', alignItems: 'center', overflow: 'hidden', zIndex: zIdx }}>
      <div style={{ ...txtStyle }}>{w.text?.trim() ? w.text : (empresa?.razonSocial || empresa?.nombreComercial || '')}</div>
    </div>
  );

  if (w.type === 'datos_empresa') {
    const texto = w.text?.trim() ? w.text : [
      empresa?.razonSocial || empresa?.nombreComercial,
      empresa?.cedulaJuridica ? `Cédula: ${empresa.cedulaJuridica}` : null,
      empresa?.telefono ? `Tel: ${empresa.telefono}` : null,
      empresa?.email,
    ].filter(Boolean).join('\n');
    return (
      <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, opacity: w.opacity, background: w.bg, borderRadius: w.borderRadius, border: w.borderWidth ? `${w.borderWidth}px solid ${w.borderColor}` : 'none', display: 'flex', alignItems: 'center', overflow: 'hidden', zIndex: zIdx }}>
        <div style={{ ...txtStyle }}>{texto}</div>
      </div>
    );
  }

  if (w.type === 'numero_cot') return (
    <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, opacity: w.opacity, background: w.bg, borderRadius: w.borderRadius, border: w.borderWidth ? `${w.borderWidth}px solid ${w.borderColor}` : 'none', display: 'flex', alignItems: 'center', overflow: 'hidden', zIndex: zIdx }}>
      <div style={{ ...txtStyle }}>{cot?.numero || w.text}</div>
    </div>
  );

  if (w.type === 'fechas') {
    return (
      <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, opacity: w.opacity, background: w.bg, borderRadius: w.borderRadius, border: w.borderWidth ? `${w.borderWidth}px solid ${w.borderColor}` : 'none', display: 'flex', alignItems: 'flex-start', overflow: 'hidden', zIndex: zIdx }}>
        <div style={{ ...txtStyle, textAlign: 'center', width: '100%' }}>
          {`Fecha: ${cot?.fechaEmision || (cot?.creadoEn?.toDate ? cot.creadoEn.toDate().toISOString().split('T')[0] : '') || '—'}\nVence: ${cot?.fechaVencimiento || '—'}\nVendedor: ${(cot?.vendedorNombre || '—').split(' ')[0]}`}
        </div>
      </div>
    );
  }

  if (w.type === 'info_cotizacion') {
    const nombre = cot?.clienteNombre || '—';
    const empresa = cot?.empresaNombre || '';
    const sede = cot?.sedeNombre || cot?.ubicacion || '';
    const contacto = cot?.clienteTelefono || cot?.clienteWhatsapp || cot?.clienteEmail || cot?.contactoEmail || '';
    const linea2 = empresa ? `Empresa: ${empresa}` : contacto ? `Contacto: ${contacto}` : `Cédula: ${cot?.empresaCedula || cot?.clienteCedula || '—'}`;
    const linea3 = empresa && sede ? `Sede: ${sede}` : empresa && cot?.empresaCedula ? `Cédula: ${cot.empresaCedula}` : empresa && contacto ? `Contacto: ${contacto}` : `Ubicación: ${sede || '—'}`;
    return (
      <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, minHeight: w.h, opacity: w.opacity, background: w.bg, borderRadius: w.borderRadius, border: w.borderWidth ? `${w.borderWidth}px solid ${w.borderColor}` : 'none', display: 'flex', gap: 12, overflow: 'visible', zIndex: zIdx }}>
        <div style={{ flex: 1, fontSize: w.fontSize, color: w.color, lineHeight: 1.6, padding: '4px 8px' }}>
          <div>Nombre: {nombre}</div>
          <div>{linea2}</div>
          <div>{linea3}</div>
        </div>
        <div style={{ flex: 1, fontSize: w.fontSize, color: w.color, lineHeight: 1.6, padding: '4px 8px', textAlign: 'right' }}>
          <div>Fecha: {cot?.fechaEmision || (cot?.creadoEn?.toDate ? cot.creadoEn.toDate().toISOString().split('T')[0] : '') || '—'}</div>
          <div>Vence: {cot?.fechaVencimiento || '—'}</div>
          <div>Vendedor: {(cot?.vendedorNombre || '—').split(' ')[0]}</div>
        </div>
      </div>
    );
  }

  if (w.type === 'vendedor') return (
    <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, opacity: w.opacity, background: w.bg, borderRadius: w.borderRadius, border: w.borderWidth ? `${w.borderWidth}px solid ${w.borderColor}` : 'none', display: 'flex', alignItems: 'center', overflow: 'hidden', zIndex: zIdx }}>
      <div style={{ ...txtStyle }}>{`Vendedor: ${(cot?.vendedorNombre || '—').split(' ')[0]}`}</div>
    </div>
  );

  if (w.type === 'datos_cliente') {
    const lineas = [];
    lineas.push(`Cliente: ${cot?.clienteNombre || '—'}`);
    if (cot?.facturarEmpresa && cot?.empresaNombre) {
      lineas.push(`Empresa: ${cot.empresaNombre}`);
      if (cot?.empresaCedula) lineas.push(`Cédula jurídica: ${cot.empresaCedula}`);
    } else {
      if (cot?.empresaCedula || cot?.clienteCedula) {
        lineas.push(`Cédula: ${cot?.empresaCedula || cot?.clienteCedula || '—'}`);
      }
    }
    const texto = lineas.join('\n') || w.text;
    return (
      <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, opacity: w.opacity, background: w.bg, borderRadius: w.borderRadius, border: w.borderWidth ? `${w.borderWidth}px solid ${w.borderColor}` : 'none', display: 'flex', alignItems: 'flex-start', overflow: 'hidden', zIndex: zIdx }}>
        <div style={{ ...txtStyle }}>{texto}</div>
      </div>
    );
  }

  if (w.type === 'tabla') {
    const thSt = { padding: '6px 8px', textAlign: 'left', fontSize: w.fontSize, fontWeight: 600, color: '#fff', background: w.color };
    const tdSt = { padding: '5px 8px', fontSize: w.fontSize, borderBottom: '1px solid #f0f4f8', verticalAlign: 'top' };
    return (
      <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, minHeight: w.h, opacity: w.opacity, background: w.bg, borderRadius: w.borderRadius, border: w.borderWidth ? `${w.borderWidth}px solid ${w.borderColor}` : 'none', overflow: 'visible', zIndex: zIdx }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thSt }}>Descripción</th>
              <th style={{ ...thSt, textAlign: 'center', width: 40 }}>Cant.</th>
              <th style={{ ...thSt, textAlign: 'right', width: 90 }}>P. unit.</th>
              <th style={{ ...thSt, textAlign: 'right', width: 90 }}>Importe</th>
            </tr>
          </thead>
          <tbody>
            {(op?.productos || []).map((p, i) => {
              const precio = mon === 'CRC' ? Number(p.precio || 0) * tasa : Number(p.precio || 0);
              const calc = calcLinea({ ...p, precio });
              return (
                <tr key={p._lid || i} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff' }}>
                  <td style={tdSt}>
                    <div style={{ fontWeight: 500 }}>{p.nombre}</div>
                    {p.descripcion && <div style={{ fontSize: w.fontSize - 1, color: '#888' }}>{p.descripcion}</div>}
                  </td>
                  <td style={{ ...tdSt, textAlign: 'center' }}>{p.cantidad}</td>
                  <td style={{ ...tdSt, textAlign: 'right' }}>{sym(mon)}{fmtN(precio)}</td>
                  <td style={{ ...tdSt, textAlign: 'right', fontWeight: 500 }}>{sym(mon)}{fmtN(calc.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (w.type === 'totales') return (
    <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, opacity: w.opacity, background: w.bg, borderRadius: w.borderRadius, border: w.borderWidth ? `${w.borderWidth}px solid ${w.borderColor}` : 'none', overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px' }}>
        {[
          ['Sin impuestos', totales?.subtotal || 0],
          totales?.descG > 0 && ['Descuento', -(totales?.descG || 0)],
          ['IVA 13%', totales?.iva || 0],
        ].filter(Boolean).map(([lbl, val]) => (
          <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: w.fontSize - 1, color: '#666' }}>
            <span>{lbl}</span>
            <span style={{ color: val < 0 ? '#E24B4A' : 'inherit' }}>{val < 0 ? `- ${sym(mon)}${fmtN(-val)}` : `${sym(mon)}${fmtN(val)}`}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${w.color}`, paddingTop: 6, fontSize: w.fontSize, fontWeight: 600, color: w.color }}>
          <span>Total</span>
          <span>{sym(mon)}{fmtN(totales?.total || 0)}</span>
        </div>
        <div style={{ marginTop: 6, fontSize: w.fontSize - 2, color: '#888' }}>
          Equiv. {mon === 'USD' ? `₡${Math.round((totales?.total || 0) * tasa).toLocaleString('es-CR')}` : `$${fmtN((totales?.total || 0) / tasa)}`}
        </div>
      </div>
    </div>
  );

  if (w.type === 'observaciones') {
    const texto = cot?.observaciones || w.text;
    if (!texto) return null;
    return (
      <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, opacity: w.opacity, background: w.bg, borderRadius: w.borderRadius, border: w.borderWidth ? `${w.borderWidth}px solid ${w.borderColor}` : 'none', overflow: 'hidden', display: 'flex', alignItems: 'flex-start', zIndex: zIdx }}>
        <div style={{ ...txtStyle }}>{texto}</div>
      </div>
    );
  }

  if (w.type === 'terminos') {
    const texto = (cot?.terminos && cot.terminos.trim()) ? cot.terminos : (cot?.textoTerminos && cot.textoTerminos.trim()) ? cot.textoTerminos : w.text;
    if (!texto) return null;
    return (
      <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, minHeight: w.h, opacity: w.opacity, background: w.bg, borderRadius: w.borderRadius, border: w.borderWidth ? `${w.borderWidth}px solid ${w.borderColor}` : 'none', overflow: 'visible', display: 'flex', alignItems: 'flex-start', zIndex: zIdx }}>
        <div style={{ ...txtStyle }}>{texto}</div>
      </div>
    );
  }

  if (w.type === 'opcionales') {
    const tieneOpcionales = (op?.productosOpcionales || []).length > 0;
    if (!tieneOpcionales) return null;
    return (
      <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, opacity: w.opacity, background: '#FFF9F0', border: '1px solid #F5D9A0', borderRadius: w.borderRadius || 8, padding: '12px 14px', overflow: 'hidden' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#854F0B', textTransform: 'uppercase', marginBottom: 8 }}>Productos opcionales</div>
        {(op.productosOpcionales || []).map((p, i) => {
          const key = p._lid || p.nombre;
          const precio = mon === 'CRC' ? Number(p.precio || 0) * tasa : Number(p.precio || 0);
          const activo = opcionales?.[key];
          return (
            <div key={i} onClick={() => !esPdf && setOpcionales(prev => ({ ...prev, [key]: !prev[key] }))}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', marginBottom: 4, background: activo ? '#FEF3E2' : '#fff', border: `1px solid ${activo ? '#F5D9A0' : '#eee'}`, borderRadius: 5, cursor: esPdf ? 'default' : 'pointer' }}>
              <span style={{ fontSize: 11, fontWeight: 500 }}>{p.nombre}</span>
              <span style={{ fontSize: 11, color: '#854F0B', fontWeight: 500 }}>+ {sym(mon)}{fmtN(precio)}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (w.type === 'opciones_tabs') {
    const opciones = cot?.opciones || [];
    if (opciones.length <= 1) return null;
    return (
      <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, opacity: w.opacity, zIndex: 30, display: 'flex', alignItems: 'center', gap: w.gap ?? 8, padding: '4px 6px', flexWrap: 'wrap' }}>
        {opciones.map(o => {
          const activa = op?.id === o.id;
          return (
            <button key={o.id}
              onClick={() => !esPdf && cambiarOpcionFn && cambiarOpcionFn(o.id)}
              style={{
                padding: `6px 18px`,
                fontSize: w.fontSize,
                fontWeight: activa ? w.fontWeight : '400',
                borderRadius: w.borderRadius,
                background: activa ? w.bg : 'transparent',
                color: activa ? w.color : w.bg,
                border: `1.5px solid ${w.bg}`,
                cursor: esPdf ? 'default' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                transition: 'all .15s',
                whiteSpace: 'nowrap',
                pointerEvents: esPdf ? 'none' : 'auto',
              }}>{o.nombre}</button>
          );
        })}
      </div>
    );
  }

  // Widget: Paginación
  if (w.type === 'paginacion') {
    const pag = pagina || 1;
    const tot = totalPaginas || 1;
    const texto = (w.text || 'Página {{pagina}} de {{totalPaginas}}')
      .replace(/\{\{pagina\}\}/gi, pag)
      .replace(/\{\{totalPaginas\}\}/gi, tot);
    return (
      <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, opacity: w.opacity, display: 'flex', alignItems: 'center', zIndex: zIdx }}>
        <div style={{ ...txtStyle }}>{texto}</div>
      </div>
    );
  }

  // Widget: Teléfono empresa
  if (w.type === 'telefono_empresa') return (
    <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, opacity: w.opacity, display: 'flex', alignItems: 'center', zIndex: zIdx }}>
      <div style={{ ...txtStyle }}>{(empresa?.telefono && empresa.telefono.trim()) || w.text || ''}</div>
    </div>
  );

  // Widget: Email empresa
  if (w.type === 'email_empresa') return (
    <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, opacity: w.opacity, display: 'flex', alignItems: 'center', zIndex: zIdx }}>
      <div style={{ ...txtStyle }}>{(empresa?.email && empresa.email.trim()) || (empresa?.correo && empresa.correo.trim()) || w.text || ''}</div>
    </div>
  );

  // Widget: Sitio web empresa
  if (w.type === 'web_empresa') return (
    <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, opacity: w.opacity, display: 'flex', alignItems: 'center', zIndex: zIdx }}>
      <div style={{ ...txtStyle }}>{(empresa?.sitioWeb && empresa.sitioWeb.trim()) || (empresa?.web && empresa.web.trim()) || w.text || ''}</div>
    </div>
  );

  // Reemplazar variables de paginación en texto libre
  let textoFinal = w.text || '';
  if (pagina && totalPaginas) {
    textoFinal = textoFinal
      .replace(/\{\{pagina\}\}/gi, pagina)
      .replace(/\{\{totalPaginas\}\}/gi, totalPaginas)
      .replace(/Página\s+\d+\s+de\s+\d+/gi, `Página ${pagina} de ${totalPaginas}`)
      .replace(/Pág\.?\s*\d+\s*\/\s*\d+/gi, `Pág. ${pagina} / ${totalPaginas}`)
      .replace(/Page\s+\d+\s+of\s+\d+/gi, `Page ${pagina} of ${totalPaginas}`)
  }

  return (
    <div style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, opacity: w.opacity, background: w.bg, borderRadius: w.borderRadius, border: w.borderWidth ? `${w.borderWidth}px solid ${w.borderColor}` : 'none', display: 'flex', alignItems: 'center', overflow: 'hidden', zIndex: zIdx }}>
      <div style={{ ...txtStyle }}>{textoFinal}</div>
    </div>
  );
}

const HOJA_W = 595;

function SeccionAbsoluta({ widgets, height, empresa, cot, op, opcionales, setOpcionales, esPdf, totales, cambiarOpcionFn, pagina, totalPaginas }) {
  const sorted = [...widgets].sort((a, b) => {
    const ord = { fondo:0, separador:1, imagen:2 };
    return (ord[a.type]??10)-(ord[b.type]??10)||widgets.indexOf(a)-widgets.indexOf(b);
  });
  return (
    <div style={{ position:'relative', width:HOJA_W, height, overflow:'visible', background:'#fff', flexShrink:0 }}>
      {sorted.map((w,i) => {
        const zFijo = ({fondo:1,separador:2,imagen:3})[w.type] ?? (20+i);
        return <WidgetRenderer key={w.id||i} w={w} empresa={empresa} cot={cot} op={op}
          opcionales={opcionales} setOpcionales={setOpcionales} esPdf={esPdf} totales={totales}
          cambiarOpcionFn={cambiarOpcionFn} zIdx={zFijo} pagina={pagina} totalPaginas={totalPaginas} />;
      })}
    </div>
  );
}

function SeccionContenido({ widgets, empresa, cot, op, opcionales, setOpcionales, esPdf, totales, cambiarOpcionFn }) {
  const mon = cot?.moneda || 'USD';
  const tasa = Number(cot?.tasa || 519.5);
  const fmtV = n => Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const symV = m => m==='USD'?'$':'₡';
  const obsW = widgets.find(w=>w.type==='observaciones');
  const totW = widgets.find(w=>w.type==='totales');

  return (
    <div style={{ width:HOJA_W, background:'#fff', padding:'12px 24px', boxSizing:'border-box', flex:1, display:'flex', flexDirection:'column' }}>
      {widgets.map((w,i) => {
        if (w.type==='opciones_tabs') {
          const opc = cot?.opciones||[];
          if (opc.length<=1) return null;
          const jc = (w.align||'left')==='center'?'center':(w.align||'left')==='right'?'flex-end':'flex-start';
          return (
            <div key={w.id||i} style={{display:'flex',justifyContent:jc,marginTop:w.marginTop??0,marginBottom:w.marginBottom??8,minHeight:w.h||'auto'}}>
            <div style={{display:'flex',gap:w.gap??6}}>
              {opc.map(o=>{
                const activa = op?.id===o.id;
                return <button key={o.id} onClick={()=>!esPdf&&cambiarOpcionFn&&cambiarOpcionFn(o.id)}
                  style={{padding:'6px 18px',fontSize:w.fontSize,fontWeight:activa?w.fontWeight:'400',borderRadius:w.borderRadius,background:activa?w.bg:'transparent',color:activa?w.color:w.bg,border:`1.5px solid ${w.bg}`,cursor:esPdf?'default':'pointer',fontFamily:'Inter,sans-serif',transition:'all .15s'}}>
                  {o.nombre}</button>;
              })}
            </div></div>
          );
        }

        if (w.type==='tabla') {
          const thSt = {padding:'6px 8px',textAlign:'left',fontSize:w.fontSize,fontWeight:600,color:'#fff',background:w.color};
          const tdSt = {padding:'5px 8px',fontSize:w.fontSize,borderBottom:'1px solid #f0f4f8',verticalAlign:'top'};
          const jcT = (w.align||'left')==='center'?'center':(w.align||'left')==='right'?'flex-end':'flex-start';
          return (
            <div key={w.id||i} style={{display:'flex',justifyContent:jcT,marginTop:w.marginTop??0,marginBottom:w.marginBottom??8,minHeight:w.h||'auto'}}>
            <div style={{width:w.w||'100%',background:w.bg,borderRadius:w.borderRadius,border:w.borderWidth?`${w.borderWidth}px solid ${w.borderColor}`:'none',overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>
                  <th style={thSt}>Descripción</th>
                  <th style={{...thSt,textAlign:'center',width:50}}>Cant.</th>
                  <th style={{...thSt,textAlign:'right',width:90}}>P. unit.</th>
                  <th style={{...thSt,textAlign:'right',width:90}}>Importe</th>
                </tr></thead>
                <tbody>
                  {(op?.productos||[]).map((p,pi)=>{
                    const precio=mon==='CRC'?Number(p.precio||0)*tasa:Number(p.precio||0);
                    const cant=Number(p.cantidad||1);
                    const descPct=p.descTipo==='%'?Number(p.desc||0):0;
                    const neto=precio*cant*(1-descPct/100);
                    const total=neto*1.13;
                    return (
                      <tr key={p._lid||pi} style={{background:pi%2===0?'#f8fafc':'#fff'}}>
                        <td style={tdSt}><div style={{fontWeight:500}}>{p.nombre}</div>{p.descripcion&&<div style={{fontSize:w.fontSize-1,color:'#888'}}>{p.descripcion}</div>}</td>
                        <td style={{...tdSt,textAlign:'center'}}>{p.cantidad}</td>
                        <td style={{...tdSt,textAlign:'right'}}>{symV(mon)}{fmtV(precio)}</td>
                        <td style={{...tdSt,textAlign:'right',fontWeight:500}}>{symV(mon)}{fmtV(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div></div>
          );
        }

        if (w.type==='observaciones') {
          return (
            <div key={w.id||i} style={{display:'flex',gap:12,marginTop:obsW?.marginTop??0,marginBottom:obsW?.marginBottom??8,alignItems:'flex-start'}}>
              <div style={{flex:1,minHeight:obsW?.h||80,padding:'6px 8px',background:obsW?.bg||'transparent',borderRadius:obsW?.borderRadius||4,border:obsW?.borderWidth?`${obsW.borderWidth}px solid ${obsW.borderColor}`:'none',fontSize:obsW?.fontSize||11,color:obsW?.color||'#555',whiteSpace:'pre-wrap',lineHeight:1.5}}>
                {cot?.observaciones||(obsW?.text||'')}
              </div>
              {totW&&(
                <div style={{width:totW?.w||220,flexShrink:0,background:totW?.bg||'#f0f4f8',borderRadius:totW?.borderRadius||6,border:totW?.borderWidth?`${totW.borderWidth}px solid ${totW.borderColor}`:'none',padding:'8px 12px'}}>
                  {[['Sin impuestos',totales?.subtotal||0],totales?.descG>0&&['Descuento',-(totales?.descG||0)],['IVA 13%',totales?.iva||0]].filter(Boolean).map(([lbl,val])=>(
                    <div key={lbl} style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:(totW?.fontSize||13)-1,color:'#666'}}>
                      <span>{lbl}</span><span style={{color:val<0?'#E24B4A':'inherit'}}>{val<0?`- ${symV(mon)}${fmtV(-val)}`:`${symV(mon)}${fmtV(val)}`}</span>
                    </div>
                  ))}
                  <div style={{display:'flex',justifyContent:'space-between',borderTop:`2px solid ${totW?.color||'#185FA5'}`,paddingTop:6,fontSize:totW?.fontSize||13,fontWeight:600,color:totW?.color||'#185FA5'}}>
                    <span>Total</span><span>{symV(mon)}{fmtV(totales?.total||0)}</span>
                  </div>
                  <div style={{marginTop:4,fontSize:(totW?.fontSize||13)-3,color:'#888',textAlign:'right'}}>
                    {mon==='USD'
                      ? `Equiv. ₡${Math.round((totales?.total||0)*tasa).toLocaleString('es-CR')} CRC`
                      : `Equiv. $${fmtV((totales?.total||0)/tasa)} USD`}
                  </div>
                </div>
              )}
            </div>
          );
        }
        if (w.type==='totales') return null;

        if (w.type==='terminos') {
          const texto = (cot?.terminos && cot.terminos.trim()) ? cot.terminos : (cot?.textoTerminos && cot.textoTerminos.trim()) ? cot.textoTerminos : (w.text||'');
          if (!texto) return null;
          return (
            <div key={w.id||i} style={{marginTop:w.marginTop??30,marginBottom:w.marginBottom??8,padding:'6px 8px',background:w.bg||'transparent',borderRadius:w.borderRadius,border:w.borderWidth?`${w.borderWidth}px solid ${w.borderColor}`:'none',fontSize:w.fontSize,color:w.color,whiteSpace:'pre-wrap',lineHeight:1.6}}>
              {texto}
            </div>
          );
        }

        // Widgets de datos (numero, fechas, cliente, vendedor, separador, texto libre) renderizados como flujo
        if (w.type === 'numero_cot') return (
          <div key={w.id||i} style={{marginTop:w.marginTop??0,marginBottom:w.marginBottom??8,padding:'4px 8px',fontSize:w.fontSize||15,fontWeight:w.fontWeight||'500',color:w.color||'#185FA5',background:w.bg||'transparent',borderRadius:w.borderRadius,border:w.borderWidth?`${w.borderWidth}px solid ${w.borderColor}`:'none'}}>
            {cot?.numero || w.text}
          </div>
        );

        if (w.type === 'fechas') return (
          <div key={w.id||i} style={{marginTop:w.marginTop??0,marginBottom:w.marginBottom??8,padding:'4px 8px',fontSize:w.fontSize||11,color:w.color||'#555',background:w.bg||'transparent',borderRadius:w.borderRadius,border:w.borderWidth?`${w.borderWidth}px solid ${w.borderColor}`:'none',whiteSpace:'pre-wrap',lineHeight:1.6}}>
            {`Fecha: ${cot?.fechaEmision || (cot?.creadoEn?.toDate ? cot.creadoEn.toDate().toISOString().split('T')[0] : '') || '—'}  ·  Vence: ${cot?.fechaVencimiento || '—'}  ·  Vendedor: ${(cot?.vendedorNombre || '—').split(' ')[0]}`}
          </div>
        );

        if (w.type === 'datos_cliente') {
          const lineas = [];
          lineas.push(`Cliente: ${cot?.clienteNombre || '—'}`);
          if (cot?.facturarEmpresa && cot?.empresaNombre) {
            lineas.push(`Empresa: ${cot.empresaNombre}`);
            if (cot?.empresaCedula) lineas.push(`Cédula jurídica: ${cot.empresaCedula}`);
          } else if (cot?.empresaCedula || cot?.clienteCedula) {
            lineas.push(`Cédula: ${cot?.empresaCedula || cot?.clienteCedula || '—'}`);
          }
          return (
            <div key={w.id||i} style={{marginTop:w.marginTop??0,marginBottom:w.marginBottom??8,padding:'6px 8px',fontSize:w.fontSize||12,color:w.color||'#333',background:w.bg||'#f8fafc',borderRadius:w.borderRadius||6,border:w.borderWidth?`${w.borderWidth}px solid ${w.borderColor}`:'1px solid #e0e8f0',whiteSpace:'pre-wrap',lineHeight:1.6}}>
              {lineas.join('\n')}
            </div>
          );
        }

        if (w.type === 'info_cotizacion') {
          const nombre2 = cot?.clienteNombre || '—';
          const empresa2 = cot?.empresaNombre || '';
          const sede2 = cot?.sedeNombre || cot?.ubicacion || '';
          const contacto2 = cot?.clienteTelefono || cot?.clienteWhatsapp || cot?.clienteEmail || cot?.contactoEmail || '';
          const lin2 = empresa2 ? `Empresa: ${empresa2}` : contacto2 ? `Contacto: ${contacto2}` : `Cédula: ${cot?.empresaCedula || cot?.clienteCedula || '—'}`;
          const lin3 = empresa2 && sede2 ? `Sede: ${sede2}` : empresa2 && cot?.empresaCedula ? `Cédula: ${cot.empresaCedula}` : empresa2 && contacto2 ? `Contacto: ${contacto2}` : `Ubicación: ${sede2 || '—'}`;
          return (
            <div key={w.id||i} style={{marginTop:w.marginTop??0,marginBottom:w.marginBottom??12,display:'flex',gap:12,padding:'8px 10px',background:w.bg||'#f8fafc',borderRadius:w.borderRadius||6,border:w.borderWidth?`${w.borderWidth}px solid ${w.borderColor}`:'1px solid #e0e8f0',fontSize:w.fontSize||11,color:w.color||'#555',lineHeight:1.6}}>
              <div style={{flex:1}}>
                <div>Nombre: {nombre2}</div>
                <div>{lin2}</div>
                <div>{lin3}</div>
              </div>
              <div style={{flex:1,textAlign:'right'}}>
                <div>Fecha: {cot?.fechaEmision || (cot?.creadoEn?.toDate ? cot.creadoEn.toDate().toISOString().split('T')[0] : '') || '—'}</div>
                <div>Vence: {cot?.fechaVencimiento || '—'}</div>
                <div>Vendedor: {(cot?.vendedorNombre || '—').split(' ')[0]}</div>
              </div>
            </div>
          );
        }

        if (w.type === 'vendedor') return (
          <div key={w.id||i} style={{marginTop:w.marginTop??0,marginBottom:w.marginBottom??8,padding:'4px 8px',fontSize:w.fontSize||11,color:w.color||'#555',background:w.bg||'transparent',borderRadius:w.borderRadius}}>
            {`Vendedor: ${(cot?.vendedorNombre || '—').split(' ')[0]}`}
          </div>
        );

        if (w.type === 'separador') return (
          <div key={w.id||i} style={{marginTop:w.marginTop??8,marginBottom:w.marginBottom??8,height:w.h||3,background:w.color||'#1a3a5c',opacity:w.opacity||1,borderRadius:w.borderRadius||0}} />
        );

        if (w.type === 'texto_libre') return (
          <div key={w.id||i} style={{marginTop:w.marginTop??0,marginBottom:w.marginBottom??8,padding:'4px 8px',fontSize:w.fontSize||14,color:w.color||'#1a1a1a',fontWeight:w.fontWeight||'400',whiteSpace:'pre-wrap',lineHeight:1.5}}>
            {w.text || ''}
          </div>
        );

        return null;
      })}
    </div>
  );
}

function PaginaWidget({ headerWidgets=[], contentWidgets=[], footerWidgets=[], headerH=110, footerH=40,
  empresa, cot, op, opcionales, setOpcionales, esPdf, totales, onCambiarOpcion, pagina, totalPaginas }) {
  const props = {empresa,cot,op,opcionales,setOpcionales,esPdf,totales,cambiarOpcionFn:onCambiarOpcion,pagina,totalPaginas};
  const innerRef = useRef(null);
  const [innerH, setInnerH] = useState(400);
  useEffect(() => {
    if (!esPdf && innerRef.current) {
      const ro = new ResizeObserver(entries => {
        for (const e of entries) setInnerH(e.contentRect.height);
      });
      ro.observe(innerRef.current);
      return () => ro.disconnect();
    }
  }, [esPdf]);

  if (esPdf) {
    // Letter = 1056px a 96dpi, escalado 1.371 = ~770px internos
    const paginaAlto = Math.round(1056 / 1.371)
    const contenidoAlto = paginaAlto - headerH - footerH
    return (
      <div className="pagina-cot" style={{background:'#fff',width:HOJA_W,height:paginaAlto,fontFamily:'Inter,sans-serif',margin:'0 auto',display:'flex',flexDirection:'column'}}>
        <SeccionAbsoluta {...props} widgets={headerWidgets} height={headerH} />
        <div className="contenido-opcion" style={{flex:1,overflow:'hidden'}}>
          <SeccionContenido {...props} widgets={contentWidgets} />
        </div>
        <SeccionAbsoluta {...props} widgets={footerWidgets} height={footerH} />
      </div>
    );
  }

  const escala = Math.min(1.33,(window.innerWidth>700?700:window.innerWidth)/HOJA_W);
  const anchoVisible = HOJA_W*escala;
  const altoVisible = innerH*escala;

  return (
    <div style={{width:anchoVisible,height:altoVisible,margin:'0 auto 32px',boxShadow:'0 4px 24px rgba(0,0,0,.1)',borderRadius:4,overflow:'hidden',position:'relative'}}>
      <div ref={innerRef} className="pagina-cot" style={{background:'#fff',width:HOJA_W,transform:`scale(${escala})`,transformOrigin:'top left',fontFamily:'Inter,sans-serif',display:'flex',flexDirection:'column',position:'absolute',top:0,left:0}}>
        <SeccionAbsoluta {...props} widgets={headerWidgets} height={headerH} />
        <SeccionContenido {...props} widgets={contentWidgets} />
        <SeccionAbsoluta {...props} widgets={footerWidgets} height={footerH} />
      </div>
    </div>
  );
}

// ── Panel lateral público ─────────────────────────────────────────────────────
function PanelLateral({ cot, totales, mon }) {
  const tieneDescuento = totales?.descG > 0;
  const fichas = (cot?.fichasTecnicas || []).filter(f => f?.url && f?.nombre);
  const terminos = cot?.terminos || cot?.textoTerminos || "";

  // Panel siempre visible

  const SeccionTitulo = ({ texto }) => (
    <div style={{
      fontSize: 10, fontWeight: 700, color: '#1a3a5c',
      textTransform: 'uppercase', letterSpacing: '.7px',
      marginBottom: 10, paddingBottom: 7,
      borderBottom: '1px solid rgba(26,58,92,.1)',
    }}>{texto}</div>
  );

  return (
    <div
      className="panel-lateral-pub"
      style={{
        width: 336,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Número cotización */}
      <div style={{
        background: '#fff',
        border: '0.5px solid rgba(0,0,0,.08)',
        borderRadius: 10,
        padding: '12px 14px',
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>Cotización</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a3a5c' }}>{cot?.numero}</div>
        {cot?.fechaVencimiento && (
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Vence: {cot.fechaVencimiento}</div>
        )}
      </div>

      {/* Descuento — solo si aplica */}
      {tieneDescuento && (
        <div style={{
          background: '#fff',
          border: '0.5px solid rgba(0,0,0,.08)',
          borderRadius: 10,
          padding: '12px 14px',
        }}>
          <SeccionTitulo texto="Descuento aplicado" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: '#EAF3DE', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B6D11" strokeWidth="2.5">
                <line x1="19" y1="5" x2="5" y2="19"/>
                <circle cx="6.5" cy="6.5" r="2.5"/>
                <circle cx="17.5" cy="17.5" r="2.5"/>
              </svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#3B6D11' }}>
              {cot?.descuentoGlobalTipo === '%'
                ? `${cot?.descuentoGlobal}% de descuento`
                : `${sym(mon)}${fmtN(cot?.descuentoGlobal)} de descuento`
              }
            </div>
          </div>
          <div style={{
            background: '#EAF3DE', borderRadius: 7, padding: '7px 10px',
            fontSize: 12, color: '#3B6D11', fontWeight: 500,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>Ahorrás</span>
            <span style={{ fontWeight: 700 }}>{sym(mon)}{fmtN(totales.descG)}</span>
          </div>
        </div>
      )}

      {/* Documentos / Fichas técnicas */}
      {fichas.length > 0 && (
        <div style={{
          background: '#fff',
          border: '0.5px solid rgba(0,0,0,.08)',
          borderRadius: 10,
          padding: '12px 14px',
        }}>
          <SeccionTitulo texto="Documentos" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fichas.map((f, i) => (
              <a
                key={i}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  border: '0.5px solid rgba(0,0,0,.1)',
                  borderRadius: 8,
                  background: '#fafafa',
                  textDecoration: 'none',
                  transition: 'all .15s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#f0f4f8';
                  e.currentTarget.style.borderColor = 'rgba(26,58,92,.3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#fafafa';
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,.1)';
                }}
              >
                {/* Ícono PDF rojo */}
                <div style={{
                  width: 32, height: 32, borderRadius: 6,
                  background: '#FCEBEB', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A32D2D" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 500, color: '#1a1a1a',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{f.nombre}</div>
                  <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>Ver / Descargar</div>
                </div>
                {/* Flecha descarga */}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Términos y condiciones */}
      {terminos && (
        <div style={{
          background: '#fff',
          border: '0.5px solid rgba(0,0,0,.08)',
          borderRadius: 10,
          padding: '12px 14px',
        }}>
          <SeccionTitulo texto="Términos y condiciones" />
          <div style={{ fontSize: 11, color: '#555', lineHeight: 1.75 }}>
            {terminos.split('\n').filter(l => l.trim()).map((linea, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
                <span style={{ color: '#1a3a5c', flexShrink: 0, fontWeight: 700, fontSize: 13, lineHeight: 1.4 }}>·</span>
                <span>{linea.replace(/^[·\-\*\•]\s*/, '')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CotizacionPublica() {
  const { id } = useParams();
  const [cot, setCot] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [widgets, setWidgets] = useState([]);
  const [headerWidgets, setHeaderWidgets] = useState([]);
  const [contentWidgets, setContentWidgets] = useState([]);
  const [footerWidgets, setFooterWidgets] = useState([]);
  const [headerH, setHeaderH] = useState(110);
  const [footerH, setFooterH] = useState(40);
  const [plantilla, setPlantilla] = useState(null);
  const [terminosCotizacion, setTerminosCotizacion] = useState("");
  const [loading, setLoading] = useState(true);
  const [opActiva, setOpActiva] = useState(null);
  const [opcionales, setOpcionales] = useState({});
  const [aceptando, setAceptando] = useState(false);
  const [pasosActivos, setPasosActivos] = useState([]);
  const [paso, setPaso] = useState(0);
  const [opElegida, setOpElegida] = useState(null);
  const [opcionalesConfirmados, setOpcionalesConfirmados] = useState({});
  const [firma, setFirma] = useState({ nombre: "", cedula: "" });
  const [enviandoFirma, setEnviandoFirma] = useState(false);
  const [aceptado, setAceptado] = useState(false);
  const canvasRef = useRef(null);
  const [dibujando, setDibujando] = useState(false);
  const [hayFirma, setHayFirma] = useState(false);
  const [hojaLista, setHojaLista] = useState(false);

  useEffect(() => { cargar(); }, [id]);

  const cargar = async () => {
    try {
      const [cotSnap, empSnap, pltSnap] = await Promise.all([
        getDoc(doc(db, "cotizaciones", id)),
        getDoc(doc(db, "configuracion", "empresa")),
        getDoc(doc(db, "configuracion", "plantilla_cotizacion")),
      ]);
      if (!cotSnap.exists()) { setLoading(false); return; }
      const data = { id: cotSnap.id, ...cotSnap.data() };
      setCot(data);
      if (empSnap.exists()) setEmpresa(empSnap.data());

      if (pltSnap.exists()) {
        const pd = pltSnap.data();
        setPlantilla(pd);
        const plantillaId = data.plantillaId || pd.plantillaBase || 'eco';
        let cfg = pd.plantillasConfig?.[plantillaId];
        if (!cfg) cfg = (pd.plantillasPersonalizadas || []).find(p => p.id === plantillaId);

        if (cfg) {
          if (cfg.headerWidgets) {
            setHeaderWidgets(cfg.headerWidgets || []);
            setContentWidgets(cfg.contentWidgets || []);
            // Filtrar widgets del footer viejo (tienen texto estático de paginación)
            const fw = (cfg.footerWidgets || []).filter(w => {
              const txt = (w.text || '').toLowerCase();
              if (txt.includes('página 1 de 1') || txt.includes('page 1 of 1') || txt.includes('pág. 1')) return false;
              return true;
            });
            setFooterWidgets(fw);
            setHeaderH(cfg.headerH || 110);
            setFooterH(cfg.footerH || 40);
          } else if (cfg.widgets) {
            const CONTENT_TYPES = ['opciones_tabs','tabla','observaciones','totales','terminos'];
            setHeaderWidgets(cfg.widgets.filter(w => !CONTENT_TYPES.includes(w.type) && (w.y||0) < 200));
            setContentWidgets(cfg.widgets.filter(w => CONTENT_TYPES.includes(w.type)));
            setFooterWidgets(cfg.widgets.filter(w => !CONTENT_TYPES.includes(w.type) && (w.y||0) >= 550));
            setFooterH(40);
          }
        }
      }

      const op = data.opciones?.find(o => o.id === data.opcionActiva) || data.opciones?.[0];
      setOpActiva(op?.id || null);
      setOpElegida(op?.id || null);
      const initOpts = {};
      (op?.productosOpcionales || []).forEach(p => { initOpts[p._lid || p.nombre] = !!p.activo; });
      setOpcionales(initOpts);
      setOpcionalesConfirmados({ ...initOpts });

      if (!data.vistoPorCliente) {
        await updateDoc(doc(db, "cotizaciones", id), {
          vistoPorCliente: true, vistoCuando: serverTimestamp(),
          estado: data.estado === "Enviada" ? "Vista" : data.estado,
        });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const cambiarOpcion = (opId) => {
    setHojaLista(false);
    setOpActiva(opId);
    const op = cot.opciones.find(o => o.id === opId);
    const initOpts = {};
    (op?.productosOpcionales || []).forEach(p => { initOpts[p._lid || p.nombre] = !!p.activo; });
    setOpcionales(initOpts);
    setTimeout(() => setHojaLista(true), 100);
  };

  useEffect(() => {
    if ((headerWidgets.length > 0 || contentWidgets.length > 0) && cot && empresa && !loading) {
      setHojaLista(false);
      setTimeout(() => setHojaLista(true), 600);
    }
  }, [headerWidgets, contentWidgets, loading]);

  const iniciarAceptacion = () => {
    const opActual = cot.opciones.find(o => o.id === opActiva) || cot.opciones[0];
    const pasos = [];
    if (cot.opciones.length > 1) pasos.push("opcion");
    if ((opActual?.productosOpcionales || []).length > 0) pasos.push("opcionales");
    pasos.push("firma");
    setPasosActivos(pasos); setPaso(0); setOpElegida(opActiva);
    setOpcionalesConfirmados({ ...opcionales }); setAceptando(true);
  };

  const siguientePaso = () => { if (paso < pasosActivos.length - 1) setPaso(p => p + 1); };
  const anteriorPaso = () => { if (paso > 0) setPaso(p => p - 1); };

  const startDraw = (e) => {
    setDibujando(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
    ctx.beginPath();
    ctx.moveTo(((e.touches ? e.touches[0].clientX : e.clientX) - rect.left) * scaleX, ((e.touches ? e.touches[0].clientY : e.clientY) - rect.top) * scaleY);
  };
  const draw = (e) => {
    if (!dibujando) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
    ctx.lineTo(((e.touches ? e.touches[0].clientX : e.clientX) - rect.left) * scaleX, ((e.touches ? e.touches[0].clientY : e.clientY) - rect.top) * scaleY);
    ctx.strokeStyle = "#1a3a5c"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.stroke();
    setHayFirma(true);
  };
  const endDraw = () => setDibujando(false);
  const limpiarCanvas = () => { canvasRef.current.getContext("2d").clearRect(0, 0, 680, 120); setHayFirma(false); };

  const confirmarAceptacion = async () => {
    if (!firma.nombre || !firma.cedula || !hayFirma) return;
    setEnviandoFirma(true);
    try {
      await updateDoc(doc(db, "cotizaciones", id), {
        estado: "Aceptada", aceptada: true, opcionElegida: opElegida,
        opcionalesElegidos: opcionalesConfirmados,
        firmaNombre: firma.nombre, firmaCedula: firma.cedula,
        firmaImg: canvasRef.current.toDataURL("image/png"),
        aceptadaEn: serverTimestamp(),
      });
      setAceptado(true); setAceptando(false);
    } catch (e) { console.error(e); }
    finally { setEnviandoFirma(false); }
  };

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, system-ui", color: "#888" }}>Cargando...</div>;
  if (!cot) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, system-ui", color: "#c00" }}>Cotización no encontrada.</div>;

  const op = cot.opciones?.find(o => o.id === opActiva) || cot.opciones?.[0];
  const mon = cot.moneda || "USD";
  const tasa = Number(cot.tasa || 519.5);
  const totales = calcTotalesOp(op, cot, opcionales);
  const pasoActual = pasosActivos[paso];
  const opParaPaso = cot.opciones?.find(o => o.id === opElegida) || cot.opciones?.[0];
  const totPaso = calcTotalesOp(opParaPaso, cot, opcionalesConfirmados);
  const portadaActiva = cot.portadaId ? (plantilla?.portadas || []).find(p => p.id === cot.portadaId) : null;

  // Determinar si hay contenido para el panel lateral
  const tieneDescuento = totales?.descG > 0;
  const fichas = (cot?.fichasTecnicas || []).filter(f => f?.url && f?.nombre);
  // Leer terminos desde la raiz del documento plantilla_cotizacion (donde los guarda ConfiguracionPage)
  const terminosFallback = plantilla?.terminosCotizacion || "";
  const terminos = (cot?.terminos && cot.terminos.trim()) ? cot.terminos : (cot?.textoTerminos && cot.textoTerminos.trim()) ? cot.textoTerminos : terminosFallback;
  const hayPanel = true;

  const s = {
    page: { minHeight: "100vh", background: "#f0f2f5", fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14, color: "#1a1a1a" },
    wrap: { maxWidth: 860, margin: "0 auto", padding: "24px 20px 60px" },
    card: { background: "#fff", border: "0.5px solid rgba(0,0,0,.08)", borderRadius: 10, padding: "20px 24px", marginBottom: 16 },
    lbl: { fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: ".5px", display: "block", marginBottom: 4 },
    inp: { width: "100%", padding: "9px 12px", border: "0.5px solid rgba(0,0,0,.2)", borderRadius: 8, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
    btn: { padding: "10px 22px", border: "0.5px solid rgba(0,0,0,.2)", borderRadius: 8, fontSize: 14, cursor: "pointer", background: "#fff", fontFamily: "inherit" },
    btnP: { padding: "12px 28px", background: "#1a3a5c", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" },
  };

  // ── ESTADO ACEPTADO ──
  if (aceptado) return (
    <div style={s.page}><div style={s.wrap}>
      <div style={{ ...s.card, textAlign: "center", padding: "52px 32px" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#EAF3DE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3B6D11" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <p style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>¡Cotización aceptada!</p>
        <p style={{ color: "#888", fontSize: 14 }}>Hemos recibido tu confirmación. En breve nos ponemos en contacto.</p>
      </div>
    </div></div>
  );

  // ── FLUJO ACEPTACIÓN ──
  if (aceptando) return (
    <div style={s.page}><div style={s.wrap}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {pasosActivos.map((p, i) => (
            <div key={p} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: i < paso ? "#EAF3DE" : i === paso ? "#1a3a5c" : "#eee", color: i < paso ? "#3B6D11" : i === paso ? "#fff" : "#aaa", fontSize: 13, fontWeight: 500 }}>
                {i < paso ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 13, color: i === paso ? "#1a3a5c" : "#aaa", fontWeight: i === paso ? 500 : 400 }}>
                {p === "opcion" ? "Elegir opción" : p === "opcionales" ? "Productos opcionales" : "Firma"}
              </span>
              {i < pasosActivos.length - 1 && <div style={{ width: 24, height: 1, background: "#dddddd" }} />}
            </div>
          ))}
        </div>
        <button onClick={() => setAceptando(false)} style={{ fontSize: 12, color: '#888', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>✕ Cancelar</button>
      </div>
      <div style={s.card}>
        {pasoActual === "opcion" && (
          <div>
            <p style={{ fontSize: 17, fontWeight: 500, marginBottom: 4 }}>¿Cuál opción preferís?</p>
            <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>Elegí la que mejor se adapta a tus necesidades.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {cot.opciones.map(o => {
                const tot = calcTotalesOp(o, cot, {});
                const sel = opElegida === o.id;
                return (
                  <div key={o.id} onClick={() => setOpElegida(o.id)} style={{ border: sel ? "2px solid #1a3a5c" : "0.5px solid rgba(0,0,0,.15)", borderRadius: 10, padding: "14px 18px", cursor: "pointer", background: sel ? "#f0f4f8" : "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", border: sel ? "6px solid #1a3a5c" : "1.5px solid #cccccc", flexShrink: 0 }} />
                        <p style={{ fontWeight: 500, fontSize: 15 }}>{o.nombre}</p>
                      </div>
                      <p style={{ fontWeight: 500, fontSize: 16, color: "#1a3a5c" }}>{sym(mon)}{fmtN(tot.total)}</p>
                    </div>
                    <div style={{ marginTop: 8, marginLeft: 30 }}>
                      {(o.productos || []).map((p, i) => <p key={i} style={{ fontSize: 12, color: "#888", marginBottom: 2 }}>{p.cantidad}x {p.nombre}</p>)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button style={s.btnP} onClick={siguientePaso} disabled={!opElegida}>Continuar →</button>
            </div>
          </div>
        )}
        {pasoActual === "opcionales" && (
          <div>
            <p style={{ fontSize: 17, fontWeight: 500, marginBottom: 4 }}>Productos opcionales</p>
            <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>Seleccioná los adicionales que querés incluir.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {(opParaPaso?.productosOpcionales || []).map((p, i) => {
                const key = p._lid || p.nombre;
                const activo = opcionalesConfirmados[key];
                const precio = mon === "CRC" ? Number(p.precio || 0) * tasa : Number(p.precio || 0);
                return (
                  <div key={i} onClick={() => setOpcionalesConfirmados(prev => ({ ...prev, [key]: !prev[key] }))} style={{ border: activo ? "2px solid #1a3a5c" : "0.5px solid rgba(0,0,0,.15)", borderRadius: 10, padding: "14px 18px", cursor: "pointer", background: activo ? "#f0f4f8" : "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 5, border: activo ? "none" : "1.5px solid #cccccc", background: activo ? "#1a3a5c" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {activo && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <p style={{ fontWeight: 500 }}>{p.nombre}</p>
                    </div>
                    <p style={{ fontWeight: 500, color: "#1a3a5c" }}>+ {sym(mon)}{fmtN(precio)}</p>
                  </div>
                );
              })}
            </div>
            <div style={{ background: "#f5f6f8", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#888" }}>Total con selección</span>
                <span style={{ fontWeight: 500 }}>{sym(mon)}{fmtN(totPaso.total)}</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button style={s.btn} onClick={anteriorPaso}>← Atrás</button>
              <button style={s.btnP} onClick={siguientePaso}>Continuar →</button>
            </div>
          </div>
        )}
        {pasoActual === "firma" && (
          <div>
            <p style={{ fontSize: 17, fontWeight: 500, marginBottom: 4 }}>Firma electrónica</p>
            <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
              Confirmás la aceptación de <strong>{cot.opciones.find(o => o.id === opElegida)?.nombre}</strong> por <strong>{sym(mon)}{fmtN(totPaso.total)}</strong>.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={s.lbl}>Nombre completo</label>
                <input style={s.inp} placeholder="Tu nombre legal" value={firma.nombre} onChange={e => setFirma(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div>
                <label style={s.lbl}>Cédula / ID</label>
                <input style={s.inp} placeholder="1-1234-5678" value={firma.cedula} onChange={e => setFirma(f => ({ ...f, cedula: e.target.value }))} />
              </div>
            </div>
            <label style={s.lbl}>Dibujá tu firma</label>
            <div style={{ border: "0.5px solid rgba(0,0,0,.2)", borderRadius: 8, overflow: "hidden", marginBottom: 6, background: "#fafafa" }}>
              <canvas ref={canvasRef} width={680} height={120} style={{ display: "block", width: "100%", cursor: "crosshair", touchAction: "none" }}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <button style={{ ...s.btn, fontSize: 12, padding: "4px 12px" }} onClick={limpiarCanvas}>Limpiar</button>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...s.btn, flex: 1 }} onClick={anteriorPaso}>← Atrás</button>
              <button style={{ ...s.btnP, flex: 2, opacity: (!firma.nombre || !firma.cedula || !hayFirma) ? 0.5 : 1 }} disabled={!firma.nombre || !firma.cedula || !hayFirma || enviandoFirma} onClick={confirmarAceptacion}>
                {enviandoFirma ? "Guardando..." : "Confirmar aceptación"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div></div>
  );

  // ── VISTA NORMAL ──
  return (
    <>
      <style>{printStyles}</style>

      {/* Barra superior */}
      <div className="no-print" style={{ background: '#1a3a5c', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: 'Inter, sans-serif' }}>{cot.numero}</span>
          <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: 'rgba(255,255,255,.15)', color: '#fff' }}>{cot.estado}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {cot.opciones?.length > 1 && widgets.some(w => w.type === 'opciones_tabs') && cot.opciones.map(o => (
            <button key={o.id} onClick={() => cambiarOpcion(o.id)} style={{ padding: '6px 14px', fontSize: 12, border: 'none', borderRadius: 6, cursor: 'pointer', background: opActiva === o.id ? '#fff' : 'rgba(255,255,255,.2)', color: opActiva === o.id ? '#1a3a5c' : '#fff', fontWeight: opActiva === o.id ? 600 : 400, fontFamily: 'Inter, sans-serif' }}>
              {o.nombre}
            </button>
          ))}
          <button onClick={() => window.print()} style={{ padding: '6px 16px', fontSize: 12, border: '1px solid rgba(255,255,255,.4)', borderRadius: 6, cursor: 'pointer', background: 'transparent', color: '#fff', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Descargar PDF
          </button>
          {cot.estado !== "Aceptada" && cot.estado !== "Rechazada" && (
            <button onClick={iniciarAceptacion} style={{ padding: '6px 16px', fontSize: 12, border: 'none', borderRadius: 6, cursor: 'pointer', background: '#0F6E56', color: '#fff', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
              ✓ Aceptar cotización
            </button>
          )}
        </div>
      </div>

      <div className="cot-print-wrapper" style={{ background: '#f0f2f5', padding: '32px 20px', fontFamily: 'Inter, sans-serif' }}>
        {/* Portada */}
        {portadaActiva && (
          <div className="portada-page" style={{ width: HOJA_W, margin: '0 auto 32px', boxShadow: '0 4px 24px rgba(0,0,0,.1)', borderRadius: 4, overflow: 'hidden' }}>
            <img src={portadaActiva.url} alt="Portada" style={{ width: '100%', display: 'block' }} />
          </div>
        )}

        {/* Vista pantalla — layout con panel lateral a la izquierda */}
        <div className="no-print">
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          `}</style>

          {!hojaLista && (headerWidgets.length > 0 || contentWidgets.length > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16, color: '#888', fontFamily: 'Inter, sans-serif' }}>
              <div style={{ width: 36, height: 36, border: '3px solid #e0e0e0', borderTopColor: '#1a3a5c', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ fontSize: 13 }}>Preparando cotización...</div>
            </div>
          )}

          {(headerWidgets.length > 0 || contentWidgets.length > 0) ? (
            <div style={{
              opacity: hojaLista ? 1 : 0,
              animation: hojaLista ? 'fadeIn 0.4s ease' : 'none',
              display: 'flex',
              gap: 20,
              justifyContent: 'center',
              alignItems: 'flex-start',
            }}>
              {/* Panel lateral — izquierda del documento */}
              {hayPanel && hojaLista && (
                <PanelLateral cot={{ ...cot, terminos }} totales={totales} mon={mon} />
              )}

              {/* Documento */}
              <div>
                <PaginaWidget
                  headerWidgets={headerWidgets}
                  contentWidgets={contentWidgets.filter(w => w.type !== 'terminos')}
                  footerWidgets={footerWidgets}
                  headerH={headerH}
                  footerH={footerH}
                  empresa={empresa}
                  cot={{ ...cot, terminos }}
                  op={op}
                  opcionales={opcionales}
                  setOpcionales={setOpcionales}
                  esPdf={false}
                  totales={totales}
                  onCambiarOpcion={cambiarOpcion}
                  opActiva={opActiva}
                />
              </div>
            </div>
          ) : !hojaLista ? null : (
            <div style={{ textAlign: 'center', padding: 40, color: '#888', background: '#fff', borderRadius: 8, maxWidth: 595, margin: '0 auto' }}>
              Cargando plantilla...
            </div>
          )}
        </div>

        {/* Vista impresión — solo documento, sin panel lateral */}
        <div className="solo-print">
          {portadaActiva && (
            <div className="portada-page" style={{ width: '100%' }}>
              <img src={portadaActiva.url} alt="Portada" style={{ width: '100%', display: 'block' }} />
            </div>
          )}
          {(cot.opciones || []).map((o, idx) => (
            <div key={o.id}>
              <PaginaWidget
                headerWidgets={headerWidgets}
                contentWidgets={contentWidgets.filter(w => w.type !== 'terminos')}
                footerWidgets={footerWidgets}
                headerH={headerH}
                footerH={footerH}
                empresa={empresa}
                cot={{ ...cot, terminos }}
                op={o}
                opcionales={{}}
                setOpcionales={() => {}}
                esPdf={true}
                totales={calcTotalesOp(o, cot, {})}
                onCambiarOpcion={() => {}}
                pagina={idx + 1}
                totalPaginas={(cot.opciones || []).length}
              />
            </div>
          ))}
          {/* Términos y condiciones — hoja separada con header y footer */}
          {terminos && (() => {
            const paginaAlto = Math.round(1056 / 1.371)
            const contenidoAlto = paginaAlto - headerH - footerH
            const propsTerminos = { empresa, cot: { ...cot, terminos }, op, opcionales: {}, setOpcionales: () => {}, esPdf: true, totales, cambiarOpcionFn: () => {} }
            return (
              <div className="pagina-terminos" style={{background:'#fff',width:HOJA_W,height:paginaAlto,fontFamily:'Inter,sans-serif',margin:'0 auto',display:'flex',flexDirection:'column'}}>
                <SeccionAbsoluta {...propsTerminos} widgets={headerWidgets} height={headerH} />
                <div style={{flex:1,overflow:'hidden',padding:'12px 24px',boxSizing:'border-box'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#1a3a5c',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:10}}>Términos y condiciones</div>
                  <div style={{fontSize:10,color:'#555',whiteSpace:'pre-wrap',lineHeight:1.7}}>{terminos}</div>
                </div>
                <SeccionAbsoluta {...propsTerminos} widgets={footerWidgets} height={footerH} />
              </div>
            )
          })()}
          {/* Header fijo — se repite en cada hoja impresa */}
          <div className="print-header">
            <SeccionAbsoluta widgets={headerWidgets} height={headerH} empresa={empresa}
              cot={{ ...cot, terminos }} op={cot.opciones?.[0]} opcionales={{}} setOpcionales={() => {}}
              esPdf={true} totales={{}} cambiarOpcionFn={() => {}} />
          </div>
          {/* Footer fijo — se repite en cada hoja impresa */}
          <div className="print-footer">
            <SeccionAbsoluta widgets={footerWidgets.filter(w => w.type !== 'paginacion' && !(w.text || '').match(/p[aá]g/i))} height={footerH} empresa={empresa}
              cot={{ ...cot, terminos }} op={cot.opciones?.[0]} opcionales={{}} setOpcionales={() => {}}
              esPdf={true} totales={{}} cambiarOpcionFn={() => {}} />
          </div>
        </div>
      </div>

      {cot.estado === "Aceptada" && (
        <div className="no-print" style={{ maxWidth: 794, margin: '0 auto 32px', background: '#EAF3DE', border: '1px solid #C0DD97', borderRadius: 8, padding: '16px 24px', textAlign: 'center' }}>
          <p style={{ fontWeight: 500, color: '#3B6D11', fontFamily: 'Inter, sans-serif' }}>✓ Cotización aceptada por {cot.firmaNombre}</p>
        </div>
      )}
    </>
  );
}