import { beforeEach, describe, expect, it } from "vitest";
import { cleanPath } from "../src";
import {
    cleanProjectDir,
    createProject,
    resolveProjectPath,
    run,
} from "./utils";

describe("resolveTsImportPath", () => {
    beforeEach(() => {
        cleanProjectDir();
    });

    it("should resolve relative imports", () => {
        createProject({
            "src/index.ts": "export const hello = 'world';",
            "src/utils/helper.ts": "import { hello } from '../index';",
        });

        const result = run({
            path: "../index",
            importer: resolveProjectPath("src/utils/helper.ts"),
            tsconfig: {},
        });

        expect(result).toBe(resolveProjectPath("src/index.ts"));
    });

    it("should resolve imports using path mappings", () => {
        createProject({
            "src/components/Button.ts": "export const Button = () => {};",
            "src/pages/Home.ts": "import { Button } from '@components/Button';",
        });

        const result = run({
            path: "@components/Button",
            importer: resolveProjectPath("src/pages/Home.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@components/*": ["src/components/*"],
                    },
                },
            },
        });

        expect(result).toBe(resolveProjectPath("src/components/Button.ts"));
    });

    it("should resolve imports to index files", () => {
        createProject({
            "src/utils/index.ts": "export const util = () => {};",
            "src/app.ts": "import { util } from './utils';",
        });

        const result = run({
            path: "./utils",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(resolveProjectPath("src/utils/index.ts"));
    });

    it("should resolve imports with different extensions", () => {
        createProject({
            "src/components/Button.tsx": "export const Button = () => {};",
            "src/utils/helper.js": "export const helper = () => {};",
            "src/app.ts": `
                import { Button } from './components/Button';
                import { helper } from './utils/helper';
            `,
        });

        const tsxResult = run({
            path: "./components/Button",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        const jsResult = run({
            path: "./utils/helper",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    allowJs: true,
                },
            },
        });

        expect(tsxResult).toBe(resolveProjectPath("src/components/Button.tsx"));
        expect(jsResult).toBe(resolveProjectPath("src/utils/helper.js"));
    });

    it("should return null for non-existent imports", () => {
        createProject({
            "src/app.ts": "import { nonExistent } from './utils/non-existent';",
        });

        const result = run({
            path: "./utils/non-existent",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBeNull();
    });

    it("should resolve complex path mappings with wildcards", () => {
        createProject({
            "src/features/auth/components/Login.ts":
                "export const Login = () => {};",
            "src/app.ts":
                "import { Login } from '@features/auth/components/Login';",
        });

        const result = run({
            path: "@features/auth/components/Login",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@features/*": ["src/features/*"],
                    },
                },
            },
        });

        expect(result).toBe(
            resolveProjectPath("src/features/auth/components/Login.ts"),
        );
    });

    it("should resolve imports with multiple path mapping patterns", () => {
        createProject({
            "src/components/ui/Button.ts": "export const Button = () => {};",
            "src/utils/formatter.ts": "export const format = () => {};",
            "src/app.ts": `
                import { Button } from '@ui/Button';
                import { format } from '@utils/formatter';
            `,
        });

        const uiResult = run({
            path: "@ui/Button",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@ui/*": ["src/components/ui/*"],
                        "@utils/*": ["src/utils/*"],
                    },
                },
            },
        });

        const utilsResult = run({
            path: "@utils/formatter",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@ui/*": ["src/components/ui/*"],
                        "@utils/*": ["src/utils/*"],
                    },
                },
            },
        });

        expect(uiResult).toBe(
            resolveProjectPath("src/components/ui/Button.ts"),
        );
        expect(utilsResult).toBe(resolveProjectPath("src/utils/formatter.ts"));
    });

    it("should resolve path mappings with multiple patterns per key", () => {
        createProject({
            "src/components/Button.ts": "export const Button = () => {};",
            "src/shared/components/Button.ts":
                "export const SharedButton = () => {};",
            "src/app.ts": `
                import { Button } from '@components/Button';
                import { SharedButton } from '@shared/components/Button';
            `,
        });

        const result1 = run({
            path: "@components/Button",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@components/*": [
                            "src/components/*",
                            "src/shared/components/*",
                        ],
                    },
                },
            },
        });

        const result2 = run({
            path: "@shared/components/Button",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@shared/*": ["src/shared/*"],
                    },
                },
            },
        });

        expect(result1).toBe(resolveProjectPath("src/components/Button.ts"));
        expect(result2).toBe(
            resolveProjectPath("src/shared/components/Button.ts"),
        );
    });

    it("should resolve JSON imports when resolveJsonModule is enabled", () => {
        createProject({
            "src/data/config.json": JSON.stringify({ version: "1.0.0" }),
            "src/app.ts": "import config from './data/config';",
        });

        const result = run({
            path: "./data/config",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    resolveJsonModule: true,
                },
            },
        });

        expect(result).toBe(resolveProjectPath("src/data/config.json"));
    });

    it("should handle baseUrl configuration correctly", () => {
        createProject({
            "base/components/Button.ts": "export const Button = () => {};",
            "src/app.ts": "import { Button } from 'components/Button';",
        });

        const result = run({
            path: "components/Button",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./base",
                },
            },
        });

        expect(result).toBe(resolveProjectPath("base/components/Button.ts"));
    });

    it("should handle path mappings with non-wildcard patterns", () => {
        createProject({
            "src/config/constants.ts":
                "export const API_URL = 'https://api.example.com';",
            "src/app.ts": "import { API_URL } from '@constants';",
        });

        const result = run({
            path: "@constants",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@constants": ["src/config/constants.ts"],
                    },
                },
            },
        });

        expect(result).toBe(resolveProjectPath("src/config/constants.ts"));
    });

    it("should resolve using the first matching path mapping substitution", () => {
        createProject({
            "src/lib/components/Button.ts":
                "export const LibButton = () => {};",
            "src/components/Button.ts": "export const Button = () => {};",
            "src/app.ts": "import { Button } from '@components/Button';",
        });

        const result = run({
            path: "@components/Button",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@components/*": [
                            "src/lib/components/*",
                            "src/components/*",
                        ],
                    },
                },
            },
        });

        expect(result).toBe(resolveProjectPath("src/lib/components/Button.ts"));
    });

    it("should fallback to next mapping if first one doesn't exist", () => {
        createProject({
            "src/components/Button.ts": "export const Button = () => {};",
            "src/app.ts": "import { Button } from '@components/Button';",
        });

        const result = run({
            path: "@components/Button",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@components/*": [
                            "src/lib/components/*",
                            "src/components/*",
                        ],
                    },
                },
            },
        });

        expect(result).toBe(resolveProjectPath("src/components/Button.ts"));
    });

    it("should resolve absolute paths", () => {
        const absolutePath = resolveProjectPath("src/utils/helper.ts");

        createProject({
            "src/utils/helper.ts": "export const helper = () => {};",
            "src/app.ts": `import { helper } from '${absolutePath}';`,
        });

        const result = run({
            path: absolutePath,
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(cleanPath(absolutePath));
    });

    it("should handle nested directory structures", () => {
        createProject({
            "src/features/auth/services/auth-service/index.ts":
                "export const authService = {};",
            "src/app.ts":
                "import { authService } from './features/auth/services/auth-service';",
        });

        const result = run({
            path: "./features/auth/services/auth-service",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(
            resolveProjectPath(
                "src/features/auth/services/auth-service/index.ts",
            ),
        );
    });

    it("should resolve to .d.ts declaration files", () => {
        createProject({
            "src/types/models.d.ts":
                "export interface User { id: string; name: string; }",
            "src/app.ts": "import { User } from './types/models';",
        });

        const result = run({
            path: "./types/models",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(resolveProjectPath("src/types/models.d.ts"));
    });

    it("should handle complex directory and file names with special characters", () => {
        createProject({
            "src/components/special-component.with.dots.ts":
                "export const Special = () => {};",
            "src/app.ts":
                "import { Special } from './components/special-component.with.dots';",
        });

        const result = run({
            path: "./components/special-component.with.dots",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(
            resolveProjectPath("src/components/special-component.with.dots.ts"),
        );
    });

    it("should resolve different extensions in order of preference", () => {
        createProject({
            "src/utils/helper.ts": "export const tsHelper = () => {};",
            "src/utils/helper.js": "export const jsHelper = () => {};",
            "src/app.ts": "import { helper } from './utils/helper';",
        });

        const result = run({
            path: "./utils/helper",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    allowJs: true,
                },
            },
        });

        expect(result).toBe(resolveProjectPath("src/utils/helper.ts"));
    });

    it("should handle imports within barrel files", () => {
        createProject({
            "src/components/Button.ts": "export const Button = () => {};",
            "src/components/Input.ts": "export const Input = () => {};",
            "src/components/index.ts": `
                export * from './Button';
                export * from './Input';
            `,
            "src/app.ts": "import { Button, Input } from './components';",
        });

        const result = run({
            path: "./components",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(resolveProjectPath("src/components/index.ts"));
    });

    it("should handle imports with file extension specified", () => {
        createProject({
            "src/utils/helper.ts": "export const helper = () => {};",
            "src/app.ts": "import { helper } from './utils/helper.ts';",
        });

        const result = run({
            path: "./utils/helper.ts",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(resolveProjectPath("src/utils/helper.ts"));
    });

    it("should handle advanced path mapping with nested aliases", () => {
        createProject({
            "src/features/user/profile/avatar.ts":
                "export const Avatar = () => {};",
            "src/app.ts": "import { Avatar } from '@user/profile/avatar';",
        });

        const result = run({
            path: "@user/profile/avatar",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@user/*": ["src/features/user/*"],
                    },
                },
            },
        });

        expect(result).toBe(
            resolveProjectPath("src/features/user/profile/avatar.ts"),
        );
    });

    it("should resolve paths when baseUrl is a nested directory", () => {
        createProject({
            "src/client/components/Header.ts":
                "export const Header = () => {};",
            "src/client/pages/Home.ts":
                "import { Header } from 'components/Header';",
        });

        const result = run({
            path: "components/Header",
            importer: resolveProjectPath("src/client/pages/Home.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "src/client",
                },
            },
        });

        expect(result).toBe(
            resolveProjectPath("src/client/components/Header.ts"),
        );
    });

    it("should resolve paths with non-standard extensions when included in extensions list", () => {
        createProject({
            "src/styles/theme.scss": ".theme { color: red; }",
            "src/app.ts": "import styles from './styles/theme.scss';",
        });

        const result = run({
            path: "./styles/theme.scss",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(resolveProjectPath("src/styles/theme.scss"));
    });

    it("should resolve complex path mappings with multiple wildcards", () => {
        createProject({
            "src/modules/admin/components/Dashboard.ts":
                "export const Dashboard = () => {};",
            "src/app.ts":
                "import { Dashboard } from '@modules/admin/components/Dashboard';",
        });

        const result = run({
            path: "@modules/admin/components/Dashboard",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@modules/*": ["src/modules/*"],
                        "@modules/*/components/*": [
                            "src/modules/*/components/*",
                        ],
                    },
                },
            },
        });

        expect(result).toBe(
            resolveProjectPath("src/modules/admin/components/Dashboard.ts"),
        );
    });

    it("should handle root-level imports when baseUrl is set", () => {
        createProject({
            "app/routes.ts": "export const routes = [];",
            "app/pages/About.ts": "import { routes } from '/routes';",
        });

        const result = run({
            path: "/routes",
            importer: resolveProjectPath("app/pages/About.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "app",
                },
            },
        });

        expect(result).toBe(resolveProjectPath("app/routes.ts"));
    });

    it("should handle complex path mappings with non-src directories", () => {
        createProject({
            "libs/shared/Button.ts": "export const Button = () => {};",
            "libs/utils/format.ts": "export const format = () => {};",
            "src/app.ts": `
                import { Button } from '@shared/Button';
                import { format } from '@utils/format';
            `,
        });

        const sharedResult = run({
            path: "@shared/Button",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@shared/*": ["libs/shared/*"],
                        "@utils/*": ["libs/utils/*"],
                    },
                },
            },
        });

        const utilsResult = run({
            path: "@utils/format",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@shared/*": ["libs/shared/*"],
                        "@utils/*": ["libs/utils/*"],
                    },
                },
            },
        });

        expect(sharedResult).toBe(resolveProjectPath("libs/shared/Button.ts"));
        expect(utilsResult).toBe(resolveProjectPath("libs/utils/format.ts"));
    });

    it("should handle aliased root imports", () => {
        createProject({
            "src/index.ts": "export const app = {};",
            "src/components/Button.ts": "import { app } from '~';",
        });

        const result = run({
            path: "~",
            importer: resolveProjectPath("src/components/Button.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "~": ["src/index.ts"],
                    },
                },
            },
        });

        expect(result).toBe(resolveProjectPath("src/index.ts"));
    });

    it("should resolve path aliases with special characters", () => {
        createProject({
            "src/utils/shared.ts": "export const shared = {};",
            "src/app.ts": "import { shared } from '#utils/shared';",
        });

        const result = run({
            path: "#utils/shared",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "#utils/*": ["src/utils/*"],
                    },
                },
            },
        });

        expect(result).toBe(resolveProjectPath("src/utils/shared.ts"));
    });

    it("should handle path mappings with empty string patterns", () => {
        createProject({
            "src/index.ts": "export const app = {};",
            "src/components/Button.ts": "import { app } from '';",
        });

        const result = run({
            path: "",
            importer: resolveProjectPath("src/components/Button.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "": ["src/index.ts"],
                    },
                },
            },
        });

        expect(result).toBe(resolveProjectPath("src/index.ts"));
    });

    it("should handle baseUrl with trailing slash", () => {
        createProject({
            "src/utils/format.ts": "export const format = () => {};",
            "src/app.ts": "import { format } from 'utils/format';",
        });

        const result = run({
            path: "utils/format",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "src/",
                },
            },
        });

        expect(result).toBe(resolveProjectPath("src/utils/format.ts"));
    });

    it("should support mixed absolute and relative paths in path mappings", () => {
        const absolutePath = resolveProjectPath("libs/shared");

        createProject({
            "libs/shared/Button.ts": "export const Button = () => {};",
            "src/utils/icons.ts": "export const Icon = () => {};",
            "src/app.ts": `
                import { Button } from '@shared/Button';
                import { Icon } from '@icons';
            `,
        });

        const sharedResult = run({
            path: "@shared/Button",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@shared/*": [`${absolutePath}/*`],
                        "@icons": ["src/utils/icons.ts"],
                    },
                },
            },
        });

        expect(sharedResult).toBe(resolveProjectPath("libs/shared/Button.ts"));
    });

    it("should handle path mappings with '$' character", () => {
        createProject({
            "src/components/Button.ts": "export const Button = () => {};",
            "src/app.ts": "import { Button } from '$components/Button';",
        });

        const result = run({
            path: "$components/Button",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "$components/*": ["src/components/*"],
                    },
                },
            },
        });

        expect(result).toBe(resolveProjectPath("src/components/Button.ts"));
    });

    it("should resolve imports with multiple segment aliases correctly", () => {
        createProject({
            "src/libs/core/utils/format.ts": "export const format = () => {};",
            "src/app.ts": "import { format } from '@libs/core/utils/format';",
        });

        const result = run({
            path: "@libs/core/utils/format",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@libs/core/*": ["src/libs/core/*"],
                    },
                },
            },
        });

        expect(result).toBe(
            resolveProjectPath("src/libs/core/utils/format.ts"),
        );
    });

    it("should handle complex monorepo structures with nested path mappings", () => {
        createProject({
            "packages/ui/src/components/Button.ts":
                "export const Button = () => {};",
            "packages/core/src/utils/format.ts":
                "export const format = () => {};",
            "apps/web/src/app.ts": `
                import { Button } from '@ui/components/Button';
                import { format } from '@core/utils/format';
            `,
        });

        const uiResult = run({
            path: "@ui/components/Button",
            importer: resolveProjectPath("apps/web/src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@ui/*": ["packages/ui/src/*"],
                        "@core/*": ["packages/core/src/*"],
                    },
                },
            },
        });

        const coreResult = run({
            path: "@core/utils/format",
            importer: resolveProjectPath("apps/web/src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@ui/*": ["packages/ui/src/*"],
                        "@core/*": ["packages/core/src/*"],
                    },
                },
            },
        });

        expect(uiResult).toBe(
            resolveProjectPath("packages/ui/src/components/Button.ts"),
        );
        expect(coreResult).toBe(
            resolveProjectPath("packages/core/src/utils/format.ts"),
        );
    });

    it("should handle path mappings with dots in alias names", () => {
        createProject({
            "src/libs/company.core/utils.ts": "export const util = () => {};",
            "src/app.ts": "import { util } from '@company.core/utils';",
        });

        const result = run({
            path: "@company.core/utils",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@company.core/*": ["src/libs/company.core/*"],
                    },
                },
            },
        });

        expect(result).toBe(
            resolveProjectPath("src/libs/company.core/utils.ts"),
        );
    });

    it("should handle path mappings where one alias is a prefix of another", () => {
        createProject({
            "src/lib/index.ts": "export const lib = {};",
            "src/lib/utils/format.ts": "export const format = () => {};",
            "src/app.ts": `
                import { lib } from '@lib';
                import { format } from '@lib/utils/format';
            `,
        });

        const libResult = run({
            path: "@lib",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@lib": ["src/lib/index.ts"],
                        "@lib/*": ["src/lib/*"],
                    },
                },
            },
        });

        const utilsResult = run({
            path: "@lib/utils/format",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@lib": ["src/lib/index.ts"],
                        "@lib/*": ["src/lib/*"],
                    },
                },
            },
        });

        expect(libResult).toBe(resolveProjectPath("src/lib/index.ts"));
        expect(utilsResult).toBe(resolveProjectPath("src/lib/utils/format.ts"));
    });

    it("should handle path with double slashes", () => {
        createProject({
            "src/components/Button.ts": "export const Button = () => {};",
            "src/app.ts": "import { Button } from './components//Button';",
        });

        const result = run({
            path: "./components//Button",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(resolveProjectPath("src/components/Button.ts"));
    });

    it("should handle Windows-style paths with backslashes", () => {
        createProject({
            "src/components/Button.ts": "export const Button = () => {};",
            "src/app.ts": "import { Button } from '.\\components\\Button';",
        });

        const result = run({
            path: ".\\components\\Button",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(resolveProjectPath("src/components/Button.ts"));
    });

    it("should handle path mappings with regex special characters", () => {
        createProject({
            "src/components/special+utils.ts":
                "export const special = () => {};",
            "src/app.ts": "import { special } from '@special+/utils';",
        });

        const result = run({
            path: "@special+/utils",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@special+/*": ["src/components/special+*"],
                    },
                },
            },
        });

        expect(result).toBe(
            resolveProjectPath("src/components/special+utils.ts"),
        );
    });

    it("should handle imports with URL-encoded characters", () => {
        createProject({
            "src/components/space file.ts":
                "export const spaceComponent = () => {};",
            "src/app.ts":
                "import { spaceComponent } from './components/space%20file';",
        });

        const result = run({
            path: "./components/space%20file",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(resolveProjectPath("src/components/space file.ts"));
    });

    it("should handle extremely deep nested structures", () => {
        createProject({
            "src/a/b/c/d/e/f/g/h/i/j/k/deep.ts":
                "export const deep = () => {};",
            "src/app.ts":
                "import { deep } from './a/b/c/d/e/f/g/h/i/j/k/deep';",
        });

        const result = run({
            path: "./a/b/c/d/e/f/g/h/i/j/k/deep",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(
            resolveProjectPath("src/a/b/c/d/e/f/g/h/i/j/k/deep.ts"),
        );
    });

    it("should handle path mappings with back-references", () => {
        createProject({
            "libs/shared/utils/formatters.ts": "export const formatters = {};",
            "src/app.ts": "import { formatters } from '@utils/formatters';",
        });

        const result = run({
            path: "@utils/formatters",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./src",
                    paths: {
                        "@utils/*": ["../libs/shared/utils/*"],
                    },
                },
            },
        });

        expect(result).toBe(
            resolveProjectPath("libs/shared/utils/formatters.ts"),
        );
    });

    it("should handle multiple baseUrl interactions", () => {
        createProject({
            "src/core/utils.ts": "export const utils = {};",
            "src/app/components/Button.ts":
                "import { utils } from 'core/utils';",
        });

        const result = run({
            path: "core/utils",
            importer: resolveProjectPath("src/app/components/Button.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./src",
                },
            },
        });

        expect(result).toBe(resolveProjectPath("src/core/utils.ts"));
    });

    it("should handle imports with query parameters", () => {
        createProject({
            "src/components/Button.ts": "export const Button = () => {};",
            "src/app.ts": "import { Button } from './components/Button?raw';",
        });

        const result = run({
            path: "./components/Button?raw",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(resolveProjectPath("src/components/Button.ts"));
    });

    it("should handle path mappings with multiple non-wildcard patterns", () => {
        createProject({
            "src/constants/app-constants.ts":
                "export const APP_VERSION = '1.0.0';",
            "src/constants/api-constants.ts":
                "export const API_URL = 'https://api.example.com';",
            "src/app.ts": `
                import { APP_VERSION } from '@constants/app';
                import { API_URL } from '@constants/api';
            `,
        });

        const appResult = run({
            path: "@constants/app",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@constants/app": ["src/constants/app-constants.ts"],
                        "@constants/api": ["src/constants/api-constants.ts"],
                    },
                },
            },
        });

        const apiResult = run({
            path: "@constants/api",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: "./",
                    paths: {
                        "@constants/app": ["src/constants/app-constants.ts"],
                        "@constants/api": ["src/constants/api-constants.ts"],
                    },
                },
            },
        });

        expect(appResult).toBe(
            resolveProjectPath("src/constants/app-constants.ts"),
        );
        expect(apiResult).toBe(
            resolveProjectPath("src/constants/api-constants.ts"),
        );
    });

    it("should handle multiple extensions with prioritization", () => {
        createProject({
            "src/utils/helper.tsx": "export const HelperComponent = () => {};",
            "src/utils/helper.ts": "export const helper = () => {};",
            "src/utils/helper.js": "export const jsHelper = () => {};",
            "src/utils/helper.jsx": "export const JsxComponent = () => {};",
            "src/app.ts": "import helper from './utils/helper';",
        });

        const result = run({
            path: "./utils/helper",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    allowJs: true,
                },
            },
        });

        // Should prioritize .ts over .js, and .tsx over .jsx
        expect(result).toBe(resolveProjectPath("src/utils/helper.ts"));
    });

    it("should handle absolute paths combined with baseUrl", () => {
        const absoluteBasePath = resolveProjectPath("src");

        createProject({
            "src/utils/format.ts": "export const format = () => {};",
            "src/components/Button.ts":
                "import { format } from 'utils/format';",
        });

        const result = run({
            path: "utils/format",
            importer: resolveProjectPath("src/components/Button.ts"),
            tsconfig: {
                compilerOptions: {
                    baseUrl: absoluteBasePath,
                },
            },
        });

        expect(result).toBe(resolveProjectPath("src/utils/format.ts"));
    });

    it("should handle imports with file extension priority", () => {
        createProject({
            "src/components/Button.d.ts": "export interface ButtonProps {}",
            "src/components/Button.ts": "export const Button = () => {};",
            "src/app.ts": "import { Button } from './components/Button';",
        });

        const result = run({
            path: "./components/Button",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        // Should prioritize implementation over declaration
        expect(result).toBe(resolveProjectPath("src/components/Button.ts"));
    });
});

describe("index file resolution", () => {
    beforeEach(() => {
        cleanProjectDir();
    });

    it("should resolve directory imports to index files with various extensions", () => {
        createProject({
            "src/utils/index.ts": "export const utils = {};",
            "src/components/index.js": "export const components = {};",
            "src/features/index.tsx": "export const features = {};",
            "src/app.ts": `
                import { utils } from './utils';
                import { components } from './components';
                import { features } from './features';
            `,
        });

        const tsResult = run({
            path: "./utils",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        const jsResult = run({
            path: "./components",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    allowJs: true,
                },
            },
        });

        const tsxResult = run({
            path: "./features",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(tsResult).toBe(resolveProjectPath("src/utils/index.ts"));
        expect(jsResult).toBe(resolveProjectPath("src/components/index.js"));
        expect(tsxResult).toBe(resolveProjectPath("src/features/index.tsx"));
    });

    it("should resolve explicit /index imports", () => {
        createProject({
            "src/utils/index.ts": "export const utils = {};",
            "src/app.ts": "import { utils } from './utils/index';",
        });

        const result = run({
            path: "./utils/index",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(resolveProjectPath("src/utils/index.ts"));
    });

    it("should resolve nested index file imports", () => {
        createProject({
            "src/features/auth/index.ts": "export const auth = {};",
            "src/features/index.ts": "export * from './auth';",
            "src/app.ts": `
                import { auth } from './features';
                import authDirect from './features/auth';
            `,
        });

        const featuresResult = run({
            path: "./features",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        const authResult = run({
            path: "./features/auth",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(featuresResult).toBe(
            resolveProjectPath("src/features/index.ts"),
        );
        expect(authResult).toBe(
            resolveProjectPath("src/features/auth/index.ts"),
        );
    });

    it("should prioritize a file over a directory with index file", () => {
        createProject({
            "src/utils.ts": "export const utils = {};",
            "src/utils/index.ts": "export const nestedUtils = {};",
            "src/app.ts": "import { utils } from './utils';",
        });

        const result = run({
            path: "./utils",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(resolveProjectPath("src/utils.ts"));
    });
});

describe("declaration and module file resolution", () => {
    beforeEach(() => {
        cleanProjectDir();
    });

    it("should resolve .d.ts declaration files", () => {
        createProject({
            "src/types/models.d.ts": "export interface User {}",
            "src/app.ts": "import { User } from './types/models';",
        });

        const result = run({
            path: "./types/models",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(resolveProjectPath("src/types/models.d.ts"));
    });

    it("should prioritize implementation files over declaration files", () => {
        createProject({
            "src/utils/helper.d.ts": "export declare function helper(): void;",
            "src/utils/helper.ts": "export function helper() { return true; }",
            "src/app.ts": "import { helper } from './utils/helper';",
        });

        const result = run({
            path: "./utils/helper",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(resolveProjectPath("src/utils/helper.ts"));
    });

    it("should resolve .mts and .cts module files", () => {
        createProject({
            "src/utils/esm-helper.mts": "export const esmHelper = {};",
            "src/utils/cjs-helper.cts": "export const cjsHelper = {};",
            "src/app.ts": `
                import { esmHelper } from './utils/esm-helper';
                import { cjsHelper } from './utils/cjs-helper';
            `,
        });

        const mtsResult = run({
            path: "./utils/esm-helper",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        const ctsResult = run({
            path: "./utils/cjs-helper",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(mtsResult).toBe(resolveProjectPath("src/utils/esm-helper.mts"));
        expect(ctsResult).toBe(resolveProjectPath("src/utils/cjs-helper.cts"));
    });

    it("should resolve .d.mts and .d.cts declaration files", () => {
        createProject({
            "src/types/esm-types.d.mts": "export interface EsmType {}",
            "src/types/cjs-types.d.cts": "export interface CjsType {}",
            "src/app.ts": `
                import { EsmType } from './types/esm-types';
                import { CjsType } from './types/cjs-types';
            `,
        });

        const dmtsResult = run({
            path: "./types/esm-types",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        const dctsResult = run({
            path: "./types/cjs-types",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(dmtsResult).toBe(
            resolveProjectPath("src/types/esm-types.d.mts"),
        );
        expect(dctsResult).toBe(
            resolveProjectPath("src/types/cjs-types.d.cts"),
        );
    });

    it("should prioritize implementation modules over declaration modules", () => {
        createProject({
            "src/utils/helper.d.mts": "export declare function helper(): void;",
            "src/utils/helper.mts": "export function helper() { return true; }",
            "src/utils/cjs-helper.d.cts":
                "export declare function cjsHelper(): void;",
            "src/utils/cjs-helper.cts":
                "export function cjsHelper() { return true; }",
            "src/app.ts": `
                import { helper } from './utils/helper';
                import { cjsHelper } from './utils/cjs-helper';
            `,
        });

        const mtsResult = run({
            path: "./utils/helper",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        const ctsResult = run({
            path: "./utils/cjs-helper",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(mtsResult).toBe(resolveProjectPath("src/utils/helper.mts"));
        expect(ctsResult).toBe(resolveProjectPath("src/utils/cjs-helper.cts"));
    });
});

describe("complex index resolution scenarios", () => {
    beforeEach(() => {
        cleanProjectDir();
    });

    it("should resolve index.d.ts files", () => {
        createProject({
            "src/types/index.d.ts": "export interface Types {}",
            "src/app.ts": "import { Types } from './types';",
        });

        const result = run({
            path: "./types",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(resolveProjectPath("src/types/index.d.ts"));
    });

    it("should resolve index.mts and index.cts files", () => {
        createProject({
            "src/utils/esm/index.mts": "export const esmUtils = {};",
            "src/utils/cjs/index.cts": "export const cjsUtils = {};",
            "src/app.ts": `
                import { esmUtils } from './utils/esm';
                import { cjsUtils } from './utils/cjs';
            `,
        });

        const mtsResult = run({
            path: "./utils/esm",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        const ctsResult = run({
            path: "./utils/cjs",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(mtsResult).toBe(resolveProjectPath("src/utils/esm/index.mts"));
        expect(ctsResult).toBe(resolveProjectPath("src/utils/cjs/index.cts"));
    });

    it("should resolve index.d.mts and index.d.cts files", () => {
        createProject({
            "src/types/esm/index.d.mts": "export interface EsmTypes {}",
            "src/types/cjs/index.d.cts": "export interface CjsTypes {}",
            "src/app.ts": `
                import { EsmTypes } from './types/esm';
                import { CjsTypes } from './types/cjs';
            `,
        });

        const dmtsResult = run({
            path: "./types/esm",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        const dctsResult = run({
            path: "./types/cjs",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(dmtsResult).toBe(
            resolveProjectPath("src/types/esm/index.d.mts"),
        );
        expect(dctsResult).toBe(
            resolveProjectPath("src/types/cjs/index.d.cts"),
        );
    });

    it("should prioritize implementation index files over declaration index files", () => {
        createProject({
            "src/utils/index.d.ts": "export declare function util(): void;",
            "src/utils/index.ts": "export function util() { return true; }",
            "src/app.ts": "import { util } from './utils';",
        });

        const result = run({
            path: "./utils",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {},
        });

        expect(result).toBe(resolveProjectPath("src/utils/index.ts"));
    });

    it("should prioritize file extensions in the correct order", () => {
        createProject({
            "src/utils/helper.ts": "export const tsHelper = {};",
            "src/utils/helper.js": "export const jsHelper = {};",
            "src/utils/helper.tsx": "export const tsxHelper = {};",
            "src/utils/helper.jsx": "export const jsxHelper = {};",
            "src/utils/helper.d.ts": "export declare const dtsHelper: any;",
            "src/utils/helper.mts": "export const mtsHelper = {};",
            "src/utils/helper.cts": "export const ctsHelper = {};",
            "src/app.ts": "import { helper } from './utils/helper';",
        });

        const result = run({
            path: "./utils/helper",
            importer: resolveProjectPath("src/app.ts"),
            tsconfig: {
                compilerOptions: {
                    allowJs: true,
                },
            },
        });

        // Should prioritize .ts over other extensions
        expect(result).toBe(resolveProjectPath("src/utils/helper.ts"));
    });
});

describe("no tsconfig resolution", () => {
    beforeEach(() => {
        cleanProjectDir();
    });

    it("should resolve relative imports without tsconfig", () => {
        createProject({
            "src/index.ts": "export const hello = 'world';",
            "src/utils/helper.ts": "import { hello } from '../index';",
        });

        const result = run({
            path: "../index",
            importer: resolveProjectPath("src/utils/helper.ts"),
        });

        expect(result).toBe(resolveProjectPath("src/index.ts"));
    });

    it("should resolve imports to index files without tsconfig", () => {
        createProject({
            "src/utils/index.ts": "export const util = () => {};",
            "src/app.ts": "import { util } from './utils';",
        });

        const result = run({
            path: "./utils",
            importer: resolveProjectPath("src/app.ts"),
        });

        expect(result).toBe(resolveProjectPath("src/utils/index.ts"));
    });

    it("should resolve imports with different extensions without tsconfig", () => {
        createProject({
            "src/components/Button.tsx": "export const Button = () => {};",
            "src/app.ts": "import { Button } from './components/Button';",
        });

        const result = run({
            path: "./components/Button",
            importer: resolveProjectPath("src/app.ts"),
        });

        expect(result).toBe(resolveProjectPath("src/components/Button.tsx"));
    });

    it("should not resolve JavaScript files without tsconfig (allowJs=false by default)", () => {
        createProject({
            "src/utils/helper.js": "export const helper = () => {};",
            "src/app.ts": "import { helper } from './utils/helper';",
        });

        const result = run({
            path: "./utils/helper",
            importer: resolveProjectPath("src/app.ts"),
        });

        expect(result).toBeNull();
    });

    it("should not resolve JSON files without tsconfig (resolveJsonModule=false by default)", () => {
        createProject({
            "src/data/config.json": JSON.stringify({ version: "1.0.0" }),
            "src/app.ts": "import config from './data/config';",
        });

        const result = run({
            path: "./data/config",
            importer: resolveProjectPath("src/app.ts"),
        });

        expect(result).toBeNull();
    });

    it("should return null for non-existent imports without tsconfig", () => {
        createProject({
            "src/app.ts": "import { nonExistent } from './utils/non-existent';",
        });

        const result = run({
            path: "./utils/non-existent",
            importer: resolveProjectPath("src/app.ts"),
        });

        expect(result).toBeNull();
    });

    it("should handle path with double slashes without tsconfig", () => {
        createProject({
            "src/components/Button.ts": "export const Button = () => {};",
            "src/app.ts": "import { Button } from './components//Button';",
        });

        const result = run({
            path: "./components//Button",
            importer: resolveProjectPath("src/app.ts"),
        });

        expect(result).toBe(resolveProjectPath("src/components/Button.ts"));
    });

    it("should handle absolute paths without tsconfig", () => {
        const absolutePath = resolveProjectPath("src/utils/helper.ts");

        createProject({
            "src/utils/helper.ts": "export const helper = () => {};",
            "src/app.ts": `import { helper } from '${absolutePath}';`,
        });

        const result = run({
            path: absolutePath,
            importer: resolveProjectPath("src/app.ts"),
        });

        expect(result).toBe(cleanPath(absolutePath));
    });

    it("should handle nested directory structures without tsconfig", () => {
        createProject({
            "src/features/auth/services/auth-service/index.ts":
                "export const authService = {};",
            "src/app.ts":
                "import { authService } from './features/auth/services/auth-service';",
        });

        const result = run({
            path: "./features/auth/services/auth-service",
            importer: resolveProjectPath("src/app.ts"),
        });

        expect(result).toBe(
            resolveProjectPath(
                "src/features/auth/services/auth-service/index.ts",
            ),
        );
    });
});
