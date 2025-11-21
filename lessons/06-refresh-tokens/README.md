# Lesson 06: リフレッシュトークン

## 📋 概要

このレッスンでは、アクセストークンとリフレッシュトークンを使った高度なセッション管理を学びます。トークンローテーション、リフレッシュの仕組み、セキュリティ上の利点を実装します。

## 🎯 学習目標

- アクセストークンとリフレッシュトークンの違いを理解する
- トークンローテーションの仕組みを学ぶ
- リフレッシュトークンのベストプラクティスを習得する
- セキュリティとユーザビリティのバランスを理解する

## 🔍 リフレッシュトークンとは？

**リフレッシュトークン**は、期限切れのアクセストークンを更新するための長期間有効なトークンです。

### アクセストークン vs リフレッシュトークン

| 項目 | アクセストークン | リフレッシュトークン |
|------|----------------|-------------------|
| **用途** | API リクエストの認証 | トークンの更新 |
| **有効期限** | 短い（15分〜1時間） | 長い（7日〜30日） |
| **保存場所** | メモリ（推奨） | HttpOnly クッキー |
| **使用頻度** | すべてのリクエスト | トークン更新時のみ |
| **セキュリティ** | 漏洩時の影響は限定的 | 漏洩時のリスク大 |

## 🔧 技術的原理

### トークンフローの仕組み

```
┌──────────┐                           ┌──────────┐
│ Client   │                           │  Server  │
└────┬─────┘                           └────┬─────┘
     │                                      │
     │  ① POST /login                       │
     │    {username, password}              │
     │ ─────────────────────────────────────>│
     │                                      │
     │                                      │ ② 認証成功、トークン生成
     │                                      │    accessToken (15分)
     │                                      │    refreshToken (7日)
     │                                      │
     │  ③ accessToken (JSON)                │
     │    Set-Cookie: refreshToken          │
     │ <─────────────────────────────────────│
     │                                      │
     ├─ ④ アクセストークンをメモリに保存    │
     ├─ ⑤ リフレッシュトークンはクッキー    │
     │                                      │
     │  ⑥ GET /api/data                     │
     │    Authorization: Bearer accessToken │
     │ ─────────────────────────────────────>│
     │                                      │
     │  ⑦ 200 OK {data}                     │
     │ <─────────────────────────────────────│
     │                                      │
     │  ... 15分後 ...                      │
     │                                      │
     │  ⑧ GET /api/data                     │
     │    Authorization: Bearer accessToken │
     │ ─────────────────────────────────────>│
     │                                      │
     │  ⑨ 401 Unauthorized (token expired)  │
     │ <─────────────────────────────────────│
     │                                      │
     │  ⑩ POST /refresh                     │
     │    Cookie: refreshToken              │
     │ ─────────────────────────────────────>│
     │                                      │
     │                                      │ ⑪ 検証、新しいトークン生成
     │                                      │
     │  ⑫ 新しい accessToken                │
     │    Set-Cookie: 新しい refreshToken   │
     │ <─────────────────────────────────────│
     │                                      │
     │  ⑬ GET /api/data (リトライ)          │
     │    Authorization: Bearer 新accessToken│
     │ ─────────────────────────────────────>│
     │                                      │
     │  ⑭ 200 OK {data}                     │
     │ <─────────────────────────────────────│
     │                                      │
```

### トークンローテーション

**トークンローテーション**は、リフレッシュトークンを使用するたびに新しいリフレッシュトークンを発行する戦略です。

```javascript
// リフレッシュ前
refreshTokens = {
  'token_v1': { userId: 1, version: 1 }
}

// リフレッシュ実行
POST /refresh
Cookie: refreshToken=token_v1

// リフレッシュ後
refreshTokens = {
  'token_v2': { userId: 1, version: 2 } // 新しいトークン
  // 'token_v1' は削除される
}

// 古いトークンの再利用を検知
POST /refresh
Cookie: refreshToken=token_v1 // ❌ 既に無効

// → セキュリティ侵害の可能性！全トークンを無効化
```

## ✅ メリット

### 1. セキュリティの向上

```javascript
// アクセストークンの漏洩
// - 有効期限が短い（15分）
// - 影響範囲が限定的

// リフレッシュトークンの保護
// - HttpOnly クッキーで JavaScript からアクセス不可
// - ローテーションで再利用を検知
```

### 2. ユーザーエクスペリエンス

```javascript
// ユーザーは頻繁にログインし直す必要がない
// アクセストークンは自動的に更新される
// → シームレスな体験
```

### 3. 即座の無効化

```javascript
// リフレッシュトークンをサーバー側で管理
// → 必要に応じて即座に無効化可能
// → JWT の弱点を補完
```

## ❌ デメリット

### 1. 実装の複雑さ

```javascript
// トークンの管理ロジックが複雑
// クライアント側でリフレッシュ処理が必要
```

### 2. 追加のリクエスト

```javascript
// トークン更新のための追加 API コール
// → わずかなオーバーヘッド
```

