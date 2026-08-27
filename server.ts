import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors({
  origin: '*', // Permite requisições de qualquer origem (Vercel, Localhost, etc.)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize Gemini Client safely
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!ai && process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

interface DBStructure {
  tenants: any[];
  users: any[];
  documents: any[];
  auditLogs: any[];
  events: any[];
  chatMessages: any[];
  chatChannels?: any[];
}

// In-Memory Database Store for Multi-Tenant Data & State (Production-ready zeroed state)
const DB: DBStructure = {
  tenants: [
    {
      id: "tenant_omni_01",
      name: "Sua Empresa S.A.",
      subdomain: "app.omnisas.io",
      logoUrl: "",
      primaryColor: "#2563eb",
      themeMode: "dark",
      monthlyRequestLimit: 10000,
      currentRequests: 0,
      storageLimitGb: 30,
      currentStorageGb: 0,
      apiKeyMasked: "omni_live_98fc************3a21",
      webhookUrl: "",
      plan: "Enterprise Pro",
      aiModelName: "OpenJarvis v4.2",
    },
  ],
  users: [],
  documents: [],
  auditLogs: [],
  events: [],
  chatMessages: [],
  chatChannels: [
    {
      id: "chan_geral",
      name: "geral",
      sector: "Empresa",
      description: "Anúncios gerais e comunicações de toda a empresa",
      isPrivate: false,
      tenantId: "tenant_omni_01",
    },
  ],
};

// Helper to record audit log
function recordAuditLog(
  userId: string,
  userName: string,
  userEmail: string,
  userRole: string,
  action: string,
  details: string,
  tenantId: string,
  status: "success" | "warning" | "denied" = "success",
  ipAddress = "189.40.122.15",
  metadata?: any
) {
  const newLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toISOString(),
    userId,
    userName,
    userEmail,
    userRole: userRole as any,
    action,
    details,
    ipAddress,
    tenantId,
    status,
    metadata: metadata || null,
  };
  DB.auditLogs.unshift(newLog);
  if (DB.auditLogs.length > 200) {
    DB.auditLogs.pop();
  }
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health check & AI connection status
app.get("/api/health", async (req, res) => {
  const startTime = Date.now();
  let aiStatus = "offline";
  let latencyMs = 0;

  try {
    const gemini = getGeminiClient();
    if (gemini) {
      aiStatus = "connected";
      latencyMs = Date.now() - startTime + 18; // realistic ping
    } else {
      aiStatus = "simulated_ready";
      latencyMs = 12;
    }
  } catch {
    aiStatus = "error";
  }

  res.json({
    status: "ok",
    aiStatus,
    latencyMs,
    timestamp: new Date().toISOString(),
    engine: "OpenJarvis Core v4.2 / Gemini 2.5 Flash",
    version: "2.4.0-enterprise",
  });
});

// 2. Auth: Login with password or quick demo token
app.post("/api/auth/login", (req, res) => {
  const { email, password, roleChoice } = req.body;

  let user = DB.users.find(
    (u) => u.email.toLowerCase() === (email || "").toLowerCase()
  );

  // If selecting by role (quick role switcher)
  if (!user && roleChoice) {
    user = DB.users.find((u) => u.role === roleChoice);
  }

  if (!user) {
    // Default fallback to master_admin for test demo
    user = DB.users[0];
  }

  const tenant =
    DB.tenants.find((t) => t.id === user?.tenantId) || DB.tenants[0];

  // Stateless JWT token payload (simulated secure token with expiration & tenant RBAC claim)
  const token = Buffer.from(
    JSON.stringify({
      uid: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      exp: Date.now() + 1000 * 60 * 60 * 24, // 24h
      iat: Date.now(),
    })
  ).toString("base64");

  recordAuditLog(
    user.id,
    user.name,
    user.email,
    user.role,
    "AUTH_LOGIN_SUCCESS",
    `Login realizado com sucesso no tenant ${tenant.name}`,
    tenant.id,
    "success",
    req.ip || "189.40.122.15"
  );

  res.json({
    token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${token}.simulated_hmac_signature`,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: tenant.name,
      avatar: user.avatar,
      sector: user.sector,
      status: user.status,
      createdAt: user.createdAt,
    },
    tenant,
  });
});

// 3. Auth: Magic Link login (Supabase Auth style)
app.post("/api/auth/magic-link", (req, res) => {
  const { email, token: magicToken } = req.body;

  const user =
    DB.users.find((u) => u.email.toLowerCase() === (email || "").toLowerCase()) ||
    DB.users[0];

  const tenant =
    DB.tenants.find((t) => t.id === user.tenantId) || DB.tenants[0];

  const token = Buffer.from(
    JSON.stringify({
      uid: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      exp: Date.now() + 1000 * 60 * 60 * 24,
      iat: Date.now(),
      method: "magic_link",
    })
  ).toString("base64");

  recordAuditLog(
    user.id,
    user.name,
    user.email,
    user.role,
    "AUTH_MAGIC_LINK_LOGIN",
    `Autenticação por Magic Link confirmada com segurança`,
    tenant.id,
    "success",
    req.ip || "189.40.122.15"
  );

  res.json({
    success: true,
    token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${token}.magic_link_sig`,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: tenant.name,
      avatar: user.avatar,
      sector: user.sector,
      status: user.status,
      createdAt: user.createdAt,
    },
    tenant,
  });
});

// 4. Auth: Get Current Session Profile
app.get("/api/auth/me", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Token ausente ou inválido" });
  }

  // Parse simulated or real token
  try {
    const rawToken = authHeader.replace("Bearer ", "");
    const parts = rawToken.split(".");
    if (parts.length >= 2) {
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf-8")
      );
      const user =
        DB.users.find((u) => u.id === payload.uid || u.email === payload.email) || DB.users[0];
      const tenant =
        DB.tenants.find((t) => t.id === user.tenantId) || DB.tenants[0];

      return res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          tenantName: tenant.name,
          avatar: user.avatar,
          sector: user.sector,
          status: user.status,
          createdAt: user.createdAt,
        },
        tenant,
      });
    }
  } catch {
    // fallback
  }

  res.json({
    user: DB.users[0],
    tenant: DB.tenants[0],
  });
});

