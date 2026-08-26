import pool from '../db/pool.js'

export async function getAll(req, res){
    try{
        const { rows } = await pool.query('SELECT * FROM PRODUCTO ORDER BY id_producto')
        res.json(rows);
    } catch (err){
        res.status(500).json({error:err.message})
    }
}
export async function getById(res, req){
    try{
    const { rows }= await pool.query('Select * FROM PRODUCTO WHERE id_producto = $1', [req.params.id]);
    if (!rows[0]) {
        return res.status(404).json({error:'producto no encontrado'})
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
            INSERT INTO PRODUCTO (${cols}) VALUES (${phs}) RETURNIGN *`, vals);
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
        const { rows }= await pool.query(`UPDATE PRODUCTO SET ${sets} WHERE id_producto = $${keys.length +1 } RETURNING *`,
            [...vals, req.params.id]
        );
        
        if(!rows[0]){
            return res.status(404).json({error:'Producto no encontrado'})
        }
        res.json(rows[0]);
     }catch(err){
        res.status(500).json({error:err.message})
     }
}

export async function remove(res, req){
    try {
        const { rowCount }= await pool.query(`DELETE FROM PRODUCTO WHERE id_producto = $1`, [req.params.id]);
        if (!rowCount) {return res.status(404).json({error:'Producto no encontrada'});}
        res.json({mensaje:'Producto eliminado correctamente'});
    }catch(err){
        res.status(500).json({error:err.message})
    }
}