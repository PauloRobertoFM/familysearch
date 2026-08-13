import { getRelatives, updatePerson, VALIDATION_STATUSES, VALIDATION_LABELS } from "./store.js";
import { personCard, escapeHtml } from "./cards.js";
import { fullName } from "./gedcom.js";

export async function renderPersonView(container, personId) {
  container.innerHTML = `<p class="hint">Carregando ficha…</p>`;

  const data = await getRelatives(personId);
  if (!data) {
    container.innerHTML = `<p class="hint">Pessoa não encontrada (#${escapeHtml(personId)}).</p>`;
    return;
  }

  const { person, parents, siblings, unions } = data;
  const status = person.validationStatus || "unverified";

  container.innerHTML = "";

  const header = document.createElement("div");
  header.className = "ficha-header";
  const safeId = escapeHtml(person.id);
  header.innerHTML = `
    <a class="back-link" href="#/tree/${safeId}">← Ver na árvore</a>
    <h1>${escapeHtml(fullName(person))}</h1>
    <div class="hint">#${safeId}</div>
  `;
  container.appendChild(header);

  const vitals = section("Sinais vitais");
  vitals.appendChild(
    fieldGrid([
      ["Sexo", sexLabel(person.sex)],
      ["Nascimento", [person.birthDate, person.birthPlace].filter(Boolean).join(" — ") || "—"],
      ["Falecimento", [person.deathDate, person.deathPlace].filter(Boolean).join(" — ") || (person.deathDate || person.deathPlace ? "" : "Vivo(a) / não registrado")],
    ])
  );
  container.appendChild(vitals);

  const validation = section("Status de validação");
  const statusRow = document.createElement("div");
  statusRow.className = "status-row";
  statusRow.innerHTML =
    `<select id="status-select">` +
    VALIDATION_STATUSES.map(
      (s) => `<option value="${s}" ${s === status ? "selected" : ""}>${VALIDATION_LABELS[s]}</option>`
    ).join("") +
    `</select>` +
    `<span id="status-saved" class="hint save-hint"></span>`;
  validation.appendChild(statusRow);
  validation
    .querySelector("#status-select")
    .addEventListener("change", async (e) => {
      await updatePerson(person.id, { validationStatus: e.target.value });
      flashSaved(validation.querySelector("#status-saved"));
    });
  container.appendChild(validation);

  const familySection = section("Membros da família");
  const cols = document.createElement("div");
  cols.className = "family-cols";

  const spouseCol = document.createElement("div");
  spouseCol.innerHTML = `<h3>Cônjuges e filhos</h3>`;
  if (unions.length === 0) {
    spouseCol.appendChild(hint("Nenhum cônjuge registrado."));
  }
  for (const u of unions) {
    const unionBlock = document.createElement("div");
    unionBlock.className = "union-block";
    if (u.spouse) unionBlock.appendChild(personCard(u.spouse, "relative"));
    if (u.family?.marriageDate || u.family?.marriagePlace) {
      unionBlock.appendChild(hint(`Casamento: ${[u.family.marriageDate, u.family.marriagePlace].filter(Boolean).join(" — ")}`));
    }
    if (u.children.length) {
      const childWrap = document.createElement("div");
      childWrap.className = "row-cards";
      for (const c of u.children) childWrap.appendChild(personCard(c, "relative"));
      unionBlock.appendChild(childWrap);
    }
    spouseCol.appendChild(unionBlock);
  }
  cols.appendChild(spouseCol);

  const parentCol = document.createElement("div");
  parentCol.innerHTML = `<h3>Pais e irmãos</h3>`;
  if (parents.length === 0) parentCol.appendChild(hint("Nenhum pai/mãe registrado."));
  const parentWrap = document.createElement("div");
  parentWrap.className = "row-cards";
  for (const p of parents) parentWrap.appendChild(personCard(p, "relative"));
  parentCol.appendChild(parentWrap);
  if (siblings.length) {
    parentCol.appendChild(hint(`Irmãos (${siblings.length}):`));
    const sibWrap = document.createElement("div");
    sibWrap.className = "row-cards";
    for (const s of siblings) sibWrap.appendChild(personCard(s, "relative"));
    parentCol.appendChild(sibWrap);
  }
  cols.appendChild(parentCol);

  familySection.appendChild(cols);
  container.appendChild(familySection);

  const notes = section("Notas");
  notes.innerHTML += `
    <textarea id="notes-input" rows="4" placeholder="Anotações sobre esta pessoa (fontes, dúvidas, próximos passos de pesquisa)...">${escapeHtml(person.notes || "")}</textarea>
    <span id="notes-saved" class="hint save-hint"></span>
  `;
  notes.querySelector("#notes-input").addEventListener("blur", async (e) => {
    await updatePerson(person.id, { notes: e.target.value });
    flashSaved(notes.querySelector("#notes-saved"));
  });
  container.appendChild(notes);
}

function section(title) {
  const el = document.createElement("section");
  el.className = "card-section";
  const h2 = document.createElement("h2");
  h2.textContent = title;
  el.appendChild(h2);
  return el;
}

function fieldGrid(pairs) {
  const grid = document.createElement("div");
  grid.className = "field-grid";
  for (const [label, value] of pairs) {
    const item = document.createElement("div");
    item.className = "field-item";
    item.innerHTML = `<div class="field-label">${escapeHtml(label)}</div><div class="field-value">${escapeHtml(value)}</div>`;
    grid.appendChild(item);
  }
  return grid;
}

function hint(text) {
  const el = document.createElement("div");
  el.className = "hint";
  el.textContent = text;
  return el;
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
