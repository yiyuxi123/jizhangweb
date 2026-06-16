import { Account, Category, Transaction, Budget } from '../types';
import { useStore } from '../store/useStore';

function getDeepSeekKey(): string {
  const storeKey = useStore.getState().deepseekApiKey;
  if (storeKey && storeKey.trim()) return storeKey.trim();
  const envKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
  if (envKey && envKey.trim()) return envKey.trim();
  throw new Error('MISSING_API_KEY_DEEPSEEK');
}

function getQwenKey(): string {
  const storeKey = useStore.getState().qwenApiKey;
  if (storeKey && storeKey.trim()) return storeKey.trim();
  const envKey = import.meta.env.VITE_QWEN_API_KEY;
  if (envKey && envKey.trim()) return envKey.trim();
  throw new Error('MISSING_API_KEY_QWEN');
}

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

export interface ParseResult {
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  categoryId?: string | null;
  suggestedCategoryName?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  note: string;
  tags?: string[];
  date: string;
}

// 1. One-Sentence Bookkeeping Parser via DeepSeek
export async function parseOneSentence(
  text: string,
  accounts: Account[],
  categories: Category[]
): Promise<ParseResult> {
  const currentTime = new Date().toISOString();
  const prompt = `你是一个极度专业且严谨的一句话记账智能解析助手。请分析用户的记账语句，将其提取为最规整、精确且简洁 of JSON 数据。

【上下文信息】
- 当前参考时间: ${currentTime} (请以此精确计算相对日期如“昨天”、“前天”、“上周五”)
- 系统已有账单分类 (Categories):
${JSON.stringify(categories.map(c => ({ id: c.id, name: c.name, type: c.type })))}
- 系统已有账户列表 (Accounts):
${JSON.stringify(accounts.map(a => ({ id: a.id, name: a.name, type: a.type })))}

【核心解析规则】
1. **交易金额解析**: 提取精确的交易数值 (正数 Float)。例如：“花了一百二”解析为 120。
2. **交易类型判定**:
   - 支出: expense (购买、给钱、消费等大多数日常交易)
   - 收入: income (发工资、奖金、退款等)
   - 转账: transfer (如“微信转到支付宝”，“招行转入余额宝”，资金在自己的两个账户间转移)
3. **账户精准匹配**:
   - 寻找语句中提及的账户词汇 (微信、支付宝、现金、招行等)。
   - 优先比对并返回系统已有的对应账户 ID 为 "fromAccountId" (转出账户) 或 "toAccountId" (转入账户)。若为非转账支出，仅填 fromAccountId；非转账收入，仅填 toAccountId。
   - 若未明示账户，默认按常识匹配：如提及“微信吃火锅”匹配“微信”账户；如完全无法推断，返回 null。
4. **分类精准关联**:
   - 对比系统已有的分类，返回最匹配的 "categoryId"。
   - 若无匹配分类且非转账，在 "suggestedCategoryName" 中返回一个最合适的新分类名 (1-4字，如“社交”、“零食”、“数码”，分类名应具有普适性)。
5. **交易日期规范化**:
   - 将“昨天”、“刚才”、“上周”等口语转化为标准 ISO 8601 本地时间格式 (如: "2026-06-13T12:00:00")。若未提及，默认使用当前参考时间的日期，时间设为 12:00:00。
6. **备注提炼 (极度规整、简洁)**:
   - 提炼一个极简、干净的备注 (note)。格式为：只记录主旨的核心消费主体。
   - ⚠️ 绝对禁止包含：时间词 (昨天、中午、刚才等)、支付渠道 (微信、支付宝等)、金额数字 (15元、一百等)、消费动作动词 (买、花、付、充值、去等)。
   - ⚠️ 示例对比：
     - 用户输入: "昨天微信买了20块钱快餐" -> 备注 (note): "快餐" (❌ 错误备注: "微信买快餐", "买了20元快餐")
     - 用户输入: "打车去火车站花了18" -> 备注 (note): "打车" 或 "火车站" (❌ 错误备注: "打车去火车站")
     - 用户输入: "发了3000元工资" -> 备注 (note): "工资" (❌ 错误备注: "发工资")
     - 若完全没有备注且无法提炼，默认使用匹配到的分类名。
7. **标签提取 (Tags)**:
   - 提取 1-2 个精确标签数组，如 ["晚餐"] 或 ["出行"] 等。标签名应该是简洁的 1-4 字。

【Few-Shot 示例】
输入: "昨天下午用微信付了 35 元麦当劳，带聚餐标签"
输出 JSON:
{
  "type": "expense",
  "amount": 35,
  "categoryId": "cat-1",
  "suggestedCategoryName": null,
  "fromAccountId": "acc-3",
  "toAccountId": null,
  "note": "麦当劳",
  "tags": ["聚餐"],
  "date": "2026-06-13T15:00:00"
}

【返回格式】
你必须且只能返回一个合法的 JSON 字符串，不要包含 Markdown 标记 (如 \`\`\`json)，且无任何解释性说明。
JSON 格式：
{
  "type": "expense" | "income" | "transfer",
  "amount": number,
  "categoryId": string | null,
  "suggestedCategoryName": string | null,
  "fromAccountId": string | null,
  "toAccountId": string | null,
  "note": string,
  "tags": string[],
  "date": string
}`;

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getDeepSeekKey()}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that outputs only raw JSON.' },
          { role: 'user', content: prompt + `\n\n用户记账输入: "${text}"` }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API returned status ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    return JSON.parse(content) as ParseResult;
  } catch (error) {
    console.error('Failed to parse one sentence via DeepSeek:', error);
    throw error;
  }
}

