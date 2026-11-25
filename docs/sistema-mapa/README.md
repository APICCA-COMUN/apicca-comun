> **Desde el 24-11-2026 el sitio aplica la línea E3 · Celda; ver `celda.md`.** Lo que sigue describe la base P1 · Mapa (23-11-2026). Donde `celda.md` cambia algo (paleta, trama, leyenda, elección y Acción Común), manda `celda.md`.

APICCA es la API para crear y conectar Acciones Comunes: apoyo mutuo, commoning y economías recíprocas no monetarias. «API» quiere decir piezas que se componen: cada **Ápice** declara qué ofrece y qué necesita, y una **Acción Común** los conecta. Este sistema es la versión **P1 · Mapa**, con la línea **E3 · Celda** encima (24-11-2026). El mapa teselado es la pantalla, y **la regla de patrón dice la Etapa**.

## Quién dice qué

- Las *decisiones de la persona* (MangleRojo ORG, 23-11-2026 y 24-11-2026) van en «Decidido».
- Todo lo demás es **Propuesta del asistente**: la codificación de P1, las reglas de uso, los tokens que no son de la paleta y los componentes.
- Lo que sigue abierto va en «Por decidir».
- Los datos de las vistas previas (Ápices, zonas, Acciones Comunes) son ficticios.

## Decidido

- **Logo**: es lo único que continúa del sistema anterior. Se usa tal cual (recursos `Logos`): no se redibuja, no se recolorea y no se le pone fondo de eje.
- **Glifos de eje**:

  | Eje | Glifo |
  |---|---|
  | agua | círculo |
  | alimento | trapecio, con la base ancha arriba |
  | cobijo | cuadrado |
  | energía | triángulo |
  | comunicación | barra diagonal maciza |

  No se proponen otros.
- **Reglas de patrón**: tresbolillo, encaje y eco. Rejilla, macro, crecida y giro quedaron fuera.
- **Color plano y negro.** Paleta E3 · Celda (24-11-2026), igual en claro y oscuro para los ejes: agua `#0096FF`, alimento `#47C254`, cobijo `#FF8F00`, energía `#FFD200`, comunicación `#FF0000`. Claro: papel `#FFFFFF`, tinta `#141414`, suave `#666666`, trama `#D3D3D3`. Oscuro: papel `#121212`, tinta `#FFFFFF`, suave `#B4B4B4`, trama `#343434`. Detalle y contrastes en `celda.md`. No hay manchas, brochazos, salpicaduras ni textura de tinta.
- **Línea E3 · Celda** (24-11-2026): ejes a tope, sin cajas, la trama solo dentro de las zonas, la leyenda como control, elegir es ampliar, y el Arco para dibujar cada Acción Común. Las seis reglas están en `celda.md`.
- **Tipo**: sans geométrica gruesa (Jost).
- **Temas** claro y oscuro. Escritorio primero.
- **Mapa** teselado con H3, con el teselado a la vista.
- **Vocabulario**: Ápice, Acción Común, economías recíprocas. No hay marco de juego.
- **Primera visita**: ver lo que existe y luego prototipar.
- **Dirección**: «Sistema P1 mapa».

## La idea en una línea

Cada Ápice es una **superficie de patrón**:
- el **color** dice el eje;
- el **glifo** repetido dice el eje otra vez, sin depender del color;
- la **regla** con que se repite dice la Etapa.

| Etapa | Regla | Lectura |
|---|---|---|
| idea | tresbolillo | Glifos sueltos. |
| prototipo | encaje | Los glifos ya se tocan. |
| en marcha | eco | El glifo se propaga. |

Usa siempre `Apicca.REGLA[etapa]`; no elijas la regla a mano.
- Un Ápice de varios ejes va en **franjas verticales**, una por eje, en el orden en que los declaró.
- Una **Acción Común** se dibuja como el **Arco**: una curva cuadrática que une sus Ápices, en orden por cercanía, con el trazo en tinta y apagada en trama cuando no está elegida. Ya no es una fila de celdas de `ruta` (retirada desde E3 · Celda). Fuera del mapa, la pieza Arco son celdas pequeñas unidas por arcos. Detalle en `celda.md`.

