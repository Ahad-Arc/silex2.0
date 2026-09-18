import { useState } from "react";
import { Zap, Webhook, History, Send } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WorkerHealthCard } from "./worker-health-card";
import { AutomationRulesTab } from "./automation-rules-tab";
import { WebhooksTab } from "./webhooks-tab";
import { AutomationHistoryTab } from "./automation-history-tab";
import { WebhookDeliveriesTab } from "./webhook-deliveries-tab";

interface AutomationManagerProps {
  initialSection?: "rules" | "webhooks" | "history" | "deliveries";
}

export function AutomationManager({ initialSection = "rules" }: AutomationManagerProps) {
  const [activeSection, setActiveSection] = useState<string>(initialSection);
  const [filteredRuleIdHistory, setFilteredRuleIdHistory] = useState<string | null>(null);

  function handleViewRuleHistory(ruleId: string) {
    setFilteredRuleIdHistory(ruleId);
    setActiveSection("history");
  }

  return (
    <div className="space-y-6">
      {/* Top Worker Execution Diagnostics Card */}
      <WorkerHealthCard />

      {/* Sub-navigation Tabs */}
      <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-4">
        <TabsList className="bg-card/70 border border-border/70 p-1 rounded-xl">
          <TabsTrigger value="rules" className="gap-1.5 text-[12.5px] rounded-lg">
            <Zap className="h-3.5 w-3.5" /> Rules
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1.5 text-[12.5px] rounded-lg">
            <Webhook className="h-3.5 w-3.5" /> Webhooks
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-[12.5px] rounded-lg">
            <History className="h-3.5 w-3.5" /> Workflow History
          </TabsTrigger>
          <TabsTrigger value="deliveries" className="gap-1.5 text-[12.5px] rounded-lg">
            <Send className="h-3.5 w-3.5" /> Deliveries
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="focus-visible:outline-none">
          <AutomationRulesTab onViewRuleHistory={handleViewRuleHistory} />
        </TabsContent>

        <TabsContent value="webhooks" className="focus-visible:outline-none">
          <WebhooksTab />
        </TabsContent>

        <TabsContent value="history" className="focus-visible:outline-none">
          <AutomationHistoryTab initialRuleId={filteredRuleIdHistory} />
        </TabsContent>

        <TabsContent value="deliveries" className="focus-visible:outline-none">
          <WebhookDeliveriesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
