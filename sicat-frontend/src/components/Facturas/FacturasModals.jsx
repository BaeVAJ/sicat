// Modales del módulo de facturas.
import { useRef, useState } from 'react';
import {
    Alert, CopyButton, DetailCard, Field, FileDropzone, Icon, Modal, SplitRow,
} from './FacturasUi';
import {
    USO_CFDI_OPCIONES, calcularFalta, campoACamel, formatoMoneda, hoyIso, mostrarFechaCompleta,
    obtenerFechaIso, parseCfdiXml, validarArchivo,
} from './facturasUtils';

const GRID_GAP = { gap: '0.75rem' };
const HINT_SUBTITLE = { fontSize: '0.78rem', color: '#94a3b8' };
const VALOR = { fontWeight: 600, color: '#f1f5f9', marginTop: '2px' };
const RFC = { fontSize: '0.76rem', color: '#94a3b8' };

/* ═══════════════ Registrar / editar factura ═══════════════ */

function formularioFactura(f) {
    if (!f) {
        return {
            idCompra: '',
            uuidFiscal: crypto.randomUUID ? crypto.randomUUID() : '',
            rfcEmisor: '',
            rfcReceptor: '',
            fechaEmision: hoyIso(),
            montoSubtotal: '',
            montoIva: '',
            metodoPago: 'PPD',
            usoCfdi: 'G01',
        };
    }
    return {
        idCompra: f.id_compra != null ? String(f.id_compra) : '',
        uuidFiscal: f.uuid_fiscal || '',
        rfcEmisor: f.rfc_emisor || '',
        rfcReceptor: f.rfc_receptor || '',
        fechaEmision: f.fecha_emision ? String(f.fecha_emision).slice(0, 10) : hoyIso(),
        montoSubtotal: f.monto_subtotal != null ? String(f.monto_subtotal) : '0',
        montoIva: f.monto_iva != null ? String(f.monto_iva) : '0',
        metodoPago: f.metodo_pago || 'PPD',
        usoCfdi: f.uso_cfdi || 'G01',
    };
}

