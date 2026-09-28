import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  FileText,
  Sparkles,
  Save,
  Trash2,
  Loader2,
  AlertCircle,
  Clock,
  Folder,
  FolderOpen,
  CheckCircle2,
  Paperclip,
  Code,
  FileCode,
  Tag,
  Check,
  ShieldCheck,
  Cpu,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getDocumentByIdFn,
  updateDocumentFn,
  deleteDocumentFn,
  getFoldersFn,
  getStorageConfigFn,
  deleteAttachmentFn,
  getAttachmentDownloadUrlFn,
} from "@/lib/server-functions/documents";
import { AttachFileModal } from "@/components/silex/documents/attach-file-modal";
import { Plus, Download } from "lucide-react";

export const Route = createFileRoute("/app/documents/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Document ${params.id} — SILEX` },
      { name: "description", content: "Document detail, rich content editor, and vector indexing." },
    ],
  }),
  component: DocumentDetailPage,
});

interface FolderItem {
  id: string;
  name: string;
  parentFolderId: string | null;
}

interface AttachmentItem {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  storagePath: string;
  createdAt: string;
}

interface DocumentData {
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

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function DocumentDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  // Document & Folders state
  const [docData, setDocData] = useState<DocumentData | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [foldersList, setFoldersList] = useState<FolderItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Editor form state
  const [title, setTitle] = useState<string>("");
  const [bodyText, setBodyText] = useState<string>("");
  const [rawJsonText, setRawJsonText] = useState<string>("{}");
  const [folderId, setFolderId] = useState<string>("");
  const [isTemplate, setIsTemplate] = useState<boolean>(false);
  const [editorMode, setEditorMode] = useState<"text" | "json">("text");

  // Status flags
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Storage and Attachments state
  const [storageConfig, setStorageConfig] = useState<{
    mode: "disabled" | "local" | "supabase";
    notice: string;
  } | null>(null);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState<boolean>(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<AttachmentItem | null>(null);
  const [isDeletingAttachment, setIsDeletingAttachment] = useState<boolean>(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Initial data loader
  const loadDocument = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);

      // Fetch document detail, folders, and storage status concurrently
      const [docRes, foldersRes, storageRes] = await Promise.all([
        getDocumentByIdFn({ data: { documentId: id } }),
        getFoldersFn(),
        getStorageConfigFn().catch(() => null),
      ]);

      if (storageRes) {
        setStorageConfig({
          mode: storageRes.mode,
          notice: storageRes.notice,
        });
      }

      if (docRes && docRes.document) {
        setDocData(docRes.document);
        setAttachments(docRes.attachments || []);
        setTitle(docRes.document.title);
        setFolderId(docRes.document.folderId || "");
        setIsTemplate(Boolean(docRes.document.isTemplate));

        // Parse contentJson into text & raw JSON string
        const content = docRes.document.contentJson || {};
        let initialText = "";
        if (typeof content.body === "string") {
          initialText = content.body;
        } else if (typeof content.text === "string") {
          initialText = content.text;
        } else if (typeof content.content === "string") {
          initialText = content.content;
        } else if (Object.keys(content).length > 0) {
          initialText = JSON.stringify(content, null, 2);
        }

        setBodyText(initialText);
        setRawJsonText(JSON.stringify(content, null, 2));
        setIsDirty(false);
      } else {
        setErrorMsg("Document not found in authorized workspace.");
      }

      setFoldersList(foldersRes || []);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to load document from workspace database."
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  // Synchronize JSON tab with text editor
  const handleBodyTextChange = (text: string) => {
    setBodyText(text);
    setIsDirty(true);

    try {
      const parsed = docData?.contentJson ? { ...docData.contentJson } : {};
      parsed.body = text;
      parsed.text = text;
      setRawJsonText(JSON.stringify(parsed, null, 2));
    } catch {
      setRawJsonText(JSON.stringify({ text, body: text }, null, 2));
    }
  };

  // Synchronize text editor when raw JSON is modified
  const handleRawJsonChange = (jsonStr: string) => {
    setRawJsonText(jsonStr);
    setIsDirty(true);

    try {
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed.body === "string") {
        setBodyText(parsed.body);
      } else if (typeof parsed.text === "string") {
        setBodyText(parsed.text);
      } else if (typeof parsed.content === "string") {
        setBodyText(parsed.content);
      }
    } catch {
      // In-flight JSON parsing errors do not break user typing
    }
  };

