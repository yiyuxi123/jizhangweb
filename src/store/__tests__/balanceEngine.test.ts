import { describe, it, expect } from 'vitest';
import { computeNetEffect } from '../balanceEngine';

describe('computeNetEffect', () => {
  it('should return 0 when no transactions match the account', () => {
    const txs = [
      { type: 'expense', fromAccountId: 'other', amount: 100 },
    ];
    expect(computeNetEffect(txs, 'acc-1')).toBe(0);
  });

  it('should subtract expenses from the source account', () => {
    const txs = [
      { type: 'expense', fromAccountId: 'acc-1', amount: 50 },
      { type: 'expense', fromAccountId: 'acc-1', amount: 30 },
    ];
    expect(computeNetEffect(txs, 'acc-1')).toBe(-80);
  });

  it('should add income to the target account', () => {
    const txs = [
      { type: 'income', toAccountId: 'acc-1', amount: 2000 },
    ];
    expect(computeNetEffect(txs, 'acc-1')).toBe(2000);
  });

  it('should handle transfers correctly', () => {
    const txs = [
      { type: 'transfer', fromAccountId: 'acc-1', toAccountId: 'acc-2', amount: 500 },
    ];
    // acc-1 is source: -500
    expect(computeNetEffect(txs, 'acc-1')).toBe(-500);
    // acc-2 is target: +500
    expect(computeNetEffect(txs, 'acc-2')).toBe(500);
  });

  it('should compute mixed transactions correctly', () => {
    const txs = [
      { type: 'income', toAccountId: 'acc-1', amount: 3000 },
      { type: 'expense', fromAccountId: 'acc-1', amount: 200 },
      { type: 'expense', fromAccountId: 'acc-1', amount: 150 },
      { type: 'transfer', fromAccountId: 'acc-1', toAccountId: 'acc-2', amount: 1000 },
    ];
    // 3000 - 200 - 150 - 1000 = 1650
    expect(computeNetEffect(txs, 'acc-1')).toBe(1650);
  });

  it('should return 0 for empty transactions array', () => {
    expect(computeNetEffect([], 'acc-1')).toBe(0);
  });

  it('should handle transactions where account is both source and target (transfer receive)', () => {
    const txs = [
      { type: 'transfer', fromAccountId: 'acc-2', toAccountId: 'acc-1', amount: 300 },
    ];
    expect(computeNetEffect(txs, 'acc-1')).toBe(300);
  });
});
