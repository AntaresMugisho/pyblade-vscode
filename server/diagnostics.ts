import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Project } from './config';
import {
    DIRECTIVE_NAMES,
    Directive,
    END_TAGS,
    findDirectives,
    getDirective,
} from './directives';
import { componentRootsOf, resolveComponent, resolveTemplate, templateRootsOf } from './definition';
import { findUrlNames, resolveStaticFile, staticRootsOf } from './django';

/** Documents bigger than this are not analysed (keeps typing responsive). */
const MAX_LENGTH = 1_000_000;

/**
 * Directives that also have an inline form (e.g. `@section('title', 'Home')`,
 * `@component('nav.menu')`), so a missing closing tag is NOT reported for them.
 * A stray closing tag (e.g. `@endsection` alone) is still reported.
 * Edit this list to match how PyBlade really works.
 */
const SOFT_BLOCKS = new Set(['component', 'slot', 'section', 'push', 'script', 'active', 'stack', 'regroup', 'cycle', 'resetcycle', 'querystring', 'firstof', 'debug', 'now', 'translate', 'trans', 'u,rl', 'static', 'get_media_prefix', 'get_static_prefix', 'gmp', 'gesp', 'ratio', 'witdhratio', 'lang', 'languages', 'pbscripts', 'pbstyles', 'yield', 'props', 'style', 'class', 'required', 'selected', 'checked', 'multiple', 'autofocus', 'readonly', 'field']);

/** Directives that only make sense inside another block (@if ... @else ... @endif). */
const INTERMEDIATES = new Set(['else', 'elif', 'empty', 'case', 'default', 'plural', 'break', 'continue', 'parent']);

