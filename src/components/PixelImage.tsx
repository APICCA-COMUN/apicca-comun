// RF-18 (001), RNF-2 (001), RF-2 (002), RF-7 (002) · Imagen pixelada de un ápice: el PNG sin suavizar y con su texto alternativo, o un
// marcador que dice que aún no hay imagen. Tamaño y suavizado van en una clase (PixelImage.css).
import type { ApiceImage } from '../data/apices';
import './PixelImage.css';

interface Props {
  image: ApiceImage | null;
  /** Nombre accesible del marcador cuando no hay imagen. */
  emptyLabel?: string;
  /** Lado en píxeles CSS, calculado por el dominio (D-T10 (002)); sin él, el de la hoja. */
  side?: number;
  onError?: () => void;
}

/** PNG como URL de datos; sin `btoa` sobre cadenas enormes, por tandas. */
function toDataUrl(png: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < png.length; i += 0x8000) binary += String.fromCharCode(...png.subarray(i, i + 0x8000));
  return `data:image/png;base64,${btoa(binary)}`;
}

export function PixelImage({ image, emptyLabel = 'Sin imagen', side, onError }: Props) {
  const size = side === undefined ? undefined : { width: `${side}px`, height: `${side}px` };
  if (image === null) {
    return (
      <div role="img" aria-label={emptyLabel} className="pixel-image pixel-image--empty" style={size}>
        <span aria-hidden="true">Sin imagen</span>
      </div>
    );
  }
  return <img src={toDataUrl(image.png)} alt={image.altText} className="pixel-image" style={size} onError={onError} />;
}
