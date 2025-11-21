# Lesson 08: セッションストア（データベース）

## 📋 概要

このレッスンでは、Redis やデータベースを使った永続的なセッション管理を学びます。分散システムでのセッション共有、高可用性、パフォーマンスの最適化を実装します。

## 🎯 学習目標

- セッションストアの種類と特徴を理解する
- Redis を使ったセッション管理を実装する
- 分散システムでのセッション共有方法を学ぶ
- セッションストアのベストプラクティスを習得する

## 🔍 セッションストアとは？

**セッションストア**は、セッションデータを永続化するためのバックエンドストレージです。

### セッションストアの比較

| ストアタイプ | 速度 | 永続性 | スケーラビリティ | 複雑さ | コスト |
|------------|------|-------|----------------|--------|--------|
| **メモリ** | 最速 | ❌ | 低 | 低 | 無料 |
| **Redis** | 高速 | ✅ | 高 | 中 | 低〜中 |
| **MongoDB** | 中速 | ✅ | 高 | 中 | 低〜中 |
| **PostgreSQL** | 中速 | ✅ | 中〜高 | 中〜高 | 低〜中 |
| **DynamoDB** | 高速 | ✅ | 最高 | 高 | 従量課金 |

## 🔧 技術的原理

### メモリストア vs Redis

#### メモリストア（Lesson 02）

```
┌─────────┐      ┌─────────┐      ┌─────────┐
│ Server1 │      │ Server2 │      │ Server3 │
│         │      │         │      │         │
│ ┌─────┐ │      │ ┌─────┐ │      │ ┌─────┐ │
│ │ Mem │ │      │ │ Mem │ │      │ │ Mem │ │
│ └─────┘ │      │ └─────┘ │      │ └─────┘ │
└─────────┘      └─────────┘      └─────────┘
    ↑                ↑                ↑
    │                │                │
    └────────────────┴────────────────┘
         セッションが分散、共有できない
```

**問題点**:
- サーバーごとにセッションが分離
- ロードバランサーでスティッキーセッション必要
- サーバー再起動でセッション消失

#### Redis ストア（推奨）

```
┌─────────┐      ┌─────────┐      ┌─────────┐
│ Server1 │      │ Server2 │      │ Server3 │
└────┬────┘      └────┬────┘      └────┬────┘
     │                │                │
     └────────────────┴────────────────┘
                      ↓
              ┌──────────────┐
              │    Redis     │
              │  (セッション)  │
              └──────────────┘
```

**利点**:
- すべてのサーバーでセッション共有
- 高速（インメモリ）
- 永続化可能
- TTL（自動削除）機能

### Redis の仕組み

```javascript
// セッションデータの保存
SET session:abc123 '{"userId":1,"username":"alice"}' EX 3600

// セッションデータの取得
GET session:abc123
// → '{"userId":1,"username":"alice"}'

// 3600 秒後に自動削除（TTL）
TTL session:abc123
// → 3600 ... 3599 ... 3598 ... 0 ... -2 (削除済み)
```

## ✅ メリット

### 1. 永続性

```javascript
// サーバー再起動してもセッションが保持される
// → ユーザーはログイン状態を維持
```

### 2. スケーラビリティ

```javascript
// 複数のサーバーでセッションを共有
// → 水平スケーリングが容易
// → スティッキーセッション不要
```

### 3. 高可用性

```javascript
// Redis のレプリケーション
// → マスター障害時もスレーブが引き継ぐ
```

### 4. パフォーマンス

```javascript
// インメモリストア（Redis）
// → ミリ秒単位の応答時間
// → データベースより高速
```

## ❌ デメリット

### 1. 追加のインフラ

```javascript
// Redis サーバーの管理が必要
// → 運用コスト
// → 設定の複雑さ
```

### 2. ネットワークオーバーヘッド

```javascript
// アプリサーバー → Redis の通信
// → わずかな遅延（通常 1-5ms）
```

### 3. コスト

```javascript
// ホスティング費用
// - AWS ElastiCache: $15/月〜
// - Redis Cloud: $5/月〜
```

## 🎯 ユースケース

### 適している場面

1. **本番環境**
   - 複数サーバーインスタンス
   - 高可用性が必要

2. **中〜大規模アプリケーション**
   - 数千〜数万の同時ユーザー
   - 24/7 稼働

3. **マイクロサービス**
   - 複数のサービス間でセッション共有

### 適していない場面

1. **小規模アプリ（開発環境）**
   - 単一サーバー
   - メモリストアで十分

2. **サーバーレス環境**
   - JWT など ステートレスな認証推奨

## 💻 実装例

### Redis セッションストア

