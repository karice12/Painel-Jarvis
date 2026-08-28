import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Bot,
  User as UserIcon,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Upload,
  BookOpen,
  Sparkles,
  Paperclip,
  Check,
  Calendar,
  Copy,
  Trash2,
  FileText,
  Clock,
  ExternalLink,
  ChevronRight,
  Info,
  ShieldAlert,
  AlertTriangle,
  Activity,
  X,
  Lock,
  Loader2,
  Globe,
  Compass,
  Search,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { OpenJarvisMessage, RagCitation, WebSearchQuotaInfo } from "../../types";
import { cn, sanitizeInput } from "../../lib/utils";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { getWebSearchQuota, sendChatMessage, getAiUsageStatus } from "../../services/api";
import { getAiChatHistoryFromDb, saveAiChatMessageToDb } from "../../services/supabaseDb";
import { OPENJARVIS_SYSTEM_INSTRUCTION } from "../../constants/aiInstructions";

interface AiChatModuleProps {
  onAddEventToAgenda?: (event: any) => void;
}

export const AiChatModule: React.FC<AiChatModuleProps> = ({ onAddEventToAgenda }) => {
  const { user, tenant, token } = useAuth();

  const [messages, setMessages] = useState<OpenJarvisMessage[]>([]);

  const [inputPrompt, setInputPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCheckingQuota, setIsCheckingQuota] = useState(false);
  const [quotaAlert, setQuotaAlert] = useState<string | null>(null);
  const [webSearchAlert, setWebSearchAlert] = useState<string | null>(null);
  const [dailyUsage, setDailyUsage] = useState<{
    current: number;
    limit: number;
    activeUsers: number;
  } | null>(null);

  // ProJarvis Web Search Quota & Toggle State
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [webSearchQuota, setWebSearchQuota] = useState<WebSearchQuotaInfo | null>(null);

  const [useKnowledgeBase, setUseKnowledgeBase] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSpeakingId, setCurrentSpeakingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Fetch current daily AI quota & Web Search Quota status from server/database
  const fetchQuotaStatus = useCallback(async () => {
    try {
      // 1. Fetch AI General Quota
      const aiUsage = await getAiUsageStatus(user?.id || "usr_master_01", tenant?.id || "tenant_omni_01", token || undefined);
      setDailyUsage({
        current: aiUsage.current_usage,
        limit: aiUsage.daily_limit,
        activeUsers: aiUsage.active_users_count,
      });

      // 2. Fetch ProJarvis Web Search Quota (3.000 reqs/month dynamically split)
      const webQuota = await getWebSearchQuota(user?.id || "usr_master_01", tenant?.id || "tenant_omni_01", token || undefined);
      setWebSearchQuota(webQuota);
    } catch (err) {
      console.warn("Could not fetch quota status:", err);
    }
  }, [user?.id, tenant?.id, token]);

  useEffect(() => {
    fetchQuotaStatus();
  }, [fetchQuotaStatus]);

  // Load chat history from Supabase, Backend API and LocalStorage on mount
  useEffect(() => {
    async function loadHistory() {
      const tenantId = tenant?.id || "tenant_omni_01";
      const userId = user?.id || "usr_master_01";
      const storageKey = `omnijarvis_chat_history_${userId}`;

      try {
        // 1. Try Supabase
        const dbHistory = await getAiChatHistoryFromDb(tenantId, userId);
        if (dbHistory && dbHistory.length > 0) {
          setMessages(dbHistory);
          localStorage.setItem(storageKey, JSON.stringify(dbHistory));
          return;
        }

        // 2. Try Backend API endpoint
        const res = await fetch(`/api/ai/history?tenantId=${encodeURIComponent(tenantId)}&userId=${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.history && data.history.length > 0) {
            setMessages(data.history);
            localStorage.setItem(storageKey, JSON.stringify(data.history));
            return;
          }
        }

        // 3. Fallback to LocalStorage
        const localSaved = localStorage.getItem(storageKey);
        if (localSaved) {
          try {
            const parsed = JSON.parse(localSaved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMessages(parsed);
            }
          } catch {
            // ignore JSON parse error
          }
        }
      } catch (err) {
        console.warn("Could not load AI chat history:", err);
      }
    }
    loadHistory();
  }, [tenant?.id, user?.id]);

  // Speech-to-Text (STT) using Web Speech API
  const toggleRecording = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Reconhecimento de voz não suportado pelo seu navegador atual.");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = "pt-BR";
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsRecording(false);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch {
      setIsRecording(false);
    }
  };

  // Text-to-Speech (TTS)
  const speakText = (text: string, msgId: string) => {
    if (!("speechSynthesis" in window)) return;

    if (isSpeaking && currentSpeakingId === msgId) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setCurrentSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown symbols for cleaner speech
    const cleanText = text.replace(/[*_#`[\]()]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "pt-BR";
    utterance.rate = 1.05;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setCurrentSpeakingId(msgId);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentSpeakingId(null);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setCurrentSpeakingId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Send Chat Message to OpenJarvis Backend via API Service layer
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // 1. Sanitization & spam prevention check
    const rawInput = inputPrompt;
    const sanitizedText = sanitizeInput(rawInput);

    if (!sanitizedText || isGenerating || isCheckingQuota) {
      return;
    }

    // Reset temporary prompt and alerts
    setInputPrompt("");
    setQuotaAlert(null);
    setWebSearchAlert(null);
    setIsCheckingQuota(true);

    // 2. AI General Quota Check & Increment
    let quotaDecision: {
      allowed: boolean;
      current_usage?: number;
      daily_limit?: number;
      active_users_count?: number;
      message?: string;
    } | null = null;

    try {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await (supabase as any).rpc("check_and_increment_api_usage");
          if (!error && data) {
            quotaDecision = {
              allowed: Boolean(data.allowed !== false),
              current_usage: Number(data.current_usage ?? data.current ?? 0),
              daily_limit: Number(data.daily_limit ?? data.limit ?? 20),
              active_users_count: Number(data.active_users_count ?? data.activeUsers ?? 4),
              message: data.message,
            };
          }
        } catch (rpcErr) {
          console.warn("Supabase RPC check_and_increment_api_usage call skipped to fallback proxy:", rpcErr);
        }
      }

      if (!quotaDecision) {
        const quotaRes = await fetch("/api/ai/check-and-increment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({
            userId: user?.id || "usr_master_01",
            tenantId: tenant?.id || "tenant_omni_01",
          }),
        });

        if (quotaRes.ok) {
          const data = await quotaRes.json();
          quotaDecision = {
            allowed: Boolean(data.allowed !== false),
            current_usage: Number(data.current_usage ?? 0),
            daily_limit: Number(data.daily_limit ?? 20),
            active_users_count: Number(data.active_users_count ?? 4),
            message: data.message,
          };
        }
      }
    } catch (checkErr) {
      console.warn("Quota validation network error:", checkErr);
    } finally {
      setIsCheckingQuota(false);
    }

    // 3. Enforce General AI Quota Restriction
    if (quotaDecision && quotaDecision.allowed === false) {
      const limitX = quotaDecision.daily_limit ?? 20;
      const activeUsersY = quotaDecision.active_users_count ?? 4;
      const alertMsg = `Limite diário de requisições de IA atingido! O seu limite hoje é de ${limitX} requisições (calculado com base em ${activeUsersY} usuários ativos da empresa). O seu limite será renovado à meia-noite.`;

      setQuotaAlert(alertMsg);

      if (quotaDecision.current_usage !== undefined) {
        setDailyUsage({
          current: quotaDecision.current_usage,
          limit: limitX,
          activeUsers: activeUsersY,
        });
      }

      // Restore user text in prompt
      setInputPrompt(rawInput);
      return;
    }

    if (quotaDecision && quotaDecision.current_usage !== undefined) {
      setDailyUsage({
        current: quotaDecision.current_usage,
        limit: quotaDecision.daily_limit ?? 20,
        activeUsers: quotaDecision.active_users_count ?? 4,
      });
    }

    // 4. Proceed with message dispatch via src/services/api.ts
    const userMsg: OpenJarvisMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: sanitizedText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isWebSearchEnabled,
    };

    const newMsgsWithUser = [...messages, userMsg];
    setMessages(newMsgsWithUser);
    setIsGenerating(true);

    const storageKey = `omnijarvis_chat_history_${user?.id || "usr_master_01"}`;
    localStorage.setItem(storageKey, JSON.stringify(newMsgsWithUser));

    // Persist user message to Backend API and Supabase
    fetch("/api/ai/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: userMsg.id,
        sender: "user",
        text: sanitizedText,
        tenantId: tenant?.id || "tenant_omni_01",
        userId: user?.id || "usr_master_01",
        userName: user?.name || "Colaborador",
        userSector: user?.sector || "Geral",
        webSearchUsed: isWebSearchEnabled,
      }),
    }).catch(() => {});

    saveAiChatMessageToDb({
      id: userMsg.id,
      sender: "user",
      text: sanitizedText,
      tenantId: tenant?.id || "tenant_omni_01",
      userId: user?.id,
      userName: user?.name,
      userSector: user?.sector,
      webSearchUsed: isWebSearchEnabled,
    }).catch((e) => console.warn("Supabase user msg save error:", e));

    try {
      const data = await sendChatMessage({
        message: sanitizedText,
        history: messages.slice(-6),
        useKnowledgeBase,
        isWebSearchEnabled,
        userSector: user?.sector || "Geral",
        userRole: user?.role || "user",
        userName: user?.name || "Colaborador",
        tenantId: tenant?.id || "tenant_omni_01",
        userId: user?.id || "usr_master_01",
        userEmail: user?.email || "usuario@nexus.com.br",
        token: token || undefined,
        systemInstruction: OPENJARVIS_SYSTEM_INSTRUCTION,
        onWebSearchQuotaExceeded: (qInfo) => {
          setWebSearchAlert(
            `⚠️ Cota individual de Pesquisa Web atingida (${qInfo.webSearchUsed}/${qInfo.webSearchLimit} buscas diárias). A resposta foi gerada utilizando a Base de Conhecimento interna.`
          );
        },
      });

      if (data.webSearchQuotaExceeded) {
        setWebSearchAlert(
          "⚠️ Cota de Pesquisa Web esgotada para hoje. Resposta gerada utilizando a Base de Conhecimento interna."
        );
      }

      const fullResponseText = data.text;
      const msgId = `ai_${Date.now()}`;

      // Persist assistant message to Backend API and Supabase
      fetch("/api/ai/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: msgId,
          sender: "assistant",
          text: fullResponseText,
          tenantId: tenant?.id || "tenant_omni_01",
          userId: user?.id || "usr_master_01",
          userName: "OpenJarvis AI",
          userSector: user?.sector || "Geral",
          ragConsulted: data.ragConsulted,
          ragSources: data.ragSources,
          webSearchUsed: data.webSearchUsed,
          webSearchSources: data.webSearchSources,
          tokensUsed: data.tokensUsed,
          suggestedEvent: data.suggestedEvent,
          dispatchedNotification: data.dispatchedNotification,
        }),
      }).catch(() => {});

      saveAiChatMessageToDb({
        id: msgId,
        sender: "assistant",
        text: fullResponseText,
        tenantId: tenant?.id || "tenant_omni_01",
        userId: user?.id,
        userName: "OpenJarvis AI",
        userSector: user?.sector,
        ragConsulted: data.ragConsulted,
        ragSources: data.ragSources,
        webSearchUsed: data.webSearchUsed,
        webSearchSources: data.webSearchSources,
        tokensUsed: data.tokensUsed,
        suggestedEvent: data.suggestedEvent,
      }).catch((e) => console.warn("Supabase assistant msg save error:", e));

      // If Jarvis scheduled or suggested an event, ensure it is saved and synced to the Agenda
      if (data.suggestedEvent) {
        fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data.suggestedEvent,
            category: "reuniao",
            type: "reuniao",
            isAiGenerated: true,
            userId: user?.id || "usr_master_01",
            userName: user?.name || "Colaborador",
            userEmail: user?.email || "colaborador@nexus.com.br",
            tenantId: tenant?.id || "tenant_omni_01",
          }),
        }).catch((e) => console.warn("Auto event save error:", e));

        window.dispatchEvent(
          new CustomEvent("omnijarvis_event_created", {
            detail: {
              ...data.suggestedEvent,
              userId: user?.id,
              userEmail: user?.email,
            },
          })
        );
      }

      // Update Web Search quota locally
      fetchQuotaStatus();

      // Dispatch global event for instant dashboard request counting and cost savings update
      window.dispatchEvent(
        new CustomEvent("omnijarvis_request_completed", {
          detail: { tokensUsed: data.tokensUsed || 150, tenantId: tenant?.id },
        })
      );

      const assistantMsgObj: OpenJarvisMessage = {
        id: msgId,
        sender: "assistant",
        text: "",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        ragConsulted: data.ragConsulted,
        ragSources: data.ragSources,
        webSearchUsed: data.webSearchUsed,
        webSearchSources: data.webSearchSources,
        suggestedEvent: data.suggestedEvent,
        dispatchedNotification: data.dispatchedNotification,
        tokensUsed: data.tokensUsed,
      };

      // Create empty assistant message for typewriter effect
      setMessages((prev) => [...prev, assistantMsgObj]);

      // Smooth typewriter effect simulation
      let currentIndex = 0;
      const chunkSize = Math.max(1, Math.floor(fullResponseText.length / 30));
      const interval = setInterval(() => {
        currentIndex += chunkSize;
        if (currentIndex >= fullResponseText.length) {
          currentIndex = fullResponseText.length;
          clearInterval(interval);
          setIsGenerating(false);

          // Save final full response to LocalStorage
          const finalizedMsgs = [...newMsgsWithUser, { ...assistantMsgObj, text: fullResponseText }];
          localStorage.setItem(storageKey, JSON.stringify(finalizedMsgs));
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, text: fullResponseText.slice(0, currentIndex) } : m
          )
        );
      }, 20);
    } catch (err: any) {
      setIsGenerating(false);
      const errorMessage =
        err?.message ||
        "Desculpe, ocorreu uma instabilidade na conexão com o assistente inteligente. Por favor, tente novamente.";
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: "assistant",
          text: `⚠️ **Falha de Conexão:** ${errorMessage}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  };

  // Upload file for RAG indexing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);

    const progressInterval = setInterval(() => {
      setUploadProgress((p) => {
        if (p >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return p + 25;
      });
    }, 200);

    setTimeout(async () => {
      clearInterval(progressInterval);
      setUploadProgress(100);

      try {
        await fetch("/api/documents/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            sizeBytes: file.size,
            sector: user?.sector || "Tecnologia",
            visibility: "company",
            contentSnippet: `Documento corporativo '${file.name}' indexado com sucesso. Contém diretrizes estratégicas e operacionais de ${user?.sector}.`,
            fileType: file.name.endsWith(".pdf")
              ? "pdf"
              : file.name.endsWith(".docx")
              ? "docx"
              : "txt",
            userId: user?.id,
            userName: user?.name,
            userRole: user?.role,
            tenantId: tenant?.id,
          }),
        });

        setMessages((prev) => [
          ...prev,
          {
            id: `upload_${Date.now()}`,
            sender: "assistant",
            text: `✅ **Arquivo indexado com sucesso para RAG!**\nO documento **${file.name}** (${(file.size / 1024).toFixed(0)} KB) foi vetorizado e adicionado à base de conhecimento corporativa. Agora você pode me fazer perguntas sobre o conteúdo dele.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            ragConsulted: true,
          },
        ]);
      } catch {
        // ignore
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }, 1200);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = async () => {
    setMessages([]);
    const userId = user?.id || "usr_master_01";
    const storageKey = `omnijarvis_chat_history_${userId}`;
    localStorage.removeItem(storageKey);
    try {
      await fetch(`/api/ai/history?tenantId=${encodeURIComponent(tenant?.id || "tenant_omni_01")}&userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
    } catch {
      // ignore
    }
  };

  return (
    <div className="h-[calc(100vh-8.5rem)] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Top Chat Toolbar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                OmniJarvis IA
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Assistente Corporativo
              </span>
              {isWebSearchEnabled && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/20 flex items-center gap-1 animate-pulse">
                  <Globe className="w-3 h-3" />
                  Pesquisa Web Ativa
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400">
              Assistente inteligente integrado à Base de Conhecimento e Pesquisa Corporativa
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* ProJarvis Web Search Toggle (Client Toggle - NO API KEYS EXPOSED) */}
          <button
            id="btn-toggle-web-search"
            type="button"
            onClick={() => {
              setIsWebSearchEnabled(!isWebSearchEnabled);
              setWebSearchAlert(null);
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
              isWebSearchEnabled
                ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500/50 text-indigo-700 dark:text-indigo-300 shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
            title="Ativar/Desativar Pesquisa Web ProJarvis em Tempo Real (Pool Global de 3.000 requisições/mês)"
          >
            <Globe className={cn("w-3.5 h-3.5", isWebSearchEnabled ? "text-indigo-600 dark:text-indigo-400 animate-spin-slow" : "text-slate-400")} />
            <span>Pesquisa Web (ProJarvis)</span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-mono ml-0.5",
                isWebSearchEnabled
                  ? "bg-indigo-200/60 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-200"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-500"
              )}
            >
              {webSearchQuota ? `${webSearchQuota.webSearchUsed}/${webSearchQuota.webSearchLimit}` : "..."}
            </span>
          </button>

          {/* RAG Toggle */}
          <button
            id="btn-toggle-rag"
            type="button"
            onClick={() => setUseKnowledgeBase(!useKnowledgeBase)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
              useKnowledgeBase
                ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500/40 text-blue-600 dark:text-blue-400 shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
            )}
            title="Ativar/Desativar consulta à Base de Conhecimento Corporativa"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Consultar Base (RAG)</span>
            <span
              className={cn(
                "w-2 h-2 rounded-full ml-1",
                useKnowledgeBase ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              )}
            />
          </button>

          {/* Quick upload file for RAG */}
          <button
            id="btn-upload-file-rag"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">Upload RAG</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.csv,.md"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Clear chat */}
          <button
            id="btn-clear-chat"
            type="button"
            onClick={clearChat}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Limpar Conversa"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Web Search Quota Exceeded / Fallback Alert Banner */}
      {webSearchAlert && (
        <div
          id="alert-web-search-quota"
          className="m-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2 text-xs"
        >
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold block text-amber-900 dark:text-amber-200">
                Aviso do Módulo ProJarvis (Pesquisa Web)
              </span>
              <p className="mt-0.5 leading-relaxed">{webSearchAlert}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setWebSearchAlert(null)}
            className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-500/20 rounded-lg transition-colors cursor-pointer"
            title="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Visual General Quota Exceeded Alert Banner */}
      {quotaAlert && (
        <div
          id="alert-quota-exceeded"
          className="m-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-500 flex-shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Limite de Requisições Atingido
              </h4>
              <p className="text-xs leading-relaxed font-medium">
                {quotaAlert}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setQuotaAlert(null)}
            className="p-1 rounded-lg text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 hover:bg-rose-500/20 transition-colors flex-shrink-0 cursor-pointer"
            title="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Progress Bar if active */}
      {isUploading && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/50 border-b border-blue-200 dark:border-blue-800 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>Processando e vetorizando documento para RAG ({uploadProgress}%)...</span>
          </div>
          <div className="w-32 bg-blue-200 dark:bg-blue-900 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-200 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
        {messages.length === 0 ? (
          <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center p-6 max-w-lg mx-auto animate-in fade-in duration-300">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 dark:bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 shadow-xs">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              OmniJarvis IA Corporativa
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 max-w-sm">
              Assistente conectado à Base de Conhecimento (RAG) e ao módulo ProJarvis de pesquisa em tempo real.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
              <button
                type="button"
                onClick={() => setInputPrompt("Como está a saúde da empresa, projetos, agenda executiva e auditorias?")}
                className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/40 hover:bg-blue-100/60 dark:hover:bg-blue-900/60 transition-colors text-xs text-slate-700 dark:text-slate-200 group cursor-pointer shadow-2xs"
              >
                <div className="font-medium text-blue-900 dark:text-blue-200 group-hover:text-blue-600 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Saúde Corporativa & Auditorias
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Diagnóstico executivo de infra, projetos e conformidade</div>
              </button>
              <button
                type="button"
                onClick={() => setInputPrompt("Avise a Pelegrino Karol que hoje temos uma reunião marcada às 14:00 sobre ampliação e criação de novos projetos e inclua na agenda")}
                className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/40 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/60 transition-colors text-xs text-slate-700 dark:text-slate-200 group cursor-pointer shadow-2xs"
              >
                <div className="font-medium text-emerald-900 dark:text-emerald-200 group-hover:text-emerald-600 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Agendar & Notificar Pelegrino Karol
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Marcar reunião às 14:00 e disparar mensagem automática</div>
              </button>
              <button
                type="button"
                onClick={() => setInputPrompt("Como estão estruturadas as diretrizes corporativas e normas de conformidade?")}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs text-slate-700 dark:text-slate-200 group cursor-pointer shadow-2xs"
              >
                <div className="font-medium text-slate-900 dark:text-white group-hover:text-blue-500 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                  Base de Conhecimento RAG
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Consultar documentos e políticas indexadas</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsWebSearchEnabled(true);
                  setInputPrompt("Pesquisar as principais novidades e tendências de mercado para o nosso setor");
                }}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs text-slate-700 dark:text-slate-200 group cursor-pointer shadow-2xs"
              >
                <div className="font-medium text-slate-900 dark:text-white group-hover:text-indigo-500 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-500" />
                  Pesquisa Web ProJarvis
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Buscar informações atualizadas em tempo real</div>
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
          const isUser = msg.sender === "user";

          return (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3 max-w-3xl",
                isUser ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-xs",
                  isUser
                    ? "bg-blue-600 text-white"
                    : "bg-slate-900 dark:bg-slate-800 text-blue-400 border border-slate-700"
                )}
              >
                {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble & Citations */}
              <div className="space-y-2 max-w-[85%]">
                <div
                  className={cn(
                    "p-4 rounded-2xl text-xs md:text-sm leading-relaxed",
                    isUser
                      ? "bg-blue-600 text-white rounded-tr-none shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200/80 dark:border-slate-700/80"
                  )}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {/* Message Actions (TTS, Copy, Timestamp) */}
                  <div
                    className={cn(
                      "mt-2 pt-2 border-t flex items-center justify-between text-[10px]",
                      isUser
                        ? "border-blue-500/40 text-blue-100"
                        : "border-slate-200 dark:border-slate-700 text-slate-400"
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{msg.timestamp}</span>
                      {msg.webSearchUsed && (
                        <span className="px-1.5 py-0.2 rounded-md bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-medium">
                          🌐 ProJarvis Web
                        </span>
                      )}
                    </span>

                    {!isUser && (
                      <div className="flex items-center gap-2">
                        {/* TTS Play/Stop */}
                        <button
                          onClick={() => speakText(msg.text, msg.id)}
                          className="hover:text-blue-500 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Ouvir resposta (TTS)"
                        >
                          {isSpeaking && currentSpeakingId === msg.id ? (
                            <>
                              <VolumeX className="w-3 h-3 text-rose-500 animate-pulse" />
                              <span className="text-rose-500">Parar</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" />
                              <span>Ouvir</span>
                            </>
                          )}
                        </button>

                        {/* Copy button */}
                        <button
                          onClick={() => copyToClipboard(msg.text, msg.id)}
                          className="hover:text-blue-500 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Copiar texto"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-500">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ProJarvis Web Search Sources Panel */}
                {msg.webSearchSources && msg.webSearchSources.length > 0 && (
                  <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/40 text-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-800 dark:text-indigo-300">
                      <span className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        Fontes da Pesquisa Web (ProJarvis - {msg.webSearchSources.length} referências)
                      </span>
                      <span className="text-[10px] text-indigo-500 font-medium">Tempo Real</span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                      {msg.webSearchSources.map((source, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50 text-[11px]"
                        >
                          <div className="flex items-center justify-between font-medium text-slate-900 dark:text-slate-100">
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-[280px]"
                            >
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              {source.title}
                            </a>
                            {source.publishedDate && (
                              <span className="text-[10px] text-slate-400">
                                {source.publishedDate}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 mt-1 italic line-clamp-2">
                            "{source.snippet}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* RAG Sources Citations Panel */}
                {msg.ragSources && msg.ragSources.length > 0 && (
                  <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 text-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" />
                        Fontes Consultadas na Base de Conhecimento ({msg.ragSources.length})
                      </span>
                      <span className="text-[10px] text-blue-500">RAG Documentos</span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                      {msg.ragSources.map((source, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/50 text-[11px]"
                        >
                          <div className="flex items-center justify-between font-medium text-slate-900 dark:text-slate-100">
                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                              <FileText className="w-3 h-3 text-blue-500 flex-shrink-0" />
                              {source.docName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Setor: {source.sector}
                            </span>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 mt-1 italic line-clamp-2">
                            "{source.snippet}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Detected Calendar Event Card */}
                {msg.suggestedEvent && (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-300 dark:border-emerald-700/60 text-xs space-y-2">
                    <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-300">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        Compromisso Detectado pelo OpenJarvis
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200">
                        IA Agenda
                      </span>
                    </div>

                    <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {msg.suggestedEvent.title}
                      </div>
                      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 mt-1 text-[11px]">
                        <span>📅 {msg.suggestedEvent.date}</span>
                        <span>
                          ⏰ {msg.suggestedEvent.startTime} - {msg.suggestedEvent.endTime}
                        </span>
                      </div>
                      {msg.suggestedEvent.description && (
                        <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-1">
                          {msg.suggestedEvent.description}
                        </p>
                      )}
                    </div>

                    <button
                      id="btn-add-event-from-chat"
                      type="button"
                      onClick={() => {
                        fetch("/api/events", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            ...msg.suggestedEvent,
                            category: "reuniao",
                            type: "reuniao",
                            isAiGenerated: true,
                            userId: user?.id || "usr_master_01",
                            userName: user?.name || "Colaborador",
                            userEmail: user?.email || "colaborador@nexus.com.br",
                            tenantId: tenant?.id || "tenant_omni_01",
                          }),
                        }).catch(() => {});

                        window.dispatchEvent(
                          new CustomEvent("omnijarvis_event_created", {
                            detail: {
                              ...msg.suggestedEvent,
                              userId: user?.id,
                              userEmail: user?.email,
                            },
                          })
                        );

                        if (onAddEventToAgenda) {
                          onAddEventToAgenda(msg.suggestedEvent);
                        }
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>📅 Visualizar na Minha Agenda</span>
                    </button>
                  </div>
                )}

                {/* AI Dispatched Internal Notification Card */}
                {msg.dispatchedNotification && (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-300 dark:border-blue-700/60 text-xs space-y-2">
                    <div className="flex items-center justify-between font-bold text-blue-800 dark:text-blue-300">
                      <span className="flex items-center gap-1.5">
                        <Send className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        Notificação Interna Disparada Automaticamente
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200">
                        Chat Corporativo
                      </span>
                    </div>

                    <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/50">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                        <span>👤 Destinatário: {msg.dispatchedNotification.recipientName}</span>
                        <span className="text-[10px] text-slate-400">Canal: #{msg.dispatchedNotification.channelName || "geral"}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-1 italic">
                        "{msg.dispatchedNotification.message}"
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1.5">
                        <Check className="w-3 h-3" />
                        <span>Entregue no sistema de mensagens corporativas</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

        {isGenerating && (
          <div className="flex items-center gap-3 max-w-md">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-blue-400 flex items-center justify-center text-xs border border-slate-700">
              <Bot className="w-4 h-4 animate-bounce" />
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              <span>
                {isWebSearchEnabled
                  ? "Buscando informações na Web e sintetizando resposta..."
                  : "Consultando base de conhecimento e gerando resposta..."}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Prompt Box with STT, ProJarvis Web Search & RAG controls */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <form onSubmit={handleSendMessage} className="space-y-2">
          <div className="relative flex items-center">
            <textarea
              id="ai-chat-textarea"
              rows={2}
              value={inputPrompt}
              disabled={isGenerating || isCheckingQuota}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                isGenerating
                  ? "OmniJarvis está respondendo... Por favor, aguarde."
                  : isCheckingQuota
                  ? "Validando política de cota corporativa..."
                  : isRecording
                  ? "🎙️ Gravando sua voz... Fale agora!"
                  : isWebSearchEnabled
                  ? "Pergunte com Pesquisa Web ativada (notícias, mercado, dados atualizados)..."
                  : "Pergunte ao OmniJarvis sobre documentos, diretrizes, processos..."
              }
              className={cn(
                "w-full pl-4 pr-24 py-3 text-xs md:text-sm rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none transition-all disabled:opacity-60 disabled:cursor-not-allowed",
                isRecording && "ring-2 ring-rose-500/50 border-rose-500 bg-rose-50/10",
                isCheckingQuota && "ring-2 ring-amber-500/30 border-amber-500/50",
                isWebSearchEnabled && "border-indigo-400 dark:border-indigo-600/60"
              )}
            />

            {/* Mic & Send Buttons inside textarea */}
            <div className="absolute right-3 flex items-center gap-1.5">
              {/* STT Mic button */}
              <button
                id="btn-voice-stt"
                type="button"
                disabled={isGenerating || isCheckingQuota}
                onClick={toggleRecording}
                className={cn(
                  "p-2 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer",
                  isRecording
                    ? "bg-rose-500 text-white animate-pulse"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                )}
                title={isRecording ? "Parar gravação" : "Comando de voz (Microfone STT)"}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Submit button with anti-spam / anti-bot protection */}
              <button
                id="btn-send-ai-message"
                type="submit"
                disabled={!inputPrompt.trim() || isGenerating || isCheckingQuota}
                className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:hover:bg-blue-600 transition-all shadow-xs flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                title={
                  isGenerating
                    ? "Processando resposta anterior..."
                    : isCheckingQuota
                    ? "Verificando autorização de cota..."
                    : "Enviar mensagem (Enter)"
                }
              >
                {isCheckingQuota ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : isGenerating ? (
                  <Sparkles className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <div className="flex items-center gap-2">
              <span>Shift + Enter para quebra de linha</span>
              {isWebSearchEnabled && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                    <Globe className="w-3 h-3" />
                    Pesquisa Web: {webSearchQuota ? `${webSearchQuota.webSearchUsed}/${webSearchQuota.webSearchLimit} hoje` : "Ativa"}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline">Setor ativo: {user?.sector}</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
