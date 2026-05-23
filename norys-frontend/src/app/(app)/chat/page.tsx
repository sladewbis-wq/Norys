"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, Plus, Send, Sparkles } from "lucide-react";

import { api, streamMessage } from "@/lib/api";
import type { Agent, ChatMessage, Conversation } from "@/lib/types";
import { Button, Textarea } from "@/components/ui";
import { cn, relativeTime } from "@/lib/utils";

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatView />
    </Suspense>
  );
}

function ChatView() {
  const searchParams = useSearchParams();
  const presetAgent = searchParams.get("agent");

  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    Promise.all([api.listAgents(), api.listConversations()]).then(([a, c]) => {
      setAgents(a);
      setConversations(c);
      if (presetAgent) {
        void newConversation(presetAgent);
      } else if (c.length > 0) {
        void selectConversation(c[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  const selectConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setStreamingText("");
    setMessages(await api.listMessages(id));
  }, []);

  const newConversation = useCallback(
    async (agentId?: string) => {
      const convo = await api.createConversation({ agent_id: agentId ?? null });
      setConversations((prev) => [convo, ...prev]);
      setActiveId(convo.id);
      setMessages([]);
      setStreamingText("");
    },
    [],
  );

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;

    let convoId = activeId;
    if (!convoId) {
      const convo = await api.createConversation({ agent_id: presetAgent ?? null });
      setConversations((prev) => [convo, ...prev]);
      convoId = convo.id;
      setActiveId(convo.id);
    }

    setInput("");
    setSending(true);
    // Optimistic user message.
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content,
      tokens: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setStreamingText("");

    try {
      let acc = "";
      await streamMessage(convoId, content, (delta) => {
        acc += delta;
        setStreamingText(acc);
      });
      // Reload canonical history once streaming completes.
      setStreamingText("");
      setMessages(await api.listMessages(convoId));
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "⚠️ Une erreur est survenue lors de la génération de la réponse.",
          tokens: null,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-screen">
      {/* Conversation list */}
      <div className="flex w-72 shrink-0 flex-col border-r border-border bg-bg-subtle">
        <div className="p-3">
          <Button variant="secondary" className="w-full" onClick={() => newConversation()}>
            <Plus className="h-4 w-4" /> Nouvelle conversation
          </Button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => selectConversation(c.id)}
              className={cn(
                "w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors",
                activeId === c.id
                  ? "bg-bg-elevated text-content"
                  : "text-content-muted hover:bg-bg-elevated/60 hover:text-content",
              )}
            >
              <span className="block truncate">{c.title}</span>
              <span className="block text-[11px] text-content-subtle">
                {relativeTime(c.updated_at)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className="flex flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-8">
            {messages.length === 0 && !streamingText ? (
              <div className="flex flex-col items-center justify-center pt-24 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-subtle">
                  <Sparkles className="h-6 w-6 text-brand-hover" />
                </div>
                <h2 className="text-lg font-semibold text-content">Comment puis-je vous aider ?</h2>
                <p className="mt-1 text-sm text-content-subtle">
                  Posez une question à votre assistant IA.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((m) => (
                  <Bubble key={m.id} role={m.role} content={m.content} />
                ))}
                {streamingText && <Bubble role="assistant" content={streamingText} streaming />}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-bg p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Textarea
              rows={1}
              value={input}
              placeholder="Écrivez votre message…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              className="max-h-40 min-h-[44px] flex-1"
            />
            <Button onClick={handleSend} loading={sending} className="h-11 w-11 p-0">
              {!sending && <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  role,
  content,
  streaming,
}: {
  role: ChatMessage["role"];
  content: string;
  streaming?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
          isUser ? "bg-bg-elevated text-content-muted" : "bg-brand-subtle text-brand-hover",
        )}
      >
        {isUser ? "Vous" : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "max-w-[80%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm leading-relaxed",
          isUser ? "bg-brand text-white" : "bg-bg-subtle text-content",
        )}
      >
        {content}
        {streaming && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-brand-hover align-middle" />}
      </div>
    </div>
  );
}
