import { describe, it, expect } from 'vitest';
import {
  calculateDynamicInjection,
  calculatePeriodicRebalance,
  checkThresholdDeviation,
  validateTargetRatios,
  roundMoney
} from '../../utils/rebalanceUtils';

describe('validateTargetRatios', () => {
  it('should pass if target ratios sum to 100', () => {
    expect(() => validateTargetRatios({ acc1: 30, acc2: 70 })).not.toThrow();
  });

  it('should throw an error if target ratios do not sum to 100', () => {
    expect(() => validateTargetRatios({ acc1: 30, acc2: 60 })).toThrow();
    expect(() => validateTargetRatios({ acc1: 50, acc2: 51 })).toThrow();
  });

  it('should do nothing if ratios list is empty', () => {
    expect(() => validateTargetRatios({})).not.toThrow();
  });
});

describe('calculateDynamicInjection', () => {
  it('should distribute new funds to fill deficiencies', () => {
    const currentBalances = { acc1: 10, acc2: 20, acc3: 70 }; // Total = 100
    const targetRatios = { acc1: 30, acc2: 30, acc3: 40 }; // TotalTarget = 110 (if injecting 10)
    // Target amounts with total 110:
    // acc1: 33, deficiency = 23
    // acc2: 33, deficiency = 13
    // acc3: 44, deficiency = -26 (no deficiency)
    // Sum deficiencies = 36. newFunds = 10 < 36.
    // Proportional allocations:
    // acc1 gets 10 * 23/36 = 6.39
    // acc2 gets 10 * 13/36 = 3.61
    
    const allocations = calculateDynamicInjection(currentBalances, targetRatios, 10);
    expect(allocations.acc1).toBe(6.39);
    expect(allocations.acc2).toBe(3.61);
    expect(allocations.acc3).toBe(0);
    
    const totalAllocated = Object.values(allocations).reduce((a, b) => a + b, 0);
    expect(roundMoney(totalAllocated)).toBe(10);
  });

  it('should allocate remaining funds proportionally if injection exceeds deficiencies', () => {
    const currentBalances = { acc1: 28, acc2: 28, acc3: 44 }; // Total = 100
    const targetRatios = { acc1: 30, acc2: 30, acc3: 40 }; // TotalTarget = 110 (if injecting 10)
    // Target amounts with total 110:
    // acc1: 33 (deficiency = 5)
    // acc2: 33 (deficiency = 5)
    // acc3: 44 (deficiency = 0)
    // Total deficiency = 10. newFunds = 10 == total deficiency.
    
    const allocations = calculateDynamicInjection(currentBalances, targetRatios, 10);
    expect(allocations.acc1).toBe(5);
    expect(allocations.acc2).toBe(5);
    expect(allocations.acc3).toBe(0);
  });

  it('should return zeros if newFunds is 0', () => {
    const currentBalances = { acc1: 10, acc2: 20 };
    const targetRatios = { acc1: 50, acc2: 50 };
    const allocations = calculateDynamicInjection(currentBalances, targetRatios, 0);
    expect(allocations.acc1).toBe(0);
    expect(allocations.acc2).toBe(0);
  });
});

describe('calculatePeriodicRebalance', () => {
  it('should compute exact buy and sell operations to reach target ratios', () => {
    const currentBalances = { acc1: 10, acc2: 20, acc3: 70 }; // Total = 100
    const targetRatios = { acc1: 30, acc2: 30, acc3: 40 };
    // Targets: acc1: 30, acc2: 30, acc3: 40
    // acc1 difference: +20 (buy)
    // acc2 difference: +10 (buy)
    // acc3 difference: -30 (sell)

    const actions = calculatePeriodicRebalance(currentBalances, targetRatios);
    
    const acc1Action = actions.find(a => a.accountId === 'acc1');
    const acc2Action = actions.find(a => a.accountId === 'acc2');
    const acc3Action = actions.find(a => a.accountId === 'acc3');

    expect(acc1Action?.action).toBe('buy');
    expect(acc1Action?.amount).toBe(20);

    expect(acc2Action?.action).toBe('buy');
    expect(acc2Action?.amount).toBe(10);

    expect(acc3Action?.action).toBe('sell');
    expect(acc3Action?.amount).toBe(30);

    // Ensure buy sum equals sell sum
    const totalBuys = actions.filter(a => a.action === 'buy').reduce((s, a) => s + a.amount, 0);
    const totalSells = actions.filter(a => a.action === 'sell').reduce((s, a) => s + a.amount, 0);
    expect(roundMoney(totalBuys)).toBe(roundMoney(totalSells));
  });

  it('should return hold actions if balances are already balanced', () => {
    const currentBalances = { acc1: 50, acc2: 50 };
    const targetRatios = { acc1: 50, acc2: 50 };
    const actions = calculatePeriodicRebalance(currentBalances, targetRatios);
    actions.forEach(act => {
      expect(act.action).toBe('hold');
      expect(act.amount).toBe(0);
    });
  });
});

describe('checkThresholdDeviation', () => {
  it('should compute current ratios and flag deviations over threshold', () => {
    const currentBalances = { acc1: 36, acc2: 64 }; // Total = 100
    const targetRatios = { acc1: 30, acc2: 70 }; // Deviations: acc1: +6%, acc2: -6%
    
    const deviations = checkThresholdDeviation(currentBalances, targetRatios, 5);
    
    const acc1Dev = deviations.find(d => d.accountId === 'acc1');
    const acc2Dev = deviations.find(d => d.accountId === 'acc2');

    expect(acc1Dev?.currentRatio).toBe(36);
    expect(acc1Dev?.deviation).toBe(6);
    expect(acc1Dev?.isOverThreshold).toBe(true);

    expect(acc2Dev?.currentRatio).toBe(64);
    expect(acc2Dev?.deviation).toBe(-6);
    expect(acc2Dev?.isOverThreshold).toBe(true);

    // Test under threshold
    const deviationsUnder = checkThresholdDeviation(currentBalances, targetRatios, 8);
    expect(deviationsUnder.every(d => !d.isOverThreshold)).toBe(true);
  });
});
