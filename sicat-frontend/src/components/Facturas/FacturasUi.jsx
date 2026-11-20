// Componentes de presentación reutilizables del módulo de facturas.
import { useRef } from 'react';
import { PAGE_SIZES } from './facturasUtils';

const ICONS = {
    invoice: (
        <>
            <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
            <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
            <path d="M12 17.5v-11" />
        </>
    ),
    refresh: (
        <>
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </>
    ),
    download: (
        <>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
        </>
    ),
    plus: (
        <>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </>
    ),
    search: (
        <>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </>
    ),
    close: (
        <>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </>
    ),
    trash: (
        <>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </>
    ),
    eye: (
        <>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </>
    ),
    code: (
        <>
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
        </>
    ),
    file: (
        <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
        </>
    ),
    copy: (
        <>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
    ),
    kpiInvoice: (
        <>
            <rect x="4" y="3" width="16" height="18" rx="2" />
            <line x1="8" y1="8" x2="16" y2="8" />
            <line x1="8" y1="12" x2="16" y2="12" />
        </>
    ),
    kpiAlert: (
        <>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
        </>
    ),
    kpiDollar: (
        <>
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </>
    ),
    alertError: (
        <>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
        </>
    ),
    alertOk: (
        <>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </>
    ),
};
ICONS.kpiFile = ICONS.file;

export function Icon({ name, size = 16, strokeWidth = 2, round = false, className }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap={round ? 'round' : undefined}
            strokeLinejoin={round ? 'round' : undefined}
            className={className}
        >
            {ICONS[name]}
        </svg>
    );
}

export function Alert({ type, onClose, compact = false, children }) {
    const isError = type === 'error';
    return (
        <div className={`facturas-alert facturas-alert--${type}`} role={isError ? 'alert' : 'status'}>
            <div className="facturas-alert__content">
                {!compact && <Icon name={isError ? 'alertError' : 'alertOk'} size={18} round />}
                <span>{children}</span>
            </div>
            <button type="button" className="facturas-alert__close" onClick={onClose} aria-label={compact ? 'Cerrar' : 'Cerrar alerta'}>
                {compact ? '✕' : <Icon name="close" />}
            </button>
        </div>
    );
}

export function SortHeader({ label, sortKey, sort, onSort, className }) {
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

export function CopyButton({ onClick, title = 'Copiar UUID completo' }) {
    return (
        <button type="button" className="facturas-copy-btn" title={title} aria-label={title} onClick={onClick}>
            <Icon name="copy" size={14} round />
        </button>
    );
}

export function Field({ label, htmlFor, required, children }) {
    return (
        <div className="facturas-form-group">
            <label className="facturas-label" htmlFor={htmlFor}>
                {label}
                {required && <> <span className="facturas-req">*</span></>}
            </label>
            {children}
        </div>
    );
}

export function DetailCard({ label, full = false, style, children }) {
    return (
        <div className={`facturas-detail-card${full ? ' facturas-detail-card--full' : ''}`} style={style}>
            <span className="facturas-detail-card__label">{label}</span>
            {children}
        </div>
    );
}

export function SplitRow({ label, value, style, valueStyle }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', ...style }}>
            <span>{label}</span>
            <span style={valueStyle}>{value}</span>
        </div>
    );
}

/** Overlay + diálogo + cabecera con botón de cierre. `footer` se pinta fuera del contenido desplazable. */
export function Modal({ title, subtitle, label, onClose, busy = false, maxWidth, detail = false, danger = false, svgClose = false, footer, children }) {
    return (
        <div className="facturas-modal-overlay" onClick={() => !busy && onClose()}>
            <div
                className={`facturas-modal${detail ? ' facturas-modal--detail' : ''}`}
                style={maxWidth ? { maxWidth } : undefined}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={label ?? title}
            >
                <div className="facturas-modal__header">
                    <div>
                        <h2 className="facturas-modal__title" style={danger ? { color: '#fca5a5' } : undefined}>{title}</h2>
                        {subtitle}
                    </div>
                    <button type="button" className="facturas-modal__close" onClick={onClose} disabled={busy} aria-label="Cerrar">
                        {svgClose ? <Icon name="close" size={18} round /> : '✕'}
                    </button>
                </div>
                {children}
                {footer && <div className="facturas-modal__footer">{footer}</div>}
            </div>
        </div>
    );
}

