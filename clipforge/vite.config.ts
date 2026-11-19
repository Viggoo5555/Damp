import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Hosts are provided by the environment when previewing on a shared VM.
const extraHosts = (process.env.VITE_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

export default defineConfig({
  // Relative base so the same build works from a web server and from file:// inside Electron.
  base: "./",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    allowedHosts: extraHosts.length ? extraHosts : undefined,
  },
  preview: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
  },
});