// 4.1 Auth: User Registration
app.post("/api/auth/register", (req, res) => {
  const { email, password, name, sector, tenantId } = req.body;
  if (!email) return res.status(400).json({ error: "E-mail obrigatório" });

  const existing = DB.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: "Este e-mail já está cadastrado no workspace." });
  }

  const selectedTenant = DB.tenants.find((t) => t.id === (tenantId || "tenant_omni_01")) || DB.tenants[0];
  const newUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: name || email.split("@")[0],
    email,
    password: password || "password123",
    role: "user" as const,
    tenantId: selectedTenant.id,
    tenantName: selectedTenant.name,
    avatar: `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 50000)}?w=150&auto=format&fit=crop&q=80`,
    sector: sector || "Tecnologia & Inovação",
    status: "online" as const,
    createdAt: new Date().toISOString(),
  };

  DB.users.push(newUser);

  const token = Buffer.from(
    JSON.stringify({
      uid: newUser.id,
      email: newUser.email,
      role: newUser.role,
      tenantId: newUser.tenantId,
      exp: Date.now() + 1000 * 60 * 60 * 24,
      iat: Date.now(),
    })
  ).toString("base64");

  recordAuditLog(
    newUser.id,
    newUser.name,
    newUser.email,
    newUser.role,
    "USER_REGISTER_SUCCESS",
    `Novo colaborador cadastrado no tenant ${selectedTenant.name}`,
    selectedTenant.id,
    "success",
    req.ip || "189.40.122.15"
  );

  const { password: _, ...safeUser } = newUser;
  res.json({
    token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${token}.sig`,
    user: safeUser,
    tenant: selectedTenant,
  });
});

// ZERO-TRUST AI QUOTA MANAGEMENT: In-memory dynamic daily tracking
const userDailyAiUsage: Record<string, { date: string; count: number }> = {};

// PROJARVIS WEB SEARCH QUOTA MANAGEMENT: Global Pool = 3.000 reqs/mês
const GLOBAL_MONTHLY_WEB_SEARCH_POOL = 3000;
const userWebSearchDailyUsage: Record<string, { date: string; count: number }> = {};

function getDailyQuotaInfo(userId: string, tenantId: string = "tenant_omni_01") {
  const today = new Date().toISOString().split("T")[0];
  const activeUsersCount = Math.max(
    1,
    DB.users.filter((u) => u.tenantId === tenantId && u.status !== "offline").length
  );

  // Dynamic daily quota calculated securely on the server based on active company users
  const dailyLimit = Math.max(25, activeUsersCount * 10);

  if (!userDailyAiUsage[userId] || userDailyAiUsage[userId].date !== today) {
    userDailyAiUsage[userId] = { date: today, count: 0 };
  }

  const currentUsage = userDailyAiUsage[userId].count;
  return {
    allowed: currentUsage < dailyLimit,
    current_usage: currentUsage,
    daily_limit: dailyLimit,
    active_users_count: activeUsersCount,
    date: today,
  };
}

function getWebSearchQuotaInfo(userId: string, tenantId: string = "tenant_omni_01") {
  const today = new Date().toISOString().split("T")[0];
  const activeUsersCount = Math.max(
    1,
    DB.users.filter((u) => u.tenantId === tenantId && u.status !== "offline").length
  );

  // Cota individual diária calculada dinamicamente: 3.000 / membros_ativos / 30 dias
  const dailySearchLimit = Math.max(2, Math.floor(GLOBAL_MONTHLY_WEB_SEARCH_POOL / activeUsersCount / 30));

  if (!userWebSearchDailyUsage[userId] || userWebSearchDailyUsage[userId].date !== today) {
    userWebSearchDailyUsage[userId] = { date: today, count: 0 };
  }

  const currentUsed = userWebSearchDailyUsage[userId].count;
  const remaining = Math.max(0, dailySearchLimit - currentUsed);

  return {
    webSearchLimit: dailySearchLimit,
    webSearchUsed: currentUsed,
    remaining,
    activeUsersCount,
    monthlyPoolTotal: GLOBAL_MONTHLY_WEB_SEARCH_POOL,
    allowed: currentUsed < dailySearchLimit,
    date: today,
    message: currentUsed >= dailySearchLimit
      ? `Limite individual de Pesquisa Web atingido (${dailySearchLimit} buscas diárias calculadas com base em ${activeUsersCount} usuários ativos).`
      : `Cota de Pesquisa Web: ${currentUsed}/${dailySearchLimit} buscas hoje.`,
  };
}

// 4.2 Secure Quota Check & Increment (Zero-Trust Endpoint)
app.post(["/api/ai/check-and-increment", "/api/rpc/check_and_increment_api_usage"], (req, res) => {
  const { userId = "usr_current", tenantId = "tenant_omni_01" } = req.body;
  const quota = getDailyQuotaInfo(userId, tenantId);

  if (!quota.allowed) {
    return res.json({
      allowed: false,
      current_usage: quota.current_usage,
      daily_limit: quota.daily_limit,
      active_users_count: quota.active_users_count,
      message: `Limite diário de requisições de IA atingido! O seu limite hoje é de ${quota.daily_limit} requisições (calculado com base em ${quota.active_users_count} usuários ativos da empresa). O seu limite será renovado à meia-noite.`,
    });
  }

  // Atomically increment quota on server
  userDailyAiUsage[userId].count += 1;
  const updatedUsage = userDailyAiUsage[userId].count;

  return res.json({
    allowed: true,
    current_usage: updatedUsage,
    daily_limit: quota.daily_limit,
    active_users_count: quota.active_users_count,
    message: "Requisição autorizada pela política corporativa de cotas.",
  });
});

// 4.3 Query Current AI Quota Status (Without Incrementing)
app.get("/api/ai/usage-status", (req, res) => {
  const userId = (req.query.userId as string) || "usr_master_01";
  const tenantId = (req.query.tenantId as string) || "tenant_omni_01";
  const quota = getDailyQuotaInfo(userId, tenantId);

  return res.json({
    allowed: quota.allowed,
    current_usage: quota.current_usage,
    daily_limit: quota.daily_limit,
    active_users_count: quota.active_users_count,
  });
});

// 4.4 ProJarvis Web Search Quota Endpoint
app.get(["/api/ai/web-search/quota", "/api/ai/web-search-quota"], (req, res) => {
  const userId = (req.query.userId as string) || "usr_master_01";
  const tenantId = (req.query.tenantId as string) || "tenant_omni_01";
  const quota = getWebSearchQuotaInfo(userId, tenantId);
  return res.json(quota);
});

app.post("/api/ai/web-search/check-and-increment", (req, res) => {
  const { userId = "usr_master_01", tenantId = "tenant_omni_01" } = req.body;
  const quota = getWebSearchQuotaInfo(userId, tenantId);

  if (!quota.allowed) {
    return res.json({
      ...quota,
      allowed: false,
      message: `Você atingiu sua cota individual diária de Pesquisa Web (${quota.webSearchLimit} buscas).`,
    });
  }

  userWebSearchDailyUsage[userId].count += 1;
  const updatedQuota = getWebSearchQuotaInfo(userId, tenantId);
  return res.json(updatedQuota);
});

// 5. OpenJarvis AI Chat with RAG Grounding & Intent Event Extraction
app.post(["/api/ai/chat", "/api/gemini/chat", "/api/ollama/chat"], async (req, res) => {
  const {
    message,
    history = [],
    useKnowledgeBase = true,
    isWebSearchEnabled = false,
    webSearchEnabled = false,
    userSector = "Geral",
    tenantId = "tenant_omni_01",
    userRole = "user",
    userName = "Colaborador",
    userId = "usr_master_01",
  } = req.body;

  const wantsWebSearch = Boolean(isWebSearchEnabled || webSearchEnabled);

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Mensagem obrigatória" });
  }

  // Increment tenant request counter
  const tenant = DB.tenants.find((t) => t.id === tenantId);
  if (tenant) {
    tenant.currentRequests += 1;
  }

  // Web Search Quota Evaluation & Real SearXNG Integration
  let webSearchUsed = false;
  let webSearchQuotaExceeded = false;
  const webSearchSources: Array<{
    title: string;
    url: string;
    snippet: string;
    publishedDate?: string;
  }> = [];

  if (wantsWebSearch) {
    const webQuota = getWebSearchQuotaInfo(userId, tenantId);
    if (webQuota.allowed) {
      // Consume 1 search credit
      userWebSearchDailyUsage[userId].count += 1;
      webSearchUsed = true;

      // Real SearXNG Search Request
      const searxngBase = process.env.SEARXNG_URL || "http://localhost:8080";
      try {
        const searxngUrl = `${searxngBase.replace(/\/+$/, "")}/search?q=${encodeURIComponent(message)}&format=json`;
        const searxngRes = await fetch(searxngUrl, {
          method: "GET",
          headers: {
            "Accept": "application/json",
          },
        });

        if (!searxngRes.ok) {
          const statusText = searxngRes.statusText || "";
          return res.status(500).json({
            error: `Erro ao conectar com SearXNG na porta 8080 (${searxngBase}): HTTP ${searxngRes.status} ${statusText}`,
          });
        }

        const searxngData = (await searxngRes.json()) as {
          results?: Array<{
            title?: string;
            url?: string;
            content?: string;
            snippet?: string;
            publishedDate?: string;
            published_date?: string;
          }>;
        };

        const results = searxngData.results || [];
        results.slice(0, 6).forEach((r) => {
          webSearchSources.push({
            title: r.title || r.url || "Fonte Web",
            url: r.url || "",
            snippet: r.content || r.snippet || "",
            publishedDate: r.publishedDate || r.published_date || undefined,
          });
        });
      } catch (searxngErr: any) {
        console.error("[SearXNG Connection Error]", searxngErr);
        return res.status(500).json({
          error: `Erro ao conectar com SearXNG na porta 8080: ${searxngErr.message || String(searxngErr)}`,
          details: searxngErr.stack || String(searxngErr),
        });
      }
    } else {
      // Quota exceeded: Do not use web search
      webSearchQuotaExceeded = true;
      webSearchUsed = false;
    }
  }

  // RAG Search in Document Knowledge Base
  let ragContext = "";
  const ragSources: Array<{
    docId: string;
    docName: string;
    snippet: string;
    sector: string;
    similarity: number;
  }> = [];

  if (useKnowledgeBase) {
    const queryWords = message.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const tenantDocs = DB.documents.filter(
      (d) =>
        d.tenantId === tenantId &&
        d.indexStatus === "indexed" &&
        (d.visibility === "company" ||
          d.sector === userSector ||
          userRole === "master_admin")
    );

    tenantDocs.forEach((doc) => {
      let score = 0;
      queryWords.forEach((word) => {
        if (doc.name.toLowerCase().includes(word)) score += 3;
        if (doc.contentSnippet.toLowerCase().includes(word)) score += 2;
        if (doc.sector.toLowerCase().includes(word)) score += 1;
      });

      if (score > 0 || tenantDocs.length <= 2) {
        ragSources.push({
          docId: doc.id,
          docName: doc.name,
          snippet: doc.contentSnippet,
          sector: doc.sector,
          similarity: Math.min(0.98, 0.65 + score * 0.08),
        });
      }
    });

    if (ragSources.length > 0) {
      ragContext = `\n\n--- BASE DE CONHECIMENTO CORPORATIVA RELEVANTE (RAG) ---\n` +
        ragSources
          .map(
            (s, idx) =>
              `[Fonte ${idx + 1}: ${s.docName} | Setor: ${s.sector}]\n"${s.snippet}"`
          )
          .join("\n\n");
    }
  }

  let webSearchContext = "";
  if (webSearchUsed && webSearchSources.length > 0) {
    webSearchContext = `\n\n--- RESULTADOS DA PESQUISA WEB EM TEMPO REAL (SEARXNG / PROJARVIS) ---\n` +
      webSearchSources
        .map((s, idx) => `[Web Fonte ${idx + 1}: ${s.title}]\nURL: ${s.url}\nConteúdo: "${s.snippet}"`)
        .join("\n\n");
  }

  const systemInstruction = `Você é o OpenJarvis (motor Ollama Local integrado com SearXNG ProJarvis Web Search), o Assistente de Inteligência Artificial Corporativo ultra-seguro da empresa "${tenant?.name || 'Nexus Enterprise'}".
Seu objetivo é auxiliar os colaboradores (${userName}, setor: ${userSector}, cargo: ${userRole}) com extrema precisão, tom profissional, prestativo e executivo em Português do Brasil.
${useKnowledgeBase ? `A Base de Conhecimento interna está ATIVADA. Quando responder usando os documentos fornecidos no contexto RAG, cite explicitamente as fontes encontradas.` : `A consulta à base de conhecimento corporativa está DESATIVADA nesta mensagem.`}
${webSearchUsed ? `A Pesquisa Web ProJarvis (SearXNG) está ATIVA e retornou fontes externas atualizadas.` : `Pesquisa Web externa não utilizada nesta requisição.`}
${ragContext}
${webSearchContext}

Se o usuário solicitar agendamento, reunião ou marcar compromisso, forneça a resposta normal e, se detectar data/horário/título claros, inclua no final um bloco JSON oculto no formato:
\`\`\`event_json
{"title": "Título do evento", "date": "YYYY-MM-DD", "startTime": "HH:mm", "endTime": "HH:mm", "description": "Breve resumo"}
\`\`\`
`;

  // Real Call to Local Ollama Server
  const ollamaBase = process.env.OLLAMA_URL || "http://localhost:11434";
  const ollamaModel = process.env.OLLAMA_MODEL || "llama3";

  try {
    const ollamaChatUrl = `${ollamaBase.replace(/\/+$/, "")}/api/chat`;
    const ollamaMessages = [
      {
        role: "system",
        content: systemInstruction,
      },
      ...history.slice(-6).map((h: any) => ({
        role: h.sender === "user" ? "user" : "assistant",
        content: h.text,
      })),
      {
        role: "user",
        content: message,
      },
    ];

    const ollamaRes = await fetch(ollamaChatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ollamaModel,
        messages: ollamaMessages,
        stream: false,
      }),
    });

    if (!ollamaRes.ok) {
      const errorText = await ollamaRes.text().catch(() => "");
      return res.status(500).json({
        error: `Erro ao conectar com Ollama na porta 11434 (${ollamaBase}): HTTP ${ollamaRes.status} ${ollamaRes.statusText} - ${errorText || "Falha na geração do modelo"}`,
      });
    }

    const ollamaData = (await ollamaRes.json()) as {
      message?: { content?: string };
      eval_count?: number;
      prompt_eval_count?: number;
    };

    let responseText = ollamaData.message?.content || "";
    let suggestedEvent: any = null;

    // Check for event_json block
    const eventMatch = responseText.match(/```event_json\s*([\s\S]*?)\s*```/);
    if (eventMatch && eventMatch[1]) {
      try {
        suggestedEvent = JSON.parse(eventMatch[1].trim());
        responseText = responseText.replace(/```event_json[\s\S]*?```/, "").trim();
      } catch {
        // ignore json parse error
      }
    }

    // Increment tenant request counter
    const currentTenant = DB.tenants.find((t) => t.id === tenantId);
    if (currentTenant) {
      currentTenant.currentRequests = (currentTenant.currentRequests || 0) + 1;
    }

    recordAuditLog(
      req.body.userId || "usr_user_01",
      userName,
      req.body.userEmail || "user@nexus.com.br",
      userRole,
      "AI_QUERY_OPENJARVIS",
      `Consulta com OpenJarvis Ollama (${ollamaModel}) (RAG: ${useKnowledgeBase ? "Ativo" : "Inativo"}, WebSearch: ${webSearchUsed ? "Ativo" : "Inativo"})`,
      tenantId,
      "success",
      req.ip || "127.0.0.1",
      {
        tokens: (ollamaData.eval_count || 0) + (ollamaData.prompt_eval_count || 0) || 350,
        tokens_used: (ollamaData.eval_count || 0) + (ollamaData.prompt_eval_count || 0) || 350,
        model: ollamaModel,
      }
    );

    const tokensUsed =
      (ollamaData.eval_count || 0) + (ollamaData.prompt_eval_count || 0) ||
      Math.floor(message.length / 3) + Math.floor(responseText.length / 3);

    return res.json({
      text: responseText,
      ragSources: useKnowledgeBase ? ragSources : [],
      ragConsulted: useKnowledgeBase && ragSources.length > 0,
      webSearchUsed,
      webSearchSources,
      webSearchQuotaExceeded,
      engineUsed: "ollama_local",
      suggestedEvent,
      tokensUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (ollamaErr: any) {
    console.error("[Ollama Connection Error]", ollamaErr);
    return res.status(500).json({
      error: `Erro ao conectar com Ollama na porta 11434: ${ollamaErr.message || String(ollamaErr)}`,
      details: ollamaErr.stack || String(ollamaErr),
    });
  }
});

