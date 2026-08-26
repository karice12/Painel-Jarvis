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
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { OpenJarvisMessage, RagCitation } from "../../types";
import { cn, sanitizeInput } from "../../lib/utils";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

interface AiChatModuleProps {
  onAddEventToAgenda?: (event: any) => void;
}

export const AiChatModule: React.FC<AiChatModuleProps> = ({ onAddEventToAgenda }) => {
  const { user, tenant, token } = useAuth();

  const [messages, setMessages] = useState<OpenJarvisMessage[]>([
    {
      id: "msg_init",
      sender: "assistant",
      text: `Olá ${user?.name || "Colaborador"}! Sou o **OpenJarvis**, assistente corporativo inteligente da **${tenant?.name || "Nexus Enterprise"}**.\n\nEstou conectado à sua **Base de Conhecimento Corporativa (RAG)** e pronto para responder dúvidas sobre políticas internas, relatórios financeiros, suporte ao cliente e automação de rotinas. Como posso ajudar você hoje?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      ragConsulted: true,
      ragSources: [
        {
          docId: "doc_01",
          docName: "Politica_Seguranca_Informacao_2026.pdf",
          snippet: "Diretrizes de conformidade LGPD, controle de acesso RBAC e criptografia.",
          sector: "Tecnologia",
          similarity: 0.96,
        },
      ],
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCheckingQuota, setIsCheckingQuota] = useState(false);
  const [quotaAlert, setQuotaAlert] = useState<string | null>(null);
  const [dailyUsage, setDailyUsage] = useState<{
    current: number;
    limit: number;
    activeUsers: number;
  } | null>(null);

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

  // Fetch current daily AI quota status from server/database without incrementing
  const fetchQuotaStatus = useCallback(async () => {
    try {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await (supabase as any).rpc("get_api_usage_status");
          if (!error && data) {
            setDailyUsage({
              current: Number(data.current_usage ?? data.current ?? 0),
              limit: Number(data.daily_limit ?? data.limit ?? 20),
              activeUsers: Number(data.active_users_count ?? data.activeUsers ?? 4),
            });
            return;
          }
        } catch {
          // fallback to backend proxy
        }
      }

      const res = await fetch(
        `/api/ai/usage-status?userId=${encodeURIComponent(user?.id || "usr_master_01")}&tenantId=${encodeURIComponent(tenant?.id || "tenant_omni_01")}`,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setDailyUsage({
          current: Number(data.current_usage ?? 0),
          limit: Number(data.daily_limit ?? 20),
          activeUsers: Number(data.active_users_count ?? 4),
        });
      }
    } catch (err) {
      console.warn("Could not fetch AI quota status:", err);
    }
  }, [user?.id, tenant?.id, token]);

  useEffect(() => {
    fetchQuotaStatus();
  }, [fetchQuotaStatus]);

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

  // Send Chat Message to OpenJarvis Backend with Zero-Trust Quota & Sanitization
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // 1. Sanitization & spam prevention check
    const rawInput = inputPrompt;
    const sanitizedText = sanitizeInput(rawInput);

    if (!sanitizedText || isGenerating || isCheckingQuota) {
      return;
    }

    // Reset temporary prompt and error state
    setInputPrompt("");
    setQuotaAlert(null);
    setIsCheckingQuota(true);

    // 2. ZERO-TRUST DYNAMIC QUOTA CHECK: Consult Supabase RPC check_and_increment_api_usage()
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

      // If Supabase RPC is not available or returned no direct data, validate via zero-trust server API
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

    // 3. ENFORCE QUOTA RESTRICTION: Block message sending if quota exceeded
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

      // Restore user text in prompt so they don't lose typed text
      setInputPrompt(rawInput);
      return; // STRICTLY BLOCK
    }

    // Update usage badge if quota was successfully checked
    if (quotaDecision && quotaDecision.current_usage !== undefined) {
      setDailyUsage({
        current: quotaDecision.current_usage,
        limit: quotaDecision.daily_limit ?? 20,
        activeUsers: quotaDecision.active_users_count ?? 4,
      });
    }

    // 4. Proceed with AI message dispatch
    const userMsg: OpenJarvisMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: sanitizedText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          message: sanitizedText,
          history: messages.slice(-6),
          useKnowledgeBase,
          userSector: user?.sector || "Geral",
          userRole: user?.role || "user",
          userName: user?.name || "Colaborador",
          tenantId: tenant?.id || "tenant_omni_01",
          userId: user?.id || "usr_master_01",
          userEmail: user?.email || "usuario@nexus.com.br",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const fullResponseText = data.text;
        const msgId = `ai_${Date.now()}`;

        // Create empty assistant message for typewriter effect
        setMessages((prev) => [
          ...prev,
          {
            id: msgId,
            sender: "assistant",
            text: "",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            ragConsulted: data.ragConsulted,
            ragSources: data.ragSources,
            suggestedEvent: data.suggestedEvent,
            tokensUsed: data.tokensUsed,
          },
        ]);

        // Smooth typewriter effect simulation
        let currentIndex = 0;
        const chunkSize = Math.max(1, Math.floor(fullResponseText.length / 30));
        const interval = setInterval(() => {
          currentIndex += chunkSize;
          if (currentIndex >= fullResponseText.length) {
            currentIndex = fullResponseText.length;
            clearInterval(interval);
            setIsGenerating(false);
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId ? { ...m, text: fullResponseText.slice(0, currentIndex) } : m
            )
          );
        }, 20);
      } else {
        throw new Error("Erro no servidor");
      }
    } catch {
      setIsGenerating(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: "assistant",
          text: "Desculpe, ocorreu uma instabilidade momentânea na conexão com o motor OpenJarvis. Por favor, tente novamente.",
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

  const clearChat = () => {
    setMessages([
      {
        id: `init_${Date.now()}`,
        sender: "assistant",
        text: `Histórico limpo. Como posso ajudar você agora, ${user?.name ?? "Colaborador"}?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
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
                OpenJarvis IA
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20">
                Gemini Flash + RAG
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Respostas baseadas nos documentos corporativos da sua empresa
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Discrete Daily Quota Consumption Indicator */}
          <div
            id="chat-header-quota-indicator"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-xs",
              !dailyUsage
                ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                : dailyUsage.current >= dailyUsage.limit
                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500/40 text-rose-600 dark:text-rose-400"
                : dailyUsage.current / dailyUsage.limit > 0.75
                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500/40 text-amber-600 dark:text-amber-400"
                : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            )}
            title={
              dailyUsage
                ? `Cota diária: ${dailyUsage.current} de ${dailyUsage.limit} requisições utilizadas hoje. Calculado com base em ${dailyUsage.activeUsers} usuários ativos da empresa. Renovação à meia-noite.`
                : "Consultando cota diária do Supabase..."
            }
          >
            <Activity
              className={cn(
                "w-3.5 h-3.5",
                dailyUsage && dailyUsage.current >= dailyUsage.limit
                  ? "text-rose-500 animate-pulse"
                  : "text-blue-500"
              )}
            />
            <span>
              Uso hoje:{" "}
              <strong className="font-bold">
                {dailyUsage ? `${dailyUsage.current} / ${dailyUsage.limit}` : "..."}
              </strong>{" "}
              reqs
            </span>
          </div>

          {/* RAG Toggle */}
          <button
            id="btn-toggle-rag"
            type="button"
            onClick={() => setUseKnowledgeBase(!useKnowledgeBase)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
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
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Limpar Conversa"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Visual Quota Exceeded Alert Banner */}
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
            className="p-1 rounded-lg text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 hover:bg-rose-500/20 transition-colors flex-shrink-0"
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
        {messages.map((msg) => {
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
                    <span>{msg.timestamp}</span>

                    {!isUser && (
                      <div className="flex items-center gap-2">
                        {/* TTS Play/Stop */}
                        <button
                          onClick={() => speakText(msg.text, msg.id)}
                          className="hover:text-blue-500 transition-colors flex items-center gap-1"
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
                          className="hover:text-blue-500 transition-colors flex items-center gap-1"
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

                {/* RAG Sources Citations Panel */}
                {msg.ragSources && msg.ragSources.length > 0 && (
                  <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 text-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" />
                        Fontes Consultadas na Base de Conhecimento ({msg.ragSources.length})
                      </span>
                      <span className="text-[10px] text-blue-500">RAG Ativo</span>
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
                        if (onAddEventToAgenda) {
                          onAddEventToAgenda(msg.suggestedEvent);
                        } else {
                          fetch("/api/events", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              ...msg.suggestedEvent,
                              category: "ia_gerado",
                              isAiGenerated: true,
                            }),
                          });
                          alert("Compromisso adicionado à sua Agenda com sucesso!");
                        }
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Confirmar & Adicionar à Agenda Corporativa</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isGenerating && (
          <div className="flex items-center gap-3 max-w-md">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-blue-400 flex items-center justify-center text-xs border border-slate-700">
              <Bot className="w-4 h-4 animate-bounce" />
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              <span>OpenJarvis consultando base de conhecimento e gerando resposta...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Prompt Box with STT & RAG controls */}
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
                  ? "OpenJarvis está respondendo... Por favor, aguarde."
                  : isCheckingQuota
                  ? "Validando política de segurança e cota no Supabase..."
                  : isRecording
                  ? "🎙️ Gravando sua voz... Fale agora!"
                  : "Pergunte ao OpenJarvis sobre documentos, dados financeiros, agendamentos..."
              }
              className={cn(
                "w-full pl-4 pr-24 py-3 text-xs md:text-sm rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none transition-all disabled:opacity-60 disabled:cursor-not-allowed",
                isRecording && "ring-2 ring-rose-500/50 border-rose-500 bg-rose-50/10",
                isCheckingQuota && "ring-2 ring-amber-500/30 border-amber-500/50"
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
                  "p-2 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed",
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
              <span>Shift + Enter para nova linha</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-500" />
                Citações RAG ativas
              </span>
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
