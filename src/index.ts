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

/**
 * Options for resolving TypeScript import paths
 */
export interface ResolveTsImportPathOptions {
    /**
     * The import path to resolve
     */
    path: string;
    /**
     * The absolute path of the file containing the import
     */
    importer: string;
    /**
     * The parsed tsconfig.json file, if available
     */
    tsconfig: TsConfig | null | undefined;
    /**
     * The custom root directory of the project, by default the current working directory
     */
    cwd: string;
}

interface ParsedCompilerOptions {
    baseUrl: string;
    paths: Record<string, string[]>;
    extensions: string[];
    cwd: string;
}

export function resolveTsImportPath(
    options: ResolveTsImportPathOptions,
): string | null {
    const { path: importPath, importer, tsconfig, cwd } = options;

    const parsedConfig = parseCompilerOptions(tsconfig || {}, cwd);
    const resolvedModule = resolveModuleName(
        importPath,
        importer,
        parsedConfig,
    );

    return resolvedModule || null;
}

function parseCompilerOptions(
    tsconfig: TsConfig,
    cwd: string,
): ParsedCompilerOptions {
    const options = tsconfig.compilerOptions || {};
    const baseUrl = options.baseUrl ? path.resolve(cwd, options.baseUrl) : cwd;

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
        cwd,
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

        const escaped = pattern
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*/g, "(.*)");
        const patternRegex = new RegExp(`^${escaped}$`);
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
