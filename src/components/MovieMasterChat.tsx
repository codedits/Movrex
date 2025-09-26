"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X, Send } from "lucide-react";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

const PAXSENIX_ENDPOINT = "https://api.paxsenix.org/v1/gpt-4o/chat";

const SYSTEM_PROMPT =
  "You are Movie Master, a helpful movie recommendation assistant inside the Movrex app. Be concise, friendly, and focus on recommending great films with year and genre. When helpful, suggest related titles. Keep answers under 3-5 lines. Format movie titles in **bold** so the UI can make them clickable.";

// Escape HTML, then apply minimal markdown: **bold** -> clickable; \n -> <br/>
function escapeHtml(input: string): string {
  return input
    .replaceAll(/&/g, "&amp;")
    .replaceAll(/</g, "&lt;")
    .replaceAll(/>/g, "&gt;")
    .replaceAll(/"/g, "&quot;")
    .replaceAll(/'/g, "&#39;");
}

function linkify(input: string): string {
  return input.replace(/(https?:\/\/[^\s<]+)/g, (m) => `<a href="${m}" target="_blank" rel="noopener noreferrer" class="underline">${m}</a>`);
}

function formatAssistantMessage(input: string): string {
  const safe = escapeHtml(input);
  const withClickable = safe.replace(/\*\*(.+?)\*\*/g, (_m, p1) => {
    const label = String(p1);
    const encoded = encodeURIComponent(label);
    return `<span data-mm-movie="${encoded}" class="underline decoration-dotted cursor-pointer hover:text-white">${label}</span>`;
  });
  const withLinks = linkify(withClickable);
  return withLinks.replace(/\r?\n/g, "<br/>");
}

export default function MovieMasterChat() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isLoadingOverlayVisible, setIsLoadingOverlayVisible] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "assistant",
      content:
        "Hi! I’m Movie Master. Tell me what you’re in the mood for and I’ll recommend some great picks.",
    },
  ]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showHelper, setShowHelper] = useState(false);
  const helperShownRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Auto-scroll on new message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isOpen]);

  // Autofocus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  const placeholder = useMemo(
    () => "Ask for recommendations (e.g., ‘spy thrillers like Mission Impossible’)…",
    []
  );

  const quickSuggestions = useMemo(
    () => [
      "Movies like Inception",
      "Best heist films from the 2010s",
      "Feel-good dramas like The Lunchbox",
      "Top sci‑fi adventures",
    ],
    []
  );

  const hasUserMessages = useMemo(() => messages.some((m) => m.role === "user"), [messages]);

  // Build a compact transcript from recent messages to provide conversational context
  const buildTranscript = useCallback((history: ChatMessage[], nextUser: string): string => {
    // Always include the system prompt as the first message
    const recent = history.slice(-8);
    const lines = [];
    const systemMsg = history.find((m) => m.role === "system");
    if (systemMsg) lines.push(`System: ${systemMsg.content}`);
    lines.push(...recent.filter((m) => m.role !== "system").map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`));
    lines.push(`User: ${nextUser}`);
    return lines.join("\n");
  }, []);

  const sendToPaxsenix = useCallback(async (transcript: string): Promise<string> => {
    try {
      // Trim transcript to a safe length for a GET param (avoid very long URLs)
      const MAX_LEN = 3000;
      let payload = transcript;
      if (typeof payload === 'string' && payload.length > MAX_LEN) {
        // prefer to keep the most recent context
        payload = payload.slice(payload.length - MAX_LEN);
      }
      // Use the Paxsenix GPT-4o API, send the transcript as 'text' param
      const url = `${PAXSENIX_ENDPOINT}?text=${encodeURIComponent(payload)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) {
        console.error(`Paxsenix API error: ${res.status} ${res.statusText}`);
        throw new Error(`API error: ${res.status}`);
      }
      const data = await res.json();
      // Paxsenix may return { ok: true, message: "..." } or { response: "..." }
      if (data && typeof data === 'object') {
        if (data.ok === false) {
          console.error('Paxsenix returned ok=false:', data);
          throw new Error('API returned error');
        }
        const msg = (data.message as string) || (data.response as string) || (data.reply as string) || (data.text as string);
        if (msg && typeof msg === 'string') return msg;
      }
      return "Sorry, I couldn't generate a reply right now.";
    } catch (error) {
      console.error('Chat API error:', error);
      throw error;
    }
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    try {
      // Build a compact transcript including the system prompt and recent messages
      const transcript = buildTranscript(messages, text);
      const reply = await sendToPaxsenix(transcript);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (error) {
      console.error('Chat error:', error);
      let errorMessage = "Hmm, I'm having trouble reaching the recommendation service. Please try again in a moment.";
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('AbortError')) {
          errorMessage = "The request took too long. Please try again.";
        } else if (error.message.includes('API error: 429')) {
          errorMessage = "Too many requests. Please wait a moment and try again.";
        } else if (error.message.includes('API error: 500')) {
          errorMessage = "The AI service is temporarily unavailable. Please try again later.";
        }
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", content: errorMessage },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, sendToPaxsenix]);

  const handleQuick = useCallback((text: string) => {
    setInput(text);
    setTimeout(() => {
      inputRef.current?.focus();
      const evt = new KeyboardEvent("keydown", { key: "Enter" });
      inputRef.current?.dispatchEvent(evt);
    }, 0);
  }, []);

  // Show widget only after page load to avoid appearing during initial loader
  useEffect(() => {
    const onReady = () => setIsReady(true);
    if (typeof window !== "undefined") {
      if (document.readyState === "complete") {
        // Add a tiny delay for smoother handoff from loading screens
        setTimeout(onReady, 200);
      } else {
        window.addEventListener("load", onReady, { once: true });
        // Fallback in case load is delayed
        const t = setTimeout(onReady, 2000);
        return () => {
          window.removeEventListener("load", onReady);
          clearTimeout(t);
        };
      }
    }
  }, []);

  // Also hide while the LoadingScreen overlay is mounted
  useEffect(() => {
    const check = () => {
      const el = document.querySelector('[data-loading-screen="true"]');
      setIsLoadingOverlayVisible(!!el);
    };
    const interval = setInterval(check, 100);
    check();
    return () => clearInterval(interval);
  }, []);

  // Show helper when footer sentinel is visible (IntersectionObserver) to avoid scroll work
  useEffect(() => {
    if (isOpen || helperShownRef.current) return;
    const sentinel = document.getElementById("footer-sentinel");
    if (!sentinel) {
      // Fallback: if no sentinel, keep lightweight passive scroll with coarse check
      const onScroll = () => {
        if (isOpen || helperShownRef.current) return;
        const scrollY = window.scrollY || document.documentElement.scrollTop;
        const viewport = window.innerHeight;
        const full = document.documentElement.scrollHeight;
        if (scrollY + viewport >= full - 80) {
          helperShownRef.current = true;
          setShowHelper(true);
          setTimeout(() => setShowHelper(false), 4000);
          window.removeEventListener("scroll", onScroll);
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (isOpen || helperShownRef.current) return;
        const entry = entries[0];
        if (entry?.isIntersecting) {
          helperShownRef.current = true;
          setShowHelper(true);
          setTimeout(() => setShowHelper(false), 4000);
          observerRef.current?.disconnect();
        }
      },
      { root: null, threshold: 0.01 }
    );
    observerRef.current.observe(sentinel);
    return () => observerRef.current?.disconnect();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && showHelper) setShowHelper(false);
  }, [isOpen, showHelper]);

  if (!isReady || isLoadingOverlayVisible) return null;
  return (
    <div
      className="fixed z-[99999] pointer-events-none"
      style={{
        // Respect safe-area on iOS while keeping consistent offset
        right: "calc(env(safe-area-inset-right, 0px) + 1rem)",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
      }}
    >
      {/* Logo button (always visible, bottom-right) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-full border border-white/15 glass p-3 md:p-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.35)] hover:bg-white/10 transition pointer-events-auto"
          aria-label="Open Movie Master chat"
        >
          <span className="sr-only">Open Movie Master chat</span>
          <Image src="/movrex.svg" alt="Movrex logo" width={32} height={32} className="mm-logo-animate md:w-[28px] md:h-[28px]" priority />
        </button>
      )}

      {/* Helper popup above the widget, does not affect layout */}
      {!isOpen && showHelper && (
        <div className="absolute bottom-full right-0 mb-2 select-none pointer-events-auto">
          <div className="rounded-2xl border border-white/10 bg-black/85 backdrop-blur-md text-white text-sm px-4 py-2.5 shadow-2xl ring-1 ring-white/15 whitespace-nowrap flex items-center shadow-[0_0_24px_rgba(255,255,255,0.25)] max-w-[92vw]">
            finding something? need help?
            <button onClick={() => setShowHelper(false)} className="ml-3 text-white/70 hover:text-white">×</button>
          </div>
          <div className="absolute -bottom-1 right-3 w-4 h-4 bg-black/85 rotate-45 border-r border-b border-white/10" />
        </div>
      )}

      {/* Chat panel (anchored bottom-right) */}
      {isOpen && (
        <div
          className="pointer-events-auto w-[92vw] max-w-[380px] md:max-w-[360px] h-[70dvh] md:h-[480px] rounded-2xl border border-white/10 bg-black/70 backdrop-blur-md overflow-hidden shadow-xl flex flex-col overscroll-contain"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/40">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-green-400" />
              <div className="text-sm font-semibold">Movie Master</div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 rounded-lg hover:bg-white/10" aria-label="Close chat">
              <X className="size-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 px-3 py-3 space-y-3 overflow-y-auto no-scrollbar">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="relative max-w-[85%]">
                  <div
                    className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${m.role === "user" ? "bg-white text-black" : "bg-black/80 border border-white/10 text-white"}`}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      const attr = target?.getAttribute?.("data-mm-movie");
                      if (attr) {
                        const title = decodeURIComponent(attr).replace(/\s*\(\d{4}\)\s*$/, "").trim();
                        try { 
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('mm_pending_query', title); 
                          }
                        } catch (error) {
                          console.warn('Error setting pending query:', error);
                        }
                        router.push(`/?q=${encodeURIComponent(title)}`);
                      }
                    }}
                  >
                    {m.role === "assistant" ? (
                      <span dangerouslySetInnerHTML={{ __html: formatAssistantMessage(m.content) }} />
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-xl px-3 py-2 text-sm leading-relaxed bg-black/80 border border-white/10 text-white inline-flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce [animation-delay:0ms]"></span>
                  <span className="inline-block w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce [animation-delay:150ms]"></span>
                  <span className="inline-block w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce [animation-delay:300ms]"></span>
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="p-2 border-t border-white/10 bg-black/30" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}>
            {!hasUserMessages && (
              <div className="mb-2 space-y-2">
                {quickSuggestions.map((q) => (
                  <div key={q} className="flex justify-end">
                    <button onClick={() => handleQuick(q)} className="rounded-xl px-3 py-2 text-sm bg-white text-black hover:bg-white/90 shadow">
                      {q}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="relative flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    handleSend();
                    return;
                  }
                  if (e.key === "Enter") handleSend();
                  if (e.key === "Escape") setInput("");
                }}
                placeholder={placeholder}
                className="w-full rounded-xl bg-white/5 border border-white/10 pl-3 pr-12 py-2 outline-none focus:ring-2 focus:ring-white/20 transition text-sm"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-2 rounded-full bg-white text-black shadow hover:bg-white/90 active:scale-[0.98] disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
