# 多語言支援使用指南

本系統已實作完整的多語言支援（i18n），支援繁體中文（預設）和英文。

## 架構說明

### 核心文件
- `/src/contexts/i18n-context.tsx` - i18n Context 和 Hook
- `/src/locales/zh-TW.ts` - 繁體中文翻譯
- `/src/locales/en.ts` - 英文翻譯
- `/src/components/common/LanguageSwitcher.tsx` - 語言切換器

### 已完成的頁面
✅ Layout & Sidebar - 導航選單、版本資訊
✅ 首頁 - 主要標題和卡片
✅ NPC 主頁 - 模板和實例導航

### 如何在頁面中使用

#### 1. 在頁面組件中加入 `'use client'`
```tsx
'use client';
```

#### 2. Import useI18n hook
```tsx
import { useI18n } from '@/contexts/i18n-context';
```

#### 3. 在組件中使用
```tsx
export default function MyPage() {
  const { t } = useI18n();

  return (
    <div>
      <h1>{t('my.translation.key')}</h1>
    </div>
  );
}
```

## 添加新翻譯

### 1. 在 `/src/locales/zh-TW.ts` 添加繁中
```typescript
export default {
  // ...existing translations
  'my.new.key': '我的新文字',
} as const;
```

### 2. 在 `/src/locales/en.ts` 添加英文
```typescript
export default {
  // ...existing translations
  'my.new.key': 'My New Text',
} as const;
```

## 翻譯命名規範

使用點記法組織翻譯 key：
- `common.*` - 通用 UI 元素（按鈕、標籤）
- `nav.*` - 導航相關
- `home.*` - 首頁
- `item.*` - 道具管理
- `npc.*` - NPC 管理
- `error.*` - 錯誤訊息
- `success.*` - 成功訊息

## 注意事項

1. **表格內容不翻譯** - Firebase 動態內容（道具名稱、NPC 名稱等）維持原樣
2. **UI 文字需翻譯** - 所有按鈕、標題、標籤、提示訊息等固定 UI 文字都應翻譯
3. **預設語言** - 繁體中文 (zh-TW)
4. **儲存位置** - 語言偏好儲存在 localStorage，跨 session 保持

## 語言切換

用戶可以點擊：
- 桌面版：Sidebar 底部的語言切換按鈕
- 手機版：頂部標題欄的語言切換按鈕

切換後立即生效，無需重新載入頁面。
