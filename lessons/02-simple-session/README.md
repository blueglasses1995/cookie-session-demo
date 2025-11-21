# Lesson 02: シンプルなセッション管理

## 📋 概要

このレッスンでは、クッキーを使ったメモリベースのセッション管理を学びます。セッション ID をクッキーに保存し、実際のセッションデータはサーバー側のメモリに保存する仕組みを実装します。

## 🎯 学習目標

- セッション管理の基本概念を理解する
- セッション ID の生成と管理方法を学ぶ
- メモリストアを使ったセッション実装を習得する
- サーバーサイドセッションのメリット・デメリットを理解する

## 🔍 セッション管理とは？

**セッション管理**は、複数の HTTP リクエストにわたってユーザーの状態を維持する仕組みです。

### Lesson 01 との違い

| 項目 | Lesson 01（クッキーのみ） | Lesson 02（セッション管理） |
|------|-------------------------|--------------------------|
| **データの保存場所** | クライアント（ブラウザ） | サーバー（メモリ） |
| **クッキーの内容** | 実際のデータ | セッション ID のみ |
| **データサイズ** | 4KB 制限 | 制限なし |
| **セキュリティ** | 低（暗号化必要） | 高 |

## 🔧 技術的原理

### セッション管理の仕組み

```
┌──────────┐                           ┌──────────┐
│ Browser  │                           │  Server  │
└────┬─────┘                           └────┬─────┘
     │                                      │
     │  ① POST /login                       │
     │    {username: "alice"}               │
     │ ─────────────────────────────────────>│
     │                                      │
     │                                      │ ② ユーザー認証成功
     │                                      │    セッション ID 生成: "abc123"
     │                                      │    メモリに保存:
     │                                      │    sessions["abc123"] = {
     │                                      │      userId: 1,
     │                                      │      username: "alice"
     │                                      │    }
     │                                      │
     │  ③ Set-Cookie: sessionId=abc123      │
     │ <─────────────────────────────────────│
     │                                      │
     ├─ ④ ブラウザがセッション ID を保存    │
     │                                      │
     │  ⑤ GET /profile                      │
     │    Cookie: sessionId=abc123          │
     │ ─────────────────────────────────────>│
     │                                      │
     │                                      │ ⑥ セッション ID からデータ取得:
     │                                      │    session = sessions["abc123"]
     │                                      │    → {userId: 1, username: "alice"}
     │                                      │
     │  ⑦ 200 OK (Welcome, alice!)          │
     │ <─────────────────────────────────────│
     │                                      │
```

### セッション ID の生成

セキュアなセッション ID は以下の特性を持つべきです：

1. **ランダム性**: 推測不可能
2. **十分な長さ**: 128 ビット以上推奨
3. **一意性**: 重複しない

```javascript
import crypto from 'crypto';

// セキュアなセッション ID の生成
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex'); // 256 ビット
}
```

### メモリストアの実装

```javascript
// シンプルなメモリストア
class MemoryStore {
  constructor() {
    this.sessions = new Map();
  }

  // セッションの作成
  create(sessionId, data) {
    this.sessions.set(sessionId, {
      data,
      createdAt: new Date()
    });
  }

  // セッションの取得
  get(sessionId) {
    return this.sessions.get(sessionId);
  }

  // セッションの更新
  update(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.data = { ...session.data, ...data };
    }
  }

  // セッションの削除
  destroy(sessionId) {
    this.sessions.delete(sessionId);
  }
}
```

## ✅ メリット

### 1. セキュリティ

- **機密データの保護**: ユーザーデータがクライアントに露出しない
- **改ざん防止**: クライアントはセッション ID しか持たない
- **データの完全性**: サーバーが完全に制御

### 2. データサイズ

- **制限なし**: クッキーの 4KB 制限に縛られない
- **複雑なデータ**: オブジェクトや配列を自由に保存可能

### 3. 即座の無効化

- **ログアウト**: サーバー側でセッションを即座に削除
- **強制ログアウト**: 管理者がユーザーをログアウトさせられる

### 4. 集中管理

- **監視**: アクティブなセッションを把握
- **制御**: 同時ログイン数の制限など

## ❌ デメリット

### 1. サーバーリソース

- **メモリ消費**: セッション数に比例してメモリを使用
- **スケーラビリティ**: 大量のユーザーで問題になる可能性

```javascript
// 1万ユーザーのセッション
// 1セッション = 1KB と仮定
// 10,000 × 1KB = 10MB のメモリ使用
```

### 2. 水平スケーリング

- **複数サーバー**: メモリは共有されない
- **セッション共有**: 別の仕組み（Redis など）が必要

```
┌─────────┐      ┌─────────┐      ┌─────────┐
│ Server1 │      │ Server2 │      │ Server3 │
│ Memory  │      │ Memory  │      │ Memory  │
└─────────┘      └─────────┘      └─────────┘
     ↑                ↑                ↑
     └────────────────┴────────────────┘
              セッションが分散
           → 共有できない問題
```

### 3. 永続性

- **再起動**: サーバー再起動でセッションが消える
- **クラッシュ**: データが失われる

### 4. パフォーマンス

- **検索コスト**: セッション ID からデータを探す必要がある
- **メモリアクセス**: ディスクより速いが、CPU キャッシュより遅い

## 🎯 ユースケース

### ✅ 適している場面

#### 1. 中小規模アプリケーション

