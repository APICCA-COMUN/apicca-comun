// RF-15 (001) · Lectura y reescritura de imágenes de referencia (D-T9 (001)). Único archivo que importa `sharp` (D-12 (001)).
import sharp from 'sharp';
import { PIXEL_SIZE, quantizeToPalette } from '../../shared/domain/images';
import type { ErrorCode } from '../../shared/domain/messages';

export type ImageFormat = 'jpeg' | 'png' | 'webp';

const CONTENT_TYPES: Record<ImageFormat, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export interface InspectedImage {
  format: ImageFormat;
  contentType: string;
  width: number;
  height: number;
}

export type Inspection = { ok: true; value: InspectedImage } | { ok: false; code: ErrorCode };

const isAdmitted = (format: string | undefined): format is ImageFormat => format === 'jpeg' || format === 'png' || format === 'webp';

/**
 * Lee el formato real por contenido (nunca por extensión), rechaza las animadas, las que pasan de
 * `maxDimension` por lado y las ilegibles. La lectura de cabecera va antes de decodificar, así una
 * imagen enorme se rechaza sin gastar memoria.
 */
export async function inspectImage(bytes: Uint8Array, maxDimension: number): Promise<Inspection> {
  if (bytes.byteLength === 0) return { ok: false, code: 'image-unreadable' };
  try {
    const meta = await sharp(bytes).metadata();
    if (!isAdmitted(meta.format)) {
      // Un formato que sharp conoce pero la spec no admite (GIF, SVG, TIFF…) se dice como tal.
      return { ok: false, code: meta.format === undefined ? 'image-unreadable' : animatedOrUnsupported(meta.format, meta.pages) };
    }
    if ((meta.pages ?? 1) > 1) return { ok: false, code: 'image-animated' };
    const { width, height } = meta;
    if (width === undefined || height === undefined) return { ok: false, code: 'image-unreadable' };
    if (width > maxDimension || height > maxDimension) return { ok: false, code: 'image-dimensions-exceeded' };
    // Decodificar de verdad: una cabecera válida con datos rotos no es una imagen legible.
    await sharp(bytes).raw().toBuffer();
    return { ok: true, value: { format: meta.format, contentType: CONTENT_TYPES[meta.format], width, height } };
  } catch {
    return { ok: false, code: 'image-unreadable' };
  }
}

function animatedOrUnsupported(format: string, pages: number | undefined): ErrorCode {
  return format === 'gif' && (pages ?? 1) > 1 ? 'image-animated' : 'image-type-unsupported';
}

/**
 * Reescribe la imagen sin metadatos (EXIF, XMP, IPTC, perfil): quita la geolocalización (RF-15 (001)).
 * Aplica antes la orientación EXIF, para que la imagen no gire al perder esa marca.
 */
export async function stripMetadata(bytes: Uint8Array, format: ImageFormat): Promise<Buffer> {
  const pipeline = sharp(bytes).rotate();
  switch (format) {
    case 'jpeg':
      return pipeline.jpeg({ quality: 90 }).toBuffer();
    case 'png':
      return pipeline.png().toBuffer();
    case 'webp':
      return pipeline.webp({ quality: 90 }).toBuffer();
  }
}

/**
 * Lo que devuelve el modelo, a la forma de la spec (RF-17 (001), D-T7 (001)): 64 × 64 y solo colores de la
 * paleta, sin confiar en lo que el modelo haya hecho. Lanza si los bytes no son una imagen legible.
 */
export async function toPixelPng(bytes: Uint8Array): Promise<Buffer> {
  const { data } = await sharp(bytes)
    .rotate()
    .resize(PIXEL_SIZE, PIXEL_SIZE, { fit: 'cover', kernel: 'nearest' })
    .flatten({ background: '#ffffff' })
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const quantized = quantizeToPalette(data);
  return sharp(quantized, { raw: { width: PIXEL_SIZE, height: PIXEL_SIZE, channels: 3 } })
    .png()
    .toBuffer();
}
