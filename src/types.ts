export type Role = 'master_admin' | 'admin' | 'user';

export type UserStatus = 'online' | 'offline' | 'away';

export type NavTab =
  | 'dashboard'
  | 'ai_chat'
  | 'internal_chat'
  | 'knowledge_base'
  | 'agenda'
  | 'audit_logs'
  | 'settings';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string;
  tenantName: string;
  avatar?: string;
  sector: string; // e.g. 'Tecnologia & Inovação', 'Financeiro', 'Suporte', 'Marketing', 'Diretoria'
  status: UserStatus;
  needsPasswordChange?: boolean;
  temporaryPassword?: string;
  createdAt: string;
}

export interface TenantConfig {
  id: string;
  name: string;
  subdomain?: string;
  customDomain?: string;
  logo?: string;
  logoUrl?: string;
  primaryColor: string; // Hex color code
  secondaryColor?: string;
  themeMode?: 'dark' | 'light' | 'system';
  monthlyRequestLimit: number;
  currentRequests: number;
  storageLimitGb: number;
  currentStorageGb: number;
  apiKeyMasked?: string;
  webhookUrl?: string;
  plan: 'Starter' | 'Business' | 'Enterprise Pro';
  aiModelName?: string;
  sectors?: string[];
  aiSettings?: {
    temperature?: number;
    maxOutputTokens?: number;
    enableRagAutoSearch?: boolean;
  };
}

export interface RagCitation {
  docId: string;
  docName: string;
  snippet: string;
  sector: string;
  similarity?: number;
}

export interface WebSearchSource {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

export interface WebSearchQuotaInfo {
  webSearchLimit: number;
  webSearchUsed: number;
  remaining: number;
  activeUsersCount: number;
  monthlyPoolTotal: number;
  allowed: boolean;
  date?: string;
  message?: string;
}

export interface OpenJarvisMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  ragSources?: RagCitation[];
  ragConsulted?: boolean;
  webSearchUsed?: boolean;
  webSearchSources?: WebSearchSource[];
  isWebSearchEnabled?: boolean;
  audioBase64?: string;
  tokensUsed?: number;
  suggestedEvent?: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    description: string;
  };
}

export interface InternalChannel {
  id: string;
  name: string;
  sector: string;
  description: string;
  isPrivate: boolean;
  unreadCount: number;
}

export interface MessageAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  url?: string;
  dataUrl?: string;
  fileType?: string;
}

export interface InternalMessage {
  id: string;
  channelId?: string;
  recipientId?: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderRole: Role;
  senderSector: string;
  text: string;
  timestamp: string;
  tenantId?: string;
  attachments?: MessageAttachment[];
  reactions?: Record<string, string[]>;
}

export type DocumentVisibility = 'private' | 'sector' | 'company';
export type IndexStatus = 'indexed' | 'processing' | 'error';

export interface DocumentItem {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  sector: string;
  uploadedAt: string;
  uploadedBy: string;
  indexStatus: IndexStatus;
  visibility: DocumentVisibility;
  contentSnippet: string;
  fileType: 'pdf' | 'docx' | 'txt' | 'csv' | 'md';
  tokensEstimated: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  category: 'reuniao' | 'prazo' | 'ia_gerado' | 'cliente' | 'geral';
  sector?: string;
  participants: string[];
  meetUrl?: string;
  isAiGenerated?: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userRole: Role;
  action: string;
  details?: string;
  resource?: string;
  ip?: string;
  ipAddress?: string;
  userAgent?: string;
  tenantId?: string;
  status: 'success' | 'warning' | 'denied' | 'failed';
  metadata?: Record<string, any>;
}

export interface MetricCardData {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
  subtext: string;
  icon: string;
}
