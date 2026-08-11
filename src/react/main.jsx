import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SettingsPage } from "./SettingsPage.jsx";
import { WorkflowPage } from "./WorkflowPage.jsx";
import { InsightsPage } from "./InsightsPage.jsx";
import { SchedulePage } from "./SchedulePage.jsx";
import { ContractsPage } from "./ContractsPage.jsx";

const mountedRoots = new WeakMap();

function ReactBridgeStatus({ label = "React bridge ready" }) {
  return (
    <span className="reactBridgeStatus" data-react-ready="true">
      {label}
    </span>
  );
}

const islands = {
  status: ReactBridgeStatus,
  settings: SettingsPage,
  workflow: WorkflowPage,
  insights: InsightsPage,
  schedule: SchedulePage,
  contracts: ContractsPage,
};

function mountIsland(element) {
  const islandName = element.dataset.reactIsland;
  const Component = islands[islandName];
  if (!Component || mountedRoots.has(element)) return false;

  const props = element.dataset.reactProps
    ? JSON.parse(element.dataset.reactProps)
    : {};
  const root = createRoot(element);
  root.render(
    <StrictMode>
      <Component {...props} />
    </StrictMode>
  );
  mountedRoots.set(element, root);
  return true;
}

export function mountReactIslands(scope = document) {
  const roots = Array.from(scope.querySelectorAll("[data-react-island]"));
  return roots.reduce((count, element) => count + (mountIsland(element) ? 1 : 0), 0);
}

if (typeof window !== "undefined") {
  window.BiDocReact = {
    islands: Object.keys(islands),
    mountReactIslands,
    version: "0.1.0"
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mountReactIslands(), { once: true });
  } else {
    mountReactIslands();
  }
}
