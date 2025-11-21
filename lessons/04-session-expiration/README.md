# Lesson 04: セッションの有効期限管理

## 📋 概要

このレッスンでは、セッションのライフサイクル管理を学びます。絶対有効期限、相対有効期限、アイドルタイムアウトなど、様々な有効期限管理の手法を実装します。

## 🎯 学習目標

- 有効期限管理の重要性を理解する
- 絶対有効期限と相対有効期限の違いを学ぶ
- アイドルタイムアウトの実装方法を習得する
- セッションの更新戦略を理解する

## 🔍 有効期限管理とは？

**セッションの有効期限管理**は、セキュリティとユーザーエクスペリエンスのバランスを取る重要な機能です。

### 有効期限管理の種類

#### 1. 絶対有効期限（Absolute Expiration）

```javascript
// ログインから24時間後に強制的に期限切れ
const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
req.session.expiresAt = expiresAt;

// 時間になったら、一切の操作を受け付けない
```

**ユースケース**:
- 高セキュリティが求められるサイト（銀行、医療）
- 一時的なアクセス権の付与
- セキュリティトークン

#### 2. 相対有効期限（Sliding Expiration）

```javascript
// 最後のアクセスから30分間有効
const maxIdleTime = 30 * 60 * 1000;
req.session.lastAccess = Date.now();

// アクセスがあるたびに延長される
```

**ユースケース**:
- 一般的な Web アプリケーション
- SNS、EC サイト
- ユーザーフレンドリーな体験

#### 3. ハイブリッド（両方の組み合わせ）

```javascript
// 最後のアクセスから30分 かつ ログインから12時間以内
const idleTimeout = 30 * 60 * 1000;
const absoluteTimeout = 12 * 60 * 60 * 1000;

req.session.lastAccess = Date.now();
req.session.loginAt = Date.now();
```

**ユースケース**:
- セキュリティとUXのバランスが重要な場合
- 企業向けアプリケーション

## 🔧 技術的原理

### アイドルタイムアウトの仕組み

```
時刻:       0:00    0:10    0:20    0:30    0:40    0:50
           │       │       │       │       │       │
ユーザー: ログイン  操作    操作    ─────   操作    ─────
           │       │       │       │       │       │
有効期限:  0:30    0:40    0:50    1:00    1:10    1:20
           └───────┴───────┴───────┴───────┴───────┘
                 アクセスごとに30分延長

時刻:      1:20    1:30    1:40    1:50
           │       │       │       │
ユーザー:  ─────   ─────   ─────   操作（失敗）
           │       │       │       │
有効期限:  1:50    期限切れ
           │       X
           └───────┘
           30分間操作なし → セッション期限切れ
```

### 実装パターン

#### パターン1: クッキーの Max-Age を使用

```javascript
// シンプルだが柔軟性が低い
res.cookie('sessionId', sessionId, {
  maxAge: 30 * 60 * 1000 // 30分
});
```

#### パターン2: セッションデータで管理

```javascript
// 柔軟性が高い
req.session.expiresAt = Date.now() + 30 * 60 * 1000;

// ミドルウェアでチェック
if (Date.now() > req.session.expiresAt) {
  // 期限切れ
  req.session = null;
}
```

#### パターン3: 複合的な管理

```javascript
req.session.loginAt = Date.now();
req.session.lastAccess = Date.now();
req.session.absoluteExpiry = Date.now() + 12 * 60 * 60 * 1000;
req.session.idleTimeout = 30 * 60 * 1000;

// チェック
const now = Date.now();
const idleTime = now - req.session.lastAccess;

if (now > req.session.absoluteExpiry) {
  // 絶対有効期限切れ
} else if (idleTime > req.session.idleTimeout) {
  // アイドルタイムアウト
} else {
  // 有効、lastAccess を更新
  req.session.lastAccess = now;
}
```

## ✅ メリット

### 1. セキュリティ向上

```javascript
// 長時間放置されたセッションを無効化
// → セッションハイジャックのリスク軽減
```

### 2. リソース管理