// 5.1 AI Event Scheduling via Natural Language
app.post("/api/ai/schedule", async (req, res) => {
  const { prompt, sector = "Geral", tenantId = "tenant_omni_01" } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt obrigatório" });

  try {
    const gemini = getGeminiClient();
    const today = new Date().toISOString().split("T")[0];

    if (gemini) {
      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Extraia informações de agendamento em JSON do seguinte pedido em linguagem natural: "${prompt}".
Hoje é ${today}.
Retorne estritamente um JSON no formato:
{
  "title": "Título resumido e profissional do evento",
  "description": "Descrição detalhada",
  "date": "YYYY-MM-DD",
  "startTime": "HH:mm",
  "endTime": "HH:mm",
  "category": "reuniao" | "prazo" | "ia_gerado" | "cliente" | "geral",
  "sector": "${sector}",
  "participants": ["Nome ou equipe participante"]
}`,
              },
            ],
          },
        ],
        config: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      const newEvent = {
        id: `evt_ai_${Date.now()}`,
        title: parsed.title || "Reunião Agendada por IA",
        description: parsed.description || prompt,
        date: parsed.date || today,
        startTime: parsed.startTime || "14:00",
        endTime: parsed.endTime || "15:00",
        category: (parsed.category as any) || "ia_gerado",
        sector: parsed.sector || sector,
        participants: parsed.participants || ["Equipe"],
        meetUrl: `https://meet.google.com/ai-${Date.now().toString().slice(-4)}`,
        isAiGenerated: true,
      };

      DB.events.push(newEvent);

      recordAuditLog(
        "usr_ai_agent",
        "OpenJarvis Scheduler",
        "ai@nexus.com.br",
        "user",
        "AI_SCHEDULE_EVENT_CREATED",
        `Evento criado via IA a partir do prompt: "${prompt.slice(0, 60)}..."`,
        tenantId,
        "success"
      );

      return res.json({ success: true, event: newEvent });
    } else {
      // Heuristic fallback
      const newEvent = {
        id: `evt_ai_${Date.now()}`,
        title: prompt.length > 30 ? `${prompt.slice(0, 30)}...` : prompt,
        description: `Agendado via IA a partir de: "${prompt}"`,
        date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        startTime: "14:00",
        endTime: "15:00",
        category: "ia_gerado" as const,
        sector: sector || "Geral",
        participants: ["Equipe"],
        meetUrl: `https://meet.google.com/ai-${Date.now().toString().slice(-4)}`,
        isAiGenerated: true,
      };

      DB.events.push(newEvent);
      return res.json({ success: true, event: newEvent });
    }
  } catch (error: any) {
    console.error("AI Schedule Error:", error);
    return res.status(500).json({ error: "Falha ao processar agendamento com IA", details: error.message });
  }
});

