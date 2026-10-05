import { test } from 'node:test';
import * as assert from 'node:assert';
import { AstEngine } from '../packages/ast-engine/dist/index.js';

test('AstEngine parses TypeScript functions, methods, and complexity', () => {
  const engine = new AstEngine();
  const code = `
  export function calculateTotal(items: any[], discount: number = 0): number {
    let sum = 0;
    for (const item of items) {
      if (item.price > 0) {
        sum += item.price;
      }
    }
    return discount > 0 ? sum * (1 - discount) : sum;
  }

  export class PaymentProcessor {
    public charge(amount: number): boolean {
      if (amount <= 0) return false;
      return true;
    }
  }
  `;

  const result = engine.parseFile('test.ts', code);

  assert.strictEqual(result.metadata.language, 'TypeScript');
  assert.strictEqual(result.metadata.linesOfCode, code.split('\n').length);
  assert.strictEqual(result.symbols.length >= 3, true);

  const calcFunc = result.symbols.find((s) => s.name === 'calculateTotal');
  assert.ok(calcFunc, 'calculateTotal function should be detected');
  assert.strictEqual(calcFunc?.kind, 'function');
  assert.strictEqual(calcFunc?.isExported, true);
  assert.strictEqual(calcFunc?.complexity >= 4, true, 'Complexity should account for loops and branches');

  const classSym = result.symbols.find((s) => s.name === 'PaymentProcessor');
  assert.ok(classSym, 'PaymentProcessor class should be detected');
  assert.strictEqual(classSym?.kind, 'class');

  const methodSym = result.symbols.find((s) => s.name === 'PaymentProcessor.charge');
  assert.ok(methodSym, 'PaymentProcessor.charge method should be detected');
  assert.strictEqual(methodSym?.kind, 'method');
});

test('AstEngine parses Python functions and classes', () => {
  const engine = new AstEngine();
  const pyCode = `
import os
import sys

class OrderService:
    def process_order(self, order_id):
        if not order_id:
            raise ValueError("Invalid order ID")
        return True

def standalone_helper():
    pass
`;

  const result = engine.parseFile('order.py', pyCode);
  assert.strictEqual(result.metadata.language, 'Python');
  assert.strictEqual(result.metadata.isPartialAnalysis, true);
  assert.strictEqual(result.symbols.length, 3);
  assert.strictEqual(result.importedFiles.length, 2);
});
