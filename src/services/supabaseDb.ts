import { supabase, isSupabaseConfigured } from "../lib/supabase";
import {
  CalendarEvent,
  DocumentItem,
  InternalChannel,
  InternalMessage,
  OpenJarvisMessage,
  User,
} from "../types";

export interface DashboardMetricsData {
  monthlyRequests: {
    value: number;
    limit: number;
    percentage: number;
  };
  storageUsed: {
    valueGb: number;
    limitGb: number;
    percentage: number;
    docsCount: number;
  };
  activeUsers: {
    count: number;
    total: number;
  };
  tokensConsumed: {
    total: number;
    formatted: string;
  };
  hourlyData: { hour: string; requests: number; tokens: number }[];
  sectorData: { name: string; value: number }[];
  recentActivities: {
    id: string;
    user: string;
    sector: string;
    type: string;
    tokens: string;
    status: string;
    latency: string;
    time: string;
  }[];
}

/**
 * Fetch real aggregated metrics for the Dashboard directly from Supabase.
 */
export async function getRealDashboardMetrics(
  tenantId: string
): Promise<DashboardMetricsData | null> {
  if (!isSupabaseConfigured) return null;

  try {
    // 1. Fetch tenant limit and current config
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("monthly_request_limit, storage_limit_gb, plan, name")
      .eq("id", tenantId)
      .maybeSingle();

    const requestLimit = tenantData?.monthly_request_limit || 10000;
    const storageLimitGb = tenantData?.storage_limit_gb || 30;

    // 2. Fetch specific tenant_metrics record if available
    const { data: metricRecord } = await supabase
      .from("tenant_metrics")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Count active profiles / users
    const { data: profilesList, count: profileCount } = await supabase
      .from("profiles")
      .select("id, name, sector, status", { count: "exact" })
      .eq("tenant_id", tenantId);

    const totalUsers = profileCount ?? (profilesList?.length || 0);
    const onlineUsers = profilesList?.filter((p) => p.status === "online").length || 0;

    // 4. Calculate real RAG documents storage and count
    const { data: ragDocs, count: ragCount } = await supabase
      .from("rag_files")
      .select("id, size_bytes, sector", { count: "exact" })
      .eq("tenant_id", tenantId);

    const totalBytes = (ragDocs || []).reduce((acc, doc) => acc + (doc.size_bytes || 0), 0);
    const storageUsedGb = Number((totalBytes / (1024 * 1024 * 1024)).toFixed(2));
    const storagePercent = Math.min(100, Math.round((storageUsedGb / storageLimitGb) * 100));

    // 5. Total AI messages / tokens
    const { data: aiMsgs, count: aiCount } = await supabase
      .from("ai_chat_history")
      .select("id, tokens_used, created_at, user_name, user_sector, sender", { count: "exact" })
      .eq("tenant_id", tenantId);

    const userRequestsCount = (aiMsgs || []).filter((m: any) => m.sender === "user").length;
    const totalRequests = metricRecord?.total_requests ?? (userRequestsCount > 0 ? userRequestsCount : (aiCount || 0));
    const requestsPercent = Math.min(100, Math.round((totalRequests / requestLimit) * 100));

    const totalTokens = (aiMsgs || []).reduce((acc, m) => acc + (m.tokens_used || 0), 0);
    const formattedTokens =
      totalTokens > 1000000
        ? `${(totalTokens / 1000000).toFixed(2)}M`
        : totalTokens > 1000
        ? `${(totalTokens / 1000).toFixed(1)}k`
        : `${totalTokens}`;

    // 6. Sector usage distribution
    const sectorCountMap: Record<string, number> = {};
    (profilesList || []).forEach((p) => {
      const sec = p.sector || "Geral";
      sectorCountMap[sec] = (sectorCountMap[sec] || 0) + 1;
    });

    const sectorData = Object.entries(sectorCountMap).map(([name, value]) => ({
      name,
      value,
    }));

    // 7. Recent AI activity logs
    const { data: recentLogs } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(6);

    const recentActivities = (recentLogs || []).map((log: any) => {
      const createdAt = new Date(log.created_at || log.timestamp || Date.now());
      return {
        id: log.id,
        user: log.user_name || "Colaborador",
        sector: log.user_sector || log.sector || "Geral",
        type: log.action || "AI Query",
        tokens: log.metadata?.tokens_used ? `${log.metadata.tokens_used}` : "340",
        status: log.status === "success" ? "200 OK" : log.status || "200 OK",
        latency: log.metadata?.latency_ms ? `${log.metadata.latency_ms}ms` : "64ms",
        time: createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
    });

    return {
      monthlyRequests: {
        value: totalRequests,
        limit: requestLimit,
        percentage: requestsPercent,
      },
      storageUsed: {
        valueGb: storageUsedGb,
        limitGb: storageLimitGb,
        percentage: storagePercent,
        docsCount: ragCount || 0,
      },
      activeUsers: {
        count: onlineUsers,
        total: totalUsers,
      },
      tokensConsumed: {
        total: totalTokens,
        formatted: formattedTokens,
      },
      hourlyData: [],
      sectorData,
      recentActivities,
    };
  } catch (err) {
    console.warn("Error fetching Supabase dashboard metrics:", err);
    return null;
  }
}

/**
 * AI Chat History: Fetch from Supabase
 */
export async function getAiChatHistoryFromDb(
  tenantId: string,
  userId?: string
): Promise<OpenJarvisMessage[]> {
  if (!isSupabaseConfigured) return [];

  try {
    let query = supabase
      .from("ai_chat_history")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((item: any) => ({
      id: item.id,
      sender: item.sender,
      text: item.text,
      timestamp: item.created_at
        ? new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      ragConsulted: Boolean(item.rag_consulted),
      ragSources: item.rag_sources || undefined,
      webSearchUsed: Boolean(item.web_search_used),
      webSearchSources: item.web_search_sources || undefined,
      tokensUsed: item.tokens_used || undefined,
      suggestedEvent: item.suggested_event || undefined,
    }));
  } catch (err) {
    console.warn("Could not load AI chat history from Supabase:", err);
    return [];
  }
}

/**
 * AI Chat History: Save new message to Supabase
 */
export async function saveAiChatMessageToDb(payload: {
  id: string;
  sender: "user" | "assistant" | "system";
  text: string;
  tenantId: string;
  userId?: string;
  userName?: string;
  userSector?: string;
  ragConsulted?: boolean;
  ragSources?: any[];
  webSearchUsed?: boolean;
  webSearchSources?: any[];
  tokensUsed?: number;
  suggestedEvent?: any;
}): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase.from("ai_chat_history").insert({
      id: payload.id,
      tenant_id: payload.tenantId,
      user_id: payload.userId,
      user_name: payload.userName,
      user_sector: payload.userSector,
      sender: payload.sender,
      text: payload.text,
      rag_consulted: payload.ragConsulted || false,
      rag_sources: payload.ragSources || null,
      web_search_used: payload.webSearchUsed || false,
      web_search_sources: payload.webSearchSources || null,
      tokens_used: payload.tokensUsed || 0,
      suggested_event: payload.suggestedEvent || null,
      created_at: new Date().toISOString(),
    });

    return !error;
  } catch (err) {
    console.warn("Could not insert AI message into Supabase:", err);
    return false;
  }
}

