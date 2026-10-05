import * as path from 'node:path';
import * as fs from 'node:fs';
import type {
  SymbolInfo,
  BlastRadiusResult,
  BlastRadiusNode,
  DeadCodeItem,
  DuplicateCodeItem,
  ArchitectureModule
} from '@codearch/protocol';
import type { CodeArchDatabase } from '@codearch/database';

export interface FileDependencyEdge {
  fromFile: string;
  toFile: string;
  importPath: string;
}

export class DependencyEngine {
  constructor(private db: CodeArchDatabase, private workspaceRoot: string) {}

  public resolveImportPath(sourceFilePath: string, importSpecifier: string): string | null {
    // Only resolve relative or local workspace imports
    if (!importSpecifier.startsWith('.') && !importSpecifier.startsWith('/')) {
      return null;
    }

    const sourceDir = path.dirname(sourceFilePath);
    let candidateBase = path.resolve(sourceDir, importSpecifier);
    if (candidateBase.endsWith('.js')) {
      const tsCandidate = candidateBase.slice(0, -3) + '.ts';
      if (fs.existsSync(tsCandidate)) return tsCandidate;
    }
    if (candidateBase.endsWith('.jsx')) {
      const tsxCandidate = candidateBase.slice(0, -4) + '.tsx';
      if (fs.existsSync(tsxCandidate)) return tsxCandidate;
    }

    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.py', '.go', '.rs'];

    // Direct match with or without extension
    if (fs.existsSync(candidateBase) && fs.statSync(candidateBase).isFile()) {
      return candidateBase;
    }

    for (const ext of extensions) {
      const candidateWithExt = candidateBase + ext;
      if (fs.existsSync(candidateWithExt) && fs.statSync(candidateWithExt).isFile()) {
        return candidateWithExt;
      }
    }

    // Index file in folder
    for (const ext of extensions) {
      const candidateIndex = path.join(candidateBase, `index${ext}`);
      if (fs.existsSync(candidateIndex) && fs.statSync(candidateIndex).isFile()) {
        return candidateIndex;
      }
    }

    return null;
  }

  public getBlastRadius(symbolName: string, filePath?: string, maxDepth: number = 4): BlastRadiusResult {
    // Find symbol
    const allSymbols = this.db.getAllSymbols();
    const targetSymbol = allSymbols.find((s) => {
      if (s.name === symbolName) {
        if (!filePath) return true;
        return s.filePath.toLowerCase().includes(filePath.toLowerCase());
      }
      return false;
    });

    const targetFile = targetSymbol ? targetSymbol.filePath : (filePath || 'unknown');
    const displaySymbolName = targetSymbol ? targetSymbol.name : symbolName;

    // Build dependent graph
    const visitedFiles = new Set<string>();
    const affectedFiles = new Set<string>();
    const affectedTests = new Set<string>();
    const apiEndpoints = new Set<string>();
    let directCount = 0;
    let indirectCount = 0;

    const isTestFile = (p: string): boolean => {
      const lower = p.toLowerCase();
      return (
        lower.includes('.test.') ||
        lower.includes('.spec.') ||
        lower.includes('__tests__') ||
        lower.includes('test_')
      );
    };

    const isApiEndpoint = (p: string, symName: string): boolean => {
      const lower = p.toLowerCase();
      const sLower = symName.toLowerCase();
      return (
        lower.includes('api') ||
        lower.includes('route') ||
        lower.includes('controller') ||
        lower.includes('endpoint') ||
        sLower.includes('handler') ||
        sLower.includes('route') ||
        sLower.includes('get') ||
        sLower.includes('post')
      );
    };

    const buildTree = (currentFile: string, currentName: string, depth: number): BlastRadiusNode => {
      const isTest = isTestFile(currentFile);
      const isEndpoint = isApiEndpoint(currentFile, currentName);
      let kind: BlastRadiusNode['kind'] = 'file';
      if (isTest) kind = 'test';
      else if (isEndpoint) kind = 'endpoint';

      const node: BlastRadiusNode = {
        id: `${currentFile}#${currentName}`,
        name: currentName,
        filePath: path.relative(this.workspaceRoot, currentFile) || currentFile,
        kind,
        depth,
        risk: depth <= 1 ? 'HIGH' : depth === 2 ? 'MEDIUM' : 'LOW',
        children: []
      };

      if (depth >= maxDepth) return node;

      const dependents = this.db.getDependents(currentFile);
      for (const depFile of dependents) {
        affectedFiles.add(depFile);
        if (isTestFile(depFile)) affectedTests.add(depFile);

        const depSymbols = this.db.getSymbolsForFile(depFile);
        const childName = depSymbols.length > 0 ? depSymbols[0].name : path.basename(depFile);

        if (isApiEndpoint(depFile, childName)) apiEndpoints.add(`${depFile}#${childName}`);

        if (depth === 0) {
          directCount++;
        } else {
          indirectCount++;
        }

        if (!visitedFiles.has(depFile)) {
          visitedFiles.add(depFile);
          node.children.push(buildTree(depFile, childName, depth + 1));
        }
      }

      return node;
    };

    visitedFiles.add(targetFile);
    const tree = buildTree(targetFile, displaySymbolName, 0);

    const totalAffected = affectedFiles.size;
    let overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let riskScore = 15;

    if (totalAffected >= 5 || affectedTests.size >= 3 || apiEndpoints.size >= 1) {
      overallRisk = 'HIGH';
      riskScore = 85;
    } else if (totalAffected >= 2 || directCount >= 2) {
      overallRisk = 'MEDIUM';
      riskScore = 55;
    }

    return {
      symbolName: displaySymbolName,
      filePath: targetFile,
      directDependents: directCount,
      indirectDependents: indirectCount,
      affectedFiles: affectedFiles.size,
      affectedTests: affectedTests.size,
      apiEndpoints: apiEndpoints.size,
      overallRisk,
      riskScore,
      tree
    };
  }

