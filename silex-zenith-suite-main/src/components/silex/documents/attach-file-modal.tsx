/**
 * SILEX 2.0 — Attach File Modal Component
 *
 * Provides a student-friendly file attachment modal adhering 100% to SILEX Design Freeze.
 * Clearly displays storage configuration mode ($0 metadata-only vs local/cloud)
 * and safely records attachment metadata without requiring paid infrastructure.
 */

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Paperclip,
  UploadCloud,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
  HardDrive,
} from "lucide-react";
import { toast } from "sonner";
import { uploadAttachmentFn } from "@/lib/server-functions/documents";
import {
  MAX_DOCUMENT_ATTACHMENT_SIZE_BYTES,
  PROHIBITED_FILE_EXTENSIONS,
} from "@/lib/storage";

interface AttachFileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  storageMode?: "disabled" | "local" | "supabase";
  storageNotice?: string | null;
  onAttachmentAdded: (attachment: {
    id: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    storagePath: string;
    createdAt: string;
  }) => void;
}

export function AttachFileModal({
  open,
  onOpenChange,
  documentId,
  storageMode = "disabled",
  storageNotice,
  onAttachmentAdded,
}: AttachFileModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setSelectedFile(null);
    setCustomName("");
    setValidationError(null);
    setIsSubmitting(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Check prohibited extension
    const lowerName = file.name.toLowerCase();
    for (const ext of PROHIBITED_FILE_EXTENSIONS) {
      if (lowerName.endsWith(ext)) {
        setValidationError(`Executable file type "${ext}" is not permitted for security.`);
        setSelectedFile(null);
        return;
      }
    }

    // Check max file size (25MB)
    if (file.size > MAX_DOCUMENT_ATTACHMENT_SIZE_BYTES) {
      setValidationError("File exceeds the maximum allowed size of 25MB.");
      setSelectedFile(null);
      return;
    }

    if (file.size <= 0) {
      setValidationError("File cannot be empty (0 bytes).");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setCustomName(file.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setValidationError("Please select a file to attach.");
      return;
    }

    const fileNameToUse = (customName.trim() || selectedFile.name).trim();
    if (!fileNameToUse) {
      setValidationError("Please provide a valid file name.");
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      const res = await uploadAttachmentFn({
        data: {
          fileName: fileNameToUse,
          fileSizeBytes: selectedFile.size,
          mimeType: selectedFile.type || "application/octet-stream",
          attachedToType: "document",
          attachedToId: documentId,
        },
      });

      toast.success("Attachment recorded successfully", {
        description: `Attached "${res.attachment.fileName}" to document.`,
      });

      onAttachmentAdded(res.attachment);
      resetState();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to record attachment.";
      setValidationError(message);
      toast.error("Attachment failed", { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) {
          if (!next) resetState();
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="sm:max-w-[480px] rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-display flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-primary" /> Attach File
            </DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground">
              Record a file attachment metadata reference for this document.
            </DialogDescription>
          </DialogHeader>

          {/* Storage Architecture Notice */}
          <div className="rounded-2xl border border-border/70 bg-background/50 p-3.5 space-y-1.5 text-[12px]">
            <div className="flex items-center gap-2 font-medium">
              <HardDrive className="h-3.5 w-3.5 text-violet" />
              <span>
                Storage Mode:{" "}
                <span className="font-semibold text-foreground">
                  {storageMode === "disabled"
                    ? "Metadata-Only ($0 Invariant)"
                    : storageMode === "local"
                      ? "Local Filesystem Sandbox"
                      : "Supabase Cloud Storage"}
                </span>
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {storageNotice ||
                (storageMode === "disabled"
                  ? "Physical cloud storage is not provisioned. The file metadata (name, size, MIME type, reference path) is safely recorded in the database with $0 infrastructure cost."
                  : "Storage provider is active and ready.")}
            </p>
          </div>

          {/* File Picker / Drop Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer rounded-2xl border border-dashed border-border/80 bg-card/60 hover:bg-card/90 hover:border-primary/50 transition-all p-5 text-center space-y-2 group"
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-2 text-foreground font-medium text-[13px]">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                <span className="truncate max-w-[280px]">{selectedFile.name}</span>
                <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            ) : (
              <>
                <UploadCloud className="h-7 w-7 mx-auto text-muted-foreground group-hover:text-primary transition-colors opacity-70" />
                <div className="text-[13px] font-medium text-foreground">
                  Click to select a file
                </div>
                <div className="text-[11px] text-muted-foreground">
                  PDF, Images, Documents, Text up to 25MB
                </div>
              </>
            )}
          </div>

          {/* Custom Name Override */}
          {selectedFile && (
            <div className="space-y-1.5">
              <Label htmlFor="customFileName" className="text-[12px] font-medium">
                Attachment Display Name
              </Label>
              <Input
                id="customFileName"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Project-Proposal-v2.pdf"
                className="h-9 rounded-xl border-border bg-background/60 text-[13px]"
                maxLength={200}
                disabled={isSubmitting}
              />
            </div>
          )}

          {/* Error Message Alert */}
          {validationError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2 text-[12px] text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetState();
                onOpenChange(false);
              }}
              disabled={isSubmitting}
              className="rounded-xl border-border text-[13px] h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !selectedFile}
              className="rounded-xl bg-primary text-primary-foreground font-medium text-[13px] h-9 gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Recording...
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5" /> Save Attachment
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
