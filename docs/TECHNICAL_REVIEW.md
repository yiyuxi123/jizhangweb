# 智能记账本 — 技术评审文档

> 面向 AI/人工评审的完整技术文档。涵盖架构、数据流、安全、测试、部署。

---

## 1. 项目概览

| 属性 | 值 |
|------|-----|
| **名称** | 智能记账本 (Money Tracker) |
| **仓库** | https://github.com/yiyuxi123/jizhangweb |
| **技术栈** | React 19 + TypeScript 5.8 + Vite 6 + Zustand 5 + Tailwind CSS 4 + Firebase + Capacitor 6 |
| **目标平台** | Web (PWA) + Android (Capacitor APK) |
| **代码规模** | ~8500 行 TypeScript/TSX，30+ 源文件 |
| **测试** | 14 单元测试 (Vitest)，0 E2E |
| **CI/CD** | GitHub Actions (type-check → test → build-web → build-apk) |

---

## 2. 目录结构

```
src/
├── main.tsx                    # 入口：I18nProvider > StrictMode > App
├── App.tsx                     # 根组件：ErrorBoundary > FirebaseProvider > AppContent
│                               #   底部4标签导航 + AnimatePresence + React.lazy 懒加载
├── index.css                   # Tailwind v4 + @custom-variant dark
├── vite-env.d.ts               # Vite 类型声明
├── firebase.ts                 # Firebase 初始化 + Google Auth
│
├── pages/                      # 4 个页面（全部 React.lazy 懒加载）
│   ├── Dashboard.tsx           # 首页：收支概览、预算进度、AI 入口
│   ├── Transactions.tsx        # 交易列表：搜索、筛选、批量操作、CSV 导出
│   ├── Statistics.tsx          # 统计图表：分类饼图、月度趋势
│   └── Accounts.tsx            # 资产管理：账户列表、设置入口、数据备份
│
├── components/                 # 18 个组件
│   ├── FirebaseProvider.tsx    # 认证状态监听 + Firestore 实时同步 + 离线检测
│   ├── ErrorBoundary.tsx       # 全局错误边界（类组件）
│   ├── SettingsModal.tsx       # 设置弹窗（4 标签：同步/API/通知/外观）
│   ├── AddTransactionModal.tsx # 记账弹窗（844 行，最复杂组件）
│   ├── AiChatModal.tsx         # AI 理财顾问聊天
│   ├── TransactionCalendar.tsx # 日历视图
│   └── ...                     # 其余 12 个模态组件
│
├── store/                      # Zustand 状态管理（6 文件模块化）
│   ├── useStore.ts             # 重导出入口（保持导入路径兼容）
│   ├── index.ts                # 主 Store：AppState 接口 + create() + persist 配置
│   ├── balanceEngine.ts        # 余额重算引擎（纯函数 + zustand action）
│   ├── configActions.ts        # 简单 setter + API Key setter + 同步设置
│   ├── entityActions.ts        # 6 实体 CRUD（Transaction/Account/Category/Budget/Template/Goal）
│   └── syncEngine.ts           # 双向同步引擎（下载→去重→映射→上传 + 墓碑清理）
│
├── services/
│   ├── firestoreService.ts     # Firestore CRUD 封装（批量写入、余额同步、报销链）
│   └── aiService.ts            # DeepSeek Chat + Qwen-VL-Max 集成（BYOK）
│
├── i18n/                       # 国际化基础
│   ├── index.ts                # 桶导出
│   ├── I18nContext.tsx          # React Context（locale + t() + setLocale）
│   └── locales/
│       ├── zh-CN.ts            # 中文语言包（~80 keys）
│       └── en.ts               # 英文语言包
│
├── lib/
│   ├── utils.ts                # cn() classname 合并 + compressImage()
│   └── crypto.ts               # Web Crypto API 加密工具（AES-GCM + PBKDF2）
│
├── types/
│   └── index.ts                # 所有 TypeScript 类型定义
│
└── test/
    └── setup.ts                # Vitest + jest-dom 配置
```

---

## 3. 组件树

```
<I18nProvider>
  <ErrorBoundary>
    <FirebaseProvider>              ← Auth 状态 + onSnapshot 监听
      <AppContent>                 ← 标签导航
        <nav>                      ← 底部导航栏（首页/明细/统计/资产）
          <NavItem /> ×4
        </nav>
        <main>
          <Suspense fallback={<PageFallback />}>
            <Dashboard />          ← React.lazy
            <Transactions />       ← React.lazy
            <Statistics />         ← React.lazy
            <Accounts />           ← React.lazy
          </Suspense>
        </main>
        <AnimatePresence>
          <AddTransactionModal />  ← React.lazy
          <SettingsModal />        ← 标签：同步/API/通知/外观
          <AiChatModal />
          <GoalModal />
          <TemplateModal />
          ... (其余模态)
        </AnimatePresence>
      </AppContent>
    </FirebaseProvider>
  </ErrorBoundary>
</I18nProvider>
```

---

## 4. 数据流架构

