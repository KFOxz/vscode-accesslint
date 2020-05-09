'use strict';

/// <reference path="typings/node/node.d.ts" />
/// <reference path="typings/accesslint/accesslint.d.ts" />

import * as server from 'vscode-languageserver';
import * as accesslint from 'accesslint';

interface Settings {
  accesslint: {
    enable: boolean;
    options: any;
  }
  [key: string]: any;
}

let settings: Settings = null;
let linter: any = null;

/**
 * Given an accesslint Error object, approximate the text range highlight
 */
function getRange(error: accesslint.Error): any {
  return {
    start: {
      line: error.location.startLine - 1,
      character: error.location.startCol - 1
    },
    end: {
      line: error.location.endLine - 1,
      character: error.location.endCol - 1
    }
  };
}

/**
 * Given an accesslist error, return a VS Code server Diagnostic object
 */
function makeDiagnostic(problem: accesslint.Error): server.Diagnostic {
  return {
    severity: server.DiagnosticSeverity.Warning,
    message: problem.description,
    range: getRange(problem),
    code: problem.type
  };
}

function getErrorMessage(err: any, document: server.TextDocument): string {
  let result: string = null;
  if (typeof err.message === 'string' || err.message instanceof String) {
    result = <string>err.message;
  } else {
    result = `An unknown error occured while validating file: ${server.Files.uriToFilePath(document.uri)}`;
  }
  return result;
}

function validateAllTextDocuments(connection: server.IConnection, documents: server.TextDocument[]): void {
  let tracker = new server.ErrorMessageTracker();
  documents.forEach(document => {
    try {
      validateTextDocument(connection, document);
    } catch (err) {
      tracker.add(getErrorMessage(err, document));
    }
  });
  tracker.sendErrors(connection);
}

function validateTextDocument(connection: server.IConnection, document: server.TextDocument): void {
  try {
    doValidate(connection, document);
  } catch (err) {
    connection.window.showErrorMessage(getErrorMessage(err, document));
  }
}

let connection: server.IConnection = server.createConnection(process.stdin, process.stdout);
let documents: server.TextDocuments = new server.TextDocuments();
documents.listen(connection);

function trace(message: string, verbose?: string): void {
  connection.tracer.log(message, verbose);
}

connection.onInitialize((params: server.InitializeParams, token: server.CancellationToken) => {
  let rootFolder = params.rootPath;
  let initOptions: {
    nodePath: string;
  } = params.initializationOptions;
  let nodePath = initOptions ? (initOptions.nodePath ? initOptions.nodePath : undefined) : undefined;

  const result = server.Files.resolveModule2(rootFolder, 'accesslint-core', nodePath, trace).
    then((value): server.InitializeResult | server.ResponseError<server.InitializeError> => {
      linter = value.default || value.AccessLint || value;

      let result: server.InitializeResult = { capabilities: { textDocumentSync: documents.syncKind } };
      return result;
    }, (error) => {
      linter = accesslint.default || accesslint.AccessLint || accesslint;
      let result: server.InitializeResult = { capabilities: { textDocumentSync: documents.syncKind } };

      return result;
    });

  return result as Thenable<server.InitializeResult>;
});

async function doValidate(connection: server.IConnection, document: server.TextDocument): Promise<any> {
  try {
    let uri = document.uri;
    let contents = document.getText();
    let errors: accesslint.Error[] = await linter(contents);
    let diagnostics: server.Diagnostic[] = [];

    if (errors.length > 0) {
      errors.forEach(each => {
        diagnostics.push(makeDiagnostic(each));
      });
    }

    connection.sendDiagnostics({ uri, diagnostics });
  } catch (err) {
    let message: string = null;
    if (typeof err.message === 'string' || err.message instanceof String) {
      message = <string>err.message;
      throw new Error(message);
    }
    throw err;
  }
}

documents.onDidChangeContent((event) => {
  validateTextDocument(connection, event.document);
});

connection.onDidChangeConfiguration((params) => {
  settings = params.settings;
  validateAllTextDocuments(connection, documents.all());
});

connection.onDidChangeWatchedFiles((params) => {
  validateAllTextDocuments(connection, documents.all());
});

connection.listen();
