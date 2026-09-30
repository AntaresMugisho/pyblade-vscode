import {
    createConnection,
    InitializeParams,
    ProposedFeatures,
    TextDocumentSyncKind,
    TextDocuments,
    Hover,
    MarkupKind,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { getDirective, END_TAGS, findDirectives } from './directives';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((_params: InitializeParams) => {
    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Full,
            hoverProvider: true,
        },
    };
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

documents.listen(connection);
connection.listen();