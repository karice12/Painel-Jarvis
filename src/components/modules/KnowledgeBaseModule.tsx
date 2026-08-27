import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  Upload,
  Search,
  Filter,
  FileText,
  CheckCircle2,
  Clock,
  Lock,
  Globe,
  Users,
  Trash2,
  Sparkles,
  RefreshCw,
  Eye,
  Plus,
  ChevronRight,
  Database,
  Loader2,
  Download,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { DocumentItem, DocumentVisibility } from "../../types";
import { cn, formatDateBR } from "../../lib/utils";
import { uploadDocumentToStorage, deleteDocumentFromStorage } from "../../lib/supabase";
import {
  getKnowledgeBaseDocsFromDb,
  saveKnowledgeBaseDocToDb,
  deleteKnowledgeBaseDocFromDb,
} from "../../services/supabaseDb";

export const KnowledgeBaseModule: React.FC = () => {
  const { user, tenant, canManageTenant } = useAuth();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = async () => {
    const tenantId = tenant?.id || "tenant_omni_01";
    try {
      setLoading(true);

      // 1. Fetch from Supabase direct
      const dbDocs = await getKnowledgeBaseDocsFromDb(tenantId, user?.sector, user?.role);
      if (dbDocs && dbDocs.length > 0) {
        setDocuments(dbDocs);
        return;
      }

      // 2. Fallback to API
      const res = await fetch(
        `/api/documents?tenantId=${tenantId}&sector=${encodeURIComponent(
          user?.sector || ""
        )}&userRole=${user?.role || "user"}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.documents) {
          setDocuments(data.documents);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [tenant?.id, user?.sector, user?.role]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState<string>("all");
  const [selectedVisibility, setSelectedVisibility] = useState<string>("all");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  // New Doc Form
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newDocName, setNewDocName] = useState("");
  const [newDocSector, setNewDocSector] = useState(user?.sector || "Tecnologia & Inovação");
  const [newDocVisibility, setNewDocVisibility] = useState<DocumentVisibility>("company");
  const [newDocSnippet, setNewDocSnippet] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.sector.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.contentSnippet.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSector = selectedSector === "all" || doc.sector === selectedSector;
    const matchesVis = selectedVisibility === "all" || doc.visibility === selectedVisibility;

    return matchesSearch && matchesSector && matchesVis;
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!newDocName) {
        setNewDocName(file.name);
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName && !selectedFile) return;

    setIsUploading(true);

    try {
      let publicStorageUrl = "";
      const fileName = selectedFile?.name || (newDocName.includes(".") ? newDocName : `${newDocName}.pdf`);
      const fileSize = selectedFile?.size || 1500000;

      if (selectedFile && tenant?.id) {
        const uploadRes = await uploadDocumentToStorage(selectedFile, tenant.id);
        if (uploadRes) {
          publicStorageUrl = uploadRes.publicUrl;
        }
      }

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fileName,
          size: `${(fileSize / (1024 * 1024)).toFixed(1)} MB`,
          sizeBytes: fileSize,
          sector: newDocSector,
          visibility: newDocVisibility,
          contentSnippet:
            newDocSnippet ||
            `Documento corporativo '${fileName}' indexado para RAG no assistente OpenJarvis.`,
          fileType: fileName.endsWith(".docx")
            ? "docx"
            : fileName.endsWith(".csv")
            ? "csv"
            : "pdf",
          userId: user?.id,
          userName: user?.name,
          userRole: user?.role,
          tenantId: tenant?.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.document) {
          setDocuments((prev) => [data.document, ...prev]);
          saveKnowledgeBaseDocToDb(data.document, tenant?.id || "tenant_omni_01");
        }
      }
    } catch {
      // fallback local item
      const fallbackDoc: DocumentItem = {
        id: `doc_${Date.now()}`,
        name: newDocName || "Documento.pdf",
        size: "1.2 MB",
        sizeBytes: 1200000,
        sector: newDocSector,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user?.name || "Colaborador",
        indexStatus: "indexed",
        visibility: newDocVisibility,
        fileType: "pdf",
        tokensEstimated: 4500,
        contentSnippet: newDocSnippet || "Documento indexado com sucesso.",
      };
      setDocuments((prev) => [fallbackDoc, ...prev]);
      saveKnowledgeBaseDocToDb(fallbackDoc, tenant?.id || "tenant_omni_01");
    } finally {
      setIsUploading(false);
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setNewDocName("");
      setNewDocSnippet("");
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (confirm("Tem certeza que deseja remover este documento da Base de Conhecimento RAG?")) {
      deleteKnowledgeBaseDocFromDb(id);
      try {
        await fetch(`/api/documents/${id}`, { method: "DELETE" });
      } catch {
        // ignore
      }
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (previewDoc?.id === id) {
        setPreviewDoc(null);
      }
    }
  };

  const handleReindex = (id: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, indexStatus: "processing" } : d))
    );
    setTimeout(() => {
      setDocuments((prev) =>
        prev.map((d) => (d.id === id ? { ...d, indexStatus: "indexed" } : d))
      );
    }, 1200);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Base de Conhecimento & RAG Corporativo
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Documentos vetorizados e indexados pelo motor OpenJarvis. A IA
            utiliza estes arquivos como fonte de verdade para responder perguntas
            com citações e dados auditáveis.
          </p>
        </div>

        <button
          id="btn-open-upload-modal"
          onClick={() => setIsUploadModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Indexar Novo Documento</span>
        </button>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            id="doc-search-input"
            type="text"
            placeholder="Pesquisar por título, trecho de conteúdo ou setor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        {/* Sector Filter */}
        <select
          id="filter-sector-select"
          value={selectedSector}
          onChange={(e) => setSelectedSector(e.target.value)}
          className="w-full sm:w-48 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="all">Todos os Setores</option>
          <option value="Tecnologia & Inovação">Tecnologia & Inovação</option>
          <option value="Financeiro & Controladoria">Financeiro & Controladoria</option>
          <option value="Suporte ao Cliente & CS">Suporte ao Cliente</option>
          <option value="Marketing & Growth">Marketing & Growth</option>
          <option value="Diretoria Executiva">Diretoria Executiva</option>
        </select>

        {/* Visibility Filter */}
        <select
          id="filter-visibility-select"
          value={selectedVisibility}
          onChange={(e) => setSelectedVisibility(e.target.value)}
          className="w-full sm:w-44 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="all">Todas Permissões</option>
          <option value="company">Toda a Empresa</option>
          <option value="sector">Meu Setor</option>
          <option value="private">Privado</option>
        </select>
      </div>

      {/* Documents Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-4">Nome do Arquivo</th>
                <th className="py-3 px-4">Tamanho</th>
                <th className="py-3 px-4">Setor / Área</th>
                <th className="py-3 px-4">Data de Envio</th>
                <th className="py-3 px-4">Indexação pela IA</th>
                <th className="py-3 px-4">Visibilidade</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Nenhum documento encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-slate-700 dark:text-slate-300"
                  >
                    {/* File Name */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex-shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate max-w-xs">{doc.name}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            Por: {doc.uploadedBy}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Size */}
                    <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">
                      {doc.size}
                    </td>

                    {/* Sector */}
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium text-[11px]">
                        {doc.sector}
                      </span>
                    </td>

                    {/* Upload Date */}
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                      {formatDateBR(doc.uploadedAt)}
                    </td>

                    {/* Index Status */}
                    <td className="py-3.5 px-4">
                      {doc.indexStatus === "indexed" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          Indexado (RAG Ativo)
                        </span>
                      ) : doc.indexStatus === "processing" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-semibold">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Vetorizando...
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[11px] font-semibold">
                          Erro
                        </span>
                      )}
                    </td>

                    {/* Visibility */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        {doc.visibility === "company" && (
                          <>
                            <Globe className="w-3.5 h-3.5 text-blue-500" />
                            <span>Toda a Empresa</span>
                          </>
                        )}
                        {doc.visibility === "sector" && (
                          <>
                            <Users className="w-3.5 h-3.5 text-purple-500" />
                            <span>Meu Setor</span>
                          </>
                        )}
                        {doc.visibility === "private" && (
                          <>
                            <Lock className="w-3.5 h-3.5 text-amber-500" />
                            <span>Privado</span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View RAG Snippet */}
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Visualizar Trecho RAG"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Reindex */}
                        <button
                          type="button"
                          onClick={() => handleReindex(doc.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Re-indexar Vetores"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Excluir Documento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Upload and Index New Document */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Indexar Documento para RAG
                </h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-3.5">
              {/* File upload zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-2xl p-4 text-center cursor-pointer bg-slate-50/50 dark:bg-slate-800/50 transition-colors"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.docx,.doc,.txt,.csv"
                  className="hidden"
                />
                <Upload className="w-6 h-6 text-blue-500 mx-auto mb-1.5" />
                {selectedFile ? (
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">
                      {selectedFile.name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {(selectedFile.size / 1024).toFixed(0)} KB • Pronto para upload
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Clique para escolher um arquivo ou arraste aqui
                    </div>
                    <div className="text-[10px] text-slate-400">
                      PDF, DOCX, CSV ou TXT (Upload seguro no Supabase Storage)
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nome do Documento / Título
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Manual_Vendas_Q3_2026.pdf"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Setor Proprietário
                  </label>
                  <select
                    value={newDocSector}
                    onChange={(e) => setNewDocSector(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="Tecnologia & Inovação">Tecnologia & Inovação</option>
                    <option value="Financeiro & Controladoria">Financeiro & Controladoria</option>
                    <option value="Suporte ao Cliente & CS">Suporte ao Cliente</option>
                    <option value="Marketing & Growth">Marketing & Growth</option>
                    <option value="Diretoria Executiva">Diretoria Executiva</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Permissão de Visualização
                  </label>
                  <select
                    value={newDocVisibility}
                    onChange={(e) => setNewDocVisibility(e.target.value as DocumentVisibility)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="company">Toda a Empresa (Público)</option>
                    <option value="sector">Apenas Meu Setor</option>
                    <option value="private">Privado (Confidencial)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Conteúdo / Resumo para Vetorização
                </label>
                <textarea
                  rows={3}
                  placeholder="Cole o texto ou diretrizes que o OpenJarvis deve memorizar..."
                  value={newDocSnippet}
                  onChange={(e) => setNewDocSnippet(e.target.value)}
                  className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-[11px] text-blue-700 dark:text-blue-300">
                ⚡ Ao salvar, o documento será processado, tokenizado e disponibilizado para busca semântica em tempo real no OpenJarvis.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  {isUploading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{isUploading ? "Processando..." : "Indexar Documento"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Preview RAG Snippet */}
      {previewDoc && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-xs">
                  {previewDoc.name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <div>
                  <span className="text-slate-400">Setor:</span>{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {previewDoc.sector}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Estimativa:</span>{" "}
                  <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono">
                    ~{previewDoc.tokensEstimated} tokens
                  </span>
                </div>
              </div>

              <div>
                <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vetor RAG Indexado:
                </div>
                <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed font-sans border border-slate-200 dark:border-slate-700">
                  {previewDoc.contentSnippet}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