```javascript
import express from 'express';
import session from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

const app = express();

// Redis クライアントの作成
const redisClient = createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  // 本番環境では TLS を使用
  tls: process.env.NODE_ENV === 'production' ? {} : undefined
});

redisClient.connect().catch(console.error);

// Redis エラーハンドリング
redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

redisClient.on('connect', () => {
  console.log('✅ Connected to Redis');
});

// express-session の設定
app.use(session({
  store: new RedisStore({
    client: redisClient,
    prefix: 'sess:', // キーのプレフィックス
    ttl: 3600        // TTL (秒)
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000 // 1時間
  }
}));

// ログイン
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  // 認証...
  const user = authenticateUser(username, password);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // セッションに保存（自動的に Redis に保存される）
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

// プロフィール取得
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

// ログアウト
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }

    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});
```

### MongoDB セッションストア

```javascript
import session from 'express-session';
import MongoStore from 'connect-mongo';

app.use(session({
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 3600, // 1時間
    touchAfter: 300 // 5分以内の更新は無視（パフォーマンス最適化）
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
```

### セッションの手動操作

```javascript
// セッションの再生成（ログイン時）
app.post('/api/login', (req, res) => {
  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({ error: 'Session regeneration failed' });
    }

    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: 'Session save failed' });
      }

      res.json({ success: true });
    });
  });
});

// セッションの破棄（ログアウト時）
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }

    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// セッションのタッチ（有効期限延長）
app.post('/api/touch', (req, res) => {
  req.session.touch();
  req.session.save((err) => {
    if (err) {
      return res.status(500).json({ error: 'Touch failed' });
    }

    res.json({ success: true });
  });
});
```

### Redis の高度な設定

```javascript
// Redis Cluster
const redisClient = createClient({
  cluster: {
    nodes: [
      { host: 'node1.redis.com', port: 6379 },
      { host: 'node2.redis.com', port: 6379 },
      { host: 'node3.redis.com', port: 6379 }
    ]
  }
});

// Redis Sentinel（高可用性）
const redisClient = createClient({
  sentinels: [
    { host: 'sentinel1', port: 26379 },
    { host: 'sentinel2', port: 26379 }
  ],
  name: 'mymaster'
});

// 接続プール
const redisClient = createClient({
  socket: {
    connectTimeout: 5000,
    keepAlive: 5000
  },
  // 再接続戦略
  reconnectStrategy: (retries) => {
    if (retries > 10) {
      return new Error('Too many retries');
    }
    return retries * 100; // ミリ秒
  }
});
```

## 🔐 セキュリティとパフォーマンス

### 1. Redis のセキュリティ

```javascript
// ✅ パスワード認証
const redisClient = createClient({
  password: process.env.REDIS_PASSWORD
});

// ✅ TLS/SSL 暗号化
const redisClient = createClient({
  tls: {
    ca: fs.readFileSync('/path/to/ca.crt'),
    cert: fs.readFileSync('/path/to/client.crt'),
    key: fs.readFileSync('/path/to/client.key')
  }
});

// ✅ ネットワーク制限
// Redis サーバーをプライベートネットワークに配置
```

### 2. パフォーマンス最適化

```javascript
// セッション更新の最適化
app.use(session({
  store: new RedisStore({ client: redisClient }),
  resave: false,           // 変更なければ保存しない
  saveUninitialized: false, // 空セッションは保存しない
  rolling: false           // 毎リクエストで TTL 延長しない
}));

// タッチ戦略
app.use(session({
  store: MongoStore.create({
    touchAfter: 300 // 5分以内の更新は無視
  })
}));
```

### 3. モニタリング

```javascript
// Redis の状態監視
redisClient.on('ready', () => console.log('Redis ready'));
redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.on('reconnecting', () => console.log('Redis reconnecting'));

// セッション数の監視
app.get('/api/stats', async (req, res) => {
  const keys = await redisClient.keys('sess:*');
  res.json({
    activeSessions: keys.length
  });
});
```

## 📝 演習問題

### 初級
1. Redis を使ったセッションストアを実装してください
2. セッションの TTL を設定してください

### 中級
3. セッション数を監視する機能を追加してください
4. Redis の接続エラーハンドリングを実装してください

### 上級
5. Redis Cluster を使った分散セッション管理を実装してください
6. セッションのバックアップ・復元機能を追加してください

## 🎉 カリキュラム完了

おめでとうございます！全 8 レッスンを完了しました。

### 学んだこと

1. ✅ **Lesson 01**: クッキーの基本
2. ✅ **Lesson 02**: メモリセッション管理
3. ✅ **Lesson 03**: 暗号化クッキーセッション
4. ✅ **Lesson 04**: 有効期限管理
5. ✅ **Lesson 05**: セキュアなクッキー設定
6. ✅ **Lesson 06**: リフレッシュトークン
7. ✅ **Lesson 07**: JWT セッション
8. ✅ **Lesson 08**: セッションストア

### 次のステップ

- 実際のプロジェクトに適用
- セキュリティテストの実施
- パフォーマンスベンチマーク
- プロダクション環境へのデプロイ

---

**[メインページに戻る](../../README.md)**
