import xo from "eslint-config-xo";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/test-results/**",
      "**/*.min.js",
    ],
  },
  ...xo(),
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,tsx}"],
    rules: {
      indent: "off",
      quotes: "off",
      semi: "off",
      "comma-dangle": "off",
      "object-curly-spacing": "off",
      "array-bracket-spacing": "off",
      "@stylistic/indent": "off",
      "@stylistic/quotes": "off",
      "@stylistic/semi": "off",
      "@stylistic/comma-dangle": "off",
      "@stylistic/object-curly-spacing": "off",
      "@stylistic/array-bracket-spacing": "off",
      complexity: ["warn", 8],
      "max-depth": ["warn", 3],
      "max-lines": ["warn", 200],
      "max-lines-per-function": ["warn", 80],
      "max-params": ["warn", 4],
    },
  },
]);
