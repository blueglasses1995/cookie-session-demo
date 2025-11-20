# Lesson 01: 基本的なクッキーの仕組み

## 📋 概要

このレッスンでは、HTTP クッキーの基本的な仕組みを学びます。クッキーは Web アプリケーションでクライアントにデータを保存する最も基本的な方法です。

## 🎯 学習目標

- クッキーとは何かを理解する
- Set-Cookie ヘッダーと Cookie ヘッダーの仕組みを学ぶ
- クッキーの主要な属性を理解する
- 実際にクッキーを設定・読み取る方法を習得する

## 🔍 クッキーとは？

**HTTP クッキー**は、サーバーがユーザーのブラウザに送信する小さなデータの断片です。ブラウザはこのデータを保存し、次回以降の同じサーバーへのリクエストに自動的に含めて送信します。

### なぜクッキーが必要なのか？

HTTP プロトコルは**ステートレス**（状態を持たない）です。つまり、各リクエストは独立しており、サーバーは以前のリクエストを「覚えていません」。クッキーはこの問題を解決し、ユーザーの状態を保持できるようにします。

## 🔧 技術的原理

### クッキーの動作フロー

```
┌──────────┐                           ┌──────────┐
│ Browser  │                           │  Server  │
└────┬─────┘                           └────┬─────┘
     │                                      │
     │  ① GET /login (username=alice)       │
     │ ─────────────────────────────────────>│
     │                                      │
     │                                      │ ② サーバーがユーザーを認証
     │                                      │    クッキーを生成
     │                                      │
     │  ③ 200 OK                            │
     │    Set-Cookie: user=alice            │
     │ <─────────────────────────────────────│
     │                                      │
     ├─ ④ ブラウザがクッキーを保存          │
     │                                      │
     │  ⑤ GET /profile                      │
     │    Cookie: user=alice                │
     │ ─────────────────────────────────────>│
     │                                      │
     │                                      │ ⑥ クッキーからユーザーを識別
     │                                      │
     │  ⑦ 200 OK (Welcome, alice!)          │
     │ <─────────────────────────────────────│
     │                                      │
```

### Set-Cookie ヘッダー

サーバーがクッキーを設定するために使用します：

```http
HTTP/1.1 200 OK
Set-Cookie: username=alice
Set-Cookie: theme=dark; Max-Age=3600
Content-Type: text/html
```

### Cookie ヘッダー

ブラウザがサーバーにクッキーを送信するために使用します：

```http
GET /profile HTTP/1.1
Host: example.com
Cookie: username=alice; theme=dark
```

## 📊 クッキーの主要属性

### 1. Name=Value（必須）

```
Set-Cookie: username=alice
```

クッキーの名前と値のペア。これが最も基本的な形式です。

### 2. Expires / Max-Age

```
Set-Cookie: session=abc123; Expires=Wed, 21 Oct 2025 07:28:00 GMT
Set-Cookie: session=abc123; Max-Age=3600
```

- **Expires**: 絶対的な有効期限（GMT 形式の日時）
- **Max-Age**: 相対的な有効期限（秒数）
- 両方とも指定されない場合：**セッションクッキー**（ブラウザを閉じると削除）

### 3. Domain

```
Set-Cookie: user=alice; Domain=example.com
```

クッキーが送信されるドメインを指定します。サブドメインにも適用されます。

### 4. Path

```
Set-Cookie: user=alice; Path=/admin
```

クッキーが送信される URL パスを指定します。`/admin` とその下位パスにのみ送信されます。

### 5. Secure

```
Set-Cookie: session=abc123; Secure
```

HTTPS 接続でのみクッキーが送信されます（重要なセキュリティ属性）。

### 6. HttpOnly

```
Set-Cookie: session=abc123; HttpOnly
```

JavaScript からクッキーにアクセスできなくなります（XSS 対策）。

### 7. SameSite

```
Set-Cookie: session=abc123; SameSite=Strict
```

- **Strict**: 同一サイトからのリクエストのみ
- **Lax**: トップレベルナビゲーションでは送信（デフォルト）
- **None**: 常に送信（Secure 必須）

## ✅ メリット

1. **シンプル**: 実装が簡単で理解しやすい
2. **自動送信**: ブラウザが自動的にクッキーを送信
3. **永続化**: ブラウザを閉じても保持可能（Expires/Max-Age 設定時）
4. **標準化**: すべてのブラウザがサポート
5. **サーバーサイド制御**: サーバーがクッキーの設定・削除を完全に制御

## ❌ デメリット

1. **サイズ制限**: 1 つのクッキーは約 4KB まで
2. **セキュリティリスク**: 適切に設定しないと盗聴・改ざんのリスク
3. **プライバシー**: トラッキングに使用される可能性
4. **パフォーマンス**: すべてのリクエストに自動的に含まれる
5. **ドメイン制限**: クッキーは同一ドメイン内でのみ共有可能

