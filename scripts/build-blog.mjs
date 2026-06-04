#!/usr/bin/env node
/**
 * build-blog.mjs — Construye el blog a partir de los .md en blog/posts/.
 *
 * - Lee cada archivo Markdown con "frontmatter" (metadatos entre --- ... ---).
 * - Genera una página HTML por artículo: blog/<slug>.html
 * - Genera el índice del blog: blog/index.html
 *
 * No usa dependencias externas: corre con `node scripts/build-blog.mjs`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "blog", "posts");
const OUT_DIR = path.join(ROOT, "blog");

/* ----------------------------- utilidades ----------------------------- */
const esc = (s = "") =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;");

function slugify(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70);
}

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
}

function readingTime(text) {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/* --------------------------- parse frontmatter ------------------------- */
function parsePost(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  const meta = {};
  let body = raw;
  if (m) {
    body = m[2];
    for (const line of m[1].split("\n")) {
      const i = line.indexOf(":");
      if (i === -1) continue;
      const key = line.slice(0, i).trim();
      let val = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      meta[key] = val;
    }
  }
  meta.tags = (meta.tags || "").split(",").map(t => t.trim()).filter(Boolean);
  return { meta, body: body.trim() };
}

/* --------------------------- markdown -> html -------------------------- */
// Renderizador compacto: titulares, párrafos, listas, citas, código,
// negrita/cursiva, enlaces y reglas horizontales. Suficiente para artículos.
function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, h) => `<a href="${h}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  return s;
}

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let para = [];
  const flushPara = () => {
    if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Bloque de código ```
    if (/^```/.test(line)) {
      flushPara();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }
    // Regla horizontal
    if (/^---+\s*$/.test(line) || /^\*\*\*+\s*$/.test(line)) {
      flushPara(); out.push("<hr>"); i++; continue;
    }
    // Titulares
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushPara();
      // El título del artículo ya es <h1>; en el cuerpo "##" -> h2, "###" -> h3.
      const lvl = Math.min(4, Math.max(2, h[1].length));
      out.push(`<h${lvl}>${inline(h[2].trim())}</h${lvl}>`);
      i++; continue;
    }
    // Cita
    if (/^>\s?/.test(line)) {
      flushPara();
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }
    // Lista no ordenada
    if (/^[-*+]\s+/.test(line)) {
      flushPara();
      const buf = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        buf.push(`<li>${inline(lines[i].replace(/^[-*+]\s+/, ""))}</li>`); i++;
      }
      out.push(`<ul>${buf.join("")}</ul>`);
      continue;
    }
    // Lista ordenada
    if (/^\d+\.\s+/.test(line)) {
      flushPara();
      const buf = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        buf.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, ""))}</li>`); i++;
      }
      out.push(`<ol>${buf.join("")}</ol>`);
      continue;
    }
    // Línea en blanco -> fin de párrafo
    if (/^\s*$/.test(line)) { flushPara(); i++; continue; }
    // Texto normal -> acumula en párrafo
    para.push(line.trim()); i++;
  }
  flushPara();
  return out.join("\n");
}

/* ------------------------------ plantillas ----------------------------- */
const HEAD = (title, desc) => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..600&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="./blog.css">
</head>
<body>`;

const HEADER = (base = "./") => `
<header>
  <div class="wrap nav">
    <a class="brand" href="${base}../index.html">
      <div class="logo">
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <text x="2" y="30" font-family="Fraunces, serif" font-size="32" font-weight="400" fill="#0d0e14" letter-spacing="-1">G</text>
          <text x="20" y="30" font-family="Fraunces, serif" font-size="32" font-weight="400" fill="#a9a9b4" letter-spacing="-1">M</text>
        </svg>
      </div>
      <div class="brand-text">
        <b>GONZALO MORENO</b>
        <span>Motion Designer &amp; Strategist</span>
      </div>
    </a>
    <nav aria-label="Main navigation">
      <ul>
        <li><a href="${base}../index.html#work">Work</a></li>
        <li><a href="${base}../index.html#services">Services</a></li>
        <li><a href="${base}../index.html#process">Process</a></li>
        <li><a href="${base}index.html" class="active">Blog</a></li>
        <li><a href="${base}../index.html#contact">Contact</a></li>
      </ul>
    </nav>
    <div class="nav-right">
      <a href="${base}../index.html#contact" class="btn btn-primary">Let's Work Together
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19L19 5M19 5H8M19 5V16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>
    </div>
  </div>
