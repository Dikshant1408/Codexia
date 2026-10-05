import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import * as fs from 'node:fs';
import type { CommitInfo } from '@codearch/protocol';

const execFileAsync = promisify(execFile);

export interface BlameInfo {
  commitHash: string;
  shortHash: string;
  author: string;
  email: string;
  date: string;
  line: number;
  content: string;
}

export interface ChurnMetrics {
  totalCommits: number;
  uniqueAuthors: number;
  lastModified: string;
  recentCommits30Days: number;
  authors: string[];
}

export class GitEngine {
  constructor(private workingDir: string) {}

  public async isGitRepo(): Promise<boolean> {
    try {
      await this.runGit(['rev-parse', '--is-inside-work-tree']);
      return true;
    } catch {
      return false;
    }
  }

  public async getRepoRoot(): Promise<string> {
    try {
      const { stdout } = await this.runGit(['rev-parse', '--show-toplevel']);
      return stdout.trim();
    } catch {
      return this.workingDir;
    }
  }

  public async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
      return stdout.trim();
    } catch {
      return 'unknown';
    }
  }

  public async getCommitHistory(options?: {
    maxCount?: number;
    filePath?: string;
    since?: string;
  }): Promise<CommitInfo[]> {
    const isRepo = await this.isGitRepo();
    if (!isRepo) return [];

    const args = [
      'log',
      `--max-count=${options?.maxCount || 100}`,
      '--format=COMMIT_START%n%H%n%h%n%an%n%ae%n%aI%n%s%nCOMMIT_END'
    ];

    if (options?.since) {
      args.push(`--since=${options.since}`);
    }

    if (options?.filePath) {
      args.push('--', options.filePath);
    }

    try {
      const { stdout } = await this.runGit(args);
      return this.parseCommitLog(stdout);
    } catch {
      return [];
    }
  }

  public async getFileEvolution(filePath: string, maxCount: number = 50): Promise<CommitInfo[]> {
    return this.getCommitHistory({ filePath, maxCount });
  }

  public async getLineBlame(filePath: string, line: number): Promise<BlameInfo | null> {
    const isRepo = await this.isGitRepo();
    if (!isRepo) return null;

    try {
      const { stdout } = await this.runGit([
        'blame',
        `-L`,
        `${line},${line}`,
        '--porcelain',
        '--',
        filePath
      ]);

      const lines = stdout.split('\n');
      if (lines.length === 0 || !lines[0]) return null;

      const firstLineParts = lines[0].split(' ');
      const commitHash = firstLineParts[0];

      let author = 'Unknown';
      let email = '';
      let timestamp = '';
      let content = '';

      for (const l of lines) {
        if (l.startsWith('author ')) author = l.slice(7).trim();
        else if (l.startsWith('author-mail ')) email = l.slice(12).replace(/[<>]/g, '').trim();
        else if (l.startsWith('author-time ')) {
          const sec = parseInt(l.slice(12).trim(), 10);
          timestamp = new Date(sec * 1000).toISOString();
        } else if (l.startsWith('\t')) {
          content = l.slice(1);
        }
      }

      return {
        commitHash,
        shortHash: commitHash.slice(0, 7),
        author,
        email,
        date: timestamp,
        line,
        content
      };
    } catch {
      return null;
    }
  }

  public async findIntroducingCommit(filePath: string, line: number): Promise<CommitInfo | null> {
    const blame = await this.getLineBlame(filePath, line);
    if (!blame) return null;

    return this.getCommitByHash(blame.commitHash);
  }

  public async getCommitByHash(commitHash: string): Promise<CommitInfo | null> {
    const isRepo = await this.isGitRepo();
    if (!isRepo) return null;

    try {
      const { stdout } = await this.runGit([
        'show',
        '--format=COMMIT_START%n%H%n%h%n%an%n%ae%n%aI%n%s%nCOMMIT_END',
        '--shortstat',
        commitHash
      ]);

      const commits = this.parseCommitLog(stdout);
      return commits[0] || null;
    } catch {
      return null;
    }
  }

  public async getChurnMetrics(filePath: string): Promise<ChurnMetrics> {
    const commits = await this.getFileEvolution(filePath, 200);
    const authorsSet = new Set<string>();
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    let recentCount = 0;

    for (const c of commits) {
      if (c.authorName) authorsSet.add(c.authorName);
      const commitTime = new Date(c.date).getTime();
      if (commitTime >= thirtyDaysAgo) {
        recentCount++;
      }
    }

    return {
      totalCommits: commits.length,
      uniqueAuthors: authorsSet.size,
      lastModified: commits[0]?.date || new Date().toISOString(),
      recentCommits30Days: recentCount,
      authors: Array.from(authorsSet)
    };
  }

  public async getDiff(commitA: string, commitB: string, filePath?: string): Promise<string> {
    const args = ['diff', commitA, commitB];
    if (filePath) {
      args.push('--', filePath);
    }
    try {
      const { stdout } = await this.runGit(args);
      return stdout;
    } catch {
      return '';
    }
  }

  private async runGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return execFileAsync('git', args, {
      cwd: this.workingDir,
      maxBuffer: 10 * 1024 * 1024
    });
  }

  private parseCommitLog(raw: string): CommitInfo[] {
    const results: CommitInfo[] = [];
    const chunks = raw.split('COMMIT_START\n');

    for (const chunk of chunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;

      const endIndex = trimmed.indexOf('\nCOMMIT_END');
      const header = endIndex !== -1 ? trimmed.slice(0, endIndex) : trimmed;
      const lines = header.split('\n');

      if (lines.length >= 6) {
        const hash = lines[0].trim();
        const shortHash = lines[1].trim();
        const authorName = lines[2].trim();
        const authorEmail = lines[3].trim();
        const date = lines[4].trim();
        const message = lines.slice(5).join(' ').trim();

        // Check for stats if present after COMMIT_END
        let filesChanged = 1;
        let insertions = 0;
        let deletions = 0;

        if (endIndex !== -1) {
          const rest = trimmed.slice(endIndex + 11);
          const statMatch = rest.match(/(\d+)\s+files? changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?/);
          if (statMatch) {
            filesChanged = parseInt(statMatch[1] || '1', 10);
            insertions = parseInt(statMatch[2] || '0', 10);
            deletions = parseInt(statMatch[3] || '0', 10);
          }
        }

        results.push({
          hash,
          shortHash,
          authorName,
          authorEmail,
          date,
          message,
          filesChanged,
          insertions,
          deletions
        });
      }
    }

    return results;
  }
}