  public findDeadCode(minConfidence: number = 60): DeadCodeItem[] {
    const allSymbols = this.db.getAllSymbols();
    const allFiles = this.db.getAllFiles();
    const deadItems: DeadCodeItem[] = [];

    // Identify entrypoint files
    const isEntrypoint = (filePath: string): boolean => {
      const base = path.basename(filePath).toLowerCase();
      return (
        base.startsWith('index.') ||
        base.startsWith('main.') ||
        base.startsWith('app.') ||
        base.startsWith('server.') ||
        base.startsWith('cli.') ||
        filePath.includes('/bin/') ||
        filePath.includes('\\bin\\')
      );
    };

    for (const sym of allSymbols) {
      if (sym.kind !== 'function' && sym.kind !== 'method' && sym.kind !== 'class') {
        continue;
      }

      // Ignore standard lifecycle or construct methods
      if (['constructor', 'toString', 'valueOf'].includes(sym.name)) {
        continue;
      }

      const dependents = this.db.getDependents(sym.filePath);
      const isFileEntrypoint = isEntrypoint(sym.filePath);

      let confidence = 0;
      const reasons: string[] = [];

      // Check dependents of the declaring file
      if (dependents.length === 0 && !isFileEntrypoint) {
        confidence += 40;
        reasons.push('Declaring file has no incoming imports');
      }

      // Check direct symbol calls/references in database
      const callers = this.findSymbolCallers(sym.name);
      if (callers.length === 0) {
        confidence += 35;
        reasons.push('No call references detected across codebase');
      }

      // Check if it's an unexported function
      if (!sym.isExported) {
        confidence += 15;
        reasons.push('Internal non-exported symbol with no internal call sites');
      }

      // Check for test coverage
      const hasTests = callers.some((c) => c.toLowerCase().includes('test'));
      if (!hasTests) {
        confidence += 10;
        reasons.push('No test references detected');
      }

      if (confidence >= minConfidence) {
        deadItems.push({
          id: sym.id,
          symbolName: sym.name,
          filePath: sym.filePath,
          line: sym.range.start.line,
          kind: sym.kind,
          confidence: Math.min(confidence, 98),
          reasons,
          lastModified: 'Over 6 months ago',
          isSuppressed: false
        });
      }
    }

    return deadItems;
  }