## 🎯 ユースケース

### 適している場面

1. **ユーザー設定の保存**
   ```javascript
   // テーマ、言語設定など
   Set-Cookie: theme=dark
   Set-Cookie: lang=ja
   ```

2. **セッション識別**
   ```javascript
   // セッション ID の保存
   Set-Cookie: sessionId=abc123; HttpOnly; Secure
   ```

3. **ユーザー追跡**
   ```javascript
   // 分析・トラッキング
   Set-Cookie: trackingId=xyz789; Max-Age=31536000
   ```

### 適していない場面

1. **大量のデータ保存**: localStorage や IndexedDB を使用
2. **機密情報の保存**: 暗号化なしでは危険
3. **クロスドメインデータ共有**: CORS や別の方法が必要

## 💻 実装例

### サーバーサイド（Node.js + Express）

```javascript
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();
app.use(cookieParser());

// クッキーの設定
app.get('/set-cookie', (req, res) => {
  // シンプルなクッキー
  res.cookie('username', 'alice');

  // オプション付きクッキー
  res.cookie('theme', 'dark', {
    maxAge: 3600000, // 1時間（ミリ秒）
    httpOnly: true,  // JavaScript からアクセス不可
    secure: false,   // HTTP でも送信（開発環境用）
    sameSite: 'lax'  // CSRF 対策
  });

  res.send('Cookies set!');
});

// クッキーの読み取り
app.get('/get-cookie', (req, res) => {
  const username = req.cookies.username;
  const theme = req.cookies.theme;

  res.json({
    username,
    theme,
    allCookies: req.cookies
  });
});

// クッキーの削除
app.get('/clear-cookie', (req, res) => {
  res.clearCookie('username');
  res.clearCookie('theme');
  res.send('Cookies cleared!');
});
```

### クライアントサイド（JavaScript）

```javascript
// JavaScript からクッキーを読み取る
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
}

// 使用例
const username = getCookie('username');
console.log('Username:', username);

// 注意: HttpOnly 属性が設定されたクッキーは
// JavaScript から読み取れません
```

## 🚀 実際に試してみよう

### 1. サーバーの起動

```bash
npm run lesson01
```

### 2. ブラウザでアクセス

```
http://localhost:3001
```

### 3. 確認手順

1. **クッキーの設定**: 「Set Cookie」ボタンをクリック
2. **開発者ツール**: F12 → Application/Storage → Cookies を確認
3. **クッキーの読み取り**: 「Get Cookie」ボタンをクリック
4. **クッキーの削除**: 「Clear Cookie」ボタンをクリック

### 4. 観察ポイント

- **Network タブ**: Response Headers の `Set-Cookie` を確認
- **Application タブ**: 保存されたクッキーの値と属性を確認
- **Console タブ**: `document.cookie` を実行してクッキーを確認

## 🔐 セキュリティの注意点

### ⚠️ やってはいけないこと

```javascript
// ❌ 機密情報をそのまま保存
res.cookie('password', '12345');  // 絶対にダメ！

// ❌ Secure フラグなしで本番環境に
res.cookie('session', 'abc', { secure: false });  // 本番では危険

// ❌ HttpOnly なしでセッション ID を保存
res.cookie('sessionId', 'xyz');  // XSS 攻撃に脆弱
```

### ✅ 推奨される実装

```javascript
// ✅ セキュアな設定
res.cookie('sessionId', generateSecureId(), {
  httpOnly: true,   // JavaScript からアクセス不可
  secure: true,     // HTTPS のみ
  sameSite: 'strict',  // CSRF 対策
  maxAge: 3600000   // 1時間で期限切れ
});
```

## 📝 演習問題

### 初級

1. "favoriteColor" という名前で "blue" という値のクッキーを設定してください
2. そのクッキーを読み取って画面に表示してください
3. クッキーを削除する機能を追加してください

### 中級

4. 訪問回数をカウントするクッキーを実装してください
5. 最終訪問日時を保存するクッキーを実装してください
6. 1 週間有効なクッキーを設定してください

### 上級

7. 複数のクッキーを一度に設定・取得する関数を実装してください
8. クッキーの値を URL エンコード/デコードする処理を追加してください
9. クッキーのサイズが 4KB を超えないようにバリデーションを追加してください

## 🔄 次のステップ

基本的なクッキーの仕組みを理解できましたか？

次は **[Lesson 02: シンプルなセッション管理](../02-simple-session/README.md)** でクッキーを使ったセッション管理を学びます。

---

**重要なポイント**:
- クッキーは HTTP の仕組みの一部
- 適切な属性設定がセキュリティの鍵
- すべてのリクエストに自動的に含まれる
- 次のレッスンでセッション管理に発展させます
