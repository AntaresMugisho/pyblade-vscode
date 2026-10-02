import {
    createConnection,
    CompletionItem,
    Hover,
    InitializeParams,
    InitializeResult,
    MarkupKind,
    ProposedFeatures,
    TextDocumentSyncKind,
    TextDocuments,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { fileURLToPath } from 'url';

import { END_TAGS, findDirectives, getDirective } from './directives';
import { discoverProjects, invalidateDirIndex, Project } from './config';
import { getCompletions } from './completion';
import { getDefinition } from './definition';
import { getDiagnostics } from './diagnostics';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let roots: string[] = [];
let projects: Project[] = [];
let supportsFolderChanges = false;
let supportsLinks = false;

function uriToPath(uri: string): string | undefined {
    try {
        return fileURLToPath(uri);
    } catch {
        return undefined;
    }
}

function logProjects(): void {
    connection.console.log(
        projects.length === 0
            ? 'PyBlade: no pyblade.toml found in the workspace'
            : 'PyBlade projects: ' +
                  projects
                      .map(
                          (p) =>
                              `${p.base} (templates="${p.config.templates}", components="${p.config.components}"` +
                              (p.config.settings ? `, settings="${p.config.settings}"` : '') +
                              ')'
                      )
                      .join('; ')
    );
}

function reloadProjects(): void {
    invalidateDirIndex();
    projects = discoverProjects(roots);
    logProjects();
    revalidateAll();
}

// ---- Diagnostics: recomputed shortly after each edit, and for all open files when the project changes ----

const pendingValidation = new Map<string, ReturnType<typeof setTimeout>>();

function validate(doc: TextDocument): void {
    connection.sendDiagnostics({ uri: doc.uri, diagnostics: getDiagnostics(doc, projects) });
}

function scheduleValidation(doc: TextDocument, delay = 300): void {
    const existing = pendingValidation.get(doc.uri);
    if (existing) {
        clearTimeout(existing);
    }
    pendingValidation.set(
        doc.uri,
        setTimeout(() => {
            pendingValidation.delete(doc.uri);
            validate(doc);
        }, delay)
    );
}

function revalidateAll(): void {
    for (const doc of documents.all()) {
        scheduleValidation(doc, 500);
    }
}

connection.onInitialize((params: InitializeParams): InitializeResult => {
    const folders =
        params.workspaceFolders ??
        (params.rootUri ? [{ uri: params.rootUri, name: 'root' }] : []);

    roots = folders
        .map((f) => uriToPath(f.uri))
        .filter((p): p is string => p !== undefined);
    projects = discoverProjects(roots);

    supportsFolderChanges = !!params.capabilities.workspace?.workspaceFolders;
    supportsLinks = !!params.capabilities.textDocument?.definition?.linkSupport;

    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Full,
            hoverProvider: true,
            definitionProvider: true,
            completionProvider: { triggerCharacters: ["'", '"', '/', '.', '-', ':'] },
            workspace: supportsFolderChanges
                ? { workspaceFolders: { supported: true, changeNotifications: true } }
                : undefined,
        },
    };
});

connection.onInitialized(() => {
    logProjects();
    if (!supportsFolderChanges) {
        return;
    }
    connection.workspace.onDidChangeWorkspaceFolders((event) => {
        const removed = new Set(event.removed.map((f) => uriToPath(f.uri)));
        const added = event.added
            .map((f) => uriToPath(f.uri))
            .filter((p): p is string => p !== undefined);

        roots = roots.filter((r) => !removed.has(r)).concat(added);
        reloadProjects();
    });
});

// Sent by the client's file watcher (see `synchronize.fileEvents` in extension.ts)
connection.onDidChangeWatchedFiles((change) => {
    if (change.changes.some((c) => c.uri.endsWith('pyblade.toml'))) {
        reloadProjects();
    } else {
        invalidateDirIndex();
        revalidateAll(); // a template, component, urls.py or static file appeared or disappeared
    }
});

documents.onDidChangeContent((event) => scheduleValidation(event.document));

documents.onDidClose((event) => {
    const pending = pendingValidation.get(event.document.uri);
    if (pending) {
        clearTimeout(pending);
        pendingValidation.delete(event.document.uri);
    }
    connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

connection.onHover((params): Hover | null => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
        return null;
    }

    const offset = doc.offsetAt(params.position);
    const directive = findDirectives(doc.getText()).find(
        (d) => offset >= d.nameStart && offset <= d.nameEnd
    );
    if (!directive) {
        return null;
    }

    const def = getDirective(directive.name);
    const opener = END_TAGS.get(directive.name);

    let value: string;
    if (def) {
        value = `**@${directive.name}**\n\n${def.description}`;
        if (def.end) {
            value += `\n\nClosed by \`@${def.end}\`.`;
        }
    } else if (opener) {
        value = `**@${directive.name}**\n\nCloses \`@${opener}\`.`;
    } else {
        return null;
    }

    return {
        contents: { kind: MarkupKind.Markdown, value },
        range: {
            start: doc.positionAt(directive.nameStart),
            end: doc.positionAt(directive.nameEnd),
        },
    };
});

connection.onDefinition((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
        return null;
    }
    return getDefinition(doc, params.position, projects, supportsLinks);
});

connection.onCompletion((params): CompletionItem[] => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
        return [];
    }
    return getCompletions(doc, params.position, projects, (m) => connection.console.log(m));
});

documents.listen(connection);
connection.listen();