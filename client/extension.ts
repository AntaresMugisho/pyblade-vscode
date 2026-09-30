import * as path from 'path';
import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;
let starting = false;

async function hasPybladeConfig(): Promise<boolean> {
    const files = await vscode.workspace.findFiles(
        '**/pyblade.toml',
        '**/{node_modules,.venv,venv,env,site-packages}/**',
        1
    );
    return files.length > 0;
}

async function startClient(context: vscode.ExtensionContext): Promise<void> {
    if (client || starting) {
        return;
    }
    starting = true;

    const serverModule = context.asAbsolutePath(
        path.join('out', 'server', 'server.js')
    );

    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: { execArgv: ['--nolazy', '--inspect=6009'] },
        },
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'pyblade' }],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/{pyblade.toml,*.html}'),
        },
    };

    const newClient = new LanguageClient(
        'pybladeServer',
        'PyBlade Language Server',
        serverOptions,
        clientOptions
    );

    try {
        await newClient.start();
        client = newClient;
    } catch (err) {
        vscode.window.showErrorMessage(`PyBlade Language Server failed to start: ${err}`);
    } finally {
        starting = false;
    }
}

async function stopClient(): Promise<void> {
    const current = client;
    client = undefined;
    if (current) {
        await current.stop();
    }
}

export async function activate(context: vscode.ExtensionContext) {
    if (await hasPybladeConfig()) {
        await startClient(context);
    }

    // React to pyblade.toml being created or deleted while VS Code is open
    const watcher = vscode.workspace.createFileSystemWatcher('**/pyblade.toml');

    context.subscriptions.push(
        watcher,
        watcher.onDidCreate(() => startClient(context)),
        watcher.onDidDelete(async () => {
            if (!(await hasPybladeConfig())) {
                await stopClient();
            }
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(async () => {
            if (await hasPybladeConfig()) {
                await startClient(context);
            } else {
                await stopClient();
            }
        })
    );
}

export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}