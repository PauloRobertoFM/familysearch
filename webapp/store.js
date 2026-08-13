import { openDB, putAll, getAll, getOne, putOne, countStore } from "./db.js";
import { parseGedcom } from "./gedcom.js";

export const VALIDATION_STATUSES = ["unverified", "partial", "verified"];

export const VALIDATION_LABELS = {
  unverified: "Não verificado",
  partial: "Parcial",
  verified: "Verificado",
};

let dbPromise = null;
function db() {
  if (!dbPromise) dbPromise = openDB();
  return dbPromise;
}

/**
 * Imports a GEDCOM text into IndexedDB. Existing people keep their
 * validationStatus/notes (manual work already done) — only the
 * GEDCOM-derived fields (name, dates, relations) are refreshed.
 */
export async function importGedcomText(text) {
  const database = await db();
  const parsed = parseGedcom(text);

  const existingPeople = await getAll(database, "people");
  const existingById = new Map(existingPeople.map((p) => [p.id, p]));

  const people = [];
  for (const p of parsed.people.values()) {
    const prev = existingById.get(p.id);
    people.push({
      ...p,
      validationStatus: prev?.validationStatus || "unverified",
      notes: prev?.notes || "",
    });
  }
  const families = Array.from(parsed.families.values());

  await putAll(database, "people", people);
  await putAll(database, "families", families);

  const rootMeta = await getOne(database, "meta", "rootPersonId");
  if (!rootMeta) {
    const preferred = people.find((p) =>
      `${p.givenName} ${p.surname}`.toUpperCase().includes("PAULO ROBERTO")
    );
    const root = preferred || people[0];
    if (root) await putOne(database, "meta", { key: "rootPersonId", value: root.id });
  }

  await putOne(database, "meta", {
    key: "lastImport",
    value: { at: new Date().toISOString(), people: people.length, families: families.length },
  });

  return { peopleCount: people.length, familiesCount: families.length };
}

export async function getPerson(id) {
  const database = await db();
  return getOne(database, "people", id);
}

export async function getFamily(id) {
  const database = await db();
  return getOne(database, "families", id);
}

export async function getAllPeople() {
  const database = await db();
  return getAll(database, "people");
}

export async function getCounts() {
  const database = await db();
  const [people, families] = await Promise.all([
    countStore(database, "people"),
    countStore(database, "families"),
  ]);
  return { people, families };
}

export async function updatePerson(id, patch) {
  const database = await db();
  const person = await getOne(database, "people", id);
  if (!person) return null;
  const updated = { ...person, ...patch };
  await putOne(database, "people", updated);
  return updated;
}

export async function getMeta(key) {
  const database = await db();
  const row = await getOne(database, "meta", key);
  return row ? row.value : null;
}

export async function setMeta(key, value) {
  const database = await db();
  await putOne(database, "meta", { key, value });
}

/**
 * Resolves a person's immediate relatives for the tree/ficha views:
 * parents, siblings (via each FAMC), spouses+children (via each FAMS).
 */
export async function getRelatives(personId) {
  const database = await db();
  const person = await getOne(database, "people", personId);
  if (!person) return null;

  const familyIds = [...new Set([...(person.famc || []), ...(person.fams || [])])];
  const families = await Promise.all(familyIds.map((fid) => getOne(database, "families", fid)));
  const familyById = new Map(families.filter(Boolean).map((f) => [f.id, f]));

  const parentIds = new Set();
  const siblingIds = new Set();
  for (const fid of person.famc || []) {
    const fam = familyById.get(fid);
    if (!fam) continue;
    if (fam.husband) parentIds.add(fam.husband);
    if (fam.wife) parentIds.add(fam.wife);
    for (const c of fam.children) if (c !== personId) siblingIds.add(c);
  }

  const unions = [];
  for (const fid of person.fams || []) {
    const fam = familyById.get(fid);
    if (!fam) continue;
    const spouseId = fam.husband === personId ? fam.wife : fam.husband;
    unions.push({ familyId: fid, spouseId, childIds: fam.children, family: fam });
  }

  const idsToLoad = [...parentIds, ...siblingIds, ...unions.flatMap((u) => [u.spouseId, ...u.childIds])].filter(
    Boolean
  );
  const loaded = await Promise.all([...new Set(idsToLoad)].map((id) => getOne(database, "people", id)));
  const peopleById = new Map(loaded.filter(Boolean).map((p) => [p.id, p]));

  return {
    person,
    parents: [...parentIds].map((id) => peopleById.get(id)).filter(Boolean),
    siblings: [...siblingIds].map((id) => peopleById.get(id)).filter(Boolean),
    unions: unions.map((u) => ({
      familyId: u.familyId,
      family: u.family,
      spouse: u.spouseId ? peopleById.get(u.spouseId) : null,
      children: u.childIds.map((id) => peopleById.get(id)).filter(Boolean),
    })),
  };
}

export async function exportBackup() {
  const database = await db();
  const [people, families] = await Promise.all([getAll(database, "people"), getAll(database, "families")]);
  return {
    exportedAt: new Date().toISOString(),
    app: "genealogia-webapp",
    version: 1,
    people,
    families,
  };
}
