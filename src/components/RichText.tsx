import { Fragment, type ReactNode } from "react";

/**
 * Very small, SAFE markdown renderer for agent replies: **bold**, [links](https://…) and line breaks.
 * Builds React nodes only (no innerHTML), so agent output can never inject HTML or scripts.
 * Copilot Studio citation markers like [1] are left as plain text.
 */
const TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\((https:\/\/[^\s)]+)\))/g;

function renderLine(line: string, key: number): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(line.slice(last, idx));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(<strong key={idx}>{tok.slice(2, -2)}</strong>);
    } else {
      const label = tok.slice(1, tok.indexOf("]"));
      parts.push(
        <a key={idx} href={m[2]} target="_blank" rel="noopener noreferrer">
          {label}
        </a>,
      );
    }
    last = idx + tok.length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return <Fragment key={key}>{parts}</Fragment>;
}

export function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((l, i) => (
        <Fragment key={i}>
          {renderLine(l, i)}
          {i < lines.length - 1 && <br />}
        </Fragment>
      ))}
    </>
  );
}
