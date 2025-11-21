# Lesson 03: セッションの暗号化

## 📋 概要

このレッスンでは、クライアントサイドでセッションデータを暗号化して保存する方法を学びます。`cookie-session` パッケージを使って、セッションデータをクッキーに暗号化して保存し、サーバー側のメモリやデータベースを使わないステートレスなセッション管理を実装します。

## 🎯 学習目標

- クライアントサイドセッションの仕組みを理解する
- 対称鍵暗号化の基礎を学ぶ
- cookie-session パッケージの使い方を習得する
- 暗号化セッションのメリット・デメリットを理解する

## 🔍 暗号化クッキーセッションとは？

**暗号化クッキーセッション**は、セッションデータを暗号化してクッキーに保存する方式です。Lesson 02 とは異なり、サーバー側でセッションデータを保持しません。

### Lesson 02 との比較

| 項目 | Lesson 02（サーバーセッション） | Lesson 03（暗号化クッキーセッション） |
|------|-------------------------------|----------------------------------|
| **データ保存場所** | サーバー（メモリ） | クライアント（クッキー、暗号化） |
| **クッキーの内容** | セッション ID のみ | 暗号化されたセッションデータ |
| **サーバーメモリ** | 使用する | 使用しない |
| **スケーラビリティ** | 低～中 | 高 |
| **即座の無効化** | 容易 | 困難 |
| **データサイズ制限** | なし | 4KB 程度 |

## 🔧 技術的原理

### 暗号化セッションの仕組み

```
┌──────────┐                           ┌──────────┐
│ Browser  │                           │  Server  │
└────┬─────┘                           └────┬─────┘
     │                                      │
     │  ① POST /login                       │
     │    {username: "alice"}               │
     │ ─────────────────────────────────────>│
     │                                      │
     │                                      │ ② セッションデータを作成:
     │                                      │    sessionData = {
     │                                      │      userId: 1,
     │                                      │      username: "alice"
     │                                      │    }
     │                                      │
     │                                      │ ③ データを暗号化:
     │                                      │    encrypted = encrypt(
     │                                      │      sessionData,
     │                                      │      secret_key
     │                                      │    )
     │                                      │
     │  ④ Set-Cookie: session=encrypted     │
     │ <─────────────────────────────────────│
     │                                      │
     ├─ ⑤ ブラウザが暗号化データを保存      │
     │                                      │
     │  ⑥ GET /profile                      │
     │    Cookie: session=encrypted         │
     │ ─────────────────────────────────────>│
     │                                      │
     │                                      │ ⑦ データを復号化:
     │                                      │    sessionData = decrypt(
     │                                      │      encrypted,
     │                                      │      secret_key
     │                                      │    )
     │                                      │    → {userId: 1, username: "alice"}
     │                                      │
     │  ⑧ 200 OK (Welcome, alice!)          │
     │ <─────────────────────────────────────│
     │                                      │
```

### 対称鍵暗号化

暗号化クッキーセッションでは、**対称鍵暗号化**（AES など）を使用します。

```
┌─────────────┐
│ 平文データ   │  "userId=1,username=alice"
└──────┬──────┘
       │
       │ + 秘密鍵（Secret Key）
       ↓
 ┌──────────┐
 │ 暗号化   │
 └─────┬────┘
       │
       ↓
┌──────────────┐
│ 暗号文        │  "xK9$mP3@zL..."
└──────┬───────┘
       │
       │ + 同じ秘密鍵
       ↓
 ┌──────────┐
 │ 復号化   │
 └─────┬────┘
       │
       ↓
┌─────────────┐
│ 平文データ   │  "userId=1,username=alice"
└─────────────┘
```

### cookie-session の実装

`cookie-session` パッケージは以下を自動的に処理します：

1. **暗号化**: セッションデータを AES-256-GCM で暗号化
2. **署名**: HMAC-SHA256 で改ざん検知
3. **自動更新**: セッションデータが変更されたら自動的にクッキーを更新

