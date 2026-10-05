# Contributing to Code Archaeologist

We welcome contributions to Code Archaeologist!

## Monorepo Architecture

The repository is organized as an npm workspace:
- `packages/protocol`: Shared JSON-RPC message contracts and interfaces
- `packages/database`: Native Node.js `node:sqlite` persistence layer
- `packages/git-engine`: Safe Git CLI wrapper for history, blame, and churn
- `packages/ast-engine`: Static analysis and AST parsers
- `packages/dependency-engine`: Dependency graph, blast radius, dead code, and duplication detection
- `packages/history-engine`: Code story, evolution timelines, and forensic blame chains
- `packages/risk-engine`: 5-factor risk scoring engine
- `packages/ai-engine`: Optional AI integration layer
- `packages/core`: Core ArchaeologyEngine orchestrator
- `apps/cli`: `codearch` executable command line tool
- `apps/vscode`: VS Code Extension
- `adapters/*`: Cross-IDE adapters

## Development Workflow

1. **Clone and Install**:
   ```bash
   git clone https://github.com/codearch/code-archaeologist.git
   cd code-archaeologist
   npm install
   ```

2. **Build**:
   ```bash
   npm run build
   ```

3. **Initialize Demo Fixture**:
   ```bash
   npm run demo:init
   ```

4. **Run Tests**:
   ```bash
   npm test
   ```

5. **Test CLI Locally**:
   ```bash
   node apps/cli/bin/codearch.js --help
   node apps/cli/bin/codearch.js doctor
   ```
