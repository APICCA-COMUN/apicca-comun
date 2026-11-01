// Rasterizador de las imágenes de marca (T-7.1, T-7.2, D-19 (002)). Corre en el navegador: SVG → `img` →
// `canvas` → PNG. `gen-brand-images.mjs` lo pasa a Playwright con `page.evaluate` y la prueba de sincronía
// lo importa en Chromium, así que las dos rasterizan igual. Debe quedar autocontenida: Playwright solo
// envía el texto de la función.

/** @param {{ svg: string; width: number; height: number }} image @returns {Promise<string>} PNG en base64. */
export async function rasterizeBrand({ svg, width, height }) {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/png').slice('data:image/png;base64,'.length);
}
