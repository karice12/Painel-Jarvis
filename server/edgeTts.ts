import WebSocket from "ws";
import crypto from "crypto";
import https from "https";

const CHROMIUM_FULL_VERSION = "143.0.3650.75";
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WINDOWS_FILE_TIME_EPOCH = 11644473600n;

// Cache em memória para sínteses recentes (TTL & LRU simples)
const audioCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const MAX_CACHE_SIZE = 100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

function getCacheKey(text: string, voice: string): string {
  return crypto.createHash("md5").update(`${voice}:${text}`).digest("hex");
}

function getFromCache(text: string, voice: string): Buffer | null {
  const key = getCacheKey(text, voice);
  const item = audioCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    audioCache.delete(key);
    return null;
  }
  return item.buffer;
}

function saveToCache(text: string, voice: string, buffer: Buffer): void {
  if (audioCache.size >= MAX_CACHE_SIZE) {
    // Remove o item mais antigo
    const firstKey = audioCache.keys().next().value;
    if (firstKey) audioCache.delete(firstKey);
  }
  const key = getCacheKey(text, voice);
  audioCache.set(key, { buffer, timestamp: Date.now() });
}

/**
 * Gera o token de segurança Sec-MS-GEC exigido pela infraestrutura de Voz Neural da Microsoft
 */
function generateSecMsGecToken(): string {
  const ticks = BigInt(Math.floor(Date.now() / 1000 + Number(WINDOWS_FILE_TIME_EPOCH))) * 10000000n;
  const roundedTicks = ticks - (ticks % 3000000000n);
  const strToHash = `${roundedTicks}${TRUSTED_CLIENT_TOKEN}`;
  const hash = crypto.createHash("sha256");
  hash.update(strToHash, "ascii");
  return hash.digest("hex").toUpperCase();
}

/**
 * Escapa caracteres XML para construção do payload SSML
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      default:
        return c;
    }
  });
}

/**
 * Limpa e sanitiza qualquer texto com formatação Markdown, URLs, blocos de código e tabelas,
 * transformando em uma fala contínua, humana e natural em Português do Brasil.
 */