/**
 * Agenda Events: Fetch from Supabase with User-Level Isolation
 */
export async function getAgendaEventsFromDb(
  tenantId: string,
  userId?: string,
  userEmail?: string
): Promise<CalendarEvent[]> {
  if (!isSupabaseConfigured) return [];

  try {
    let query = supabase
      .from("agenda_events")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data
      .filter((evt: any) => {
        // Enforce user isolation if user_id or userEmail provided
        if (userId && evt.user_id && evt.user_id !== userId) {
          const participants = Array.isArray(evt.participants) ? evt.participants : [evt.participants || ""];
          const isParticipant = participants.some((p: string) =>
            (userEmail && p.toLowerCase().includes(userEmail.toLowerCase())) ||
            (userId && p.toLowerCase().includes(userId.toLowerCase()))
          );
          if (!isParticipant) return false;
        }
        return true;
      })
      .map((evt: any) => ({
        id: evt.id,
        title: evt.title,
        description: evt.description || "",
        date: evt.date,
        startTime: evt.start_time || "10:00",
        endTime: evt.end_time || "11:00",
        category: evt.category || "geral",
        sector: evt.sector || "Geral",
        participants: Array.isArray(evt.participants) ? evt.participants : [evt.participants || "Equipe"],
        meetUrl: evt.meet_url || undefined,
        isAiGenerated: Boolean(evt.is_ai_generated),
        userId: evt.user_id || userId,
        userEmail: evt.user_email || userEmail,
        createdBy: evt.created_by || evt.user_id || userId,
        tenantId: evt.tenant_id || tenantId,
      }));
  } catch (err) {
    console.warn("Could not load agenda events from Supabase:", err);
    return [];
  }
}

