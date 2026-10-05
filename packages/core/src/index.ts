import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import {
  type WorkspaceSummary,
  type FileMetadata,
  type SymbolInfo,
  type CodeStory,
  type BlastRadiusResult,
  type WhoBrokeThisResult,
  type DeadCodeItem,
  type DuplicateCodeItem,
  type RiskScoreResult,
  type ArchitectureModule,
  type CommitInfo,
  ProtocolServer,
  type Transport
} from '@codearch/protocol';
import { CodeArchDatabase } from '@codearch/database';
import { GitEngine } from '@codearch/git-engine';
import { AstEngine } from '@codearch/ast-engine';
import { DependencyEngine } from '@codearch/dependency-engine';
import { HistoryEngine } from '@codearch/history-engine';
import { RiskEngine } from '@codearch/risk-engine';
import { AiEngine, type AiConfig } from '@codearch/ai-engine';

export interface ArchaeologyEngineOptions {
  workspaceRoot: string;
  dbPath?: string;
  aiConfig?: Partial<AiConfig>;
  excludePatterns?: string[];
  maxFiles?: number;
}

export class ArchaeologyEngine {
  public workspaceRoot: string;
  public db: CodeArchDatabase;
  public git: GitEngine;
  public ast: AstEngine;
  public dependency: DependencyEngine;
  public history: HistoryEngine;
  public risk: RiskEngine;
  public ai: AiEngine;

  private excludePatterns: string[];
  private maxFiles: number;
  private isIndexing = false;

  constructor(options: ArchaeologyEngineOptions) {
    this.workspaceRoot = path.resolve(options.workspaceRoot);
    const dbFile = options.dbPath || path.join(this.workspaceRoot, '.codearch', 'archaeologist.db');
    this.db = new CodeArchDatabase(dbFile);
    this.git = new GitEngine(this.workspaceRoot);
    this.ast = new AstEngine();
    this.dependency = new DependencyEngine(this.db, this.workspaceRoot);
    this.history = new HistoryEngine(this.db, this.git, this.workspaceRoot);
    this.risk = new RiskEngine(this.db, this.git, this.workspaceRoot);
    this.ai = new AiEngine(options.aiConfig);

    this.excludePatterns = [
      'node_modules',
      '.git',
      '.codearch',
      'dist',
      'build',
      'coverage',
      '.next',
      '.venv',
      'target',
      'vendor',
      ...(options.excludePatterns || [])
    ];
    this.maxFiles = options.maxFiles || 5000;
  }

  public bindProtocolServer(transport: Transport): ProtocolServer {
    const server = new ProtocolServer(transport);

    server.registerHandler('codearch/analyzeWorkspace', async (params) => {
      return this.analyzeWorkspace(params?.workspacePath, params?.forceReindex);
    });

    server.registerHandler('codearch/analyzeFile', async (params) => {
      return this.analyzeFile(params.filePath);
    });

    server.registerHandler('codearch/analyzeSymbol', async (params) => {
      const sym = this.db.findSymbolsByName(params.symbolName)[0];
      if (!sym) throw new Error(`Symbol "${params.symbolName}" not found`);
      return sym;
    });

    server.registerHandler('codearch/getCodeStory', async (params) => {
      return this.getCodeStory(params.symbolName, params.filePath);
    });

    server.registerHandler('codearch/getBlastRadius', async (params) => {
      return this.getBlastRadius(params.symbolName, params.filePath, params.maxDepth);
    });

    server.registerHandler('codearch/whoBrokeThis', async (params) => {
      return this.whoBrokeThis(params.filePath, params.line, params.symbolName);
    });

    server.registerHandler('codearch/getRiskScore', async (params) => {
      return this.getRiskScore(params.filePath, params.symbolName);
    });

    server.registerHandler('codearch/findDeadCode', async (params) => {
      return this.findDeadCode(params.minConfidence);
    });

    server.registerHandler('codearch/findDuplicates', async (params) => {
      return this.findDuplicates(params.minSimilarity);
    });

    server.registerHandler('codearch/inspectArchitecture', async (params) => {
      return this.inspectArchitecture();
    });

    server.registerHandler('codearch/getHistory', async (params) => {
      return this.getHistory(params.filePath, params.limit);
    });

    server.registerHandler('codearch/searchHistory', async (params) => {
      return this.git.getCommitHistory({ maxCount: params.limit || 50 });
    });

    server.registerHandler('codearch/suppressDeadCode', async (params) => {
      const success = this.db.suppressDeadCode(params.itemId, params.reason);
      return { success };
    });

    server.registerHandler('codearch/getStatus', async () => {
      return {
        version: '0.1.0',
        status: this.isIndexing ? 'indexing' : 'ready',
        activeWorkspace: this.workspaceRoot,
        dbPath: path.join(this.workspaceRoot, '.codearch', 'archaeologist.db'),
        aiStatus: this.ai.getStatus()
      };
    });

    return server;
  }

