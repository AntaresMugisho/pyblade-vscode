export type ArgsMode = 'none' | 'optional' | 'required';

export interface DirectiveDef {
    description: string;
    args: ArgsMode;
    /** Closing directive, e.g. "endif" */
    end?: string;
    params?: string[];
    optionalParams?: string[];
}

type DirectiveEntry = DirectiveDef | { aliasOf: string; end?: string };

const ENTRIES: Record<string, DirectiveEntry> = {
    // Control flow
    if: { description: 'Renders its content when the Python expression is true.', args: 'required', end: 'endif' },
    elif: { description: 'Additional condition inside an `@if` block.', args: 'required' },
    else: { description: 'Fallback branch of a conditional block.', args: 'none' },
    for: { description: 'Loops over an iterable (e.g. `@for(item in items)`).', args: 'required', end: 'endfor' },
    empty: { description: 'Branch of a `@for` loop rendered when the iterable is empty.', args: 'none' },
    unless: { description: 'Renders its content when the expression is False.', args: 'required', end: 'endunless' },
    match: { description: 'Starts a match block compared against `@case` branches.', args: 'required', end: 'endmatch' },
    switch: { description: 'Starts a switch block compared against `@case` branches.', args: 'required', end: 'endswitch' },
    case: { description: 'A branch inside `@switch` / `@match`.', args: 'required' },
    default: { description: 'Fallback branch inside `@switch` / `@match`.', args: 'none' },
    with: { description: 'Binds local variables for the enclosed content.', args: 'required', end: 'endwith' },
    ifchanged: { description: 'Renders its content only when a value changed since the previous loop iteration.', args: 'optional', end: 'endifchanged' },
    break: { description: 'Exits the current loop, optionally when a condition is true.', args: 'optional' },
    continue: { description: 'Skips to the next loop iteration, optionally when a condition is true.', args: 'optional' },
    cycle: { description: 'Cycles through the given values on each loop iteration.', args: 'required' },
    resetcycle: { description: 'Resets a `@cycle` back to its first value.', args: 'optional' },

    // Auth / state
    auth: { description: 'Renders its content for authenticated users.', args: 'none', end: 'endauth' },
    guest: { description: 'Renders its content for unauthenticated users.', args: 'none', end: 'endguest' },
    anonymous: { description: 'Renders its content for anonymous users.', args: 'none', end: 'endanonymous' },
    error: { description: 'Renders its content when the given form field has an error.', args: 'required', end: 'enderror' },
    active: { description: 'Outputs the content inside if the current URL is the active one.', args: 'required', end: 'endactive' },

    // Layout and composition
    extends: { description: "Declares the parent template (e.g. `@extends('layouts/base')`).", args: 'required' },
    block: { description: 'Defines a named block that child templates can override.', args: 'required', end: 'endblock' },
    parent: { description: "Renders the parent template's content for the current block.", args: 'none' },
    section: { description: 'Defines a named section placed into the parent layout.', args: 'required', end: 'endsection' },
    yield: { description: 'Outputs the content of a named section.', args: 'required' },
    include: { description: "Includes another template (e.g. `@include('partials/nav')`).", args: 'required', params: ['string'] },
    push: { description: 'Pushes content onto a named stack.', args: 'required', end: 'endpush' },
    stack: { description: 'Outputs a named stack.', args: 'required', end: 'endstack' },
    component: { description: "Renders a component (e.g. `@component('nav/menu')`).", args: 'required', end: 'endcomponent' },
    slot: { description: 'Defines a named slot passed to a component.', args: 'required', end: 'endslot' },
    script: { description: 'Places extra live comonents scripts at the same place in a template.', args: 'none', end: 'endscript' },
    pbstyles: { description: 'Outputs the default PyBlade styles.', args: 'none' }, 
    pbscripts: { description: 'Outputs the default PyBlade scripts.', args: 'none' },
    comment: { description: 'Block comment, not rendered in the output.', args: 'none', end: 'endcomment' },
    verbatim: { description: 'Outputs its content without processing directives.', args: 'none', end: 'endverbatim' },
    spaceless: { description: 'Removes whitespace between HTML tags in its content.', args: 'none', end: 'endspaceless' },
    lorem: { description: 'Generates placeholder text.', args: 'optional' },
    debug: {description: 'Render the active context when DEBUG is True', args: 'none'},
        
    // Helpers
    url: { description: "Accepts a string: the relative or absolute URL (e.g., `@url('home')`).", args: 'required', params: ['string'] },
    static: { description: "Accepts a string: the path to the static resource (e.g., `@static('css/style.css')`).", args: 'required', params: ['string'] },
    class: { description: "Conditional classes", args: 'required', params: ['object'] },
    style: { description: 'Conditional styles.', args: 'required' },
    props: { description: 'In a Component, defines default props.', args: 'optional' },
    field: { description: "Form field's widget modifier", args: 'optional' },
    csrf: { description: 'Outputs the CSRF token field.', args: 'none' },
    now: { description: 'Outputs the current date/time with the given format.', args: 'required' },
    querystring: { description: 'Builds a query string from the given parameters.', args: 'optional' },
    firstof: { description: 'Outputs the first argument that is not empty.', args: 'required' },
    ratio: { description: 'Outputs the ratio of two numbers at a given scale.', args: 'required' },
    widthratio: { aliasOf: 'ratio' },
    regroup: { description: 'Regroups a list of objects by a common attribute.', args: 'required' },
    get_static_prefix: { description: 'Outputs the static files URL prefix.', args: 'none' },
    get_media_prefix: { description: 'Outputs the media files URL prefix.', args: 'none' },
    gsp: { aliasOf: 'get_static_prefix' },
    gmp: { aliasOf: 'get_media_prefix' },

    // Form attribute helpers
    checked: { description: 'Adds the `checked` attribute when the condition is true.', args: 'required' },
    selected: { description: 'Adds the `selected` attribute when the condition is true.', args: 'required' },
    required: { description: 'Adds the `required` attribute when the condition is true.', args: 'required' },
    autofocus: { description: 'Adds the `autofocus` attribute when the condition is true.', args: 'required' },
    multiple: { description: 'Adds the `multiple` attribute when the condition is true.', args: 'required' },
    readonly: { description: 'Adds the `readonly` attribute when the condition is true.', args: 'required' },

    // i18n
    translate: {
        description: "Accepts a key and optional replacements: localized string (e.g., `@translate('welcome', {'user': 'John'})`).",
        args: 'required', params: ['string'], optionalParams: ['object'],
    },
    trans: { aliasOf: 'translate' },
    blocktranslate: { description: 'Translates a block of text that may contain variables.', args: 'optional', end: 'endblocktranslate' },
    blocktrans: { aliasOf: 'blocktranslate', end: 'endblocktrans' },
    plural: { description: 'Plural form inside a `@blocktranslate` block.', args: 'optional' },
    lang: { description: 'Current language', args: 'optional' },
    languages: { description: 'List of languages', args: 'optional' },
};

