# Codexia 🔎

> **Universal Code Archaeology & Software Intelligence Platform**
> 
> *Understand why code exists, how it evolved, what depends on it, and what could break if it changes.*

A cross-IDE code intelligence and software archaeology platform combining Git history, AST static analysis, dependency graphs, and transparent risk scoring into a unified developer experience.

---

## ⚡ What is Code Archaeologist?

Code Archaeologist is **NOT** a generic generative AI coding assistant that autocompletes syntax.

It is a **forensic software intelligence platform** built to answer four fundamental engineering questions:

| Question | What Code Archaeologist Answers |
|---|---|
| **WHAT?** | What does this code, function, or module actually do? |
| **WHY?** | Why was this code introduced? What problem was it created to solve? |
| **WHAT CHANGED?** | How did it evolve across commits, refactors, and bugfixes over time? |
| **WHAT BREAKS?** | What is the structural blast radius if this code is modified or removed? |

---

## 🏛️ Core Architecture

The core analysis engine has **zero dependency on VS Code or any single editor**. All editor integrations interface through a strongly typed Universal Protocol (JSON-RPC 2.0).

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
                 │ SQLite Persistence│
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

## 🛡️ Epistemic Integrity

Code Archaeologist never hallucinates explanations. All insights clearly declare their evidentiary source:

- **`[FACT]`**: Directly verified via Git commit logs, diffs, line blame, or AST declarations.
- **`[INFERENCE]`**: Derived from caller patterns, structural heuristics, or commit semantics.
- **`[AI SUMMARY]`**: Synthesized by an optional LLM (Ollama or OpenAI-compatible).
- **`[UNKNOWN]`**: Explicitly declared when historical evidence is missing or inconclusive.

---

## 🚀 Key Features

### 1. Code Story & Evolution Timeline
Select any function, class, method, or file to reconstruct its full chronological history:
- When was it created?
- What was its original purpose?
- How did it evolve? (v1, v2, v3, bugfixes, refactors)
- Current state (complexity, dependents, test suites, churn recency, risk score).

### 2. Blast Radius ("What breaks if I change this?")
Calculates direct dependents, indirect dependents, affected test files, and API endpoints, displayed as a clean architectural hierarchy tree.

### 3. "Who Broke This?" Forensic Investigation
Pinpoint which commit and author introduced a specific line, how many times it was modified afterward, related commits, and regression risk level.

### 4. Transparent 5-Factor Risk Score
Transparent, inspectable 0-100 risk score based on:
```text
Score = Coupling (25) + Churn (25) + Complexity (20) + Test Deficit (15) + Bug History (15)
```

### 5. Dead Code Detector
Detects unused functions, obsolete classes, and unimported exports with confidence ratings (e.g. 97%), actionable suppression, and clear reasoning.

### 6. Structural Duplicate Detector
Identifies structural code duplicates based on AST statement patterns (validation logic, null checks, error handling) and suggests unified abstractions (e.g. `ValidationService`).

### 7. Architecture Inspect Mode
Inspect domain module boundaries, cross-module dependencies, and inbound caller couplings.

---

## 💻 CLI Usage (`codearch`)

The CLI works completely standalone on any repository:

```bash
# Analyze and index the current workspace
codearch analyze

# Reconstruct the origin and evolution of a symbol
codearch symbol calculatePrice

# Calculate blast radius for a symbol or file
codearch impact src/pricing/PricingService.ts

# Inspect AST symbols and complexity of a file
codearch file src/auth/AuthService.ts

# Forensic investigation of a line
codearch who-broke-this src/payment/PaymentService.ts 6

# Calculate transparent 5-factor risk score
codearch risk src/pricing/PricingService.ts calculatePrice

# Detect dead code and obsolete exports
codearch dead-code

# Detect structural logic duplication
codearch duplicates

# Inspect architecture and module coupling
codearch architecture

# Run system diagnostic
codearch doctor

# Launch local interactive web dashboard
codearch dashboard --port 3456
```

---

## 🔒 Privacy & Running 100% Offline

Code Archaeologist is **offline and local-first by default**.
- **No API key is required.**
- **No source code is ever uploaded to external servers.**
- The status is always visibly declared:
  ```text
  ● LOCAL ANALYSIS (100% Offline, Privacy Guaranteed)
  ```

### Optional: Enabling Local Ollama
To enable local AI summaries using Ollama:
```json
{
  "codeArchaeologist.ai.enabled": true,
  "codeArchaeologist.ai.provider": "ollama",
  "codeArchaeologist.ai.model": "qwen2.5-coder:7b"
}
```

---

## 🔌 Cross-IDE Support & Extension Installation

### VS Code / Cursor / Windsurf / Antigravity / VSCodium:
Install the pre-built `.vsix` extension package:
```bash
code --install-extension codexia-0.1.0.vsix
```
Or in your editor:
1. Open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
2. Click the `...` (Views and More Actions) menu at top right
3. Select **Install from VSIX...**
4. Choose [`codexia-0.1.0.vsix`](codexia-0.1.0.vsix)

To rebuild and package the extension from source at any time:
```bash
npm run package:extension
```

- **Antigravity**: Built-in adapter and agentic skill definition in `adapters/antigravity`.
- **JetBrains / Zed / Neovim / Visual Studio**: See [adapters/README.md](adapters/README.md) for the universal protocol adapter specification.

---

## 🧪 Testing

```bash
# Initialize realistic demo Git fixture
npm run demo:init

# Run comprehensive test suite
npm test
```

---

## 📜 Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — Architectural design and package layout
- [PROTOCOL.md](docs/PROTOCOL.md) — Universal Archaeology Protocol specifications
- [ADAPTERS.md](adapters/README.md) — Guide to building adapters for new editors
- [PRIVACY.md](docs/PRIVACY.md) — Privacy-first local security guarantees
- [SECURITY.md](docs/SECURITY.md) — Safe argument parsing and execution policies

---

## 📄 License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).
