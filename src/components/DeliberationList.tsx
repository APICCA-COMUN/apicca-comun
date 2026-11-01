// RF-9 (004) · 9.1–9.3; RF-16 (004) · 16.3; RF-17 (004) · 17.1: lista de comentarios de una deliberación (D-T13 (004)).
import { useState } from 'react';
import { todayInColombia } from '../../shared/domain/dates';
import { parseMarkdown } from '../../shared/domain/docs/markdown';
import { ApiClientError } from '../data/api';
import { DocBlocks } from './DocBlocks';

export interface DeliberationComment {
  id: string;
  text: string;
  authorUid: string;
  authorUsername: string;
  createdAt: number;
  editedAt?: number | null;
  version: number;
  archived: boolean;
  archivedBy?: string | null;
  archivedByUsername?: string | null;
  archivedAt?: number | null;
}

export interface DeliberationListProps {
  comments: readonly DeliberationComment[];
  isOpen: boolean;
  currentUid?: string;
  isFacilitator?: boolean;
  onEdit?(comment: DeliberationComment): void;
  onSaveEdit?(commentId: string, newText: string): void | Promise<unknown>;
  onArchive?(commentId: string): void;
}

export function DeliberationList({
  comments,
  isOpen,
  currentUid,
  isFacilitator = false,
  onEdit,
  onSaveEdit,
  onArchive,
}: DeliberationListProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canInlineEdit = Boolean(onSaveEdit);

  const startEdit = (comment: DeliberationComment) => {
    if (canInlineEdit) {
      setEditingId(comment.id);
      setEditText(comment.text);
      setEditError(null);
      setConfirmingId(null);
    }
    onEdit?.(comment);
  };

  const handleSaveEdit = async (commentId: string) => {
    setBusy(true);
    setEditError(null);
    try {
      await onSaveEdit?.(commentId, editText);
      setEditingId(null);
    } catch (caught) {
      // RF-17 (004) · 17.1: si guardar falla, muestra el motivo en español y conserva lo escrito.
      const message =
        caught instanceof ApiClientError
          ? caught.message
          : 'No se pudo guardar el comentario. Inténtalo de nuevo.';
      setEditError(message);
    } finally {
      setBusy(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
    setEditText('');
  };

  if (comments.length === 0) {
    return (
      <div className="block block-empty">
        <p>Todavía no hay comentarios en esta propuesta.</p>
      </div>
    );
  }

  return (
    <section className="lot lot-comments" aria-label="Deliberación">
      <ol className="lot">
        {comments.map((comment) => {
          if (comment.archived) {
            return (
              <li key={comment.id} className="block comment-item comment-archived" role="note">
                <p>Comentario archivado por {comment.archivedByUsername ?? 'quien facilita'}.</p>
              </li>
            );
          }

          let contentBlocks;
          try {
            contentBlocks = parseMarkdown(comment.text);
          } catch {
            contentBlocks = [{ type: 'paragraph' as const, children: [{ type: 'text' as const, text: comment.text }] }];
          }

          const canEdit = isOpen && currentUid === comment.authorUid;
          const canArchive = isOpen && (currentUid === comment.authorUid || isFacilitator);
          const isConfirming = confirmingId === comment.id;
          const isEditing = editingId === comment.id;

          return (
            <li key={comment.id} className="block comment-item">
              <header className="comment-header">
                <p className="comment-meta">
                  <strong>{comment.authorUsername}</strong>
                  {' · '}
                  <time dateTime={todayInColombia(new Date(comment.createdAt))}>
                    {todayInColombia(new Date(comment.createdAt))}
                  </time>
                  {comment.version > 1 && <span> (editado)</span>}
                </p>
              </header>

              {isEditing ? (
                <div className="comment-edit-form">
                  <textarea
                    aria-label="Texto del comentario"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={4}
                  />
                  {editError !== null && (
                    <p role="alert" className="comment-error">
                      {editError}
                    </p>
                  )}
                  <footer className="comment-actions">
                    <button
                      type="button"
                      className="block action-secondary"
                      disabled={busy}
                      onClick={() => void handleSaveEdit(comment.id)}
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      className="block action-secondary"
                      disabled={busy}
                      onClick={cancelEdit}
                    >
                      Cancelar
                    </button>
                  </footer>
                </div>
              ) : (
                <>
                  <div className="comment-content">
                    <DocBlocks blocks={contentBlocks} />
                  </div>

                  {(canEdit || canArchive) && (
                    <footer className="comment-actions">
                      {canEdit && !isConfirming && (
                        <button type="button" className="block action-secondary" onClick={() => startEdit(comment)}>
                          Editar
                        </button>
                      )}
                      {canArchive &&
                        (isConfirming ? (
                          <span className="comment-confirm-group">
                            <button
                              type="button"
                              className="block action-destructive"
                              onClick={() => {
                                onArchive?.(comment.id);
                                setConfirmingId(null);
                              }}
                            >
                              Confirmar archivo
                            </button>
                            <button type="button" className="block action-secondary" onClick={() => setConfirmingId(null)}>
                              Cancelar
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="block action-destructive"
                            onClick={() => setConfirmingId(comment.id)}
                          >
                            Archivar
                          </button>
                        ))}
                    </footer>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
