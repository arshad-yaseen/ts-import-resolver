import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
    type ResolveTypeScriptImportPathOptions,
    resolveTypeScriptImportPath,
} from "../src";

const TEST_DIR = join(process.cwd(), "test");
const PROJECT_DIR = join(TEST_DIR, ".project");

export function createProject(tree: Record<string, string>): void {
    if (!existsSync(PROJECT_DIR)) {
        mkdirSync(PROJECT_DIR, { recursive: true });
    }

    for (const [key, value] of Object.entries(tree)) {
        const filePath = join(PROJECT_DIR, key);
        const dirPath = dirname(filePath);
        mkdirSync(dirPath, { recursive: true });
        writeFileSync(filePath, value as string, "utf-8");
    }
}

export function cleanProjectDir(): void {
    if (existsSync(PROJECT_DIR)) {
        rmSync(PROJECT_DIR, { recursive: true, force: true });
        mkdirSync(PROJECT_DIR, { recursive: true });
    }
}

export function run(
    options: Omit<ResolveTypeScriptImportPathOptions, "rootDir">,
): string | null {
    return resolveTypeScriptImportPath({
        ...(options as ResolveTypeScriptImportPathOptions),
        rootDir: PROJECT_DIR,
    });
}

export function resolveProjectPath(relativePath?: string): string {
    return join(PROJECT_DIR, relativePath ?? "");
}
