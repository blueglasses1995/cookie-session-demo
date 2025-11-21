# Lesson 07: JWT セッション

## 📋 概要

このレッスンでは、JSON Web Token (JWT) を使ったステートレスなセッション管理を学びます。JWT の構造、署名と検証の仕組み、従来のセッション管理との違いを理解し、実装します。

## 🎯 学習目標

- JWT の構造と仕組みを理解する
- JWT の署名と検証方法を学ぶ
- ステートレス認証の利点と欠点を理解する
- JWT のベストプラクティスを習得する

## 🔍 JWT とは？

**JSON Web Token (JWT)** は、JSON形式のデータを安全に転送するためのコンパクトで自己完結型のトークン規格です（RFC 7519）。

### JWT の構造

JWT は 3 つの部分から構成されます：

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWxpY2UifQ.4pcPyMD09olPSyXnrXCjTwXyr4BsezdI1AVTmud2fU4

├─────────── Header ──────────┤ ├────────── Payload ─────────┤ ├───── Signature ─────┤
```

#### 1. Header（ヘッダー）

```json
{
  "alg": "HS256",  // 署名アルゴリズム
  "typ": "JWT"     // トークンタイプ
}
```

Base64URL エンコード → `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`

#### 2. Payload（ペイロード）

```json
{
  "userId": 1,
  "username": "alice",
  "email": "alice@example.com",
  "iat": 1677123456,  // 発行時刻
  "exp": 1677127056   // 有効期限
}
```

Base64URL エンコード → `eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWxpY2UifQ...`

**標準クレーム**:
- `iss` (issuer): 発行者
- `sub` (subject): 主体（ユーザーID など）
- `aud` (audience): 対象者
- `exp` (expiration): 有効期限
- `nbf` (not before): 有効開始時刻
- `iat` (issued at): 発行時刻
- `jti` (JWT ID): トークン ID

#### 3. Signature（署名）

```javascript
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret
)
```

署名により、トークンの改ざんを検知できます。

## 🔧 技術的原理

### JWT の検証フロー

```
┌──────────┐                           ┌──────────┐
│ Client   │                           │  Server  │
└────┬─────┘                           └────┬─────┘
     │                                      │
     │  ① POST /login                       │
     │    {username, password}              │
     │ ─────────────────────────────────────>│
     │                                      │
     │                                      │ ② 認証成功
     │                                      │    JWT を生成:
     │                                      │    header.payload.signature
     │                                      │
     │  ③ JWT をクッキーまたは JSON で返す  │
     │ <─────────────────────────────────────│
     │                                      │
     ├─ ④ JWT を保存                        │
     │                                      │
     │  ⑤ GET /api/profile                  │
     │    Cookie: jwt=xxx または            │
     │    Authorization: Bearer xxx         │
     │ ─────────────────────────────────────>│
     │                                      │
     │                                      │ ⑥ JWT を検証:
     │                                      │    a. 署名の検証
     │                                      │    b. 有効期限の確認
     │                                      │    c. ペイロードの取得
     │                                      │
     │  ⑦ 200 OK {user data}                │
     │ <─────────────────────────────────────│
     │                                      │
```

### 従来のセッション vs JWT

| 項目 | 従来のセッション | JWT |
|------|----------------|-----|
| **状態管理** | ステートフル | ステートレス |
| **データ保存** | サーバー（メモリ/DB） | クライアント（トークン） |
| **サーバーリソース** | 必要 | 不要 |
| **スケーラビリティ** | 低〜中 | 高 |
| **即座の無効化** | 容易 | 困難 |
| **トークンサイズ** | 小（ID のみ） | 大（データ含む） |
| **検証コスト** | DB/メモリアクセス | 署名検証（CPU） |

## ✅ メリット

### 1. ステートレス

```javascript
// サーバー側でセッションデータを保持しない
// → スケーラビリティが高い
// → 複数サーバー間で共有が容易
```

### 2. 自己完結型

```javascript
// トークンにユーザー情報が含まれる
// → データベースアクセス不要
// → 高速な認証処理
```

### 3. クロスドメイン対応

```javascript
// API サーバーと Web サーバーが分離している場合に最適
// マイクロサービスアーキテクチャに適合
```

### 4. モバイルアプリに最適

```javascript
// ネイティブアプリでクッキー管理が不要
// トークンを localStorage や Secure Storage に保存
```

## ❌ デメリット

### 1. 即座の無効化が困難

```javascript
// トークンを発行したら、有効期限まで有効
// → ログアウトしてもトークンは有効

// 対策:
// - 短い有効期限（15分など）
// - ブラックリスト（複雑化）
// - トークンバージョニング
```

### 2. トークンサイズ

```javascript
// セッション ID: 32 bytes
// JWT: 数百 bytes 〜 1KB

// 毎リクエストで送信 → 帯域幅の消費
```

### 3. 機密データの扱い

```javascript
// ペイロードは Base64 エンコードのみ（暗号化ではない）
// → 誰でもデコード可能

