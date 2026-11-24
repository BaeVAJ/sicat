import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import client from '../../../api/client';
import './SolicitarMaterial.css';

function normalizar(texto) {
    return String(texto ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function SolicitarMaterial() {
    const { usuario } = useAuth();
    const [materiales, setMateriales] = useState([]);
    const [material, setMaterial] = useState('');
    const [cantidad, setCantidad] = useState(1);
    const [urgente, setUrgente] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [showResults, setShowResults] = useState(false);

    const isAdmin = usuario?.rol === 'admin';

    const showMessage = useCallback((type, text) => {
        setMessage({ type, text });
    }, []);

    const fetchData = useCallback(async () => {
        try {
            const response = await client.get('/inventario');
            setMateriales(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            const errorMessage = err.response?.data?.error;
            const status = err.response?.status;
            const errorText = typeof errorMessage === 'string' ? errorMessage : '';
            let msg = 'No se pudieron cargar los materiales.';

            if (!err.response) {
                msg = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
            } else if (errorText.includes('getaddrinfo')) {
                msg = 'El servidor no pudo conectar con un servicio externo. Inténtalo más tarde.';
            }
            if (isAdmin) {
                msg += ` [${status ?? err.code} | ${errorText || err.message}]`;
            }
            showMessage('error', msg);
        }
    }, [isAdmin, showMessage]);

    useEffect(() => {
        queueMicrotask(() => {
            void fetchData();
        });
    }, [fetchData]);

    const filteredMateriales = useMemo(() => {
        const q = normalizar(material.trim());
        if (!q) return [];
        const vistos = new Set();
        const lista = [];
        materiales.forEach((item) => {
            const nombre = String(item.producto || '').trim();
            if (!nombre) return;
            const norm = normalizar(nombre);
            if (!norm.includes(q) || vistos.has(norm)) return;
            vistos.add(norm);
            lista.push(item);
        });
        return lista.slice(0, 8);
    }, [material, materiales]);

    async function handleSubmit(event) {
        event.preventDefault();
        showMessage('', '');
        const cantidadNum = Number(cantidad);
        if (!material.trim() || !Number.isInteger(cantidadNum) || cantidadNum < 1) {
            showMessage('error', 'Escribe el material que necesitarás y una cantidad válida.');
            return;
        }

        setLoading(true);
        try {
            await client.post('/pedidos', {
                descripcion_material: material.trim(),
                cantidad_solicitada: cantidadNum,
                urgente,
                id_departamento: usuario?.id_departamento,
            });
            showMessage('success', 'Solicitud enviada correctamente.');
            setMaterial('');
            setCantidad(1);
            setUrgente(false);
            setShowResults(false);
        } catch (err) {
            const errorMessage = err.response?.data?.error;
            const status = err.response?.status;
            const errorText = typeof errorMessage === 'string' ? errorMessage : 'No se pudo enviar la solicitud.';
            let msg = 'No se pudo enviar la solicitud.';

            if (!err.response) {
                msg = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
            } else if (errorText.includes('getaddrinfo')) {
                msg = 'El servidor no pudo conectar con un servicio externo. Inténtalo más tarde.';
            } else if (errorText) {
                msg = errorText;
            }
            if (isAdmin) {
                msg += ` [${status ?? err.code} | ${errorText || err.message}]`;
            }

            showMessage('error', msg);
        } finally {
            setLoading(false);
        }
    }

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
            <button
                type="button"
                className="complementos-alert__close"
                aria-label="Cerrar Alerta"
                onClick={() => setMessage({ type: '', text: '' })}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
        </div>
    );

    return (
            <div className="solic-container">
                <div className="solic-form-container">
                    <form className="solic-form" onSubmit={handleSubmit}>
                        <div className="solic-form--header">
                            <div className="solic-form--icon-box" aria-hidden="true">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 5v14M5 12h14" />
                                </svg>
                            </div>
                            <h1 className="solic-form--title">Solicitar material</h1>
                        </div>

                        {alerta}

                        <div className="solic-form--body">
                            <div className="solic-form--input-group">
                                <label htmlFor="material" className="solic-label">Material</label>
                                <input
                                    className="solic-input"
                                    type="text"
                                    id="material"
                                    autoComplete="off"
                                    value={material}
                                    onChange={(e) => {
                                        setMaterial(e.target.value);
                                        setShowResults(true);
                                    }}
                                    onFocus={() => setShowResults(true)}
                                    onBlur={() => setTimeout(() => setShowResults(false), 160)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') setShowResults(false);
                                    }}
                                    required
                                    placeholder="Escribe el material que necesitas"
                                />

                                {material && filteredMateriales.length > 0 && showResults && (
                                    <ul className="search-results" role="listbox" aria-label="Sugerencias de materiales">
                                        {filteredMateriales.map((item) => (
                                            <li
                                                key={item.id_inventario ?? item.producto}
                                                className="search-result-item"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => {
                                                    setMaterial(item.producto);
                                                    setShowResults(false);
                                                }}
                                            >
                                                {item.producto}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="solic-form--input-group">
                                <label htmlFor="cantidad" className="solic-label">Cantidad</label>
                                <input
                                    required
                                    type="number"
                                    id="cantidad"
                                    value={cantidad}
                                    onChange={(e) => setCantidad(e.target.value)}
                                    placeholder="Escribe la cantidad que necesitas"
                                    min="1"
                                    step="1"
                                    className="solic-input"
                                />
                            </div>

                            <div className="solicitud-switch">
                                <input
                                    type="checkbox"
                                    id="urgente"
                                    checked={urgente}
                                    onChange={(e) => setUrgente(e.target.checked)}
                                />
                                <label htmlFor="urgente" className="solic-switch-label">Urgente</label>
                            </div>
                        </div>

                        <div className="solic-form--footer" >
                            <button type="button" className="solic-btn solic-btn--secondary" disabled={loading} onClick={()=> window.history.back()}>
                                <span className="solic-btn__content">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="19" y1="12" x2="5" y2="12" />
                                        <polyline points="12 19 5 12 12 5" />
                                    </svg>
                                    volver
                                </span>
                            </button>
                            <button type="submit" className="solic-btn solic-btn--primary" disabled={loading}>
                                {loading ? 'Enviando...' : 'Enviar solicitud'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
    );
}

export default SolicitarMaterial;
