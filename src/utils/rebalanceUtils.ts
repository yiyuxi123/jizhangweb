/**
 * Utility functions for Asset Rebalancing calculations.
 * Ensures float safety by rounding to 2 decimal places.
 */

export const roundMoney = (val: number): number => {
  return Math.round(val * 100) / 100;
};

/**
 * Automatically extracts a clean, shortened name (abbreviation) for accounts
 * to prevent legend overflow in pie charts.
 */
export const getAccountShortName = (name: string): string => {
  if (!name) return '';
  let short = name;
  // Remove common suffixes and descriptors
  short = short.replace(/(开放式|发起式|定期开放|定开|混合型|股票型|指数增强|指数型|指数|债券型|证券投资|投资|联接|证券投资基金|基金|账户|LOF|ETF|A类|C类|I类|E类)/g, '');
  // Remove parentheses content
  short = short.replace(/\(.*?\)/g, '').replace(/（.*?）/g, '');
  // Trim space
  short = short.trim();
  // Limit length to 8 characters to fit nicely in legends
  if (short.length > 8) {
    short = short.substring(0, 8) + '...';
  }
  return short;
};

const getSumOfValues = (obj: Record<string, number>): number => {
  return Object.values(obj).reduce((sum, val) => sum + val, 0);
};

/**
 * Validates that the sum of target ratios is exactly 100%.
 */
export const validateTargetRatios = (targetRatios: Record<string, number>): void => {
  const keys = Object.keys(targetRatios);
  if (keys.length === 0) return;
  
  const totalRatio = Math.round(getSumOfValues(targetRatios));
  if (totalRatio !== 100) {
    throw new Error(`目标仓位比例总和必须为 100%，当前为 ${totalRatio}%`);
  }
};

export interface RebalanceAction {
  accountId: string;
  difference: number; // targetAmount - currentAmount
  action: 'buy' | 'sell' | 'hold';
  amount: number;
}

export interface DeviationDetail {
  accountId: string;
  currentRatio: number;
  targetRatio: number;
  deviation: number; // currentRatio - targetRatio
  isOverThreshold: boolean;
}

/**
 * 1. 动态再平衡 (增量注入模型)
 * 计算如果新注入 newFunds 资金后，应如何分配到各理财账户，使得占比尽可能接近目标占比。
 * 该模型不卖出任何现有资产。
 */
export const calculateDynamicInjection = (
  currentBalances: Record<string, number>,
  targetRatios: Record<string, number>,
  newFunds: number
): Record<string, number> => {
  validateTargetRatios(targetRatios);
  
  if (newFunds <= 0) {
    const zeroAllocations: Record<string, number> = {};
    Object.keys(targetRatios).forEach(id => {
      zeroAllocations[id] = 0;
    });
    return zeroAllocations;
  }

  const accountIds = Object.keys(targetRatios);
  const totalCurrent = getSumOfValues(currentBalances);
  const totalTarget = totalCurrent + newFunds;

  // Step 1: 计算标准目标额与缺口
  const targetAmounts: Record<string, number> = {};
  const deficiencies: Record<string, number> = {};
  let sumPositiveDeficiencies = 0;

  accountIds.forEach(id => {
    const current = currentBalances[id] || 0;
    const ratio = targetRatios[id] || 0;
    const target = roundMoney((totalTarget * ratio) / 100);
    targetAmounts[id] = target;

    const deficiency = roundMoney(target - current);
    if (deficiency > 0) {
      deficiencies[id] = deficiency;
      sumPositiveDeficiencies += deficiency;
    } else {
      deficiencies[id] = 0;
    }
  });

  const allocations: Record<string, number> = {};
  
  // Step 2: 根据新钱与总缺口的关系分配资金
  if (sumPositiveDeficiencies > 0) {
    if (newFunds >= sumPositiveDeficiencies) {
      // 资金足够补齐所有现有缺口，补齐后剩下的钱按目标比例分配
      let allocatedFunds = 0;
      accountIds.forEach(id => {
        allocations[id] = deficiencies[id];
        allocatedFunds += deficiencies[id];
      });

      const remainingFunds = roundMoney(newFunds - allocatedFunds);
      if (remainingFunds > 0) {
        accountIds.forEach(id => {
          const ratio = targetRatios[id] || 0;
          const share = roundMoney((remainingFunds * ratio) / 100);
          allocations[id] = roundMoney(allocations[id] + share);
        });
      }
    } else {
      // 资金不足以弥补全部缺口，则按照缺口比例进行分配
      accountIds.forEach(id => {
        const deficiency = deficiencies[id] || 0;
        if (deficiency > 0) {
          allocations[id] = roundMoney((newFunds * deficiency) / sumPositiveDeficiencies);
        } else {
          allocations[id] = 0;
        }
      });
    }
  } else {
    // 没有任何缺口（可能所有仓位都是持平或超出的，或者是刚开始建仓）
    // 直接按目标占比分配
    accountIds.forEach(id => {
      const ratio = targetRatios[id] || 0;
      allocations[id] = roundMoney((newFunds * ratio) / 100);
    });
  }

  // Step 3: 对齐舍入误差，确保分配金额之和精确等于 newFunds
  let sumAllocations = getSumOfValues(allocations);
  let diff = roundMoney(newFunds - sumAllocations);

  if (diff !== 0 && accountIds.length > 0) {
    // 找出分配额最大或权重最高的一个账户来吸收这个舍入差额
    let maxId = accountIds[0];
    let maxVal = -1;
    accountIds.forEach(id => {
      // 优先补给正缺口最大或者分配额最大的账户
      const val = (deficiencies[id] || 0) + (allocations[id] || 0);
      if (val > maxVal) {
        maxVal = val;
        maxId = id;
      }
    });
    allocations[maxId] = roundMoney(allocations[maxId] + diff);
  }

  // 兜底，防止出现负值分配
  accountIds.forEach(id => {
    if (allocations[id] < 0) allocations[id] = 0;
  });

  return allocations;
};