## Contenido y voz

- **Tuteo**, frases cortas y verbos de hacer: «Prototipar un Ápice», «Conectar», «Sumarme», «Entrar».
- **Títulos y rótulos en MAYÚSCULAS** (`titulo-*`, `rotulo`, `boton`, `navegacion`). El cuerpo va en minúscula normal.
- **Textos de interfaz que ya existen**; reúsalos tal cual:
  - título de Inicio: «API para crear y conectar Acciones Comunes»;
  - entradilla: «Apoyo mutuo, commoning y economías recíprocas no monetarias.»;
  - navegación: Ápices · Acciones Comunes · Documentación · Constitución · Foro;
  - ficha: «Ofrece:» y «Necesita:»; si falta el dato, «Sin declarar.».
- **Los textos nuevos de la interfaz los decide la persona.** Un agente solo los propone, y los marca como propuesta.
- Los **nombres de eje** van en minúscula en el texto corrido («agua y comunicación · en marcha») y en mayúscula en los rótulos.
- Cifras con conteo y punto medio: «19 Ápices · 4 Acciones Comunes · 5 zonas». No hay puntajes, rankings ni nada monetario.
- **No uses** jugar, juego, reglas del juego, plaza, edificio, manzana, camino, puntos, monedas ni precio. Tampoco emojis.

## Fundamentos visuales

**Color**
- Pon el fondo en `papel` y el texto en `tinta`.
- El texto secundario va en `suave`, solo sobre `papel`.
- `trama` es solo decoración: celdas vacías y divisores de 1,5 px. Solo aparece dentro de las zonas; el mapa flota (regla 1 de `celda.md`).
- Los cinco `eje-*` son fondos de superficie, nunca color de texto. Sobre un eje, el glifo y su patrón van siempre en `glifo-sobre-eje` (`#141414`), en los dos temas. Con la paleta E3 · Celda, el contraste del glifo va de 4,61:1 (comunicación) a 12,69:1 (energía).
- Los colores de eje dan poco contraste sobre papel blanco: energía 1,45:1 y cobijo 2,29:1. Por eso el color nunca va solo (glifo, regla o palabra) y la celda lleva contorno.
- **Filtrar es apagar el color** (regla 2): lo que no pasa el filtro conserva patrón y lugar en gris de trama. En el mapa no desaparece nada; la vista de lista sí quita filas.

**Contorno de superficie (Propuesta del asistente)**
- Toda superficie de patrón lleva un contorno de `trazo-contorno` (2 px) en `contorno-superficie`: tinta `#141414` en claro, blanco en oscuro.
- En claro, el contorno de tinta es imprescindible sobre papel blanco, porque el amarillo y el naranja no se separan del fondo solos.
- Aplica a celdas, leyendas y filas. La ficha ya no lleva borde (sale en E3 · Celda), así que el contorno es lo que la separa.

**Tema oscuro**
- `papel` y `tinta` se invierten. Los ejes no cambian.
- `ruta` queda retirada: en la línea E3 · Celda la Acción Común no usa celdas de `ruta`. Su valor oscuro (`#343434`) se conserva en `tokens.ts` solo hasta que el código lo retire.
- `trama` en oscuro es `#343434`.

**Tipo**
- Todo va en Jost (`font-jost`), en dos pesos dominantes: 800 para títulos, rótulos y botones, y 400–700 para el texto.
- Hay un `titulo-pantalla` por pantalla. Las fichas usan `titulo-ficha`.
- Los rótulos sobre el mapa van en `rotulo-mapa`:
  - zona: papel con texto en tinta;
  - Acción Común (Arco): el glifo del eje de 14 px y el nombre en mayúsculas, sin caja. No ocupa celdas.
