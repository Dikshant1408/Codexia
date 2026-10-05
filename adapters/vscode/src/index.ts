import type { ArchaeologyEngine } from '@codearch/core';
import type {
  CodeStory,
  BlastRadiusResult,
  WhoBrokeThisResult,
  DeadCodeItem,
  DuplicateCodeItem,
  RiskScoreResult
} from '@codearch/protocol';

export interface IdeAdapterHost {
  getActiveEditor(): {
    document: { fileName: string; getText(range?: any): string; lineAt(line: number): { text: string } };
    selection: { start: { line: number; character: number }; end: { line: number; character: number } };
  } | undefined;
  getWorkspaceRoot(): string | undefined;
  showInformationMessage(message: string): Promise<string | undefined>;
  showWarningMessage(message: string): Promise<string | undefined>;
  showErrorMessage(message: string): Promise<string | undefined>;
  openWebviewPanel(viewType: string, title: string, htmlContent: string): void;
  setEditorDecorations(decorationType: string, ranges: Array<{ line: number; hoverMessage: string }>): void;
}

export class VsCodeAdapter {
  constructor(
    private engine: ArchaeologyEngine,
    private host: IdeAdapterHost
  ) {}

  public async handleAnalyzeWorkspace(): Promise<void> {
    const root = this.host.getWorkspaceRoot();
    if (!root) {
      await this.host.showErrorMessage('No active workspace folder opened.');
      return;
    }

    await this.host.showInformationMessage('Code Archaeologist: Analyzing workspace...');
    const summary = await this.engine.analyzeWorkspace(root);
    await this.host.showInformationMessage(
      `Analysis complete: ${summary.analyzedFiles} files, ${summary.totalSymbols} symbols, ${summary.deadCodeCount} dead-code candidates.`
    );
  }

  public async handleShowCodeStory(): Promise<void> {
    const editor = this.host.getActiveEditor();
    if (!editor) {
      await this.host.showWarningMessage('Please open a file to view its Code Story.');
      return;
    }

    const fileName = editor.document.fileName;
    const line = editor.selection.start.line + 1;

    // Detect symbol at line
    const fileSymbols = this.engine.db.getSymbolsForFile(fileName);
    const sym = fileSymbols.find((s) => s.range.start.line <= line && line <= s.range.end.line) || fileSymbols[0];
    const symbolName = sym ? sym.name : 'Active Module';

    const story = await this.engine.getCodeStory(symbolName, fileName);
    this.renderInWebview(`Code Story: ${symbolName}`, this.formatStoryHtml(story));
  }

  public async handleShowBlastRadius(): Promise<void> {
    const editor = this.host.getActiveEditor();
    if (!editor) {
      await this.host.showWarningMessage('Please open a file to calculate Blast Radius.');
      return;
    }

    const fileName = editor.document.fileName;
    const line = editor.selection.start.line + 1;
    const fileSymbols = this.engine.db.getSymbolsForFile(fileName);
    const sym = fileSymbols.find((s) => s.range.start.line <= line && line <= s.range.end.line);
    const target = sym ? sym.name : fileName;

    const blast = await this.engine.getBlastRadius(target, fileName);
    this.renderInWebview(`Blast Radius: ${target}`, this.formatBlastHtml(blast));
  }

  public async handleInvestigateChanges(): Promise<void> {
    const editor = this.host.getActiveEditor();
    if (!editor) {
      await this.host.showWarningMessage('Please open a file to investigate.');
      return;
    }

    const fileName = editor.document.fileName;
    const line = editor.selection.start.line + 1;

    const who = await this.engine.whoBrokeThis(fileName, line);
    this.renderInWebview(`Forensics: Line ${line}`, this.formatWhoHtml(who));
  }

  public async handleAnalyzeRisk(): Promise<void> {
    const editor = this.host.getActiveEditor();
    if (!editor) return;

    const fileName = editor.document.fileName;
    const risk = await this.engine.getRiskScore(fileName);
    this.renderInWebview(`Risk Score: ${risk.target}`, this.formatRiskHtml(risk));
  }

  public async handleFindDeadCode(): Promise<void> {
    const items = await this.engine.findDeadCode();
    this.renderInWebview('Dead Code Report', this.formatDeadCodeHtml(items));
  }

