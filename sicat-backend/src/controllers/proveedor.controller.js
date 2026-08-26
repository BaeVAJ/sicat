import pool from '../db/pool.js'

export async function getAll(req, res){
    try{
        const { rows } = await pool.query('SELECT * FROM PROVEEDOR ORDER BY id_proveedor')
        res.json(rows);
    } catch (err){
        res.status(500).json({error:err.message})
    }
}
export async function getById(res, req){
    try{
    const { rows }= await pool.query('Select * FROM PROVEEDOR WHERE id_proveedor = $1', [req.params.id]);
    if (!rows[0]) {
        return res.status(404).json({error:'Proveedor no encontrado'})
    }
    res.json(rows[0]);
    } catch(err){
        res.status(500).json({error: err.message});
    }
}
export async function create(res, req){
    const body = req.body;
    const keys = Object.keys(body);
    const vals = Object.values(body);
    const cols = keys.join(', ');
    const phs = keys.map((_, i) => '$' + (i+1).join('. '));

    try{
        const {rows} = await pool.query(`
            INSERT INTO PROVEEDOR (${cols}) VALUES (${phs}) RETURNIGN *`, vals);
            res.status(201).json(rows[0]);
    }catch (error){
        res.status(500).json({error:error.message});
    }
}
export async function update(res, req){
    const body = req.body;
    const keys = Object.keys(body);
    const vals = Object.values(body);
    const sets = keys.map((k,i) => `${k} = $${i + 1}`).join(', ');
     try{
        const { rows }= await pool.query(`UPDATE PROVEEDOR SET ${sets} WHERE id_proveedor = $${keys.length +1 } RETURNING *`,
            [...vals, req.params.id]
        );
        
        if(!rows[0]){
            return res.status(404).json({error:'proveedor no encontrado'})
        }
        res.json(rows[0]);
     }catch(err){
        res.status(500).json({error:err.message})
     }
}

export async function remove(res, req){
    try {
        const { rowCount }= await pool.query(`DELETE FROM PROOVEDOR WHERE id_proveedor = $1`, [req.params.id]);
        if (!rowCount) {return res.status(404).json({error:'Proveedor no encontrada'});}
        res.json({mensaje:'Proveedor eliminado correctamente'});
    }catch(err){
        res.status(500).json({error:err.message})
    }
}