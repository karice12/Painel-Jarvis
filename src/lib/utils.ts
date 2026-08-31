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

/**
 * Limpa marcações Markdown (*, #, _, ~, [, ], (, ), links e URLs) para síntese de voz fluida
 */
export function sanitizeMarkdownForTTS(text: string): string {
  if (!text || typeof text !== "string") return "";
  let clean = text;

  // 1. Remove blocos de código
  clean = clean.replace(/```[\s\S]*?```/g, "");
  clean = clean.replace(/`([^`]+)`/g, "$1");

  // 2. Remove imagens markdown
  clean = clean.replace(/!\[[^\]]*\]\([^\)]*\)/g, "");

  // 3. Converte links markdown mantendo apenas o texto da âncora: [STJ](https://...) -> STJ
  clean = clean.replace(/\[([^\]]+)\]\([^\)]*\)/g, "$1");

  // 4. Remove URLs avulsas
  clean = clean.replace(/https?:\/\/\S+/g, "");

  // 5. Remove marcações de formatação Markdown (*, #, _, ~, >, |, [, ], (, ), {, })
  clean = clean.replace(/[\*#_~>|\[\]\(\)\{\}]/g, " ");

  // 6. Converte o símbolo & para ' e ' para fala natural e compatibilidade XML
  clean = clean.replace(/\s*&\s*/g, " e ");

  // 7. Remove tags HTML e caracteres XML inseguros (<, >)
  clean = clean.replace(/[<>]/g, "");

  // 8. Remove emojis e ícones especiais
  clean = clean.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, "");

  // 9. Normaliza espaços e quebras de linha
  clean = clean.replace(/\s+/g, " ").trim();

  // Limite de caracteres para fala fluida
  if (clean.length > 1500) {
    clean = clean.slice(0, 1500);
    const lastPunct = Math.max(clean.lastIndexOf("."), clean.lastIndexOf("!"), clean.lastIndexOf("?"));
    if (lastPunct > 300) {
      clean = clean.slice(0, lastPunct + 1);
    }
  }

  return clean;
}

/**
 * Decodifica entidades HTML recursivamente, remove tags e limpa metadados e fragmentos de busca
 */
export function cleanHtmlAndExtractText(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  let text = raw;

  // 1. Remove CDATA
  text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");

  // 2. Decode entities repeatedly (up to 4 passes)
  for (let i = 0; i < 4; i++) {
    text = text
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&")
      .replace(/&nbsp;/gi, " ")
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  // 3. Remove script, style, font, anchor tags, and extract inner text
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ");
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");

  // 4. Remove all HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // 5. Remove leftover HTML tag fragments and attributes
  text = text
    .replace(/(?:target=["']?[^"'\s>]*["']?|href=["']?[^"'\s>]*["']?|class=["']?[^"'\s>]*["']?)/gi, " ")
    .replace(/(?:&lt;|&gt;|&amp;|&quot;|&#39;|&nbsp;|<|>)/gi, " ")
    .replace(/https?:\/\/\S+/g, " ");

  // 6. Clean cookie notices, subscriptions, social media noise
  text = text
    .replace(/(?:este site|o portal|nosso site|nós)?\s*(?:utiliza|utilizamos|usa|usamos)\s+cookies(?:\s+para\s+melhorar\s+sua\s+experi[eê]ncia)?[^.]*\.?/gi, "")
    .replace(/Ao\s+continuar\s+navegando,\s+voc[eê]\s+concorda\s+com\s+(?:nossa|a)\s+Pol[ií]tica\s+de\s+Privacidade[^.]*\.?/gi, "")
    .replace(/Todos\s+os\s+direitos\s+reservados[^.]*\.?/gi, "")
    .replace(/Inscreva-se\s+no\s+canal[^.]*\.?/gi, "")
    .replace(/Deixe\s+seu\s+like[^.]*\.?/gi, "");

  // 7. Normalize whitespace and strip trailing cutoffs/ellipsis
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/(?:\s*\.{2,}|\s*…|\s*reg\.\.\.|\s*[a-zA-Z]{1,3}\.\.\.)\s*$/, "").trim();

  return text;
}


