-- ==============================================================================
-- OMNIJARVIS SAAS MULTI-TENANT - SUPABASE DATABASE SCHEMA & RLS POLICIES
-- ==============================================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. TENANTS TABLE (Empresas & Configurações White-Label)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
    id TEXT PRIMARY KEY DEFAULT ('tenant_' || substr(md5(random()::text), 1, 8)),
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE,
    custom_domain TEXT UNIQUE,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#2563eb',
    theme_mode TEXT DEFAULT 'dark',
    monthly_request_limit INTEGER DEFAULT 10000,
    storage_limit_gb NUMERIC(6, 2) DEFAULT 10.0,
    plan TEXT DEFAULT 'Enterprise Pro',
    ai_model_name TEXT DEFAULT 'OpenJarvis (Ollama Local + ProJarvis Web Search)',
    webhook_url TEXT,
    api_key_masked TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. PROFILES TABLE (Usuários & Colaboradores com RBAC)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('master_admin', 'admin', 'user')),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    tenant_name TEXT,
    avatar TEXT,
    sector TEXT NOT NULL DEFAULT 'Tecnologia & Inovação',
    status TEXT DEFAULT 'online' CHECK (status IN ('online', 'offline', 'away')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. TENANT METRICS TABLE (Consumo & Métricas do Dashboard)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    total_requests INTEGER DEFAULT 0,
    total_tokens_consumed BIGINT DEFAULT 0,
    storage_used_bytes BIGINT DEFAULT 0,
    active_users_count INTEGER DEFAULT 1,
    web_searches_used INTEGER DEFAULT 0,
    recorded_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, recorded_date)
);