### 3. サーバー側の状態管理

```javascript
// リフレッシュトークンをサーバーで保存
// → ステートレスではない
// → スケーラビリティへの影響
```

## 🎯 ユースケース

### 適している場面

1. **モバイルアプリ**
   - 長期間のログイン維持が必要
   - バックグラウンドでトークン更新

2. **SPA (Single Page Application)**
   - API との通信が頻繁
   - トークンの自動更新が必要

3. **高セキュリティが求められる API**
   - 短命のアクセストークン
   - 厳格なトークン管理

### 適していない場面

1. **シンプルな Web アプリ**
   - 従来のセッション管理で十分

2. **低頻度のAPI利用**
   - トークン更新の複雑さが不要

## 💻 実装例

### サーバー側

```javascript
import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const app = express();

// トークンの設定
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// リフレッシュトークンストア（本番環境では Redis などを使用）
const refreshTokens = new Map();

// アクセストークンを生成
function generateAccessToken(userId, username) {
  return jwt.sign(
    { userId, username },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

// リフレッシュトークンを生成
function generateRefreshToken(userId) {
  const token = crypto.randomBytes(64).toString('hex');
  refreshTokens.set(token, {
    userId,
    createdAt: Date.now()
  });
  return token;
}

// ログイン
app.post('/api/login', (req, res) => {
  // 認証処理...

  const accessToken = generateAccessToken(user.id, user.username);
  const refreshToken = generateRefreshToken(user.id);

  // リフレッシュトークンを HttpOnly クッキーに保存
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7日
  });

  // アクセストークンは JSON で返す（クライアントがメモリに保存）
  res.json({
    success: true,
    accessToken,
    expiresIn: 15 * 60 // 秒数
  });
});

// トークンのリフレッシュ
app.post('/api/refresh', (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token not found'
    });
  }

  // リフレッシュトークンの検証
  const tokenData = refreshTokens.get(refreshToken);

  if (!tokenData) {
    return res.status(403).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }

  // 古いリフレッシュトークンを削除（ローテーション）
  refreshTokens.delete(refreshToken);

  // 新しいトークンを生成
  const user = getUserById(tokenData.userId); // DB から取得
  const newAccessToken = generateAccessToken(user.id, user.username);
  const newRefreshToken = generateRefreshToken(user.id);

  // 新しいリフレッシュトークンを設定
  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    accessToken: newAccessToken,
    expiresIn: 15 * 60
  });
});

// ログアウト
app.post('/api/logout', (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    refreshTokens.delete(refreshToken);
  }

  res.clearCookie('refreshToken');
  res.json({ success: true });
});

// アクセストークンの検証ミドルウェア
function verifyAccessToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired access token'
      });
    }

    req.user = user;
    next();
  });
}

// 保護されたエンドポイント
app.get('/api/profile', verifyAccessToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});
```

### クライアント側（JavaScript）

```javascript
class TokenManager {
  constructor() {
    this.accessToken = null;
  }

  async login(username, password) {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (data.success) {
      // アクセストークンをメモリに保存
      this.accessToken = data.accessToken;

      // 有効期限の少し前に自動更新をスケジュール
      this.scheduleRefresh(data.expiresIn);
    }

    return data;
  }

  async refresh() {
    const response = await fetch('/api/refresh', {
      method: 'POST'
    });

    const data = await response.json();

    if (data.success) {
      this.accessToken = data.accessToken;
      this.scheduleRefresh(data.expiresIn);
    } else {
      // リフレッシュ失敗 → 再ログイン必要
      this.logout();
    }

    return data;
  }

  scheduleRefresh(expiresIn) {
    // 期限の30秒前に更新
    const refreshTime = (expiresIn - 30) * 1000;
    setTimeout(() => this.refresh(), refreshTime);
  }

  async apiCall(url, options = {}) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${this.accessToken}`
    };

    let response = await fetch(url, options);

    // トークン期限切れ
    if (response.status === 401) {
      // トークンを更新して再試行
      await this.refresh();

      options.headers['Authorization'] = `Bearer ${this.accessToken}`;
      response = await fetch(url, options);
    }

    return response;
  }

  logout() {
    this.accessToken = null;
    fetch('/api/logout', { method: 'POST' });
  }
}

// 使用例
const tokenManager = new TokenManager();

// ログイン
await tokenManager.login('alice', 'password123');

// API コール（自動的にトークン更新）
const response = await tokenManager.apiCall('/api/profile');
const data = await response.json();
```

## 📝 演習問題

### 初級
1. アクセストークンとリフレッシュトークンを生成してください
2. トークンリフレッシュ機能を実装してください

### 中級
3. トークンローテーションを実装してください
4. 自動トークン更新機能をクライアント側に実装してください

### 上級
5. 再利用検知機能を実装してください
6. デバイスごとのトークン管理を実装してください

## 🔄 次のステップ

次は **[Lesson 07: JWT セッション](../07-jwt-session/README.md)** で JSON Web Token を使ったステートレスセッション管理を学びます。
