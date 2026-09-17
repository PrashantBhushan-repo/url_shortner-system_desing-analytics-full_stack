import React, { useState, useRef, useEffect, useMemo, Component } from "react";
import ReactMarkdown from "react-markdown";
import {
  Bot,
  X,
  Send,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  BookOpen,
  Link as LinkIcon,
  Download,
  CheckCircle2,
  Plus,
  History,
  Search,
  Maximize2,
  Minimize2,
  FileDown,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  User,
  Clock,
  ArrowRight,
  Sun,
  Moon,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Star,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import API from "../../services/urlApi";

const STORAGE_KEY_PREFIX = "pburls_ai_sessions_";
const SETTINGS_KEY = "pburls_ai_mode_settings_v2";

const sanitizeMessages = (messagesList) => {
  if (!Array.isArray(messagesList)) return [];
  return messagesList
    .filter((m) => m && typeof m === "object")
    .map((m, idx) => {
      let textContent = "";
      if (typeof m.text === "string") {
        textContent = m.text;
      } else if (m.text && typeof m.text === "object") {
        try {
          textContent = JSON.stringify(m.text);
        } catch {
          textContent = String(m.text);
        }
      } else if (m.text !== undefined && m.text !== null) {
        textContent = String(m.text);
      }

      return {
        id: m.id !== undefined && m.id !== null ? String(m.id) : `msg-${idx}-${Date.now()}`,
        role: m.role === "user" ? "user" : "assistant",
        timestamp: typeof m.timestamp === "string" ? m.timestamp : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: textContent,
        type: typeof m.type === "string" ? m.type : null,
        data: m.data && typeof m.data === "object" ? m.data : null,
        latencyMs: typeof m.latencyMs === "number" ? m.latencyMs : null,
        suggestions: Array.isArray(m.suggestions) ? m.suggestions.filter((s) => typeof s === "string") : [],
        sessionTitle: typeof m.sessionTitle === "string" ? m.sessionTitle : "Saved Chat",
      };
    });
};

const sanitizeSessions = (sessionsList, userName = "") => {
  if (!Array.isArray(sessionsList) || sessionsList.length === 0) {
    return [createNewSession(userName)];
  }
  const valid = sessionsList
    .filter((s) => s && typeof s === "object")
    .map((s, idx) => ({
      id: s.id !== undefined && s.id !== null ? String(s.id) : `session-${idx}-${Date.now()}`,
      title: typeof s.title === "string" ? s.title : "Conversation",
      createdAt: typeof s.createdAt === "string" ? s.createdAt : new Date().toISOString(),
      updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : new Date().toISOString(),
      messages: sanitizeMessages(s.messages),
    }));
  return valid.length > 0 ? valid : [createNewSession(userName)];
};

const createNewSession = (userName = "") => ({
  id: `session-${Date.now()}`,
  title: "New Conversation",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messages: [
    {
      id: "welcome",
      role: "assistant",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: `👋 **Hi${userName ? ` ${userName}` : ""}! I'm your pbUrls Assistant.**\n\nI can answer architecture & documentation questions, create short links, generate QR codes, analyze your link telemetry, and inspect link hygiene.`,
      suggestions: [
        "How does bot filtering work?",
        "How to configure custom domain CNAME?",
        "Show my top performing links",
        "Run a link hygiene check",
      ],
    },
  ],
});

function AiAssistantWidget() {
  // 1. All hooks at top level
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentView, setCurrentView] = useState("chat"); // 'chat' | 'history' | 'starred'
  const [historySearchQuery, setHistorySearchQuery] = useState("");

  const [settings, setSettings] = useState(() => {
    if (typeof window === "undefined") return { mode: "dark", tone: "technical" };
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return { mode: "dark", tone: "technical" };
  });

  const userStorageKey = `${STORAGE_KEY_PREFIX}${user?.id || "guest"}`;
  const userStarredKey = `starred_${STORAGE_KEY_PREFIX}${user?.id || "guest"}`;

  const [sessions, setSessions] = useState(() => {
    if (typeof window === "undefined" || !userStorageKey) return [createNewSession(user?.name)];
    try {
      const saved = localStorage.getItem(userStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return sanitizeSessions(parsed, user?.name);
      }
    } catch {
      // Ignore storage error
    }
    return [createNewSession(user?.name)];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    return sessions[0]?.id || "session-1";
  });

  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [feedbackGiven, setFeedbackGiven] = useState({});
  const [starredMessages, setStarredMessages] = useState(() => {
    if (typeof window === "undefined" || !userStarredKey) return [];
    try {
      const saved = localStorage.getItem(userStarredKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return sanitizeMessages(parsed);
      }
    } catch {
      // Ignore storage error
    }
    return [];
  });

  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState(null);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const recognitionRef = useRef(null);

  const [quickLongUrl, setQuickLongUrl] = useState("");
  const [quickSlug, setQuickSlug] = useState("");
  const [creatingQuickLink, setCreatingQuickLink] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const messagesEndRef = useRef(null);

  // Synchronize state strictly when user changes (defense in depth)
  useEffect(() => {
    if (!userStorageKey) return;
    try {
      const saved = localStorage.getItem(userStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const sanitized = sanitizeSessions(parsed, user?.name);
        setSessions(sanitized);
        setActiveSessionId(sanitized[0]?.id || `session-${Date.now()}`);
        return;
      }
    } catch {
      // Ignore storage error
    }
    const fresh = createNewSession(user?.name);
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
  }, [userStorageKey, user?.name]);

  useEffect(() => {
    if (!userStarredKey) return;
    try {
      const saved = localStorage.getItem(userStarredKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setStarredMessages(sanitizeMessages(parsed));
      }
    } catch {
      setStarredMessages([]);
    }
  }, [userStarredKey]);

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || sessions[0] || createNewSession(user?.name);
  }, [sessions, activeSessionId, user?.name]);

  const messages = activeSession?.messages || [];

  const filteredSessions = useMemo(() => {
    if (!historySearchQuery.trim()) return sessions;
    const query = historySearchQuery.toLowerCase().trim();
    return sessions.filter((s) => {
      const matchTitle = (s.title || "").toLowerCase().includes(query);
      const matchMsg = (s.messages || []).some((m) => (m.text || "").toLowerCase().includes(query));
      return matchTitle || matchMsg;
    });
  }, [sessions, historySearchQuery]);

  // Persist strictly to this individual user's storage key
  useEffect(() => {
    if (typeof window !== "undefined" && userStorageKey && sessions.length > 0) {
      try {
        localStorage.setItem(userStorageKey, JSON.stringify(sessions));
      } catch {
        // Ignore storage error
      }
    }
  }, [sessions, userStorageKey]);

  useEffect(() => {
    if (typeof window !== "undefined" && userStarredKey) {
      try {
        localStorage.setItem(userStarredKey, JSON.stringify(starredMessages));
      } catch {
        // Ignore storage error
      }
    }
  }, [starredMessages, userStarredKey]);

  useEffect(() => {
    if (isOpen && currentView === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, currentView]);

  const isDark = settings?.mode === "dark";

  const updateSetting = (key, value) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const toggleVoiceInput = async () => {
    setMicError(null);

    const SpeechRecognition =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognition) {
      setMicError("Speech recognition is not supported in this browser. Please use Chrome, Brave, or Edge.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      setIsListening(false);
      return;
    }

    // Explicitly request microphone permissions first if mediaDevices API is present
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setMicError("Microphone access denied. Please allow microphone permissions in your browser URL bar.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setMicError("No microphone device detected on your hardware.");
        } else {
          setMicError(`Microphone permission error: ${err.message}`);
        }
        return;
      }
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "en-US";

      const initialInput = inputMessage;

      recognition.onstart = () => {
        setIsListening(true);
        setMicError(null);
      };

      recognition.onresult = (event) => {
        let currentTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        const text = currentTranscript.trim();
        setInputMessage(initialInput ? `${initialInput} ${text}` : text);
      };

      recognition.onerror = (event) => {
        console.warn("[VoiceInput] Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setMicError("Microphone permission blocked by browser. Please enable microphone permissions in site settings.");
        } else if (event.error === "audio-capture") {
          setMicError("Microphone is currently unavailable or in use by another application.");
        } else if (event.error === "network") {
          setMicError("Network error contacting speech recognition service.");
        } else if (event.error !== "no-speech") {
          setMicError(`Voice error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("[VoiceInput] Failed to start speech recognition:", err);
      setIsListening(false);
      setMicError(`Could not start voice recognition: ${err.message}`);
    }
  };

  const toggleSpeechReadout = (msgId, text) => {
    if (!("speechSynthesis" in window)) return;

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = (text || "").replace(/[#*`_]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const toggleStarMessage = (msg) => {
    setStarredMessages((prev) => {
      const exists = prev.some((item) => item.id === msg.id);
      if (exists) {
        return prev.filter((item) => item.id !== msg.id);
      } else {
        return [{ ...msg, sessionTitle: activeSession?.title || "Saved Chat", savedAt: new Date().toISOString() }, ...prev];
      }
    });
  };

  const handleStartNewChat = () => {
    const newSession = createNewSession(user?.name);
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setCurrentView("chat");
  };

  const handleSelectSession = (sessionId) => {
    setActiveSessionId(sessionId);
    setCurrentView("chat");
  };

  const handleDeleteSession = (e, sessionId) => {
    e.stopPropagation();
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (filtered.length === 0) {
        const fresh = createNewSession(user?.name);
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleClearAllHistory = () => {
    const fresh = createNewSession(user?.name);
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
    setCurrentView("chat");
    if (user?.id && typeof window !== "undefined") {
      try {
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}${user.id}`);
      } catch (_) {}
    }
  };

  const handleDeleteParticularMessage = (messageId) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        return {
          ...s,
          messages: s.messages.filter((m) => m.id !== messageId),
        };
      })
    );
  };

  const handleSendMessage = async (textToSend = null) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || loading) return;

    const userMessageId = `user-${Date.now()}`;
    const userMsg = {
      id: userMessageId,
      role: "user",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: query,
    };

    let updatedTitle = activeSession?.title || "New Conversation";
    if (updatedTitle === "New Conversation") {
      updatedTitle = query.slice(0, 36) + (query.length > 36 ? "..." : "");
    }

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        return {
          ...s,
          title: updatedTitle,
          updatedAt: new Date().toISOString(),
          messages: [...(s.messages || []), userMsg],
        };
      })
    );

    setInputMessage("");
    setShowSlashMenu(false);
    setLoading(true);

    try {
      const response = await API.post("/assistant/chat", {
        message: query,
        tone: settings?.tone || "technical",
        pageContext: typeof window !== "undefined" ? window.location?.pathname || "/" : "/",
      });
      const data = response.data;

      const assistantMsg = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: data.message || "Here is what I found:",
        type: data.type,
        data: data.data,
        latencyMs: data.latencyMs,
        suggestions: data.suggestions || [],
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSessionId) return s;
          return {
            ...s,
            updatedAt: new Date().toISOString(),
            messages: [...(s.messages || []), assistantMsg],
          };
        })
      );
    } catch (err) {
      const errorMsg = {
        id: `error-${Date.now()}`,
        role: "assistant",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: `⚠️ **Error:** ${err.response?.data?.error || err.message || "Failed to process request."}`,
        suggestions: ["List my links", "How does bot detection work?", "Show pricing plans"],
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSessionId) return s;
          return {
            ...s,
            messages: [...(s.messages || []), errorMsg],
          };
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFormSubmit = async (e) => {
    e.preventDefault();
    if (!quickLongUrl.trim() || creatingQuickLink) return;

    setCreatingQuickLink(true);
    const command = quickSlug.trim()
      ? `shorten ${quickLongUrl.trim()} with alias ${quickSlug.trim()}`
      : `shorten ${quickLongUrl.trim()}`;

    setQuickLongUrl("");
    setQuickSlug("");
    setCreatingQuickLink(false);
    await handleSendMessage(command);
  };

  const copyToClipboard = async (text, id) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportChat = () => {
    const markdownContent = messages
      .map((m) => `### ${m.role === "user" ? "👤 User" : "🤖 pbUrls Assistant"} (${m.timestamp || ""})\n\n${m.text}\n`)
      .join("\n---\n\n");

    const blob = new Blob([markdownContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pburls-chat-${(activeSession?.title || "chat").replace(/[^a-z0-9]/gi, "_")}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFeedback = (msgId, type) => {
    setFeedbackGiven((prev) => ({ ...prev, [msgId]: type }));
  };

  const slashCommands = [
    { cmd: "/profile", desc: "View account info, security & 2FA status", example: "/profile" },
    { cmd: "/credits", desc: "View remaining short link credits & quota", example: "/credits" },
    { cmd: "/history", desc: "View short URL generation history", example: "/history" },
    { cmd: "/navigate", desc: "Get path & navigate to any page", example: "/navigate to custom domains" },
    { cmd: "/shorten", desc: "Shorten a destination URL", example: "/shorten https://stripe.com" },
    { cmd: "/qr", desc: "Generate a dynamic QR code", example: "/qr for my-link" },
    { cmd: "/analytics", desc: "Show top performing links", example: "/analytics" },
    { cmd: "/hygiene", desc: "Run a link health & broken link audit", example: "/hygiene" },
    { cmd: "/dns", desc: "How to configure custom domain CNAME", example: "/dns" },
    { cmd: "/plans", desc: "Show feature limits & pricing", example: "/plans" },
    { cmd: "/sync", desc: "Re-index dynamic knowledge base & live metrics", example: "/sync" },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-bold shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border border-white/30 cursor-pointer"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-400/30" />
          <Bot className="w-5 h-5 text-white group-hover:rotate-12 transition-transform" />
          <span className="text-xs font-black tracking-tight text-white drop-shadow flex items-center gap-1">
            <span>pb<span className="text-cyan-300 font-black">Urls</span></span>
            <span className="font-extrabold text-white/95">Assistant</span>
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] font-extrabold uppercase text-white shadow-sm">
            Live
          </span>
        </button>
      )}

      {/* Main Chat Drawer Window */}
      {isOpen && (
        <div
          className={`flex flex-col rounded-3xl shadow-2xl overflow-hidden transition-all duration-200 border ${
            isDark
              ? "bg-[#0B0F19] border-slate-700 shadow-black/95 text-slate-100"
              : "bg-white border-slate-300 shadow-slate-900/25 text-slate-900"
          } ${
            isExpanded
              ? "w-[94vw] sm:w-[820px] h-[88vh] max-h-[88vh]"
              : "w-[400px] sm:w-[490px] h-[650px] max-h-[85vh]"
          }`}
        >
          {/* Header Bar */}
          <div
            className={`p-3 border-b flex items-center justify-between shadow-sm ${
              isDark
                ? "bg-[#0F172A] border-slate-800 text-white"
                : "bg-slate-100 border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {/* History Button */}
              <button
                type="button"
                onClick={() => setCurrentView(currentView === "history" ? "chat" : "history")}
                className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 cursor-pointer font-bold text-xs ${
                  currentView === "history"
                    ? "bg-blue-600 text-white border-blue-600 shadow"
                    : isDark
                    ? "bg-slate-800 text-white hover:bg-slate-700 border-slate-700"
                    : "bg-white text-slate-800 hover:bg-slate-200 border-slate-300"
                }`}
                title="View Saved Conversations"
              >
                <History className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">History</span>
              </button>

              {/* Starred Button */}
              <button
                type="button"
                onClick={() => setCurrentView(currentView === "starred" ? "chat" : "starred")}
                className={`p-1.5 rounded-xl border transition flex items-center cursor-pointer font-bold ${
                  currentView === "starred"
                    ? "bg-amber-600 text-white border-amber-600 shadow"
                    : isDark
                    ? "bg-slate-800 text-slate-200 hover:text-amber-400 border-slate-700 hover:bg-slate-700"
                    : "bg-white text-slate-700 hover:text-amber-600 border-slate-300 hover:bg-slate-200"
                }`}
                title="Starred / Bookmarked Answers"
              >
                <Star className="w-3.5 h-3.5" />
              </button>

              {/* Instant 1-Click Dark/Bright Mode Toggle */}
              <button
                type="button"
                onClick={() => updateSetting("mode", isDark ? "bright" : "dark")}
                className={`p-1.5 rounded-xl border transition flex items-center cursor-pointer font-bold ${
                  isDark
                    ? "bg-slate-800 text-amber-300 hover:text-amber-200 border-slate-700 hover:bg-slate-700"
                    : "bg-white text-indigo-600 hover:text-indigo-800 border-slate-300 hover:bg-slate-200"
                }`}
                title={isDark ? "Switch to Bright / Light Mode" : "Switch to Dark Mode"}
              >
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>

              <div className="min-w-0 pl-1.5 flex flex-col justify-center">
                <div className="flex items-center gap-1">
                  <span className="font-black text-xs tracking-tight flex items-center leading-none">
                    <span className={isDark ? "text-white" : "text-slate-900"}>pb</span>
                    <span className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-500 bg-clip-text text-transparent font-black">Urls</span>
                    <span className="ml-1 px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-400 text-[10px] font-extrabold uppercase tracking-wider">
                      Assistant
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`text-[10px] font-bold truncate block max-w-[110px] sm:max-w-[150px] ${
                      isDark ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    {currentView === "chat" && (activeSession?.title || "Conversation")}
                    {currentView === "history" && "Saved Chats"}
                    {currentView === "starred" && `Starred (${starredMessages.length})`}
                  </span>
                  {user?.email && (
                    <span className="text-[9px] text-blue-400/80 font-mono font-medium truncate max-w-[90px] sm:max-w-[130px] hidden sm:inline">
                      • {user.name || user.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleStartNewChat}
                className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold transition cursor-pointer flex items-center gap-1 text-xs shadow"
                title="Start New Chat"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
              <button
                type="button"
                onClick={handleExportChat}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  isDark ? "hover:bg-slate-800 text-slate-400 hover:text-white" : "hover:bg-slate-200 text-slate-600 hover:text-slate-900"
                }`}
                title="Export as Markdown"
              >
                <FileDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className={`p-1.5 rounded-lg transition cursor-pointer hidden sm:flex ${
                  isDark ? "hover:bg-slate-800 text-slate-400 hover:text-white" : "hover:bg-slate-200 text-slate-600 hover:text-slate-900"
                }`}
                title={isExpanded ? "Collapse Window" : "Expand Window"}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  isDark ? "hover:bg-slate-800 text-slate-400 hover:text-white" : "hover:bg-slate-200 text-slate-600 hover:text-slate-900"
                }`}
                title="Close Assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* VIEW 1: STARRED / BOOKMARKS DRAWER */}
          {currentView === "starred" && (
            <div className={`flex-1 p-4 space-y-4 overflow-y-auto text-xs ${isDark ? "bg-[#0A0E17]" : "bg-slate-50"}`}>
              <div className={`flex items-center justify-between border-b pb-2 ${isDark ? "border-slate-800" : "border-slate-300"}`}>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className={`font-extrabold text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
                    Bookmarked Answers
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentView("chat")}
                  className={`px-3 py-1 rounded-xl font-bold text-xs cursor-pointer ${
                    isDark ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-white text-slate-800 border border-slate-300 hover:bg-slate-200"
                  }`}
                >
                  Back to Chat
                </button>
              </div>

              {starredMessages.length === 0 ? (
                <div className={`p-10 text-center text-xs rounded-2xl border space-y-1 ${
                  isDark ? "bg-[#111827] border-slate-800 text-slate-400" : "bg-white border-slate-300 text-slate-600"
                }`}>
                  <p className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>No bookmarked messages yet.</p>
                  <p className="text-[11px]">Click the Star (⭐) icon on any answer to save it here for quick access.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {starredMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-2xl border space-y-2 shadow-sm ${
                        isDark ? "bg-[#111827] border-slate-800" : "bg-white border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-amber-500 font-bold border-b pb-1.5 border-slate-200 dark:border-slate-800">
                        <span>Pinned from: {msg.sessionTitle}</span>
                        <button
                          type="button"
                          onClick={() => toggleStarMessage(msg)}
                          className="hover:text-rose-500 text-slate-400 transition cursor-pointer"
                          title="Remove bookmark"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className={`prose prose-xs line-clamp-4 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                        <ReactMarkdown>{typeof msg?.text === "string" ? msg.text : String(msg?.text || "")}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: SEARCHABLE CONVERSATION HISTORY */}
          {currentView === "history" && (
            <div className={`flex-1 flex flex-col p-4 space-y-4 overflow-y-auto ${isDark ? "bg-[#0A0E17]" : "bg-slate-50"}`}>
              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-blue-500" />
                <input
                  type="text"
                  placeholder="Search questions or keywords..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className={`w-full rounded-2xl pl-10 pr-10 py-2.5 text-xs font-semibold outline-none border focus:ring-1 focus:ring-blue-500 ${
                    isDark
                      ? "bg-[#111827] border-slate-700 text-white placeholder-slate-400 focus:border-blue-400"
                      : "bg-white border-slate-300 text-slate-900 placeholder-slate-500 focus:border-blue-500"
                  }`}
                />
                {historySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setHistorySearchQuery("")}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* History Header */}
              <div className={`flex items-center justify-between text-xs font-bold border-b pb-2 ${
                isDark ? "text-slate-300 border-slate-800" : "text-slate-700 border-slate-300"
              }`}>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span>Your Saved Chats ({filteredSessions.length})</span>
                </span>
                <button
                  type="button"
                  onClick={handleClearAllHistory}
                  className="text-rose-500 hover:text-rose-600 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                  title="Clear all saved history"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear All</span>
                </button>
              </div>

              {/* Conversation List */}
              <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                {filteredSessions.length === 0 ? (
                  <div className={`p-10 text-center text-xs rounded-2xl border ${
                    isDark ? "bg-[#111827] border-slate-800 text-slate-400" : "bg-white border-slate-300 text-slate-600"
                  }`}>
                    <p className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>No matching conversations found.</p>
                  </div>
                ) : (
                  filteredSessions.map((item) => {
                    const lastMessage = item.messages?.[item.messages.length - 1]?.text || "";
                    const previewText = lastMessage
                      .replace(/[#*`_]/g, "")
                      .replace(/\n+/g, " ")
                      .slice(0, 90);

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectSession(item.id)}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col gap-2 cursor-pointer group shadow-sm ${
                          item.id === activeSessionId
                            ? isDark
                              ? "bg-blue-950/40 border-blue-500/60 ring-1 ring-blue-500/30"
                              : "bg-blue-50 border-blue-400 ring-1 ring-blue-400/30"
                            : isDark
                            ? "bg-[#111827] hover:bg-[#1E293B] border-slate-800"
                            : "bg-white hover:bg-slate-100 border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <MessageSquare
                              className={`w-4 h-4 shrink-0 ${
                                item.id === activeSessionId ? "text-blue-500" : "text-slate-400"
                              }`}
                            />
                            <span className={`text-xs font-extrabold truncate ${
                              isDark ? "text-white group-hover:text-blue-300" : "text-slate-900 group-hover:text-blue-600"
                            }`}>
                              {item.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                              isDark ? "bg-slate-800 border-slate-700 text-sky-300" : "bg-slate-100 border-slate-300 text-blue-700"
                            }`}>
                              {item.messages?.length || 0} msgs
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSession(e, item.id)}
                              className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                              title="Delete this chat"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {previewText && (
                          <p className={`text-[11px] line-clamp-2 leading-relaxed pl-6 border-l-2 ${
                            isDark ? "text-slate-300 border-slate-700" : "text-slate-700 border-slate-300"
                          }`}>
                            {previewText}...
                          </p>
                        )}

                        <div className={`flex items-center justify-between text-[10px] pt-1 border-t ${
                          isDark ? "text-slate-400 border-slate-800" : "text-slate-500 border-slate-200"
                        }`}>
                          <span>
                            {new Date(item.updatedAt || item.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="text-blue-600 dark:text-blue-400 flex items-center gap-0.5 font-bold">
                            Open Chat <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* VIEW 3: ACTIVE CHAT STREAM */}
          {currentView === "chat" && (
            <>
              <div className={`flex-1 overflow-y-auto p-4 space-y-4 text-[13px] ${isDark ? "bg-[#0A0E17]" : "bg-slate-50"}`}>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col group ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    {/* Header with Avatar & Role */}
                    <div className={`flex items-center gap-1.5 mb-1 text-[10px] font-bold px-1 ${
                      isDark ? "text-slate-400" : "text-slate-600"
                    }`}>
                      {msg.role === "user" ? (
                        <>
                          <span className="text-blue-600 dark:text-blue-400 font-extrabold">You</span>
                          <User className="w-3 h-3 text-blue-500" />
                        </>
                      ) : (
                        <>
                          <Bot className="w-3.5 h-3.5 text-blue-500" />
                          <span className="font-extrabold tracking-tight text-xs flex items-center">
                            <span className={isDark ? "text-white" : "text-slate-900"}>pb</span>
                            <span className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-500 bg-clip-text text-transparent font-black">Urls</span>
                            <span className={`ml-1 font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>Assistant</span>
                          </span>
                          {msg.latencyMs && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-mono font-bold">
                              ⚡ {msg.latencyMs}ms
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <div
                      className={`relative max-w-[94%] p-4 rounded-2xl leading-relaxed shadow-md ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white rounded-tr-none shadow-blue-600/20"
                          : isDark
                          ? "bg-[#111827] border border-slate-700 text-slate-100 rounded-tl-none shadow-black/40"
                          : "bg-white border border-slate-200 text-slate-900 rounded-tl-none shadow-slate-200"
                      }`}
                    >
                      {/* Markdown Renderer with High Visibility Text */}
                      <div className={`prose prose-xs max-w-none space-y-2.5 ${
                        isDark ? "prose-invert text-slate-100" : "text-slate-900"
                      }
                        [&>h1]:text-sm [&>h1]:font-black [&>h1]:border-b [&>h1]:pb-1.5 [&>h1]:mb-2
                        [&>h2]:text-xs [&>h2]:font-extrabold [&>h2]:text-blue-600 dark:[&>h2]:text-sky-400 [&>h2]:mt-3 [&>h2]:mb-1
                        [&>h3]:text-xs [&>h3]:font-bold [&>h3]:text-indigo-600 dark:[&>h3]:text-cyan-300 [&>h3]:mt-2 [&>h3]:mb-1
                        [&>p]:leading-relaxed
                        [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:space-y-1.5
                        [&>ol]:list-decimal [&>ol]:pl-4 [&>ol]:space-y-1.5
                        [&>p>strong]:font-black
                        [&>p>code]:bg-slate-100 dark:[&>p>code]:bg-slate-950 [&>p>code]:text-emerald-600 dark:[&>p>code]:text-emerald-300 [&>p>code]:font-mono [&>p>code]:font-bold [&>p>code]:px-1.5 [&>p>code]:py-0.5 [&>p>code]:rounded-md [&>p>code]:border [&>p>code]:border-slate-300 dark:[&>p>code]:border-emerald-500/30 [&>p>code]:text-[11px]
                        [&>pre]:bg-slate-900 dark:[&>pre]:bg-slate-950 [&>pre]:p-3 [&>pre]:rounded-2xl [&>pre]:border [&>pre]:border-slate-700 [&>pre]:text-emerald-300 [&>pre]:overflow-x-auto`}>
                        <ReactMarkdown>{typeof msg?.text === "string" ? msg.text : String(msg?.text || "")}</ReactMarkdown>
                      </div>

                      {/* 1. Quick Link Creator Form */}
                      {msg.type === "PROMPT_CREATE_LINK" && (
                        <form
                          onSubmit={handleQuickFormSubmit}
                          className={`mt-3.5 p-4 rounded-2xl border space-y-3 shadow-inner ${
                            isDark ? "bg-slate-950 border-blue-500/40" : "bg-slate-50 border-blue-400"
                          }`}
                        >
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-extrabold text-blue-600 dark:text-blue-300 block tracking-wider">
                              Destination Long URL *
                            </label>
                            <input
                              type="url"
                              required
                              placeholder="https://example.com/my-page"
                              value={quickLongUrl}
                              onChange={(e) => setQuickLongUrl(e.target.value)}
                              className={`w-full rounded-xl px-3.5 py-2.5 text-xs font-semibold outline-none border focus:ring-1 focus:ring-blue-500 ${
                                isDark
                                  ? "bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-blue-400"
                                  : "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600"
                              }`}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className={`text-[10px] uppercase font-extrabold block tracking-wider ${
                              isDark ? "text-slate-300" : "text-slate-700"
                            }`}>
                              Custom Slug / Alias (Optional)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. my-product-2026"
                              value={quickSlug}
                              onChange={(e) => setQuickSlug(e.target.value)}
                              className={`w-full rounded-xl px-3.5 py-2.5 text-xs font-semibold outline-none border focus:ring-1 focus:ring-blue-500 ${
                                isDark
                                  ? "bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-blue-400"
                                  : "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600"
                              }`}
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={creatingQuickLink || !quickLongUrl.trim()}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-blue-600/30 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Shorten Link Now</span>
                          </button>
                        </form>
                      )}

                      {/* 2. Short Link Created Card */}
                      {msg.type === "ACTION_CREATE_LINK" && msg.data?.link && (
                        <div className={`mt-3.5 p-4 rounded-2xl border space-y-3 shadow-lg ${
                          isDark ? "bg-slate-950 border-emerald-500/40" : "bg-emerald-50/50 border-emerald-300"
                        }`}>
                          <div className={`flex items-center justify-between gap-2 border-b pb-2.5 ${
                            isDark ? "border-slate-800" : "border-emerald-200"
                          }`}>
                            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Ready to Share</span>
                            </div>
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold font-mono border border-emerald-500/30">
                              /{msg.data.link.shortCode}
                            </span>
                          </div>

                          <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 font-mono text-xs ${
                            isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
                          }`}>
                            <span className="font-bold truncate select-all">{msg.data.link.shortUrl}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(msg.data.link.shortUrl, msg.id)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-sans text-[11px] font-bold flex items-center gap-1.5 transition shrink-0 shadow cursor-pointer"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div className="text-[11px] truncate flex items-center gap-1">
                            <span className={`font-bold ${isDark ? "text-slate-400" : "text-slate-600"}`}>Target:</span>
                            <a
                              href={msg.data.link.longUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 dark:text-sky-400 hover:underline flex items-center gap-1 truncate font-medium"
                            >
                              <span className="truncate">{msg.data.link.longUrl}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          </div>
                        </div>
                      )}

                      {/* 3. Render QR Code Card */}
                      {msg.type === "ACTION_QR_CODE" && msg.data?.qrDataUrl && (
                        <div className={`mt-3.5 p-4 rounded-2xl border flex flex-col items-center space-y-3 shadow-lg ${
                          isDark ? "bg-slate-950 border-slate-700" : "bg-slate-50 border-slate-300"
                        }`}>
                          <div className="p-2 bg-white rounded-2xl shadow-md border border-slate-200">
                            <img src={msg.data.qrDataUrl} alt="QR Code" className="w-36 h-36" />
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={msg.data.qrDataUrl}
                              download={`pburls-qr-${msg.data.shortCode}.png`}
                              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition shadow cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download PNG</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(msg.data.qrDataUrl, `qr-${msg.id}`)}
                              className={`px-3.5 py-2 rounded-xl font-bold text-[11px] flex items-center gap-1.5 border transition cursor-pointer ${
                                isDark
                                  ? "bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700"
                                  : "bg-white hover:bg-slate-100 text-slate-800 border-slate-300"
                              }`}
                            >
                              {copiedId === `qr-${msg.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>{copiedId === `qr-${msg.id}` ? "Copied Data URL" : "Copy Image"}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 4. Render Top Links Card */}
                      {msg.type === "ACTION_TOP_LINKS" && msg.data?.topLinks && (
                        <div className="mt-3.5 space-y-2">
                          {msg.data.topLinks.map((item, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl border flex items-center justify-between transition ${
                                isDark
                                  ? "bg-slate-950 border-slate-700 hover:border-slate-600"
                                  : "bg-slate-50 border-slate-300 hover:border-slate-400"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                                  {idx + 1}
                                </span>
                                <span className={`font-mono text-xs font-bold truncate ${
                                  isDark ? "text-white" : "text-slate-900"
                                }`}>
                                  /{item.short_code}
                                </span>
                              </div>
                              <span className="text-[10px] px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 font-extrabold shrink-0 border border-blue-500/30">
                                {item.click_count} clicks
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 5. Render List Links Card */}
                      {msg.type === "ACTION_LIST_LINKS" && msg.data?.links && (
                        <div className="mt-3.5 space-y-2">
                          {msg.data.links.map((item, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl border flex items-center justify-between transition ${
                                isDark
                                  ? "bg-slate-950 border-slate-700 hover:border-slate-600"
                                  : "bg-slate-50 border-slate-300 hover:border-slate-400"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <LinkIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className={`font-mono text-xs font-bold truncate ${
                                  isDark ? "text-white" : "text-slate-900"
                                }`}>
                                  /{item.shortCode || item.short_code}
                                </span>
                              </div>
                              <span className={`text-[11px] font-medium shrink-0 ${
                                isDark ? "text-slate-300" : "text-slate-600"
                              }`}>
                                {item.clicksCount || 0} clicks
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 6. Render Link Hygiene Card */}
                      {msg.type === "ACTION_HYGIENE_REPORT" && msg.data && (
                        <div className={`mt-3.5 p-3.5 rounded-2xl border space-y-2.5 ${
                          isDark ? "bg-slate-950 border-slate-700" : "bg-slate-50 border-slate-300"
                        }`}>
                          <div className="grid grid-cols-2 gap-2.5 text-center text-xs">
                            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                              <span className="block font-black text-lg">{msg.data.healthyCount}</span>
                              <span className="font-bold text-[11px]">Healthy Links</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300">
                              <span className="block font-black text-lg">{msg.data.failingCount}</span>
                              <span className="font-bold text-[11px]">Issues Detected</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 7. Knowledge RAG Source Footer */}
                      {msg.type === "KNOWLEDGE_RAG" && msg.data?.articleTitle && (
                        <div className={`mt-3.5 pt-2.5 border-t flex items-center justify-between text-[11px] ${
                          isDark ? "border-slate-700 text-sky-400" : "border-slate-200 text-blue-700"
                        }`}>
                          <div className="flex items-center gap-1.5 min-w-0 pr-2">
                            <BookOpen className="w-3.5 h-3.5 shrink-0" />
                            <span className="font-bold truncate">{msg.data.articleTitle}</span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-[9px] font-extrabold uppercase text-blue-700 dark:text-blue-200 shrink-0">
                            {msg.data.topic || "Knowledge"}
                          </span>
                        </div>
                      )}

                      {/* 8. Navigation Guidance Action Card */}
                      {msg.type === "ACTION_NAVIGATE" && msg.data?.targetPath && (
                        <div className={`mt-3.5 p-4 rounded-2xl border space-y-3 shadow-lg ${
                          isDark ? "bg-slate-950 border-blue-500/40" : "bg-blue-50/70 border-blue-300"
                        }`}>
                          <div className={`flex items-center justify-between gap-2 border-b pb-2 ${
                            isDark ? "border-slate-800" : "border-blue-200"
                          }`}>
                            <div className="flex items-center gap-1.5 text-blue-600 dark:text-cyan-400 font-extrabold text-xs">
                              <ArrowRight className="w-4 h-4" />
                              <span>Navigation Route Ready</span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-cyan-300 font-mono font-bold border border-blue-500/30">
                              {msg.data.targetPath}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (msg.data.targetPath) {
                                navigate(msg.data.targetPath);
                                setIsOpen(false);
                              }
                            }}
                            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>🚀 Jump to {msg.data.targetName || msg.data.targetPath} Now</span>
                          </button>
                        </div>
                      )}

                      {/* 9. Subscription & Credit Progress Bar Card */}
                      {msg.type === "ACTION_CREDITS_TELEMETRY" && msg.data && (
                        <div className={`mt-3.5 p-4 rounded-2xl border space-y-3 shadow-lg ${
                          isDark ? "bg-slate-950 border-slate-700" : "bg-slate-50 border-slate-300"
                        }`}>
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className={isDark ? "text-slate-200" : "text-slate-800"}>Link Credits Usage</span>
                            <span className="text-blue-500 font-extrabold">{msg.data.usedPercent}% Used</span>
                          </div>
                          <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden p-0.5 border border-slate-300 dark:border-slate-700">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                              style={{ width: `${Math.min(100, msg.data.usedPercent || 0)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
                            <span>{msg.data.activeUrlsCount} / {msg.data.maxUrls} Short Links Used</span>
                            <span className="text-emerald-500 font-extrabold">{msg.data.remainingCredits} Credits Remaining</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Message Action Bar */}
                    <div className={`flex items-center gap-2.5 mt-1.5 px-2 text-[11px] font-medium ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}>
                      <span>{msg.timestamp || ""}</span>

                      {msg.role === "assistant" && (
                        <>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(msg.text, `text-${msg.id}`)}
                            className="hover:text-blue-600 dark:hover:text-white transition cursor-pointer flex items-center gap-1"
                            title="Copy response text"
                          >
                            {copiedId === `text-${msg.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSpeechReadout(msg.id, msg.text)}
                            className={`hover:text-blue-600 dark:hover:text-white transition cursor-pointer ${
                              speakingMsgId === msg.id ? "text-blue-500 animate-pulse" : ""
                            }`}
                            title={speakingMsgId === msg.id ? "Stop voice readout" : "Listen to answer"}
                          >
                            {speakingMsgId === msg.id ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleStarMessage(msg)}
                            className={`hover:text-amber-500 transition cursor-pointer ${
                              starredMessages.some((item) => item.id === msg.id) ? "text-amber-500 fill-amber-500" : ""
                            }`}
                            title="Star / Bookmark answer"
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFeedback(msg.id, "up")}
                            className={`hover:text-blue-600 dark:hover:text-white transition cursor-pointer ${
                              feedbackGiven[msg.id] === "up" ? "text-emerald-500" : ""
                            }`}
                            title="Good response"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFeedback(msg.id, "down")}
                            className={`hover:text-blue-600 dark:hover:text-white transition cursor-pointer ${
                              feedbackGiven[msg.id] === "down" ? "text-rose-500" : ""
                            }`}
                            title="Poor response"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {/* Delete Particular Message Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteParticularMessage(msg.id)}
                        className="hover:text-rose-500 transition cursor-pointer opacity-0 group-hover:opacity-100"
                        title="Delete this message"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Suggestions Pills */}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-2 max-w-[96%]">
                        {msg.suggestions.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => handleSendMessage(sug)}
                            className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95 ${
                              isDark
                                ? "bg-slate-800 hover:bg-blue-600 border-slate-700 text-slate-100 hover:text-white"
                                : "bg-white hover:bg-blue-600 border-slate-300 text-slate-800 hover:text-white shadow-slate-200"
                            }`}
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className={`flex items-center gap-2.5 text-xs p-3 rounded-2xl border animate-pulse ${
                    isDark ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-white border-slate-300 text-slate-700"
                  }`}>
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    <span className="font-bold flex items-center gap-1.5">
                      <span>pb<span className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-500 bg-clip-text text-transparent font-black">Urls</span> Assistant</span>
                      <span className={isDark ? "text-slate-400" : "text-slate-500"}>thinking &amp; executing...</span>
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Slash Command Helper Menu */}
              {showSlashMenu && (
                <div className={`p-2 border-t space-y-1 ${
                  isDark ? "bg-[#0F172A] border-slate-800" : "bg-slate-100 border-slate-300"
                }`}>
                  <div className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}>
                    Quick Slash Commands (Type or Click):
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {slashCommands.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setInputMessage(item.example);
                          setShowSlashMenu(false);
                        }}
                        className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                          isDark
                            ? "bg-slate-900 hover:bg-blue-600 border-slate-800 text-white"
                            : "bg-white hover:bg-blue-600 hover:text-white border-slate-300 text-slate-900"
                        }`}
                      >
                        <span className="font-mono font-bold text-blue-500 block text-xs">{item.cmd}</span>
                        <span className="text-[10px] block truncate opacity-80">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Listening Active Bar */}
              {isListening && (
                <div className="px-4 py-2 bg-rose-500/10 border-t border-rose-500/20 flex items-center justify-between text-xs text-rose-500 font-semibold animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                    </span>
                    <span>🎙️ Listening live... Speak into your microphone.</span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    className="text-[10px] uppercase font-bold underline cursor-pointer hover:text-rose-400"
                  >
                    Stop
                  </button>
                </div>
              )}

              {/* Mic Error Notification */}
              {micError && (
                <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 flex items-center justify-between text-xs text-amber-500 font-semibold">
                  <span className="truncate pr-2">⚠️ {micError}</span>
                  <button
                    type="button"
                    onClick={() => setMicError(null)}
                    className="text-[10px] font-bold text-amber-500 hover:text-amber-400 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Chat Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className={`p-3 border-t flex items-center gap-2 ${
                  isDark ? "bg-[#0F172A] border-slate-800" : "bg-slate-100 border-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={`p-2.5 rounded-2xl transition cursor-pointer shrink-0 ${
                    isListening
                      ? "bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/40"
                      : isDark
                      ? "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
                      : "bg-white hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300"
                  }`}
                  title={isListening ? "Stop listening" : "Voice input (Speech-to-Text)"}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-blue-500" />}
                </button>

                <input
                  type="text"
                  placeholder="Ask anything, type '/shorten', '/dns', or speak..."
                  value={inputMessage}
                  onChange={(e) => {
                    setInputMessage(e.target.value);
                    if (e.target.value.startsWith("/")) {
                      setShowSlashMenu(true);
                    } else {
                      setShowSlashMenu(false);
                    }
                  }}
                  disabled={loading}
                  className={`flex-1 rounded-2xl px-4 py-2.5 text-xs font-semibold outline-none border focus:ring-1 focus:ring-blue-500 ${
                    isDark
                      ? "bg-[#111827] border-slate-700 text-white placeholder-slate-400 focus:border-blue-400"
                      : "bg-white border-slate-300 text-slate-900 placeholder-slate-500 focus:border-blue-600"
                  }`}
                />

                <button
                  type="submit"
                  disabled={loading || !inputMessage.trim()}
                  className="p-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition cursor-pointer shrink-0 shadow-lg shadow-blue-600/30"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}

class AiAssistantErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[AiAssistantWidget] Error boundary caught rendering crash:", error, errorInfo);
  }

  handleReset = () => {
    try {
      if (typeof window !== "undefined") {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes("pburls_ai") || key.includes("SETTINGS_KEY"))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      }
    } catch (_) {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 border border-slate-700 text-white shadow-2xl max-w-sm text-xs space-y-2.5">
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <Bot className="w-5 h-5 text-amber-400" />
            <span>AI Assistant Recovery</span>
          </div>
          <p className="text-slate-300">
            An unexpected error occurred while rendering the assistant. Click below to reset state.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition cursor-pointer"
          >
            Reset Assistant & Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function SafeAiAssistantWidget(props) {
  return (
    <AiAssistantErrorBoundary>
      <AiAssistantWidget {...props} />
    </AiAssistantErrorBoundary>
  );
}
