import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  MapPin,
  MoreHorizontal,
  Plus,
  FileText,
  MessageSquare,
  Sparkles,
  Download,
  Loader2,
  Edit,
  Trash2,
  Pin,
  PinOff,
  FolderKanban,
  ArrowUpRight,
  AlertCircle,
  Building2,
  User,
  Star,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import {
  getClientByIdFn,
  deleteClientFn,
  createClientNoteFn,
  togglePinClientNoteFn,
  deleteClientNoteFn,
  setPrimaryClientContactFn,
  deleteClientContactFn,
} from "@/lib/server-functions/crm";
import { EditClientModal } from "@/components/crm/edit-client-modal";
import { ContactModal } from "@/components/crm/contact-modal";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/app/clients/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Client Details — SILEX` },
      { name: "description", content: `CRM profile and collaboration for client ${params.id}.` },
    ],
  }),
  component: ClientDetail,
});

function formatCurrency(cents: number, currency: string = "USD") {
  const amount = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
}

const statusToneMap: Record<string, string> = {
  Active: "bg-success/10 text-success",
  Lead: "bg-violet/10 text-violet",
  Overdue: "bg-destructive/10 text-destructive",
  Paused: "bg-muted text-muted-foreground",
  active: "bg-success/10 text-success",
  in_progress: "bg-primary/10 text-primary",
  planning: "bg-violet/10 text-violet",
  completed: "bg-success/10 text-success",
  on_hold: "bg-warning/15 text-warning",
  draft: "bg-muted text-muted-foreground",
  paid: "bg-success/10 text-success",
  Paid: "bg-success/10 text-success",
  sent: "bg-primary/10 text-primary",
  Sent: "bg-primary/10 text-primary",
  cancelled: "bg-muted text-muted-foreground",
};

const trend = Array.from({ length: 12 }).map((_, i) => ({
  x: i,
  y: 20 + Math.sin(i / 2) * 12 + i * 3,
}));

function ClientDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [realClientData, setRealClientData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Delete Client Dialog
  const [isDeleteClientOpen, setIsDeleteClientOpen] = useState(false);
  const [isDeletingClient, setIsDeletingClient] = useState(false);

  // Note Compose
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNotePinned, setNewNotePinned] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Delete Note Dialog
  const [noteToDelete, setNoteToDelete] = useState<any | null>(null);
  const [isDeletingNote, setIsDeletingNote] = useState(false);

  // Key Contacts Modal & Actions
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [contactToDelete, setContactToDelete] = useState<any | null>(null);
  const [isDeletingContact, setIsDeletingContact] = useState(false);

  const loadClientDetail = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const res = await getClientByIdFn({ data: { clientId: id } });
      if (res && res.client) {
        setRealClientData(res);
      } else {
        setRealClientData(null);
        setLoadError("Client not found or access denied.");
      }
    } catch (err: any) {
      setRealClientData(null);
      setLoadError(err instanceof Error ? err.message : "Failed to load client details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadClientDetail();
    } else {
      setIsLoading(false);
    }
  }, [id]);

  // Client Update Handler
  const handleClientUpdated = (updatedClient: any) => {
    setRealClientData((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        client: {
          ...prev.client,
          ...updatedClient,
        },
      };
    });
  };

  // Client Deletion Handler
  const handleDeleteClient = async () => {
    if (!id) return;
    try {
      setIsDeletingClient(true);
      await deleteClientFn({ data: { clientId: id } });
      toast.success("Client deleted successfully");
      setIsDeleteClientOpen(false);
      navigate({ to: "/app/clients" });
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to delete client");
    } finally {
      setIsDeletingClient(false);
    }
  };

  // Note Creation Handler
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newNoteContent.trim();
    if (!content) {
      toast.error("Note content cannot be empty.");
      return;
    }

    try {
      setIsSubmittingNote(true);
      const res = await createClientNoteFn({
        data: {
          clientId: id,
          content,
          isPinned: newNotePinned,
        },
      });

      if (res && res.note) {
        toast.success("Note added successfully");
        setRealClientData((prev: any) => {
          if (!prev) return prev;
          const currentNotes = prev.notes || [];
          const updatedNotes = [res.note, ...currentNotes].sort((a: any, b: any) => {
            if (a.isPinned !== b.isPinned) {
              return a.isPinned ? -1 : 1;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          return {
            ...prev,
            notes: updatedNotes,
          };
        });
        setNewNoteContent("");
        setNewNotePinned(false);
        setIsAddingNote(false);
      }
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to create note.");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Toggle Pin Note Handler
  const handleTogglePinNote = async (note: any) => {
    try {
      const res = await togglePinClientNoteFn({
        data: {
          noteId: note.id,
          clientId: id,
          isPinned: !note.isPinned,
        },
      });

      if (res && res.note) {
        toast.success(res.note.isPinned ? "Note pinned to top" : "Note unpinned");
        setRealClientData((prev: any) => {
          if (!prev) return prev;
          const currentNotes = prev.notes || [];
          const updatedNotes = currentNotes
            .map((n: any) => (n.id === res.note.id ? res.note : n))
            .sort((a: any, b: any) => {
              if (a.isPinned !== b.isPinned) {
                return a.isPinned ? -1 : 1;
              }
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
          return {
            ...prev,
            notes: updatedNotes,
          };
        });
      }
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle note pin.");
    }
  };

  // Delete Note Handler
  const handleDeleteNote = async () => {
    if (!noteToDelete) return;
    try {
      setIsDeletingNote(true);
      await deleteClientNoteFn({
        data: {
          noteId: noteToDelete.id,
          clientId: id,
        },
      });

      toast.success("Note deleted");
      setRealClientData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          notes: (prev.notes || []).filter((n: any) => n.id !== noteToDelete.id),
        };
      });
      setNoteToDelete(null);
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to delete note.");
    } finally {
      setIsDeletingNote(false);
    }
  };

  // Contact Handlers
  const handleOpenAddContact = () => {
    setEditingContact(null);
    setIsContactModalOpen(true);
  };

  const handleOpenEditContact = (contact: any) => {
    setEditingContact(contact);
    setIsContactModalOpen(true);
  };

  const handleSetPrimaryContact = async (contact: any) => {
    if (!id || !contact.id) return;
    try {
      await setPrimaryClientContactFn({
        data: {
          clientId: id,
          contactId: contact.id,
        },
      });
      toast.success(`${contact.firstName} set as primary contact`);
      loadClientDetail();
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to set primary contact.");
    }
  };

  const handleDeleteContact = async () => {
    if (!id || !contactToDelete) return;
    try {
      setIsDeletingContact(true);
      await deleteClientContactFn({
        data: {
          clientId: id,
          contactId: contactToDelete.id,
        },
      });
      toast.success("Contact deleted");
      setContactToDelete(null);
      loadClientDetail();
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to delete contact.");
    } finally {
      setIsDeletingContact(false);
    }
  };

  const client = realClientData?.client;
  const contacts = realClientData?.contacts || [];
  const notes = realClientData?.notes || [];
  const invoices = realClientData?.invoices || [];
  const projects = realClientData?.projects || [];
  const stats = realClientData?.stats || {
    lifetimeValueCents: 0,
    totalInvoicedCents: 0,
    outstandingCents: 0,
    averageInvoiceCents: 0,
    invoicesCount: 0,
    projectsCount: 0,
  };

  const clientName = client?.companyName || "Client Profile";
  const primaryContact = contacts.find((c: any) => c.isPrimary) || contacts[0];
  const email = primaryContact?.email || "No email";
  const phone = primaryContact?.phone || "No phone";
  const website = client?.website || "No website";
  const status = client?.status || "Active";
  const currency = client?.currency || "USD";

  const billingAddr = client?.billingAddress || {};
  const formattedAddress = [billingAddr.city, billingAddr.state, billingAddr.country]
    .filter(Boolean)
    .join(", ");

  const initials = clientName
    .split(" ")
    .map((w: string) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase() || "CL";

  return (
    <div className="space-y-6 stagger">
      <Link
        to="/app/clients"
        className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All clients
      </Link>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-[13px]">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading client profile…
        </div>
      ) : loadError || !client ? (
        <div className="rounded-3xl border border-destructive/30 bg-card/70 p-8 text-center space-y-3">
          <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
          <h2 className="text-xl font-display">{loadError || "Client not found"}</h2>
          <p className="text-sm text-muted-foreground">
            The requested client record may have been deleted or does not belong to your workspace.
          </p>
          <div className="pt-2">
            <Link
              to="/app/clients"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-[13px] font-medium shadow-float hover:bg-primary/90 transition"
            >
              Return to clients
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Header card */}
          <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-6">
            <div className="absolute inset-x-0 top-0 h-32 bg-aurora opacity-70" />
            <div className="relative flex flex-wrap items-start gap-5">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-violet text-primary-foreground text-xl font-semibold shadow-float">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-display tracking-tight">{clientName}</h1>
                  <span
                    className={`rounded-full text-[11px] font-medium px-2 py-0.5 ${
                      statusToneMap[status] || "bg-muted text-muted-foreground"
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {email}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {phone}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-3 w-3" /> {website}
                  </span>
                  {formattedAddress && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {formattedAddress}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {email !== "No email" && (
                  <a
                    href={`mailto:${email}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-[13px] font-medium hover:border-violet/50 transition"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Message
                  </a>
                )}
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-[13px] font-medium hover:border-violet/50 transition"
                >
                  <Edit className="h-3.5 w-3.5" /> Edit client
                </button>
                <Link
                  to="/app/invoices/new"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-[13px] font-medium shadow-float hover:bg-primary/90 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> New invoice
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card hover:bg-muted/40 transition">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
                      <Edit className="mr-2 h-4 w-4" /> Edit Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setIsDeleteClientOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Client
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="grid gap-4 xl:grid-cols-3">
            {/* Left Column (KPIs, Invoices, Projects) */}
            <div className="xl:col-span-2 space-y-4">
              {/* KPIs */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { l: "Lifetime value", v: formatCurrency(stats.lifetimeValueCents, currency) },
                  { l: "Total invoiced", v: formatCurrency(stats.totalInvoicedCents, currency) },
                  { l: "Outstanding", v: formatCurrency(stats.outstandingCents, currency) },
                  { l: "Avg. invoice", v: formatCurrency(stats.averageInvoiceCents, currency) },
                  { l: "Projects", v: `${stats.projectsCount ?? projects.length}` },
                ].map((s) => (
                  <div key={s.l} className="rounded-2xl border border-border/70 bg-card/70 p-4">
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                      {s.l}
                    </div>
                    <div className="mt-1 text-2xl font-display">{s.v}</div>
                  </div>
                ))}
              </div>

              {/* Revenue trend */}
              <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
                      Revenue with {clientName}
                    </div>
                    <div className="mt-1 text-3xl font-display">
                      {formatCurrency(stats.totalInvoicedCents, currency)}
                    </div>
                  </div>
                  <span className="text-[12px] font-medium text-success">
                    {stats.invoicesCount} {stats.invoicesCount === 1 ? "invoice" : "invoices"}
                  </span>
                </div>
                <div className="mt-4 h-32">
                  <ResponsiveContainer>
                    <AreaChart data={trend}>
                      <defs>
                        <linearGradient id="c1" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="oklch(0.58 0.28 295)" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="oklch(0.58 0.28 295)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area dataKey="y" stroke="oklch(0.32 0.14 275)" strokeWidth={2} fill="url(#c1)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Invoices */}
              <div className="rounded-3xl border border-border/70 bg-card/70 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
                  <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
                    Invoices ({invoices.length})
                  </div>
                  <Link to="/app/invoices" className="text-[12px] text-primary hover:underline">
                    View all
                  </Link>
                </div>
                <div className="divide-y divide-border/60">
                  {invoices.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-[13px]">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                      No invoices created for this client yet.
                    </div>
                  ) : (
                    invoices.map((inv: any) => (
                      <Link
                        key={inv.id}
                        to="/app/invoices/$id"
                        params={{ id: inv.id }}
                        className="flex items-center gap-3 px-6 py-3.5 hover:bg-muted/40 transition group"
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium group-hover:text-primary transition">
                            {inv.invoiceNumber}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Due {new Date(inv.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                        </div>
                        <div className="text-[13px] font-medium tabular-nums">
                          {formatCurrency(inv.totalCents, inv.currency || currency)}
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            statusToneMap[inv.status] || "bg-muted text-muted-foreground"
                          }`}
                        >
                          {inv.status}
                        </span>
                        <Download className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:opacity-100 transition" />
                      </Link>
                    ))
                  )}
                </div>
              </div>

              {/* Projects */}
              <div className="rounded-3xl border border-border/70 bg-card/70 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
                  <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
                    Projects ({projects.length})
                  </div>
                  <Link to="/app/projects" className="text-[12px] text-primary hover:underline">
                    View all
                  </Link>
                </div>
                <div className="divide-y divide-border/60">
                  {projects.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-[13px]">
                      <FolderKanban className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                      No projects assigned to this client yet.
                    </div>
                  ) : (
                    projects.map((proj: any) => (
                      <Link
                        key={proj.id}
                        to="/app/projects/$id"
                        params={{ id: proj.id }}
                        className="flex items-center gap-3 px-6 py-3.5 hover:bg-muted/40 transition group"
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                          <FolderKanban className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium group-hover:text-primary transition">
                              {proj.name}
                            </span>
                            {proj.code && (
                              <span className="text-[11px] font-mono text-muted-foreground">
                                [{proj.code}]
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {proj.dueDate
                              ? `Due ${new Date(proj.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                              : proj.startDate
                              ? `Started ${new Date(proj.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                              : "Active deliverable"}
                          </div>
                        </div>
                        <div className="text-[13px] font-medium tabular-nums">
                          {formatCurrency(proj.budgetCents, currency)}
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            statusToneMap[proj.status] || "bg-muted text-muted-foreground"
                          }`}
                        >
                          {proj.status}
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:opacity-100 transition" />
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {/* AI summary */}
              <div className="rounded-3xl bg-gradient-to-br from-primary to-violet text-primary-foreground p-5 shadow-float">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest opacity-80">
                  <Sparkles className="h-3 w-3" /> AI client intelligence
                </div>
                <p className="mt-3 text-[13.5px] leading-relaxed opacity-95">
                  Client relationship status: <strong>{status}</strong>. Currently managing {projects.length}{" "}
                  {projects.length === 1 ? "project" : "projects"} and {invoices.length}{" "}
                  {invoices.length === 1 ? "invoice" : "invoices"}. Notes and interactions are automatically
                  indexed into Zenith AI memory for context-aware summaries.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <Link
                    to="/app/invoices/new"
                    className="rounded-lg bg-white/15 backdrop-blur px-3 py-1.5 text-[12px] font-medium hover:bg-white/25 transition"
                  >
                    Draft Invoice
                  </Link>
                </div>
              </div>

              {/* Key Contacts */}
              <div className="rounded-3xl border border-border/70 bg-card/70 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
                    Key Contacts ({contacts.length})
                  </div>
                  <button
                    onClick={handleOpenAddContact}
                    className="text-[12px] text-primary hover:underline font-medium inline-flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add contact
                  </button>
                </div>

                {contacts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center">
                    <User className="h-6 w-6 mx-auto text-muted-foreground/60 mb-2" />
                    <p className="text-xs text-muted-foreground">No contacts registered yet</p>
                    <button
                      onClick={handleOpenAddContact}
                      className="mt-2 text-xs text-primary font-medium hover:underline"
                    >
                      + Add first contact
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {contacts.map((c: any) => (
                      <div
                        key={c.id}
                        className="rounded-2xl border border-border/60 bg-card/50 p-3.5 space-y-2 transition hover:border-violet/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium truncate">
                                {c.firstName} {c.lastName}
                              </span>
                              {c.isPrimary && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-violet/10 px-2 py-0.5 text-[10px] font-medium text-violet">
                                  <Star className="h-2.5 w-2.5 fill-violet" /> Primary
                                </span>
                              )}
                            </div>
                            {c.jobTitle && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {c.jobTitle}
                              </div>
                            )}
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted/60 text-muted-foreground transition">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {!c.isPrimary && (
                                <DropdownMenuItem onClick={() => handleSetPrimaryContact(c)}>
                                  <Star className="mr-2 h-3.5 w-3.5 text-amber-500" /> Set as Primary
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleOpenEditContact(c)}>
                                <Edit className="mr-2 h-3.5 w-3.5" /> Edit Contact
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setContactToDelete(c)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Contact
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground pt-1 border-t border-border/40">
                          {c.email && (
                            <a
                              href={`mailto:${c.email}`}
                              className="inline-flex items-center gap-1 hover:text-foreground transition"
                            >
                              <Mail className="h-3 w-3" /> {c.email}
                            </a>
                          )}
                          {c.phone && (
                            <a
                              href={`tel:${c.phone}`}
                              className="inline-flex items-center gap-1 hover:text-foreground transition"
                            >
                              <Phone className="h-3 w-3" /> {c.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes & Collaboration */}
              <div className="rounded-3xl border border-border/70 bg-card/70 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
                    Notes & Collaboration ({notes.length})
                  </div>
                  <button
                    onClick={() => setIsAddingNote(!isAddingNote)}
                    className="text-[12px] text-primary hover:underline font-medium"
                  >
                    {isAddingNote ? "Cancel" : "Add note"}
                  </button>
                </div>

                {/* Inline Add Note Form */}
                {isAddingNote && (
                  <form
                    onSubmit={handleCreateNote}
                    className="rounded-2xl border border-border/80 bg-background/50 p-3 space-y-3 animate-in fade-in duration-200"
                  >
                    <Textarea
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      placeholder="Add an internal note or context about this client..."
                      rows={3}
                      className="text-xs resize-none rounded-xl border-border/70 bg-card/60 focus:border-violet/60"
                      disabled={isSubmittingNote}
                      autoFocus
                    />
                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                        <Checkbox
                          checked={newNotePinned}
                          onCheckedChange={(c) => setNewNotePinned(Boolean(c))}
                          disabled={isSubmittingNote}
                        />
                        <span>Pin to top</span>
                      </label>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isSubmittingNote || !newNoteContent.trim()}
                        className="h-8 rounded-xl bg-primary text-primary-foreground text-xs font-medium shadow-float"
                      >
                        {isSubmittingNote ? (
                          <>
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Saving…
                          </>
                        ) : (
                          "Post note"
                        )}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Notes List */}
                <div className="space-y-3">
                  {notes.length === 0 ? (
                    <div className="py-6 text-center text-muted-foreground text-xs">
                      No internal notes recorded yet.
                    </div>
                  ) : (
                    notes.map((n: any) => (
                      <div
                        key={n.id}
                        className={`group relative rounded-xl border p-3 text-[13px] transition ${
                          n.isPinned
                            ? "border-violet/40 bg-violet/5 shadow-xs"
                            : "border-border/60 bg-card/40 hover:border-border"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-primary/30 to-violet/30 text-[10px] font-semibold text-foreground">
                              {n.author?.name ? n.author.name.slice(0, 2).toUpperCase() : "TM"}
                            </span>
                            <div>
                              <span className="text-xs font-medium text-foreground">
                                {n.author?.name || "Teammate"}
                              </span>
                              <span className="ml-1.5 text-[11px] text-muted-foreground">
                                {new Date(n.createdAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                            <button
                              type="button"
                              onClick={() => handleTogglePinNote(n)}
                              title={n.isPinned ? "Unpin note" : "Pin note to top"}
                              className={`rounded-md p-1 hover:bg-muted transition ${
                                n.isPinned ? "text-violet" : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {n.isPinned ? <Pin className="h-3.5 w-3.5 fill-violet" /> : <PinOff className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setNoteToDelete(n)}
                              title="Delete note"
                              className="rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">
                          {n.content}
                        </div>

                        {n.isPinned && (
                          <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-violet">
                            <Pin className="h-2.5 w-2.5 fill-violet" /> Pinned note
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Files */}
              <div className="rounded-3xl border border-border/70 bg-card/70 p-5">
                <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
                  Files & contracts
                </div>
                <div className="mt-4 space-y-2 text-[13px]">
                  {["Client Master Agreement.pdf", "Brand Guidelines v2.pdf", "Project Scope.pdf"].map(
                    (f) => (
                      <div
                        key={f}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 hover:border-violet/40 transition"
                      >
                        <span className="flex items-center gap-2 truncate text-xs">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" /> {f}
                        </span>
                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Edit Client Modal */}
          <EditClientModal
            open={isEditModalOpen}
            onOpenChange={setIsEditModalOpen}
            client={client}
            onClientUpdated={handleClientUpdated}
          />

          {/* Delete Client Dialog */}
          <AlertDialog open={isDeleteClientOpen} onOpenChange={setIsDeleteClientOpen}>
            <AlertDialogContent className="rounded-3xl border-border/80 bg-card/95 backdrop-blur-xl p-6">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-lg font-display">Delete Client</AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to delete <strong>{clientName}</strong>? This action will
                  soft-delete the client record and archive their associated notes. Active invoices and
                  projects will remain in the database.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-4 flex items-center justify-end gap-2">
                <AlertDialogCancel disabled={isDeletingClient} className="rounded-xl border-border text-xs">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteClient}
                  disabled={isDeletingClient}
                  className="rounded-xl bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition shadow-float"
                >
                  {isDeletingClient ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Deleting…
                    </>
                  ) : (
                    "Delete Client"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Delete Note Dialog */}
          <AlertDialog open={Boolean(noteToDelete)} onOpenChange={(o) => !o && setNoteToDelete(null)}>
            <AlertDialogContent className="rounded-3xl border-border/80 bg-card/95 backdrop-blur-xl p-6">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-lg font-display">Delete Note</AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to delete this internal note? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-4 flex items-center justify-end gap-2">
                <AlertDialogCancel disabled={isDeletingNote} className="rounded-xl border-border text-xs">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteNote}
                  disabled={isDeletingNote}
                  className="rounded-xl bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition shadow-float"
                >
                  {isDeletingNote ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Deleting…
                    </>
                  ) : (
                    "Delete Note"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Contact Modal (Add / Edit) */}
          <ContactModal
            open={isContactModalOpen}
            onOpenChange={setIsContactModalOpen}
            clientId={id}
            contact={editingContact}
            onSuccess={() => loadClientDetail()}
          />

          {/* Delete Contact Dialog */}
          <AlertDialog
            open={Boolean(contactToDelete)}
            onOpenChange={(o) => !o && setContactToDelete(null)}
          >
            <AlertDialogContent className="rounded-3xl border-border/80 bg-card/95 backdrop-blur-xl p-6">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-lg font-display">Delete Contact</AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to remove{" "}
                  <strong>
                    {contactToDelete?.firstName} {contactToDelete?.lastName}
                  </strong>{" "}
                  from this client? If this person is the primary contact, another active contact will
                  automatically be promoted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-4 flex items-center justify-end gap-2">
                <AlertDialogCancel
                  disabled={isDeletingContact}
                  className="rounded-xl border-border text-xs"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteContact}
                  disabled={isDeletingContact}
                  className="rounded-xl bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition shadow-float"
                >
                  {isDeletingContact ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Removing…
                    </>
                  ) : (
                    "Remove Contact"
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