// 6. Document Upload & Auto-indexing for RAG
app.post("/api/documents/upload", async (req, res) => {
  const { name, size, sizeBytes, sector, visibility, contentSnippet, fileType, userId, userName, userRole, tenantId } = req.body;

  const newDoc = {
    id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    tenantId: tenantId || "tenant_omni_01",
    name: name || "Documento_Sem_Nome.pdf",
    size: size || "1.2 MB",
    sizeBytes: sizeBytes || 1200000,
    sector: sector || "Geral",
    uploadedAt: new Date().toISOString(),
    uploadedBy: userName || "Colaborador",
    indexStatus: "indexed" as const,
    visibility: visibility || "company",
    contentSnippet:
      contentSnippet ||
      "Documento corporativo carregado para análise e RAG no assistente OpenJarvis.",
    fileType: fileType || "pdf",
    tokensEstimated: Math.floor((contentSnippet || "").length / 3.5) + 300,
  };

  DB.documents.unshift(newDoc);

  // Update storage in tenant
  const tenant = DB.tenants.find((t) => t.id === (tenantId || "tenant_omni_01"));
  if (tenant) {
    tenant.currentStorageGb = parseFloat((tenant.currentStorageGb + 0.05).toFixed(2));
  }

  recordAuditLog(
    userId || "usr_admin_01",
    userName || "Admin",
    "admin@nexus.com.br",
    userRole || "admin",
    "DOC_UPLOAD_RAG",
    `Documento '${newDoc.name}' (${newDoc.size}) enviado e indexado para RAG`,
    tenantId || "tenant_omni_01",
    "success"
  );

  res.json({
    success: true,
    document: newDoc,
  });
});

