// src/components/Ticket/CrearTicket/CrearTicket.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import client from '../../../api/client';
import './CrearTicket.css';

function CrearTicket() {
    const navigate = useNavigate();
    const { usuario } = useAuth();
    const isAdmin = usuario?.rol === 'admin';

    const [departamentos, setDepartamentos] = useState([]);
    const [idDepartamento, setIdDepartamento] = useState('');
    const [miDepartamentoNombre, setMiDepartamentoNombre] = useState(usuario?.departamento || '');
    const [descripcion, setDescripcion] = useState('');
    const [urgente, setUrgente] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingDeps, setLoadingDeps] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const MAX_DESC = 500;

    // Cargar departamentos y perfil del usuario
    useEffect(() => {
        let mounted = true;

        async function init() {
            setLoadingDeps(true);
            try {
                // Cargar lista de departamentos
                const { data: deps } = await client.get('/departamentos');
                if (!mounted) return;
                setDepartamentos(Array.isArray(deps) ? deps : []);

                // Si no es admin, obtener el departamento asignado del usuario
                let depId = usuario?.id_departamento;
                let depNombre = usuario?.departamento;

                // Si falta en la sesión local, consultar /auth/me
                if (!depId || !depNombre) {
                    try {
                        const { data: me } = await client.get('/auth/me');
                        if (me?.id_departamento) depId = me.id_departamento;
                        if (me?.departamento) depNombre = me.departamento;
                    } catch {
                        // ignore error
                    }
                }

                if (!depNombre && depId && Array.isArray(deps)) {
                    const match = deps.find((d) => String(d.id_departamento) === String(depId));
                    if (match) depNombre = match.nombre;
                }

                if (mounted) {
                    if (depId) setIdDepartamento(String(depId));
                    if (depNombre) setMiDepartamentoNombre(depNombre);
                }
            } catch {
                if (mounted) setError('No se pudieron cargar los datos de departamentos');
            } finally {
                if (mounted) setLoadingDeps(false);
            }
        }

        init();
        return () => {
            mounted = false;
        };
    }, [usuario]);

    const isValid =
        (isAdmin ? idDepartamento !== '' : (idDepartamento !== '' || miDepartamentoNombre !== '')) &&
        descripcion.trim().length >= 10 &&
        descripcion.length <= MAX_DESC;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const depAEnviar = isAdmin
                ? Number(idDepartamento)
                : Number(idDepartamento || usuario?.id_departamento);

            await client.post('/tickets', {
                id_departamento: depAEnviar,
                descripcion: descripcion.trim(),
                id_usuario: usuario?.id_usuario || null,
                urgente: Boolean(urgente),
            });

            setSuccess('Ticket creado exitosamente');
            setDescripcion('');
            setUrgente(false);

            if (isAdmin) {
                // Mantener o resetear departamento para admin
                setIdDepartamento(usuario?.id_departamento ? String(usuario.id_departamento) : '');
            }
        } catch (err) {
            const mensaje =
                err.response?.data?.error ||
                err.message ||
                'Error al crear el ticket';
            setError(mensaje);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ticket-page">
            <div className="ticket-card">
                {/* ── Header ── */}
                <div className="ticket-header">
                    <div className="ticket-header__icon" aria-hidden="true">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="12" y1="18" x2="12" y2="12" />
                            <line x1="9" y1="15" x2="15" y2="15" />
                        </svg>
                    </div>
                    <h1 className="ticket-header__title">Crear Ticket</h1>
                    <p className="ticket-header__subtitle">Solicitud de soporte</p>
                </div>

                {/* ── Alerts ── */}
                {error && (
                    <div className="ticket-alert ticket-alert--error" role="alert">
                        <span className="ticket-alert__icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                        </span>
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="ticket-alert ticket-alert--success" role="alert">
                        <span className="ticket-alert__icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '0.5rem' }}>
                            <span>{success}</span>
                            <button
                                type="button"
                                onClick={() => navigate('/tickets')}
                                style={{
                                    background: 'rgba(255,255,255,0.18)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    padding: '0.25rem 0.65rem',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                Ver Tickets
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Form ── */}
                <form onSubmit={handleSubmit} noValidate>

                    {/* Departamento: Si es administrador puede elegirlo, si no, se fija automáticamente al suyo */}
                    <div className="ticket-field">
                        <label htmlFor="ticket-dep" className="ticket-field__label">
                            {isAdmin ? 'Departamento de Destino' : 'Departamento Asignado'}
                        </label>
                        <div className="ticket-field__wrapper">
                            <span className="ticket-field__icon" aria-hidden="true">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                    <polyline points="9 22 9 12 15 12 15 22" />
                                </svg>
                            </span>

                            {isAdmin ? (
                                <>
                                    <select
                                        id="ticket-dep"
                                        className="ticket-field__select"
                                        value={idDepartamento}
                                        onChange={(e) => setIdDepartamento(e.target.value)}
                                        disabled={loadingDeps}
                                        required
                                    >
                                        <option value="">
                                            {loadingDeps ? 'Cargando departamentos…' : '-- Selecciona un departamento --'}
                                        </option>
                                        {departamentos.map((dep) => (
                                            <option key={dep.id_departamento} value={dep.id_departamento}>
                                                {dep.nombre}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="ticket-field__arrow" aria-hidden="true">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                    </span>
                                </>
                            ) : (
                                <input
                                    type="text"
                                    className="ticket-field__select"
                                    value={miDepartamentoNombre || (loadingDeps ? 'Cargando departamento…' : 'Sin departamento asignado')}
                                    readOnly
                                    disabled
                                    style={{
                                        cursor: 'not-allowed',
                                        opacity: 0.9,
                                        background: 'rgba(255, 255, 255, 0.04)',
                                        borderColor: 'rgba(255, 255, 255, 0.08)'
                                    }}
                                />
                            )}
                        </div>
                        <span style={{ fontSize: '0.74rem', color: 'rgba(148, 163, 184, 0.7)', marginTop: '4px', display: 'block' }}>
                            {isAdmin
                                ? ''
                                : 'Tu ticket se asociará automáticamente al departamento de tu cuenta.'}
                        </span>
                    </div>

                    {/* Descripción del problema */}
                    <div className="ticket-field">
                        <label htmlFor="ticket-desc" className="ticket-field__label">
                            Descripción del problema
                        </label>
                        <div className="ticket-field__wrapper">
                            <span className="ticket-field__icon" style={{ alignSelf: 'flex-start', marginTop: '14px' }} aria-hidden="true">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="17" y1="10" x2="3" y2="10" />
                                    <line x1="21" y1="6" x2="3" y2="6" />
                                    <line x1="21" y1="14" x2="3" y2="14" />
                                    <line x1="17" y1="18" x2="3" y2="18" />
                                </svg>
                            </span>
                            <textarea
                                id="ticket-desc"
                                className="ticket-field__textarea"
                                value={descripcion}
                                onChange={(e) => {
                                    if (e.target.value.length <= MAX_DESC) {
                                        setDescripcion(e.target.value);
                                    }
                                }}
                                placeholder="Describe detalladamente el problema o la solicitud (mínimo 10 caracteres)…"
                                required
                            />
                        </div>
                        <div className="ticket-field__counter">
                            {descripcion.length} / {MAX_DESC}
                        </div>
                    </div>

                    {/* ── Botón / Selector de Urgente ── */}
                    <div className="ticket-field-urgente">
                        <label className="ticket-urgente-toggle">
                            <input
                                type="checkbox"
                                checked={urgente}
                                onChange={(e) => setUrgente(e.target.checked)}
                                className="ticket-urgente-checkbox"
                            />
                            <div className={`ticket-urgente-btn ${urgente ? 'ticket-urgente-btn--active' : ''}`}>
                                <div className="ticket-urgente-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                    </svg>
                                </div>
                                <div className="ticket-urgente-texts">
                                    <span className="ticket-urgente-title">Prioridad Urgente</span>
                                    <span className="ticket-urgente-desc">
                                        {urgente
                                            ? 'Atención inmediata requerida'
                                            : 'Marcar el ticket como urgente para que sea atendido con prioridad'}
                                    </span>
                                </div>
                                <div className={`ticket-urgente-badge ${urgente ? 'ticket-urgente-badge--active' : ''}`}>
                                    {urgente ? 'URGENTE' : 'NORMAL'}
                                </div>
                            </div>
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="ticket-actions">
                        <button
                            type="button"
                            className="ticket-btn ticket-btn--secondary"
                            onClick={() => navigate(-1)}
                            disabled={loading}
                        >
                            <span className="ticket-btn__content">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="19" y1="12" x2="5" y2="12" />
                                    <polyline points="12 19 5 12 12 5" />
                                </svg>
                                Volver
                            </span>
                        </button>
                        <button
                            type="submit"
                            className="ticket-btn ticket-btn--primary"
                            disabled={!isValid || loading}
                        >
                            <span className="ticket-btn__content">
                                {loading && <span className="ticket-spinner" aria-hidden="true" />}
                                {loading ? 'Enviando…' : 'Crear Ticket'}
                            </span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CrearTicket;