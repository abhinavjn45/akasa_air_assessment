import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { initDb } from '../init_db.js';
import { db } from '../src/config/db.js';

function readPassword(prompt) {
  if (!stdin.isTTY) throw new Error('An interactive terminal is required to enter a password securely.');
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise((resolve, reject) => {
    let password = '';
    function finish(error) {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      if (error) reject(error);
      else resolve(password);
    }
    function onData(chunk) {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') return finish(new Error('Account creation cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') password = Array.from(password).slice(0, -1).join('');
        else if (character >= ' ') password += character;
      }
    }
    stdin.on('data', onData);
  });
}

const accountSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(191),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'HOD']),
  password: z.string().min(12).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
});

try {
  await initDb();
  const prompt = createInterface({ input: stdin, output: stdout });
  let displayName;
  let email;
  let role;
  try {
    displayName = await prompt.question('Display name: ');
    email = await prompt.question('Email: ');
    role = (await prompt.question('Role (EMPLOYEE, MANAGER, HOD): ')).trim().toUpperCase();
  } finally {
    prompt.close();
  }

  const password = await readPassword('Password (at least 12 characters): ');
  const confirmation = await readPassword('Confirm password: ');
  if (password !== confirmation) throw new Error('Passwords do not match.');

  const result = accountSchema.safeParse({ displayName, email, role, password });
  if (!result.success) throw new Error('Check the name, email, role, and password length.');

  const passwordHash = await bcrypt.hash(result.data.password, 12);
  await db.execute(
    'INSERT INTO users (id, email, display_name, password_hash, role_code) VALUES (?, ?, ?, ?, ?)',
    [randomUUID(), result.data.email, result.data.displayName, passwordHash, result.data.role],
  );
  console.log('Account created.');
} catch (error) {
  console.error(error.code === 'ER_DUP_ENTRY' ? 'An account with that email already exists.' : `Account creation failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