```
┌──────────────┐
│  User Action │  (点击、输入、滑动)
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│              useStore (Zustand)               │
│                                              │
│  ┌──────────────┐  ┌───────────────────────┐ │
│  │ entityActions │  │   syncEngine          │ │
│  │ (CRUD)        │  │   (双向同步)           │ │
│  │              │  │                       │ │
│  │ addTx()      │  │ syncAllData()         │ │
│  │ updateAcct() │──│   ├─ 下载合并          │ │
│  │ deleteCat()  │  │   ├─ 去重映射          │ │
│  │ ...          │  │   ├─ 余额校正          │ │
│  └──────┬───────┘  │   └─ 上传删除          │ │
│         │          └───────────────────────┘ │
│         │                      │             │
│         ▼                      ▼             │
│  ┌──────────────┐  ┌───────────────────────┐ │
│  │ IndexedDB    │  │   Firestore           │ │
│  │ (idb-keyval) │  │   (云端持久化)         │ │
│  └──────────────┘  └───────────────────────┘ │
└──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│           FirebaseProvider                    │
│                                              │
│  onAuthStateChanged()  ← 认证状态             │
│  onSnapshot() ×6       ← 实时监听 6 集合       │
│  visibilitychange      ← 前台同步触发          │
│  online event          ← 网络恢复触发          │
└──────────────────────────────────────────────┘
```

### 同步冲突解决

- **策略**：Last-Write-Wins (LWW)，基于 `updatedAt` 时间戳
- **首次快照**：时间戳仲裁（远程仅在新于本地时覆盖）
- **增量快照**：始终接受远程（本地待写通过 `hasPendingWrites` 过滤）
- **墓碑机制**：删除项追踪 30 天，防止复活
- **批量写入**：400 文档/批，自动分片

### 余额引擎

```
balance = initialBalance + netEffect

netEffect = Σ(收入) - Σ(支出) + Σ(转入) - Σ(转出)

用户手动修改余额时：
  initialBalance = newBalance - netEffect  ← 锚定，绝不覆盖余额

自动校正时：
  initialBalance = currentBalance - netEffect  ← 以余额为准
```

---

## 5. 安全架构

| 层级 | 措施 |
|------|------|
| **认证** | Firebase Auth (Google OAuth)，支持 Capacitor 原生插件 |
| **数据隔离** | Firestore 安全规则：`request.auth.uid == userId` |
| **API Key** | BYOK 模式，仅存 IndexedDB（**不同步到云端**），Web Crypto 加密模块就绪 |
| **传输** | HTTPS (Firestore SDK) |
| **输入** | Firestore 规则验证字段类型、图片大小限制 |
| **客户端** | ErrorBoundary 全局捕获、TypeScript 严格模式 |

---

## 6. AI 服务集成

| 函数 | 模型 | 用途 |
|------|------|------|
| `parseOneSentence()` | DeepSeek Chat | 自然语言解析 → 结构化交易 |
| `parseReceiptImage()` | Qwen-VL-Max | 小票 OCR → 结构化交易 |
| `getAiFinancialAdvice()` | DeepSeek Chat | 全上下文理财顾问 |

API Key 从 store 读取（用户自行配置），fallback 到 `import.meta.env.VITE_*_API_KEY`。

---

## 7. 性能优化

| 优化 | 实现 |
|------|------|
| **代码分割** | React.lazy + Suspense（4 页面 + 3 重模态） |
| **主 bundle** | 890 KB（从 1550 KB 减 43%） |
| **虚拟滚动** | @tanstack/react-virtual 就绪 |
| **PWA** | vite-plugin-pwa（条件启用，Capacitor 构建禁用） |
| **离线优先** | IndexedDB 本地持久化，自动降级离线模式 |
| **深色模式** | Tailwind v4 class-based，22 组件全覆盖 |

---

## 8. 测试

### 现有测试（14 个）

```
src/lib/__tests__/utils.test.ts        # cn() 5 tests + compressImage 2 tests
src/store/__tests__/balanceEngine.test.ts  # computeNetEffect 7 tests
```

### 测试覆盖缺口

- [ ] `syncEngine` 去重逻辑（dedupCategories/Accounts/Budgets/Templates/Goals）
- [ ] `entityActions` CRUD 流程
- [ ] `I18nContext` t() 函数
- [ ] E2E 测试（Playwright/Cypress）
- [ ] 边界用例：断网连续修改 → 恢复网络同步

---

## 9. CI/CD

```yaml
.github/workflows/ci.yml:
  type-check → build-web + test → build-android-apk
  - Node 20, ubuntu-latest
  - JDK 17 (Temurin)
  - Android SDK 36
  - APK artifact 上传
```

---

## 10. 已知限制 & 改进路线图

| 优先级 | 项目 | 状态 |
|--------|------|------|
| P0 | E2E 测试 | 未开始 |
| P1 | Web Crypto 加密落地到 IndexedDB 存储层 | 模块就绪，未集成 |
| P1 | 全组件无障碍审计 | 基础完成，深层待做 |
| P1 | 事务列表完整虚拟滚动 | 库已安装，待集成 |
| P2 | iOS 适配 | 项目存在，未测试 |
| P2 | 深色模式自动跟随系统 | 已实现（system 选项） |
| P3 | 数据导出/导入 UI 优化 | 基本可用 |
| P3 | 多设备冲突可视化 | 未开始 |

---

## 11. 本地开发

```bash
# 安装
npm install

# 开发
npm run dev          # Vite :3000

# 测试
npm test             # Vitest
npm run lint         # tsc --noEmit

# 构建
npm run build        # Vite → dist/
npm run cap:sync     # + Capacitor sync

# Android APK
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk

# 安装到设备
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 12. 环境变量

| 变量 | 用途 |
|------|------|
| `VITE_DEEPSEEK_API_KEY` | DeepSeek API Key（可选，优先使用 UI 输入） |
| `VITE_QWEN_API_KEY` | Qwen API Key（可选） |
| `VITE_PWA` | 启用 PWA 插件（仅 Web 部署设为 `true`） |
| `GEMINI_API_KEY` | （遗留）Google AI Studio 环境 |

---

*文档生成于 2026-06-14，随代码库持续更新。*
