# Privacy Policy & Architecture

Code Archaeologist is designed from the ground up as a **privacy-first, local-only developer intelligence tool**.

---

## 1. Local by Default

- **Zero Cloud Transmission**: All Git history parsing, AST analysis, dependency graph calculation, and SQLite indexing run strictly on your local machine.
- **No Telemetry**: Code Archaeologist contains zero phone-home telemetry, analytics trackers, or usage monitors.
- **No Auto-Upload**: Source code and file contents are never transmitted across the network unless you explicitly configure an AI provider.

---

## 2. Visible Privacy State Indicator

The system prominently displays its current privacy state across all interfaces (CLI banner, web dashboard, VS Code status):

- `● LOCAL ANALYSIS (100% Offline, Privacy Guaranteed)`: AI is disabled; all analysis is deterministic and executed locally.
- `● AI ENABLED — Ollama (<model>)`: Using local Ollama running on `http://127.0.0.1:11434`. Data never leaves your machine.
- `● AI ENABLED — Remote (<model>)`: Using a user-configured OpenAI-compatible endpoint.

---

## 3. Data Storage

- Analysis indices and metrics are stored in a local SQLite database (`.codearch/archaeologist.db`) within your workspace.
- The database stores structural metadata (symbol names, line numbers, hashes, commit metadata). Raw file contents are never copied into the database.
- To purge the index, simply delete the `.codearch/` directory or run:
  ```bash
  codearch analyze --reindex
  ```