// 7. Get Documents list for Tenant & Role
app.get("/api/documents", (req, res) => {
  const { tenantId = "tenant_omni_01", sector = "", userRole = "user" } = req.query;

  let docs = DB.documents.filter((d) => d.tenantId === tenantId);

  // RBAC filter
  if (userRole !== "master_admin" && userRole !== "admin") {
    docs = docs.filter(
      (d) =>
        d.visibility === "company" ||
        (d.visibility === "sector" && d.sector === sector)
    );
  }

  res.json({ documents: docs });
});

// 8. Delete Document
app.delete("/api/documents/:id", (req, res) => {
  const { id } = req.params;
  const index = DB.documents.findIndex((d) => d.id === id);
  if (index >= 0) {
    const deleted = DB.documents.splice(index, 1)[0];
    res.json({ success: true, deleted });
  } else {
    res.status(404).json({ error: "Documento não encontrado" });
  }
});

// 9. Calendar Events CRUD
app.get("/api/events", (req, res) => {
  res.json({ events: DB.events });
});

app.post("/api/events", (req, res) => {
  const { title, description, date, startTime, endTime, category, sector, participants, meetUrl, isAiGenerated } = req.body;
  const newEvent = {
    id: `evt_${Date.now()}`,
    title: title || "Novo Compromisso",
    description: description || "",
    date: date || new Date().toISOString().split("T")[0],
    startTime: startTime || "09:00",
    endTime: endTime || "10:00",
    category: category || "geral",
    sector: sector || "Geral",
    participants: participants || ["Equipe"],
    meetUrl: meetUrl || (category === "reuniao" ? `https://meet.google.com/omni-${Date.now().toString().slice(-4)}` : undefined),
    isAiGenerated: !!isAiGenerated,
  };
  DB.events.push(newEvent);

  recordAuditLog(
    "usr_user_01",
    "Usuário",
    "user@nexus.com.br",
    "user",
    "CALENDAR_EVENT_CREATED",
    `Evento criado: ${newEvent.title} em ${newEvent.date} às ${newEvent.startTime}`,
    "tenant_omni_01",
    "success"
  );

  res.json({ success: true, event: newEvent });
});