- La acción principal es un rótulo grande en tinta, sin caja: la única mancha negra fuera del mapa (regla 5).

**Forma**
- Radio 0 en todo (`radio-0`).
- Sin sombras ni degradados.
- Los trazos son de cuatro grosores:
  - `trazo-borde` (3 px): en E3 · Celda sale de la cabecera, del panel, de la ficha y del botón de contorno; queda como referencia hasta que el código lo retire;
  - `trazo-zona` (4 px) para el borde de zona;
  - `trazo-contorno` (2 px) para el contorno de superficie y del Arco (halo de papel aparte);
  - `trazo-divisor` (1,5 px) para la trama.
- Las líneas van solo horizontales y a 60°, excepto el Arco (regla 6).
- Sin cajas ni tarjetas: las piezas son celda, rótulo, filete y texto (regla 5). «Entrar» tampoco va en caja.

**Espacio**: pasos `espacio-1` a `espacio-7` (4, 8, 12, 16, 24, 32 y 48 px). Las alturas son fijas:
- controles: `alto-control`, 48 px;
- cabecera: `alto-cabecera`, 64 px;
- botón de ícono: `boton-icono`, 44 px.

**Estados**
- **Foco**: contorno de `trazo-foco` (3 px) en `tinta`, separado `foco-separacion` (3 px), en todo control (`:focus-visible`).
- **Botón secundario y selector**: al pasar el cursor, o al pulsarlos, se invierten a tinta llena (Propuesta del asistente).
- **Ápice elegido en el mapa** (E3 · Celda, regla 4): el Ápice se dibuja en grande en la columna, unido a su celda por una línea de llamada en arco (geometría del Arco, comba menor hacia arriba, trazo fino, un disco de 4 px en la llegada, dentro del hexágono y cerca del borde que mira a la columna, no al centro; borde de papel). Al elegir, el resto se apaga. La línea de llamada solo aparece en escritorio (≥ 900 px). Sustituye al doble anillo de P1.

**Composición de Inicio (P1, con E3 · Celda)**
- Cabecera de 64 px, sin borde.
- Debajo, el `Mapa` ocupa el ancho menos un panel de `ancho-panel` (430 px), sin borde de separación.
- El panel lleva, en este orden:
  1. el título y la entradilla;
  2. «Prototipar un Ápice» y «Conectar»;
  3. la leyenda como control (regla 3): Ejes, Etapa y nivel son celdas que se encienden y se apagan. Ya no son dos leyendas sueltas;
  4. la Ficha del Ápice elegido, sin borde;
  5. la lista de Ápices en `FilaApice`.

## Mapa

- Las celdas son **hexágonos planos arriba**, como el teselado H3, y van en coordenadas axiales (q, r).
- Una **zona** son siete celdas (centro y anillo), con el borde exterior en `trazo-zona`.
- Si una zona tiene más Ápices de los que caben, su celda central muestra «+N» en tinta.
- Las celdas vacías se dibujan en `trama` solo dentro de las zonas (regla 1): fuera de ellas no hay teselado de fondo.
- Los rótulos van fuera de las celdas, nunca encima de un patrón.
- La Acción Común se dibuja como el Arco (ver «La idea en una línea»): curva de Ápice a Ápice, apagada en trama cuando no está elegida. No ocupa celdas.
- Filtrar apaga el color y no quita piezas del mapa (regla 2).
- Pendientes de E3 · Celda (sin regla todavía): rótulos de zona cuando se tocan, y el paso del Arco entre zonas contiguas. Ver `celda.md`.

## Iconografía

