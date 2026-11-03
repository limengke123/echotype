import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * `/llm/*` is proxied to the local Ollama server so the browser never hits a
 * cross-origin request. Ollama does not send CORS headers for unknown origins
 * unless OLLAMA_ORIGINS is configured, which is a confusing failure mode for a
 * first-run user, so we route everything through the dev/preview server.
 *
 * The `/llm` prefix is stripped: `/llm/v1/chat/completions` is forwarded to
 * `http://127.0.0.1:11434/v1/chat/completions`, `/llm/api/tags` to `/api/tags`.
 */
const OLLAMA_TARGET = process.env.ECHOTYPE_OLLAMA_URL ?? "http://127.0.0.1:11434";

const ollamaProxy = {
  target: OLLAMA_TARGET,
  changeOrigin: true,
  rewrite: (path: string) => path.replace(/^\/llm/, ""),
};

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react()],
  server: {
    proxy: { "/llm": ollamaProxy },
  },
  preview: {
    proxy: { "/llm": ollamaProxy },
  },
});
