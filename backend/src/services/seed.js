import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';

const credentialsPath = fileURLToPath(new URL('../../.seed-credentials.json', import.meta.url));
const roles = ['EMPLOYEE', 'MANAGER', 'HOD'];

async function loadOrCreateCredentials() {
  try {
    const records = JSON.parse(await readFile(credentialsPath, 'utf8'));
    if (!Array.isArray(records) || !roles.every((role) => records.some((record) => (
      record.role === role && typeof record.id === 'string' && typeof record.email === 'string'
      && typeof record.password === 'string' && record.password.length >= 12
    )))) throw new Error('Invalid seed credentials file.');
    return records;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const suffix = randomBytes(5).toString('hex');
  const records = roles.map((role) => ({
    id: randomUUID(),
    role,
    email: `${role.toLowerCase()}-${suffix}@example.test`,
    password: randomBytes(18).toString('base64url'),
  }));
  await writeFile(credentialsPath, `${JSON.stringify(records, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return records;
}

export async function seedDemoUsers(connection) {
  if (env.NODE_ENV !== 'development') return;

  const [existing] = await connection.execute('SELECT role_code FROM lt_seed_accounts');
  const seededRoles = new Set(existing.map((row) => row.role_code));
  const missing = roles.filter((role) => !seededRoles.has(role));
  if (!missing.length) return;

  const records = await loadOrCreateCredentials();
  for (const role of missing) {
    const account = records.find((record) => record.role === role);
    const passwordHash = await bcrypt.hash(account.password, 12);
    await connection.beginTransaction();
    try {
      await connection.execute(
        'INSERT INTO users (id, email, display_name, password_hash, role_code) VALUES (?, ?, ?, ?, ?)',
        [account.id, account.email, role === 'HOD' ? 'HOD' : role[0] + role.slice(1).toLowerCase(), passwordHash, role],
      );
      await connection.execute('INSERT INTO lt_seed_accounts (role_code, user_id) VALUES (?, ?)', [role, account.id]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
}