</header>`;

const FOOTER = `
<footer class="site">
  <div class="wrap row">
    <div>© ${new Date().getFullYear()} Gonzalo Moreno. All rights reserved.</div>
    <div class="links">
      <a href="#" rel="noopener noreferrer">Dribbble</a>
      <a href="#" rel="noopener noreferrer">LinkedIn</a>
      <a href="#" rel="noopener noreferrer">Instagram</a>
    </div>
  </div>
</footer>
</body>
</html>`;

const ARROW = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19L19 5M19 5H8M19 5V16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ------------------------------- artículo ------------------------------ */
function renderArticle(post) {
  const { meta, body } = post;
  const tags = meta.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("");
  const aiBadge = (meta.generatedBy || "").toLowerCase() === "ai"
    ? `<span class="ai-badge"><span class="pulse"></span>Escrito con IA</span>` : "";
  return `${HEAD(meta.title + " — Gonzalo Moreno", meta.excerpt || "")}
${HEADER("./")}
<main class="article">
  <div class="wrap">
    <div class="article-back"><a href="./index.html">${ARROW} Volver al blog</a></div>
    <div class="article-head">
      <div class="meta">
        <span>${formatDate(meta.date)}</span><span class="dot"></span>
        <span>${readingTime(body)} min de lectura</span>
        ${aiBadge ? '<span class="dot"></span>' + aiBadge : ""}
      </div>
      <h1>${esc(meta.title)}</h1>
      ${meta.excerpt ? `<p class="lead">${esc(meta.excerpt)}</p>` : ""}
      <div class="tags" style="margin-top:18px">${tags}</div>
    </div>
    <article class="article-body">
${renderMarkdown(body)}
    </article>
  </div>
</main>
${FOOTER}`;
}

/* -------------------------------- índice ------------------------------- */
function renderIndex(posts) {
  const cards = posts.map(p => {
    const tags = p.meta.tags.slice(0, 2).map(t => `<span class="tag">${esc(t)}</span>`).join("");
    return `      <a class="post-card" href="./${p.slug}.html">
        <div class="meta"><span>${formatDate(p.meta.date)}</span><span class="dot"></span><span>${readingTime(p.body)} min</span></div>
        <h2>${esc(p.meta.title)}</h2>
        <p>${esc(p.meta.excerpt || "")}</p>
        <div class="tags">${tags}</div>
        <span class="read-more">Leer artículo ${ARROW}</span>
      </a>`;
  }).join("\n");

  const grid = posts.length
    ? `<div class="post-grid">\n${cards}\n    </div>`
    : `<div class="empty"><p>Aún no hay artículos publicados. El primero llegará pronto.</p></div>`;

  return `${HEAD("Blog — Gonzalo Moreno", "Ideas sobre motion design, estrategia creativa y sistemas de diseño.")}
${HEADER("./")}
<main>
  <section class="blog-hero">
    <div class="wrap">
      <span class="eyebrow">El Blog</span>
      <h1>Notas sobre <span class="serif">movimiento</span>, estrategia y sistemas.</h1>
      <p>Artículos sobre motion design, estrategia creativa y cómo construir marcas que se mueven con propósito.</p>
    </div>
  </section>
  <section class="posts">
    <div class="wrap">
      ${grid}
    </div>
  </section>
</main>
${FOOTER}`;
}

/* -------------------------------- main --------------------------------- */
function main() {
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith(".md"));

  const posts = files.map(f => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, f), "utf8");
    const parsed = parsePost(raw);
    const slug = parsed.meta.slug || slugify(parsed.meta.title || path.basename(f, ".md"));
    return { ...parsed, slug, file: f };
  }).sort((a, b) => new Date(b.meta.date) - new Date(a.meta.date));

  for (const p of posts) {
    fs.writeFileSync(path.join(OUT_DIR, `${p.slug}.html`), renderArticle(p));
  }
  fs.writeFileSync(path.join(OUT_DIR, "index.html"), renderIndex(posts));

  console.log(`✓ Blog construido: ${posts.length} artículo(s).`);
  posts.forEach(p => console.log(`  · ${p.slug}.html`));
}

main();