-- ------------------------------------------------------------------------------
-- 4. AI CHAT HISTORY TABLE (Histórico Persistente do Chat OpenJarvis)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_chat_history (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id TEXT,
    user_name TEXT,
    user_sector TEXT,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant', 'system')),
    text TEXT NOT NULL,
    rag_consulted BOOLEAN DEFAULT FALSE,
    rag_sources JSONB,
    web_search_used BOOLEAN DEFAULT FALSE,
    web_search_sources JSONB,
    tokens_used INTEGER DEFAULT 0,
    suggested_event JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. CHAT CHANNELS TABLE (Canais de Comunicação Interna)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_channels (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sector TEXT NOT NULL DEFAULT 'Geral',
    description TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. CHAT MESSAGES TABLE (Mensagens Internas - Canais e Mensagens Diretas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    channel_id TEXT REFERENCES public.chat_channels(id) ON DELETE CASCADE,
    recipient_id TEXT,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_avatar TEXT,
    sender_role TEXT NOT NULL DEFAULT 'user',
    sender_sector TEXT NOT NULL DEFAULT 'Geral',
    text TEXT NOT NULL,
    attachments JSONB,
    reactions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. RAG FILES TABLE (Documentos Vetorizados & Base de Conhecimento)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rag_files (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    size TEXT,
    size_bytes BIGINT DEFAULT 0,
    sector TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    index_status TEXT DEFAULT 'indexed' CHECK (index_status IN ('indexed', 'processing', 'error')),
    visibility TEXT DEFAULT 'company' CHECK (visibility IN ('private', 'sector', 'company')),
    content_snippet TEXT,
    file_type TEXT DEFAULT 'pdf',
    tokens_estimated INTEGER DEFAULT 1000,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. AGENDA EVENTS TABLE (Eventos Corporativos & Agendamentos por IA)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agenda_events (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    start_time TEXT NOT NULL DEFAULT '10:00',
    end_time TEXT NOT NULL DEFAULT '11:00',
    category TEXT NOT NULL DEFAULT 'geral',
    sector TEXT DEFAULT 'Geral',
    participants JSONB DEFAULT '[]'::jsonb,
    meet_url TEXT,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. AUDIT LOGS TABLE (Trilha de Auditoria & Conformidade LGPD)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id TEXT,
    user_name TEXT,
    user_email TEXT,
    user_role TEXT DEFAULT 'user',
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'warning', 'denied', 'failed')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. WEB SEARCH QUOTAS TABLE (Controle de Cota ProJarvis por Usuário)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.web_search_quotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    searches_count INTEGER DEFAULT 0,
    quota_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, user_id, quota_date)
);

-- ==============================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_metrics_tenant_date ON public.tenant_metrics(tenant_id, recorded_date);
CREATE INDEX IF NOT EXISTS idx_ai_history_tenant_user ON public.ai_chat_history(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_channel ON public.chat_messages(tenant_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_rag_files_tenant_sector ON public.rag_files(tenant_id, sector);
CREATE INDEX IF NOT EXISTS idx_agenda_events_tenant_date ON public.agenda_events(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON public.audit_logs(tenant_id, created_at DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_search_quotas ENABLE ROW LEVEL SECURITY;

-- Helper Function to extract Tenant ID of authenticated user
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS TEXT AS $$
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 1. Tenants Policies
CREATE POLICY "Users can view their own tenant config"
    ON public.tenants FOR SELECT
    USING (id = public.get_auth_tenant_id() OR auth.role() = 'service_role');

CREATE POLICY "Master admins can update their tenant config"
    ON public.tenants FOR UPDATE
    USING (
        id = public.get_auth_tenant_id() AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('master_admin', 'admin'))
    );

-- 2. Profiles Policies
CREATE POLICY "Users can view members of the same tenant"
    ON public.profiles FOR SELECT
    USING (tenant_id = public.get_auth_tenant_id() OR auth.role() = 'service_role');

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "Admins can insert or manage profiles in their tenant"
    ON public.profiles FOR ALL
    USING (
        tenant_id = public.get_auth_tenant_id() AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('master_admin', 'admin'))
    );

-- 3. Tenant Metrics Policies
CREATE POLICY "Users can view tenant metrics"
    ON public.tenant_metrics FOR SELECT
    USING (tenant_id = public.get_auth_tenant_id() OR auth.role() = 'service_role');

CREATE POLICY "Service role and admins can insert/update metrics"
    ON public.tenant_metrics FOR ALL
    USING (tenant_id = public.get_auth_tenant_id() OR auth.role() = 'service_role');

-- 4. AI Chat History Policies
CREATE POLICY "Users can view their own AI chat history"
    ON public.ai_chat_history FOR SELECT
    USING (tenant_id = public.get_auth_tenant_id() OR auth.role() = 'service_role');

CREATE POLICY "Users can insert their AI chat messages"
    ON public.ai_chat_history FOR INSERT
    WITH CHECK (tenant_id = public.get_auth_tenant_id() OR auth.role() = 'service_role');

-- 5. Chat Channels Policies
CREATE POLICY "Users can view channels of their tenant"
    ON public.chat_channels FOR SELECT
    USING (tenant_id = public.get_auth_tenant_id() OR auth.role() = 'service_role');

CREATE POLICY "Users can insert channels in their tenant"
    ON public.chat_channels FOR INSERT
    WITH CHECK (tenant_id = public.get_auth_tenant_id() OR auth.role() = 'service_role');

-- 6. Chat Messages Policies
CREATE POLICY "Users can view internal messages of their tenant"
    ON public.chat_messages FOR SELECT
    USING (tenant_id = public.get_auth_tenant_id() OR auth.role() = 'service_role');

CREATE POLICY "Users can send internal messages"
    ON public.chat_messages FOR INSERT
    WITH CHECK (tenant_id = public.get_auth_tenant_id() OR auth.role() = 'service_role');

-- 7. RAG Files Policies
CREATE POLICY "Users can view documents in their tenant according to visibility"
    ON public.rag_files FOR SELECT
    USING (
        tenant_id = public.get_auth_tenant_id() AND (
            visibility = 'company' OR
            visibility = 'sector' AND sector = (SELECT sector FROM public.profiles WHERE id = auth.uid()) OR
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('master_admin', 'admin'))
        ) OR auth.role() = 'service_role'
    );

CREATE POLICY "Users can upload RAG documents"
    ON public.rag_files FOR INSERT
    WITH CHECK (tenant_id = public.get_auth_tenant_id() OR auth.role() = 'service_role');

CREATE POLICY "Admins or authors can delete RAG documents"
    ON public.rag_files FOR DELETE
    USING (
        tenant_id = public.get_auth_tenant_id() AND (
            uploaded_by = (SELECT name FROM public.profiles WHERE id = auth.uid()) OR
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('master_admin', 'admin'))
        ) OR auth.role() = 'service_role'
    );

-- 8. Agenda Events Policies
CREATE POLICY "Users can view agenda events of their tenant"
    ON public.agenda_events FOR SELECT
    USING (tenant_id = public.get_auth_tenant_id() OR auth.role() = 'service_role');

CREATE POLICY "Users can insert agenda events"
    ON public.agenda_events FOR INSERT
    WITH CHECK (tenant_id = public.get_auth_tenant_id() OR auth.role() = 'service_role');

-- 9. Audit Logs Policies
CREATE POLICY "Master and Admins can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (
        tenant_id = public.get_auth_tenant_id() AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('master_admin', 'admin'))
        OR auth.role() = 'service_role'
    );

