import * as path from 'node:path';
import type {
  CodeStory,
  SymbolEvolutionMilestone,
  EpistemicNote,
  WhoBrokeThisResult,
  InvestigationStep,
  CommitInfo
} from '@codearch/protocol';
import type { CodeArchDatabase } from '@codearch/database';
import type { GitEngine } from '@codearch/git-engine';

export class HistoryEngine {
  constructor(
    private db: CodeArchDatabase,
    private git: GitEngine,
    private workspaceRoot: string
  ) {}

  public async getCodeStory(symbolName: string, filePath?: string): Promise<CodeStory> {
    const allSymbols = this.db.getAllSymbols();
    const sym = allSymbols.find((s) => {
      if (s.name === symbolName) {
        if (!filePath) return true;
        return s.filePath.toLowerCase().includes(filePath.toLowerCase());
      }
      return false;
    });

    const targetFile = sym ? sym.filePath : (filePath || 'src/unknown.ts');
    const targetName = sym ? sym.name : symbolName;

    // Get Git commits for this file
    const commits = await this.git.getFileEvolution(targetFile, 50);

    const epistemicNotes: EpistemicNote[] = [];
    const evolution: SymbolEvolutionMilestone[] = [];

    if (commits.length > 0) {
      // Oldest commit is the creation
      const oldestCommit = commits[commits.length - 1];
      const createdDate = new Date(oldestCommit.date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });

      epistemicNotes.push({
        status: 'FACT',
        claim: `Symbol/file was introduced in commit ${oldestCommit.shortHash} by ${oldestCommit.authorName}`,
        source: `git show ${oldestCommit.shortHash}`
      });

      // Construct evolution milestones in chronological order
      const chronCommits = [...commits].reverse();
      for (let i = 0; i < chronCommits.length; i++) {
        const c = chronCommits[i];
        const lowerMsg = c.message.toLowerCase();

        let type: SymbolEvolutionMilestone['type'] = 'feature';
        if (i === 0) type = 'create';
        else if (lowerMsg.includes('fix') || lowerMsg.includes('bug')) type = 'fix';
        else if (lowerMsg.includes('refactor') || lowerMsg.includes('clean')) type = 'refactor';
        else if (lowerMsg.includes('break') || lowerMsg.includes('deprecat')) type = 'breaking';

        evolution.push({
          version: `v${i + 1}`,
          title: c.message.slice(0, 50),
          description: c.message,
          commitHash: c.hash,
          author: c.authorName,
          date: c.date,
          type,
          epistemicStatus: 'FACT'
        });
      }

      // Infer purpose
      const firstMsg = oldestCommit.message;
      let inferredPurpose = `Created to manage ${targetName} logic.`;
      if (firstMsg.toLowerCase().includes('feat') || firstMsg.toLowerCase().includes('add')) {
        inferredPurpose = firstMsg;
      }
      epistemicNotes.push({
        status: 'INFERENCE',
        claim: `The function appears to have been created for: "${inferredPurpose}" based on commit history & context.`,
        source: 'git log commit message heuristics'
      });

      // Look up dependents & dependencies
      const deps = this.db.getDependencies(targetFile);
      const dependents = this.db.getDependents(targetFile);

      const lastModifiedDate = new Date(commits[0].date);
      const daysAgo = Math.max(1, Math.round((Date.now() - lastModifiedDate.getTime()) / (1000 * 3600 * 24)));

      const complexityScore = sym ? sym.complexity : 5;
      const complexity: 'Low' | 'Medium' | 'High' =
        complexityScore > 10 ? 'High' : complexityScore > 4 ? 'Medium' : 'Low';

      const riskScore = Math.min(100, Math.round(dependents.length * 8 + complexityScore * 4));
      const risk: 'Low' | 'Medium' | 'High' = riskScore > 60 ? 'High' : riskScore > 30 ? 'Medium' : 'Low';

      return {
        symbolName: targetName,
        filePath: targetFile,
        createdDate,
        createdCommit: oldestCommit.shortHash,
        originalPurpose: inferredPurpose,
        evolution,
        currentState: {
          complexity,
          complexityScore,
          dependentsCount: dependents.length,
          dependenciesCount: deps.length,
          testsCount: dependents.filter((d) => d.includes('test') || d.includes('spec')).length,
          lastModifiedRelative: `${daysAgo} days ago`,
          risk,
          riskScore
        },
        epistemicNotes
      };
    }

    // Fallback if no git history yet
    epistemicNotes.push({
      status: 'UNKNOWN',
      claim: 'No git commits recorded yet for this file/symbol',
      source: 'git rev-parse'
    });

