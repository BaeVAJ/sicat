// src/components/Facturas/facturas.jsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import Layout from '../layout/Layout';
import './facturas.css';

// Helper: Formatea texto XML con sangrías para visualización limpia
function formatXml(xmlStr) {
    if (!xmlStr) return '';
    try {
        const PADDING = '  ';
        const reg = /(>)(<)(\/*)/g;
        let formatted = xmlStr.replace(reg, '$1\r\n$2$3');
        let pad = 0;
        return formatted
            .split('\r\n')
            .map((node) => {
                let indent = 0;
                if (node.match(/.+<\/\w[^>]*>$/)) {
                    indent = 0;
                } else if (node.match(/^<\/\w/)) {
                    if (pad > 0) pad -= 1;
                } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
                    indent = 1;
                } else {
                    indent = 0;
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

// Helper: Descarga de archivo segura con nombre y extensión garantizada
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
    const [filterArchivos, setFilterArchivos] = useState('ALL'); // 'ALL' | 'PDF' | 'XML' | 'BOTH' | 'NONE'

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
    const [archivoXml, setArchivoXml] = useState(null);
    const [xmlParseNotice, setXmlParseNotice] = useState('');

    // PDF Viewer Modal state
    const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
    const [previewPdfTitle, setPreviewPdfTitle] = useState('');
    const [previewPdfFilename, setPreviewPdfFilename] = useState('');

    // XML Viewer Modal state
    const [previewXmlContent, setPreviewXmlContent] = useState(null);
    const [previewXmlTitle, setPreviewXmlTitle] = useState('');
    const [previewXmlDownloadUrl, setPreviewXmlDownloadUrl] = useState('');
    const [previewXmlFilename, setPreviewXmlFilename] = useState('');
    const [xmlCopied, setXmlCopied] = useState(false);

    // Delete Confirmation Modal
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [facturaToDelete, setFacturaToDelete] = useState(null);

    // Detail Modal state
    const [facturaDetalle, setFacturaDetalle] = useState(null);

    const pdfInputRef = useRef(null);
    const xmlInputRef = useRef(null);

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
        setArchivoXml(null);
        setXmlParseNotice('');
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

    // Handle PDF File selection
    const handlePdfChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                setError('El archivo seleccionado debe ser un documento PDF (.pdf)');
                return;
            }
            if (file.size > 25 * 1024 * 1024) {
                setError('El archivo PDF no debe exceder los 25 MB');
                return;
            }
            setArchivoPdf(file);
            setError('');
        }
    };

    // Handle XML File selection & Smart CFDI Autofill
    const handleXmlChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.xml') && file.type !== 'text/xml' && file.type !== 'application/xml') {
            setError('El archivo seleccionado debe ser un documento XML (.xml)');
            return;
        }

        setArchivoXml(file);
        setError('');

        // Parse XML to autofill form fields
        try {
            const text = await file.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'text/xml');

            // 1. UUID Fiscal
            const timbre = xmlDoc.getElementsByTagName('tfd:TimbreFiscalDigital')[0] ||
                xmlDoc.getElementsByTagName('TimbreFiscalDigital')[0];
            const parsedUuid = timbre?.getAttribute('UUID');

            // 2. Comprobante (Fecha, SubTotal, Total, MetodoPago)
            const comprobante = xmlDoc.getElementsByTagName('cfdi:Comprobante')[0] ||
                xmlDoc.getElementsByTagName('Comprobante')[0];
            const parsedFecha = comprobante?.getAttribute('Fecha')?.split('T')[0];
            const parsedSubtotal = comprobante?.getAttribute('SubTotal');
            const parsedMetodoPago = comprobante?.getAttribute('MetodoPago');

            // 3. Emisor (RFC)
            const emisor = xmlDoc.getElementsByTagName('cfdi:Emisor')[0] ||
                xmlDoc.getElementsByTagName('Emisor')[0];
            const parsedRfcEmisor = emisor?.getAttribute('Rfc');

            // 4. Receptor (RFC, UsoCFDI)
            const receptor = xmlDoc.getElementsByTagName('cfdi:Receptor')[0] ||
                xmlDoc.getElementsByTagName('Receptor')[0];
            const parsedRfcReceptor = receptor?.getAttribute('Rfc');
            const parsedUsoCfdi = receptor?.getAttribute('UsoCFDI');

            // 5. Impuestos (IVA SAT 002)
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

            // Si no está en el nodo de Impuestos principal, buscar en los Traslados (Impuesto 002 = IVA)
            if (!parsedIva) {
                const allTraslados = Array.from(xmlDoc.getElementsByTagName('*')).filter(
                    (el) => el.localName === 'Traslado'
                );
                const ivaTraslados = allTraslados.filter(
                    (t) => (t.getAttribute('Impuesto') === '002' || !t.hasAttribute('Impuesto')) && t.getAttribute('Importe')
                );
                if (ivaTraslados.length > 0) {
                    const sum = ivaTraslados.reduce((acc, t) => acc + (parseFloat(t.getAttribute('Importe')) || 0), 0);
                    if (sum > 0) {
                        parsedIva = sum.toFixed(2);
                    }
                }
            }

            let camposRellenados = 0;

            if (parsedUuid) {
                setUuidFiscal(parsedUuid);
                camposRellenados++;
            }
            if (parsedRfcEmisor) {
                setRfcEmisor(parsedRfcEmisor.toUpperCase());
                camposRellenados++;
            }
            if (parsedRfcReceptor) {
                setRfcReceptor(parsedRfcReceptor.toUpperCase());
                camposRellenados++;
            }
            if (parsedFecha) {
                setFechaEmision(parsedFecha);
                camposRellenados++;
            }
            if (parsedSubtotal) {
                setMontoSubtotal(parsedSubtotal);
                camposRellenados++;
            }
            if (parsedIva !== null && parsedIva !== undefined) {
                setMontoIva(parsedIva);
                camposRellenados++;
            }
            if (parsedMetodoPago && ['PUE', 'PPD'].includes(parsedMetodoPago.toUpperCase())) {
                setMetodoPago(parsedMetodoPago.toUpperCase());
                camposRellenados++;
            }
            if (parsedUsoCfdi) {
                setUsoCfdi(parsedUsoCfdi.toUpperCase());
                camposRellenados++;
            }

            if (camposRellenados > 0) {
                setXmlParseNotice(`¡XML procesado! Se autocompletaron ${camposRellenados} campos fiscales.`);
            }
        } catch (err) {
            console.warn('No se pudo autocompletar desde el XML:', err);
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
            formData.append('archivo_pdf', archivoPdf);
        }
        if (archivoXml) {
            formData.append('archivo_xml', archivoXml);
        }

        try {
            const { data } = await client.post('/facturas', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setFacturas((prev) => [data, ...prev]);

            let mensaje = 'Factura registrada exitosamente.';
            const adjuntos = [];
            if (archivoPdf) adjuntos.push('PDF');
            if (archivoXml) adjuntos.push('XML');
            if (adjuntos.length > 0) {
                mensaje += ` (Archivos guardados: ${adjuntos.join(' + ')})`;
            }

            setSuccess(mensaje);
            setModalOpen(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al registrar la factura');
        } finally {
            setActionLoading(false);
        }
    };

    // Handle Copy UUID
    const handleCopyUuid = (uuid) => {
        if (!uuid) return;
        navigator.clipboard.writeText(uuid);
        setSuccess(`UUID copiado al portapapeles: ${uuid}`);
        setTimeout(() => setSuccess(''), 3000);
    };

    // Ver / Previsualizar PDF en modal con URL firmada
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

    // Ver / Previsualizar XML en modal ventana emergente con formato y descarga
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

            // Descargar el contenido de texto del XML para mostrarlo en la ventana
            const res = await fetch(signedUrl);
            const xmlText = await res.text();
            const formatted = formatXml(xmlText);

            const cleanUuid = factura.uuid_fiscal || `Factura_${factura.id_factura}`;
            const fileName = `Factura_${cleanUuid}.xml`;

            setPreviewXmlContent(formatted);
            setPreviewXmlTitle(`Comprobante Fiscal XML — ${cleanUuid.substring(0, 13)}...`);
            setPreviewXmlDownloadUrl(signedUrl);
            setPreviewXmlFilename(fileName);
            setXmlCopied(false);
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Error al abrir el archivo XML');
        } finally {
            setActionLoading(false);
        }
    };

    // Copiar contenido XML al portapapeles
    const handleCopyXmlContent = () => {
        if (!previewXmlContent) return;
        navigator.clipboard.writeText(previewXmlContent);
        setXmlCopied(true);
        setTimeout(() => setXmlCopied(false), 2500);
    };

    // Confirm Delete
    const handleConfirmDelete = async () => {
        if (!facturaToDelete) return;
        setActionLoading(true);
        setError('');
        setSuccess('');

        try {
            await client.delete(`/facturas/${facturaToDelete.id_factura}`);
            setFacturas((prev) => prev.filter((f) => f.id_factura !== facturaToDelete.id_factura));
            if (facturaDetalle && facturaDetalle.id_factura === facturaToDelete.id_factura) {
                setFacturaDetalle(null);
            }
            setSuccess(`Factura con UUID ${facturaToDelete.uuid_fiscal} eliminada correctamente`);
            setDeleteModalOpen(false);
            setFacturaToDelete(null);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al eliminar la factura');
        } finally {
            setActionLoading(false);
        }
    };

    // Filter and search
    const facturasFiltradas = useMemo(() => {
        return facturas.filter((factura) => {
            const query = search.toLowerCase().trim();
            const matchesSearch =
                !query ||
                factura.uuid_fiscal?.toLowerCase().includes(query) ||
                factura.empresa?.toLowerCase().includes(query) ||
                factura.proveedor?.toLowerCase().includes(query) ||
                factura.rfc_emisor?.toLowerCase().includes(query) ||
                factura.rfc_receptor?.toLowerCase().includes(query);

            const matchesMetodo = filterMetodo === 'ALL' || factura.metodo_pago === filterMetodo;

            let matchesArchivos = true;
            const hasPdf = Boolean(factura.archivo_url);
            const hasXml = Boolean(factura.archivo_xml_url);

            if (filterArchivos === 'PDF') {
                matchesArchivos = hasPdf;
            } else if (filterArchivos === 'XML') {
                matchesArchivos = hasXml;
            } else if (filterArchivos === 'BOTH') {
                matchesArchivos = hasPdf && hasXml;
            } else if (filterArchivos === 'NONE') {
                matchesArchivos = !hasPdf && !hasXml;
            }

            return matchesSearch && matchesMetodo && matchesArchivos;
        });
    }, [facturas, search, filterMetodo, filterArchivos]);

    // Financial KPI stats
    const kpis = useMemo(() => {
        const totalRegistros = facturas.length;
        let sumaTotal = 0;
        let sumaIva = 0;
        let conPdf = 0;
        let conXml = 0;

        facturas.forEach((f) => {
            const sub = parseFloat(f.monto_subtotal || 0);
            const iva = parseFloat(f.monto_iva || 0);
            sumaTotal += sub + iva;
            sumaIva += iva;
            if (f.archivo_url) conPdf++;
            if (f.archivo_xml_url) conXml++;
        });

        return {
            totalRegistros,
            sumaTotal,
            sumaIva,
            conPdf,
            conXml,
        };
    }, [facturas]);

    return (
        <Layout>
            <div className="facturas-container">
                {/* ── Header ── */}
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
                            Gestión de Facturas Fiscales
                        </h1>
                        <p className="facturas-header__subtitle">
                            Control fiscal y almacenamiento de comprobantes PDF y XML en Supabase
                        </p>
                    </div>

                    <div className="facturas-header__actions">
                        <button
                            type="button"
                            className="facturas-btn facturas-btn--secondary"
                            onClick={fetchFacturas}
                            disabled={loading || actionLoading}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'facturas-btn__spin' : ''}>
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                            <span>Refrescar</span>
                        </button>

                        {usuario?.rol === 'admin' && (
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
                    <div className="facturas-alert facturas-alert--error">
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
                    <div className="facturas-alert facturas-alert--success">
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

                {/* ── Search & Filter Bar ── */}
                <div className="facturas-filters">
                    <div className="facturas-search-wrap">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="facturas-search-icon">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            className="facturas-search-input"
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
                        value={filterMetodo}
                        onChange={(e) => setFilterMetodo(e.target.value)}
                    >
                        <option value="ALL">Todos los métodos de pago</option>
                        <option value="PUE">PUE (Pago en una sola exhibición)</option>
                        <option value="PPD">PPD (Pago en parcialidades o diferido)</option>
                    </select>

                    <select
                        className="facturas-select"
                        value={filterArchivos}
                        onChange={(e) => setFilterArchivos(e.target.value)}
                    >
                        <option value="ALL">Todos los comprobantes</option>
                        <option value="PDF">Con archivo PDF</option>
                        <option value="XML">Con archivo XML</option>
                        <option value="BOTH">Con Ambos (PDF + XML)</option>
                        <option value="NONE">Sin archivos adjuntos</option>
                    </select>
                </div>

                {/* ── Table ── */}
                <div className="facturas-table-wrap">
                    <table className="facturas-table">
                        <thead>
                            <tr>
                                <th>UUID Fiscal</th>
                                <th>Empresa / Proveedor</th>
                                <th className="facturas-hide-mobile">Emisión</th>
                                <th className="facturas-hide-mobile">Subtotal / IVA</th>
                                <th>Total</th>
                                <th className="facturas-hide-mobile">Método / CFDI</th>
                                <th>Documentos & Acciones</th>
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
                                        Cargando facturas fiscales...
                                    </td>
                                </tr>
                            ) : facturasFiltradas.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'rgba(148, 163, 184, 0.5)' }}>
                                        {search || filterMetodo !== 'ALL' || filterArchivos !== 'ALL'
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
                                                <div className="facturas-show-mobile" style={{ fontSize: '0.74rem', color: 'rgba(148, 163, 184, 0.65)', marginTop: '2px' }}>
                                                    {factura.fecha_emision ? new Date(factura.fecha_emision).toLocaleDateString('es-MX') : ''}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{factura.empresa || 'Empresa'}</div>
                                                <div className="facturas-table__sub">Prov: {factura.proveedor || 'Proveedor'}</div>
                                            </td>
                                            <td className="facturas-hide-mobile">
                                                <span style={{ fontSize: '0.84rem' }}>
                                                    {factura.fecha_emision ? new Date(factura.fecha_emision).toLocaleDateString('es-MX') : '—'}
                                                </span>
                                            </td>
                                            <td className="facturas-hide-mobile">
                                                <div>${parseFloat(factura.monto_subtotal || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                                                <div className="facturas-table__sub">+IVA: ${parseFloat(factura.monto_iva || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                                            </td>
                                            <td>
                                                <div className="facturas-table__total">
                                                    ${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                                <div className="facturas-show-mobile" style={{ marginTop: '2px' }}>
                                                    <span className={`facturas-badge ${factura.metodo_pago === 'PUE' ? 'facturas-badge--pue' : 'facturas-badge--ppd'}`} style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                                                        {factura.metodo_pago || 'PUE'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="facturas-hide-mobile">
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
                                                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    {/* Botón Detalles (Visible solo en móvil) */}
                                                    <button
                                                        type="button"
                                                        className="facturas-btn facturas-btn--secondary facturas-show-mobile"
                                                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.76rem' }}
                                                        onClick={() => setFacturaDetalle(factura)}
                                                        title="Ver detalles completos de la factura"
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="10" />
                                                            <line x1="12" y1="16" x2="12" y2="12" />
                                                            <line x1="12" y1="8" x2="12.01" y2="8" />
                                                        </svg>
                                                        <span>Detalles</span>
                                                    </button>

                                                    {/* Botón Ver PDF */}
                                                    {factura.archivo_url && (
                                                        <button
                                                            type="button"
                                                            className="facturas-btn facturas-btn--pdf"
                                                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.76rem' }}
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

                                                    {/* Botón Ver/Descargar XML */}
                                                    {factura.archivo_xml_url && (
                                                        <button
                                                            type="button"
                                                            className="facturas-btn facturas-btn--xml"
                                                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.76rem' }}
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

                                                    {/* Badge si no tiene ningún archivo */}
                                                    {!factura.archivo_url && !factura.archivo_xml_url && (
                                                        <span className="facturas-badge facturas-badge--nopdf">Sin archivos</span>
                                                    )}

                                                    {/* Botón Eliminar (Admin) */}
                                                    {usuario?.rol === 'admin' && (
                                                        <button
                                                            type="button"
                                                            className="facturas-btn facturas-btn--danger"
                                                            style={{ padding: '0.35rem 0.55rem', fontSize: '0.76rem' }}
                                                            title="Eliminar factura"
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
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Modal: Registrar Factura ── */}
                {modalOpen && (
                    <div className="facturas-modal-overlay" onClick={() => setModalOpen(false)}>
                        <div className="facturas-modal" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
                            <div className="facturas-modal__header">
                                <div>
                                    <h2 className="facturas-modal__title">Registrar Factura Fiscal</h2>
                                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                        Acepta archivo PDF, XML CFDI o ambos
                                    </span>
                                </div>
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

                            <form onSubmit={handleSubmit} className="facturas-modal__form">
                                {xmlParseNotice && (
                                    <div className="facturas-xml-notice">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                            <polyline points="22 4 12 14.01 9 11.01" />
                                        </svg>
                                        <span>{xmlParseNotice}</span>
                                    </div>
                                )}

                                {/* Compra Asociada */}
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
                                        <option value="">-- Seleccionar Compra --</option>
                                        {compras.map((c) => (
                                            <option key={c.id_compra} value={c.id_compra}>
                                                Compra #{c.id_compra} — {c.empresa || 'Empresa'} ({c.proveedor || 'Proveedor'}) - {c.fecha_compra ? new Date(c.fecha_compra).toLocaleDateString('es-MX') : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* UUID Fiscal */}
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

                                {/* RFC Emisor y Receptor */}
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

                                {/* Fecha de Emisión */}
                                <div className="facturas-form-group">
                                    <label className="facturas-label">Fecha de Emisión</label>
                                    <input
                                        type="date"
                                        className="facturas-input"
                                        value={fechaEmision}
                                        onChange={(e) => setFechaEmision(e.target.value)}
                                    />
                                </div>

                                {/* Montos Subtotal e IVA */}
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

                                {/* Método de Pago y Uso de CFDI */}
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

                                {/* ── Sección de Archivos Adjuntos (PDF + XML) ── */}
                                <div className="facturas-upload-section">
                                    <span className="facturas-label" style={{ marginBottom: '8px', display: 'block' }}>
                                        Comprobantes Fiscales Digitales (PDF, XML o Ambos)
                                    </span>

                                    <div className="facturas-grid-2" style={{ gap: '0.75rem' }}>
                                        {/* Dropzone PDF */}
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

                                        {/* Dropzone XML */}
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
                                    </div>
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
                                        {actionLoading ? 'Guardando en Supabase...' : 'Guardar Factura'}
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
                                        className="facturas-btn facturas-btn--secondary"
                                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem' }}
                                        onClick={() => downloadFile(previewPdfUrl, previewPdfFilename || 'Factura.pdf')}
                                        title="Descargar archivo PDF"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="7 10 12 15 17 10" />
                                            <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        <span>Descargar PDF</span>
                                    </button>
                                    <a
                                        href={previewPdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="facturas-btn facturas-btn--secondary"
                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}
                                    >
                                        Pestaña nueva ↗
                                    </a>
                                    <button
                                        type="button"
                                        className="facturas-modal__close"
                                        onClick={() => setPreviewPdfUrl(null)}
                                        aria-label="Cerrar visor"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

                {/* ── Modal: Visor de Archivo XML (Ventana emergente) ── */}
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
                                    {/* Botón Copiar XML */}
                                    <button
                                        type="button"
                                        className="facturas-btn facturas-btn--secondary"
                                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem' }}
                                        onClick={handleCopyXmlContent}
                                        title="Copiar código XML completo"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                        <span>{xmlCopied ? '¡Copiado!' : 'Copiar'}</span>
                                    </button>

                                    {/* Botón Descargar XML */}
                                    <button
                                        type="button"
                                        className="facturas-btn facturas-btn--xml"
                                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem' }}
                                        onClick={() => downloadFile(previewXmlDownloadUrl, previewXmlFilename)}
                                        title="Descargar archivo con extensión .xml"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="7 10 12 15 17 10" />
                                            <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        <span>Descargar XML</span>
                                    </button>

                                    {/* Botón Cerrar */}
                                    <button
                                        type="button"
                                        className="facturas-modal__close"
                                        onClick={() => setPreviewXmlContent(null)}
                                        aria-label="Cerrar visor XML"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Contenido XML formateado con editor look */}
                            <div className="facturas-xml-viewer-body">
                                <pre className="facturas-xml-viewer-code">
                                    <code>{previewXmlContent}</code>
                                </pre>
                            </div>

                            {/* Pie de ventana XML con detalles de archivo */}
                            <div className="facturas-xml-viewer-footer">
                                <div className="facturas-xml-viewer-filename">
                                    <span>Archivo: </span>
                                    <strong>{previewXmlFilename}</strong>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        type="button"
                                        className="facturas-btn facturas-btn--xml"
                                        style={{ padding: '0.4rem 0.9rem' }}
                                        onClick={() => downloadFile(previewXmlDownloadUrl, previewXmlFilename)}
                                    >
                                        Guardar Documento (.xml)
                                    </button>
                                </div>
                            </div>
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
                                <strong style={{ color: '#f1f5f9' }}>{facturaToDelete.uuid_fiscal}</strong>? Si tiene archivos adjuntos (PDF o XML) en Supabase Storage, también serán eliminados.
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

                {/* ── Modal: Detalles Completos de Factura ── */}
                {facturaDetalle && (
                    <div className="facturas-modal-overlay" onClick={() => setFacturaDetalle(null)}>
                        <div className="facturas-modal" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
                            <div className="facturas-modal__header">
                                <div>
                                    <h2 className="facturas-modal__title">Detalles de Factura Fiscal</h2>
                                    <span style={{ fontSize: '0.76rem', color: '#38bdf8' }}>ID #{facturaDetalle.id_factura}</span>
                                </div>
                                <button
                                    type="button"
                                    className="facturas-modal__close"
                                    onClick={() => setFacturaDetalle(null)}
                                    aria-label="Cerrar modal"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', maxHeight: '72vh', overflowY: 'auto' }}>
                                {/* UUID Fiscal */}
                                <div className="facturas-detail-card">
                                    <span className="facturas-detail-card__label">UUID Fiscal (Folio Digital)</span>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
                                        <span style={{ fontFamily: 'monospace', fontSize: '0.86rem', color: '#f1f5f9', wordBreak: 'break-all' }}>
                                            {facturaDetalle.uuid_fiscal || '—'}
                                        </span>
                                        {facturaDetalle.uuid_fiscal && (
                                            <button
                                                type="button"
                                                className="facturas-copy-btn"
                                                onClick={() => handleCopyUuid(facturaDetalle.uuid_fiscal)}
                                                title="Copiar UUID"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Empresa & Proveedor */}
                                <div className="facturas-grid-2" style={{ gap: '0.75rem' }}>
                                    <div className="facturas-detail-card">
                                        <span className="facturas-detail-card__label">Empresa Receptora</span>
                                        <div style={{ fontWeight: 600, color: '#f1f5f9', marginTop: '2px' }}>
                                            {facturaDetalle.empresa || 'Empresa'}
                                        </div>
                                        <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                                            RFC: {facturaDetalle.rfc_receptor || 'No especificado'}
                                        </span>
                                    </div>
                                    <div className="facturas-detail-card">
                                        <span className="facturas-detail-card__label">Proveedor Emisor</span>
                                        <div style={{ fontWeight: 600, color: '#f1f5f9', marginTop: '2px' }}>
                                            {facturaDetalle.proveedor || 'Proveedor'}
                                        </div>
                                        <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                                            RFC: {facturaDetalle.rfc_emisor || 'No especificado'}
                                        </span>
                                    </div>
                                </div>

                                {/* Compra & Fecha */}
                                <div className="facturas-grid-2" style={{ gap: '0.75rem' }}>
                                    <div className="facturas-detail-card">
                                        <span className="facturas-detail-card__label">Compra Vinculada</span>
                                        <div style={{ fontWeight: 600, color: '#38bdf8', marginTop: '2px' }}>
                                            Compra #{facturaDetalle.id_compra}
                                        </div>
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

                                {/* Desglose Financiero */}
                                <div className="facturas-detail-card" style={{ background: 'rgba(30, 41, 59, 0.7)' }}>
                                    <span className="facturas-detail-card__label">Desglose Fiscal</span>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.86rem' }}>
                                        <span>Subtotal:</span>
                                        <span style={{ fontWeight: 600 }}>${parseFloat(facturaDetalle.monto_subtotal || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.86rem' }}>
                                        <span>IVA (16%):</span>
                                        <span style={{ fontWeight: 600, color: '#67e8f9' }}>+${parseFloat(facturaDetalle.monto_iva || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '1rem', fontWeight: 700, color: '#34d399' }}>
                                        <span>Total Facturado:</span>
                                        <span>${(parseFloat(facturaDetalle.monto_subtotal || 0) + parseFloat(facturaDetalle.monto_iva || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </div>

                                {/* Método y Uso de CFDI */}
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
                                                {facturaDetalle.uso_cfdi || 'G01 - Adquisición de mercancías'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Archivos Adjuntos */}
                                <div className="facturas-detail-card">
                                    <span className="facturas-detail-card__label">Archivos Digitales Adjuntos</span>
                                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '8px', flexWrap: 'wrap' }}>
                                        {facturaDetalle.archivo_url && (
                                            <button
                                                type="button"
                                                className="facturas-btn facturas-btn--pdf"
                                                onClick={() => handleVerPdf(facturaDetalle)}
                                                disabled={actionLoading}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                                <span>Ver Documento PDF</span>
                                            </button>
                                        )}

                                        {facturaDetalle.archivo_xml_url && (
                                            <button
                                                type="button"
                                                className="facturas-btn facturas-btn--xml"
                                                onClick={() => handleVerXml(facturaDetalle)}
                                                disabled={actionLoading}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="16 18 22 12 16 6" />
                                                    <polyline points="8 6 2 12 8 18" />
                                                </svg>
                                                <span>Ver / Descargar XML</span>
                                            </button>
                                        )}

                                        {!facturaDetalle.archivo_url && !facturaDetalle.archivo_xml_url && (
                                            <span className="facturas-badge facturas-badge--nopdf">Sin archivos digitales adjuntos</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="facturas-modal__footer" style={{ justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="facturas-btn facturas-btn--secondary"
                                    onClick={() => setFacturaDetalle(null)}
                                >
                                    Cerrar
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