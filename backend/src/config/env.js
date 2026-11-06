import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DB_HOST: z.string().trim().min(1).max(255),
  DB_USER: z.string().trim().min(1).max(128),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  CORS_ORIGIN: z.string().url().refine((value) => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
  }),
  JWT_ACCESS_SECRET: z.string().min(32),
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && !value.DB_PASSWORD) {
    context.addIssue({ code: 'custom', path: ['DB_PASSWORD'], message: 'A database password is required.' });
  }
  if (value.JWT_ACCESS_SECRET.startsWith('REPLACE_')) {
    context.addIssue({ code: 'custom', path: ['JWT_ACCESS_SECRET'], message: 'Set a unique signing secret.' });
  }
});

const result = schema.safeParse(process.env);

if (!result.success) {
  const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
  throw new Error(`Invalid backend configuration: ${fields.join(', ')}. Check backend/.env.`);
}

export const env = result.data;
