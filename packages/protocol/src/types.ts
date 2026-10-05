/**
 * Epistemic classification status
 * FACT: Directly verified through Git commits, diffs, AST, or deterministic analysis.
 * INFERENCE: Derived through structural heuristics, commit message semantics, or graph analysis.
 * AI_SUMMARY: Generated or synthesized by an LLM (Ollama or OpenAI-compatible).
 * UNKNOWN: Information could not be established with confidence.
 */
export type EpistemicStatus = 'FACT' | 'INFERENCE' | 'AI_SUMMARY' | 'UNKNOWN';

export interface EpistemicNote {
  status: EpistemicStatus;
  claim: string;
  source: string;
}

export type SymbolKind =
  | 'function'
  | 'method'
  | 'class'
  | 'interface'
  | 'variable'
  | 'type'
  | 'module'
  | 'endpoint';

export interface Position {
  line: number; // 1-indexed
  column: number; // 1-indexed
}

export interface Range {
  start: Position;
  end: Position;
}

export interface SymbolInfo {
  id: string; // e.g., "src/auth/AuthService.ts#AuthService.login"
  name: string;
  kind: SymbolKind;
  filePath: string;
  range: Range;
  signature?: string;
  docstring?: string;
  complexity: number;
  parametersCount?: number;
  returnType?: string;
  isExported: boolean;
  parentSymbolId?: string;
}

export interface ReferenceInfo {
  symbolId: string;
  sourceFile: string;
  range: Range;
  contextSnippet?: string;
  isCall: boolean;
  isImport: boolean;
}

export interface FileMetadata {
  path: string;
  relativePath: string;
  language: string;
  linesOfCode: number;
  complexity: number;
  symbolsCount: number;
  lastModifiedDate: string;
  gitCommitHash?: string;
  sha256?: string;
  isPartialAnalysis?: boolean;
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  message: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface SymbolEvolutionMilestone {
  version: string;
  title: string;
  description: string;
  commitHash: string;
  author: string;
  date: string;
  type: 'create' | 'feature' | 'fix' | 'refactor' | 'breaking';
  epistemicStatus: EpistemicStatus;
}

export interface CurrentStateMetrics {
  complexity: 'Low' | 'Medium' | 'High';
  complexityScore: number;
  dependentsCount: number;
  dependenciesCount: number;
  testsCount: number;
  lastModifiedRelative: string;
  risk: 'Low' | 'Medium' | 'High';
  riskScore: number;
}

export interface CodeStory {
  symbolName: string;
  filePath: string;
  createdDate: string;
  createdCommit: string;
  originalPurpose: string;
  evolution: SymbolEvolutionMilestone[];
  currentState: CurrentStateMetrics;
  epistemicNotes: EpistemicNote[];
  aiSummary?: string;
}

export interface BlastRadiusNode {
  id: string;
  name: string;
  filePath: string;
  kind: SymbolKind | 'file' | 'endpoint' | 'test';
  depth: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  children: BlastRadiusNode[];
}

export interface BlastRadiusResult {
  symbolName: string;
  filePath: string;
  directDependents: number;
  indirectDependents: number;
  affectedFiles: number;
  affectedTests: number;
  apiEndpoints: number;
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore: number;
  tree: BlastRadiusNode;
}

export interface InvestigationStep {
  level: 'Line' | 'Commit' | 'RelatedFiles' | 'Modifications' | 'Tests' | 'Regression';
  title: string;
  description: string;
  details: Record<string, unknown>;
}

export interface WhoBrokeThisResult {
  target: string;
  filePath: string;
  lineNumber?: number;
  introducedBy: {
    commitHash: string;
    shortHash: string;
    author: string;
    date: string;
    message: string;
  };
  changedCount: number;
  relatedCommits: Array<{
    hash: string;
    shortHash: string;
    message: string;
    date: string;
  }>;
  potentialRegression: 'LOW' | 'MEDIUM' | 'HIGH';
  explanation: string;
  epistemicNotes: EpistemicNote[];
  chain: InvestigationStep[];
}

export interface DeadCodeItem {
  id: string;
  symbolName: string;
  filePath: string;
  line: number;
  kind: SymbolKind;
  confidence: number; // 0 - 100%
  reasons: string[];
  lastModified: string;
  isSuppressed: boolean;
}

export interface DuplicateCodeItem {
  id: string;
  symbolA: {
    name: string;
    filePath: string;
    line: number;
    snippet?: string;
  };
  symbolB: {
    name: string;
    filePath: string;
    line: number;
    snippet?: string;
  };
  similarity: number; // 0 - 100%
  sharedStructure: string[];
  possibleExtraction: string;
}

export interface CodeDna {
  symbolName: string;
  filePath: string;
  businessLogic: number; // 0 - 10
  database: number;      // 0 - 10
  api: number;           // 0 - 10
  validation: number;    // 0 - 10
  logging: number;       // 0 - 10
  complexity: number;
  coupling: 'Low' | 'Medium' | 'High';
  cohesion: 'Low' | 'Medium' | 'High';
  testCoverage: number; // 0 - 100%
  changeFrequency: 'Low' | 'Medium' | 'High';
}

export interface RiskFactor {
  name: string;
  score: number; // points added
  maxScore: number;
  reason: string;
}

export interface RiskScoreResult {
  target: string;
  filePath: string;
  score: number; // 0 - 100
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: RiskFactor[];
  formula: string;
}

export interface ArchitectureModule {
  id: string;
  name: string;
  path: string;
  type: 'module' | 'package' | 'directory';
  symbolsCount: number;
  filesCount: number;
  dependencies: string[];
  callers: string[];
  riskScore: number;
  children?: ArchitectureModule[];
}

export interface WorkspaceSummary {
  workspacePath: string;
  totalFiles: number;
  analyzedFiles: number;
  totalSymbols: number;
  totalCommits: number;
  totalDependencies: number;
  deadCodeCount: number;
  duplicatesCount: number;
  averageRiskScore: number;
  languages: Record<string, number>;
  aiStatus: {
    enabled: boolean;
    provider?: string;
    model?: string;
    statusText: string;
  };
}
