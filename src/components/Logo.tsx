// RF-1 (002) · Logo de APICCA COMÚN en SVG en línea, con los colores `logo-*` directamente sobre el
// fondo, sin placa (RF-2 (003) · 2.1–2.4; RF-17 (003) · 17.1), como enlace al inicio con nombre accesible y sin ser un encabezado (1.2, 1.3); la
// variante monocroma con colores forzados está en Logo.css (1.6). 32 px de alto por D-T16 (002).
import { LOGO } from "../../shared/domain/identity";
import { Link } from "../app/router";
import "./Logo.css";

const HEIGHT = 32;
const [, , vbWidth = 1, vbHeight = 1] = LOGO.viewBox.split(" ").map(Number);
const WIDTH = Math.round((HEIGHT * vbWidth) / vbHeight);

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="APICCA COMÚN, ir al inicio">
      <svg
        className="logo__svg"
        viewBox={LOGO.viewBox}
        width={WIDTH}
        height={HEIGHT}
        aria-hidden="true"
        focusable="false"
      >
        {LOGO.layers.map((layer) => (
          <path
            key={layer.token}
            className={`logo__layer logo__layer--${layer.token}`}
            d={layer.d}
            fillRule="evenodd"
          />
        ))}
      </svg>
    </Link>
  );
}
