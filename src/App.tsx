import { useCallback, useMemo, useState } from "react";
import { GatewayClient } from "./api/client";
import { ChatWindow } from "./components/ChatWindow";
import { Launcher } from "./components/Launcher";
import type { WidgetConfig } from "./types";

export function App({ config }: { config: WidgetConfig }) {
  const [open, setOpen] = useState(Boolean(config.startOpen));
  const client = useMemo(() => new GatewayClient(config), [config]);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className={`vc-root vc-audience--${config.audience}`}>
      {/* Keep the window mounted once opened so the conversation survives close/reopen. */}
      <OpenOnce open={open}>
        <div hidden={!open}>
          <ChatWindow config={config} client={client} onClose={close} />
        </div>
      </OpenOnce>
      <Launcher open={open} onToggle={() => setOpen((o) => !o)} />
    </div>
  );
}

/** Renders children only after the first time `open` becomes true (lazy session start), then keeps them. */
function OpenOnce({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened ? <>{children}</> : null;
}