export function FacturaFormModal({ factura, compras, canRegisterPago, busy, onClose, onSubmit, onError }) {
    const editing = Boolean(factura);
    const [form, setForm] = useState(() => formularioFactura(factura));
    const [archivoPdf, setArchivoPdf] = useState(null);
    const [archivoXml, setArchivoXml] = useState(null);
    const [eliminarPdf, setEliminarPdf] = useState(false);
    const [eliminarXml, setEliminarXml] = useState(false);
    const [notice, setNotice] = useState('');

    const set = (name, transform = (v) => v) => (e) => setForm((p) => ({ ...p, [name]: transform(e.target.value) }));
    const upper = (v) => v.toUpperCase();

    const subtotal = Number(form.montoSubtotal) || 0;
    const iva = Number(form.montoIva) || 0;
    const total = subtotal + iva;
    const puedeGuardar = Boolean(form.idCompra) && Boolean(form.uuidFiscal.trim()) && total > 0;
    const tituloBoton = puedeGuardar ? undefined : 'Selecciona una compra, un UUID y montos válidos';
    const esPpd = form.metodoPago === 'PPD';

    const comprasDisponibles = factura?.id_compra && !compras.some((c) => Number(c.id_compra) === Number(factura.id_compra))
        ? [{ id_compra: factura.id_compra, empresa: factura.empresa, proveedor: factura.proveedor, fecha_compra: factura.fecha_compra }, ...compras]
        : compras;

    const seleccionarPdf = (file) => {
        if (!file) return;
        const err = validarArchivo(file, 'pdf');
        if (err) return onError(err);
        setArchivoPdf(file);
        setEliminarPdf(false);
        onError('');
    };

    const seleccionarXml = async (file) => {
        if (!file) return;
        const err = validarArchivo(file, 'xml');
        if (err) return onError(err);
        setArchivoXml(file);
        setEliminarXml(false);
        onError('');
        try {
            const campos = parseCfdiXml(await file.text());
            const n = Object.keys(campos).length;
            setForm((p) => ({ ...p, ...campos }));
            if (n > 0) setNotice(`¡XML procesado! Se autocompletaron ${n} campos fiscales.`);
        } catch (e) {
            console.warn('No se pudo autocompletar desde el XML:', e);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.idCompra) return onError('Debes seleccionar una compra asociada');
        if (!form.uuidFiscal.trim()) return onError('El UUID fiscal es obligatorio');
        if (total <= 0) return onError('Los montos deben ser números mayores o iguales a cero y el total mayor a cero');

        const data = new FormData();
        data.append('id_compra', form.idCompra);
        data.append('uuid_fiscal', form.uuidFiscal.trim());
        if (editing || form.rfcEmisor) data.append('rfc_emisor', form.rfcEmisor.trim().toUpperCase());
        if (editing || form.rfcReceptor) data.append('rfc_receptor', form.rfcReceptor.trim().toUpperCase());
        data.append('fecha_emision', form.fechaEmision);
        data.append('monto_subtotal', form.montoSubtotal || '0');
        data.append('monto_iva', form.montoIva || '0');
        data.append('metodo_pago', form.metodoPago);
        data.append('uso_cfdi', form.usoCfdi);
        if (archivoPdf) data.append('archivo_pdf', archivoPdf);
        else if (editing && eliminarPdf) data.append('eliminar_pdf', 'true');
        if (archivoXml) data.append('archivo_xml', archivoXml);
        else if (editing && eliminarXml) data.append('eliminar_xml', 'true');

        onSubmit(data, {
            continueToPago: e.nativeEvent.submitter?.dataset.continue === 'true',
            metodo: form.metodoPago,
            subtotal,
            iva,
            adjuntos: [archivoPdf && 'PDF', archivoXml && 'XML'].filter(Boolean),
            eliminados: [editing && eliminarPdf && !archivoPdf && 'PDF', editing && eliminarXml && !archivoXml && 'XML'].filter(Boolean),
        });
    };

    return (
        <Modal
            title={editing ? 'Editar Factura Fiscal' : 'Registrar Factura Fiscal'}
            maxWidth="640px"
            busy={busy}
            svgClose
            onClose={onClose}
            subtitle={
                <span style={HINT_SUBTITLE}>
                    {editing
                        ? 'Modifica los datos fiscales o reemplaza/elimina los comprobantes PDF y XML'
                        : 'Sube primero el XML CFDI para autollenar o captura manualmente'}
                </span>
            }
        >
            <form onSubmit={handleSubmit} className="facturas-modal__form">
                {notice && (
                    <div className="facturas-xml-notice">
                        <Icon name="alertOk" />
                        <span>{notice}</span>
                    </div>
                )}

                <div className="facturas-upload-section" style={{ marginTop: 0 }}>
                    <span className="facturas-label" style={{ marginBottom: '8px', display: 'block' }}>
                        Comprobantes Fiscales Digitales (XML autollena el formulario + PDF)
                    </span>
                    <div className="facturas-grid-2" style={GRID_GAP}>
                        <FileDropzone
                            kind="xml"
                            file={archivoXml}
                            existing={editing && Boolean(factura.archivo_xml_url)}
                            markedForDelete={eliminarXml}
                            emptyTitle="Subir Archivo XML"
                            idleText="Clic para .xml (Autollena el formulario)"
                            readyText="(Autollenado)"
                            onSelect={seleccionarXml}
                            onRemove={() => { setArchivoXml(null); setNotice(''); }}
                            onDeleteExisting={() => setEliminarXml(true)}
                            onUndoDelete={() => setEliminarXml(false)}
                        />
                        <FileDropzone
                            kind="pdf"
                            file={archivoPdf}
                            existing={editing && Boolean(factura.archivo_url)}
                            markedForDelete={eliminarPdf}
                            emptyTitle="Subir Documento PDF"
                            idleText="Clic para seleccionar archivo .pdf"
                            readyText="(Listo)"
                            onSelect={seleccionarPdf}
                            onRemove={() => setArchivoPdf(null)}
                            onDeleteExisting={() => setEliminarPdf(true)}
                            onUndoDelete={() => setEliminarPdf(false)}
                        />
                    </div>
                </div>

                <Field label="Compra Asociada" required>
                    <select className="facturas-input" value={form.idCompra} onChange={set('idCompra')} required>
                        <option value="">
                            {comprasDisponibles.length === 0
                                ? '-- No hay compras pendientes de facturar --'
                                : '-- Seleccionar Compra --'}
                        </option>
                        {comprasDisponibles.map((c) => (
                            <option key={c.id_compra} value={c.id_compra}>
                                Compra #{c.id_compra} — {c.empresa || 'Empresa'} ({c.proveedor || 'Proveedor'}) - {c.fecha_compra ? new Date(c.fecha_compra).toLocaleDateString('es-MX') : ''}
                            </option>
                        ))}
                    </select>
                    {!editing && compras.length === 0 && (
                        <span style={{ color: '#fbbf24', fontSize: '0.78rem', marginTop: '0.35rem', display: 'block' }}>
                            Todas las compras registradas ya cuentan con factura asociada.
                        </span>
                    )}
                </Field>

                <Field label="UUID Fiscal (Folio Digital SAT)" required>
                    <div className="facturas-input-group">
                        <input
                            type="text"
                            className="facturas-input"
                            placeholder="ej. 123e4567-e89b-12d3-a456-426614174000"
                            value={form.uuidFiscal}
                            onChange={set('uuidFiscal')}
                            required
                        />
                        <button
                            type="button"
                            className="facturas-btn facturas-btn--secondary"
                            style={{ padding: '0 0.85rem' }}
                            title="Generar UUID aleatorio"
                            onClick={() => setForm((p) => ({ ...p, uuidFiscal: crypto.randomUUID ? crypto.randomUUID() : '' }))}
                        >
                            Generar
                        </button>
                    </div>
                </Field>

                <div className="facturas-grid-2">
                    <Field label="RFC Emisor (Proveedor)">
                        <input type="text" className="facturas-input" placeholder="ej. AAA010101AAA" maxLength="13"
                            value={form.rfcEmisor} onChange={set('rfcEmisor', upper)} />
                    </Field>
                    <Field label="RFC Receptor (Empresa)">
                        <input type="text" className="facturas-input" placeholder="ej. BBB020202BBB" maxLength="13"
                            value={form.rfcReceptor} onChange={set('rfcReceptor', upper)} />
                    </Field>
                </div>

                <Field label="Fecha de Emisión">
                    <input type="date" className="facturas-input" value={form.fechaEmision} onChange={set('fechaEmision')} />
                </Field>

                <div className="facturas-grid-2">
                    <Field label="Monto Subtotal ($ MXN)">
                        <input type="number" step="0.01" min="0" className="facturas-input" placeholder="0.00"
                            value={form.montoSubtotal} onChange={set('montoSubtotal')} />
                    </Field>
                    <Field label="Monto IVA ($ MXN)">
                        <input type="number" step="0.01" min="0" className="facturas-input" placeholder="0.00"
                            value={form.montoIva} onChange={set('montoIva')} />
                    </Field>
                </div>

                <div className="facturas-grid-2">
                    <Field label="Método de Pago">
                        <select className="facturas-input" value={form.metodoPago} onChange={set('metodoPago')}>
                            <option value="PUE">PUE - Pago en una sola exhibición</option>
                            <option value="PPD">PPD - Pago en parcialidades o diferido</option>
                        </select>
                    </Field>
                    <Field label="Uso de CFDI">
                        <select className="facturas-input" value={form.usoCfdi} onChange={set('usoCfdi')}>
                            {USO_CFDI_OPCIONES.map(([codigo, nombre]) => (
                                <option key={codigo} value={codigo}>{codigo} - {nombre}</option>
                            ))}
                        </select>
                    </Field>
                </div>

                <div className="facturas-resumen" style={{ marginBottom: 0 }}>
                    <div className="facturas-resumen__row"><span>Subtotal</span><span>{formatoMoneda(subtotal)}</span></div>
                    <div className="facturas-resumen__row"><span>IVA</span><span>{formatoMoneda(iva)}</span></div>
                    <div className="facturas-resumen__row facturas-resumen__row--total">
                        <span>Total facturado</span><span>{formatoMoneda(total)}</span>
                    </div>
                    <div className="facturas-resumen__row">
                        <span>Saldo esperado</span><span>{esPpd ? formatoMoneda(total) : '—'}</span>
                    </div>
                    <p className="facturas-resumen__hint">
                        {esPpd
                            ? <>Estado inicial: <strong>PENDIENTE</strong>. Puedes guardar la factura o continuar directamente al registro del primer complemento de pago.</>
                            : <>Con método PUE la factura se registra como <strong>PAGADO</strong>.</>}
                    </p>
                </div>

                <div className="facturas-modal__footer" style={{ flexWrap: 'wrap' }}>
                    <button type="button" className="facturas-btn facturas-btn--secondary" onClick={onClose} disabled={busy}>
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className={`facturas-btn ${!editing && esPpd ? 'facturas-btn--secondary' : 'facturas-btn--primary'}`}
                        disabled={busy || !puedeGuardar}
                        title={tituloBoton}
                    >
                        {busy ? 'Guardando...' : editing ? 'Actualizar Factura' : 'Guardar Factura'}
                    </button>
                    {!editing && esPpd && canRegisterPago && (
                        <button
                            type="submit"
                            data-continue="true"
                            className="facturas-btn facturas-btn--primary"
                            disabled={busy || !puedeGuardar}
                            title={tituloBoton}
                        >
                            {busy ? 'Guardando...' : 'Guardar y Registrar 1er Pago'}
                        </button>
                    )}
                </div>
            </form>
        </Modal>
    );
}

