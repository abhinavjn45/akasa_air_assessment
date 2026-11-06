import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronRight, ClipboardList, FileText, LayoutDashboard, LogOut, Menu, Plus, UploadCloud, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';
import { request } from '../lib/api.js';

const labels = {
  PENDING_MANAGER: 'Pending manager', NEEDS_INFORMATION: 'Information needed',
  PENDING_HOD: 'Pending HOD', APPROVED: 'Approved', REJECTED: 'Rejected',
};
const roleNames = { EMPLOYEE: 'Employee', MANAGER: 'Manager', HOD: 'HOD' };
const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-brand-orange px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-hover disabled:opacity-50';
const field = 'mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-orange focus:ring-2 focus:ring-orange-100';
const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-50';

function prettyDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function prettyDateTime(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date);
}

function ApprovalJourney({ request: leave, actions, role }) {
  const duration = Math.round((new Date(leave.to_date).getTime() - new Date(leave.from_date).getTime()) / 86400000) + 1;
  const needsHod = duration > 3 || actions.some((action) => action.stage === 'HOD');
  const latestInfoRequest = [...actions].reverse().find((action) => action.decision === 'INFO_REQUESTED');
  const rejection = [...actions].reverse().find((action) => action.decision === 'REJECTED');
  const managerApproved = actions.some((action) => action.stage === 'MANAGER' && action.decision === 'APPROVED')
    || leave.status === 'PENDING_HOD'
    || actions.some((action) => action.stage === 'HOD');
  const waitingStage = leave.status === 'NEEDS_INFORMATION' ? latestInfoRequest?.stage : null;
  const waitingLabel = role === 'EMPLOYEE' ? 'Waiting for your response' : 'Waiting for employee response';
  let managerState = 'Not started';
  if (leave.status === 'PENDING_MANAGER') managerState = 'In review';
  else if (waitingStage === 'MANAGER') managerState = waitingLabel;
  else if (rejection?.stage === 'MANAGER' && leave.status === 'REJECTED') managerState = 'Rejected';
  else if (managerApproved || leave.status === 'APPROVED') managerState = 'Approved';

  let hodState = 'Not started';
  if (leave.status === 'PENDING_HOD') hodState = 'In review';
  else if (waitingStage === 'HOD') hodState = waitingLabel;
  else if (rejection?.stage === 'HOD' && leave.status === 'REJECTED') hodState = 'Rejected';
  else if (leave.status === 'APPROVED' && needsHod) hodState = 'Approved';
  else if (leave.status === 'REJECTED' && rejection?.stage === 'MANAGER') hodState = 'Not required';

  const finalState = leave.status === 'APPROVED' ? 'Approved' : leave.status === 'REJECTED' ? 'Rejected' : 'Pending';
  const steps = [
    { label: 'Submitted', state: 'Complete' },
    { label: 'Manager review', state: managerState },
    ...(needsHod ? [{ label: 'HOD review', state: hodState }] : []),
    { label: 'Final decision', state: finalState },
  ];

  return <section aria-label="Approval journey" className="rounded-md border border-line bg-slate-50 p-4">
    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Approval journey</h4>
    <ol className="mt-4 grid gap-3 sm:grid-cols-2">
      {steps.map((step, index) => {
        const active = step.state === 'In review' || step.state === waitingLabel;
        const complete = step.state === 'Complete' || step.state === 'Approved';
        const rejected = step.state === 'Rejected';
        return <li key={step.label} className="flex items-start gap-3">
          <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${rejected ? 'border-red-200 bg-red-50 text-red-800' : active ? 'border-orange-300 bg-orange-50 text-orange-800' : complete ? 'border-green-200 bg-green-50 text-green-800' : 'border-line bg-white text-muted'}`}>{index + 1}</span>
          <div><p className="text-sm font-medium text-ink">{step.label}</p><p className="mt-0.5 text-xs text-muted">{step.state}</p></div>
        </li>;
      })}
    </ol>
    {leave.status === 'NEEDS_INFORMATION' && !waitingStage && <p className="mt-3 text-xs text-muted">{waitingLabel}. The review stage is unavailable.</p>}
  </section>;
}

function ActivityTimeline({ actions, responses }) {
  const decisionLabels = { APPROVED: 'Approved', REJECTED: 'Rejected', INFO_REQUESTED: 'Requested more information' };
  const entries = [
    ...actions.map((item) => ({
      key: `action-${item.id}`, timestamp: item.created_at,
      heading: `${item.stage === 'HOD' ? 'HOD' : 'Manager'} · ${decisionLabels[item.decision] || item.decision}`,
      text: item.comment,
    })),
    ...responses.map((item) => ({
      key: `response-${item.id}`, timestamp: item.created_at,
      heading: 'Employee · Response provided', text: item.response,
    })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (!entries.length) return null;
  return <section aria-label="Request activity">
    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Activity timeline</h4>
    <ol className="mt-4 border-l border-line">
      {entries.map((entry) => <li key={entry.key} className="relative pb-5 pl-5 last:pb-0">
        <span aria-hidden="true" className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border border-brand-orange bg-white" />
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold text-ink">{entry.heading}</p>
          <time dateTime={entry.timestamp} className="text-xs text-muted">{prettyDateTime(entry.timestamp)}</time>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted">{entry.text}</p>
      </li>)}
    </ol>
  </section>;
}

function Status({ value }) {
  const color = value === 'APPROVED' ? 'bg-green-50 text-green-800' : value === 'REJECTED' ? 'bg-red-50 text-red-800' : value === 'NEEDS_INFORMATION' ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800';
  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${color}`}>{labels[value] || value}</span>;
}

function LeaveBalances({ balances, loading, error, onRetry, year }) {
  const totals = balances.reduce((sum, item) => ({
    annual: sum.annual + item.annualDays,
    approved: sum.approved + item.approvedDays,
    pending: sum.pending + item.pendingDays,
    available: sum.available + item.availableDays,
  }), { annual: 0, approved: 0, pending: 0, available: 0 });
  const cards = [
    { label: 'Annual allowance', value: totals.annual, icon: CalendarDays },
    { label: 'Approved leave', value: totals.approved, icon: ClipboardList },
    { label: 'Pending reservation', value: totals.pending, icon: FileText },
    { label: 'Leave remaining', value: totals.available, icon: CalendarDays },
  ];

  return <section aria-labelledby="balances-heading" className="mt-8">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div><h2 id="balances-heading" className="text-lg font-semibold text-ink">Leave balances</h2><p className="mt-1 text-sm text-muted">Calendar year {year} · All values are in days</p></div>
    </div>
    {error ? <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      {error} <button type="button" onClick={onRetry} className="ml-2 font-medium underline">Try again</button>
    </div> : loading ? <p role="status" className="mt-4 rounded-lg border border-line bg-white p-6 text-sm text-muted">Loading leave balances…</p>
      : balances.length === 0 ? <p className="mt-4 rounded-lg border border-line bg-white p-6 text-sm text-muted">No leave categories are available.</p>
        : <>
          <div className="dashboard-stats mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-lg border border-line bg-white p-5">
              <div className="flex items-center justify-between text-muted"><p className="text-sm">{label}</p><Icon size={18} /></div>
              <p className="mt-4 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted">days</p>
            </div>)}
          </div>
          <div className="mt-4 rounded-lg border border-line bg-white p-5">
            <h3 className="text-sm font-semibold text-ink">By leave type</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {balances.map((item) => <div key={item.code} className="rounded-md border border-line p-4">
                <div className="flex items-start justify-between gap-3"><h4 className="text-sm font-semibold text-ink">{item.name}</h4><span className="text-xs text-muted">{item.annualDays} days / year</span></div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-xs text-muted">Approved</dt><dd className="mt-1 font-semibold text-ink">{item.approvedDays}</dd></div>
                  <div><dt className="text-xs text-muted">Reserved</dt><dd className="mt-1 font-semibold text-ink">{item.pendingDays}</dd></div>
                  <div><dt className="text-xs text-muted">Remaining</dt><dd className="mt-1 font-semibold text-ink">{item.availableDays}</dd></div>
                </dl>
              </div>)}
            </div>
            <p className="mt-4 text-xs leading-5 text-muted">Approved includes future approved leave. Pending requests reserve days; rejected requests do not use your allowance.</p>
          </div>
        </>}
  </section>;
}

