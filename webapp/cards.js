import { fullName, lifespan } from "./gedcom.js";
import { VALIDATION_LABELS } from "./store.js";

function initials(person) {
  const parts = `${person.givenName} ${person.surname}`.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function sexClass(person) {
  const sex = (person.sex || "").toUpperCase();
  if (sex === "M") return "sex-m";
  if (sex === "F") return "sex-f";
  return "sex-u";
}

const STATUS_ICON = { unverified: "?", partial: "~", verified: "✓" };

/**
 * Builds a person card element.
 * mode: "focus" (opens ficha on tap) | "relative" (recenters the tree on tap,
 * plus an explicit link to open the ficha).
 */
export function personCard(person, mode = "relative") {
  const el = document.createElement("div");
  const status = person.validationStatus || "unverified";
  el.className = `p-card ${sexClass(person)} status-${status} ${mode === "focus" ? "is-focus" : ""}`;
  el.dataset.id = person.id;

  el.innerHTML = `
    <div class="p-card-top">
      <div class="p-avatar">${initials(person)}</div>
      <span class="status-dot" title="Status: ${VALIDATION_LABELS[status]}">${STATUS_ICON[status]}</span>
    </div>
    <div class="p-name">${escapeHtml(fullName(person))}</div>
    <div class="p-years">${escapeHtml(lifespan(person)) || "&nbsp;"}</div>
    <div class="p-id">#${escapeHtml(person.id)}</div>
    ${mode === "relative" ? `<a class="p-ficha-link" href="#/person/${person.id}">Ver ficha →</a>` : ""}
  `;

  if (mode === "relative") {
    el.addEventListener("click", (e) => {
      if (e.target.closest(".p-ficha-link")) return;
      window.location.hash = `#/tree/${person.id}`;
    });
  } else {
    el.addEventListener("click", () => {
      window.location.hash = `#/person/${person.id}`;
    });
  }

  return el;
}

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
