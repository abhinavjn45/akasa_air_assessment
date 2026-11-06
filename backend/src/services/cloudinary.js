import { createHash, randomUUID } from 'node:crypto';
import { httpError } from '../utils/http-error.js';

function config() {
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloud || !key || !secret || !/^[a-zA-Z0-9_-]+$/.test(cloud)) {
    throw httpError(503, 'STORAGE_UNAVAILABLE', 'Document storage is not configured.');
  }
  return { cloud, key, secret };
}

function sign(params, secret) {
  const value = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&');
  return createHash('sha1').update(value + secret).digest('hex');
}

export async function uploadDocument(file) {
  const { cloud, key, secret } = config();
  const bytes = Buffer.from(file.content, 'base64');
  const pdf = bytes.subarray(0, 5).toString() === '%PDF-';
  const png = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  const jpeg = bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!bytes.length || bytes.length > 3 * 1024 * 1024 || !(pdf || png || jpeg)) {
    throw httpError(400, 'INVALID_FILE', 'Use a PDF, PNG, or JPEG file of at most 3 MB.');
  }
  const extension = pdf ? 'pdf' : png ? 'png' : 'jpg';
  const mediaType = pdf ? 'application/pdf' : png ? 'image/png' : 'image/jpeg';
  const publicId = `leave-tracker/${randomUUID()}.${extension}`;
  const params = { public_id: publicId, timestamp: Math.floor(Date.now() / 1000), type: 'authenticated' };
  const form = new FormData();
  for (const [name, value] of Object.entries(params)) form.append(name, String(value));
  form.append('api_key', key);
  form.append('signature', sign(params, secret));
  form.append('file', new Blob([bytes], { type: mediaType }), publicId.split('/').at(-1));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/raw/upload`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw httpError(503, 'STORAGE_UNAVAILABLE', 'Could not upload the document.');
  return { storageKey: publicId, mediaType, byteSize: bytes.length };
}

export async function deleteDocument(publicId) {
  const { cloud, key, secret } = config();
  const params = { public_id: publicId, timestamp: Math.floor(Date.now() / 1000), type: 'authenticated' };
  const form = new URLSearchParams({ ...params, api_key: key, signature: sign(params, secret) });
  await fetch(`https://api.cloudinary.com/v1_1/${cloud}/raw/destroy`, { method: 'POST', body: form, signal: AbortSignal.timeout(10000) });
}

export async function downloadDocument(publicId) {
  const { cloud, key, secret } = config();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { expires_at: timestamp + 60, public_id: publicId, timestamp, type: 'authenticated' };
  const query = new URLSearchParams({ ...params, api_key: key, signature: sign(params, secret) });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/raw/download?${query}`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw httpError(503, 'STORAGE_UNAVAILABLE', 'Could not retrieve the document.');
  return Buffer.from(await response.arrayBuffer());
}
