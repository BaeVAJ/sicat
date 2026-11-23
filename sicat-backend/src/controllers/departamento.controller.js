import pool from '../db/pool.js';
import { enviarErrorInterno, esEnteroPositivo } from '../utils/errorHandler.js';

export async function getAll(req, res){
    try{
        const { rows } = await pool.query(`
            SELECT d.*, e.nombre AS empresa 
            FROM DEPARTAMENTO d 
            LEFT JOIN EMPRESA e 
            ON d.id_empresa = e.id_empresa`);
        res.json(rows);
    } catch (err){
        return enviarErrorInterno(res, err, 'departamento.getAll');
    }
}

// CORREGIDO: (req, res) en lugar de (res, req)
export async function getById(req, res){
    try{
        const { rows }= await pool.query('SELECT * FROM DEPARTAMENTO WHERE id_departamento = $1', [req.params.id]);
        if (!rows[0]) {
            return res.status(404).json({error:'DEPARTAMENTO NO ENCONTRADO'})
        }
        res.json(rows[0]);
    } catch(err){
        return enviarErrorInterno(res, err, 'departamento.getById');
    }
}

export async function create(req, res){
    const { nombre, id_empresa } = req.body || {};
    if (typeof nombre !== 'string' || !nombre.trim()) {
        return res.status(400).json({ error: 'El nombre del departamento es obligatorio' });
    }
    if (!esEnteroPositivo(id_empresa)) {
        return res.status(400).json({ error: 'El id_empresa debe ser un entero positivo' });
    }

    try{
        const {rows} = await pool.query(
            `INSERT INTO DEPARTAMENTO (nombre, id_empresa) VALUES ($1, $2) RETURNING *`,
            [nombre.trim(), Number(id_empresa)]
        );
        res.status(201).json(rows[0]);
    }catch (error){
        return enviarErrorInterno(res, error, 'departamento.create');
    }
}

export async function update(req, res){
    const { nombre, id_empresa } = req.body || {};
    if (typeof nombre !== 'string' || !nombre.trim()) {
        return res.status(400).json({ error: 'El nombre del departamento es obligatorio' });
    }
    if (!esEnteroPositivo(id_empresa)) {
        return res.status(400).json({ error: 'El id_empresa debe ser un entero positivo' });
    }

     try{
        const { rows }= await pool.query(
            `UPDATE DEPARTAMENTO SET nombre = $1, id_empresa = $2 WHERE id_departamento = $3 RETURNING *`,
            [nombre.trim(), Number(id_empresa), req.params.id]
        );
        
        if(!rows[0]){
            return res.status(404).json({error:'Departamento no encontrado'})
        }
        res.json(rows[0]);
     }catch(err){
        return enviarErrorInterno(res, err, 'departamento.update');
     }
}

export async function remove(req, res){
    try {
        const { rowCount }= await pool.query(`DELETE FROM DEPARTAMENTO WHERE id_departamento = $1`, [req.params.id]);
        if (!rowCount) {
            return res.status(404).json({error:'Departamento no encontrado'});
        }
        res.json({mensaje:'Departamento eliminado correctamente'});
    }catch(err){
        return enviarErrorInterno(res, err, 'departamento.remove');
    }
}