import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  FolderPlus,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import {
  getFoldersFn,
  createFolderFn,
  getDocumentsFn,
  createDocumentFn,
} from "@/lib/server-functions/documents";

export const Route = createFileRoute("/app/documents")({
  head: () => ({
    meta: [
      { title: "Documents — SILEX" },
      { name: "description", content: "Workspace documents, folders, and templates." },
    ],
  }),
  component: DocumentsPage,
});

interface FolderItem {
  id: string;
  workspaceId: string;
  parentFolderId: string | null;
  name: string;
  createdBy: string;
  createdAt: string;
}

interface DocumentItem {
  id: string;
  workspaceId: string;
  folderId: string | null;
  title: string;
  contentJson: Record<string, any>;
  isTemplate: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function DocumentsPage() {
  const [foldersList, setFoldersList] = useState<FolderItem[]>([]);
  const [documentsList, setDocumentsList] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | "ALL">("ALL");
  const [templateFilter, setTemplateFilter] = useState<"ALL" | "DOCS" | "TEMPLATES">("ALL");

  // Create Folder Modal state
  const [isFolderModalOpen, setIsFolderModalOpen] = useState<boolean>(false);
  const [folderName, setFolderName] = useState<string>("");
  const [parentFolderId, setParentFolderId] = useState<string>("");
  const [isSubmittingFolder, setIsSubmittingFolder] = useState<boolean>(false);

  // Create Document Modal state
  const [isDocModalOpen, setIsDocModalOpen] = useState<boolean>(false);
  const [docTitle, setDocTitle] = useState<string>("");
  const [targetFolderId, setTargetFolderId] = useState<string>("");
  const [isTemplate, setIsTemplate] = useState<boolean>(false);
  const [isSubmittingDoc, setIsSubmittingDoc] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      // Fetch folders
      const fetchedFolders = await getFoldersFn();
      setFoldersList(fetchedFolders);

      // Prepare filters for server query
      const isTemplateParam =
        templateFilter === "TEMPLATES" ? true : templateFilter === "DOCS" ? false : undefined;

      let folderIdParam: string | null | undefined = undefined;
      if (selectedFolderId === "ROOT") {
        folderIdParam = null;
      } else if (selectedFolderId && selectedFolderId !== "ALL") {
        folderIdParam = selectedFolderId;
      }

      const fetchedDocs = await getDocumentsFn({
        data: {
          search: searchQuery.trim() || undefined,
          folderId: folderIdParam,
          isTemplate: isTemplateParam,
        },
      });

      setDocumentsList(fetchedDocs);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to load documents from workspace database."
      );
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedFolderId, templateFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) {
      toast.error("Folder name is required");
      return;
    }

    try {
      setIsSubmittingFolder(true);
      const res = await createFolderFn({
        data: {
          name: folderName.trim(),
          parentFolderId: parentFolderId || null,
        },
      });

      toast.success(`Folder "${res.folder.name}" created!`);
      setIsFolderModalOpen(false);
      setFolderName("");
      setParentFolderId("");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setIsSubmittingFolder(false);
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) {
      toast.error("Document title is required");
      return;
    }

    try {
      setIsSubmittingDoc(true);
      const res = await createDocumentFn({
        data: {
          title: docTitle.trim(),
          folderId: targetFolderId || null,
          isTemplate,
          contentJson: {},
        },
      });

      toast.success(
        res.document.isTemplate
          ? `Template "${res.document.title}" created!`
          : `Document "${res.document.title}" created!`
      );
      setIsDocModalOpen(false);
      setDocTitle("");
      setTargetFolderId("");
      setIsTemplate(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create document");
    } finally {
      setIsSubmittingDoc(false);
    }
  };

  // Helper map for folder lookup
  const folderMap = new Map<string, FolderItem>();
  foldersList.forEach((f) => folderMap.set(f.id, f));

  // Determine view state flags
  const isWorkspaceEmpty = !isLoading && foldersList.length === 0 && documentsList.length === 0 && !searchQuery && selectedFolderId === "ALL" && templateFilter === "ALL";
  const isSearchEmpty = !isLoading && documentsList.length === 0 && Boolean(searchQuery);
  const isFolderEmpty = !isLoading && documentsList.length === 0 && !searchQuery && selectedFolderId !== "ALL";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display tracking-tight">Documents</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Workspace documents, folders, and templates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFolderModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/70 px-3 py-2 text-[13px] font-medium shadow-sm hover:bg-card transition"
          >
            <FolderPlus className="h-3.5 w-3.5 text-violet" /> New Folder
          </button>
          <button
            onClick={() => setIsDocModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3.5 py-2 text-[13px] font-medium shadow-float hover:bg-primary/90 transition"
          >
            <Plus className="h-3.5 w-3.5" /> Create Document
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive flex items-center gap-3 text-[13px]">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="flex-1">{errorMsg}</div>
        </div>
      )}

      {/* Main Grid Layout: Sidebar Navigation + Directory View */}
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Left Folder Directory Navigation Pane */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card/60 p-3 space-y-1">
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Directory
            </div>
            <button
              onClick={() => setSelectedFolderId("ALL")}
              className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition ${
                selectedFolderId === "ALL"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <FolderOpen className="h-4 w-4" /> All Documents
            </button>
            <button
              onClick={() => setSelectedFolderId("ROOT")}
              className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition ${
                selectedFolderId === "ROOT"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Folder className="h-4 w-4" /> Root / Unfiled
            </button>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/60 p-3 space-y-1">
            <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              <span>Folders</span>
              <span className="text-[10px] rounded-full bg-violet/10 text-violet px-2 py-0.5">
                {foldersList.length}
              </span>
            </div>

            {foldersList.length === 0 ? (
              <div className="px-3 py-4 text-center text-[12px] text-muted-foreground italic">
                No folders created yet.
              </div>
            ) : (
              foldersList.map((folder) => {
                const isSelected = selectedFolderId === folder.id;
                const parentFolder = folder.parentFolderId ? folderMap.get(folder.parentFolderId) : null;
                return (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-[13px] font-medium transition group ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Folder className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary-foreground" : "text-violet"}`} />
                      <span className="truncate">{folder.name}</span>
                    </div>
                    {parentFolder && (
                      <span className="text-[10px] text-muted-foreground truncate opacity-70">
                        ↳ {parentFolder.name}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Main Documents List */}
        <div className="space-y-4">
          {/* Toolbar: Search + Template Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 flex-1 min-w-[220px] focus-within:border-violet/60 transition">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search document title..."
                className="flex-1 bg-transparent outline-none text-[13px]"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 rounded-xl border border-border bg-card/60 p-0.5 text-[12px]">
              {[
                { id: "ALL", label: "All Items" },
                { id: "DOCS", label: "Documents" },
                { id: "TEMPLATES", label: "Templates" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplateFilter(t.id as "ALL" | "DOCS" | "TEMPLATES")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    templateFilter === t.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Document Items Directory Table / List */}
          <div className="rounded-3xl border border-border/70 bg-card/70 overflow-hidden shadow-sm">
            <div className="grid grid-cols-[minmax(0,2.5fr)_minmax(0,1.2fr)_120px_140px] gap-3 px-5 py-3 border-b border-border/60 text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
              <div>Title</div>
              <div>Folder</div>
              <div>Type</div>
              <div className="text-right">Updated</div>
            </div>

            <div className="divide-y divide-border/60">
              {isLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-[13px]">
                  <Loader2 className="h-5 w-5 animate-spin mr-2 text-violet" /> Loading workspace documents…
                </div>
              ) : isWorkspaceEmpty ? (
                <div className="py-16 text-center space-y-3">
                  <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <div className="text-[14px] font-medium">No documents or folders in workspace</div>
                  <p className="text-[12px] text-muted-foreground max-w-sm mx-auto">
                    Get started by creating your first workspace document or organizing folders.
                  </p>
                  <div className="flex justify-center gap-2 pt-2">
                    <button
                      onClick={() => setIsFolderModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-muted transition"
                    >
                      <FolderPlus className="h-3.5 w-3.5 text-violet" /> Create Folder
                    </button>
                    <button
                      onClick={() => setIsDocModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3.5 py-1.5 text-[12px] font-medium hover:bg-primary/90 transition shadow-float"
                    >
                      <Plus className="h-3.5 w-3.5" /> Create Document
                    </button>
                  </div>
                </div>
              ) : isSearchEmpty ? (
                <div className="py-12 text-center text-muted-foreground text-[13px]">
                  No documents found matching title &quot;{searchQuery}&quot;.
                </div>
              ) : isFolderEmpty ? (
                <div className="py-12 text-center text-muted-foreground text-[13px]">
                  No documents located inside this folder.
                </div>
              ) : documentsList.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-[13px]">
                  No documents matching current filters.
                </div>
              ) : (
                documentsList.map((doc) => {
                  const folder = doc.folderId ? folderMap.get(doc.folderId) : null;
                  return (
                    <Link
                      key={doc.id}
                      to={`/app/documents/${doc.id}` as any}
                      className="grid grid-cols-[minmax(0,2.5fr)_minmax(0,1.2fr)_120px_140px] items-center gap-3 px-5 py-4 hover:bg-muted/40 transition group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet/10 text-violet text-[14px]">
                          {doc.isTemplate ? <Sparkles className="h-4 w-4 text-violet" /> : <FileText className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-medium group-hover:text-violet transition">
                            {doc.title}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            Created {new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0">
                        {folder ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground truncate">
                            <Folder className="h-3 w-3 text-violet shrink-0" />
                            <span className="truncate">{folder.name}</span>
                          </span>
                        ) : (
                          <span className="text-[12px] text-muted-foreground italic">Root</span>
                        )}
                      </div>

                      <div>
                        {doc.isTemplate ? (
                          <span className="inline-flex rounded-full bg-violet/15 text-violet px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
                            Template
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-success/10 text-success px-2.5 py-0.5 text-[11px] font-medium">
                            Document
                          </span>
                        )}
                      </div>

                      <div className="text-right text-[12px] text-muted-foreground tabular-nums flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground/60" />
                        {new Date(doc.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Folder Modal Dialog */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2 font-display text-lg">
                <FolderPlus className="h-5 w-5 text-violet" />
                Create New Folder
              </div>
              <button
                type="button"
                onClick={() => setIsFolderModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-muted-foreground mb-1">
                  Folder Name *
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="e.g. Legal & Contracts"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-violet/60 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-muted-foreground mb-1">
                  Parent Folder (Optional)
                </label>
                <select
                  value={parentFolderId}
                  onChange={(e) => setParentFolderId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-violet/60 transition"
                >
                  <option value="">None (Root Directory)</option>
                  {foldersList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-[13px] font-medium hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFolder}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-[13px] font-medium hover:bg-primary/90 transition shadow-float disabled:opacity-60"
                >
                  {isSubmittingFolder ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…
                    </>
                  ) : (
                    "Create Folder"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Document Modal Dialog */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2 font-display text-lg">
                <FileText className="h-5 w-5 text-violet" />
                Create New Document
              </div>
              <button
                type="button"
                onClick={() => setIsDocModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDocument} className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-muted-foreground mb-1">
                  Document Title *
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. Master Services Agreement 2026"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-violet/60 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-muted-foreground mb-1">
                  Target Folder (Optional)
                </label>
                <select
                  value={targetFolderId}
                  onChange={(e) => setTargetFolderId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-violet/60 transition"
                >
                  <option value="">None (Root Directory)</option>
                  {foldersList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="isTemplate"
                  checked={isTemplate}
                  onChange={(e) => setIsTemplate(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-violet focus:ring-violet"
                />
                <label htmlFor="isTemplate" className="text-[13px] font-medium cursor-pointer">
                  Save as Workspace Template
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-[13px] font-medium hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDoc}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-[13px] font-medium hover:bg-primary/90 transition shadow-float disabled:opacity-60"
                >
                  {isSubmittingDoc ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                    </>
                  ) : (
                    "Save Document"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