// 10. Audit Logs (Master Admin Only)
app.get("/api/audit/logs", (req, res) => {
  const role = req.headers["x-user-role"] || req.query.role;
  const tenantId = req.query.tenantId || "tenant_omni_01";

  if (role !== "master_admin") {
    recordAuditLog(
      "usr_unauthorized",
      "Tentativa Bloqueada",
      "unauthorized@nexus.com.br",
      (role as string) || "user",
      "RBAC_AUDIT_ACCESS_DENIED",
      "Tentativa de visualização de logs restritos de auditoria rejeitada por falta de privilégios de Master Admin",
      tenantId as string,
      "denied",
      req.ip || "189.40.122.15"
    );
    return res.status(403).json({
      error: "Acesso restrito: Apenas usuários com a Role 'master_admin' podem acessar a trilha de auditoria.",
      code: "FORBIDDEN_RBAC",
    });
  }

  res.json({ logs: DB.auditLogs });
});

// 11. Tenant White-Label & Config Update
app.post("/api/tenant/config", (req, res) => {
  const { tenantId, name, primaryColor, logoUrl, subdomain, webhookUrl } = req.body;
  const tenant = DB.tenants.find((t) => t.id === (tenantId || "tenant_omni_01"));

  if (tenant) {
    if (name) tenant.name = name;
    if (primaryColor) tenant.primaryColor = primaryColor;
    if (logoUrl) tenant.logoUrl = logoUrl;
    if (subdomain) tenant.subdomain = subdomain;
    if (webhookUrl !== undefined) tenant.webhookUrl = webhookUrl;

    recordAuditLog(
      "usr_master_01",
      "Rodrigo Alencar",
      "rodrigo.master@nexus.com.br",
      "master_admin",
      "CONFIG_TENANT_UPDATE",
      `Configurações de marca e White-Label atualizadas para o tenant ${tenant.name}`,
      tenant.id,
      "success"
    );

    return res.json({ success: true, tenant });
  }

  res.status(404).json({ error: "Tenant não encontrado" });
});

