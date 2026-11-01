// Dobles en memoria de las fuentes de la constitución común (spec 004) para montar la `App` real sin red
// (RF-17 (003) · 17.3, D-T21 (003)). Una constitución abierta con una sección `ejemplo`, sin documentos ni propuestas.
import type { ConstitutionState, Section } from '../../shared/domain/constitution/types';
import type { AmendmentsSource } from '../data/constitution/amendments';
import type { DocumentsSource } from '../data/constitution/documents';
import type { NoticeSource } from '../data/constitution/notice';
import type { SectionsSource } from '../data/constitution/sections';

const AT = Date.parse('2026-09-03T15:00:00Z');
const none = () => undefined;

const section: Section = {
  id: 'ejemplo',
  title: 'Cuidado mutuo',
  text: 'Nos cuidamos entre todas las personas.',
  updatedAt: AT,
  isRetired: false,
  retiredAt: null,
};

const state: ConstitutionState = { isOpen: true, openedAt: AT, order: ['ejemplo'], updatedAt: AT, logSeq: 1 };

export const sectionsDouble: SectionsSource = {
  onState: (callback) => (callback(state), none),
  onSections: (_audience, callback) => (callback([section]), none),
  onMeta: (audience, _id, callback) => (
    callback(audience === 'visitor' ? null : { version: 1, proposedByUid: 'fab', proposedByUsername: 'fabi', openAmendment: null }),
    none
  ),
  onVersions: (_audience, _id, callback) => (callback([]), none),
  onLog: (_audience, callback) => (callback([]), none),
};

export const documentsDouble: DocumentsSource = {
  fetchPage: async () => ({ items: [], cursor: null }),
  onDocument: (_id, callback) => (callback(null), none),
  onVersions: (_id, callback) => (callback([]), none),
};

export const amendmentsDouble: AmendmentsSource = {
  onOpen: (callback) => (callback([]), none),
  fetchClosedPage: async () => ({ items: [], cursor: null }),
  onAmendment: (_id, callback) => (callback(null), none),
  onRevisions: (_id, callback) => (callback([]), none),
  onComments: (_id, callback) => (callback([]), none),
  onStances: (_id, callback) => (callback([]), none),
  onObjections: (_id, callback) => (callback([]), none),
};

export const noticeDouble: NoticeSource = {
  fetchNotice: async () => ({ count: 0, nextCloseAt: null }),
};