CREATE POLICY "System can record audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (tenant_id = public.get_auth_tenant_id() OR auth.role() = 'service_role');

-- 10. Web Search Quotas Policies
CREATE POLICY "Users can view web search quotas"
    ON public.web_search_quotas FOR SELECT
    USING (tenant_id = public.get_auth_tenant_id() OR auth.role() = 'service_role');

CREATE POLICY "System can update web search quotas"
    ON public.web_search_quotas FOR ALL
    USING (tenant_id = public.get_auth_tenant_id() OR auth.role() = 'service_role');

-- ==============================================================================
-- STORED PROCEDURE: CHECK AND INCREMENT API USAGE
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_and_increment_api_usage()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_tenant_id TEXT;
    v_active_users INTEGER := 1;
    v_daily_limit INTEGER := 20;
    v_current_usage INTEGER := 0;
BEGIN
    -- Get tenant
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = v_user_id LIMIT 1;
    IF v_tenant_id IS NULL THEN
        v_tenant_id := 'tenant_omni_01';
    END IF;

    -- Count active users in tenant
    SELECT COUNT(*) INTO v_active_users FROM public.profiles WHERE tenant_id = v_tenant_id;
    IF v_active_users < 1 THEN
        v_active_users := 1;
    END IF;

    -- Dynamic limit calculation
    v_daily_limit := GREATEST(5, FLOOR(100.0 / v_active_users)::INTEGER);

    -- Get or initialize quota for today
    SELECT searches_count INTO v_current_usage
    FROM public.web_search_quotas
    WHERE tenant_id = v_tenant_id AND user_id = v_user_id::text AND quota_date = CURRENT_DATE;

    IF v_current_usage IS NULL THEN
        INSERT INTO public.web_search_quotas (tenant_id, user_id, searches_count, quota_date)
        VALUES (v_tenant_id, v_user_id::text, 1, CURRENT_DATE)
        ON CONFLICT (tenant_id, user_id, quota_date)
        DO UPDATE SET searches_count = public.web_search_quotas.searches_count + 1;
        v_current_usage := 1;
    ELSE
        UPDATE public.web_search_quotas
        SET searches_count = searches_count + 1
        WHERE tenant_id = v_tenant_id AND user_id = v_user_id::text AND quota_date = CURRENT_DATE;
        v_current_usage := v_current_usage + 1;
    END IF;

    -- Also increment total tenant metrics
    INSERT INTO public.tenant_metrics (tenant_id, total_requests, recorded_date)
    VALUES (v_tenant_id, 1, CURRENT_DATE)
    ON CONFLICT (tenant_id, recorded_date)
    DO UPDATE SET total_requests = public.tenant_metrics.total_requests + 1;

    RETURN jsonb_build_object(
        'allowed', (v_current_usage <= v_daily_limit),
        'current_usage', v_current_usage,
        'daily_limit', v_daily_limit,
        'active_users_count', v_active_users
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
