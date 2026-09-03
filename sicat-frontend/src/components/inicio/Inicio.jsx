// src/components/DashboardAdmin/DashboardAdmin.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import Layout from '../layout/Layout';
import './Inicio.css';


function DashboardAdmin() {
    const {usuario} = useAuth();


    return (
        <Layout>
            <div className="dash-container">
                <div className="dash-header">
                    <div className="dash-header--title">
                        <h1>Bienvenido {usuario?.rol} {usuario?.nombre}</h1>
                    </div>
                </div>
                
            </div>
        </Layout>
    );
}

export default DashboardAdmin;