  public findStructuralDuplicates(minSimilarity: number = 70): DuplicateCodeItem[] {
    const allSymbols = this.db.getAllSymbols().filter(
      (s) => s.kind === 'function' || s.kind === 'method'
    );
    const duplicates: DuplicateCodeItem[] = [];

    // Analyze structural signatures of functions
    for (let i = 0; i < allSymbols.length; i++) {
      for (let j = i + 1; j < allSymbols.length; j++) {
        const a = allSymbols[i];
        const b = allSymbols[j];

        if (a.id === b.id) continue;

        const sharedFeatures: string[] = [];
        let similarity = 0;

        // Check name semantic similarity
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        if (
          (aName.includes('validate') && bName.includes('validate')) ||
          (aName.includes('check') && bName.includes('check')) ||
          (aName.includes('auth') && bName.includes('auth')) ||
          (aName.includes('calc') && bName.includes('calc')) ||
          (aName.includes('format') && bName.includes('format'))
        ) {
          sharedFeatures.push('semantic validation / check intent');
          similarity += 30;
        }

        // Check complexity and signature parity
        if (Math.abs(a.complexity - b.complexity) <= 1 && a.complexity > 1) {
          sharedFeatures.push('matching branch complexity');
          similarity += 25;
        }

        if (a.parametersCount !== undefined && a.parametersCount === b.parametersCount) {
          sharedFeatures.push('identical parameter count');
          similarity += 15;
        }

        // Structural signature check if docstrings or signatures match
        if (a.returnType && a.returnType === b.returnType) {
          sharedFeatures.push('identical return type');
          similarity += 15;
        }

        // Read source snippet if available to check structural keywords
        try {
          if (fs.existsSync(a.filePath) && fs.existsSync(b.filePath)) {
            const aContent = fs.readFileSync(a.filePath, 'utf-8');
            const bContent = fs.readFileSync(b.filePath, 'utf-8');
            const aLines = aContent.split('\n').slice(a.range.start.line - 1, a.range.end.line).join('\n');
            const bLines = bContent.split('\n').slice(b.range.start.line - 1, b.range.end.line).join('\n');

            const hasNullCheck = (code: string) => /(!\w+|\w+\s*===?\s*null|\w+\s*===?\s*undefined)/.test(code);
            const hasErrorThrow = (code: string) => /(throw new|Error\(|return\s+\{.*error)/.test(code);
            const hasDbLookup = (code: string) => /(find|select|query|getById|db\.)/.test(code);

            if (hasNullCheck(aLines) && hasNullCheck(bLines)) {
              sharedFeatures.push('null checking');
              similarity += 10;
            }
            if (hasErrorThrow(aLines) && hasErrorThrow(bLines)) {
              sharedFeatures.push('error handling');
              similarity += 10;
            }
            if (hasDbLookup(aLines) && hasDbLookup(bLines)) {
              sharedFeatures.push('database lookup');
              similarity += 10;
            }
          }
        } catch {
          // ignore file read error
        }

        if (similarity >= minSimilarity && sharedFeatures.length >= 2) {
          let suggestedExtraction = 'SharedUtilityService';
          if (sharedFeatures.includes('null checking') && sharedFeatures.includes('semantic validation / check intent')) {
            suggestedExtraction = 'ValidationService';
          }

          duplicates.push({
            id: `dup-${a.name}-${b.name}`,
            symbolA: {
              name: a.name,
              filePath: a.filePath,
              line: a.range.start.line
            },
            symbolB: {
              name: b.name,
              filePath: b.filePath,
              line: b.range.start.line
            },
            similarity: Math.min(similarity, 96),
            sharedStructure: sharedFeatures,
            possibleExtraction: suggestedExtraction
          });
        }
      }
    }

    return duplicates;
  }

  public inspectArchitecture(): ArchitectureModule[] {
    const allFiles = this.db.getAllFiles();
    const modulesMap = new Map<string, { files: string[]; symbolsCount: number }>();

    for (const f of allFiles) {
      const rel = path.relative(this.workspaceRoot, f.path);
      const parts = rel.split(path.sep);
      const modName = parts.length > 1 ? parts[parts.length - 2] : 'root';

      const entry = modulesMap.get(modName) || { files: [], symbolsCount: 0 };
      entry.files.push(f.path);
      const syms = this.db.getSymbolsForFile(f.path);
      entry.symbolsCount += syms.length;
      modulesMap.set(modName, entry);
    }

    const result: ArchitectureModule[] = [];
    for (const [modName, data] of modulesMap.entries()) {
      const deps = new Set<string>();
      const callers = new Set<string>();

      for (const filePath of data.files) {
        for (const dep of this.db.getDependencies(filePath)) {
          const depRel = path.relative(this.workspaceRoot, dep);
          const depParts = depRel.split(path.sep);
          const depMod = depParts.length > 1 ? depParts[depParts.length - 2] : 'root';
          if (depMod !== modName) deps.add(depMod);
        }
        for (const caller of this.db.getDependents(filePath)) {
          const callerRel = path.relative(this.workspaceRoot, caller);
          const callerParts = callerRel.split(path.sep);
          const callerMod = callerParts.length > 1 ? callerParts[callerParts.length - 2] : 'root';
          if (callerMod !== modName) callers.add(callerMod);
        }
      }

      result.push({
        id: `module-${modName}`,
        name: modName.toUpperCase(),
        path: modName,
        type: 'module',
        symbolsCount: data.symbolsCount,
        filesCount: data.files.length,
        dependencies: Array.from(deps),
        callers: Array.from(callers),
        riskScore: data.files.length > 5 ? 65 : 25
      });
    }

    return result;
  }

  private findSymbolCallers(symbolName: string): string[] {
    const allSymbols = this.db.getAllSymbols();
    const callers: string[] = [];

    // Search files for callers of this symbol name
    const files = this.db.getAllFiles();
    for (const f of files) {
      try {
        if (!fs.existsSync(f.path)) continue;
        const content = fs.readFileSync(f.path, 'utf-8');
        if (content.includes(symbolName)) {
          callers.push(f.path);
        }
      } catch {
        // ignore
      }
    }

    return callers;
  }
}