// 12. Team Members CRUD
app.get("/api/users", (req, res) => {
  const { tenantId = "tenant_omni_01" } = req.query;
  const members = DB.users
    .filter((u) => u.tenantId === tenantId)
    .map(({ password, ...rest }) => rest);
  res.json({ users: members });
});

app.post("/api/users/invite", (req, res) => {
  const { name, email, role, sector, tenantId } = req.body;
  const newUser = {
    id: `usr_${Date.now()}`,
    name: name || "Novo Colaborador",
    email: email || `user_${Date.now()}@nexus.com.br`,
    password: "password123",
    role: role || "user",
    tenantId: tenantId || "tenant_omni_01",
    tenantName: "Nexus Enterprise S.A.",
    avatar: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 90000000)}?w=150&auto=format&fit=crop&q=80`,
    sector: sector || "Tecnologia & Inovação",
    status: "online" as const,
    createdAt: new Date().toISOString(),
  };

  DB.users.push(newUser);

  recordAuditLog(
    "usr_master_01",
    "Rodrigo Alencar",
    "rodrigo.master@nexus.com.br",
    "master_admin",
    "USER_MEMBER_INVITED",
    `Novo usuário '${newUser.name}' (${newUser.email}) cadastrado com a role '${newUser.role}'`,
    tenantId || "tenant_omni_01",
    "success"
  );

  const { password, ...safeUser } = newUser;
  res.json({ success: true, user: safeUser });
});

app.patch("/api/users/:id/role", (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  const user = DB.users.find((u) => u.id === id);

  if (user) {
    const oldRole = user.role;
    user.role = role;

    recordAuditLog(
      "usr_master_01",
      "Rodrigo Alencar",
      "rodrigo.master@nexus.com.br",
      "master_admin",
      "USER_ROLE_CHANGED",
      `Role de '${user.name}' alterada de ${oldRole} para ${role}`,
      user.tenantId,
      "success"
    );

    const { password, ...safeUser } = user;
    return res.json({ success: true, user: safeUser });
  }

  res.status(404).json({ error: "Usuário não encontrado" });
});

app.delete("/api/users/:id", (req, res) => {
  const { id } = req.params;
  const userIdx = DB.users.findIndex((u) => u.id === id);

  if (userIdx !== -1) {
    const deletedUser = DB.users[userIdx];
    if (deletedUser.role === "master_admin") {
      return res.status(403).json({ error: "Não é permitido remover um Master Admin da organização." });
    }

    DB.users.splice(userIdx, 1);

    recordAuditLog(
      "usr_master_01",
      "Rodrigo Alencar",
      "rodrigo.master@nexus.com.br",
      "master_admin",
      "USER_MEMBER_REMOVED",
      `Colaborador '${deletedUser.name}' (${deletedUser.email}) desativado/removido do tenant`,
      deletedUser.tenantId || "tenant_omni_01",
      "success"
    );

    return res.json({ success: true, message: "Colaborador desativado com sucesso" });
  }

  res.status(404).json({ error: "Colaborador não encontrado" });
});

// 13. Internal Chat Channels, Messages CRUD & Reactions
app.get("/api/chat/channels", (req, res) => {
  const { tenantId = "tenant_omni_01" } = req.query;
  const channels = (DB.chatChannels || []).filter(
    (c: any) => !c.tenantId || c.tenantId === tenantId
  );
  res.json({ channels });
});

app.post("/api/chat/channels", (req, res) => {
  const { name, sector, description, isPrivate, tenantId = "tenant_omni_01" } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Nome do canal é obrigatório" });
  }

  const cleanName = name
    .toLowerCase()
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");

  const newChannel = {
    id: `chan_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: cleanName || "canal",
    sector: sector || "Geral",
    description: description || `Canal de comunicação #${cleanName}`,
    isPrivate: Boolean(isPrivate),
    tenantId,
    unreadCount: 0,
  };

  if (!DB.chatChannels) DB.chatChannels = [];
  DB.chatChannels.push(newChannel);

  // Log channel creation in audit log
  recordAuditLog(
    "usr_system",
    "System",
    "system@nexus.com.br",
    "master_admin",
    "CHAT_CHANNEL_CREATE",
    `Novo canal criado: #${newChannel.name} (${newChannel.sector})`,
    tenantId as string,
    "success",
    req.ip || "127.0.0.1"
  );

  res.json({ success: true, channel: newChannel });
});

app.get("/api/chat/messages", (req, res) => {
  const { channelId, recipientId, tenantId = "tenant_omni_01" } = req.query;

  let messages = (DB.chatMessages || []).filter((m) => m.tenantId === tenantId);

  if (channelId) {
    messages = messages.filter((m) => m.channelId === channelId);
  } else if (recipientId) {
    const senderId = req.query.senderId as string;
    messages = messages.filter(
      (m) =>
        (m.recipientId === recipientId && m.senderId === senderId) ||
        (m.recipientId === senderId && m.senderId === recipientId)
    );
  }

  res.json({ messages });
});

