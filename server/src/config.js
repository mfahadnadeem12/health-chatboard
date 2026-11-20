import 'dotenv/config';

const required = ['MONGODB_URI', 'JWT_SECRET', 'GOOGLE_CLIENT_ID'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}. Copy server/.env.example to server/.env and fill it in.`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters.');
  process.exit(1);
}

export const CATEGORIES = [
  'General',
  'Sleep',
  'Nutrition',
  'Mental health',
  'Chronic conditions',
  'Medications',
  'Fitness',
  'Children & family',
];

export default {
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  adminEmails: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  port: Number(process.env.PORT) || 4000,
  isProd: process.env.NODE_ENV === 'production',
};
