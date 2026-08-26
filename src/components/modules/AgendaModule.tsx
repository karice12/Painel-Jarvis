import React, { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Sparkles,
  Video,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Users,
  MapPin,
  Bot,
  Tag,
  Search,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { CalendarEvent } from "../../types";
import { cn } from "../../lib/utils";

export const AgendaModule: React.FC = () => {
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        if (data.events) {
          setEvents(data.events);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAiQuickCreateOpen, setIsAiQuickCreateOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isParsingAi, setIsParsingAi] = useState(false);

  // New Event Form
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newStartTime, setNewStartTime] = useState("10:00");
  const [newEndTime, setNewEndTime] = useState("11:00");
  const [newCategory, setNewCategory] = useState<CalendarEvent["category"]>("reuniao");
  const [newDesc, setNewDesc] = useState("");
  const [newMeet, setNewMeet] = useState(true);

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
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.event) {
          setEvents((prev) => [...prev, data.event]);
        }
      } else {
        throw new Error("Erro na API");
      }
    } catch {
      const fallbackEvent: CalendarEvent = {
        id: `evt_ai_${Date.now()}`,
        title: aiPrompt.length > 30 ? aiPrompt.slice(0, 30) + "..." : aiPrompt,
        description: `Agendado via IA: "${aiPrompt}"`,
        date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        startTime: "14:00",
        endTime: "15:00",
        category: "ia_gerado",
        sector: user?.sector || "Tecnologia",
        participants: [user?.name || "Colaborador"],
        meetUrl: "https://meet.google.com/ai-room-omni",
        isAiGenerated: true,
      };
      setEvents((prev) => [...prev, fallbackEvent]);
    } finally {
      setIsParsingAi(false);
      setIsAiQuickCreateOpen(false);
      setAiPrompt("");
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    const newEventPayload = {
      title: newTitle,
      description: newDesc,
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
      category: newCategory,
      sector: user?.sector || "Geral",
      participants: [user?.name || "Colaborador"],
      meetUrl: newMeet ? `https://meet.google.com/omni-${Date.now().toString().slice(-4)}` : undefined,
      isAiGenerated: false,
    };

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEventPayload),
      });

      if (res.ok) {
        const data = await res.json();
        setEvents((prev) => [...prev, data.event || { id: `evt_${Date.now()}`, ...newEventPayload }]);
      } else {
        setEvents((prev) => [...prev, { id: `evt_${Date.now()}`, ...newEventPayload }]);
      }
    } catch {
      setEvents((prev) => [...prev, { id: `evt_${Date.now()}`, ...newEventPayload }]);
    } finally {
      setIsModalOpen(false);
      setNewTitle("");
      setNewDesc("");
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

  // Calendar days generation
  const daysInMonth = 31;
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateStr = `2026-08-${dayNum < 10 ? `0${dayNum}` : dayNum}`;
    const dayEvents = events.filter((e) => e.date === dateStr || (dayNum === 26 && e.date === new Date().toISOString().split("T")[0]));
    return { dayNum, dateStr, events: dayEvents };
  });

  return (
    <div className="space-y-6 pb-8">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Agenda Corporativa & Compromissos
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Sincronização de reuniões, prazos de projetos e compromissos
            agendados automaticamente pelo assistente OpenJarvis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick AI Schedule Button */}
          <button
            id="btn-ai-schedule-event"
            onClick={() => setIsAiQuickCreateOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 text-xs font-semibold flex items-center gap-1.5 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span>Agendar com IA</span>
          </button>

          {/* New Event Manual */}
          <button
            id="btn-create-event-manual"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Evento</span>
          </button>
        </div>
      </div>

      {/* Calendar Header Controls */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Agosto de 2026
          </h3>
          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
            <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-semibold text-slate-700 dark:text-slate-300">
              Hoje
            </span>
            <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="grid grid-cols-3 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs w-full sm:w-64">
          {(["month", "week", "day"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "py-1.5 rounded-lg font-medium capitalize transition-colors text-center",
                viewMode === mode
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              {mode === "month" ? "Mês" : mode === "week" ? "Semana" : "Dia"}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid View */}
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
            {monthDays.map((day) => {
              const isToday = day.dayNum === 26;

              return (
                <div
                  key={day.dayNum}
                  className={cn(
                    "min-h-[105px] p-2 transition-colors flex flex-col justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30",
                    isToday && "bg-blue-50/40 dark:bg-blue-950/20"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center",
                        isToday
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-700 dark:text-slate-300"
                      )}
                    >
                      {day.dayNum}
                    </span>
                    {day.events.length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    )}
                  </div>

                  {/* Day Events Pills */}
                  <div className="space-y-1 mt-1">
                    {day.events.map((evt) => {
                      const badge = getCategoryBadge(evt.category);
                      return (
                        <div
                          key={evt.id}
                          className={cn(
                            "px-1.5 py-1 rounded-md text-[10px] font-medium border truncate flex items-center justify-between gap-1",
                            badge.color
                          )}
                          title={`${evt.title} (${evt.startTime} - ${evt.endTime})`}
                        >
                          <span className="truncate">{evt.title}</span>
                          <span className="font-mono text-[9px] opacity-75">{evt.startTime}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Week/Day List View */
        <div className="space-y-3">
          {events.map((evt) => {
            const badge = getCategoryBadge(evt.category);
            return (
              <div
                key={evt.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-blue-500/40 transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
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
                  </div>
                  {evt.description && (
                    <p className="text-xs text-slate-400 max-w-xl">{evt.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5 text-blue-500" />
                      {evt.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      {evt.startTime} - {evt.endTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                      {evt.participants.join(", ")}
                    </span>
                  </div>
                </div>

                {evt.meetUrl && (
                  <a
                    href={evt.meetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-blue-100 transition-colors"
                  >
                    <Video className="w-4 h-4" />
                    <span>Entrar na Reunião</span>
                  </a>
                )}
              </div>
            );
          })}
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
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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

              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-[11px] text-purple-700 dark:text-purple-300">
                🤖 O OpenJarvis analisará a data, hora, participantes e título automaticamente para gerar o evento e o link do Meet.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAiQuickCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isParsingAi}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  {isParsingAi ? (
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{isParsingAi ? "Analisando..." : "Agendar com IA"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manual Event Creation */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Novo Compromisso na Agenda
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Título do Evento
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Reunião de Resultados Mensais"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Data
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Início
                  </label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Fim
                  </label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Categoria
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="reuniao">Reunião Interna</option>
                    <option value="prazo">Prazo / Deadline</option>
                    <option value="cliente">Cliente / Comercial</option>
                    <option value="ia_gerado">IA / OpenJarvis</option>
                    <option value="geral">Geral</option>
                  </select>
                </div>

                <div className="space-y-1 flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2 text-xs text-slate-700 dark:text-slate-300 font-medium">
                    <input
                      type="checkbox"
                      checked={newMeet}
                      onChange={(e) => setNewMeet(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Gerar Link do Google Meet</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Descrição do Compromisso
                </label>
                <textarea
                  rows={2}
                  placeholder="Pauta e notas da reunião..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs"
                >
                  Salvar Compromisso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
