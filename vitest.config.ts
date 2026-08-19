import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * `dir` limita la radice della scansione a `src`. Non e' un dettaglio
     * cosmetico: senza, il runner attraversa anche `.next` e su un build di
     * produzione esaurisce la memoria del processo prima ancora di raccogliere
     * i test.
     */
    dir: "src",
    include: ["engine/__tests__/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/out/**"],
    environment: "node",
  },
});
