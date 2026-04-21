#!/usr/bin/env node
// Build: inject GA and CONTACT into HTML at compile time
// Usage:
//   GA_ID=G-XXXX CONTACT_EMAIL=me@example.com node scripts/build.js
//   or create .env.dev / .env.production with lines like GA_ID=..., CONTACT_EMAIL=...
//
// Quick deploy commands:
// - Dev preview: npm run deploy:dev
// - Production:  npm run deploy:prod

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..', 'public');
const OUT_DIR = path.resolve(__dirname, '..', 'dist');

function loadEnvFile(name) {
  const p = path.resolve(__dirname, '..', `.env.${name}`);
  if (!fs.existsSync(p)) return {};
  const out = {};
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

// Merge env: explicit NODE_ENV file -> defaults
const nodeEnv = process.env.NODE_ENV || 'production';
const fileEnv = { ...loadEnvFile('local'), ...loadEnvFile(nodeEnv) };
const GA_ID = process.env.GA_ID || fileEnv.GA_ID || '';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || fileEnv.CONTACT_EMAIL || '';

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  for (const e of fs.readdirSync(p)) {
    const ep = path.join(p, e);
    const st = fs.lstatSync(ep);
    if (st.isDirectory()) rmrf(ep); else fs.unlinkSync(ep);
  }
  fs.rmdirSync(p);
}

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function injectIntoHtml(html) {
  let out = html;
  if (GA_ID) {
    const snippet = `\n<script>(function(w,d){\n  if(w._gaInjected) return; w._gaInjected = true;\n  if(!d.getElementById('ga-gtag-js')){\n    var s=d.createElement('script'); s.id='ga-gtag-js'; s.async=true; s.src='https://www.googletagmanager.com/gtag/js?id=${GA_ID}';\n    (d.head||d.documentElement).appendChild(s);\n  }\n  w.dataLayer=w.dataLayer||[];\n  function gtag(){w.dataLayer.push(arguments);}\n  if(!w._gaInit){ gtag('js', new Date()); gtag('config', '${GA_ID}'); w._gaInit=true; }\n})(window,document);</script>\n`;
    out = out.replace(/<head(\s[^>]*)?>/i, (m) => m + snippet);
  }
  if (CONTACT_EMAIL) {
    out = out.replace(/<form([^>]*\bid=["']contact-form["'][^>]*)>/i, (m, attrs) => {
      if (/data-email=/.test(attrs)) return m;
      return `<form${attrs} data-email="${CONTACT_EMAIL}">`;
    });
  }
  return out;
}

function copyRecursive(src, dest) {
  const st = fs.lstatSync(src);
  if (st.isDirectory()) {
    ensureDir(dest);
    for (const e of fs.readdirSync(src)) copyRecursive(path.join(src, e), path.join(dest, e));
  } else {
    if (src.endsWith('.html')) {
      const html = fs.readFileSync(src, 'utf8');
      fs.writeFileSync(dest, injectIntoHtml(html));
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

console.log(`Building site from ${SRC_DIR} -> ${OUT_DIR} (env: ${nodeEnv})`);
rmrf(OUT_DIR);
ensureDir(OUT_DIR);
copyRecursive(SRC_DIR, OUT_DIR);
console.log('Build complete.');
