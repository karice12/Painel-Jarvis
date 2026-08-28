// Comprehensive Senior Full-Stack End-to-End System Test Suite
const http = require("http");

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data, raw: data });
        }
      });
    });

    req.on("error", (e) => reject(e));
    if (postData) {
      req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

const tests = [];
let passCount = 0;
let failCount = 0;

function it(name, fn) {
  tests.push({ name, fn });
}

let masterToken = "";
let masterUser = null;
let standardToken = "";
let standardUser = null;
let createdDocId = null;
let createdEventId = null;
let createdChannelId = null;
let createdMessageId = null;

// 1. Health & Infrastructure
it("1. GET /api/health - Deve retornar status 'ok' com headers de segurança", async () => {
  const res = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/health",
    method: "GET",
  });
  if (res.status !== 200 || res.data.status !== "ok") {
    throw new Error(`Expected 200 ok, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
});

// 2. Auth: Master Admin Login (Pelegrino)
it("2. POST /api/auth/login - Login com email Master Admin (Pelegrino) com role 'master_admin'", async () => {
  const res = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { email: "pelegrinokarol@gmail.com", password: "password123" }
  );

  if (res.status !== 200 || !res.data.token || res.data.user.role !== "master_admin") {
    throw new Error(`Expected 200 with master_admin role, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
  masterToken = res.data.token;
  masterUser = res.data.user;
});

// 3. Auth: Verify Token & Get Session (/api/auth/me)
it("3. GET /api/auth/me - Obter sessão ativa via Bearer token", async () => {
  const res = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/auth/me",
    method: "GET",
    headers: { Authorization: `Bearer ${masterToken}` },
  });

  if (res.status !== 200 || res.data.user.email !== "pelegrinokarol@gmail.com") {
    throw new Error(`Expected 200 with active session, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
});

// 4. Auth: Register & Standard User Login
it("4. POST /api/auth/register - Cadastro de novo colaborador", async () => {
  const testEmail = `dev_${Date.now()}@workspace.com`;
  const res = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/register",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      email: testEmail,
      password: "password123",
      name: "Engenheiro Teste",
      sector: "Tecnologia & Inovação",
    }
  );

  if (res.status !== 200 || !res.data.token) {
    throw new Error(`Expected 200 register, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
  standardToken = res.data.token;
  standardUser = res.data.user;
});

// 5. Tenant Config: Visual Customization & White-label
it("5. POST /api/tenant/config - Salvar Personalização Visual da Empresa (Cores, Marca, Logo)", async () => {
  const res = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/tenant/config",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      name: "OmniJarvis Enterprise Corp",
      primaryColor: "#4f46e5",
      secondaryColor: "#06b6d4",
      logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200",
      customDomain: "app.omnijarvis.com.br",
      webhookUrl: "https://webhook.site/audit-logs",
      userId: masterUser.id,
      userName: masterUser.name,
      userRole: masterUser.role,
    }
  );

  if (res.status !== 200 || !res.data.success || res.data.tenant.name !== "OmniJarvis Enterprise Corp") {
    throw new Error(`Expected 200 with updated tenant config, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
});

// 6. Tenant Sectors: List & Create New Sector
it("6. POST /api/tenant/sectors - Criar Novo Setor Corporativo (ex: Jurídico & Compliance)", async () => {
  const res = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/tenant/sectors",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      sector: "Jurídico & Compliance",
      userId: masterUser.id,
      userName: masterUser.name,
      userRole: masterUser.role,
    }
  );

  if (res.status !== 200 || !res.data.success || !res.data.sectors.includes("Jurídico & Compliance")) {
    throw new Error(`Expected 200 with new sector added, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
});

// 7. OpenJarvis Engine AI Parameters Configuration
it("7. POST /api/tenant/ai-params - Salvar Parâmetros do Motor OpenJarvis (Temperatura, Tokens, RAG)", async () => {
  const res = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/tenant/ai-params",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      temperature: 0.35,
      maxOutputTokens: 3000,
      ragAutoSearch: true,
      citationThreshold: 0.8,
      userId: masterUser.id,
      userName: masterUser.name,
      userRole: masterUser.role,
    }
  );

  if (res.status !== 200 || !res.data.success || res.data.aiSettings.temperature !== 0.35) {
    throw new Error(`Expected 200 with saved AI parameters, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
});

// 8. Documents & RAG Knowledge Base CRUD
it("8. POST /api/documents/upload - Upload e Indexação de Documento com RAG", async () => {
  const res = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/documents/upload",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      name: "Manual_Seguranca_LGPD_2026.pdf",
      sector: "Jurídico & Compliance",
      visibility: "company",
      contentSnippet: "Diretrizes de conformidade LGPD da empresa: Todos os dados sensíveis devem ser criptografados ponta a ponta e auditados.",
      userId: masterUser.id,
      userName: masterUser.name,
      userRole: masterUser.role,
    }
  );

  if (res.status !== 200 || !res.data.success || !res.data.document.id) {
    throw new Error(`Expected 200 doc upload, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
  createdDocId = res.data.document.id;
});

it("8.1 GET /api/documents - Listagem de Documentos da Base de Conhecimento", async () => {
  const res = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/documents?tenantId=tenant_omni_01&userRole=master_admin",
    method: "GET",
  });

  if (res.status !== 200 || !Array.isArray(res.data.documents) || res.data.documents.length === 0) {
    throw new Error(`Expected 200 with document list, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
});

// 9. Calendar / Agenda CRUD & AI Scheduler
it("9. POST /api/events - Criar Evento na Agenda Corporativa", async () => {
  const res = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/events",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      title: "Alinhamento Estratégico Q3",
      description: "Reunião de diretoria e tecnologia para metas trimestrais.",
      date: new Date().toISOString().split("T")[0],
      startTime: "14:00",
      endTime: "15:30",
      category: "reuniao",
      sector: "Diretoria & Tecnologia",
      participants: ["Pelegrinokarol", "Equipe de Engenharia"],
    }
  );

  if (res.status !== 200 || !res.data.success || !res.data.event.id) {
    throw new Error(`Expected 200 event created, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
  createdEventId = res.data.event.id;
});

it("9.1 POST /api/ai/schedule - Agendamento Inteligente via Linguagem Natural", async () => {
  const res = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/ai/schedule",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      prompt: "Marcar reunião de revisão técnica de código amanhã às 16h com o time de engenharia",
      sector: "Tecnologia & Inovação",
    }
  );

  if (res.status !== 200 || !res.data.success || !res.data.event.title) {
    throw new Error(`Expected 200 AI schedule, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
});

// 10. Internal Chat Channels & Realtime Communications
it("10. POST /api/chat/channels - Criar Novo Canal de Comunicação Interno", async () => {
  const res = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/chat/channels",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      name: "compliance-juridico",
      sector: "Jurídico & Compliance",
      description: "Canal dedicado a dúvidas e alinhamentos de conformidade",
      isPrivate: false,
    }
  );

  if (res.status !== 200 || !res.data.success || !res.data.channel.id) {
    throw new Error(`Expected 200 create channel, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
  createdChannelId = res.data.channel.id;
});

it("10.1 GET /api/chat/channels - Listar Canais do Tenant", async () => {
  const res = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/chat/channels",
    method: "GET",
  });

  if (res.status !== 200 || !Array.isArray(res.data.channels) || res.data.channels.length === 0) {
    throw new Error(`Expected 200 with channels, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
});

// 11. Internal Chat Messages & Emoji Reactions
it("11. POST /api/chat/messages - Enviar Mensagem no Canal", async () => {
  const res = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/chat/messages",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      channelId: createdChannelId || "chan_geral",
      senderId: masterUser.id,
      senderName: masterUser.name,
      senderRole: masterUser.role,
      senderSector: masterUser.sector,
      text: "Olá a todos! Sejam bem-vindos ao novo canal de conformidade.",
    }
  );

  if (res.status !== 200 || !res.data.success || !res.data.message.id) {
    throw new Error(`Expected 200 send message, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
  createdMessageId = res.data.message.id;
});

it("11.1 POST /api/chat/messages/:id/react - Reagir com Emoji na Mensagem", async () => {
  const res = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/chat/messages/${createdMessageId}/react`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      emoji: "🚀",
      userId: masterUser.id,
    }
  );

  if (res.status !== 200 || !res.data.success || !res.data.reactions["🚀"]) {
    throw new Error(`Expected 200 emoji reaction, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
});

// 12. OpenJarvis AI Chat (RAG, Web Search & Fallback)
it("12. POST /api/ai/chat - Consulta Inteligente ao OpenJarvis com RAG Corporativo", async () => {
  const res = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/ai/chat",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      message: "Quais são as diretrizes de LGPD e segurança da nossa empresa?",
      useKnowledgeBase: true,
      userId: masterUser.id,
      userName: masterUser.name,
      userRole: masterUser.role,
      userSector: masterUser.sector,
    }
  );

  if (res.status !== 200 || (!res.data.text && !res.data.reply)) {
    throw new Error(`Expected 200 AI chat response, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
});

// 13. Users Management & Role Promotion
it("13. PATCH /api/users/:id/role - Alteração de Permissão de Colaborador", async () => {
  if (!standardUser) throw new Error("No standard user to update");

  const res = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/users/${standardUser.id}/role`,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    },
    {
      role: "admin",
      adminUserId: masterUser.id,
      adminUserName: masterUser.name,
      adminUserRole: masterUser.role,
    }
  );

  if (res.status !== 200 || !res.data.success || res.data.user.role !== "admin") {
    throw new Error(`Expected 200 role updated to admin, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
});

// 14. Audit Logs Compliance & Security Traceability
it("14. GET /api/audit-logs - Auditoria e Rastreabilidade LGPD/ISO27001", async () => {
  const res = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/audit-logs?role=master_admin&tenantId=tenant_omni_01",
    method: "GET",
    headers: { "x-user-role": "master_admin" },
  });

  if (res.status !== 200 || !res.data.success || !Array.isArray(res.data.logs)) {
    throw new Error(`Expected 200 audit logs, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
});

// 15. Real Dashboard Metrics Aggregation
it("15. GET /api/dashboard/metrics - Métricas Consolidadas do Painel", async () => {
  const res = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/dashboard/metrics?tenantId=tenant_omni_01",
    method: "GET",
  });

  if (res.status !== 200 || !res.data.success || typeof res.data.metrics.totalUsers !== "number") {
    throw new Error(`Expected 200 dashboard metrics, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
});

// Cleanup: Delete Document & Event
it("16. DELETE /api/documents/:id - Remoção Segura de Documento", async () => {
  if (!createdDocId) return;
  const res = await request({
    hostname: "localhost",
    port: 3000,
    path: `/api/documents/${createdDocId}`,
    method: "DELETE",
  });

  if (res.status !== 200 || !res.data.success) {
    throw new Error(`Expected 200 delete document, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
});

it("17. DELETE /api/events/:id - Cancelamento/Exclusão de Evento", async () => {
  if (!createdEventId) return;
  const res = await request({
    hostname: "localhost",
    port: 3000,
    path: `/api/events/${createdEventId}`,
    method: "DELETE",
  });

  if (res.status !== 200 || !res.data.success) {
    throw new Error(`Expected 200 delete event, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
});

async function runAll() {
  console.log("==================================================================");
  console.log("  INICIANDO SUÍTE COMPLETA DE TESTES AUTOMATIZADOS FULL-STACK    ");
  console.log("==================================================================\n");

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✅ [PASS] ${t.name}`);
      passCount++;
    } catch (err) {
      console.error(`❌ [FAIL] ${t.name}`);
      console.error(`   Erro: ${err.message}\n`);
      failCount++;
    }
  }

  console.log("\n==================================================================");
  console.log(`  RESUMO DA EXECUÇÃO: ${passCount} PASSOU | ${failCount} FALHOU (Total: ${tests.length})`);
  console.log("==================================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

runAll();
