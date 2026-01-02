import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
    {
        files: ["**/*.ts"],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            "no-unused-vars": "off", // Handled by TS
            "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
            "@typescript-eslint/no-explicit-any": "warn"
        },
        ignores: ["lib/**/*", "node_modules/**/*"]
    }
];