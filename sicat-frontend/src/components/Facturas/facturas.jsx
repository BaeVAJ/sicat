// src/components/Facturas/facturas.jsx
import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import Layout from '../layout/Layout';
import './facturas.css';

const PAGE_SIZES = [10, 25, 50, 100];
const MAX_FILE_SIZE = 25 * 1024 * 1024;

function normalizar(texto) {
    return String(texto ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function formatoMoneda(valor) {
    if (valor === null || valor === undefined || valor === '') return '—';
    const n = Number(valor);
    if (Number.isNaN(n)) return '—';
    return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function mostrarFechaCorta(fecha) {
    if (!fecha) return '—';
    const date = new Date(fecha);
    return Number.isNaN(date.getTime())
        ? '—'
        : date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function mostrarFechaCompleta(fecha) {
    if (!fecha) return '—';
    const date = new Date(fecha);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-MX');
}

function obtenerFechaLocalParaInput(fecha = new Date()) {
    const date = fecha instanceof Date ? fecha : new Date(fecha);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (v) => String(v).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function obtenerFechaIso(fechaLocal) {
    const date = new Date(fechaLocal);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function escaparCsv(valor) {
    const texto = valor == null ? '' : String(valor);
    return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function descargarCsv(encabezados, filas, filename) {
    const csv = [encabezados, ...filas].map((fila) => fila.map(escaparCsv).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function validarArchivo(file, tipo) {
    if (!file) return null;
    const nombre = (file.name || '').toLowerCase();
    const mime = (file.type || '').toLowerCase();

    const esPdf = tipo === 'pdf' && (mime === 'application/pdf' || nombre.endsWith('.pdf'));
    const esXml = tipo === 'xml' && (
        mime === 'text/xml' ||
        mime === 'application/xml' ||
        nombre.endsWith('.xml')
    );

    if (!esPdf && !esXml) return `El archivo debe ser ${tipo.toUpperCase()}`;
    if (file.size > MAX_FILE_SIZE) return `El archivo ${tipo.toUpperCase()} no debe exceder 25 MB`;
    return null;
}

function campoACamel(campo) {
    return campo ? String(campo).replace(/_([a-z])/g, (_, c) => c.toUpperCase()) : '';
}

function calcularFalta(saldoAnterior, montoPago) {
    if (saldoAnterior === '' || montoPago === '') return '';
    const saldo = Number(saldoAnterior);
    const monto = Number(montoPago);
    if (Number.isNaN(saldo) || Number.isNaN(monto)) return '';
    return Math.max(saldo - monto, 0).toFixed(2);
}

function formatXml(xmlStr) {
    if (!xmlStr) return '';
    try {
        const PADDING = '  ';
        const reg = /(>)(<)(\/*)/g;
        const formatted = xmlStr.replace(reg, '$1\r\n$2$3');
        let pad = 0;
        return formatted
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
                const padding = PADDING.repeat(pad);
                pad += indent;
                return padding + node;
            })
            .join('\n');
    } catch {
        return xmlStr;
    }
}

async function downloadFile(url, filename) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
        console.warn('Fallback a descarga directa:', err);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function SortHeader({ label, sortKey, sort, onSort, className }) {
    const active = sort.key === sortKey;
    const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    return (
        <th aria-sort={ariaSort} className={className}>
            <button type="button" className="facturas-sort" onClick={() => onSort(sortKey)}>
                {label}
                <span className="facturas-sort__arrow" aria-hidden="true">
                    {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                </span>
            </button>
        </th>
    );
}

const initialPagoForm = {
    idFactura: '',
    numPago: '',
    fechaPago: obtenerFechaLocalParaInput(),
    saldoAnterior: '',
    montoPago: '',
    formaPago: '',
    faltaPagar: '',
};

const initialLogFilters = {
    busqueda: '',
    empresa: '',
    proveedor: '',
    formaPago: '',
    desde: '',
    hasta: '',
    saldo: '',
    archivos: '',
};

function Facturas() {
    const { usuario } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const isAdmin = usuario?.rol === 'admin';
    const canRegisterPago = isAdmin || usuario?.rol === 'gerente';

    // Core data
    const [facturas, setFacturas] = useState([]);
    const [ppdResumenes, setPpdResumenes] = useState([]);
    const [complementos, setComplementos] = useState([]);
    const [formasPago, setFormasPago] = useState([]);
    const [compras, setCompras] = useState([]);

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isMobile, setIsMobile] = useState(false);

    // Unified navigation & accordion state
    const [activeTab, setActiveTab] = useState('bitacora'); // 'facturas' | 'bitacora'
    const [expandedIds, setExpandedIds] = useState(() => new Set());

    // Tab 1: Facturas + Estado PPD filters, sort, pagination
    const [quickChip, setQuickChip] = useState('ALL');
    const [search, setSearch] = useState('');
    const [filterEmpresa, setFilterEmpresa] = useState('');
    const [filterProveedor, setFilterProveedor] = useState('');
    const [filterArchivos, setFilterArchivos] = useState('ALL'); // 'ALL' | 'INCOMPLETE' | 'PDF' | 'XML' | 'BOTH' | 'NONE'
    const [sortFacturas, setSortFacturas] = useState({ key: 'emision', dir: 'desc' });
    const [pageFacturas, setPageFacturas] = useState(1);
    const [pageSizeFacturas, setPageSizeFacturas] = useState(25);

    // Tab 2: Bitácora Global de Pagos filters, sort, pagination
    const [logFilters, setLogFilters] = useState(initialLogFilters);
    const [sortLog, setSortLog] = useState({ key: 'fecha_pago', dir: 'desc' });
    const [pageLog, setPageLog] = useState(1);
    const [pageSizeLog, setPageSizeLog] = useState(10);

    // Create Factura Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [idCompra, setIdCompra] = useState('');
    const [uuidFiscal, setUuidFiscal] = useState('');
    const [rfcEmisor, setRfcEmisor] = useState('');
    const [rfcReceptor, setRfcReceptor] = useState('');
    const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split('T')[0]);
    const [montoSubtotal, setMontoSubtotal] = useState('');
    const [montoIva, setMontoIva] = useState('');
    const [metodoPago, setMetodoPago] = useState('PPD');
    const [usoCfdi, setUsoCfdi] = useState('G01');
    const [archivoPdf, setArchivoPdf] = useState(null);
    const [archivoXml, setArchivoXml] = useState(null);
    const [xmlParseNotice, setXmlParseNotice] = useState('');
    const continueToPagoRef = useRef(false);

    // Registrar / Editar Complemento de Pago Modal state
    const [pagoModalOpen, setPagoModalOpen] = useState(false);
    const [pagoForm, setPagoForm] = useState(initialPagoForm);
    const [pagoPdf, setPagoPdf] = useState(null);
    const [pagoXml, setPagoXml] = useState(null);
    const [editingPago, setEditingPago] = useState(null);
    const [savingPago, setSavingPago] = useState(false);
    const [campoErrorPago, setCampoErrorPago] = useState('');
    const [pagoModalError, setPagoModalError] = useState('');
    const faltaManualRef = useRef(false);

    // Detail & Preview Modals
    const [facturaDetalle, setFacturaDetalle] = useState(null);
    const [pagoDetalle, setPagoDetalle] = useState(null);
    const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
    const [previewPdfTitle, setPreviewPdfTitle] = useState('');
    const [previewPdfFilename, setPreviewPdfFilename] = useState('');
    const [previewXmlContent, setPreviewXmlContent] = useState(null);
    const [previewXmlTitle, setPreviewXmlTitle] = useState('');
    const [previewXmlDownloadUrl, setPreviewXmlDownloadUrl] = useState('');
    const [previewXmlFilename, setPreviewXmlFilename] = useState('');
    const [xmlCopied, setXmlCopied] = useState(false);

    // Delete Confirmation Modals
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [facturaToDelete, setFacturaToDelete] = useState(null);
    const [pagoToDelete, setPagoToDelete] = useState(null);
    const [deletingPagoId, setDeletingPagoId] = useState(null);

    const pdfInputRef = useRef(null);
    const xmlInputRef = useRef(null);
    const pagoPdfInputRef = useRef(null);
    const pagoXmlInputRef = useRef(null);
    const messageTimer = useRef(null);

    const notifySuccess = useCallback((text, timeout = 4500) => {
        setError('');
        setSuccess(text);
        if (messageTimer.current) clearTimeout(messageTimer.current);
        if (timeout > 0) {
            messageTimer.current = setTimeout(() => setSuccess(''), timeout);
        }
    }, []);

    useEffect(() => () => {
        if (messageTimer.current) clearTimeout(messageTimer.current);
    }, []);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const fetchCompras = useCallback(async () => {
        try {
            const { data } = await client.get('/compras?sin_factura=true');
            setCompras(Array.isArray(data) ? data : []);
        } catch {
            console.warn('No se pudieron precargar las compras para el formulario');
        }
    }, []);

    const loadAllData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [facturasRes, ppdRes, complementosRes, formasRes, comprasRes] = await Promise.all([
                client.get('/facturas'),
                client.get('/facturas/ppd/estado-cuenta'),
                client.get('/facturas/complementos'),
                client.get('/facturas/formas-pago'),
                client.get('/compras?sin_factura=true').catch(() => ({ data: [] })),
            ]);

            setFacturas(Array.isArray(facturasRes.data) ? facturasRes.data : []);
            setPpdResumenes(Array.isArray(ppdRes.data) ? ppdRes.data : []);
            setComplementos(Array.isArray(complementosRes.data) ? complementosRes.data : []);
            setFormasPago(Array.isArray(formasRes.data) ? formasRes.data : []);
            setCompras(Array.isArray(comprasRes.data) ? comprasRes.data : []);
        } catch (err) {
            setError(err.response?.data?.error || err.response?.data?.message || 'Error al cargar las facturas y pagos');
        } finally {
            setLoading(false);
        }
    }, []);

    const refreshPpdYComplementos = useCallback(async () => {
        try {
            const [ppdRes, complementosRes] = await Promise.all([
                client.get('/facturas/ppd/estado-cuenta'),
                client.get('/facturas/complementos'),
            ]);
            setPpdResumenes(Array.isArray(ppdRes.data) ? ppdRes.data : []);
            setComplementos(Array.isArray(complementosRes.data) ? complementosRes.data : []);
        } catch {
            // Silently fallback to local optimistic state if background sync fails
        }
    }, []);

    useEffect(() => {
        void loadAllData();
    }, [loadAllData]);

    // Merge facturas + estado PPD + historial de complementos
    const facturasEnriquecidas = useMemo(() => {
        const ppdMap = new Map();
        ppdResumenes.forEach((r) => {
            if (r?.id_factura != null) ppdMap.set(Number(r.id_factura), r);
        });

        const pagosMap = new Map();
        complementos.forEach((c) => {
            const idF = Number(c.id_factura);
            if (!idF) return;
            if (!pagosMap.has(idF)) pagosMap.set(idF, []);
            pagosMap.get(idF).push(c);
        });

        pagosMap.forEach((lista) => {
            lista.sort((a, b) => {
                const diffNum = (Number(b.num_pago) || 0) - (Number(a.num_pago) || 0);
                if (diffNum !== 0) return diffNum;
                return (new Date(b.fecha_pago).getTime() || 0) - (new Date(a.fecha_pago).getTime() || 0);
            });
        });

        return facturas.map((f) => {
            const idF = Number(f.id_factura);
            const totalBase = (Number(f.monto_subtotal) || 0) + (Number(f.monto_iva) || 0);
            const ppd = ppdMap.get(idF);
            const pagos = pagosMap.get(idF) || [];
            const esPpd = f.metodo_pago === 'PPD';

            if (esPpd) {
                const total = ppd?.total != null ? Number(ppd.total) : totalBase;
                const pagado = ppd?.pagado != null
                    ? Number(ppd.pagado)
                    : pagos.reduce((acc, p) => acc + (Number(p.monto_pago) || 0), 0);
                const saldo = ppd?.saldo != null ? Number(ppd.saldo) : Math.max(total - pagado, 0);
                const estadoPago = ppd?.estado || (saldo <= 0 ? 'PAGADO' : pagado > 0 ? 'PAGO_PARCIAL' : 'PENDIENTE');
                const ultimoNumPago = ppd?.ultimo_num_pago ?? Math.max(...pagos.map((p) => Number(p.num_pago) || 0), 0);
                return {
                    ...f,
                    total,
                    pagado,
                    saldo,
                    estadoPago,
                    numPagos: ppd?.num_pagos ?? pagos.length,
                    ultimoNumPago,
                    ultimoPago: ppd?.ultimo_pago ?? pagos[0]?.fecha_pago ?? null,
                    pagos,
                };
            }

            return {
                ...f,
                total: totalBase,
                pagado: totalBase,
                saldo: 0,
                estadoPago: 'PAGADO',
                numPagos: 0,
                ultimoNumPago: 0,
                ultimoPago: null,
                pagos: [],
            };
        });
    }, [facturas, ppdResumenes, complementos]);

    const ppdFacturas = useMemo(
        () => facturasEnriquecidas.filter((f) => f.metodo_pago === 'PPD'),
        [facturasEnriquecidas]
    );

    // Filter dropdown options
    const opcionesFacturas = useMemo(() => {
        const unicos = (campo) =>
            [...new Set(facturasEnriquecidas.map((f) => f[campo]).filter(Boolean))]
                .sort((a, b) => String(a).localeCompare(String(b), 'es'));
        return {
            empresas: unicos('empresa'),
            proveedores: unicos('proveedor'),
        };
    }, [facturasEnriquecidas]);

    const opcionesLog = useMemo(() => {
        const unicos = (campo) =>
            [...new Set(complementos.map((c) => c[campo]).filter(Boolean))]
                .sort((a, b) => String(a).localeCompare(String(b), 'es'));
        return {
            empresas: unicos('empresa'),
            proveedores: unicos('proveedor'),
            formas: unicos('forma_pago'),
        };
    }, [complementos]);

    // Global KPIs
    const kpis = useMemo(() => {
        const totalRegistros = facturasEnriquecidas.length;
        let sumaFacturado = 0;
        let saldoPendiente = 0;
        let ppdAbiertasCount = 0;
        let totalPagado = 0;
        let pueCount = 0;
        let conAlgunArchivo = 0;
        let sinArchivos = 0;

        facturasEnriquecidas.forEach((f) => {
            sumaFacturado += f.total;
            if (f.metodo_pago === 'PPD') {
                if (f.saldo > 0) {
                    saldoPendiente += f.saldo;
                    ppdAbiertasCount += 1;
                }
                totalPagado += f.pagado;
            } else {
                pueCount += 1;
                totalPagado += f.total;
            }

            if (f.archivo_url || f.archivo_xml_url) conAlgunArchivo += 1;
            else sinArchivos += 1;
        });

        const ppdTotal = facturasEnriquecidas.filter((f) => f.metodo_pago === 'PPD').length;

        return {
            totalRegistros,
            sumaFacturado,
            saldoPendiente,
            ppdAbiertasCount,
            ppdLiquidadasCount: ppdTotal - ppdAbiertasCount,
            totalPagado,
            pueCount,
            conAlgunArchivo,
            sinArchivos,
        };
    }, [facturasEnriquecidas]);

    // Tab 1 filtering & sorting
    const facturasFiltradas = useMemo(() => {
        const q = normalizar(search.trim());
        const lista = facturasEnriquecidas.filter((f) => {
            if (quickChip === 'PPD_OPEN' && !(f.metodo_pago === 'PPD' && f.saldo > 0)) return false;
            if (quickChip === 'PPD_DONE' && !(f.metodo_pago === 'PPD' && f.saldo <= 0)) return false;
            if (quickChip === 'PUE' && f.metodo_pago !== 'PUE') return false;
            if (quickChip === 'PAID' && f.saldo > 0) return false;
            if (quickChip === 'INCOMPLETE' && (f.archivo_url && f.archivo_xml_url)) return false;

            if (q) {
                const texto = normalizar([
                    f.uuid_fiscal,
                    f.empresa,
                    f.proveedor,
                    f.rfc_emisor,
                    f.rfc_receptor,
                    f.id_compra,
                ].join(' '));
                if (!texto.includes(q)) return false;
            }
            if (filterEmpresa && f.empresa !== filterEmpresa) return false;
            if (filterProveedor && f.proveedor !== filterProveedor) return false;

            const hasPdf = Boolean(f.archivo_url);
            const hasXml = Boolean(f.archivo_xml_url);
            if (filterArchivos === 'INCOMPLETE' && (hasPdf && hasXml)) return false;
            if (filterArchivos === 'PDF' && !hasPdf) return false;
            if (filterArchivos === 'XML' && !hasXml) return false;
            if (filterArchivos === 'BOTH' && !(hasPdf && hasXml)) return false;
            if (filterArchivos === 'NONE' && (hasPdf || hasXml)) return false;

            return true;
        });

        const valorOrdenFactura = (item, key) => {
            switch (key) {
                case 'uuid_fiscal':
                    return item.uuid_fiscal || '';
                case 'empresa':
                    return normalizar(item.empresa);
                case 'emision': {
                    const t = new Date(item.fecha_emision).getTime();
                    return Number.isNaN(t) ? null : t;
                }
                case 'metodo_pago':
                    return normalizar(item.metodo_pago);
                case 'total':
                    return Number(item.total) || 0;
                case 'saldo':
                    return Number(item.saldo) || 0;
                default:
                    return item[key] ?? null;
            }
        };

        const factor = sortFacturas.dir === 'asc' ? 1 : -1;
        return [...lista].sort((a, b) => {
            const va = valorOrdenFactura(a, sortFacturas.key);
            const vb = valorOrdenFactura(b, sortFacturas.key);
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            if (va < vb) return -1 * factor;
            if (va > vb) return 1 * factor;
            return 0;
        });
    }, [facturasEnriquecidas, quickChip, search, filterEmpresa, filterProveedor, filterArchivos, sortFacturas]);

    const totalPagesFacturas = Math.max(1, Math.ceil(facturasFiltradas.length / pageSizeFacturas));
    const safePageFacturas = Math.min(pageFacturas, totalPagesFacturas);
    const inicioFacturas = (safePageFacturas - 1) * pageSizeFacturas;
    const visiblesFacturas = useMemo(
        () => facturasFiltradas.slice(inicioFacturas, inicioFacturas + pageSizeFacturas),
        [facturasFiltradas, inicioFacturas, pageSizeFacturas]
    );

    useEffect(() => {
        setPageFacturas(1);
    }, [quickChip, search, filterEmpresa, filterProveedor, filterArchivos, sortFacturas, pageSizeFacturas]);

    const filtrosFacturasActivos = Boolean(
        quickChip !== 'ALL' || search.trim() || filterEmpresa || filterProveedor || filterArchivos !== 'ALL'
    );

    const limpiarFiltrosFacturas = useCallback(() => {
        setQuickChip('ALL');
        setSearch('');
        setFilterEmpresa('');
        setFilterProveedor('');
        setFilterArchivos('ALL');
    }, []);

    // Tab 2: Bitácora Global filtering & sorting
    const complementosFiltrados = useMemo(() => {
        const q = normalizar(logFilters.busqueda.trim());
        const lista = complementos.filter((item) => {
            if (q) {
                const texto = normalizar(
                    [item.uuid_fiscal, item.empresa, item.proveedor, item.forma_pago, item.num_pago].join(' ')
                );
                if (!texto.includes(q)) return false;
            }
            if (logFilters.empresa && item.empresa !== logFilters.empresa) return false;
            if (logFilters.proveedor && item.proveedor !== logFilters.proveedor) return false;
            if (logFilters.formaPago && item.forma_pago !== logFilters.formaPago) return false;

            if (logFilters.desde || logFilters.hasta) {
                const dia = obtenerFechaLocalParaInput(item.fecha_pago).slice(0, 10);
                if (!dia) return false;
                if (logFilters.desde && dia < logFilters.desde) return false;
                if (logFilters.hasta && dia > logFilters.hasta) return false;
            }

            const falta = item.falta_pagar;
            if (logFilters.saldo === 'pendiente' && !(falta != null && Number(falta) > 0)) return false;
            if (logFilters.saldo === 'liquidado' && !(falta != null && Number(falta) === 0)) return false;
            if (logFilters.saldo === 'sin_dato' && falta != null) return false;

            const tienePdf = Boolean(item.url_pdf);
            const tieneXml = Boolean(item.url_xml);
            if (logFilters.archivos === 'completos' && !(tienePdf && tieneXml)) return false;
            if (logFilters.archivos === 'con_pdf' && !tienePdf) return false;
            if (logFilters.archivos === 'con_xml' && !tieneXml) return false;
            if (logFilters.archivos === 'sin_pdf' && tienePdf) return false;
            if (logFilters.archivos === 'sin_xml' && tieneXml) return false;
            if (logFilters.archivos === 'sin_archivos' && (tienePdf || tieneXml)) return false;

            return true;
        });

        const valorOrdenLog = (item, key) => {
            switch (key) {
                case 'empresa':
                    return normalizar(item.empresa);
                case 'fecha_pago': {
                    const t = new Date(item.fecha_pago).getTime();
                    return Number.isNaN(t) ? null : t;
                }
                case 'num_pago':
                case 'monto_pago':
                case 'falta_pagar':
                    return item[key] == null || item[key] === '' ? null : Number(item[key]);
                default:
                    return item[key] ?? null;
            }
        };

        const factor = sortLog.dir === 'asc' ? 1 : -1;
        return [...lista].sort((a, b) => {
            const va = valorOrdenLog(a, sortLog.key);
            const vb = valorOrdenLog(b, sortLog.key);
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            if (va < vb) return -1 * factor;
            if (va > vb) return 1 * factor;
            return 0;
        });
    }, [complementos, logFilters, sortLog]);

    const filtrosLogActivos = useMemo(
        () => Object.entries(logFilters).filter(([k, v]) => v !== '' && v !== initialLogFilters[k]).length,
        [logFilters]
    );

    const totalPagesLog = Math.max(1, Math.ceil(complementosFiltrados.length / pageSizeLog));
    const safePageLog = Math.min(pageLog, totalPagesLog);
    const inicioLog = (safePageLog - 1) * pageSizeLog;
    const visiblesLog = useMemo(
        () => complementosFiltrados.slice(inicioLog, inicioLog + pageSizeLog),
        [complementosFiltrados, inicioLog, pageSizeLog]
    );

    useEffect(() => {
        setPageLog(1);
    }, [logFilters, sortLog, pageSizeLog]);

    const toggleSortFacturas = useCallback((key) => {
        setSortFacturas((prev) =>
            prev.key === key
                ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: key === 'empresa' ? 'asc' : 'desc' }
        );
    }, []);

    const toggleSortLog = useCallback((key) => {
        setSortLog((prev) =>
            prev.key === key
                ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: key === 'empresa' ? 'asc' : 'desc' }
        );
    }, []);

    const handleKpiFilter = useCallback((chipId) => {
        setActiveTab('facturas');
        setQuickChip((prev) => (prev === chipId && chipId !== 'ALL' ? 'ALL' : chipId));
        if (chipId === 'INCOMPLETE') {
            setFilterArchivos((prev) => (prev === 'INCOMPLETE' ? 'ALL' : 'INCOMPLETE'));
        } else {
            setFilterArchivos('ALL');
        }
    }, []);

    const toggleAccordion = useCallback((idFactura) => {
        const id = Number(idFactura);
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const irAFacturaDesdeBitacora = useCallback((idFactura) => {
        const id = Number(idFactura);
        setActiveTab('facturas');
        setQuickChip('ALL');
        setSearch('');
        setFilterEmpresa('');
        setFilterProveedor('');
        setFilterArchivos('ALL');
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }, []);

    // Helpers for Payment Modal
    const saldoFactura = useCallback((idFactura) => {
        if (!idFactura) return null;
        return facturasEnriquecidas.find((f) => Number(f.id_factura) === Number(idFactura)) || null;
    }, [facturasEnriquecidas]);

    const datosSiguientePago = useCallback((idFactura, customFactura) => {
        if (!idFactura) return { numPago: '', saldoAnterior: '', saldo: null };
        const resumen = customFactura || saldoFactura(idFactura);
        const previos = complementos.filter((c) => Number(c.id_factura) === Number(idFactura));
        const ultimoNum = Math.max(
            Number(resumen?.ultimoNumPago) || 0,
            ...previos.map((c) => Number(c.num_pago) || 0),
            0
        );
        const saldo = resumen?.saldo ?? (() => {
            const ultimo = [...previos].sort(
                (a, b) => (Number(a.num_pago) || 0) - (Number(b.num_pago) || 0)
            ).at(-1);
            return ultimo?.falta_pagar ?? null;
        })();
        return {
            numPago: ultimoNum + 1,
            saldoAnterior: saldo == null ? '' : Number(saldo).toFixed(2),
            saldo,
        };
    }, [complementos, saldoFactura]);

    const openPagoModal = useCallback((preferId, customFactura = null) => {
        const preferida = customFactura || (preferId != null
            ? ppdFacturas.find((f) => Number(f.id_factura) === Number(preferId))
            : null);
        const conSaldo = ppdFacturas.find((f) => Number(f.saldo) > 0);
        const target = preferida || conSaldo || ppdFacturas[0];
        const idFactura = target?.id_factura || '';
        const sugerido = datosSiguientePago(idFactura, target);

        faltaManualRef.current = false;
        setEditingPago(null);
        setPagoModalError('');
        setCampoErrorPago('');
        setPagoForm({
            ...initialPagoForm,
            fechaPago: obtenerFechaLocalParaInput(),
            idFactura,
            numPago: sugerido.numPago,
            saldoAnterior: sugerido.saldoAnterior,
            montoPago: '',
            faltaPagar: '',
        });
        setPagoPdf(null);
        setPagoXml(null);
        setPagoModalOpen(true);
    }, [ppdFacturas, datosSiguientePago]);

    const openEditPago = useCallback((item) => {
        faltaManualRef.current = true;
        setPagoDetalle(null);
        setEditingPago(item);
        setPagoModalError('');
        setCampoErrorPago('');
        setPagoForm({
            idFactura: item.id_factura,
            numPago: item.num_pago || '',
            fechaPago: obtenerFechaLocalParaInput(item.fecha_pago),
            saldoAnterior: item.saldo_anterior ?? '',
            montoPago: item.monto_pago ?? '',
            formaPago: item.forma_pago || '',
            faltaPagar: item.falta_pagar ?? '',
        });
        setPagoPdf(null);
        setPagoXml(null);
        setPagoModalOpen(true);
    }, []);

    const closePagoModal = useCallback(() => {
        setPagoModalOpen(false);
        setEditingPago(null);
        setPagoPdf(null);
        setPagoXml(null);
        setPagoModalError('');
        setCampoErrorPago('');
        faltaManualRef.current = false;
    }, []);

    // Support arrival with location.state?.idFactura
    useEffect(() => {
        const id = location.state?.idFactura;
        if (!id || loading) return;
        const target = ppdFacturas.find((f) => Number(f.id_factura) === Number(id));
        if (!target) return;
        setExpandedIds((prev) => new Set(prev).add(Number(id)));
        if (canRegisterPago && target.saldo > 0) {
            openPagoModal(id, target);
        }
        navigate(location.pathname, { replace: true });
    }, [location.state, location.pathname, loading, ppdFacturas, canRegisterPago, openPagoModal, navigate]);

    // Escape key closes open modals
    useEffect(() => {
        if (!modalOpen && !pagoModalOpen && !facturaDetalle && !pagoDetalle && !deleteModalOpen && !pagoToDelete && !previewPdfUrl && !previewXmlContent) {
            return undefined;
        }
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            if (previewPdfUrl) setPreviewPdfUrl(null);
            else if (previewXmlContent) setPreviewXmlContent(null);
            else if (deleteModalOpen) setDeleteModalOpen(false);
            else if (pagoToDelete && !deletingPagoId) setPagoToDelete(null);
            else if (pagoModalOpen) closePagoModal();
            else if (modalOpen) setModalOpen(false);
            else if (pagoDetalle) setPagoDetalle(null);
            else if (facturaDetalle) setFacturaDetalle(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [modalOpen, pagoModalOpen, facturaDetalle, pagoDetalle, deleteModalOpen, pagoToDelete, deletingPagoId, previewPdfUrl, previewXmlContent, closePagoModal]);

    const updatePagoField = useCallback((e) => {
        const { name, value } = e.target;
        if (name === 'faltaPagar') faltaManualRef.current = true;
        if (name) setCampoErrorPago((prev) => (prev === name ? '' : prev));
        setPagoModalError('');

        setPagoForm((prev) => {
            const next = { ...prev, [name]: value };

            if (name === 'idFactura' && !editingPago) {
                const sugerido = datosSiguientePago(value);
                next.numPago = sugerido.numPago;
                next.saldoAnterior = sugerido.saldoAnterior;
                faltaManualRef.current = false;
            }

            if (!faltaManualRef.current && ['idFactura', 'saldoAnterior', 'montoPago'].includes(name)) {
                next.faltaPagar = calcularFalta(next.saldoAnterior, next.montoPago);
            }
            return next;
        });
    }, [editingPago, datosSiguientePago]);

    const liquidarSaldoTotal = useCallback((saldo) => {
        const val = Number(saldo);
        if (Number.isNaN(val) || val <= 0) return;
        faltaManualRef.current = false;
        setPagoModalError('');
        setPagoForm((prev) => {
            const saldoBase = prev.saldoAnterior !== '' ? prev.saldoAnterior : val.toFixed(2);
            const montoStr = val.toFixed(2);
            return {
                ...prev,
                saldoAnterior: saldoBase,
                montoPago: montoStr,
                faltaPagar: calcularFalta(saldoBase, montoStr),
            };
        });
    }, []);

    const recalcularFalta = useCallback(() => {
        faltaManualRef.current = false;
        setPagoForm((prev) => ({
            ...prev,
            faltaPagar: calcularFalta(prev.saldoAnterior, prev.montoPago),
        }));
    }, []);

    const mergePpdResumen = useCallback((resumen) => {
        if (!resumen?.id_factura) return;
        setPpdResumenes((prev) => {
            const exists = prev.some((r) => Number(r.id_factura) === Number(resumen.id_factura));
            if (exists) {
                return prev.map((r) => (Number(r.id_factura) === Number(resumen.id_factura) ? { ...r, ...resumen } : r));
            }
            return [resumen, ...prev];
        });
    }, []);

    const savePago = async (event) => {
        event.preventDefault();

        const fechaPagoIso = obtenerFechaIso(pagoForm.fechaPago);
        if (!pagoForm.idFactura || !fechaPagoIso || Number(pagoForm.montoPago) <= 0) {
            setPagoModalError('Selecciona una factura PPD, fecha y monto mayor a cero');
            return;
        }

        if (pagoForm.saldoAnterior !== '' && Number(pagoForm.montoPago) > Number(pagoForm.saldoAnterior)) {
            setPagoModalError('El monto pagado no puede ser mayor al saldo anterior');
            return;
        }

        if (pagoForm.numPago !== '') {
            const duplicado = complementos.some(
                (c) =>
                    Number(c.id_factura) === Number(pagoForm.idFactura) &&
                    Number(c.num_pago) === Number(pagoForm.numPago) &&
                    c.id_detalle_factura !== editingPago?.id_detalle_factura
            );
            if (duplicado) {
                setPagoModalError(`Ya existe el pago número ${pagoForm.numPago} para esta factura`);
                return;
            }
        }

        const errPdf = validarArchivo(pagoPdf, 'pdf');
        if (errPdf) return setPagoModalError(errPdf);
        const errXml = validarArchivo(pagoXml, 'xml');
        if (errXml) return setPagoModalError(errXml);

        const data = new FormData();
        const campos = {
            num_pago: pagoForm.numPago,
            fecha_pago: fechaPagoIso,
            saldo_anterior: pagoForm.saldoAnterior,
            monto_pago: pagoForm.montoPago,
            forma_pago: pagoForm.formaPago,
            falta_pagar: pagoForm.faltaPagar,
        };
        Object.entries(campos).forEach(([k, v]) => data.append(k, v ?? ''));
        if (pagoPdf) data.append('archivo_pdf', pagoPdf);
        if (pagoXml) data.append('archivo_xml', pagoXml);

        setSavingPago(true);
        setCampoErrorPago('');
        setPagoModalError('');
        try {
            if (editingPago) {
                const { data: updated } = await client.put(
                    `/facturas/complementos/${editingPago.id_detalle_factura}`,
                    data
                );
                const { factura: resumen, ...detalle } = updated;
                setComplementos((prev) =>
                    prev.map((item) =>
                        item.id_detalle_factura === detalle.id_detalle_factura
                            ? { ...item, ...detalle }
                            : item
                    )
                );
                mergePpdResumen(resumen);
                notifySuccess('Complemento de pago actualizado correctamente.');
            } else {
                const { data: created } = await client.post(
                    `/facturas/${pagoForm.idFactura}/complementos`,
                    data
                );
                const { factura: resumen, ...detalle } = created;
                const facInfo = saldoFactura(pagoForm.idFactura);
                const enriched = {
                    ...detalle,
                    id_factura: Number(pagoForm.idFactura),
                    uuid_fiscal: resumen?.uuid_fiscal ?? detalle.uuid_fiscal ?? facInfo?.uuid_fiscal,
                    empresa: resumen?.empresa ?? detalle.empresa ?? facInfo?.empresa,
                    proveedor: resumen?.proveedor ?? detalle.proveedor ?? facInfo?.proveedor,
                };
                setComplementos((prev) => [enriched, ...prev]);
                mergePpdResumen(resumen);
                setExpandedIds((prev) => new Set(prev).add(Number(pagoForm.idFactura)));
                notifySuccess('Complemento de pago registrado correctamente.');
            }
            closePagoModal();
            void refreshPpdYComplementos();
        } catch (err) {
            const campo = campoACamel(err.response?.data?.campo);
            setCampoErrorPago(campo);
            setPagoModalError(err.response?.data?.error || 'No se pudo guardar el complemento');
        } finally {
            setSavingPago(false);
        }
    };

    const removePago = async (item) => {
        if (deletingPagoId) return;
        setDeletingPagoId(item.id_detalle_factura);
        try {
            await client.delete(`/facturas/complementos/${item.id_detalle_factura}`);
            setComplementos((prev) => prev.filter((c) => c.id_detalle_factura !== item.id_detalle_factura));
            setPagoDetalle((prev) => (prev?.id_detalle_factura === item.id_detalle_factura ? null : prev));
            setPagoToDelete(null);
            notifySuccess('Complemento eliminado correctamente.');
            void refreshPpdYComplementos();
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudo eliminar el complemento');
        } finally {
            setDeletingPagoId(null);
        }
    };

    const openComplementoFile = async (item, type) => {
        try {
            const { data } = await client.get(`/facturas/complementos/${item.id_detalle_factura}/url?tipo=${type}`);
            const url = data.url || (type === 'pdf' ? data.pdf_url : data.xml_url);
            if (!url) {
                setError(`No hay archivo ${type.toUpperCase()} disponible`);
                return;
            }
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudo abrir el archivo del complemento');
        }
    };

    // Export CSV contextual to active tab
    const handleExportCsv = useCallback(() => {
        if (activeTab === 'bitacora') {
            if (complementosFiltrados.length === 0) {
                setError('No hay complementos para exportar con los filtros actuales');
                return;
            }
            const encabezados = [
                'UUID fiscal', 'Empresa', 'Proveedor', 'No. pago', 'Fecha de pago',
                'Saldo anterior', 'Monto pagado', 'Forma de pago', 'Falta por pagar', 'PDF', 'XML',
            ];
            const filas = complementosFiltrados.map((c) => [
                c.uuid_fiscal, c.empresa, c.proveedor, c.num_pago, mostrarFechaCompleta(c.fecha_pago),
                c.saldo_anterior, c.monto_pago, c.forma_pago, c.falta_pagar,
                c.url_pdf ? 'Sí' : 'No', c.url_xml ? 'Sí' : 'No',
            ]);
            descargarCsv(encabezados, filas, `complementos_pago_${new Date().toISOString().slice(0, 10)}.csv`);
            notifySuccess(`Se exportaron ${complementosFiltrados.length} complemento(s) a CSV.`);
            return;
        }

        if (facturasFiltradas.length === 0) {
            setError('No hay facturas para exportar con los filtros actuales');
            return;
        }
        const encabezados = [
            'UUID fiscal', 'Compra', 'Empresa', 'Proveedor', 'Fecha emisión',
            'Subtotal', 'IVA', 'Total', 'Método', 'Uso CFDI', 'Pagado', 'Saldo', 'Estado pago', 'No. pagos', 'PDF', 'XML',
        ];
        const filas = facturasFiltradas.map((f) => [
            f.uuid_fiscal, f.id_compra, f.empresa, f.proveedor, mostrarFechaCorta(f.fecha_emision),
            f.monto_subtotal, f.monto_iva, f.total, f.metodo_pago, f.uso_cfdi,
            f.pagado, f.saldo, f.estadoPago, f.numPagos,
            f.archivo_url ? 'Sí' : 'No', f.archivo_xml_url ? 'Sí' : 'No',
        ]);
        descargarCsv(encabezados, filas, `facturas_y_saldos_${new Date().toISOString().slice(0, 10)}.csv`);
        notifySuccess(`Se exportaron ${facturasFiltradas.length} factura(s) a CSV.`);
    }, [activeTab, complementosFiltrados, facturasFiltradas, notifySuccess]);

    // Nueva Factura modal helpers
    const subtotalNum = Number(montoSubtotal) || 0;
    const ivaNum = Number(montoIva) || 0;
    const totalFacturaModal = subtotalNum + ivaNum;
    const montosValidos = subtotalNum >= 0 && ivaNum >= 0 && totalFacturaModal > 0;
    const puedeGuardar = Boolean(idCompra) && Boolean(uuidFiscal.trim()) && montosValidos;

    const comprasSinFactura = useMemo(() => {
        const comprasConFactura = new Set(
            facturas
                .map((f) => f.id_compra)
                .filter(Boolean)
                .map(Number)
        );
        return compras.filter(
            (c) => !comprasConFactura.has(Number(c.id_compra)) && !c.tiene_factura
        );
    }, [compras, facturas]);

    const handleOpenCreate = () => {
        void fetchCompras();
        setIdCompra('');
        setUuidFiscal(crypto.randomUUID ? crypto.randomUUID() : '');
        setRfcEmisor('');
        setRfcReceptor('');
        setFechaEmision(new Date().toISOString().split('T')[0]);
        setMontoSubtotal('');
        setMontoIva('');
        setMetodoPago('PPD');
        setUsoCfdi('G01');
        setArchivoPdf(null);
        setArchivoXml(null);
        setXmlParseNotice('');
        continueToPagoRef.current = false;
        setError('');
        setModalOpen(true);
    };

    const handlePdfChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const errMsg = validarArchivo(file, 'pdf');
        if (errMsg) {
            setError(errMsg);
            return;
        }
        setArchivoPdf(file);
        setError('');
    };

    const handleXmlChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const errMsg = validarArchivo(file, 'xml');
        if (errMsg) {
            setError(errMsg);
            return;
        }

        setArchivoXml(file);
        setError('');

        try {
            const text = await file.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'text/xml');

            const timbre = xmlDoc.getElementsByTagName('tfd:TimbreFiscalDigital')[0] ||
                xmlDoc.getElementsByTagName('TimbreFiscalDigital')[0];
            const parsedUuid = timbre?.getAttribute('UUID');

            const comprobante = xmlDoc.getElementsByTagName('cfdi:Comprobante')[0] ||
                xmlDoc.getElementsByTagName('Comprobante')[0];
            const parsedFecha = comprobante?.getAttribute('Fecha')?.split('T')[0];
            const parsedSubtotal = comprobante?.getAttribute('SubTotal');
            const parsedMetodoPago = comprobante?.getAttribute('MetodoPago');

            const emisor = xmlDoc.getElementsByTagName('cfdi:Emisor')[0] ||
                xmlDoc.getElementsByTagName('Emisor')[0];
            const parsedRfcEmisor = emisor?.getAttribute('Rfc');

            const receptor = xmlDoc.getElementsByTagName('cfdi:Receptor')[0] ||
                xmlDoc.getElementsByTagName('Receptor')[0];
            const parsedRfcReceptor = receptor?.getAttribute('Rfc');
            const parsedUsoCfdi = receptor?.getAttribute('UsoCFDI');

            let parsedIva = null;
            const allImpuestos = Array.from(xmlDoc.getElementsByTagName('*')).filter(
                (el) => el.localName === 'Impuestos'
            );
            for (const imp of allImpuestos) {
                const totalTras = imp.getAttribute('TotalImpuestosTrasladados');
                if (totalTras !== null && totalTras !== undefined && totalTras !== '') {
                    parsedIva = totalTras;
                    break;
                }
            }

            if (!parsedIva) {
                const allTraslados = Array.from(xmlDoc.getElementsByTagName('*')).filter(
                    (el) => el.localName === 'Traslado'
                );
                const ivaTraslados = allTraslados.filter(
                    (t) => (t.getAttribute('Impuesto') === '002' || !t.hasAttribute('Impuesto')) && t.getAttribute('Importe')
                );
                if (ivaTraslados.length > 0) {
                    const sum = ivaTraslados.reduce((acc, t) => acc + (parseFloat(t.getAttribute('Importe')) || 0), 0);
                    if (sum > 0) parsedIva = sum.toFixed(2);
                }
            }

            let camposRellenados = 0;
            if (parsedUuid) { setUuidFiscal(parsedUuid); camposRellenados++; }
            if (parsedRfcEmisor) { setRfcEmisor(parsedRfcEmisor.toUpperCase()); camposRellenados++; }
            if (parsedRfcReceptor) { setRfcReceptor(parsedRfcReceptor.toUpperCase()); camposRellenados++; }
            if (parsedFecha) { setFechaEmision(parsedFecha); camposRellenados++; }
            if (parsedSubtotal) { setMontoSubtotal(parsedSubtotal); camposRellenados++; }
            if (parsedIva !== null && parsedIva !== undefined) { setMontoIva(parsedIva); camposRellenados++; }
            if (parsedMetodoPago && ['PUE', 'PPD'].includes(parsedMetodoPago.toUpperCase())) {
                setMetodoPago(parsedMetodoPago.toUpperCase());
                camposRellenados++;
            }
            if (parsedUsoCfdi) { setUsoCfdi(parsedUsoCfdi.toUpperCase()); camposRellenados++; }

            if (camposRellenados > 0) {
                setXmlParseNotice(`¡XML procesado! Se autocompletaron ${camposRellenados} campos fiscales.`);
            }
        } catch (err) {
            console.warn('No se pudo autocompletar desde el XML:', err);
        }
    };

    const handleSubmitFactura = async (e) => {
        e.preventDefault();
        if (!idCompra) {
            setError('Debes seleccionar una compra asociada');
            return;
        }
        if (!uuidFiscal.trim()) {
            setError('El UUID fiscal es obligatorio');
            return;
        }
        if (!montosValidos) {
            setError('Los montos deben ser números mayores o iguales a cero y el total mayor a cero');
            return;
        }

        const abrirPagoAlGuardar = continueToPagoRef.current;
        continueToPagoRef.current = false;

        setActionLoading(true);
        setError('');
        setSuccess('');

        const formData = new FormData();
        formData.append('id_compra', idCompra);
        formData.append('uuid_fiscal', uuidFiscal.trim());
        if (rfcEmisor) formData.append('rfc_emisor', rfcEmisor.trim().toUpperCase());
        if (rfcReceptor) formData.append('rfc_receptor', rfcReceptor.trim().toUpperCase());
        formData.append('fecha_emision', fechaEmision);
        formData.append('monto_subtotal', montoSubtotal || '0');
        formData.append('monto_iva', montoIva || '0');
        formData.append('metodo_pago', metodoPago);
        formData.append('uso_cfdi', usoCfdi);
        if (archivoPdf) formData.append('archivo_pdf', archivoPdf);
        if (archivoXml) formData.append('archivo_xml', archivoXml);

        try {
            const { data } = await client.post('/facturas', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setFacturas((prev) => [data, ...prev]);

            let mensaje = 'Factura registrada exitosamente.';
            const adjuntos = [];
            if (archivoPdf) adjuntos.push('PDF');
            if (archivoXml) adjuntos.push('XML');
            if (adjuntos.length > 0) mensaje += ` (Archivos guardados: ${adjuntos.join(' + ')})`;

            setModalOpen(false);
            void fetchCompras();

            if (metodoPago === 'PPD' && data?.id_factura) {
                const totalNuevo = (Number(data.monto_subtotal) || subtotalNum) + (Number(data.monto_iva) || ivaNum);
                const nuevaPpd = {
                    ...data,
                    total: totalNuevo,
                    pagado: 0,
                    saldo: totalNuevo,
                    estado: 'PENDIENTE',
                    num_pagos: 0,
                    ultimo_num_pago: 0,
                };
                mergePpdResumen(nuevaPpd);
                setExpandedIds((prev) => new Set(prev).add(Number(data.id_factura)));

                if (abrirPagoAlGuardar && canRegisterPago) {
                    notifySuccess('Factura PPD guardada. Registra ahora su primer complemento de pago.');
                    openPagoModal(data.id_factura, {
                        ...nuevaPpd,
                        estadoPago: 'PENDIENTE',
                        numPagos: 0,
                        ultimoNumPago: 0,
                        pagos: [],
                    });
                    return;
                }
            }

            notifySuccess(mensaje);
            void refreshPpdYComplementos();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al registrar la factura');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCopyUuid = useCallback((uuid) => {
        if (!uuid) return;
        navigator.clipboard?.writeText(uuid).then(
            () => notifySuccess(`UUID copiado al portapapeles: ${uuid}`, 2800),
            () => setError('No se pudo copiar el UUID al portapapeles')
        );
    }, [notifySuccess]);

    const handleVerPdf = async (factura) => {
        if (!factura.archivo_url) {
            setError('Esta factura no tiene un archivo PDF adjunto');
            return;
        }
        setActionLoading(true);
        try {
            const { data } = await client.get(`/facturas/${factura.id_factura}/url?tipo=pdf`);
            const signedUrl = data.pdf_url || data.url;
            if (!signedUrl) throw new Error('No se pudo generar el enlace seguro');

            const cleanUuid = factura.uuid_fiscal || `Factura_${factura.id_factura}`;
            setPreviewPdfUrl(signedUrl);
            setPreviewPdfTitle(`Factura ${cleanUuid.substring(0, 8)} - ${factura.empresa || 'Doc'}`);
            setPreviewPdfFilename(`Factura_${cleanUuid}.pdf`);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al abrir el PDF');
        } finally {
            setActionLoading(false);
        }
    };

    const handleVerXml = async (factura) => {
        if (!factura.archivo_xml_url) {
            setError('Esta factura no tiene un archivo XML adjunto');
            return;
        }
        setActionLoading(true);
        try {
            const { data } = await client.get(`/facturas/${factura.id_factura}/url?tipo=xml`);
            const signedUrl = data.xml_url || data.url;
            if (!signedUrl) throw new Error('No se pudo generar el enlace del XML');

            const res = await fetch(signedUrl);
            const xmlText = await res.text();
            const formatted = formatXml(xmlText);

            const cleanUuid = factura.uuid_fiscal || `Factura_${factura.id_factura}`;
            setPreviewXmlContent(formatted);
            setPreviewXmlTitle(`Comprobante Fiscal XML — ${cleanUuid.substring(0, 13)}...`);
            setPreviewXmlDownloadUrl(signedUrl);
            setPreviewXmlFilename(`Factura_${cleanUuid}.xml`);
            setXmlCopied(false);
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Error al abrir el archivo XML');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCopyXmlContent = () => {
        if (!previewXmlContent) return;
        navigator.clipboard?.writeText(previewXmlContent);
        setXmlCopied(true);
        setTimeout(() => setXmlCopied(false), 2500);
    };

    const handleConfirmDeleteFactura = async () => {
        if (!facturaToDelete) return;
        setActionLoading(true);
        setError('');
        setSuccess('');
        try {
            await client.delete(`/facturas/${facturaToDelete.id_factura}`);
            const idDel = Number(facturaToDelete.id_factura);
            setFacturas((prev) => prev.filter((f) => Number(f.id_factura) !== idDel));
            setPpdResumenes((prev) => prev.filter((r) => Number(r.id_factura) !== idDel));
            setComplementos((prev) => prev.filter((c) => Number(c.id_factura) !== idDel));
            if (facturaDetalle && Number(facturaDetalle.id_factura) === idDel) {
                setFacturaDetalle(null);
            }
            notifySuccess(`Factura con UUID ${facturaToDelete.uuid_fiscal} eliminada correctamente`);
            setDeleteModalOpen(false);
            setFacturaToDelete(null);
            void fetchCompras();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al eliminar la factura');
        } finally {
            setActionLoading(false);
        }
    };

    const facturaEditando = editingPago
        ? facturasEnriquecidas.find((f) => Number(f.id_factura) === Number(editingPago.id_factura))
        : null;
    const facturaPagoSeleccionada = !editingPago ? saldoFactura(pagoForm.idFactura) : null;
    const facturaBannerActual = editingPago ? facturaEditando : facturaPagoSeleccionada;

    const countsChips = useMemo(() => ({
        all: facturasEnriquecidas.length,
        ppdOpen: facturasEnriquecidas.filter((f) => f.metodo_pago === 'PPD' && f.saldo > 0).length,
        ppdDone: facturasEnriquecidas.filter((f) => f.metodo_pago === 'PPD' && f.saldo <= 0).length,
        pue: facturasEnriquecidas.filter((f) => f.metodo_pago === 'PUE').length,
    }), [facturasEnriquecidas]);

    return (
        <Layout>
            <div className="facturas-container">
                {/* ── Header Unificado ── */}
                <div className="facturas-header">
                    <div>
                        <h1 className="facturas-header__title">
                            <span className="facturas-header__icon-box">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
                                    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                                    <path d="M12 17.5v-11" />
                                </svg>
                            </span>
                            Centro de Facturas y Pagos
                        </h1>
                        <p className="facturas-header__subtitle">
                            Control fiscal CFDI, estado de cuenta PPD y complementos de pago en una sola pantalla
                        </p>
                    </div>

                    <div className="facturas-header__actions">
                        <button
                            type="button"
                            className="facturas-btn facturas-btn--secondary"
                            onClick={loadAllData}
                            disabled={loading || actionLoading}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'facturas-btn__spin' : ''}>
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                            <span>Refrescar</span>
                        </button>

                        <button
                            type="button"
                            className="facturas-btn facturas-btn--secondary"
                            onClick={handleExportCsv}
                            disabled={loading}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            <span>Exportar CSV</span>
                        </button>

                        {isAdmin && (
                            <button
                                type="button"
                                className="facturas-btn facturas-btn--primary"
                                onClick={handleOpenCreate}
                                disabled={actionLoading}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                <span>Nueva Factura</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Alerts ── */}
                {error && (
                    <div className="facturas-alert facturas-alert--error" role="alert">
                        <div className="facturas-alert__content">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                            <span>{error}</span>
                        </div>
                        <button type="button" className="facturas-alert__close" onClick={() => setError('')} aria-label="Cerrar alerta">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                {success && (
                    <div className="facturas-alert facturas-alert--success" role="status">
                        <div className="facturas-alert__content">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            <span>{success}</span>
                        </div>
                        <button type="button" className="facturas-alert__close" onClick={() => setSuccess('')} aria-label="Cerrar alerta">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* ── 4 Tarjetas KPI Interactivas (Filtros en 1 clic) ── */}
                {!loading && facturasEnriquecidas.length > 0 && (
                    <section className="facturas-kpis" aria-label="Resumen de facturas y pagos">
                        <button
                            type="button"
                            className={`facturas-kpi-card facturas-kpi-card--interactive ${quickChip === 'ALL' && activeTab === 'facturas' ? 'facturas-kpi-card--active' : ''}`}
                            onClick={() => handleKpiFilter('ALL')}
                        >
                            <div className="facturas-kpi-card__top">
                                <span className="facturas-kpi-card__label">Facturas Totales</span>
                                <span className="facturas-kpi-card__icon facturas-kpi-card__icon--blue">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="4" y="3" width="16" height="18" rx="2" />
                                        <line x1="8" y1="8" x2="16" y2="8" />
                                        <line x1="8" y1="12" x2="16" y2="12" />
                                    </svg>
                                </span>
                            </div>
                            <span className="facturas-kpi-card__val">{kpis.totalRegistros} registradas</span>
                            <span className="facturas-kpi-card__sub">
                                <span>{formatoMoneda(kpis.sumaFacturado)} facturado</span>
                                <span className="facturas-kpi-card__hint">Ver todas</span>
                            </span>
                        </button>

                        <button
                            type="button"
                            className={`facturas-kpi-card facturas-kpi-card--interactive ${quickChip === 'PPD_OPEN' && activeTab === 'facturas' ? 'facturas-kpi-card--active-amber' : ''}`}
                            onClick={() => handleKpiFilter('PPD_OPEN')}
                        >
                            <div className="facturas-kpi-card__top">
                                <span className="facturas-kpi-card__label">Saldo Pendiente PPD</span>
                                <span className="facturas-kpi-card__icon facturas-kpi-card__icon--amber">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                </span>
                            </div>
                            <span className={`facturas-kpi-card__val ${kpis.saldoPendiente > 0 ? 'facturas-kpi-card__val--amber' : ''}`}>
                                {formatoMoneda(kpis.saldoPendiente)}
                            </span>
                            <span className="facturas-kpi-card__sub">
                                <span>{kpis.ppdAbiertasCount} factura(s) PPD abierta(s)</span>
                                <span className="facturas-kpi-card__hint">Clic p/ filtrar</span>
                            </span>
                        </button>

                        <button
                            type="button"
                            className={`facturas-kpi-card facturas-kpi-card--interactive ${quickChip === 'PAID' && activeTab === 'facturas' ? 'facturas-kpi-card--active' : ''}`}
                            onClick={() => handleKpiFilter('PAID')}
                        >
                            <div className="facturas-kpi-card__top">
                                <span className="facturas-kpi-card__label">Total Pagado / Abonado</span>
                                <span className="facturas-kpi-card__icon facturas-kpi-card__icon--green">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="12" y1="1" x2="12" y2="23" />
                                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                    </svg>
                                </span>
                            </div>
                            <span className="facturas-kpi-card__val">{formatoMoneda(kpis.totalPagado)}</span>
                            <span className="facturas-kpi-card__sub">
                                <span>{complementos.length} complementos · {kpis.pueCount} PUE</span>
                                <span className="facturas-kpi-card__hint">Liquidadas</span>
                            </span>
                        </button>

                        <button
                            type="button"
                            className={`facturas-kpi-card facturas-kpi-card--interactive ${quickChip === 'INCOMPLETE' && activeTab === 'facturas' ? 'facturas-kpi-card--active-amber' : ''}`}
                            onClick={() => handleKpiFilter('INCOMPLETE')}
                        >
                            <div className="facturas-kpi-card__top">
                                <span className="facturas-kpi-card__label">Expediente Fiscal CFDI</span>
                                <span className="facturas-kpi-card__icon facturas-kpi-card__icon--cyan">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                </span>
                            </div>
                            <span className="facturas-kpi-card__val">{kpis.conAlgunArchivo} con XML/PDF</span>
                            <span className="facturas-kpi-card__sub">
                                <span>{kpis.sinArchivos} sin archivos</span>
                                <span className="facturas-kpi-card__hint">Incompletas</span>
                            </span>
                        </button>
                    </section>
                )}

                {/* ── Pestañas Segmentadas ── */}
                <div className="facturas-view-bar">
                    <div className="facturas-segmented-tabs" role="tablist" aria-label="Vistas de facturación">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'bitacora'}
                            className={`facturas-seg-tab ${activeTab === 'bitacora' ? 'facturas-seg-tab--active' : ''}`}
                            onClick={() => setActiveTab('bitacora')}
                        >
                            <span>Bitácora Global de Pagos</span>
                            <span className="facturas-seg-tab__count">{complementos.length}</span>
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'facturas'}
                            className={`facturas-seg-tab ${activeTab === 'facturas' ? 'facturas-seg-tab--active' : ''}`}
                            onClick={() => setActiveTab('facturas')}
                        >
                            <span>Facturas y Estado de Cuenta</span>
                            <span className="facturas-seg-tab__count">{facturasEnriquecidas.length}</span>
                        </button>
                    </div>

                    {activeTab === 'bitacora' && canRegisterPago && (
                        <button
                            type="button"
                            className="facturas-btn facturas-btn--primary facturas-btn--sm"
                            onClick={() => openPagoModal(null)}
                            disabled={ppdFacturas.length === 0}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            <span>Nuevo Complemento</span>
                        </button>
                    )}
                </div>

                
                {activeTab === 'facturas' && (
                    <>
                        <section className="facturas-filters-card" aria-label="Filtros de facturas">
                            <div className="facturas-chips-row">
                                <span className="facturas-chips-row__label">Vista rápida:</span>
                                <button
                                    type="button"
                                    className={`facturas-chip ${quickChip === 'ALL' ? 'facturas-chip--active' : ''}`}
                                    onClick={() => handleKpiFilter('ALL')}
                                >
                                    Todas ({countsChips.all})
                                </button>
                                <button
                                    type="button"
                                    className={`facturas-chip ${quickChip === 'PPD_OPEN' ? 'facturas-chip--active-amber' : ''}`}
                                    onClick={() => handleKpiFilter('PPD_OPEN')}
                                >
                                    PPD por Pagar ({countsChips.ppdOpen})
                                </button>
                                <button
                                    type="button"
                                    className={`facturas-chip ${quickChip === 'PPD_DONE' ? 'facturas-chip--active' : ''}`}
                                    onClick={() => handleKpiFilter('PPD_DONE')}
                                >
                                    PPD Liquidadas ({countsChips.ppdDone})
                                </button>
                                <button
                                    type="button"
                                    className={`facturas-chip ${quickChip === 'PUE' ? 'facturas-chip--active' : ''}`}
                                    onClick={() => handleKpiFilter('PUE')}
                                >
                                    PUE ({countsChips.pue})
                                </button>
                            </div>

                            <div className="facturas-filters-grid">
                                <div className="facturas-search-wrap" style={{ minWidth: 0 }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="facturas-search-icon">
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                    <input
                                        type="text"
                                        className="facturas-search-input"
                                        aria-label="Buscar facturas"
                                        placeholder="Buscar por UUID fiscal, empresa, proveedor o RFC..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                    {search && (
                                        <button
                                            type="button"
                                            className="facturas-search-clear"
                                            onClick={() => setSearch('')}
                                            aria-label="Limpiar búsqueda"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                <select
                                    className="facturas-select"
                                    aria-label="Filtrar por empresa"
                                    value={filterEmpresa}
                                    onChange={(e) => setFilterEmpresa(e.target.value)}
                                >
                                    <option value="">Todas las empresas</option>
                                    {opcionesFacturas.empresas.map((emp) => (
                                        <option key={emp} value={emp}>{emp}</option>
                                    ))}
                                </select>

                                <select
                                    className="facturas-select"
                                    aria-label="Filtrar por proveedor"
                                    value={filterProveedor}
                                    onChange={(e) => setFilterProveedor(e.target.value)}
                                >
                                    <option value="">Todos los proveedores</option>
                                    {opcionesFacturas.proveedores.map((prov) => (
                                        <option key={prov} value={prov}>{prov}</option>
                                    ))}
                                </select>

                                <select
                                    className="facturas-select"
                                    aria-label="Filtrar por comprobantes"
                                    value={filterArchivos}
                                    onChange={(e) => {
                                        setFilterArchivos(e.target.value);
                                        if (quickChip === 'INCOMPLETE' && e.target.value !== 'INCOMPLETE') {
                                            setQuickChip('ALL');
                                        }
                                    }}
                                >
                                    <option value="ALL">Archivos: Todos</option>
                                    <option value="INCOMPLETE">Falta PDF o XML</option>
                                    <option value="PDF">Con archivo PDF</option>
                                    <option value="XML">Con archivo XML</option>
                                    <option value="BOTH">Completos (PDF + XML)</option>
                                    <option value="NONE">Sin archivos adjuntos</option>
                                </select>
                            </div>

                            <div className="facturas-filters-footer">
                                <span className="facturas-filters-footer__count" aria-live="polite">
                                    {facturasFiltradas.length === facturasEnriquecidas.length
                                        ? `${facturasEnriquecidas.length} factura(s)`
                                        : `${facturasFiltradas.length} de ${facturasEnriquecidas.length} factura(s)`}
                                </span>
                                {filtrosFacturasActivos && (
                                    <button
                                        type="button"
                                        className="facturas-btn facturas-btn--secondary facturas-btn--xs"
                                        onClick={limpiarFiltrosFacturas}
                                    >
                                        Limpiar filtros
                                    </button>
                                )}
                            </div>
                        </section>

                        <div className="facturas-table-wrap">
                            <table className="facturas-table">
                                <thead>
                                    <tr>
                                        <SortHeader label="UUID / Compra" sortKey="uuid_fiscal" sort={sortFacturas} onSort={toggleSortFacturas} />
                                        <SortHeader label="Empresa / Proveedor" sortKey="empresa" sort={sortFacturas} onSort={toggleSortFacturas} />
                                        <SortHeader label="Emisión" sortKey="emision" sort={sortFacturas} onSort={toggleSortFacturas} className="facturas-hide-mobile" />
                                        <SortHeader label="Método / CFDI" sortKey="metodo_pago" sort={sortFacturas} onSort={toggleSortFacturas} className="facturas-hide-mobile" />
                                        <SortHeader label="Total y Avance de Pago" sortKey="total" sort={sortFacturas} onSort={toggleSortFacturas} />
                                        <th className="facturas-hide-mobile">Documentos</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan="7" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                                                <span className="facturas-btn__spin" style={{ display: 'inline-block', marginRight: '8px' }}>
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="23 4 23 10 17 10" />
                                                        <polyline points="1 20 1 14 7 14" />
                                                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                                    </svg>
                                                </span>
                                                Cargando facturas y estado de pagos...
                                            </td>
                                        </tr>
                                    ) : visiblesFacturas.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'rgba(148, 163, 184, 0.7)' }}>
                                                {filtrosFacturasActivos
                                                    ? 'No se encontraron facturas con los filtros aplicados.'
                                                    : 'No hay facturas registradas en el sistema.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        visiblesFacturas.map((factura) => {
                                            const isPpd = factura.metodo_pago === 'PPD';
                                            const isOpenPpd = isPpd && factura.saldo > 0;
                                            const isExpanded = isPpd && expandedIds.has(Number(factura.id_factura));
                                            const pct = factura.total > 0 ? Math.min(100, Math.round((factura.pagado / factura.total) * 100)) : 0;
                                            const nextNumPago = factura.pagos.length > 0
                                                ? Math.max(...factura.pagos.map((p) => Number(p.num_pago) || 0), factura.ultimoNumPago || 0) + 1
                                                : 1;

                                            return (
                                                <Fragment key={factura.id_factura}>
                                                    <tr className={isExpanded ? 'facturas-row--expanded' : undefined}>
                                                        <td>
                                                            <div className="facturas-table__uuid">
                                                                <span title={factura.uuid_fiscal || undefined}>
                                                                    {factura.uuid_fiscal ? `${factura.uuid_fiscal.substring(0, 13)}...` : '—'}
                                                                </span>
                                                                {factura.uuid_fiscal && (
                                                                    <button
                                                                        type="button"
                                                                        className="facturas-copy-btn"
                                                                        title="Copiar UUID completo"
                                                                        aria-label="Copiar UUID completo"
                                                                        onClick={() => handleCopyUuid(factura.uuid_fiscal)}
                                                                    >
                                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                                        </svg>
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="facturas-table__sub">
                                                                Compra #{factura.id_compra || '—'}
                                                            </div>
                                                            <div className="facturas-show-mobile facturas-table__sub">
                                                                {mostrarFechaCorta(factura.fecha_emision)} · {factura.metodo_pago || 'PUE'}
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{factura.empresa || 'Empresa'}</div>
                                                            <div className="facturas-table__sub">Prov: {factura.proveedor || 'Proveedor'}</div>
                                                        </td>

                                                        <td className="facturas-hide-mobile" style={{ whiteSpace: 'nowrap' }}>
                                                            <span style={{ fontSize: '0.84rem' }}>
                                                                {mostrarFechaCorta(factura.fecha_emision)}
                                                            </span>
                                                        </td>

                                                        <td className="facturas-hide-mobile">
                                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                                <span className={`facturas-badge ${isPpd ? 'facturas-badge--ppd' : 'facturas-badge--pue'}`}>
                                                                    {factura.metodo_pago || 'PUE'}
                                                                </span>
                                                                <span className="facturas-badge facturas-badge--cfdi">
                                                                    {factura.uso_cfdi || 'G01'}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        <td>
                                                            {isPpd ? (
                                                                <div className="facturas-progress-box">
                                                                    <div className="facturas-progress-box__top">
                                                                        <span className="facturas-table__total">{formatoMoneda(factura.total)}</span>
                                                                        <span className={`facturas-badge ${isOpenPpd ? 'facturas-badge--warn' : 'facturas-badge--ok'}`}>
                                                                            {isOpenPpd ? `Saldo: ${formatoMoneda(factura.saldo)}` : 'Liquidado $0.00'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="facturas-progress-track">
                                                                        <div
                                                                            className={`facturas-progress-fill ${isOpenPpd ? 'facturas-progress-fill--partial' : 'facturas-progress-fill--done'}`}
                                                                            style={{ width: `${pct}%` }}
                                                                        />
                                                                    </div>
                                                                    <div className="facturas-progress-box__sub">
                                                                        <span>Pagado {formatoMoneda(factura.pagado)} de {formatoMoneda(factura.total)}</span>
                                                                        <span>{pct}%</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="facturas-progress-box">
                                                                    <div className="facturas-progress-box__top">
                                                                        <span className="facturas-table__total">{formatoMoneda(factura.total)}</span>
                                                                        <span className="facturas-badge facturas-badge--ok">Pago único</span>
                                                                    </div>
                                                                    <div className="facturas-progress-box__sub">
                                                                        <span>Sub {formatoMoneda(factura.monto_subtotal || 0)} + IVA {formatoMoneda(factura.monto_iva || 0)}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </td>

                                                        <td className="facturas-hide-mobile">
                                                            <div className="facturas-actions-cluster">
                                                                {factura.archivo_url && (
                                                                    <button
                                                                        type="button"
                                                                        className="facturas-btn facturas-btn--pdf"
                                                                        onClick={() => handleVerPdf(factura)}
                                                                        disabled={actionLoading}
                                                                        title="Ver documento PDF"
                                                                    >
                                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                                            <circle cx="12" cy="12" r="3" />
                                                                        </svg>
                                                                        <span>PDF</span>
                                                                    </button>
                                                                )}
                                                                {factura.archivo_xml_url && (
                                                                    <button
                                                                        type="button"
                                                                        className="facturas-btn facturas-btn--xml"
                                                                        onClick={() => handleVerXml(factura)}
                                                                        disabled={actionLoading}
                                                                        title="Previsualizar y descargar archivo XML"
                                                                    >
                                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                            <polyline points="16 18 22 12 16 6" />
                                                                            <polyline points="8 6 2 12 8 18" />
                                                                        </svg>
                                                                        <span>XML</span>
                                                                    </button>
                                                                )}
                                                                {!factura.archivo_url && !factura.archivo_xml_url && (
                                                                    <span className="facturas-badge facturas-badge--nopdf">Sin archivos</span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        <td>
                                                            <div className="facturas-actions-cluster">
                                                                {isOpenPpd && canRegisterPago && (
                                                                    <button
                                                                        type="button"
                                                                        className="facturas-btn facturas-btn--primary facturas-btn--sm"
                                                                        onClick={() => openPagoModal(factura.id_factura, factura)}
                                                                        disabled={actionLoading}
                                                                    >
                                                                        + Abonar
                                                                    </button>
                                                                )}

                                                                {isPpd && (
                                                                    <button
                                                                        type="button"
                                                                        className={`facturas-btn facturas-btn--sm ${isExpanded ? 'facturas-btn--violet' : 'facturas-btn--secondary'}`}
                                                                        onClick={() => toggleAccordion(factura.id_factura)}
                                                                        aria-expanded={isExpanded}
                                                                    >
                                                                        <span>Pagos ({factura.pagos.length}) {isExpanded ? '▴' : '▾'}</span>
                                                                    </button>
                                                                )}

                                                                <button
                                                                    type="button"
                                                                    className="facturas-btn facturas-btn--secondary facturas-btn--sm"
                                                                    onClick={() => setFacturaDetalle(factura)}
                                                                    title="Ver detalles completos de la factura"
                                                                >
                                                                    Detalle
                                                                </button>

                                                                {isAdmin && (
                                                                    <button
                                                                        type="button"
                                                                        className="facturas-btn facturas-btn--danger facturas-btn--sm"
                                                                        title="Eliminar factura"
                                                                        aria-label="Eliminar factura"
                                                                        onClick={() => {
                                                                            setFacturaToDelete(factura);
                                                                            setDeleteModalOpen(true);
                                                                        }}
                                                                        disabled={actionLoading}
                                                                    >
                                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                            <polyline points="3 6 5 6 21 6" />
                                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                        </svg>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {/* ── Acordeón Inline: Historial de Complementos de Pago (REP) ── */}
                                                    {isExpanded && (
                                                        <tr className="facturas-accordion-row">
                                                            <td colSpan="7">
                                                                <div className="facturas-accordion-panel">
                                                                    <div className="facturas-accordion-panel__head">
                                                                        <div>
                                                                            <div className="facturas-accordion-panel__title">
                                                                                Historial de Complementos de Pago (REP) — {factura.empresa || 'Empresa'} · Compra #{factura.id_compra || '—'}
                                                                            </div>
                                                                            <div className="facturas-accordion-panel__summary">
                                                                                Total factura: <strong>{formatoMoneda(factura.total)}</strong> · Abonado:{' '}
                                                                                <strong>{formatoMoneda(factura.pagado)}</strong> · Saldo restante:{' '}
                                                                                <strong style={{ color: isOpenPpd ? '#fcd34d' : '#6ee7b7' }}>
                                                                                    {formatoMoneda(factura.saldo)}
                                                                                </strong>
                                                                            </div>
                                                                        </div>

                                                                        {isOpenPpd && canRegisterPago ? (
                                                                            <button
                                                                                type="button"
                                                                                className="facturas-btn facturas-btn--primary facturas-btn--sm"
                                                                                onClick={() => openPagoModal(factura.id_factura, factura)}
                                                                            >
                                                                                + Registrar Pago #{nextNumPago} (Saldo: {formatoMoneda(factura.saldo)})
                                                                            </button>
                                                                        ) : (
                                                                            <span className="facturas-badge facturas-badge--ok">
                                                                                {factura.saldo <= 0 ? 'Factura PPD 100% Liquidada' : 'Solo lectura'}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    <div className="facturas-subtable-wrap">
                                                                        <table className="facturas-subtable">
                                                                            <thead>
                                                                                <tr>
                                                                                    <th>No. Pago</th>
                                                                                    <th>Fecha</th>
                                                                                    <th>Forma de Pago</th>
                                                                                    <th>Saldo Anterior</th>
                                                                                    <th>Monto Abonado</th>
                                                                                    <th>Saldo Restante</th>
                                                                                    <th>Comprobantes</th>
                                                                                    <th>Acciones</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {factura.pagos.length === 0 ? (
                                                                                    <tr>
                                                                                        <td colSpan="8" style={{ textAlign: 'center', padding: '1.15rem', color: 'rgba(148, 163, 184, 0.7)' }}>
                                                                                            Aún no hay complementos de pago registrados para esta factura.
                                                                                        </td>
                                                                                    </tr>
                                                                                ) : (
                                                                                    factura.pagos.map((pago) => {
                                                                                        const liquidadoPago = pago.falta_pagar != null && Number(pago.falta_pagar) <= 0;
                                                                                        return (
                                                                                            <tr key={pago.id_detalle_factura}>
                                                                                                <td><strong>Pago #{pago.num_pago || '—'}</strong></td>
                                                                                                <td style={{ whiteSpace: 'nowrap' }}>{mostrarFechaCorta(pago.fecha_pago)}</td>
                                                                                                <td>{pago.forma_pago || '—'}</td>
                                                                                                <td>{formatoMoneda(pago.saldo_anterior)}</td>
                                                                                                <td style={{ color: '#34d399', fontWeight: 700 }}>
                                                                                                    {formatoMoneda(pago.monto_pago)}
                                                                                                </td>
                                                                                                <td>
                                                                                                    {formatoMoneda(pago.falta_pagar)}
                                                                                                    {liquidadoPago && (
                                                                                                        <span className="facturas-badge facturas-badge--ok" style={{ marginLeft: '6px', padding: '0.12rem 0.45rem', fontSize: '0.66rem' }}>
                                                                            Liquidado
                                                                                                        </span>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td>
                                                                                                    <div className="facturas-actions-cluster">
                                                                                                        {pago.url_pdf && (
                                                                                                            <button type="button" className="facturas-btn facturas-btn--pdf facturas-btn--xs" onClick={() => openComplementoFile(pago, 'pdf')}>
                                                                                                                PDF
                                                                                                            </button>
                                                                                                        )}
                                                                                                        {pago.url_xml && (
                                                                                                            <button type="button" className="facturas-btn facturas-btn--xml facturas-btn--xs" onClick={() => openComplementoFile(pago, 'xml')}>
                                                                                                                XML
                                                                                                            </button>
                                                                                                        )}
                                                                                                        {!pago.url_pdf && !pago.url_xml && (
                                                                                                            <span className="facturas-badge facturas-badge--nopdf">Sin archivos</span>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </td>
                                                                                                <td>
                                                                                                    <div className="facturas-actions-cluster">
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            className="facturas-btn facturas-btn--secondary facturas-btn--xs"
                                                                                                            onClick={() => setPagoDetalle(pago)}
                                                                                                        >
                                                                                                            Detalles
                                                                                                        </button>
                                                                                                        {isAdmin && (
                                                                                                            <>
                                                                                                                <button
                                                                                                                    type="button"
                                                                                                                    className="facturas-btn facturas-btn--secondary facturas-btn--xs"
                                                                                                                    onClick={() => openEditPago(pago)}
                                                                                                                >
                                                                                                                    Editar
                                                                                                                </button>
                                                                                                                <button
                                                                                                                    type="button"
                                                                                                                    className="facturas-btn facturas-btn--danger facturas-btn--xs"
                                                                                                                    onClick={() => setPagoToDelete(pago)}
                                                                                                                    disabled={deletingPagoId === pago.id_detalle_factura}
                                                                                                                >
                                                                                                                    Eliminar
                                                                                                                </button>
                                                                                                            </>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </td>
                                                                                            </tr>
                                                                                        );
                                                                                    })
                                                                                )}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {facturasFiltradas.length > 0 && (
                            <div className="facturas-pagination">
                                <div className="facturas-pagination__size">
                                    <label className="facturas-label" htmlFor="facturas-page-size">Filas por página:</label>
                                    <select
                                        id="facturas-page-size"
                                        className="facturas-select facturas-select--sm"
                                        value={pageSizeFacturas}
                                        onChange={(e) => setPageSizeFacturas(Number(e.target.value))}
                                    >
                                        {PAGE_SIZES.map((size) => (
                                            <option key={size} value={size}>{size}</option>
                                        ))}
                                    </select>
                                </div>
                                <span className="facturas-pagination__info">
                                    {inicioFacturas + 1}-{Math.min(inicioFacturas + pageSizeFacturas, facturasFiltradas.length)} de {facturasFiltradas.length}
                                </span>
                                <div className="facturas-pagination__nav">
                                    {safePageFacturas > 1 && (
                                        <>
                                            <button type="button" className="facturas-btn facturas-btn--secondary facturas-btn--sm" onClick={() => setPageFacturas(1)} aria-label="Primera página">«</button>
                                            <button type="button" className="facturas-btn facturas-btn--secondary facturas-btn--sm" onClick={() => setPageFacturas(safePageFacturas - 1)}>Anterior</button>
                                        </>
                                    )}
                                    <span className="facturas-pagination__page">Página {safePageFacturas} de {totalPagesFacturas}</span>
                                    {safePageFacturas < totalPagesFacturas && (
                                        <>
                                            <button type="button" className="facturas-btn facturas-btn--secondary facturas-btn--sm" onClick={() => setPageFacturas(safePageFacturas + 1)}>Siguiente</button>
                                            <button type="button" className="facturas-btn facturas-btn--secondary facturas-btn--sm" onClick={() => setPageFacturas(totalPagesFacturas)} aria-label="Última página">»</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ══════════════════════════════════════════════════
                    TAB 2: BITÁCORA GLOBAL DE PAGOS (AUDITORÍA REP)
                   ══════════════════════════════════════════════════ */}
                {activeTab === 'bitacora' && (
                    <>
                        <section className="facturas-filters-card" aria-label="Filtros de bitácora global de pagos">
                            <div className="facturas-search-wrap">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="facturas-search-icon">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <input
                                    type="text"
                                    name="busqueda"
                                    className="facturas-search-input"
                                    aria-label="Buscar complementos"
                                    placeholder="Buscar por UUID, empresa, proveedor o No. de pago..."
                                    value={logFilters.busqueda}
                                    onChange={(e) => setLogFilters((prev) => ({ ...prev, busqueda: e.target.value }))}
                                />
                                {logFilters.busqueda && (
                                    <button
                                        type="button"
                                        className="facturas-search-clear"
                                        onClick={() => setLogFilters((prev) => ({ ...prev, busqueda: '' }))}
                                        aria-label="Limpiar búsqueda"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            <div className="facturas-filters-grid facturas-filters-grid--log">
                                <div className="facturas-form-group">
                                    <label className="facturas-label" htmlFor="b-empresa">Empresa</label>
                                    <select
                                        id="b-empresa"
                                        className="facturas-select"
                                        style={{ minWidth: 0 }}
                                        value={logFilters.empresa}
                                        onChange={(e) => setLogFilters((prev) => ({ ...prev, empresa: e.target.value }))}
                                    >
                                        <option value="">Todas</option>
                                        {opcionesLog.empresas.map((v) => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>

                                <div className="facturas-form-group">
                                    <label className="facturas-label" htmlFor="b-proveedor">Proveedor</label>
                                    <select
                                        id="b-proveedor"
                                        className="facturas-select"
                                        style={{ minWidth: 0 }}
                                        value={logFilters.proveedor}
                                        onChange={(e) => setLogFilters((prev) => ({ ...prev, proveedor: e.target.value }))}
                                    >
                                        <option value="">Todos</option>
                                        {opcionesLog.proveedores.map((v) => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>

                                <div className="facturas-form-group">
                                    <label className="facturas-label" htmlFor="b-forma">Forma de pago</label>
                                    <select
                                        id="b-forma"
                                        className="facturas-select"
                                        style={{ minWidth: 0 }}
                                        value={logFilters.formaPago}
                                        onChange={(e) => setLogFilters((prev) => ({ ...prev, formaPago: e.target.value }))}
                                    >
                                        <option value="">Todas</option>
                                        {opcionesLog.formas.map((v) => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>

                                <div className="facturas-form-group">
                                    <label className="facturas-label" htmlFor="b-saldo">Saldo</label>
                                    <select
                                        id="b-saldo"
                                        className="facturas-select"
                                        style={{ minWidth: 0 }}
                                        value={logFilters.saldo}
                                        onChange={(e) => setLogFilters((prev) => ({ ...prev, saldo: e.target.value }))}
                                    >
                                        <option value="">Todos</option>
                                        <option value="pendiente">Con saldo pendiente</option>
                                        <option value="liquidado">Liquidado</option>
                                        <option value="sin_dato">Sin saldo registrado</option>
                                    </select>
                                </div>

                                <div className="facturas-form-group">
                                    <label className="facturas-label" htmlFor="b-archivos">Archivos REP</label>
                                    <select
                                        id="b-archivos"
                                        className="facturas-select"
                                        style={{ minWidth: 0 }}
                                        value={logFilters.archivos}
                                        onChange={(e) => setLogFilters((prev) => ({ ...prev, archivos: e.target.value }))}
                                    >
                                        <option value="">Todos</option>
                                        <option value="completos">Con PDF y XML</option>
                                        <option value="con_pdf">Con PDF</option>
                                        <option value="con_xml">Con XML</option>
                                        <option value="sin_pdf">Sin PDF</option>
                                        <option value="sin_xml">Sin XML</option>
                                        <option value="sin_archivos">Sin archivos</option>
                                    </select>
                                </div>

                                <div className="facturas-form-group">
                                    <label className="facturas-label" htmlFor="b-desde">Pagado desde</label>
                                    <input
                                        id="b-desde"
                                        type="date"
                                        max={logFilters.hasta}
                                        className="facturas-input"
                                        value={logFilters.desde}
                                        onChange={(e) => setLogFilters((prev) => ({ ...prev, desde: e.target.value }))}
                                    />
                                </div>

                                <div className="facturas-form-group">
                                    <label className="facturas-label" htmlFor="b-hasta">Pagado hasta</label>
                                    <input
                                        id="b-hasta"
                                        type="date"
                                        min={logFilters.desde}
                                        className="facturas-input"
                                        value={logFilters.hasta}
                                        onChange={(e) => setLogFilters((prev) => ({ ...prev, hasta: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="facturas-filters-footer">
                                <span className="facturas-filters-footer__count" aria-live="polite">
                                    {complementosFiltrados.length === complementos.length
                                        ? `${complementos.length} complemento(s)`
                                        : `${complementosFiltrados.length} de ${complementos.length} complemento(s)`}
                                </span>
                                {filtrosLogActivos > 0 && (
                                    <button
                                        type="button"
                                        className="facturas-btn facturas-btn--secondary facturas-btn--xs"
                                        onClick={() => setLogFilters(initialLogFilters)}
                                    >
                                        Limpiar filtros ({filtrosLogActivos})
                                    </button>
                                )}
                            </div>
                        </section>

                        <div className="facturas-table-wrap">
                            <table className="facturas-table">
                                <thead>
                                    <tr>
                                        <SortHeader label="Factura / Empresa" sortKey="empresa" sort={sortLog} onSort={toggleSortLog} />
                                        <SortHeader label="No. pago" sortKey="num_pago" sort={sortLog} onSort={toggleSortLog} className="facturas-hide-mobile" />
                                        <SortHeader label="Fecha" sortKey="fecha_pago" sort={sortLog} onSort={toggleSortLog} className="facturas-hide-mobile" />
                                        <SortHeader label="Pago" sortKey="monto_pago" sort={sortLog} onSort={toggleSortLog} />
                                        <SortHeader label="Saldo" sortKey="falta_pagar" sort={sortLog} onSort={toggleSortLog} />
                                        <th className="facturas-hide-mobile">Forma de pago</th>
                                        <th className="facturas-hide-mobile">Archivos</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan="8" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                                                Cargando bitácora de complementos...
                                            </td>
                                        </tr>
                                    ) : visiblesLog.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'rgba(148, 163, 184, 0.7)' }}>
                                                {filtrosLogActivos > 0
                                                    ? 'No se encontraron complementos que coincidan con los filtros aplicados.'
                                                    : 'No hay complementos de pago registrados.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        visiblesLog.map((item) => {
                                            const liquidado = item.falta_pagar != null && Number(item.falta_pagar) === 0;
                                            return (
                                                <tr key={item.id_detalle_factura}>
                                                    <td>
                                                        <div className="facturas-table__uuid">
                                                            <span title={item.uuid_fiscal || undefined}>
                                                                {item.uuid_fiscal ? `${item.uuid_fiscal.slice(0, 13)}...` : '—'}
                                                            </span>
                                                            {item.uuid_fiscal && (
                                                                <button
                                                                    type="button"
                                                                    className="facturas-copy-btn"
                                                                    title="Copiar UUID completo"
                                                                    onClick={() => handleCopyUuid(item.uuid_fiscal)}
                                                                >
                                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="facturas-table__sub">
                                                            {item.empresa || '—'} · {item.proveedor || '—'}
                                                        </div>
                                                        <div className="facturas-show-mobile facturas-table__sub">
                                                            Pago #{item.num_pago || '—'} · {mostrarFechaCorta(item.fecha_pago)}
                                                        </div>
                                                    </td>
                                                    <td className="facturas-hide-mobile">{item.num_pago || '—'}</td>
                                                    <td className="facturas-hide-mobile" style={{ whiteSpace: 'nowrap' }}>{mostrarFechaCorta(item.fecha_pago)}</td>
                                                    <td>
                                                        <span className="facturas-table__total">
                                                            {formatoMoneda(item.monto_pago ?? 0)}
                                                        </span>
                                                        {item.forma_pago && isMobile && (
                                                            <div className="facturas-table__sub">{item.forma_pago}</div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 700, color: liquidado ? '#6ee7b7' : '#fcd34d' }}>
                                                            {item.falta_pagar == null || item.falta_pagar === ''
                                                                ? '—'
                                                                : formatoMoneda(item.falta_pagar)}
                                                        </div>
                                                        {liquidado && (
                                                            <span className="facturas-badge facturas-badge--ok" style={{ marginTop: '4px' }}>Liquidado</span>
                                                        )}
                                                    </td>
                                                    <td className="facturas-hide-mobile">{item.forma_pago || '—'}</td>
                                                    <td className="facturas-hide-mobile">
                                                        <div className="facturas-actions-cluster">
                                                            {item.url_pdf && (
                                                                <button type="button" className="facturas-btn facturas-btn--pdf facturas-btn--xs" onClick={() => openComplementoFile(item, 'pdf')}>
                                                                    PDF
                                                                </button>
                                                            )}
                                                            {item.url_xml && (
                                                                <button type="button" className="facturas-btn facturas-btn--xml facturas-btn--xs" onClick={() => openComplementoFile(item, 'xml')}>
                                                                    XML
                                                                </button>
                                                            )}
                                                            {!item.url_pdf && !item.url_xml && (
                                                                <span className="facturas-badge facturas-badge--nopdf">Sin archivos</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="facturas-actions-cluster">
                                                            <button
                                                                type="button"
                                                                className="facturas-btn facturas-btn--violet facturas-btn--sm"
                                                                onClick={() => irAFacturaDesdeBitacora(item.id_factura)}
                                                            >
                                                                Ver en Factura
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="facturas-btn facturas-btn--secondary facturas-btn--sm"
                                                                onClick={() => setPagoDetalle(item)}
                                                            >
                                                                Detalles
                                                            </button>
                                                            {isAdmin && (
                                                                <>
                                                                    {!isMobile && (
                                                                        <button
                                                                            type="button"
                                                                            className="facturas-btn facturas-btn--secondary facturas-btn--sm"
                                                                            onClick={() => openEditPago(item)}
                                                                        >
                                                                            Editar
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        className="facturas-btn facturas-btn--danger facturas-btn--sm"
                                                                        onClick={() => setPagoToDelete(item)}
                                                                        disabled={deletingPagoId === item.id_detalle_factura}
                                                                    >
                                                                        {deletingPagoId === item.id_detalle_factura ? 'Eliminando...' : 'Eliminar'}
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {complementosFiltrados.length > 0 && (
                            <div className="facturas-pagination">
                                <div className="facturas-pagination__size">
                                    <label className="facturas-label" htmlFor="log-page-size">Filas por página:</label>
                                    <select
                                        id="log-page-size"
                                        className="facturas-select facturas-select--sm"
                                        value={pageSizeLog}
                                        onChange={(e) => setPageSizeLog(Number(e.target.value))}
                                    >
                                        {PAGE_SIZES.map((size) => (
                                            <option key={size} value={size}>{size}</option>
                                        ))}
                                    </select>
                                </div>
                                <span className="facturas-pagination__info">
                                    {inicioLog + 1}-{Math.min(inicioLog + pageSizeLog, complementosFiltrados.length)} de {complementosFiltrados.length}
                                </span>
                                <div className="facturas-pagination__nav">
                                    {safePageLog > 1 && (
                                        <>
                                            <button type="button" className="facturas-btn facturas-btn--secondary facturas-btn--sm" onClick={() => setPageLog(1)} aria-label="Primera página">«</button>
                                            <button type="button" className="facturas-btn facturas-btn--secondary facturas-btn--sm" onClick={() => setPageLog(safePageLog - 1)}>Anterior</button>
                                        </>
                                    )}
                                    <span className="facturas-pagination__page">Página {safePageLog} de {totalPagesLog}</span>
                                    {safePageLog < totalPagesLog && (
                                        <>
                                            <button type="button" className="facturas-btn facturas-btn--secondary facturas-btn--sm" onClick={() => setPageLog(safePageLog + 1)}>Siguiente</button>
                                            <button type="button" className="facturas-btn facturas-btn--secondary facturas-btn--sm" onClick={() => setPageLog(totalPagesLog)} aria-label="Última página">»</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ══════════════════════════════════════════════════
                    MODAL: REGISTRAR FACTURA FISCAL (FLUJO CONTINUO)
                   ══════════════════════════════════════════════════ */}
                {modalOpen && (
                    <div className="facturas-modal-overlay" onClick={() => setModalOpen(false)}>
                        <div className="facturas-modal" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Registrar Factura Fiscal">
                            <div className="facturas-modal__header">
                                <div>
                                    <h2 className="facturas-modal__title">Registrar Factura Fiscal</h2>
                                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                        Sube primero el XML CFDI para autollenar o captura manualmente
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="facturas-modal__close"
                                    onClick={() => setModalOpen(false)}
                                    disabled={actionLoading}
                                    aria-label="Cerrar"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmitFactura} className="facturas-modal__form">
                                {xmlParseNotice && (
                                    <div className="facturas-xml-notice">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                            <polyline points="22 4 12 14.01 9 11.01" />
                                        </svg>
                                        <span>{xmlParseNotice}</span>
                                    </div>
                                )}

                                {/* Dropzones XML & PDF primero para autollenado rápido */}
                                <div className="facturas-upload-section" style={{ marginTop: 0 }}>
                                    <span className="facturas-label" style={{ marginBottom: '8px', display: 'block' }}>
                                        Comprobantes Fiscales Digitales (XML autollena el formulario + PDF)
                                    </span>
                                    <div className="facturas-grid-2" style={{ gap: '0.75rem' }}>
                                        <div
                                            className={`facturas-dropzone ${archivoXml ? 'facturas-dropzone--active-xml' : ''}`}
                                            onClick={() => xmlInputRef.current?.click()}
                                        >
                                            <input
                                                type="file"
                                                ref={xmlInputRef}
                                                accept="text/xml,application/xml,.xml"
                                                style={{ display: 'none' }}
                                                onChange={handleXmlChange}
                                            />
                                            <div className="facturas-dropzone__icon facturas-dropzone__icon--xml">
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="16 18 22 12 16 6" />
                                                    <polyline points="8 6 2 12 8 18" />
                                                </svg>
                                            </div>
                                            <div className="facturas-dropzone__info">
                                                <span className="facturas-dropzone__title">
                                                    {archivoXml ? archivoXml.name : 'Subir Archivo XML'}
                                                </span>
                                                <span className="facturas-dropzone__sub">
                                                    {archivoXml
                                                        ? `${(archivoXml.size / 1024).toFixed(1)} KB (Autollenado)`
                                                        : 'Clic para .xml (Autollena el formulario)'}
                                                </span>
                                            </div>
                                            {archivoXml && (
                                                <button
                                                    type="button"
                                                    className="facturas-dropzone__remove"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setArchivoXml(null);
                                                        setXmlParseNotice('');
                                                    }}
                                                    title="Quitar XML"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>

                                        <div
                                            className={`facturas-dropzone ${archivoPdf ? 'facturas-dropzone--active' : ''}`}
                                            onClick={() => pdfInputRef.current?.click()}
                                        >
                                            <input
                                                type="file"
                                                ref={pdfInputRef}
                                                accept="application/pdf,.pdf"
                                                style={{ display: 'none' }}
                                                onChange={handlePdfChange}
                                            />
                                            <div className="facturas-dropzone__icon facturas-dropzone__icon--pdf">
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    <polyline points="14 2 14 8 20 8" />
                                                </svg>
                                            </div>
                                            <div className="facturas-dropzone__info">
                                                <span className="facturas-dropzone__title">
                                                    {archivoPdf ? archivoPdf.name : 'Subir Documento PDF'}
                                                </span>
                                                <span className="facturas-dropzone__sub">
                                                    {archivoPdf
                                                        ? `${(archivoPdf.size / 1024).toFixed(1)} KB (Listo)`
                                                        : 'Clic para seleccionar archivo .pdf'}
                                                </span>
                                            </div>
                                            {archivoPdf && (
                                                <button
                                                    type="button"
                                                    className="facturas-dropzone__remove"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setArchivoPdf(null);
                                                    }}
                                                    title="Quitar PDF"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="facturas-form-group">
                                    <label className="facturas-label">
                                        Compra Asociada <span className="facturas-req">*</span>
                                    </label>
                                    <select
                                        className="facturas-input"
                                        value={idCompra}
                                        onChange={(e) => setIdCompra(e.target.value)}
                                        required
                                    >
                                        <option value="">
                                            {comprasSinFactura.length === 0
                                                ? '-- No hay compras pendientes de facturar --'
                                                : '-- Seleccionar Compra --'}
                                        </option>
                                        {comprasSinFactura.map((c) => (
                                            <option key={c.id_compra} value={c.id_compra}>
                                                Compra #{c.id_compra} — {c.empresa || 'Empresa'} ({c.proveedor || 'Proveedor'}) - {c.fecha_compra ? new Date(c.fecha_compra).toLocaleDateString('es-MX') : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {comprasSinFactura.length === 0 && (
                                        <span style={{ color: '#fbbf24', fontSize: '0.78rem', marginTop: '0.35rem', display: 'block' }}>
                                            Todas las compras registradas ya cuentan con factura asociada.
                                        </span>
                                    )}
                                </div>

                                <div className="facturas-form-group">
                                    <label className="facturas-label">
                                        UUID Fiscal (Folio Digital SAT) <span className="facturas-req">*</span>
                                    </label>
                                    <div className="facturas-input-group">
                                        <input
                                            type="text"
                                            className="facturas-input"
                                            placeholder="ej. 123e4567-e89b-12d3-a456-426614174000"
                                            value={uuidFiscal}
                                            onChange={(e) => setUuidFiscal(e.target.value)}
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="facturas-btn facturas-btn--secondary"
                                            style={{ padding: '0 0.85rem' }}
                                            title="Generar UUID aleatorio"
                                            onClick={() => setUuidFiscal(crypto.randomUUID ? crypto.randomUUID() : '')}
                                        >
                                            Generar
                                        </button>
                                    </div>
                                </div>

                                <div className="facturas-grid-2">
                                    <div className="facturas-form-group">
                                        <label className="facturas-label">RFC Emisor (Proveedor)</label>
                                        <input
                                            type="text"
                                            className="facturas-input"
                                            placeholder="ej. AAA010101AAA"
                                            maxLength="13"
                                            value={rfcEmisor}
                                            onChange={(e) => setRfcEmisor(e.target.value.toUpperCase())}
                                        />
                                    </div>
                                    <div className="facturas-form-group">
                                        <label className="facturas-label">RFC Receptor (Empresa)</label>
                                        <input
                                            type="text"
                                            className="facturas-input"
                                            placeholder="ej. BBB020202BBB"
                                            maxLength="13"
                                            value={rfcReceptor}
                                            onChange={(e) => setRfcReceptor(e.target.value.toUpperCase())}
                                        />
                                    </div>
                                </div>

                                <div className="facturas-form-group">
                                    <label className="facturas-label">Fecha de Emisión</label>
                                    <input
                                        type="date"
                                        className="facturas-input"
                                        value={fechaEmision}
                                        onChange={(e) => setFechaEmision(e.target.value)}
                                    />
                                </div>

                                <div className="facturas-grid-2">
                                    <div className="facturas-form-group">
                                        <label className="facturas-label">Monto Subtotal ($ MXN)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="facturas-input"
                                            placeholder="0.00"
                                            value={montoSubtotal}
                                            onChange={(e) => setMontoSubtotal(e.target.value)}
                                        />
                                    </div>
                                    <div className="facturas-form-group">
                                        <label className="facturas-label">Monto IVA ($ MXN)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="facturas-input"
                                            placeholder="0.00"
                                            value={montoIva}
                                            onChange={(e) => setMontoIva(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="facturas-grid-2">
                                    <div className="facturas-form-group">
                                        <label className="facturas-label">Método de Pago</label>
                                        <select
                                            className="facturas-input"
                                            value={metodoPago}
                                            onChange={(e) => setMetodoPago(e.target.value)}
                                        >
                                            <option value="PUE">PUE - Pago en una sola exhibición</option>
                                            <option value="PPD">PPD - Pago en parcialidades o diferido</option>
                                        </select>
                                    </div>
                                    <div className="facturas-form-group">
                                        <label className="facturas-label">Uso de CFDI</label>
                                        <select
                                            className="facturas-input"
                                            value={usoCfdi}
                                            onChange={(e) => setUsoCfdi(e.target.value)}
                                        >
                                            <option value="G01">G01 - Adquisición de mercancías</option>
                                            <option value="G02">G02 - Devoluciones, descuentos o bonificaciones</option>
                                            <option value="G03">G03 - Gastos en general</option>
                                            <option value="I01">I01 - Construcciones</option>
                                            <option value="I02">I02 - Mobilario y equipo de oficina</option>
                                            <option value="I03">I03 - Equipo de transporte</option>
                                            <option value="I04">I04 - Equipo de cómputo y accesorios</option>
                                            <option value="I05">I05 - Dados, troqueles, moldes, matrices y herramental</option>
                                            <option value="I06">I06 - Comunicaciones telefónicas</option>
                                            <option value="I07">I07 - Comunicaciones satelitales</option>
                                            <option value="I08">I08 - Otra maquinaria y equipo</option>
                                            <option value="D01">D01 - Honorarios médicos, dentales y gastos hospitalarios</option>
                                            <option value="D02">D02 - Gastos médicos por incapacidad o discapacidad</option>
                                            <option value="D03">D03 - Gastos funerales</option>
                                            <option value="D04">D04 - Donativos</option>
                                            <option value="P01">P01 - Por definir</option>
                                            <option value="CP01">CP01 - Pagos</option>
                                            <option value="CN01">CN01 - Nómina</option>
                                            <option value="S01">S01 - Sin efectos fiscales</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="facturas-resumen" style={{ marginBottom: 0 }}>
                                    <div className="facturas-resumen__row">
                                        <span>Subtotal</span>
                                        <span>{formatoMoneda(subtotalNum)}</span>
                                    </div>
                                    <div className="facturas-resumen__row">
                                        <span>IVA</span>
                                        <span>{formatoMoneda(ivaNum)}</span>
                                    </div>
                                    <div className="facturas-resumen__row facturas-resumen__row--total">
                                        <span>Total facturado</span>
                                        <span>{formatoMoneda(totalFacturaModal)}</span>
                                    </div>
                                    <div className="facturas-resumen__row">
                                        <span>Saldo esperado</span>
                                        <span>{metodoPago === 'PPD' ? formatoMoneda(totalFacturaModal) : '—'}</span>
                                    </div>
                                    {metodoPago === 'PPD' ? (
                                        <p className="facturas-resumen__hint">
                                            Estado inicial: <strong>PENDIENTE</strong>. Puedes guardar la factura o continuar directamente al registro del primer complemento de pago.
                                        </p>
                                    ) : (
                                        <p className="facturas-resumen__hint">
                                            Con método PUE la factura se registra como <strong>PAGADO</strong>.
                                        </p>
                                    )}
                                </div>

                                <div className="facturas-modal__footer" style={{ flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        className="facturas-btn facturas-btn--secondary"
                                        onClick={() => setModalOpen(false)}
                                        disabled={actionLoading}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className={`facturas-btn ${metodoPago === 'PPD' ? 'facturas-btn--secondary' : 'facturas-btn--primary'}`}
                                        disabled={actionLoading || !puedeGuardar}
                                        onClick={() => { continueToPagoRef.current = false; }}
                                        title={puedeGuardar ? undefined : 'Selecciona una compra, un UUID y montos válidos'}
                                    >
                                        {actionLoading ? 'Guardando...' : 'Guardar Factura'}
                                    </button>
                                    {metodoPago === 'PPD' && canRegisterPago && (
                                        <button
                                            type="submit"
                                            className="facturas-btn facturas-btn--primary"
                                            disabled={actionLoading || !puedeGuardar}
                                            onClick={() => { continueToPagoRef.current = true; }}
                                            title={puedeGuardar ? undefined : 'Selecciona una compra, un UUID y montos válidos'}
                                        >
                                            {actionLoading ? 'Guardando...' : 'Guardar y Registrar 1er Pago →'}
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════
                    MODAL: REGISTRAR / EDITAR COMPLEMENTO DE PAGO PPD
                   ══════════════════════════════════════════════════ */}
                {pagoModalOpen && (
                    <div className="facturas-modal-overlay" onClick={closePagoModal}>
                        <div className="facturas-modal" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={editingPago ? 'Editar complemento de pago' : 'Registrar abono PPD'}>
                            <div className="facturas-modal__header">
                                <div>
                                    <h2 className="facturas-modal__title">
                                        {editingPago ? 'Editar Complemento de Pago' : 'Registrar Abono / Complemento PPD'}
                                    </h2>
                                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                        Pagos (REP) vinculados directamente a la factura PPD
                                    </span>
                                </div>
                                <button type="button" className="facturas-modal__close" onClick={closePagoModal} aria-label="Cerrar">
                                    ✕
                                </button>
                            </div>

                            {pagoModalError && (
                                <div className="facturas-alert facturas-alert--error" role="alert">
                                    <div className="facturas-alert__content">
                                        <span>{pagoModalError}</span>
                                    </div>
                                    <button type="button" className="facturas-alert__close" onClick={() => setPagoModalError('')} aria-label="Cerrar">✕</button>
                                </div>
                            )}

                            {facturaBannerActual && (
                                <div className="facturas-context-banner">
                                    <div className="facturas-context-banner__meta">
                                        <strong>{facturaBannerActual.empresa || 'Empresa'}</strong> · {facturaBannerActual.proveedor || 'Proveedor'} ({facturaBannerActual.uuid_fiscal?.slice(0, 13)}...)
                                        <span>
                                            Total: {formatoMoneda(facturaBannerActual.total)} · Pagado: {formatoMoneda(facturaBannerActual.pagado)} · Saldo actual:{' '}
                                            <strong style={{ color: facturaBannerActual.saldo > 0 ? '#fcd34d' : '#6ee7b7' }}>
                                                {formatoMoneda(facturaBannerActual.saldo)}
                                            </strong>
                                        </span>
                                    </div>
                                    {!editingPago && facturaBannerActual.saldo > 0 && (
                                        <button
                                            type="button"
                                            className="facturas-btn facturas-btn--primary facturas-btn--sm"
                                            onClick={() => liquidarSaldoTotal(facturaBannerActual.saldo)}
                                        >
                                            ⚡ Liquidar saldo total ({formatoMoneda(facturaBannerActual.saldo)})
                                        </button>
                                    )}
                                </div>
                            )}

                            <form onSubmit={savePago} className="facturas-modal__form">
                                <div className="facturas-form-section">
                                    <h3 className="facturas-form-section__title">Datos del pago</h3>

                                    {editingPago ? (
                                        <div className="facturas-form-group">
                                            <span className="facturas-label">Factura</span>
                                            <div className="facturas-readonly">
                                                {facturaEditando?.uuid_fiscal || editingPago.uuid_fiscal || '—'}
                                                {(facturaEditando?.empresa || editingPago.empresa) && ` · ${facturaEditando?.empresa || editingPago.empresa}`}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="facturas-form-group">
                                            <label className="facturas-label" htmlFor="p-factura">
                                                Factura PPD <span className="facturas-req">*</span>
                                            </label>
                                            <select
                                                id="p-factura"
                                                name="idFactura"
                                                className="facturas-input"
                                                value={pagoForm.idFactura}
                                                onChange={updatePagoField}
                                                required
                                            >
                                                <option value="">Selecciona una factura</option>
                                                {ppdFacturas.map((f) => (
                                                    <option key={f.id_factura} value={f.id_factura}>
                                                        {f.uuid_fiscal} — {f.empresa}
                                                        {f.saldo != null ? ` · saldo ${formatoMoneda(f.saldo)}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="facturas-grid-2">
                                        <div className="facturas-form-group">
                                            <label className="facturas-label" htmlFor="p-num">Número de pago</label>
                                            <input
                                                id="p-num"
                                                type="number"
                                                name="numPago"
                                                min="1"
                                                required
                                                className={`facturas-input${campoErrorPago === 'numPago' ? ' facturas-input--error' : ''}`}
                                                value={pagoForm.numPago}
                                                onChange={updatePagoField}
                                            />
                                        </div>

                                        <div className="facturas-form-group">
                                            <label className="facturas-label" htmlFor="p-fecha">Fecha y hora</label>
                                            <input
                                                id="p-fecha"
                                                type="datetime-local"
                                                name="fechaPago"
                                                required
                                                className={`facturas-input${campoErrorPago === 'fechaPago' ? ' facturas-input--error' : ''}`}
                                                value={pagoForm.fechaPago}
                                                onChange={updatePagoField}
                                            />
                                        </div>

                                        <div className="facturas-form-group">
                                            <label className="facturas-label" htmlFor="p-forma">Forma de pago</label>
                                            <select
                                                id="p-forma"
                                                name="formaPago"
                                                className={`facturas-input${campoErrorPago === 'formaPago' ? ' facturas-input--error' : ''}`}
                                                value={pagoForm.formaPago}
                                                onChange={updatePagoField}
                                            >
                                                <option value="">Selecciona una forma de pago</option>
                                                {formasPago.map((v) => (
                                                    <option key={v.codigo_pago} value={v.descripcion}>
                                                        {v.codigo_pago} — {v.descripcion}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="facturas-form-group">
                                            <label className="facturas-label" htmlFor="p-saldo">Saldo anterior ($ MXN)</label>
                                            <input
                                                id="p-saldo"
                                                name="saldoAnterior"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                                className="facturas-input"
                                                value={pagoForm.saldoAnterior}
                                                onChange={updatePagoField}
                                            />
                                        </div>

                                        <div className="facturas-form-group">
                                            <label className="facturas-label" htmlFor="p-monto">Monto pagado ($ MXN)</label>
                                            <input
                                                id="p-monto"
                                                name="montoPago"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                                className={`facturas-input${campoErrorPago === 'montoPago' ? ' facturas-input--error' : ''}`}
                                                value={pagoForm.montoPago}
                                                onChange={updatePagoField}
                                            />
                                        </div>

                                        <div className="facturas-form-group">
                                            <label className="facturas-label" htmlFor="p-falta">Falta por pagar</label>
                                            <input
                                                id="p-falta"
                                                name="faltaPagar"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                                className="facturas-input"
                                                value={pagoForm.faltaPagar}
                                                onChange={updatePagoField}
                                            />
                                            <small className="facturas-hint">
                                                Saldo anterior − monto pagado.{' '}
                                                <button type="button" className="facturas-link" onClick={recalcularFalta}>Recalcular</button>
                                            </small>
                                        </div>
                                    </div>
                                </div>

                                <div className="facturas-form-section">
                                    <h3 className="facturas-form-section__title">Comprobantes del complemento (PDF / XML)</h3>
                                    <div className="facturas-grid-2" style={{ gap: '0.75rem' }}>
                                        <div
                                            className={`facturas-dropzone ${pagoPdf ? 'facturas-dropzone--active' : ''}`}
                                            onClick={() => pagoPdfInputRef.current?.click()}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pagoPdfInputRef.current?.click(); } }}
                                        >
                                            <input
                                                type="file"
                                                ref={pagoPdfInputRef}
                                                accept=".pdf,application/pdf"
                                                style={{ display: 'none' }}
                                                onChange={(e) => setPagoPdf(e.target.files?.[0] || null)}
                                            />
                                            <div className="facturas-dropzone__icon facturas-dropzone__icon--pdf">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    <polyline points="14 2 14 8 20 8" />
                                                </svg>
                                            </div>
                                            <div className="facturas-dropzone__info">
                                                <span className="facturas-dropzone__title">{pagoPdf ? pagoPdf.name : 'Documento PDF REP'}</span>
                                                <span className="facturas-dropzone__sub">
                                                    {pagoPdf
                                                        ? `${(pagoPdf.size / 1024).toFixed(1)} KB · listo`
                                                        : editingPago?.url_pdf
                                                            ? 'Ya hay un PDF. Selecciona otro para reemplazarlo'
                                                            : 'Clic para seleccionar archivo .pdf'}
                                                </span>
                                            </div>
                                            {pagoPdf && (
                                                <button
                                                    type="button"
                                                    className="facturas-dropzone__remove"
                                                    aria-label="Quitar PDF"
                                                    onClick={(e) => { e.stopPropagation(); setPagoPdf(null); }}
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>

                                        <div
                                            className={`facturas-dropzone ${pagoXml ? 'facturas-dropzone--active-xml' : ''}`}
                                            onClick={() => pagoXmlInputRef.current?.click()}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pagoXmlInputRef.current?.click(); } }}
                                        >
                                            <input
                                                type="file"
                                                ref={pagoXmlInputRef}
                                                accept=".xml,text/xml,application/xml"
                                                style={{ display: 'none' }}
                                                onChange={(e) => setPagoXml(e.target.files?.[0] || null)}
                                            />
                                            <div className="facturas-dropzone__icon facturas-dropzone__icon--xml">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="16 18 22 12 16 6" />
                                                    <polyline points="8 6 2 12 8 18" />
                                                </svg>
                                            </div>
                                            <div className="facturas-dropzone__info">
                                                <span className="facturas-dropzone__title">{pagoXml ? pagoXml.name : 'Archivo XML REP'}</span>
                                                <span className="facturas-dropzone__sub">
                                                    {pagoXml
                                                        ? `${(pagoXml.size / 1024).toFixed(1)} KB · listo`
                                                        : editingPago?.url_xml
                                                            ? 'Ya hay un XML. Selecciona otro para reemplazarlo'
                                                            : 'Clic para seleccionar archivo .xml'}
                                                </span>
                                            </div>
                                            {pagoXml && (
                                                <button
                                                    type="button"
                                                    className="facturas-dropzone__remove"
                                                    aria-label="Quitar XML"
                                                    onClick={(e) => { e.stopPropagation(); setPagoXml(null); }}
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="facturas-modal__footer">
                                    <button type="button" className="facturas-btn facturas-btn--secondary" onClick={closePagoModal} disabled={savingPago}>
                                        Cancelar
                                    </button>
                                    <button type="submit" className="facturas-btn facturas-btn--primary" disabled={savingPago}>
                                        {savingPago ? 'Guardando...' : editingPago ? 'Actualizar Complemento' : 'Guardar Complemento de Pago'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── Modal: Visor de PDF ── */}
                {previewPdfUrl && (
                    <div className="facturas-modal-overlay" onClick={() => setPreviewPdfUrl(null)}>
                        <div className="facturas-pdf-viewer-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="facturas-pdf-viewer-header">
                                <div className="facturas-pdf-viewer-title">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    <span>{previewPdfTitle}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <button
                                        type="button"
                                        className="facturas-btn facturas-btn--secondary facturas-btn--sm"
                                        onClick={() => downloadFile(previewPdfUrl, previewPdfFilename || 'Factura.pdf')}
                                        title="Descargar archivo PDF"
                                    >
                                        Descargar PDF
                                    </button>
                                    <a
                                        href={previewPdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="facturas-btn facturas-btn--secondary facturas-btn--sm"
                                    >
                                        Pestaña nueva ↗
                                    </a>
                                    <button
                                        type="button"
                                        className="facturas-modal__close"
                                        onClick={() => setPreviewPdfUrl(null)}
                                        aria-label="Cerrar visor"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                            <iframe
                                src={previewPdfUrl}
                                title="Visor de Factura PDF"
                                className="facturas-pdf-viewer-frame"
                            />
                        </div>
                    </div>
                )}

                {/* ── Modal: Visor de XML ── */}
                {previewXmlContent && (
                    <div className="facturas-modal-overlay" onClick={() => setPreviewXmlContent(null)}>
                        <div className="facturas-xml-viewer-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="facturas-xml-viewer-header">
                                <div className="facturas-xml-viewer-title">
                                    <div className="facturas-dropzone__icon--xml" style={{ width: '28px', height: '28px', minWidth: '28px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="16 18 22 12 16 6" />
                                            <polyline points="8 6 2 12 8 18" />
                                        </svg>
                                    </div>
                                    <span>{previewXmlTitle}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <button
                                        type="button"
                                        className="facturas-btn facturas-btn--secondary facturas-btn--sm"
                                        onClick={handleCopyXmlContent}
                                    >
                                        {xmlCopied ? '¡Copiado!' : 'Copiar'}
                                    </button>
                                    <button
                                        type="button"
                                        className="facturas-btn facturas-btn--xml facturas-btn--sm"
                                        onClick={() => downloadFile(previewXmlDownloadUrl, previewXmlFilename)}
                                    >
                                        Descargar XML
                                    </button>
                                    <button
                                        type="button"
                                        className="facturas-modal__close"
                                        onClick={() => setPreviewXmlContent(null)}
                                        aria-label="Cerrar visor XML"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            <div className="facturas-xml-viewer-body">
                                <pre className="facturas-xml-viewer-code">
                                    <code>{previewXmlContent}</code>
                                </pre>
                            </div>

                            <div className="facturas-xml-viewer-footer">
                                <div className="facturas-xml-viewer-filename">
                                    <span>Archivo: </span>
                                    <strong>{previewXmlFilename}</strong>
                                </div>
                                <button
                                    type="button"
                                    className="facturas-btn facturas-btn--xml facturas-btn--sm"
                                    onClick={() => downloadFile(previewXmlDownloadUrl, previewXmlFilename)}
                                >
                                    Guardar Documento (.xml)
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Modal: Confirmar Eliminación de Factura ── */}
                {deleteModalOpen && facturaToDelete && (
                    <div className="facturas-modal-overlay" onClick={() => !actionLoading && setDeleteModalOpen(false)}>
                        <div className="facturas-modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
                            <div className="facturas-modal__header">
                                <h2 className="facturas-modal__title" style={{ color: '#fca5a5' }}>Confirmar Eliminación</h2>
                                <button type="button" className="facturas-modal__close" onClick={() => setDeleteModalOpen(false)} disabled={actionLoading}>✕</button>
                            </div>
                            <p style={{ color: '#cbd5e1', fontSize: '0.92rem', lineHeight: '1.5', margin: '0.5rem 0 1.5rem' }}>
                                ¿Estás seguro de que deseas eliminar la factura con UUID{' '}
                                <strong style={{ color: '#f1f5f9' }}>{facturaToDelete.uuid_fiscal}</strong>? Si tiene archivos adjuntos (PDF o XML) en Supabase Storage, también serán eliminados.
                            </p>
                            <div className="facturas-modal__footer">
                                <button type="button" className="facturas-btn facturas-btn--secondary" onClick={() => setDeleteModalOpen(false)} disabled={actionLoading}>
                                    Cancelar
                                </button>
                                <button type="button" className="facturas-btn facturas-btn--danger" onClick={handleConfirmDeleteFactura} disabled={actionLoading}>
                                    {actionLoading ? 'Eliminando...' : 'Sí, Eliminar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Modal: Confirmar Eliminación de Complemento ── */}
                {pagoToDelete && (
                    <div className="facturas-modal-overlay" onClick={() => !deletingPagoId && setPagoToDelete(null)}>
                        <div className="facturas-modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
                            <div className="facturas-modal__header">
                                <h2 className="facturas-modal__title" style={{ color: '#fca5a5' }}>Confirmar eliminación</h2>
                                <button type="button" className="facturas-modal__close" onClick={() => setPagoToDelete(null)} disabled={Boolean(deletingPagoId)}>✕</button>
                            </div>
                            <p style={{ color: '#cbd5e1', fontSize: '0.92rem', lineHeight: '1.5', margin: '0.5rem 0 1.5rem' }}>
                                ¿Eliminar el complemento de pago <strong>#{pagoToDelete.num_pago || '—'}</strong> con fecha{' '}
                                <strong>{mostrarFechaCompleta(pagoToDelete.fecha_pago)}</strong>? Esta acción no se puede deshacer.
                            </p>
                            <div className="facturas-modal__footer">
                                <button type="button" className="facturas-btn facturas-btn--secondary" onClick={() => setPagoToDelete(null)} disabled={Boolean(deletingPagoId)}>
                                    Cancelar
                                </button>
                                <button type="button" className="facturas-btn facturas-btn--danger" onClick={() => removePago(pagoToDelete)} disabled={Boolean(deletingPagoId)}>
                                    {deletingPagoId ? 'Eliminando...' : 'Sí, eliminar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Modal: Detalles Completos de Factura ── */}
                {facturaDetalle && (
                    <div className="facturas-modal-overlay" onClick={() => setFacturaDetalle(null)}>
                        <div className="facturas-modal" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
                            <div className="facturas-modal__header">
                                <div>
                                    <h2 className="facturas-modal__title">Detalles de Factura Fiscal</h2>
                                    <span style={{ fontSize: '0.76rem', color: '#38bdf8' }}>ID #{facturaDetalle.id_factura}</span>
                                </div>
                                <button type="button" className="facturas-modal__close" onClick={() => setFacturaDetalle(null)} aria-label="Cerrar modal">✕</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '70vh', overflowY: 'auto' }}>
                                <div className="facturas-detail-card">
                                    <span className="facturas-detail-card__label">UUID Fiscal (Folio Digital)</span>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
                                        <span style={{ fontFamily: 'monospace', fontSize: '0.84rem', color: '#f1f5f9', wordBreak: 'break-all' }}>
                                            {facturaDetalle.uuid_fiscal || '—'}
                                        </span>
                                        {facturaDetalle.uuid_fiscal && (
                                            <button type="button" className="facturas-copy-btn" onClick={() => handleCopyUuid(facturaDetalle.uuid_fiscal)} title="Copiar UUID">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="facturas-grid-2" style={{ gap: '0.75rem' }}>
                                    <div className="facturas-detail-card">
                                        <span className="facturas-detail-card__label">Empresa Receptora</span>
                                        <div style={{ fontWeight: 600, color: '#f1f5f9', marginTop: '2px' }}>{facturaDetalle.empresa || 'Empresa'}</div>
                                        <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>RFC: {facturaDetalle.rfc_receptor || 'No especificado'}</span>
                                    </div>
                                    <div className="facturas-detail-card">
                                        <span className="facturas-detail-card__label">Proveedor Emisor</span>
                                        <div style={{ fontWeight: 600, color: '#f1f5f9', marginTop: '2px' }}>{facturaDetalle.proveedor || 'Proveedor'}</div>
                                        <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>RFC: {facturaDetalle.rfc_emisor || 'No especificado'}</span>
                                    </div>
                                </div>

                                <div className="facturas-grid-2" style={{ gap: '0.75rem' }}>
                                    <div className="facturas-detail-card">
                                        <span className="facturas-detail-card__label">Compra Vinculada</span>
                                        <div style={{ fontWeight: 600, color: '#38bdf8', marginTop: '2px' }}>Compra #{facturaDetalle.id_compra}</div>
                                        {facturaDetalle.fecha_compra && (
                                            <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                                                Fecha compra: {new Date(facturaDetalle.fecha_compra).toLocaleDateString('es-MX')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="facturas-detail-card">
                                        <span className="facturas-detail-card__label">Fecha de Emisión</span>
                                        <div style={{ fontWeight: 600, color: '#f1f5f9', marginTop: '2px' }}>
                                            {facturaDetalle.fecha_emision ? new Date(facturaDetalle.fecha_emision).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                                        </div>
                                    </div>
                                </div>

                                <div className="facturas-detail-card" style={{ background: 'rgba(30, 41, 59, 0.7)' }}>
                                    <span className="facturas-detail-card__label">Desglose Fiscal y Avance</span>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.86rem' }}>
                                        <span>Subtotal:</span>
                                        <span style={{ fontWeight: 600 }}>{formatoMoneda(facturaDetalle.monto_subtotal || 0)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.86rem' }}>
                                        <span>IVA:</span>
                                        <span style={{ fontWeight: 600, color: '#67e8f9' }}>+{formatoMoneda(facturaDetalle.monto_iva || 0)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '1rem', fontWeight: 700, color: '#34d399' }}>
                                        <span>Total Facturado:</span>
                                        <span>{formatoMoneda(facturaDetalle.total)}</span>
                                    </div>
                                    {facturaDetalle.metodo_pago === 'PPD' && (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.86rem' }}>
                                                <span>Total abonado ({facturaDetalle.numPagos} pago(s)):</span>
                                                <span style={{ fontWeight: 600, color: '#6ee7b7' }}>{formatoMoneda(facturaDetalle.pagado)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.9rem', fontWeight: 700, color: facturaDetalle.saldo > 0 ? '#fcd34d' : '#6ee7b7' }}>
                                                <span>Saldo pendiente:</span>
                                                <span>{formatoMoneda(facturaDetalle.saldo)}</span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="facturas-grid-2" style={{ gap: '0.75rem' }}>
                                    <div className="facturas-detail-card">
                                        <span className="facturas-detail-card__label">Método de Pago</span>
                                        <div style={{ marginTop: '4px' }}>
                                            <span className={`facturas-badge ${facturaDetalle.metodo_pago === 'PUE' ? 'facturas-badge--pue' : 'facturas-badge--ppd'}`}>
                                                {facturaDetalle.metodo_pago === 'PUE' ? 'PUE - Pago único' : 'PPD - En parcialidades'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="facturas-detail-card">
                                        <span className="facturas-detail-card__label">Uso de CFDI</span>
                                        <div style={{ marginTop: '4px' }}>
                                            <span className="facturas-badge facturas-badge--cfdi">
                                                {facturaDetalle.uso_cfdi || 'G01'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="facturas-detail-card">
                                    <span className="facturas-detail-card__label">Archivos Digitales Adjuntos</span>
                                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '8px', flexWrap: 'wrap' }}>
                                        {facturaDetalle.archivo_url && (
                                            <button type="button" className="facturas-btn facturas-btn--pdf" onClick={() => handleVerPdf(facturaDetalle)} disabled={actionLoading}>
                                                Ver Documento PDF
                                            </button>
                                        )}
                                        {facturaDetalle.archivo_xml_url && (
                                            <button type="button" className="facturas-btn facturas-btn--xml" onClick={() => handleVerXml(facturaDetalle)} disabled={actionLoading}>
                                                Ver / Descargar XML
                                            </button>
                                        )}
                                        {!facturaDetalle.archivo_url && !facturaDetalle.archivo_xml_url && (
                                            <span className="facturas-badge facturas-badge--nopdf">Sin archivos digitales adjuntos</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="facturas-modal__footer">
                                {facturaDetalle.metodo_pago === 'PPD' && facturaDetalle.saldo > 0 && canRegisterPago && (
                                    <button
                                        type="button"
                                        className="facturas-btn facturas-btn--primary"
                                        onClick={() => {
                                            const target = facturaDetalle;
                                            setFacturaDetalle(null);
                                            openPagoModal(target.id_factura, target);
                                        }}
                                    >
                                        + Abonar a esta factura
                                    </button>
                                )}
                                <button type="button" className="facturas-btn facturas-btn--secondary" onClick={() => setFacturaDetalle(null)}>
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Modal: Detalle de Complemento de Pago ── */}
                {pagoDetalle && (
                    <div className="facturas-modal-overlay" onClick={() => setPagoDetalle(null)}>
                        <div className="facturas-modal" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Detalle del complemento de pago">
                            <div className="facturas-modal__header">
                                <div>
                                    <h2 className="facturas-modal__title">Detalle del complemento</h2>
                                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                        Pago #{pagoDetalle.num_pago || '—'} · {mostrarFechaCompleta(pagoDetalle.fecha_pago)}
                                    </span>
                                </div>
                                <button type="button" className="facturas-modal__close" onClick={() => setPagoDetalle(null)} aria-label="Cerrar">✕</button>
                            </div>

                            <div className="facturas-detail-grid">
                                <div className="facturas-detail-card facturas-detail-card--full">
                                    <span className="facturas-detail-card__label">UUID fiscal</span>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
                                        <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#f1f5f9', wordBreak: 'break-all' }}>
                                            {pagoDetalle.uuid_fiscal || '—'}
                                        </span>
                                        {pagoDetalle.uuid_fiscal && (
                                            <button type="button" className="facturas-copy-btn" title="Copiar UUID" onClick={() => handleCopyUuid(pagoDetalle.uuid_fiscal)}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="facturas-detail-card">
                                    <span className="facturas-detail-card__label">Empresa</span>
                                    <span style={{ fontWeight: 600, color: '#f1f5f9', marginTop: '2px' }}>{pagoDetalle.empresa || '—'}</span>
                                </div>
                                <div className="facturas-detail-card">
                                    <span className="facturas-detail-card__label">Proveedor</span>
                                    <span style={{ fontWeight: 600, color: '#f1f5f9', marginTop: '2px' }}>{pagoDetalle.proveedor || '—'}</span>
                                </div>
                                <div className="facturas-detail-card">
                                    <span className="facturas-detail-card__label">Número de pago</span>
                                    <span style={{ fontWeight: 600, color: '#f1f5f9', marginTop: '2px' }}>{pagoDetalle.num_pago || '—'}</span>
                                </div>
                                <div className="facturas-detail-card">
                                    <span className="facturas-detail-card__label">Forma de pago</span>
                                    <span style={{ fontWeight: 600, color: '#f1f5f9', marginTop: '2px' }}>{pagoDetalle.forma_pago || '—'}</span>
                                </div>

                                <div className="facturas-detail-card facturas-detail-card--full">
                                    <span className="facturas-detail-card__label">Desglose del pago</span>
                                    <div className="facturas-resumen__row">
                                        <span>Saldo anterior</span>
                                        <span>{formatoMoneda(pagoDetalle.saldo_anterior)}</span>
                                    </div>
                                    <div className="facturas-resumen__row">
                                        <span>Monto pagado</span>
                                        <span style={{ color: '#34d399' }}>{formatoMoneda(pagoDetalle.monto_pago)}</span>
                                    </div>
                                    <div className="facturas-resumen__row facturas-resumen__row--total">
                                        <span>Falta por pagar</span>
                                        <span>
                                            {formatoMoneda(pagoDetalle.falta_pagar)}
                                            {pagoDetalle.falta_pagar != null && Number(pagoDetalle.falta_pagar) === 0 && (
                                                <span className="facturas-badge facturas-badge--ok" style={{ marginLeft: '6px' }}>Liquidado</span>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                <div className="facturas-detail-card facturas-detail-card--full">
                                    <span className="facturas-detail-card__label">Comprobantes REP</span>
                                    <div className="facturas-actions-cluster" style={{ marginTop: '8px' }}>
                                        {pagoDetalle.url_pdf && (
                                            <button type="button" className="facturas-btn facturas-btn--pdf" onClick={() => openComplementoFile(pagoDetalle, 'pdf')}>
                                                Abrir PDF
                                            </button>
                                        )}
                                        {pagoDetalle.url_xml && (
                                            <button type="button" className="facturas-btn facturas-btn--xml" onClick={() => openComplementoFile(pagoDetalle, 'xml')}>
                                                Abrir XML
                                            </button>
                                        )}
                                        {!pagoDetalle.url_pdf && !pagoDetalle.url_xml && (
                                            <span className="facturas-badge facturas-badge--nopdf">Sin archivos</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="facturas-modal__footer">
                                <button type="button" className="facturas-btn facturas-btn--secondary" onClick={() => setPagoDetalle(null)}>
                                    Cerrar
                                </button>
                                {isAdmin && (
                                    <button type="button" className="facturas-btn facturas-btn--primary" onClick={() => openEditPago(pagoDetalle)}>
                                        Editar
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}

export default Facturas;
