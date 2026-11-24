# AGENTS.md

APICCA COMÚN: **API para Crear y Conectar Acciones Comunes**. No es una API literal: es un marco para que varias personas se encuentren y co-creen.

## Dominio
- **Ápice:** módulo principal. Conecta cinco ejes de autonomía compartida: agua, alimento, cobijo, energía y comunicación.
- **Acción Común:** base del apoyo mutuo. Evoca las acciones de bolsa, pero es una acción real a favor del bien común.
- **Marco:** apoyo mutuo, commoning y economías recíprocas no monetarias.
- **Web:** mecánicas de juego de granja sin el cliché estadounidense o europeo; conexiones entre personas al estilo del Social Strand System (Death Stranding). Estética del sistema «APICCA · Mapa» (`docs/sistema-mapa/README.md`, 23-11-2026): papel y tinta, Jost autoalojada, bordes de 3 px, radio 0, sin sombras; cada Ápice se muestra como una superficie de patrón (franjas por eje, regla por Etapa: tresbolillo, encaje, eco; `shared/domain/identity/pattern.ts`, `src/components/Superficie.tsx` y `Glifo.tsx`), sin imagen ni generación de imágenes. El mapa de Ápices es propio y teselado con H3 (`h3-js` en el cliente solo en `shared/domain/h3cells.ts`, cargado de forma diferida): cada zona es una celda de resolución 7 con sus siete celdas de resolución 8, en tres niveles (8, 6 y 4); Leaflet queda solo en el selector de ubicación. El sitio comienza en el mapa (`/`, composición P1): cabecera de 64 px con Ápices · Acciones Comunes · Documentación · Constitución · Foro, el mapa a lo ancho y un panel de 430 px a la derecha (título, «Prototipar un Ápice», «Conectar», contador, filtros, leyendas y filas de Ápices); la ficha, «Prototipar un Ápice» y «Editar» ocupan el panel (`/apices/:id`, `/apices/nuevo`, `/apices/:id/editar`); `/prototipado` y `/tablero` llevan al mapa. Cada Acción Común une de 3 a 10 Ápices y se dibuja como una fila de celdas de `ruta` con el glifo de su eje (`gridPathCells`): su panel es `/acciones/:id`, su lista `/acciones` y «Conectar» `/acciones/nueva`; las operaciones están en `functions/src/ops` y el cliente solo lee. Primer contacto: en la primera visita, una invitación con un recorrido de tres pasos (`localStorage`, `apicca:bienvenida`); sin sesión, «Prototipar un Ápice» abre un boceto local en `/boceto` (`sessionStorage`, nunca llega al servidor). Foro con hilos por eje, lectura pública y moderación de Facilitación (spec 009). Spec 008: fidelidad a los lienzos del sistema de diseño (controles de 48 px, foco de 3 px, estructura y textos de cada página, columnas de lectura de 1040 y 800 px). Spec 012: campana de avisos (cambios en mis ápices y propuestas de la constitución), hoy en la barra del mapa. Spec 013: operación mínima (respaldo diario de Firestore y Storage, alertas de gasto y de errores, registro de despliegues, runbook y CI). Spec 014: dependencias al día (auditoría en la CI con excepciones registradas, Dependabot semanal, versiones mayores de una en una). Spec 015: el pie de las páginas de texto y el menú de juego muestran solo «Apoyado por» y el logo oficial de MangleRojo sin lema, enlazado a su sitio. Spec 019, «Terreno vivo» (fase 1, Sistema): todo tamaño de texto sale de la escala y todo radio es `var(--radius-*)` o 0; diálogos nativos con velo; formularios con etiquetas encima y grupos como lotes; «Etapa» con mayúscula inicial; los colores de eje solo en ejes y ápices; el pie al fondo. Diseño práctico y escalable.

## Reglas
Desde el 23-11-2026 no se usa el flujo SDD en APICCA: no se abren specs ni se exigen.