// ❌ 機密データを含めない
const token = jwt.sign({
  userId: 1,
  password: 'secret' // 危険！
}, secret);

// ✅ 最小限の情報のみ
const token = jwt.sign({
  userId: 1,
  username: 'alice'
}, secret);
```

### 4. XSS 脆弱性

```javascript
// localStorage に保存すると XSS のリスク
// → HttpOnly クッキー推奨

// ❌ XSS に脆弱
localStorage.setItem('jwt', token);

// ✅ HttpOnly クッキー
res.cookie('jwt', token, { httpOnly: true });
```

## 🎯 ユースケース

### 適している場面

1. **マイクロサービス**
   - 複数のサービス間で認証情報を共有
   - ステートレスな設計

2. **API サーバー**
   - RESTful API
   - GraphQL API

3. **モバイルアプリ**
   - ネイティブアプリケーション
   - SPA (Single Page Application)

4. **サーバーレス**
   - AWS Lambda, Vercel Functions
   - ステートを持てない環境

### 適していない場面

1. **高度なセッション管理が必要**
   - 即座の無効化
   - セッションの一覧表示

2. **大量のユーザーデータ**
   - トークンサイズの制約

3. **高セキュリティ要求**
   - 銀行、医療など
   - サーバー側セッション推奨

## 💻 実装例

### サーバー側

```javascript
import express from 'express';
import jwt from 'jsonwebtoken';

const app = express();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRY = '1h';

// ログイン
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  // 認証処理...
  const user = authenticateUser(username, password);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // JWT を生成
  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      email: user.email
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRY,
      issuer: 'my-app',
      audience: 'my-app-users'
    }
  );

  // HttpOnly クッキーに保存（推奨）
  res.cookie('jwt', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 3600000 // 1時間
  });

  // または JSON で返す（クライアントが管理）
  res.json({
    success: true,
    token,
    expiresIn: 3600
  });
});

// JWT 検証ミドルウェア
function verifyJWT(req, res, next) {
  // クッキーまたは Authorization ヘッダーから取得
  const token = req.cookies.jwt ||
                (req.headers.authorization?.split(' ')[1]);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'my-app',
      audience: 'my-app-users'
    });

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Invalid token'
    });
  }
}

// 保護されたルート
app.get('/api/profile', verifyJWT, (req, res) => {
  res.json({
    success: true,
    user: {
      userId: req.user.userId,
      username: req.user.username,
      email: req.user.email
    }
  });
});

// ログアウト（クッキーをクリア）
app.post('/api/logout', (req, res) => {
  res.clearCookie('jwt');
  res.json({ success: true });
});
```

### ブラックリストの実装（オプション）

```javascript
// トークンのブラックリスト（Redis などに保存）
const blacklist = new Set();

// ログアウト時にブラックリストに追加
app.post('/api/logout', verifyJWT, (req, res) => {
  const token = req.cookies.jwt;

  // ブラックリストに追加
  blacklist.add(token);

  // 有効期限後に自動削除（Redis の TTL 機能を使用）
  const expiryTime = req.user.exp * 1000 - Date.now();
  setTimeout(() => blacklist.delete(token), expiryTime);

  res.clearCookie('jwt');
  res.json({ success: true });
});

// 検証時にブラックリストをチェック
function verifyJWT(req, res, next) {
  const token = req.cookies.jwt;

  if (blacklist.has(token)) {
    return res.status(401).json({
      success: false,
      message: 'Token has been revoked'
    });
  }

  // 通常の検証...
}
```

## 🔐 セキュリティのベストプラクティス

### 1. 強力な秘密鍵

```javascript
// ✅ 256 ビット以上のランダムな鍵
const crypto = require('crypto');
const secret = crypto.randomBytes(64).toString('hex');

// ❌ 短い、推測可能な鍵
const secret = 'mysecret'; // 危険！
```

### 2. 短い有効期限

```javascript
// ✅ 15分〜1時間
expiresIn: '15m'

// ❌ 長すぎる
expiresIn: '30d' // 漏洩時のリスク大
```

### 3. HTTPS 必須

```javascript
// HTTPS でのみ使用
res.cookie('jwt', token, {
  secure: true // 必須
});
```

### 4. 機密データを含めない

```javascript
// ✅ 最小限の情報
const payload = {
  userId: user.id,
  role: user.role
};

// ❌ 機密情報を含める
const payload = {
  userId: user.id,
  password: user.password, // 危険！
  creditCard: user.cc      // 危険！
};
```

## 📝 演習問題

### 初級
1. JWT を生成してください
2. JWT を検証するミドルウェアを実装してください

### 中級
3. 有効期限切れのエラーハンドリングを追加してください
4. リフレッシュトークン機能を実装してください

### 上級
5. ブラックリスト機能を実装してください
6. 非対称鍵（RS256）を使った JWT を実装してください

## 🔄 次のステップ

次は **[Lesson 08: セッションストア](../08-session-store/README.md)** でデータベースを使った永続的なセッション管理を学びます。