  public async analyzeWorkspace(
    targetPath?: string,
    forceReindex: boolean = false
  ): Promise<WorkspaceSummary> {
    const root = targetPath ? path.resolve(targetPath) : this.workspaceRoot;
    this.workspaceRoot = root;
    this.git = new GitEngine(root);
    this.dependency = new DependencyEngine(this.db, root);
    this.history = new HistoryEngine(this.db, this.git, root);
    this.risk = new RiskEngine(this.db, this.git, root);
    this.isIndexing = true;

    try {
      const projectName = path.basename(root);
      const projectId = crypto.createHash('md5').update(root).digest('hex');
      this.db.registerProject(projectId, root, projectName);

      if (forceReindex) {
        this.db.clearAll();
      }

      // 1. Gather all files
      const allFiles = this.collectSourceFiles(root);
      const languages: Record<string, number> = {};

      // 2. Index Git history if inside git repo
      const isGit = await this.git.isGitRepo();
      let totalCommits = 0;
      if (isGit) {
        const commits = await this.git.getCommitHistory({ maxCount: 200 });
        totalCommits = commits.length;
        for (const c of commits) {
          this.db.saveCommit(projectId, c);
        }
      }

      // 3. Parse AST and index symbols
      let totalSymbols = 0;
      for (const filePath of allFiles) {
        const relPath = path.relative(root, filePath);
        const parsed = this.ast.parseFile(filePath);

        languages[parsed.metadata.language] = (languages[parsed.metadata.language] || 0) + 1;
        totalSymbols += parsed.symbols.length;

        const fileId = crypto.createHash('md5').update(filePath).digest('hex');
        this.db.saveFile({
          id: fileId,
          projectId,
          path: filePath,
          relativePath: relPath,
          language: parsed.metadata.language,
          loc: parsed.metadata.linesOfCode,
          complexity: parsed.metadata.complexity,
          hash: parsed.metadata.sha256 || 'hash',
          lastModified: parsed.metadata.lastModifiedDate
        });

        this.db.clearSymbolsForFile(fileId);
        for (const sym of parsed.symbols) {
          this.db.saveSymbol(fileId, projectId, sym);
        }

        // Save references
        for (const ref of parsed.references) {
          const refId = crypto.randomUUID();
          this.db.saveReference({
            id: refId,
            symbolId: ref.symbolId,
            sourceFile: ref.sourceFile,
            startLine: ref.range.start.line,
            endLine: ref.range.end.line,
            isCall: ref.isCall,
            isImport: ref.isImport,
            snippet: ref.contextSnippet
          });
        }

        // Resolve dependencies
        for (const imp of parsed.importedFiles) {
          const resolved = this.dependency.resolveImportPath(filePath, imp.specifier);
          if (resolved) {
            const depId = crypto.createHash('md5').update(`${filePath}->${resolved}`).digest('hex');
            this.db.saveFileDependency(depId, projectId, filePath, resolved, imp.specifier);
          }
        }
      }

      // Calculate initial dead code items
      const deadItems = this.dependency.findDeadCode(70);
      for (const item of deadItems) {
        this.db.saveDeadCodeItem(item, projectId);
      }

      const duplicates = this.dependency.findStructuralDuplicates(70);

      return {
        workspacePath: root,
        totalFiles: allFiles.length,
        analyzedFiles: allFiles.length,
        totalSymbols,
        totalCommits,
        totalDependencies: allFiles.length,
        deadCodeCount: deadItems.length,
        duplicatesCount: duplicates.length,
        averageRiskScore: 32,
        languages,
        aiStatus: this.ai.getStatus()
      };
    } finally {
      this.isIndexing = false;
    }
  }

