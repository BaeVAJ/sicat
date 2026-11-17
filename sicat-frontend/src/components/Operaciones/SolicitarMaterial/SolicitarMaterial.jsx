import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import client from '../../../api/client';
import Layout from '../../layout/Layout';
import './SolicitarMaterial.css';


function SolicitarMaterial() {
    const { usuario } = useAuth();
    const [materiales, setMateriales] = useState([]);
    const [material, setMaterial] = useState('');
    const [cantidad, setCantidad] = useState(1);
    const [urgente, setUrgente] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const isAdmin = usuario?.rol === 'admin';

    const showMessage = useCallback((type, text) => {
        setMessage({ type, text });
    }, []);

    async function fetchData() {
        try{
            const response = await client.get('/inventario');
            setMateriales(Array.isArray(response.data) ? response.data : []);

        }catch(err){
            const errorMessage = err.response?.data?.error;
            const status = err.response?.status;
            const errorText = typeof errorMessage === 'String' ? errorMessage : '';
            let message = 'no pudieron cargar los materiales';

            if (!err.response) {
                message = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
            } else if (errorText.includes('getaddrinfo')) {
                message = 'El servidor no pudo conectar con un servicio externo. Inténtalo más tarde.';
            }
            if (isAdmin) {
                message += ` [${status ?? err.code} | ${errorText || err.message}]`;
            }
            showMessage('error', message);
        }
    }

    useEffect(() => {
        fetchData();
        showMessage('','');
    },[]);

    async function handleSubmit(event) {
        event.preventDefault();
        showMessage('', '');
        if (!material.trim() || !Number.isInteger(Number(cantidad)) || Number(cantidad) < 1) {
            showMessage('Escribe el material que necesitarás y una cantidad válida.', 'error');
            return;
        }
        setLoading(true);
        try {
            await client.post('/pedidos', {
                descripcion_material: material.trim(),
                cantidad_solicitada: Number(cantidad),
                urgente,
                id_departamento: usuario?.id_departamento,
            });
            showMessage('success', 'Solicitud enviada correctamente.');
            console.log(message.text);
            setMaterial('');
            setCantidad(1);
            setUrgente(false);
        } catch (err) {
            const errorMessage = err.response?.data?.error;
            const status = err.response?.status;
            const errorText = typeof errorMessage === 'String' ? errorMessage : 'No se pudo enviar la solicitud.';
            let message = 'no se pudo enviar la solicitud.';

            if (!err.response) {
                message = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
            } else if (errorText.includes('getaddrinfo')) {
                message = 'El servidor no pudo conectar con un servicio externo. Inténtalo más tarde.';
            }
            if (isAdmin) {
                message += ` [${status ?? err.code} | ${errorText || err.message}]`;
            }

            showMessage('error', message);
        } finally {
            setLoading(false);
        }
    }

    const filteredMateriales = (()=>{
        return filteredMaterial = materiales.filter((item) => {
            return item.producto.toLowerCase().includes(material.toLowerCase());
        })
    },[material, materiales]);

    const searchResults = filteredMateriales.map((item) => (
        <li key={item.id} className="search-result-item" onClick={() => setMaterial(item.producto)}>
            {item.producto}
        </li>
    ))

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
            <button type="button" className="complementos-alert__close" aria-label="Cerrar Alerta" onClick={() => setMessage({ type: '', text: '' })}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
        </div>
        );

    return (
        <Layout>
            <div className="solic-container">
                <div className="solic-form-container">
                    <form className="solic-form" onSubmit={handleSubmit}>
                        <div className="solic-form--header">
                            <div className="solic-form--icon-box">
                                <span>
                                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="22" height="22" stroke="currentColor" stroke-width="2"><path d="M11 4v14M4 11h14" /></svg>
                                </span>
                            </div>
                            <h2 className="solic-form--title">Solicitar material</h2>
                        </div>

                        {alerta}
                        <div className="solic-form--body">
                            <div className="solic-form--input-group">
                                <label htmlFor="material" className="solic-label">Material: </label>
                                <input
                                    className="solic-input"
                                    type="text"
                                    id="material"
                                    value={material}
                                    onChange={(e) => setMaterial(e.target.value)}
                                    required
                                    placeholder="Escribe el material que necesitas"
                                />
                            </div>
                            {material && searchResults.length > 0 && (
                                <ul className="search-results">
                                    {searchResults}
                                </ul>
                            )}
                            <div className="solic-form--input-group">
                                <label htmlFor="cantidad" className="solic-label">Cantidad:</label>
                                <input
                                    required
                                    type="number"
                                    id="cantidad"
                                    value={cantidad}
                                    onChange={(e) => setCantidad(e.target.value)}
                                    placeholder="Escribe la cantidad que necesitas"
                                    min='1'
                                    step='1'
                                    className="solic-input"
                                />
                            </div>
                            <div className="solicitud-switch">
                                <input
                                    type="checkbox"
                                    id="urgente"
                                    checked={urgente}
                                    onChange={(e) => setUrgente(e.target.checked)} />
                                <label htmlFor="urgente" className="solic-label">Urgente</label>
                            </div>
                        </div>
                        <div className="solic-form--footer">
                            <button type="submit" className="solic-btn solic-btn--primary">
                                {loading ? 'Enviando...' : 'Enviar solicitud'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    );
}

export default SolicitarMaterial;