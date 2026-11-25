/**
 * Actualiza dinámicamente el título del documento y las etiquetas meta OG/Twitter en el cliente.
 */
export function updateDocumentMeta(params: { title: string; description?: string }) {
  if (typeof document === "undefined") return;
  const { title, description } = params;
  document.title = title;

  const setMeta = (selector: string, content: string) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute("content", content);
  };

  setMeta('meta[property="og:title"]', title);
  setMeta('meta[name="twitter:title"]', title);

  if (description) {
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[name="twitter:description"]', description);
  }
}
