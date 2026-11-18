interface Props {
  open: boolean;
  onToggle: () => void;
}

export function Launcher({ open, onToggle }: Props) {
  return (
    <button
      type="button"
      className="vc-launcher"
      aria-label={open ? "Close support chat" : "Open support chat"}
      aria-expanded={open}
      onClick={onToggle}
    >
      {open ? (
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path
            d="M4 5h16v11H8l-4 4V5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
