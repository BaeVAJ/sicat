import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import Layout from '../layout/Layout';
import './complementosPago.css';

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

function mostrarFecha(fecha) {
  const date = new Date(fecha);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-MX');
}

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

function escaparCsv(valor) {
  const texto = valor == null ? '' : String(valor);
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const initialForm = {
  idFactura: '',
  numPago: '',
  fechaPago: obtenerFechaLocalParaInput(),
  saldoAnterior: '',
  montoPago: '',
  formaPago: '',
  faltaPagar: '',
};

const initialFilters = {
  busqueda: '',
  empresa: '',
  proveedor: '',
  formaPago: '',
  desde: '',
  hasta: '',
  saldo: '',
  archivos: '',
};

const PAGE_SIZES = [10, 25, 50, 100];

const MAX_FILE_SIZE = 25 * 1024 * 1024;

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

function valorOrden(item, key) {
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

function ComplementosPago() {
  const { usuario } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [complementos, setComplementos] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [formasPago, setFormasPago] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [pdf, setPdf] = useState(null);
  const [xml, setXml] = useState(null);
  const [editing, setEditing] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [campoError, setCampoError] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState({ key: 'fecha_pago', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const messageTimer = useRef(null);
  const faltaManual = useRef(false);
  const pdfInputRef = useRef(null);
  const xmlInputRef = useRef(null);
  const isAdmin = usuario?.rol === 'admin';

  const ppdFacturas = useMemo(
    () => facturas.filter((f) => f.metodo_pago === 'PPD'),
    [facturas]
  );

  const showMessage = useCallback((type, text, timeout = 5000) => {
    if (messageTimer.current) clearTimeout(messageTimer.current);
    setMessage({ type, text });
    if (timeout > 0) {
      messageTimer.current = setTimeout(() => setMessage({ type: '', text: '' }), timeout);
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [complementosRes, facturasRes, formasRes] = await Promise.all([
        client.get('/facturas/complementos'),
        client.get('/facturas/ppd/estado-cuenta'),
        client.get('/facturas/formas-pago'),
      ]);
      setComplementos(complementosRes.data || []);
      setFacturas(facturasRes.data || []);
      setFormasPago(formasRes.data || []);
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'No se pudieron cargar los complementos');
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  useEffect(() => { void loadData(); }, [loadData]);

  const opciones = useMemo(() => {
    const unicos = (campo) =>
      [...new Set(complementos.map((c) => c[campo]).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b), 'es'));
    return {
      empresas: unicos('empresa'),
      proveedores: unicos('proveedor'),
      formas: unicos('forma_pago'),
    };
  }, [complementos]);

  const filtrados = useMemo(() => {
    const q = normalizar(filters.busqueda.trim());

    const lista = complementos.filter((item) => {
      if (q) {
        const texto = normalizar(
          [item.uuid_fiscal, item.empresa, item.proveedor, item.forma_pago, item.num_pago].join(' ')
        );
        if (!texto.includes(q)) return false;
      }
      if (filters.empresa && item.empresa !== filters.empresa) return false;
      if (filters.proveedor && item.proveedor !== filters.proveedor) return false;
      if (filters.formaPago && item.forma_pago !== filters.formaPago) return false;

      if (filters.desde || filters.hasta) {
        const dia = obtenerFechaLocalParaInput(item.fecha_pago).slice(0, 10);
        if (!dia) return false;
        if (filters.desde && dia < filters.desde) return false;
        if (filters.hasta && dia > filters.hasta) return false;
      }

      const falta = item.falta_pagar;
      if (filters.saldo === 'pendiente' && !(falta != null && Number(falta) > 0)) return false;
      if (filters.saldo === 'liquidado' && !(falta != null && Number(falta) === 0)) return false;
      if (filters.saldo === 'sin_dato' && falta != null) return false;

      const tienePdf = Boolean(item.url_pdf);
      const tieneXml = Boolean(item.url_xml);
      if (filters.archivos === 'completos' && !(tienePdf && tieneXml)) return false;
      if (filters.archivos === 'con_pdf' && !tienePdf) return false;
      if (filters.archivos === 'con_xml' && !tieneXml) return false;
      if (filters.archivos === 'sin_pdf' && tienePdf) return false;
      if (filters.archivos === 'sin_xml' && tieneXml) return false;
      if (filters.archivos === 'sin_archivos' && (tienePdf || tieneXml)) return false;

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
  }, [complementos, filters, sort]);

  const filtrosActivos = useMemo(
    () => Object.entries(filters).filter(([k, v]) => v !== '' && v !== initialFilters[k]).length,
    [filters]
  );

  const kpis = useMemo(() => {
    let totalPagado = 0;
    let saldoPendiente = 0;
    let liquidados = 0;

    complementos.forEach((c) => {
      totalPagado += Number(c.monto_pago) || 0;
      const falta = c.falta_pagar == null || c.falta_pagar === '' ? null : Number(c.falta_pagar);
      if (falta != null && falta > 0) saldoPendiente += falta;
      if (falta === 0) liquidados += 1;
    });

    return {
      total: complementos.length,
      totalPagado,
      saldoPendiente,
      liquidados,
    };
  }, [complementos]);

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
        : { key, dir: key === 'empresa' ? 'asc' : 'desc' }
    );
  }, []);

  const handleCopyUuid = useCallback((uuid) => {
    if (!uuid) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(uuid).then(
        () => showMessage('success', 'UUID copiado al portapapeles', 2500),
        () => showMessage('error', 'No se pudo copiar el UUID')
      );
    }
  }, [showMessage]);

  const exportCsv = useCallback(() => {
    if (filtrados.length === 0) {
      showMessage('error', 'No hay complementos para exportar con los filtros actuales');
      return;
    }
    const encabezados = [
      'UUID fiscal', 'Empresa', 'Proveedor', 'No. pago', 'Fecha de pago',
      'Saldo anterior', 'Monto pagado', 'Forma de pago', 'Falta por pagar', 'PDF', 'XML',
    ];
    const filas = filtrados.map((c) => [
      c.uuid_fiscal, c.empresa, c.proveedor, c.num_pago, mostrarFecha(c.fecha_pago),
      c.saldo_anterior, c.monto_pago, c.forma_pago, c.falta_pagar,
      c.url_pdf ? 'Sí' : 'No', c.url_xml ? 'Sí' : 'No',
    ]);
    const csv = [encabezados, ...filas].map((fila) => fila.map(escaparCsv).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `complementos_pago_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showMessage('success', `Se exportaron ${filtrados.length} complemento(s)`);
  }, [filtrados, showMessage]);

  // Saldo/número de pago vienen del servidor (estado de cuenta PPD). Se mantienen
  // frescos porque cada alta/edición devuelve el resumen actualizado de la factura.
  const saldoFactura = useCallback((idFactura) => {
    if (!idFactura) return null;
    return facturas.find((f) => Number(f.id_factura) === Number(idFactura)) || null;
  }, [facturas]);

  const mergeFactura = useCallback((resumen) => {
    if (!resumen?.id_factura) return;
    setFacturas((prev) =>
      prev.map((f) => (Number(f.id_factura) === Number(resumen.id_factura) ? { ...f, ...resumen } : f))
    );
  }, []);

  const datosSiguientePago = useCallback((idFactura) => {
    if (!idFactura) return { numPago: '', saldoAnterior: '', saldo: null };
    const previos = complementos.filter((c) => Number(c.id_factura) === Number(idFactura));
    const resumen = saldoFactura(idFactura);
    const ultimoNum = Math.max(
      Number(resumen?.ultimo_num_pago) || 0,
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
      saldoAnterior: saldo == null ? '' : saldo,
      saldo,
    };
  }, [complementos, saldoFactura]);

  const resetForm = useCallback(() => {
    setForm(initialForm);
    setPdf(null);
    setXml(null);
    setEditing(null);
    setCampoError('');
    faltaManual.current = false;
  }, []);

  const openCreate = useCallback((preferId) => {
    const preferida = preferId != null
      ? ppdFacturas.find((f) => Number(f.id_factura) === Number(preferId))
      : null;
    const conSaldo = ppdFacturas.find((f) => Number(f.saldo) > 0);
    const idFactura = (preferida || conSaldo || ppdFacturas[0])?.id_factura || '';
    const sugerido = datosSiguientePago(idFactura);
    faltaManual.current = false;
    setEditing(null);
    setForm({
      ...initialForm,
      fechaPago: obtenerFechaLocalParaInput(),
      idFactura,
      numPago: sugerido.numPago,
      saldoAnterior: sugerido.saldoAnterior,
      montoPago: '',
    });
    setPdf(null);
    setXml(null);
    setMessage({ type: '', text: '' });
    setModalOpen(true);
  }, [ppdFacturas, datosSiguientePago]);

  useEffect(() => {
    const id = location.state?.idFactura;
    if (!id || loading) return;
    if (!ppdFacturas.some((f) => Number(f.id_factura) === Number(id))) return;
    openCreate(id);
    navigate(location.pathname, { replace: true });
  }, [location.state, location.pathname, loading, ppdFacturas, openCreate, navigate]);

  const openEdit = useCallback((item) => {
    faltaManual.current = true;
    setDetalle(null);
    setEditing(item);
    setForm({
      idFactura: item.id_factura,
      numPago: item.num_pago || '',
      fechaPago: obtenerFechaLocalParaInput(item.fecha_pago),
      saldoAnterior: item.saldo_anterior ?? '',
      montoPago: item.monto_pago ?? '',
      formaPago: item.forma_pago || '',
      faltaPagar: item.falta_pagar ?? '',
    });
    setPdf(null);
    setXml(null);
    setMessage({ type: '', text: '' });
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    resetForm();
  }, [resetForm]);

  useEffect(() => {
    if (!modalOpen && !detalle && !confirmar) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (modalOpen) closeModal();
      else if (confirmar) setConfirmar(null);
      else setDetalle(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, detalle, confirmar, closeModal]);

  const updateField = useCallback((e) => {
    const { name, value } = e.target;
    if (name === 'faltaPagar') faltaManual.current = true;
    if (name) setCampoError((prev) => (prev === name ? '' : prev));

    setForm((prev) => {
      const next = { ...prev, [name]: value };

      if (name === 'idFactura' && !editing) {
        const sugerido = datosSiguientePago(value);
        next.numPago = sugerido.numPago;
        next.saldoAnterior = sugerido.saldoAnterior;
        faltaManual.current = false;
      }

      if (!faltaManual.current && ['idFactura', 'saldoAnterior', 'montoPago'].includes(name)) {
        next.faltaPagar = calcularFalta(next.saldoAnterior, next.montoPago);
      }
      return next;
    });
  }, [editing, datosSiguientePago]);

  const recalcularFalta = useCallback(() => {
    faltaManual.current = false;
    setForm((prev) => ({ ...prev, faltaPagar: calcularFalta(prev.saldoAnterior, prev.montoPago) }));
  }, []);

  const save = async (event) => {
    event.preventDefault();

    const fechaPagoIso = obtenerFechaIso(form.fechaPago);
    if (!form.idFactura || !fechaPagoIso || Number(form.montoPago) <= 0) {
      showMessage('error', 'Selecciona una factura PPD, fecha y monto mayor a cero');
      return;
    }

    if (form.saldoAnterior !== '' && Number(form.montoPago) > Number(form.saldoAnterior)) {
      showMessage('error', 'El monto pagado no puede ser mayor al saldo anterior');
      return;
    }

    if (form.numPago !== '') {
      const duplicado = complementos.some(
        (c) =>
          Number(c.id_factura) === Number(form.idFactura) &&
          Number(c.num_pago) === Number(form.numPago) &&
          c.id_detalle_factura !== editing?.id_detalle_factura
      );
      if (duplicado) {
        showMessage('error', `Ya existe el pago número ${form.numPago} para esta factura`);
        return;
      }
    }

    const errPdf = validarArchivo(pdf, 'pdf');
    if (errPdf) return showMessage('error', errPdf);
    const errXml = validarArchivo(xml, 'xml');
    if (errXml) return showMessage('error', errXml);

    const data = new FormData();
    const campos = {
      num_pago: form.numPago,
      fecha_pago: fechaPagoIso,
      saldo_anterior: form.saldoAnterior,
      monto_pago: form.montoPago,
      forma_pago: form.formaPago,
      falta_pagar: form.faltaPagar,
    };
    Object.entries(campos).forEach(([k, v]) => data.append(k, v ?? ''));
    if (pdf) data.append('archivo_pdf', pdf);
    if (xml) data.append('archivo_xml', xml);

    setSaving(true);
    setCampoError('');
    try {
      if (editing) {
        const { data: updated } = await client.put(
          `/facturas/complementos/${editing.id_detalle_factura}`,
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
        mergeFactura(resumen);
        showMessage('success', 'Complemento actualizado correctamente');
      } else {
        const { data: created } = await client.post(
          `/facturas/${form.idFactura}/complementos`,
          data
        );
        const { factura: resumen, ...detalle } = created;
        const enriched = {
          ...detalle,
          uuid_fiscal: resumen?.uuid_fiscal ?? detalle.uuid_fiscal,
          empresa: resumen?.empresa ?? detalle.empresa,
          proveedor: resumen?.proveedor ?? detalle.proveedor,
        };
        setComplementos((prev) => [enriched, ...prev]);
        mergeFactura(resumen);
        showMessage('success', 'Complemento registrado correctamente');
      }
      closeModal();
    } catch (error) {
      const campo = campoACamel(error.response?.data?.campo);
      setCampoError(campo);
      showMessage('error', error.response?.data?.error || 'No se pudo guardar el complemento');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (deletingId) return;

    setDeletingId(item.id_detalle_factura);
    try {
      await client.delete(`/facturas/complementos/${item.id_detalle_factura}`);
      setComplementos((prev) =>
        prev.filter((c) => c.id_detalle_factura !== item.id_detalle_factura)
      );
      setDetalle((prev) => (prev?.id_detalle_factura === item.id_detalle_factura ? null : prev));
      showMessage('success', 'Complemento eliminado correctamente');
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'No se pudo eliminar el complemento');
    } finally {
      setDeletingId(null);
      setConfirmar(null);
    }
  };

  const openFile = async (item, type) => {
    try {
      const { data } = await client.get(
        `/facturas/complementos/${item.id_detalle_factura}/url?tipo=${type}`
      );
      const url = data.url || (type === 'pdf' ? data.pdf_url : data.xml_url);
      if (!url) {
        showMessage('error', `No hay archivo ${type.toUpperCase()} disponible`);
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'No se pudo abrir el archivo');
    }
  };

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

  const facturaEditando = editing
    ? facturas.find((f) => f.id_factura === editing.id_factura)
    : null;

  const facturaSeleccionada = !editing ? saldoFactura(form.idFactura) : null;

  const hayDatos = complementos.length > 0;

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
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <path d="M2 10h20" />
                    <path d="M6 15h4" />
                  </svg>
                </span>
                Complementos de Pago
              </h1>
              <p className="complementos-header__subtitle">
                Administra los pagos asociados a facturas con método de pago PPD
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
              <button className="complementos-btn complementos-btn--secondary" type="button" onClick={exportCsv} disabled={loading}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Exportar CSV
              </button>
              {isAdmin && (
                <button className="complementos-btn complementos-btn--primary" type="button" onClick={() => openCreate()}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Nuevo Complemento
                </button>
              )}
            </div>
          </header>

          {!modalOpen && alerta}

          {hayDatos && (
            <section className="complementos-kpis" aria-label="Resumen de complementos">
              <div className="complementos-kpi-card">
                <div className="complementos-kpi-card__top">
                  <span className="complementos-kpi-card__label">Complementos</span>
                  <span className="complementos-kpi-card__icon complementos-kpi-card__icon--blue">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                  </span>
                </div>
                <span className="complementos-kpi-card__val">{kpis.total}</span>
                <span className="complementos-kpi-card__sub">Registros totales</span>
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
                <span className="complementos-kpi-card__sub">Monto acumulado</span>
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
                <span className="complementos-kpi-card__sub">Por liquidar</span>
              </div>

              <div className="complementos-kpi-card">
                <div className="complementos-kpi-card__top">
                  <span className="complementos-kpi-card__label">Liquidados</span>
                  <span className="complementos-kpi-card__icon complementos-kpi-card__icon--green">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </span>
                </div>
                <span className="complementos-kpi-card__val">{kpis.liquidados}</span>
                <span className="complementos-kpi-card__sub">Con saldo en cero</span>
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
                  placeholder="Buscar por UUID, empresa, proveedor o No. de pago..."
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
                  <label className="complementos-form-group__label" htmlFor="f-empresa">Empresa</label>
                  <select id="f-empresa" className="complementos-select" name="empresa" value={filters.empresa} onChange={updateFilter}>
                    <option value="">Todas</option>
                    {opciones.empresas.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="complementos-form-group">
                  <label className="complementos-form-group__label" htmlFor="f-proveedor">Proveedor</label>
                  <select id="f-proveedor" className="complementos-select" name="proveedor" value={filters.proveedor} onChange={updateFilter}>
                    <option value="">Todos</option>
                    {opciones.proveedores.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="complementos-form-group">
                  <label className="complementos-form-group__label" htmlFor="f-forma">Forma de pago</label>
                  <select id="f-forma" className="complementos-select" name="formaPago" value={filters.formaPago} onChange={updateFilter}>
                    <option value="">Todas</option>
                    {opciones.formas.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="complementos-form-group">
                  <label className="complementos-form-group__label" htmlFor="f-saldo">Saldo</label>
                  <select id="f-saldo" className="complementos-select" name="saldo" value={filters.saldo} onChange={updateFilter}>
                    <option value="">Todos</option>
                    <option value="pendiente">Con saldo pendiente</option>
                    <option value="liquidado">Liquidado</option>
                    <option value="sin_dato">Sin saldo registrado</option>
                  </select>
                </div>
                <div className="complementos-form-group">
                  <label className="complementos-form-group__label" htmlFor="f-archivos">Archivos</label>
                  <select id="f-archivos" className="complementos-select" name="archivos" value={filters.archivos} onChange={updateFilter}>
                    <option value="">Todos</option>
                    <option value="completos">Con PDF y XML</option>
                    <option value="con_pdf">Con PDF</option>
                    <option value="con_xml">Con XML</option>
                    <option value="sin_pdf">Sin PDF</option>
                    <option value="sin_xml">Sin XML</option>
                    <option value="sin_archivos">Sin archivos</option>
                  </select>
                </div>
                <div className="complementos-form-group">
                  <label className="complementos-form-group__label" htmlFor="f-desde">Pagado desde</label>
                  <input id="f-desde" className="complementos-input" type="date" max={filters.hasta} name="desde" value={filters.desde} onChange={updateFilter} />
                </div>
                <div className="complementos-form-group">
                  <label className="complementos-form-group__label" htmlFor="f-hasta">Pagado hasta</label>
                  <input id="f-hasta" className="complementos-input" type="date" min={filters.desde} name="hasta" value={filters.hasta} onChange={updateFilter} />
                </div>
              </div>
              <div className="complementos-filters__footer">
                <span className="complementos-filters__footer-count" aria-live="polite">
                  {filtrados.length === complementos.length
                    ? `${complementos.length} complemento(s)`
                    : `${filtrados.length} de ${complementos.length} complemento(s)`}
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
              <p className="complementos-empty">Cargando complementos...</p>
            ) : !hayDatos ? (
              <p className="complementos-empty">
                No hay complementos registrados
                {isAdmin ? ' Usa “Nuevo Complemento” para registrar el primero.' : ''}
              </p>
            ) : filtrados.length === 0 ? (
              <div className="complementos-empty">
                <p>No se encontraron complementos que coincidan con los filtros aplicados.</p>
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
                        <SortHeader label="No. pago" sortKey="num_pago" sort={sort} onSort={toggleSort} className="complementos-hide-mobile" />
                        <SortHeader label="Fecha" sortKey="fecha_pago" sort={sort} onSort={toggleSort} className="complementos-hide-mobile" />
                        <SortHeader label="Pago" sortKey="monto_pago" sort={sort} onSort={toggleSort} />
                        <SortHeader label="Saldo" sortKey="falta_pagar" sort={sort} onSort={toggleSort} />
                        <th className="complementos-hide-mobile">Forma de pago</th>
                        <th className="complementos-hide-mobile">Archivos</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map((item) => {
                        const liquidado = item.falta_pagar != null && Number(item.falta_pagar) === 0;
                        return (
                          <tr key={item.id_detalle_factura}>
                            <td>
                              <div className="complementos-table__uuid">
                                <strong title={item.uuid_fiscal || undefined}>
                                  {item.uuid_fiscal ? `${item.uuid_fiscal.slice(0, 13)}...` : '—'}
                                </strong>
                                {item.uuid_fiscal && (
                                  <button
                                    type="button"
                                    className="complementos-copy-btn"
                                    title="Copiar UUID completo"
                                    aria-label="Copiar UUID completo"
                                    onClick={() => handleCopyUuid(item.uuid_fiscal)}
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                              <div className="complementos-table__sub">
                                {item.empresa || '—'} · {item.proveedor || '—'}
                              </div>
                              <div className="complementos-show-mobile complementos-table__sub">
                                Pago #{item.num_pago || '—'} · {mostrarFechaCorta(item.fecha_pago)}
                              </div>
                            </td>
                            <td className="complementos-hide-mobile">{item.num_pago || '—'}</td>
                            <td className="complementos-hide-mobile">{mostrarFechaCorta(item.fecha_pago)}</td>
                            <td>
                              <span className="complementos-table__total">
                                {formatoMoneda(item.monto_pago ?? 0)}
                              </span>
                              {item.forma_pago && (
                                <div className="complementos-table__sub">{item.forma_pago}</div>
                              )}
                            </td>
                            <td>
                              <span className="complementos-table__saldo">
                                {item.falta_pagar == null || item.falta_pagar === ''
                                  ? '—'
                                  : formatoMoneda(item.falta_pagar)}
                              </span>
                              {liquidado && (
                                <span className="complementos-badge complementos-badge--ok">Liquidado</span>
                              )}
                            </td>
                            <td className="complementos-hide-mobile">{item.forma_pago || '—'}</td>
                            <td className="complementos-hide-mobile">
                              <div className="complementos-files">
                                {item.url_pdf && (
                                  <button type="button" className="complementos-btn complementos-btn--pdf" onClick={() => openFile(item, 'pdf')}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                      <circle cx="12" cy="12" r="3" />
                                    </svg>
                                    PDF
                                  </button>
                                )}
                                {item.url_xml && (
                                  <button className="complementos-btn complementos-btn--xml" type="button" onClick={() => openFile(item, 'xml')}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="16 18 22 12 16 6" />
                                      <polyline points="8 6 2 12 8 18" />
                                    </svg>
                                    XML
                                  </button>
                                )}
                                {!item.url_pdf && !item.url_xml && (
                                  <span className="complementos-badge complementos-badge--empty">Sin archivos</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="complementos-actions">
                                <button className="complementos-btn complementos-btn--secondary" type="button" onClick={() => setDetalle(item)}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="16" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                  </svg>
                                  Detalles
                                </button>
                                {isAdmin && (
                                  <>
                                    {!isMobile && (
                                      <button className="complementos-btn complementos-btn--secondary" type="button" onClick={() => openEdit(item)}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z" />
                                        </svg>
                                        Editar
                                      </button>
                                    )}
                                    <button type="button" className="complementos-btn complementos-btn--danger" onClick={() => setConfirmar(item)} disabled={deletingId === item.id_detalle_factura}>
                                      {deletingId === item.id_detalle_factura ? (
                                        <>
                                          <svg className="complementos-btn__spin" width="12" height="12"
                                            viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                            strokeWidth="2.5" strokeLinecap="round">
                                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                          </svg>
                                          Eliminando
                                        </>
                                      ) : (
                                        <>
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6" />
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                          </svg>
                                          Eliminar
                                        </>
                                      )}
                                    </button>
                                  </>
                                )}
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

        {detalle && (
          <div className="complementos-modal-overlay" onClick={() => setDetalle(null)}>
            <div
              className="complementos-modal"
              style={{ maxWidth: '600px' }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Detalle del complemento de pago"
            >
              <div className="complementos-modal__header">
                <div>
                  <h2 className="complementos-modal__title">Detalle del complemento</h2>
                  <span className="complementos-modal__subtitle">
                    Pago #{detalle.num_pago || '—'} · {mostrarFecha(detalle.fecha_pago)}
                  </span>
                </div>
                <button className="complementos-modal__close" onClick={() => setDetalle(null)} aria-label="Cerrar">✕</button>
              </div>

              <div className="complementos-detail-grid">
                <div className="complementos-detail-card complementos-detail-card--full">
                  <span className="complementos-detail-card__label">UUID fiscal</span>
                  <div className="complementos-detail-card__row">
                    <span className="complementos-detail-card__mono">{detalle.uuid_fiscal || '—'}</span>
                    {detalle.uuid_fiscal && (
                      <button
                        type="button"
                        className="complementos-copy-btn"
                        title="Copiar UUID"
                        aria-label="Copiar UUID"
                        onClick={() => handleCopyUuid(detalle.uuid_fiscal)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="complementos-detail-card">
                  <span className="complementos-detail-card__label">Empresa</span>
                  <span className="complementos-detail-card__value">{detalle.empresa || '—'}</span>
                </div>
                <div className="complementos-detail-card">
                  <span className="complementos-detail-card__label">Proveedor</span>
                  <span className="complementos-detail-card__value">{detalle.proveedor || '—'}</span>
                </div>
                <div className="complementos-detail-card">
                  <span className="complementos-detail-card__label">Número de pago</span>
                  <span className="complementos-detail-card__value">{detalle.num_pago || '—'}</span>
                </div>
                <div className="complementos-detail-card">
                  <span className="complementos-detail-card__label">Forma de pago</span>
                  <span className="complementos-detail-card__value">{detalle.forma_pago || '—'}</span>
                </div>

                <div className="complementos-detail-card complementos-detail-card--full">
                  <span className="complementos-detail-card__label">Desglose del pago</span>
                  <div className="complementos-detail-card__line">
                    <span>Saldo anterior</span>
                    <span>{formatoMoneda(detalle.saldo_anterior)}</span>
                  </div>
                  <div className="complementos-detail-card__line">
                    <span>Monto pagado</span>
                    <span className="complementos-detail-card__value--green">{formatoMoneda(detalle.monto_pago)}</span>
                  </div>
                  <div className="complementos-detail-card__line complementos-detail-card__line--total">
                    <span>Falta por pagar</span>
                    <span>
                      {formatoMoneda(detalle.falta_pagar)}
                      {detalle.falta_pagar != null && Number(detalle.falta_pagar) === 0 && (
                        <span className="complementos-badge complementos-badge--ok">Liquidado</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="complementos-detail-card complementos-detail-card--full">
                  <span className="complementos-detail-card__label">Comprobantes</span>
                  <div className="complementos-files complementos-detail-card__files">
                    {detalle.url_pdf && (
                      <button type="button" className="complementos-btn complementos-btn--pdf" onClick={() => openFile(detalle, 'pdf')}>Abrir PDF</button>
                    )}
                    {detalle.url_xml && (
                      <button type="button" className="complementos-btn complementos-btn--xml" onClick={() => openFile(detalle, 'xml')}>Abrir XML</button>
                    )}
                    {!detalle.url_pdf && !detalle.url_xml && (
                      <span className="complementos-badge complementos-badge--empty">Sin archivos</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="complementos-modal__footer">
                <button className="complementos-btn complementos-btn--secondary" type="button" onClick={() => setDetalle(null)}>
                  Cerrar
                </button>
                {isAdmin && (
                  <button className="complementos-btn complementos-btn--primary" type="button" onClick={() => openEdit(detalle)}>
                    Editar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {confirmar && (
          <div className="complementos-modal-overlay" onClick={() => !deletingId && setConfirmar(null)}>
            <div className="complementos-modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Confirmar eliminación">
              <div className="complementos-modal__header">
                <h2 className="complementos-modal__title" style={{ color: '#fca5a5' }}>Confirmar eliminación</h2>
                <button className="complementos-modal__close" type="button" onClick={() => setConfirmar(null)} disabled={Boolean(deletingId)} aria-label="Cerrar">✕</button>
              </div>
              <p className="complementos-confirm__text">
                ¿Eliminar el complemento de pago <strong>#{confirmar.num_pago || '—'}</strong> con fecha{' '}
                <strong>{mostrarFecha(confirmar.fecha_pago)}</strong>? Esta acción no se puede deshacer.
              </p>
              <div className="complementos-modal__footer">
                <button className="complementos-btn complementos-btn--secondary" type="button" onClick={() => setConfirmar(null)} disabled={Boolean(deletingId)}>
                  Cancelar
                </button>
                <button className="complementos-btn complementos-btn--danger" type="button" onClick={() => remove(confirmar)} disabled={Boolean(deletingId)}>
                  {deletingId ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {modalOpen && (
          <div className="complementos-modal-overlay">
            <form className="complementos-modal" onSubmit={save}>
              <div className="complementos-modal__header">
                <div>
                  <h2 className="complementos-modal__title">
                    {editing ? 'Editar complemento de pago' : 'Nuevo complemento de pago'}
                  </h2>
                  <span className="complementos-modal__subtitle">Pagos (REP) asociados a facturas PPD</span>
                </div>
                <button className="complementos-modal__close" type="button" onClick={closeModal} aria-label="Cerrar">✕</button>
              </div>

              {alerta}

              <div className="complementos-form-section">
                <h3 className="complementos-form-section__title">Datos del pago</h3>

                {editing ? (
                  <div className="complementos-form-group">
                    <span className="complementos-label">Factura</span>
                    <div className="complementos-readonly">
                      {facturaEditando?.uuid_fiscal || editing.uuid_fiscal || '—'}
                      {(facturaEditando?.empresa || editing.empresa) && ` · ${facturaEditando?.empresa || editing.empresa}`}
                    </div>
                  </div>
                ) : (
                  <div className="complementos-form-group">
                    <label className="complementos-label" htmlFor="c-factura">
                      Factura PPD <span className="complementos-req">*</span>
                    </label>
                    <select id="c-factura" className="complementos-input" name="idFactura" value={form.idFactura} onChange={updateField} required>
                      <option value="">Selecciona una factura</option>
                      {ppdFacturas.map((f) => (
                        <option key={f.id_factura} value={f.id_factura}>
                          {f.uuid_fiscal} — {f.empresa}
                          {f.saldo != null ? ` · saldo ${formatoMoneda(f.saldo)}` : ''}
                        </option>
                      ))}
                    </select>
                    {facturaSeleccionada && (
                      <small className="complementos-hint">
                        Saldo pendiente: <strong>{formatoMoneda(facturaSeleccionada.saldo)}</strong>
                        {` · pagos registrados: ${facturaSeleccionada.num_pagos || 0}`}
                        {facturaSeleccionada.estado ? ` · estado: ${facturaSeleccionada.estado}` : ''}
                      </small>
                    )}
                    {ppdFacturas.length === 0 && (
                      <small className="complementos-hint">
                        No hay facturas con método de pago PPD disponibles.
                      </small>
                    )}
                  </div>
                )}

                <div className="complementos-grid-2">
                  <div className="complementos-form-group">
                    <label className="complementos-label" htmlFor="c-num">Número de pago</label>
                    <input id="c-num" type="number" className={`complementos-input${campoError === 'numPago' ? ' complementos-input--error' : ''}`} name="numPago" value={form.numPago} onChange={updateField} min="1" required />
                  </div>
                  <div className="complementos-form-group">
                    <label className="complementos-label" htmlFor="c-fecha">Fecha y hora</label>
                    <input id="c-fecha" type="datetime-local" className={`complementos-input${campoError === 'fechaPago' ? ' complementos-input--error' : ''}`} name="fechaPago" value={form.fechaPago} onChange={updateField} required />
                  </div>
                  <div className="complementos-form-group">
                    <label className="complementos-label" htmlFor="c-forma">Forma de pago</label>
                    <select id="c-forma" className={`complementos-input${campoError === 'formaPago' ? ' complementos-input--error' : ''}`} name="formaPago" value={form.formaPago} onChange={updateField}>
                      <option value="">Selecciona una forma de pago</option>
                      {formasPago.map((v) => (
                        <option key={v.codigo_pago} value={v.descripcion}>
                          {v.codigo_pago} — {v.descripcion}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="complementos-form-group">
                    <label className="complementos-label" htmlFor="c-saldo">Saldo anterior</label>
                    <input id="c-saldo" name="saldoAnterior" type="number" min="0" step="0.01"
                      className="complementos-input" value={form.saldoAnterior} onChange={updateField} placeholder="0.00" />
                  </div>
                  <div className="complementos-form-group">
                    <label className="complementos-label" htmlFor="c-monto">Monto pagado</label>
                    <input id="c-monto" name="montoPago" type="number" className={`complementos-input${campoError === 'montoPago' ? ' complementos-input--error' : ''}`} value={form.montoPago} onChange={updateField} placeholder="0.00" step="0.01" min="0" />
                  </div>
                  <div className="complementos-form-group">
                    <label className="complementos-label" htmlFor="c-falta">Falta por pagar</label>
                    <input id="c-falta" name="faltaPagar" type="number" min="0" step="0.01" className="complementos-input" value={form.faltaPagar} onChange={updateField} placeholder="0.00" />
                    <small className="complementos-hint">
                      Se calcula como saldo anterior − monto pagado.
                      {' '}
                      <button type="button" className="complementos-link" onClick={recalcularFalta}>Recalcular</button>
                    </small>
                  </div>
                </div>
              </div>

              <div className="complementos-form-section">
                <h3 className="complementos-form-section__title">Comprobantes (PDF / XML)</h3>

                <div className="complementos-grid-2" style={{ gap: '0.75rem' }}>
                  <div
                    className={`complementos-dropzone ${pdf ? 'complementos-dropzone--active' : ''}`}
                    onClick={() => pdfInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pdfInputRef.current?.click(); } }}
                  >
                    <input type="file" ref={pdfInputRef} accept=".pdf,application/pdf" style={{ display: 'none' }}
                      onChange={(e) => setPdf(e.target.files?.[0] || null)} />
                    <div className="complementos-dropzone__icon complementos-dropzone__icon--pdf">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div className="complementos-dropzone__info">
                      <span className="complementos-dropzone__title">{pdf ? pdf.name : 'Documento PDF'}</span>
                      <span className="complementos-dropzone__sub">
                        {pdf
                          ? `${(pdf.size / 1024).toFixed(1)} KB · listo`
                          : editing?.url_pdf
                            ? 'Ya hay un PDF. Selecciona otro para reemplazarlo'
                            : 'Clic para seleccionar archivo .pdf'}
                      </span>
                    </div>
                    {pdf && (
                      <button type="button" className="complementos-dropzone__remove" aria-label="Quitar PDF"
                        onClick={(e) => { e.stopPropagation(); setPdf(null); }}>✕</button>
                    )}
                  </div>

                  <div
                    className={`complementos-dropzone ${xml ? 'complementos-dropzone--active-xml' : ''}`}
                    onClick={() => xmlInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); xmlInputRef.current?.click(); } }}
                  >
                    <input type="file" ref={xmlInputRef} accept=".xml,text/xml,application/xml" style={{ display: 'none' }}
                      onChange={(e) => setXml(e.target.files?.[0] || null)} />
                    <div className="complementos-dropzone__icon complementos-dropzone__icon--xml">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                      </svg>
                    </div>
                    <div className="complementos-dropzone__info">
                      <span className="complementos-dropzone__title">{xml ? xml.name : 'Archivo XML'}</span>
                      <span className="complementos-dropzone__sub">
                        {xml
                          ? `${(xml.size / 1024).toFixed(1)} KB · listo`
                          : editing?.url_xml
                            ? 'Ya hay un XML. Selecciona otro para reemplazarlo'
                            : 'Clic para seleccionar archivo .xml'}
                      </span>
                    </div>
                    {xml && (
                      <button type="button" className="complementos-dropzone__remove" aria-label="Quitar XML"
                        onClick={(e) => { e.stopPropagation(); setXml(null); }}>✕</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="complementos-modal__footer">
                <button className="complementos-btn complementos-btn--secondary" type="button" onClick={closeModal}>
                  Cancelar
                </button>
                <button className="complementos-btn complementos-btn--primary" type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <svg className="complementos-btn__spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Guardar complemento
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </Layout>
    </div>
  );
}

export default ComplementosPago;
