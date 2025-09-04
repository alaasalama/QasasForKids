// utils.js - shared helpers

// Simple slugify for English names to id fallback
function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Debounce utility
function debounce(fn, delay = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// DOM helpers
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.substring(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  });
  if (!Array.isArray(children)) children = [children];
  for (const c of children) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

function showToast(message, ms = 3000) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = message;
  t.hidden = false;
  setTimeout(() => (t.hidden = true), ms);
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

function parseHashParams() {
  const hash = location.hash.startsWith("#") ? location.hash.substring(1) : location.hash;
  const params = new URLSearchParams(hash);
  const out = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

function setHashParams(obj) {
  const usp = new URLSearchParams(obj);
  location.hash = usp.toString();
}

function scrollIntoViewCentered(node) {
  node?.scrollIntoView({ behavior: "smooth", block: "center" });
}

// Expose in global scope for simplicity
window.qqkUtils = { slugify, debounce, el, showToast, fetchJSON, parseHashParams, setHashParams, scrollIntoViewCentered };
