import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../config/db.js';
import { asyncHandler } from '../middlewares/errors.js';
import { requireAuth, requireRole } from '../middlewares/security.js';
import { validate } from '../middlewares/validate.js';
import { httpError } from '../utils/http-error.js';
import { uploadDocument, deleteDocument, downloadDocument } from '../services/cloudinary.js';

const router = Router();
const empty = z.object({}).strip();
const id = z.object({ id: z.string().uuid() }).strip();
const attachmentParams = id.extend({ attachmentId: z.string().uuid() });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(value + 'T00:00:00Z');
  return Number(value.slice(0, 4)) >= 1000 && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const attachmentList = z.array(z.object({
  name: z.string().trim().min(1).max(200),
  content: z.string().min(1).max(4194304).regex(/^[A-Za-z0-9+/]*={0,2}$/),
}).strip()).max(3).default([]);
const createBody = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.string().regex(/^[A-Z_]{1,32}$/),
  fromDate: date, toDate: date, reason: z.string().trim().min(1).max(2000),
  attachments: attachmentList,
}).strip();
const actionBody = z.object({ decision: z.enum(['APPROVED', 'REJECTED', 'INFO_REQUESTED']), comment: z.string().trim().min(1).max(2000) }).strip();
const responseBody = z.object({ response: z.string().trim().min(1).max(2000), attachments: attachmentList }).strip();
const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  scope: z.enum(['current', 'history']).default('current'),
  search: z.string().trim().max(100).default(''),
  status: z.enum(['', 'PENDING_MANAGER', 'NEEDS_INFORMATION', 'PENDING_HOD', 'APPROVED', 'REJECTED']).default(''),
  category: z.enum(['', 'CASUAL', 'SICK', 'EARNED']).default(''),
  sort: z.enum(['title', 'employee', 'dates', 'status', 'submitted']).default('submitted'),
  direction: z.enum(['asc', 'desc']).default('desc'),
}).strip();
const packet = (data, req) => ({ data, meta: { requestId: req.id } });

function todayInIndia() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

async function canView(user, row) {
  if (user.role_code === 'EMPLOYEE') return row.employee_user_id === user.id;
  if (user.role_code === 'MANAGER') return true;
  if (user.role_code !== 'HOD') return false;
  if (row.status === 'PENDING_HOD') return true;
  const [actions] = await db.execute("SELECT id FROM approval_actions WHERE leave_request_id = ? AND stage = 'HOD' LIMIT 1", [row.id]);
  return actions.length > 0;
}

