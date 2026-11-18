interface Props {
  ticketRef: string;
  onDone: () => void;
}

export function TicketConfirmation({ ticketRef, onDone }: Props) {
  return (
    <div className="vc-confirm" role="status">
      <div className="vc-confirm-icon" aria-hidden="true">
        ✓
      </div>
      <h3>Your request has been logged</h3>
      <p>
        Reference: <strong>{ticketRef}</strong>
      </p>
      <p className="vc-hint">Our support team will reply by email. Keep this reference if you contact us again.</p>
      <button type="button" className="vc-btn" onClick={onDone}>
        Back to chat
      </button>
    </div>
  );
}
