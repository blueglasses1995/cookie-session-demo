import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

// ミドルウェアの設定
app.use(cookieParser());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// ログミドルウェア（学習用）
app.use((req, res, next) => {
  console.log('\n=== 新しいリクエスト ===');
  console.log(`${req.method} ${req.path}`);
  console.log('受信したクッキー:', req.cookies);
  next();
});

// ルート: ホームページ
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ルート: クッキーの設定
app.get('/api/set-cookie', (req, res) => {
  const username = req.query.username || 'guest';
  const theme = req.query.theme || 'light';

  // シンプルなクッキー（セッションクッキー）
  res.cookie('username', username, {
    // デフォルト: ブラウザを閉じると削除される
  });

  // オプション付きクッキー
  res.cookie('theme', theme, {
    maxAge: 3600000,    // 1時間（ミリ秒単位）
    httpOnly: false,    // JavaScript からアクセス可能（デモ用）
    secure: false,      // HTTP でも送信（開発環境用）
    sameSite: 'lax'     // CSRF 対策
  });

  // 訪問回数をカウント
  const visitCount = parseInt(req.cookies.visitCount || '0') + 1;
  res.cookie('visitCount', visitCount, {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1年間
  });

  // 最終訪問日時を記録
  const lastVisit = new Date().toISOString();
  res.cookie('lastVisit', lastVisit, {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1年間
  });

  console.log('✅ クッキーを設定しました:');
  console.log(`  - username: ${username}`);
  console.log(`  - theme: ${theme}`);
  console.log(`  - visitCount: ${visitCount}`);
  console.log(`  - lastVisit: ${lastVisit}`);

  res.json({
    success: true,
    message: 'Cookies set successfully!',
    cookies: {
      username,
      theme,
      visitCount,
      lastVisit
    }
  });
});

// ルート: クッキーの読み取り
app.get('/api/get-cookie', (req, res) => {
  const cookies = req.cookies;

  console.log('📖 クッキーを読み取りました:', cookies);

  if (Object.keys(cookies).length === 0) {
    return res.json({
      success: true,
      message: 'No cookies found',
      cookies: {}
    });
  }

  res.json({
    success: true,
    message: 'Cookies retrieved successfully!',
    cookies: {
      username: cookies.username,
      theme: cookies.theme,
      visitCount: cookies.visitCount,
      lastVisit: cookies.lastVisit,
      all: cookies
    }
  });
});

// ルート: 特定のクッキーの読み取り
app.get('/api/get-cookie/:name', (req, res) => {
  const cookieName = req.params.name;
  const cookieValue = req.cookies[cookieName];

  console.log(`📖 クッキー "${cookieName}" を読み取りました:`, cookieValue);

  if (!cookieValue) {
    return res.status(404).json({
      success: false,
      message: `Cookie "${cookieName}" not found`
    });
  }

  res.json({
    success: true,
    name: cookieName,
    value: cookieValue
  });
});

// ルート: クッキーの削除
app.get('/api/clear-cookie', (req, res) => {
  const cookiesToClear = ['username', 'theme', 'visitCount', 'lastVisit'];

  cookiesToClear.forEach(cookie => {
    res.clearCookie(cookie);
  });

  console.log('🗑️  クッキーを削除しました:', cookiesToClear);

  res.json({
    success: true,
    message: 'All cookies cleared!',
    cleared: cookiesToClear
  });
});

// ルート: 特定のクッキーの削除
app.delete('/api/clear-cookie/:name', (req, res) => {
  const cookieName = req.params.name;

  res.clearCookie(cookieName);

  console.log(`🗑️  クッキー "${cookieName}" を削除しました`);

  res.json({
    success: true,
    message: `Cookie "${cookieName}" cleared!`,
    cleared: cookieName
  });
});

// ルート: すべてのクッキーを表示（デバッグ用）
app.get('/api/debug/cookies', (req, res) => {
  console.log('🔍 デバッグ: すべてのクッキー:', req.cookies);

  res.json({
    cookies: req.cookies,
    cookieHeader: req.headers.cookie
  });
});

// ルート: クッキーの属性デモ
app.get('/api/demo/cookie-attributes', (req, res) => {
  // 様々な属性のクッキーを設定

  // 1. セッションクッキー（ブラウザを閉じると削除）
  res.cookie('session', 'temporary');

  // 2. 永続的クッキー（Max-Age）
  res.cookie('persistent_maxage', 'lasts-1-hour', {
    maxAge: 3600000 // 1時間
  });

  // 3. 永続的クッキー（Expires）
  const expiresDate = new Date();
  expiresDate.setHours(expiresDate.getHours() + 1);
  res.cookie('persistent_expires', 'lasts-1-hour', {
    expires: expiresDate
  });

  // 4. HttpOnly クッキー（JavaScript からアクセス不可）
  res.cookie('httponly_cookie', 'secret-value', {
    httpOnly: true
  });

  // 5. パス指定クッキー
  res.cookie('path_cookie', 'only-for-api', {
    path: '/api'
  });

  // 6. SameSite 属性
  res.cookie('samesite_strict', 'strict-value', {
    sameSite: 'strict'
  });

  res.cookie('samesite_lax', 'lax-value', {
    sameSite: 'lax'
  });

  console.log('🎭 様々な属性のクッキーを設定しました');

  res.json({
    success: true,
    message: 'Cookie attributes demo - check your browser devtools!',
    cookies: [
      'session (session cookie)',
      'persistent_maxage (Max-Age: 1 hour)',
      'persistent_expires (Expires: 1 hour)',
      'httponly_cookie (HttpOnly: true)',
      'path_cookie (Path: /api)',
      'samesite_strict (SameSite: Strict)',
      'samesite_lax (SameSite: Lax)'
    ]
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
  console.log('🍪 Lesson 01: Basic Cookies');
  console.log('='.repeat(50));
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📚 このレッスンで学ぶこと:`);
  console.log(`   - クッキーの基本的な仕組み`);
  console.log(`   - Set-Cookie と Cookie ヘッダー`);
  console.log(`   - クッキーの主要な属性`);
  console.log(`   - クッキーの設定・読み取り・削除`);
  console.log('\n' + '='.repeat(50));
  console.log('🚀 ブラウザで http://localhost:' + PORT + ' にアクセスしてください');
  console.log('='.repeat(50) + '\n');
});
