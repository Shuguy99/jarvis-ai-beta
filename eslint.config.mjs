import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react-hooks";
import reactRefreshPlugin from "eslint-plugin-react-refresh";

const eslintConfig = [
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactPlugin,
      "react-refresh": reactRefreshPlugin,
    },
    rules: {
      // TypeScript — senior-level enforcement
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/prefer-as-const": "error",
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],

      // React — catch bugs early
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react/no-unescaped-entities": "off",
      "react/display-name": "off",
      "react/prop-types": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // JavaScript quality
      "prefer-const": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "warn",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-irregular-whitespace": "off",
      "no-case-declarations": "error",
      "no-fallthrough": ["error", { commentPattern: "falls?through" }],
      "no-mixed-spaces-and-tabs": "error",
      "no-redeclare": "error",
      "no-undef": "off", // handled by TS
      "no-unreachable": "error",
      "no-useless-escape": "off",
      "eqeqeq": ["error", "always"],
      "curly": ["error", "multi-line"],
    },
  },
  {
    ignores: ["node_modules/**", "dist/**", "server/dist/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills", "electron/**", "tailwind.config.ts"]
  }
];

export default eslintConfig;