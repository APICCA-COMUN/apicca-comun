// Códigos de error tipificados de las ops y su mensaje en español con tildes (RNF-1 (001)).
// El servidor devuelve el código y la interfaz muestra el mensaje: nadie escribe el texto
// de un error en otro lugar. Cada hito agrega aquí los códigos de sus ops.

export const MESSAGES = {
  // Puerta común de las ops (D-T2 (001), RNF-5 (001)).
  'invalid-request': 'La solicitud no tiene la forma esperada.',
  'unknown-op': 'Esa operación no existe.',
  'payload-too-large': 'La solicitud es demasiado grande.',
  // Acceso (RF-5 (001)).
  unauthenticated: 'Inicia sesión para continuar.',
  'account-suspended': 'Tu cuenta está suspendida. Escribe a quien facilita el espacio para retomarla.',
  forbidden: 'No tienes permiso para hacer esto.',
  // Invitaciones (RF-1 (001), RF-2 (001)).
  'account-exists': 'Ese correo ya tiene una cuenta.',
  'invitation-not-found': 'Este enlace de invitación no es válido.',
  'invitation-expired': 'Este enlace de invitación venció. Pide que te envíen uno nuevo.',
  'invitation-cancelled': 'Esta invitación fue anulada. Pide que te envíen una nueva.',
  'invitation-used': 'Esta invitación ya se usó. Si es tu cuenta, inicia sesión.',
  'invitation-not-cancellable': 'Una invitación ya aceptada no se puede anular.',
  // Registro (RF-2 (001)).
  'password-too-short': 'La contraseña debe tener al menos 8 caracteres.',
  'name-invalid': 'El nombre debe tener entre 1 y 80 caracteres.',
  'username-invalid': 'El nombre de usuario debe tener de 3 a 24 caracteres: letras sin tilde, números o guion bajo, con al menos una letra.',
  'username-taken': 'Ese nombre de usuario ya está en uso.',
  'username-reserved': 'Ese nombre de usuario está reservado.',
  // Solicitudes de inscripción (RF-4 (001)).
  'email-invalid': 'Escribe un correo electrónico válido.',
  'message-too-long': 'El mensaje admite hasta 2.000 caracteres.',
  'consent-required': 'Para enviar la solicitud debes aceptar el tratamiento de datos.',
  'rate-limited': 'Hiciste demasiados intentos. Vuelve a intentarlo más tarde.',
  'reason-required': 'Escribe el motivo del descarte.',
  // Suspensión (RF-5 (001)).
  'cannot-suspend-facilitator': 'No se puede suspender a otra persona que facilita.',
  'cannot-suspend-self': 'No puedes suspender tu propia cuenta.',
  // Ficha del ápice (RF-6 (001), RF-7 (001)).
  'field-required': 'Falta un dato obligatorio de la ficha.',
  'text-too-long': 'Un texto de la ficha excede su límite.',
  'control-characters': 'El texto contiene caracteres de control que no se admiten.',
  'axes-duplicated': 'Los ejes no pueden repetirse.',
  'axis-unknown': 'Uno de los ejes elegidos no existe.',
  // Ubicación (RF-9 (001)).
  'coordinates-invalid': 'Las coordenadas no existen o están fuera de rango: la latitud va de −90 a 90 y la longitud de −180 a 180.',
  // Referencias (RF-15 (001), RF-16 (001)).
  'image-too-large': 'La imagen supera los 5 MB o está vacía.',
  'image-type-unsupported': 'La imagen debe ser JPG, PNG o WebP.',
  'image-dimensions-exceeded': 'La imagen excede los 4096 × 4096 píxeles.',
  'image-unreadable': 'No se pudo leer el archivo como imagen estática.',
  'references-full': 'El ápice ya tiene el máximo de 5 referencias.',
  'alt-text-required': 'Escribe un texto alternativo que describa la imagen.',
  'alt-text-too-long': 'El texto alternativo admite hasta 200 caracteres.',
  'image-missing': 'Elige una imagen para subir.',
  'reference-not-found': 'La referencia no existe.',
  'retract-reason-required': 'Escribe el motivo del retiro.',
  // Edición (RF-10 (001), RF-14 (001)).
  'apice-archived': 'El ápice está archivado y no se puede modificar.',
  'image-animated': 'La imagen es animada: sube una imagen estática.',
  // Generación de imagen (RF-17 (001), RF-18 (001), RF-19 (001), RF-20 (001)).
  'generation-in-progress': 'Ya tienes una generación en curso. Espera a que termine.',
  'generation-limit-reached': 'Ya usaste tus 3 generaciones de hoy.',
  'generation-global-limit': 'Hoy se alcanzó el máximo de generaciones del espacio. Vuelve a intentarlo mañana.',
  'generation-blocked': 'Hubo varias fallas seguidas. Espera unos minutos para volver a intentarlo.',
  'generation-failed': 'No se pudo generar la imagen. Puedes reintentar; esta petición no cuenta.',
  'generation-timeout': 'El modelo tardó demasiado en responder. Puedes reintentar; esta petición no cuenta.',
  'generation-empty': 'El modelo no devolvió una imagen utilizable. Puedes reintentar; esta petición no cuenta.',
  'generation-rejected': 'El modelo rechazó la descripción o las referencias. Ajusta el texto o las imágenes y reintenta.',
  'generation-unavailable': 'La generación de imágenes no está disponible por ahora. Lo demás sigue funcionando.',
  'proposal-not-found': 'No hay una propuesta pendiente.',
  'proposal-expired': 'La propuesta caducó. Genera una nueva.',
  'proposal-stale': 'El ápice cambió desde que se generó la propuesta. Confirma si quieres aceptarla de todos modos.',
  // Constitución y propuestas de cambio (RF-1 (004), RF-4 (004), RF-6 (004), RF-8 (004), RF-10 (004), RF-11 (004),
  // RF-12 (004), RF-16 (004)).
  'constitution-open': 'La constitución ya está abierta: sus secciones solo cambian por una propuesta aprobada.',
  'constitution-not-open': 'La constitución todavía no está abierta: las propuestas llegan con la apertura.',
  'constitution-already-open': 'La constitución ya se abrió y no se puede volver a abrir ni cerrar.',
  'section-not-found': 'Esa sección no existe.',
  'section-retired': 'Esa sección ya no está vigente.',
  'amendment-not-found': 'Esa propuesta no existe.',
  'comment-not-found': 'Ese comentario no existe.',
  'amendment-closed': 'La propuesta ya cerró: no admite acuerdos, objeciones, revisiones ni comentarios.',
  'amendment-unchanged': 'La propuesta deja la sección igual a la vigente. Cambia el título o el texto.',
  'amendment-limit': 'Se alcanzó el máximo de 100 propuestas abiertas a la vez. Espera a que cierre alguna.',
  'not-amendment-author': 'Solo quien abrió la propuesta puede revisarla o retirarla.',
  'own-amendment': 'Tu acuerdo con tu propia propuesta ya cuenta: no puedes acordarla ni objetarla.',
  'agree-with-objection': 'Tienes una objeción abierta: retírala o dala por resuelta antes de acordar.',
  'object-with-agreement': 'Tienes un acuerdo vigente: revócalo antes de objetar.',
  'objection-already-open': 'Ya tienes una objeción abierta en esta propuesta.',
  // Foro (RF-3 (009), RF-4 (009), RF-5 (009), RF-6 (009)).
  'thread-not-found': 'Ese hilo no existe.',
  'thread-archived': 'Ese hilo está archivado: ya no admite respuestas.',
  'message-not-found': 'Ese mensaje no existe.',
  'text-empty': 'Falta un texto obligatorio: no puede quedar vacío ni con solo espacios.',
} as const;

export type ErrorCode = keyof typeof MESSAGES;

export const ERROR_CODES = Object.keys(MESSAGES) as ErrorCode[];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(MESSAGES, value);
}

export function messageFor(code: ErrorCode): string {
  return MESSAGES[code];
}
