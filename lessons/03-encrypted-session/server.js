import express from 'express';
import cookieSession from 'cookie-session';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3003;

// cookie-session ミドルウェアの設定
app.use(cookieSession({
  name: 'session',
  keys: [
    process.env.SESSION_KEY_1 || 'secret-key-current-2024',
    process.env.SESSION_KEY_2 || 'secret-key-previous-2023'
  ],

  // クッキー設定
  maxAge: 24 * 60 * 60 * 1000, // 24時間
  httpOnly: true,               // JavaScript からアクセス不可
  secure: false,                // 開発環境用（本番では true）
  sameSite: 'lax',              // CSRF 対策
  signed: true                  // 署名を有効化
}));

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// デモ用のユーザーデータベース
const users = [
  { id: 1, username: 'alice', password: 'password123', email: 'alice@example.com' },
  { id: 2, username: 'bob', password: 'password456', email: 'bob@example.com' },
  { id: 3, username: 'charlie', password: 'password789', email: 'charlie@example.com' }
];

// セッションバージョン（無効化用）
const CURRENT_SESSION_VERSION = 1;

// セッションサイズチェックミドルウェア
function checkSessionSize(req, res, next) {
  if (req.session) {
    const sessionStr = JSON.stringify(req.session);
    const size = Buffer.byteLength(sessionStr, 'utf8');
    const maxSize = 3000; // 3KB（安全マージン）

    if (size > maxSize) {
      console.warn(`⚠️  セッションサイズが大きい: ${size} bytes`);
    }

    req.sessionSize = size;
  }
  next();
}

app.use(checkSessionSize);

// ログミドルウェア
app.use((req, res, next) => {
  console.log('\n=== 新しいリクエスト ===');
  console.log(`${req.method} ${req.path}`);
  if (req.session && req.session.username) {
    console.log('ユーザー:', req.session.username);
    console.log('セッションサイズ:', req.sessionSize, 'bytes');
  }
  next();
});

// ホームページ
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ログイン
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  console.log('🔐 ログイン試行:', username);

  // ユーザー認証
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    console.log('❌ 認証失敗');
    return res.status(401).json({
      success: false,
      message: 'Invalid username or password'
    });
  }

  // セッションデータを設定（自動的に暗号化される）
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.email = user.email;
  req.session.loginAt = new Date().toISOString();
  req.session.version = CURRENT_SESSION_VERSION;
  req.session.data = {}; // ユーザーデータ用

  console.log('✅ ログイン成功');
  console.log('   ユーザー:', user.username);
  console.log('   セッションバージョン:', req.session.version);

  res.json({
    success: true,
    message: 'Login successful',
    user: {
      id: user.id,
      username: user.username,
      email: user.email
    },
    sessionSize: req.sessionSize
  });
});

