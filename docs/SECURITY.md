# Security Architecture & Guidelines

Code Archaeologist treats analyzed repositories as potentially untrusted input.

---

## Threat Mitigations

1. **Command Injection Prevention**:
   - Git operations are executed via `node:child_process.execFile` passing argument arrays directly to the OS kernel without shell execution.
   - Shell metacharacters (`|`, `;`, `&`, `$`, `` ` ``) are never evaluated by an intermediate shell.
2. **Safe Argument Handling**:
   - All Git file paths are passed following standard double-dash delimiters (`-- path/to/file`) to prevent option injection attacks (e.g. filenames beginning with `--`).
3. **No Automatic Code Execution**:
   - Code Archaeologist analyzes code through static AST parsing and Git history. It **never** requires executing, evaluating, or importing repository code.
4. **Path Traversal Protection**:
   - File paths are normalized and resolved against the workspace boundary root. Relative path escapes (`../..`) are sanitized.
5. **No Hard-Coded API Keys**:
   - AI endpoints read keys strictly from user configuration settings or environment variables (`CODEARCH_AI_KEY`).
