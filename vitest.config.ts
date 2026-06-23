import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: [
      "src/floorplan/__tests__/**/*.test.ts",
      "src/app/lib/generatePrrDocx.test.ts",
      "src/app/lib/generateStatementDocx.test.ts",
      "src/app/lib/svgViewport.test.ts",
      "src/app/lib/floorplanEditor.textEdit.test.ts",
      "src/app/types/__tests__/**/*.test.ts",
      "src/app/lib/__tests__/**/*.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
