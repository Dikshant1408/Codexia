import { DatabaseSync } from 'node:sqlite';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { SCHEMA_SQL } from './schema.js';
import type {
  SymbolInfo,
  CommitInfo,
  DeadCodeItem,
  RiskScoreResult,
  FileMetadata
} from '@codearch/protocol';

export class CodeArchDatabase {
  private db: DatabaseSync;

  constructor(dbPath: string = ':memory:') {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(SCHEMA_SQL);
  }

  public registerProject(id: string, projectPath: string, name: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, path, name, created_at, last_analyzed)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        last_analyzed = excluded.last_analyzed,
        name = excluded.name
    `);
    const now = new Date().toISOString();
    stmt.run(id, projectPath, name, now, now);
  }

  public saveFile(file: {
    id: string;
    projectId: string;
    path: string;
    relativePath: string;
    language: string;
    loc: number;
    complexity: number;
    hash: string;
    lastModified: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO files (id, project_id, path, relative_path, language, loc, complexity, hash, last_modified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        relative_path = excluded.relative_path,
        language = excluded.language,
        loc = excluded.loc,
        complexity = excluded.complexity,
        hash = excluded.hash,
        last_modified = excluded.last_modified
    `);
    stmt.run(
      file.id,
      file.projectId,
      file.path,
      file.relativePath,
      file.language,
      file.loc,
      file.complexity,
      file.hash,
      file.lastModified
    );
  }

  public clearSymbolsForFile(fileId: string): void {
    this.db.prepare(`DELETE FROM symbols WHERE file_id = ?`).run(fileId);
  }

  public saveSymbol(fileId: string, projectId: string, sym: SymbolInfo): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO symbols (
        id, file_id, project_id, name, kind, start_line, end_line,
        start_col, end_col, signature, docstring, complexity, is_exported, parent_symbol_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      sym.id,
      fileId,
      projectId,
      sym.name,
      sym.kind,
      sym.range.start.line,
      sym.range.end.line,
      sym.range.start.column,
      sym.range.end.column,
      sym.signature || null,
      sym.docstring || null,
      sym.complexity,
      sym.isExported ? 1 : 0,
      sym.parentSymbolId || null
    );
  }

  public saveReference(ref: {
    id: string;
    symbolId: string;
    sourceFile: string;
    startLine: number;
    endLine: number;
    isCall: boolean;
    isImport: boolean;
    snippet?: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO symbol_references (
        id, symbol_id, source_file, start_line, end_line, is_call, is_import, snippet
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      ref.id,
      ref.symbolId,
      ref.sourceFile,
      ref.startLine,
      ref.endLine,
      ref.isCall ? 1 : 0,
      ref.isImport ? 1 : 0,
      ref.snippet || null
    );
  }

  public saveFileDependency(id: string, projectId: string, fromFile: string, toFile: string, importPath: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO file_dependencies (id, project_id, from_file, to_file, import_path)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, projectId, fromFile, toFile, importPath);
  }

  public getDependencies(fromFile: string): string[] {
    const rows = this.db.prepare(`SELECT to_file FROM file_dependencies WHERE from_file = ?`).all(fromFile) as any[];
    return rows.map((r) => r.to_file);
  }

  public getDependents(toFile: string): string[] {
    const rows = this.db.prepare(`SELECT from_file FROM file_dependencies WHERE to_file = ?`).all(toFile) as any[];
    return rows.map((r) => r.from_file);
  }

  public saveCommit(projectId: string, commit: CommitInfo): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO git_commits (
        hash, project_id, short_hash, author_name, author_email,
        commit_date, message, files_changed, insertions, deletions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      commit.hash,
      projectId,
      commit.shortHash,
      commit.authorName,
      commit.authorEmail,
      commit.date,
      commit.message,
      commit.filesChanged,
      commit.insertions,
      commit.deletions
    );
  }

  public saveCommitFile(id: string, commitHash: string, filePath: string, status: string, additions: number, deletions: number): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO git_commit_files (id, commit_hash, file_path, status, additions, deletions)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, commitHash, filePath, status, additions, deletions);
  }

  public getCommitsForFile(filePath: string, limit: number = 50): CommitInfo[] {
    const rows = this.db.prepare(`
      SELECT c.* FROM git_commits c
      INNER JOIN git_commit_files cf ON c.hash = cf.commit_hash
      WHERE cf.file_path LIKE ?
      ORDER BY c.commit_date DESC
      LIMIT ?
    `).all(`%${filePath}%`, limit) as any[];

    return rows.map((r) => ({
      hash: r.hash,
      shortHash: r.short_hash,
      authorName: r.author_name,
      authorEmail: r.author_email,
      date: r.commit_date,
      message: r.message,
      filesChanged: r.files_changed,
      insertions: r.insertions,
      deletions: r.deletions
    }));
  }

  public findSymbolsByName(name: string): SymbolInfo[] {
    const rows = this.db.prepare(`
      SELECT s.*, f.path as file_path FROM symbols s
      JOIN files f ON s.file_id = f.id
      WHERE s.name = ?
    `).all(name) as any[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      filePath: r.file_path,
      range: {
        start: { line: r.start_line, column: r.start_col },
        end: { line: r.end_line, column: r.end_col }
      },
      signature: r.signature,
      docstring: r.docstring,
      complexity: r.complexity,
      isExported: r.is_exported === 1,
      parentSymbolId: r.parent_symbol_id
    }));
  }

  public getSymbolsForFile(filePath: string): SymbolInfo[] {
    const rows = this.db.prepare(`
      SELECT s.*, f.path as file_path FROM symbols s
      JOIN files f ON s.file_id = f.id
      WHERE f.path = ?
      ORDER BY s.start_line ASC
    `).all(filePath) as any[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      filePath: r.file_path,
      range: {
        start: { line: r.start_line, column: r.start_col },
        end: { line: r.end_line, column: r.end_col }
      },
      signature: r.signature,
      docstring: r.docstring,
      complexity: r.complexity,
      isExported: r.is_exported === 1,
      parentSymbolId: r.parent_symbol_id
    }));
  }

  public getAllSymbols(): SymbolInfo[] {
    const rows = this.db.prepare(`
      SELECT s.*, f.path as file_path FROM symbols s
      JOIN files f ON s.file_id = f.id
    `).all() as any[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      filePath: r.file_path,
      range: {
        start: { line: r.start_line, column: r.start_col },
        end: { line: r.end_line, column: r.end_col }
      },
      signature: r.signature,
      docstring: r.docstring,
      complexity: r.complexity,
      isExported: r.is_exported === 1,
      parentSymbolId: r.parent_symbol_id
    }));
  }

  public getAllFiles(): FileMetadata[] {
    const rows = this.db.prepare(`SELECT * FROM files ORDER BY relative_path ASC`).all() as any[];
    return rows.map((r) => ({
      path: r.path,
      relativePath: r.relative_path,
      language: r.language,
      linesOfCode: r.loc,
      complexity: r.complexity,
      symbolsCount: 0,
      lastModifiedDate: r.last_modified,
      sha256: r.hash
    }));
  }

  public saveDeadCodeItem(item: DeadCodeItem, projectId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO dead_code_items (
        id, project_id, symbol_name, file_path, line, kind,
        confidence, reasons_json, last_modified, is_suppressed, suppression_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      item.id,
      projectId,
      item.symbolName,
      item.filePath,
      item.line,
      item.kind,
      item.confidence,
      JSON.stringify(item.reasons),
      item.lastModified,
      item.isSuppressed ? 1 : 0,
      null
    );
  }

  public getDeadCodeItems(projectId?: string): DeadCodeItem[] {
    let query = `SELECT * FROM dead_code_items WHERE is_suppressed = 0`;
    const params: any[] = [];
    if (projectId) {
      query += ` AND project_id = ?`;
      params.push(projectId);
    }
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      symbolName: r.symbol_name,
      filePath: r.file_path,
      line: r.line,
      kind: r.kind,
      confidence: r.confidence,
      reasons: JSON.parse(r.reasons_json || '[]'),
      lastModified: r.last_modified,
      isSuppressed: r.is_suppressed === 1
    }));
  }

  public suppressDeadCode(itemId: string, reason: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE dead_code_items
      SET is_suppressed = 1, suppression_reason = ?
      WHERE id = ?
    `);
    stmt.run(reason, itemId);
    return true;
  }

  public saveRiskScore(result: RiskScoreResult, projectId: string): void {
    const id = `${result.filePath}#${result.target}`;
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO risk_scores (
        id, project_id, target, file_path, score, level, factors_json, calculated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      projectId,
      result.target,
      result.filePath,
      result.score,
      result.level,
      JSON.stringify(result.factors),
      new Date().toISOString()
    );
  }

  public getRiskScore(target: string, filePath: string): RiskScoreResult | null {
    const id = `${filePath}#${target}`;
    const row = this.db.prepare(`SELECT * FROM risk_scores WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return {
      target: row.target,
      filePath: row.file_path,
      score: row.score,
      level: row.level,
      factors: JSON.parse(row.factors_json || '[]'),
      formula: 'Coupling (25%) + Churn (25%) + Complexity (20%) + Test Coverage (15%) + Regression Recency (15%)'
    };
  }

  public setCache(key: string, value: string): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO analysis_cache (cache_key, cache_val, updated_at)
      VALUES (?, ?, ?)
    `).run(key, value, new Date().toISOString());
  }

  public getCache(key: string): string | null {
    const row = this.db.prepare(`SELECT cache_val FROM analysis_cache WHERE cache_key = ?`).get(key) as any;
    return row ? row.cache_val : null;
  }

  public clearAll(): void {
    this.db.exec(`
      DELETE FROM symbol_references;
      DELETE FROM symbols;
      DELETE FROM file_dependencies;
      DELETE FROM files;
      DELETE FROM dead_code_items;
      DELETE FROM risk_scores;
    `);
  }

  public close(): void {
    this.db.close();
  }
}