// 2. Receipt / Image Bookkeeping Parser via Qwen Vision
export async function parseReceiptImage(
  base64Image: string, // Full data URL or pure base64 (we will format it to full data URL)
  accounts: Account[],
  categories: Category[]
): Promise<ParseResult> {
  const currentTime = new Date().toISOString();
  
  // Format base64 if not already a data URL
  let imageUrl = base64Image;
  if (!base64Image.startsWith('data:')) {
    imageUrl = `data:image/jpeg;base64,${base64Image}`;
  }

  const prompt = `你是一个顶级记账小票与账单截图智能识别助手。请对上传的图片（发票、小票、支付截图等）进行深度的 OCR 及语义解析，转化为高度精确的记账 JSON 数据。

【上下文信息】
- 当前参考时间: ${currentTime} (以此判断小票上的相对时间或缺省年份)
- 系统已有账单分类 (Categories):
${JSON.stringify(categories.map(c => ({ id: c.id, name: c.name, type: c.type })))}
- 系统已有账户列表 (Accounts):
${JSON.stringify(accounts.map(a => ({ id: a.id, name: a.name, type: a.type })))}

【核心解析规则】
1. **交易金额解析 (实付第一)**:
   - 必须提取**实际支付金额 (实付金额/应付/支付金额/Total/扣款金额)**。
   - ⚠️ 绝对忽略: 优惠前原价、折扣小计、找零金额、起送价或单价。
   - 金额必须为正数 (Float)。退款交易应判定为 "income"。
2. **交易类型判定**:
   - 支出: expense (购买、外卖、打车、缴费、购物小票、付款截图等)
   - 收入: income (退款、工资、微信/支付宝收款截图等)
   - 转账: transfer (自己在微信、支付宝、银行卡之间腾转的账单)
3. **账户匹配 (精准映射)**:
   - 细致寻找图片中有关支付渠道的文字 (如：微信支付、微信红包、支付宝、Alipay、中国银行、招商银行、微信转账等)。
   - 对齐系统已有的账户，若有高度匹配项，返回对应的账户 ID (支出填入 "fromAccountId"，收入填入 "toAccountId"，转账两端皆填)。
   - 微信支付优先匹配名字包含“微信”的账户；支付宝优先匹配名字包含“支付宝”的账户。若未归入，返回 null。
4. **分类匹配 (就近匹配与归类)**:
   - 根据小票商户名称或商品内容，关联系统已有分类 ID。
   - 若系统内无合适分类，且非转账，在 "suggestedCategoryName" 中返回一个最合适的分类名称 (如“餐饮”、“超市”、“出行”、“零食”，1-4字，简明规整)。
5. **交易时间提取**:
   - 从图片中寻找交易日期与时间。
   - 统一转换为标准的 ISO 8601 本地时间字符串 (例如: "2026-06-13T15:30:00")。
   - 若只有月日时分 (如“06-13 15:30”)，使用当前参考时间的年份补齐。若无任何日期时间，默认使用当前参考时间。
6. **备注汇总 (极简、规整、简洁)**:
   - 提炼一个极简、规整的备注，格式必须为: \`[商户/品牌名] [主要商品分类/购买核心内容]\`。
   - ⚠️ 绝对禁止罗列所有商品的繁琐明细清单！
   - ⚠️ 示例对比：
     - 超市小票，买了可乐、薯片、洗头水。 -> 备注 (note): "永辉超市: 零食百货"
     - 滴滴打车账单。 -> 备注 (note): "滴滴出行: 打车支出"
     - 麦当劳就餐账单。 -> 备注 (note): "麦当劳: 餐饮"
7. **标签聚合 (Tags)**:
   - 提取 1-2 个代表交易情境的极简标签 (如：“午餐”、“超市”、“出行”、“日常”、“数码”)。

【返回格式】
你必须且只能返回一个合法的 JSON 字符串，绝不能包含 Markdown 标记 (如 \`\`\`json)，且无任何解释性说明文字。
JSON 结构：
{
  "type": "expense" | "income" | "transfer",
  "amount": number,
  "categoryId": string | null,
  "suggestedCategoryName": string | null,
  "fromAccountId": string | null,
  "toAccountId": string | null,
  "note": string,
  "tags": string[],
  "date": string
}`;

  try {
    const response = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getQwenKey()}`
      },
      body: JSON.stringify({
        model: 'qwen-vl-max',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`Qwen Vision API returned status ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    // Sometimes models still return markdown blocks, strip them if present
    let jsonStr = content;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    }
    
    return JSON.parse(jsonStr) as ParseResult;
  } catch (error) {
    console.error('Failed to parse receipt image via Qwen-VL:', error);
    throw error;
  }
}

