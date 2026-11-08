"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { AlertCircle, ArrowDownToLine, ArrowRight, ArrowUp, ArrowUpRight, AudioLines, Bookmark, Check, ChevronDown, ChevronRight, CircleHelp, Code2, Compass, Copy, Download, FileText, Globe2, Lightbulb, LoaderCircle, LockKeyhole, LogIn, Menu, MessageCircle, Mic, Moon, MoreHorizontal, PanelLeft, Pencil, Plus, Search, Settings2, ShieldCheck, Shuffle, Smartphone, Sparkles, Square, Sun, Trash2, Volume2, WandSparkles, X, Zap } from "lucide-react";
import { AmbientBackground } from "@/components/ambient-background";
import { Brand, BrandMark } from "@/components/brand";
import { ChatMarkdown } from "@/components/chat-markdown";
import { AboutDialog, AuthDialog, InstallDialog, LibraryDialog, ModelsDialog, SearchDialog, SettingsDialog, type Theme } from "@/components/dialogs";
import { Modal } from "@/components/modal";
import { api, downloadText } from "@/lib/client";
import { MODELS, PROMPTS, type Conversation, type Message, type ModelId, type User } from "@/lib/types";

type Dialog = "auth" | "register" | "models" | "library" | "search" | "settings" | "install" | "about" | null;
interface InstallPrompt extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
type Recognition = { lang: string; interimResults: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };

