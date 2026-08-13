import { getRelatives, updatePerson, VALIDATION_STATUSES, VALIDATION_LABELS } from "./store.js";
import { personCard } from "./cards.js";
import { fullName } from "./gedcom.js";
import { h, clear } from "./dom.js";

export async function renderPersonView(container, personId) {
  clear(container);
  container.appendChild(h("p", { class: "hint" }, "Carregando ficha…"));

  const data = await getRelatives(personId);
  if (!data) {
    clear(container);
    container.appendChild(h("p", { class: "hint" }, `Pessoa não encontrada (#${personId}).`));
    return;
  }

  const { person, parents, siblings, unions } = data;
  const status = person.validationStatus || "unverified";

  clear(container);

  container.appendChild(
    h(
      "div",
      { class: "ficha-header" },
      h("a", { class: "back-link", href: `#/tree/${person.id}` }, "← Ver na árvore"),
      h("h1", {}, fullName(person)),
      h("div", { class: "hint" }, `#${person.id}`)
    )
  );

  const vitals = section("Sinais vitais");
  vitals.appendChild(
    fieldGrid([
      ["Sexo", sexLabel(person.sex)],
      ["Nascimento", [person.birthDate, person.birthPlace].filter(Boolean).join(" — ") || "—"],
      [
        "Falecimento",
        [person.deathDate, person.deathPlace].filter(Boolean).join(" — ") ||
          (person.deathDate || person.deathPlace ? "" : "Vivo(a) / não registrado"),
      ],
    ])
  );
  container.appendChild(vitals);

  const validation = section("Status de validação");
  const savedHint = h("span", { class: "hint save-hint", id: "status-saved" });
  const select = h(
    "select",
    { id: "status-select" },
    ...VALIDATION_STATUSES.map((s) => h("option", { value: s, selected: s === status || undefined }, VALIDATION_LABELS[s]))
  );
  select.value = status;
  select.addEventListener("change", async (e) => {
    await updatePerson(person.id, { validationStatus: e.target.value });
    flashSaved(savedHint);
  });
  validation.appendChild(h("div", { class: "status-row" }, select, savedHint));
  container.appendChild(validation);

  const familySection = section("Membros da família");
  const cols = h("div", { class: "family-cols" });

  const spouseCol = h("div", {}, h("h3", {}, "Cônjuges e filhos"));
  if (unions.length === 0) {
    spouseCol.appendChild(hint("Nenhum cônjuge registrado."));
  }
  for (const u of unions) {
    const unionBlock = h("div", { class: "union-block" });
    if (u.spouse) unionBlock.appendChild(personCard(u.spouse, "relative"));
    if (u.family?.marriageDate || u.family?.marriagePlace) {
      unionBlock.appendChild(hint(`Casamento: ${[u.family.marriageDate, u.family.marriagePlace].filter(Boolean).join(" — ")}`));
    }
    if (u.children.length) {
      unionBlock.appendChild(h("div", { class: "row-cards" }, ...u.children.map((c) => personCard(c, "relative"))));
    }
    spouseCol.appendChild(unionBlock);
  }
  cols.appendChild(spouseCol);

  const parentCol = h("div", {}, h("h3", {}, "Pais e irmãos"));
  if (parents.length === 0) parentCol.appendChild(hint("Nenhum pai/mãe registrado."));
  parentCol.appendChild(h("div", { class: "row-cards" }, ...parents.map((p) => personCard(p, "relative"))));
  if (siblings.length) {
    parentCol.appendChild(hint(`Irmãos (${siblings.length}):`));
    parentCol.appendChild(h("div", { class: "row-cards" }, ...siblings.map((s) => personCard(s, "relative"))));
  }
  cols.appendChild(parentCol);

  familySection.appendChild(cols);
  container.appendChild(familySection);

  const notes = section("Notas");
  const notesSaved = h("span", { class: "hint save-hint", id: "notes-saved" });
  const textarea = h("textarea", {
    id: "notes-input",
    rows: "4",
    placeholder: "Anotações sobre esta pessoa (fontes, dúvidas, próximos passos de pesquisa)...",
  });
  textarea.value = person.notes || "";
  textarea.addEventListener("blur", async (e) => {
    await updatePerson(person.id, { notes: e.target.value });
    flashSaved(notesSaved);
  });
  notes.appendChild(textarea);
  notes.appendChild(notesSaved);
  container.appendChild(notes);
}

function section(title) {
  return h("section", { class: "card-section" }, h("h2", {}, title));
}

function fieldGrid(pairs) {
  return h(
    "div",
    { class: "field-grid" },
    ...pairs.map(([label, value]) =>
      h("div", { class: "field-item" }, h("div", { class: "field-label" }, label), h("div", { class: "field-value" }, value))
    )
  );
}

function hint(text) {
  return h("div", { class: "hint" }, text);
}

function sexLabel(sex) {
  if (sex === "M") return "Masculino";
  if (sex === "F") return "Feminino";
  return "Não informado";
}

function flashSaved(el) {
  el.textContent = "Salvo ✓";
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.textContent = ""), 1500);
}