```javascript
import cookieSession from 'cookie-session';

app.use(cookieSession({
  name: 'session',
  keys: ['secret-key-1', 'secret-key-2'], // ローテーション用に複数キー
  maxAge: 24 * 60 * 60 * 1000 // 24時間
}));
```

## ✅ メリット

### 1. サーバーリソース不要

```javascript
// ✅ メモリやデータベースが不要
// - セッション数が増えてもサーバーメモリは増えない
// - セッションストアの管理が不要
```

### 2. 水平スケーリングが容易

```
┌─────────┐      ┌─────────┐      ┌─────────┐
│ Server1 │      │ Server2 │      │ Server3 │
└────┬────┘      └────┬────┘      └────┬────┘
     │                │                │
     └────────────────┴────────────────┘
         どのサーバーでも同じ秘密鍵で復号化可能
         セッション共有の問題なし！
```

### 3. シンプルな実装

```javascript
// セッションストアの設定不要
// Redis などの外部依存なし
// コード量が少ない
```

### 4. サーバー再起動の影響なし

```javascript
// サーバーが再起動してもセッションは継続
// クライアント側にデータがあるため
```

## ❌ デメリット

### 1. データサイズ制限

```javascript
// クッキーのサイズ制限: 約 4KB
// 暗号化でサイズが増加（約 1.3 倍）
// 実質的な保存可能データ: 約 3KB

// ❌ 大量のデータは保存できない
req.session.largeData = hugeObject; // クッキーサイズ超過の可能性
```

### 2. 即座の無効化が困難

```javascript
// サーバー側からセッションを削除できない
// クライアントがクッキーを持ち続ける限り有効

// 解決策:
// - 短い有効期限を設定
// - ブラックリストを使用（複雑化）
// - バージョニング（下記参照）
```

**バージョニングでの対処例**:

```javascript
// セッションにバージョンを含める
req.session.version = currentVersion;

// サーバー側でバージョンをチェック
if (req.session.version !== currentVersion) {
  // 古いセッションを無効化
  req.session = null;
}
```

### 3. 機密データの扱い

```javascript
// 暗号化されているが、クライアント側にデータがある
// 秘密鍵が漏洩すると全セッションが危険

// ⚠️ 以下は保存を避けるべき:
// - クレジットカード情報
// - パスワード
// - 機密性の高い個人情報
```

### 4. パフォーマンス

```javascript
// 毎リクエストで暗号化・復号化処理が必要
// ただし、AES は非常に高速（通常問題にならない）

// ベンチマーク例:
// 暗号化・復号化: < 1ms（1KB のデータ）
```

## 🎯 ユースケース

### ✅ 適している場面

#### 1. ステートレスなアプリケーション

```javascript
// マイクロサービス
// サーバーレス（AWS Lambda、Vercel など）
// 複数リージョン展開
```

#### 2. 小〜中規模データ

```javascript
// ユーザー ID、名前
// 設定、言語
// ショッピングカート（少量）
```

#### 3. 高スケーラビリティ要求

```javascript
// トラフィックの変動が大きい
// オートスケーリングが必要
// セッションストアを避けたい
```

### ❌ 適していない場面

#### 1. 大量のセッションデータ

```javascript
// 4KB を超えるデータ
// → サーバーセッション or データベースを使用
```

#### 2. 即座の無効化が必要

```javascript
// リアルタイムでセッション無効化
// セキュリティクリティカルな用途
// → サーバーセッション + Redis を使用
```

#### 3. 高度な機密情報

```javascript
// 決済情報
// 医療情報
// → サーバーセッション + 暗号化データベース
```

## 💻 実装例

### 基本的な設定

```javascript
import express from 'express';
import cookieSession from 'cookie-session';

const app = express();

// cookie-session の設定
app.use(cookieSession({
  name: 'session',
  keys: [
    process.env.SESSION_KEY_1 || 'secret-key-1',
    process.env.SESSION_KEY_2 || 'secret-key-2'
  ],

  // クッキー設定
  maxAge: 24 * 60 * 60 * 1000, // 24時間
  httpOnly: true,              // JavaScript からアクセス不可
  secure: false,               // 開発環境（本番では true）
  sameSite: 'lax'              // CSRF 対策
}));

app.use(express.json());
```