/* ═══════════════ Registrar / editar complemento de pago ═══════════════ */

export function PagoFormModal({ editing, initial, ppdFacturas, findFactura, getSiguientePago, formasPago, complementos, onClose, onSave }) {
    const [form, setForm] = useState(initial);
    const [pdf, setPdf] = useState(null);
    const [xml, setXml] = useState(null);
    const [eliminarPdf, setEliminarPdf] = useState(false);
    const [eliminarXml, setEliminarXml] = useState(false);
    const [saving, setSaving] = useState(false);
    const [campoError, setCampoError] = useState('');
    const [error, setError] = useState('');
    const faltaManual = useRef(Boolean(editing));

    const banner = findFactura(form.idFactura);
    const inputClass = (name) => `facturas-input${campoError === name ? ' facturas-input--error' : ''}`;

    const update = (e) => {
        const { name, value } = e.target;
        if (name === 'faltaPagar') faltaManual.current = true;
        setCampoError((prev) => (prev === name ? '' : prev));
        setError('');

        const next = { ...form, [name]: value };
        if (name === 'idFactura' && !editing) {
            const sugerido = getSiguientePago(value);
            next.numPago = sugerido.numPago;
            next.saldoAnterior = sugerido.saldoAnterior;
            faltaManual.current = false;
        }
        if (!faltaManual.current && ['idFactura', 'saldoAnterior', 'montoPago'].includes(name)) {
            next.faltaPagar = calcularFalta(next.saldoAnterior, next.montoPago);
        }
        setForm(next);
    };

    const liquidarSaldoTotal = (saldo) => {
        const val = Number(saldo);
        if (Number.isNaN(val) || val <= 0) return;
        faltaManual.current = false;
        setError('');
        setForm((prev) => {
            const saldoBase = prev.saldoAnterior !== '' ? prev.saldoAnterior : val.toFixed(2);
            const monto = val.toFixed(2);
            return { ...prev, saldoAnterior: saldoBase, montoPago: monto, faltaPagar: calcularFalta(saldoBase, monto) };
        });
    };

    const recalcularFalta = () => {
        faltaManual.current = false;
        setForm((prev) => ({ ...prev, faltaPagar: calcularFalta(prev.saldoAnterior, prev.montoPago) }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        const fechaIso = obtenerFechaIso(form.fechaPago);
        if (!form.idFactura || !fechaIso || Number(form.montoPago) <= 0) {
            return setError('Selecciona una factura PPD, fecha y monto mayor a cero');
        }
        if (form.saldoAnterior !== '' && Number(form.montoPago) > Number(form.saldoAnterior)) {
            return setError('El monto pagado no puede ser mayor al saldo anterior');
        }
        if (form.numPago !== '') {
            const duplicado = complementos.some((c) =>
                Number(c.id_factura) === Number(form.idFactura) &&
                Number(c.num_pago) === Number(form.numPago) &&
                c.id_detalle_factura !== editing?.id_detalle_factura
            );
            if (duplicado) return setError(`Ya existe el pago número ${form.numPago} para esta factura`);
        }
        const errArchivo = validarArchivo(pdf, 'pdf') || validarArchivo(xml, 'xml');
        if (errArchivo) return setError(errArchivo);

        const data = new FormData();
        Object.entries({
            num_pago: form.numPago,
            fecha_pago: fechaIso,
            saldo_anterior: form.saldoAnterior,
            monto_pago: form.montoPago,
            forma_pago: form.formaPago,
            falta_pagar: form.faltaPagar,
        }).forEach(([k, v]) => data.append(k, v ?? ''));
        if (pdf) data.append('archivo_pdf', pdf);
        else if (editing && eliminarPdf) data.append('eliminar_pdf', 'true');
        if (xml) data.append('archivo_xml', xml);
        else if (editing && eliminarXml) data.append('eliminar_xml', 'true');

        setSaving(true);
        setCampoError('');
        setError('');
        try {
            await onSave(data, { editing, idFactura: form.idFactura });
        } catch (err) {
            setCampoError(campoACamel(err.response?.data?.campo));
            setError(err.response?.data?.error || 'No se pudo guardar el complemento');
            setSaving(false);
        }
    };

    return (
        <Modal
            title={editing ? 'Editar Complemento de Pago' : 'Registrar Abono / Complemento PPD'}
            label={editing ? 'Editar complemento de pago' : 'Registrar abono PPD'}
            maxWidth="640px"
            onClose={onClose}
            subtitle={<span style={HINT_SUBTITLE}>Pagos (REP) vinculados directamente a la factura PPD</span>}
        >
            {error && <Alert type="error" compact onClose={() => setError('')}>{error}</Alert>}

            {banner && (
                <div className="facturas-context-banner">
                    <div className="facturas-context-banner__meta">
                        <strong>{banner.empresa || 'Empresa'}</strong> · {banner.proveedor || 'Proveedor'} ({banner.uuid_fiscal?.slice(0, 13)}...)
                        <span>
                            Total: {formatoMoneda(banner.total)} · Pagado: {formatoMoneda(banner.pagado)} · Saldo actual:{' '}
                            <strong style={{ color: banner.saldo > 0 ? '#fcd34d' : '#6ee7b7' }}>{formatoMoneda(banner.saldo)}</strong>
                        </span>
                    </div>
                    {!editing && banner.saldo > 0 && (
                        <button type="button" className="facturas-btn facturas-btn--primary facturas-btn--sm" onClick={() => liquidarSaldoTotal(banner.saldo)}>
                            Liquidar saldo total ({formatoMoneda(banner.saldo)})
                        </button>
                    )}
                </div>
            )}

            <form onSubmit={handleSubmit} className="facturas-modal__form">
                <div className="facturas-form-section">
                    <h3 className="facturas-form-section__title">Datos del pago</h3>

                    {editing ? (
                        <div className="facturas-form-group">
                            <span className="facturas-label">Factura</span>
                            <div className="facturas-readonly">
                                {banner?.uuid_fiscal || editing.uuid_fiscal || '—'}
                                {(banner?.empresa || editing.empresa) && ` · ${banner?.empresa || editing.empresa}`}
                            </div>
                        </div>
                    ) : (
                        <Field label="Factura PPD" htmlFor="p-factura" required>
                            <select id="p-factura" name="idFactura" className="facturas-input" value={form.idFactura} onChange={update} required>
                                <option value="">Selecciona una factura</option>
                                {ppdFacturas.map((f) => (
                                    <option key={f.id_factura} value={f.id_factura}>
                                        {f.uuid_fiscal} — {f.empresa}
                                        {f.saldo != null ? ` · saldo ${formatoMoneda(f.saldo)}` : ''}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    )}

                    <div className="facturas-grid-2">
                        <Field label="Número de pago" htmlFor="p-num">
                            <input id="p-num" type="number" name="numPago" min="1" required className={inputClass('numPago')} value={form.numPago} onChange={update} />
                        </Field>
                        <Field label="Fecha y hora" htmlFor="p-fecha">
                            <input id="p-fecha" type="datetime-local" name="fechaPago" required className={inputClass('fechaPago')} value={form.fechaPago} onChange={update} />
                        </Field>
                        <Field label="Forma de pago" htmlFor="p-forma">
                            <select id="p-forma" name="formaPago" className={inputClass('formaPago')} value={form.formaPago} onChange={update}>
                                <option value="">Selecciona una forma de pago</option>
                                {formasPago.map((v) => (
                                    <option key={v.codigo_pago} value={v.descripcion}>{v.codigo_pago} — {v.descripcion}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Saldo anterior ($ MXN)" htmlFor="p-saldo">
                            <input id="p-saldo" name="saldoAnterior" type="number" min="0" step="0.01" placeholder="0.00" className="facturas-input" value={form.saldoAnterior} onChange={update} />
                        </Field>
                        <Field label="Monto pagado ($ MXN)" htmlFor="p-monto">
                            <input id="p-monto" name="montoPago" type="number" min="0" step="0.01" placeholder="0.00" className={inputClass('montoPago')} value={form.montoPago} onChange={update} />
                        </Field>
                        <Field label="Falta por pagar" htmlFor="p-falta">
                            <input id="p-falta" name="faltaPagar" type="number" min="0" step="0.01" placeholder="0.00" className="facturas-input" value={form.faltaPagar} onChange={update} />
                            <small className="facturas-hint">
                                Saldo anterior − monto pagado.{' '}
                                <button type="button" className="facturas-link" onClick={recalcularFalta}>Recalcular</button>
                            </small>
                        </Field>
                    </div>
                </div>

                <div className="facturas-form-section">
                    <h3 className="facturas-form-section__title">Comprobantes del complemento (PDF / XML)</h3>
                    <div className="facturas-grid-2" style={GRID_GAP}>
                        <FileDropzone
                            kind="pdf"
                            file={pdf}
                            existing={Boolean(editing?.url_pdf)}
                            markedForDelete={eliminarPdf}
                            emptyTitle="Documento PDF REP"
                            idleText="Clic para seleccionar archivo .pdf"
                            readyText="· listo"
                            iconSize={18}
                            onSelect={(f) => { setPdf(f); if (f) setEliminarPdf(false); }}
                            onRemove={() => setPdf(null)}
                            onDeleteExisting={() => setEliminarPdf(true)}
                            onUndoDelete={() => setEliminarPdf(false)}
                        />
                        <FileDropzone
                            kind="xml"
                            file={xml}
                            existing={Boolean(editing?.url_xml)}
                            markedForDelete={eliminarXml}
                            emptyTitle="Archivo XML REP"
                            idleText="Clic para seleccionar archivo .xml"
                            readyText="· listo"
                            iconSize={18}
                            onSelect={(f) => { setXml(f); if (f) setEliminarXml(false); }}
                            onRemove={() => setXml(null)}
                            onDeleteExisting={() => setEliminarXml(true)}
                            onUndoDelete={() => setEliminarXml(false)}
                        />
                    </div>
                </div>

                <div className="facturas-modal__footer">
                    <button type="button" className="facturas-btn facturas-btn--secondary" onClick={onClose} disabled={saving}>
                        Cancelar
                    </button>
                    <button type="submit" className="facturas-btn facturas-btn--primary" disabled={saving}>
                        {saving ? 'Guardando...' : editing ? 'Actualizar Complemento' : 'Guardar Complemento de Pago'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

/* ═══════════════ Detalles ═══════════════ */

function UuidLine({ uuid, fontSize, onCopy }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontFamily: 'monospace', fontSize, color: '#f1f5f9', wordBreak: 'break-all' }}>{uuid || '—'}</span>
            {uuid && <CopyButton title="Copiar UUID" round={false} onClick={() => onCopy(uuid)} />}
        </div>
    );
}

function EntityCard({ label, nombre, rfc }) {
    return (
        <DetailCard label={label}>
            <div style={VALOR}>{nombre}</div>
            <span style={RFC}>RFC: {rfc || 'No especificado'}</span>
        </DetailCard>
    );
}

const BadgeCard = ({ label, className, children }) => (
    <DetailCard label={label}>
        <div style={{ marginTop: '4px' }}><span className={className}>{children}</span></div>
    </DetailCard>
);

function DocumentManageList({ record, pdfUrl, xmlUrl, isAdmin, busy, emptyLabel = 'Sin archivos', onOpenFile, onReplaceDoc, onDeleteDoc }) {
    const hasPdf = Boolean(pdfUrl);
    const hasXml = Boolean(xmlUrl);
    if (!hasPdf && !hasXml && !isAdmin) {
        return <span className="facturas-badge facturas-badge--nopdf">{emptyLabel}</span>;
    }

    const docs = [
        { tipo: 'pdf', label: 'Documento PDF', openLabel: 'Abrir PDF', existe: hasPdf },
        { tipo: 'xml', label: 'Comprobante XML', openLabel: 'Descargar XML', existe: hasXml },
    ];

    return (
        <div className="facturas-doc-list">
            {docs.map(({ tipo, label, openLabel, existe }) => (
                <div key={tipo} className="facturas-doc-row">
                    <span className="facturas-doc-row__info">
                        <Icon name={tipo === 'pdf' ? 'file' : 'code'} size={15} round />
                        <span>{label}</span>
                        {!existe && <span className="facturas-badge facturas-badge--nopdf">Sin adjuntar</span>}
                    </span>
                    <div className="facturas-doc-row__actions">
                        {existe && (
                            <button
                                type="button"
                                className={`facturas-btn facturas-btn--${tipo} facturas-btn--xs`}
                                onClick={() => onOpenFile(record, tipo)}
                                disabled={busy}
                            >
                                {openLabel}
                            </button>
                        )}
                        {isAdmin && (
                            <button
                                type="button"
                                className="facturas-btn facturas-btn--secondary facturas-btn--xs"
                                onClick={() => onReplaceDoc(record, tipo)}
                                disabled={busy}
                            >
                                {existe ? 'Reemplazar' : `Subir ${tipo.toUpperCase()}`}
                            </button>
                        )}
                        {isAdmin && existe && (
                            <button
                                type="button"
                                className="facturas-btn facturas-btn--danger facturas-btn--xs"
                                onClick={() => onDeleteDoc(record, tipo)}
                                disabled={busy}
                            >
                                Eliminar
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

export function FacturaDetailModal({ factura: f, isAdmin, canRegisterPago, busy, onClose, onCopy, onOpenFile, onReplaceDoc, onDeleteDoc, onAbonar, onEditar }) {
    const esPpd = f.metodo_pago === 'PPD';
    const colorSaldo = f.saldo > 0 ? '#fcd34d' : '#6ee7b7';

    return (
        <Modal
            detail
            maxWidth="580px"
            title="Detalles de Factura Fiscal"
            subtitle={<span style={{ fontSize: '0.76rem', color: '#38bdf8' }}>ID #{f.id_factura}</span>}
            onClose={onClose}
            footer={
                <>
                    {esPpd && f.saldo > 0 && canRegisterPago && (
                        <button type="button" className="facturas-btn facturas-btn--primary" onClick={() => onAbonar(f)}>
                            + Abonar a esta factura
                        </button>
                    )}
                    {isAdmin && (
                        <button type="button" className="facturas-btn facturas-btn--secondary" onClick={() => onEditar(f)}>
                            Editar
                        </button>
                    )}
                    <button type="button" className="facturas-btn facturas-btn--secondary" onClick={onClose}>Cerrar</button>
                </>
            }
        >
            <div className="facturas-detail-scroll">
                <div className="facturas-detail-scroll__inner">
                    <DetailCard label="UUID Fiscal (Folio Digital)">
                        <UuidLine uuid={f.uuid_fiscal} fontSize="0.84rem" onCopy={onCopy} />
                    </DetailCard>

                    <div className="facturas-grid-2" style={GRID_GAP}>
                        <EntityCard label="Empresa Receptora" nombre={f.empresa || 'Empresa'} rfc={f.rfc_receptor} />
                        <EntityCard label="Proveedor Emisor" nombre={f.proveedor || 'Proveedor'} rfc={f.rfc_emisor} />
                    </div>

                    <div className="facturas-grid-2" style={GRID_GAP}>
                        <DetailCard label="Compra Vinculada">
                            <div style={{ ...VALOR, color: '#38bdf8' }}>Compra #{f.id_compra}</div>
                            {f.fecha_compra && (
                                <span style={RFC}>Fecha compra: {new Date(f.fecha_compra).toLocaleDateString('es-MX')}</span>
                            )}
                        </DetailCard>
                        <DetailCard label="Fecha de Emisión">
                            <div style={VALOR}>
                                {f.fecha_emision
                                    ? new Date(f.fecha_emision).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
                                    : '—'}
                            </div>
                        </DetailCard>
                    </div>

                    <DetailCard label="Desglose Fiscal y Avance" style={{ background: 'rgba(30, 41, 59, 0.7)' }}>
                        <SplitRow label="Subtotal:" value={formatoMoneda(f.monto_subtotal || 0)}
                            style={{ marginTop: '6px', fontSize: '0.86rem' }} valueStyle={{ fontWeight: 600 }} />
                        <SplitRow label="IVA:" value={`+${formatoMoneda(f.monto_iva || 0)}`}
                            style={{ marginTop: '4px', fontSize: '0.86rem' }} valueStyle={{ fontWeight: 600, color: '#67e8f9' }} />
                        <SplitRow label="Total Facturado:" value={formatoMoneda(f.total)}
                            style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '1rem', fontWeight: 700, color: '#34d399' }} />
                        {esPpd && (
                            <>
                                <SplitRow label={`Total abonado (${f.numPagos} pago(s)):`} value={formatoMoneda(f.pagado)}
                                    style={{ marginTop: '6px', fontSize: '0.86rem' }} valueStyle={{ fontWeight: 600, color: '#6ee7b7' }} />
                                <SplitRow label="Saldo pendiente:" value={formatoMoneda(f.saldo)}
                                    style={{ marginTop: '4px', fontSize: '0.9rem', fontWeight: 700, color: colorSaldo }} />
                            </>
                        )}
                    </DetailCard>

                    <div className="facturas-grid-2" style={GRID_GAP}>
                        <BadgeCard label="Método de Pago" className={`facturas-badge ${f.metodo_pago === 'PUE' ? 'facturas-badge--pue' : 'facturas-badge--ppd'}`}>
                            {f.metodo_pago === 'PUE' ? 'PUE - Pago único' : 'PPD - En parcialidades'}
                        </BadgeCard>
                        <BadgeCard label="Uso de CFDI" className="facturas-badge facturas-badge--cfdi">
                            {f.uso_cfdi || 'G01'}
                        </BadgeCard>
                    </div>

                    <DetailCard label="Archivos Digitales Adjuntos">
                        <DocumentManageList
                            record={f}
                            pdfUrl={f.archivo_url}
                            xmlUrl={f.archivo_xml_url}
                            isAdmin={isAdmin}
                            busy={busy}
                            emptyLabel="Sin archivos digitales adjuntos"
                            onOpenFile={onOpenFile}
                            onReplaceDoc={onReplaceDoc}
                            onDeleteDoc={onDeleteDoc}
                        />
                    </DetailCard>
                </div>
            </div>
        </Modal>
    );
}

export function PagoDetailModal({ pago: p, isAdmin, busy, onClose, onCopy, onOpenFile, onReplaceDoc, onDeleteDoc, onEditar }) {
    const liquidado = p.falta_pagar != null && Number(p.falta_pagar) === 0;
    const datos = [
        ['Empresa', p.empresa],
        ['Proveedor', p.proveedor],
        ['Número de pago', p.num_pago],
        ['Forma de pago', p.forma_pago],
    ];

    return (
        <Modal
            detail
            maxWidth="580px"
            title="Detalle del complemento"
            label="Detalle del complemento de pago"
            subtitle={<span style={HINT_SUBTITLE}>Pago #{p.num_pago || '—'} · {mostrarFechaCompleta(p.fecha_pago)}</span>}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="facturas-btn facturas-btn--secondary" onClick={onClose}>Cerrar</button>
                    {isAdmin && (
                        <button type="button" className="facturas-btn facturas-btn--primary" onClick={() => onEditar(p)}>Editar</button>
                    )}
                </>
            }
        >
            <div className="facturas-detail-scroll">
                <div className="facturas-detail-scroll__inner">
                    <div className="facturas-detail-grid">
                        <DetailCard label="UUID fiscal" full>
                            <UuidLine uuid={p.uuid_fiscal} fontSize="0.82rem" onCopy={onCopy} />
                        </DetailCard>

                        {datos.map(([label, valor]) => (
                            <DetailCard key={label} label={label}>
                                <span style={VALOR}>{valor || '—'}</span>
                            </DetailCard>
                        ))}

                        <DetailCard label="Desglose del pago" full>
                            <div className="facturas-resumen__row"><span>Saldo anterior</span><span>{formatoMoneda(p.saldo_anterior)}</span></div>
                            <div className="facturas-resumen__row">
                                <span>Monto pagado</span><span style={{ color: '#34d399' }}>{formatoMoneda(p.monto_pago)}</span>
                            </div>
                            <div className="facturas-resumen__row facturas-resumen__row--total">
                                <span>Falta por pagar</span>
                                <span>
                                    {formatoMoneda(p.falta_pagar)}
                                    {liquidado && <span className="facturas-badge facturas-badge--ok" style={{ marginLeft: '6px' }}>Liquidado</span>}
                                </span>
                            </div>
                        </DetailCard>

                        <DetailCard label="Comprobantes REP" full>
                            <DocumentManageList
                                record={p}
                                pdfUrl={p.url_pdf}
                                xmlUrl={p.url_xml}
                                isAdmin={isAdmin}
                                busy={busy}
                                emptyLabel="Sin archivos"
                                onOpenFile={onOpenFile}
                                onReplaceDoc={onReplaceDoc}
                                onDeleteDoc={onDeleteDoc}
                            />
                        </DetailCard>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
