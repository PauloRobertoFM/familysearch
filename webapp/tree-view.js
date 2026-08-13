import { getRelatives, getAllPeople } from "./store.js";
import { personCard } from "./cards.js";
import { fullName } from "./gedcom.js";
import { h, clear } from "./dom.js";

export async function renderTreeView(container, personId) {
  clear(container);
  container.appendChild(h("p", { class: "hint" }, "Carregando árvore…"));

  const data = await getRelatives(personId);
  if (!data) {
    clear(container);
    container.appendChild(h("p", { class: "hint" }, `Pessoa não encontrada (#${personId}).`));
    return;
  }

  const { person, parents, siblings, unions } = data;
  const activeUnion = unions[0] || { spouse: null, children: [], family: null };

  clear(container);

  const searchResults = h("div", { class: "search-results", id: "tree-search-results" });
  const searchInput = h("input", {
    type: "search",
    id: "tree-search-input",
    placeholder: "Buscar pessoa por nome…",
    autocomplete: "off",
  });
  const header = h("div", { class: "tree-search" }, searchInput, searchResults);
  container.appendChild(header);
  wireSearch(searchInput, searchResults);

  if (parents.length) {
    const cards = h("div", { class: "tree-row-cards" }, ...parents.map((p) => personCard(p, "relative")));
    container.appendChild(h("div", { class: "tree-row tree-row-parents" }, h("div", { class: "tree-row-label" }, "Pais"), cards));
    container.appendChild(h("div", { class: "tree-connector" }));
  }

  const focusCards = [personCard(person, "focus")];
  if (activeUnion.spouse) focusCards.push(personCard(activeUnion.spouse, "relative"));
  container.appendChild(h("div", { class: "tree-row tree-row-focus" }, h("div", { class: "tree-row-cards" }, ...focusCards)));

  if (unions.length > 1) {
    const buttons = unions.map((u, i) =>
      h(
        "button",
        {
          type: "button",
          class: `union-btn${i === 0 ? " active" : ""}`,
          dataset: { idx: String(i) },
          onclick: (e) => {
            renderChildren(container, unions[i].children, true);
            container.querySelectorAll(".union-btn").forEach((b) => b.classList.remove("active"));
            e.currentTarget.classList.add("active");
          },
        },
        u.spouse ? fullName(u.spouse) : "Cônjuge desconhecido"
      )
    );
    container.appendChild(
      h("div", { class: "union-picker" }, h("span", { class: "hint" }, `${unions.length} uniões conhecidas: `), ...buttons)
    );
  }

  if (siblings.length) {
    const cards = h("div", { class: "tree-row-cards tree-row-scroll" }, ...siblings.map((s) => personCard(s, "relative")));
    container.appendChild(
      h("div", { class: "tree-row tree-row-siblings" }, h("div", { class: "tree-row-label" }, `Irmãos (${siblings.length})`), cards)
    );
  }

  renderChildren(container, activeUnion.children, false);
}

function renderChildren(container, children, replace) {
  const existing = container.querySelector(".tree-row-children");
  const existingConnector = existing?.previousElementSibling;
  if (existing) existing.remove();
  if (existingConnector?.classList.contains("tree-connector")) existingConnector.remove();
  if (!children.length) return;

  const connector = h("div", { class: "tree-connector" });
  const cards = h("div", { class: "tree-row-cards tree-row-scroll" }, ...children.map((c) => personCard(c, "relative")));
  const row = h("div", { class: "tree-row tree-row-children" }, h("div", { class: "tree-row-label" }, `Filhos (${children.length})`), cards);

  const anchor = container.querySelector(".union-picker") || container.querySelector(".tree-row-siblings");
  if (anchor) {
    anchor.after(connector, row);
  } else {
    container.appendChild(connector);
    container.appendChild(row);
  }
}

let allPeopleCache = null;

export function invalidatePeopleCache() {
  allPeopleCache = null;
}

function wireSearch(input, results) {
  input.addEventListener("input", async () => {
    const q = input.value.trim().toLowerCase();
    clear(results);
    if (q.length < 2) return;
    if (!allPeopleCache) allPeopleCache = await getAllPeople();
    const matches = allPeopleCache.filter((p) => fullName(p).toLowerCase().includes(q)).slice(0, 12);

    for (const p of matches) {
      results.appendChild(
        h(
          "div",
          {
            class: "search-hit",
            dataset: { id: p.id },
            onclick: () => {
              window.location.hash = `#/tree/${p.id}`;
            },
          },
          `${fullName(p)} `,
          h("span", { class: "hint" }, `#${p.id}`)
        )
      );
    }
  });
}
