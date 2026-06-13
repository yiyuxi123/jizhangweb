# 智能记账本 (Smart Money Tracker)

一个基于 **React + Vite + Zustand + Firebase + Capacitor** 开发的现代、智能、高安全性的个人财务记账应用。支持 Web 网页端与 Android 移动端。

---

## 🌟 核心功能特性

### 1. 📊 多维度财务数据统计与分析
- **智能财务洞察 (AI Insights)**：基于用户的真实账单，AI 助手自动总结消费结构，生成个性化财务优化建议与省钱小妙招。
- **收支分类占比**：美观易用的饼图/列表，直观展示各项日常支出和收入占比，支持点击下钻查看具体流水明细。
- **趋势变化分析**：支持月度、年度维度切换，折线图与柱状图对比分析收支趋势。
- **日均统计自愈**：计算平均每日消费，并支持手动勾选/排除特定大额罕见分类（如房租、保险等），让日均支出更贴近真实水平。
- **资产趋势逆推**：通过账户当前余额与历史交易流水逆推资产轨迹，绘制真实的财富积累曲线。
- **固定 vs 浮动分析**：智能标记或手动配置“固定支出”（如房租、订阅）与“浮动支出”（如餐饮、娱乐），掌握财务弹性。
- **账户资金分布**：直观展示钱包、借记卡、信用卡等各账户的资金水位，防范流动性风险。
- **自定义标签统计**：支持跨分类的标签（如 `#旅行`、`#聚餐`、`#数码`）聚合统计。

### 2. 💼 离散式智能报销管理系统
- **离散式设计**：记账时若勾选“可报销”，该笔支出将**不会**计入您的个人消费总额，避免报销账单导致月度预算失真。
- **一键平账**：收到公司打款时，新增一笔“报销款”收入，系统会自动唤起未报销列表，勾选需要平账的支出账单即可一键完成销账。

### 3. 📅 定期自动入账计划
- 在“资产”页面为特定账户创建“自动入账计划”。适用于每月固定发放的工资、固定支出的房租、公积金或固定订阅服务（如 iCloud 扩容）。
- 设置完成后，系统会在每月的设定日期自动创建交易单据，无需手动补账。

### 4. 🤖 AI 双引擎记账与财务对话 (BYOK)
- **一句话语音/文本记账**：输入或语音输入如：“今天中午用微信付了 35 元麦当劳”，AI 即可全自动提取金额、分类、账户、备注，并在 1 秒内完成入账。
- **拍照/小票截图识别**：上传或拍摄一张纸质发票、收据或电子支付截图，AI 自动识别小票内的商品明细、消费金额，自动关联匹配记账分类。
- **只读式智能财务助手**：直接与 AI 对话，AI 会在**安全只读**的前提下，访问账目数据并提供深度的个性化理财咨询。
- **BYOK 隐私保护 (Bring Your Own Key)**：本应用无任何中转服务器收集密钥，所有的 DeepSeek API 密钥与阿里百炼 API 密钥皆储存在用户设备本地，保障绝对的数据隐私与账户安全。

### 5. 🔄 强一致性多端云同步
- **Google 账号登录**：支持绑定 Google 账号以开启云同步（使用 Cloud Firestore 作为后端，需网络畅通）。
- **去中心化冲突合并**：采用 LWW (Last-Writer-Wins) 与离线墓碑（Tombstones）机制，完美解决离线删除、多设备并发编辑、离线新增后再连网的数据冲突问题。
- **安全性与批量上传**：严格限制上传分块，每次最多 400 个批量操作，规避 Firestore 上限。
- **余额自愈重算**：多端数据同步或恢复备份后，自动在本地重新计算所有账户的历史流水余额，确保账面资产与交易明细的绝对对齐。

### 6. 📦 完整本地备份与数据导出
- **完整 JSON 备份**：支持导出包括账户、交易明细、分类配置、预算设置、快捷模板、存钱目标与删除墓碑在内的完整 JSON 文件。
- **CSV 报表导出**：支持导出账单流水与账户余额为 CSV 表格，方便使用 Excel 进行自定义多维透视与分析。

