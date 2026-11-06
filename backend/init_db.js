import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { db, dbConfig } from './src/config/db.js';
import { env } from './src/config/env.js';
import { managedTables, tableStatements } from './src/config/schema.js';
import { seedDemoUsers } from './src/services/seed.js';

async function connectToDatabase() {
  try {
    return await db.getConnection();
  } catch (error) {
    if (error.code !== 'ER_BAD_DB_ERROR') throw error;

    const { database, host, user, password } = dbConfig;
    const connection = await mysql.createConnection({ host, user, password });
    try {
      await connection.query(`CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } finally {
      await connection.end();
    }
    return db.getConnection();
  }
}

export async function initDb() {
  const connection = await connectToDatabase();
  const lockName = `leave-tracker-init-${createHash('sha256').update(env.DB_NAME).digest('hex').slice(0, 24)}`;
  let locked = false;

  try {
    const [lockRows] = await connection.execute('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
    if (lockRows[0]?.acquired !== 1) throw new Error('Could not acquire the database initialization lock.');
    locked = true;

    const placeholders = managedTables.map(() => '?').join(', ');
    const [existing] = await connection.execute(
      `SELECT TABLE_NAME AS table_name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${placeholders})`,
      [env.DB_NAME, ...managedTables],
    );
    const existingNames = new Set(existing.map((row) => row.table_name.toLowerCase()));
    if (!existingNames.has('lt_schema_migrations') && existingNames.size > 0) {
      throw new Error('The database contains existing application table names without an initialization marker; no tables were changed.');
    }

    await connection.query(`CREATE TABLE IF NOT EXISTS lt_schema_migrations (
      version VARCHAR(64) PRIMARY KEY,
      status ENUM('STARTED','APPLIED') NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    const [markers] = await connection.execute('SELECT status FROM lt_schema_migrations WHERE version = ?', ['001_initial']);
    if (existingNames.has('lt_schema_migrations') && !markers.length && existingNames.size > 1) {
      throw new Error('Existing application tables have no matching initialization marker; no tables were changed.');
    }
    if (!markers.length) {
      await connection.execute('INSERT INTO lt_schema_migrations (version, status) VALUES (?, ?)', ['001_initial', 'STARTED']);
    }

    for (const statement of tableStatements) await connection.query(statement);
    const [leaveColumns] = await connection.execute(
      'SELECT COLUMN_NAME AS column_name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
      [env.DB_NAME, 'leave_requests'],
    );
    const columnNames = new Set(leaveColumns.map((row) => row.column_name.toLowerCase()));
    if (!columnNames.has('title')) await connection.query('ALTER TABLE leave_requests ADD COLUMN title VARCHAR(120) NULL');
    if (!columnNames.has('category_code')) await connection.query('ALTER TABLE leave_requests ADD COLUMN category_code VARCHAR(32) NULL');
    await connection.execute(
      'INSERT IGNORE INTO leave_categories (code, name, default_annual_days) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)',
      ['CASUAL', 'Casual leave', 12, 'SICK', 'Sick leave', 12, 'EARNED', 'Earned leave', 12],
    );
    await connection.execute(
      'INSERT IGNORE INTO roles (code, label) VALUES (?, ?), (?, ?), (?, ?)',
      ['EMPLOYEE', 'Employee', 'MANAGER', 'Manager', 'HOD', 'HOD'],
    );
    await seedDemoUsers(connection);
    await connection.execute('UPDATE lt_schema_migrations SET status = ? WHERE version = ?', ['APPLIED', '001_initial']);
  } finally {
    if (locked) await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => {});
    connection.release();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await initDb();
    console.log('Database structure and role records are ready.');
  } catch (error) {
    console.error(`Database initialization failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
