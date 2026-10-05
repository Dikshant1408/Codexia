import { test } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArchaeologyEngine } from '../packages/core/dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoDir = path.resolve(__dirname, '../examples/demo-project');

test('Integration: ArchaeologyEngine indexes demo-project correctly', async () => {
  const engine = new ArchaeologyEngine({
    workspaceRoot: demoDir
  });

  const summary = await engine.analyzeWorkspace(demoDir, true);

  assert.strictEqual(summary.analyzedFiles >= 8, true);
  assert.strictEqual(summary.totalSymbols >= 15, true);
  assert.strictEqual(summary.totalCommits >= 6, true);
  assert.strictEqual(summary.aiStatus.enabled, false);
  assert.strictEqual(summary.aiStatus.statusText.includes('LOCAL ANALYSIS'), true);
});

test('Integration: Blast radius correctly tracks dependents of calculatePrice', async () => {
  const engine = new ArchaeologyEngine({
    workspaceRoot: demoDir
  });
  await engine.analyzeWorkspace(demoDir);

  const blast = await engine.getBlastRadius('calculatePrice');

  assert.strictEqual(blast.symbolName, 'calculatePrice');
  assert.strictEqual(blast.directDependents >= 3, true);
  assert.strictEqual(blast.affectedFiles >= 4, true);
  assert.strictEqual(blast.overallRisk, 'HIGH');
  assert.ok(blast.tree);
  assert.strictEqual(blast.tree.children.length >= 3, true);
});

test('Integration: Structural duplicate detector identifies UserService and OrderService', async () => {
  const engine = new ArchaeologyEngine({
    workspaceRoot: demoDir
  });
  await engine.analyzeWorkspace(demoDir);

  const dups = await engine.findDuplicates(65);
  assert.strictEqual(dups.length >= 1, true);

  const found = dups.find((d) => d.symbolA.name.includes('validate') && d.symbolB.name.includes('validate'));
  assert.ok(found, 'Should find duplicate validation logic');
  assert.strictEqual(found?.possibleExtraction, 'ValidationService');
});

test('Integration: Risk score evaluates with transparent 5-factor breakdown', async () => {
  const engine = new ArchaeologyEngine({
    workspaceRoot: demoDir
  });
  await engine.analyzeWorkspace(demoDir);

  const risk = await engine.getRiskScore('src/pricing/PricingService.ts', 'calculatePrice');

  assert.ok(risk.score >= 0 && risk.score <= 100);
  assert.strictEqual(risk.factors.length, 5);
  assert.ok(risk.factors.some((f) => f.name === 'Coupling'));
  assert.ok(risk.factors.some((f) => f.name === 'Change frequency'));
  assert.ok(risk.factors.some((f) => f.name === 'Complexity'));
  assert.ok(risk.factors.some((f) => f.name === 'Few tests'));
  assert.ok(risk.factors.some((f) => f.name === 'Recent regressions'));
});
