# E3 · Celda

Desde el 24-11-2026 el sitio aplica la línea **E3 · Celda** sobre el sistema «APICCA · Mapa» (`README.md` de esta carpeta). Este documento dice qué cambia, por qué y qué queda abierto. Los valores de color son los de `shared/domain/identity/tokens.ts`, que es la fuente de verdad; `tokens.json` los refleja.

## Quién dice qué

- La línea E3 · Celda la eligió MangleRojo ORG el 24-11-2026: naranja y amarillo «a tope» y el Arco como dibujo de una Acción Común.
- Lo que aquí va marcado como **Propuesta del asistente** es del asistente y no está aprobado.
- Lo que está en «Pendiente / por decidir» no está zanjado: son versiones abiertas, cada una con su origen.

## Qué cambia y por qué

El sistema «APICCA · Mapa» usaba colores apagados y piezas con caja. E3 · Celda busca que el mapa se lea solo: ejes de color plano y a tope, sin cajas ni tarjetas, y una Acción Común dibujada como una curva entre sus Ápices, en vez de una cadena de celdas. La leyenda deja de ser texto suelto y pasa a ser el control del mapa.

Cambios principales:

- Paleta: de la paleta apagada a cinco colores de eje planos e iguales en claro y oscuro.
- Mapa: la trama solo aparece dentro de las zonas; el filtro apaga el color en vez de quitar piezas.
- Elegir un Ápice lo amplía en la columna del mapa, con una línea de llamada.
- Las Acciones Comunes pasan de la cadena de celdas `ruta` al Arco.
- Salen las cajas, los bordes de cabecera y de panel, y los botones con borde o en caja.

## Paleta

Ejes, iguales en claro y oscuro:

| Eje | Color | Antes (claro) |
|---|---|---|
| agua | `#0096FF` | `#3E8FB3` |
| alimento | `#47C254` | `#86A150` |
| cobijo | `#FF8F00` | `#E0862E` |
| energía | `#FFD200` | `#F2CC3D` |
| comunicación | `#FF0000` | `#E5645C` |

Claro:

- papel `#FFFFFF` (antes `#F1EFE9`);
- tinta `#141414`;
- suave `#666666` (antes `#56534C`);
- trama `#D3D3D3` (antes `#C8C5BA`).

Oscuro:

- papel `#121212` (antes `#131312`);
- tinta `#FFFFFF` (antes `#F1EFE9`);
- suave `#B4B4B4` (antes `#B8B4AA`);
- trama `#343434` (antes `#3B3A36`).

El glifo sobre un eje va siempre en `#141414`, en los dos temas.

**Propuesta del asistente:** los valores oscuros de tinta y suave (`#FFFFFF` y `#B4B4B4`) los deduce el asistente de la lógica del sistema; no vienen de la decisión del 24-11-2026.

Contraste del glifo `#141414` sobre cada eje:

- agua 5,97:1;
- alimento 7,99:1;
- cobijo 8,05:1;
- energía 12,69:1;
- comunicación 4,61:1 (margen corto).

Sobre papel blanco, el color de eje casi no contrasta: el amarillo da 1,45:1 y el naranja 2,29:1. Por eso la celda lleva contorno de tinta; sin él no se separa del fondo.

Cifras que el asistente calculó y que no vienen de la decisión: el alimento da 2,30:1 y el agua 3,09:1 sobre papel blanco; la tinta sobre papel claro da 18,4:1 y la trama da 1,5:1 (decoración, nunca lleva significado solo).

## Las seis reglas

1. **El mapa flota.** La trama solo aparece dentro de las zonas. Fuera de ellas no hay teselado de fondo.
2. **Filtrar es apagar el color.** Lo que no pasa el filtro conserva su patrón y su lugar, en gris de trama. No desaparece nada en el mapa. (En la vista de lista sí se quitan filas.)
3. **La leyenda es el control.** Ejes, Etapa y nivel son celdas que se encienden y se apagan.
4. **Elegir es ampliar.** El Ápice elegido se dibuja en grande en la columna, unido a su celda por una línea de llamada: primero horizontal y luego a 60°, con un disco de 4 px y borde de papel. Al elegir, el resto se apaga. La línea de llamada aparece solo en escritorio (≥ 900 px).
5. **Cuatro piezas.** Celda, rótulo, filete y texto. Sin cajas ni tarjetas. La acción principal es un rótulo grande en tinta, la única mancha negra fuera del mapa.
6. **Las líneas son horizontales o a 60°,** excepto el Arco.

## El Arco

El Arco dibuja una Acción Común: une sus Ápices con una curva.

- Es una curva cuadrática de Ápice a Ápice.
- El orden de las paradas es por cercanía: vecino más cercano, empezando en el Ápice más lejano del centroide. Decisión de MangleRojo del 24-11-2026.
  - **Tensión:** el requisito RF-18 (18.2) habla de «el orden elegido». Hay que decidir cuál de los dos manda.
- La comba es de 0,16 o de 0,26, la que pise menos Ápices.
- El tramo se corta a 0,78 R de cada parada.
- El trazo es tinta, de grosor máximo entre 1,4 px y 1,8 · R/46 px, con un halo de papel de 5 px alrededor.
- En cada extremo va un disco de 4,5 · R/46 + 1 px.
- Cuando la Acción Común está apagada, el Arco va en trama y por debajo de los Ápices.
- El rótulo lleva el glifo del eje de 14 px y el nombre en mayúsculas, sin caja. No ocupa celdas.

Fuera del mapa, la pieza Arco son celdas pequeñas unidas por arcos. Desaparecen la cadena de celdas y el token `ruta`.

## Lo que sale

- El borde de la cabecera y el de la columna del panel.
- El borde de la ficha.
- El botón de contorno.
- «Entrar» en caja.
- Las dos leyendas sueltas: pasan a ser el control de la regla 3.
- La trama fuera de las zonas.
- La cadena de celdas `ruta` y el token `ruta`.

`tokens.json` marca `ruta` como retirada. Los trazos `stroke-border` (3 px) de la cabecera, el panel y la ficha quedan como referencia hasta que el código los retire.

## Pendiente / por decidir

- **Rótulos de zona cuando las zonas se tocan.** No hay regla todavía para cuando dos rótulos de zona quedan juntos.
- **Por dónde pasa el Arco entre zonas contiguas.** Hoy el Arco esquiva Ápices, pero no hay regla para cruzar la frontera entre dos zonas.
- **Orden de las paradas.** Vecino más cercano (decisión del 24-11-2026) frente a «el orden elegido» de RF-18 (18.2). Ver la tensión en «El Arco».
- **Tamaño de celda en teléfono.** Por debajo del tamaño mínimo de toque, la celda no sirve para tocar; falta decidir cómo se resuelve.
- **Textos propuestos.** Por ejemplo «3 Ápices más» para la celda con «+N». Son propuestas del asistente, no textos aprobados: los textos nuevos de la interfaz los decide la persona.
- **Nombre del sistema.** «APICCA · Mapa» sigue como nombre en `tokens.json` y en `README.md`; no hay nombre nuevo decidido.