/**
 * Agenda Events: Insert new event to Supabase
 */
export async function saveAgendaEventToDb(
  event: CalendarEvent,
  tenantId: string,
  userId?: string,
  userEmail?: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase.from("agenda_events").upsert(
      {
        id: event.id,
        tenant_id: tenantId,
        user_id: userId || event.userId,
        user_email: userEmail || event.userEmail,
        created_by: userId || event.userId,
        title: event.title,
        description: event.description,
        date: event.date,
        start_time: event.startTime,
        end_time: event.endTime,
        category: event.category,
        sector: event.sector,
        participants: event.participants,
        meet_url: event.meetUrl,
        is_ai_generated: event.isAiGenerated || false,
        created_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    return !error;
  } catch (err) {
    console.warn("Could not insert/upsert event into Supabase:", err);
    return false;
  }
}

/**
 * Agenda Events: Update existing event in Supabase
 */
export async function updateAgendaEventInDb(
  event: CalendarEvent,
  tenantId: string,
  userId?: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase
      .from("agenda_events")
      .update({
        title: event.title,
        description: event.description,
        date: event.date,
        start_time: event.startTime,
        end_time: event.endTime,
        category: event.category,
        sector: event.sector,
        participants: event.participants,
        meet_url: event.meetUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", event.id);

    return !error;
  } catch (err) {
    console.warn("Could not update event in Supabase:", err);
    return false;
  }
}

/**
 * Agenda Events: Delete event from Supabase
 */
export async function deleteAgendaEventFromDb(
  eventId: string,
  tenantId?: string,
  userId?: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase
      .from("agenda_events")
      .delete()
      .eq("id", eventId);

    return !error;
  } catch (err) {
    console.warn("Could not delete event from Supabase:", err);
    return false;
  }
}

/**
 * Internal Chat Channels: Fetch from Supabase
 */
export async function getInternalChannelsFromDb(tenantId: string): Promise<InternalChannel[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from("chat_channels")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });

    if (error || !data) return [];

    return data.map((c: any) => ({
      id: c.id,
      name: c.name,
      sector: c.sector,
      description: c.description || "",
      isPrivate: Boolean(c.is_private),
      unreadCount: 0,
    }));
  } catch (err) {
    console.warn("Could not load channels from Supabase:", err);
    return [];
  }
}

/**
 * Internal Chat Channels: Insert new channel
 */
export async function saveInternalChannelToDb(
  channel: InternalChannel,
  tenantId: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase.from("chat_channels").insert({
      id: channel.id,
      tenant_id: tenantId,
      name: channel.name,
      sector: channel.sector,
      description: channel.description,
      is_private: channel.isPrivate,
      created_at: new Date().toISOString(),
    });

    return !error;
  } catch (err) {
    console.warn("Could not insert channel into Supabase:", err);
    return false;
  }
}

/**
 * Internal Chat Messages: Fetch from Supabase
 */
