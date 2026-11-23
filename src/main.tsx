import { createRoot, type Root } from "react-dom/client";
import { App } from "./App";
import styles from "./styles/widget.css?inline";
import type { Audience, Region, WidgetConfig } from "./types";

const AUDIENCES: Audience[] = ["public", "client", "candidate"];
const REGIONS: Region[] = ["UK", "AU"];
const DEFAULT_TOKEN_URL = "http://localhost:8787/token";

// Must be read synchronously while this script is executing. Module scripts (Vite dev server)
// don't set currentScript, so fall back to the first tag carrying our data attributes.
const currentScript = (document.currentScript ??
  document.querySelector("script[data-vetting-chat]")) as HTMLScriptElement | null;

let root: Root | null = null;
let host: HTMLElement | null = null;

function configFromScript(el: HTMLScriptElement | null): Partial<WidgetConfig> {
  if (!el) return {};
  const d = el.dataset;
  return {
    audience: d.audience as Audience | undefined,
    region: d.region as Region | undefined,
    tokenUrl: d.tokenUrl,
    startOpen: d.startOpen === "true",
  };
}

function normalise(input: Partial<WidgetConfig>): WidgetConfig {
  const audience = AUDIENCES.includes(input.audience as Audience) ? (input.audience as Audience) : "public";
  const region = REGIONS.includes(input.region as Region) ? input.region : undefined;
  return {
    audience,
    region,
    authToken: input.authToken,
    tokenUrl: input.tokenUrl || DEFAULT_TOKEN_URL,
    startOpen: input.startOpen,
  };
}

/** Mounts (or re-mounts) the widget inside a Shadow DOM so host-page CSS can't affect it. */
function init(options: Partial<WidgetConfig> = {}) {
  const config = normalise({ ...configFromScript(currentScript), ...options });

  if (!host) {
    host = document.createElement("div");
    host.id = "vetting-chat-widget";
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = styles;
    const mount = document.createElement("div");
    shadow.append(style, mount);
    root = createRoot(mount);
  }
  root!.render(<App config={config} />);
}

function destroy() {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
}

const api = { init, destroy };
declare global {
  interface Window {
    VettingChat: typeof api;
  }
}
window.VettingChat = api;

// Auto-start unless the page wants to call VettingChat.init({ authToken }) itself (portals).
if (currentScript?.dataset.manualInit !== "true") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }
}
