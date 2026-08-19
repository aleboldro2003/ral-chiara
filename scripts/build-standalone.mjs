/**
 * Costruisce la versione a file singolo: un solo .html con CSS e JavaScript
 * incorporati, nessuna richiesta di rete, apribile ovunque anche senza server.
 *
 * Non duplica l'interfaccia: monta gli stessi componenti React dell'app Next.js
 * a partire da src/standalone.tsx. L'app resta il deliverable, questo file e' il
 * modo piu' corto per farla vedere.
 *
 *   node scripts/build-standalone.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";

const radice = join(dirname(fileURLToPath(import.meta.url)), "..");
const uscita = join(radice, "standalone");
const temporanea = join(uscita, ".tmp");

rmSync(uscita, { recursive: true, force: true });
mkdirSync(temporanea, { recursive: true });

// ---------------------------------------------------------------- CSS
// Tailwind scandisce i sorgenti e produce solo le classi effettivamente usate.
const cssSorgente = join(temporanea, "ingresso.css");
const cssCompilato = join(temporanea, "stile.css");
writeFileSync(cssSorgente, readFileSync(join(radice, "src/app/globals.css"), "utf-8"));

// Si invoca l'entry JS del CLI con lo stesso node, invece di passare da npx:
// su Windows spawnSync rifiuta i .cmd con EINVAL, e cosi' si evita anche un
// processo intermedio.
const tailwindCli = join(
  dirname(fileURLToPath(import.meta.resolve("@tailwindcss/cli/package.json"))),
  "dist/index.mjs",
);
execFileSync(
  process.execPath,
  [tailwindCli, "-i", cssSorgente, "-o", cssCompilato, "--minify"],
  { cwd: radice, stdio: "inherit" },
);

// ---------------------------------------------------------------- JavaScript
const bundle = await esbuild.build({
  entryPoints: [join(radice, "src/standalone.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2022"],
  jsx: "automatic",
  write: false,
  loader: { ".json": "json" },
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "@": join(radice, "src") },
  legalComments: "none",
});

const js = bundle.outputFiles[0].text;
const css = readFileSync(cssCompilato, "utf-8");

// ---------------------------------------------------------------- pagina
const pagina = `<title>RAL Chiara</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Sans:wght@400;450;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<meta name="description" content="Calcolatore da retribuzione annua lorda a netto per l'anno d'imposta 2026, con la scomposizione completa di ogni trattenuta e il riferimento normativo di ogni voce. Prototipo dimostrativo.">
<style>${css}</style>
<div id="radice"></div>
<noscript><p style="max-width:40rem;margin:3rem auto;padding:0 1.25rem;font:16px/1.6 system-ui,sans-serif;color:#1c1917">RAL Chiara calcola interamente nel browser, senza inviare nulla a un server. Per usarlo serve JavaScript attivo.</p></noscript>
<script>${js}</script>
`;

const destinazione = join(uscita, "ral-chiara.html");
writeFileSync(destinazione, pagina, "utf-8");
rmSync(temporanea, { recursive: true, force: true });

const kb = (statSync(destinazione).size / 1024).toFixed(0);
console.log(`standalone/ral-chiara.html — ${kb} kB (CSS ${(css.length / 1024).toFixed(0)} kB, JS ${(js.length / 1024).toFixed(0)} kB)`);