export function ConfirmModal({ title, busy, confirmLabel, busyLabel, onCancel, onConfirm, children }) {
    return (
        <Modal title={title} danger maxWidth="420px" busy={busy} onClose={onCancel}
            footer={
                <>
                    <button type="button" className="facturas-btn facturas-btn--secondary" onClick={onCancel} disabled={busy}>
                        Cancelar
                    </button>
                    <button type="button" className="facturas-btn facturas-btn--danger" onClick={onConfirm} disabled={busy}>
                        {busy ? busyLabel : confirmLabel}
                    </button>
                </>
            }
        >
            <p style={{ color: '#cbd5e1', fontSize: '0.92rem', lineHeight: '1.5', margin: '0.5rem 0 1.5rem' }}>
                {children}
            </p>
        </Modal>
    );
}

/** Zona de carga de PDF/XML. */
export function FileDropzone({ kind, file, existing = false, emptyTitle, idleText, readyText, iconSize = 22, onSelect, onRemove }) {
    const inputRef = useRef(null);
    const isXml = kind === 'xml';
    const open = () => inputRef.current?.click();

    const subtitle = file
        ? `${(file.size / 1024).toFixed(1)} KB ${readyText}`
        : existing
            ? `Ya hay un ${kind.toUpperCase()}. Selecciona otro para reemplazarlo`
            : idleText;

    return (
        <div
            className={`facturas-dropzone${file ? ` facturas-dropzone--active${isXml ? '-xml' : ''}` : ''}`}
            onClick={open}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
                e.preventDefault();
                open();
            }}
        >
            <input
                type="file"
                ref={inputRef}
                accept={isXml ? '.xml,text/xml,application/xml' : '.pdf,application/pdf'}
                style={{ display: 'none' }}
                onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
            />
            <div className={`facturas-dropzone__icon facturas-dropzone__icon--${kind}`}>
                <Icon name={isXml ? 'code' : 'file'} size={iconSize} />
            </div>
            <div className="facturas-dropzone__info">
                <span className="facturas-dropzone__title">{file ? file.name : emptyTitle}</span>
                <span className="facturas-dropzone__sub">{subtitle}</span>
            </div>
            {file && (
                <button
                    type="button"
                    className="facturas-dropzone__remove"
                    title={`Quitar ${kind.toUpperCase()}`}
                    aria-label={`Quitar ${kind.toUpperCase()}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (inputRef.current) inputRef.current.value = '';
                        onRemove();
                    }}
                >
                    ✕
                </button>
            )}
        </div>
    );
}

export function Pagination({ page, totalPages, pageSize, total, onPage, onPageSize }) {
    if (total === 0) return null;
    const inicio = (page - 1) * pageSize;
    const btn = (label, target, props) => (
        <button type="button" className="facturas-btn facturas-btn--secondary facturas-btn--sm" onClick={() => onPage(target)} {...props}>
            {label}
        </button>
    );
    return (
        <div className="facturas-pagination">
            <div className="facturas-pagination__size">
                <label className="facturas-label" htmlFor="facturas-page-size">Filas por página:</label>
                <select
                    id="facturas-page-size"
                    className="facturas-select facturas-select--sm"
                    value={pageSize}
                    onChange={(e) => onPageSize(Number(e.target.value))}
                >
                    {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
            </div>
            <span className="facturas-pagination__info">
                {inicio + 1}-{Math.min(inicio + pageSize, total)} de {total}
            </span>
            <div className="facturas-pagination__nav">
                {page > 1 && (
                    <>
                        {btn('«', 1, { 'aria-label': 'Primera página' })}
                        {btn('Anterior', page - 1)}
                    </>
                )}
                <span className="facturas-pagination__page">Página {page} de {totalPages}</span>
                {page < totalPages && (
                    <>
                        {btn('Siguiente', page + 1)}
                        {btn('»', totalPages, { 'aria-label': 'Última página' })}
                    </>
                )}
            </div>
        </div>
    );
}
