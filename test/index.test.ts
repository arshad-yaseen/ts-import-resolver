import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTypeScriptImportPath } from "../src";

const rootDir = process.cwd();

describe("resolveTypeScriptImportPath", () => {
    const basicTsconfig = {
        compilerOptions: {
            baseUrl: ".",
            paths: {
                "@/*": ["src/*"],
            },
            rootDir: "./src",
        },
    };

    it("should resolve a relative path", () => {
        const result = resolveTypeScriptImportPath({
            path: "../src/index",
            importer: path.resolve(rootDir, "test/index.test.ts"),
            tsconfig: basicTsconfig,
            rootDir,
        });

        expect(result).toBeTruthy();
        expect(result).toContain(path.join(rootDir, "src/index"));
    });

    it("should return null for non-existent paths", () => {
        const result = resolveTypeScriptImportPath({
            path: "./non-existent-file",
            importer: path.resolve(rootDir, "test/index.test.ts"),
            tsconfig: basicTsconfig,
            rootDir,
        });

        expect(result).toBeNull();
    });

    it("should return null if tsconfig is null", () => {
        const result = resolveTypeScriptImportPath({
            path: "../src/index",
            importer: path.resolve(rootDir, "test/index.test.ts"),
            tsconfig: null,
            rootDir,
        });

        expect(result).toBeNull();
    });

    it("should resolve path aliases defined in tsconfig", () => {
        const result = resolveTypeScriptImportPath({
            path: "@/index",
            importer: path.resolve(rootDir, "test/index.test.ts"),
            tsconfig: basicTsconfig,
            rootDir,
        });

        expect(result).toBeTruthy();
        expect(result).toContain(path.join(rootDir, "src/index"));
    });

    it("should handle complex path resolution", () => {
        const complexTsconfig = {
            compilerOptions: {
                baseUrl: ".",
                paths: {
                    "@/*": ["src/*"],
                    "~utils/*": ["src/utils/*"],
                    "lib/*": ["src/lib/*"],
                },
                rootDir: "./src",
            },
        };

        const testFilePath = path.resolve(rootDir, "src/utils/helper.ts");
        const testFileDir = path.dirname(testFilePath);

        if (fs.existsSync(testFileDir)) {
            const result = resolveTypeScriptImportPath({
                path: "~utils/helper",
                importer: path.resolve(rootDir, "test/index.test.ts"),
                tsconfig: complexTsconfig,
                rootDir,
            });

            if (fs.existsSync(testFilePath)) {
                expect(result).toBeTruthy();
                expect(result).toContain(
                    path.join(rootDir, "src/utils/helper"),
                );
            } else {
                expect(result).toBeNull();
            }
        }
    });

    it("should return null for node_modules paths", () => {
        const result = resolveTypeScriptImportPath({
            path: "typescript",
            importer: path.resolve(rootDir, "test/index.test.ts"),
            tsconfig: basicTsconfig,
            rootDir,
        });

        expect(result).toBeNull();
    });
});
