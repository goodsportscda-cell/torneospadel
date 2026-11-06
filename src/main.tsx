import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const reloadKey = "padel_chunk_reload_ts";
  const lastReload = Number(sessionStorage.getItem(reloadKey) || "0");
  if (Date.now() - lastReload > 10_000) {
    sessionStorage.setItem(reloadKey, String(Date.now()));
    if ("caches" in window) {
      caches
        .keys()
        .then((names) => Promise.all(names.map((n) => caches.delete(n))))
        .finally(() => window.location.reload());
    } else {
      window.location.reload();
    }
  }
});

createRoot(document.getElementById("root")!).render(<App />);
