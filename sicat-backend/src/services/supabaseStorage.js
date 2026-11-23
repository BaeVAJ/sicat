import { createClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';
import dotenv from 'dotenv';

dotenv.config();

const BUCKET_NAME = (process.env.SUPABASE_BUCKET || 'facturas').trim().toLowerCase();

/**
 * Obtiene el cliente de Supabase asegurando que la clave esté configurada
 */
export function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!key || key.startsWith('placeholder')) {
    throw new Error(
      'Falta configurar SUPABASE_KEY en el archivo .env del backend. Por favor agrega tu clave anon o service_role de Supabase (empieza con eyJhbGciOi...).'
    );
  }

  return createClient(supabaseUrl, key);
}

/**
 * Extrae la ruta relativa de un archivo dentro del bucket
 */
export function extraerPathArchivo(pathOrUrl) {
  if (!pathOrUrl) return '';
  let path = pathOrUrl;
  if (path.includes(`/${BUCKET_NAME}/`)) {
    path = path.split(`/${BUCKET_NAME}/`).pop();
  }
  // Limpiar query params si tenía token previo
  path = path.split('?')[0];
  return path;
}

/**
 * Valida la firma mágica de un archivo PDF antes de procesarlo o subirlo.
 */
export function validarBufferPdf(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    const err = new Error('El archivo no corresponde a un PDF válido');
    err.status = 400;
    throw err;
  }
}

/**
 * Valida que el buffer XML sea texto estructurado seguro sin DTD/ENTITY ni contenido script/XHTML.
 */
export function validarBufferXml(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error('El archivo XML está vacío o no es válido');
    err.status = 400;
    throw err;
  }
  const contenido = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
  if (!contenido.startsWith('<') || !contenido.endsWith('>')) {
    const err = new Error('El archivo no tiene estructura XML válida');
    err.status = 400;
    throw err;
  }
  if (/<!\s*(doctype|entity)\b/i.test(contenido)) {
    const err = new Error('El XML contiene declaraciones DTD o ENTITY no permitidas');
    err.status = 400;
    throw err;
  }
  if (/<\s*script\b/i.test(contenido) || /http:\/\/www\.w3\.org\/1999\/xhtml/i.test(contenido)) {
    const err = new Error('El XML contiene elementos HTML/script no permitidos');
    err.status = 400;
    throw err;
  }
}

/**
 * Genera una URL firmada temporal para acceder a un archivo de un bucket privado
 * @param {string} pathOrUrl - Ruta o URL guardada
 * @param {number} expiresIn - Segundos de validez (por defecto 1 hora)
 * @param {{ download?: boolean | string }} [options]
 * @returns {Promise<string>}
 */
export async function obtenerUrlFirmada(pathOrUrl, expiresIn = 3600, options = {}) {
  const path = extraerPathArchivo(pathOrUrl);
  if (!path) return '';

  const client = getSupabaseClient();
  const signedOptions = options.download ? { download: options.download } : undefined;
  const { data, error } = await client.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, expiresIn, signedOptions);

  if (error) {
    console.error('[Supabase Signed URL Error]:', error.message);
    throw new Error(`Error al generar enlace seguro: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Optimiza y comprime un archivo PDF usando pdf-lib
 * @param {Buffer} buffer - Buffer del archivo PDF original
 * @returns {Promise<{ buffer: Buffer, originalSize: number, compressedSize: number, ratio: string }>}
 */
export async function comprimirPdf(buffer) {
  const originalSize = buffer.length;
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });

    // Guarda el documento con compresión de streams de objetos y eliminación de referencias huérfanas
    const compressedUint8Array = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    const compressedBuffer = Buffer.from(compressedUint8Array);
    const compressedSize = compressedBuffer.length;

    // Si por alguna razón el archivo comprimido resultó mayor, usamos el original
    const finalBuffer = compressedSize < originalSize ? compressedBuffer : buffer;
    const finalSize = finalBuffer.length;
    const ratio = (((originalSize - finalSize) / originalSize) * 100).toFixed(1);

    console.log(
      `[PDF-Compresión] Original: ${(originalSize / 1024).toFixed(1)} KB | Final: ${(finalSize / 1024).toFixed(1)} KB | Ahorro: ${ratio}%`
    );

    return {
      buffer: finalBuffer,
      originalSize,
      compressedSize: finalSize,
      ratio: `${ratio}%`,
    };
  } catch (error) {
    console.warn('[PDF-Compresión] No se pudo recomprimir el PDF, usando original:', error.message);
    return {
      buffer,
      originalSize,
      compressedSize: originalSize,
      ratio: '0%',
    };
  }
}

/**
 * Sube un archivo PDF al bucket de Supabase Storage
 * @param {Buffer} buffer - Buffer del archivo
 * @param {string} originalName - Nombre original del archivo
 * @returns {Promise<{ url: string, path: string, originalSize: number, compressedSize: number }>}
 */
export async function subirPdfFactura(buffer, originalName = 'factura.pdf') {
  validarBufferPdf(buffer);
  const client = getSupabaseClient();
  const { buffer: optimizedBuffer, originalSize, compressedSize } = await comprimirPdf(buffer);

  const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniquePrefix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const filePath = `facturas_pdf_${uniquePrefix}_${cleanName.endsWith('.pdf') ? cleanName : cleanName + '.pdf'}`;

  const { error: uploadError } = await client.storage
    .from(BUCKET_NAME)
    .upload(filePath, optimizedBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    console.error('[Supabase Storage PDF Error]:', uploadError);
    throw new Error(`Error al subir PDF a Supabase: ${uploadError.message}`);
  }

  return {
    url: filePath,
    path: filePath,
    originalSize,
    compressedSize,
  };
}

/**
 * Sube un archivo XML al bucket de Supabase Storage
 * @param {Buffer} buffer - Buffer del archivo XML
 * @param {string} originalName - Nombre original del archivo
 * @returns {Promise<{ url: string, path: string, size: number }>}
 */
export async function subirXmlFactura(buffer, originalName = 'factura.xml') {
  validarBufferXml(buffer);
  const client = getSupabaseClient();

  const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniquePrefix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const filePath = `facturas_xml_${uniquePrefix}_${cleanName.endsWith('.xml') ? cleanName : cleanName + '.xml'}`;

  const { error: uploadError } = await client.storage
    .from(BUCKET_NAME)
    .upload(filePath, buffer, {
      contentType: 'application/xml',
      upsert: true,
    });

  if (uploadError) {
    console.error('[Supabase Storage XML Error]:', uploadError);
    throw new Error(`Error al subir XML a Supabase: ${uploadError.message}`);
  }

  return {
    url: filePath,
    path: filePath,
    size: buffer.length,
  };
}

/**
 * Elimina un archivo de Supabase Storage
 * @param {string} pathOrUrl - Ruta o URL del archivo
 */
export async function eliminarArchivoFactura(pathOrUrl) {
  if (!pathOrUrl) return;
  try {
    const client = getSupabaseClient();
    const filePath = extraerPathArchivo(pathOrUrl);

    if (!filePath) return;

    const { error } = await client.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.warn('[Supabase Storage Eliminar Warning]:', error.message);
    }
  } catch (err) {
    console.warn('[Supabase Storage Eliminar Exception]:', err.message);
  }
}

// Mantener retrocompatibilidad
export const eliminarPdfFactura = eliminarArchivoFactura;