```javascript
// 古いセッションを自動削除
// → サーバーメモリの節約
```

### 3. コンプライアンス

```javascript
// GDPR、個人情報保護法などへの対応
// → 必要最小限の期間のみデータ保持
```

## ❌ デメリット

### 1. ユーザーエクスペリエンス

```javascript
// 作業中に突然ログアウト
// → ユーザーの不満
```

### 2. 実装の複雑さ

```javascript
// タイムゾーン、サーバー時刻の考慮
// → バグの可能性
```

### 3. パフォーマンス

```javascript
// 毎リクエストで時刻チェック
// → わずかなオーバーヘッド
```

## 🎯 ユースケース

### 適切な有効期限の設定例

| サービス種類 | 絶対期限 | アイドル期限 | 理由 |
|------------|---------|------------|------|
| **銀行・金融** | 10分 | 5分 | 高セキュリティ |
| **EC サイト** | 7日 | 30分 | UX とセキュリティのバランス |
| **SNS** | 30日 | なし | ユーザーフレンドリー |
| **管理画面** | 8時間 | 30分 | 業務時間内で十分 |
| **API トークン** | 1時間 | なし | 短命、頻繁な更新 |

## 💻 実装例

```javascript
import express from 'express';
import cookieSession from 'cookie-session';

const app = express();

// セッション設定
app.use(cookieSession({
  name: 'session',
  keys: ['secret-key'],
  maxAge: 12 * 60 * 60 * 1000 // クッキーの絶対有効期限: 12時間
}));

// セッションタイムアウト設定
const ABSOLUTE_TIMEOUT = 12 * 60 * 60 * 1000; // 12時間
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30分

// セッションチェックミドルウェア
function checkSessionExpiration(req, res, next) {
  if (!req.session || !req.session.userId) {
    return next(); // セッションなし、続行
  }

  const now = Date.now();
  const loginTime = req.session.loginAt;
  const lastAccessTime = req.session.lastAccess;

  // 絶対有効期限チェック
  if (now - loginTime > ABSOLUTE_TIMEOUT) {
    console.log('⏰ 絶対有効期限切れ');
    req.session = null;
    return res.status(401).json({
      success: false,
      message: 'Session expired (absolute timeout)',
      reason: 'absolute'
    });
  }

  // アイドルタイムアウトチェック
  if (now - lastAccessTime > IDLE_TIMEOUT) {
    console.log('⏰ アイドルタイムアウト');
    req.session = null;
    return res.status(401).json({
      success: false,
      message: 'Session expired (idle timeout)',
      reason: 'idle'
    });
  }

  // セッション有効、最終アクセス時刻を更新
  req.session.lastAccess = now;

  // 有効期限情報を計算
  req.sessionExpiry = {
    absoluteExpiry: loginTime + ABSOLUTE_TIMEOUT,
    idleExpiry: now + IDLE_TIMEOUT,
    remainingAbsolute: loginTime + ABSOLUTE_TIMEOUT - now,
    remainingIdle: now + IDLE_TIMEOUT - now
  };

  next();
}

app.use(checkSessionExpiration);

// ログイン
app.post('/api/login', (req, res) => {
  // 認証処理...

  const now = Date.now();
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.loginAt = now;
  req.session.lastAccess = now;

  res.json({
    success: true,
    expiry: {
      absoluteTimeout: ABSOLUTE_TIMEOUT,
      idleTimeout: IDLE_TIMEOUT
    }
  });
});
```

## 📝 演習問題

### 初級
1. 30分のアイドルタイムアウトを実装してください
2. セッションの残り時間を表示してください

### 中級
3. 絶対有効期限とアイドルタイムアウトの両方を実装してください
4. 期限切れ前の警告機能を追加してください

### 上級
5. セッション延長機能（"ログインを維持"）を実装してください
6. タイムゾーンを考慮した有効期限管理を実装してください

## 🔄 次のステップ

次は **[Lesson 05: セキュアなクッキー設定](../05-secure-cookies/README.md)** でプロダクション環境のセキュリティ対策を学びます。