/**
 * 2. 定期再平衡 (存量一键配平)
 * 卖高买低，调仓方案不包含新钱注入，总金额不变。
 */
export const calculatePeriodicRebalance = (
  currentBalances: Record<string, number>,
  targetRatios: Record<string, number>
): RebalanceAction[] => {
  validateTargetRatios(targetRatios);

  const accountIds = Object.keys(targetRatios);
  const totalCurrent = getSumOfValues(currentBalances);

  if (totalCurrent <= 0) {
    return accountIds.map(id => ({
      accountId: id,
      difference: 0,
      action: 'hold',
      amount: 0
    }));
  }

  const actions: RebalanceAction[] = [];
  let sumBuys = 0;
  let sumSells = 0;

  accountIds.forEach(id => {
    const current = currentBalances[id] || 0;
    const ratio = targetRatios[id] || 0;
    const target = roundMoney((totalCurrent * ratio) / 100);
    const diff = roundMoney(target - current);

    if (diff > 0) {
      actions.push({
        accountId: id,
        difference: diff,
        action: 'buy',
        amount: diff
      });
      sumBuys += diff;
    } else if (diff < 0) {
      const absDiff = Math.abs(diff);
      actions.push({
        accountId: id,
        difference: diff,
        action: 'sell',
        amount: absDiff
      });
      sumSells += absDiff;
    } else {
      actions.push({
        accountId: id,
        difference: 0,
        action: 'hold',
        amount: 0
      });
    }
  });

  // 对齐买和卖的精度误差，保证调仓是一个闭环
  sumBuys = roundMoney(sumBuys);
  sumSells = roundMoney(sumSells);
  let roundingDiff = roundMoney(sumBuys - sumSells);

  if (roundingDiff !== 0) {
    if (roundingDiff > 0) {
      // 买入额多于卖出额，微调买入最大的一项，减少买入额
      const buyActions = actions.filter(a => a.action === 'buy');
      if (buyActions.length > 0) {
        const maxBuy = buyActions.reduce((max, a) => a.amount > max.amount ? a : max, buyActions[0]);
        maxBuy.amount = roundMoney(maxBuy.amount - roundingDiff);
        maxBuy.difference = roundMoney(maxBuy.difference - roundingDiff);
      }
    } else {
      // 卖出额多于买入额，微调卖出最大的一项，减少卖出额
      const sellActions = actions.filter(a => a.action === 'sell');
      if (sellActions.length > 0) {
        const maxSell = sellActions.reduce((max, a) => a.amount > max.amount ? a : max, sellActions[0]);
        const correction = Math.abs(roundingDiff);
        maxSell.amount = roundMoney(maxSell.amount - correction);
        maxSell.difference = roundMoney(maxSell.difference + correction); // 负数加上正的correction使绝对值变小
      }
    }
  }

  // 过滤掉买入或卖出金额极小（如 0）的动作
  return actions.map(act => {
    if (act.amount <= 0.01) {
      return { ...act, action: 'hold', amount: 0, difference: 0 };
    }
    return act;
  });
};

/**
 * 3. 偏差度检查
 * 计算当前的实际持仓比例，并对比目标比例，检查是否超出阈值偏离界限。
 */
export const checkThresholdDeviation = (
  currentBalances: Record<string, number>,
  targetRatios: Record<string, number>,
  threshold: number
): DeviationDetail[] => {
  const accountIds = Object.keys(targetRatios);
  const totalCurrent = getSumOfValues(currentBalances);

  if (totalCurrent <= 0) {
    return accountIds.map(id => ({
      accountId: id,
      currentRatio: 0,
      targetRatio: targetRatios[id] || 0,
      deviation: roundMoney(-(targetRatios[id] || 0)),
      isOverThreshold: (targetRatios[id] || 0) >= threshold
    }));
  }

  return accountIds.map(id => {
    const current = currentBalances[id] || 0;
    const target = targetRatios[id] || 0;
    const currentRatio = roundMoney((current / totalCurrent) * 100);
    const deviation = roundMoney(currentRatio - target);
    const isOverThreshold = Math.abs(deviation) >= threshold;

    return {
      accountId: id,
      currentRatio,
      targetRatio: target,
      deviation,
      isOverThreshold
    };
  });
};