- **Glifos de eje**: son la iconografía principal. Usa `Glifo` (losa de color con glifo, o glifo suelto en `currentColor`) o los SVG del grupo `Glifos` (tinta `#141414`).
- **Íconos de interfaz** (`Icono`): siete trazos geométricos en `currentColor`, todos del mismo dibujo que los glifos.
  - ofrece: triángulo macizo;
  - necesita: triángulo invertido de contorno;
  - avanzar;
  - tema: disco mitad lleno;
  - cerrar;
  - agregar;
  - etapa: las tres reglas en miniatura.
- No hay biblioteca de íconos externa ni emojis.
- **No dibujes** gotas, hojas, casas, rayos, soles, antenas, fábricas ni siluetas de ciudad.

## Cómo usar los componentes

- `components/bundle.js` define `window.Apicca`. Cada componente es una función `(props) => cadena HTML`, sin React ni bibliotecas.
  - Ejemplo: `el.innerHTML = Apicca.FichaApice({ nombre: 'Tanques de agua lluvia' })`.
  - Geometría suelta: `Apicca.patron(eje, regla, ancho, alto, { escala })`, `Apicca.superficie(ejes, etapa, ancho, alto)` y `Apicca.forma(eje, cx, cy, s, modo)`.
  - Datos ficticios: `Apicca.demo`.
- `components/bundle.css` tiene las clases `ap-…`. Todos sus valores salen de los tokens.
- **Estado (24-11-2026):** ni `components/bundle.js` ni `components/bundle.css` están en esta carpeta; `bundle.css` está aquí, y la copia de `bundle.js` está en `tests/fixtures/sistema-mapa/bundle.js`. El sitio (`src/`) no los carga: la geometría vive en `shared/domain/identity/pattern.ts` y en `shared/domain/mapArcs.ts`, y el estilo en `src/styles/tokens.css`. Las clases `ap-…` y los componentes descritos arriba son de P1 y no se usan en el código actual; no se han borrado.
- Para llevarlo a React, envuelve cada función en un componente: la geometría no depende del marco.

## Qué no hacer

- Manchas, brochazos, salpicaduras, texturas de impresión.
- Esquinas redondeadas, sombras, degradados, transparencias decorativas.
- El color como única señal: siempre glifo, regla o palabra.
- Una superficie de eje sin contorno.
- Texto sobre un patrón.
- El glifo en blanco sobre un eje.
- Otros glifos de eje, otras reglas de patrón (rejilla, macro, crecida, giro) o las figuras de la exploración 023 (Sellos, Geoplano, Ronda, Partitura, Trama).
- Metáforas monetarias, puntajes o marco de juego.
- Cajas o tarjetas alrededor de piezas, de la ficha o de «Entrar» (E3 · Celda, regla 5).
- Trama fuera de las zonas (regla 1).
- Apagar un Ápice quitándolo del mapa: se apaga el color (regla 2).
- Líneas en ángulos distintos de la horizontal y de 60°, salvo el Arco (regla 6).
- Dos leyendas sueltas: la leyenda es el control (regla 3).

## Por decidir

- **Nombres**: el nombre de este sistema («APICCA · Mapa») y el de «P1» son provisionales. La línea E3 · Celda no tiene nombre nuevo.
- **E3 · Celda, abierto** (ver `celda.md`): rótulos de zona cuando las zonas se tocan; por dónde pasa el Arco entre zonas contiguas; orden de las paradas del Arco (vecino más cercano del 24-11-2026 frente a «el orden elegido» de RF-18, 18.2); tamaño de celda en teléfono bajo el tamaño de toque; textos propuestos («3 Ápices más», etc.).
- **Etapa**: si la regla de patrón queda como el código definitivo de la Etapa, y quién elige la regla.
- **Contorno**: si el contorno de 2 px de las superficies se queda en los dos temas.
- **Revisión pendiente**: daltonismo con simulador y lectura de rótulos de menos de 16 px.
- **Línea L**: la relación con «L · Desde el logo» (otra paleta y otros glifos). Por ahora son dos líneas abiertas.
- **Teléfono**: en este sistema no hay pantallas de teléfono todavía.
