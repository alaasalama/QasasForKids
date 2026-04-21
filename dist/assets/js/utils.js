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
  // Merge query parameters and hash parameters, with hash taking precedence
  const out = {};
  const search = new URLSearchParams(location.search || "");
  for (const [k, v] of search.entries()) out[k] = v;
  const hash = location.hash.startsWith("#") ? location.hash.substring(1) : location.hash;
  const h = new URLSearchParams(hash || "");
  for (const [k, v] of h.entries()) out[k] = v;
  return out;
}

function setHashParams(obj) {
  const usp = new URLSearchParams(obj);
  location.hash = usp.toString();
}

function scrollIntoViewCentered(node) {
  node?.scrollIntoView({ behavior: "smooth", block: "center" });
}

// Scroll-to-top button (injects once per page)
function initScrollTopButton(opts = {}) {
  // Lower threshold to show sooner on small screens
  let threshold = Number(opts.threshold ?? 0);
  if (!threshold || Number.isNaN(threshold)) {
    threshold = Math.min(300, Math.floor(window.innerHeight * 0.6));
  }
  if (document.getElementById('scroll-top')) return; // already added
  const btn = el('button', { id: 'scroll-top', class: 'scroll-top-btn', 'aria-label': 'إلى الأعلى', title: 'إلى الأعلى' }, '▲');
  document.body.appendChild(btn);
  const toggle = () => {
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    if (y > threshold) btn.classList.add('visible'); else btn.classList.remove('visible');
  };
  window.addEventListener('scroll', toggle, { passive: true });
  window.addEventListener('load', toggle);
  window.addEventListener('resize', toggle);
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// Expose in global scope for simplicity
window.qqkUtils = { slugify, debounce, el, showToast, fetchJSON, parseHashParams, setHashParams, scrollIntoViewCentered, initScrollTopButton };
