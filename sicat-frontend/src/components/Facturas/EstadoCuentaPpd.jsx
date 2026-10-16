import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import Layout from '../layout/Layout';
import './complementosPago.css';

function mostrarFechaCorta(fecha) {
  const date = new Date(fecha);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatoMoneda(valor) {
  if (valor == null || valor === '') return '—';
  const n = Number(valor);
  if (Number.isNaN(n)) return '—';
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function escaparCsv(valor) {
  const texto = valor == null ? '' : String(valor);
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function estadoBadge(estado) {
  switch (estado) {
    case 'PAGADO':
      return { cls: 'complementos-badge--ok', label: 'Pagado' };
    case 'PAGO_PARCIAL':
      return { cls: 'complementos-badge--warn', label: 'Pago parcial' };
    case 'PENDIENTE':
      return { cls: 'complementos-badge--info', label: 'Pendiente' };
    case 'CANCELADO':
      return { cls: 'complementos-badge--empty', label: 'Cancelado' };
    default:
      return { cls: 'complementos-badge--empty', label: estado || '—' };
  }
}

const PAGE_SIZES = [10, 25, 50, 100];

const initialFilters = {
  busqueda: '',
  estado: '',
  empresa: '',
  proveedor: '',
  saldo: '',
};

function valorOrden(item, key) {
  switch (key) {
    case 'empresa':
      return normalizar(item.empresa);
    case 'proveedor':
      return normalizar(item.proveedor);
    case 'fecha_emision': {
      const t = new Date(item.fecha_emision).getTime();
      return Number.isNaN(t) ? null : t;
    }
    case 'total':
    case 'pagado':
    case 'saldo':
    case 'num_pagos': {
      const n = Number(item[key]);
      return Number.isNaN(n) ? null : n;
    }
    default:
      return item[key] ?? null;
  }
}

function SortHeader({ label, sortKey, sort, onSort, className }) {
  const active = sort.key === sortKey;
  const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th aria-sort={ariaSort} className={className}>
      <button type="button" className="complementos-sort" onClick={() => onSort(sortKey)}>
        {label}
        <span className="complementos-sort__arrow" aria-hidden="true">
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

function EstadoCuentaPpd() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const isAdmin = usuario?.rol === 'admin';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isMobile, setIsMobile] = useState(false);

  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState({ key: 'fecha_emision', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const showMessage = useCallback((type, text) => {
    setMessage({ type, text });
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get('/facturas/ppd/estado-cuenta');
      setRows(data || []);
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'No se pudo cargar el estado de cuenta PPD');
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  useEffect(() => { void loadData(); }, [loadData]);

  const opciones = useMemo(() => {
    const unicos = (campo) =>
      [...new Set(rows.map((r) => r[campo]).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b), 'es'));
    return {
      empresas: unicos('empresa'),
      proveedores: unicos('proveedor'),
    };
  }, [rows]);

  const kpis = useMemo(() => {
    let totalFacturado = 0;
    let totalPagado = 0;
    let saldoPendiente = 0;
    let liquidadas = 0;

    rows.forEach((r) => {
      totalFacturado += Number(r.total) || 0;
      totalPagado += Number(r.pagado) || 0;
      const saldo = Number(r.saldo) || 0;
      saldoPendiente += saldo;
      if (saldo <= 0) liquidadas += 1;
    });

    return {
      total: rows.length,
      totalFacturado,
      totalPagado,
      saldoPendiente,
      liquidadas,
      conSaldo: rows.length - liquidadas,
    };
  }, [rows]);

  const filtrados = useMemo(() => {
    const q = normalizar(filters.busqueda.trim());

    const lista = rows.filter((item) => {
      if (q) {
        const texto = normalizar([item.uuid_fiscal, item.empresa, item.proveedor].join(' '));
        if (!texto.includes(q)) return false;
      }
      if (filters.estado && item.estado !== filters.estado) return false;
      if (filters.empresa && item.empresa !== filters.empresa) return false;
      if (filters.proveedor && item.proveedor !== filters.proveedor) return false;

      const saldo = Number(item.saldo) || 0;
      if (filters.saldo === 'con_saldo' && saldo <= 0) return false;
      if (filters.saldo === 'liquidadas' && saldo > 0) return false;

      return true;
    });

    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...lista].sort((a, b) => {
      const va = valorOrden(a, sort.key);
      const vb = valorOrden(b, sort.key);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return -1 * factor;
      if (va > vb) return 1 * factor;
      return 0;
    });
  }, [rows, filters, sort]);

  const filtrosActivos = useMemo(
    () => Object.entries(filters).filter(([k, v]) => v !== '' && v !== initialFilters[k]).length,
    [filters]
  );

  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const inicio = (safePage - 1) * pageSize;
  const visibles = useMemo(
    () => filtrados.slice(inicio, inicio + pageSize),
    [filtrados, inicio, pageSize]
  );

  useEffect(() => { setPage(1); }, [filters, sort, pageSize]);

  const updateFilter = useCallback((e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  const clearFilters = useCallback(() => setFilters(initialFilters), []);

  const toggleSort = useCallback((key) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'empresa' || key === 'proveedor' ? 'asc' : 'desc' }
    );
  }, []);

  const registrarPago = useCallback((item) => {
    navigate('/complementos-pago', { state: { idFactura: item.id_factura } });
  }, [navigate]);

  const exportCsv = useCallback(() => {
    if (filtrados.length === 0) {
      showMessage('error', 'No hay facturas para exportar con los filtros actuales');
      return;
    }
    const encabezados = [
      'UUID fiscal', 'Empresa', 'Proveedor', 'Fecha emisión', 'Total',
      'Pagado', 'Saldo', 'No. pagos', 'Último pago', 'Estado',
    ];
    const filas = filtrados.map((r) => [
      r.uuid_fiscal, r.empresa, r.proveedor, mostrarFechaCorta(r.fecha_emision),
      r.total, r.pagado, r.saldo, r.num_pagos, r.ultimo_pago ? mostrarFechaCorta(r.ultimo_pago) : '',
      r.estado,
    ]);
    const csv = [encabezados, ...filas].map((fila) => fila.map(escaparCsv).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estado_cuenta_ppd_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showMessage('success', `Se exportaron ${filtrados.length} factura(s)`);
  }, [filtrados, showMessage]);

  const alerta = message.text && (
    <div className={`complementos-alert complementos-alert--${message.type}`} role="alert">
      <div className="complementos-alert__content">
        {message.type === 'error' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        )}
        <span>{message.text}</span>
      </div>
      <button type="button" className="complementos-alert__close"
        aria-label="Cerrar mensaje"
        onClick={() => setMessage({ type: '', text: '' })}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );

  const hayDatos = rows.length > 0;

  return (
    <div>
      <Layout>
        <div className="complementos-container">
          <header className="complementos-header">
            <div>
              <h1 className="complementos-header__title">
                <span className="complementos-header__icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18" />
                    <path d="M7 14l3-3 3 3 4-5" />
                  </svg>
                </span>
                Estado de cuenta PPD
              </h1>
              <p className="complementos-header__subtitle">
                Saldo y avance de pagos de facturas con método PPD (crédito)
              </p>
            </div>
            <div className="complementos-header__actions">
              <button className="complementos-btn complementos-btn--secondary" type="button" onClick={loadData} disabled={loading}>
                <svg className={loading ? 'complementos-btn__spin' : undefined}
                  width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Actualizar
              </button>
              <button className="complementos-btn complementos-btn--secondary" type="button" onClick={exportCsv} disabled={loading || !hayDatos}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Exportar CSV
              </button>
            </div>
          </header>

          {alerta}

          {hayDatos && (
            <section className="complementos-kpis" aria-label="Resumen de estado de cuenta">
              <div className="complementos-kpi-card">
                <div className="complementos-kpi-card__top">
                  <span className="complementos-kpi-card__label">Facturas PPD</span>
                  <span className="complementos-kpi-card__icon complementos-kpi-card__icon--blue">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
                    </svg>
                  </span>
                </div>
                <span className="complementos-kpi-card__val">{kpis.total}</span>
                <span className="complementos-kpi-card__sub">{kpis.conSaldo} con saldo pendiente</span>
              </div>

              <div className="complementos-kpi-card">
                <div className="complementos-kpi-card__top">
                  <span className="complementos-kpi-card__label">Total facturado</span>
                  <span className="complementos-kpi-card__icon complementos-kpi-card__icon--blue">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="3" width="16" height="18" rx="2" />
                      <line x1="8" y1="8" x2="16" y2="8" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                  </span>
                </div>
                <span className="complementos-kpi-card__val">{formatoMoneda(kpis.totalFacturado)}</span>
                <span className="complementos-kpi-card__sub">Subtotal + IVA</span>
              </div>

              <div className="complementos-kpi-card">
                <div className="complementos-kpi-card__top">
                  <span className="complementos-kpi-card__label">Total pagado</span>
                  <span className="complementos-kpi-card__icon complementos-kpi-card__icon--cyan">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </span>
                </div>
                <span className="complementos-kpi-card__val">{formatoMoneda(kpis.totalPagado)}</span>
                <span className="complementos-kpi-card__sub">Abonos registrados</span>
              </div>

              <div className="complementos-kpi-card">
                <div className="complementos-kpi-card__top">
                  <span className="complementos-kpi-card__label">Saldo pendiente</span>
                  <span className="complementos-kpi-card__icon complementos-kpi-card__icon--amber">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </span>
                </div>
                <span className="complementos-kpi-card__val">{formatoMoneda(kpis.saldoPendiente)}</span>
                <span className="complementos-kpi-card__sub">{kpis.liquidadas} liquidada(s)</span>
              </div>
            </section>
          )}

          {hayDatos && (
            <section className="complementos-filters" aria-label="Filtros de búsqueda">
              <div className="complementos-filters__search">
                <svg className="complementos-filters__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  name="busqueda"
                  className="complementos-filters__search-input"
                  placeholder="Buscar por UUID, empresa o proveedor..."
                  value={filters.busqueda}
                  onChange={updateFilter}
                />
                {filters.busqueda && (
                  <button
                    type="button"
                    className="complementos-filters__search-clear"
                    onClick={() => setFilters((prev) => ({ ...prev, busqueda: '' }))}
                    aria-label="Limpiar búsqueda"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="complementos-filters__grid">
                <div className="complementos-form-group">
                  <label className="complementos-form-group__label" htmlFor="e-estado">Estado</label>
                  <select id="e-estado" className="complementos-select" name="estado" value={filters.estado} onChange={updateFilter}>
                    <option value="">Todos</option>
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="PAGO_PARCIAL">Pago parcial</option>
                    <option value="PAGADO">Pagado</option>
                  </select>
                </div>
                <div className="complementos-form-group">
                  <label className="complementos-form-group__label" htmlFor="e-empresa">Empresa</label>
                  <select id="e-empresa" className="complementos-select" name="empresa" value={filters.empresa} onChange={updateFilter}>
                    <option value="">Todas</option>
                    {opciones.empresas.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="complementos-form-group">
                  <label className="complementos-form-group__label" htmlFor="e-proveedor">Proveedor</label>
                  <select id="e-proveedor" className="complementos-select" name="proveedor" value={filters.proveedor} onChange={updateFilter}>
                    <option value="">Todos</option>
                    {opciones.proveedores.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="complementos-form-group">
                  <label className="complementos-form-group__label" htmlFor="e-saldo">Saldo</label>
                  <select id="e-saldo" className="complementos-select" name="saldo" value={filters.saldo} onChange={updateFilter}>
                    <option value="">Todos</option>
                    <option value="con_saldo">Con saldo pendiente</option>
                    <option value="liquidadas">Liquidadas</option>
                  </select>
                </div>
              </div>
              <div className="complementos-filters__footer">
                <span className="complementos-filters__footer-count" aria-live="polite">
                  {filtrados.length === rows.length
                    ? `${rows.length} factura(s)`
                    : `${filtrados.length} de ${rows.length} factura(s)`}
                </span>
                {filtrosActivos > 0 && (
                  <button className="complementos-btn complementos-btn--secondary" type="button" onClick={clearFilters}>
                    Limpiar filtros ({filtrosActivos})
                  </button>
                )}
              </div>
            </section>
          )}

          <section className="complementos-card">
            {loading ? (
              <p className="complementos-empty">Cargando estado de cuenta...</p>
            ) : !hayDatos ? (
              <p className="complementos-empty">
                No hay facturas PPD registradas.
              </p>
            ) : filtrados.length === 0 ? (
              <div className="complementos-empty">
                <p>No se encontraron facturas que coincidan con los filtros aplicados.</p>
                {filtrosActivos > 0 && (
                  <button className="complementos-btn complementos-btn--secondary" type="button" onClick={clearFilters}>
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="complementos-table-wrap">
                  <table className="complementos-table">
                    <thead>
                      <tr>
                        <SortHeader label="Factura / Empresa" sortKey="empresa" sort={sort} onSort={toggleSort} />
                        <SortHeader label="Emisión" sortKey="fecha_emision" sort={sort} onSort={toggleSort} className="complementos-hide-mobile" />
                        <SortHeader label="Total" sortKey="total" sort={sort} onSort={toggleSort} />
                        <SortHeader label="Pagado" sortKey="pagado" sort={sort} onSort={toggleSort} />
                        <SortHeader label="Saldo" sortKey="saldo" sort={sort} onSort={toggleSort} />
                        <SortHeader label="Pagos" sortKey="num_pagos" sort={sort} onSort={toggleSort} className="complementos-hide-mobile" />
                        <th className="complementos-hide-mobile">Último pago</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map((item) => {
                        const badge = estadoBadge(item.estado);
                        const liquidada = Number(item.saldo) <= 0;
                        return (
                          <tr key={item.id_factura}>
                            <td>
                              <div className="complementos-table__uuid">
                                <strong title={item.uuid_fiscal || undefined}>
                                  {item.uuid_fiscal ? `${item.uuid_fiscal.slice(0, 13)}...` : '—'}
                                </strong>
                              </div>
                              <div className="complementos-table__sub">
                                {item.empresa || '—'} · {item.proveedor || '—'}
                              </div>
                              <div className="complementos-show-mobile complementos-table__sub">
                                {mostrarFechaCorta(item.fecha_emision)} · {badge.label}
                              </div>
                            </td>
                            <td className="complementos-hide-mobile">{mostrarFechaCorta(item.fecha_emision)}</td>
                            <td>
                              <span className="complementos-table__total">{formatoMoneda(item.total)}</span>
                            </td>
                            <td>{formatoMoneda(item.pagado)}</td>
                            <td>
                              <span className="complementos-table__saldo">{formatoMoneda(item.saldo)}</span>
                            </td>
                            <td className="complementos-hide-mobile">{item.num_pagos ?? 0}</td>
                            <td className="complementos-hide-mobile">
                              {item.ultimo_pago ? mostrarFechaCorta(item.ultimo_pago) : '—'}
                            </td>
                            <td>
                              <span className={`complementos-badge ${badge.cls}`}>{badge.label}</span>
                            </td>
                            <td>
                              <div className="complementos-actions">
                                {!liquidada && (isAdmin || usuario?.rol === 'gerente') && (
                                  <button className="complementos-btn complementos-btn--primary" type="button" onClick={() => registrarPago(item)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="12" y1="5" x2="12" y2="19" />
                                      <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                    {isMobile ? 'Pago' : 'Registrar pago'}
                                  </button>
                                )}
                                <button className="complementos-btn complementos-btn--secondary" type="button" onClick={() => navigate('/complementos-pago')}>
                                  Ver pagos
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="complementos-pagination">
                  <div className="complementos-pagination__size">
                    <label className="complementos-label" htmlFor="page-size">Filas por página:</label>
                    <select id="page-size" className="complementos-select complementos-select--sm" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                      {PAGE_SIZES.map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                  <span className="complementos-pagination__info">
                    {inicio + 1}-{Math.min(inicio + pageSize, filtrados.length)} de {filtrados.length}
                  </span>
                  <div className="complementos-pagination__nav">
                    {safePage > 1 && (
                      <button className="complementos-btn complementos-btn--secondary" type="button" onClick={() => setPage(1)} aria-label="Primera página">«</button>
                    )}
                    {safePage > 1 && (
                      <button className="complementos-btn complementos-btn--secondary" type="button" onClick={() => setPage(safePage - 1)}>
                        Anterior
                      </button>
                    )}
                    <span className="complementos-pagination__page">Página {safePage} de {totalPages}</span>
                    {safePage < totalPages && (
                      <>
                        <button type="button" className="complementos-btn complementos-btn--secondary" onClick={() => setPage(safePage + 1)}>
                          Siguiente
                        </button>
                        <button type="button" className="complementos-btn complementos-btn--secondary" onClick={() => setPage(totalPages)} aria-label="Última página">»</button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </Layout>
    </div>
  );
}

export default EstadoCuentaPpd;
