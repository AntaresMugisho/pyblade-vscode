import * as fs from 'fs';
import * as path from 'path';
import { Project, findNamedFiles, findRoots, listFiles } from './config';

function readText(file: string): string {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch {
        return '';
    }
}

function isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Source text with full-line Python comments blanked out (line numbers are kept). */
function withoutComments(text: string): string {
    return text
        .split(/\r?\n/)
        .map((line) => (/^\s*#/.test(line) ? '' : line))
        .join('\n');
}

function relativeToBase(project: Project, file: string): string {
    return path.relative(project.base, file).split(path.sep).join('/');
}

// ---------------------------------------------------------------------------
// URL names
// ---------------------------------------------------------------------------

export interface UrlName {
    /** Name as used in @url('...'), including the "app_name:" namespace */
    name: string;
    /** urls.py that defines it, relative to the project base */
    file: string;
    /** Absolute path of that urls.py */
    path: string;
    /** Position of the name literal in the file (0-based) */
    line: number;
    character: number;
    length: number;
}

/**
 * Collects `name="..."` from every urls.py in the project. When the file
 * declares `app_name = "blog"`, names get the "blog:" namespace prefix.
 *
 * This is a text scan, not a Python parser: it covers path(), re_path() and
 * url() calls (also split over several lines), but not names built dynamically.
 */
export function findUrlNames(projects: Project[]): UrlName[] {
    const found = new Map<string, UrlName>();

    for (const project of projects) {
        for (const file of findNamedFiles(project, 'urls.py')) {
            const text = withoutComments(readText(file));
            const namespace = /^\s*app_name\s*=\s*['"]([\w.-]+)['"]/m.exec(text)?.[1];

            for (const m of text.matchAll(/\bname\s*=\s*(['"])([\w.:-]+)\1/g)) {
                const name = namespace ? `${namespace}:${m[2]}` : m[2];
                if (found.has(name)) {
                    continue;
                }

                // m[0] ends with <name><closing quote>
                const nameStart = (m.index ?? 0) + m[0].length - 1 - m[2].length;
                const before = text.slice(0, nameStart);
                const lineStart = before.lastIndexOf('\n') + 1;

                found.set(name, {
                    name,
                    file: relativeToBase(project, file),
                    path: file,
                    line: (before.match(/\n/g) ?? []).length,
                    character: nameStart - lineStart,
                    length: m[2].length,
                });
            }
        }
    }
    return [...found.values()];
}

/** The definition of a URL name (for go-to-definition). */
export function resolveUrl(projects: Project[], name: string): UrlName | undefined {
    return findUrlNames(projects).find((u) => u.name === name);
}

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------

export interface StaticFile {
    /** Path as used in @static('...'), relative to its static folder */
    name: string;
    /** File relative to the project base */
    file: string;
}

/**
 * Settings files of a project: the one set in pyblade.toml ([paths] settings),
 * given as a file ("config/settings/base.py"), a module ("config.settings.base"),
 * or a settings package folder. Without it, every settings.py found.
 */
function settingsFilesOf(project: Project): string[] {
    const value = project.config.settings;
    if (value) {
        const rel = value.replace(/\\/g, '/');
        const target = path.resolve(project.base, rel);

        let files: string[] = [];
        if (isFile(target)) {
            files = [target];
        } else if (isFile(`${target}.py`)) {
            files = [`${target}.py`];
        } else if (isDir(target)) {
            try {
                files = fs
                    .readdirSync(target)
                    .filter((n) => n.endsWith('.py'))
                    .map((n) => path.join(target, n));
            } catch {
                files = [];
            }
        } else {
            const dotted = path.resolve(project.base, `${rel.replace(/\./g, '/')}.py`);
            files = isFile(dotted) ? [dotted] : [];
        }
        if (files.length > 0) {
            return files;
        }
    }
    return findNamedFiles(project, 'settings.py');
}

/**
 * BASE_DIR of a settings file. Understands Path(__file__).resolve().parent.parent
 * and os.path.dirname(os.path.dirname(...)); falls back to the project root.
 */
function baseDirOf(text: string, file: string, project: Project): string {
    const line = /^BASE_DIR\s*=\s*(.+)$/m.exec(text)?.[1];
    if (line) {
        const parents = /Path\(\s*__file__\s*\)(?:\.resolve\(\))?((?:\.parent)+)/.exec(line);
        const levels = parents
            ? (parents[1].match(/\.parent/g) ?? []).length
            : (line.match(/dirname\(/g) ?? []).length;

        if (levels > 0) {
            let dir = file;
            for (let i = 0; i < levels; i++) {
                dir = path.dirname(dir);
            }
            return dir;
        }
    }
    return project.base;
}

/** Resolves `from X import *` (relative or absolute) to a settings file. */
function resolveImport(module: string, fromFile: string, project: Project): string | undefined {
    let dir: string;
    let rest: string;

    if (module.startsWith('.')) {
        const dots = module.length - module.replace(/^\.+/, '').length;
        dir = path.dirname(fromFile);
        for (let i = 1; i < dots; i++) {
            dir = path.dirname(dir);
        }
        rest = module.slice(dots).split('.').join('/');
    } else {
        dir = project.base;
        rest = module.split('.').join('/');
    }

    for (const candidate of [path.join(dir, `${rest}.py`), path.join(dir, rest, '__init__.py')]) {
        if (rest && isFile(candidate)) {
            return candidate;
        }
    }
    return undefined;
}

/**
 * STATICFILES_DIRS entries of a settings file (string literals relative to
 * BASE_DIR), following `from .base import *` chains up to 3 levels.
 */
function staticDirsFromSettings(
    file: string,
    project: Project,
    visited: Set<string> = new Set(),
    depth = 0
): string[] {
    const resolved = path.resolve(file);
    if (visited.has(resolved) || depth > 3) {
        return [];
    }
    visited.add(resolved);

    const text = withoutComments(readText(file));
    const baseDir = baseDirOf(text, file, project);
    const dirs: string[] = [];

    for (const list of text.matchAll(/STATICFILES_DIRS\s*\+?=\s*\[([\s\S]*?)\]/g)) {
        for (const literal of list[1].matchAll(/(['"])([^'"\n]+)\1/g)) {
            const dir = path.resolve(baseDir, literal[2]);
            if (isDir(dir)) {
                dirs.push(dir);
            }
        }
    }

    for (const imp of text.matchAll(/^from\s+([\w.]+)\s+import\s+\*/gm)) {
        const target = resolveImport(imp[1], file, project);
        if (target) {
            dirs.push(...staticDirsFromSettings(target, project, visited, depth + 1));
        }
    }
    return dirs;
}

/**
 * Static folders of a project:
 *  - every folder called "static" (project level and inside apps), which is
 *    what Django's AppDirectoriesFinder uses;
 *  - folders listed in STATICFILES_DIRS in the settings (see settingsFilesOf),
 *    when written as string literals relative to BASE_DIR
 *    (BASE_DIR / "assets", os.path.join(BASE_DIR, "assets"), "assets").
 */
export function findStaticRoots(project: Project): string[] {
    // Same priority as Django: STATICFILES_DIRS first, then the "static" folders of apps
    const roots = new Set<string>();

    const visited = new Set<string>();
    for (const settings of settingsFilesOf(project)) {
        for (const dir of staticDirsFromSettings(settings, project, visited)) {
            roots.add(dir);
        }
    }
    for (const root of findRoots(project, 'static')) {
        roots.add(path.resolve(root));
    }
    return [...roots];
}

export function findStaticFiles(projects: Project[]): StaticFile[] {
    const found = new Map<string, StaticFile>();

    for (const project of projects) {
        for (const root of findStaticRoots(project)) {
            for (const name of listFiles(root)) {
                if (path.basename(name).startsWith('.') || found.has(name)) {
                    continue;
                }
                found.set(name, {
                    name,
                    file: relativeToBase(project, path.join(root, name)),
                });
            }
        }
    }
    return [...found.values()];
}

/** Finds the file behind a @static('...') name, trying the static folders in priority order. */
export function resolveStaticFile(projects: Project[], name: string): string | undefined {
    const clean = name.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!clean || clean.split('/').includes('..')) {
        return undefined;
    }

    for (const project of projects) {
        for (const root of findStaticRoots(project)) {
            const file = path.join(root, clean);
            if (isFile(file)) {
                return file;
            }
        }
    }
    return undefined;
}