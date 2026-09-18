import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  ArrowUp,
  Paperclip,
  FileText,
  Mail,
  Users,
  Wand2,
  Search,
  Clock,
  MessageSquare,
  Plus,
  Loader2,
  RotateCcw,
  Database,
  Cpu,
} from "lucide-react";
import {
  queryZenithFn,
  getZenithConversationsFn,
  getZenithConversationMessagesFn,
  type ZenithConversationItem,
} from "@/lib/server-functions/zenith";

export const Route = createFileRoute("/app/ai")({
  head: () => ({
    meta: [
      { title: "AI Assistant — SILEX" },
      { name: "description", content: "Your always-on business partner." },
    ],
  }),
  component: AiPage,
});

const SUGGESTIONS = [
  { i: FileText, l: "Draft invoice for Acme — Q3 retainer" },
  { i: Mail, l: "Write a warm follow-up for INV-2039" },
  { i: Users, l: "Summarize my relationship with Nova Labs" },
  { i: Wand2, l: "What's my Q3 revenue forecast?" },
  { i: Search, l: "Find every contract with a non-compete clause" },
  { i: Clock, l: "Who hasn't paid me in over 14 days?" },
];

type SourceItem = { entityType: string; entityId: string; sourceTitle?: string };
type ToolCallItem = { toolName: string; status: string };

type Msg = {
  role: "ai" | "user";
  text: string;
  sources?: SourceItem[];
  tools?: ToolCallItem[];
  isError?: boolean;
};

function AiPage() {
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [conversations, setConversations] = useState<ZenithConversationItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusText, setStatusText] = useState("Ready");
  const [lastQuery, setLastQuery] = useState<string | undefined>();
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "ai",
      text: "Hi — I'm SILEX. I read your entire workspace so you don't have to. Ask me anything about your business, or start with a suggestion.",
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch past conversations list on mount
  useEffect(() => {
    async function loadConversations() {
      try {
        setLoadingHistory(true);
        const res = await getZenithConversationsFn();
        setConversations(res.conversations || []);
      } catch {
        // Safe fallback on unauthenticated/empty workspace
      } finally {
        setLoadingHistory(false);
      }
    }
    loadConversations();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, sending]);

  const loadConversation = async (convId: string) => {
    try {
      setSending(true);
      setStatusText("Loading conversation...");
      const res = await getZenithConversationMessagesFn({ data: { conversationId: convId } });
      setConversationId(convId);
      setMsgs(
        res.messages.map((m) => ({
          role: m.role === "assistant" ? "ai" : "user",
          text: m.content,
        }))
      );
    } catch {
      // Fallback
    } finally {
      setSending(false);
      setStatusText("Ready");
    }
  };

  const startNewConversation = () => {
    setConversationId(undefined);
    setLastQuery(undefined);
    setMsgs([
      {
        role: "ai",
        text: "Started a new conversation. Ask me anything about your business.",
      },
    ]);
  };

  const send = async (t: string) => {
    if (!t.trim() || sending) return;
    const userQuery = t.trim();
    setLastQuery(userQuery);
    setMsgs((m) => [...m, { role: "user", text: userQuery }]);
    setInput("");
    setSending(true);
    setStatusText("Searching workspace memory & tools...");

    try {
      const res = await queryZenithFn({
        data: {
          conversationId,
          query: userQuery,
        },
      });

      if (res?.conversationId) {
        setConversationId(res.conversationId);
        // Refresh conversations list
        getZenithConversationsFn().then((r) => setConversations(r.conversations || [])).catch(() => {});
      }

      setMsgs((m) => [
        ...m,
        {
          role: "ai",
          text: res?.response || "No response generated.",
          sources: res?.sources,
          tools: res?.toolCallsExecuted,
        },
      ]);
      setStatusText("Ready");
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "ai",
          text: "Zenith is temporarily unavailable. Please check your connection or server authorization.",
          isError: true,
        },
      ]);
      setStatusText("Error occurred");
    } finally {
      setSending(false);
    }
  };

  const handleRetry = () => {
    if (lastQuery && !sending) {
      send(lastQuery);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 stagger">
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-violet text-primary-foreground shadow-float">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-5xl font-display tracking-tight">SILEX AI</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Your always-on business partner. Ask anything.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* History Sidebar */}
        <div className="lg:col-span-1 rounded-3xl border border-border/70 bg-card/70 p-4 space-y-3 flex flex-col h-[600px]">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-violet" /> History
            </span>
            <button
              onClick={startNewConversation}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
              title="New Conversation"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {loadingHistory ? (
              <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet" /> Loading history...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground italic">No past conversations</div>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => loadConversation(c.id)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs transition truncate block ${
                    c.id === conversationId
                      ? "bg-violet/15 text-violet border border-violet/30 font-medium"
                      : "hover:bg-muted/60 text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                >
                  {c.title}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Conversation Window */}
        <div className="lg:col-span-3 rounded-3xl border border-border/70 bg-card/70 overflow-hidden flex flex-col h-[600px]">
          <div ref={scrollRef} className="flex-1 p-6 space-y-4 overflow-y-auto">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`animate-rise space-y-1.5 ${
                  m.role === "user" ? "ml-auto max-w-[80%]" : "mr-auto max-w-[90%]"
                }`}
              >
                {m.role === "ai" && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1.5">
                    <span className="grid h-4 w-4 place-items-center rounded-sm bg-gradient-to-br from-primary to-violet text-primary-foreground">
                      <Sparkles className="h-2.5 w-2.5" />
                    </span>
                    SILEX
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : m.isError
                      ? "bg-destructive/10 border border-destructive/30 text-destructive rounded-bl-md"
                      : "bg-muted/60 rounded-bl-md"
                  }`}
                >
                  {m.text}
                </div>

                {/* Sources badges */}
                {m.sources && m.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {m.sources.map((s, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-[10px] font-mono px-2.5 py-0.5 rounded-full border border-violet/30 bg-violet/10 text-violet-foreground"
                      >
                        <Database className="h-3 w-3 text-violet" />
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
                        className="inline-flex items-center gap-1 text-[10px] font-mono px-2.5 py-0.5 rounded-full border border-border bg-card/60 text-muted-foreground"
                      >
                        <Cpu className="h-3 w-3 text-primary" />
                        {t.toolName}
                      </span>
                    ))}
                  </div>
                )}

                {/* Retry button */}
                {m.isError && lastQuery && (
                  <button
                    onClick={handleRetry}
                    disabled={sending}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline pt-1 transition"
                  >
                    <RotateCcw className="h-3 w-3" /> Retry query
                  </button>
                )}
              </div>
            ))}

            {sending && (
              <div className="mr-auto max-w-[90%] animate-rise">
                <div className="rounded-2xl px-4 py-3 bg-muted/40 text-muted-foreground text-xs flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-violet" />
                  <span>{statusText}</span>
                </div>
              </div>
            )}
          </div>

          {msgs.length <= 1 && (
            <div className="border-t border-border/60 p-6">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Try one of these
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.l}
                    onClick={() => send(s.l)}
                    className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card px-3 py-2.5 text-left text-[13px] hover:border-violet/50 hover:bg-card transition"
                  >
                    <s.i className="h-4 w-4 text-violet shrink-0" /> {s.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-border/60 p-4"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 focus-within:border-violet/60 transition">
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted transition"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Ask SILEX about your business..."
                className="flex-1 resize-none bg-transparent py-2 text-[14px] outline-none placeholder:text-muted-foreground min-w-0"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
