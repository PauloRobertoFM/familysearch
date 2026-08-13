import { getRelatives, getAllPeople } from "./store.js";
import { personCard, escapeHtml } from "./cards.js";
import { fullName } from "./gedcom.js";

export async function renderTreeView(container, personId) {
  container.innerHTML = `<p class="hint">Carregando árvore…</p>`;

  const data = await getRelatives(personId);
  if (!data) {
    container.innerHTML = `<p class="hint">Pessoa não encontrada (#${escapeHtml(personId)}).</p>`;
    return;
  }

  const { person, parents, siblings, unions } = data;
  const activeUnion = unions[0] || { spouse: null, children: [], family: null };

  container.innerHTML = "";

  const header = document.createElement("div");
  header.className = "tree-search";
  header.innerHTML = `
    <input type="search" id="tree-search-input" placeholder="Buscar pessoa por nome…" autocomplete="off" />
    <div id="tree-search-results" class="search-results"></div>
  `;
  container.appendChild(header);

  wireSearch(header);

  if (parents.length) {
    const row = document.createElement("div");
    row.className = "tree-row tree-row-parents";
    row.innerHTML = `<div class="tree-row-label">Pais</div>`;
    const cards = document.createElement("div");
    cards.className = "tree-row-cards";
    for (const p of parents) cards.appendChild(personCard(p, "relative"));
    row.appendChild(cards);
    container.appendChild(row);

    const connector = document.createElement("div");
    connector.className = "tree-connector";
    container.appendChild(connector);
  }

  const focusRow = document.createElement("div");
  focusRow.className = "tree-row tree-row-focus";
  const focusCards = document.createElement("div");
  focusCards.className = "tree-row-cards";
  focusCards.appendChild(personCard(person, "focus"));
  if (activeUnion.spouse) focusCards.appendChild(personCard(activeUnion.spouse, "relative"));
  focusRow.appendChild(focusCards);
  container.appendChild(focusRow);

  if (unions.length > 1) {
    const unionPicker = document.createElement("div");
    unionPicker.className = "union-picker";
    unionPicker.innerHTML =
      `<span class="hint">${unions.length} uniões conhecidas: </span>` +
      unions
        .map(
          (u, i) =>
            `<button type="button" class="union-btn${i === 0 ? " active" : ""}" data-idx="${i}">${
              u.spouse ? escapeHtml(fullName(u.spouse)) : "Cônjuge desconhecido"
            }</button>`
        )
        .join(" ");
    container.appendChild(unionPicker);
    unionPicker.addEventListener("click", (e) => {
      const btn = e.target.closest(".union-btn");
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx, 10);
      renderChildren(container, unions[idx].children, true);
      unionPicker.querySelectorAll(".union-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  }

  if (siblings.length) {
    const row = document.createElement("div");
    row.className = "tree-row tree-row-siblings";
    row.innerHTML = `<div class="tree-row-label">Irmãos (${siblings.length})</div>`;
    const cards = document.createElement("div");
    cards.className = "tree-row-cards tree-row-scroll";
    for (const s of siblings) cards.appendChild(personCard(s, "relative"));
    row.appendChild(cards);
    container.appendChild(row);
  }

  renderChildren(container, activeUnion.children, false);
}

function renderChildren(container, children, replace) {
  const existing = container.querySelector(".tree-row-children");
  if (existing) existing.remove();
  if (!children.length) return;

  const connector = document.createElement("div");
  connector.className = "tree-connector";

  const row = document.createElement("div");
  row.className = "tree-row tree-row-children";
  row.innerHTML = `<div class="tree-row-label">Filhos (${children.length})</div>`;
  const cards = document.createElement("div");
  cards.className = "tree-row-cards tree-row-scroll";
  for (const c of children) cards.appendChild(personCard(c, "relative"));
  row.appendChild(cards);

  const anchor = container.querySelector(".union-picker") || container.querySelector(".tree-row-siblings");
  if (anchor) {
    anchor.after(connector, row);
  } else {
    container.appendChild(connector);
    container.appendChild(row);
  }
}

let allPeopleCache = null;
function wireSearch(header) {
  const input = header.querySelector("#tree-search-input");
  const results = header.querySelector("#tree-search-results");

  input.addEventListener("input", async () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) {
      results.innerHTML = "";
      return;
    }
    if (!allPeopleCache) allPeopleCache = await getAllPeople();
    const matches = allPeopleCache
      .filter((p) => fullName(p).toLowerCase().includes(q))
      .slice(0, 12);

    results.innerHTML = matches
      .map((p) => `<div class="search-hit" data-id="${p.id}">${escapeHtml(fullName(p))} <span class="hint">#${p.id}</span></div>`)
      .join("");
  });

  results.addEventListener("click", (e) => {
    const hit = e.target.closest(".search-hit");
    if (!hit) return;
    window.location.hash = `#/tree/${hit.dataset.id}`;
  });
}
