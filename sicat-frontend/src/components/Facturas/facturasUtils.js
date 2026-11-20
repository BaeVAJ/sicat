// Utilidades puras del módulo de facturas (sin React).

export const PAGE_SIZES = [10, 25, 50, 100];
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export const USO_CFDI_OPCIONES = [
    ['G01', 'Adquisición de mercancías'],
    ['G02', 'Devoluciones, descuentos o bonificaciones'],
    ['G03', 'Gastos en general'],
    ['I01', 'Construcciones'],
    ['I02', 'Mobilario y equipo de oficina'],
    ['I03', 'Equipo de transporte'],
    ['I04', 'Equipo de cómputo y accesorios'],
    ['I05', 'Dados, troqueles, moldes, matrices y herramental'],
    ['I06', 'Comunicaciones telefónicas'],
    ['I07', 'Comunicaciones satelitales'],
    ['I08', 'Otra maquinaria y equipo'],
    ['D01', 'Honorarios médicos, dentales y gastos hospitalarios'],
    ['D02', 'Gastos médicos por incapacidad o discapacidad'],
    ['D03', 'Gastos funerales'],
    ['D04', 'Donativos'],
    ['P01', 'Por definir'],
    ['CP01', 'Pagos'],
    ['CN01', 'Nómina'],
    ['S01', 'Sin efectos fiscales'],
];

/* ───────────── Formato ───────────── */

