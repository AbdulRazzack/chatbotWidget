import { useState, type FormEvent, type KeyboardEvent } from "react";

interface Props {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
}

const MAX_LENGTH = 2000;

export function Composer({ onSend, onStop, streaming, disabled }: Props) {
  const [text, setText] = useState("");

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || streaming || disabled) return;
    onSend(text);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter adds a new line.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form className="vc-composer" onSubmit={submit}>
      <label htmlFor="vc-input" className="vc-sr-only">
        Type your message
      </label>
      <textarea
        id="vc-input"
        rows={1}
        value={text}
        maxLength={MAX_LENGTH}
        placeholder={disabled ? "Connecting…" : "Type your message…"}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {streaming ? (
        <button type="button" className="vc-send" onClick={onStop} aria-label="Stop response">
          ■
        </button>
      ) : (
        <button type="submit" className="vc-send" disabled={!text.trim() || disabled} aria-label="Send message">
          ➤
        </button>
      )}
    </form>
  );
}
