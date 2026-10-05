import type {
  WorkspaceSummary,
  FileMetadata,
  SymbolInfo,
  CodeStory,
  BlastRadiusResult,
  WhoBrokeThisResult,
  DeadCodeItem,
  DuplicateCodeItem,
  RiskScoreResult,
  ArchitectureModule,
  CommitInfo
} from './types.js';

export interface JsonRpcRequest<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params: T;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface JsonRpcNotification<T = unknown> {
  jsonrpc: '2.0';
  method: string;
  params: T;
}

// Universal Protocol Method Map
export interface ProtocolMethodMap {
  'codearch/analyzeWorkspace': {
    params: { workspacePath?: string; forceReindex?: boolean };
    result: WorkspaceSummary;
  };
  'codearch/analyzeFile': {
    params: { filePath: string };
    result: { metadata: FileMetadata; symbols: SymbolInfo[] };
  };
  'codearch/analyzeSymbol': {
    params: { symbolName: string; filePath?: string };
    result: SymbolInfo;
  };
  'codearch/getCodeStory': {
    params: { symbolName: string; filePath?: string };
    result: CodeStory;
  };
  'codearch/getBlastRadius': {
    params: { symbolName: string; filePath?: string; maxDepth?: number };
    result: BlastRadiusResult;
  };
  'codearch/whoBrokeThis': {
    params: { filePath: string; line?: number; symbolName?: string };
    result: WhoBrokeThisResult;
  };
  'codearch/getRiskScore': {
    params: { filePath: string; symbolName?: string };
    result: RiskScoreResult;
  };
  'codearch/findDeadCode': {
    params: { workspacePath?: string; minConfidence?: number };
    result: DeadCodeItem[];
  };
  'codearch/findDuplicates': {
    params: { workspacePath?: string; minSimilarity?: number };
    result: DuplicateCodeItem[];
  };
  'codearch/inspectArchitecture': {
    params: { workspacePath?: string; focusModule?: string };
    result: ArchitectureModule[];
  };
  'codearch/getHistory': {
    params: { filePath: string; limit?: number };
    result: CommitInfo[];
  };
  'codearch/searchHistory': {
    params: { query: string; limit?: number };
    result: CommitInfo[];
  };
  'codearch/suppressDeadCode': {
    params: { itemId: string; reason: string };
    result: { success: boolean };
  };
  'codearch/getStatus': {
    params: Record<string, never>;
    result: {
      version: string;
      status: 'ready' | 'indexing' | 'error';
      activeWorkspace?: string;
      dbPath: string;
      aiStatus: {
        enabled: boolean;
        provider?: string;
        model?: string;
        statusText: string;
      };
    };
  };
}
