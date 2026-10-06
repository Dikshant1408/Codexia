# Codexia 🔎

**Universal Cross-IDE Code Archaeology & Forensic Intelligence Platform**

> Understand why code exists, how it evolved, what depends on it, and what could break if changed.

Codexia is an offline-first, forensic code intelligence extension. It combines AST static analysis, Git revision history, call graph dependency tracking, and multi-factor risk scoring to give engineers immediate context into complex codebases.

---

## ⚡ Key Features

- 📖 **Code Story**: Uncover the origin story and chronological evolution of any function or class directly from Git history.
- 💥 **Blast Radius**: Calculate exact structural dependents and affected test suites before modifying or refactoring a symbol.
- 🕵️ **Forensic Investigation (Who Broke This?)**: Trace when regressions were introduced, who touched lines, and how logic changed over time.
- 🎯 **Transparent Risk Scoring**: Inspect 5-factor deterministic risk breakdown (0–100) combining churn, author count, complexity, test coverage, and fan-out.
- 🧹 **Dead Code & Duplication Detection**: Spot unreferenced functions and structural copy-paste anti-patterns across your repository.
- 🔒 **100% Offline & Private**: Zero data sent to cloud servers. Works completely locally with SQLite persistence.

---

## 🚀 Commands

Access via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) or right-click any code selection:

| Command | Action |
|---|---|
| `Codexia: Analyze Workspace` | Run fast AST + Git forensic indexing on the workspace |
| `Codexia: Show Code Story` | Open visual timeline of how the selected function evolved |
| `Codexia: Show Blast Radius` | View dependency graph and risk of editing the active symbol |
| `Codexia: Investigate Changes` | Pinpoint the exact commit and context behind a line |
| `Codexia: Analyze Risk Score` | Detailed breakdown of volatility and structural risk |
| `Codexia: Find Dead Code` | Identify orphaned functions and unreachable exports |
| `Codexia: Find Duplicates` | Detect near-identical code blocks across modules |
| `Codexia: Inspect Architecture` | Map domain boundaries and package dependencies |

---

## ⚙️ Settings

Customize Codexia in **Preferences: Open Settings (UI)** under `Codexia`:

- `codexia.ai.enabled`: Enable optional local AI summaries (disabled by default for 100% offline privacy).
- `codexia.ai.provider`: Choose AI provider (`none`, `ollama`, or `openai`).
- `codexia.ai.model`: Model name (defaults to `qwen2.5-coder:7b`).
- `codexia.analysis.maxFiles`: Maximum source files to analyze per workspace (default `10000`).

---

## ☕ Support

If you find **Codexia** helpful for your workflow and daily productivity, consider supporting its ongoing development:

👉 [**Support on chai4.me/godrikt**](https://www.chai4.me/godrikt)

---

## 👥 Credits & Author

- **Company**: AxrydeStudio
- **Developer**: Godrikt
- **Role**: Workflow System & Original Concept

---

## 📄 License

Licensed under the Apache-2.0 License.
