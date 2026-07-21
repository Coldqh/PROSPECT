import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./app/App";
import { CareerLibraryProvider } from "./state/CareerLibraryProvider";
import "./styles/index.css";

registerSW({
  immediate: true,
});

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element was not found");
}

createRoot(root).render(
  <StrictMode>
    <CareerLibraryProvider>
      <App />
    </CareerLibraryProvider>
  </StrictMode>,
);
