import jwt from 'jsonwebtoken';

export function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token requerido' });
    }

    try {

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = payload;
        next();
    } catch {
        //token de usuario invalido o expirado
        return res.status(403).json({ error: 'Error. Ingresa a tu cuenta de nuevo' })

    }
}
export function verificarRol(...rolesPermitidos) {
    return (req, res, next) => {
        if (!rolesPermitidos.includes(req.usuario?.rol)) {
            return res.status(403).json({ error: 'No tienes permisos para esta accion' })
        }
        next();
    };
}