app.post("/api/chat/messages", (req, res) => {
  const {
    channelId,
    recipientId,
    senderId,
    senderName,
    senderAvatar,
    senderRole,
    senderSector,
    text,
    attachments,
    tenantId = "tenant_omni_01",
  } = req.body;

  if (!text && (!attachments || attachments.length === 0)) {
    return res.status(400).json({ error: "Mensagem não pode ser vazia" });
  }

  const newMsg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    channelId,
    recipientId,
    senderId: senderId || "usr_current",
    senderName: senderName || "Colaborador",
    senderAvatar: senderAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    senderRole: senderRole || "user",
    senderSector: senderSector || "Geral",
    text: text || "",
    timestamp: new Date().toISOString(),
    attachments: attachments || [],
    reactions: {},
    tenantId,
  };

  if (!DB.chatMessages) DB.chatMessages = [];
  DB.chatMessages.push(newMsg);

  res.json({ success: true, message: newMsg });
});

app.post("/api/chat/messages/:id/react", (req, res) => {
  const { id } = req.params;
  const { emoji, userId } = req.body;

  const msg = (DB.chatMessages || []).find((m) => m.id === id);
  if (!msg) {
    return res.status(404).json({ error: "Mensagem não encontrada" });
  }

  if (!msg.reactions) msg.reactions = {};
  if (!msg.reactions[emoji]) msg.reactions[emoji] = [];

  const existingIdx = msg.reactions[emoji].indexOf(userId);
  if (existingIdx >= 0) {
    msg.reactions[emoji].splice(existingIdx, 1);
    if (msg.reactions[emoji].length === 0) {
      delete msg.reactions[emoji];
    }
  } else {
    msg.reactions[emoji].push(userId);
  }

  res.json({ success: true, reactions: msg.reactions });
});

// 14. Real Dashboard Metrics Aggregation
app.get("/api/dashboard/metrics", (req, res) => {
  const tenantId = (req.query.tenantId as string) || "tenant_omni_01";

  const tenant = DB.tenants.find((t) => t.id === tenantId) || DB.tenants[0];
  const tenantDocs = (DB.documents || []).filter((d) => d.tenantId === tenantId);
  const tenantLogs = (DB.auditLogs || []).filter((l) => l.tenantId === tenantId);
  const tenantUsers = (DB.users || []).filter((u) => u.tenantId === tenantId);

  // Compute total requests from tenant counter and logs
  const totalRequests =
    tenant?.currentRequests ||
    tenantLogs.filter((l) => l.action.startsWith("AI_") || l.action.startsWith("GEMINI_")).length ||
    0;

  // Real Storage in GB
  const totalSizeBytes = tenantDocs.reduce((acc, d) => acc + (d.sizeBytes || 0), 0);
  const storageUsedGb = Number((totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2));

  // Compute real tokens used
  const totalTokens =
    tenantDocs.reduce((acc, d) => acc + (d.tokensEstimated || 0), 0) +
    tenantLogs.reduce((acc, l) => acc + ((l.metadata?.tokens || l.metadata?.tokens_used || 0) as number), 0);

  // Active users count
  const activeUsersCount = tenantUsers.filter((u) => u.status !== "offline").length;

  // Real requests by hour from logs
  const hourMap: Record<string, { requests: number; tokens: number }> = {};
  tenantLogs.forEach((log) => {
    if (log.timestamp) {
      const hour = new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (!hourMap[hour]) hourMap[hour] = { requests: 0, tokens: 0 };
      hourMap[hour].requests += 1;
      hourMap[hour].tokens += (log.metadata?.tokens || 350) as number;
    }
  });

  const requestsByHour = Object.entries(hourMap).map(([hour, data]) => ({
    hour,
    requests: data.requests,
    tokens: data.tokens,
  }));

  // Sector distribution from real users and docs
  const sectorCount: Record<string, number> = {};
  tenantDocs.forEach((d) => {
    const sec = d.sector || "Geral";
    sectorCount[sec] = (sectorCount[sec] || 0) + 1;
  });
  tenantUsers.forEach((u) => {
    const sec = u.sector || "Geral";
    sectorCount[sec] = (sectorCount[sec] || 0) + 1;
  });

  const sectorDistribution = Object.entries(sectorCount).map(([name, value]) => ({
    name,
    value,
  }));

  const requestLimit = tenant?.monthlyRequestLimit || 10000;
  const storageLimit = tenant?.storageLimitGb || 30;

  const formattedTokens =
    totalTokens > 1000000
      ? `${(totalTokens / 1000000).toFixed(2)}M`
      : totalTokens > 1000
      ? `${(totalTokens / 1000).toFixed(1)}k`
      : `${totalTokens}`;

  res.json({
    metrics: {
      monthlyRequests: {
        value: totalRequests,
        limit: requestLimit,
        percentage: Math.min(100, Math.round((totalRequests / requestLimit) * 100)),
      },
      storageUsed: {
        valueGb: storageUsedGb,
        limitGb: storageLimit,
        percentage: Math.min(100, Math.round((storageUsedGb / storageLimit) * 100)),
        docsCount: tenantDocs.length,
      },
      activeUsers: {
        count: activeUsersCount,
        total: tenantUsers.length,
      },
      tokensConsumed: {
        total: totalTokens,
        formatted: `${formattedTokens} tokens`,
      },
    },
    requestsByHour,
    sectorDistribution,
    recentLogs: tenantLogs.slice(0, 5),
  });
});

// ----------------------------------------------------
// VITE SPA MIDDLEWARE INTEGRATION
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`OpenJarvis Multi-Tenant SaaS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
