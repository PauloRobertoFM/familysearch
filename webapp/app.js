import { getCounts, getMeta, getAllPeople } from "./store.js";
import { renderTreeView } from "./tree-view.js";
import { renderPersonView } from "./person-view.js";
import { renderImportView } from "./import-view.js";
import { renderExportView } from "./export-view.js";

const view = document.getElementById("view");

async function route() {
  const hash = window.location.hash || "";
  const [, page, id] = hash.match(/^#\/([a-z]+)(?:\/(.+))?$/) || [];

  setActiveNav(page);

  if (page === "import") return renderImportView(view);
  if (page === "export") return renderExportView(view);
  if (page === "tree" && id) return renderTreeView(view, id);
  if (page === "person" && id) return renderPersonView(view, id);

  const counts = await getCounts();
  if (counts.people === 0) {
    window.location.hash = "#/import";
    return;
  }

  let root = await getMeta("rootPersonId");
  if (!root) {
    const [first] = await getAllPeople();
    root = first?.id;
  }

  if (!root) {
    window.location.hash = "#/import";
    return;
  }
  window.location.hash = `#/tree/${root}`;
}

function setActiveNav(page) {
  document.querySelectorAll("#nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.page === page);
  });
}

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", () => {
  route();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((err) => console.warn("SW registration failed", err));
  }
});
