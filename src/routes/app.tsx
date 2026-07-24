import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/silex/app-shell";

export const Route = createFileRoute("/app")({
  component: AppShell,
});