/** Matches `("name"` right after a directive name; sticky so we never slice the text. */
const FIRST_STRING = /\s*\(\s*(['"])([^'"\n]*)\1/y;

function levenshtein(a: string, b: string): number {
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) {
            current[j] = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
        previous = current;
    }
    return previous[b.length];
}

/**
 * Closest known directive, only when it is a plausible typo: short names must
 * differ by 1 character, longer ones by at most 2. This keeps CSS at-rules
 * (@media, @import) and framework attributes (@click) from being flagged.
 */
function closestDirective(name: string): string | undefined {
    if (name.length < 4) {
        return undefined;
    }
    const max = name.length <= 5 ? 1 : 2;

    let best: string | undefined;
    let bestDistance = max + 1;
    for (const known of DIRECTIVE_NAMES) {
        if (Math.abs(known.length - name.length) > max) {
            continue;
        }
        const distance = levenshtein(name, known);
        if (distance < bestDistance) {
            best = known;
            bestDistance = distance;
        }
    }
    return best;
}

function once<T>(fn: () => T): () => T {
    let done = false;
    let value: T;
    return () => {
        if (!done) {
            value = fn();
            done = true;
        }
        return value;
    };
}

/** First quoted argument of the directive whose name ends at `offset`. */
function firstStringArg(
    text: string,
    offset: number
): { name: string; start: number; end: number } | undefined {
    FIRST_STRING.lastIndex = offset;
    const m = FIRST_STRING.exec(text);
    if (!m) {
        return undefined;
    }
    const end = offset + m[0].length - 1; // closing quote
    return { name: m[2], start: end - m[2].length, end };
}

/** True when the directive name is followed (after spaces/tabs) by "(". */
function followedByParen(text: string, from: number): boolean {
    let i = from;
    while (text[i] === ' ' || text[i] === '\t') {
        i++;
    }
    return text[i] === '(';
}

interface OpenBlock {
    directive: Directive;
    end: string;
    soft: boolean;
}

export function getDiagnostics(doc: TextDocument, projects: Project[]): Diagnostic[] {
    const text = doc.getText();
    if (text.length > MAX_LENGTH) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    const report = (
        start: number,
        end: number,
        severity: DiagnosticSeverity,
        code: string,
        message: string
    ) => {
        diagnostics.push({
            range: { start: doc.positionAt(start), end: doc.positionAt(end) },
            severity,
            code,
            source: 'PyBlade',
            message,
        });
    };

    // {# comments #}: nothing inside is analysed
    const commentRanges: Array<[number, number]> = [];
    for (const m of text.matchAll(/\{#[\s\S]*?#\}/g)) {
        commentRanges.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
    }
    const inComment = (offset: number) => commentRanges.some(([s, e]) => offset >= s && offset < e);

    const directives = findDirectives(text).filter((d) => !inComment(d.nameStart));

    // -----------------------------------------------------------------------
    // 1. Block structure: @if ... @endif, @for ... @endfor, ...
    // -----------------------------------------------------------------------
    const stack: OpenBlock[] = [];
    const literalRanges: Array<[number, number]> = []; // inside @verbatim / @comment
    let waitingFor: string | undefined; // closing tag we skip ahead to inside @verbatim / @comment
    let literalStart = 0;

    for (const d of directives) {
        if (waitingFor) {
            if (d.name !== waitingFor) {
                continue; // literal text, not directives
            }
            literalRanges.push([literalStart, d.nameStart]);
            waitingFor = undefined;
        }

        const openerName = END_TAGS.get(d.name);
        if (openerName) {
            // Closing tag. Skip optional-end blocks that were never closed.
            let i = stack.length - 1;
            while (i >= 0 && stack[i].soft && stack[i].directive.name !== openerName) {
                i--;
            }

            if (i >= 0 && stack[i].directive.name === openerName) {
                stack.length = i;
            } else if (stack.some((s) => s.directive.name === openerName)) {
                // The opener is further down: everything above it was left open
                while (stack.length > 0) {
                    const open = stack.pop() as OpenBlock;
                    if (open.directive.name === openerName) {
                        break;
                    }
                    if (!open.soft) {
                        report(
                            open.directive.nameStart,
                            open.directive.nameEnd,
                            DiagnosticSeverity.Error,
                            'unclosed-block',
                            `@${open.directive.name} is never closed (expected @${open.end} before @${d.name})`
                        );
                    }
                }
            } else {
                const top = [...stack].reverse().find((s) => !s.soft);
                report(
                    d.nameStart,
                    d.nameEnd,
                    DiagnosticSeverity.Error,
                    'unexpected-end',
                    top
                        ? `Unexpected @${d.name}: @${top.directive.name} is still open (expected @${top.end})`
                        : `@${d.name} has no matching @${openerName}`
                );
            }
            continue;
        }

        const def = getDirective(d.name);
        if (def?.end) {
            stack.push({ directive: d, end: def.end, soft: SOFT_BLOCKS.has(d.name) });
            if (d.name === 'verbatim' || d.name === 'comment') {
                waitingFor = def.end;
                literalStart = d.nameEnd;
            }
            continue;
        }

        if (INTERMEDIATES.has(d.name) && stack.every((s) => s.soft)) {
            report(
                d.nameStart,
                d.nameEnd,
                DiagnosticSeverity.Warning,
                'misplaced-directive',
                `@${d.name} is only valid inside a block such as @if, @for, @block, @section or @blocktranslate`
            );
        }
    }

    if (waitingFor) {
        literalRanges.push([literalStart, text.length]);
    }
    for (const open of stack) {
        if (!open.soft) {
            report(
                open.directive.nameStart,
                open.directive.nameEnd,
                DiagnosticSeverity.Error,
                'unclosed-block',
                `@${open.directive.name} is never closed (expected @${open.end})`
            );
        }
    }

    const inLiteral = (offset: number) => literalRanges.some(([s, e]) => offset >= s && offset < e);

    // -----------------------------------------------------------------------
    // 2. Unclosed argument lists   3. Unknown (misspelled) directives
    // -----------------------------------------------------------------------
    for (const d of directives) {
        if (inLiteral(d.nameStart)) {
            continue;
        }

        const known = getDirective(d.name) !== undefined || END_TAGS.has(d.name);
        if (known) {
            if (d.argsStart === -1 && followedByParen(text, d.nameEnd)) {
                report(
                    d.nameStart,
                    d.nameEnd,
                    DiagnosticSeverity.Error,
                    'unclosed-arguments',
                    `Unclosed argument list for @${d.name}: missing ")" or a closing quote`
                );
            }
            continue;
        }

        // Only lowercase names that are not followed by = . : - (@click="..", @click.prevent, @font-face)
        const next = text[d.nameEnd];
        if (!/^[a-z]/.test(d.name) || (next !== undefined && '=.:-@'.includes(next))) {
            continue;
        }
        const suggestion = closestDirective(d.name);
        if (suggestion) {
            report(
                d.nameStart,
                d.nameEnd,
                DiagnosticSeverity.Warning,
                'unknown-directive',
                `Unknown directive @${d.name}. Did you mean @${suggestion}?`
            );
        }
    }

    // -----------------------------------------------------------------------
    // 4. References that do not resolve (warnings: names can be built dynamically)
    // -----------------------------------------------------------------------
    if (projects.length === 0) {
        return diagnostics;
    }

    const templateRoots = once(() => templateRootsOf(projects));
    const componentRoots = once(() => componentRootsOf(projects));
    const staticRoots = once(() => staticRootsOf(projects));
    const urlNames = once(() => new Set(findUrlNames(projects).map((u) => u.name)));

    for (const d of directives) {
        if (inLiteral(d.nameStart)) {
            continue;
        }
        if (!['include', 'extends', 'component', 'url', 'static'].includes(d.name)) {
            continue;
        }

        const arg = firstStringArg(text, d.nameEnd);
        if (!arg || !arg.name || /[{}#$]/.test(arg.name)) {
            continue; // not a plain string literal
        }

        switch (d.name) {
            case 'include':
            case 'extends':
                if (templateRoots().length > 0 && !resolveTemplate(projects, arg.name, templateRoots())) {
                    report(
                        arg.start,
                        arg.end,
                        DiagnosticSeverity.Warning,
                        'missing-template',
                        `Template "${arg.name}" not found`
                    );
                }
                break;

            case 'component':
                if (componentRoots().length > 0 && !resolveComponent(projects, arg.name, componentRoots())) {
                    report(
                        arg.start,
                        arg.end,
                        DiagnosticSeverity.Warning,
                        'missing-component',
                        `Component "${arg.name}" not found`
                    );
                }
                break;

            case 'url':
                // Names from django.contrib.admin and other installed packages are not in the project
                if (
                    !arg.name.startsWith('admin:') &&
                    urlNames().size > 0 &&
                    !urlNames().has(arg.name)
                ) {
                    report(
                        arg.start,
                        arg.end,
                        DiagnosticSeverity.Warning,
                        'missing-url',
                        `URL name "${arg.name}" not found in any urls.py`
                    );
                }
                break;

            case 'static':
                if (
                    !/^(https?:)?\/\/|^data:/.test(arg.name) &&
                    staticRoots().length > 0 &&
                    !resolveStaticFile(projects, arg.name, staticRoots())
                ) {
                    report(
                        arg.start,
                        arg.end,
                        DiagnosticSeverity.Warning,
                        'missing-static',
                        `Static file "${arg.name}" not found`
                    );
                }
                break;
        }
    }

    // <pb-nav.menu /> tags
    for (const m of text.matchAll(/<pb-([\w.-]+)/g)) {
        const end = (m.index ?? 0) + m[0].length;
        const start = end - m[1].length;
        if (inComment(start) || inLiteral(start)) {
            continue;
        }
        if (componentRoots().length > 0 && !resolveComponent(projects, m[1], componentRoots())) {
            report(
                start,
                end,
                DiagnosticSeverity.Warning,
                'missing-component',
                `Component "${m[1]}" not found`
            );
        }
    }

    return diagnostics;
}