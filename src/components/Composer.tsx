import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { ATTACHMENT_RULES, checkFiles, type PendingFile } from "../config/attachments";

interface Props {
  onSend: (text: string, files: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
  allowAttachments?: boolean;
}

const MAX_LENGTH = 2000;
const uid = () => Math.random().toString(36).slice(2, 10);

export function Composer({ onSend, disabled, placeholder = "Type your message…", allowAttachments = false }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Free preview URLs for files removed before sending.
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.url)), []);

  const addFiles = (incoming: File[]) => {
    if (!allowAttachments || !incoming.length) return;
    const { ok, errors } = checkFiles(incoming, files.length);
    setErrors(errors);
    if (ok.length) {
      setFiles((prev) => [...prev, ...ok.map((file) => ({ id: uid(), file, url: URL.createObjectURL(file) }))]);
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const gone = prev.find((f) => f.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((f) => f.id !== id);
    });
    setErrors([]);
  };

  const canSend = !disabled && (text.trim().length > 0 || files.length > 0);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;
    // The object URLs now belong to the sent message (shown in the chat), so they aren't revoked here.
    onSend(text, files.map((f) => f.file));
    setText("");
    setFiles([]);
    setErrors([]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter adds a new line.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  // Pasting a screenshot (Ctrl/Cmd + V) attaches it.
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = Array.from(e.clipboardData.files ?? []);
    if (allowAttachments && pasted.length) {
      e.preventDefault();
      addFiles(pasted.map((f, i) => (f.name && f.name !== "image.png" ? f : new File([f], `screenshot-${i + 1}.png`, { type: f.type }))));
    }
  };

  const dragProps = allowAttachments
    ? {
        onDragOver: (e: DragEvent) => {
          e.preventDefault();
          setDragging(true);
        },
        onDragLeave: () => setDragging(false),
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          setDragging(false);
          addFiles(Array.from(e.dataTransfer.files));
        },
      }
    : {};

  return (
    <div className={`vc-composer-wrap${dragging ? " vc-dragging" : ""}`} {...dragProps}>
      {allowAttachments && (files.length > 0 || errors.length > 0) && (
        <div className="vc-attach-tray">
          {files.length > 0 && (
            <ul className="vc-previews" aria-label="Attached images">
              {files.map((f) => (
                <li key={f.id} className="vc-preview">
                  <img src={f.url} alt="" />
                  <span className="vc-preview-name" title={f.file.name}>
                    {f.file.name}
                  </span>
                  <button type="button" className="vc-preview-remove" onClick={() => removeFile(f.id)} aria-label={`Remove ${f.file.name}`}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          {files.length > 0 && <p className="vc-hint">{ATTACHMENT_RULES.notice}</p>}
          {errors.map((err) => (
            <p key={err} className="vc-field-error" role="alert">
              {err}
            </p>
          ))}
        </div>
      )}

      <form className="vc-composer" onSubmit={submit}>
        {allowAttachments && (
          <>
            <button
              type="button"
              className="vc-attach-btn"
              onClick={() => fileInput.current?.click()}
              disabled={disabled || files.length >= ATTACHMENT_RULES.maxFiles}
              aria-label="Attach a screenshot"
              title={`Attach a screenshot (${ATTACHMENT_RULES.notice})`}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path
                  d="M21 11.5l-8.6 8.6a5 5 0 01-7.1-7.1l8.6-8.6a3.3 3.3 0 014.7 4.7l-8.6 8.6a1.7 1.7 0 01-2.4-2.4l7.9-7.9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={ATTACHMENT_RULES.accept}
              multiple
              hidden
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = ""; // allow picking the same file again
              }}
            />
          </>
        )}
        <label htmlFor="vc-input" className="vc-sr-only">
          Type your message
        </label>
        <textarea
          id="vc-input"
          rows={1}
          value={text}
          maxLength={MAX_LENGTH}
          placeholder={files.length ? "Add a message (optional)…" : placeholder}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />
        <button type="submit" className="vc-send" disabled={!canSend} aria-label="Send message">
          ➤
        </button>
      </form>
    </div>
  );
}