1. Lee `docs/constitution.md` antes de cambiar nada. Sus 7 principios mandan sobre todo lo demás.
2. Flujo SDD: spec en `docs/specs/` → aprobación de la persona → pruebas en rojo → código → `npm run verify`. Sin spec aprobada no se programa.
3. Si algo contradice la constitución o la spec, dilo y pregunta. No lo esquives.
4. Cambios mínimos. Ninguna dependencia nueva sin spec.
5. La base técnica viene de `~/Desarollo/neta/app`. No copies de allí secretos (`.env*`), marca ni dominio.
6. Commits y despliegues, solo cuando la persona los pide.

## Specs (EARS)
- Una carpeta por funcionalidad: `docs/specs/NNN-nombre/` con `spec.md` (qué y por qué), `decisions.md`, `plan.md` y `tasks.md` (cómo, tras aprobar la spec).
- Requisitos `RF-n` y `RNF-n`; un número no se reutiliza. Decisiones `D-n` (de la persona) y `D-Tn` (técnicas).
- EARS: prosa en español, palabras clave en inglés (`WHEN`, `WHILE`, `IF`/`THEN`, `WHERE`, `SHALL`). Un requisito por frase, verificable, con sujeto nombrado; dice qué, no cómo. Ejemplo: WHEN una persona propone una Acción Común, el ápice SHALL registrar su autoría y la fecha.
- Trazabilidad: toda cita lleva la spec, `RF-9 (001)`, `D-T7 (001)`. Los nombres de las pruebas empiezan por el requisito que cubren; las cabeceras de `src/pages`, `src/components` y `functions/src/ops`, y cada `match` de las reglas que concede acceso, también citan. `npm run rf-coverage` lo exige; los requisitos solo manuales van en `pending` de `scripts/rf-coverage.json`.
- Al terminar una tarea, márcala en `tasks.md`. Si el código se aparta de la spec, se actualizan juntos.

## Estructura
- `src/`: interfaz en React. Solo renderiza y delega.
- `src/data/`: acceso a Firebase y a las callables.
- `src/data/constitution/`: lectura de secciones, documentos, propuestas y aviso de la constitución común.
- `shared/domain/`: dominio puro, sin React ni DOM; se prueba sin navegador.
- `shared/domain/constitution/`: tipos, límites, validadores y consultas de la constitución común (spec 004).
- `shared/domain/forum/`: límites, validadores, orden, filtro y consultas del foro (spec 009).
- `shared/domain/docs/`: convertidor de Markdown propio, índice de la documentación y lectura de la constitución.
- `docs/documentacion/`: artículos de la documentación del sitio (`NN-slug.md`) y su `indice.json`.
- Dependencias de ejecución del sitio: `firebase`, `h3-js` (4.5.0, solo en `shared/domain/h3cells.ts`), `leaflet`, `react` y `react-dom`.
- `functions/src/`: Cloud Functions (`api`, `storageSweep`, `amendmentCloser`, `firestoreBackup`); una operación por archivo en `ops/`.
- `firestore.rules`, `storage.rules`, `firestore.indexes.json` (generado con `npm run gen-indexes`).
- `tests/rules`, `tests/storage`: reglas contra emuladores.
- `docs/constitution.md`, `docs/specs/`: principios y contratos.
- `docs/specs/`, `docs/constitution.md`, `docs/operacion.md` y `docs/despliegues.md` son internos: están en `.gitignore` y no viajan en el repo público (`APICCA-COMUN/apicca-comun`). Solo `docs/documentacion/` se publica, porque el sitio la compila. `rf-coverage` y las pruebas que leen esos archivos corren en local; en la CI se saltan (RF-8 (013) v0.5).
- `docs/operacion.md` (runbook) y `docs/despliegues.md` (qué está publicado); `.github/workflows/ci.yml`: CI reducida (spec 013). `.github/dependabot.yml` y `scripts/audit-exceptions.json`: dependencias (spec 014).

