import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { Location, LocationLink, Position, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Project, findRoots } from './config';
import { resolveStaticFile, resolveUrl } from './django';

function isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

export function componentRootsOf(projects: Project[]): string[] {
    return projects.flatMap((p) => findRoots(p, p.config.components));
}

export function templateRootsOf(projects: Project[]): string[] {
    return projects.flatMap((p) => findRoots(p, p.config.templates));
}

/**
 * Resolves a component name to a file, in this order:
 *   nav.menu -> nav/menu.py, nav/menu/menu.py (live), nav/menu.html
 * Dots are folder separators. Live and Python components both land on the .py file.
 * `roots` can be passed in to avoid rescanning the disk for every name.
 */
export function resolveComponent(
    projects: Project[],
    name: string,
    roots: string[] = componentRootsOf(projects)
): string | undefined {
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
        for (const root of roots) {
            const file = path.join(root, candidate);
            if (isFile(file)) {
                return file;
            }
        }
    }
    return undefined;
}

/**
 * Resolves a template name (as written in @include / @extends) to a file.
 * Dot notation comes first (layouts.base -> layouts/base.html); the name as
 * written, with or without ".html", is kept as a fallback.
 */
export function resolveTemplate(
    projects: Project[],
    name: string,
    roots: string[] = templateRootsOf(projects)
): string | undefined {
    const clean = name.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!clean || clean.split('/').includes('..')) {
        return undefined;
    }

    const candidates = [...new Set([`${clean.replace(/\./g, '/')}.html`, clean, `${clean}.html`])];

    for (const candidate of candidates) {
        for (const root of roots) {
            const file = path.join(root, candidate);
            if (isFile(file)) {
                return file;
            }
        }
    }
    return undefined;
}

type Kind = 'component' | 'template' | 'url' | 'static';

/** Directive -> what its first string argument refers to */
const DIRECTIVE_KINDS: Record<string, Kind> = {
    include: 'template',
    extends: 'template',
    component: 'component',
    url: 'url',
    static: 'static',
};

interface Target {
    kind: Kind;
    name: string;
    /** Character offsets of the name inside the line */
    start: number;
    end: number;
}

/** Finds the component, template, URL or static name under the cursor, if any. */
function targetAt(line: string, character: number): Target | undefined {
    // <pb-nav.menu  /  </pb-nav.menu
    for (const m of line.matchAll(/<\/?pb-([\w.-]+)/g)) {
        const end = (m.index ?? 0) + m[0].length;
        const start = end - m[1].length;
        if (character >= start && character <= end) {
            return { kind: 'component', name: m[1], start, end };
        }
    }

    // @component('nav.menu')  @extends("layouts.base")  @url('blog:post_list')  @static('css/app.css')
    for (const m of line.matchAll(/@(include|extends|component|url|static)\s*\(\s*(['"])([^'"]*)\2/g)) {
        const name = m[3];
        const end = (m.index ?? 0) + m[0].length - 1; // index of the closing quote
        const start = end - name.length;
        if (character >= start && character <= end) {
            return { kind: DIRECTIVE_KINDS[m[1]], name, start, end };
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

    // Where to land: the top of the file, or an exact range (URL names)
    let file: string | undefined;
    let targetRange = Range.create(0, 0, 0, 0);

    switch (target.kind) {
        case 'component':
            file = resolveComponent(projects, target.name);
            break;
        case 'template':
            file = resolveTemplate(projects, target.name);
            break;
        case 'static':
            file = resolveStaticFile(projects, target.name);
            break;
        case 'url': {
            const url = resolveUrl(projects, target.name);
            if (url) {
                file = url.path;
                targetRange = Range.create(url.line, url.character, url.line, url.character + url.length);
            }
            break;
        }
    }
    if (!file) {
        return null;
    }

    const uri = pathToFileURL(file).toString();

    if (linkSupport) {
        // originSelectionRange makes the whole name (dots included) the underlined link
        const origin = Range.create(position.line, target.start, position.line, target.end);
        return [LocationLink.create(uri, targetRange, targetRange, origin)];
    }
    return [Location.create(uri, targetRange)];
}