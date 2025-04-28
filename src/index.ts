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

export interface resolveTsImportPathOptions {
    path: string;
    importer: string;
    tsconfig?: TsConfig;
    rootDir: string;
}

interface ParsedCompilerOptions {
    baseUrl: string;
    paths: Record<string, string[]>;
    extensions: string[];
    rootDir: string;
}

class ResolutionCache {
    private patternRegexes = new Map<string, RegExp>();

    getOrCreatePatternRegex(pattern: string): RegExp {
        let regex = this.patternRegexes.get(pattern);
        if (!regex) {
            const escaped = pattern
                .replace(/[.+^${}()|[\]\\]/g, "\\$&")
                .replace(/\*/g, "(.*)");
            regex = new RegExp(`^${escaped}$`);
            this.patternRegexes.set(pattern, regex);
        }
        return regex;
    }

    clear(): void {
        this.patternRegexes.clear();
    }
}

const cache = new ResolutionCache();

export function resolveTsImportPath(
    options: resolveTsImportPathOptions,
): string | null {
    const { path: importPath, importer, tsconfig, rootDir } = options;

    const parsedConfig = parseCompilerOptions(tsconfig || {}, rootDir);
    const resolvedModule = resolveModuleName(
        importPath,
        importer,
        parsedConfig,
    );

    return resolvedModule || null;
}

export function clearResolutionCache(): void {
    cache.clear();
}

function parseCompilerOptions(
    tsconfig: TsConfig,
    rootDir: string,
): ParsedCompilerOptions {
    const options = tsconfig.compilerOptions || {};
    const baseUrl = options.baseUrl
        ? path.resolve(rootDir, options.baseUrl)
        : rootDir;

    const extensions = [
        ".ts",
        ".tsx",
        ".mts",
        ".cts",
        ".d.ts",
        ".d.tsx",
        ".d.mts",
        ".d.cts",
    ];

    if (options.allowJs) extensions.push(".js", ".jsx");
    if (options.resolveJsonModule) extensions.push(".json");

    return {
        baseUrl,
        paths: options.paths || {},
        extensions,
        rootDir,
    };
}

function resolveModuleName(
    moduleName: string,
    containingFile: string,
    compilerOptions: ParsedCompilerOptions,
): string | null {
    const cleanedModuleName = cleanPath(moduleName);

    // Handle root-level imports (e.g., "/routes") relative to baseUrl
    if (cleanedModuleName.startsWith("/") && compilerOptions.baseUrl) {
        const relativePath = cleanedModuleName.slice(1);
        const resolvedPath = path.join(compilerOptions.baseUrl, relativePath);
        const result = tryResolveFile(resolvedPath, compilerOptions);
        if (result) return result;
    }

    if (Object.keys(compilerOptions.paths).length > 0) {
        const mappedPath = tryResolveWithPathMappings(
            cleanedModuleName,
            compilerOptions,
        );
        if (mappedPath) return mappedPath;
    }

    if (isRelativePath(cleanedModuleName)) {
        const containingDir = path.dirname(containingFile);
        return tryResolveFile(
            path.resolve(containingDir, cleanedModuleName),
            compilerOptions,
        );
    }

    if (path.isAbsolute(cleanedModuleName)) {
        return tryResolveFile(cleanedModuleName, compilerOptions);
    }

    if (compilerOptions.baseUrl) {
        const baseUrlPath = path.join(
            compilerOptions.baseUrl,
            cleanedModuleName,
        );
        return tryResolveFile(baseUrlPath, compilerOptions);
    }

    return null;
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

        const patternRegex = cache.getOrCreatePatternRegex(pattern);
        const match = patternRegex.exec(moduleName);
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

    const { extensions } = compilerOptions;

    for (const ext of extensions) {
        const pathWithExt = `${filePath}${ext}`;
        if (fileExists(pathWithExt)) return pathWithExt;
    }

    if (directoryExists(filePath)) {
        for (const ext of extensions) {
            const indexPath = path.join(filePath, `index${ext}`);
            if (fileExists(indexPath)) return indexPath;
        }
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
    // Normalize path separators to forward slashes
    let cleaned = path.replace(/\\/g, "/");

    // Remove duplicate slashes
    cleaned = cleaned.replace(/\/+/g, "/");

    // Remove query parameters
    cleaned = cleaned.split("?")[0];

    // Handle URL-encoded characters
    try {
        cleaned = decodeURIComponent(cleaned);
    } catch {}

    return cleaned;
}
