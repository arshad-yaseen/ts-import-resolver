# ts-import-resolver

Resolves TypeScript import paths to absolute file paths.

## Installation

```bash
npm install ts-import-resolver
```
## Features

- Resolves TypeScript imports to their absolute file paths
- Supports path aliases, baseUrl, and other module resolution options defined in tsconfig.json
- Caches for better performance
- No additional dependencies besides TypeScript

## Usage

```typescript
import { resolveTypeScriptImportPath } from 'ts-import-resolver';
import fs from 'fs';
import path from 'path';

// Load your tsconfig.json
const tsconfig = JSON.parse(fs.readFileSync('./tsconfig.json', 'utf8'));
const rootDir = path.resolve('.');

const absolutePath = resolveTypeScriptImportPath({
  path: '@/components/Button',  // The import path to resolve
  importer: '/path/to/your/file.ts',  // The file containing the import
  tsconfig,  // Your parsed tsconfig object
  rootDir,  // Project root directory
});

if (absolutePath) {
  console.log(`Resolved to: ${absolutePath}`);
} else {
  console.log('Could not resolve the import');
}
```

## API Reference

### resolveTypeScriptImportPath(options)

Resolves a TypeScript import path to its absolute file path.

#### Options

```typescript
interface ResolveTypeScriptImportPathOptions {
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
```

#### Returns

- `string | null` - The absolute path to the imported module if found, or `null` if it couldn't be resolved or is from node_modules.

## How It Works

This library uses TypeScript's built-in module resolution system to resolve import paths. It parses your tsconfig.json configuration and uses TypeScript's APIs to accurately resolve imports according to your project's configuration.

## License

MIT
