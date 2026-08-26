import pool from '../db/pool.js'

export async function getAll(req, res){
    try{
        const { rows } = await pool.query('SELECT * FROM DEPARTAMENTO ORDER BY id_departamento')
        res.json(rows);
    } catch (err){
        res.status(500).json({error:err.message})
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
        res.status(500).json({error: err.message});
    }
}

export async function create(req, res){
    const body = req.body;
    const keys = Object.keys(body);
    const vals = Object.values(body);
    const cols = keys.join(', ');
    
    // CORREGIDO: el .join(', ') va fuera del map y reparamos la lógica
    const phs = keys.map((_, i) => '$' + (i + 1)).join(', ');

    try{
        // CORREGIDO: RETURNING en lugar de RETURNIGN
        const {rows} = await pool.query(`
            INSERT INTO DEPARTAMENTO (${cols}) VALUES (${phs}) RETURNING *`, vals);
        res.status(201).json(rows[0]);
    }catch (error){
        res.status(500).json({error:error.message});
    }
}

export async function update(req, res){
    const body = req.body;
    const keys = Object.keys(body);
    const vals = Object.values(body);
    const sets = keys.map((k,i) => `${k} = $${i + 1}`).join(', ');
    
     try{
        const { rows }= await pool.query(`UPDATE DEPARTAMENTO SET ${sets} WHERE id_departamento = $${keys.length + 1} RETURNING *`,
            [...vals, req.params.id]
        );
        
        if(!rows[0]){
            return res.status(404).json({error:'Departamento no encontrado'})
        }
        res.json(rows[0]);
     }catch(err){
        res.status(500).json({error:err.message})
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
        res.status(500).json({error:err.message})
    }
}