import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3002;

// ミドルウェアの設定
app.use(cookieParser());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// メモリストア（セッションデータを保存）
const sessions = new Map();

// デモ用のユーザーデータベース
const users = [
  { id: 1, username: 'alice', password: 'password123' },
  { id: 2, username: 'bob', password: 'password456' },
  { id: 3, username: 'charlie', password: 'password789' }
];

// セキュアなセッション ID を生成
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex'); // 256ビット
}

// セッション確認ミドルウェア
function requireSession(req, res, next) {
  const sessionId = req.cookies.sessionId;

  if (!sessionId) {
    return res.status(401).json({
      success: false,
      message: 'No session cookie found'
    });
  }

  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session'
    });
  }

  // 最終アクセス時刻を更新
  session.lastAccess = new Date();

  req.session = session;
  req.sessionId = sessionId;
  next();
}

// ログミドルウェア
app.use((req, res, next) => {
  console.log('\n=== 新しいリクエスト ===');
  console.log(`${req.method} ${req.path}`);
  console.log('セッション ID:', req.cookies.sessionId);
  console.log('アクティブセッション数:', sessions.size);
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

  // 既存のセッションがあれば削除（セッション固定攻撃の防止）
  const oldSessionId = req.cookies.sessionId;
  if (oldSessionId && sessions.has(oldSessionId)) {
    sessions.delete(oldSessionId);
    console.log('🗑️  古いセッションを削除:', oldSessionId.substring(0, 8) + '...');
  }

  // 新しいセッション ID を生成
  const sessionId = generateSessionId();

  // セッションデータを作成
  const sessionData = {
    userId: user.id,
    username: user.username,
    loginAt: new Date(),
    lastAccess: new Date(),
    data: {} // ユーザーデータ用
  };

  // メモリストアに保存
  sessions.set(sessionId, sessionData);

  console.log('✅ ログイン成功');
  console.log('   セッション ID:', sessionId.substring(0, 8) + '...');
  console.log('   ユーザー:', user.username);

  // セッション ID をクッキーに設定
  res.cookie('sessionId', sessionId, {
    httpOnly: true,     // JavaScript からアクセス不可
    secure: false,      // 開発環境用（本番では true）
    sameSite: 'lax',    // CSRF 対策
    maxAge: 24 * 60 * 60 * 1000 // 24時間
  });

  res.json({
    success: true,
    message: 'Login successful',
    user: {
      id: user.id,
      username: user.username
    }
  });
});

// ログアウト
app.post('/api/logout', requireSession, (req, res) => {
  console.log('👋 ログアウト:', req.session.username);

  // セッションをメモリから削除
  sessions.delete(req.sessionId);

  // クッキーをクリア
  res.clearCookie('sessionId');

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// プロフィール取得（認証必要）
app.get('/api/profile', requireSession, (req, res) => {
  console.log('📖 プロフィール取得:', req.session.username);

  res.json({
    success: true,
    user: {
      userId: req.session.userId,
      username: req.session.username,
      loginAt: req.session.loginAt,
      lastAccess: req.session.lastAccess
    }
  });
});

// セッションデータの設定
app.post('/api/session/set', requireSession, (req, res) => {
  const { key, value } = req.body;

  if (!key) {
    return res.status(400).json({
      success: false,
      message: 'Key is required'
    });
  }

  req.session.data[key] = value;

  console.log(`💾 セッションデータ保存: ${key} = ${value}`);

  res.json({
    success: true,
    key,
    value,
    allData: req.session.data
  });
});

// セッションデータの取得
app.get('/api/session/get/:key', requireSession, (req, res) => {
  const { key } = req.params;
  const value = req.session.data[key];

  console.log(`📖 セッションデータ取得: ${key} = ${value}`);

  res.json({
    success: true,
    key,
    value,
    exists: value !== undefined
  });
});

// すべてのセッションデータを取得
app.get('/api/session/all', requireSession, (req, res) => {
  console.log('📖 全セッションデータ取得');

  res.json({
    success: true,
    data: req.session.data
  });
});

// セッションデータの削除
app.delete('/api/session/delete/:key', requireSession, (req, res) => {
  const { key } = req.params;
  const existed = req.session.data[key] !== undefined;

  delete req.session.data[key];

  console.log(`🗑️  セッションデータ削除: ${key}`);

  res.json({
    success: true,
    key,
    existed
  });
});

// セッション統計
app.get('/api/sessions/stats', (req, res) => {
  const stats = {
    totalSessions: sessions.size,
    sessions: Array.from(sessions.entries()).map(([id, session]) => ({
      sessionId: id.substring(0, 8) + '...',
      username: session.username,
      loginAt: session.loginAt,
      lastAccess: session.lastAccess
    }))
  };

  console.log('📊 セッション統計:', stats.totalSessions, '個');

  res.json({
    success: true,
    ...stats
  });
});

// 特定のユーザーのセッションを削除（管理者機能のデモ）
app.delete('/api/sessions/:username', (req, res) => {
  const { username } = req.params;
  let deletedCount = 0;

  for (const [sessionId, session] of sessions.entries()) {
    if (session.username === username) {
      sessions.delete(sessionId);
      deletedCount++;
    }
  }

  console.log(`🗑️  ${username} のセッションを削除: ${deletedCount}個`);

  res.json({
    success: true,
    username,
    deletedCount
  });
});

// セッションのクリーンアップ（タイムアウト処理）
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30分

function cleanupExpiredSessions() {
  const now = Date.now();
  let deletedCount = 0;

  for (const [sessionId, session] of sessions.entries()) {
    const lastAccessTime = new Date(session.lastAccess).getTime();

    if (now - lastAccessTime > SESSION_TIMEOUT) {
      sessions.delete(sessionId);
      deletedCount++;
      console.log(`⏰ セッションタイムアウト: ${session.username} (${sessionId.substring(0, 8)}...)`);
    }
  }

  if (deletedCount > 0) {
    console.log(`🧹 ${deletedCount}個の期限切れセッションを削除しました`);
  }
}

// 1分ごとにクリーンアップを実行
setInterval(cleanupExpiredSessions, 60 * 1000);

// デバッグ用: メモリストアの内容を表示
app.get('/api/debug/sessions', (req, res) => {
  const sessionList = Array.from(sessions.entries()).map(([id, data]) => ({
    sessionId: id,
    ...data
  }));

  res.json({
    totalSessions: sessions.size,
    sessions: sessionList
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
  console.log('🔐 Lesson 02: Simple Session Management');
  console.log('='.repeat(50));
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📚 このレッスンで学ぶこと:`);
  console.log(`   - メモリベースのセッション管理`);
  console.log(`   - セッション ID の生成と管理`);
  console.log(`   - ログイン・ログアウトの実装`);
  console.log(`   - セッションデータの操作`);
  console.log('\n' + '='.repeat(50));
  console.log('👤 テストユーザー:');
  console.log('   - alice / password123');
  console.log('   - bob / password456');
  console.log('   - charlie / password789');
  console.log('='.repeat(50));
  console.log('🚀 ブラウザで http://localhost:' + PORT + ' にアクセスしてください');
  console.log('='.repeat(50) + '\n');
});
