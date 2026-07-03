import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
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
    "react-compiler/react-compiler": "off",

    // Next.js
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",

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
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills", "electron/**"]
}];

export default eslintConfig;