import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import client from '../../../api/client';
import Layout from '../../layout/Layout';
import './SolicitarMaterial.css';

function SolicitarMaterial() {
    const { usuario } = useAuth();
    const [material, setMaterial] = useState('');
    const [cantidad, setCantidad] = useState(1);
    const [urgente, setUrgente] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    async function handleSubmit(event) {
        event.preventDefault();
        setError('');
        setSuccess('');
        if (!material.trim() || !Number.isInteger(Number(cantidad)) || Number(cantidad) < 1) {
            setError('Escribe el material que necesitas y una cantidad válida.');
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
            setMaterial('');
            setCantidad(1);
            setUrgente(false);
            setSuccess('Solicitud enviada. El área de Sistemas la verá en Asignaciones.');
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudo enviar la solicitud.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Layout>
            <main className="solicitud-page">
                <section className="solicitud-card">
                    <div className="solicitud-heading">
                        <span className="solicitud-icon">+</span>
                        <div>
                            <h1>Solicitar material</h1>
                            <p>Describe lo que necesitas; Sistemas elegirá el material equivalente de su inventario.</p>
                        </div>
                    </div>
                    {error && <div className="solicitud-message solicitud-message--error">{error}</div>}
                    {success && <div className="solicitud-message solicitud-message--success">{success}</div>}
                    <form onSubmit={handleSubmit} className="solicitud-form">
                        <label>
                            Material solicitado
                            <input value={material} onChange={(event) => setMaterial(event.target.value)} placeholder="Ej. toner" maxLength={160} required />
                        </label>
                        <label>
                            Cantidad
                            <input type="number" min="1" step="1" value={cantidad} onChange={(event) => setCantidad(event.target.value)} required />
                        </label>
                        <label className="solicitud-checkbox">
                            <input type="checkbox" checked={urgente} onChange={(event) => setUrgente(event.target.checked)} />
                            Marcar como urgente
                        </label>
                        <button type="submit" disabled={loading}>{loading ? 'Enviando...' : 'Enviar solicitud'}</button>
                    </form>
                </section>
            </main>
        </Layout>
    );
}

export default SolicitarMaterial;
