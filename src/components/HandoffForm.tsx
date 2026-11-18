import { useState, type FormEvent } from "react";
import type { VisitorType } from "../types";

export interface HandoffValues {
  name: string;
  email: string;
  issue: string;
  visitorType?: VisitorType;
}

interface Props {
  askVisitorType: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: HandoffValues) => void;
  onCancel: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function HandoffForm({ askVisitorType, submitting, error, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<HandoffValues>({ name: "", email: "", issue: "" });
  const [touched, setTouched] = useState(false);

  const set = <K extends keyof HandoffValues>(k: K, v: HandoffValues[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const invalid = {
    name: !values.name.trim(),
    email: !EMAIL_RE.test(values.email),
    issue: values.issue.trim().length < 10,
    visitorType: askVisitorType && !values.visitorType,
  };
  const hasErrors = Object.values(invalid).some(Boolean);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!hasErrors) onSubmit(values);
  };

  return (
    <form className="vc-handoff" onSubmit={submit} noValidate aria-labelledby="vc-handoff-title">
      <h3 id="vc-handoff-title">Contact our support team</h3>
      <p className="vc-hint">
        We'll log your request and a member of the team will follow up by email. Please don't include passwords,
        passport images or criminal-record details.
      </p>

      {askVisitorType && (
        <fieldset>
          <legend>I am a…</legend>
          <div className="vc-radios">
            {(["candidate", "client", "referee"] as VisitorType[]).map((t) => (
              <label key={t}>
                <input
                  type="radio"
                  name="vc-visitor-type"
                  value={t}
                  checked={values.visitorType === t}
                  onChange={() => set("visitorType", t)}
                />
                {t[0].toUpperCase() + t.slice(1)}
              </label>
            ))}
          </div>
          {touched && invalid.visitorType && <span className="vc-field-error">Please choose one</span>}
        </fieldset>
      )}

      <label>
        Name
        <input value={values.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
        {touched && invalid.name && <span className="vc-field-error">Please enter your name</span>}
      </label>

      <label>
        Email
        <input
          type="email"
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          autoComplete="email"
        />
        {touched && invalid.email && <span className="vc-field-error">Please enter a valid email</span>}
      </label>

      <label>
        How can we help?
        <textarea rows={4} maxLength={2000} value={values.issue} onChange={(e) => set("issue", e.target.value)} />
        {touched && invalid.issue && (
          <span className="vc-field-error">Please describe the issue (at least 10 characters)</span>
        )}
      </label>

      {error && (
        <p className="vc-error" role="alert">
          {error}
        </p>
      )}

      <div className="vc-actions">
        <button type="button" className="vc-btn vc-btn--ghost" onClick={onCancel} disabled={submitting}>
          Back to chat
        </button>
        <button type="submit" className="vc-btn" disabled={submitting}>
          {submitting ? "Sending…" : "Send to support"}
        </button>
      </div>
    </form>
  );
}
