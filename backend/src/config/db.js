import mysql from 'mysql2/promise';
import { env } from './env.js';

export const dbConfig = {
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 10000,
  timezone: 'Z',
};

export const db = mysql.createPool(dbConfig);
