import * as path from 'node:path';
import * as fs from 'node:fs';
import type {
  RiskScoreResult,
  RiskFactor,
  CodeDna
} from '@codearch/protocol';
import type { CodeArchDatabase } from '@codearch/database';
import type { GitEngine } from '@codearch/git-engine';

export class RiskEngine {
  constructor(
    private db: CodeArchDatabase,
    private git: GitEngine,
    private workspaceRoot: string
  ) {}

  public async calculateRiskScore(filePath: string, symbolName?: string): Promise<RiskScoreResult> {
    const targetName = symbolName || path.basename(filePath);

    // 1. Coupling (max 25 pts)
    const dependents = this.db.getDependents(filePath);
    const dependencies = this.db.getDependencies(filePath);
    const totalCoupled = dependents.length + dependencies.length;
    let couplingPts = Math.min(25, Math.round(totalCoupled * 3.5));
    const couplingReason =
      totalCoupled >= 6
        ? `High coupling: ${dependents.length} inbound dependents and ${dependencies.length} outbound dependencies`
        : totalCoupled >= 2
        ? `Moderate coupling: ${dependents.length} dependents and ${dependencies.length} dependencies`
        : 'Isolated module with minimal coupling';

    // 2. Change Frequency / Churn (max 25 pts)
    const churn = await this.git.getChurnMetrics(filePath);
    let churnPts = 0;
    if (churn.totalCommits >= 15) churnPts = 25;
    else if (churn.totalCommits >= 8) churnPts = 18;
    else if (churn.totalCommits >= 3) churnPts = 10;
    else churnPts = 3;

    const churnReason =
      churn.totalCommits >= 8
        ? `High change frequency: touched ${churn.totalCommits} times across ${churn.uniqueAuthors} authors (${churn.recentCommits30Days} in last 30d)`
        : `Stable history: touched ${churn.totalCommits} times`;

    // 3. Complexity (max 20 pts)
    const symbols = this.db.getSymbolsForFile(filePath);
    let maxComplexity = 1;
    for (const s of symbols) {
      if (!symbolName || s.name === symbolName) {
        if (s.complexity > maxComplexity) maxComplexity = s.complexity;
      }
    }
    let complexityPts = 0;
    if (maxComplexity >= 15) complexityPts = 20;
    else if (maxComplexity >= 8) complexityPts = 14;
    else if (maxComplexity >= 4) complexityPts = 8;
    else complexityPts = 3;

    const complexityReason =
      maxComplexity >= 8
        ? `High cyclomatic complexity (${maxComplexity}) with nested branching`
        : `Moderate to low complexity (score ${maxComplexity})`;

    // 4. Test coverage proximity (max 15 pts)
    const testDependents = dependents.filter(
      (d) => d.toLowerCase().includes('test') || d.toLowerCase().includes('spec')
    );
    let testPts = 15; // default full penalty if no tests
    let testReason = 'No associated test files detected';
    if (testDependents.length >= 2) {
      testPts = 0;
      testReason = `Well covered: ${testDependents.length} associated test suites`;
    } else if (testDependents.length === 1) {
      testPts = 6;
      testReason = 'Single associated test suite detected';
    }

    // 5. Recent regressions / bug fixes (max 15 pts)
    const commits = await this.git.getFileEvolution(filePath, 20);
    const bugFixCommits = commits.filter((c) => {
      const msg = c.message.toLowerCase();
      return msg.includes('fix') || msg.includes('bug') || msg.includes('hotfix') || msg.includes('patch');
    });

    let regressionPts = 0;
    if (bugFixCommits.length >= 3) regressionPts = 15;
    else if (bugFixCommits.length >= 1) regressionPts = 9;
    else regressionPts = 2;

    const regressionReason =
      bugFixCommits.length > 0
        ? `${bugFixCommits.length} previous bug fixes recorded on this module`
        : 'No recorded bugfix/regression churn';

    const totalScore = Math.min(100, couplingPts + churnPts + complexityPts + testPts + regressionPts);

    const level: 'LOW' | 'MEDIUM' | 'HIGH' =
      totalScore >= 70 ? 'HIGH' : totalScore >= 40 ? 'MEDIUM' : 'LOW';

    const factors: RiskFactor[] = [
      { name: 'Coupling', score: couplingPts, maxScore: 25, reason: couplingReason },
      { name: 'Change frequency', score: churnPts, maxScore: 25, reason: churnReason },
      { name: 'Complexity', score: complexityPts, maxScore: 20, reason: complexityReason },
      { name: 'Few tests', score: testPts, maxScore: 15, reason: testReason },
      { name: 'Recent regressions', score: regressionPts, maxScore: 15, reason: regressionReason }
    ];

    return {
      target: targetName,
      filePath,
      score: totalScore,
      level,
      factors,
      formula: 'Score = Coupling (25) + Churn (25) + Complexity (20) + Test Deficit (15) + Bug History (15)'
    };
  }

  public async calculateCodeDna(filePath: string, symbolName?: string): Promise<CodeDna> {
    const targetName = symbolName || path.basename(filePath);

    let content = '';
    try {
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf-8');
      }
    } catch {
      // ignore
    }

    const countMatches = (regex: RegExp) => (content.match(regex) || []).length;

    // Detect technical profiles
    const businessCount = countMatches(/\b(calculate|process|compute|handle|dispatch|orchestrate|rule|apply)\b/gi);
    const databaseCount = countMatches(/\b(select|insert|update|delete|query|find|save|repo|db|table|prisma|sql)\b/gi);
    const apiCount = countMatches(/\b(req|res|endpoint|route|fetch|http|status|url|header|json|post|get)\b/gi);
    const validationCount = countMatches(/\b(validate|check|assert|schema|verify|isvalid|throw|zod|yup)\b/gi);
    const loggingCount = countMatches(/\b(log|info|warn|error|debug|trace|telemetry|metrics)\b/gi);

    const totalProfile = businessCount + databaseCount + apiCount + validationCount + loggingCount || 1;

    const normalize = (val: number) => Math.min(10, Math.max(1, Math.round((val / totalProfile) * 10)));

    const symbols = this.db.getSymbolsForFile(filePath);
    let maxComplexity = 1;
    for (const s of symbols) {
      if (!symbolName || s.name === symbolName) {
        if (s.complexity > maxComplexity) maxComplexity = s.complexity;
      }
    }

    const dependents = this.db.getDependents(filePath);
    const churn = await this.git.getChurnMetrics(filePath);

    const coupling: 'Low' | 'Medium' | 'High' =
      dependents.length >= 5 ? 'High' : dependents.length >= 2 ? 'Medium' : 'Low';

    const changeFreq: 'Low' | 'Medium' | 'High' =
      churn.totalCommits >= 8 ? 'High' : churn.totalCommits >= 3 ? 'Medium' : 'Low';

    const testDependents = dependents.filter((d) => d.includes('test') || d.includes('spec'));
    const testCoverage = testDependents.length >= 2 ? 88 : testDependents.length === 1 ? 65 : 20;

    return {
      symbolName: targetName,
      filePath,
      businessLogic: normalize(businessCount),
      database: normalize(databaseCount),
      api: normalize(apiCount),
      validation: normalize(validationCount),
      logging: normalize(loggingCount),
      complexity: parseFloat((maxComplexity * 0.8 + 1.2).toFixed(1)),
      coupling,
      cohesion: symbols.length > 5 ? 'Medium' : 'High',
      testCoverage,
      changeFrequency: changeFreq
    };
  }
}
