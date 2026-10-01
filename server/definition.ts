import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { Location, LocationLink, Position, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Project, findRoots } from './config';

function isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/**
 * Resolves a component name to a file, in this order:
 *   nav.menu -> nav/menu.py, nav/menu/menu.py (live), nav/menu.html
 * Dots are folder separators. Live and Python components both land on the .py file.
 */
export function resolveComponent(projects: Project[], name: string): string | undefined {
    if (name.includes('/') || name.includes('\\')) {
        return undefined;
    }
    const parts = name.split('.').filter(Boolean);
    if (parts.length === 0) {
        return undefined;
    }

    const rel = parts.join('/');
    const last = parts[parts.length - 1];
    const candidates = [`${rel}.py`, `${rel}/${last}.py`, `${rel}.html`];

    for (const candidate of candidates) {
        for (const project of projects) {
            for (const root of findRoots(project, project.config.components)) {
                const file = path.join(root, candidate);
                if (isFile(file)) {
                    return file;
                }
            }
        }
    }
    return undefined;
}

/**
 * Resolves a template name (as written in @include / @extends) to a file.
 * Tries the name as written, then with ".html" added, then with dots as folders.
 */
export function resolveTemplate(projects: Project[], name: string): string | undefined {
    const clean = name.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!clean || clean.split('/').includes('..')) {
        return undefined;
    }

    const candidates = [...new Set([clean, `${clean}.html`, `${clean.replace(/\./g, '/')}.html`])];

    for (const candidate of candidates) {
        for (const project of projects) {
            for (const root of findRoots(project, project.config.templates)) {
                const file = path.join(root, candidate);
                if (isFile(file)) {
                    return file;
                }
            }
        }
    }
    return undefined;
}

interface Target {
    kind: 'component' | 'template';
    name: string;
    /** Character offsets of the name inside the line */
    start: number;
    end: number;
}

/** Finds the component or template name under the cursor, if any. */
function targetAt(line: string, character: number): Target | undefined {
    // <pb-nav.menu  /  </pb-nav.menu
    for (const m of line.matchAll(/<\/?pb-([\w.-]+)/g)) {
        const end = (m.index ?? 0) + m[0].length;
        const start = end - m[1].length;
        if (character >= start && character <= end) {
            return { kind: 'component', name: m[1], start, end };
        }
    }

    // @component('nav.menu')  @include('partials/nav.html')  @extends("layouts/base")
    for (const m of line.matchAll(/@(include|extends|component)\s*\(\s*(['"])([^'"]*)\2/g)) {
        const name = m[3];
        const end = (m.index ?? 0) + m[0].length - 1; // index of the closing quote
        const start = end - name.length;
        if (character >= start && character <= end) {
            return {
                kind: m[1] === 'component' ? 'component' : 'template',
                name,
                start,
                end,
            };
        }
    }
    return undefined;
}

export function getDefinition(
    doc: TextDocument,
    position: Position,
    projects: Project[],
    linkSupport: boolean
): LocationLink[] | Location[] | null {
    const lineText = doc
        .getText(Range.create(position.line, 0, position.line + 1, 0))
        .replace(/\r?\n$/, '');

    const target = targetAt(lineText, position.character);
    if (!target) {
        return null;
    }

    const file =
        target.kind === 'component'
            ? resolveComponent(projects, target.name)
            : resolveTemplate(projects, target.name);
    if (!file) {
        return null;
    }

    const uri = pathToFileURL(file).toString();
    const top = Range.create(0, 0, 0, 0);

    if (linkSupport) {
        // originSelectionRange makes the whole name (dots included) the underlined link
        const origin = Range.create(position.line, target.start, position.line, target.end);
        return [LocationLink.create(uri, top, top, origin)];
    }
    return [Location.create(uri, top)];
}