import { importGedcomText, getMeta, getCounts } from "./store.js";

export async function renderImportView(container) {
  const counts = await getCounts();

  container.innerHTML = `
    <section class="card-section">
      <h2>Importar árvore (GEDCOM)</h2>
      <p class="hint">
        ${counts.people > 0
          ? `Já há ${counts.people} pessoas e ${counts.families} famílias carregadas. Importar de novo atualiza os dados
             (nome, datas, relações) sem apagar o status de validação e as notas que você já preencheu.`
          : "Nenhum dado carregado ainda. Importe um arquivo .ged exportado do FamilySearch/MyHeritage."}
      </p>
      <input type="file" id="gedcom-file" accept=".ged,.gedcom,text/plain" />
      <p id="import-status" class="hint"></p>
      <hr />
      <p class="hint">Ou carregue o exemplo já incluído neste app (família Miglioli, 321 pessoas):</p>
      <button type="button" id="load-sample">Carregar exemplo</button>
    </section>
  `;

  const status = container.querySelector("#import-status");

  container.querySelector("#gedcom-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    status.textContent = "Importando…";
    try {
      const text = await file.text();
      const result = await importGedcomText(text);
      status.textContent = `Importado: ${result.peopleCount} pessoas, ${result.familiesCount} famílias.`;
      const root = await getMeta("rootPersonId");
      if (root) setTimeout(() => (window.location.hash = `#/tree/${root}`), 700);
    } catch (err) {
      status.textContent = `Erro ao importar: ${err.message}`;
      console.error(err);
    }
  });

  container.querySelector("#load-sample").addEventListener("click", async () => {
    status.textContent = "Carregando exemplo…";
    try {
      const res = await fetch("./sample/familia_miglioli.ged");
      const text = await res.text();
      const result = await importGedcomText(text);
      status.textContent = `Importado: ${result.peopleCount} pessoas, ${result.familiesCount} famílias.`;
      const root = await getMeta("rootPersonId");
      if (root) setTimeout(() => (window.location.hash = `#/tree/${root}`), 700);
    } catch (err) {
      status.textContent = `Erro ao carregar exemplo: ${err.message}`;
      console.error(err);
    }
  });
}
