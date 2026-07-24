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
  FileText,
  CreditCard,
  BarChart3,
  Sparkles,
  Bell,
  Settings,
  User,
  Plus,
  Send,
  Search,
} from "lucide-react";

export function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
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

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search clients, invoices, actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => go("/app/invoices/new")}>
            <Plus /> New invoice
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/app/clients")}>
            <Users /> Add client
          </CommandItem>
          <CommandItem onSelect={() => go("/app/ai")}>
            <Sparkles /> Ask SILEX AI
          </CommandItem>
          <CommandItem onSelect={() => go("/app/ai")}>
            <Send /> Draft email
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/app")}><LayoutDashboard /> Dashboard</CommandItem>
          <CommandItem onSelect={() => go("/app/clients")}><Users /> Clients</CommandItem>
          <CommandItem onSelect={() => go("/app/invoices")}><FileText /> Invoices</CommandItem>
          <CommandItem onSelect={() => go("/app/payments")}><CreditCard /> Payments</CommandItem>
          <CommandItem onSelect={() => go("/app/analytics")}><BarChart3 /> Analytics</CommandItem>
          <CommandItem onSelect={() => go("/app/notifications")}><Bell /> Notifications</CommandItem>
          <CommandItem onSelect={() => go("/app/settings")}><Settings /> Settings</CommandItem>
          <CommandItem onSelect={() => go("/app/profile")}><User /> Profile</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Search results">
          <CommandItem><Search /> Acme Studio — client</CommandItem>
          <CommandItem><Search /> INV-2041 — invoice, $12,400</CommandItem>
          <CommandItem><Search /> Nova Labs — client</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function useCommandMenu() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
