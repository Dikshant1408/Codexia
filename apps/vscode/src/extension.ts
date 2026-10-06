import * as vscode from 'vscode';
import { ArchaeologyEngine } from '@codearch/core';
import { VsCodeAdapter, type IdeAdapterHost } from '@codearch/adapter-vscode';

export function activate(context: vscode.ExtensionContext): void {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const rootPath = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : process.cwd();

  const config = vscode.workspace.getConfiguration('codexia');
  const legacyConfig = vscode.workspace.getConfiguration('codeArchaeologist');
  const aiEnabled = config.get<boolean>('ai.enabled') ?? legacyConfig.get<boolean>('ai.enabled', false);
  const aiProvider = config.get<'none' | 'ollama' | 'openai'>('ai.provider') ?? legacyConfig.get<'none' | 'ollama' | 'openai'>('ai.provider', 'none');
  const aiModel = config.get<string>('ai.model') ?? legacyConfig.get<string>('ai.model', 'qwen2.5-coder:7b');

  const engine = new ArchaeologyEngine({
    workspaceRoot: rootPath,
    aiConfig: {
      enabled: aiEnabled,
      provider: aiProvider,
      model: aiModel
    }
  });

  const host: IdeAdapterHost = {
    getActiveEditor: () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return undefined;
      return {
        document: {
          fileName: editor.document.fileName,
          getText: (r) => editor.document.getText(r),
          lineAt: (l) => editor.document.lineAt(l)
        },
        selection: {
          start: { line: editor.selection.start.line, character: editor.selection.start.character },
          end: { line: editor.selection.end.line, character: editor.selection.end.character }
        }
      };
    },
    getWorkspaceRoot: () => rootPath,
    showInformationMessage: async (msg) => vscode.window.showInformationMessage(msg),
    showWarningMessage: async (msg) => vscode.window.showWarningMessage(msg),
    showErrorMessage: async (msg) => vscode.window.showErrorMessage(msg),
    openWebviewPanel: (viewType, title, htmlContent) => {
      const panel = vscode.window.createWebviewPanel(viewType, title, vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true
      });
      panel.webview.html = htmlContent;
    },
    setEditorDecorations: (decType, ranges) => {
      // Editor decoration placeholder for warning badges
    }
  };

  const adapter = new VsCodeAdapter(engine, host);

  context.subscriptions.push(
    vscode.commands.registerCommand('codearch.analyzeWorkspace', () => adapter.handleAnalyzeWorkspace()),
    vscode.commands.registerCommand('codearch.showCodeStory', () => adapter.handleShowCodeStory()),
    vscode.commands.registerCommand('codearch.showBlastRadius', () => adapter.handleShowBlastRadius()),
    vscode.commands.registerCommand('codearch.investigateChanges', () => adapter.handleInvestigateChanges()),
    vscode.commands.registerCommand('codearch.analyzeRisk', () => adapter.handleAnalyzeRisk()),
    vscode.commands.registerCommand('codearch.findDeadCode', () => adapter.handleFindDeadCode()),
    vscode.commands.registerCommand('codearch.findDuplicates', () => adapter.handleFindDuplicates()),
    vscode.commands.registerCommand('codearch.inspectArchitecture', async () => {
      const arch = await engine.inspectArchitecture();
      host.openWebviewPanel(
        'codearchArch',
        'Architecture Inspect Mode',
        `<html><body style="background:#090d14;color:#f1f5f9;font-family:sans-serif;padding:20px;">
          <h2>Domain Modules (${arch.length})</h2>
          <pre>${JSON.stringify(arch, null, 2)}</pre>
        </body></html>`
      );
    })
  );
}

export function deactivate(): void {}
