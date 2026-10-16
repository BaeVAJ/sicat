import Layout from "../../layout/Layout"
import "./Asignaciones.css"
import { useState, useMemo, useEffect } from "react";
import client from "../../../api/client";
import { useAuth } from "../../../context/AuthContext";
import { subscribeToEvents } from '../../../api/events';


function asignaciones() {
    const { usuario } = useAuth();

    const [asignaciones, setAsignaciones] = useState([]);
    const [inventario, setInventario] = useState([]);
    const [departamento, setDepartamento] = useState([]);
    const [pedido, setPedido] = useState([]);
    const [pedidoInventario, setPedidoInventario] = useState([]);
    const [devuelto, setDevuelto] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [openDeleteModal, setOpenDeleteModal] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [filterEstado, setFilterEstado] = useState("ALL");
    const [departamentoFilter, setDepartamentoFilter] = useState("ALL");
    const [estado, setEstado] = useState("ALL");
    const [search, setSearch] = useState("");

    const [departamentoForm, setDepartamentoForm] = useState("");
    const [cantidadForm, setCantidadForm] = useState(0);
    const [stockActual, setStockActual] = useState("");
    const [materialPedidoForm, setMaterialPedidoForm] = useState("");
    const [urgenteform, setUrgenteForm] = useState(false);
    const [fechaAsignacionForm, setFechaAsignacionForm] = useState("");
    const [condicionForm, setCondicionForm] = useState("");
    const [esDevolvibleForm, setEsDevolvibleForm] = useState(false);

    const canManage = usuario?.rol === "admin" || usuario?.rol === "operaciones";

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    useEffect(() => {
        if (!usuario) return undefined;
        fetchAsignaciones();
        return subscribeToEvents((type) => {
            if (type.startsWith('ticket.')) fetchTickets();
            if (type.startsWith('material-request.')) fetchPedidos();
        });
    }, [usuario]);

    const fetchAsignaciones = async () => {
        setLoading(true);
        setError("");
        try {
            const [asigRes, depRes, invRes, pedidosRes] = await Promise.all([
                client.get("/asignaciones"),
                client.get("/departamentos"),
                client.get("/inventario"),
                client.get("/pedidos")
            ])
            setAsignaciones(Array.isArray(asigRes.data) ? asigRes.data : []);
            setDepartamento(Array.isArray(depRes.data) ? depRes.data : []);
            setInventario(Array.isArray(invRes.data) ? invRes.data : []);
            setPedido(Array.isArray(pedidosRes.data) ? pedidosRes.data : []);
        } catch (err) {
            setError("Error al obtener los datos.")
        }
        finally {
            setLoading(false);
        }
    }

    const filteredAsignaciones = useMemo(() => {
        return asignaciones.filter((a) => {
            const matchesSearch = (a.producto || "").toLowerCase().includes(search.toLowerCase()) ||
                (a.departamento || "").toLowerCase().includes(search.toLowerCase()) ||
                (a.estado || "").toLowerCase().includes(search.toLowerCase()) ||
                (a.marca || "").toLowerCase().includes(search.toLowerCase()) ||
                (a.modelo || "").toLowerCase().includes(search.toLowerCase()) ||
                (a.condicion || "").toLowerCase().includes(search.toLowerCase()) ||
                String(a.id_asignacion).includes(search);

            const matchesEstado = filterEstado === 'ALL' || (filterEstado === 'ACTIVO' && a.estatus !== 'DEVUELTO') || (filterEstado === 'DEVUELTO' && a.estatus === 'DEVUELTO');
            const matchesDepartamento = departamentoFilter === 'ALL' || a.departamento.trim() === departamentoFilter;

            return matchesSearch && matchesEstado && matchesDepartamento;
        })
    })

    const handleOpenDetails = (a) => {
        setModalOpen(true);
        setError("");
        setSuccess("");
        setDepartamentoForm(a.departamento || "");
        setCantidadForm(a.cantidad || "");
        setMaterialPedidoForm(a.producto || "");
        setStockActual(a.stock || "");
        setFechaAsignacionForm(formatDate(a.fecha_asignacion || ""));
        setCondicionForm(a.condicion || "");
        console.log(formatDate(a.fecha_asignacion))
    }

    const handleOpenDelete = (a) => {
        handleDeleteAsignacion(a);
        setOpenDeleteModal(true);
    }

    const handleDeleteAsignacion = async (asignacion) => {
        if (!openDeleteModal) return;
        setActionLoading(true);
        setError("");
        setSuccess("");
        try {
            await client.delete(`/asignaciones/${asignacion.id_asignacion}`);
            setSuccess("Asignación eliminada correctamente.");
            fetchAsignaciones();
        } catch (err) {
            setError("Error al eliminar la asignación.");
        } finally {
            setActionLoading(false);
            setOpenDeleteModal(false);
        }
    }

    const handleEditAsignacion = async (asignacion) => {
        setActionLoading(true);
        setError("");
        setSuccess("");
        try {
            await client.put(`/asignaciones/${asignacion.id_asignacion}`, {
                departamento: departamentoForm,
                cantidad: cantidadForm,
                producto: materialPedidoForm,
                fecha_pedido: fechaAsignacionForm,
                condicion: condicionForm
            });
        } catch (err) {
            setError(err.response?.data?.error || "Error al actualizar la asignacion.");
        } finally {
            setActionLoading(false);
            setModalOpen(false);
        }
    }
    

    const totalAsignaciones = asignaciones.length;
    const asinacionesFaltaDevolver = asignaciones.filter(a => (a.estatus === "ACTIVO" && a.es_devolvible === true)).length;
    const prestamosCompletados = asignaciones.filter(a => (a.estatus === "DEVUELTO" && a.es_devolvible === true)).length;

    return (
        <Layout>
            <div className="asignaciones-container">
                <div className="asignaciones-header" style={{ display: 'inline-flex', gap: '0.85rem', alignItems: 'center' }} >
                    <div style={{ display: 'inline-flex', gap: '0.85rem', alignItems: 'center' }}>
                        <span className="asignaciones-header__icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                            </svg>
                        </span>
                        <div>
                            <h1 className="asignaciones-title">Asignaciones</h1>
                            <h2 className="asignaciones-subtitle">
                                Gestion de asignaciones de equipos.
                            </h2>
                        </div>
                    </div>
                    <div className="asingaciones-header__actions">
                        <button
                            className="asignaciones-btn asignaciones-btn--secondary asignaciones-btn__refresh"
                            onClick={() => fetchAsignaciones()}
                            disabled={actionLoading || loading}
                            title="Recargar datos">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="asignaciones-kpis">
                    <div className="asignaciones-kpi">
                        <div className="asignaciones-kpi__icon-box">
                            <svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M14 19.2857L15.8 21L20 17M4 21C4 17.134 7.13401 14 11 14C12.4872 14 13.8662 14.4638 15 15.2547M15 7C15 9.20914 13.2091 11 11 11C8.79086 11 7 9.20914 7 7C7 4.79086 8.79086 3 11 3C13.2091 3 15 4.79086 15 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path> </g></svg>
                        </div>
                        <div className="asignaciones-kpi__content">
                            <div className="asignaciones-kpi__label">Todas las Asignaciones</div>
                            <div className="asignaciones-kpi__value">{totalAsignaciones}</div>
                        </div>
                    </div>
                    <div className="asignaciones-kpi">
                        <div className="asignaciones-kpi__icon-box">
                            <svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M15 16L20 21M20 16L15 21M4 21C4 17.134 7.13401 14 11 14M15 7C15 9.20914 13.2091 11 11 11C8.79086 11 7 9.20914 7 7C7 4.79086 8.79086 3 11 3C13.2091 3 15 4.79086 15 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path> </g></svg>
                        </div>
                        <div className="asignaciones-kpi__content">
                            <div className="asignaciones-kpi__label">Falta devolver</div>
                            <div className="asignaciones-kpi__value">{asinacionesFaltaDevolver}</div>
                        </div>
                    </div>
                    <div className="asignaciones-kpi">
                        <div className="asignaciones-kpi__icon-box">
                            <svg width="24px" height="22px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M14.9999 15.2547C13.8661 14.4638 12.4872 14 10.9999 14C7.40399 14 4.44136 16.7114 4.04498 20.2013C4.01693 20.4483 4.0029 20.5718 4.05221 20.6911C4.09256 20.7886 4.1799 20.8864 4.2723 20.9375C4.38522 21 4.52346 21 4.79992 21H9.94465M13.9999 19.2857L15.7999 21L19.9999 17M14.9999 7C14.9999 9.20914 13.2091 11 10.9999 11C8.79078 11 6.99992 9.20914 6.99992 7C6.99992 4.79086 8.79078 3 10.9999 3C13.2091 3 14.9999 4.79086 14.9999 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path> </g></svg>
                        </div>
                        <div className="asignaciones-kpi__content">
                            <div className="asignaciones-kpi__label">Prestamos Completados</div>
                            <div className="asignaciones-kpi__value">{prestamosCompletados}</div>
                        </div>
                    </div>
                </div>
                {error && (
                    <div className="asignaciones-alert asignaciones-alert--error" role="alert">
                        <div className="asignaciones-alert__content">
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                            <span>
                                {error}
                            </span>
                        </div>
                        <button
                            type="button"
                            className="empresa-alert__close"
                            onClick={() => setError('')}
                            title="Cerrar alerta"
                            aria-label="Cerrar alerta"
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
                            >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                {success && (
                    <div className="asignaciones-alert asignaciones-alert--success">
                        <div className="asignaciones-alert__content">
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            {success}
                        </div>
                        <button
                            type="button"
                            className="empresa-alert__close"
                            onClick={() => setSuccess('')}
                            title="Cerrar notificación"
                            aria-label="Cerrar notificación"
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
                            >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}
                <div className="asignaciones-toolbar">
                    <div className="asignaciones-search-wrap">
                        <span className="asignaciones-search-icon">
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="asignaciones-input asignaciones-search-input"
                            >
                            </input>
                        </span>
                    </div>
                    <div className="asignaciones-toolbar__filters">
                        <select
                            onChange={(e) => setFilterEstado(e.target.value)}
                            value={filterEstado}
                            className="asignaciones-select asignaciones-toolbar__select"
                            title="Filtrar por estado"
                            disabled={actionLoading || loading}
                        >
                            <option value="ALL">Todos los estados</option>
                            <option value="ACTIVO">Activo</option>
                            <option value="DEVUELTO">Devuelto</option>
                        </select>
                        <select
                            onChange={(e) => setDepartamentoFilter(e.target.value)}
                            value={departamentoFilter}
                            className="asignaciones-select asignaciones-toolbar__select"
                            title="filtrar por departamento">
                            <option value="ALL">Todos los Departamentos</option>
                            {departamento.map((d) =>
                                <option key={d.id_departamento} value={d.nombre}>{d.nombre}</option>
                            )}
                        </select>
                    </div>
                    <div className="asignaciones-table-wrap">
                        <div className="asignaciones-table">
                            {filteredAsignaciones.map((a) => (
                                <table key={a.id_asignacion}>
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Departamento</th>
                                            <th>Material</th>
                                            <th>Condicion</th>
                                            <th>Fecha de asignacion</th>
                                            <th>Fecha de devolucion</th>
                                            <th>Estado</th>
                                            {canManage && <th>Acciones</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr key={a.id_asignacion}>
                                            <td>{a.id_asignacion}</td>
                                            <td>{a.departamento}</td>
                                            <td>{a.producto}</td>
                                            <td>{a.condicion}</td>
                                            <td>{formatDate(a.fecha_asignacion)}</td>
                                            <td>{a.es_devolvible ? (formatDate(a.fecha_devolucion)) : '-'}</td>
                                            <td>{a.es_devolvible ? (a.estatus) : 'N/A'}</td>
                                            {canManage && (
                                                <td>
                                                    <button
                                                        className="asignaciones-table__action-btn asignaciones-btn--danger"
                                                        onClick={() => handleOpenDelete(a)}
                                                        title="Eliminar asignación"
                                                        disabled={actionLoading || loading}
                                                    >
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        className="asignaciones-table__action-btn asignaciones-btn--edit"
                                                        onClick={() => handleOpenDetails(a)}
                                                        title="Editar asignación"
                                                        disabled={actionLoading || loading}>
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                        </svg>
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    </tbody>
                                </table>
                            ))}
                            <div className="asignaciones-footer">
                                <div className="asignaciones-footer__info">
                                    {`Mostrando ${filteredAsignaciones.length} de ${asignaciones.length} asignaciones`}
                                </div>
                            </div>
                        </div>
                    </div>
                    {modalOpen &&(
                        <form className="asignaciones-moadal-overlay">
                            <div className="asignaciones-modal">
                                <div className="asignaciones-modal__header">
                                    <h2 className="asignaciones-modal__title">Editar asignación</h2>
                                </div>
                                <div className= "asignaciones-modal__body">
                                    <p className="asignaciones-modal__nombre">{materialPedidoForm}</p>
                                    <div className="asignaciones-grid-2">
                                        <div className="asignaciones-date">
                                            <label htmlFor="fechaAsignacion">Fecha de asignación</label>
                                            <input
                                                type="date"
                                                id="fechaAsignacion"
                                                name="fechaAsignacion"
                                                value={String(formatDate(fechaAsignacionForm))}
                                                onChange={(e) => setFechaAsignacionForm(e.target.value)}
                                                >

                                            </input>
                                        </div>
                                    </div>
                                </div>
                            </div> 
                        </form> 
                    )}
                </div>
            </div>
        </Layout>
    )
}
export default asignaciones