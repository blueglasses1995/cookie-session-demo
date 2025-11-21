import express from 'express';
import cookieSession from 'cookie-session';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = 3004;

const ABSOLUTE_TIMEOUT = 12 * 60 * 60 * 1000; // 12時間
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30分

app.use(cookieSession({
  name: 'session',
  keys: ['secret-key-expiration'],
  maxAge: ABSOLUTE_TIMEOUT
}));

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const users = [
  { id: 1, username: 'alice', password: 'password123' },
  { id: 2, username: 'bob', password: 'password456' }
];

function checkSessionExpiration(req, res, next) {
  if (!req.session || !req.session.userId) {
    return next();
  }

  const now = Date.now();
  const loginTime = req.session.loginAt;
  const lastAccessTime = req.session.lastAccess;

  if (now - loginTime > ABSOLUTE_TIMEOUT) {
    req.session = null;
    return res.status(401).json({
      success: false,
      message: 'Session expired (absolute timeout)',
      reason: 'absolute'
    });
  }

  if (now - lastAccessTime > IDLE_TIMEOUT) {
    req.session = null;
    return res.status(401).json({
      success: false,
      message: 'Session expired (idle timeout)',
      reason: 'idle'
    });
  }

  req.session.lastAccess = now;
  req.sessionExpiry = {
    remainingAbsolute: loginTime + ABSOLUTE_TIMEOUT - now,
    remainingIdle: IDLE_TIMEOUT
  };

  next();
}

app.use(checkSessionExpiration);

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const now = Date.now();
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.loginAt = now;
  req.session.lastAccess = now;

  res.json({
    success: true,
    user: { id: user.id, username: user.username },
    expiry: {
      absoluteTimeout: ABSOLUTE_TIMEOUT,
      idleTimeout: IDLE_TIMEOUT
    }
  });
});

app.get('/api/profile', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  res.json({
    success: true,
    user: {
      userId: req.session.userId,
      username: req.session.username,
      loginAt: req.session.loginAt,
      lastAccess: req.session.lastAccess
    },
    expiry: req.sessionExpiry
  });
});

app.post('/api/logout', (req, res) => {
  req.session = null;
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log('\\n' + '='.repeat(50));
  console.log('⏰ Lesson 04: Session Expiration');
  console.log('='.repeat(50));
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`   - Absolute timeout: ${ABSOLUTE_TIMEOUT / 1000 / 60 / 60} hours`);
  console.log(`   - Idle timeout: ${IDLE_TIMEOUT / 1000 / 60} minutes`);
  console.log('='.repeat(50) + '\\n');
});
