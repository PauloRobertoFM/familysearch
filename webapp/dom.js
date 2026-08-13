/**
 * Minimal, safe DOM-builder helper. Deliberately never touches innerHTML/
 * outerHTML — text children become real Text nodes (auto-escaped by the
 * DOM) and attributes go through setAttribute, so there is no HTML-parsing
 * sink to inject into, even with untrusted data (e.g. names/places coming
 * from an imported GEDCOM file).
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "class") {
      el.className = value;
    } else if (key === "dataset") {
      Object.assign(el.dataset, value);
    } else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      el.setAttribute(key, value);
    }
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(el) {
  el.replaceChildren();
}

export function text(el, value) {
  clear(el);
  el.appendChild(document.createTextNode(String(value ?? "")));
}
