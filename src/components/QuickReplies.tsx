interface Props {
  options: string[];
  onPick: (text: string) => void;
  disabled?: boolean;
}

export function QuickReplies({ options, onPick, disabled }: Props) {
  if (!options.length) return null;
  return (
    <div className="vc-quick" role="group" aria-label="Suggested questions">
      {options.map((o) => (
        <button key={o} type="button" className="vc-chip" disabled={disabled} onClick={() => onPick(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}