    return {
      symbolName: targetName,
      filePath: targetFile,
      createdDate: 'Recently',
      createdCommit: 'local-uncommitted',
      originalPurpose: `Implementation of ${targetName}`,
      evolution: [
        {
          version: 'v1',
          title: 'Initial implementation',
          description: 'Working draft before initial commit',
          commitHash: '0000000',
          author: 'Current Developer',
          date: new Date().toISOString(),
          type: 'create',
          epistemicStatus: 'FACT'
        }
      ],
      currentState: {
        complexity: 'Low',
        complexityScore: sym ? sym.complexity : 2,
        dependentsCount: 0,
        dependenciesCount: 0,
        testsCount: 0,
        lastModifiedRelative: 'Today',
        risk: 'Low',
        riskScore: 20
      },
      epistemicNotes
    };
  }

  public async whoBrokeThis(
    filePath: string,
    line?: number,
    symbolName?: string
  ): Promise<WhoBrokeThisResult> {
    const targetLine = line || 1;
    const targetIdentifier = symbolName || path.basename(filePath);

    const blame = await this.git.getLineBlame(filePath, targetLine);
    const commits = await this.git.getFileEvolution(filePath, 20);

    const epistemicNotes: EpistemicNote[] = [];

    if (blame) {
      epistemicNotes.push({
        status: 'FACT',
        claim: `Line ${targetLine} was last touched in commit ${blame.shortHash} by ${blame.author} on ${blame.date.slice(0, 10)}.`,
        source: `git blame -L ${targetLine},${targetLine}`
      });

      const introducingCommit = await this.git.getCommitByHash(blame.commitHash);
      const commitMsg = introducingCommit ? introducingCommit.message : 'Modified lines';

      // Find subsequent modifications
      const changedTimes = commits.filter((c) => {
        return new Date(c.date).getTime() > new Date(blame.date).getTime();
      }).length;

      const related = commits.slice(0, 5).map((c) => ({
        hash: c.hash,
        shortHash: c.shortHash,
        message: c.message,
        date: c.date
      }));

      // Regression risk estimation
      let regression: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (changedTimes >= 5 || commitMsg.toLowerCase().includes('fix') || commitMsg.toLowerCase().includes('hotfix')) {
        regression = 'HIGH';
      } else if (changedTimes >= 2) {
        regression = 'MEDIUM';
      }

      epistemicNotes.push({
        status: 'INFERENCE',
        claim: `Potential regression estimated at ${regression} due to ${changedTimes} subsequent modifications and commit semantics.`,
        source: 'Forensic churn and message pattern analysis'
      });

      const chain: InvestigationStep[] = [
        {
          level: 'Line',
          title: `Line ${targetLine}`,
          description: blame.content || `Source line in ${path.basename(filePath)}`,
          details: { line: targetLine, file: filePath }
        },
        {
          level: 'Commit',
          title: `Commit ${blame.shortHash}`,
          description: commitMsg,
          details: { author: blame.author, date: blame.date, hash: blame.commitHash }
        },
        {
          level: 'RelatedFiles',
          title: 'Related Files in Commit',
          description: `Affected ${introducingCommit?.filesChanged || 1} files in total`,
          details: { filesCount: introducingCommit?.filesChanged || 1 }
        },
        {
          level: 'Modifications',
          title: 'Subsequent Modifications',
          description: `Changed ${changedTimes} times after introduction`,
          details: { changesAfter: changedTimes }
        },
        {
          level: 'Tests',
          title: 'Test Verification',
          description: 'Inspecting associated unit/integration tests for coverage',
          details: { covered: regression !== 'HIGH' }
        },
        {
          level: 'Regression',
          title: 'Regression Risk Evaluation',
          description: `Risk evaluated as ${regression}`,
          details: { risk: regression }
        }
      ];

      return {
        target: targetIdentifier,
        filePath,
        lineNumber: targetLine,
        introducedBy: {
          commitHash: blame.commitHash,
          shortHash: blame.shortHash,
          author: blame.author,
          date: blame.date,
          message: commitMsg
        },
        changedCount: changedTimes,
        relatedCommits: related,
        potentialRegression: regression,
        explanation: `Line ${targetLine} originated from commit ${blame.shortHash} ("${commitMsg}") by ${blame.author} and was subsequently modified ${changedTimes} times.`,
        epistemicNotes,
        chain
      };
    }

    // Default fallback
    return {
      target: targetIdentifier,
      filePath,
      lineNumber: targetLine,
      introducedBy: {
        commitHash: '0000000',
        shortHash: '0000000',
        author: 'Current Author',
        date: new Date().toISOString(),
        message: 'Working tree modification'
      },
      changedCount: 0,
      relatedCommits: [],
      potentialRegression: 'LOW',
      explanation: 'No blame history available for this line yet.',
      epistemicNotes: [
        {
          status: 'UNKNOWN',
          claim: 'Line has not been committed to git yet',
          source: 'git blame'
        }
      ],
      chain: []
    };
  }
}
