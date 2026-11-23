/**
 * Verifica que un valor represente un número entero estrictamente positivo (> 0).
 */
export function esEnteroPositivo(valor) {
  return (
    !Array.isArray(valor) &&
    typeof valor !== 'boolean' &&
    valor !== null &&
    valor !== undefined &&
    String(valor).trim() !== '' &&
    Number.isInteger(Number(valor)) &&
    Number(valor) > 0
  );
}

/**
 * Verifica que un valor represente un número entero mayor o igual a cero (>= 0).
 */
export function esEnteroNoNegativo(valor) {
  return (
    !Array.isArray(valor) &&
    typeof valor !== 'boolean' &&
    valor !== null &&
    valor !== undefined &&
    String(valor).trim() !== '' &&
    Number.isInteger(Number(valor)) &&
    Number(valor) >= 0
  );
}

/**
 * Construye un error de negocio con código HTTP controlado (4xx).
 */
export function crearErrorDominio(mensaje, status = 400, extras = {}) {
  const error = new Error(mensaje);
  error.status = status;
  Object.assign(error, extras);
  return error;
}

const PG_ERROR_MAP = {
  '22P02': { status: 400, error: 'Parámetro o formato de dato inválido' },
  '22007': { status: 400, error: 'Formato de fecha u hora inválido' },
  '22008': { status: 400, error: 'Formato de fecha u hora inválido' },
  '23502': { status: 400, error: 'Faltan campos obligatorios' },
  '23505': { status: 409, error: 'Ya existe un registro con esos datos' },
  '23503': { status: 409, error: 'No se puede completar la operación por registros relacionados' },
};

/**
 * Registra el error real en el servidor y envía al cliente una respuesta sanitizada.
 */
export function enviarErrorInterno(
  res,
  err,
  contexto,
  mensajeDefault = 'Error interno del servidor'
) {
  console.error(`[${contexto}]`, err);

  if (err?.status >= 400 && err?.status < 500) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.campo ? { campo: err.campo } : {}),
    });
  }

  const mapped = err?.code ? PG_ERROR_MAP[err.code] : null;
  if (mapped) {
    return res.status(mapped.status).json({ error: mapped.error });
  }

  return res.status(500).json({ error: mensajeDefault });
}
