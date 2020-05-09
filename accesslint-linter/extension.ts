import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, SettingMonitor, ServerOptions } from 'vscode-languageclient';

export function activate(context: ExtensionContext) {
  let serverModulePath = path.join(__dirname, '..', 'server', 'server.js');
  let debugOptions = { execArgv: ["--nolazy", "--inspect=6010"], cwd: process.cwd() };
  let serverOptions: ServerOptions = {
    run: { module: serverModulePath },
    debug: { module: serverModulePath, options: debugOptions }
  };

  let config = workspace.getConfiguration('accesslint');
  let languages: string[] = config.get('documentSelector');
  let documentSelector = languages.map(language => ({ language, scheme: 'file' }));

  let clientOptions: LanguageClientOptions = {
    documentSelector,
    diagnosticCollectionName: 'accesslint',
    synchronize: {
      configurationSection: 'accesslint'
    }
  }

  let forceDebug = false;
  let client = new LanguageClient('AccessLint', serverOptions, clientOptions, forceDebug);
  context.subscriptions.push(new SettingMonitor(client, 'accesslint.enable').start());
}