  // Delete Attachment Handler
  const handleDeleteAttachment = async () => {
    if (!attachmentToDelete) return;
    setIsDeletingAttachment(true);
    try {
      await deleteAttachmentFn({
        data: { attachmentId: attachmentToDelete.id },
      });
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentToDelete.id));
      toast.success("Attachment deleted", {
        description: `Removed "${attachmentToDelete.fileName}".`,
      });
      setAttachmentToDelete(null);
    } catch (err) {
      toast.error("Failed to delete attachment", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsDeletingAttachment(false);
    }
  };

  // Download / View Attachment Handler
  const handleDownloadAttachment = async (att: AttachmentItem) => {
    setDownloadingId(att.id);
    try {
      const res = await getAttachmentDownloadUrlFn({
        data: { attachmentId: att.id },
      });
      if (res.isAvailable && res.downloadUrl) {
        window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      } else {
        toast.info("Metadata-only file", {
          description:
            res.notice ||
            "Physical file was recorded in $0 metadata-only mode. Cloud storage is not configured.",
        });
      }
    } catch (err) {
      toast.error("Download failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  // Save Document Mutation
  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Document title cannot be empty.");
      return;
    }

    let resolvedContentJson: Record<string, unknown> = {};

    if (editorMode === "json") {
      try {
        resolvedContentJson = JSON.parse(rawJsonText);
        if (typeof resolvedContentJson !== "object" || resolvedContentJson === null) {
          throw new Error("Content must be a valid JSON object.");
        }
      } catch (err) {
        toast.error("Invalid JSON syntax: please correct JSON before saving.");
        return;
      }
    } else {
      // Build contentJson preserving any existing non-text properties
      const existing = docData?.contentJson ? { ...docData.contentJson } : {};
      resolvedContentJson = {
        ...existing,
        body: bodyText,
        text: bodyText,
      };
    }

    try {
      setIsSaving(true);
      const res = await updateDocumentFn({
        data: {
          documentId: id,
          title: trimmedTitle,
          contentJson: resolvedContentJson,
          folderId: folderId ? folderId : null,
          isTemplate,
        },
      });

      if (res && res.document) {
        setDocData(res.document);
        setTitle(res.document.title);
        setFolderId(res.document.folderId || "");
        setIsTemplate(Boolean(res.document.isTemplate));
        setRawJsonText(JSON.stringify(res.document.contentJson || {}, null, 2));
        setIsDirty(false);
        toast.success("Document saved & AI vector index updated!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save document.");
    } finally {
      setIsSaving(false);
    }
  };

  // Soft Delete Document Mutation
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteDocumentFn({
        data: {
          documentId: id,
        },
      });

      toast.success("Document deleted successfully");
      setIsDeleteDialogOpen(false);
      navigate({ to: "/app/documents" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete document.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Resolved current folder
  const currentFolder = useMemo(() => {
    return foldersList.find((f) => f.id === folderId);
  }, [foldersList, folderId]);

  // Document word & character metrics
  const metrics = useMemo(() => {
    const chars = bodyText.length;
    const words = bodyText.trim() ? bodyText.trim().split(/\s+/).length : 0;
    return { chars, words };
  }, [bodyText]);

  return (
    <div className="space-y-6 stagger">
      {/* Return navigation link */}
      <div className="flex items-center justify-between">
        <Link
          to="/app/documents"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All documents
        </Link>

        {/* Unsaved changes badge */}
        {isDirty && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 text-[11px] font-medium text-warning animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Unsaved changes
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-28 text-muted-foreground text-[13px]">
          <Loader2 className="h-5 w-5 animate-spin mr-2 text-violet" /> Loading document details…
        </div>
      ) : errorMsg || !docData ? (
        <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center space-y-4 shadow-xl">
          <AlertCircle className="h-9 w-9 text-destructive mx-auto" />
          <div className="text-base font-medium">{errorMsg || "Document not found"}</div>
          <p className="text-[12.5px] text-muted-foreground">
            The requested document could not be loaded or does not belong to your authorized workspace.
          </p>
          <Link
            to="/app/documents"
            className="inline-block text-[13px] text-primary underline hover:text-primary/90"
          >
            Return to Documents Directory
          </Link>
        </div>
      ) : (
        <>
          {/* Document Header Card */}
          <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-6 shadow-sm">
            <div className="absolute inset-x-0 top-0 h-32 bg-aurora opacity-70" />
            <div className="relative flex flex-wrap items-start justify-between gap-5">
              {/* Document Identity & Title */}
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-violet text-primary-foreground text-xl font-semibold shadow-float">
                  {isTemplate ? <Sparkles className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                </span>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="Document title"
                      className="text-2xl md:text-3xl font-display tracking-tight text-foreground bg-transparent border-transparent hover:border-border/70 focus:border-violet/60 focus:bg-background/80 transition px-2 py-1 rounded-xl h-auto"
                    />

                    {isTemplate ? (
                      <span className="inline-flex rounded-full bg-violet/15 text-violet border border-violet/30 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
                        Template
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-success/10 text-success border border-success/20 px-2.5 py-0.5 text-[11px] font-medium">
                        Document
                      </span>
                    )}
                  </div>

                  {/* Metadata Chips: Folder, Last Updated, RAG status */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] text-muted-foreground px-2">
                    <div className="flex items-center gap-1.5">
                      <Folder className="h-3.5 w-3.5 text-violet shrink-0" />
                      <span>{currentFolder ? currentFolder.name : "Root / Unfiled"}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
                      <span>
                        Updated:{" "}
                        {new Date(docData.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-violet">
                      <Cpu className="h-3.5 w-3.5 shrink-0" />
                      <span>AI Zenith RAG Ingested</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Save & Delete */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 text-[13px] h-9 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || !title.trim()}
                  className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-[13px] h-9 gap-1.5 shadow-float disabled:opacity-60"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" /> Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Main Workspace Layout: Editor Surface + Document Inspector Sidebar */}
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            {/* Left: Editor Surface */}
            <div className="space-y-4">
              {/* Editor Mode Tabs & Word Count Bar */}
              <div className="flex items-center justify-between gap-3 px-2">
                <div className="flex gap-1 rounded-xl border border-border/70 bg-card/60 p-0.5 text-[12px]">
                  <button
                    type="button"
                    onClick={() => setEditorMode("text")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                      editorMode === "text"
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" /> Document Content
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode("json")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                      editorMode === "json"
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FileCode className="h-3.5 w-3.5" /> JSON Structure
                  </button>
                </div>

                <div className="text-[12px] text-muted-foreground tabular-nums">
                  {metrics.words} words · {metrics.chars} characters
                </div>
              </div>

              {/* Editor Canvas */}
              <div className="rounded-3xl border border-border/70 bg-card/70 p-6 shadow-sm min-h-[460px]">
                {editorMode === "text" ? (
                  <Textarea
                    value={bodyText}
                    onChange={(e) => handleBodyTextChange(e.target.value)}
                    placeholder="Start drafting document content, specifications, notes, or clauses..."
                    className="w-full min-h-[420px] bg-transparent border-none resize-y text-[14px] leading-relaxed outline-none focus-visible:ring-0 p-0 font-sans"
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="text-[11.5px] text-muted-foreground font-mono">
                      Edit underlying JSON structure directly. Must be valid JSON object:
                    </div>
                    <Textarea
                      value={rawJsonText}
                      onChange={(e) => handleRawJsonChange(e.target.value)}
                      className="w-full min-h-[380px] bg-muted/30 font-mono text-[12.5px] leading-relaxed rounded-xl p-3 border border-border/60 focus:border-violet/60 resize-y"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right: Document Inspector & Properties Sidebar */}
            <div className="space-y-5">
              {/* Properties Card */}
              <div className="rounded-3xl border border-border/70 bg-card/70 p-5 space-y-4">
                <div className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Document Settings
                </div>

                {/* Target Folder Selector */}
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
                    <Folder className="h-3.5 w-3.5 text-violet" /> Location / Folder
                  </label>
                  <select
                    value={folderId}
                    onChange={(e) => {
                      setFolderId(e.target.value);
                      setIsDirty(true);
                    }}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-violet/60 transition"
                  >
                    <option value="">Root / Unfiled</option>
                    {foldersList.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Template Toggle */}
                <div className="flex items-center gap-2.5 pt-2 border-t border-border/50">
                  <input
                    type="checkbox"
                    id="isTemplateCheckbox"
                    checked={isTemplate}
                    onChange={(e) => {
                      setIsTemplate(e.target.checked);
                      setIsDirty(true);
                    }}
                    className="h-4 w-4 rounded border-border text-violet focus:ring-violet"
                  />
                  <label
                    htmlFor="isTemplateCheckbox"
                    className="text-[13px] font-medium cursor-pointer"
                  >
                    Workspace Template
                  </label>
                </div>
              </div>

              {/* RAG Status Card */}
              <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-card/80 to-violet/5 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-violet" /> AI Zenith RAG Status
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet/15 text-violet px-2 py-0.5 text-[10.5px] font-semibold">
                    <CheckCircle2 className="h-3 w-3" /> Indexed
                  </span>
                </div>

                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Every document save automatically chunks, normalizes, and re-indexes 1536-dimensional vector embeddings into AI Zenith workspace memory.
                </p>

                <div className="rounded-xl border border-border/50 bg-background/50 p-2.5 text-[11px] text-muted-foreground space-y-1 font-mono">
                  <div>Model: gemini-embedding-001</div>
                  <div>Dimensions: 1536</div>
                  <div>Sync Mode: Atomic with Save</div>
                </div>
              </div>

              {/* Attachments Metadata Card */}
              <div className="rounded-3xl border border-border/70 bg-card/70 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-primary" /> Attachments ({attachments.length})
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAttachModalOpen(true)}
                    className="h-7 px-2.5 rounded-lg border-border/70 text-[11px] font-medium gap-1 text-primary hover:bg-primary/10"
                  >
                    <Plus className="h-3 w-3" /> Attach
                  </Button>
                </div>

                {attachments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 p-4 text-center space-y-2 text-muted-foreground">
                    <Paperclip className="h-5 w-5 mx-auto opacity-40" />
                    <div className="text-[12px] font-medium">No attachments</div>
                    <p className="text-[11px] leading-tight text-muted-foreground/80 max-w-[260px] mx-auto">
                      {storageConfig?.mode === "disabled"
                        ? "Operating in $0 metadata-only mode. Click \"Attach\" to record file references without cloud costs."
                        : "Add documents, images, or files to accompany this document."}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsAttachModalOpen(true)}
                      className="h-7 text-[11px] font-medium text-primary hover:bg-primary/10"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add attachment
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 p-2.5 text-[12px] group hover:border-border transition-colors"
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <Paperclip className="h-3.5 w-3.5 text-violet shrink-0" />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">{att.fileName}</div>
                            <div className="text-[10px] text-muted-foreground tabular-nums">
                              {formatBytes(att.fileSizeBytes)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => handleDownloadAttachment(att)}
                            disabled={downloadingId === att.id}
                            title={
                              storageConfig?.mode === "disabled"
                                ? "View metadata info"
                                : "Download attachment"
                            }
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-colors disabled:opacity-50"
                          >
                            {downloadingId === att.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAttachmentToDelete(att)}
                            title="Delete attachment"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Attach File Modal */}
          <AttachFileModal
            open={isAttachModalOpen}
            onOpenChange={setIsAttachModalOpen}
            documentId={id}
            storageMode={storageConfig?.mode || "disabled"}
            storageNotice={storageConfig?.notice}
            onAttachmentAdded={(newAtt) => {
              setAttachments((prev) => [newAtt, ...prev]);
            }}
          />

          {/* Delete Attachment Confirmation Alert Dialog */}
          <AlertDialog
            open={attachmentToDelete !== null}
            onOpenChange={(open) => {
              if (!open && !isDeletingAttachment) {
                setAttachmentToDelete(null);
              }
            }}
          >
            <AlertDialogContent className="rounded-3xl border border-border bg-card p-6 shadow-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-lg font-display">
                  Delete Attachment
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[13px] text-muted-foreground">
                  Are you sure you want to remove &quot;{attachmentToDelete?.fileName}&quot; from this document? The attachment metadata will be deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 pt-2">
                <AlertDialogCancel
                  disabled={isDeletingAttachment}
                  className="rounded-xl border border-border text-[13px]"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={isDeletingAttachment}
                  onClick={(e) => {
                    e.preventDefault();
                    handleDeleteAttachment();
                  }}
                  className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 text-[13px] shadow-float"
                >
                  {isDeletingAttachment ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Deleting...
                    </>
                  ) : (
                    "Delete Attachment"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Delete Confirmation Alert Dialog */}
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent className="rounded-3xl border border-border bg-card p-6 shadow-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-lg font-display">
                  Delete Document
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[13px] text-muted-foreground">
                  Are you sure you want to delete &quot;{title}&quot;? The document will be soft-deleted and its vector embeddings will be purged from AI Zenith RAG memory.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 pt-2">
                <AlertDialogCancel
                  disabled={isDeleting}
                  className="rounded-xl border border-border text-[13px]"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={isDeleting}
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete();
                  }}
                  className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 text-[13px] shadow-float"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Deleting…
                    </>
                  ) : (
                    "Delete Document"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
