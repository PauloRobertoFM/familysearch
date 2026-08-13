import { fullName, lifespan } from "./gedcom.js";
import { VALIDATION_LABELS } from "./store.js";
import { h } from "./dom.js";

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
  const status = person.validationStatus || "unverified";
  const id = person.id;

  const cardChildren = [
    h(
      "div",
      { class: "p-card-top" },
      h("div", { class: "p-avatar" }, initials(person)),
      h("span", { class: "status-dot", title: `Status: ${VALIDATION_LABELS[status]}` }, STATUS_ICON[status])
    ),
    h("div", { class: "p-name" }, fullName(person)),
    h("div", { class: "p-years" }, lifespan(person) || " "),
    h("div", { class: "p-id" }, `#${id}`),
  ];
  if (mode === "relative") {
    cardChildren.push(h("a", { class: "p-ficha-link", href: `#/person/${id}` }, "Ver ficha →"));
  }

  const el = h(
    "div",
    {
      class: `p-card ${sexClass(person)} status-${status} ${mode === "focus" ? "is-focus" : ""}`,
      dataset: { id },
    },
    ...cardChildren
  );

  if (mode === "relative") {
    el.addEventListener("click", (e) => {
      if (e.target.closest(".p-ficha-link")) return;
      window.location.hash = `#/tree/${id}`;
    });
  } else {
    el.addEventListener("click", () => {
      window.location.hash = `#/person/${id}`;
    });
  }

  return el;
}
