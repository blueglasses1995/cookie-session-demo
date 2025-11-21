import express from 'express';
import cookieSession from 'cookie-session';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = 3005;

app.use(cookieSession({ name: 'session', keys: ['secret-key'], maxAge: 3600000 }));
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const users = [
  { id: 1, username: 'alice', password: 'password123' },
  { id: 2, username: 'bob', password: 'password456' }
];

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.loginAt = new Date().toISOString();
  res.json({ success: true, user: { id: user.id, username: user.username } });
});

app.get('/api/profile', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  res.json({
    success: true,
    user: { userId: req.session.userId, username: req.session.username, loginAt: req.session.loginAt }
  });
});

app.post('/api/logout', (req, res) => {
  req.session = null;
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Lesson 05: Server running at http://localhost:${PORT}`);
});