export async function getInternalMessagesFromDb(
  tenantId: string,
  channelId?: string,
  recipientId?: string,
  senderId?: string
): Promise<InternalMessage[]> {
  if (!isSupabaseConfigured) return [];

  try {
    let query = supabase
      .from("chat_messages")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (channelId) {
      query = query.eq("channel_id", channelId);
    } else if (recipientId && senderId) {
      query = query.or(
        `and(sender_id.eq.${senderId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${senderId})`
      );
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((m: any) => ({
      id: m.id,
      channelId: m.channel_id || undefined,
      recipientId: m.recipient_id || undefined,
      senderId: m.sender_id,
      senderName: m.sender_name,
      senderAvatar: m.sender_avatar,
      senderRole: m.sender_role,
      senderSector: m.sender_sector,
      text: m.text,
      timestamp: m.created_at
        ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      tenantId: m.tenant_id,
      attachments: m.attachments || undefined,
      reactions: m.reactions || {},
    }));
  } catch (err) {
    console.warn("Could not load internal chat messages from Supabase:", err);
    return [];
  }
}

/**
 * Internal Chat Messages: Save message to Supabase
 */
export async function saveInternalMessageToDb(msg: InternalMessage): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase.from("chat_messages").insert({
      id: msg.id,
      tenant_id: msg.tenantId,
      channel_id: msg.channelId || null,
      recipient_id: msg.recipientId || null,
      sender_id: msg.senderId,
      sender_name: msg.senderName,
      sender_avatar: msg.senderAvatar,
      sender_role: msg.senderRole,
      sender_sector: msg.senderSector,
      text: msg.text,
      attachments: msg.attachments || null,
      reactions: msg.reactions || {},
      created_at: new Date().toISOString(),
    });

    return !error;
  } catch (err) {
    console.warn("Could not insert chat message into Supabase:", err);
    return false;
  }
}

/**
 * Knowledge Base (RAG Files): Fetch from Supabase
 */
export async function getKnowledgeBaseDocsFromDb(
  tenantId: string,
  userSector?: string,
  userRole?: string
): Promise<DocumentItem[]> {
  if (!isSupabaseConfigured) return [];

  try {
    let query = supabase
      .from("rag_files")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error || !data) return [];

    let filtered = data;
    if (userRole !== "master_admin" && userRole !== "admin") {
      filtered = data.filter((doc: any) => {
        if (doc.visibility === "company") return true;
        if (doc.visibility === "sector" && doc.sector === userSector) return true;
        return false;
      });
    }

    return filtered.map((d: any) => ({
      id: d.id,
      name: d.name,
      size: d.size || `${((d.size_bytes || 0) / 1024).toFixed(0)} KB`,
      sizeBytes: d.size_bytes || 0,
      sector: d.sector,
      uploadedAt: d.created_at || new Date().toISOString(),
      uploadedBy: d.uploaded_by || "Colaborador",
      indexStatus: d.index_status || "indexed",
      visibility: d.visibility || "company",
      contentSnippet: d.content_snippet || "",
      fileType: d.file_type || "pdf",
      tokensEstimated: d.tokens_estimated || 1000,
    }));
  } catch (err) {
    console.warn("Could not load knowledge base documents from Supabase:", err);
    return [];
  }
}

/**
 * Knowledge Base: Save document to Supabase
 */
export async function saveKnowledgeBaseDocToDb(doc: DocumentItem, tenantId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase.from("rag_files").insert({
      id: doc.id,
      tenant_id: tenantId,
      name: doc.name,
      size: doc.size,
      size_bytes: doc.sizeBytes,
      sector: doc.sector,
      uploaded_by: doc.uploadedBy,
      index_status: doc.indexStatus,
      visibility: doc.visibility,
      content_snippet: doc.contentSnippet,
      file_type: doc.fileType,
      tokens_estimated: doc.tokensEstimated,
      created_at: doc.uploadedAt || new Date().toISOString(),
    });

    return !error;
  } catch (err) {
    console.warn("Could not insert document into Supabase:", err);
    return false;
  }
}

/**
 * Knowledge Base: Delete document from Supabase
 */
export async function deleteKnowledgeBaseDocFromDb(docId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase.from("rag_files").delete().eq("id", docId);
    return !error;
  } catch (err) {
    console.warn("Could not delete document from Supabase:", err);
    return false;
  }
}

/**
 * Audit Logs: Fetch from Supabase with Backend API Fallback
 */