function Modal({ title, onClose, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const focusable = () => [...(dialog.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]') || [])];
    focusable()[0]?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="dashboard-dialog max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 id="dialog-title" className="text-lg font-semibold text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-2 text-muted hover:bg-canvas"><X size={20} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, content: String(reader.result).split(',')[1] });
    reader.onerror = () => reject(new Error('Could not read an attachment.'));
    reader.readAsDataURL(file);
  });
}

function CreateRequest({ onClose, onSaved }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dates, setDates] = useState({ from: '', to: '' });
  const [category, setCategory] = useState('');
  const [balances, setBalances] = useState([]);
  const [balanceError, setBalanceError] = useState('');
  const [balanceLoading, setBalanceLoading] = useState(true);
  const year = dates.from ? Number(dates.from.slice(0, 4)) : new Date().getFullYear();
  const days = dates.from && dates.to ? Math.floor((Date.parse(dates.to) - Date.parse(dates.from)) / 86400000) + 1 : 0;
  const selectedBalance = balances.find((item) => item.code === category);
  useEffect(() => {
    let active = true;
    setBalanceLoading(true);
    setBalanceError('');
    request(`/leave-requests/balances?year=${year}`, { authenticated: true })
      .then((data) => { if (active) setBalances(data); })
      .catch(() => { if (active) { setBalances([]); setBalanceError('Could not load your leave balances. Reopen this form to try again.'); } })
      .finally(() => { if (active) setBalanceLoading(false); });
    return () => { active = false; };
  }, [year]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (days < 1) return setError('Choose an end date on or after the start date.');
    if (dates.from.slice(0, 4) !== dates.to.slice(0, 4)) return setError('Submit separate requests for different calendar years.');
    if (!selectedBalance || days > selectedBalance.availableDays) return setError('This request exceeds your available leave balance.');
    if (days > 3 && !files.length) return setError('Attach a supporting document for leave longer than three days.');
    setBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      await request('/leave-requests', { method: 'POST', authenticated: true, body: {
        title: form.get('title'), category, fromDate: form.get('fromDate'), toDate: form.get('toDate'), reason: form.get('reason'),
        attachments: await Promise.all(files.map(readFile)),
      } });
      onSaved('Leave request submitted.');
    } catch (err) { setError(err.message || 'Could not submit the request.'); setBusy(false); }
  }

  function selectFiles(event) {
    const selected = Array.from(event.target.files || []);
    const combined = [...files, ...selected];
    event.target.value = '';
    if (combined.length > 3 || combined.some((file) => file.size > 3 * 1024 * 1024 || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type))) {
      return setError('Choose up to three PDF, PNG, or JPEG files, each no larger than 3 MB.');
    }
    setError('');
    setFiles(combined);
  }

  return <Modal title="New leave request" onClose={onClose}>
    <form onSubmit={submit} className="space-y-5 p-6">
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {balanceError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{balanceError}</p>}
      <label className="block text-sm font-medium text-ink">Leave title<input className={field} name="title" maxLength="120" required placeholder="Enter a short title" /></label>
      <label className="block text-sm font-medium text-ink">Leave type
        <select className={field} value={category} onChange={(event) => setCategory(event.target.value)} required disabled={balanceLoading || Boolean(balanceError)}>
          <option value="">{balanceLoading ? 'Loading leave types…' : 'Select a leave type'}</option>
          {balances.map((item) => <option key={item.code} value={item.code}>{item.name} — {item.availableDays} days available</option>)}
        </select>
      </label>
      {selectedBalance && <div className="rounded-md border border-line bg-slate-50 px-4 py-3 text-sm text-muted">
        <span className="font-medium text-ink">{selectedBalance.availableDays} of {selectedBalance.annualDays} days available</span> for {year}.
        {' '}{selectedBalance.approvedDays} approved · {selectedBalance.pendingDays} reserved for pending requests.
      </div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-ink">From date<input className={field} type="date" name="fromDate" required onChange={(event) => setDates({ ...dates, from: event.target.value })} /></label>
        <label className="text-sm font-medium text-ink">To date<input className={field} type="date" name="toDate" required onChange={(event) => setDates({ ...dates, to: event.target.value })} /></label>
      </div>
      {days > 0 && <p className="text-sm text-muted">{days} consecutive {days === 1 ? 'day' : 'days'}{days > 3 ? ' · Supporting document and HOD approval required' : ''}</p>}
      <label className="block text-sm font-medium text-ink">Reason<textarea className={field} name="reason" rows="4" maxLength="2000" required placeholder="Briefly describe your reason" /></label>
      <div>
        <span className="text-sm font-medium text-ink">Supporting documents {days > 3 && <span className="text-red-700">(required)</span>}</span>
        <label className="dashboard-upload mt-2 flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-orange-400">
          <UploadCloud size={23} className="text-muted" />
          <span className="text-sm font-medium text-link">Choose files</span>
          <span className="text-xs text-muted">PDF, PNG or JPEG · Up to 3 files, 3 MB each</span>
          <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="sr-only" onChange={selectFiles} />
        </label>
        {files.map((file, index) => <div key={index} className="mt-2 flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm"><span className="truncate">{file.name}</span><button type="button" className="ml-3 text-link" onClick={() => setFiles(files.filter((_, i) => i !== index))} aria-label={`Remove ${file.name}`}>Remove</button></div>)}
      </div>
      <div className="flex justify-end gap-3 border-t border-line pt-5"><button type="button" onClick={onClose} className={secondary}>Cancel</button><button disabled={busy || balanceLoading || Boolean(balanceError)} className={button}>{busy ? 'Submitting…' : 'Submit request'}</button></div>
    </form>
  </Modal>;
}

