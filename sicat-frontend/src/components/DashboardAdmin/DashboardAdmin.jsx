// src/components/DashboardAdmin/DashboardAdmin.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import Layout from '../layout/Layout';
import './DashboardAdmin.css';


function DashboardAdmin() {
    
    

    return (
        <Layout>
            <div className="dash-container">
            </div>
        </Layout>
    );
}

export default DashboardAdmin;