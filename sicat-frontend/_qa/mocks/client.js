const clone = (x) => JSON.parse(JSON.stringify(x));
const wait = () => new Promise((r) => setTimeout(r, 5));

const base = (id, extra) => ({
  id_factura: id,
  id_compra: 10 + id,
  empresa: 'Operadora Romerson',
  proveedor: 'Perez Sanchez',
  rfc_emisor: 'AAA010101AAA',
  rfc_receptor: 'BBB020202BBB',
  fecha_emision: `2026-09-${10 + id}`,
  fecha_compra: '2026-09-01',
  monto_subtotal: 100 * id,
  monto_iva: 16 * id,
  metodo_pago: 'PPD',
  uso_cfdi: 'G01',
  archivo_url: 'a.pdf',
  archivo_xml_url: 'a.xml',
  uuid_fiscal: `bd5ee5ea-afd5-4c2a-9a10-00000000000${id}`,
  ...extra,
});

export const DB = {
  facturas: [
    base(1),
    base(2, { proveedor: 'Lopez SA', archivo_xml_url: null }),
    base(3, { metodo_pago: 'PUE', empresa: 'Operadora Trajes Espanoles', archivo_url: null, archivo_xml_url: null, uso_cfdi: 'G03' }),
    base(4, { empresa: 'Operadora Trajes Espanoles' }),
  ],
  ppd: [
    { id_factura: 1, total: 116, pagado: 50, saldo: 66, estado: 'PAGO_PARCIAL', num_pagos: 2, ultimo_num_pago: 2, ultimo_pago: '2026-09-23T10:00:00Z' },
    { id_factura: 2, total: 232, pagado: 232, saldo: 0, estado: 'PAGADO', num_pagos: 1, ultimo_num_pago: 1, ultimo_pago: '2026-09-24T10:00:00Z' },
    { id_factura: 4, total: 464, pagado: 0, saldo: 464, estado: 'PENDIENTE', num_pagos: 0, ultimo_num_pago: 0, ultimo_pago: null },
  ],
  complementos: [
    { id_detalle_factura: 1, id_factura: 1, num_pago: 1, fecha_pago: '2026-09-22T12:00:00Z', saldo_anterior: 116, monto_pago: 30, forma_pago: 'Efectivo', falta_pagar: 86, url_pdf: 'p.pdf', url_xml: null, uuid_fiscal: 'bd5ee5ea-afd5-4c2a-9a10-000000000001', empresa: 'Operadora Romerson', proveedor: 'Perez Sanchez' },
    { id_detalle_factura: 2, id_factura: 1, num_pago: 2, fecha_pago: '2026-09-23T10:00:00Z', saldo_anterior: 86, monto_pago: 20, forma_pago: 'Cheque nominativo', falta_pagar: 66, url_pdf: null, url_xml: null, uuid_fiscal: 'bd5ee5ea-afd5-4c2a-9a10-000000000001', empresa: 'Operadora Romerson', proveedor: 'Perez Sanchez' },
    { id_detalle_factura: 3, id_factura: 2, num_pago: 1, fecha_pago: '2026-09-24T10:00:00Z', saldo_anterior: 232, monto_pago: 232, forma_pago: 'Efectivo', falta_pagar: 0, url_pdf: 'p2.pdf', url_xml: 'p2.xml', uuid_fiscal: 'bd5ee5ea-afd5-4c2a-9a10-000000000002', empresa: 'Operadora Romerson', proveedor: 'Lopez SA' },
  ],
  formas: [
    { codigo_pago: '01', descripcion: 'Efectivo' },
    { codigo_pago: '03', descripcion: 'Transferencia electrónica de fondos (SPEI)' },
  ],
  compras: [
    { id_compra: 20, empresa: 'Operadora Romerson', proveedor: 'Perez Sanchez', fecha_compra: '2026-09-05' },
  ],
};

const serialize = (body) => {
  if (!(body instanceof FormData)) return body ?? null;
  const out = {};
  body.forEach((v, k) => { out[k] = v instanceof File ? `file:${v.name}` : v; });
  return out;
};

const log = (method, url, body) => {
  (window.__calls ||= []).push({ method, url, body: serialize(body) });
};

const resumenPpd = (idFactura) => {
  const f = DB.facturas.find((x) => x.id_factura === Number(idFactura));
  const pagos = DB.complementos.filter((c) => c.id_factura === Number(idFactura));
  const total = Number(f.monto_subtotal) + Number(f.monto_iva);
  const pagado = pagos.reduce((a, c) => a + Number(c.monto_pago), 0);
  const saldo = Math.max(total - pagado, 0);
  const resumen = {
    id_factura: f.id_factura, uuid_fiscal: f.uuid_fiscal, empresa: f.empresa, proveedor: f.proveedor,
    total, pagado, saldo, estado: saldo <= 0 ? 'PAGADO' : pagado > 0 ? 'PAGO_PARCIAL' : 'PENDIENTE',
    num_pagos: pagos.length, ultimo_num_pago: Math.max(0, ...pagos.map((c) => Number(c.num_pago))),
    ultimo_pago: pagos.at(-1)?.fecha_pago ?? null,
  };
  const i = DB.ppd.findIndex((r) => r.id_factura === f.id_factura);
  if (i >= 0) DB.ppd[i] = resumen; else DB.ppd.push(resumen);
  return resumen;
};

export default {
  async get(url) {
    log('GET', url);
    await wait();
    if (url === '/facturas') return { data: clone(DB.facturas) };
    if (url === '/facturas/ppd/estado-cuenta') return { data: clone(DB.ppd) };
    if (url === '/facturas/complementos') return { data: clone(DB.complementos) };
    if (url === '/facturas/formas-pago') return { data: clone(DB.formas) };
    if (url.startsWith('/compras')) return { data: clone(DB.compras) };
    return { data: {} };
  },
  async post(url, body) {
    log('POST', url, body);
    await wait();
    const m = url.match(/^\/facturas\/(\d+)\/complementos$/);
    if (m) {
      const f = DB.facturas.find((x) => x.id_factura === Number(m[1]));
      const det = {
        id_detalle_factura: 99, id_factura: f.id_factura, num_pago: Number(body.get('num_pago')),
        fecha_pago: body.get('fecha_pago'), saldo_anterior: Number(body.get('saldo_anterior')),
        monto_pago: Number(body.get('monto_pago')), forma_pago: body.get('forma_pago'),
        falta_pagar: Number(body.get('falta_pagar')), url_pdf: null, url_xml: null,
      };
      DB.complementos.push({ ...det, uuid_fiscal: f.uuid_fiscal, empresa: f.empresa, proveedor: f.proveedor });
      return { data: { ...det, factura: clone(resumenPpd(f.id_factura)) } };
    }
    return { data: {} };
  },
  async put(url, body) {
    log('PUT', url, body);
    await wait();
    const m = url.match(/^\/facturas\/(\d+)$/);
    if (m) {
      const f = DB.facturas.find((x) => x.id_factura === Number(m[1]));
      const upd = {
        ...f,
        id_compra: Number(body.get('id_compra')), uuid_fiscal: body.get('uuid_fiscal'),
        monto_subtotal: Number(body.get('monto_subtotal')), monto_iva: Number(body.get('monto_iva')),
        metodo_pago: body.get('metodo_pago'), uso_cfdi: body.get('uso_cfdi'),
      };
      Object.assign(f, upd);
      return { data: { ...clone(f), total: upd.monto_subtotal + upd.monto_iva } };
    }
    return { data: {} };
  },
  async delete(url) {
    log('DELETE', url);
    await wait();
    return { data: {} };
  },
};