export function ChatWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [model, setModel] = useState<ModelId>("farhan");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [booted, setBooted] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [modelMenu, setModelMenu] = useState(false);
  const [chatMenu, setChatMenu] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [banner, setBanner] = useState(true);
  const [theme, setTheme] = useState<Theme>("dark");
  const [animated, setAnimated] = useState(true);
  const [instructions, setInstructions] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [deepThink, setDeepThink] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [shuffleOffset, setShuffleOffset] = useState(0);
  const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [rename, setRename] = useState<Conversation | null>(null);
  const [renaming, setRenaming] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const installPrompt = useRef<InstallPrompt | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatLoad = useRef(0);
  const selectedModel = MODELS.find(m => m.id === model) ?? MODELS[0];
  const current = conversations.find(c => c.id === activeId);
  const closeDialog = useCallback(() => setDialog(null), []);
  const notify = useCallback((message: string) => { setToast(message); if (toastTimeout.current) clearTimeout(toastTimeout.current); toastTimeout.current = setTimeout(() => setToast(""), 4500); }, []);

  const refresh = useCallback(async () => {
    const result = await api<{ user: User | null; conversations: Conversation[] }>("/api/bootstrap");
    setUser(result.user); setConversations(result.conversations);
  }, []);

  useEffect(() => {
    refresh().catch(() => setError("We couldn’t connect to your workspace. Please refresh to try again.")).finally(() => setBooted(true));
    try {
      const storedTheme = localStorage.getItem("fg_theme");
      if (storedTheme === "dark" || storedTheme === "light" || storedTheme === "system") setTheme(storedTheme);
      setBanner(localStorage.getItem("fg_banner_dismissed") !== "true");
      setAnimated(localStorage.getItem("fg_animated") !== "false");
      setInstructions(localStorage.getItem("fg_instructions") ?? "");
      const bookmarks: unknown = JSON.parse(localStorage.getItem("fg_saved") ?? "[]");
      if (Array.isArray(bookmarks)) setSaved(bookmarks.filter((v): v is string => typeof v === "string"));
    } catch { /* Storage may be disabled in a private browser. */ }
    const beforeInstall = (event: Event) => { event.preventDefault(); installPrompt.current = event as InstallPrompt; };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => { window.removeEventListener("beforeinstallprompt", beforeInstall); abort.current?.abort(); recognition.current?.stop(); if (toastTimeout.current) clearTimeout(toastTimeout.current); };
  }, [refresh]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.theme = theme === "system" ? media.matches ? "dark" : "light" : theme; };
    apply(); media.addEventListener("change", apply);
    try { localStorage.setItem("fg_theme", theme); } catch {}
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => { document.documentElement.dataset.animations = animated ? "on" : "off"; try { localStorage.setItem("fg_animated", String(animated)); } catch {} }, [animated]);
  useEffect(() => { if (textarea.current) { textarea.current.style.height = "auto"; textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 150)}px`; } }, [input]);
  useEffect(() => { const element = scrollArea.current; if (element && messages.length) element.scrollTo({ top: element.scrollHeight, behavior: busy ? "instant" : "smooth" }); }, [messages, busy]);
  useEffect(() => { const dismiss = (event: MouseEvent) => { if (!(event.target as HTMLElement).closest("[data-popover]")) { setModelMenu(false); setChatMenu(null); } }; document.addEventListener("click", dismiss); return () => document.removeEventListener("click", dismiss); }, []);

  const newChat = useCallback(() => {
    abort.current?.abort(); chatLoad.current++; setActiveId(null); setMessages([]); setInput(""); setAttachment(null); setError(""); setLoadingChat(false); setMobileOpen(false); setChatMenu(null); setTimeout(() => textarea.current?.focus(), 50);
  }, []);
  useEffect(() => { const shortcuts = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setDialog("search"); } if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "o") { e.preventDefault(); newChat(); } if (e.key === "Escape") { setMobileOpen(false); setModelMenu(false); setChatMenu(null); } }; window.addEventListener("keydown", shortcuts); return () => window.removeEventListener("keydown", shortcuts); }, [newChat]);

  async function openConversation(id: string) {
    abort.current?.abort(); const load = ++chatLoad.current; setLoadingChat(true); setMobileOpen(false); setError(""); setInput(""); setAttachment(null);
    try { const result = await api<{ conversation: Conversation; messages: Message[] }>(`/api/conversations/${id}`); if (chatLoad.current !== load) return; setActiveId(id); setMessages(result.messages); setModel(MODELS.some(m => m.id === result.conversation.model) ? result.conversation.model as ModelId : "farhan"); }
    catch (e) { if (chatLoad.current === load) notify(e instanceof Error ? e.message : "Could not load this conversation."); }
    finally { if (chatLoad.current === load) setLoadingChat(false); }
  }
  function usePrompt(prompt: string) { setInput(prompt); setMobileOpen(false); setTimeout(() => { textarea.current?.focus(); textarea.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, 80); }
  function savePrompt(id: string) { setSaved(previous => { const next = previous.includes(id) ? previous.filter(v => v !== id) : [...previous, id]; try { localStorage.setItem("fg_saved", JSON.stringify(next)); } catch {} return next; }); }
  function changeInstructions(text: string) { setInstructions(text); try { localStorage.setItem("fg_instructions", text); } catch {} }
  function chooseModel(id: ModelId) { setModel(id); setModelMenu(false); notify(`${MODELS.find(m => m.id === id)?.name} is ready for your next message.`); }
  async function installApp() { if (!installPrompt.current) return false; try { await installPrompt.current.prompt(); const result = await installPrompt.current.userChoice; installPrompt.current = null; if (result.outcome === "accepted") notify("Welcome to your new home screen."); return true; } catch { return false; } }
  async function authenticated(account: User) { setUser(account); closeDialog(); notify(`Welcome${account.name ? `, ${account.name.split(" ")[0]}` : ""}. Make yourself at home.`); await refresh().catch(() => {}); }
  function loggedOut() { closeDialog(); setUser(null); newChat(); setConversations([]); refresh().catch(() => {}); }
  async function exportConversation(conversation?: Conversation) {
    const chat = conversation ?? current;
    if (!chat) return;
    try { const data = chat.id === activeId ? messages : (await api<{ messages: Message[] }>(`/api/conversations/${chat.id}`)).messages; downloadText(`FarhanGPT-${chat.title.replace(/[^a-z0-9 -]/gi, "").slice(0, 45) || "conversation"}.md`, `# ${chat.title}\n\nExported from FarhanGPT\n\n` + data.map(m => `## ${m.role === "user" ? "You" : "FarhanGPT"}\n\n${m.content}`).join("\n\n---\n\n")); notify("Your conversation is downloaded."); } catch (e) { notify(e instanceof Error ? e.message : "Could not export conversation."); }
  }
  async function deleteConversation(chat: Conversation) {
    setChatMenu(null); if (!window.confirm(`Delete “${chat.title}”? This cannot be undone.`)) return;
    try { await api(`/api/conversations/${chat.id}`, { method: "DELETE" }); if (activeId === chat.id) newChat(); await refresh(); notify("Conversation deleted."); } catch (e) { notify(e instanceof Error ? e.message : "Could not delete conversation."); }
  }
  async function renameConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!rename) return; const data = new FormData(event.currentTarget); setRenaming(true);
    try { await api(`/api/conversations/${rename.id}`, { method: "PATCH", body: JSON.stringify({ title: data.get("title") }) }); setRename(null); await refresh(); notify("A fresh name for a good idea."); } catch (e) { notify(e instanceof Error ? e.message : "Could not rename conversation."); } finally { setRenaming(false); }
  }
  async function copyMessage(content: string) { try { await navigator.clipboard.writeText(content); notify("Copied. Take that good idea with you."); } catch { notify("Copy is unavailable in this browser. You can select the text instead."); } }
  function speak(content: string) { if (!("speechSynthesis" in window)) { notify("Read aloud is not available in this browser."); return; } window.speechSynthesis.cancel(); const speech = new SpeechSynthesisUtterance(content.replace(/[#*`]/g, "")); speech.rate = 1; window.speechSynthesis.speak(speech); notify("Reading aloud. Click again to restart."); }
  function startVoice() {
    if (recording) { recognition.current?.stop(); setRecording(false); return; }
    const browser = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) { notify("Voice input works in Chrome and Edge. You can also use your keyboard’s microphone."); return; }
    const instance = new Constructor(); instance.lang = navigator.language || "en-US"; instance.interimResults = false;
    instance.onresult = event => { const text = event.results[0]?.[0]?.transcript; if (text) setInput(previous => `${previous}${previous ? " " : ""}${text}`); };
    instance.onend = () => setRecording(false); instance.onerror = () => { setRecording(false); notify("Microphone unavailable. Check your browser’s microphone permission."); }; recognition.current = instance;
    try { instance.start(); setRecording(true); } catch { setRecording(false); notify("Could not start the microphone. Please try again."); }
  }
  async function attachFile(file?: File) {
    if (!file) return;
    if (file.size > 128000) { notify("Choose a text or code file smaller than 128 KB."); return; }
    if (!/\.(txt|md|csv|json|js|jsx|ts|tsx|py|html|css|log|xml|yaml|yml|sql)$/i.test(file.name)) { notify("Text and code files are supported: TXT, MD, CSV, JSON, JS, TS, PY, and more."); return; }
    try { const content = await file.text(); if (content.length > 22000) { notify("This file is a little long. Please keep it under 22,000 characters."); return; } setAttachment({ name: file.name, content }); textarea.current?.focus(); } catch { notify("Could not read this file. Please try another one."); }
    if (fileInput.current) fileInput.current.value = "";
  }
  async function send() {
    if (busy || !booted || (!input.trim() && !attachment)) return;
    const text = `${input.trim() || "Please help me understand this file."}${attachment ? `\n\n[Attached file: ${attachment.name}]\n${attachment.content}` : ""}`;
    if (text.length > 30000) { notify("Your message and attachment together must be under 30,000 characters."); return; }
    const assistantId = crypto.randomUUID(); const controller = new AbortController(); abort.current = controller;
    setMessages(previous => [...previous, { id: crypto.randomUUID(), role: "user", content: text }, { id: assistantId, role: "assistant", content: "" }]);
    setInput(""); setAttachment(null); setBusy(true); setError(""); setModelMenu(false);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: activeId, model, message: text, deepThink, webSearch, instructions }), signal: controller.signal });
      if (!response.ok) { const result = await response.json(); if (result.conversationId) setActiveId(result.conversationId); throw new Error(result.error || "The AI couldn’t connect. Please try again."); }
      if (!response.body) throw new Error("Streaming isn’t available. Please refresh and try again.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) { if (!line.trim()) continue; const event = JSON.parse(line); if (event.type === "meta") setActiveId(event.conversationId); if (event.type === "delta") setMessages(previous => previous.map(m => m.id === assistantId ? { ...m, content: m.content + event.content } : m)); if (event.type === "error") setError(event.error); }
      }
    } catch (e) { if (!(e instanceof Error && e.name === "AbortError")) setError(e instanceof Error ? e.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); setMessages(previous => previous.filter(m => m.id !== assistantId || Boolean(m.content))); await refresh().catch(() => {}); textarea.current?.focus(); }
  }

  const cardCategories = [{ name: "Writing", icon: WandSparkles, title: "Write & create" }, { name: "Coding", icon: Code2, title: "Code smarter" }, { name: "Learning", icon: Lightbulb, title: "Learn anything" }, { name: "Everyday", icon: Compass, title: "Explore ideas" }];
  const isWelcome = messages.length === 0 && !loadingChat;

  return <div className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"} ${mobileOpen ? "mobile-sidebar-open" : ""}`}>
    {mobileOpen && <button className="sidebar-overlay" aria-label="Dismiss navigation overlay" onClick={() => setMobileOpen(false)} />}
    <aside className="sidebar" aria-label="Main navigation"><div className="sidebar-brand"><button onClick={newChat} aria-label="FarhanGPT home"><Brand /></button><button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={19} /></button></div>
      <div className="sidebar-navigation"><button className="new-chat-button" onClick={newChat}><Plus size={18} /><span>New conversation</span><span className="new-chat-shortcut">↗</span></button><button className="nav-button search-nav" onClick={() => setDialog("search")}><Search size={17} /><span>Search conversations</span><kbd>⌘ K</kbd></button><button className="nav-button" onClick={() => setDialog("library")}><Bookmark size={17} /><span>Prompt library</span><span className="nav-count">12</span></button><button className="nav-button" onClick={() => setDialog("models")}><Sparkles size={17} /><span>Explore models</span><span className="new-badge">NEW</span></button></div>
      <div className="sidebar-history"><div className="sidebar-section-label"><span>YOUR CONVERSATIONS</span><button className="icon-button" title="New conversation" onClick={newChat} aria-label="New conversation"><Plus size={14} /></button></div>{conversations.length ? <div className="conversation-list">{conversations.map(c => <div className={`history-item ${c.id === activeId ? "active" : ""}`} key={c.id} data-popover><button className="history-title" onClick={() => openConversation(c.id)} title={c.title}><MessageCircle size={14} /><span>{c.title}</span></button><button className="history-more icon-button" aria-label={`Options for ${c.title}`} onClick={() => setChatMenu(chatMenu === c.id ? null : c.id)}><MoreHorizontal size={16} /></button>{chatMenu === c.id && <div className="history-popover"><button onClick={() => { setRename(c); setChatMenu(null); }}><Pencil size={14} />Rename</button><button onClick={() => { exportConversation(c); setChatMenu(null); }}><Download size={14} />Export</button><button className="danger-text" onClick={() => deleteConversation(c)}><Trash2 size={14} />Delete</button></div>}</div>)}</div> : <div className="history-empty"><span className="empty-chat-icon"><MessageCircle size={19} /><span>✧</span></span><p>A fresh start.<br /><span>A world of possibilities.</span></p></div>}
        {!conversations.length && <div className="sidebar-inspiration"><div className="sidebar-section-label"><span>A LITTLE INSPIRATION</span></div><button onClick={() => usePrompt(PROMPTS[1].prompt)}><Code2 size={15} /><span>Build something amazing</span><ArrowUpRight size={12} /></button><button onClick={() => usePrompt(PROMPTS[3].prompt)}><Lightbulb size={15} /><span>Find my next big idea</span><ArrowUpRight size={12} /></button><button onClick={() => usePrompt(PROMPTS[7].prompt)}><Compass size={15} /><span>Make everyday easier</span><ArrowUpRight size={12} /></button></div>}
      </div>
      <div className="sidebar-bottom"><div className="sidebar-app-card"><div className="app-card-title"><span><Sparkles size={17} /></span>Good ideas travel.</div><p>Your favorite thinking partner.<br />Now a little closer to hand.</p><button onClick={() => setDialog("install")}><Smartphone size={14} /><span>Get the mobile app</span><ArrowUpRight size={14} /></button><span className="app-card-decoration" aria-hidden="true">✦</span></div><div className="sidebar-utilities"><button onClick={() => setDialog("settings")}><Settings2 size={16} /><span>Settings</span></button><button className="icon-button" onClick={() => setDialog("about")} title="About FarhanGPT" aria-label="About and help"><CircleHelp size={17} /></button></div><button className="profile-button" onClick={() => setDialog(user ? "settings" : "register")}><span className="avatar">{user ? user.name.charAt(0).toUpperCase() : "F"}</span><span className="profile-text"><strong>{user ? user.name : "Your personal space"}</strong><span>{user ? "Personal workspace" : "Sign in to make it yours"}</span></span><ChevronRight size={15} /></button></div>
    </aside>
    <main className="main-column"><AmbientBackground animated={animated} />
      {banner && <div className="announcement"><div className="announcement-message"><span className="announcement-icon"><Smartphone size={14} /></span><span><strong>Your AI, on the go.</strong><span className="announcement-extra"> Take a little brilliance with you.</span></span><button onClick={() => setDialog("install")}>Get the app<ArrowUpRight size={13} /></button></div><button className="announcement-close" aria-label="Dismiss app announcement" onClick={() => { setBanner(false); try { localStorage.setItem("fg_banner_dismissed", "true"); } catch {} }}><X size={15} /></button></div>}
      <header className="workspace-header"><div className="header-left"><button className="icon-button sidebar-toggle" title="Toggle navigation" aria-label="Toggle navigation" onClick={() => { if (window.innerWidth <= 860) setMobileOpen(!mobileOpen); else setSidebarOpen(!sidebarOpen); }}><PanelLeft size={19} /></button><span className="header-divider" /><button className="header-brand" onClick={() => setDialog("models")}>FarhanGPT<ChevronDown size={14} /></button><span className="workspace-tag">Personal</span></div><div className="header-right"><button className="whats-new" onClick={() => setDialog("about")}><span />What’s new</button><button className="icon-button theme-toggle" onClick={() => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")} title="Switch color theme" aria-label="Switch color theme">{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button><span className="header-divider" />{user ? <button className="header-account" onClick={() => setDialog("settings")}><span className="avatar small">{user.name.charAt(0).toUpperCase()}</span><span>{user.name.split(" ")[0]}</span></button> : <button className="sign-in-button" disabled={!booted} onClick={() => setDialog("auth")}><LogIn size={15} /><span>Sign in</span></button>}</div></header>
      <div className={`workspace-scroll ${isWelcome ? "welcome-scroll" : "has-messages"}`} ref={scrollArea}>
        {loadingChat ? <div className="chat-loading"><LoaderCircle size={24} className="spin" /><span>Picking up where you left off…</span></div> : isWelcome ? <section className="welcome-content"><div className="welcome-hero"><div className="hero-art"><div className="hero-orbit" /><Image src="/images/farhan-orb.png" alt="Luminous violet glass orbit" width={256} height={256} priority className="hero-orb" /><span className="hero-star star-one">✧</span><span className="hero-star star-two">✦</span><span className="hero-star star-three">✧</span></div><div className="hero-eyebrow"><span />YOUR EVERYDAY AI, REIMAGINED</div><h1>A little curiosity.<br /><span>Endless possibilities.</span></h1><p>A fresh perspective. A helping hand. Your next big idea.<br className="desktop-break" /> Whatever’s on your mind, let’s make something of it.</p></div><div className="suggestions-section"><div className="suggestions-heading"><span><Sparkles size={13} />A little inspiration to get you started</span><button onClick={() => setShuffleOffset(previous => previous + 1)} title="Show different prompts"><Shuffle size={13} /><span>Shuffle ideas</span></button></div><div className="suggestion-grid">{cardCategories.map(category => { const choices = PROMPTS.filter(p => p.category === category.name); const prompt = choices[shuffleOffset % choices.length]; const Icon = category.icon; return <button className={`suggestion-card category-${category.name.toLowerCase()}`} key={category.name} onClick={() => usePrompt(prompt.prompt)}><div className="suggestion-top"><span className="category-icon"><Icon size={19} /></span><ArrowUpRight size={15} className="suggestion-arrow" /></div><h2>{category.title}</h2><p>{shuffleOffset === 0 ? category.name === "Writing" ? "Find the words.\nTell your story." : category.name === "Coding" ? "Build, debug, and bring\nyour ideas to life." : category.name === "Learning" ? "Big questions.\nLightbulb moments." : "A fresh spark for\nsomething extraordinary." : prompt.description}</p></button>; })}</div></div></section> : <section className="conversation-content" aria-label="Conversation"><div className="conversation-heading"><span><MessageCircle size={14} />{current?.title ?? "A new conversation"}</span><button className="icon-button" title="Export conversation" aria-label="Export conversation" onClick={() => exportConversation()}><ArrowDownToLine size={16} /></button></div>{messages.map((message, index) => <article key={message.id} className={`chat-message ${message.role}`}><div className={`message-avatar ${message.role === "assistant" ? "ai-avatar" : ""}`}>{message.role === "assistant" ? <BrandMark size={21} /> : (user?.name.charAt(0) ?? "Y").toUpperCase()}</div><div className="message-body"><div className="message-author">{message.role === "user" ? "You" : "FarhanGPT"}{message.role === "assistant" && <span>{selectedModel.id === "farhan" ? "Your AI companion" : selectedModel.name}</span>}</div>{message.content ? message.role === "assistant" ? <ChatMarkdown content={message.content} /> : <div className="user-message-content">{message.content}</div> : <div className="thinking-indicator" aria-label="Thinking"><span /><span /><span /><span className="thinking-text">A little thought, a little magic…</span></div>}{message.role === "assistant" && message.content && (!busy || index !== messages.length - 1) && <div className="response-actions"><button title="Copy response" aria-label="Copy response" onClick={() => copyMessage(message.content)}><Copy size={14} /></button><button title="Read response aloud" aria-label="Read response aloud" onClick={() => speak(message.content)}><Volume2 size={15} /></button><span>Made a little more possible.</span></div>}</div></article>)}{busy && messages[messages.length - 1]?.content && <span className="streaming-cursor" />}</section>}
      </div>
      <div className={`composer-region ${isWelcome ? "welcome-composer" : ""}`}>
        {error && <div className="chat-error" role="alert"><AlertCircle size={17} /><span>{error}</span><button className="icon-button" onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
        <form className={`composer ${recording ? "is-recording" : ""}`} onSubmit={event => { event.preventDefault(); send(); }}>{attachment && <div className="attachment-chip"><FileText size={15} /><span>{attachment.name}</span><button onClick={() => setAttachment(null)} type="button" aria-label="Remove attachment"><X size={13} /></button></div>}<textarea ref={textarea} aria-label="Message FarhanGPT" rows={1} value={input} maxLength={28000} onChange={e => setInput(e.target.value)} placeholder={recording ? "Listening… good ideas sound like you." : "Ask anything, or dream up something new…"} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} /><div className="composer-toolbar"><div className="composer-tools"><button type="button" className="icon-button attach-button" title="Attach a text or code file" aria-label="Attach a text or code file" onClick={() => fileInput.current?.click()}><Plus size={20} /></button><input type="file" ref={fileInput} accept=".txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.html,.css,.log,.xml,.yaml,.yml,.sql" hidden onChange={e => attachFile(e.target.files?.[0])} /><span className="toolbar-divider" /><div className="model-control" data-popover><button className="model-trigger" type="button" aria-expanded={modelMenu} aria-label="Choose AI model" onClick={() => setModelMenu(!modelMenu)}><span style={{ color: selectedModel.color }}><BrandMark size={16} /></span><span>{selectedModel.name}</span><ChevronDown size={12} /></button>{modelMenu && <div className="model-popover"><div className="popover-heading">A great mind for every idea</div>{MODELS.map(m => <button type="button" key={m.id} className={model === m.id ? "active" : ""} onClick={() => chooseModel(m.id)}><span className="mini-model-icon" style={{ color: m.color }}><BrandMark size={18} /></span><span><strong>{m.name}</strong><small>{m.provider}</small></span>{model === m.id ? <Check size={15} /> : <span className="model-mini-badge">{m.badge}</span>}</button>)}<div className="popover-footer"><LockKeyhole size={12} />Your API connection stays private.</div></div>}</div><button type="button" className={`tool-pill ${deepThink ? "active" : ""}`} aria-pressed={deepThink} title="Get a more carefully considered answer" onClick={() => setDeepThink(!deepThink)}><Lightbulb size={14} /><span>Deep think</span></button><button type="button" className={`tool-pill ${webSearch ? "active" : ""}`} aria-pressed={webSearch} title="Search the web with OpenRouter (provider credits may apply)" onClick={() => setWebSearch(!webSearch)}><Globe2 size={14} /><span>Search web</span></button></div><div className="composer-send"><button className={`icon-button voice-button ${recording ? "recording" : ""}`} type="button" onClick={startVoice} title={recording ? "Stop listening" : "Use your voice"} aria-label={recording ? "Stop voice input" : "Use voice input"}>{recording ? <AudioLines size={19} /> : <Mic size={18} />}</button>{busy ? <button className="send-button stop-button" type="button" aria-label="Stop generating" title="Stop generating" onClick={() => abort.current?.abort()}><Square size={14} fill="currentColor" /></button> : <button className="send-button" type="submit" aria-label="Send message" title="Send message (Enter)" disabled={(!input.trim() && !attachment) || !booted}><ArrowUp size={21} strokeWidth={2.2} /></button>}</div></div></form>
        <div className="composer-caption"><span>FarhanGPT can make mistakes. A little double-check goes a long way.</span><span className="privacy-caption"><LockKeyhole size={11} />Private by design</span></div>
      </div>
      <footer className="workspace-footer"><span><BrandMark size={12} />Made for curious minds.</span><span className="footer-right"><span className="status-dot" />Your ideas. Your space.</span></footer>
    </main>
    {toast && <div className="toast" role="status"><span><Check size={15} /></span>{toast}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast("")}><X size={14} /></button></div>}
    {(dialog === "auth" || dialog === "register") && <AuthDialog onClose={closeDialog} onSuccess={authenticated} initialMode={dialog === "register" ? "register" : "login"} />}
    {dialog === "models" && <ModelsDialog model={model} onSelect={chooseModel} onClose={closeDialog} />}
    {dialog === "library" && <LibraryDialog onClose={closeDialog} onUse={usePrompt} saved={saved} onSave={savePrompt} />}
    {dialog === "search" && <SearchDialog conversations={conversations} onSelect={openConversation} onNew={newChat} onClose={closeDialog} />}
    {dialog === "install" && <InstallDialog onClose={closeDialog} onInstall={installApp} onToast={notify} />}
    {dialog === "settings" && <SettingsDialog user={user} theme={theme} onTheme={setTheme} animated={animated} onAnimated={setAnimated} instructions={instructions} onInstructions={changeInstructions} onClose={closeDialog} onLogout={loggedOut} onClear={() => { newChat(); setConversations([]); }} onToast={notify} />}
    {dialog === "about" && <AboutDialog onClose={closeDialog} />}
    {rename && <Modal title="Give this idea a name." subtitle="Something that’s easy to find again." onClose={() => setRename(null)}><form className="form-stack" onSubmit={renameConversation}><label>Conversation title<input name="title" defaultValue={rename.title} maxLength={100} required data-autofocus /></label><button className="primary-button" disabled={renaming}>{renaming ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}Save name</button></form></Modal>}
  </div>;
}
