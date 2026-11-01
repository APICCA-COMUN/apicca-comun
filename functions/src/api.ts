// Callable `api`: registro de las ops ligeras (D-T2 (001)). Cada op nueva se registra aquí.
import type { Ctx } from './context';
import { dispatch, type OpHandler } from './dispatch';
import { handleAcceptProposal } from './ops/acceptProposal';
import { handleArchiveApice } from './ops/archiveApice';
import { handleArchiveDocument } from './ops/archiveDocument';
import { handleCancelInvitation } from './ops/cancelInvitation';
import { handleCreateApice } from './ops/createApice';
import { handleDiscardProposal } from './ops/discardProposal';
import { handleEditApice } from './ops/editApice';
import { handleGenerationStatus } from './ops/generationStatus';
import { handleInspectInvitation } from './ops/inspectInvitation';
import { handleInvite } from './ops/invite';
import { handleOpenConstitution } from './ops/openConstitution';
import { handleRequestEnrollment } from './ops/requestEnrollment';
import { handleRegister } from './ops/register';
import { handleRestoreApice } from './ops/restoreApice';
import { handleRestoreDocument } from './ops/restoreDocument';
import { handleOpenAmendment } from './ops/openAmendment';
import { handleReviseAmendment } from './ops/reviseAmendment';
import { handleWithdrawAmendment } from './ops/withdrawAmendment';
import { handleCommentAmendment } from './ops/commentAmendment';
import { handleEditComment } from './ops/editComment';
import { handleArchiveComment } from './ops/archiveComment';
import { handleAgreeAmendment } from './ops/agreeAmendment';
import { handleRevokeAgreement } from './ops/revokeAgreement';
import { handleObjectAmendment } from './ops/objectAmendment';
import { handleResolveObjection } from './ops/resolveObjection';
import { handleWithdrawObjection } from './ops/withdrawObjection';
import { handleRestoreVersion } from './ops/restoreVersion';
import { handleMarkNoticesSeen } from './ops/markNoticesSeen';
import { handleOpenThread } from './ops/openThread';
import { handleReplyThread } from './ops/replyThread';
import { handleEditMessage } from './ops/editMessage';
import { handleArchiveThread } from './ops/archiveThread';
import { handleArchiveMessage } from './ops/archiveMessage';
import { handleReactivateAccount } from './ops/reactivateAccount';
import { handleRemoveReference } from './ops/removeReference';
import { handleRemoveSection } from './ops/removeSection';
import { handleReorderSections } from './ops/reorderSections';
import { handleResolveEnrollment } from './ops/resolveEnrollment';
import { handleRetractImage } from './ops/retractImage';
import { handleSaveDocument } from './ops/saveDocument';
import { handleSaveSection } from './ops/saveSection';
import { handleSetVisibility } from './ops/setVisibility';
import { handleSettleAmendments } from './ops/settleAmendments';
import { handleSuspendAccount } from './ops/suspendAccount';

export const API_OPS: Record<string, OpHandler> = {
  invite: handleInvite,
  cancelInvitation: handleCancelInvitation,
  inspectInvitation: handleInspectInvitation,
  requestEnrollment: handleRequestEnrollment,
  register: handleRegister,
  createApice: handleCreateApice,
  editApice: handleEditApice,
  restoreVersion: handleRestoreVersion,
  setVisibility: handleSetVisibility,
  archiveApice: handleArchiveApice,
  restoreApice: handleRestoreApice,
  resolveEnrollment: handleResolveEnrollment,
  suspendAccount: handleSuspendAccount,
  reactivateAccount: handleReactivateAccount,
  // Avisos (012): marcar como leídos.
  markNoticesSeen: handleMarkNoticesSeen,
  openThread: handleOpenThread,
  replyThread: handleReplyThread,
  editMessage: handleEditMessage,
  archiveThread: handleArchiveThread,
  archiveMessage: handleArchiveMessage,
  removeReference: handleRemoveReference,
  retractImage: handleRetractImage,
  generationStatus: handleGenerationStatus,
  acceptProposal: handleAcceptProposal,
  discardProposal: handleDiscardProposal,
  // Constitución común (004): secciones y apertura (T-4.8), documentos (T-5.5).
  saveSection: handleSaveSection,
  removeSection: handleRemoveSection,
  reorderSections: handleReorderSections,
  openConstitution: handleOpenConstitution,
  saveDocument: handleSaveDocument,
  archiveDocument: handleArchiveDocument,
  restoreDocument: handleRestoreDocument,
  // Constitución común (004): propuestas, deliberación y posturas (T-6.14).
  openAmendment: handleOpenAmendment,
  reviseAmendment: handleReviseAmendment,
  withdrawAmendment: handleWithdrawAmendment,
  commentAmendment: handleCommentAmendment,
  editComment: handleEditComment,
  archiveComment: handleArchiveComment,
  agreeAmendment: handleAgreeAmendment,
  revokeAgreement: handleRevokeAgreement,
  objectAmendment: handleObjectAmendment,
  resolveObjection: handleResolveObjection,
  withdrawObjection: handleWithdrawObjection,
  // Constitución común (004): reflejo del vencimiento al abrir una página (T-7.6).
  settleAmendments: handleSettleAmendments,
};

export function handleApi(ctx: Ctx, data: unknown, uid: string | null): Promise<unknown> {
  return dispatch(API_OPS, data, ctx, uid);
}
