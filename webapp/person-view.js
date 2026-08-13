import { getRelatives, updatePerson, VALIDATION_STATUSES, VALIDATION_LABELS } from "./store.js";
import { personCard } from "./cards.js";
import { fullName } from "./gedcom.js";
import { h, clear } from "./dom.js";
import { invalidatePeopleCache } from "./tree-view.js";

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

  const nameHeading = h("h1", {}, fullName(person));
  container.appendChild(
    h(
      "div",
      { class: "ficha-header" },
      h("a", { class: "back-link", href: `#/tree/${person.id}` }, "← Ver na árvore"),
      nameHeading,
      h("div", { class: "hint" }, `#${person.id}`)
    )
  );

  const vitals = section("Sinais vitais");
  const vitalsSaved = h("span", { class: "hint save-hint", id: "vitals-saved" });

  async function saveField(patch) {
    const unchanged = Object.entries(patch).every(([key, value]) => (person[key] ?? "") === value);
    if (unchanged) return;
    Object.assign(person, patch);
    await updatePerson(person.id, patch);
    nameHeading.textContent = fullName(person);
    invalidatePeopleCache();
    flashSaved(vitalsSaved);
  }

  const givenInput = editableText(person.givenName, (v) => saveField({ givenName: v }));
  const surnameInput = editableText(person.surname, (v) => saveField({ surname: v }));

  const sexSelect = h(
    "select",
    { class: "field-input" },
    h("option", { value: "" }, "Não informado"),
    h("option", { value: "M" }, "Masculino"),
    h("option", { value: "F" }, "Feminino")
  );
  sexSelect.value = person.sex || "";
  sexSelect.addEventListener("change", (e) => saveField({ sex: e.target.value }));

  const birthDateInput = editableText(person.birthDate, (v) => saveField({ birthDate: v }), "ex: 12 JAN 1950");
  const birthPlaceInput = editableText(person.birthPlace, (v) => saveField({ birthPlace: v }), "cidade, estado, país");
  const deathDateInput = editableText(person.deathDate, (v) => saveField({ deathDate: v }), "deixe em branco se vivo(a)");
  const deathPlaceInput = editableText(person.deathPlace, (v) => saveField({ deathPlace: v }));

  vitals.appendChild(
    h(
      "div",
      { class: "field-grid" },
      fieldRow("Nome", givenInput),
      fieldRow("Sobrenome", surnameInput),
      fieldRow("Sexo", sexSelect),
      fieldRow("Data de nascimento", birthDateInput),
      fieldRow("Local de nascimento", birthPlaceInput),
      fieldRow("Data de falecimento", deathDateInput),
      fieldRow("Local de falecimento", deathPlaceInput)
    )
  );
  vitals.appendChild(vitalsSaved);
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

function fieldRow(label, inputEl) {
  return h("div", { class: "field-item" }, h("div", { class: "field-label" }, label), inputEl);
}

function editableText(value, onSave, placeholder) {
  const input = h("input", { type: "text", class: "field-input", placeholder: placeholder || "" });
  input.value = value || "";
  input.addEventListener("blur", () => onSave(input.value.trim()));
  return input;
}

function hint(text) {
  return h("div", { class: "hint" }, text);
}

function flashSaved(el) {
  el.textContent = "Salvo ✓";
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.textContent = ""), 1500);
}