## Comandos
- `npm run dev`: servidor local. `npm run dev:emu`: con emuladores.
- `npm run build`: compilar a `dist/`.
- `npm run check`: tipos. `npm test`: unidad (`unit-node`, `unit-dom`).
- `npm run test:emu`: pruebas de emulador (`*.emu.test.ts`, reglas).
- `npm run test:browser`: pruebas en navegador (Chromium) y capturas. Requiere `npx playwright install chromium` y Java (el de los emuladores). Camino reducido para colaborar: `npm test` no necesita Chromium ni Java, y `npm run test:browser` puede correrse solo.
- `npm run test:emu:par`, `npm run test:browser:par` y `npm run verify:par`: lo mismo en el carril paralelo de emuladores (`firebase.paralelo.json`, `VITE_EMULATOR_LANE=par`), para no chocar con otra tanda que use los puertos de `firebase.json`.
- `npm run verify`: todo lo anterior más `rf-coverage`. Debe quedar verde antes de cada commit.
- Desde `functions/`, `npm run recalculate-zones -- --project <proyecto>`: calcula la zona H3 de los ápices que ya tenían ubicación (spec 021, D-T15). Sin `--apply` solo cuenta lo que cambiaría; en producción lo corre la persona.
- `npm run demo`: emuladores de `demo-apicca` (con Functions) sembrados con datos de demostración, y el sitio en local (spec 022). Cinco cuentas ficticias, todas con la contraseña `demo-apicca`: `ana_agua@demo.apicca` (facilitación), `beto_huerta@`, `carla_techo@`, `dario_sol@` y `eli_radio@demo.apicca`. Nunca toca `apicca-com`; los datos se pierden al cerrar. El demo usa los mismos puertos y el mismo proyecto que `test:emu`, `test:browser` y `verify`, así que no se corren a la vez; con el demo abierto se usa `verify:par`. La siembra está en `functions/scripts/seed-demo.ts` y la sal local del emulador, en `functions/.secret.local` (fuera de git).
- `npm run audit-deps`: auditoría de las dependencias de producción contra las excepciones registradas (spec 014). Necesita red, así que corre en la CI y no en `verify`.
- Usa la CLI local, `npx firebase …`; la global de esta máquina no arranca.

## Entorno real
- Proyecto `apicca-com`; sitio de hosting `apicca`.
- Node 24 en la máquina local, en la CI y en el runtime de las functions (RF-5 (014)).
- Firestore: base `(default)` (`nam5`); la base nombrada `apicca` se borró el 10 de octubre de 2026 (spec 006). Functions en `us-central1`. Storage: bucket `apicca-com.firebasestorage.app` en `us-east1`.
- Secretos de Functions: `IP_HASH_SALT`. La generación de imágenes se retiró (RF-27 (021)); el retiro de `OPENROUTER_API_KEY` y de la función `media` en producción está en `docs/operacion.md`.
- Canal de prueba: `npm run build && npx firebase hosting:channel:deploy preview --only apicca --project apicca-com --expires 7d` → `https://apicca--preview-1wnxpjee.web.app` (el sufijo cambió el 3 de noviembre de 2026; la URL vigente la imprime el comando).
- Producción: siempre con `--only` y por partes (`hosting:apicca`, `functions`, `firestore:rules`, `firestore:indexes`, `storage`). Antes, la persona confirma el objetivo.
- Si cambian `functions/`, las reglas o los índices, despliégalos aparte; publicar solo el hosting no los actualiza.
- Cada despliegue suma una fila en `docs/despliegues.md` (RF-6 (013)); los procedimientos están en `docs/operacion.md`.
- Respaldos en `gs://apicca-com-respaldos` (spec 013). `gcloud` puede apuntar a otro proyecto: usa siempre `--project apicca-com`.
- La plantilla del correo de restablecer contraseña (RF-12 (002)) se aplica y se comprueba aparte: desde `functions/`, `npm run apply-auth-templates -- --project apicca-com` (más `--with-body` si Firebase Auth admite cambiar el cuerpo) y después el mismo comando con `--check`. Hoy Firebase bloquea los cambios de la plantilla y se usa la predeterminada en español (D-23 (002)).

## Convenciones
- Docs, mensajes y comentarios en español latino, con tildes completas.
- Identificadores en inglés, salvo términos del dominio (`apice`, `hebra`).
- Commits en español, estilo `tipo: descripción` (`feat`, `fix`, `test`, `docs`, `chore`).
