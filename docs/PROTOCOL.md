# Universal Archaeology Protocol (UAP)

The Universal Archaeology Protocol defines a standard JSON-RPC 2.0 communication format between editor adapters and the core engine.

---

## Transport Layers

1. **Stdio / Process**: Adapters spawn `codearch serve` or the core engine as a child process and exchange newline-delimited JSON-RPC messages.
2. **HTTP / JSON-RPC**: `codearch serve --port <port>` listens for standard HTTP POST requests.
3. **In-Memory**: Direct JavaScript/TypeScript adapter instantiation without IPC overhead.

---

## Method Specifications

### 1. `codearch/analyzeWorkspace`
Indexes source files, AST symbols, Git commit history, and dependency edges.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "codearch/analyzeWorkspace",
  "params": {
    "workspacePath": "/path/to/project",
    "forceReindex": false
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "workspacePath": "/path/to/project",
    "totalFiles": 48,
    "analyzedFiles": 48,
    "totalSymbols": 210,
    "totalCommits": 142,
    "totalDependencies": 85,
    "deadCodeCount": 4,
    "duplicatesCount": 2,
    "averageRiskScore": 34,
    "aiStatus": {
      "enabled": false,
      "statusText": "● LOCAL ANALYSIS (100% Offline, Privacy Guaranteed)"
    }
  }
}
```

### 2. `codearch/getCodeStory`
Reconstructs the origin, evolutionary milestones, and purpose of a symbol.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "codearch/getCodeStory",
  "params": {
    "symbolName": "calculatePrice",
    "filePath": "src/pricing/PricingService.ts"
  }
}
```

### 3. `codearch/getBlastRadius`
Calculates direct and indirect dependents, affected test suites, and risk.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "codearch/getBlastRadius",
  "params": {
    "symbolName": "calculatePrice",
    "maxDepth": 4
  }
}
```

### 4. `codearch/whoBrokeThis`
Forensically traces the introducing commit, modifications, and regression risk.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "codearch/whoBrokeThis",
  "params": {
    "filePath": "src/payment/PaymentService.ts",
    "line": 6
  }
}
```

### 5. `codearch/getRiskScore`
Evaluates the 5-factor transparent risk formula (0-100).

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "codearch/getRiskScore",
  "params": {
    "filePath": "src/pricing/PricingService.ts",
    "symbolName": "calculatePrice"
  }
}
```

### 6. `codearch/findDeadCode`
Identifies unreferenced and unused functions, classes, and exports.

### 7. `codearch/findDuplicates`
Detects structural duplication (branch complexity, null checking, error handling).

### 8. `codearch/inspectArchitecture`
Returns domain module boundaries, outgoing dependencies, and inbound callers.
