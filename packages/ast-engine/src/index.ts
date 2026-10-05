import ts from 'typescript';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import type {
  SymbolInfo,
  ReferenceInfo,
  FileMetadata,
  SymbolKind
} from '@codearch/protocol';

export interface ParseResult {
  metadata: FileMetadata;
  symbols: SymbolInfo[];
  references: ReferenceInfo[];
  importedFiles: Array<{ specifier: string; resolvedPath?: string }>;
  exportedSymbols: string[];
}

export class AstEngine {
  public parseFile(filePath: string, content?: string): ParseResult {
    const fileContent = content !== undefined ? content : fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    const sha256 = crypto.createHash('sha256').update(fileContent).digest('hex');
    const lines = fileContent.split('\n');
    const loc = lines.length;

    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
      return this.parseTypeScript(filePath, fileContent, sha256, loc);
    } else if (['.py'].includes(ext)) {
      return this.parsePython(filePath, fileContent, sha256, loc);
    } else if (['.go'].includes(ext)) {
      return this.parseGo(filePath, fileContent, sha256, loc);
    } else if (['.rs'].includes(ext)) {
      return this.parseRust(filePath, fileContent, sha256, loc);
    } else if (['.java'].includes(ext)) {
      return this.parseJava(filePath, fileContent, sha256, loc);
    } else {
      return this.parseGeneric(filePath, fileContent, sha256, loc);
    }
  }

  private parseTypeScript(
    filePath: string,
    content: string,
    hash: string,
    loc: number
  ): ParseResult {
    const isTs = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      isTs ? ts.ScriptKind.TS : ts.ScriptKind.JS
    );

    const symbols: SymbolInfo[] = [];
    const references: ReferenceInfo[] = [];
    const importedFiles: Array<{ specifier: string; resolvedPath?: string }> = [];
    const exportedSymbols: string[] = [];

    let totalFileComplexity = 1;

    const computeComplexity = (node: ts.Node): number => {
      let score = 1;
      const walk = (n: ts.Node) => {
        switch (n.kind) {
          case ts.SyntaxKind.IfStatement:
          case ts.SyntaxKind.ConditionalExpression:
          case ts.SyntaxKind.CaseClause:
          case ts.SyntaxKind.CatchClause:
          case ts.SyntaxKind.ForStatement:
          case ts.SyntaxKind.ForInStatement:
          case ts.SyntaxKind.ForOfStatement:
          case ts.SyntaxKind.WhileStatement:
          case ts.SyntaxKind.DoStatement:
            score++;
            break;
          case ts.SyntaxKind.BinaryExpression: {
            const bin = n as ts.BinaryExpression;
            if (
              bin.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
              bin.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
              bin.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
            ) {
              score++;
            }
            break;
          }
        }
        ts.forEachChild(n, walk);
      };
      walk(node);
      return score;
    };

    const getDocstring = (node: ts.Node): string | undefined => {
      const fullText = sourceFile.getFullText();
      const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart());
      if (!ranges || ranges.length === 0) return undefined;
      return ranges
        .map((r) => fullText.substring(r.pos, r.end).trim())
        .join('\n');
    };

    const visit = (node: ts.Node, parentSymbolId?: string) => {
      // 1. Imports
      if (ts.isImportDeclaration(node)) {
        const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
        importedFiles.push({ specifier });
      }

      // 2. Export declarations
      if (ts.isExportDeclaration(node)) {
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const el of node.exportClause.elements) {
            exportedSymbols.push(el.name.text);
          }
        }
      }

      // 3. Call Expressions (references)
      if (ts.isCallExpression(node)) {
        const callStart = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const callEnd = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        let calledName = '';
        if (ts.isIdentifier(node.expression)) {
          calledName = node.expression.text;
        } else if (ts.isPropertyAccessExpression(node.expression)) {
          calledName = node.expression.name.text;
        }

        if (calledName) {
          references.push({
            symbolId: calledName,
            sourceFile: filePath,
            range: {
              start: { line: callStart.line + 1, column: callStart.character + 1 },
              end: { line: callEnd.line + 1, column: callEnd.character + 1 }
            },
            isCall: true,
            isImport: false,
            contextSnippet: node.getText(sourceFile).slice(0, 100)
          });
        }
      }

      // 4. Function Declarations
      if (ts.isFunctionDeclaration(node) && node.name) {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const name = node.name.text;
        const isExported = Boolean(
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        );
        if (isExported) exportedSymbols.push(name);

        const complexity = computeComplexity(node);
        totalFileComplexity += complexity;
        const symId = `${filePath}#${name}`;

        symbols.push({
          id: symId,
          name,
          kind: 'function',
          filePath,
          range: {
            start: { line: start.line + 1, column: start.character + 1 },
            end: { line: end.line + 1, column: end.character + 1 }
          },
          signature: node.getText(sourceFile).split('{')[0]?.trim(),
          docstring: getDocstring(node),
          complexity,
          parametersCount: node.parameters.length,
          returnType: node.type?.getText(sourceFile),
          isExported,
          parentSymbolId
        });

        ts.forEachChild(node, (child) => visit(child, symId));
        return;
      }

      // 5. Class Declarations
      if (ts.isClassDeclaration(node) && node.name) {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const name = node.name.text;
        const isExported = Boolean(
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        );
        if (isExported) exportedSymbols.push(name);

        const symId = `${filePath}#${name}`;
        symbols.push({
          id: symId,
          name,
          kind: 'class',
          filePath,
          range: {
            start: { line: start.line + 1, column: start.character + 1 },
            end: { line: end.line + 1, column: end.character + 1 }
          },
          signature: `class ${name}`,
          docstring: getDocstring(node),
          complexity: 1,
          isExported,
          parentSymbolId
        });

        // Traverse class members
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.name) {
            const mStart = sourceFile.getLineAndCharacterOfPosition(member.getStart());
            const mEnd = sourceFile.getLineAndCharacterOfPosition(member.getEnd());
            const mName = member.name.getText(sourceFile);
            const mComplexity = computeComplexity(member);
            totalFileComplexity += mComplexity;
            const mId = `${filePath}#${name}.${mName}`;

            symbols.push({
              id: mId,
              name: `${name}.${mName}`,
              kind: 'method',
              filePath,
              range: {
                start: { line: mStart.line + 1, column: mStart.character + 1 },
                end: { line: mEnd.line + 1, column: mEnd.character + 1 }
              },
              signature: member.getText(sourceFile).split('{')[0]?.trim(),
              docstring: getDocstring(member),
              complexity: mComplexity,
              parametersCount: member.parameters.length,
              returnType: member.type?.getText(sourceFile),
              isExported,
              parentSymbolId: symId
            });

            ts.forEachChild(member, (child) => visit(child, mId));
          }
        }
        return;
      }

      // 6. Variable Statement with Arrow Functions or Consts
      if (ts.isVariableStatement(node)) {
        const isExported = Boolean(
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        );
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            const name = decl.name.text;
            if (isExported) exportedSymbols.push(name);
            const start = sourceFile.getLineAndCharacterOfPosition(decl.getStart());
            const end = sourceFile.getLineAndCharacterOfPosition(decl.getEnd());

            const isArrow = decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer));
            const complexity = isArrow ? computeComplexity(decl.initializer) : 1;
            totalFileComplexity += complexity;
            const symId = `${filePath}#${name}`;

            symbols.push({
              id: symId,
              name,
              kind: isArrow ? 'function' : 'variable',
              filePath,
              range: {
                start: { line: start.line + 1, column: start.character + 1 },
                end: { line: end.line + 1, column: end.character + 1 }
              },
              signature: isArrow ? decl.getText(sourceFile).split('=>')[0]?.trim() : name,
              docstring: getDocstring(node),
              complexity,
              isExported,
              parentSymbolId
            });

            if (isArrow) {
              ts.forEachChild(decl.initializer, (child) => visit(child, symId));
            }
          }
        }
        return;
      }

      // 7. Interface Declarations
      if (ts.isInterfaceDeclaration(node)) {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const name = node.name.text;
        const isExported = Boolean(
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        );
        if (isExported) exportedSymbols.push(name);

        symbols.push({
          id: `${filePath}#${name}`,
          name,
          kind: 'interface',
          filePath,
          range: {
            start: { line: start.line + 1, column: start.character + 1 },
            end: { line: end.line + 1, column: end.character + 1 }
          },
          signature: `interface ${name}`,
          docstring: getDocstring(node),
          complexity: 1,
          isExported,
          parentSymbolId
        });
        return;
      }

      ts.forEachChild(node, (child) => visit(child, parentSymbolId));
    };

    visit(sourceFile);

    return {
      metadata: {
        path: filePath,
        relativePath: filePath,
        language: isTs ? 'TypeScript' : 'JavaScript',
        linesOfCode: loc,
        complexity: totalFileComplexity,
        symbolsCount: symbols.length,
        lastModifiedDate: new Date().toISOString(),
        sha256: hash,
        isPartialAnalysis: false
      },
      symbols,
      references,
      importedFiles,
      exportedSymbols
    };
  }

  private parsePython(filePath: string, content: string, hash: string, loc: number): ParseResult {
    const lines = content.split('\n');
    const symbols: SymbolInfo[] = [];
    const references: ReferenceInfo[] = [];
    const importedFiles: Array<{ specifier: string }> = [];
    const exportedSymbols: string[] = [];

    let currentClass: string | null = null;
    let complexity = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Complexity heuristics
      if (/\b(if|elif|for|while|except|and|or)\b/.test(trimmed)) {
        complexity++;
      }

      // Import heuristics
      const importMatch = trimmed.match(/^(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/);
      if (importMatch) {
        const mod = importMatch[1] || importMatch[2];
        importedFiles.push({ specifier: mod });
      }

      // Class definition
      const classMatch = line.match(/^class\s+([A-Za-z0-9_]+)/);
      if (classMatch) {
        currentClass = classMatch[1];
        exportedSymbols.push(currentClass);
        symbols.push({
          id: `${filePath}#${currentClass}`,
          name: currentClass,
          kind: 'class',
          filePath,
          range: {
            start: { line: i + 1, column: 1 },
            end: { line: i + 1, column: line.length }
          },
          signature: trimmed,
          complexity: 1,
          isExported: !currentClass.startsWith('_')
        });
        continue;
      }

      // Def statement
      const defMatch = line.match(/^(\s*)def\s+([A-Za-z0-9_]+)\s*\((.*)\)/);
      if (defMatch) {
        const indent = defMatch[1].length;
        const name = defMatch[2];
        const isMethod = indent > 0 && currentClass !== null;
        const fullName = isMethod ? `${currentClass}.${name}` : name;
        const isExported = !name.startsWith('_');
        if (isExported) exportedSymbols.push(fullName);

        symbols.push({
          id: `${filePath}#${fullName}`,
          name: fullName,
          kind: isMethod ? 'method' : 'function',
          filePath,
          range: {
            start: { line: i + 1, column: indent + 1 },
            end: { line: i + 1, column: line.length }
          },
          signature: trimmed.split(':')[0],
          complexity: 2,
          isExported,
          parentSymbolId: isMethod ? `${filePath}#${currentClass}` : undefined
        });
      }
    }

    return {
      metadata: {
        path: filePath,
        relativePath: filePath,
        language: 'Python',
        linesOfCode: loc,
        complexity,
        symbolsCount: symbols.length,
        lastModifiedDate: new Date().toISOString(),
        sha256: hash,
        isPartialAnalysis: true
      },
      symbols,
      references,
      importedFiles,
      exportedSymbols
    };
  }

  private parseGo(filePath: string, content: string, hash: string, loc: number): ParseResult {
    const lines = content.split('\n');
    const symbols: SymbolInfo[] = [];
    const references: ReferenceInfo[] = [];
    const importedFiles: Array<{ specifier: string }> = [];
    const exportedSymbols: string[] = [];

    let complexity = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (/\b(if|for|switch|case|select)\b/.test(trimmed)) complexity++;

      const importMatch = trimmed.match(/^import\s+"([^"]+)"/);
      if (importMatch) {
        importedFiles.push({ specifier: importMatch[1] });
      }

      const funcMatch = line.match(/^func\s+(?:\((?:[^)]+)\)\s+)?([A-Za-z0-9_]+)\s*\(/);
      if (funcMatch) {
        const name = funcMatch[1];
        const isExported = /^[A-Z]/.test(name);
        if (isExported) exportedSymbols.push(name);

        symbols.push({
          id: `${filePath}#${name}`,
          name,
          kind: 'function',
          filePath,
          range: {
            start: { line: i + 1, column: 1 },
            end: { line: i + 1, column: line.length }
          },
          signature: trimmed.split('{')[0]?.trim(),
          complexity: 2,
          isExported
        });
      }
    }

    return {
      metadata: {
        path: filePath,
        relativePath: filePath,
        language: 'Go',
        linesOfCode: loc,
        complexity,
        symbolsCount: symbols.length,
        lastModifiedDate: new Date().toISOString(),
        sha256: hash,
        isPartialAnalysis: true
      },
      symbols,
      references,
      importedFiles,
      exportedSymbols
    };
  }

  private parseRust(filePath: string, content: string, hash: string, loc: number): ParseResult {
    const lines = content.split('\n');
    const symbols: SymbolInfo[] = [];
    const references: ReferenceInfo[] = [];
    const importedFiles: Array<{ specifier: string }> = [];
    const exportedSymbols: string[] = [];

    let complexity = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (/\b(if|match|for|while|loop)\b/.test(trimmed)) complexity++;

      const useMatch = trimmed.match(/^use\s+([^;]+);/);
      if (useMatch) {
        importedFiles.push({ specifier: useMatch[1] });
      }

      const fnMatch = line.match(/^(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)/);
      if (fnMatch) {
        const name = fnMatch[1];
        const isExported = line.includes('pub fn');
        if (isExported) exportedSymbols.push(name);

        symbols.push({
          id: `${filePath}#${name}`,
          name,
          kind: 'function',
          filePath,
          range: {
            start: { line: i + 1, column: 1 },
            end: { line: i + 1, column: line.length }
          },
          signature: trimmed.split('{')[0]?.trim(),
          complexity: 2,
          isExported
        });
      }
    }

    return {
      metadata: {
        path: filePath,
        relativePath: filePath,
        language: 'Rust',
        linesOfCode: loc,
        complexity,
        symbolsCount: symbols.length,
        lastModifiedDate: new Date().toISOString(),
        sha256: hash,
        isPartialAnalysis: true
      },
      symbols,
      references,
      importedFiles,
      exportedSymbols
    };
  }

  private parseJava(filePath: string, content: string, hash: string, loc: number): ParseResult {
    const lines = content.split('\n');
    const symbols: SymbolInfo[] = [];
    const references: ReferenceInfo[] = [];
    const importedFiles: Array<{ specifier: string }> = [];
    const exportedSymbols: string[] = [];

    let complexity = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (/\b(if|for|while|switch|catch)\b/.test(trimmed)) complexity++;

      const importMatch = trimmed.match(/^import\s+([^;]+);/);
      if (importMatch) {
        importedFiles.push({ specifier: importMatch[1] });
      }

      const methodMatch = line.match(/(?:public|protected|private)?\s+(?:static\s+)?[A-Za-z0-9_<>[\], ]+\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{?/);
      if (methodMatch && !line.includes('class ') && !line.includes('interface ')) {
        const name = methodMatch[1];
        const isExported = line.includes('public ');
        if (isExported) exportedSymbols.push(name);

        symbols.push({
          id: `${filePath}#${name}`,
          name,
          kind: 'method',
          filePath,
          range: {
            start: { line: i + 1, column: 1 },
            end: { line: i + 1, column: line.length }
          },
          signature: trimmed.split('{')[0]?.trim(),
          complexity: 2,
          isExported
        });
      }
    }

    return {
      metadata: {
        path: filePath,
        relativePath: filePath,
        language: 'Java',
        linesOfCode: loc,
        complexity,
        symbolsCount: symbols.length,
        lastModifiedDate: new Date().toISOString(),
        sha256: hash,
        isPartialAnalysis: true
      },
      symbols,
      references,
      importedFiles,
      exportedSymbols
    };
  }

  private parseGeneric(filePath: string, content: string, hash: string, loc: number): ParseResult {
    return {
      metadata: {
        path: filePath,
        relativePath: filePath,
        language: 'Plaintext',
        linesOfCode: loc,
        complexity: 1,
        symbolsCount: 0,
        lastModifiedDate: new Date().toISOString(),
        sha256: hash,
        isPartialAnalysis: true
      },
      symbols: [],
      references: [],
      importedFiles: [],
      exportedSymbols: []
    };
  }
}
