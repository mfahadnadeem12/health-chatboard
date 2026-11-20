import config, { CATEGORIES } from './config.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { loadUser } from './auth.js';
import authRoutes from './routes/auth.js';
import threadRoutes from './routes/threads.js';

const app = express();
app.disable('x-powered-by');
if (config.isProd) app.set('trust proxy', 1);

// Security headers. The page may only talk to itself, Google sign-in and OpenRouter.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", 'https://accounts.google.com'],
        'frame-src': ['https://accounts.google.com'],
        'connect-src': ["'self'", 'https://openrouter.ai', 'https://accounts.google.com'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
        'img-src': ["'self'", 'data:', 'https:'],
        'upgrade-insecure-requests': null,
      },
    },
    // Google's sign-in popup needs this relaxed value.
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  })
);
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());
app.use(loadUser);

// The browser reads these at startup, so nothing secret or build-time lives in the client.
app.get('/api/config', (_req, res) => {
  res.json({ googleClientId: config.googleClientId, categories: CATEGORIES });
});
app.use('/api/auth', authRoutes);
app.use('/api', threadRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

// In production, serve the built React app from this same server.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next()));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status && err.status < 500 ? err.status : 500;
  res.status(status).json({ error: status < 500 ? err.message : 'Something went wrong. Try again.' });
});

mongoose.set('strictQuery', true);
mongoose
  .connect(config.mongoUri)
  .then(() => {
    app.listen(config.port, () => console.log(`Server on http://localhost:${config.port}`));
  })
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });
