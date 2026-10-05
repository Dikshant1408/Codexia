import type {
  CodeStory,
  BlastRadiusResult,
  BlastRadiusNode,
  WhoBrokeThisResult,
  DeadCodeItem,
  DuplicateCodeItem,
  RiskScoreResult,
  ArchitectureModule,
  WorkspaceSummary
} from '@codearch/protocol';

export const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

export class CliRenderer {
  public static printBanner(): void {
    console.log(`
${c.cyan}${c.bold}  CODE ARCHAEOLOGIST${c.reset} ${c.gray}v0.1.0${c.reset}
  ${c.dim}Understand why code exists, how it evolved, and what breaks if changed.${c.reset}
    `);
  }

  public static renderWorkspaceSummary(summary: WorkspaceSummary): void {
    console.log(`
${c.bold}WORKSPACE ANALYSIS SUMMARY${c.reset}
${c.gray}──────────────────────────────────────────────────${c.reset}
  Path:              ${c.cyan}${summary.workspacePath}${c.reset}
  Files Analyzed:    ${c.bold}${summary.analyzedFiles}${c.reset}
  Symbols Indexed:   ${c.bold}${summary.totalSymbols}${c.reset}
  Commits Traversed: ${c.bold}${summary.totalCommits}${c.reset}
  Dead Code Alerts:  ${summary.deadCodeCount > 0 ? c.yellow : c.green}${summary.deadCodeCount}${c.reset}
  Duplicate Logic:   ${summary.duplicatesCount > 0 ? c.yellow : c.green}${summary.duplicatesCount}${c.reset}
  Privacy Mode:      ${summary.aiStatus.enabled ? c.yellow : c.green}${summary.aiStatus.statusText}${c.reset}
${c.gray}──────────────────────────────────────────────────${c.reset}
`);
  }

  public static renderCodeStory(story: CodeStory): void {
    console.log(`
${c.bold}${c.cyan}CODE STORY:${c.reset} ${c.bold}${story.symbolName}()${c.reset}
${c.gray}File: ${story.filePath}${c.reset}

${c.bold}Created${c.reset}
  ${story.createdDate} (commit ${c.yellow}${story.createdCommit}${c.reset})

${c.bold}Original purpose${c.reset}
  ${story.originalPurpose}

${c.bold}Evolution${c.reset}`);

    for (const m of story.evolution) {
      const typeColor = m.type === 'fix' ? c.red : m.type === 'create' ? c.green : c.cyan;
      console.log(`
  ${c.bold}● ${m.version}${c.reset} ${c.gray}(${m.author}, ${m.date.slice(0, 10)})${c.reset}
    ${typeColor}${m.title}${c.reset}`);
    }

    console.log(`
${c.bold}Current state${c.reset}
  Complexity:    ${story.currentState.complexity === 'High' ? c.red : story.currentState.complexity === 'Medium' ? c.yellow : c.green}${story.currentState.complexity}${c.reset} (${story.currentState.complexityScore})
  Dependents:    ${story.currentState.dependentsCount}
  Dependencies:  ${story.currentState.dependenciesCount}
  Tests:         ${story.currentState.testsCount > 0 ? c.green : c.red}${story.currentState.testsCount}${c.reset}
  Last modified: ${story.currentState.lastModifiedRelative}
  Risk:          ${story.currentState.risk === 'High' ? c.red : story.currentState.risk === 'Medium' ? c.yellow : c.green}${story.currentState.risk}${c.reset} (${story.currentState.riskScore}/100)
`);

    console.log(`${c.bold}Epistemic Distinctions${c.reset}`);
    for (const note of story.epistemicNotes) {
      const badge =
        note.status === 'FACT'
          ? `${c.green}[FACT]${c.reset}`
          : note.status === 'INFERENCE'
          ? `${c.yellow}[INFERENCE]${c.reset}`
          : note.status === 'AI_SUMMARY'
          ? `${c.magenta}[AI SUMMARY]${c.reset}`
          : `${c.gray}[UNKNOWN]${c.reset}`;
      console.log(`  ${badge} ${note.claim} ${c.gray}(Source: ${note.source})${c.reset}`);
    }
    console.log('');
  }

  public static renderBlastRadius(result: BlastRadiusResult): void {
    const riskBadge =
      result.overallRisk === 'HIGH'
        ? `${c.red}${c.bold}HIGH${c.reset}`
        : result.overallRisk === 'MEDIUM'
        ? `${c.yellow}${c.bold}MEDIUM${c.reset}`
        : `${c.green}${c.bold}LOW${c.reset}`;

    console.log(`
${c.bold}${c.magenta}BLAST RADIUS ANALYSIS${c.reset}
${c.gray}Target:${c.reset} ${c.bold}${result.symbolName}${c.reset}

  Direct dependents:    ${c.bold}${result.directDependents}${c.reset}
  Indirect dependents:  ${c.bold}${result.indirectDependents}${c.reset}
  Affected files:       ${c.bold}${result.affectedFiles}${c.reset}
  Affected tests:       ${result.affectedTests > 0 ? c.green : c.red}${result.affectedTests}${c.reset}
  API endpoints:        ${result.apiEndpoints > 0 ? c.yellow : c.gray}${result.apiEndpoints}${c.reset}

  Risk: ${riskBadge} (${result.riskScore}/100)

${c.bold}Dependent Hierarchy Tree:${c.reset}`);

    const printNode = (node: BlastRadiusNode, prefix = '', isLast = true) => {
      const branch = isLast ? '└── ' : '├── ';
      const tag = node.kind === 'test' ? `${c.green}[test]${c.reset} ` : node.kind === 'endpoint' ? `${c.yellow}[api]${c.reset} ` : '';
      console.log(`${prefix}${branch}${tag}${c.bold}${node.name}${c.reset} ${c.gray}(${node.filePath})${c.reset}`);
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');
      for (let i = 0; i < node.children.length; i++) {
        printNode(node.children[i], nextPrefix, i === node.children.length - 1);
      }
    };

    printNode(result.tree);
    console.log('');
  }

