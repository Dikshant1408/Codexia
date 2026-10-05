# Code Archaeologist — Cross-IDE Adapter Architecture

Code Archaeologist is built on a **Universal Protocol** model. The core intelligence engine has zero dependency on any IDE API.

```text
                    CODE ARCHAEOLOGIST
                           │
                 ┌─────────┴─────────┐
                 │   CORE ENGINE      │
                 │                   │
                 │ AST Analysis      │
                 │ Git Analysis      │
                 │ Dependency Graph  │
                 │ Symbol Index      │
                 │ Code Metrics      │
                 │ History Engine    │
                 │ Risk Engine       │
                 │ AI Engine         │
                 │ Cache             │
                 └─────────┬─────────┘
                           │
                 Universal Protocol (JSON-RPC)
                           │
        ┌──────────────────┼──────────────────┐
        ↓                  ↓                  ↓
   VS Code Adapter   Antigravity Adapter   CLI Adapter
        ↓                  ↓                  ↓
     IDE UI              IDE UI             Terminal
```

---

## 1. Supported First-Class Adapters

1. **`adapters/cli`**: Terminal adapter with ANSI color formatting, box styling, ASCII trees, and tables.
2. **`adapters/vscode`**: Standard VS Code extension API adapter (`apps/vscode`).
3. **`adapters/antigravity`**: Antigravity IDE adapter with custom skill instructions (`SKILL.md`) for agentic AI workflows.

---

## 2. Implementing New Adapters

To implement an adapter for an editor/IDE not yet supported, you only need to connect to the Universal Protocol via one of two transports:

### Option A: Embedded Node.js / TypeScript SDK

If the editor supports Node.js or embedded TypeScript (e.g. Zed extensions, VS Code forks, Atom/Electron-based editors):

```typescript
import { ArchaeologyEngine } from '@codearch/core';

const engine = new ArchaeologyEngine({
  workspaceRoot: '/path/to/project'
});

// 1. Analyze workspace
const summary = await engine.analyzeWorkspace();

// 2. Reconstruct Code Story
const story = await engine.getCodeStory('calculatePrice');

// 3. Blast radius
const blast = await engine.getBlastRadius('calculatePrice');

// 4. Who broke this
const blame = await engine.whoBrokeThis('src/payment/PaymentService.ts', 6);
```

### Option B: JSON-RPC over Stdio or HTTP (Universal for ALL Editors)

For editors written in Rust, C++, Java, Lua, or Elisp (JetBrains, Zed, Neovim, Visual Studio, Emacs), run `codearch serve`:

```bash
codearch serve --port 3457
```

Send standard JSON-RPC 2.0 requests:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "codearch/getBlastRadius",
  "params": {
    "symbolName": "calculatePrice"
  }
}
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "symbolName": "calculatePrice",
    "directDependents": 4,
    "indirectDependents": 1,
    "affectedFiles": 5,
    "affectedTests": 1,
    "overallRisk": "HIGH",
    "riskScore": 85,
    "tree": { ... }
  }
}
```

---

## 3. Editor Implementation Guides

### JetBrains (IntelliJ IDEA, WebStorm, PyCharm, RustRover)
- **Language**: Kotlin / Java
- **Integration**:
  - Spawn `codearch serve` or invoke `codearch` CLI directly using `com.intellij.execution.process.OSProcessHandler`.
  - Add gutter icons on functions showing risk level (`LOW`, `MEDIUM`, `HIGH`).
  - Add right-click action in Project and Editor popup menus: `Code Archaeology -> Show Code Story`.
  - Display blast radius tree in a dedicated `ToolWindowFactory`.

### Zed
- **Language**: Rust
- **Integration**:
  - Implement a Zed Extension utilizing Zed's Language Server Protocol (LSP) or slash commands.
  - Spawn `codearch` CLI as a background process and parse JSON output.
  - Render code stories in a dock panel or custom webview when supported.

### Neovim
- **Language**: Lua
- **Integration**:
  - Use `vim.fn.jobstart({'codearch', 'serve'})` or call `codearch` directly via `vim.system`.
  - Expose Lua commands:
    - `:CodeArchStory`
    - `:CodeArchImpact`
    - `:CodeArchWhoBrokeThis`
    - `:CodeArchDeadCode`
  - Display tree outputs using `vim.lsp.util` floating windows or `telescope.nvim` pickers.

### Visual Studio (C++ / C#)
- **Language**: C# (.NET)
- **Integration**:
  - Create a Visual Studio VSIX extension using MEF components.
  - Connect to `codearch` daemon via `System.Net.Http.HttpClient` or named pipes.
  - Implement a Visual Studio Tool Window with WPF or WebView2 hosting the dashboard.

### Emacs
- **Language**: Emacs Lisp (Elisp)
- **Integration**:
  - Implement `code-archaeologist.el` calling `codearch` via `call-process` or `make-process`.
  - Create a dedicated buffer `*Code Archaeology*` with collapsible outlines using `outline-mode`.

---

## 4. Universal Protocol Method Reference

| Method | Parameters | Return Value | Description |
|---|---|---|---|
| `codearch/analyzeWorkspace` | `{ workspacePath?: string, forceReindex?: boolean }` | `WorkspaceSummary` | Indexes AST symbols, Git commits, dependencies |
| `codearch/analyzeFile` | `{ filePath: string }` | `{ metadata, symbols }` | Returns file metrics and AST symbols |
| `codearch/getCodeStory` | `{ symbolName: string, filePath?: string }` | `CodeStory` | Evolution timeline and purpose |
| `codearch/getBlastRadius` | `{ symbolName: string, maxDepth?: number }` | `BlastRadiusResult` | Dependent hierarchy tree and risk score |
| `codearch/whoBrokeThis` | `{ filePath: string, line?: number }` | `WhoBrokeThisResult` | Introducing commit, changes count, regression |
| `codearch/getRiskScore` | `{ filePath: string, symbolName?: string }` | `RiskScoreResult` | Transparent 5-factor risk score |
| `codearch/findDeadCode` | `{ minConfidence?: number }` | `DeadCodeItem[]` | Unused functions and obsolete logic |
| `codearch/findDuplicates` | `{ minSimilarity?: number }` | `DuplicateCodeItem[]` | Structural duplicate patterns |
| `codearch/inspectArchitecture` | `{}` | `ArchitectureModule[]` | Module boundaries and cross-couplings |
| `codearch/getStatus` | `{}` | `StatusInfo` | DB status and privacy state |
