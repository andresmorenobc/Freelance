# Blog automatizado

Un blog que se publica solo: la IA (Claude) escribe artículos nuevos según un
calendario, se construyen como páginas HTML con el estilo del portfolio y se
publican en el sitio. No necesitas tocar código para el día a día.

## Cómo funciona

```
blog/posts/*.md   →   scripts/build-blog.mjs   →   blog/index.html + blog/<post>.html
   (contenido)              (motor de build)              (páginas finales)

scripts/generate-post.mjs  →  crea un .md nuevo pidiéndoselo a Claude
.github/workflows/auto-blog.yml  →  hace todo lo anterior solo, cada semana
```

- **`blog/posts/`** — un archivo Markdown por artículo (la fuente).
- **`scripts/build-blog.mjs`** — convierte los `.md` en HTML y arma el índice. Sin dependencias.
- **`scripts/generate-post.mjs`** — pide a Claude un artículo nuevo y lo guarda como `.md`.
- **`.github/workflows/auto-blog.yml`** — genera + construye + publica automáticamente.
- **`blog/blog.css`** — estilos del blog (heredan el design system del portfolio).

## Puesta en marcha (una sola vez)

1. **Consigue una API key de Anthropic** en https://console.anthropic.com → *API Keys*.
2. En GitHub, ve a **Settings → Secrets and variables → Actions → New repository secret**:
   - Nombre: `ANTHROPIC_API_KEY`
   - Valor: tu clave `sk-ant-...`
3. (Opcional) En la pestaña **Variables** crea `BLOG_MODEL` si quieres otro modelo
   (por defecto usa `claude-sonnet-4-6`, buen equilibrio calidad/coste).

¡Listo! A partir de ahí el blog se publica solo.

## Frecuencia de publicación

En `.github/workflows/auto-blog.yml`, la línea del `cron` controla cuándo se publica:

```yaml
schedule:
  - cron: "0 9 * * 1"   # cada lunes a las 09:00 UTC
```

- Diario: `0 9 * * *`
- Dos veces por semana (lunes y jueves): `0 9 * * 1,4`
- Primer día de cada mes: `0 9 1 * *`

## Publicar un artículo ahora mismo (manual)

En GitHub: pestaña **Actions → Blog automático → Run workflow**. Puedes escribir
un tema concreto o dejarlo vacío para que la IA elija.

## Uso desde tu ordenador (opcional)

```bash
# Generar un artículo nuevo (necesita la clave en el entorno)
export ANTHROPIC_API_KEY=sk-ant-...
npm run blog:new                       # tema aleatorio
npm run blog:new "Tipografía cinética" # tema concreto

# Reconstruir el blog tras editar/añadir un .md
npm run blog:build

# Las dos cosas a la vez
npm run blog:auto
```

## Escribir un artículo a mano

Crea un archivo en `blog/posts/`, por ejemplo `2026-07-01-mi-articulo.md`:

```markdown
---
title: "Mi título"
date: 2026-07-01
excerpt: "Un resumen corto para la tarjeta del blog."
tags: Motion Design, Estrategia
generatedBy: human
---

## Primer subtítulo

Tu contenido en Markdown. Soporta **negrita**, *cursiva*, `código`,
[enlaces](https://ejemplo.com), listas, citas (>) y bloques de código.
```

Luego `npm run blog:build` y listo.

## Publicación (Vercel)

El sitio ya se despliega en Vercel desde este repo. Cuando el workflow hace
`push` de un artículo nuevo, Vercel lo detecta y redespliega solo. El blog
queda en `tu-dominio.com/blog/`.