// 3. AI Financial Advisor Chat via DeepSeek
export async function getAiFinancialAdvice(
  chatHistory: { role: 'user' | 'assistant'; content: string }[],
  transactions: Transaction[],
  accounts: Account[],
  budgets: Budget[],
  categories: Category[]
): Promise<string> {
  // Construct financial summary context for the LLM
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalAssets = accounts.filter(a => a.balance > 0).reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = accounts.filter(a => a.balance < 0).reduce((sum, a) => sum + Math.abs(a.balance), 0);
  
  // Calculate this month's stats
  const now = new Date();
  const currentMonthTxs = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  
  const monthlyExpense = currentMonthTxs
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const monthlyIncome = currentMonthTxs
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  // Group current month spending by category
  const expenseByCategory: Record<string, number> = {};
  currentMonthTxs.filter(t => t.type === 'expense').forEach(t => {
    const catName = categories.find(c => c.id === t.categoryId)?.name || '未分类';
    expenseByCategory[catName] = (expenseByCategory[catName] || 0) + t.amount;
  });

  const categorySpendingStr = Object.entries(expenseByCategory)
    .map(([cat, amt]) => `${cat}: ¥${amt.toFixed(2)}`)
    .join(', ');

  // Get budgets status
  const totalBudget = budgets.find(b => !b.categoryId)?.amount || 0;
  const budgetRemaining = totalBudget - monthlyExpense;

  const systemInstructions = `你是一个非常专业、幽默且贴心的 AI 财务分析助手。你正在为一个记账 App 的用户提供个性化的理财建议。
以下是该用户的真实资产与本月账单数据上下文：

【用户财务数据】
- 净资产: ¥${totalBalance.toFixed(2)} (总资产: ¥${totalAssets.toFixed(2)}, 总负债: ¥${totalLiabilities.toFixed(2)})
- 本月总收入: ¥${monthlyIncome.toFixed(2)}
- 本月总支出: ¥${monthlyExpense.toFixed(2)}
- 本月剩余总预算: ¥${budgetRemaining.toFixed(2)} (总预算: ¥${totalBudget.toFixed(2)})
- 本月各品类支出分布: ${categorySpendingStr || '暂无消费数据'}
- 最近10笔交易明细:
${transactions.slice(0, 10).map(t => {
  const cat = categories.find(c => c.id === t.categoryId)?.name || '转账';
  return `- [${t.date.split('T')[0]}] ${t.type === 'expense' ? '支出' : t.type === 'income' ? '收入' : '转账'} ¥${t.amount} (${cat}) 备注: ${t.note || '无'}`;
}).join('\n')}

【你的职责】
1. 深入分析用户的收支分布，诊断哪些开销可以削减，并给予科学实用的储蓄或理财建议。
2. 语气要温暖、真诚，偶尔可以带点幽默，不要表现得过于机械呆板。
3. 当用户询问具体开支问题（例如：“我最近买了什么？”、“分析我的消费趋势”），利用上述提供的交易和预算明细进行精准、详细的回答，甚至可以使用简单的 Markdown 表格呈现数据。
4. 只能回答财务、记账、消费、省钱和资产规划相关的问题，若用户闲聊其他无关话题，请委婉地引导他们回到财务理财上。`;

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getDeepSeekKey()}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemInstructions },
          ...chatHistory.map(h => ({ role: h.role, content: h.content }))
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API returned status ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim() as string;
  } catch (error) {
    console.error('Failed to get AI financial advice:', error);
    return '抱歉，我现在无法连接到 AI 助手。请检查您的网络连接或稍后再试。';
  }
}

