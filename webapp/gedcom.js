const LINE_RE = /^(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s+(.*))?$/;

function stripPointer(value) {
  return (value || "").replace(/@/g, "").trim();
}

function newPerson(id) {
  return {
    id,
    givenName: "",
    surname: "",
    sex: "",
    birthDate: "",
    birthPlace: "",
    deathDate: "",
    deathPlace: "",
    famc: [],
    fams: [],
  };
}

function newFamily(id) {
  return {
    id,
    husband: null,
    wife: null,
    children: [],
    marriageDate: "",
    marriagePlace: "",
  };
}

/**
 * Parses GEDCOM 5.5.1 text into people/families/sources maps.
 * Mirrors the field set read by src/gedcom_loader.py (Python side),
 * since both need to agree on what a "person" record looks like.
 */
export function parseGedcom(text) {
  const lines = text.split(/\r\n|\r|\n/);
  const people = new Map();
  const families = new Map();
  const sources = new Map();

  let current = null; // { type: 'INDI' | 'FAM' | 'SOUR', id }
  let level1Tag = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;
    const m = line.match(LINE_RE);
    if (!m) continue;

    const level = parseInt(m[1], 10);
    const pointer = m[2] ? stripPointer(m[2]) : null;
    const tag = m[3];
    const value = m[4] || "";

    if (level === 0) {
      current = null;
      level1Tag = null;
      if (pointer && tag === "INDI") {
        current = { type: "INDI", id: pointer };
        people.set(pointer, newPerson(pointer));
      } else if (pointer && tag === "FAM") {
        current = { type: "FAM", id: pointer };
        families.set(pointer, newFamily(pointer));
      } else if (pointer && tag === "SOUR") {
        current = { type: "SOUR", id: pointer };
        sources.set(pointer, { id: pointer, title: "", author: "" });
      }
      continue;
    }

    if (!current) continue;

    if (current.type === "INDI") {
      const p = people.get(current.id);
      if (level === 1) {
        level1Tag = tag;
        if (tag === "NAME") {
          const nm = value.match(/^([^/]*)\/([^/]*)\/?\s*(.*)$/);
          if (nm) {
            p.givenName = nm[1].trim();
            p.surname = nm[2].trim();
          } else {
            p.givenName = value.trim();
          }
        } else if (tag === "SEX") {
          p.sex = value.trim();
        } else if (tag === "FAMC") {
          p.famc.push(stripPointer(value));
        } else if (tag === "FAMS") {
          p.fams.push(stripPointer(value));
        }
      } else if (level === 2) {
        if (level1Tag === "BIRT") {
          if (tag === "DATE") p.birthDate = value.trim();
          else if (tag === "PLAC") p.birthPlace = value.trim();
        } else if (level1Tag === "DEAT") {
          if (tag === "DATE") p.deathDate = value.trim();
          else if (tag === "PLAC") p.deathPlace = value.trim();
        }
      }
    } else if (current.type === "FAM") {
      const f = families.get(current.id);
      if (level === 1) {
        level1Tag = tag;
        if (tag === "HUSB") f.husband = stripPointer(value);
        else if (tag === "WIFE") f.wife = stripPointer(value);
        else if (tag === "CHIL") f.children.push(stripPointer(value));
      } else if (level === 2) {
        if (level1Tag === "MARR") {
          if (tag === "DATE") f.marriageDate = value.trim();
          else if (tag === "PLAC") f.marriagePlace = value.trim();
        }
      }
    } else if (current.type === "SOUR") {
      if (level === 1) {
        const s = sources.get(current.id);
        if (tag === "TITL") s.title = value.trim();
        else if (tag === "AUTH") s.author = value.trim();
      }
    }
  }

  return { people, families, sources };
}

export function fullName(person) {
  if (!person) return "(desconhecido)";
  const name = `${person.givenName} ${person.surname}`.trim();
  return name || "(sem nome)";
}

export function lifespan(person) {
  const birth = yearOf(person.birthDate);
  const death = yearOf(person.deathDate);
  if (!birth && !death) return "";
  if (birth && !death) return `${birth}–`;
  if (!birth && death) return `–${death}`;
  return `${birth}–${death}`;
}

export function yearOf(dateStr) {
  if (!dateStr) return "";
  const m = dateStr.match(/\b(\d{4})\b/);
  return m ? m[1] : "";
}
