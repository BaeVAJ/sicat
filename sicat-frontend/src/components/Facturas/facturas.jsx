// src/components/Facturas/facturas.jsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import Layout from '../layout/Layout';
import './facturas.css';

function Facturas() {
    const { usuario } = useAuth();

    const [facturas, setFacturas] = useState([]);
    const [compras, setCompras] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Search and filters
    const [search, setSearch] = useState('');
    const [filterMetodo, setFilterMetodo] = useState('ALL');
    const [filterPdf, setFilterPdf] = useState('ALL');

    // Create Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [idCompra, setIdCompra] = useState('');
    const [uuidFiscal, setUuidFiscal] = useState('');
    const [rfcEmisor, setRfcEmisor] = useState('');
    const [rfcReceptor, setRfcReceptor] = useState('');
    const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split('T')[0]);
    const [montoSubtotal, setMontoSubtotal] = useState('');
    const [montoIva, setMontoIva] = useState('');
    const [metodoPago, setMetodoPago] = useState('PUE');
    const [usoCfdi, setUsoCfdi] = useState('G01');
    const [archivoPdf, setArchivoPdf] = useState(null);

    // PDF Viewer Modal state
    const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
    const [previewPdfTitle, setPreviewPdfTitle] = useState('');

    // Delete Confirmation Modal
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [facturaToDelete, setFacturaToDelete] = useState(null);

    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchFacturas();
        fetchCompras();
    }, []);

    const fetchFacturas = async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await client.get('/facturas');
            setFacturas(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al cargar las facturas');
        } finally {
            setLoading(false);
        }
    };

    const fetchCompras = async () => {
        try {
            const { data } = await client.get('/compras');
            setCompras(Array.isArray(data) ? data : []);
        } catch {
            console.warn('No se pudieron precargar las compras para el formulario');
        }
    };

    // Open create modal
    const handleOpenCreate = () => {
        setIdCompra('');
        setUuidFiscal(crypto.randomUUID ? crypto.randomUUID() : '');
        setRfcEmisor('');
        setRfcReceptor('');
        setFechaEmision(new Date().toISOString().split('T')[0]);
        setMontoSubtotal('');
        setMontoIva('');
        setMetodoPago('PUE');
        setUsoCfdi('G01');
        setArchivoPdf(null);
        setError('');
        setModalOpen(true);
    };

    // Calculate IVA automatically when subtotal changes (16%)
    const handleSubtotalChange = (val) => {
        setMontoSubtotal(val);
        const num = parseFloat(val);
        if (!isNaN(num) && num > 0) {
            setMontoIva((num * 0.16).toFixed(2));
        } else {
            setMontoIva('');
        }
    };

    // Handle File selection
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                setError('El archivo seleccionado debe ser un documento PDF');
                return;
            }
            if (file.size > 20 * 1024 * 1024) {
                setError('El archivo no debe exceder los 20 MB');
                return;
            }
            setArchivoPdf(file);
            setError('');
        }
    };

    // Handle Submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!idCompra) {
            setError('Debes seleccionar una compra asociada');
            return;
        }
        if (!uuidFiscal.trim()) {
            setError('El UUID fiscal es obligatorio');
            return;
        }

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

        if (archivoPdf) {
            formData.append('archivo', archivoPdf);
        }

        try {
            const { data } = await client.post('/facturas', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setFacturas((prev) => [data, ...prev]);

            let mensaje = 'Factura registrada exitosamente.';
            if (data.compressionStats) {
                const orig = (data.compressionStats.originalSize / 1024).toFixed(1);
                const comp = (data.compressionStats.compressedSize / 1024).toFixed(1);
                mensaje += ` PDF optimizado: ${orig} KB → ${comp} KB.`;
            }
            setSuccess(mensaje);
            setModalOpen(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al registrar la factura');
        } finally {
            setActionLoading(false);
        }
    };

    // Handle Delete
    const handleConfirmDelete = async () => {
        if (!facturaToDelete) return;
        setActionLoading(true);
        setError('');
        setSuccess('');
        try {
            await client.delete(`/facturas/${facturaToDelete.id_factura}`);
            setFacturas((prev) => prev.filter((f) => f.id_factura !== facturaToDelete.id_factura));
            setSuccess('Factura eliminada correctamente.');
            setDeleteModalOpen(false);
            setFacturaToDelete(null);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al eliminar la factura');
        } finally {
            setActionLoading(false);
        }
    };

    // Abrir visor de PDF obteniendo URL firmada segura del backend
    const handleVerPdf = async (factura) => {
        try {
            setActionLoading(true);
            const { data } = await client.get(`/facturas/${factura.id_factura}/url`);
            setPreviewPdfUrl(data.url);
            setPreviewPdfTitle(`Factura ${factura.uuid_fiscal || factura.id_factura}`);
        } catch (err) {
            if (factura.archivo_url) {
                setPreviewPdfUrl(factura.archivo_url);
                setPreviewPdfTitle(`Factura ${factura.uuid_fiscal || factura.id_factura}`);
            } else {
                setError(err.response?.data?.error || 'No se pudo obtener el acceso al PDF');
            }
        } finally {
            setActionLoading(false);
        }
    };

    // Descargar o abrir en pestaña con URL firmada
    const handleDescargarPdf = async (e, factura) => {
        e.preventDefault();
        try {
            const { data } = await client.get(`/facturas/${factura.id_factura}/url`);
            window.open(data.url, '_blank', 'noopener,noreferrer');
        } catch {
            if (factura.archivo_url) {
                window.open(factura.archivo_url, '_blank', 'noopener,noreferrer');
            }
        }
    };

    // Copy UUID
    const handleCopyUuid = (uuid) => {
        navigator.clipboard?.writeText(uuid);
        setSuccess(`UUID copiado al portapapeles: ${uuid}`);
    };

    // Filtered list
    const facturasFiltradas = useMemo(() => {
        return facturas.filter((f) => {
            const matchSearch =
                (f.uuid_fiscal || '').toLowerCase().includes(search.toLowerCase()) ||
                (f.empresa || '').toLowerCase().includes(search.toLowerCase()) ||
                (f.proveedor || '').toLowerCase().includes(search.toLowerCase()) ||
                (f.rfc_emisor || '').toLowerCase().includes(search.toLowerCase()) ||
                (f.rfc_receptor || '').toLowerCase().includes(search.toLowerCase());

            if (!matchSearch) return false;
            if (filterMetodo !== 'ALL' && f.metodo_pago !== filterMetodo) return false;
            if (filterPdf === 'WITH_PDF' && !f.archivo_url) return false;
            if (filterPdf === 'WITHOUT_PDF' && f.archivo_url) return false;
            return true;
        });
    }, [facturas, search, filterMetodo, filterPdf]);

    // Summary calculations
    const totalFacturas = facturas.length;
    const conPdfCount = facturas.filter((f) => f.archivo_url).length;
    const montoTotalAcumulado = facturas.reduce(
        (acc, f) => acc + (parseFloat(f.monto_subtotal || 0) + parseFloat(f.monto_iva || 0)),
        0
    );
    const subtotalAcumulado = facturas.reduce((acc, f) => acc + parseFloat(f.monto_subtotal || 0), 0);

    return (
        <Layout>
            <div className="facturas-container">
                {/* ── Header ── */}
                <div className="facturas-header">
                    <div>
                        <h1 className="facturas-header__title">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <polyline points="10 9 9 9 8 9" />
                            </svg>
                            Gestión de Facturas Fiscales
                        </h1>
                        <p className="facturas-header__subtitle">
                            
                        </p>
                        
                    </div>
                    <div className="facturas-header__actions">
                        <button
                            type="button"
                            className="facturas-btn facturas-btn--secondary"
                            onClick={fetchFacturas}
                            disabled={loading}
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={loading ? 'facturas-btn__spin' : ''}
                            >
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                            <span>Actualizar</span>
                        </button>
                        {['admin', 'gerente'].includes(usuario?.rol) && (
                            <button
                                type="button"
                                className="facturas-btn facturas-btn--primary"
                                onClick={handleOpenCreate}
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

                {/* ── Stats ── */}
                <div className="facturas-stats">
                    <div className="facturas-stat" style={{ borderColor: '#059669' }}>
                        <span className="facturas-stat__count" style={{ color: '#34d399' }}>
                            {totalFacturas}
                        </span>
                        <span className="facturas-stat__label">Total Facturas</span>
                    </div>
                    <div className="facturas-stat" style={{ borderColor: '#06b6d4' }}>
                        <span className="facturas-stat__count" style={{ color: '#67e8f9' }}>
                            ${montoTotalAcumulado.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="facturas-stat__label">Monto Total Facturado</span>
                    </div>
                    <div className="facturas-stat" style={{ borderColor: '#7c3aed' }}>
                        <span className="facturas-stat__count" style={{ color: '#c4b5fd' }}>
                            ${subtotalAcumulado.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="facturas-stat__label">Subtotal Acumulado</span>
                    </div>
                    <div className="facturas-stat" style={{ borderColor: '#f59e0b' }}>
                        <span className="facturas-stat__count" style={{ color: '#fbbf24' }}>
                            {conPdfCount} / {totalFacturas}
                        </span>
                        <span className="facturas-stat__label">Con PDF Adjunto</span>
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
                        <button
                            type="button"
                            className="facturas-alert__close"
                            onClick={() => setError('')}
                            title="Cerrar alerta"
                            aria-label="Cerrar alerta"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                {success && (
                    <div className="facturas-alert facturas-alert--success" role="alert">
                        <div className="facturas-alert__content">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            <span>{success}</span>
                        </div>
                        <button
                            type="button"
                            className="facturas-alert__close"
                            onClick={() => setSuccess('')}
                            title="Cerrar notificación"
                            aria-label="Cerrar notificación"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* ── Search & Filter Toolbar ── */}
                <div className="facturas-toolbar">
                    <div className="facturas-search-wrap">
                        <span className="facturas-search-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            className="facturas-search-input"
                            placeholder="Buscar por UUID fiscal, empresa, proveedor o RFC..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        className="facturas-filter-select"
                        value={filterMetodo}
                        onChange={(e) => setFilterMetodo(e.target.value)}
                    >
                        <option value="ALL">Todos los métodos</option>
                        <option value="PUE">PUE - Pago único</option>
                        <option value="PPD">PPD - En parcialidades</option>
                    </select>
                    <select
                        className="facturas-filter-select"
                        value={filterPdf}
                        onChange={(e) => setFilterPdf(e.target.value)}
                    >
                        <option value="ALL">Todos los archivos</option>
                        <option value="WITH_PDF">Solo con PDF</option>
                        <option value="WITHOUT_PDF">Sin PDF adjunto</option>
                    </select>
                </div>

                {/* ── Table ── */}
                <div className="facturas-table-wrap">
                    <table className="facturas-table">
                        <thead>
                            <tr>
                                <th>UUID Fiscal</th>
                                <th>Empresa / Proveedor</th>
                                <th>Emisión</th>
                                <th>Subtotal / IVA</th>
                                <th>Total</th>
                                <th>Método / CFDI</th>
                                <th>Documento PDF</th>
                                {usuario?.rol === 'admin' && <th>Acciones</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={usuario?.rol === 'admin' ? 8 : 7} style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                                        <span className="facturas-btn__spin" style={{ display: 'inline-block', marginRight: '8px' }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="23 4 23 10 17 10" />
                                                <polyline points="1 20 1 14 7 14" />
                                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                            </svg>
                                        </span>
                                        Cargando facturas fiscales...
                                    </td>
                                </tr>
                            ) : facturasFiltradas.length === 0 ? (
                                <tr>
                                    <td colSpan={usuario?.rol === 'admin' ? 8 : 7} style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'rgba(148, 163, 184, 0.5)' }}>
                                        {search || filterMetodo !== 'ALL' || filterPdf !== 'ALL'
                                            ? 'No se encontraron facturas con los filtros aplicados'
                                            : 'No hay facturas registradas en el sistema'}
                                    </td>
                                </tr>
                            ) : (
                                facturasFiltradas.map((factura) => {
                                    const total = parseFloat(factura.monto_subtotal || 0) + parseFloat(factura.monto_iva || 0);
                                    return (
                                        <tr key={factura.id_factura}>
                                            <td>
                                                <div className="facturas-table__uuid">
                                                    <span>{factura.uuid_fiscal ? `${factura.uuid_fiscal.substring(0, 13)}...` : '—'}</span>
                                                    {factura.uuid_fiscal && (
                                                        <button
                                                            type="button"
                                                            className="facturas-copy-btn"
                                                            title="Copiar UUID completo"
                                                            onClick={() => handleCopyUuid(factura.uuid_fiscal)}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{factura.empresa || 'Empresa'}</div>
                                                <div className="facturas-table__sub">Prov: {factura.proveedor || 'Proveedor'}</div>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: '0.84rem' }}>
                                                    {factura.fecha_emision ? new Date(factura.fecha_emision).toLocaleDateString('es-MX') : '—'}
                                                </span>
                                            </td>
                                            <td>
                                                <div>${parseFloat(factura.monto_subtotal || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                                                <div className="facturas-table__sub">+IVA: ${parseFloat(factura.monto_iva || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                                            </td>
                                            <td>
                                                <div className="facturas-table__total">
                                                    ${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                    <span className={`facturas-badge ${factura.metodo_pago === 'PUE' ? 'facturas-badge--pue' : 'facturas-badge--ppd'}`}>
                                                        {factura.metodo_pago || 'PUE'}
                                                    </span>
                                                    <span className="facturas-badge facturas-badge--cfdi">
                                                        {factura.uso_cfdi || 'G01'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                {factura.archivo_url ? (
                                                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                                        <button
                                                            type="button"
                                                            className="facturas-btn facturas-btn--pdf"
                                                            onClick={() => handleVerPdf(factura)}
                                                            disabled={actionLoading}
                                                            title="Ver documento PDF"
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                                <circle cx="12" cy="12" r="3" />
                                                            </svg>
                                                            <span>Ver PDF</span>
                                                        </button>
                                                        
                                                    </div>
                                                ) : (
                                                    <span className="facturas-badge facturas-badge--nopdf">Sin archivo</span>
                                                )}
                                            </td>
                                            {usuario?.rol === 'admin' && (
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="facturas-btn facturas-btn--danger"
                                                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}
                                                        title="Eliminar factura"
                                                        onClick={() => {
                                                            setFacturaToDelete(factura);
                                                            setDeleteModalOpen(true);
                                                        }}
                                                        disabled={actionLoading}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                        </svg>
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Modal: Registrar Factura ── */}
                {modalOpen && (
                    <div className="facturas-modal-overlay">
                        <div className="facturas-modal">
                            <div className="facturas-modal__header">
                                <h2 className="facturas-modal__title">Registrar Nueva Factura Fiscal</h2>
                                <button
                                    type="button"
                                    className="facturas-modal__close"
                                    onClick={() => setModalOpen(false)}
                                    disabled={actionLoading}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit}>
                                {/* Compra Asociada */}
                                <div className="facturas-form-group">
                                    <label className="facturas-form-label">Compra Asociada *</label>
                                    <select
                                        className="facturas-form-select"
                                        value={idCompra}
                                        onChange={(e) => setIdCompra(e.target.value)}
                                        required
                                    >
                                        <option value="">Selecciona la compra correspondiente</option>
                                        {compras.map((c) => (
                                            <option key={c.id_compra} value={c.id_compra}>
                                                Compra #{c.id_compra} — {c.empresa || 'Empresa'} / {c.proveedor || 'Proveedor'} (${parseFloat(c.total || 0).toLocaleString('es-MX')})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* UUID Fiscal */}
                                <div className="facturas-form-group">
                                    <label className="facturas-form-label">UUID Fiscal (Folio Digital) *</label>
                                    <input
                                        type="text"
                                        className="facturas-form-input"
                                        placeholder="Ej. 123e4567-e89b-12d3-a456-426614174000"
                                        value={uuidFiscal}
                                        onChange={(e) => setUuidFiscal(e.target.value)}
                                        required
                                    />
                                </div>

                                {/* RFC Emisor y Receptor */}
                                <div className="facturas-grid-2">
                                    <div className="facturas-form-group">
                                        <label className="facturas-form-label">RFC Emisor</label>
                                        <input
                                            type="text"
                                            className="facturas-form-input"
                                            placeholder="RFC del Proveedor"
                                            value={rfcEmisor}
                                            onChange={(e) => setRfcEmisor(e.target.value.toUpperCase())}
                                            maxLength={13}
                                        />
                                    </div>
                                    <div className="facturas-form-group">
                                        <label className="facturas-form-label">RFC Receptor</label>
                                        <input
                                            type="text"
                                            className="facturas-form-input"
                                            placeholder="RFC de la Empresa"
                                            value={rfcReceptor}
                                            onChange={(e) => setRfcReceptor(e.target.value.toUpperCase())}
                                            maxLength={13}
                                        />
                                    </div>
                                </div>

                                {/* Fecha de Emisión y Método de Pago */}
                                <div className="facturas-grid-2">
                                    <div className="facturas-form-group">
                                        <label className="facturas-form-label">Fecha de Emisión</label>
                                        <input
                                            type="date"
                                            className="facturas-form-input"
                                            value={fechaEmision}
                                            onChange={(e) => setFechaEmision(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="facturas-form-group">
                                        <label className="facturas-form-label">Método de Pago</label>
                                        <select
                                            className="facturas-form-select"
                                            value={metodoPago}
                                            onChange={(e) => setMetodoPago(e.target.value)}
                                        >
                                            <option value="PUE">PUE - Pago en una sola exhibición</option>
                                            <option value="PPD">PPD - Pago en parcialidades o diferido</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Uso de CFDI */}
                                <div className="facturas-form-group">
                                    <label className="facturas-form-label">Uso de CFDI</label>
                                    <select
                                        className="facturas-form-select"
                                        value={usoCfdi}
                                        onChange={(e) => setUsoCfdi(e.target.value)}
                                    >
                                        <option value="G01">G01 - Adquisición de mercancías</option>
                                        <option value="G02">G02 - Devoluciones, descuentos o bonificaciones</option>
                                        <option value="G03">G03 - Gastos en general</option>
                                        <option value="I01">I01 - Construcciones</option>
                                        <option value="I02">I02 - Mobilario y equipo de oficina</option>
                                        <option value="P01">P01 - Por definir</option>
                                    </select>
                                </div>

                                {/* Subtotal e IVA */}
                                <div className="facturas-grid-2">
                                    <div className="facturas-form-group">
                                        <label className="facturas-form-label">Monto Subtotal ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="facturas-form-input"
                                            placeholder="0.00"
                                            value={montoSubtotal}
                                            onChange={(e) => handleSubtotalChange(e.target.value)}
                                        />
                                    </div>
                                    <div className="facturas-form-group">
                                        <label className="facturas-form-label">Monto IVA (16%) ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="facturas-form-input"
                                            placeholder="0.00"
                                            value={montoIva}
                                            onChange={(e) => setMontoIva(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* PDF Upload Dropzone */}
                                <div className="facturas-form-group">
                                    <label className="facturas-form-label">Archivo de Factura en PDF (Opcional)</label>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept=".pdf,application/pdf"
                                        style={{ display: 'none' }}
                                        onChange={handleFileChange}
                                    />

                                    {!archivoPdf ? (
                                        <div
                                            className="facturas-dropzone"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <div className="facturas-dropzone__icon">
                                                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <polyline points="17 8 12 3 7 8" />
                                                    <line x1="12" y1="3" x2="12" y2="15" />
                                                </svg>
                                            </div>
                                            <div className="facturas-dropzone__text">Haz clic o arrastra aquí tu archivo PDF</div>
                                            <div className="facturas-dropzone__subtext">
                                                Se optimizará y comprimirá automáticamente al subir al bucket de facturas (Máx 20MB)
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="facturas-file-preview">
                                            <div className="facturas-file-preview__info">
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    <polyline points="14 2 14 8 20 8" />
                                                </svg>
                                                <div>
                                                    <div className="facturas-file-preview__name">{archivoPdf.name}</div>
                                                    <div className="facturas-file-preview__size">
                                                        {(archivoPdf.size / 1024).toFixed(1)} KB (Listo para optimizar y subir)
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="facturas-alert__close"
                                                onClick={() => setArchivoPdf(null)}
                                                title="Quitar archivo"
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="18" y1="6" x2="6" y2="18" />
                                                    <line x1="6" y1="6" x2="18" y2="18" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="facturas-modal__footer">
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
                                        className="facturas-btn facturas-btn--primary"
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? (
                                            <>
                                                <span className="facturas-btn__spin">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="23 4 23 10 17 10" />
                                                        <polyline points="1 20 1 14 7 14" />
                                                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                                    </svg>
                                                </span>
                                                <span>Subiendo y Comprimiendo...</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                                    <polyline points="17 21 17 13 7 13 7 21" />
                                                    <polyline points="7 3 7 8 15 8" />
                                                </svg>
                                                <span>Guardar Factura</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── Modal: Visor de PDF Embebido ── */}
                {previewPdfUrl && (
                    <div className="facturas-modal-overlay">
                        <div className="facturas-modal facturas-modal--pdf">
                            <div className="facturas-modal__header">
                                <h2 className="facturas-modal__title">{previewPdfTitle || 'Documento PDF'}</h2>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <a
                                        href={previewPdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="facturas-btn facturas-btn--secondary"
                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}
                                    >
                                        Abrir en pestaña
                                    </a>
                                    <button
                                        type="button"
                                        className="facturas-modal__close"
                                        onClick={() => setPreviewPdfUrl(null)}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
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

                {/* ── Modal: Confirmar Eliminación ── */}
                {deleteModalOpen && facturaToDelete && (
                    <div className="facturas-modal-overlay">
                        <div className="facturas-modal" style={{ maxWidth: '420px' }}>
                            <div className="facturas-modal__header">
                                <h2 className="facturas-modal__title" style={{ color: '#fca5a5' }}>
                                    Confirmar Eliminación
                                </h2>
                                <button
                                    type="button"
                                    className="facturas-modal__close"
                                    onClick={() => setDeleteModalOpen(false)}
                                    disabled={actionLoading}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                            <p style={{ color: '#cbd5e1', fontSize: '0.92rem', lineHeight: '1.5', margin: '0.5rem 0 1.5rem' }}>
                                ¿Estás seguro de que deseas eliminar la factura con UUID{' '}
                                <strong style={{ color: '#f1f5f9' }}>{facturaToDelete.uuid_fiscal}</strong>? Si tiene un archivo PDF adjunto en Supabase Storage, también será eliminado.
                            </p>
                            <div className="facturas-modal__footer">
                                <button
                                    type="button"
                                    className="facturas-btn facturas-btn--secondary"
                                    onClick={() => setDeleteModalOpen(false)}
                                    disabled={actionLoading}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    className="facturas-btn facturas-btn--danger"
                                    onClick={handleConfirmDelete}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? 'Eliminando...' : 'Sí, Eliminar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}

export default Facturas;
