/* Browser entry for the accepted JARVIS Command Center (jarvis-command-center.jsx).
   Bundled by scripts/jarvis-command-center-ui-build-v1.mjs into a single inline
   script. The server shell sets window.__JARVIS_CC__ = { apiBase } before this
   runs so the System Status section can reach GET <apiBase>/runtime-truth. */
import React from "react";
import { createRoot } from "react-dom/client";
import JarvisCommandCenter from "./jarvis-command-center.jsx";

function mount() {
  const el = document.getElementById("jarvis-command-center-root");
  if (!el) return;
  createRoot(el).render(React.createElement(React.StrictMode, null, React.createElement(JarvisCommandCenter)));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
