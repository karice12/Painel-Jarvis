import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Sparkles,
  Video,
  ChevronLeft,
  ChevronRight,
  Users,
  Tag,
  Search,
  Pencil,
  Trash2,
  Lock,
  AlertCircle,
  Check,
  X,
  ShieldCheck,
  ExternalLink,
  Info,
  CalendarCheck2,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { CalendarEvent } from "../../types";
import { cn } from "../../lib/utils";
import {
  getAgendaEventsFromDb,
  saveAgendaEventToDb,
  updateAgendaEventInDb,
  deleteAgendaEventFromDb,
} from "../../services/supabaseDb";

const AVAILABLE_TIME_SLOTS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00",
];

export const AgendaModule: React.FC = () => {
  const { user, tenant } = useAuth();

  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAiQuickCreateOpen, setIsAiQuickCreateOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);
  const [selectedEventDetail, setSelectedEventDetail] = useState<CalendarEvent | null>(null);

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  // AI Quick Schedule Form
  const [aiPrompt, setAiPrompt] = useState("");
  const [isParsingAi, setIsParsingAi] = useState(false);

  // Form State (for both create and edit)
  const [formEventId, setFormEventId] = useState<string>("");
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formCategory, setFormCategory] = useState<CalendarEvent["category"]>("reuniao");
  const [formDesc, setFormDesc] = useState("");
  const [formMeet, setFormMeet] = useState(true);
  const [formParticipants, setFormParticipants] = useState<string>("");
  const [formSector, setFormSector] = useState<string>("");
  const [formValidationError, setFormValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper date calculations
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  }, []);

  const getCurrentTimeStr = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Fetch only events belonging to the current user (Strict Agenda Privacy)
  const fetchEvents = async () => {
    const tenantId = tenant?.id || user?.tenantId || "tenant_omni_01";
    const userId = user?.id || "usr_master_01";
    const userEmail = user?.email || "colaborador@nexus.com.br";

    try {
      setLoading(true);
      // 1. Try Supabase direct fetch with user filtering
      const dbEvents = await getAgendaEventsFromDb(tenantId, userId, userEmail);
      if (dbEvents && dbEvents.length > 0) {
        setEvents(dbEvents);
        return;
      }

      // 2. Fallback to API with user query parameters
      const res = await fetch(
        `/api/events?tenantId=${encodeURIComponent(tenantId)}&userId=${encodeURIComponent(userId)}&userEmail=${encodeURIComponent(userEmail)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.events) {
          // Additional client-side guard for user isolation
          const userFiltered = data.events.filter((e: CalendarEvent) => {
            const isOwner = e.userId === userId || e.createdBy === userId || (e.userEmail && e.userEmail.toLowerCase() === userEmail.toLowerCase());
            const isParticipant = Array.isArray(e.participants) && e.participants.some((p: string) =>
              p.toLowerCase().includes(userEmail.toLowerCase()) || p.toLowerCase().includes(user?.name?.toLowerCase() || "")
            );
            return isOwner || isParticipant;
          });
          setEvents(userFiltered);
        }
      }
    } catch (err) {
      console.warn("Could not fetch user agenda events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [tenant?.id, user?.id, user?.email]);

  // Check if a time slot has already passed
  const isTimeSlotPassed = (dateStr: string, timeSlot: string) => {
    if (!dateStr) return false;
    if (dateStr < todayIso) return true;
    if (dateStr === todayIso) {
      return timeSlot < getCurrentTimeStr();
    }
    return false;
  };

  // Check if a time slot has a conflict with an existing event
  const isTimeSlotOccupied = (dateStr: string, timeSlot: string, currentEditingId?: string) => {
    if (!dateStr) return false;
    return events.some((e) => {
      if (currentEditingId && e.id === currentEditingId) return false;
      if (e.date !== dateStr) return false;
      return timeSlot >= e.startTime && timeSlot < e.endTime;
    });
  };

  // Get available time slots for a given date
  const getAvailableSlotsForDate = (dateStr: string, currentEditingId?: string) => {
    return AVAILABLE_TIME_SLOTS.map((slot) => {
      const passed = isTimeSlotPassed(dateStr, slot);
      const occupied = isTimeSlotOccupied(dateStr, slot, currentEditingId);
      return {
        slot,
        passed,
        occupied,
        available: !passed && !occupied,
      };
    });
  };

  // Find first available future time slot for today or default 09:00
  const getNextAvailableSlot = (dateStr: string) => {
    const slots = getAvailableSlotsForDate(dateStr);
    const available = slots.find((s) => s.available);
    return available ? available.slot : "09:00";
  };

  const calculateDefaultEndTime = (startTime: string) => {
    const [h, m] = startTime.split(":").map(Number);
    const endH = (h + 1) % 24;
    return `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  // Open Create Modal
  const openCreateModal = (presetDate?: string) => {
    const targetDate = presetDate && presetDate >= todayIso ? presetDate : todayIso;
    const initialStartTime = getNextAvailableSlot(targetDate);
    const initialEndTime = calculateDefaultEndTime(initialStartTime);

    setFormEventId("");
    setFormTitle("");
    setFormDate(targetDate);
    setFormStartTime(initialStartTime);
    setFormEndTime(initialEndTime);
    setFormCategory("reuniao");
    setFormDesc("");
    setFormMeet(true);
    setFormParticipants(user?.name || "Colaborador");
    setFormSector(user?.sector || "Geral");
    setFormValidationError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (evt: CalendarEvent) => {
    setFormEventId(evt.id);
    setFormTitle(evt.title);
    setFormDate(evt.date < todayIso ? todayIso : evt.date);
    setFormStartTime(evt.startTime);
    setFormEndTime(evt.endTime);
    setFormCategory(evt.category);
    setFormDesc(evt.description || "");
    setFormMeet(Boolean(evt.meetUrl));
    setFormParticipants(Array.isArray(evt.participants) ? evt.participants.join(", ") : evt.participants || user?.name || "");
    setFormSector(evt.sector || user?.sector || "Geral");
    setFormValidationError(null);
    setSelectedEventDetail(null);
    setIsEditModalOpen(true);
  };

  // Validate form dates and times
  const validateForm = (): boolean => {
    if (!formTitle.trim()) {
      setFormValidationError("O título do compromisso é obrigatório.");
      return false;
    }
    if (!formDate) {
      setFormValidationError("Selecione uma data para o compromisso.");
      return false;
    }
    if (formDate < todayIso) {
      setFormValidationError(`Data inválida! Não é permitido agendar em datas que já passaram (${formDate}). Selecione hoje ou uma data futura.`);
      return false;
    }
    if (formDate === todayIso) {
      const current = getCurrentTimeStr();
      if (formStartTime < current) {
        setFormValidationError(`Horário indisponível! O horário de início (${formStartTime}) já passou hoje (horário atual: ${current}). Escolha um horário futuro.`);
        return false;
      }
    }
    if (formEndTime <= formStartTime) {
      setFormValidationError("O horário de término deve ser posterior ao horário de início.");
      return false;
    }

    setFormValidationError(null);
    return true;
  };

  // Submit Create Event
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const participantsList = formParticipants
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const newEventPayload: CalendarEvent = {
      id: eventId,
      title: formTitle.trim(),
      description: formDesc.trim(),
      date: formDate,
      startTime: formStartTime,
      endTime: formEndTime,
      category: formCategory,
      sector: formSector || user?.sector || "Geral",
      participants: participantsList.length > 0 ? participantsList : [user?.name || "Colaborador"],
      meetUrl: formMeet ? `https://meet.google.com/omni-${Date.now().toString().slice(-4)}` : undefined,
      isAiGenerated: false,
      userId: user?.id,
      userEmail: user?.email,
      createdBy: user?.id,
      tenantId: tenant?.id || user?.tenantId || "tenant_omni_01",
    };

    // 1. Optimistic Update
    setEvents((prev) => [...prev, newEventPayload]);

    // 2. Persist to Supabase
    saveAgendaEventToDb(newEventPayload, tenant?.id || "tenant_omni_01", user?.id, user?.email);

    // 3. Persist to Backend API
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newEventPayload,
          userName: user?.name,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.error) {
          showToast(errJson.error, "error");
        }
      } else {
        showToast("Compromisso agendado com sucesso na sua agenda pessoal!", "success");
      }
    } catch {
      showToast("Compromisso salvo localmente na agenda!", "info");
    } finally {
      setIsSubmitting(false);
      setIsModalOpen(false);
    }
  };

  // Submit Edit Event
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    const participantsList = formParticipants
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const updatedPayload: CalendarEvent = {
      id: formEventId,
      title: formTitle.trim(),
      description: formDesc.trim(),
      date: formDate,
      startTime: formStartTime,
      endTime: formEndTime,
      category: formCategory,
      sector: formSector || user?.sector || "Geral",
      participants: participantsList.length > 0 ? participantsList : [user?.name || "Colaborador"],
      meetUrl: formMeet
        ? events.find((e) => e.id === formEventId)?.meetUrl || `https://meet.google.com/omni-${Date.now().toString().slice(-4)}`
        : undefined,
      userId: user?.id,
      userEmail: user?.email,
      createdBy: user?.id,
      tenantId: tenant?.id || user?.tenantId || "tenant_omni_01",
      updatedAt: new Date().toISOString(),
    };

    // 1. Optimistic Update
    setEvents((prev) => prev.map((e) => (e.id === formEventId ? updatedPayload : e)));

    // 2. Persist to Supabase
    updateAgendaEventInDb(updatedPayload, tenant?.id || "tenant_omni_01", user?.id);

    // 3. Persist to Backend API
    try {
      const res = await fetch(`/api/events/${formEventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updatedPayload,
          userName: user?.name,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.error) {
          showToast(errJson.error, "error");
        }
      } else {
        showToast("Compromisso atualizado com sucesso!", "success");
      }
    } catch {
      showToast("Compromisso atualizado!", "info");
    } finally {
      setIsSubmitting(false);
      setIsEditModalOpen(false);
    }
  };

  // Delete Event
  const handleDeleteEvent = async (evt: CalendarEvent) => {
    // 1. Optimistic update
    setEvents((prev) => prev.filter((e) => e.id !== evt.id));
    if (selectedEventDetail?.id === evt.id) {
      setSelectedEventDetail(null);
    }
    setEventToDelete(null);

    // 2. Persist to Supabase
    deleteAgendaEventFromDb(evt.id, tenant?.id, user?.id);

    // 3. Persist to Backend API
    try {
      const res = await fetch(
        `/api/events/${evt.id}?userId=${encodeURIComponent(user?.id || "")}&userName=${encodeURIComponent(
          user?.name || ""
        )}&userEmail=${encodeURIComponent(user?.email || "")}&tenantId=${encodeURIComponent(tenant?.id || "tenant_omni_01")}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        showToast(`Compromisso "${evt.title}" excluído com sucesso da sua agenda!`, "success");
      }
    } catch {
      showToast(`Compromisso "${evt.title}" removido.`, "info");
    }
  };

  // Quick AI Natural Language Scheduling
  const handleAiSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    setIsParsingAi(true);

    try {
      const res = await fetch("/api/ai/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          sector: user?.sector || "Tecnologia & Inovação",
          tenantId: user?.tenantId || "tenant_omni_01",
          userId: user?.id,
          userName: user?.name,
          userEmail: user?.email,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.event) {
          setEvents((prev) => [...prev, data.event]);
          saveAgendaEventToDb(data.event, tenant?.id || "tenant_omni_01", user?.id, user?.email);
          showToast(`Compromisso agendado por IA: "${data.event.title}"`, "success");
        }
      } else {
        throw new Error("Erro na API de IA");
      }
    } catch {
      const fallbackEvent: CalendarEvent = {
        id: `evt_ai_${Date.now()}`,
        title: aiPrompt.length > 30 ? aiPrompt.slice(0, 30) + "..." : aiPrompt,
        description: `Agendado via IA: "${aiPrompt}"`,
        date: todayIso,
        startTime: getNextAvailableSlot(todayIso),
        endTime: calculateDefaultEndTime(getNextAvailableSlot(todayIso)),
        category: "ia_gerado",
        sector: user?.sector || "Tecnologia",
        participants: [user?.name || "Colaborador"],
        meetUrl: "https://meet.google.com/ai-room-omni",
        isAiGenerated: true,
        userId: user?.id,
        userEmail: user?.email,
        createdBy: user?.id,
      };
      setEvents((prev) => [...prev, fallbackEvent]);
      saveAgendaEventToDb(fallbackEvent, tenant?.id || "tenant_omni_01", user?.id, user?.email);
      showToast("Compromisso gerado e adicionado à sua agenda!", "success");
    } finally {
      setIsParsingAi(false);
      setIsAiQuickCreateOpen(false);
      setAiPrompt("");
    }
  };

  const getCategoryBadge = (cat: CalendarEvent["category"]) => {
    switch (cat) {
      case "ia_gerado":
        return { label: "IA OpenJarvis", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" };
      case "reuniao":
        return { label: "Reunião", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
      case "prazo":
        return { label: "Prazo Crítico", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" };
      case "cliente":
        return { label: "Cliente", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
      default:
        return { label: "Geral", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20" };
    }
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      const matchesSearch =
        evt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (evt.description && evt.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (evt.participants && evt.participants.some((p) => p.toLowerCase().includes(searchTerm.toLowerCase())));

      const matchesCat = selectedCategoryFilter === "all" || evt.category === selectedCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [events, searchTerm, selectedCategoryFilter]);

  // Calendar days generation (current month: August 2026)
  const daysInMonth = 31;
  const currentMonthDays = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const dateStr = `2026-08-${dayNum < 10 ? `0${dayNum}` : dayNum}`;
      const isPast = dateStr < todayIso;
      const isToday = dateStr === todayIso;
      const dayEvents = filteredEvents.filter((e) => e.date === dateStr);

      return {
        dayNum,
        dateStr,
        isPast,
        isToday,
        events: dayEvents,
      };
    });
  }, [filteredEvents, todayIso]);

  // Dynamic available time slots for the active form date
  const activeFormSlots = useMemo(() => {
    if (!formDate) return [];
    return getAvailableSlotsForDate(formDate, formEventId);
  }, [formDate, formEventId, events]);

  return (
    <div className="space-y-6 pb-8">
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 text-xs font-semibold",
            feedbackMessage.type === "success" && "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200",
            feedbackMessage.type === "error" && "bg-rose-50 dark:bg-rose-950 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200",
            feedbackMessage.type === "info" && "bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200"
          )}
        >
          {feedbackMessage.type === "success" && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          {feedbackMessage.type === "error" && <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
          {feedbackMessage.type === "info" && <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          <span>{feedbackMessage.text}</span>
          <button onClick={() => setFeedbackMessage(null)} className="ml-2 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Banner with User Privacy Notice */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80">
              <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Agenda Corporativa & Compromissos
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Agenda Pessoal Privada
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Visualização exclusiva de <strong className="text-slate-700 dark:text-slate-200">{user?.name || "Colaborador"}</strong> ({user?.email}).
                Apenas os seus compromissos e reuniões atribuídas são exibidos.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick AI Schedule Button */}
          <button
            id="btn-ai-schedule-event"
            onClick={() => setIsAiQuickCreateOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 text-xs font-semibold flex items-center gap-1.5 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors shadow-xs cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span>Agendar com IA</span>
          </button>

          {/* New Event Manual */}
          <button
            id="btn-create-event-manual"
            onClick={() => openCreateModal()}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Compromisso</span>
          </button>
        </div>
      </div>

      {/* Filter and View Controls Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Agosto de 2026
            </h3>
            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[11px] font-medium text-blue-700 dark:text-blue-300">
              Hoje: 28 de Agosto
            </span>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar em meus compromissos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-48 sm:w-60"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
          >
            <option value="all">Todas as Categorias</option>
            <option value="reuniao">Reuniões</option>
            <option value="prazo">Prazos Críticos</option>
            <option value="cliente">Clientes</option>
            <option value="ia_gerado">Gerados por IA</option>
            <option value="geral">Gerais</option>
          </select>
        </div>

        {/* View Mode Switcher */}
        <div className="grid grid-cols-3 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs w-full sm:w-64">
          {(["month", "week", "day"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "py-1.5 rounded-lg font-medium capitalize transition-colors text-center cursor-pointer",
                viewMode === mode
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              {mode === "month" ? "Mês" : mode === "week" ? "Semana" : "Lista / Dia"}
            </button>
          ))}
        </div>
      </div>

      {/* Rules Notice: Past dates & times locked */}
      <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-300">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            <strong>Proteção de Agendamento Ativa:</strong> Datas passadas e horários já ultrapassados hoje ficam bloqueados automaticamente para evitar conflitos de reuniões.
          </span>
        </div>
        <div className="text-[11px] text-amber-700 dark:text-amber-400 font-mono hidden md:block">
          {events.length} {events.length === 1 ? "compromisso pessoal" : "compromissos pessoais"}
        </div>
      </div>

      {/* Calendar Grid View (Month Mode) */}
      {viewMode === "month" ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 text-center text-xs font-semibold text-slate-400 py-3 bg-slate-50 dark:bg-slate-800/40">
            <div>Dom</div>
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
          </div>

          {/* Month day cells */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800/80">
            {currentMonthDays.map((day) => {
              return (
                <div
                  key={day.dayNum}
                  onClick={() => {
                    if (day.isPast) {
                      showToast("Datas passadas não estão disponíveis para novos agendamentos.", "info");
                    } else {
                      openCreateModal(day.dateStr);
                    }
                  }}
                  className={cn(
                    "min-h-[115px] p-2.5 transition-all flex flex-col justify-between group relative",
                    day.isPast
                      ? "bg-slate-50/60 dark:bg-slate-950/40 opacity-55 cursor-not-allowed"
                      : "hover:bg-blue-50/30 dark:hover:bg-slate-800/40 cursor-pointer",
                    day.isToday && "bg-blue-50/50 dark:bg-blue-950/25 ring-1 ring-blue-500/40 inset-0"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center transition-transform",
                        day.isToday
                          ? "bg-blue-600 text-white shadow-xs scale-105"
                          : day.isPast
                          ? "text-slate-400 dark:text-slate-600"
                          : "text-slate-700 dark:text-slate-300 group-hover:text-blue-600"
                      )}
                    >
                      {day.dayNum}
                    </span>

                    {day.isPast && (
                      <span title="Data retroativa inativa para novos agendamentos">
                        <Lock className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                      </span>
                    )}

                    {!day.isPast && day.events.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 shadow-xs" />
                    )}
                  </div>

                  {/* Day Events Pills */}
                  <div className="space-y-1 mt-1.5">
                    {day.events.slice(0, 2).map((evt) => {
                      const badge = getCategoryBadge(evt.category);
                      return (
                        <div
                          key={evt.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEventDetail(evt);
                          }}
                          className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-medium border truncate flex items-center justify-between gap-1 shadow-2xs hover:scale-[1.02] transition-transform cursor-pointer",
                            badge.color
                          )}
                          title={`${evt.title} (${evt.startTime} - ${evt.endTime})`}
                        >
                          <span className="truncate">{evt.title}</span>
                          <span className="font-mono text-[9px] opacity-80 shrink-0">{evt.startTime}</span>
                        </div>
                      );
                    })}

                    {day.events.length > 2 && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEventDetail(day.events[0]);
                        }}
                        className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold pl-1 hover:underline cursor-pointer"
                      >
                        +{day.events.length - 2} mais
                      </div>
                    )}
                  </div>

                  {/* Quick Add icon on hover for future days */}
                  {!day.isPast && day.events.length === 0 && (
                    <div className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <Plus className="w-3 h-3 text-blue-500" />
                      <span>Agendar</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Week/Day List View with Direct Edit & Delete Buttons */
        <div className="space-y-3">
          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 space-y-3">
              <CalendarCheck2 className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Nenhum compromisso encontrado na sua agenda pessoal
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Clique em "Novo Compromisso" ou "Agendar com IA" para marcar uma reunião.
                </p>
              </div>
              <button
                onClick={() => openCreateModal()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Primeiro Compromisso</span>
              </button>
            </div>
          ) : (
            filteredEvents.map((evt) => {
              const badge = getCategoryBadge(evt.category);
              const isPastDate = evt.date < todayIso;

              return (
                <div
                  key={evt.id}
                  className={cn(
                    "p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-blue-500/40 transition-all",
                    isPastDate && "opacity-60 bg-slate-50/50 dark:bg-slate-950/30"
                  )}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded-md font-semibold border",
                          badge.color
                        )}
                      >
                        {badge.label}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {evt.title}
                      </h4>
                      {isPastDate && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 font-medium">
                          Concluído / Passado
                        </span>
                      )}
                    </div>

                    {evt.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">{evt.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1 flex-wrap">
                      <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                        <CalendarIcon className="w-3.5 h-3.5 text-blue-500" />
                        {evt.date}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-slate-700 dark:text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                        {evt.startTime} - {evt.endTime}
                      </span>
                      {evt.participants && evt.participants.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-blue-500" />
                          {Array.isArray(evt.participants) ? evt.participants.join(", ") : evt.participants}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions: Video Meet, Edit Button, Delete Button */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {evt.meetUrl && (
                      <a
                        href={evt.meetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-semibold flex items-center gap-1.5 hover:bg-blue-100 transition-colors"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Entrar</span>
                      </a>
                    )}

                    {/* Botão de Editar */}
                    <button
                      id={`btn-edit-event-${evt.id}`}
                      onClick={() => openEditModal(evt)}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/60 dark:hover:text-blue-400 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Editar este compromisso"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-600" />
                      <span>Editar</span>
                    </button>

                    {/* Botão de Excluir */}
                    <button
                      id={`btn-delete-event-${evt.id}`}
                      onClick={() => setEventToDelete(evt)}
                      className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Excluir este compromisso"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal: Quick AI Schedule Natural Language */}
      {isAiQuickCreateOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Agendamento Inteligente com OpenJarvis
                </h3>
              </div>
              <button
                onClick={() => setIsAiQuickCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAiSchedule} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Descreva o compromisso em linguagem natural:
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ex: Reunião de alinhamento com a diretoria amanhã às 14h para revisar o plano de expansão de IA..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-[11px] text-purple-700 dark:text-purple-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Isolamento & Validação Automática:
                </div>
                <p>
                  O OpenJarvis validará horários futuros e salvará o evento exclusivamente na sua agenda pessoal ({user?.email}).
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAiQuickCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isParsingAi}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {isParsingAi ? (
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{isParsingAi ? "Processando..." : "Agendar com IA"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manual Event Creation */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Novo Compromisso na Sua Agenda
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Agenda Pessoal de {user?.name || "Colaborador"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formValidationError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{formValidationError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Título do Evento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Reunião de Resultados e Alinhamento"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              {/* Date Input with min={todayIso} */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3 text-blue-500" />
                    <span>Data *</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={todayIso}
                    value={formDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val < todayIso) {
                        setFormValidationError(`A data mínima permitida é hoje (${todayIso}).`);
                      } else {
                        setFormValidationError(null);
                        setFormDate(val);
                        // Auto update start time if needed
                        const nextSlot = getNextAvailableSlot(val);
                        setFormStartTime(nextSlot);
                        setFormEndTime(calculateDefaultEndTime(nextSlot));
                      }
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium"
                  />
                  <span className="text-[10px] text-slate-400">Datas passadas inativas</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-500" />
                    <span>Início *</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormStartTime(val);
                      setFormEndTime(calculateDefaultEndTime(val));
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-500" />
                    <span>Fim *</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono"
                  />
                </div>
              </div>

              {/* Dynamic Available Time Slot Selector */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    Horários Disponíveis ({formDate || todayIso})
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Livre
                    </span>
                    <span className="flex items-center gap-1 text-rose-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Passado/Ocupado
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-28 overflow-y-auto pr-1 pt-1">
                  {activeFormSlots.map((slotInfo) => {
                    const isSelected = formStartTime === slotInfo.slot;
                    return (
                      <button
                        key={slotInfo.slot}
                        type="button"
                        disabled={!slotInfo.available}
                        onClick={() => {
                          setFormStartTime(slotInfo.slot);
                          setFormEndTime(calculateDefaultEndTime(slotInfo.slot));
                          setFormValidationError(null);
                        }}
                        className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-mono font-medium transition-all text-center border cursor-pointer",
                          isSelected && "bg-blue-600 text-white border-blue-600 shadow-xs font-bold",
                          !isSelected && slotInfo.available && "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40",
                          !slotInfo.available && "bg-slate-100 dark:bg-slate-900/60 text-slate-400 dark:text-slate-600 border-slate-200/50 dark:border-slate-800 line-through cursor-not-allowed opacity-50"
                        )}
                        title={
                          slotInfo.passed
                            ? "Horário já passou hoje"
                            : slotInfo.occupied
                            ? "Horário ocupado por outro compromisso"
                            : "Horário disponível para agendamento"
                        }
                      >
                        {slotInfo.slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Categoria
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="reuniao">Reunião Interna</option>
                    <option value="prazo">Prazo / Deadline</option>
                    <option value="cliente">Cliente / Comercial</option>
                    <option value="ia_gerado">IA / OpenJarvis</option>
                    <option value="geral">Geral</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Participantes
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Karol, Roberto, Equipe Tech"
                    value={formParticipants}
                    onChange={(e) => setFormParticipants(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 font-medium">
                  <input
                    type="checkbox"
                    checked={formMeet}
                    onChange={(e) => setFormMeet(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Gerar Link do Google Meet Corporativo</span>
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Pauta & Descrição
                </label>
                <textarea
                  rows={2}
                  placeholder="Objetivo e pontos de discussão do compromisso..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Salvando..." : "Salvar Compromisso"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Existing Event */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Editar Compromisso
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Modifique a data, horário ou pauta do seu compromisso
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formValidationError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{formValidationError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Título do Evento *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              {/* Date Input with min={todayIso} */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3 text-blue-500" />
                    <span>Data *</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={todayIso}
                    value={formDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val < todayIso) {
                        setFormValidationError(`A data mínima permitida é hoje (${todayIso}).`);
                      } else {
                        setFormValidationError(null);
                        setFormDate(val);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium"
                  />
                  <span className="text-[10px] text-slate-400">Datas passadas bloqueadas</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-500" />
                    <span>Início *</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-500" />
                    <span>Fim *</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono"
                  />
                </div>
              </div>

              {/* Dynamic Available Time Slot Selector */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    Horários Disponíveis ({formDate || todayIso})
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Livre
                    </span>
                    <span className="flex items-center gap-1 text-rose-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Indisponível
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-28 overflow-y-auto pr-1 pt-1">
                  {activeFormSlots.map((slotInfo) => {
                    const isSelected = formStartTime === slotInfo.slot;
                    return (
                      <button
                        key={slotInfo.slot}
                        type="button"
                        disabled={!slotInfo.available && !isSelected}
                        onClick={() => {
                          setFormStartTime(slotInfo.slot);
                          setFormEndTime(calculateDefaultEndTime(slotInfo.slot));
                          setFormValidationError(null);
                        }}
                        className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-mono font-medium transition-all text-center border cursor-pointer",
                          isSelected && "bg-blue-600 text-white border-blue-600 shadow-xs font-bold",
                          !isSelected && slotInfo.available && "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-400",
                          !slotInfo.available && !isSelected && "bg-slate-100 dark:bg-slate-900/60 text-slate-400 dark:text-slate-600 border-slate-200/50 dark:border-slate-800 line-through cursor-not-allowed opacity-50"
                        )}
                      >
                        {slotInfo.slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Categoria
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="reuniao">Reunião Interna</option>
                    <option value="prazo">Prazo / Deadline</option>
                    <option value="cliente">Cliente / Comercial</option>
                    <option value="ia_gerado">IA / OpenJarvis</option>
                    <option value="geral">Geral</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Participantes
                  </label>
                  <input
                    type="text"
                    value={formParticipants}
                    onChange={(e) => setFormParticipants(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 font-medium">
                  <input
                    type="checkbox"
                    checked={formMeet}
                    onChange={(e) => setFormMeet(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Link do Google Meet Corporativo Ativo</span>
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Pauta & Descrição
                </label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const evt = events.find((e) => e.id === formEventId);
                    if (evt) {
                      setIsEditModalOpen(false);
                      setEventToDelete(evt);
                    }
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? "Salvando..." : "Salvar Alterações"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Event */}
      {eventToDelete && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-2xl bg-rose-100 dark:bg-rose-950">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Excluir Compromisso?
                </h3>
                <p className="text-[11px] text-slate-400">
                  Esta ação removerá o evento da sua agenda
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-200">{eventToDelete.title}</p>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px]">
                <span>📅 {eventToDelete.date}</span>
                <span>⏰ {eventToDelete.startTime} - {eventToDelete.endTime}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEventToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteEvent(eventToDelete)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmar Exclusão</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Event Details (Quick View from Month Grid) */}
      {selectedEventDetail && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className={cn("text-[10px] px-2 py-0.5 rounded-md font-semibold border", getCategoryBadge(selectedEventDetail.category).color)}>
                  {getCategoryBadge(selectedEventDetail.category).label}
                </span>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[220px]">
                  {selectedEventDetail.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEventDetail(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {selectedEventDetail.description && (
                <p className="text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  {selectedEventDetail.description}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-blue-500 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400">Data</div>
                    <div className="font-semibold">{selectedEventDetail.date}</div>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400">Horário</div>
                    <div className="font-mono font-semibold">{selectedEventDetail.startTime} - {selectedEventDetail.endTime}</div>
                  </div>
                </div>
              </div>

              {selectedEventDetail.participants && selectedEventDetail.participants.length > 0 && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Users className="w-4 h-4 text-blue-500 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400">Participantes</div>
                    <div className="font-medium">
                      {Array.isArray(selectedEventDetail.participants)
                        ? selectedEventDetail.participants.join(", ")
                        : selectedEventDetail.participants}
                    </div>
                  </div>
                </div>
              )}

              {selectedEventDetail.meetUrl && (
                <a
                  href={selectedEventDetail.meetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                >
                  <Video className="w-4 h-4" />
                  <span>Acessar Sala do Google Meet</span>
                </a>
              )}
            </div>

            {/* Quick Action Footer: Editar & Excluir */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const evt = selectedEventDetail;
                  setSelectedEventDetail(null);
                  setEventToDelete(evt);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedEventDetail(null)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(selectedEventDetail)}
                  className="px-4 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-semibold flex items-center gap-1.5 hover:bg-blue-100 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