/**
 * 4. AI Rebalancing Advisor via DeepSeek
 */
export async function getRebalanceAdvice(
  currentBalances: { name: string; balance: number; currentRatio: number; targetRatio: number; deviation: number }[],
  strategy: 'dynamic' | 'periodic' | 'threshold',
  strategyParams: { newFunds?: number; thresholdValue?: number; actions?: { name: string; action: string; amount: number }[] }
): Promise<string> {
  const strategyLabel = {
    dynamic: '动态再平衡 (增量注入)',
    periodic: '定期再平衡 (一键配平)',
    threshold: '阈值再平衡 (纪律监控)'
  }[strategy];

  let strategyDetails = '';
  if (strategy === 'dynamic') {
    strategyDetails = `准备追加的增量资金: ¥${strategyParams.newFunds || 0}\n系统算出的分配指南: \n` + 
      (strategyParams.actions || []).map(a => `- 为 [${a.name}] 分配新钱: ¥${a.amount}`).join('\n');
  } else if (strategy === 'periodic') {
    strategyDetails = `系统算出的存量配平方案: \n` + 
      (strategyParams.actions || []).map(a => {
        if (a.action === 'buy') return `- 【买入】[${a.name}] 金额: ¥${a.amount}`;
        if (a.action === 'sell') return `- 【卖出】[${a.name}] 金额: ¥${a.amount}`;
        return `- [${a.name}] 保持现状`;
      }).join('\n');
  } else if (strategy === 'threshold') {
    strategyDetails = `设定的偏离度报警阈值: ${strategyParams.thresholdValue || 5}%\n当前超出或接近该阈值的理财账户情况见持仓列表。`;
  }

  const listStr = currentBalances.map(b => 
    `- 账户 [${b.name}]: 当前余额 ¥${b.balance.toFixed(2)} | 实际占比 ${b.currentRatio}% | 目标占比 ${b.targetRatio}% | 绝对偏离度 ${b.deviation > 0 ? '+' : ''}${b.deviation}%`
  ).join('\n');

  const systemInstructions = `你是一个纪律严明的量化投资顾问。你的核心投资心法是“反人性”的资产再平衡（高抛低吸、遵守规则、冷冰冰且逻辑清晰）。
请根据用户提供的投资占比数据和所选择的调仓方案，生成一份情绪稳定、逻辑严密、极其精炼的调仓分析报告。

【当前参考时间】
${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}

【用户当前理财账户持仓详情】
${listStr}

【选择的调仓方案】
方案名称：${strategyLabel}
操作详情：
${strategyDetails}

【你的职责】
1. 当前偏离情况分析：以极其简炼的语言诊断当前的账户偏差（不超过2句话，指出偏离最严重的资产）。
2. 调仓方案解释与执行：用极简短的 Markdown 列表直接给出核心动作建议，帮助用户理清这套调仓方案背后的算路逻辑，避免长篇大论。
3. 纪律性心理辅导：简单阐述为什么在市场波动时做到“反人性”（克服恐惧买入低位，克服贪婪卖出高位）是长期盈利的关键。
4. 总体篇幅控制：整篇报告【必须控制在 300 字以内】，重点突出，直接给出行动建议和原因，绝不包含任何套话或多余的解释。请直接输出 Markdown 内容。`;

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getDeepSeekKey()}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemInstructions },
          { role: 'user', content: '请根据我的财务数据，为我生成一份详细的资产再平衡调仓建议报告。' }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API returned status ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim() as string;
  } catch (error) {
    console.error('Failed to get rebalance advice via DeepSeek:', error);
    return '抱歉，我现在无法连接到 AI 助手。请检查您的网络连接并确保您已在“设置”中配置了有效的 DeepSeek API Key。';
  }
}