  public static renderWhoBrokeThis(result: WhoBrokeThisResult): void {
    const regressionBadge =
      result.potentialRegression === 'HIGH'
        ? `${c.red}${c.bold}HIGH${c.reset}`
        : result.potentialRegression === 'MEDIUM'
        ? `${c.yellow}${c.bold}MEDIUM${c.reset}`
        : `${c.green}${c.bold}LOW${c.reset}`;

    console.log(`
${c.bold}${c.yellow}WHO BROKE THIS? (Forensic Investigation)${c.reset}
${c.gray}Target: ${result.target} (${result.filePath}${result.lineNumber ? `:${result.lineNumber}` : ''})${c.reset}

${c.bold}Introduced by:${c.reset}
  Commit:  ${c.yellow}${result.introducedBy.shortHash}${c.reset}
  Author:  ${result.introducedBy.author}
  Date:    ${result.introducedBy.date.slice(0, 10)}
  Message: "${result.introducedBy.message}"

${c.bold}Modifications:${c.reset}
  Changed: ${c.bold}${result.changedCount}${c.reset} times afterward

${c.bold}Related commits:${c.reset}`);
    for (const rc of result.relatedCommits) {
      console.log(`  ● ${c.yellow}${rc.shortHash}${c.reset} ${rc.message} ${c.gray}(${rc.date.slice(0, 10)})${c.reset}`);
    }

    console.log(`
Potential regression: ${regressionBadge}

${c.bold}Forensic Investigation Chain:${c.reset}`);
    for (const step of result.chain) {
      console.log(`  [${step.level}] -> ${step.title}: ${c.gray}${step.description}${c.reset}`);
    }
    console.log('');
  }

  public static renderDeadCode(items: DeadCodeItem[]): void {
    console.log(`
${c.bold}${c.red}DEAD CODE DETECTOR${c.reset}
${c.gray}Found ${items.length} suspect symbols with high confidence${c.reset}
`);
    if (items.length === 0) {
      console.log(`  ${c.green}✓ No dead code identified in workspace.${c.reset}\n`);
      return;
    }

    for (const item of items) {
      console.log(`  ${c.bold}${item.symbolName}()${c.reset} ${c.gray}(${item.filePath}:${item.line})${c.reset}`);
      console.log(`  Confidence: ${c.yellow}${item.confidence}%${c.reset}`);
      console.log(`  Reasons:`);
      for (const r of item.reasons) {
        console.log(`    ${c.green}✓${c.reset} ${r}`);
      }
      console.log(`  Last modified: ${item.lastModified}\n`);
    }
  }

  public static renderDuplicates(items: DuplicateCodeItem[]): void {
    console.log(`
${c.bold}${c.yellow}STRUCTURAL DUPLICATE DETECTOR${c.reset}
${c.gray}Found ${items.length} duplicate structural logic patterns${c.reset}
`);
    if (items.length === 0) {
      console.log(`  ${c.green}✓ No significant structural duplication found.${c.reset}\n`);
      return;
    }

    for (const item of items) {
      console.log(`  ${c.bold}${item.symbolA.name}${c.reset} <─> ${c.bold}${item.symbolB.name}${c.reset}`);
      console.log(`  Similarity: ${c.yellow}${item.similarity}%${c.reset}`);
      console.log(`  Shared structure:`);
      for (const s of item.sharedStructure) {
        console.log(`    ${c.green}✓${c.reset} ${s}`);
      }
      console.log(`  Possible extraction: ${c.cyan}${item.possibleExtraction}${c.reset}\n`);
    }
  }

  public static renderRiskScore(result: RiskScoreResult): void {
    const levelBadge =
      result.level === 'HIGH'
        ? `${c.red}${c.bold}HIGH${c.reset}`
        : result.level === 'MEDIUM'
        ? `${c.yellow}${c.bold}MEDIUM${c.reset}`
        : `${c.green}${c.bold}LOW${c.reset}`;

    console.log(`
${c.bold}RISK SCORE:${c.reset} ${c.bold}${result.score}/100${c.reset} [${levelBadge}]
${c.gray}Target: ${result.target} (${result.filePath})${c.reset}

${c.bold}Factors:${c.reset}`);
    for (const f of result.factors) {
      console.log(`  ${f.name.padEnd(20)} ${c.bold}+${f.score}${c.reset} ${c.gray}(max ${f.maxScore}) — ${f.reason}${c.reset}`);
    }

    console.log(`
${c.gray}Formula: ${result.formula}${c.reset}
`);
  }

  public static renderArchitecture(modules: ArchitectureModule[]): void {
    console.log(`
${c.bold}${c.cyan}ARCHITECTURE INSPECT MODE${c.reset}
${c.gray}Identified ${modules.length} domain modules${c.reset}
`);
    for (const mod of modules) {
      console.log(`  ${c.bold}[${mod.name}]${c.reset} ${c.gray}(${mod.filesCount} files, ${mod.symbolsCount} symbols)${c.reset}`);
      if (mod.dependencies.length > 0) {
        console.log(`    └── Depends on: ${mod.dependencies.join(', ')}`);
      }
      if (mod.callers.length > 0) {
        console.log(`    └── Inbound callers: ${mod.callers.join(', ')}`);
      }
    }
    console.log('');
  }
}
