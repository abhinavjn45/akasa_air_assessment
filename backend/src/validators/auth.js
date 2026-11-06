import { z } from 'zod';

export const emptyObject = z.object({}).strip();

export const loginBody = z.object({
  email: z.string().trim().toLowerCase().email().max(191),
  password: z.string().min(1).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
  rememberMe: z.boolean().default(false),
}).strip();

export const emptyRequest = { body: emptyObject, query: emptyObject, params: emptyObject };
