import { useCallback, useState, type ReactNode } from "react";
import { ChatWindow } from "./components/ChatWindow";
import { Launcher } from "./components/Launcher";
import type { WidgetConfig } from "./types";

export function App({ config }: { config: WidgetConfig }) {
  const [open, setOpen] = useState(Boolean(config.startOpen));
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className={`vc-root vc-audience--${config.audience}`}>
      {/* Mount on first open (so no Copilot Studio conversation starts until needed), then keep it
          mounted so the conversation survives close/reopen. */}
      <OpenOnce open={open}>
        <div hidden={!open}>
          <ChatWindow config={config} onClose={close} />
        </div>
      </OpenOnce>
      <Launcher open={open} onToggle={() => setOpen((o) => !o)} />
    </div>
  );
}

function OpenOnce({ open, children }: { open: boolean; children: ReactNode }) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened ? <>{children}</> : null;
}