### ログイン機能

```javascript
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  // 認証
  const user = authenticateUser(username, password);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // セッションにデータを保存（自動的に暗号化される）
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.loginAt = new Date().toISOString();

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username
    }
  });
});
```

### セッションデータへのアクセス

```javascript
// セッションの読み取り
app.get('/api/profile', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  res.json({
    success: true,
    user: {
      userId: req.session.userId,
      username: req.session.username,
      loginAt: req.session.loginAt
    }
  });
});

// セッションの更新
app.post('/api/session/update', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  const { key, value } = req.body;
  req.session[key] = value; // 自動的に暗号化して保存

  res.json({
    success: true,
    key,
    value
  });
});
```

### ログアウト

```javascript
app.post('/api/logout', (req, res) => {
  // セッションをクリア
  req.session = null;

  res.json({
    success: true,
    message: 'Logged out'
  });
});
```

## 🔐 セキュリティのベストプラクティス

### 1. 強力な秘密鍵

```javascript
// ✅ 良い例: ランダムで長い秘密鍵
const crypto = require('crypto');
const key = crypto.randomBytes(32).toString('base64');
// 例: "xK9mP3zL7qW2nV8bC4fG6hJ9kM5nR8sT1uY7vZ3aB4c="

// ❌ 悪い例: 短い、推測可能
const key = 'mysecret'; // 危険！
const key = 'password123'; // 危険！
```

### 2. キーローテーション

```javascript
// 複数の鍵を設定（最初の鍵で署名、他は検証用）
app.use(cookieSession({
  name: 'session',
  keys: [
    process.env.SESSION_KEY_NEW,  // 新しい鍵（署名用）
    process.env.SESSION_KEY_OLD   // 古い鍵（検証のみ）
  ]
}));

// 定期的に鍵をローテーション（例: 3ヶ月ごと）
```

### 3. 適切なクッキー設定

```javascript
app.use(cookieSession({
  name: 'session',
  keys: [...],

  // 本番環境の推奨設定
  maxAge: 3600000,        // 1時間（短め推奨）
  httpOnly: true,         // 必須
  secure: true,           // HTTPS のみ（本番環境）
  sameSite: 'strict'      // CSRF 対策（厳格）
}));
```

### 4. データサイズの監視

```javascript
// セッションサイズをチェック
function checkSessionSize(req, res, next) {
  if (req.session) {
    const size = JSON.stringify(req.session).length;
    const maxSize = 3000; // 3KB（安全マージン）

    if (size > maxSize) {
      console.warn(`Session too large: ${size} bytes`);
      // 適切な処理（エラーまたは警告）
    }
  }
  next();
}

app.use(checkSessionSize);
```

## 📝 演習問題

### 初級

1. cookie-session を使ってログイン機能を実装してください
2. セッションにユーザー名を保存し、表示してください
3. ログアウト機能を実装してください

### 中級

4. セッションに任意のデータを保存・取得する機能を追加してください
5. セッションデータのサイズを計算して表示してください
6. セッションの有効期限を 1 時間に設定してください

### 上級

7. セッションバージョニングを実装して、古いセッションを無効化してください
8. セッションデータが 3KB を超えたら警告を出す機能を追加してください
9. キーローテーションの仕組みを実装してください

## 🔄 次のステップ

暗号化クッキーセッションの仕組みを理解できましたか？

次は **[Lesson 04: セッションの有効期限管理](../04-session-expiration/README.md)** でセッションのライフサイクル管理を学びます。

---

**重要なポイント**:
- データはクライアントに暗号化して保存される
- サーバーメモリ不要で水平スケーリングが容易
- データサイズ制限（4KB）と即座の無効化が困難
- ステートレスなアプリケーションに最適