function RequestDetails({ id, role, onClose, onChanged }) {
  const [details, setDetails] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState('');
  const [comment, setComment] = useState('');
  const [responseFiles, setResponseFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  useEffect(() => {
    let active = true;
    request(`/leave-requests/${id}`, { authenticated: true }).then((data) => { if (active) setDetails(data); }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [id]);
  useEffect(() => {
    if (!preview) return undefined;
    let active = true;
    let objectUrl = '';
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewUrl('');
    request(`/leave-requests/${id}/attachments/${preview.id}`, { authenticated: true, binary: true })
      .then((blob) => {
        if (!active) return;
        if (!['application/pdf', 'image/png', 'image/jpeg'].includes(blob.type)) {
          throw new Error('This file type cannot be previewed.');
        }
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((err) => { if (active) setPreviewError(err.message || 'Could not open this attachment.'); })
      .finally(() => { if (active) setPreviewLoading(false); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, preview]);

  async function act(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const path = role === 'EMPLOYEE' ? 'responses' : 'actions';
      const body = role === 'EMPLOYEE'
        ? { response: comment, attachments: await Promise.all(responseFiles.map(readFile)) }
        : { decision, comment };
      await request(`/leave-requests/${id}/${path}`, { method: 'POST', authenticated: true, body });
      onChanged(role === 'EMPLOYEE' ? 'Your response was sent.' : 'Decision recorded.');
    } catch (err) { setError(err.message); setBusy(false); }
  }

  function selectResponseFiles(event) {
    const combined = [...responseFiles, ...Array.from(event.target.files || [])];
    event.target.value = '';
    if (combined.length > 3 || combined.some((file) => file.size > 3 * 1024 * 1024 || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type))) {
      setError('Choose up to three PDF, PNG, or JPEG files, each no larger than 3 MB.');
      return;
    }
    setError('');
    setResponseFiles(combined);
  }

  const row = details?.request;
  const mayRespond = row?.status === 'NEEDS_INFORMATION' && role === 'EMPLOYEE';
  const mayReview = (role === 'MANAGER' && row?.status === 'PENDING_MANAGER') || (role === 'HOD' && row?.status === 'PENDING_HOD');
  return <Modal title={preview ? 'Attachment preview' : 'Leave request'} onClose={onClose}>
    {preview ? <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="break-all text-sm font-medium text-ink">{preview.filename}</p>
        <button type="button" onClick={() => setPreview(null)} className={secondary}>Back to request</button>
      </div>
      {previewLoading && <p role="status" className="py-8 text-center text-sm text-muted">Loading attachment…</p>}
      {previewError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{previewError}</p>}
      {previewUrl && (preview.media_type === 'application/pdf'
        ? <div>
          <iframe title={`Preview of ${preview.filename}`} src={previewUrl} className="h-[65vh] w-full rounded-md border border-line bg-slate-50" />
          <p className="mt-2 text-xs text-muted">If your browser blocks the preview, <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-link underline">open the PDF in a new tab</a>.</p>
        </div>
        : <div className="flex max-h-[65vh] justify-center overflow-auto rounded-md border border-line bg-slate-50 p-3"><img src={previewUrl} alt={preview.filename} className="max-h-[60vh] max-w-full object-contain" /></div>)}
    </div> :
    <div className="space-y-5 p-6">
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!row && !error && <p role="status" className="text-sm text-muted">Loading request…</p>}
      {row && <>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-ink">{row.title || 'Leave request'}</h3><p className="mt-1 text-sm text-muted">{row.employee_name} · {row.category_code ? row.category_code.toLowerCase() + ' leave' : 'Type not recorded'}</p><p className="mt-1 text-sm text-muted">{prettyDate(row.from_date)} – {prettyDate(row.to_date)}</p></div><Status value={row.status} /></div>
        <ApprovalJourney request={row} actions={details.actions} role={role} />
        <div><h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Reason</h4><p className="mt-2 whitespace-pre-wrap text-sm text-ink">{row.reason}</p></div>
        <div><h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Attachments</h4>{details.attachments.length ? details.attachments.map((file) => <button key={file.id} type="button" onClick={() => setPreview(file)} className="mt-2 flex items-center gap-2 text-left text-sm text-link hover:underline"><FileText size={16} />{file.filename}<span className="text-xs text-muted">Preview</span></button>) : <p className="mt-2 text-sm text-muted">No attachments.</p>}</div>
        <ActivityTimeline actions={details.actions} responses={details.responses} />
        {(mayReview || mayRespond) && <form onSubmit={act} className="space-y-4 border-t border-line pt-5">
          {mayReview && <label className="block text-sm font-medium">Decision<select required className={field} value={decision} onChange={(event) => setDecision(event.target.value)}><option value="">Select a decision</option><option value="APPROVED">Approve</option><option value="REJECTED">Reject</option><option value="INFO_REQUESTED">Request more information</option></select></label>}
          <label className="block text-sm font-medium">{mayRespond ? 'Your response' : 'Comment'}<textarea required maxLength="2000" rows="3" className={field} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
          {mayRespond && <div>
            <span className="text-sm font-medium text-ink">Additional attachments <span className="font-normal text-muted">(optional)</span></span>
            <label className="dashboard-upload mt-2 flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-orange-400">
              <UploadCloud size={23} className="text-muted" />
              <span className="text-sm font-medium text-link">Choose files</span>
              <span className="text-xs text-muted">PDF, PNG or JPEG · Up to 3 files, 3 MB each</span>
              <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="sr-only" onChange={selectResponseFiles} disabled={busy} />
            </label>
            {responseFiles.map((file, index) => <div key={index} className="mt-2 flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm">
              <span className="truncate">{file.name}</span>
              <button type="button" disabled={busy} className="ml-3 text-link" onClick={() => setResponseFiles(responseFiles.filter((_, i) => i !== index))} aria-label={`Remove ${file.name}`}>Remove</button>
            </div>)}
          </div>}
          <button className={button} disabled={busy}>{busy ? 'Saving…' : mayRespond ? 'Send response' : 'Save decision'}</button>
        </form>}
      </>}
    </div>}
  </Modal>;
}

export default function DashboardPage() {
  const { user, signOut, clearSession } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [view, setView] = useState('overview');
  const [modal, setModal] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const accountMenu = useRef(null);
  const accountButton = useRef(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sort, setSort] = useState('submitted');
  const [direction, setDirection] = useState('desc');
  const requestSequence = useRef(0);
  const [balances, setBalances] = useState([]);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState('');
  const balanceYear = new Date().getFullYear();

  useEffect(() => {
    if (!accountOpen) return undefined;
    function dismiss(event) {
      if (!accountMenu.current?.contains(event.target)) setAccountOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setAccountOpen(false);
        accountButton.current?.focus();
      }
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [accountOpen]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true); setError('');
    const query = new URLSearchParams({
      page: String(page), limit: '20', scope: view === 'history' ? 'history' : 'current',
      search: debouncedSearch, status: statusFilter, category: categoryFilter, sort, direction,
    });
    try {
      const result = await request(`/leave-requests?${query}`, { authenticated: true, includeMeta: true });
      if (sequence === requestSequence.current) { setRows(result.data); setTotal(result.meta.pagination.total); }
    } catch (err) {
      if (sequence !== requestSequence.current) return;
      if (err.status === 401) clearSession(); else setError(err.message || 'Could not load requests.');
    } finally { if (sequence === requestSequence.current) setLoading(false); }
  }, [page, view, debouncedSearch, statusFilter, categoryFilter, sort, direction, clearSession]);
  useEffect(() => { load(); }, [load]);

  const loadBalances = useCallback(async () => {
    if (user.role !== 'EMPLOYEE') return;
    setBalanceLoading(true);
    setBalanceError('');
    try { setBalances(await request(`/leave-requests/balances?year=${balanceYear}`, { authenticated: true })); }
    catch (err) {
      if (err.status === 401) clearSession();
      else setBalanceError('Could not load your leave balances.');
    } finally { setBalanceLoading(false); }
  }, [user.role, balanceYear, clearSession]);
  useEffect(() => { loadBalances(); }, [loadBalances]);

  function saved(message) { setModal(null); setNotice(message); load(); loadBalances(); }
  async function logout() {
    setSigningOut(true);
    try { await signOut(); }
    catch { setError('Could not sign out. Try again.'); setAccountOpen(false); setSigningOut(false); }
  }
  const nav = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'requests', label: user.role === 'EMPLOYEE' ? 'My requests' : 'Requests to review', icon: ClipboardList },
    ...(user.role === 'EMPLOYEE' ? [] : [{ key: 'history', label: 'Past requests', icon: FileText }]),
  ];
  const title = view === 'overview' ? 'Overview' : view === 'history' ? 'Past requests' : user.role === 'EMPLOYEE' ? 'My requests' : 'Requests to review';
  useEffect(() => {
    document.title = `${title} | Leave Tracker`;
  }, [title]);
  function changeView(key) {
    setView(key); setPage(1); setSearch(''); setDebouncedSearch(''); setStatusFilter(''); setCategoryFilter('');
    setMobileNav(false);
  }
  return <div className="dashboard-shell min-h-screen bg-canvas text-ink lg:flex">
    {mobileNav && <button className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside className={`dashboard-sidebar fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="dashboard-brand border-b border-line px-6 py-6"><div className="brand-mark" aria-hidden="true"><CalendarDays size={19} /></div><div><div className="text-lg font-semibold tracking-tight">Leave Tracker<span className="text-brand-orange">.</span></div><p className="mt-1 text-xs text-muted">Leave management portal</p></div></div>
      <div className="px-4 pt-7"><p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted">Workspace</p><nav aria-label="Main navigation" className="dashboard-nav mt-3 space-y-1">{nav.map(({ key, label, icon: Icon }) => <button key={key} type="button" onClick={() => changeView(key)} aria-current={view === key ? 'page' : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium ${view === key ? 'bg-orange-50 text-orange-800' : 'text-muted hover:bg-canvas hover:text-ink'}`}><Icon size={18} />{label}</button>)}</nav></div>
      <div className="mt-auto flex min-h-16 items-center border-t border-line px-4 py-2">
        <button type="button" onClick={logout} disabled={signingOut} className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-muted hover:bg-canvas hover:text-ink disabled:opacity-60">
          <LogOut size={18} />{signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </aside>
    <div className="flex min-h-screen min-w-0 flex-1 flex-col">
      <header className="dashboard-topbar sticky top-0 z-20 flex min-h-20 items-center justify-between gap-4 border-b border-line bg-white px-5 sm:px-8">
        <div className="flex items-center gap-3"><button type="button" onClick={() => setMobileNav(true)} aria-label="Open navigation" className="rounded-md p-2 lg:hidden"><Menu size={22} /></button><div><p className="text-xs text-muted">Workspace</p><p className="mt-1 text-sm font-semibold">{title}</p></div></div>
        <div ref={accountMenu} className="relative flex items-center gap-3">
          <div className="text-right"><p className="text-sm font-semibold">{user.displayName}</p><p className="text-xs text-muted">{roleNames[user.role]}</p></div>
          <button ref={accountButton} type="button" aria-label="Account options" aria-expanded={accountOpen} aria-controls="account-menu" onClick={() => setAccountOpen((open) => !open)} className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-800 hover:bg-orange-200">
            {user.displayName.slice(0, 1).toUpperCase()}
          </button>
          {accountOpen && <div id="account-menu" className="absolute right-0 top-full z-30 mt-2 w-48 rounded-md border border-line bg-white p-1 shadow-md">
            <button type="button" onClick={logout} disabled={signingOut} className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-muted hover:bg-canvas hover:text-ink disabled:opacity-60">
              <LogOut size={18} />{signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>}
        </div>
      </header>
      <main className="dashboard-main mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8">
        <div className="dashboard-heading flex flex-wrap items-start justify-between gap-4"><div><p className="dashboard-eyebrow">LEAVE MANAGEMENT</p><h1 className="text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted">{user.role === 'EMPLOYEE' ? 'Submit requests and keep track of their progress.' : 'Review leave requests and record your decisions.'}</p></div>{user.role === 'EMPLOYEE' && <button onClick={() => setModal('create')} className={`${button} dashboard-primary`}><Plus size={17} />New request</button>}</div>
        {notice && <div role="status" className="mt-6 flex justify-between gap-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={16} /></button></div>}
        {error && <div role="alert" className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error} <button type="button" onClick={load} className="ml-2 underline">Try again</button></div>}
        {view === 'overview' && user.role === 'EMPLOYEE' && <LeaveBalances balances={balances} loading={balanceLoading} error={balanceError} onRetry={loadBalances} year={balanceYear} />}
        {view === 'overview' && user.role !== 'EMPLOYEE' && <div className="dashboard-stats mt-8 grid gap-4 sm:grid-cols-3">{[
          { label: 'Requests shown', value: rows.length, icon: ClipboardList },
          { label: 'Awaiting action', value: rows.filter((row) => ['PENDING_MANAGER', 'PENDING_HOD', 'NEEDS_INFORMATION'].includes(row.status)).length, icon: CalendarDays },
          { label: user.role === 'EMPLOYEE' ? 'Approved' : 'Your role', value: user.role === 'EMPLOYEE' ? rows.filter((row) => row.status === 'APPROVED').length : roleNames[user.role], icon: FileText },
        ].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-lg border border-line bg-white p-5"><div className="flex items-center justify-between text-muted"><p className="text-sm">{label}</p><Icon size={18} /></div><p className="mt-4 text-2xl font-semibold">{loading ? '—' : value}</p><p className="mt-1 text-xs text-muted">Current page</p></div>)}</div>}
        <section className="dashboard-requests mt-8 overflow-hidden rounded-lg border border-line bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4"><div><h2 className="font-semibold">{view === 'overview' ? 'Recent requests' : title}</h2><p className="mt-1 text-xs text-muted">{view === 'history' ? 'Completed requests' : user.role === 'EMPLOYEE' ? 'Your leave requests' : 'Requests available for your review'}</p></div>{view === 'overview' && <button onClick={() => changeView('requests')} className="text-sm font-medium text-link">View all</button>}</div>
          <div className="grid gap-3 border-b border-line px-5 py-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs font-medium text-muted">Search<input type="search" maxLength="100" className={field} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Title, employee or reason" /></label>
            <label className="text-xs font-medium text-muted">Status<select className={field} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="">All statuses</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="text-xs font-medium text-muted">Leave type<select className={field} value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}><option value="">All types</option><option value="CASUAL">Casual leave</option><option value="SICK">Sick leave</option><option value="EARNED">Earned leave</option></select></label>
            <label className="text-xs font-medium text-muted">Sort by<select className={field} value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="submitted">Submitted</option><option value="title">Request title</option><option value="employee">Employee</option><option value="dates">Start date</option><option value="status">Status</option></select></label>
            <label className="text-xs font-medium text-muted">Order<select className={field} value={direction} onChange={(event) => { setDirection(event.target.value); setPage(1); }}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
          </div>
          {loading ? <p role="status" className="p-8 text-center text-sm text-muted">Loading requests…</p> : !rows.length ? <div className="p-10 text-center"><ClipboardList size={26} className="mx-auto text-muted" /><p className="mt-3 text-sm font-medium">No matching requests</p><p className="mt-1 text-sm text-muted">Try a different search or filter.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs text-muted"><tr><th className="px-5 py-3 font-medium">Request</th><th className="px-5 py-3 font-medium">Dates</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Submitted</th><th className="px-5 py-3"><span className="sr-only">View</span></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-line hover:bg-slate-50"><td className="px-5 py-4 font-medium">{row.title || 'Leave request'}<div className="mt-1 text-xs font-normal text-muted">{row.employee_name}{row.category_code ? ` · ${row.category_code.toLowerCase()}` : ''}</div></td><td className="px-5 py-4 text-muted">{prettyDate(row.from_date)} – {prettyDate(row.to_date)}</td><td className="px-5 py-4"><Status value={row.status} /></td><td className="px-5 py-4 text-muted">{prettyDate(row.created_at)}</td><td className="px-5 py-4"><button onClick={() => setModal(row.id)} aria-label={`View request from ${row.employee_name}`} className="rounded p-1 text-link hover:bg-orange-50"><ChevronRight size={19} /></button></td></tr>)}</tbody></table></div>}
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-muted"><span>{total} matching requests · Page {page}</span><div className="flex gap-2"><button disabled={page === 1 || loading} onClick={() => setPage(page - 1)} className={secondary}>Previous</button><button disabled={page * 20 >= total || loading} onClick={() => setPage(page + 1)} className={secondary}>Next</button></div></div>
        </section>
      </main>
      <footer className="dashboard-footer flex min-h-16 flex-wrap items-center justify-between gap-3 border-t border-line bg-white px-5 py-3 text-xs text-muted sm:px-8">
        <span>Leave Tracker · Employee leave management</span>
        <span className="ml-auto text-right">Abhinav Jain - 2547203</span>
      </footer>
    </div>
    {modal === 'create' && <CreateRequest onClose={() => setModal(null)} onSaved={saved} />}
    {modal && modal !== 'create' && <RequestDetails id={modal} role={user.role} onClose={() => setModal(null)} onChanged={saved} />}
  </div>;
}
