import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Paperclip, Wand2, FileText, Mail, Users, ArrowUp, Loader2, RotateCcw, Plus, Database, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryZenithFn } from "@/lib/server-functions/zenith";

const SUGGESTIONS = [
  { icon: FileText, label: "Draft invoice for Acme Studio" },
  { icon: Mail, label: "Write a follow-up email for INV-2041" },
  { icon: Users, label: "Summarize Nova Labs relationship" },
  { icon: Wand2, label: "What's my Q3 revenue forecast?" },
];

type SourceItem = { entityType: string; entityId: string; sourceTitle?: string };
type ToolCallItem = { toolName: string; status: string };

type Msg = {
  role: "user" | "assistant";
  text: string;
  sources?: SourceItem[];
  tools?: ToolCallItem[];
  isError?: boolean;
};

export function AiDock() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("Ready");
  const [lastQuery, setLastQuery] = useState<string | undefined>();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Hi — I'm SILEX. I can draft invoices, summarize clients, and answer anything about your business. What's on your mind?",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, loading]);

  const startNewConversation = () => {
    setConversationId(undefined);
    setLastQuery(undefined);
    setMessages([
      {
        role: "assistant",
        text: "Started a new conversation. What would you like to explore in your workspace?",
      },
    ]);
  };

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userText = text.trim();
    setLastQuery(userText);
    setMessages((m) => [...m, { role: "user", text: userText }]);
    setInput("");
    setLoading(true);
    setStatusMessage("Searching workspace memory & tools...");

    try {
      const res = await queryZenithFn({
        data: {
          conversationId,
          query: userText,
        },
      });

      if (res?.conversationId) {
        setConversationId(res.conversationId);
      }

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: res?.response || "No response generated.",
          sources: res?.sources,
          tools: res?.toolCallsExecuted,
        },
      ]);
      setStatusMessage("Ready");
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: "Zenith is temporarily unavailable. Please check your network connection or server authorization.",
          isError: true,
        },
      ]);
      setStatusMessage("Error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastQuery && !loading) {
      send(lastQuery);
    }
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center rounded-full",
          "bg-gradient-to-br from-primary via-violet to-primary text-primary-foreground",
          "shadow-float-lg hover:scale-105 transition-transform",
          "before:absolute before:inset-0 before:rounded-full before:animate-pulse-ring",
          open && "opacity-0 pointer-events-none",
        )}
        aria-label="Open SILEX AI"
      >
        <Sparkles className="h-6 w-6 relative" />
      </button>

      {/* Panel */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-3rem)]",
          "rounded-3xl glass-strong shadow-float-lg overflow-hidden",
          "flex flex-col origin-bottom-right transition-all duration-300",
          open
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-90 translate-y-4 pointer-events-none",
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-primary to-violet text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold tracking-tight">SILEX AI</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", loading ? "bg-amber-400" : "bg-success")} />
                <span className="truncate max-w-[180px]">{loading ? statusMessage : "Ready"}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={startNewConversation}
              title="New Conversation"
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "animate-rise space-y-1.5",
                m.role === "user" ? "ml-auto max-w-[85%]" : "mr-auto max-w-[90%]",
              )}
            >
              <div
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : m.isError
                    ? "bg-destructive/10 border border-destructive/30 text-destructive rounded-bl-md"
                    : "bg-muted/70 text-foreground rounded-bl-md",
                )}
              >
                {m.text}
              </div>

              {/* Source badges */}
              {m.sources && m.sources.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {m.sources.map((s, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border border-violet/30 bg-violet/10 text-violet-foreground"
                    >
                      <Database className="h-2.5 w-2.5 text-violet" />
                      {s.sourceTitle || `${s.entityType}: ${s.entityId.slice(0, 8)}`}
                    </span>
                  ))}
                </div>
              )}

              {/* Executed Tools Badge */}
              {m.tools && m.tools.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.tools.map((t, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border border-border bg-card/60 text-muted-foreground"
                    >
                      <Cpu className="h-2.5 w-2.5 text-primary" />
                      {t.toolName}
                    </span>
                  ))}
                </div>
              )}

              {/* Retry button on error */}
              {m.isError && lastQuery && (
                <button
                  onClick={handleRetry}
                  disabled={loading}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline pt-1 transition"
                >
                  <RotateCcw className="h-3 w-3" /> Retry query
                </button>
              )}
            </div>
          ))}

          {loading && (
            <div className="mr-auto max-w-[90%] animate-rise">
              <div className="rounded-2xl px-4 py-3 bg-muted/50 text-muted-foreground text-xs flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet" />
                <span>{statusMessage}</span>
              </div>
            </div>
          )}

          {messages.length <= 1 && (
            <div className="pt-2 stagger">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                Try asking
              </div>
              <div className="grid gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => send(s.label)}
                    className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card/60 px-3 py-2.5 text-left text-sm hover:border-violet/60 hover:bg-card transition"
                  >
                    <s.icon className="h-4 w-4 text-violet" />
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="p-3 border-t border-border/60"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2 focus-within:border-violet/60 transition">
            <button
              type="button"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted transition"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask SILEX anything..."
              rows={1}
              className="flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground min-w-0"
            />
            <button
              type="submit"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-40"
              disabled={loading || !input.trim()}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