### 7. 🛡️ 异常防御与高可用
- 引入全局 Error Boundary 错误捕获机制，组件或页面发生意外渲染错误时，展示崩溃详情并提供“复制错误日志”与“刷新应用”按钮，最大程度保障用户录入数据的安全，防止白屏死机。

---

## 🛠️ 开发者指南与本地运行

### 本地环境准备
- **Node.js**: v18.0.0 或更高版本
- **包管理器**: npm

### 1. 安装项目依赖
```bash
npm install
```

### 2. 启动开发服务器
```bash
npm run dev
```
启动后在浏览器打开控制台输出的本地端口（例如 `http://localhost:5173`）即可进行开发调试。

### 3. API 密钥配置 (AI 功能启用)
本应用采用 BYOK（自带密钥）架构：
1. **APP 内配置（推荐）**：启动应用 -> 点击右上角 **系统设置** (Settings) 按钮。
   - 在 **DeepSeek Key** 输入框内填入您的 DeepSeek 官方 API 密钥（获取地址：[DeepSeek API](https://platform.deepseek.com/)），启用一句话记账与财务助手。
   - 在 **Qwen Key** 输入框内填入您的阿里云百炼平台 API 密钥（获取地址：[阿里百炼控制台](https://bailian.console.aliyun.com/)），启用小票截图识别功能。
   - 保存后，密钥将安全地保存在本地 Zustand Persist 存储中。
2. **环境变量默认兜底（选填）**：在根目录下创建 `.env.local` 文件并配置以下变量：
   ```env
   VITE_DEEPSEEK_API_KEY=您的DeepSeek密钥
   VITE_QWEN_API_KEY=您的通义千问密钥
   ```

---

## 📱 Android 端打包与部署 (Capacitor)

应用集成了 Capacitor 框架，支持将 Web 应用直接封装为 Android 原生 APP。

### 1. 构建 Web 前端资源
每次修改 Web 代码后，需要首先生成生产构建产物：
```bash
npm run build
```

### 2. 同步资源至 Android 工程
将前端打包产物及 Capacitor 插件同步到 Android 工程目录：
```bash
npx cap sync android
```

### 3. 构建 Debug APK
在 Windows PowerShell 终端中，您可以指定 JDK 和 Android SDK 路径，然后使用 Gradle 脚本一键构建 APK：
```powershell
$env:JAVA_HOME="E:\as\jbr"
$env:ANDROID_HOME="C:\Users\23818\AppData\Local\Android\Sdk"
cd android
.\gradlew.bat assembleDebug
```
构建成功后的 APK 安装包路径：
`android/app/build/outputs/apk/debug/app-debug.apk`

### 4. 安装至测试机
确保手机已开启 **USB 调试模式** 且通过 ADB 与电脑建立连接（可通过 `adb devices` 查看），运行以下命令安装：
```powershell
$env:ANDROID_HOME="C:\Users\23818\AppData\Local\Android\Sdk"
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s 58f93bd4 install -r "android/app/build/outputs/apk/debug/app-debug.apk"
```

---

## ☁️ Firebase 部署与规则配置

### 1. 密钥与凭证文件
- Web 配置文件引用根目录下的 `firebase-applet-config.json`。
- Android 原生配置文件位于 `android/app/google-services.json`。

### 2. Firestore 安全规则部署 (`firestore.rules`)
请在 Firebase 终端或 Firebase Console 控制台中部署根目录下的 [firestore.rules](firestore.rules) 安全规则，它为应用提供了：
- 基于 `request.auth.uid` 的细粒度数据隔离与所有权保护。
- 新增/更新交易流水时的字段校验（包含类型、数值范围与字符长度限制）。
- 限制 `image`（Base64 编码的小票/收据图片）字段的大小以防御存储资源滥用。

---

## 📄 许可证
本软件仅供个人理财记账及 AI 辅助财务分析的交流与学习，严禁用于任何商业目的。
