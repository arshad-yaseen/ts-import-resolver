import fs from "node:fs";
import path from "node:path";

interface TsConfig {
    compilerOptions?: CompilerOptions;
}

interface CompilerOptions {
    baseUrl?: string;
    paths?: Record<string, string[]>;
    allowJs?: boolean;
    resolveJsonModule?: boolean;
    moduleResolution?: "node" | "classic";
}

export interface ResolveTsImportPathOptions {
    path: string;
    importer: string;
    tsconfig: TsConfig | null | undefined;
    cwd: string;
}

interface ParsedCompilerOptions {
    baseUrl: string;
    paths: Record<string, string[]>;
    extensions: string[];
}

const JS_TO_TS_MAPPINGS: Record<string, string[]> = {
    ".js": [".ts", ".tsx", ".d.ts"],
    ".mjs": [".mts", ".d.mts"],
    ".cjs": [".cts", ".d.cts"],
    ".jsx": [".tsx", ".d.tsx"],
} as const;

const BASE_EXTENSIONS = [
    ".ts",
    ".tsx",
    ".mts",
    ".cts",
    ".d.ts",
    ".d.tsx",
    ".d.mts",
    ".d.cts",
];

export function resolveTsImportPath(
    options: ResolveTsImportPathOptions,
): string | null {
    const { path: importPath, importer, tsconfig, cwd } = options;
    const parsedConfig = parseCompilerOptions(tsconfig || {}, cwd);
    return resolveModuleName(cleanPath(importPath), importer, parsedConfig);
}

function parseCompilerOptions(
    tsconfig: TsConfig,
    cwd: string,
): ParsedCompilerOptions {
    const options = tsconfig.compilerOptions || {};
    const baseUrl = options.baseUrl ? path.resolve(cwd, options.baseUrl) : cwd;
    const extensions = [...BASE_EXTENSIONS];

    if (options.allowJs) extensions.push(".js", ".jsx");
    if (options.resolveJsonModule) extensions.push(".json");

    return { baseUrl, paths: options.paths || {}, extensions };
}

function resolveModuleName(
    moduleName: string,
    containingFile: string,
    compilerOptions: ParsedCompilerOptions,
): string | null {
    if (moduleName.startsWith("/") && compilerOptions.baseUrl) {
        const result = tryResolveFile(
            path.join(compilerOptions.baseUrl, moduleName.slice(1)),
            compilerOptions,
        );
        if (result) return result;
    }

    if (Object.keys(compilerOptions.paths).length > 0) {
        const mappedPath = tryResolveWithPathMappings(
            moduleName,
            compilerOptions,
        );
        if (mappedPath) return mappedPath;
    }

    if (isRelativePath(moduleName)) {
        return tryResolveFile(
            path.resolve(path.dirname(containingFile), moduleName),
            compilerOptions,
        );
    }

    if (path.isAbsolute(moduleName)) {
        return tryResolveFile(moduleName, compilerOptions);
    }

    return tryResolveFile(
        path.join(compilerOptions.baseUrl, moduleName),
        compilerOptions,
    );
}

function isRelativePath(moduleName: string): boolean {
    return (
        moduleName.startsWith("./") ||
        moduleName.startsWith("../") ||
        moduleName === "."
    );
}

function tryResolveWithPathMappings(
    moduleName: string,
    compilerOptions: ParsedCompilerOptions,
): string | null {
    const { paths, baseUrl } = compilerOptions;

    for (const [pattern, substitutions] of Object.entries(paths)) {
        if (!Array.isArray(substitutions) || !substitutions.length) continue;

        const escaped = pattern
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*/g, "(.*)");
        const match = new RegExp(`^${escaped}$`).exec(moduleName);
        if (!match) continue;

        const wildcardMatch = pattern.includes("*") ? match[1] : "";

        for (const substitution of substitutions) {
            const candidate = substitution.replace("*", wildcardMatch);
            const result = tryResolveFile(
                path.resolve(baseUrl, candidate),
                compilerOptions,
            );
            if (result) return result;
        }
    }
    return null;
}

function tryResolveFile(
    filePath: string,
    compilerOptions: ParsedCompilerOptions,
): string | null {
    if (fileExists(filePath)) return filePath;

    const jsToTsMapping = tryResolveJavaScriptExtension(
        filePath,
        compilerOptions.extensions,
    );
    if (jsToTsMapping) return jsToTsMapping;

    for (const ext of compilerOptions.extensions) {
        const pathWithExt = `${filePath}${ext}`;
        if (fileExists(pathWithExt)) return pathWithExt;
    }

    if (directoryExists(filePath)) {
        for (const ext of compilerOptions.extensions) {
            const indexPath = path.join(filePath, `index${ext}`);
            if (fileExists(indexPath)) return indexPath;
        }
    }

    return null;
}

function tryResolveJavaScriptExtension(
    filePath: string,
    extensions: string[],
): string | null {
    for (const [jsExt, tsExtensions] of Object.entries(JS_TO_TS_MAPPINGS)) {
        if (!filePath.endsWith(jsExt)) continue;

        const basePath = filePath.slice(0, -jsExt.length);

        for (const tsExt of tsExtensions) {
            if (!extensions.includes(tsExt)) continue;

            const tsPath = basePath + tsExt;
            if (fileExists(tsPath)) return tsPath;
        }

        if (directoryExists(basePath)) {
            for (const tsExt of tsExtensions) {
                if (!extensions.includes(tsExt)) continue;

                const indexPath = path.join(basePath, `index${tsExt}`);
                if (fileExists(indexPath)) return indexPath;
            }
        }

        return null;
    }
    return null;
}

function fileExists(filePath: string): boolean {
    try {
        return fs.statSync(filePath).isFile();
    } catch {
        return false;
    }
}

function directoryExists(dirPath: string): boolean {
    try {
        return fs.statSync(dirPath).isDirectory();
    } catch {
        return false;
    }
}

export function cleanPath(path: string): string {
    let cleaned = path.replace(/\\/g, "/").replace(/\/+/g, "/").split("?")[0];

    try {
        cleaned = decodeURIComponent(cleaned);
    } catch {}

    return cleaned;
}
