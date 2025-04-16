import ts from "typescript";

/**
 * Options for resolving TypeScript import paths.
 */
export interface ResolveTypeScriptImportPathOptions {
    /**
     * The import path to resolve (e.g., './utils', '@/components', etc.)
     */
    path: string;

    /**
     * The absolute path of the file containing the import
     */
    importer: string;

    /**
     * The parsed TypeScript configuration object
     */
    tsconfig: Record<string, unknown> | null;

    /**
     * The root directory of the project
     */
    rootDir: string;
}

const parsedConfigCache = new Map<string, ts.ParsedCommandLine>();
const resolvedModuleCache = new Map<
    string,
    ts.ResolvedModuleWithFailedLookupLocations
>();
const finalPathCache = new Map<string, string | null>();
const overallResultCache = new Map<string, string | null>();
let tsconfigCounter = 0;
const tsconfigIDs = new WeakMap<object, number>();

/**
 * Resolves a TypeScript import path to its absolute file path.
 */
export function resolveTypeScriptImportPath(
    options: ResolveTypeScriptImportPathOptions,
): string | null {
    const { path, importer, tsconfig, rootDir } = options;

    if (!tsconfig) {
        return null;
    }

    let tsconfigID: number;
    if (tsconfigIDs.has(tsconfig)) {
        const id = tsconfigIDs.get(tsconfig);
        tsconfigID = id !== undefined ? id : tsconfigCounter++;
    } else {
        tsconfigID = tsconfigCounter++;
        tsconfigIDs.set(tsconfig, tsconfigID);
    }

    const overallResultKey = `${path}:${importer}:${tsconfigID}:${rootDir}`;
    if (overallResultCache.has(overallResultKey)) {
        const result = overallResultCache.get(overallResultKey);
        return result !== undefined ? result : null;
    }

    const parsedConfigKey = `${tsconfigID}:${rootDir}`;
    let parsedConfig: ts.ParsedCommandLine;
    if (parsedConfigCache.has(parsedConfigKey)) {
        const cached = parsedConfigCache.get(parsedConfigKey);
        parsedConfig =
            cached !== undefined
                ? cached
                : ts.parseJsonConfigFileContent(tsconfig, ts.sys, rootDir);
    } else {
        parsedConfig = ts.parseJsonConfigFileContent(tsconfig, ts.sys, rootDir);
        parsedConfigCache.set(parsedConfigKey, parsedConfig);
    }

    const resolvedModuleKey = `${path}:${importer}:${parsedConfigKey}`;
    let result: ts.ResolvedModuleWithFailedLookupLocations;
    if (resolvedModuleCache.has(resolvedModuleKey)) {
        const cached = resolvedModuleCache.get(resolvedModuleKey);
        result =
            cached !== undefined
                ? cached
                : ts.resolveModuleName(
                      path,
                      importer,
                      parsedConfig.options,
                      ts.sys,
                  );
    } else {
        result = ts.resolveModuleName(
            path,
            importer,
            parsedConfig.options,
            ts.sys,
        );
        resolvedModuleCache.set(resolvedModuleKey, result);
    }

    const resolvedFileName = result.resolvedModule?.resolvedFileName;

    if (!resolvedFileName) {
        overallResultCache.set(overallResultKey, null);
        return null;
    }

    const finalPathKey = `${resolvedFileName}:${rootDir}`;
    let finalPath: string | null;

    if (finalPathCache.has(finalPathKey)) {
        const cached = finalPathCache.get(finalPathKey);
        finalPath = cached !== undefined ? cached : null;
    } else {
        if (isNodeModulePath(resolvedFileName)) {
            finalPath = null;
        } else {
            finalPath = resolvedFileName;
        }

        finalPathCache.set(finalPathKey, finalPath);
    }

    overallResultCache.set(overallResultKey, finalPath);
    return finalPath;
}

function isNodeModulePath(filePath: string): boolean {
    return filePath.includes("node_modules");
}
