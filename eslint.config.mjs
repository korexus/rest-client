import { defineConfig } from "eslint/config";
import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import chaiFriendly from "eslint-plugin-chai-friendly";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([{
    extends: fixupConfigRules(compat.extends(
        "prettier",
        "plugin:@typescript-eslint/recommended",
        "plugin:import/errors",
        "plugin:import/warnings",
        "plugin:import/typescript",
    )),

    plugins: {
        "chai-friendly": chaiFriendly,
        "@typescript-eslint": fixupPluginRules(typescriptEslint),
    },

    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.mocha,
            expect: true,
        },

        parser: tsParser,
        ecmaVersion: 9,
        sourceType: "commonjs",
    },

    rules: {
        "max-depth": ["error", 3],
        "import/no-mutable-exports": 0,
        "import/extensions": 0,

        "import/no-extraneous-dependencies": ["error", {
            devDependencies: ["**/*.test.ts"],
        }],

        "no-case-declarations": 0,
        "no-console": 0,
        "no-plusplus": 0,
        "no-restricted-syntax": 0,
        "no-await-in-loop": 0,
        "no-mutable-exports": 0,
        "no-underscore-dangle": 0,
        "no-unused-expressions": 0,

        "prefer-destructuring": ["error", {
            array: false,
            object: true,
        }, {
            enforceForRenamedProperties: false,
        }],

        "chai-friendly/no-unused-expressions": 2,

        "no-undef": ["error"],
        "no-use-before-define": ["error", {
            functions: false,
        }],

        "max-len": [2, {
            code: 120,
            ignoreStrings: true,
            ignoreTemplateLiterals: true,
            ignoreComments: true,
        }],

        "class-methods-use-this": "off",
        semi: "error",
    },
}, {
    files: ["**/*.ts"],

    rules: {
        "lines-between-class-members": ["error", "always", {
            exceptAfterSingleLine: true,
        }],

        "no-useless-constructor": 0,
        "@typescript-eslint/no-explicit-any": 0,
        "@typescript-eslint/no-unused-expressions": 0,
        "@typescript-eslint/no-useless-constructor": ["error"],
    },
}]);