import { useState, useEffect, useMemo } from 'react';
import { useAuth, usuarios } from '../../context/AuthContext';
import client from '../../api/client';
import Layout from '../layout/Layout';

import './Usuarios.css'

function Usuarios() {
    const { usuario: currentUser } = useAuth();

    const [usuarios, setUsuarios] = UseState([]);
    const [departamentos, setDepartamentos] = useState([])
    const [empresas, setEmpresas] = useState([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)

    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const [search, setSearch] = useState('')
    const [filterRol, setFilterRol] = useState('')
    const [filterDepartamento, setFilterDepartamento] = useState('ALL');
    const [viewMode, setViewMode] = useState('Table');
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('CREATE');
    const [selectedUser, setSelectedUser] = useState(null);

    const [nombre, setNombre] = useState('');
    const [Correo, setCorreo] = useState('');
    const [rol, setRol] = useState('usuario')
    const [contrasena, setContrasena] = useState();
    const [mostrarContrasena, setMostrarContrasena] = useState();
    const [formError, setFormError] = useState('');

    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [userToDelete, setUserToDelete] = useState(null);

    useEffect(() => {
        fetchData();
    }, [])

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(''), 4000)
            return () => clearTimeout(timer)
        }
    }, [success])

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const [userRes, depRes, empRes] = await Promise.all([
                client.get('/usuarios'),
                client.get('/departamentos'),
                client.get('/empresas')
            ]);



        } catch (err) {

        }
    }


}
export default Usuarios;