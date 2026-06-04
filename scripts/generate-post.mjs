#!/usr/bin/env node
/**
 * generate-post.mjs — Pide a Claude un artículo nuevo y lo guarda como .md.
 *
 * Requisitos:
 *   - Variable de entorno ANTHROPIC_API_KEY (clave de la API de Anthropic).
 *   - Node 18+ (usa fetch nativo).
 *
 * Uso:
 *   ANTHROPIC_API_KEY=sk-... node scripts/generate-post.mjs
 *   node scripts/generate-post.mjs "Tema opcional para el artículo"
 *
 * El artículo se escribe en blog/posts/AAAA-MM-DD-slug.md
 * Después, scripts/build-blog.mjs lo convierte en HTML.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "blog", "posts");

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.BLOG_MODEL || "claude-sonnet-4-6";

// Temas base del nicho de Gonzalo (motion + estrategia). La IA elige un ángulo fresco.
const TOPICS = [
  "Cómo el motion design refuerza la identidad de una marca",
  "Principios de animación que todo diseñador debería dominar",
  "Diseñar sistemas de movimiento coherentes para un producto digital",
  "El rol de la estrategia creativa antes de abrir After Effects",
  "Microinteracciones: por qué los pequeños detalles venden",
  "Cómo construir un showreel que consiga clientes",
  "Storytelling en motion: ritmo, pausa y tensión",
  "De brief a entrega: un proceso de motion design que escala",
  "Tipografía cinética: cuándo el texto debe moverse",
  "Cómo medir el impacto del motion design en una campaña",
  "Tendencias de motion design y cuáles vale la pena ignorar",
  "Colaborar con equipos de producto sin perder la visión creativa",
];

function slugify(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70);
}

function existingTitles() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR).filter(f => f.endsWith(".md")).map(f => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, f), "utf8");
    const m = raw.match(/title:\s*(.+)/);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
  }).filter(Boolean);
}

async function generate() {
  if (!API_KEY) {
    console.error("✗ Falta ANTHROPIC_API_KEY. Configúrala como secret/variable de entorno.");
    process.exit(1);
  }

  const cliTopic = process.argv.slice(2).join(" ").trim();
  const topic = cliTopic || TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const previous = existingTitles();

  const system = `Eres Gonzalo Moreno, motion designer y estratega creativo con años de experiencia.
Escribes en español, en primera persona, con voz cercana y profesional. Tu blog es parte de tu portfolio,
así que demuestras criterio sin sonar a anuncio. Evitas el relleno y los clichés de IA.`;

  const prompt = `Escribe un artículo de blog original sobre este tema: "${topic}".

Requisitos:
- Entre 600 y 900 palabras.
- Markdown: usa "##" y "###" para subtítulos (NO uses "#", el título va aparte).
- Incluye una idea accionable o un ejemplo concreto de tu experiencia.
- Tono humano, con opinión. Nada de "en el mundo actual..." ni introducciones genéricas.
${previous.length ? `- Evita repetir estos títulos ya publicados: ${previous.join("; ")}.` : ""}

Devuelve ÚNICAMENTE un objeto JSON válido (sin texto antes ni después, sin bloques de código) con esta forma exacta:
{
  "title": "Título del artículo (sin comillas internas)",
  "excerpt": "Resumen de 1-2 frases para la tarjeta del blog",
  "tags": ["Etiqueta1", "Etiqueta2"],
  "body": "Cuerpo del artículo en Markdown"
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    console.error(`✗ Error de la API (${res.status}): ${await res.text()}`);
    process.exit(1);
  }

  const data = await res.json();
  let text = (data.content || []).map(b => b.text || "").join("").trim();
  // Por si el modelo envuelve la respuesta en ```json ... ```
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  let post;
  try {
    post = JSON.parse(text);
  } catch (e) {
    console.error("✗ No se pudo parsear la respuesta como JSON:\n", text.slice(0, 500));
    process.exit(1);
  }

  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(post.title);
  const tags = Array.isArray(post.tags) ? post.tags.join(", ") : "";
  const safe = v => String(v).replace(/\n/g, " ").replace(/"/g, "'");

  const frontmatter =
`---
title: "${safe(post.title)}"
date: ${date}
excerpt: "${safe(post.excerpt)}"
tags: ${tags}
generatedBy: ai
---

${post.body.trim()}
`;

  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
  const filename = `${date}-${slug}.md`;
  fs.writeFileSync(path.join(POSTS_DIR, filename), frontmatter);
  console.log(`✓ Artículo generado: blog/posts/${filename}`);
  console.log(`  Título: ${post.title}`);
}

generate().catch(err => { console.error(err); process.exit(1); });
