// src/components/Facturas/facturas.jsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import Layout from '../layout/Layout';
import FacturaRow from './FacturaRow';
import { Alert, ConfirmModal, Icon, Pagination, SortHeader } from './FacturasUi';
import {
    FacturaDetailModal, FacturaFormModal, PagoDetailModal, PagoFormModal,
} from './FacturasModals';
import {
    enriquecerFacturas, exportarFacturasCsv, filtrarFacturas, formatoMoneda, mostrarFechaCompleta,
    nuevoPagoForm, obtenerFechaLocalParaInput, ordenarFacturas, resumirFacturas, validarArchivo, valoresUnicos,
} from './facturasUtils';
import './facturas.css';

import {useSearchParams} from "react-router-dom";

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };
const asArray = (data) => (Array.isArray(data) ? data : []);
const errorDe = (err, fallback) => err.response?.data?.error || fallback;

const OPCIONES_ARCHIVOS = [
    ['ALL', 'Archivos: Todos'],
    ['INCOMPLETE', 'Falta PDF o XML'],
    ['PDF', 'Con archivo PDF'],
    ['XML', 'Con archivo XML'],
    ['BOTH', 'Completos (PDF + XML)'],
    ['NONE', 'Sin archivos adjuntos'],
];

function Facturas() {
    const { usuario } = useAuth();
    const isAdmin = usuario?.rol === 'admin';
    const canRegisterPago = isAdmin || usuario?.rol === 'gerente';

    // Datos
    const [facturas, setFacturas] = useState([]);
    const [ppdResumenes, setPpdResumenes] = useState([]);
    const [complementos, setComplementos] = useState([]);
    const [formasPago, setFormasPago] = useState([]);
    const [compras, setCompras] = useState([]);

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Vista: acordeón, filtros, orden y paginación
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const [quickChip, setQuickChip] = useState('ALL');
    const [search, setSearch] = useState('');
    const [filterEmpresa, setFilterEmpresa] = useState('');
    const [filterProveedor, setFilterProveedor] = useState('');
    const [filterArchivos, setFilterArchivos] = useState('ALL');
    const [sort, setSort] = useState({ key: 'emision', dir: 'desc' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Modales
    const [facturaModal, setFacturaModal] = useState(null); // { factura: null | objeto }
    const [pagoModal, setPagoModal] = useState(null); // { editing, initial }
    const [facturaDetalle, setFacturaDetalle] = useState(null);
    const [pagoDetalle, setPagoDetalle] = useState(null);
    const [facturaToDelete, setFacturaToDelete] = useState(null);
    const [pagoToDelete, setPagoToDelete] = useState(null);
    const [docToDelete, setDocToDelete] = useState(null);
    const [deletingPagoId, setDeletingPagoId] = useState(null);

    const messageTimer = useRef(null);
    const replaceDocInputRef = useRef(null);
    const pendingReplaceRef = useRef(null);

    const [searchParams, setSearchParams] = useSearchParams();

    const notifySuccess = useCallback((text, timeout = 4500) => {
        setError('');
        setSuccess(text);
        clearTimeout(messageTimer.current);
        if (timeout > 0) messageTimer.current = setTimeout(() => setSuccess(''), timeout);
    }, []);

    useEffect(() => () => clearTimeout(messageTimer.current), []);

    /* ───────────── Carga de datos ───────────── */

    const fetchCompras = useCallback(async () => {
        try {
            const { data } = await client.get('/compras?sin_factura=true');
            setCompras(asArray(data));
        } catch {
            console.warn('No se pudieron precargar las compras para el formulario');
        }
    }, []);

    const loadAllData = useCallback(() =>
        Promise.all([
            client.get('/facturas'),
            client.get('/facturas/ppd/estado-cuenta'),
            client.get('/facturas/complementos'),
            client.get('/facturas/formas-pago'),
            client.get('/compras?sin_factura=true').catch(() => ({ data: [] })),
        ])
            .then(([facturasRes, ppdRes, complementosRes, formasRes, comprasRes]) => {
                setFacturas(asArray(facturasRes.data));
                setPpdResumenes(asArray(ppdRes.data));
                setComplementos(asArray(complementosRes.data));
                setFormasPago(asArray(formasRes.data));
                setCompras(asArray(comprasRes.data));
            })
            .catch((err) => setError(err.response?.data?.error || err.response?.data?.message || 'Error al cargar las facturas y pagos'))
            .finally(() => setLoading(false)),
    []);

    const refreshPpdYComplementos = useCallback(async () => {
        try {
            const [ppdRes, complementosRes] = await Promise.all([
                client.get('/facturas/ppd/estado-cuenta'),
                client.get('/facturas/complementos'),
            ]);
            setPpdResumenes(asArray(ppdRes.data));
            setComplementos(asArray(complementosRes.data));
        } catch {
            // Se conserva el estado local optimista si falla la sincronización en segundo plano
        }
    }, []);

    useEffect(() => {
        void loadAllData();
    }, [loadAllData]);

    const recargar = () => {
        setLoading(true);
        setError('');
        void loadAllData();
    };

    /* ───────────── Datos derivados ───────────── */

    const facturasEnriquecidas = useMemo(
        () => enriquecerFacturas(facturas, ppdResumenes, complementos),
        [facturas, ppdResumenes, complementos]
    );
    const ppdFacturas = useMemo(
        () => facturasEnriquecidas.filter((f) => f.metodo_pago === 'PPD'),
        [facturasEnriquecidas]
    );
    const resumen = useMemo(() => resumirFacturas(facturasEnriquecidas), [facturasEnriquecidas]);
    const empresas = useMemo(() => valoresUnicos(facturasEnriquecidas, 'empresa'), [facturasEnriquecidas]);
    const proveedores = useMemo(() => valoresUnicos(facturasEnriquecidas, 'proveedor'), [facturasEnriquecidas]);

    const facturasFiltradas = useMemo(
        () => ordenarFacturas(
            filtrarFacturas(facturasEnriquecidas, {
                chip: quickChip, busqueda: search, empresa: filterEmpresa, proveedor: filterProveedor, archivos: filterArchivos,
            }),
            sort
        ),
        [facturasEnriquecidas, quickChip, search, filterEmpresa, filterProveedor, filterArchivos, sort]
    );

    // La página vuelve a 1 cuando cambian filtros, orden o tamaño de página
    const resetKey = [quickChip, search, filterEmpresa, filterProveedor, filterArchivos, sort.key, sort.dir, pageSize].join('|');
    const [prevResetKey, setPrevResetKey] = useState(resetKey);
    if (prevResetKey !== resetKey) {
        setPrevResetKey(resetKey);
        setPage(1);
    }

    const totalPages = Math.max(1, Math.ceil(facturasFiltradas.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const visibles = useMemo(
        () => facturasFiltradas.slice((safePage - 1) * pageSize, safePage * pageSize),
        [facturasFiltradas, safePage, pageSize]
    );

    const filtrosActivos = quickChip !== 'ALL' || Boolean(search.trim()) || Boolean(filterEmpresa) || Boolean(filterProveedor) || filterArchivos !== 'ALL';

    const comprasSinFactura = useMemo(() => {
        const facturadas = new Set(facturas.map((f) => f.id_compra).filter(Boolean).map(Number));
        return compras.filter((c) => !facturadas.has(Number(c.id_compra)) && !c.tiene_factura);
    }, [compras, facturas]);


    const limpiarFiltros = () => {
        setQuickChip('ALL');
        setSearch('');
        setFilterEmpresa('');
        setFilterProveedor('');
        setFilterArchivos('ALL');
    };

    const toggleSort = (key) =>
        setSort((prev) =>
            prev.key === key
                ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: key === 'empresa' ? 'asc' : 'desc' }
        );

    const handleKpiFilter = (chipId) => {
        setQuickChip((prev) => (prev === chipId && chipId !== 'ALL' ? 'ALL' : chipId));
        setFilterArchivos((prev) => (chipId !== 'INCOMPLETE' ? 'ALL' : prev === 'INCOMPLETE' ? 'ALL' : 'INCOMPLETE'));
    };

    const expandir = (idFactura) => setExpandedIds((prev) => new Set(prev).add(Number(idFactura)));

    const toggleAccordion = (idFactura) =>
        setExpandedIds((prev) => {
            const id = Number(idFactura);
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    /* ───────────── Complementos de pago ───────────── */

    const findFactura = (idFactura) =>
        (idFactura ? facturasEnriquecidas.find((f) => Number(f.id_factura) === Number(idFactura)) || null : null);

    const getSiguientePago = (idFactura, factura) => {
        if (!idFactura) return { numPago: '', saldoAnterior: '' };
        const resumenFactura = factura || findFactura(idFactura);
        const previos = complementos.filter((c) => Number(c.id_factura) === Number(idFactura));
        const ultimoNum = Math.max(
            Number(resumenFactura?.ultimoNumPago) || 0,
            ...previos.map((c) => Number(c.num_pago) || 0),
            0
        );
        const ultimoPrevio = previos.reduce(
            (max, c) => ((Number(c.num_pago) || 0) >= (Number(max?.num_pago) || 0) ? c : max),
            null
        );
        const saldo = resumenFactura?.saldo ?? ultimoPrevio?.falta_pagar ?? null;
        return {
            numPago: ultimoNum + 1,
            saldoAnterior: saldo == null ? '' : Number(saldo).toFixed(2),
        };
    };

    const openPagoModal = (preferId, customFactura = null) => {
        const preferida = customFactura || (preferId != null ? findFactura(preferId) : null);
        const target = preferida || ppdFacturas.find((f) => Number(f.saldo) > 0) || ppdFacturas[0];
        const idFactura = target?.id_factura || '';
        const sugerido = getSiguientePago(idFactura, target);
        setPagoModal({
            editing: null,
            initial: { ...nuevoPagoForm(), idFactura, numPago: sugerido.numPago, saldoAnterior: sugerido.saldoAnterior },
        });
    };

    const openEditPago = (item) => {
        setPagoDetalle(null);
        setPagoModal({
            editing: item,
            initial: {
                idFactura: item.id_factura,
                numPago: item.num_pago || '',
                fechaPago: obtenerFechaLocalParaInput(item.fecha_pago),
                saldoAnterior: item.saldo_anterior ?? '',
                montoPago: item.monto_pago ?? '',
                formaPago: item.forma_pago || '',
                faltaPagar: item.falta_pagar ?? '',
            },
        });
    };

    const mergePpdResumen = (resumenPpd) => {
        if (!resumenPpd?.id_factura) return;
        const id = Number(resumenPpd.id_factura);
        setPpdResumenes((prev) =>
            prev.some((r) => Number(r.id_factura) === id)
                ? prev.map((r) => (Number(r.id_factura) === id ? { ...r, ...resumenPpd } : r))
                : [resumenPpd, ...prev]
        );
    };

    const savePago = async (data, { editing, idFactura }) => {
        if (editing) {
            const { data: updated } = await client.put(`/facturas/complementos/${editing.id_detalle_factura}`, data);
            const { factura: resumenPpd, ...detalle } = updated;
            setComplementos((prev) =>
                prev.map((item) => (item.id_detalle_factura === detalle.id_detalle_factura ? { ...item, ...detalle } : item))
            );
            mergePpdResumen(resumenPpd);
            notifySuccess('Complemento de pago actualizado correctamente.');
        } else {
            const { data: created } = await client.post(`/facturas/${idFactura}/complementos`, data);
            const { factura: resumenPpd, ...detalle } = created;
            const info = findFactura(idFactura);
            setComplementos((prev) => [{
                ...detalle,
                id_factura: Number(idFactura),
                uuid_fiscal: resumenPpd?.uuid_fiscal ?? detalle.uuid_fiscal ?? info?.uuid_fiscal,
                empresa: resumenPpd?.empresa ?? detalle.empresa ?? info?.empresa,
                proveedor: resumenPpd?.proveedor ?? detalle.proveedor ?? info?.proveedor,
            }, ...prev]);
            mergePpdResumen(resumenPpd);
            expandir(idFactura);
            notifySuccess('Complemento de pago registrado correctamente.');
        }
        setPagoModal(null);
        void refreshPpdYComplementos();
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
            setError(errorDe(err, 'No se pudo eliminar el complemento'));
        } finally {
            setDeletingPagoId(null);
        }
    };

    const abrirDocumento = async (endpoint, existe, tipo, nombreRegistro) => {
        if (!existe) {
            return setError(`${nombreRegistro} no tiene un archivo ${tipo.toUpperCase()} adjunto`);
        }
        setActionLoading(true);
        try {
            const { data } = await client.get(`${endpoint}?tipo=${tipo}`);
            const url = tipo === 'pdf' ? (data.pdf_url || data.url) : (data.xml_url || data.url);
            if (!url) return setError(`No hay archivo ${tipo.toUpperCase()} disponible`);
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (err) {
            setError(errorDe(err, `No se pudo abrir el archivo ${tipo.toUpperCase()}`));
        } finally {
            setActionLoading(false);
        }
    };

    const openFacturaFile = (factura, tipo) =>
        abrirDocumento(
            `/facturas/${factura.id_factura}/url`,
            tipo === 'pdf' ? factura.archivo_url : factura.archivo_xml_url,
            tipo,
            'Esta factura'
        );

    const openComplementoFile = (item, tipo) =>
        abrirDocumento(
            `/facturas/complementos/${item.id_detalle_factura}/url`,
            tipo === 'pdf' ? item.url_pdf : item.url_xml,
            tipo,
            'Este complemento'
        );

    const triggerReplaceDoc = (scope, record, tipo) => {
        pendingReplaceRef.current = { scope, record, tipo };
        const input = replaceDocInputRef.current;
        if (!input) return;
        input.accept = tipo === 'xml' ? '.xml,text/xml,application/xml' : '.pdf,application/pdf';
        input.value = '';
        input.click();
    };

    const handleReplaceDocFile = async (e) => {
        const file = e.target.files?.[0] ?? null;
        e.target.value = '';
        const target = pendingReplaceRef.current;
        pendingReplaceRef.current = null;
        if (!file || !target) return;

        const { scope, record, tipo } = target;
        const errValidacion = validarArchivo(file, tipo);
        if (errValidacion) return setError(errValidacion);

        const data = new FormData();
        data.append(tipo === 'pdf' ? 'archivo_pdf' : 'archivo_xml', file);

        setActionLoading(true);
        setError('');
        setSuccess('');
        try {
            if (scope === 'factura') {
                const { data: updated } = await client.patch(
                    `/facturas/${record.id_factura}/documento/${tipo}`,
                    data,
                    MULTIPART
                );
                setFacturas((prev) =>
                    prev.map((f) => (Number(f.id_factura) === Number(record.id_factura) ? { ...f, ...updated } : f))
                );
                notifySuccess(`${tipo.toUpperCase()} de la factura actualizado correctamente.`);
            } else {
                const { data: updated } = await client.patch(
                    `/facturas/complementos/${record.id_detalle_factura}/documento/${tipo}`,
                    data,
                    MULTIPART
                );
                const { factura: resumenPpd, ...detalle } = updated;
                setComplementos((prev) =>
                    prev.map((c) => (c.id_detalle_factura === detalle.id_detalle_factura ? { ...c, ...detalle } : c))
                );
                mergePpdResumen(resumenPpd);
                notifySuccess(`${tipo.toUpperCase()} del complemento actualizado correctamente.`);
            }
        } catch (err) {
            setError(errorDe(err, `No se pudo reemplazar el archivo ${tipo.toUpperCase()}`));
        } finally {
            setActionLoading(false);
        }
    };

    const confirmDeleteDoc = async () => {
        if (!docToDelete) return;
        const { scope, record, tipo } = docToDelete;
        setActionLoading(true);
        setError('');
        setSuccess('');
        try {
            if (scope === 'factura') {
                const { data: updated } = await client.delete(
                    `/facturas/${record.id_factura}/documento/${tipo}`
                );
                setFacturas((prev) =>
                    prev.map((f) => (Number(f.id_factura) === Number(record.id_factura) ? { ...f, ...updated } : f))
                );
                notifySuccess(`${tipo.toUpperCase()} de la factura eliminado correctamente.`);
            } else {
                const { data: updated } = await client.delete(
                    `/facturas/complementos/${record.id_detalle_factura}/documento/${tipo}`
                );
                const { factura: resumenPpd, ...detalle } = updated;
                setComplementos((prev) =>
                    prev.map((c) => (c.id_detalle_factura === detalle.id_detalle_factura ? { ...c, ...detalle } : c))
                );
                mergePpdResumen(resumenPpd);
                notifySuccess(`${tipo.toUpperCase()} del complemento eliminado correctamente.`);
            }
            setDocToDelete(null);
        } catch (err) {
            setError(errorDe(err, `No se pudo eliminar el archivo ${tipo.toUpperCase()}`));
        } finally {
            setActionLoading(false);
        }
    };

    /* ───────────── Facturas ───────────── */

    const openFacturaModal = (factura = null) => {
        void fetchCompras();
        setFacturaDetalle(null);
        setError('');
        setFacturaModal({ factura });
    };

    const saveFactura = async (data, { continueToPago, metodo, subtotal, iva, adjuntos, eliminados = [] }) => {
        const editing = facturaModal?.factura;
        setActionLoading(true);
        setError('');
        setSuccess('');

        try {
            if (editing) {
                const { data: updated } = await client.put(`/facturas/${editing.id_factura}`, data, MULTIPART);
                setFacturas((prev) =>
                    prev.map((f) => (Number(f.id_factura) === Number(editing.id_factura) ? { ...f, ...updated } : f))
                );
                setFacturaModal(null);
                void fetchCompras();
                const partes = [];
                if (adjuntos?.length) partes.push(`Archivos actualizados: ${adjuntos.join(' + ')}`);
                if (eliminados.length) partes.push(`Archivos eliminados: ${eliminados.join(' + ')}`);
                notifySuccess(
                    `Factura actualizada exitosamente.${partes.length ? ` (${partes.join(' · ')})` : ''}`
                );
                void refreshPpdYComplementos();
                return;
            }

            const { data: creada } = await client.post('/facturas', data, MULTIPART);
            setFacturas((prev) => [creada, ...prev]);
            setFacturaModal(null);
            void fetchCompras();

            if (metodo === 'PPD' && creada?.id_factura) {
                const total = (Number(creada.monto_subtotal) || subtotal) + (Number(creada.monto_iva) || iva);
                const nuevaPpd = {
                    ...creada, total, pagado: 0, saldo: total, estado: 'PENDIENTE', num_pagos: 0, ultimo_num_pago: 0,
                };
                mergePpdResumen(nuevaPpd);
                expandir(creada.id_factura);

                if (continueToPago && canRegisterPago) {
                    notifySuccess('Factura PPD guardada. Registra ahora su primer complemento de pago.');
                    openPagoModal(creada.id_factura, {
                        ...nuevaPpd, estadoPago: 'PENDIENTE', numPagos: 0, ultimoNumPago: 0, pagos: [],
                    });
                    return;
                }
            }

            notifySuccess(
                `Factura registrada exitosamente.${adjuntos.length ? ` (Archivos guardados: ${adjuntos.join(' + ')})` : ''}`
            );
            void refreshPpdYComplementos();
        } catch (err) {
            setError(errorDe(err, editing ? 'Error al actualizar la factura' : 'Error al registrar la factura'));
        } finally {
            setActionLoading(false);
        }
    };

    const confirmDeleteFactura = async () => {
        const factura = facturaToDelete;
        if (!factura) return;
        setActionLoading(true);
        setError('');
        setSuccess('');
        try {
            await client.delete(`/facturas/${factura.id_factura}`);
            const id = Number(factura.id_factura);
            const distinta = (x) => Number(x.id_factura) !== id;
            setFacturas((prev) => prev.filter(distinta));
            setPpdResumenes((prev) => prev.filter(distinta));
            setComplementos((prev) => prev.filter(distinta));
            setFacturaDetalle((prev) => (prev && Number(prev.id_factura) === id ? null : prev));
            notifySuccess(`Factura con UUID ${factura.uuid_fiscal} eliminada correctamente`);
            setFacturaToDelete(null);
            void fetchCompras();
        } catch (err) {
            setError(errorDe(err, 'Error al eliminar la factura'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleCopyUuid = (uuid) => {
        if (!uuid) return;
        navigator.clipboard?.writeText(uuid).then(
            () => notifySuccess(`UUID copiado al portapapeles: ${uuid}`, 2800),
            () => setError('No se pudo copiar el UUID al portapapeles')
        );
    };

    const handleExportCsv = () => {
        if (facturasFiltradas.length === 0) return setError('No hay facturas para exportar con los filtros actuales');
        exportarFacturasCsv(facturasFiltradas);
        notifySuccess(`Se exportaron ${facturasFiltradas.length} factura(s) a CSV.`);
    };

    /* ───────────── Tecla Escape: cierra el modal superior ───────────── */

    useEffect(() => {
        const capas = [
            [docToDelete, () => setDocToDelete(null)],
            [facturaToDelete, () => setFacturaToDelete(null)],
            [pagoToDelete && !deletingPagoId, () => setPagoToDelete(null)],
            [pagoModal, () => setPagoModal(null)],
            [facturaModal, () => setFacturaModal(null)],
            [pagoDetalle, () => setPagoDetalle(null)],
            [facturaDetalle, () => setFacturaDetalle(null)],
        ];
        const superior = capas.find(([abierta]) => abierta);
        if (!superior) return undefined;
        const onKey = (e) => e.key === 'Escape' && superior[1]();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [docToDelete, facturaToDelete, pagoToDelete, deletingPagoId, pagoModal, facturaModal, pagoDetalle, facturaDetalle]);

    /* ───────────── Presentación ───────────── */

    const facturaDetalleActual = useMemo(
        () => (facturaDetalle ? facturasEnriquecidas.find((f) => Number(f.id_factura) === Number(facturaDetalle.id_factura)) || facturaDetalle : null),
        [facturaDetalle, facturasEnriquecidas]
    );
    const pagoDetalleActual = useMemo(
        () => (pagoDetalle ? complementos.find((c) => Number(c.id_detalle_factura) === Number(pagoDetalle.id_detalle_factura)) || pagoDetalle : null),
        [pagoDetalle, complementos]
    );

    const kpiCards = [
        {
            id: 'ALL', label: 'Facturas Totales', icon: 'kpiInvoice', tone: 'blue', active: 'facturas-kpi-card--active',
            value: `${resumen.totalRegistros} registradas`, sub: `${formatoMoneda(resumen.sumaFacturado)} facturado`, hint: 'Ver todas',
        },
        {
            id: 'PPD_OPEN', label: 'Saldo Pendiente PPD', icon: 'kpiAlert', tone: 'amber', active: 'facturas-kpi-card--active-amber',
            value: formatoMoneda(resumen.saldoPendiente), valueClass: resumen.saldoPendiente > 0 ? ' facturas-kpi-card__val--amber' : '',
            sub: `${resumen.ppdAbiertas} factura(s) PPD abierta(s)`, hint: 'Clic p/ filtrar',
        },
        {
            id: 'PAID', label: 'Total Pagado / Abonado', icon: 'kpiDollar', tone: 'green', active: 'facturas-kpi-card--active',
            value: formatoMoneda(resumen.totalPagado), sub: `${complementos.length} complementos · ${resumen.pue} PUE`, hint: 'Liquidadas',
        },
        {
            id: 'INCOMPLETE', label: 'Expediente Fiscal CFDI', icon: 'kpiFile', tone: 'cyan', active: 'facturas-kpi-card--active-amber',
            value: `${resumen.conArchivo} con XML/PDF`, sub: `${resumen.sinArchivos} sin archivos`, hint: 'Incompletas',
        },
    ];

    const chips = [
        ['ALL', 'Todas', facturasEnriquecidas.length, 'facturas-chip--active'],
        ['PPD_OPEN', 'PPD por Pagar', resumen.ppdAbiertas, 'facturas-chip--active-amber'],
        ['PPD_DONE', 'PPD Liquidadas', resumen.ppdLiquidadas, 'facturas-chip--active'],
        ['PUE', 'PUE', facturasEnriquecidas.filter((f) => f.metodo_pago === 'PUE').length, 'facturas-chip--active'],
    ];

    const acciones = {
        toggle: toggleAccordion,
        abonar: (factura) => openPagoModal(factura.id_factura, factura),
        detalle: setFacturaDetalle,
        editar: openFacturaModal,
        eliminar: setFacturaToDelete,
        openFacturaFile,
        replaceFacturaDoc: (factura, tipo) => triggerReplaceDoc('factura', factura, tipo),
        deleteFacturaDoc: (factura, tipo) => setDocToDelete({ scope: 'factura', record: factura, tipo }),
        copy: handleCopyUuid,
        pagoDetalle: setPagoDetalle,
        pagoEditar: openEditPago,
        pagoEliminar: setPagoToDelete,
        openComplementoFile,
        replaceComplementoDoc: (pago, tipo) => triggerReplaceDoc('complemento', pago, tipo),
        deleteComplementoDoc: (pago, tipo) => setDocToDelete({ scope: 'complemento', record: pago, tipo }),
    };

    useEffect(() => {
        const newFactura = searchParams.get('pagoModalOpen');
        const idCompraParam = searchParams.get('idCompra');
        const idCompraFactura = searchParams.get('id_compra');

        if (newFactura === 'true') {
            if (isAdmin) {
                const parsedId = Number(idCompraParam);
                const initialIdCompra = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
                void fetchCompras();
                setFacturaDetalle(null);
                setError('');
                setFacturaModal({ factura: null, initialIdCompra });
            }
            
            return;
        }

        if (idCompraFactura && !loading) {
            const encontrada = facturasEnriquecidas.find(
                (f) => Number(f.id_compra) === Number(idCompraFactura)
            );
            if (encontrada) {
                setFacturaDetalle(encontrada);
            }
            
        }
    }, [searchParams, setSearchParams, facturasEnriquecidas, loading, isAdmin, fetchCompras]);

    return (
        <Layout>
            <div className="facturas-container">
                <div className="facturas-header">
                    <div>
                        <h1 className="facturas-header__title">
                            <span className="facturas-header__icon-box"><Icon name="invoice" size={24} round /></span>
                            Centro de Facturas y Pagos
                        </h1>
                        <p className="facturas-header__subtitle">
                            Control fiscal CFDI, estado de cuenta PPD y complementos de pago en una sola pantalla
                        </p>
                    </div>

                    <div className="facturas-header__actions">
                        <button type="button" className="facturas-btn facturas-btn--secondary" onClick={recargar} disabled={loading || actionLoading}>
                            <Icon name="refresh" round className={loading ? 'facturas-btn__spin' : ''} />
                            <span>Refrescar</span>
                        </button>
                        <button type="button" className="facturas-btn facturas-btn--secondary" onClick={handleExportCsv} disabled={loading}>
                            <Icon name="download" size={15} strokeWidth={2.2} round />
                            <span>Exportar CSV</span>
                        </button>
                        {isAdmin && (
                            <button type="button" className="facturas-btn facturas-btn--primary" onClick={() => openFacturaModal()} disabled={actionLoading}>
                                <Icon name="plus" round />
                                <span>Nueva Factura</span>
                            </button>
                        )}
                    </div>
                </div>

                {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
                {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

                {!loading && facturasEnriquecidas.length > 0 && (
                    <section className="facturas-kpis" aria-label="Resumen de facturas y pagos">
                        {kpiCards.map((k) => (
                            <button
                                key={k.id}
                                type="button"
                                className={`facturas-kpi-card facturas-kpi-card--interactive${quickChip === k.id ? ` ${k.active}` : ''}`}
                                onClick={() => handleKpiFilter(k.id)}
                            >
                                <div className="facturas-kpi-card__top">
                                    <span className="facturas-kpi-card__label">{k.label}</span>
                                    <span className={`facturas-kpi-card__icon facturas-kpi-card__icon--${k.tone}`}>
                                        <Icon name={k.icon} />
                                    </span>
                                </div>
                                <span className={`facturas-kpi-card__val${k.valueClass || ''}`}>{k.value}</span>
                                <span className="facturas-kpi-card__sub">
                                    <span>{k.sub}</span>
                                    <span className="facturas-kpi-card__hint">{k.hint}</span>
                                </span>
                            </button>
                        ))}
                    </section>
                )}

                <section className="facturas-filters-card" aria-label="Filtros de facturas">
                    <div className="facturas-chips-row">
                        <span className="facturas-chips-row__label">Vista rápida:</span>
                        {chips.map(([id, label, count, activeClass]) => (
                            <button
                                key={id}
                                type="button"
                                className={`facturas-chip${quickChip === id ? ` ${activeClass}` : ''}`}
                                onClick={() => handleKpiFilter(id)}
                            >
                                {label} ({count})
                            </button>
                        ))}
                    </div>

                    <div className="facturas-filters-grid">
                        <div className="facturas-search-wrap" style={{ minWidth: 0 }}>
                            <Icon name="search" round className="facturas-search-icon" />
                            <input
                                type="text"
                                className="facturas-search-input"
                                aria-label="Buscar facturas"
                                placeholder="Buscar por UUID fiscal, empresa, proveedor, RFC o forma de pago..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {search && (
                                <button type="button" className="facturas-search-clear" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
                                    ✕
                                </button>
                            )}
                        </div>

                        <select className="facturas-select" aria-label="Filtrar por empresa" value={filterEmpresa} onChange={(e) => setFilterEmpresa(e.target.value)}>
                            <option value="">Todas las empresas</option>
                            {empresas.map((emp) => <option key={emp} value={emp}>{emp}</option>)}
                        </select>

                        <select className="facturas-select" aria-label="Filtrar por proveedor" value={filterProveedor} onChange={(e) => setFilterProveedor(e.target.value)}>
                            <option value="">Todos los proveedores</option>
                            {proveedores.map((prov) => <option key={prov} value={prov}>{prov}</option>)}
                        </select>

                        <select
                            className="facturas-select"
                            aria-label="Filtrar por comprobantes"

                            value={filterArchivos}
                            onChange={(e) => {
                                setFilterArchivos(e.target.value);
                                if (quickChip === 'INCOMPLETE' && e.target.value !== 'INCOMPLETE') setQuickChip('ALL');
                            }}
                        >
                            {OPCIONES_ARCHIVOS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </div>

                    <div className="facturas-filters-footer">
                        <span className="facturas-filters-footer__count" aria-live="polite">
                            {facturasFiltradas.length === facturasEnriquecidas.length
                                ? `${facturasEnriquecidas.length} factura(s)`
                                : `${facturasFiltradas.length} de ${facturasEnriquecidas.length} factura(s)`}
                        </span>
                        {filtrosActivos && (
                            <button type="button" className="facturas-btn facturas-btn--secondary facturas-btn--xs" onClick={limpiarFiltros}>
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                </section>

                <div className="facturas-table-wrap">
                    <table className="facturas-table">
                        <thead>
                            <tr>
                                <SortHeader label="UUID / Compra" sortKey="uuid_fiscal" sort={sort} onSort={toggleSort} />
                                <SortHeader label="Empresa / Proveedor" sortKey="empresa" sort={sort} onSort={toggleSort} />
                                <SortHeader label="Emisión" sortKey="emision" sort={sort} onSort={toggleSort} className="facturas-hide-mobile" />
                                <SortHeader label="Método / CFDI" sortKey="metodo_pago" sort={sort} onSort={toggleSort} className="facturas-hide-mobile" />
                                <SortHeader label="Total y Avance de Pago" sortKey="total" sort={sort} onSort={toggleSort} />
                                <th className="facturas-hide-mobile">Documentos</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading || visibles.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan="7"
                                        style={loading
                                            ? { textAlign: 'center', padding: '3.5rem 1rem' }
                                            : { textAlign: 'center', padding: '3.5rem 1rem', color: 'rgba(148, 163, 184, 0.7)' }}
                                    >
                                        {loading ? (
                                            <>
                                                <span className="facturas-btn__spin" style={{ display: 'inline-block', marginRight: '8px' }}>
                                                    <Icon name="refresh" size={18} round />
                                                </span>
                                                Cargando facturas y estado de pagos...
                                            </>
                                        ) : filtrosActivos
                                            ? 'No se encontraron facturas con los filtros aplicados.'
                                            : 'No hay facturas registradas en el sistema.'}
                                    </td>
                                </tr>
                            ) : (
                                visibles.map((factura) => (
                                    <FacturaRow
                                        key={factura.id_factura}
                                        factura={factura}
                                        expanded={expandedIds.has(Number(factura.id_factura))}
                                        canRegisterPago={canRegisterPago}
                                        isAdmin={isAdmin}
                                        busy={actionLoading}
                                        deletingPagoId={deletingPagoId}
                                        on={acciones}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    page={safePage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    total={facturasFiltradas.length}
                    onPage={setPage}
                    onPageSize={setPageSize}
                />

                {facturaModal && (
                    <FacturaFormModal
                        factura={facturaModal.factura}
                        initialIdCompra={facturaModal.initialIdCompra ?? null}
                        compras={comprasSinFactura}
                        canRegisterPago={canRegisterPago}
                        busy={actionLoading}
                        onClose={() => setFacturaModal(null)}
                        onSubmit={saveFactura}
                        onError={setError}
                    />
                )}

                {pagoModal && (
                    <PagoFormModal
                        editing={pagoModal.editing}
                        initial={pagoModal.initial}
                        ppdFacturas={ppdFacturas}
                        findFactura={findFactura}
                        getSiguientePago={getSiguientePago}
                        formasPago={formasPago}
                        complementos={complementos}
                        onClose={() => setPagoModal(null)}
                        onSave={savePago}
                    />
                )}

                {facturaToDelete && (
                    <ConfirmModal
                        title="Confirmar Eliminación"
                        busy={actionLoading}
                        confirmLabel="Sí, Eliminar"
                        busyLabel="Eliminando..."
                        onCancel={() => setFacturaToDelete(null)}
                        onConfirm={confirmDeleteFactura}
                    >
                        ¿Estás seguro de que deseas eliminar la factura con UUID{' '}
                        <strong style={{ color: '#f1f5f9' }}>{facturaToDelete.uuid_fiscal}</strong>? Si tiene archivos adjuntos (PDF o XML) en Supabase Storage, también serán eliminados.
                    </ConfirmModal>
                )}

                {pagoToDelete && (
                    <ConfirmModal
                        title="Confirmar eliminación"
                        busy={Boolean(deletingPagoId)}
                        confirmLabel="Sí, eliminar"
                        busyLabel="Eliminando..."
                        onCancel={() => setPagoToDelete(null)}
                        onConfirm={() => removePago(pagoToDelete)}
                    >
                        ¿Eliminar el complemento de pago <strong>#{pagoToDelete.num_pago || '—'}</strong> con fecha{' '}
                        <strong>{mostrarFechaCompleta(pagoToDelete.fecha_pago)}</strong>? Esta acción no se puede deshacer.
                    </ConfirmModal>
                )}

                {docToDelete && (
                    <ConfirmModal
                        title={`Eliminar ${docToDelete.tipo.toUpperCase()}`}
                        busy={actionLoading}
                        confirmLabel="Sí, eliminar documento"
                        busyLabel="Eliminando..."
                        onCancel={() => setDocToDelete(null)}
                        onConfirm={confirmDeleteDoc}
                    >
                        ¿Estás seguro de que deseas eliminar el archivo{' '}
                        <strong style={{ color: '#f1f5f9' }}>{docToDelete.tipo.toUpperCase()}</strong>{' '}
                        {docToDelete.scope === 'factura'
                            ? <>de la factura <strong style={{ color: '#f1f5f9' }}>{docToDelete.record.uuid_fiscal || `#${docToDelete.record.id_factura}`}</strong></>
                            : <>del complemento de pago <strong style={{ color: '#f1f5f9' }}>#{docToDelete.record.num_pago || '—'}</strong></>}
                        ? Se borrará permanentemente de Supabase Storage.
                    </ConfirmModal>
                )}

                {facturaDetalleActual && (
                    <FacturaDetailModal
                        factura={facturaDetalleActual}
                        isAdmin={isAdmin}
                        canRegisterPago={canRegisterPago}
                        busy={actionLoading}
                        onClose={() => setFacturaDetalle(null)}
                        onCopy={handleCopyUuid}
                        onOpenFile={openFacturaFile}
                        onReplaceDoc={acciones.replaceFacturaDoc}
                        onDeleteDoc={acciones.deleteFacturaDoc}
                        onAbonar={(f) => { setFacturaDetalle(null); openPagoModal(f.id_factura, f); }}
                        onEditar={acciones.editar}
                    />
                )}

                {pagoDetalleActual && (
                    <PagoDetailModal
                        pago={pagoDetalleActual}
                        isAdmin={isAdmin}
                        busy={actionLoading}
                        onClose={() => setPagoDetalle(null)}
                        onCopy={handleCopyUuid}
                        onOpenFile={openComplementoFile}
                        onReplaceDoc={acciones.replaceComplementoDoc}
                        onDeleteDoc={acciones.deleteComplementoDoc}
                        onEditar={openEditPago}
                    />
                )}
                <input
                    type="file"
                    ref={replaceDocInputRef}
                    style={{ display: 'none' }}
                    onChange={handleReplaceDocFile}
                />
            </div>
        </Layout>
    );
}

export default Facturas;
