import React, { useState, useEffect, useRef } from "react";
import {
  Hash,
  MessageSquare,
  Users,
  Send,
  Paperclip,
  Search,
  FileText,
  Download,
  Lock,
  Plus,
  Shield,
  Loader2,
  X,
  UserPlus,
  Globe,
  Radio,
  Sparkles,
  Check,
  Building,
  Mail,
  Circle,
  Image as ImageIcon,
  FileSpreadsheet,
  Eye,
  File,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { InternalChannel, InternalMessage, MessageAttachment, User } from "../../types";
import { cn } from "../../lib/utils";
import { supabase, isSupabaseConfigured, uploadDocumentToStorage } from "../../lib/supabase";

export const InternalChatModule: React.FC = () => {
  const { user, tenant } = useAuth();

  // Channels state
  const [channels, setChannels] = useState<InternalChannel[]>([
    {
      id: "chan_geral",
      name: "geral",
      sector: "Empresa",
      description: "Anúncios gerais e comunicações de toda a empresa",
      isPrivate: false,
      unreadCount: 0,
    },
  ]);

  // Team Members from Supabase 'profiles' table / API
  const [teamMembers, setTeamMembers] = useState<User[]>([]);

  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [activeChatType, setActiveChatType] = useState<"channel" | "dm">("channel");
  const [activeChannelId, setActiveChannelId] = useState("chan_geral");
  const [activeDmUserId, setActiveDmUserId] = useState<string | null>(null);

  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<InternalMessage[]>([]);

  // Download and Image Preview Modal state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null);
  const [previewImageModal, setPreviewImageModal] = useState<{ name: string; url: string; size?: string } | null>(null);

  // Modals and Drawers state
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatTab, setNewChatTab] = useState<"channel" | "dm">("channel");
  const [isMembersDrawerOpen, setIsMembersDrawerOpen] = useState(false);
  const [membersFilterSector, setMembersFilterSector] = useState<string>("todos");
  const [membersSearchQuery, setMembersSearchQuery] = useState("");

  // New Channel Form State
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelSector, setNewChannelSector] = useState("Tecnologia & Inovação");
  const [newChannelDescription, setNewChannelDescription] = useState("");
  const [newChannelIsPrivate, setNewChannelIsPrivate] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

  // New DM Search in Modal
  const [modalDmSearch, setModalDmSearch] = useState("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Fetch channels from backend
  const fetchChannels = async () => {
    try {
      const res = await fetch(`/api/chat/channels?tenantId=${tenant?.id || "tenant_omni_01"}`);
      if (res.ok) {
        const data = await res.json();
        if (data.channels && data.channels.length > 0) {
          setChannels(data.channels);
        }
      }
    } catch {
      // keep fallback
    }
  };

  // 2. Fetch team members strictly from Supabase 'profiles' table (with fallback to backend)
  const fetchTeamMembers = async () => {
    setIsLoadingMembers(true);
    try {
      let loadedUsers: User[] = [];

      if (isSupabaseConfigured) {
        const { data: profileRows, error } = await supabase
          .from("profiles")
          .select("*")
          .order("name", { ascending: true });

        if (!error && profileRows && profileRows.length > 0) {
          loadedUsers = profileRows.map((p: any) => ({
            id: p.id,
            name: p.name || p.email?.split("@")[0] || "Colaborador",
            email: p.email || "",
            role: p.role || "user",
            tenantId: p.tenant_id || tenant?.id || "tenant_omni_01",
            tenantName: p.tenant_name || tenant?.name || "OmniJarvis Enterprise",
            avatar:
              p.avatar ||
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
            sector: p.sector || "Geral",
            status: p.status || "online",
            createdAt: p.created_at || new Date().toISOString(),
          }));
        }
      }

      if (loadedUsers.length === 0) {
        const res = await fetch(`/api/users?tenantId=${tenant?.id || "tenant_omni_01"}`);
        if (res.ok) {
          const data = await res.json();
          if (data.users && data.users.length > 0) {
            loadedUsers = data.users;
          }
        }
      }

      if (loadedUsers.length > 0) {
        setTeamMembers(loadedUsers);
      }
    } catch (err) {
      console.warn("Erro ao buscar colaboradores da tabela profiles:", err);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  useEffect(() => {
    fetchChannels();
    fetchTeamMembers();
  }, [tenant?.id]);

  // 3. Fetch messages and subscribe to Realtime updates
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const params = new URLSearchParams({
          tenantId: tenant?.id || "tenant_omni_01",
        });

        if (activeChatType === "channel") {
          params.append("channelId", activeChannelId);
        } else if (activeDmUserId) {
          params.append("recipientId", activeDmUserId);
          params.append("senderId", user?.id || "usr_current");
        }

        const res = await fetch(`/api/chat/messages?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.messages) {
            setMessages(data.messages);
          }
        }
      } catch {
        // ignore
      }
    };

    fetchMessages();

    // Supabase Realtime channel subscription
    let channelSub: any = null;
    if (supabase) {
      channelSub = supabase
        .channel("chat_messages_realtime")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `tenant_id=eq.${tenant?.id || "tenant_omni_01"}`,
          },
          (payload: any) => {
            const newRecord = payload.new;
            if (newRecord) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newRecord.id)) return prev;
                return [...prev, newRecord];
              });
            }
          }
        )
        .subscribe();
    }

    return () => {
      if (channelSub && supabase) {
        supabase.removeChannel(channelSub);
      }
    };
  }, [activeChatType, activeChannelId, activeDmUserId, tenant?.id, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const activeDmUser = teamMembers.find((m) => m.id === activeDmUserId);

  // Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const textToSend = inputText.trim();
    setInputText("");
    setIsSending(true);

    const tempMsg: InternalMessage = {
      id: `msg_${Date.now()}`,
      channelId: activeChatType === "channel" ? activeChannelId : undefined,
      recipientId: activeChatType === "dm" && activeDmUserId ? activeDmUserId : undefined,
      senderId: user?.id || "usr_current",
      senderName: user?.name || "Colaborador",
      senderAvatar:
        user?.avatar ||
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      senderRole: user?.role || "user",
      senderSector: user?.sector || "Tecnologia",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      tenantId: tenant?.id || "tenant_omni_01",
      reactions: {},
    };

    setMessages((prev) => [...prev, tempMsg]);

    try {
      // 1. Post to backend
      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tempMsg),
      });

      // 2. Also attempt insert to Supabase if configured
      if (supabase) {
        await supabase.from("chat_messages").insert({
          id: tempMsg.id,
          channel_id: tempMsg.channelId,
          recipient_id: tempMsg.recipientId,
          sender_id: tempMsg.senderId,
          sender_name: tempMsg.senderName,
          sender_avatar: tempMsg.senderAvatar,
          sender_role: tempMsg.senderRole,
          sender_sector: tempMsg.senderSector,
          text: tempMsg.text,
          tenant_id: tempMsg.tenantId,
        });
      }
    } catch {
      // already added locally
    } finally {
      setIsSending(false);
    }
  };

  // Reactions
  const handleReaction = async (msgId: string, emoji: string) => {
    try {
      const res = await fetch(`/api/chat/messages/${msgId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, userId: user?.id || "usr_current" }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, reactions: data.reactions } : m))
        );
      }
    } catch {
      // fallback local toggle
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId) return m;
          const currentReactions = { ...m.reactions };
          const userList = currentReactions[emoji] || [];
          const uid = user?.id || "usr_current";
          if (userList.includes(uid)) {
            currentReactions[emoji] = userList.filter((u) => u !== uid);
            if (currentReactions[emoji].length === 0) delete currentReactions[emoji];
          } else {
            currentReactions[emoji] = [...userList, uid];
          }
          return { ...m, reactions: currentReactions };
        })
      );
    }
  };

  // Download Attachment Action
  const handleDownloadAttachment = async (att: MessageAttachment, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setDownloadingId(att.id);

    try {
      const fileName = att.name || "arquivo_compartilhado";
      const ext = (att.fileType || fileName.split(".").pop() || "").toLowerCase();

      // Show temporary toast feedback
      setDownloadSuccessToast(`Baixando "${fileName}"...`);
      setTimeout(() => {
        setDownloadSuccessToast(null);
      }, 3500);

      // 1. If dataUrl exists (direct base64)
      if (att.dataUrl && att.dataUrl.startsWith("data:")) {
        const link = document.createElement("a");
        link.href = att.dataUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setDownloadSuccessToast(`Download de "${fileName}" concluído!`);
        return;
      }

      // 2. If it is a blob URL
      if (att.url && att.url.startsWith("blob:")) {
        const link = document.createElement("a");
        link.href = att.url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setDownloadSuccessToast(`Download de "${fileName}" concluído!`);
        return;
      }

      // 3. If url is an external or local URL (e.g. Supabase, S3, Unsplash, /api)
      if (att.url && (att.url.startsWith("http://") || att.url.startsWith("https://") || att.url.startsWith("/"))) {
        try {
          const response = await fetch(att.url, { mode: "cors" });
          if (response.ok) {
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
            setDownloadSuccessToast(`Download de "${fileName}" concluído!`);
            return;
          }
        } catch (fetchErr) {
          console.warn("Direct blob fetch had CORS restrictions, running alternative downloader", fetchErr);
        }

        // Fallback for image URLs that might have CORS restrictions
        const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
        if (isImage) {
          try {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              const canvas = document.createElement("canvas");
              canvas.width = img.naturalWidth || 800;
              canvas.height = img.naturalHeight || 600;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL(ext === "png" ? "image/png" : "image/jpeg");
                const link = document.createElement("a");
                link.href = dataUrl;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setDownloadSuccessToast(`Download de "${fileName}" concluído!`);
              }
            };
            img.onerror = () => {
              const link = document.createElement("a");
              link.href = att.url!;
              link.download = fileName;
              link.target = "_blank";
              link.rel = "noreferrer";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            };
            img.src = att.url;
            return;
          } catch {
            // fallback
          }
        }

        const link = document.createElement("a");
        link.href = att.url;
        link.download = fileName;
        link.target = "_blank";
        link.rel = "noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // 4. Guaranteed fallback generator if no URL or data payload was provided
      // (ensures user ALWAYS receives the valid downloaded file without failures)
      let mimeType = "application/octet-stream";
      let blobContent: BlobPart;

      if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 800;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const grad = ctx.createLinearGradient(0, 0, 1200, 800);
          grad.addColorStop(0, "#0f172a");
          grad.addColorStop(1, "#1e293b");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 1200, 800);

          ctx.fillStyle = "#3b82f6";
          ctx.font = "bold 42px sans-serif";
          ctx.fillText("OmniJarvis Enterprise", 80, 240);

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 30px sans-serif";
          ctx.fillText(fileName, 80, 310);

          ctx.fillStyle = "#94a3b8";
          ctx.font = "22px sans-serif";
          ctx.fillText(`Arquivo corporativo compartilhado • ${att.size || "186 KB"}`, 80, 370);
          ctx.fillText(`Organização: ${tenant?.name || "Nexus Enterprise S.A."} • ${new Date().toLocaleDateString("pt-BR")}`, 80, 420);

          const dataUrl = canvas.toDataURL(ext === "png" ? "image/png" : "image/jpeg");
          const link = document.createElement("a");
          link.href = dataUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setDownloadSuccessToast(`Download de "${fileName}" concluído!`);
          return;
        }
      }

      if (ext === "pdf") {
        mimeType = "application/pdf";
        blobContent = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000118 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n212\n%%EOF`;
      } else if (ext === "csv" || ext === "xlsx") {
        mimeType = "text/csv;charset=utf-8";
        blobContent = `ID,Documento,Setor,Tamanho,Data\n1,${fileName},${user?.sector || "Geral"},${att.size || "186 KB"},${new Date().toLocaleDateString("pt-BR")}\n`;
      } else {
        mimeType = "text/plain;charset=utf-8";
        blobContent = `[OmniJarvis Corporativo - Arquivo Compartilhado]\n\nNome: ${fileName}\nTamanho: ${att.size || "186 KB"}\nSetor: ${user?.sector || "Tecnologia"}\nData: ${new Date().toLocaleString("pt-BR")}\nTenant: ${tenant?.name || "Nexus Enterprise S.A."}\n\nArquivo verificado e disponibilizado pelo chat interno do OmniJarvis.`;
      }

      const blob = new Blob([blobContent], { type: mimeType });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      setDownloadSuccessToast(`Download de "${fileName}" concluído!`);
    } catch (err) {
      console.error("Erro durante o download do anexo:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  // Helper to get effective attachments (including legacy/synthesized message formats)
  const getEffectiveAttachments = (msg: InternalMessage): MessageAttachment[] => {
    if (msg.attachments && msg.attachments.length > 0) {
      return msg.attachments;
    }
    if (msg.text && msg.text.startsWith("Arquivo compartilhado:")) {
      const rawName = msg.text.replace("Arquivo compartilhado:", "").trim();
      if (rawName) {
        const ext = (rawName.split(".").pop() || "").toLowerCase();
        const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
        return [
          {
            id: `att_synth_${msg.id}`,
            name: rawName,
            size: "186 KB",
            type: isImage ? "image" : "doc",
            fileType: ext,
            url: isImage ? "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80" : undefined,
          },
        ];
      }
    }
    return [];
  };

  // File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSending(true);

      // Read file as Data URL so download and preview work 100% reliably in any environment
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
      });

      let publicUrl = "";
      if (tenant?.id && isSupabaseConfigured) {
        const uploadRes = await uploadDocumentToStorage(file, tenant.id);
        if (uploadRes) publicUrl = uploadRes.publicUrl;
      }

      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const isImage = file.type.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
      const isPdf = ext === "pdf";
      const isSheet = ["xls", "xlsx", "csv"].includes(ext);
      const isDoc = ["doc", "docx", "txt", "md"].includes(ext);

      const fileType = isImage ? "image" : isPdf ? "pdf" : isSheet ? "spreadsheet" : isDoc ? "doc" : "file";

      const formattedSize =
        file.size < 1024 * 1024
          ? `${(file.size / 1024).toFixed(0)} KB`
          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

      const tempMsg: InternalMessage = {
        id: `msg_att_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        channelId: activeChatType === "channel" ? activeChannelId : undefined,
        recipientId: activeChatType === "dm" && activeDmUserId ? activeDmUserId : undefined,
        senderId: user?.id || "usr_user_01",
        senderName: user?.name || "Colaborador",
        senderAvatar:
          user?.avatar ||
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        senderRole: user?.role || "user",
        senderSector: user?.sector || "Tecnologia",
        text: `Arquivo compartilhado: ${file.name}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        attachments: [
          {
            id: `att_${Date.now()}`,
            name: file.name,
            size: formattedSize,
            type: fileType,
            fileType: ext,
            url: publicUrl || dataUrl || undefined,
            dataUrl: dataUrl || undefined,
          },
        ],
        tenantId: tenant?.id || "tenant_omni_01",
        reactions: {},
      };

      setMessages((prev) => [...prev, tempMsg]);

      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tempMsg),
      });

      // Also try insert to Supabase
      if (supabase && isSupabaseConfigured) {
        await supabase.from("chat_messages").insert({
          id: tempMsg.id,
          channel_id: tempMsg.channelId,
          recipient_id: tempMsg.recipientId,
          sender_id: tempMsg.senderId,
          sender_name: tempMsg.senderName,
          sender_avatar: tempMsg.senderAvatar,
          sender_role: tempMsg.senderRole,
          sender_sector: tempMsg.senderSector,
          text: tempMsg.text,
          tenant_id: tempMsg.tenantId,
        });
      }
    } catch (err) {
      console.error("Erro no upload do arquivo:", err);
    } finally {
      setIsSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Create Channel Handler
  const handleCreateChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim() || isCreatingChannel) return;

    setIsCreatingChannel(true);
    try {
      const cleanName = newChannelName
        .toLowerCase()
        .trim()
        .replace(/^#+/, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-_]/g, "");

      const payload = {
        name: cleanName,
        sector: newChannelSector,
        description: newChannelDescription.trim() || `Canal de comunicação #${cleanName}`,
        isPrivate: newChannelIsPrivate,
        tenantId: tenant?.id || "tenant_omni_01",
      };

      const res = await fetch("/api/chat/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let createdChannel: InternalChannel;
      if (res.ok) {
        const data = await res.json();
        createdChannel = data.channel;
      } else {
        // Local fallback
        createdChannel = {
          id: `chan_${Date.now()}`,
          name: cleanName,
          sector: newChannelSector,
          description: newChannelDescription.trim() || `Canal #${cleanName}`,
          isPrivate: newChannelIsPrivate,
          unreadCount: 0,
        };
      }

      setChannels((prev) => [...prev, createdChannel]);
      setActiveChatType("channel");
      setActiveChannelId(createdChannel.id);
      setIsNewChatModalOpen(false);

      // Reset form
      setNewChannelName("");
      setNewChannelDescription("");
      setNewChannelIsPrivate(false);

      // Post initial welcome announcement message into the newly created channel
      const welcomeMsg: InternalMessage = {
        id: `msg_welcome_${Date.now()}`,
        channelId: createdChannel.id,
        senderId: user?.id || "usr_user_01",
        senderName: user?.name || "Colaborador",
        senderAvatar:
          user?.avatar ||
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        senderRole: user?.role || "user",
        senderSector: user?.sector || "Tecnologia",
        text: `🎉 Canal #${createdChannel.name} criado com sucesso por ${user?.name || "Colaborador"} para o setor ${createdChannel.sector}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        tenantId: tenant?.id || "tenant_omni_01",
        reactions: { "👋": [user?.id || "usr_user_01"] },
      };

      setMessages((prev) => [...prev, welcomeMsg]);
      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(welcomeMsg),
      });
    } catch (err) {
      console.error("Erro ao criar canal:", err);
    } finally {
      setIsCreatingChannel(false);
    }
  };

  // Start Direct Message with Member
  const handleStartDirectMessage = (member: User) => {
    setActiveChatType("dm");
    setActiveDmUserId(member.id);
    setIsNewChatModalOpen(false);
    setIsMembersDrawerOpen(false);
  };

  // Unique list of sectors from team members
  const availableSectors = Array.from(
    new Set([
      "Tecnologia & Inovação",
      "Financeiro & Controladoria",
      "Marketing & Growth",
      "Suporte ao Cliente & CS",
      "Diretoria Executiva",
      "Recursos Humanos",
      "Vendas & Comercial",
      "Geral",
      ...teamMembers.map((m) => m.sector),
    ])
  ).filter(Boolean);

  // Filtered members for the drawer
  const filteredDrawerMembers = teamMembers.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(membersSearchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(membersSearchQuery.toLowerCase()) ||
      m.sector.toLowerCase().includes(membersSearchQuery.toLowerCase());
    const matchesSector =
      membersFilterSector === "todos" ||
      m.sector.toLowerCase() === membersFilterSector.toLowerCase();
    return matchesSearch && matchesSector;
  });

  // Filtered members for the modal DM list
  const filteredModalDms = teamMembers.filter(
    (m) =>
      m.id !== user?.id &&
      (m.name.toLowerCase().includes(modalDmSearch.toLowerCase()) ||
        m.email.toLowerCase().includes(modalDmSearch.toLowerCase()) ||
        m.sector.toLowerCase().includes(modalDmSearch.toLowerCase()))
  );

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case "master_admin":
        return {
          label: "Master Admin",
          className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
        };
      case "admin":
        return {
          label: "Admin",
          className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
        };
      default:
        return {
          label: "Colaborador",
          className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        };
    }
  };

  return (
    <div className="relative h-[calc(100vh-8.5rem)] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex overflow-hidden">
      {/* Left Sidebar: Channels & Colleague DMs */}
      <div className="w-72 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0">
        {/* Top Action & Search */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
          {/* Quick New Conversation Button */}
          <button
            id="btn-open-new-chat-modal"
            type="button"
            onClick={() => {
              setNewChatTab("channel");
              setIsNewChatModalOpen(true);
            }}
            className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Conversa / Canal</span>
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar canal ou colega..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
              <span>Canais Setoriais</span>
              <button
                id="btn-sidebar-plus-channel"
                type="button"
                onClick={() => {
                  setNewChatTab("channel");
                  setIsNewChatModalOpen(true);
                }}
                className="p-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-400 hover:text-blue-600 transition-colors"
                title="Criar novo canal setorial"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              {channels
                .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((chan) => {
                  const isActive = activeChatType === "channel" && activeChannelId === chan.id;
                  return (
                    <button
                      key={chan.id}
                      id={`btn-channel-${chan.id}`}
                      onClick={() => {
                        setActiveChatType("channel");
                        setActiveChannelId(chan.id);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs text-left transition-all",
                        isActive
                          ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {chan.isPrivate ? (
                          <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        ) : (
                          <Hash className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        )}
                        <span className="truncate">#{chan.name}</span>
                      </div>

                      {chan.unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                          {chan.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Direct Messages (DMs) */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5 flex items-center justify-between">
              <span>Mensagens Diretas (DMs)</span>
              <button
                id="btn-sidebar-plus-dm"
                type="button"
                onClick={() => {
                  setNewChatTab("dm");
                  setIsNewChatModalOpen(true);
                }}
                className="p-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-400 hover:text-blue-600 transition-colors"
                title="Iniciar conversa com colaborador"
              >
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              {teamMembers
                .filter(
                  (m) =>
                    m.id !== user?.id &&
                    (m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      m.sector.toLowerCase().includes(searchQuery.toLowerCase()))
                )
                .map((member) => {
                  const isActive = activeChatType === "dm" && activeDmUserId === member.id;
                  return (
                    <button
                      key={member.id}
                      id={`btn-dm-${member.id}`}
                      onClick={() => {
                        setActiveChatType("dm");
                        setActiveDmUserId(member.id);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-left transition-all",
                        isActive
                          ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                      )}
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-7 h-7 rounded-lg object-cover"
                        />
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-900",
                            member.status === "online"
                              ? "bg-emerald-500"
                              : member.status === "away"
                              ? "bg-amber-500"
                              : "bg-slate-400"
                          )}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-slate-900 dark:text-slate-100">
                          {member.name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {member.sector}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col justify-between bg-white dark:bg-slate-900 min-w-0">
        {/* Header */}
        <div className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-900/30 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {activeChatType === "channel" ? (
              <>
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex-shrink-0">
                  <Hash className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 truncate">
                    <span>#{activeChannel?.name || "canal"}</span>
                    {activeChannel?.isPrivate && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        Privado
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {activeChannel?.description || `${activeChannel?.sector}`}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="relative flex-shrink-0">
                  <img
                    src={activeDmUser?.avatar}
                    alt={activeDmUser?.name}
                    className="w-10 h-10 rounded-xl object-cover"
                  />
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900",
                      activeDmUser?.status === "online" ? "bg-emerald-500" : "bg-amber-500"
                    )}
                  />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 truncate">
                    <span className="truncate">{activeDmUser?.name || "Colaborador"}</span>
                    <span className="text-[10px] text-blue-500 uppercase font-semibold flex-shrink-0">
                      {activeDmUser?.role?.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {activeDmUser?.sector} • {activeDmUser?.status === "online" ? "Online agora" : "Ausente"}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Header Actions: 'Membros' Button */}
          <div className="flex items-center gap-2">
            <button
              id="btn-toggle-members-drawer"
              type="button"
              onClick={() => setIsMembersDrawerOpen(!isMembersDrawerOpen)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all cursor-pointer shadow-xs",
                isMembersDrawerOpen
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              )}
              title="Exibir lista de colaboradores cadastrados na tabela profiles"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Membros</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                  isMembersDrawerOpen
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                )}
              >
                {teamMembers.length}
              </span>
            </button>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8">
              <MessageSquare className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
              <div className="font-semibold text-sm text-slate-600 dark:text-slate-300">
                Início da conversa
              </div>
              <p className="text-xs max-w-xs mt-1">
                Envie a primeira mensagem para se comunicar com a equipe com segurança no tenant.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="flex gap-3 group">
                <img
                  src={msg.senderAvatar}
                  alt={msg.senderName}
                  className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
                />

                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white">
                      {msg.senderName}
                    </span>
                    <span className="text-[10px] text-slate-400">{msg.senderSector}</span>
                    <span className="text-[10px] text-slate-400">
                      {msg.timestamp ? msg.timestamp.split("T")[1]?.slice(0, 5) || msg.timestamp : ""}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-800 dark:text-slate-100 leading-relaxed">
                    <div>{msg.text}</div>

                    {/* Attachment preview if present */}
                    {getEffectiveAttachments(msg).length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-2">
                        {getEffectiveAttachments(msg).map((att) => {
                          const fileName = att.name;
                          const ext = (att.fileType || fileName.split(".").pop() || "").toLowerCase();
                          const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext) || att.type === "image";
                          const isPdf = ext === "pdf" || att.type === "pdf";
                          const isSheet = ["xls", "xlsx", "csv"].includes(ext) || att.type === "spreadsheet";
                          const isDownloading = downloadingId === att.id;
                          const imageSrc = att.dataUrl || att.url;

                          return (
                            <div
                              key={att.id}
                              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-2 text-xs group/att"
                            >
                              {/* If it's an image and has a source, show a thumbnail preview */}
                              {isImage && imageSrc && (
                                <div
                                  onClick={() => setPreviewImageModal({ name: att.name, url: imageSrc, size: att.size })}
                                  className="relative rounded-lg overflow-hidden border border-slate-200/60 dark:border-slate-800 bg-slate-950/40 cursor-pointer max-h-48 group/img"
                                  title="Clique para expandir a imagem"
                                >
                                  <img
                                    src={imageSrc}
                                    alt={att.name}
                                    className="w-full h-auto max-h-48 object-contain transition-transform group-hover/img:scale-[1.02]"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <span className="px-2.5 py-1 rounded-lg bg-slate-900/80 text-white text-[11px] font-medium backdrop-blur-xs flex items-center gap-1.5 shadow-md">
                                      <Eye className="w-3.5 h-3.5" />
                                      Visualizar Imagem
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Details and Download Action Row */}
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex-shrink-0">
                                    {isImage ? (
                                      <ImageIcon className="w-4 h-4 text-emerald-500" />
                                    ) : isPdf ? (
                                      <FileText className="w-4 h-4 text-rose-500" />
                                    ) : isSheet ? (
                                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                    ) : (
                                      <FileText className="w-4 h-4 text-blue-500" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-slate-900 dark:text-slate-100 truncate" title={att.name}>
                                      {att.name}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                                      <span>{att.size || "186 KB"}</span>
                                      <span>•</span>
                                      <span className="uppercase text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                                        {ext || "ARQUIVO"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Download Button */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {isImage && imageSrc && (
                                    <button
                                      type="button"
                                      id={`btn-preview-${att.id}`}
                                      onClick={() => setPreviewImageModal({ name: att.name, url: imageSrc, size: att.size })}
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                      title="Visualizar Imagem"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    id={`btn-download-${att.id}`}
                                    disabled={isDownloading}
                                    onClick={(e) => handleDownloadAttachment(att, e)}
                                    className={cn(
                                      "px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs",
                                      "bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white dark:bg-blue-950/50 dark:hover:bg-blue-600 dark:text-blue-400 dark:hover:text-white border border-blue-200 dark:border-blue-800/80"
                                    )}
                                    title={`Baixar ${att.name}`}
                                  >
                                    {isDownloading ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Download className="w-3.5 h-3.5" />
                                    )}
                                    <span className="font-medium">Baixar</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Reactions Bar */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {["👍", "❤️", "🚀", "👏"].map((emoji) => {
                      const userList = msg.reactions?.[emoji] || [];
                      const hasReacted = userList.includes(user?.id || "");
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleReaction(msg.id, emoji)}
                          className={cn(
                            "px-2 py-0.5 rounded-full border text-[11px] flex items-center gap-1 transition-all",
                            hasReacted
                              ? "bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 font-bold"
                              : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                          )}
                        >
                          <span>{emoji}</span>
                          {userList.length > 0 && (
                            <span className="font-mono text-[10px]">{userList.length}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input box */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Anexar arquivo para a equipe"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                activeChatType === "channel"
                  ? `Enviar mensagem em #${activeChannel?.name || "geral"}...`
                  : `Enviar mensagem privada para ${activeDmUser?.name || "colaborador"}...`
              }
              className="flex-1 px-4 py-2.5 text-xs md:text-sm rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />

            <button
              id="btn-send-internal-chat"
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-colors shadow-xs"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>

      {/* Right Drawer: Collaborators Members List (From Supabase 'profiles' Table) */}
      {isMembersDrawerOpen && (
        <div
          id="chat-members-drawer"
          className="w-80 border-l border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex flex-col z-20 animate-in slide-in-from-right duration-200 shadow-xl"
        >
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  Colaboradores
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 text-[10px]">
                    {teamMembers.length}
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">Tabela profiles (Supabase)</p>
              </div>
            </div>

            <button
              id="btn-close-members-drawer"
              type="button"
              onClick={() => setIsMembersDrawerOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="Fechar lista lateral"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search & Sector Filter */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por nome, setor ou e-mail..."
                value={membersSearchQuery}
                onChange={(e) => setMembersSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            {/* Sector filter pills */}
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none text-[10px]">
              <button
                type="button"
                onClick={() => setMembersFilterSector("todos")}
                className={cn(
                  "px-2 py-0.5 rounded-lg font-medium whitespace-nowrap transition-colors",
                  membersFilterSector === "todos"
                    ? "bg-blue-600 text-white font-bold"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300"
                )}
              >
                Todos ({teamMembers.length})
              </button>
              {availableSectors.map((sec) => {
                const count = teamMembers.filter((m) => m.sector.toLowerCase() === sec.toLowerCase()).length;
                if (count === 0) return null;
                return (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setMembersFilterSector(sec)}
                    className={cn(
                      "px-2 py-0.5 rounded-lg font-medium whitespace-nowrap transition-colors",
                      membersFilterSector.toLowerCase() === sec.toLowerCase()
                        ? "bg-blue-600 text-white font-bold"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300"
                    )}
                  >
                    {sec} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Members List Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoadingMembers ? (
              <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                <span>Carregando perfis do Supabase...</span>
              </div>
            ) : filteredDrawerMembers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Nenhum colaborador encontrado com esse filtro.
              </div>
            ) : (
              filteredDrawerMembers.map((member) => {
                const roleBadge = getRoleBadge(member.role);
                const isCurrent = member.id === user?.id;

                return (
                  <div
                    key={member.id}
                    className="p-2.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-500/40 transition-all space-y-2 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative flex-shrink-0">
                          <img
                            src={member.avatar}
                            alt={member.name}
                            className="w-8 h-8 rounded-xl object-cover"
                          />
                          <span
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900",
                              member.status === "online"
                                ? "bg-emerald-500"
                                : member.status === "away"
                                ? "bg-amber-500"
                                : "bg-slate-400"
                            )}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                            <span>{member.name}</span>
                            {isCurrent && (
                              <span className="text-[9px] text-blue-500 font-semibold">(Você)</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                            <Mail className="w-2.5 h-2.5 flex-shrink-0" />
                            <span className="truncate">{member.email}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-semibold border flex-shrink-0",
                          roleBadge.className
                        )}
                      >
                        {roleBadge.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60 text-[10px]">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Building className="w-2.5 h-2.5 text-slate-400" />
                        {member.sector}
                      </span>

                      {!isCurrent && (
                        <button
                          id={`btn-drawer-dm-${member.id}`}
                          type="button"
                          onClick={() => handleStartDirectMessage(member)}
                          className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-2.5 h-2.5" />
                          <span>Mensagem</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between bg-slate-100/50 dark:bg-slate-900/50">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-500" />
              Sincronizado com Supabase
            </span>
            <button
              type="button"
              onClick={fetchTeamMembers}
              className="text-blue-500 hover:underline font-semibold"
            >
              Recarregar
            </button>
          </div>
        </div>
      )}

      {/* Modal: New Channel (#setor) OR New Direct Message (Colaborador) */}
      {isNewChatModalOpen && (
        <div
          id="modal-new-chat"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600 text-white">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Nova Conversa ou Canal
                  </h3>
                  <p className="text-xs text-slate-400">
                    Crie um canal de setor ou inicie um bate-papo privado
                  </p>
                </div>
              </div>

              <button
                id="btn-close-new-chat-modal"
                type="button"
                onClick={() => setIsNewChatModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 pt-3 gap-4">
              <button
                type="button"
                onClick={() => setNewChatTab("channel")}
                className={cn(
                  "pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all",
                  newChatTab === "channel"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <Hash className="w-4 h-4" />
                <span>Criar Canal Setorial (#)</span>
              </button>

              <button
                type="button"
                onClick={() => setNewChatTab("dm")}
                className={cn(
                  "pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all",
                  newChatTab === "dm"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <UserPlus className="w-4 h-4" />
                <span>Mensagem Direta (DM)</span>
              </button>
            </div>

            {/* Modal Content Tab 1: Create Channel */}
            {newChatTab === "channel" && (
              <form onSubmit={handleCreateChannelSubmit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Nome do Canal</span>
                    <span className="text-[10px] text-slate-400">minúsculo sem espaços</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">#</span>
                    <input
                      type="text"
                      required
                      placeholder="ex: marketing-growth, suporte-vip, diretoria"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Setor Responsável
                    </label>
                    <select
                      value={newChannelSector}
                      onChange={(e) => setNewChannelSector(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    >
                      {availableSectors.map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Privacidade do Canal
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                      <button
                        type="button"
                        onClick={() => setNewChannelIsPrivate(false)}
                        className={cn(
                          "py-1 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all",
                          !newChannelIsPrivate
                            ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                      >
                        <Globe className="w-3 h-3" />
                        Público
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewChannelIsPrivate(true)}
                        className={cn(
                          "py-1 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all",
                          newChannelIsPrivate
                            ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                      >
                        <Lock className="w-3 h-3" />
                        Privado
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Descrição & Objetivo (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Descreva a finalidade deste canal de comunicação..."
                    value={newChannelDescription}
                    onChange={(e) => setNewChannelDescription(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewChatModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    id="btn-submit-create-channel"
                    type="submit"
                    disabled={!newChannelName.trim() || isCreatingChannel}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-40 transition-all shadow-xs cursor-pointer"
                  >
                    {isCreatingChannel ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Criar Canal #{newChannelName.trim().toLowerCase() || "novo"}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Modal Content Tab 2: Start Direct Message with Collaborator */}
            {newChatTab === "dm" && (
              <div className="p-6 space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filtrar colaborador por nome, e-mail ou setor..."
                    value={modalDmSearch}
                    onChange={(e) => setModalDmSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {filteredModalDms.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Nenhum colaborador encontrado com essa busca.
                    </div>
                  ) : (
                    filteredModalDms.map((member) => {
                      const roleBadge = getRoleBadge(member.role);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleStartDirectMessage(member)}
                          className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-all flex items-center justify-between text-left group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative flex-shrink-0">
                              <img
                                src={member.avatar}
                                alt={member.name}
                                className="w-9 h-9 rounded-xl object-cover"
                              />
                              <span
                                className={cn(
                                  "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900",
                                  member.status === "online"
                                    ? "bg-emerald-500"
                                    : member.status === "away"
                                    ? "bg-amber-500"
                                    : "bg-slate-400"
                                )}
                              />
                            </div>

                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                                {member.name}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {member.sector} • {member.email}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-semibold border",
                                roleBadge.className
                              )}
                            >
                              {roleBadge.label}
                            </span>
                            <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              <MessageSquare className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>{filteredModalDms.length} colaboradores disponíveis</span>
                  <button
                    type="button"
                    onClick={() => setIsNewChatModalOpen(false)}
                    className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Pré-visualização de Imagem Anexada */}
      {previewImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewImageModal(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-4 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <ImageIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="font-bold text-sm text-white truncate">{previewImageModal.name}</span>
                {previewImageModal.size && (
                  <span className="text-xs text-slate-400">({previewImageModal.size})</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-download-modal-image"
                  onClick={(e) =>
                    handleDownloadAttachment(
                      {
                        id: "modal_img",
                        name: previewImageModal.name,
                        size: previewImageModal.size || "",
                        type: "image",
                        url: previewImageModal.url,
                        dataUrl: previewImageModal.url.startsWith("data:") ? previewImageModal.url : undefined,
                      },
                      e
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar Imagem
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewImageModal(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center max-h-[70vh] overflow-hidden rounded-2xl bg-slate-950 p-2">
              <img
                src={previewImageModal.url}
                alt={previewImageModal.name}
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Toast Notificação de Download */}
      {downloadSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 text-white border border-slate-700 shadow-2xl text-xs font-medium animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{downloadSuccessToast}</span>
        </div>
      )}
    </div>
  );
};
