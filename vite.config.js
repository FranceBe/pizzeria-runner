import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the built game also opens from a plain folder or a sub-path.
export default defineConfig({ plugins: [react()], base: "./" });