export async function getAuditLogsFromDb(tenantId: string): Promise<any[]> {
  // 1. Try Supabase if configured
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (!error && data && data.length > 0) {
        return data.map((log: any) => ({
          id: log.id,
          userId: log.user_id || "usr_anonymous",
          userName: log.user_name || "Colaborador",
          userRole: log.user_role || "user",
          action: log.action || "SYSTEM_ACTION",
          resource: log.resource || log.action || "Gateway",
          details: log.details || log.resource || log.action,
          ip: log.ip_address || "127.0.0.1",
          userAgent: log.user_agent || "Client Browser",
          timestamp: log.created_at || new Date().toISOString(),
          status: log.status || "success",
          metadata: log.metadata || {},
        }));
      }
    } catch (err) {
      console.warn("Supabase audit logs query error:", err);
    }
  }

  // 2. Seamless Backend / Server fallback
  try {
    const res = await fetch(`/api/audit/logs?tenantId=${encodeURIComponent(tenantId)}&role=master_admin`);
    if (res.ok) {
      const json = await res.json();
      const serverLogs = json.logs || [];
      return serverLogs.map((l: any) => ({
        id: l.id,
        userId: l.userId || "usr_anonymous",
        userName: l.userName || "Colaborador",
        userRole: l.userRole || "user",
        action: l.action || "SYSTEM_ACTION",
        resource: l.resource || l.details || l.action || "Gateway",
        details: l.details || l.resource || l.action,
        ip: l.ipAddress || l.ip || "189.40.122.15",
        userAgent: "Nexus Client Browser",
        timestamp: l.timestamp || new Date().toISOString(),
        status: l.status || "success",
        metadata: l.metadata || {},
      }));
    }
  } catch (err) {
    console.warn("Backend audit logs fetch error:", err);
  }

  return [];
}

/**
 * Audit Logs: Save to Supabase and Backend API with instant local dispatch
 */
export async function saveAuditLogToDb(log: {
  id?: string;
  tenantId: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  resource?: string;
  details?: string;
  status?: "success" | "warning" | "denied";
  ip?: string;
  metadata?: any;
}): Promise<boolean> {
  const normalizedLog = {
    id: log.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    tenantId: log.tenantId || "tenant_omni_01",
    userId: log.userId || "usr_anonymous",
    userName: log.userName || "Colaborador",
    userEmail: log.userEmail || "colaborador@nexus.com.br",
    userRole: log.userRole || "user",
    action: log.action,
    resource: log.resource || log.details || log.action,
    details: log.details || log.resource || log.action,
    status: log.status || "success",
    ip: log.ip || "189.40.122.15",
    metadata: log.metadata || null,
    timestamp: new Date().toISOString(),
  };

  // 1. Dispatch custom event for real-time UI reactive addition
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("omnijarvis_audit_log_created", {
        detail: normalizedLog,
      })
    );
  }

  // 2. Save to Supabase if configured
  if (isSupabaseConfigured) {
    try {
      await supabase.from("audit_logs").insert({
        id: normalizedLog.id,
        tenant_id: normalizedLog.tenantId,
        user_id: normalizedLog.userId,
        user_name: normalizedLog.userName,
        user_role: normalizedLog.userRole,
        action: normalizedLog.action,
        resource: normalizedLog.resource,
        status: normalizedLog.status,
        ip_address: normalizedLog.ip,
        metadata: normalizedLog.metadata,
        created_at: normalizedLog.timestamp,
      });
    } catch (err) {
      console.warn("Could not insert audit log into Supabase:", err);
    }
  }

  // 3. Always send to backend server endpoint
  try {
    await fetch("/api/audit/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizedLog),
    });
  } catch (err) {
    console.warn("Could not send audit log to backend:", err);
  }

  return true;
}

/**
 * Profiles/Users: Fetch from Supabase
 */
export async function getTeamProfilesFromDb(tenantId: string): Promise<User[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true });

    if (error || !data) return [];

    return data.map((p: any) => ({
      id: p.id,
      name: p.name || p.email?.split("@")[0] || "Colaborador",
      email: p.email || "",
      role: p.role || "user",
      tenantId: p.tenant_id || tenantId,
      tenantName: p.tenant_name || "Sua Empresa",
      avatar:
        p.avatar_url ||
        p.avatar ||
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      sector: p.sector || "Geral",
      status: p.status || "online",
      createdAt: p.created_at || new Date().toISOString(),
    }));
  } catch (err) {
    console.warn("Could not load profiles from Supabase:", err);
    return [];
  }
}