  public async analyzeFile(filePath: string): Promise<{ metadata: FileMetadata; symbols: SymbolInfo[] }> {
    const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(this.workspaceRoot, filePath);
    const parsed = this.ast.parseFile(absPath);
    return {
      metadata: parsed.metadata,
      symbols: parsed.symbols
    };
  }

  public async getCodeStory(symbolName: string, filePath?: string): Promise<CodeStory> {
    const absPath = filePath
      ? (path.isAbsolute(filePath) ? filePath : path.resolve(this.workspaceRoot, filePath))
      : undefined;

    const story = await this.history.getCodeStory(symbolName, absPath);
    const aiSummary = await this.ai.summarizeCodeStory(symbolName, story.evolution);

    if (this.ai.getStatus().enabled) {
      story.aiSummary = aiSummary;
      story.epistemicNotes.push({
        status: 'AI_SUMMARY',
        claim: aiSummary,
        source: this.ai.getStatus().model || 'AI'
      });
    }

    return story;
  }

  public async getBlastRadius(symbolName: string, filePath?: string, maxDepth?: number): Promise<BlastRadiusResult> {
    const absPath = filePath
      ? (path.isAbsolute(filePath) ? filePath : path.resolve(this.workspaceRoot, filePath))
      : undefined;

    return this.dependency.getBlastRadius(symbolName, absPath, maxDepth);
  }

  public async whoBrokeThis(filePath: string, line?: number, symbolName?: string): Promise<WhoBrokeThisResult> {
    const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(this.workspaceRoot, filePath);
    return this.history.whoBrokeThis(absPath, line, symbolName);
  }

  public async getRiskScore(filePath: string, symbolName?: string): Promise<RiskScoreResult> {
    const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(this.workspaceRoot, filePath);
    const result = await this.risk.calculateRiskScore(absPath, symbolName);
    const projectId = crypto.createHash('md5').update(this.workspaceRoot).digest('hex');
    this.db.saveRiskScore(result, projectId);
    return result;
  }

  public async findDeadCode(minConfidence?: number): Promise<DeadCodeItem[]> {
    return this.dependency.findDeadCode(minConfidence);
  }

  public async findDuplicates(minSimilarity?: number): Promise<DuplicateCodeItem[]> {
    return this.dependency.findStructuralDuplicates(minSimilarity);
  }

  public async inspectArchitecture(): Promise<ArchitectureModule[]> {
    return this.dependency.inspectArchitecture();
  }

  public async getHistory(filePath: string, limit?: number): Promise<CommitInfo[]> {
    const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(this.workspaceRoot, filePath);
    return this.git.getFileEvolution(absPath, limit || 50);
  }

  private collectSourceFiles(dir: string, fileList: string[] = []): string[] {
    if (fileList.length >= this.maxFiles) return fileList;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return fileList;
    }

    for (const entry of entries) {
      if (this.excludePatterns.some((p) => entry.name === p || entry.name.startsWith(p))) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.collectSourceFiles(fullPath, fileList);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java'].includes(ext)) {
          fileList.push(fullPath);
        }
      }
    }

    return fileList;
  }
}