async function getLeave(connection, requestId, lock = false) {
  const [rows] = await connection.execute(`SELECT * FROM leave_requests WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [requestId]);
  if (!rows.length) throw httpError(404, 'NOT_FOUND', 'Request not found.');
  return rows[0];
}

async function audit(connection, userId, leaveId, action, requestId) {
  await connection.execute('INSERT INTO audit_events (id, actor_user_id, leave_request_id, action, request_id) VALUES (?, ?, ?, ?, ?)', [randomUUID(), userId, leaveId, action, requestId]);
}

router.use(requireAuth);
router.get('/balances', requireRole('EMPLOYEE'), validate({
  body: empty,
  query: z.object({ year: z.coerce.number().int().min(1000).max(9999) }).strip(),
  params: empty,
}), asyncHandler(async (req, res) => {
  const { year } = req.validated.query;
  const [rows] = await db.execute(
    `SELECT c.code, c.name, COALESCE(e.annual_days, c.default_annual_days) AS annual_days,
      COALESCE(SUM(CASE WHEN r.status = 'APPROVED' THEN DATEDIFF(r.to_date, r.from_date) + 1 ELSE 0 END), 0) AS approved_days,
      COALESCE(SUM(CASE WHEN r.status IN ('PENDING_MANAGER', 'NEEDS_INFORMATION', 'PENDING_HOD') THEN DATEDIFF(r.to_date, r.from_date) + 1 ELSE 0 END), 0) AS pending_days
     FROM leave_categories c
     LEFT JOIN leave_entitlements e ON e.category_code = c.code AND e.user_id = ? AND e.leave_year = ?
     LEFT JOIN leave_requests r ON r.category_code = c.code AND r.employee_user_id = ? AND YEAR(r.from_date) = ?
     WHERE c.is_active = 1 GROUP BY c.code, c.name, e.annual_days, c.default_annual_days ORDER BY c.name`,
    [req.auth.id, year, req.auth.id, year],
  );
  res.json(packet(rows.map((row) => ({
    code: row.code, name: row.name, annualDays: Number(row.annual_days),
    approvedDays: Number(row.approved_days), pendingDays: Number(row.pending_days),
    availableDays: Math.max(0, Number(row.annual_days) - Number(row.approved_days) - Number(row.pending_days)),
  })), req));
}));
router.get('/', validate({ body: empty, query: listQuery, params: empty }), asyncHandler(async (req, res) => {
  const { page, limit, scope, search, status, category, sort, direction } = req.validated.query;
  const user = req.auth;
  const where = [user.role_code === 'EMPLOYEE' ? 'employee_user_id = ?'
    : user.role_code === 'MANAGER' ? (scope === 'history' ? "status IN ('APPROVED','REJECTED')" : "status IN ('PENDING_MANAGER','NEEDS_INFORMATION','PENDING_HOD')")
      : user.role_code === 'HOD' ? (scope === 'history' ? "status IN ('APPROVED','REJECTED') AND EXISTS (SELECT 1 FROM approval_actions a WHERE a.leave_request_id = leave_requests.id AND a.stage = 'HOD')" : "status = 'PENDING_HOD'") : '1 = 0'];
  const values = user.role_code === 'EMPLOYEE' ? [user.id] : [];
  if (user.role_code === 'EMPLOYEE' && scope === 'history') where.push("status IN ('APPROVED','REJECTED')");
  if (search) { where.push('(title LIKE ? OR employee_name LIKE ? OR reason LIKE ?)'); values.push(...Array(3).fill(`%${search}%`)); }
  if (status) { where.push('status = ?'); values.push(status); }
  if (category) { where.push('category_code = ?'); values.push(category); }
  const filter = where.map((condition) => `(${condition})`).join(' AND ');
  const sortColumn = { title: 'title', employee: 'employee_name', dates: 'from_date', status: 'status', submitted: 'created_at' }[sort];
  const order = direction === 'asc' ? 'ASC' : 'DESC';
  const [counts] = await db.execute(`SELECT COUNT(*) AS total FROM leave_requests WHERE ${filter}`, values);
  const [rows] = await db.execute(`SELECT id, title, category_code, employee_name, from_date, to_date, reason, status, created_at FROM leave_requests WHERE ${filter} ORDER BY ${sortColumn} ${order}, id ${order} LIMIT ? OFFSET ?`, [...values, limit, (page - 1) * limit]);
  res.json({ data: rows, meta: { requestId: req.id, pagination: { page, limit, total: counts[0].total } } });
}));

router.post('/', requireRole('EMPLOYEE'), validate({ body: createBody, query: empty, params: empty }), asyncHandler(async (req, res) => {
  req.setTimeout(120000);
  const { title, category, fromDate, toDate, reason, attachments } = req.validated.body;
  if (fromDate < todayInIndia()) throw httpError(422, 'PAST_LEAVE_DATE', 'The start date cannot be before today.');
  if (toDate < fromDate) throw httpError(422, 'INVALID_DATE_RANGE', 'The end date must be on or after the start date.');
  if (fromDate.slice(0, 4) !== toDate.slice(0, 4)) throw httpError(422, 'CROSS_YEAR_REQUEST', 'Submit separate requests for different calendar years.');
  const year = Number(fromDate.slice(0, 4));
  const days = (Date.parse(toDate + 'T00:00:00Z') - Date.parse(fromDate + 'T00:00:00Z')) / 86400000 + 1;
  if (days > 3 && !attachments.length) throw httpError(422, 'EVIDENCE_REQUIRED', 'Attach a document for leave longer than three days.');
  const uploaded = [];
  let committed = false;
  let connection;
  try {
    for (const attachment of attachments) uploaded.push({ ...await uploadDocument(attachment), name: attachment.name.replace(/[\\/\x00-\x1f]/g, '_') });
    connection = await db.getConnection();
    const requestId = randomUUID();
    await connection.beginTransaction();
    await connection.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [req.auth.id]);
    const [categories] = await connection.execute('SELECT code, default_annual_days FROM leave_categories WHERE code = ? AND is_active = 1', [category]);
    if (!categories.length) throw httpError(400, 'INVALID_CATEGORY', 'Choose an available leave type.');
    await connection.execute('INSERT IGNORE INTO leave_entitlements (user_id, category_code, leave_year, annual_days) VALUES (?, ?, ?, ?)', [req.auth.id, category, year, categories[0].default_annual_days]);
    const [entitlements] = await connection.execute('SELECT annual_days FROM leave_entitlements WHERE user_id = ? AND category_code = ? AND leave_year = ? FOR UPDATE', [req.auth.id, category, year]);
    const [usage] = await connection.execute(
      "SELECT COALESCE(SUM(DATEDIFF(to_date, from_date) + 1), 0) AS used_days FROM leave_requests WHERE employee_user_id = ? AND category_code = ? AND YEAR(from_date) = ? AND status IN ('PENDING_MANAGER', 'NEEDS_INFORMATION', 'PENDING_HOD', 'APPROVED')",
      [req.auth.id, category, year],
    );
    if (Number(usage[0].used_days) + days > entitlements[0].annual_days) throw httpError(422, 'INSUFFICIENT_BALANCE', 'This request exceeds your available leave balance.');
    const [overlaps] = await connection.execute(
      "SELECT id FROM leave_requests WHERE employee_user_id = ? AND status <> 'REJECTED' AND from_date <= ? AND to_date >= ? LIMIT 1",
      [req.auth.id, toDate, fromDate],
    );
    if (overlaps.length) throw httpError(409, 'OVERLAPPING_LEAVE', 'Your request overlaps an existing leave request.');
    await connection.execute('INSERT INTO leave_requests (id, employee_user_id, employee_name, title, category_code, from_date, to_date, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [requestId, req.auth.id, req.auth.display_name, title, category, fromDate, toDate, reason]);
    for (const file of uploaded) await connection.execute('INSERT INTO leave_attachments (id, leave_request_id, uploader_user_id, filename, media_type, byte_size, storage_key) VALUES (?, ?, ?, ?, ?, ?, ?)', [randomUUID(), requestId, req.auth.id, file.name, file.mediaType, file.byteSize, file.storageKey]);
    await audit(connection, req.auth.id, requestId, 'LEAVE_CREATED', req.id);
    await connection.commit();
    committed = true;
    res.status(201).json(packet({ id: requestId, status: 'PENDING_MANAGER' }, req));
  } catch (error) {
    if (!committed) {
      if (connection) await connection.rollback().catch(() => {});
      await Promise.allSettled(uploaded.map((file) => deleteDocument(file.storageKey)));
    }
    throw error;
  } finally { connection?.release(); }
}));

router.get('/:id', validate({ body: empty, query: empty, params: id }), asyncHandler(async (req, res) => {
  const row = await getLeave(db, req.validated.params.id);
  if (!await canView(req.auth, row)) throw httpError(404, 'NOT_FOUND', 'Request not found.');
  const [attachments] = await db.execute('SELECT id, filename, media_type, byte_size FROM leave_attachments WHERE leave_request_id = ?', [row.id]);
  const [actions] = await db.execute('SELECT id, stage, decision, comment, created_at FROM approval_actions WHERE leave_request_id = ? ORDER BY created_at, id', [row.id]);
  const [responses] = await db.execute('SELECT id, response, created_at FROM information_responses WHERE leave_request_id = ? ORDER BY created_at, id', [row.id]);
  res.json(packet({ request: row, attachments, actions, responses }, req));
}));

router.get('/:id/attachments/:attachmentId', validate({ body: empty, query: empty, params: attachmentParams }), asyncHandler(async (req, res) => {
  const row = await getLeave(db, req.validated.params.id);
  if (!await canView(req.auth, row)) throw httpError(404, 'NOT_FOUND', 'Request not found.');
  const [files] = await db.execute('SELECT storage_key, media_type FROM leave_attachments WHERE id = ? AND leave_request_id = ?', [req.validated.params.attachmentId, row.id]);
  if (!files.length) throw httpError(404, 'NOT_FOUND', 'Document not found.');
  const bytes = await downloadDocument(files[0].storage_key);
  await audit(db, req.auth.id, row.id, 'DOCUMENT_DOWNLOADED', req.id);
  res.set({ 'Content-Type': files[0].media_type, 'Content-Disposition': 'attachment', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).send(bytes);
}));

router.post('/:id/actions', requireRole('MANAGER', 'HOD'), validate({ body: actionBody, query: empty, params: id }), asyncHandler(async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const initial = await getLeave(connection, req.validated.params.id);
    await connection.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [initial.employee_user_id]);
    const row = await getLeave(connection, req.validated.params.id, true);
    const stage = req.auth.role_code;
    if (row.employee_user_id === req.auth.id) throw httpError(403, 'FORBIDDEN', 'You cannot review your own request.');
    if (row.status !== (stage === 'MANAGER' ? 'PENDING_MANAGER' : 'PENDING_HOD')) throw httpError(409, 'STALE_REQUEST', 'This request is no longer awaiting your decision.');
    const { decision, comment } = req.validated.body;
    if (decision === 'APPROVED' && row.category_code) {
      const year = new Date(row.from_date).getUTCFullYear();
      const [balances] = await connection.execute(
        `SELECT e.annual_days, COALESCE(SUM(DATEDIFF(r.to_date, r.from_date) + 1), 0) AS used_days
         FROM leave_entitlements e LEFT JOIN leave_requests r
           ON r.employee_user_id = e.user_id AND r.category_code = e.category_code
           AND YEAR(r.from_date) = e.leave_year
           AND r.status IN ('PENDING_MANAGER', 'NEEDS_INFORMATION', 'PENDING_HOD', 'APPROVED')
         WHERE e.user_id = ? AND e.category_code = ? AND e.leave_year = ?
         GROUP BY e.annual_days`,
        [row.employee_user_id, row.category_code, year],
      );
      if (!balances.length || Number(balances[0].used_days) > balances[0].annual_days) {
        throw httpError(409, 'INSUFFICIENT_BALANCE', 'The employee no longer has enough leave available for this approval.');
      }
    }
    const days = (new Date(row.to_date).getTime() - new Date(row.from_date).getTime()) / 86400000 + 1;
    const next = decision === 'INFO_REQUESTED' ? 'NEEDS_INFORMATION' : decision === 'REJECTED' ? 'REJECTED' : stage === 'MANAGER' && days > 3 ? 'PENDING_HOD' : 'APPROVED';
    await connection.execute('UPDATE leave_requests SET status = ? WHERE id = ?', [next, row.id]);
    await connection.execute('INSERT INTO approval_actions (id, leave_request_id, actor_user_id, stage, decision, comment) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), row.id, req.auth.id, stage, decision, comment]);
    await audit(connection, req.auth.id, row.id, decision, req.id);
    await connection.commit();
    res.json(packet({ status: next }, req));
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}));

router.post('/:id/responses', requireRole('EMPLOYEE'), validate({ body: responseBody, query: empty, params: id }), asyncHandler(async (req, res) => {
  req.setTimeout(120000);
  const existing = await getLeave(db, req.validated.params.id);
  if (existing.employee_user_id !== req.auth.id) throw httpError(404, 'NOT_FOUND', 'Request not found.');
  if (existing.status !== 'NEEDS_INFORMATION') throw httpError(409, 'STALE_REQUEST', 'This request is not waiting for information.');
  const uploaded = [];
  let connection;
  let committed = false;
  try {
    for (const attachment of req.validated.body.attachments) {
      uploaded.push({ ...await uploadDocument(attachment), name: attachment.name.replace(/[\\/\x00-\x1f]/g, '_') });
    }
    connection = await db.getConnection();
    await connection.beginTransaction();
    const row = await getLeave(connection, req.validated.params.id, true);
    if (row.employee_user_id !== req.auth.id) throw httpError(404, 'NOT_FOUND', 'Request not found.');
    if (row.status !== 'NEEDS_INFORMATION') throw httpError(409, 'STALE_REQUEST', 'This request is not waiting for information.');
    const [informationRequests] = await connection.execute(
      "SELECT stage FROM approval_actions WHERE leave_request_id = ? AND decision = 'INFO_REQUESTED' ORDER BY created_at DESC, id DESC LIMIT 1",
      [row.id],
    );
    const stage = informationRequests[0]?.stage;
    if (stage !== 'MANAGER' && stage !== 'HOD') throw httpError(409, 'INVALID_REQUEST_STATE', 'The review stage could not be determined.');
    const nextStatus = stage === 'HOD' ? 'PENDING_HOD' : 'PENDING_MANAGER';
    await connection.execute('INSERT INTO information_responses (id, leave_request_id, author_user_id, response) VALUES (?, ?, ?, ?)', [randomUUID(), row.id, req.auth.id, req.validated.body.response]);
    for (const file of uploaded) {
      await connection.execute('INSERT INTO leave_attachments (id, leave_request_id, uploader_user_id, filename, media_type, byte_size, storage_key) VALUES (?, ?, ?, ?, ?, ?, ?)', [randomUUID(), row.id, req.auth.id, file.name, file.mediaType, file.byteSize, file.storageKey]);
    }
    await connection.execute('UPDATE leave_requests SET status = ? WHERE id = ?', [nextStatus, row.id]);
    await audit(connection, req.auth.id, row.id, 'INFORMATION_PROVIDED', req.id);
    await connection.commit();
    committed = true;
    res.json(packet({ status: nextStatus }, req));
  } catch (error) {
    if (!committed) {
      if (connection) await connection.rollback().catch(() => {});
      await Promise.allSettled(uploaded.map((file) => deleteDocument(file.storageKey)));
    }
    throw error;
  } finally { connection?.release(); }
}));

export default router;
