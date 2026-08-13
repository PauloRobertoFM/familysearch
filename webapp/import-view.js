import { importGedcomText, getMeta, getCounts } from "./store.js";
import { invalidatePeopleCache } from "./tree-view.js";
import { h, clear } from "./dom.js";

export async function renderImportView(container) {
  const counts = await getCounts();

  clear(container);

  const status = h("p", { class: "hint", id: "import-status" });

  const description =
    counts.people > 0
      ? `Já há ${counts.people} pessoas e ${counts.families} famílias carregadas. Importar de novo atualiza os dados ` +
        "(nome, datas, relações) sem apagar o status de validação e as notas que você já preencheu."
      : "Nenhum dado carregado ainda. Importe um arquivo .ged exportado do FamilySearch/MyHeritage.";

  const fileInput = h("input", { type: "file", id: "gedcom-file", accept: ".ged,.gedcom,text/plain" });
  const sampleBtn = h("button", { type: "button", id: "load-sample" }, "Carregar exemplo");

  container.appendChild(
    h(
      "section",
      { class: "card-section" },
      h("h2", {}, "Importar árvore (GEDCOM)"),
      h("p", { class: "hint" }, description),
      fileInput,
      status,
      h("hr", {}),
      h("p", { class: "hint" }, "Ou carregue o exemplo já incluído neste app (família Miglioli, 321 pessoas):"),
      sampleBtn
    )
  );

  async function finishImport(text) {
    const result = await importGedcomText(text);
    invalidatePeopleCache();
    status.textContent = `Importado: ${result.peopleCount} pessoas, ${result.familiesCount} famílias.`;
    const root = await getMeta("rootPersonId");
    if (root) setTimeout(() => (window.location.hash = `#/tree/${root}`), 700);
  }

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    status.textContent = "Importando…";
    try {
      await finishImport(await file.text());
    } catch (err) {
      status.textContent = `Erro ao importar: ${err.message}`;
      console.error(err);
    }
  });

  sampleBtn.addEventListener("click", async () => {
    status.textContent = "Carregando exemplo…";
    try {
      const res = await fetch("./sample/familia_miglioli.ged");
      await finishImport(await res.text());
    } catch (err) {
      status.textContent = `Erro ao carregar exemplo: ${err.message}`;
      console.error(err);
    }
  });
}
