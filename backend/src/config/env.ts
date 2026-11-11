import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from './logger.js';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().positive()).default('5000'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // PostgreSQL
  DATABASE_URL: z.string().default('postgresql://atti_user:atti_secret@localhost:5432/atti_db?schema=public'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // Firebase
  FIREBASE_PROJECT_ID: z.string().optional().default('atti-dev'),
  FIREBASE_CLIENT_EMAIL: z.string().optional().default(''),
  FIREBASE_PRIVATE_KEY: z.string().optional().default(''),

  // Phone + PIN / JWT Auth
  JWT_SECRET: z.string().optional().default(''),

  // WebRTC STUN / TURN
  STUN_SERVERS: z.string().default('stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302'),
  TURN_SERVER_URL: z.string().optional().default(''),
  TURN_USERNAME: z.string().optional().default(''),
  TURN_CREDENTIAL: z.string().optional().default(''),
  TURN_SECRET: z.string().optional().default(''),
  TURN_TTL_SECONDS: z
    .string()
    .transform(Number)
    .pipe(z.number().positive())
    .default('86400'),

  // S3 / Storage
  S3_ENDPOINT: z.string().optional().default(''),
  S3_BUCKET: z.string().optional().default('atti-media'),
  S3_REGION: z.string().optional().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),

  // Web Push (VAPID)
  VAPID_PUBLIC_KEY: z.string().optional().default(''),
  VAPID_PRIVATE_KEY: z.string().optional().default(''),
  VAPID_SUBJECT: z.string().default('mailto:support@pingup.app'),
});

export type EnvConfig = z.infer<typeof envSchema>;

function parseEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    logger.error('Invalid environment variables configuration:', result.error.format());
    throw new Error('Environment configuration validation failed');
  }
  return result.data;
}

export const env = parseEnv();

