const REACT_BRIDGE_URL = "/react/bidoc-react.js?v=20260901-kapaim-contract-preview-fix";

function loadReactBridge() {
  if (!document.querySelector("[data-react-island]")) return;
  import(REACT_BRIDGE_URL).catch((error) => {
    console.warn("[react] failed to load bridge:", error);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadReactBridge, { once: true });
} else {
  loadReactBridge();
}