// ログアウト
app.post('/api/logout', (req, res) => {
  const username = req.session?.username || 'unknown';
  console.log('👋 ログアウト:', username);

  // セッションをクリア（null を代入）
  req.session = null;

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// 認証チェックミドルウェア
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  // セッションバージョンチェック
  if (req.session.version !== CURRENT_SESSION_VERSION) {
    console.log('⚠️  古いセッションバージョン:', req.session.version);
    req.session = null;
    return res.status(401).json({
      success: false,
      message: 'Session expired (version mismatch)'
    });
  }

  next();
}

// プロフィール取得
app.get('/api/profile', requireAuth, (req, res) => {
  console.log('📖 プロフィール取得:', req.session.username);

  res.json({
    success: true,
    user: {
      userId: req.session.userId,
      username: req.session.username,
      email: req.session.email,
      loginAt: req.session.loginAt,
      version: req.session.version
    },
    sessionSize: req.sessionSize
  });
});

// セッションデータの設定
app.post('/api/session/set', requireAuth, (req, res) => {
  const { key, value } = req.body;

  if (!key) {
    return res.status(400).json({
      success: false,
      message: 'Key is required'
    });
  }

  // データを保存
  if (!req.session.data) {
    req.session.data = {};
  }
  req.session.data[key] = value;

  console.log(`💾 セッションデータ保存: ${key} = ${value}`);
  console.log(`   セッションサイズ: ${req.sessionSize} bytes`);

  res.json({
    success: true,
    key,
    value,
    sessionSize: req.sessionSize,
    allData: req.session.data
  });
});

// セッションデータの取得
app.get('/api/session/get/:key', requireAuth, (req, res) => {
  const { key } = req.params;
  const value = req.session.data?.[key];

  console.log(`📖 セッションデータ取得: ${key} = ${value}`);

  res.json({
    success: true,
    key,
    value,
    exists: value !== undefined
  });
});

// すべてのセッションデータを取得
app.get('/api/session/all', requireAuth, (req, res) => {
  console.log('📖 全セッションデータ取得');

  res.json({
    success: true,
    data: req.session.data || {},
    sessionInfo: {
      userId: req.session.userId,
      username: req.session.username,
      loginAt: req.session.loginAt,
      version: req.session.version,
      size: req.sessionSize
    }
  });
});

// セッションデータの削除
app.delete('/api/session/delete/:key', requireAuth, (req, res) => {
  const { key } = req.params;
  const existed = req.session.data?.[key] !== undefined;

  if (req.session.data) {
    delete req.session.data[key];
  }

  console.log(`🗑️  セッションデータ削除: ${key}`);

  res.json({
    success: true,
    key,
    existed,
    sessionSize: req.sessionSize
  });
});

// セッション情報の取得
app.get('/api/session/info', requireAuth, (req, res) => {
  const sessionStr = JSON.stringify(req.session);
  const size = Buffer.byteLength(sessionStr, 'utf8');
  const maxSize = 4096; // 4KB
  const percentage = ((size / maxSize) * 100).toFixed(2);

  res.json({
    success: true,
    session: {
      userId: req.session.userId,
      username: req.session.username,
      email: req.session.email,
      loginAt: req.session.loginAt,
      version: req.session.version,
      dataKeys: Object.keys(req.session.data || {})
    },
    size: {
      bytes: size,
      maxBytes: maxSize,
      percentage: percentage + '%',
      warning: size > 3000
    }
  });
});

// セッションのクリア（データのみ）
app.post('/api/session/clear-data', requireAuth, (req, res) => {
  console.log('🗑️  セッションデータをクリア');

  req.session.data = {};

  res.json({
    success: true,
    message: 'Session data cleared',
    sessionSize: req.sessionSize
  });
});

// デバッグ用: セッション全体を表示
app.get('/api/debug/session', (req, res) => {
  if (!req.session) {
    return res.json({
      session: null,
      message: 'No session'
    });
  }

  const sessionStr = JSON.stringify(req.session);
  const size = Buffer.byteLength(sessionStr, 'utf8');

  res.json({
    session: req.session,
    size: {
      bytes: size,
      maxBytes: 4096,
      percentage: ((size / 4096) * 100).toFixed(2) + '%'
    }
  });
});

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error('❌ エラー:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message
  });
});

// サーバー起動
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🔒 Lesson 03: Encrypted Session (Cookie-Session)');
  console.log('='.repeat(50));
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📚 このレッスンで学ぶこと:`);
  console.log(`   - 暗号化クッキーセッション`);
  console.log(`   - cookie-session パッケージの使用`);
  console.log(`   - クライアントサイドセッション管理`);
  console.log(`   - セッションサイズの管理`);
  console.log('\n' + '='.repeat(50));
  console.log('🔑 セッション暗号化キー:');
  console.log('   - Key 1 (Current): secret-key-current-2024');
  console.log('   - Key 2 (Previous): secret-key-previous-2023');
  console.log('='.repeat(50));
  console.log('👤 テストユーザー:');
  console.log('   - alice / password123');
  console.log('   - bob / password456');
  console.log('   - charlie / password789');
  console.log('='.repeat(50));
  console.log('🚀 ブラウザで http://localhost:' + PORT + ' にアクセスしてください');
  console.log('='.repeat(50) + '\n');
});