```javascript
// 同時接続ユーザー: 〜1,000人
// メモリ使用量: 〜1-10MB
// シンプルな実装で十分
```

#### 2. 開発・テスト環境

```javascript
// 外部依存なし（Redis など不要）
// 簡単にセットアップ可能
// デバッグが容易
```

#### 3. 機密データの保存

```javascript
// ユーザーの個人情報
// 支払い情報（一時的）
// 管理者権限の情報
```

### ❌ 適していない場面

#### 1. 大規模アプリケーション

```javascript
// 同時接続ユーザー: 10,000人以上
// → Redis などの外部ストア推奨
```

#### 2. マイクロサービス

```javascript
// 複数のサーバーインスタンス
// → セッションストアの共有が必要
```

#### 3. サーバーレス環境

```javascript
// AWS Lambda, Vercel など
// → ステートレスな JWT 推奨
```

## 💻 実装例

### 基本的なセッション管理

```javascript
import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';

const app = express();
app.use(cookieParser());
app.use(express.json());

// メモリストア
const sessions = new Map();

// セッション ID 生成
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

// ログイン
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  // 認証（デモ用の簡易実装）
  if (username && password === 'password') {
    // セッション ID 生成
    const sessionId = generateSessionId();

    // セッションデータを保存
    sessions.set(sessionId, {
      userId: Date.now(),
      username,
      loginAt: new Date(),
      data: {}
    });

    // セッション ID をクッキーに設定
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: false, // 開発環境
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24時間
    });

    res.json({ success: true, username });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// セッション確認ミドルウェア
function requireSession(req, res, next) {
  const sessionId = req.cookies.sessionId;

  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  req.session = sessions.get(sessionId);
  req.sessionId = sessionId;
  next();
}

// プロフィール取得（認証必要）
app.get('/api/profile', requireSession, (req, res) => {
  res.json({
    success: true,
    user: {
      username: req.session.username,
      userId: req.session.userId,
      loginAt: req.session.loginAt
    }
  });
});

// ログアウト
app.post('/api/logout', requireSession, (req, res) => {
  // セッションを削除
  sessions.delete(req.sessionId);

  // クッキーをクリア
  res.clearCookie('sessionId');

  res.json({ success: true, message: 'Logged out' });
});
```

### セッションデータの操作

```javascript
// データの保存
app.post('/api/session/set', requireSession, (req, res) => {
  const { key, value } = req.body;
  req.session.data[key] = value;

  res.json({ success: true, data: req.session.data });
});

// データの取得
app.get('/api/session/get/:key', requireSession, (req, res) => {
  const { key } = req.params;
  const value = req.session.data[key];

  res.json({ success: true, key, value });
});

// データの削除
app.delete('/api/session/delete/:key', requireSession, (req, res) => {
  const { key } = req.params;
  delete req.session.data[key];

  res.json({ success: true });
});
```

## 🔐 セキュリティのベストプラクティス

### 1. セッション ID の要件

```javascript
// ✅ 良い例: 暗号学的に安全
const sessionId = crypto.randomBytes(32).toString('hex');

// ❌ 悪い例: 推測可能
const sessionId = Date.now().toString(); // 危険！
const sessionId = Math.random().toString(); // 危険！
```

### 2. クッキーの設定

```javascript
// ✅ セキュアな設定
res.cookie('sessionId', sessionId, {
  httpOnly: true,    // JavaScript からアクセス不可
  secure: true,      // HTTPS のみ（本番環境）
  sameSite: 'strict', // CSRF 対策
  maxAge: 3600000    // 1時間
});
```

### 3. セッション固定攻撃の防止

```javascript
// ログイン成功時に新しいセッション ID を生成
app.post('/api/login', (req, res) => {
  // 古いセッションがあれば削除
  const oldSessionId = req.cookies.sessionId;
  if (oldSessionId) {
    sessions.delete(oldSessionId);
  }

  // 新しいセッション ID を生成
  const newSessionId = generateSessionId();
  // ...
});
```

### 4. セッションのタイムアウト

```javascript
// 一定時間アクセスがないセッションを削除
setInterval(() => {
  const now = Date.now();
  const timeout = 30 * 60 * 1000; // 30分

  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastAccess > timeout) {
      sessions.delete(sessionId);
      console.log(`Session ${sessionId} expired`);
    }
  }
}, 60 * 1000); // 1分ごとにチェック
```

## 📝 演習問題

### 初級

1. ログイン機能を実装してセッションを作成してください
2. セッションにユーザー名を保存し、表示してください
3. ログアウト機能を実装してセッションを削除してください

### 中級

4. セッションに任意のデータを保存・取得する機能を追加してください
5. アクティブなセッション数を表示する機能を実装してください
6. 最終アクセス時刻を記録し、表示してください

### 上級

7. セッションのタイムアウト機能を実装してください（30分）
8. 同一ユーザーの重複ログインを防ぐ機能を追加してください
9. セッションデータのサイズを制限する機能を実装してください

## 🔄 次のステップ

メモリベースのセッション管理を理解できましたか？

次は **[Lesson 03: セッションの暗号化](../03-encrypted-session/README.md)** でクライアントサイドでセッションを暗号化して保存する方法を学びます。

---

**重要なポイント**:
- セッション ID はクッキーに、データはサーバーに保存
- セキュアなセッション ID 生成が重要
- メモリストアはシンプルだがスケーラビリティに課題
- 次のレッスンで暗号化クッキーセッションを学びます
