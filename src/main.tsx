import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { LanguageProvider } from "./hooks/useLanguage";

const root = document.getElementById("root")!;
createRoot(root).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>
);
