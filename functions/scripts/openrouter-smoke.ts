// Script de humo MANUAL del adaptador de OpenRouter (T-6.7, D-T22 (001)). No corre en CI.
// Hace UNA generación real (cuesta crédito) y deja el resultado cuantizado en 64 × 64 para
// elegir la paleta definitiva (T-6.8, D-5 (001)).
//
// Uso (desde functions/):
//   OPENROUTER_API_KEY=<llave con tope> OPENROUTER_MODEL=<id del modelo> \
//     npm run smoke:openrouter -- "una huerta comunal en la ladera" salida.png
//
// La llave solo se lee del entorno de esa orden: no se escribe en archivos ni en el repositorio.
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { PIXEL_SIZE, quantizeToPalette } from '../../shared/domain/images';
import { createOpenRouterImageModel } from '../src/model/openRouterImageModel';

const apiKey = process.env['OPENROUTER_API_KEY'];
const model = process.env['OPENROUTER_MODEL'] ?? 'black-forest-labs/flux.2-klein-4b';
if (!apiKey) {
  console.error('Define OPENROUTER_API_KEY en el entorno (OPENROUTER_MODEL es opcional y usa black-forest-labs/flux.2-klein-4b).');
  process.exit(1);
}
const prompt = process.argv[2] ?? 'Una huerta comunal en la ladera, estilo pixel art.';
const out = process.argv[3] ?? 'openrouter-smoke.png';

async function main(apiKey: string, model: string): Promise<void> {
  const bytes = await createOpenRouterImageModel({ apiKey, model }).generate({ prompt, references: [] });
  const raw = await sharp(bytes)
    .resize(PIXEL_SIZE, PIXEL_SIZE, { fit: 'cover', kernel: 'nearest' })
    .removeAlpha()
    .raw()
    .toBuffer();
  const quantized = quantizeToPalette(new Uint8Array(raw));
  await sharp(Buffer.from(quantized), { raw: { width: PIXEL_SIZE, height: PIXEL_SIZE, channels: 3 } })
    .png()
    .toFile(out);
  writeFileSync(`${out}.original`, bytes);
  console.log(`Listo: ${out} (64 × 64, paleta) y ${out}.original (lo que devolvió el modelo).`);
}

main(apiKey, model).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
