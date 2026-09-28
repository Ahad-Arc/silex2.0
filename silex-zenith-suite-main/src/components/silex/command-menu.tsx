import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  Files,
  CreditCard,
  BarChart3,
  Sparkles,
  Bell,
  Settings,
  User,
  Plus,
  Send,
  Search,
  Building2,
  Palette,
  CheckSquare,
  Loader2,
} from "lucide-react";
import { globalSearchFn, SearchResultItem, GlobalSearchResponse } from "@/lib/server-functions/search";

export function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<GlobalSearchResponse["groupedResults"] | null>(null);

  const go = (to: string, search?: Record<string, string>) => {
    onOpenChange(false);
    navigate({ to: to as any, search: search as any });
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSearchResults(null);
      setLoading(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await globalSearchFn({ data: { query: trimmed } });
        setSearchResults(res.groupedResults);
      } catch (err: any) {
        console.error("Global search error:", err);
        setError("Failed to fetch search results.");
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const hasSearchQuery = query.trim().length > 0;
  const totalResultsCount = searchResults
    ? searchResults.projects.length +
      searchResults.tasks.length +
      searchResults.documents.length +
      searchResults.clients.length +
      searchResults.invoices.length +
      searchResults.expenses.length
    : 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={!hasSearchQuery}>
      <CommandInput
        placeholder="Search projects, tasks, documents, clients, invoices, expenses..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Searching workspace...
          </div>
        )}

        {error && !loading && (
          <div className="py-6 text-center text-sm text-destructive">{error}</div>
        )}

        {!hasSearchQuery && (
          <>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Quick actions">
              <CommandItem onSelect={() => go("/app/invoices/new")}>
                <Plus className="mr-2 h-4 w-4" /> New invoice
                <CommandShortcut>⌘N</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => go("/app/clients")}>
                <Users className="mr-2 h-4 w-4" /> Add client
              </CommandItem>
              <CommandItem onSelect={() => go("/app/ai")}>
                <Sparkles className="mr-2 h-4 w-4" /> Ask SILEX AI
              </CommandItem>
              <CommandItem onSelect={() => go("/app/ai")}>
                <Send className="mr-2 h-4 w-4" /> Draft email
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Navigate">
              <CommandItem onSelect={() => go("/app")}>
                <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
              </CommandItem>
              <CommandItem onSelect={() => go("/app/clients")}>
                <Users className="mr-2 h-4 w-4" /> Clients
              </CommandItem>
              <CommandItem onSelect={() => go("/app/projects")}>
                <FolderKanban className="mr-2 h-4 w-4" /> Projects
              </CommandItem>
              <CommandItem onSelect={() => go("/app/documents")}>
                <Files className="mr-2 h-4 w-4" /> Documents
              </CommandItem>
              <CommandItem onSelect={() => go("/app/invoices")}>
                <FileText className="mr-2 h-4 w-4" /> Invoices
              </CommandItem>
              <CommandItem onSelect={() => go("/app/payments")}>
                <CreditCard className="mr-2 h-4 w-4" /> Payments
              </CommandItem>
              <CommandItem onSelect={() => go("/app/analytics")}>
                <BarChart3 className="mr-2 h-4 w-4" /> Analytics
              </CommandItem>
              <CommandItem onSelect={() => go("/app/notifications")}>
                <Bell className="mr-2 h-4 w-4" /> Notifications
              </CommandItem>
              <CommandItem onSelect={() => go("/app/settings", { tab: "workspace" })}>
                <Building2 className="mr-2 h-4 w-4" /> Workspace Settings
              </CommandItem>
              <CommandItem onSelect={() => go("/app/settings", { tab: "team" })}>
                <Users className="mr-2 h-4 w-4" /> Team & Members
              </CommandItem>
              <CommandItem onSelect={() => go("/app/settings", { tab: "branding" })}>
                <Palette className="mr-2 h-4 w-4" /> Workspace Branding
              </CommandItem>
              <CommandItem onSelect={() => go("/app/settings")}>
                <Settings className="mr-2 h-4 w-4" /> All Settings
              </CommandItem>
              <CommandItem onSelect={() => go("/app/profile")}>
                <User className="mr-2 h-4 w-4" /> Profile
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {hasSearchQuery && !loading && !error && (
          <>
            {totalResultsCount === 0 ? (
              <CommandEmpty>No results found for "{query}".</CommandEmpty>
            ) : (
              <>
                {searchResults?.projects && searchResults.projects.length > 0 && (
                  <CommandGroup heading="Projects">
                    {searchResults.projects.map((item) => (
                      <CommandItem key={item.id} onSelect={() => go(item.route)}>
                        <FolderKanban className="mr-2 h-4 w-4 shrink-0 text-primary" />
                        <div className="flex flex-col overflow-hidden">
                          <span className="truncate font-medium">{item.title}</span>
                          {item.subtitle && (
                            <span className="truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {searchResults?.tasks && searchResults.tasks.length > 0 && (
                  <CommandGroup heading="Tasks">
                    {searchResults.tasks.map((item) => (
                      <CommandItem key={item.id} onSelect={() => go(item.route)}>
                        <CheckSquare className="mr-2 h-4 w-4 shrink-0 text-primary" />
                        <div className="flex flex-col overflow-hidden">
                          <span className="truncate font-medium">{item.title}</span>
                          {item.subtitle && (
                            <span className="truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {searchResults?.documents && searchResults.documents.length > 0 && (
                  <CommandGroup heading="Documents">
                    {searchResults.documents.map((item) => (
                      <CommandItem key={item.id} onSelect={() => go(item.route)}>
                        <Files className="mr-2 h-4 w-4 shrink-0 text-primary" />
                        <div className="flex flex-col overflow-hidden">
                          <span className="truncate font-medium">{item.title}</span>
                          {item.subtitle && (
                            <span className="truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {searchResults?.clients && searchResults.clients.length > 0 && (
                  <CommandGroup heading="Clients">
                    {searchResults.clients.map((item) => (
                      <CommandItem key={item.id} onSelect={() => go(item.route)}>
                        <Users className="mr-2 h-4 w-4 shrink-0 text-primary" />
                        <div className="flex flex-col overflow-hidden">
                          <span className="truncate font-medium">{item.title}</span>
                          {item.subtitle && (
                            <span className="truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {searchResults?.invoices && searchResults.invoices.length > 0 && (
                  <CommandGroup heading="Invoices">
                    {searchResults.invoices.map((item) => (
                      <CommandItem key={item.id} onSelect={() => go(item.route)}>
                        <FileText className="mr-2 h-4 w-4 shrink-0 text-primary" />
                        <div className="flex flex-col overflow-hidden">
                          <span className="truncate font-medium">{item.title}</span>
                          {item.subtitle && (
                            <span className="truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {searchResults?.expenses && searchResults.expenses.length > 0 && (
                  <CommandGroup heading="Expenses">
                    {searchResults.expenses.map((item) => (
                      <CommandItem key={item.id} onSelect={() => go(item.route)}>
                        <CreditCard className="mr-2 h-4 w-4 shrink-0 text-primary" />
                        <div className="flex flex-col overflow-hidden">
                          <span className="truncate font-medium">{item.title}</span>
                          {item.subtitle && (
                            <span className="truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function useCommandMenu() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
