# Pruebas de reglas de Firestore

Corren solo con `npm run test:emu` (dentro de `firebase emulators:exec --project demo-apicca`). `setup.ts` crea el entorno de `@firebase/rules-unit-testing` con `firestore.rules` en el proyecto de prueba `demo-apicca`; una prueba puede traer reglas propias en un proyecto aparte del emulador.

## Estado actual

`firestore.rules` y `storage.rules` solo contienen la denegación por defecto (RF-SEG-1, RF-SEG-2). Cada colección o ruta se abre por una spec aprobada en `docs/specs/`, con su bloque `match` (que cita su RF en la línea anterior) y su archivo de pruebas en `tests/rules/` o `tests/storage/`.

## Qué cuenta `string.size()`

Medido en el emulador de Firestore (septiembre de 2026, en otro proyecto Firebase): `string.size()` cuenta **unidades UTF-16**, no puntos de código ni bytes. Un emoji o cualquier carácter fuera del plano básico cuenta como 2. Si una spec fija límites de texto en puntos de código, las reglas solo pueden aplicar un techo holgado (`size() <= 4 × límite`) y la cuenta exacta la hace el dominio compartido en el cliente. Vuelve a medirlo en este repositorio antes de apoyarte en ello.

## Leer un documento que puede no existir

Un `get()` sobre un documento ausente dentro de una regla **tumba la condición entera** en vez de dar nulo. Pregunta primero con `exists()`:

```
function isActive() {
  return request.auth != null && exists(memberPath()) && get(memberPath()).data.status == 'active';
}
```

Cada acceso entre documentos (`get`, `exists`) cuenta contra el tope por evaluación, así que conviene poner la ruta en su propia función y dejar que `&&` y `||` corten antes de pagar la lectura.

## Un `setDoc` sobre un documento que existe es `update`, no `create`

Para probar la rama `create` de una regla hay que borrar antes el documento con las reglas desactivadas (`env.withSecurityRulesDisabled`).

## Storage

Las reglas de Storage del emulador son globales (un solo juego por archivo de prueba) y `env.clearStorage()` del SDK solo vacía la raíz; usa `clearStorage(env)` de `tests/storage/setup.ts`.
