import type { ArchaeologyEngine } from '@codearch/core';
import type {
  CodeStory,
  BlastRadiusResult,
  WhoBrokeThisResult,
  DeadCodeItem,
  DuplicateCodeItem,
  RiskScoreResult
} from '@codearch/protocol';

export class AntigravityAdapter {
  constructor(private engine: ArchaeologyEngine) {}

  public async explainSymbolForAgent(symbolName: string, filePath?: string): Promise<string> {
    const story = await this.engine.getCodeStory(symbolName, filePath);
    const radius = await this.engine.getBlastRadius(symbolName, filePath);
    const risk = await this.engine.getRiskScore(story.filePath, symbolName);

    let md = `### Code Archaeology: \`${symbolName}\`\n\n`;
    md += `**Location**: [${symbolName}](${this.toFileUri(story.filePath)})\n\n`;
    md += `#### 1. Why does this code exist?\n`;
    md += `${story.originalPurpose}\n\n`;

    md += `#### 2. How did it evolve?\n`;
    for (const m of story.evolution) {
      md += `- **${m.version}** (${m.date.slice(0, 10)}, \`${m.commitHash.slice(0, 7)}\`): ${m.title}\n`;
    }
    md += `\n`;

    md += `#### 3. What breaks if modified? (Blast Radius)\n`;
    md += `- **Overall Risk**: ${radius.overallRisk} (${radius.riskScore}/100)\n`;
    md += `- **Direct Dependents**: ${radius.directDependents}\n`;
    md += `- **Indirect Dependents**: ${radius.indirectDependents}\n`;
    md += `- **Affected Files**: ${radius.affectedFiles}\n`;
    md += `- **Associated Tests**: ${radius.affectedTests}\n\n`;

    md += `#### 4. Risk Factors\n`;
    for (const f of risk.factors) {
      md += `- **${f.name}** (+${f.score}/${f.maxScore}): ${f.reason}\n`;
    }
    md += `\n`;

    md += `#### 5. Epistemic Verification\n`;
    for (const n of story.epistemicNotes) {
      md += `- \`[${n.status}]\` ${n.claim} *(Source: ${n.source})*\n`;
    }

    return md;
  }

  public async investigateRegressionForAgent(filePath: string, line: number): Promise<string> {
    const who = await this.engine.whoBrokeThis(filePath, line);
    let md = `### Forensic Investigation: Line ${line} of [${filePath}](${this.toFileUri(filePath)}#L${line})\n\n`;
    md += `**Origin**: Commit \`${who.introducedBy.shortHash}\` by **${who.introducedBy.author}** on ${who.introducedBy.date.slice(0, 10)}\n`;
    md += `> "${who.introducedBy.message}"\n\n`;
    md += `**Subsequent Modifications**: Touched ${who.changedCount} times afterward.\n`;
    md += `**Regression Risk**: **${who.potentialRegression}**\n\n`;

    md += `#### Investigation Chain\n`;
    for (const step of who.chain) {
      md += `1. **[${step.level}] ${step.title}**: ${step.description}\n`;
    }

    return md;
  }

  private toFileUri(localPath: string): string {
    const normalized = localPath.replace(/\\/g, '/');
    return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
  }
}
