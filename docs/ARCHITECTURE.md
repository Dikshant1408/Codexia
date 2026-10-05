# Code Archaeologist Architecture

Code Archaeologist is a **cross-IDE code intelligence and software archaeology platform** engineered to reconstruct code history, evolution, blast radius, and risk.

---

## 1. System Overview

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
                 │ AI Engine (Opt)   │
                 │ Local SQLite DB   │
                 └─────────┬─────────┘
                           │
                 Universal Protocol (JSON-RPC)
                           │
        ┌──────────────────┼──────────────────┐
        ↓                  ↓                  ↓
   VS Code Adapter   Antigravity Adapter   CLI Adapter
        ↓                  ↓                  ↓
   VS Code UI         Agentic Skill          Terminal
```

---

## 2. Core Principles

1. **Deterministic First**: Analysis is built on concrete Git commits, blame hashes, AST traversals, and dependency graphs. AI is strictly optional and never fabricates historical facts.
2. **Epistemic Classification**:
   - **`FACT`**: Verifiable through Git commit logs, diffs, line blames, or AST signatures.
   - **`INFERENCE`**: Derived from structural heuristics, caller patterns, or commit message semantics.
   - **`AI_SUMMARY`**: Synthesized by local (Ollama) or remote LLMs when explicitly enabled.
   - **`UNKNOWN`**: Explicitly flagged when data cannot be proven.
3. **Privacy First**: 100% offline analysis by default. Zero code or telemetry transmitted.
4. **IDE Decoupled**: The core engine runs equally in CLI, embedded servers, VS Code, Antigravity, and future editors.

---

## 3. Package Responsibilities

- **`packages/protocol`**: Universal protocol interfaces, JSON-RPC 2.0 schemas, and bidirectional transport abstractions.
- **`packages/database`**: SQLite persistence using native Node `node:sqlite`. Stores project metadata, symbols, references, file dependencies, commit files, and dead-code suppressions.
- **`packages/git-engine`**: Safe, parameter-array Git execution. Handles log parsing, line blames, file evolution, and author churn.
- **`packages/ast-engine`**: AST parsing using TypeScript compiler API for TypeScript/JavaScript, plus structural extractors for Python, Go, Rust, and Java.
- **`packages/dependency-engine`**: File imports and symbol references resolver, hierarchical blast radius engine, dead code detector, and structural duplicate detector.
- **`packages/history-engine`**: Evolution milestones (v1, v2, v3...), "Who Broke This?" forensic chain, and code story reconstructor.
- **`packages/risk-engine`**: Transparent 5-factor risk score (Coupling, Churn, Complexity, Test Deficit, Regression History) and Code DNA profiler.
- **`packages/ai-engine`**: Optional Ollama / OpenAI-compatible connector with local fallback.
- **`packages/core`**: Central coordinator orchestrating database, indexing, file watchers, and protocol server bindings.
