import * as fs from 'fs';
import * as path from 'path';

export interface PybladeConfig {
    templates: string;
    components: string;
    i18n: string;
}

export interface Project {
    /** Directory that contains pyblade.toml */
    base: string;
    config: PybladeConfig;
}

export const DEFAULT_CONFIG: PybladeConfig = {
    templates: 'templates',
    components: 'components',
    i18n: 'locale',
};

// Folders never worth walking into (dot-folders are skipped separately)
const SKIP_DIRS = new Set([
    'node_modules', 'venv', 'env', 'site-packages', '__pycache__', 'dist', 'out', 'build',
]);

function skipDir(name: string): boolean {
    return name.startsWith('.') || SKIP_DIRS.has(name);
}

function isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// pyblade.toml (only the tiny subset we need: [section] and key = "string")
// ---------------------------------------------------------------------------

function stripComment(line: string): string {
    let quote: string | null = null;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quote) {
            if (c === '\\' && quote === '"') {
                i++;
            } else if (c === quote) {
                quote = null;
            }
        } else if (c === '"' || c === "'") {
            quote = c;
        } else if (c === '#') {
            return line.slice(0, i);
        }
    }
    return line;
}

function parseToml(text: string): Record<string, Record<string, string>> {
    const result: Record<string, Record<string, string>> = {};
    let section = '';

    for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
        const line = stripComment(raw).trim();
        if (!line) {
            continue;
        }

        const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
        if (sectionMatch) {
            section = sectionMatch[1].trim();
            continue;
        }

        const kv = /^([\w.-]+)\s*=\s*(.+)$/.exec(line);
        if (!kv) {
            continue;
        }

        const str = /^"((?:[^"\\]|\\.)*)"$|^'([^']*)'$/.exec(kv[2].trim());
        if (!str) {
            continue;
        }

        (result[section] ??= {})[kv[1]] = str[1] !== undefined ? str[1] : str[2];
    }
    return result;
}

export function loadConfig(tomlPath: string): PybladeConfig {
    let text: string;
    try {
        text = fs.readFileSync(tomlPath, 'utf8');
    } catch {
        return { ...DEFAULT_CONFIG };
    }

    const toml = parseToml(text);
    return {
        templates: toml['paths']?.['templates'] ?? DEFAULT_CONFIG.templates,
        components: toml['paths']?.['components'] ?? DEFAULT_CONFIG.components,
        i18n: toml['i18n']?.['directory'] ?? DEFAULT_CONFIG.i18n,
    };
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

function listDirs(dir: string): string[] {
    try {
        return fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((e) => e.isDirectory() && !skipDir(e.name))
            .map((e) => path.join(dir, e.name));
    } catch {
        return [];
    }
}

/** Breadth-first walk of directories, `start` being depth 0. */
function walkDirs(start: string, maxDepth: number, visit: (dir: string) => void): void {
    let level = [start];
    for (let depth = 0; depth <= maxDepth && level.length > 0; depth++) {
        const next: string[] = [];
        for (const dir of level) {
            visit(dir);
            if (depth < maxDepth) {
                next.push(...listDirs(dir));
            }
        }
        level = next;
    }
}

/** Finds every pyblade.toml under the workspace folders (up to 4 levels deep). */
export function discoverProjects(workspaceRoots: string[]): Project[] {
    const projects: Project[] = [];
    const seen = new Set<string>();

    for (const root of workspaceRoots) {
        walkDirs(root, 4, (dir) => {
            const toml = path.join(dir, 'pyblade.toml');
            if (!seen.has(dir) && fs.existsSync(toml)) {
                seen.add(dir);
                projects.push({ base: dir, config: loadConfig(toml) });
            }
        });
    }
    return projects;
}

/**
 * Finds every folder named `relPath` (e.g. "templates") in the project:
 * directly under the project base, and inside app folders (Django layout,
 * up to 3 levels down).
 */
export function findRoots(project: Project, relPath: string): string[] {
    const roots: string[] = [];
    walkDirs(project.base, 3, (dir) => {
        const candidate = path.join(dir, relPath);
        if (isDir(candidate)) {
            roots.push(candidate);
        }
    });
    return roots;
}

/** Lists files under `root` with one of `extensions`, as "/"-separated relative paths. */
export function listFiles(root: string, extensions: string[]): string[] {
    const results: string[] = [];
    const stack: string[] = [''];

    while (stack.length > 0) {
        const rel = stack.pop() as string;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
        } catch {
            continue;
        }

        for (const entry of entries) {
            const childRel = rel ? `${rel}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                if (!skipDir(entry.name)) {
                    stack.push(childRel);
                }
            } else if (extensions.includes(path.extname(entry.name))) {
                results.push(childRel);
            }
        }
    }
    return results;
}