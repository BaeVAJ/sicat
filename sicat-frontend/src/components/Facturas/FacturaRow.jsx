// Fila de factura con su acordeón de complementos de pago (REP).
import { Fragment } from 'react';
import { CopyButton, Icon } from './FacturasUi';
import { formatoMoneda, mostrarFechaCorta } from './facturasUtils';

const EMPRESA_STYLE = { fontWeight: 600, color: '#f1f5f9' };

function DocumentosCell({ record, pdfUrl, xmlUrl, isAdmin, busy, compact = false, onOpen, onReplace, onDelete }) {
    const sizeClass = compact ? ' facturas-btn--xs' : '';
    const renderDoc = (tipo, existe) => {
        if (!existe) return null;
        const upper = tipo.toUpperCase();
        const title = tipo === 'pdf' ? 'Abrir PDF en nueva pestaña' : 'Descargar archivo XML';
        return (
            <div key={tipo} className="facturas-doc-pill">
                <button
                    type="button"
                    className={`facturas-btn facturas-btn--${tipo}${sizeClass}`}
                    onClick={() => onOpen(record, tipo)}
                    disabled={busy}
                    title={title}
                >
                    {!compact && <Icon name={tipo === 'pdf' ? 'file' : 'code'} size={13} round />}
                    <span>{upper}</span>
                </button>
                {isAdmin && (
                    <>
                        <button
                            type="button"
                            className="facturas-doc-pill__action"
                            onClick={() => onReplace(record, tipo)}
                            disabled={busy}
                            title={`Reemplazar ${upper}`}
                            aria-label={`Reemplazar ${upper}`}
                        >
                            <Icon name="replace" size={12} round />
                        </button>
                        <button
                            type="button"
                            className="facturas-doc-pill__action facturas-doc-pill__action--danger"
                            onClick={() => onDelete(record, tipo)}
                            disabled={busy}
                            title={`Eliminar ${upper}`}
                            aria-label={`Eliminar ${upper}`}
                        >
                            <Icon name="trash" size={12} round />
                        </button>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="facturas-actions-cluster">
            {renderDoc('pdf', Boolean(pdfUrl))}
            {renderDoc('xml', Boolean(xmlUrl))}
            {!pdfUrl && !xmlUrl && <span className="facturas-badge facturas-badge--nopdf">Sin archivos</span>}
        </div>
    );
}

function AvanceDePago({ factura, esPpd, abierta }) {
    const pct = factura.total > 0 ? Math.min(100, Math.round((factura.pagado / factura.total) * 100)) : 0;
    const total = <span className="facturas-table__total">{formatoMoneda(factura.total)}</span>;

    if (!esPpd) {
        return (
            <div className="facturas-progress-box">
                <div className="facturas-progress-box__top">
                    {total}
                    <span className="facturas-badge facturas-badge--ok">Pago único</span>
                </div>
                <div className="facturas-progress-box__sub">
                    <span>Sub {formatoMoneda(factura.monto_subtotal || 0)} + IVA {formatoMoneda(factura.monto_iva || 0)}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="facturas-progress-box">
            <div className="facturas-progress-box__top">
                {total}
                <span className={`facturas-badge ${abierta ? 'facturas-badge--warn' : 'facturas-badge--ok'}`}>
                    {abierta ? `Saldo: ${formatoMoneda(factura.saldo)}` : 'Liquidado $0.00'}
                </span>
            </div>
            <div className="facturas-progress-track">
                <div
                    className={`facturas-progress-fill ${abierta ? 'facturas-progress-fill--partial' : 'facturas-progress-fill--done'}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <div className="facturas-progress-box__sub">
                <span>Pagado {formatoMoneda(factura.pagado)} de {formatoMoneda(factura.total)}</span>
                <span>{pct}%</span>
            </div>
        </div>
    );
}

function FilaPago({ pago, isAdmin, busy, deletingPagoId, on }) {
    const liquidado = pago.falta_pagar != null && Number(pago.falta_pagar) <= 0;
    const pagoBusy = busy || deletingPagoId === pago.id_detalle_factura;
    return (
        <tr>
            <td><strong>Pago #{pago.num_pago || '—'}</strong></td>
            <td style={{ whiteSpace: 'nowrap' }}>{mostrarFechaCorta(pago.fecha_pago)}</td>
            <td>{pago.forma_pago || '—'}</td>
            <td>{formatoMoneda(pago.saldo_anterior)}</td>
            <td style={{ color: '#34d399', fontWeight: 700 }}>{formatoMoneda(pago.monto_pago)}</td>
            <td>
                {formatoMoneda(pago.falta_pagar)}
                {liquidado && (
                    <span className="facturas-badge facturas-badge--ok" style={{ marginLeft: '6px', padding: '0.12rem 0.45rem', fontSize: '0.66rem' }}>
                        Liquidado
                    </span>
                )}
            </td>
            <td>
                <DocumentosCell
                    record={pago}
                    pdfUrl={pago.url_pdf}
                    xmlUrl={pago.url_xml}
                    isAdmin={isAdmin}
                    busy={pagoBusy}
                    compact
                    onOpen={on.openComplementoFile}
                    onReplace={on.replaceComplementoDoc}
                    onDelete={on.deleteComplementoDoc}
                />
            </td>
            <td>
                <div className="facturas-actions-cluster">
                    <button type="button" className="facturas-btn facturas-btn--secondary facturas-btn--xs" onClick={() => on.pagoDetalle(pago)}>Detalles</button>
                    {isAdmin && (
                        <>
                            <button type="button" className="facturas-btn facturas-btn--secondary facturas-btn--xs" onClick={() => on.pagoEditar(pago)} disabled={pagoBusy}>Editar</button>
                            <button
                                type="button"
                                className="facturas-btn facturas-btn--danger facturas-btn--xs"
                                onClick={() => on.pagoEliminar(pago)}
                                disabled={pagoBusy}
                            >
                                Eliminar
                            </button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
}

const COLUMNAS_PAGO = ['No. Pago', 'Fecha', 'Forma de Pago', 'Saldo Anterior', 'Monto Abonado', 'Saldo Restante', 'Comprobantes', 'Acciones'];

function AcordeonPagos({ factura, abierta, canRegisterPago, isAdmin, busy, deletingPagoId, on }) {
    const siguiente = factura.pagos.length > 0
        ? Math.max(...factura.pagos.map((p) => Number(p.num_pago) || 0), factura.ultimoNumPago || 0) + 1
        : 1;

    return (
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
                                <strong style={{ color: abierta ? '#fcd34d' : '#6ee7b7' }}>{formatoMoneda(factura.saldo)}</strong>
                            </div>
                        </div>

                        {abierta && canRegisterPago ? (
                            <button type="button" className="facturas-btn facturas-btn--primary facturas-btn--sm" onClick={() => on.abonar(factura)}>
                                + Registrar Pago #{siguiente} (Saldo: {formatoMoneda(factura.saldo)})
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
                                <tr>{COLUMNAS_PAGO.map((c) => <th key={c}>{c}</th>)}</tr>
                            </thead>
                            <tbody>
                                {factura.pagos.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" style={{ textAlign: 'center', padding: '1.15rem', color: 'rgba(148, 163, 184, 0.7)' }}>
                                            Aún no hay complementos de pago registrados para esta factura.
                                        </td>
                                    </tr>
                                ) : (
                                    factura.pagos.map((pago) => (
                                        <FilaPago key={pago.id_detalle_factura} pago={pago} isAdmin={isAdmin} busy={busy} deletingPagoId={deletingPagoId} on={on} />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </td>
        </tr>
    );
}

export default function FacturaRow({ factura, expanded, canRegisterPago, isAdmin, busy, deletingPagoId, on }) {
    const esPpd = factura.metodo_pago === 'PPD';
    const abierta = esPpd && factura.saldo > 0;
    const isExpanded = esPpd && expanded;
    const uuid = factura.uuid_fiscal;

    return (
        <Fragment>
            <tr className={isExpanded ? 'facturas-row--expanded' : undefined}>
                <td>
                    <div className="facturas-table__uuid">
                        <span title={uuid || undefined}>{uuid ? `${uuid.substring(0, 13)}...` : '—'}</span>
                        {uuid && <CopyButton onClick={() => on.copy(uuid)} />}
                    </div>
                    <div className="facturas-table__sub">Compra #{factura.id_compra || '—'}</div>
                    <div className="facturas-show-mobile facturas-table__sub">
                        {mostrarFechaCorta(factura.fecha_emision)} · {factura.metodo_pago || 'PUE'}
                    </div>
                </td>

                <td>
                    <div style={EMPRESA_STYLE}>{factura.empresa || 'Empresa'}</div>
                    <div className="facturas-table__sub">Prov: {factura.proveedor || 'Proveedor'}</div>
                </td>

                <td className="facturas-hide-mobile" style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.84rem' }}>{mostrarFechaCorta(factura.fecha_emision)}</span>
                </td>

                <td className="facturas-hide-mobile">
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <span className={`facturas-badge ${esPpd ? 'facturas-badge--ppd' : 'facturas-badge--pue'}`}>
                            {factura.metodo_pago || 'PUE'}
                        </span>
                        <span className="facturas-badge facturas-badge--cfdi">{factura.uso_cfdi || 'G01'}</span>
                    </div>
                </td>

                <td><AvanceDePago factura={factura} esPpd={esPpd} abierta={abierta} /></td>

                <td className="facturas-hide-mobile">
                    <DocumentosCell
                        record={factura}
                        pdfUrl={factura.archivo_url}
                        xmlUrl={factura.archivo_xml_url}
                        isAdmin={isAdmin}
                        busy={busy}
                        onOpen={on.openFacturaFile}
                        onReplace={on.replaceFacturaDoc}
                        onDelete={on.deleteFacturaDoc}
                    />
                </td>

                <td>
                    <div className="facturas-actions-cluster">
                        {abierta && canRegisterPago && (
                            <button type="button" className="facturas-btn facturas-btn--primary facturas-btn--sm" onClick={() => on.abonar(factura)} disabled={busy}>
                                + Abonar
                            </button>
                        )}
                        {esPpd && (
                            <button
                                type="button"
                                className={`facturas-btn facturas-btn--sm ${isExpanded ? 'facturas-btn--violet' : 'facturas-btn--secondary'}`}
                                onClick={() => on.toggle(factura.id_factura)}
                                aria-expanded={isExpanded}
                            >
                                <span>Pagos ({factura.pagos.length}) {isExpanded ? '▴' : '▾'}</span>
                            </button>
                        )}
                        <button
                            type="button"
                            className="facturas-btn facturas-btn--secondary facturas-btn--sm"
                            onClick={() => on.detalle(factura)}
                            title="Ver detalles completos de la factura"
                        >
                            Detalle
                        </button>
                        {isAdmin && (
                            <>
                                <button type="button" className="facturas-btn facturas-btn--secondary facturas-btn--sm" onClick={() => on.editar(factura)} disabled={busy} title="Editar factura">
                                    Editar
                                </button>
                                <button
                                    type="button"
                                    className="facturas-btn facturas-btn--danger facturas-btn--sm"
                                    title="Eliminar factura"
                                    aria-label="Eliminar factura"
                                    onClick={() => on.eliminar(factura)}
                                    disabled={busy}
                                >
                                    <Icon name="trash" size={13} round />
                                </button>
                            </>
                        )}
                    </div>
                </td>
            </tr>

            {isExpanded && (
                <AcordeonPagos
                    factura={factura}
                    abierta={abierta}
                    canRegisterPago={canRegisterPago}
                    isAdmin={isAdmin}
                    busy={busy}
                    deletingPagoId={deletingPagoId}
                    on={on}
                />
            )}
        </Fragment>
    );
}
