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
  const prompt = `你是一个专业的记账助手。请解析用户的记账句子，并提取为结构化的 JSON 数据。

【上下文信息】
- 当前时间: ${currentTime} (请以此计算相对日期如“昨天”、“大前天”、“上周五”)
- 已有的账单分类 (Categories):
${JSON.stringify(categories.map(c => ({ id: c.id, name: c.name, type: c.type })))}
- 已有的账户列表 (Accounts):
${JSON.stringify(accounts.map(a => ({ id: a.id, name: a.name, type: a.type })))}

【解析规则】
1. 分析交易类型: 支出 (expense)、收入 (income) 或是账户间转账 (transfer)。
2. 提取交易金额: 必须是正数。
3. 关联已有分类: 根据内容匹配最契合的分类，返回 categoryId。如果无匹配，且类型不是转账，请在 suggestedCategoryName 中返回推荐的新分类名称。
4. 关联已有账户: 
   - 支出 (expense): 匹配付款账户，返回 fromAccountId (如匹配到“支付宝”则使用对应的支付宝账户ID)。
   - 收入 (income): 匹配收款账户，返回 toAccountId。
   - 转账 (transfer): 匹配转出账户 (fromAccountId) 和转入账户 (toAccountId)。
5. 提取日期: 解析“昨天”、“刚才”等时间词，转化为 ISO 8601 本地时间字符串。若未提及，默认使用当前时间。
6. 提取备注 (note): 简要记录消费内容/项目。
7. 提取标签 (tags): 提取 1-2 个交易标签，如“午餐”、“打车”、“购物”。

【返回格式】
你必须且只能返回一个合法的 JSON 字符串，不要包含 Markdown 标记（如 \`\`\`json），不能包含任何额外说明。
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

  const prompt = `你是一个专业的记账小票/账单截图智能识别助手。请分析上传的交易图片，将其提取并转换为结构化的 JSON 数据。

【上下文信息】
- 当前时间: ${currentTime}
- 已有的账单分类 (Categories):
${JSON.stringify(categories.map(c => ({ id: c.id, name: c.name, type: c.type })))}
- 已有的账户列表 (Accounts):
${JSON.stringify(accounts.map(a => ({ id: a.id, name: a.name, type: a.type })))}

【解析规则】
1. 从图片（账单小票、交易截图或发票）中识别出交易金额（必须为正数）。
2. 识别交易类型 (expense/income/transfer)。大多数支付截图为支出 (expense)。
3. 根据交易内容，匹配最契合的已有分类 ID (categoryId)，或推荐新分类名称 (suggestedCategoryName)。
4. 识别所涉及的付款账户。若微信支付截图则匹配“微信”账户的ID并返回为 fromAccountId，若是支付宝则匹配“支付宝”返回。
5. 识别交易时间，转换为 ISO 8601 本地时间字符串。若图片中无时间或无法识别，默认为当前时间。
6. 自动提炼出一句话备注 (note)，描述购买的商品、商户或服务。
7. 提取 1-2 个标签 (tags) 数组。

【返回格式】
你必须且只能返回一个合法的 JSON 字符串，不要包含 Markdown 标记（如 \`\`\`json）。
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
