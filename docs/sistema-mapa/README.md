APICCA es la API para crear y conectar Acciones Comunes: apoyo mutuo, commoning y economías recíprocas no monetarias. «API» quiere decir piezas que se componen: cada **Ápice** declara qué ofrece y qué necesita, y una **Acción Común** los conecta. Este sistema es la versión **P1 · Mapa**. El mapa teselado es la pantalla, y **la regla de patrón dice la Etapa**.

## Quién dice qué

- Las *decisiones de la persona* (MangleRojo ORG, 23-11-2026) van en «Decidido».
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
- **Color plano y negro.** Paleta: agua `#3E8FB3`, alimento `#86A150`, cobijo `#E0862E`, energía `#F2CC3D`, comunicación `#E5645C`, negro `#141414` y hueso `#F1EFE9`. No hay manchas, brochazos, salpicaduras ni textura de tinta.
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
- Una **Acción Común** es una fila de celdas de `ruta`, cada una con el glifo de su eje en color, que une las celdas de los Ápices.

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
- `trama` es solo decoración: celdas vacías y divisores de 1,5 px.
- Los cinco `eje-*` son fondos de superficie, nunca color de texto. Sobre un eje, el glifo y su patrón van siempre en `glifo-sobre-eje` (`#141414`, de 5,1:1 a 11,8:1), en los dos temas.
- Los ejes casi no se distinguen por luminancia: agua, comunicación, alimento y cobijo están entre 0,24 y 0,33. Por eso el glifo siempre acompaña al color, y el color nunca va solo.

**Contorno de superficie (Propuesta del asistente)**
- Toda superficie de patrón lleva un contorno de `trazo-contorno` (2 px) en `contorno-superficie`.
- Sobre papel claro los ejes dan entre 1,4:1 (energía) y 3,2:1 (agua), y en tema oscuro el negro del patrón se funde con el fondo. El contorno los separa del fondo en los dos temas (16:1).
- Aplica a celdas, leyendas y filas. En la ficha, el borde de 3 px ya cumple esa función.

**Tema oscuro**
- `papel` y `tinta` se invierten. Los ejes no cambian.
- `ruta` pasa de `#141414` a `#3b3a36`: así el triángulo de energía y los demás glifos se leen sobre la celda (de 3,1:1 a 7,3:1).

**Tipo**
- Todo va en Jost (`font-jost`), en dos pesos dominantes: 800 para títulos, rótulos y botones, y 400–700 para el texto.
- Hay un `titulo-pantalla` por pantalla. Las fichas usan `titulo-ficha`.
- Los rótulos sobre el mapa van en `rotulo-mapa`:
  - zona: papel con texto en tinta;
  - Acción Común: tinta con texto en papel.

**Forma**
- Radio 0 en todo (`radio-0`).
- Sin sombras ni degradados.
- Los bordes son de tres grosores:
  - `trazo-borde` (3 px) para controles, fichas, la cabecera y los separadores de sección;
  - `trazo-zona` (4 px) para el borde de zona;
  - `trazo-divisor` (1,5 px) para la trama.

**Espacio**: pasos `espacio-1` a `espacio-7` (4, 8, 12, 16, 24, 32 y 48 px). Las alturas son fijas:
- controles: `alto-control`, 48 px;
- cabecera: `alto-cabecera`, 64 px;
- botón de ícono: `boton-icono`, 44 px.

**Estados**
- **Foco**: contorno de `trazo-foco` (3 px) en `tinta`, separado `foco-separacion` (3 px), en todo control (`:focus-visible`).
- **Botón secundario y selector**: al pasar el cursor, o al pulsarlos, se invierten a tinta llena (Propuesta del asistente).
- **Ápice elegido en el mapa**: doble anillo, de papel (5 px) y de tinta (7 px).

**Composición de Inicio (P1)**
- Cabecera de 64 px.
- Debajo, el `Mapa` ocupa el ancho menos un panel de `ancho-panel` (430 px), separado por un borde de 3 px.
- El panel lleva, en este orden:
  1. el título y la entradilla;
  2. «Prototipar un Ápice» y «Conectar»;
  3. la Leyenda de Etapa y la de ejes;
  4. la Ficha del Ápice elegido;
  5. la lista de Ápices en `FilaApice`.

## Mapa

- Las celdas son **hexágonos planos arriba**, como el teselado H3, y van en coordenadas axiales (q, r).
- Una **zona** son siete celdas (centro y anillo), con el borde exterior en `trazo-zona`.
- Si una zona tiene más Ápices de los que caben, su celda central muestra «+N» en tinta.
- Las celdas vacías se dibujan en `trama`: el teselado siempre se ve.
- Los rótulos van fuera de las celdas, nunca encima de un patrón.

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

## Por decidir

- **Nombres**: el nombre de este sistema («APICCA · Mapa») y el de «P1» son provisionales.
- **Etapa**: si la regla de patrón queda como el código definitivo de la Etapa, y quién elige la regla.
- **Contorno**: si el contorno de 2 px de las superficies se queda en los dos temas.
- **Revisión pendiente**: daltonismo con simulador y lectura de rótulos de menos de 16 px.
- **Línea L**: la relación con «L · Desde el logo» (otra paleta y otros glifos). Por ahora son dos líneas abiertas.
- **Teléfono**: en este sistema no hay pantallas de teléfono todavía.