export function getDirective(name: string): DirectiveDef | undefined {
    // hasOwn avoids inherited keys such as "constructor"
    if (!Object.hasOwn(ENTRIES, name)) {
        return undefined;
    }
    const entry = ENTRIES[name];
    if (!('aliasOf' in entry)) {
        return entry;
    }
    const base = ENTRIES[entry.aliasOf] as DirectiveDef;
    return { ...base, end: entry.end };
}

/** Maps a closing tag to its opener, e.g. "endif" -> "if" */
export const END_TAGS = new Map<string, string>();
for (const name of Object.keys(ENTRIES)) {
    const end = getDirective(name)?.end;
    if (end) {
        END_TAGS.set(end, name);
    }
}

export const DIRECTIVE_NAMES: string[] = [...Object.keys(ENTRIES), ...END_TAGS.keys()];

export interface Directive {
    name: string;
    /** Offset of the "@" */
    nameStart: number;
    /** Offset just after the name */
    nameEnd: number;
    /** Offset just after "(" , or -1 if the directive has no (closed) argument list */
    argsStart: number;
    /** Offset of the matching ")", or -1 */
    argsEnd: number;
}

/**
 * Finds the matching ")" for the "(" at `openIndex`, honouring nesting
 * and quoted strings. Returns -1 if it is never closed.
 */
function findClosingParen(text: string, openIndex: number): number {
    let depth = 0;
    let quote: string | null = null;

    for (let i = openIndex; i < text.length; i++) {
        const c = text[i];

        if (quote) {
            if (c === "\\") {
                i++; // skip escaped character
            } else if (c === quote) {
                quote = null;
            }
            continue;
        }

        if (c === "'" || c === '"') {
            quote = c;
        } else if (c === "(") {
            depth++;
        } else if (c === ")") {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}

export function findDirectives(text: string): Directive[] {
    const directives: Directive[] = [];
    // "@name" not preceded by a word character or another "@" (skips emails and "@@" escapes)
    const re = /(?<![\w@])@(\w+)/g;

    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
        const name = match[1];
        const nameStart = match.index;
        const nameEnd = nameStart + 1 + name.length;

        let i = nameEnd;
        while (text[i] === " " || text[i] === "\t") {
            i++;
        }

        let argsStart = -1;
        let argsEnd = -1;

        if (text[i] === "(") {
            const close = findClosingParen(text, i);
            if (close !== -1) {
                argsStart = i + 1;
                argsEnd = close;
                re.lastIndex = close + 1; // don't rescan inside the arguments
            }
        }

        directives.push({ name, nameStart, nameEnd, argsStart, argsEnd });
    }
    return directives;
}