export function sanitizeTextForNeuralTTS(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  let clean = raw;

  // 1. Remove blocos de código ```...``` e JSONs
  clean = clean.replace(/```[\s\S]*?```/g, "");
  clean = clean.replace(/`([^`]+)`/g, "$1");

  // 2. Remove imagens markdown ![alt](url)
  clean = clean.replace(/!\[[^\]]*\]\([^\)]*\)/g, "");

  // 3. Converte links markdown mantendo apenas o texto da âncora: [STJ](https://...) -> STJ
  clean = clean.replace(/\[([^\]]+)\]\([^\)]*\)/g, "$1");

  // 4. Remove URLs avulsas
  clean = clean.replace(/https?:\/\/\S+/g, "");

  // 5. Remove marcações Markdown (*, #, _, ~, >, |, [, ], (, ), {, }) e aspas
  clean = clean.replace(/[\*#_~>|\[\]\(\)\{\}\"\'\«\»\“”]/g, " ");

  // 6. Converte & para ' e ' para fala natural e conformidade SSML
  clean = clean.replace(/\s*&\s*/g, " e ");

  // 7. Remove tags HTML e caracteres XML inseguros (<, >)
  clean = clean.replace(/[<>]/g, "");

  // 8. Remove emojis e símbolos visuais
  clean = clean.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, "");

  // 9. Normaliza espaços múltiplos e quebras de linha
  clean = clean.replace(/\s+/g, " ").trim();

  // Limite seguro de caracteres para manter latência ultrarrápida e naturalidade
  if (clean.length > 1800) {
    clean = clean.slice(0, 1800);
    const lastPunct = Math.max(clean.lastIndexOf("."), clean.lastIndexOf("!"), clean.lastIndexOf("?"));
    if (lastPunct > 300) {
      clean = clean.slice(0, lastPunct + 1);
    }
  }

  return clean;
}

export interface NeuralTTSOptions {
  voice?: string;
  rate?: string;
  pitch?: string;
  volume?: string;
  timeoutMs?: number;
}

/**
 * Fallback de síntese neural de alta qualidade via streaming HTTP
 */
async function synthesizeGoogleNeuralFallback(text: string): Promise<Buffer> {
  // Quebra em sentenças de até 150 caracteres para naturalidade
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const chunks: string[] = [];
  let current = "";

  for (const s of sentences) {
    if ((current + " " + s).trim().length <= 180) {
      current = (current + " " + s).trim();
    } else {
      if (current) chunks.push(current);
      current = s.trim();
    }
  }
  if (current) chunks.push(current);

  const bufferChunks: Buffer[] = [];

  for (const chunk of chunks) {
    const encoded = encodeURIComponent(chunk);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=pt-BR&client=tw-ob&q=${encoded}`;

    const buf = await new Promise<Buffer>((resolve, reject) => {
      https.get(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Fallback TTS error HTTP ${res.statusCode}`));
            return;
          }
          const data: Buffer[] = [];
          res.on("data", (d) => data.push(d));
          res.on("end", () => resolve(Buffer.concat(data)));
        }
      ).on("error", reject);
    });

    bufferChunks.push(buf);
  }

  return Buffer.concat(bufferChunks);
}

/**
 * Sintetiza o texto em áudio neural MP3 de alta fidelidade (24kHz 96kbps)
 * diretamente em memória via WebSocket com o serviço de Edge Neural TTS da Microsoft.
 * Caso haja oscilação de rede, recorre automaticamente ao fallback neural de servidor.
 */
export async function synthesizeNeuralSpeech(
  text: string,
  options: NeuralTTSOptions = {}
): Promise<Buffer> {
  const voice = options.voice || "pt-BR-AntonioNeural";
  const rate = options.rate || "+0%";
  const pitch = options.pitch || "+0Hz";
  const timeoutMs = options.timeoutMs || 15000;

  const cleanText = sanitizeTextForNeuralTTS(text) || "Olá, tudo bem? Estou à disposição para ajudar.";

  // 1. Verifica cache em memória
  const cached = getFromCache(cleanText, voice);
  if (cached) {
    return cached;
  }

  // 2. Tenta primariamente a síntese Microsoft Neural de Estúdio (Antônio / Francisca / Thalita)
  try {
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      let ws: WebSocket | null = null;
      let timeout: NodeJS.Timeout | null = null;

      try {
        const secMsGec = generateSecMsGecToken();
        const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=1-${CHROMIUM_FULL_VERSION}`;

        ws = new WebSocket(url, {
          host: "speech.platform.bing.com",
          origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
          headers: {
            Pragma: "no-cache",
            "Cache-Control": "no-cache",
            "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0`,
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
          },
        });

        const audioChunks: Buffer[] = [];

        timeout = setTimeout(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
          reject(new Error("Timeout ao sintetizar áudio com a API de Voz Neural"));
        }, timeoutMs);

        ws.on("open", () => {
          // Configuração de áudio MP3 24kHz 96kbps (Alta fidelidade humana)
          const configMsg =
            "Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n" +
            JSON.stringify({
              context: {
                synthesis: {
                  audio: {
                    metadataoptions: {
                      sentenceBoundaryEnabled: false,
                      wordBoundaryEnabled: false,
                    },
                    outputFormat: "audio-24khz-96kbitrate-mono-mp3",
                  },
                },
              },
            });
          ws?.send(configMsg);

          // SSML com entonação humana natural
          const reqId = crypto.randomBytes(16).toString("hex");
          const ssml =
            `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="pt-BR">` +
            `<voice name="${voice}">` +
            `<prosody rate="${rate}" pitch="${pitch}">` +
            `${escapeXml(cleanText)}` +
            `</prosody>` +
            `</voice>` +
            `</speak>`;

          const ssmlMsg =
            `X-RequestId:${reqId}\r\n` +
            `Content-Type:application/ssml+xml\r\n` +
            `Path:ssml\r\n\r\n` +
            ssml;

          ws?.send(ssmlMsg);
        });

        ws.on("message", (data: any, isBinary: boolean) => {
          if (isBinary) {
            const separator = "Path:audio\r\n";
            const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
            const index = buf.indexOf(separator);
            if (index !== -1) {
              const audioData = buf.subarray(index + separator.length);
              if (audioData.length > 0) {
                audioChunks.push(audioData);
              }
            }
          } else {
            const message = data.toString();
            if (message.includes("Path:turn.end")) {
              if (timeout) clearTimeout(timeout);
              ws?.close();
              const fullAudio = Buffer.concat(audioChunks);
              resolve(fullAudio);
            }
          }
        });

        ws.on("error", (err: any) => {
          if (timeout) clearTimeout(timeout);
          reject(err);
        });

        ws.on("close", () => {
          if (timeout) clearTimeout(timeout);
          if (audioChunks.length > 0) {
            resolve(Buffer.concat(audioChunks));
          }
        });
      } catch (err) {
        if (timeout) clearTimeout(timeout);
        reject(err);
      }
    });

    if (buffer && buffer.length > 1000) {
      saveToCache(cleanText, voice, buffer);
      return buffer;
    }
  } catch (primaryErr) {
    console.warn("[Voz Neural Microsoft indisponível, usando fallback neural de alta qualidade]:", primaryErr);
  }

  // 3. Fallback Neural no Servidor (Sem jamais recorrer a voz mecânica do navegador)
  try {
    const fallbackBuf = await synthesizeGoogleNeuralFallback(cleanText);
    if (fallbackBuf && fallbackBuf.length > 0) {
      saveToCache(cleanText, voice, fallbackBuf);
      return fallbackBuf;
    }
  } catch (fallbackErr) {
    console.error("[Erro no fallback de áudio neural]:", fallbackErr);
  }

  throw new Error("Não foi possível sintetizar a voz neural humanizada no momento.");
}
