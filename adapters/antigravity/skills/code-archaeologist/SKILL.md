---
name: code-archaeologist
description: Cross-IDE code archaeology, evolution timeline, blast radius calculation, forensics and dead code detection.
---

# Code Archaeologist Skill

This skill enables Antigravity agents to inspect why code was written, how it evolved through Git history, what depends on it, and what breaks if it is modified.

## Available CLI Commands

When investigating code in the current repository, execute the `codearch` CLI directly:

1. **Reconstruct Code Story & Evolution**:
   ```bash
   node apps/cli/bin/codearch.js symbol <symbolName>
   ```

2. **Calculate Blast Radius ("What breaks if I change this?")**:
   ```bash
   node apps/cli/bin/codearch.js impact <symbolOrFile>
   ```

3. **Investigate Origin & Blame ("Who broke this?")**:
   ```bash
   node apps/cli/bin/codearch.js who-broke-this <filePath> <line>
   ```

4. **Transparent Risk Score**:
   ```bash
   node apps/cli/bin/codearch.js risk <filePath> [symbol]
   ```

5. **Dead Code & Obsolete Logic**:
   ```bash
   node apps/cli/bin/codearch.js dead-code
   ```

6. **Structural Duplication**:
   ```bash
   node apps/cli/bin/codearch.js duplicates
   ```

7. **Architecture Inspection**:
   ```bash
   node apps/cli/bin/codearch.js architecture
   ```

## Protocol Integration

For programmatic agentic communication, start the local JSON-RPC protocol server:
```bash
node apps/cli/bin/codearch.js serve --port 3457
```

Supported JSON-RPC methods:
- `codearch/analyzeWorkspace`
- `codearch/getCodeStory`
- `codearch/getBlastRadius`
- `codearch/whoBrokeThis`
- `codearch/getRiskScore`
- `codearch/findDeadCode`
- `codearch/findDuplicates`
- `codearch/inspectArchitecture`

## Epistemic Integrity
When answering questions based on Code Archaeologist analysis, ALWAYS maintain the epistemic distinction:
- **FACT**: Directly proven by git commits, diffs, AST, or deterministic graph traversal.
- **INFERENCE**: Probable intent derived from commit messages, callers, or semantic heuristics.
- **AI SUMMARY**: Synthesized by optional LLMs.
- **UNKNOWN**: When history is missing or unverifiable.
