/**
 * Attachment rules. Kept deliberately narrow: VETTING's integration spec says ID documents,
 * certificates and criminal-record details must go through the secure upload process in the
 * portal, never through chat. Chat attachments are for screenshots of a problem.
 */
export const ATTACHMENT_RULES = {
  /** MIME types accepted. Copilot Studio can read PNG, JPEG, WEBP and non-animated GIF. */
  acceptedTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  /** Value for the file input's `accept` attribute. */
  accept: ".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif",
  maxFiles: 3,
  maxBytes: 5 * 1024 * 1024,
  notice: "Screenshots only. Please don't upload ID documents, certificates or criminal-record information.",
};

export interface PendingFile {
  id: string;
  file: File;
  /** Object URL used for the preview and, when sending, by the Direct Line uploader. */
  url: string;
}

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

/** Splits files into ones we accept and human-readable reasons for the ones we don't. */
export function checkFiles(incoming: File[], alreadySelected: number): { ok: File[]; errors: string[] } {
  const ok: File[] = [];
  const errors: string[] = [];
  for (const f of incoming) {
    if (!ATTACHMENT_RULES.acceptedTypes.includes(f.type)) {
      errors.push(`${f.name || "That file"}: only images (PNG, JPG, WEBP, GIF) can be attached.`);
    } else if (f.size > ATTACHMENT_RULES.maxBytes) {
      errors.push(`${f.name}: ${formatSize(f.size)} is too large (max ${formatSize(ATTACHMENT_RULES.maxBytes)}).`);
    } else if (alreadySelected + ok.length >= ATTACHMENT_RULES.maxFiles) {
      errors.push(`You can attach up to ${ATTACHMENT_RULES.maxFiles} images per message.`);
      break;
    } else {
      ok.push(f);
    }
  }
  return { ok, errors };
}