export function normalizar(texto) {
    return String(texto ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

export function formatoMoneda(valor) {
    if (valor === null || valor === undefined || valor === '') return '—';
    const n = Number(valor);
    if (Number.isNaN(n)) return '—';
    return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function aFecha(fecha) {
    const date = new Date(fecha);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function mostrarFechaCorta(fecha) {
    const date = fecha && aFecha(fecha);
    return date ? date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

export function mostrarFechaCompleta(fecha) {
    const date = fecha && aFecha(fecha);
    return date ? date.toLocaleString('es-MX') : '—';
}

export function obtenerFechaLocalParaInput(fecha = new Date()) {
    const date = fecha instanceof Date ? fecha : new Date(fecha);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (v) => String(v).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function obtenerFechaIso(fechaLocal) {
    const date = new Date(fechaLocal);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export const hoyIso = () => new Date().toISOString().slice(0, 10);

export function calcularFalta(saldoAnterior, montoPago) {
    if (saldoAnterior === '' || montoPago === '') return '';
    const saldo = Number(saldoAnterior);
    const monto = Number(montoPago);
    if (Number.isNaN(saldo) || Number.isNaN(monto)) return '';
    return Math.max(saldo - monto, 0).toFixed(2);
}

export const campoACamel = (campo) =>
    (campo ? String(campo).replace(/_([a-z])/g, (_, c) => c.toUpperCase()) : '');

/* ───────────── Archivos ───────────── */

export function validarArchivo(file, tipo) {
    if (!file) return null;
    const nombre = (file.name || '').toLowerCase();
    const mime = (file.type || '').toLowerCase();

    const esValido = tipo === 'pdf'
        ? mime === 'application/pdf' || nombre.endsWith('.pdf')
        : mime === 'text/xml' || mime === 'application/xml' || nombre.endsWith('.xml');

    if (!esValido) return `El archivo debe ser ${tipo.toUpperCase()}`;
    if (file.size > MAX_FILE_SIZE) return `El archivo ${tipo.toUpperCase()} no debe exceder 25 MB`;
    return null;
}

function dispararDescarga(href, filename, extra = {}) {
    const a = Object.assign(document.createElement('a'), { href, download: filename, ...extra });
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export async function downloadFile(url, filename) {
    try {
        const blob = await (await fetch(url)).blob();
        const blobUrl = window.URL.createObjectURL(blob);
        dispararDescarga(blobUrl, filename);
        window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
        console.warn('Fallback a descarga directa:', err);
        dispararDescarga(url, filename, { target: '_blank' });
    }
}

const escaparCsv = (valor) => {
    const texto = valor == null ? '' : String(valor);
    return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

export function descargarCsv(encabezados, filas, filename) {
    const csv = [encabezados, ...filas].map((fila) => fila.map(escaparCsv).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
    dispararDescarga(url, filename);
    URL.revokeObjectURL(url);
}

export function exportarFacturasCsv(facturas) {
    descargarCsv(
        [
            'UUID fiscal', 'Compra', 'Empresa', 'Proveedor', 'Fecha emisión',
            'Subtotal', 'IVA', 'Total', 'Método', 'Uso CFDI', 'Pagado', 'Saldo', 'Estado pago', 'No. pagos', 'PDF', 'XML',
        ],
        facturas.map((f) => [
            f.uuid_fiscal, f.id_compra, f.empresa, f.proveedor, mostrarFechaCorta(f.fecha_emision),
            f.monto_subtotal, f.monto_iva, f.total, f.metodo_pago, f.uso_cfdi,
            f.pagado, f.saldo, f.estadoPago, f.numPagos,
            f.archivo_url ? 'Sí' : 'No', f.archivo_xml_url ? 'Sí' : 'No',
        ]),
        `facturas_y_saldos_${hoyIso()}.csv`
    );
}

/* ───────────── XML (CFDI) ───────────── */

export function formatXml(xmlStr) {
    if (!xmlStr) return '';
    try {
        let pad = 0;
        return xmlStr
            .replace(/(>)(<)(\/*)/g, '$1\r\n$2$3')
            .split('\r\n')
            .map((node) => {
                let indent = 0;
                if (node.match(/.+<\/\w[^>]*>$/)) {
                    indent = 0;
                } else if (node.match(/^<\/\w/)) {
                    if (pad > 0) pad -= 1;
                } else if (node.match(/^<\w[^>]*[^/]>.*$/)) {
                    indent = 1;
                }
                const linea = '  '.repeat(pad) + node;
                pad += indent;
                return linea;
            })
            .join('\n');
    } catch {
        return xmlStr;
    }
}

/**
 * Extrae los datos fiscales de un CFDI. Devuelve solo los campos encontrados,
 * con las mismas claves que usa el formulario de factura.
 */
export function parseCfdiXml(text) {
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    const primero = (...tags) => tags.map((t) => doc.getElementsByTagName(t)[0]).find(Boolean);
    const elementos = Array.from(doc.getElementsByTagName('*'));
    const porNombreLocal = (nombre) => elementos.filter((el) => el.localName === nombre);

    const timbre = primero('tfd:TimbreFiscalDigital', 'TimbreFiscalDigital');
    const comprobante = primero('cfdi:Comprobante', 'Comprobante');
    const emisor = primero('cfdi:Emisor', 'Emisor');
    const receptor = primero('cfdi:Receptor', 'Receptor');

    let iva = porNombreLocal('Impuestos')
        .map((el) => el.getAttribute('TotalImpuestosTrasladados'))
        .find((v) => v !== null && v !== '');

    if (!iva) {
        const suma = porNombreLocal('Traslado')
            .filter((t) => (t.getAttribute('Impuesto') === '002' || !t.hasAttribute('Impuesto')) && t.getAttribute('Importe'))
            .reduce((acc, t) => acc + (parseFloat(t.getAttribute('Importe')) || 0), 0);
        iva = suma > 0 ? suma.toFixed(2) : null;
    }

    const metodo = comprobante?.getAttribute('MetodoPago')?.toUpperCase();
    const campos = {
        uuidFiscal: timbre?.getAttribute('UUID'),
        rfcEmisor: emisor?.getAttribute('Rfc')?.toUpperCase(),
        rfcReceptor: receptor?.getAttribute('Rfc')?.toUpperCase(),
        fechaEmision: comprobante?.getAttribute('Fecha')?.split('T')[0],
        montoSubtotal: comprobante?.getAttribute('SubTotal'),
        montoIva: iva,
        metodoPago: ['PUE', 'PPD'].includes(metodo) ? metodo : null,
        usoCfdi: receptor?.getAttribute('UsoCFDI')?.toUpperCase(),
    };
    return Object.fromEntries(Object.entries(campos).filter(([, v]) => v));
}

/* ───────────── Modelo de facturas ───────────── */

const ordenarPagos = (a, b) =>
    (Number(b.num_pago) || 0) - (Number(a.num_pago) || 0) ||
    (new Date(b.fecha_pago).getTime() || 0) - (new Date(a.fecha_pago).getTime() || 0);

/** Une facturas + estado de cuenta PPD + complementos y precalcula el texto de búsqueda. */
export function enriquecerFacturas(facturas, ppdResumenes, complementos) {
    const ppdMap = new Map();
    ppdResumenes.forEach((r) => {
        if (r?.id_factura != null) ppdMap.set(Number(r.id_factura), r);
    });

    const pagosMap = new Map();
    complementos.forEach((c) => {
        const id = Number(c.id_factura);
        if (!id) return;
        if (!pagosMap.has(id)) pagosMap.set(id, []);
        pagosMap.get(id).push(c);
    });
    pagosMap.forEach((lista) => lista.sort(ordenarPagos));

    return facturas.map((f) => {
        const id = Number(f.id_factura);
        const totalBase = (Number(f.monto_subtotal) || 0) + (Number(f.monto_iva) || 0);
        const pagos = pagosMap.get(id) || [];
        const esPpd = f.metodo_pago === 'PPD';
        const ppd = ppdMap.get(id);

        let resumen;
        if (esPpd) {
            const total = ppd?.total != null ? Number(ppd.total) : totalBase;
            const pagado = ppd?.pagado != null
                ? Number(ppd.pagado)
                : pagos.reduce((acc, p) => acc + (Number(p.monto_pago) || 0), 0);
            const saldo = ppd?.saldo != null ? Number(ppd.saldo) : Math.max(total - pagado, 0);
            resumen = {
                total,
                pagado,
                saldo,
                estadoPago: ppd?.estado || (saldo <= 0 ? 'PAGADO' : pagado > 0 ? 'PAGO_PARCIAL' : 'PENDIENTE'),
                numPagos: ppd?.num_pagos ?? pagos.length,
                ultimoNumPago: ppd?.ultimo_num_pago ?? Math.max(...pagos.map((p) => Number(p.num_pago) || 0), 0),
                ultimoPago: ppd?.ultimo_pago ?? pagos[0]?.fecha_pago ?? null,
                pagos,
            };
        } else {
            resumen = {
                total: totalBase,
                pagado: totalBase,
                saldo: 0,
                estadoPago: 'PAGADO',
                numPagos: 0,
                ultimoNumPago: 0,
                ultimoPago: null,
                pagos: [],
            };
        }

        const busqueda = normalizar([
            f.uuid_fiscal, f.empresa, f.proveedor, f.rfc_emisor, f.rfc_receptor, f.id_compra,
            ...resumen.pagos.map((p) => [p.forma_pago, p.num_pago, mostrarFechaCorta(p.fecha_pago)].join(' ')),
        ].join(' '));

        return { ...f, ...resumen, busqueda };
    });
}

/** KPIs globales y contadores de los chips en una sola pasada. */
export function resumirFacturas(facturas) {
    const r = {
        totalRegistros: facturas.length,
        sumaFacturado: 0,
        saldoPendiente: 0,
        ppdAbiertas: 0,
        ppdLiquidadas: 0,
        totalPagado: 0,
        pue: 0,
        conArchivo: 0,
        sinArchivos: 0,
    };
    facturas.forEach((f) => {
        r.sumaFacturado += f.total;
        if (f.metodo_pago === 'PPD') {
            r.totalPagado += f.pagado;
            if (f.saldo > 0) {
                r.saldoPendiente += f.saldo;
                r.ppdAbiertas += 1;
            } else {
                r.ppdLiquidadas += 1;
            }
        } else {
            r.pue += 1;
            r.totalPagado += f.total;
        }
        if (f.archivo_url || f.archivo_xml_url) r.conArchivo += 1;
        else r.sinArchivos += 1;
    });
    return r;
}

export const FILTROS_CHIP = {
    ALL: () => true,
    PPD_OPEN: (f) => f.metodo_pago === 'PPD' && f.saldo > 0,
    PPD_DONE: (f) => f.metodo_pago === 'PPD' && f.saldo <= 0,
    PUE: (f) => f.metodo_pago === 'PUE',
    PAID: (f) => !(f.saldo > 0),
    INCOMPLETE: (f) => !(f.archivo_url && f.archivo_xml_url),
};

export const FILTROS_ARCHIVOS = {
    ALL: () => true,
    INCOMPLETE: (pdf, xml) => !(pdf && xml),
    PDF: (pdf) => pdf,
    XML: (pdf, xml) => xml,
    BOTH: (pdf, xml) => pdf && xml,
    NONE: (pdf, xml) => !pdf && !xml,
};

const VALOR_ORDEN = {
    uuid_fiscal: (f) => f.uuid_fiscal || '',
    empresa: (f) => normalizar(f.empresa),
    emision: (f) => {
        const t = new Date(f.fecha_emision).getTime();
        return Number.isNaN(t) ? null : t;
    },
    metodo_pago: (f) => normalizar(f.metodo_pago),
    total: (f) => Number(f.total) || 0,
    saldo: (f) => Number(f.saldo) || 0,
};

export function ordenarFacturas(lista, { key, dir }) {
    const valor = VALOR_ORDEN[key] || ((f) => f[key] ?? null);
    const factor = dir === 'asc' ? 1 : -1;
    return lista
        .map((f) => [valor(f), f])
        .sort(([va], [vb]) => {
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            return va < vb ? -factor : va > vb ? factor : 0;
        })
        .map(([, f]) => f);
}

export function filtrarFacturas(facturas, { chip, busqueda, empresa, proveedor, archivos }) {
    const q = normalizar(busqueda.trim());
    const pasaChip = FILTROS_CHIP[chip] || FILTROS_CHIP.ALL;
    const pasaArchivos = FILTROS_ARCHIVOS[archivos] || FILTROS_ARCHIVOS.ALL;
    return facturas.filter((f) =>
        pasaChip(f) &&
        (!q || f.busqueda.includes(q)) &&
        (!empresa || f.empresa === empresa) &&
        (!proveedor || f.proveedor === proveedor) &&
        pasaArchivos(Boolean(f.archivo_url), Boolean(f.archivo_xml_url))
    );
}

export const valoresUnicos = (lista, campo) =>
    [...new Set(lista.map((f) => f[campo]).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b), 'es'));

export const nuevoPagoForm = () => ({
    idFactura: '',
    numPago: '',
    fechaPago: obtenerFechaLocalParaInput(),
    saldoAnterior: '',
    montoPago: '',
    formaPago: '',
    faltaPagar: '',
});
