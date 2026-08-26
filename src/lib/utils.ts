import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDateBR(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

/**
 * Sanitizes user text input before sending to backend or AI engines
 * Strips script tags, invalid control chars, inline event handlers and prevents injection.
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== "string") return "";

  // 1. Strip non-printable/dangerous ASCII control characters (keep standard newlines & tabs)
  let clean = input.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, "");

  // 2. Remove script tags and their content
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // 3. Remove inline javascript URI schemes and DOM event handler strings
  clean = clean.replace(/javascript\s*:/gi, "");
  clean = clean.replace(/\bon\w+\s*=\s*(['"]).*?\1/gi, "");
  clean = clean.replace(/\bon\w+\s*=\s*[^>\s]+/gi, "");

  // 4. Strip dangerous iframe or object embed injections
  clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  clean = clean.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");

  return clean.trim();
}
