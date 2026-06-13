# Architecture: 智能记账本 (Money Tracker)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript 5.8 |
| Build | Vite 6 |
| State | Zustand 5 (persisted to IndexedDB via idb-keyval) |
| Styling | Tailwind CSS 4 + Motion (Framer Motion fork) |
| Charts | Recharts 3 |
| Icons | Lucide React |
| Backend | Firebase Auth + Firestore |
| Mobile | Capacitor 6 (Android) |
| Testing | Vitest + Testing Library + jsdom |

## Project Structure

```
src/
├── main.tsx                 # Entry point: React.StrictMode render
├── App.tsx                  # Root: ErrorBoundary > FirebaseProvider > AppContent
│                            #   Bottom-nav tabs + AnimatePresence page transitions
├── index.css                # Tailwind v4 import, custom utility classes
├── firebase.ts              # Firebase init + Google Auth (web popup + native Capacitor)
├── components/              # 18 components (mostly modals)
│   ├── FirebaseProvider.tsx # Auth state listener, cloud sync orchestration
│   ├── ErrorBoundary.tsx    # Global React error boundary
│   ├── SettingsModal.tsx    # Sync / API keys / Notification settings
│   ├── AddTransactionModal.tsx  # Largest modal (844 lines)
│   ├── AddAccountModal.tsx
│   ├── EditAccountModal.tsx
│   ├── EditBudgetModal.tsx
│   ├── EditCategoryModal.tsx
│   ├── CategoryManagementModal.tsx
│   ├── TransactionDetailModal.tsx
│   ├── TransactionCalendar.tsx
│   ├── AiChatModal.tsx      # AI financial advisor chat
│   ├── GoalModal.tsx
│   ├── TemplateModal.tsx
│   ├── ManageTemplatesModal.tsx
│   ├── Numpad.tsx
│   ├── DonationModal.tsx
│   └── GuideModal.tsx
├── pages/                   # 4 page-level views
│   ├── Dashboard.tsx
│   ├── Transactions.tsx
│   ├── Statistics.tsx
│   └── Accounts.tsx
├── store/                   # Zustand store (split into 6 files)
│   ├── useStore.ts          # Re-export from index.ts
│   ├── index.ts             # Store composition + AppState interface + persist config
│   ├── balanceEngine.ts     # Balance recalculation logic
│   ├── configActions.ts     # Simple setters, API key setters, sync settings
│   ├── entityActions.ts     # CRUD for 6 entities (Transaction/Account/Category/Budget/Template/Goal)
│   └── syncEngine.ts        # syncToCloudNow, pullFromCloud, syncAllData, dedup helpers
├── services/
│   ├── firestoreService.ts  # Firestore CRUD + batch write helpers
│   └── aiService.ts         # DeepSeek (text) + Qwen (vision) AI integration
├── types/
│   └── index.ts             # All TypeScript interfaces
├── lib/
│   └── utils.ts             # cn() classname utility + compressImage()
├── utils/
│   └── icons.ts             # Centralized Lucide icon re-exports (84 icons)
└── test/
    └── setup.ts             # Vitest setup (jest-dom matchers)
```

## Component Tree

```
<App>
  <ErrorBoundary>
    <FirebaseProvider>          ← Auth state + sync listeners
      <AppContent>             ← Tab navigation + page routing
        <NavBar />             ← Bottom tab bar (首页/明细/统计/资产)
        <Page>                 ← React.lazy + Suspense
          <Dashboard />        ← Charts, budget, AI entry
          <Transactions />     ← Transaction list + search/filter
          <Statistics />       ← Pie charts, category breakdown
          <Accounts />         ← Account list + management
        </Page>
        <Modals>               ← AnimatePresence portal
          <AddTransactionModal />
          <SettingsModal />    ← Tabs: 同步/API/通知
          <AiChatModal />
          ...
        </Modals>
      </AppContent>
    </FirebaseProvider>
  </ErrorBoundary>
</App>
```

## Data Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  User Action │────→│  useStore    │────→│  IndexedDB  │
│  (add/edit)  │     │  (action)    │     │  (persist)  │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────▼───────┐
                    │  Firestore   │  (if storageMode==='cloud')
                    │  (sync)      │
                    └──────┬───────┘
                           │
              ┌────────────▼────────────┐
              │  FirebaseProvider       │
              │  onSnapshot listeners   │──→ useStore setters
              └─────────────────────────┘
```

### Sync Architecture

- **Conflict resolution**: Last-Write-Wins (LWW) via `updatedAt` timestamp
- **Bidirectional merge**: download → deduplicate → remap → upload
- **Tombstone mechanism**: Deleted items tracked for 30 days to prevent resurrection
- **Batch writes**: 400 documents per Firestore batch, operations chunked automatically
- **First snapshot**: Timestamp arbitration (remote wins only if newer)
- **Incremental snapshot**: Always accept remote (local pending writes filtered via `hasPendingWrites`)

### Balance Engine

- User manual edits have highest priority — never overridden
- `initialBalance` is an internal anchor: `balance = initialBalance + netEffect`
- When balance doesn't match expected: anchor `initialBalance` to current balance (don't change balance)
- Called after every `syncAllData` and `restoreData`

## AI Services

| Service | Model | Purpose |
|---------|-------|---------|
| `parseOneSentence` | DeepSeek Chat | Natural-language transaction parsing |
| `parseReceiptImage` | Qwen-VL-Max | Receipt image OCR + structured parsing |
| `getAiFinancialAdvice` | DeepSeek Chat | Financial advisor with full context |

API keys are BYOK (Bring Your Own Key), stored locally in IndexedDB.

## Build & Deploy

```bash
# Development
npm run dev                      # Vite dev server on :3000

# Build
npm run build                    # Vite production build → dist/

# Mobile (Android)
npm run cap:sync                 # Build + sync to Android project
cd android && ./gradlew assembleDebug  # Build APK
# Output: android/app/build/outputs/apk/debug/app-debug.apk

# Install to device
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Testing
npm test                         # Vitest
npm run lint                     # tsc --noEmit
```
