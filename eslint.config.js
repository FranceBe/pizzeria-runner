import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  { ignores: ["dist", "coverage"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "detect" } },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      // Plain JavaScript project: no PropTypes.
      "react/prop-types": "off",
      // `const { toasts, ...saveData } = state` is how we drop a field.
      "no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
  {
    // Tests read source files from Node.
    files: ["**/*.test.{js,jsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
];