  public async handleFindDuplicates(): Promise<void> {
    const items = await this.engine.findDuplicates();
    this.renderInWebview('Structural Duplication Report', this.formatDuplicatesHtml(items));
  }

  public async updateDecorations(): Promise<void> {
    const editor = this.host.getActiveEditor();
    if (!editor) return;

    const fileName = editor.document.fileName;
    const risk = await this.engine.getRiskScore(fileName);

    const decorations: Array<{ line: number; hoverMessage: string }> = [];
    if (risk.score >= 50) {
      decorations.push({
        line: 1,
        hoverMessage: `⚠ Code Archaeologist: High risk module (${risk.score}/100) — ${risk.factors.map(f => f.name).join(', ')}`
      });
    }

    this.host.setEditorDecorations('codeArchaeologistRisk', decorations);
  }

  private renderInWebview(title: string, bodyContent: string): void {
    const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { background: #0b0f17; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
    h2 { color: #38bdf8; font-size: 1.2rem; margin-bottom: 12px; }
    .card { background: #111827; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
    .badge-fact { background: rgba(16,185,129,0.2); color: #10b981; }
    .badge-inf { background: rgba(245,158,11,0.2); color: #f59e0b; }
    pre { background: #161e2e; padding: 12px; border-radius: 6px; overflow-x: auto; font-family: monospace; }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
    this.host.openWebviewPanel('codearchView', title, html);
  }

  private formatStoryHtml(story: CodeStory): string {
    return `<h2>Code Story: ${story.symbolName}()</h2>
<div class="card">
  <div><strong>Created:</strong> ${story.createdDate} (${story.createdCommit})</div>
  <div style="margin: 8px 0;"><strong>Original Purpose:</strong> ${story.originalPurpose}</div>
  <div style="margin-top: 12px;"><strong>Evolution:</strong></div>
  <ul>
    ${story.evolution.map(m => `<li><strong>${m.version}:</strong> ${m.title} (${m.author}, ${m.date.slice(0, 10)})</li>`).join('')}
  </ul>
</div>`;
  }

  private formatBlastHtml(blast: BlastRadiusResult): string {
    return `<h2>Blast Radius: ${blast.symbolName}</h2>
<div class="card">
  <div><strong>Overall Risk:</strong> ${blast.overallRisk} (${blast.riskScore}/100)</div>
  <div><strong>Direct Dependents:</strong> ${blast.directDependents}</div>
  <div><strong>Affected Files:</strong> ${blast.affectedFiles}</div>
  <div><strong>Affected Tests:</strong> ${blast.affectedTests}</div>
</div>`;
  }

  private formatWhoHtml(who: WhoBrokeThisResult): string {
    return `<h2>Forensic Investigation: ${who.target}</h2>
<div class="card">
  <div><strong>Introduced in commit:</strong> ${who.introducedBy.shortHash} by ${who.introducedBy.author} (${who.introducedBy.date.slice(0, 10)})</div>
  <div><strong>Commit message:</strong> "${who.introducedBy.message}"</div>
  <div style="margin-top: 8px;"><strong>Subsequent modifications:</strong> ${who.changedCount} times</div>
  <div><strong>Potential regression:</strong> ${who.potentialRegression}</div>
</div>`;
  }

  private formatRiskHtml(risk: RiskScoreResult): string {
    return `<h2>Risk Breakdown: ${risk.target} (${risk.score}/100 - ${risk.level})</h2>
<div class="card">
  ${risk.factors.map(f => `<div><strong>${f.name} (+${f.score}/${f.maxScore}):</strong> ${f.reason}</div>`).join('')}
</div>`;
  }

  private formatDeadCodeHtml(items: DeadCodeItem[]): string {
    return `<h2>Dead Code Report (${items.length} items)</h2>
${items.map(d => `<div class="card"><strong>${d.symbolName}()</strong> - ${d.filePath}:${d.line} (${d.confidence}% confidence)</div>`).join('')}`;
  }

  private formatDuplicatesHtml(items: DuplicateCodeItem[]): string {
    return `<h2>Structural Duplication Report (${items.length} items)</h2>
${items.map(d => `<div class="card"><strong>${d.symbolA.name} &harr; ${d.symbolB.name}</strong> (${d.similarity}% match)<br>Possible Extraction: ${d.possibleExtraction}</div>`).join('')}`;
  }
}
