// Datos de la siembra que también lee el marco de pruebas (D-T13 (002)); sin dependencias de Node.

/** Nombre de 120 caracteres sin espacios, el límite de los títulos (RF-6 (002) · 6.7). */
export const LONG_NAME = 'Acueductocomunitario'.repeat(6);

/** Usuario de 24 caracteres, el máximo admitido. */
export const LONG_USERNAME = 'cuidadora_del_agua_comun';

/** Identificadores fijos de la siembra parcial. */
export const LONG_AUTHOR_UID = 'autora-larga';
export const LONG_APICE_ID = 'apice-nombre-largo';

// Siembra completa (T-8.1, D-T13 (002)): cuentas de los emuladores de Auth y los ápices de cada condición.

/** La autora de los ápices de la siembra completa y la facilitación; las contraseñas son solo de los emuladores. */
export const AUTHOR = { uid: 'autora-fija', email: 'autora@ejemplo.org', password: 'clave-de-prueba-1', name: 'Autora Fija', username: 'autora_fija' } as const;
export const FACILITATOR = { uid: 'facilitacion-fija', email: 'facilitacion@ejemplo.org', password: 'clave-de-prueba-2', name: 'Facilitación Fija', username: 'facilitacion_fija' } as const;

/** Un ápice por condición. Todos son de la autora, salvo los que reutiliza la siembra parcial. */
export const APICE_IDS = {
  /** Público, con imagen PNG de 64 × 64 y una referencia activa en Storage. */
  withImage: 'apice-con-imagen',
  /** Público, con los cinco ejes. */
  allAxes: 'apice-cinco-ejes',
  /** Privado. */
  private: 'apice-privado',
  /** Archivado. */
  archived: 'apice-archivado',
  /** Con una propuesta de imagen pendiente de la autora. */
  withProposal: 'apice-con-propuesta',
  /** Con una referencia retirada por la facilitación. */
  withRetractedReference: 'apice-referencia-retirada',
} as const;

/** La invitación pendiente de la facilitación. */
export const INVITED_EMAIL = 'invitada@ejemplo.org';

/** Id de la referencia activa de `withImage` y de la retirada de `withRetractedReference`. */
export const REFERENCE_IDS = { active: 'referencia-activa', retracted: 'referencia-retirada' } as const;

/** Textos de las condiciones, los mismos de la 001 (RF-13 (002) · 13.3). */
export const CONDITION_TEXTS = { private: 'privado', archived: 'archivado', status: 'prototipo', retracted: 'Retirada' } as const;

// Constitución común sembrada (T-11.2, RNF-4 (004), D-T18 (004)): abierta, con tres secciones, un documento y tres
// propuestas. Las ids son fijas para que las rutas de la matriz y de las capturas no cambien entre corridas.

/** Ids de la constitución sembrada; las tres propuestas son de `AUTHOR`. */
export const CONSTITUTION_IDS = {
  sections: { water: 'seccion-agua', care: 'seccion-cuidado', exchange: 'seccion-intercambio' },
  document: 'documento-cuidados',
  amendments: {
    /** Abierta: cambia el texto de `sections.water`. */
    openChange: 'propuesta-abierta-cambio',
    /** Abierta: añade una sección después de `sections.exchange`. */
    openAdd: 'propuesta-abierta-anadir',
    /** Cerrada y aprobada: cambió `sections.care` a su versión 2. */
    closed: 'propuesta-cerrada',
  },
} as const;

/** Títulos sembrados, para que las pruebas lean la página sin repetir los textos. */
export const CONSTITUTION_TITLES = {
  water: 'Agua compartida',
  care: 'Cuidado mutuo ampliado',
  exchange: 'Intercambio sin dinero',
  document: 'Guía de cuidados',
  openChange: 'Agua compartida con turnos',
  openAdd: 'Memoria de las cosechas',
  closed: 'Cuidado mutuo ampliado',
} as const;
