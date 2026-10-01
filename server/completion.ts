import * as path from 'path';
import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    Position,
    Range,
    TextEdit,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Project, findRoots, listFiles } from './config';

export type Log = (message: string) => void;
const noLog: Log = () => {};

const TEMPLATE_DIRECTIVES = new Set(['include', 'extends']);
const COMPONENT_DIRECTIVES = new Set(['component']);

interface ArgContext {
    kind: 'template' | 'component';
    /** Text already typed inside the string (or after "pb-") */
    typed: string;
    /** True for a bare "pb-" typed without "<": accepting inserts the whole tag */
    bare?: boolean;
}

/**
 * Looks at the text before the cursor and decides whether we are typing a
 * template name, a component name, or neither.
 *
 * `textBefore` is a few lines of text ending at the cursor; it is only used to
 * tell whether a bare "pb-" is inside an HTML tag (e.g. class="pb-4").
 */
export function getArgContext(
    linePrefix: string,
    textBefore: string = linePrefix
): ArgContext | undefined {
    // <pb-nav.menu   or   </pb-nav.menu
    const tag = /<\/?pb-([\w.-]*)$/.exec(linePrefix);
    if (tag) {
        return { kind: 'component', typed: tag[1] };
    }

    // pb-nav.menu typed without "<". Not after a word char, ".", "-", "<" or "/",
    // and not inside a tag, so Tailwind classes like class="pb-4" are left alone.
    const bare = /(?<![\w.\-<\/])pb-([\w.-]*)$/.exec(linePrefix);
    if (bare) {
        const insideTag = textBefore.lastIndexOf('<') > textBefore.lastIndexOf('>');
        return insideTag ? undefined : { kind: 'component', typed: bare[1], bare: true };
    }

    // @include('par   @component("nav.   (first argument, still unclosed)
    const arg = /@(\w+)\s*\(\s*(['"])([^'"]*)$/.exec(linePrefix);
    if (!arg) {
        return undefined;
    }
    if (TEMPLATE_DIRECTIVES.has(arg[1])) {
        return { kind: 'template', typed: arg[3] };
    }
    if (COMPONENT_DIRECTIVES.has(arg[1])) {
        return { kind: 'component', typed: arg[3] };
    }
    return undefined;
}

interface Found {
    name: string;
    rank: number;
    detail: string;
    /** File the name resolves to, relative to the project base */
    file: string;
}

/**
 * Component names, following the resolution order:
 *   nav.menu -> nav/menu.py (python), nav/menu/menu.py (live), nav/menu.html (UI)
 * Dots are folder separators; extensions are never part of the name.
 */
function componentNames(projects: Project[], log: Log): Found[] {
    const found = new Map<string, Found>();

    for (const project of projects) {
        const roots = findRoots(project, project.config.components);
        log(`[components] folders for ${project.base}: ${roots.join(', ') || '(none found)'}`);

        for (const root of roots) {
            const files = listFiles(root, ['.py', '.html']);
            log(`[components] ${root}: ${files.length} .py/.html files`);

            const pythonStems = new Set(
                files.filter((f) => f.endsWith('.py')).map((f) => f.slice(0, -3))
            );

            for (const file of files) {
                const ext = path.extname(file);
                const stem = file.slice(0, -ext.length);
                const segments = stem.split('/');

                let name: string;
                let rank: number;
                let detail: string;

                if (segments.some((s) => s.startsWith('_'))) {
                    log(`[components]   skipped ${file} (a name part starts with "_")`);
                    continue;
                } else if (ext === '.html') {
                    if (pythonStems.has(stem)) {
                        log(`[components]   skipped ${file} (template of ${stem}.py)`);
                        continue;
                    }
                    name = segments.join('.');
                    rank = 2;
                    detail = 'Component';
                } else if (
                    segments.length >= 2 &&
                    segments[segments.length - 1] === segments[segments.length - 2]
                ) {
                    name = segments.slice(0, -1).join('.');
                    rank = 1;
                    detail = 'Live component';
                } else {
                    name = segments.join('.');
                    rank = 0;
                    detail = 'Live component';
                }

                const relFile = path
                    .relative(project.base, path.join(root, file))
                    .split(path.sep)
                    .join('/');

                const previous = found.get(name);
                if (!previous || rank < previous.rank) {
                    found.set(name, { name, rank, detail, file: relFile });
                }
            }
        }
    }
    return [...found.values()];
}

/**
 * Template names relative to each templates folder, with "/" separators and
 * the .html extension (Django style). Adjust here if PyBlade expects another form.
 */
function templateNames(projects: Project[]): string[] {
    const names = new Set<string>();
    for (const project of projects) {
        for (const root of findRoots(project, project.config.templates)) {
            for (const file of listFiles(root, ['.html'])) {
                names.add(file);
            }
        }
    }
    return [...names];
}

export function getCompletions(
    doc: TextDocument,
    position: Position,
    projects: Project[],
    log: Log = noLog
): CompletionItem[] {
    const linePrefix = doc.getText(
        Range.create(position.line, 0, position.line, position.character)
    );
    const textBefore = doc.getText(
        Range.create(Math.max(0, position.line - 20), 0, position.line, position.character)
    );
    const context = getArgContext(linePrefix, textBefore);

    if (/pb-|@(include|extends|component)/.test(linePrefix)) {
        log(
            `[completion] "...${linePrefix.slice(-30)}" -> ` +
                (context ? `${context.kind}, typed "${context.typed}"` : 'no context') +
                `, ${projects.length} project(s)`
        );
    }

    if (!context || projects.length === 0) {
        return [];
    }

    // Replace everything typed so far so dots and slashes filter correctly
    const replaced = context.typed.length + (context.bare ? 'pb-'.length : 0);
    const range = Range.create(
        position.line,
        position.character - replaced,
        position.line,
        position.character
    );

    if (context.kind === 'template') {
        const items = templateNames(projects).map((name) => ({
            label: name,
            kind: CompletionItemKind.File,
            detail: 'Template',
            filterText: name,
            textEdit: TextEdit.replace(range, name),
        }));
        log(`[completion] ${items.length} template(s)`);
        return items;
    }

    const items = componentNames(projects, log).map((c): CompletionItem => {
        const base: CompletionItem = {
            label: c.name,
            kind: CompletionItemKind.File,
            detail: `${c.detail} · ${c.file}`,
            sortText: `${c.rank}${c.name}`,
            filterText: c.name,
            textEdit: TextEdit.replace(range, c.name),
        };
        if (!context.bare) {
            return base;
        }

        // Typed "pb-" without "<": complete the whole tag, cursor before "/>"
        const escaped = c.name.replace(/[\\$}]/g, '\\$&');
        return {
            ...base,
            label: `pb-${c.name}`,
            filterText: `pb-${c.name}`,
            insertTextFormat: InsertTextFormat.Snippet,
            textEdit: TextEdit.replace(range, `<pb-${escaped} $0/>`),
        };
    });
    log(`[completion] ${items.length} component(s)`);
    return items;
}