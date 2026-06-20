// app.jsx — Project Hub main application (real Anthropic API)
const { useState, useEffect, useRef, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "cozy",
  "cardStyle": "bordered",
  "tabStyle": "underline"
}/*EDITMODE-END*/;

// ── Mode helpers ─────────────────────────────────────────────────────────
function getMode() { return localStorage.getItem("hub_mode") || "proxy"; }
function formatMsgTime() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (now >= today) return time;
  if (now >= yesterday) return `Yesterday ${time}`;
  return `${now.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}
function setMode(m) { localStorage.setItem("hub_mode", m); }

// Absolute-timestamp date labelling — reliable across days (unlike frozen strings)
function labelFromTs(ts) {
  const d = new Date(ts);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const dd = new Date(d); dd.setHours(0, 0, 0, 0);
  if (dd.getTime() === today.getTime()) return "Today";
  if (dd.getTime() === yest.getTime()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Anthropic API ─────────────────────────────────────────────────────────
function getStoredKey() { return localStorage.getItem("hub_api_key") || ""; }
function getStoredChats() {
  try { return JSON.parse(localStorage.getItem("hub_chats") || "{}"); } catch { return {}; }
}
async function fetchServerChats() {
  try {
    const res = await fetch("/api/chats");
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
async function pushServerChats(chats) {
  try {
    await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chats),
    });
  } catch {}
}
async function fetchServerState() {
  try {
    const res = await fetch("/api/state");
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
async function pushServerState(state) {
  try {
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
  } catch {}
}

// ── User project storage ──────────────────────────────────────────────────
function getStoredProjects() {
  try { return JSON.parse(localStorage.getItem("hub_projects") || "[]"); } catch { return []; }
}
function saveStoredProjects(projects) {
  localStorage.setItem("hub_projects", JSON.stringify(projects));
}
function getStoredShipMode() {
  try { return JSON.parse(localStorage.getItem("hub_ship_mode") || "{}"); } catch { return {}; }
}
function saveShipMode(data) { localStorage.setItem("hub_ship_mode", JSON.stringify(data)); }

function getStoredAutoThreads() {
  try { return JSON.parse(localStorage.getItem("hub_auto_threads") || "{}"); } catch { return {}; }
}
function saveAutoThreads(data) {
  const trimmed = {};
  for (const [id, threads] of Object.entries(data)) {
    trimmed[id] = threads.slice(-10);
  }
  localStorage.setItem("hub_auto_threads", JSON.stringify(trimmed));
}
function uid() { return Math.random().toString(36).slice(2, 9); }

// ── Webhook storage ───────────────────────────────────────────────────────
function getWebhooks() {
  try { return JSON.parse(localStorage.getItem("hub_webhooks") || "{}"); } catch { return {}; }
}
function saveWebhookUrl(platform, url) {
  const w = getWebhooks();
  w[platform] = url;
  localStorage.setItem("hub_webhooks", JSON.stringify(w));
}

// ── Post intent detection ─────────────────────────────────────────────────
const POST_INTENTS = {
  instagram: /\b(post (this|it|option [abc])|post to instagram|publish (this|it))\b/i,
  mailchimp: /\b(send (this|email|it|newsletter)|send to mailchimp|email this)\b/i,
};
function detectPostIntent(text) {
  for (const [platform, re] of Object.entries(POST_INTENTS)) {
    if (re.test(text)) return platform;
  }
  return null;
}

// Extract the right content from the focused thread
function extractContent(thread, userText) {
  const proposal = thread?.body?.proposal || "";
  // Check for specific option letter (A, B, C)
  const optMatch = userText.match(/option\s+([abc])/i);
  if (optMatch && proposal) {
    const letter = optMatch[1].toUpperCase();
    const parts = proposal.split(/\n\n(?=[A-C][\s✦—])/);
    const hit = parts.find((p) => p.trimStart().startsWith(letter));
    if (hit) return hit.replace(/^[A-C]\s*[✦—\s]*RECOMMENDED\s*[—\s]*/i, "").replace(/^[A-C]\s*[—\s]*/i, "").trim();
  }
  if (proposal) return proposal;
  return Object.values(thread?.body || {}).filter((v) => typeof v === "string").join("\n\n");
}

// ── Claude Code proxy (uses your subscription via local server) ───────────
async function callClaudeProxy({ systemPrompt, messages, onChunk, onDone }) {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemPrompt, messages }),
    });
    if (!res.ok) { onChunk(`⚠️ Server error ${res.status}`); onDone(); return; }
    const data = await res.json();
    onChunk(data.text || "No response.");
  } catch (e) {
    onChunk(`⚠️ Could not reach local server: ${e.message}`);
  }
  onDone();
}

async function callClaude({ systemPrompt, messages, onChunk, onDone }) {
  if (getMode() === "proxy") {
    return callClaudeProxy({ systemPrompt, messages, onChunk, onDone });
  }
  const key = getStoredKey();
  if (!key) {
    onChunk("⚠️ No API key found. Reload the page to enter your key.");
    onDone();
    return;
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      stream: true,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    onChunk(`⚠️ API error ${res.status}: ${err}`);
    onDone();
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
          onChunk(parsed.delta.text);
        }
      } catch {}
    }
  }
  onDone();
}

// ── System prompts per role ───────────────────────────────────────────────
function projectCtx(project) {
  const base = `Project: ${project.name}${project.tagline ? " — " + project.tagline : ""}. Stage: ${project.stage}.`;
  return project.goals ? `${base}\n\nProject goals: ${project.goals}` : base;
}

const SYSTEM_PROMPTS = {
  pm: (project) => `You are the Product Manager for ${project.name}. ${projectCtx(project)}

Your job is to think in specs, user stories, and priorities. When asked to plan something, produce it — write the spec, define acceptance criteria, break work into milestones. No corporate speak.

When replying, produce full documents when asked. Keep conversational replies to 2-4 sentences. Use markdown (headers, bullets, numbered lists) for plans and specs.`,

  "tech-lead": (project) => `You are the Tech Lead for ${project.name}. ${projectCtx(project)}

Your job is to build things. When asked to write code, write actual working code — not descriptions. Use markdown code fences with the correct language tag (\`\`\`html, \`\`\`javascript, \`\`\`python, \`\`\`css, etc). Produce complete, runnable outputs.

IMPORTANT — for web apps and tools: produce self-contained single-file HTML whenever possible. Load libraries from CDN (React via unpkg, Tailwind via CDN, etc.) so the output can be previewed immediately in a browser with no build step. The founder can click Preview on your code block to see it running instantly. This is the preferred output format for all web work.

When replying, produce the first working version and note what iteration 2 would add. Keep conversational replies to 2-4 sentences.`,

  "ux-lead": (project) => `You are the UX and Design Lead for ${project.name}. ${projectCtx(project)}

Your job is to make things clear, consistent, and intentional. When asked to design something, describe it precisely enough that a developer could implement it — layout, hierarchy, copy, interactions. Produce concrete direction, not principles.

When replying, produce full UI specs or copy when asked. Keep conversational replies to 2-4 sentences.`,

  "growth-analyst": (project) => `You are the Growth Analyst for ${project.name}. ${projectCtx(project)}

Your job is to find what works and translate it into action. When asked for a growth plan, write it — channels, tactics, metrics, timeline. Be analytical but plain-spoken. No jargon.

When replying, produce the analysis or plan in full when asked. Keep conversational replies to 2-4 sentences.`,

  "content-marketer": (project) => `You are the Content Marketer for ${project.name}. ${projectCtx(project)}

Your job is to produce content — when asked, write the actual post, script, caption, or campaign brief. Don't describe what you'd write. Write it.

When replying, produce content in full unless it's a quick question. Keep conversational replies to 2-4 sentences.`,

  "competitive-analyst": (project) => `You are the Competitive Analyst for ${project.name}. ${projectCtx(project)}

Your job is to map the landscape and find the positioning move. When asked for research, produce the actual competitive matrix, positioning map, or strategic brief — not a description of what you'd produce.

When replying, use structured formats (bullets, tables) for research outputs. Keep conversational replies to 2-4 sentences.`,

  "ux-researcher": (project) => `You are the UX Researcher for ${project.name}. ${projectCtx(project)}

Your job is to surface what real users do and need. When asked for research, produce the actual interview guide, usability audit, or insight report in full.

When replying, produce complete research outputs when asked. Keep conversational replies to 2-4 sentences.`,

  director: (project) => `You are the Director for ${project.name} — synthesiser across the whole team. ${projectCtx(project)}

Your job is to give the founder a clear picture of where things stand and surface the 1-2 decisions that matter most right now. When a project has goals, make sure the team is tracking toward them.

When replying, give signal not noise. 3-5 sentences unless asked for a full briefing. Full briefing format: what's on track / what needs attention / what decision is needed today.`,
};

function getSystemPrompt(member, project) {
  const role = (member.role || "").toLowerCase();
  let base;
  if (role.includes("director"))                      base = SYSTEM_PROMPTS.director(project);
  else if (role.includes("content"))                  base = SYSTEM_PROMPTS["content-marketer"](project);
  else if (role.includes("competitive"))              base = SYSTEM_PROMPTS["competitive-analyst"](project);
  else if (role.includes("ux researcher") ||
           role.includes("ux research"))              base = SYSTEM_PROMPTS["ux-researcher"](project);
  else if (role.includes("ux") || role.includes("design")) base = SYSTEM_PROMPTS["ux-lead"](project);
  else if (role.includes("tech") || role.includes("engineer") || role.includes("developer"))
                                                      base = SYSTEM_PROMPTS["tech-lead"](project);
  else if (role.includes("growth"))                   base = SYSTEM_PROMPTS["growth-analyst"](project);
  else if (role.includes("product") || role.includes("pm")) base = SYSTEM_PROMPTS.pm(project);
  else base = `You are ${member.role} for ${project.name}. ${projectCtx(project)}

Your job is to produce real outputs from your area of expertise — not just advice. When asked to write, build, design, or research something, produce it directly. Use markdown code fences for code, structured headers for documents, bullets for plans. Keep conversational replies to 2-4 sentences.`;

  if (member.background && member.background.trim()) {
    base += `\n\nYour background and expertise: ${member.background.trim()}`;
  }
  return base;
}

// ── Shared team memory ────────────────────────────────────────────────────
// Digest of what every OTHER member is working on, so each member coordinates.
function buildTeamDigest(project, currentMemberId, autoThreads, extra) {
  const parts = [];
  project.members.forEach((mem) => {
    if (mem.id === currentMemberId || mem.director) return;
    const threads = [...mem.threads, ...((autoThreads && autoThreads[mem.id]) || [])];
    if (!threads.length) return;
    const recent = threads.slice(-3);
    const lines = recent.map((th) => {
      const allMsgs = [...(th.messages || []), ...((extra && extra[th.id]) || [])];
      const last = allMsgs.filter((m) => m.from === "member" && m.text).slice(-1)[0];
      const snippet = last ? last.text.replace(/\s+/g, " ").slice(0, 220) : "";
      return `  • [${th.type}] ${th.title}${snippet ? ": " + snippet : ""}`;
    });
    parts.push(`${mem.name} (${mem.role}):\n${lines.join("\n")}`);
  });
  if (!parts.length) return "";
  return `\n\n--- WHAT THE REST OF THE TEAM IS WORKING ON ---\n${parts.join("\n\n")}\n--- END TEAM CONTEXT ---\n\nStay consistent with your teammates above and avoid contradicting their work. Reference it when relevant.`;
}

function buildThreadContext(thread) {
  if (!thread) return "";
  const lines = [`Thread: "${thread.title}" (type: ${thread.type})`];
  if (thread.body) {
    for (const [k, v] of Object.entries(thread.body)) {
      if (v && typeof v === "string") lines.push(`${k}: ${v}`);
    }
  }
  return lines.join("\n");
}

// ── Streaming reply ───────────────────────────────────────────────────────
async function streamReply({ tid, member, project, focused, founderText, priorMessages, setExtra, teamDigest }) {
  const systemPrompt = getSystemPrompt(member, project) + (teamDigest || "");
  const threadCtx = buildThreadContext(focused);

  // Build message history from prior thread messages (excluding streaming placeholders)
  const history = (priorMessages || [])
    .filter((m) => !m.streaming && m.text)
    .map((m) => ({
      role: m.from === "founder" ? "user" : "assistant",
      content: m.text,
    }));

  // Add context about the thread, then the founder's message
  const userContent = threadCtx
    ? `[Thread context]\n${threadCtx}\n\n[Founder]: ${founderText}`
    : founderText;

  const messages = [...history, { role: "user", content: userContent }];

  // Insert streaming placeholder
  const repliedAt = formatMsgTime();
  setExtra((prev) => ({
    ...prev,
    [tid]: [...(prev[tid] || []), { from: "member", text: "", time: repliedAt, ts: Date.now(), streaming: true }],
  }));

  let accumulated = "";
  await callClaude({
    systemPrompt,
    messages,
    onChunk: (chunk) => {
      accumulated += chunk;
      setExtra((prev) => {
        const arr = [...(prev[tid] || [])];
        const last = arr.length - 1;
        if (last < 0) return prev;
        arr[last] = { ...arr[last], text: accumulated, streaming: true };
        return { ...prev, [tid]: arr };
      });
    },
    onDone: () => {
      setExtra((prev) => {
        const arr = [...(prev[tid] || [])];
        const last = arr.length - 1;
        if (last >= 0) arr[last] = { ...arr[last], streaming: false };
        return { ...prev, [tid]: arr };
      });
    },
  });
}

// ── Action modal (post to Instagram / Mailchimp) ─────────────────────────
function ActionModal({ platform, content, webhookUrl, onCancel, onDone }) {
  const [text, setText] = useState(content);
  const [status, setStatus] = useState("idle");

  const label = { instagram: "Instagram", mailchimp: "Mailchimp" }[platform] || platform;

  async function fire() {
    setStatus("sending");
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: text, platform, timestamp: new Date().toISOString() }),
      });
      setStatus("done");
      setTimeout(onDone, 1400);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="action-overlay" onClick={onCancel}>
      <div className="action-modal" onClick={(e) => e.stopPropagation()}>
        <div className="action-header">
          <span className="action-platform-chip">{label}</span>
          <span className="action-title">Review before posting</span>
          <button className="action-close" onClick={onCancel}>✕</button>
        </div>
        <textarea
          className="action-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
        />
        {!webhookUrl && (
          <p className="action-warn">No {label} webhook set. Open Settings (⚙️) → Integrations to add one.</p>
        )}
        <div className="action-btns">
          <button className="action-btn-cancel" onClick={onCancel}>Cancel</button>
          <button
            className={"action-btn-confirm" + (status === "done" ? " is-done" : "")}
            onClick={status === "idle" ? fire : undefined}
            disabled={!webhookUrl || status === "sending" || status === "done"}
          >
            {status === "idle" && `Post to ${label}`}
            {status === "sending" && "Posting…"}
            {status === "done" && "✓ Sent"}
            {status === "error" && "Error — try again"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── API key gate ─────────────────────────────────────────────────────────
function ApiKeyGate({ children }) {
  const [mode, setModeState] = useState(getMode);
  const [key, setKey]        = useState(getStoredKey);
  const [draft, setDraft]    = useState("");
  const [error, setError]    = useState("");

  if (mode === "proxy" || key) return children;

  function saveKey() {
    const k = draft.trim();
    if (!k.startsWith("sk-ant-")) { setError("Key should start with sk-ant-"); return; }
    localStorage.setItem("hub_api_key", k);
    setKey(k);
  }

  function useProxy() {
    setMode("proxy");
    setModeState("proxy");
  }

  return (
    <div className="key-gate">
      <div className="key-modal">
        <div className="key-modal-icon">◆</div>
        <h2 className="key-modal-title">Project Hub</h2>
        <p className="key-modal-desc">Choose how to power your AI team.</p>

        <button className="key-btn" onClick={useProxy} style={{ background: "oklch(0.45 0.15 195)" }}>
          Use Claude Code subscription
        </button>
        <p className="key-hint">Uses your existing Claude Code plan — no extra cost</p>

        <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", color: "var(--ink-3)", fontSize: 11 }}>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          or
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        </div>

        <input
          className="key-input"
          type="password"
          placeholder="sk-ant-api03-… (Anthropic API key)"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") saveKey(); }}
        />
        {error && <p style={{ color: "oklch(0.5 0.18 25)", fontSize: 12, margin: 0 }}>{error}</p>}
        <button className="key-btn" onClick={saveKey} disabled={!draft.trim()} style={{ background: "oklch(0.32 0.014 60)" }}>
          Continue with API key
        </button>
        <p className="key-hint">Billed separately at console.anthropic.com</p>
      </div>
    </div>
  );
}

// ── Project switcher ──────────────────────────────────────────────────────
// ── New Project Modal ─────────────────────────────────────────────────────
const NP_STAGES = ["Discovery", "Building", "Growing", "Launched"];
const NP_AVATAR_HUES = [220, 150, 30, 280, 120, 350, 200, 60];
const NP_TYPES = ["proposal", "learning", "hygiene", "blocker", "status"];

const PROJECT_TYPES = [
  { id: "app",       icon: "⚡", label: "Build an App",       desc: "Web, mobile, or internal tool",   color: "#6366f1",
    team: [{ name: "Jordan", role: "Product Manager", short: "PM",   types: ["proposal","learning"] },
           { name: "Sam",    role: "Tech Lead",        short: "TL",   types: ["proposal","hygiene"]  },
           { name: "Maya",   role: "UX Designer",      short: "UX",   types: ["proposal","learning"] }] },
  { id: "music",     icon: "🎵", label: "Music Project",       desc: "Album, playlist, or sound design", color: "#8b5cf6",
    team: [{ name: "Alex",  role: "Prompt Engineer",   short: "PE",   types: ["proposal","hygiene"]  },
           { name: "Riley", role: "Post-Production",    short: "POST", types: ["hygiene","learning"]  },
           { name: "Casey", role: "Content Creator",    short: "CC",   types: ["proposal","learning"] }] },
  { id: "marketing", icon: "📣", label: "Marketing Campaign",  desc: "Growth, social, or brand",        color: "#f59e0b",
    team: [{ name: "Jordan", role: "Growth Analyst",   short: "GRW",  types: ["proposal","learning"] },
           { name: "Sam",    role: "Content Creator",   short: "CC",   types: ["proposal","hygiene"]  }] },
  { id: "content",   icon: "✍️", label: "Content Strategy",    desc: "Blog, social, or editorial",      color: "#10b981",
    team: [{ name: "Alex",  role: "Content Creator",   short: "CC",   types: ["proposal","hygiene"]  },
           { name: "Riley", role: "Growth Analyst",     short: "GRW",  types: ["learning","proposal"] }] },
  { id: "research",  icon: "🔬", label: "Research",             desc: "Market, user, or strategy",       color: "#06b6d4",
    team: [{ name: "Maya",  role: "UX Researcher",      short: "UXR",  types: ["learning","proposal"] },
           { name: "Sam",   role: "Competitive Analyst", short: "CA",   types: ["learning","proposal"] }] },
  { id: "other",     icon: "◆",  label: "Other",                desc: "Custom project type",              color: "#6366f1", team: [] },
];

function NewProjectModal({ onDone, onClose }) {
  const [step, setStep] = useState(1);
  // Step 1: type
  const [typeId, setTypeId] = useState(null);
  // Step 2: details + goals
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [goals, setGoals] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [stage, setStage] = useState("Building");
  // Step 3: team
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ name: "", role: "", short: "", background: "" });
  const [formTypes, setFormTypes] = useState(["proposal", "learning"]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedMember, setExpandedMember] = useState(null);

  const selType = PROJECT_TYPES.find((t) => t.id === typeId);

  function pickType(pt) {
    setTypeId(pt.id);
    setColor(pt.color);
    // pre-load suggested team with placeholder names
    const hues = NP_AVATAR_HUES;
    setMembers(pt.team.map((m, i) => ({
      id: "mem_" + uid(), name: m.name, role: m.role, short: m.short,
      desc: m.role, avatarHue: hues[i % hues.length], types: m.types, threads: [],
    })));
  }

  function autoShort(role) {
    const words = (role || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "";
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return words.map((w) => w[0]).join("").toUpperCase().slice(0, 4);
  }

  function addMember() {
    if (!form.name.trim() || !form.role.trim()) return;
    setMembers((prev) => [...prev, {
      id: "mem_" + uid(), name: form.name.trim(), role: form.role.trim(),
      short: form.short.trim() || autoShort(form.role), desc: form.role.trim(),
      background: form.background.trim(),
      avatarHue: NP_AVATAR_HUES[prev.length % NP_AVATAR_HUES.length],
      types: formTypes.length ? [...formTypes] : ["proposal", "learning"], threads: [],
    }]);
    setForm({ name: "", role: "", short: "", background: "" });
    setFormTypes(["proposal", "learning"]);
    setShowAddForm(false);
  }

  function removeMember(id) { setMembers((prev) => prev.filter((m) => m.id !== id)); }

  function updateMember(id, patch) {
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } : m));
  }

  function launch() {
    const stamp = () => `Today, ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    const goalsNote = goals.trim() ? `\n\nYour project goals: "${goals.trim()}"` : "";
    const seed = (m, opening) => {
      const now = Date.now();
      return {
        ...m, threads: [{
          id: "th_" + uid(), type: m.types[0] || "status",
          title: "Project kickoff — get started here",
          time: stamp(), ts: now, body: {},
          messages: [{ from: "member", text: opening + goalsNote, time: stamp(), ts: now }],
        }],
      };
    };
    const director = seed({
      id: "dir_" + uid(), name: "Director", role: "Creative Director",
      short: "DIR", desc: "Synthesis across the whole team",
      avatarHue: 220, director: true, types: ["status"],
    }, `I've reviewed the project brief. I'll keep you across all team members, synthesise progress, and surface decisions when you need them. Start by telling me what outcome matters most this week — or ask me for a full kickoff briefing.`);
    const seededMembers = members.map((m) =>
      seed(m, `Hi, I'm ${m.name} — your ${m.role}. Tell me what you'd like me to work on first and I'll get started.`)
    );
    onDone({
      id: "uproj_" + uid(),
      name: name.trim() || (selType ? selType.label : "New Project"),
      tagline: tagline.trim() || "",
      goals: goals.trim(),
      color, stage,
      members: [director, ...seededMembers],
    });
  }

  const types = window.HUB_DATA.types;
  const stepTitles = ["What are you building?", "Project details", "Your team"];

  return (
    <div className="action-overlay" onClick={onClose}>
      <div className="np-modal" onClick={(e) => e.stopPropagation()}>
        <div className="np-header">
          <div>
            <div className="np-steps-track">
              {[1,2,3].map((n) => (
                <span key={n} className={"np-step-dot" + (n === step ? " is-active" : n < step ? " is-done" : "")} />
              ))}
            </div>
            <h2 className="np-title">{stepTitles[step - 1]}</h2>
          </div>
          <button className="action-close" onClick={onClose}>✕</button>
        </div>

        {/* ── STEP 1: Project type ── */}
        {step === 1 && (
          <div className="np-body">
            <div className="np-type-grid">
              {PROJECT_TYPES.map((pt) => (
                <button key={pt.id}
                  className={"np-type-card" + (typeId === pt.id ? " is-active" : "")}
                  style={typeId === pt.id ? { "--tc": pt.color } : {}}
                  onClick={() => pickType(pt)}>
                  <span className="np-type-icon">{pt.icon}</span>
                  <span className="np-type-label">{pt.label}</span>
                  <span className="np-type-desc">{pt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: Details + goals ── */}
        {step === 2 && (
          <div className="np-body">
            {selType && (
              <div className="np-selected-type">
                <span className="np-type-icon" style={{ fontSize: 18 }}>{selType.icon}</span>
                <span>{selType.label}</span>
              </div>
            )}
            <div className="np-field">
              <label className="np-label">Project name</label>
              <input className="np-input" placeholder="e.g. Wave Cycles, Bloom App…"
                value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="np-field">
              <label className="np-label">Tagline <span className="np-optional">optional</span></label>
              <input className="np-input" placeholder="One line describing this project"
                value={tagline} onChange={(e) => setTagline(e.target.value)} />
            </div>
            <div className="np-field">
              <label className="np-label">Project goals</label>
              <textarea className="np-textarea"
                placeholder={"Describe what you want to achieve. Be specific — your team will read this and work from it.\n\ne.g. Build a simple expense tracker app with React. Users can add/edit/delete expenses and see a monthly summary chart."}
                value={goals} onChange={(e) => setGoals(e.target.value)} rows={5} />
            </div>
            <div className="np-row">
              <div className="np-field" style={{ flex: 1 }}>
                <label className="np-label">Stage</label>
                <div className="np-stage-pills">
                  {NP_STAGES.map((s) => (
                    <button key={s} className={"np-stage-pill" + (stage === s ? " is-active" : "")}
                      onClick={() => setStage(s)}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Team ── */}
        {step === 3 && (
          <div className="np-body">
            <div className="np-dir-tip">
              <span className="np-dir-mark">◆</span>
              <span>Director is added automatically and will read your project goals to brief the team.</span>
            </div>

            {members.length > 0 && (
              <div className="np-member-list">
                {members.map((m) => {
                  const isExp = expandedMember === m.id;
                  return (
                    <div key={m.id} className={"np-member-row" + (isExp ? " is-expanded" : "")}>
                      <div className="np-member-row-top">
                        <Avatar name={m.name} hue={m.avatarHue} size={28} />
                        <div className="np-member-row-body">
                          <input className="np-member-name-input" value={m.name}
                            onChange={(e) => updateMember(m.id, { name: e.target.value })}
                            placeholder="Name" />
                          <span className="np-member-row-role">{m.role}</span>
                        </div>
                        <span className="np-member-chip-role">{m.short}</span>
                        <button className="np-bg-toggle"
                          onClick={() => setExpandedMember(isExp ? null : m.id)}
                          title={isExp ? "Collapse" : "Add background"}>
                          {isExp ? "▲" : (m.background ? "✎" : "+ bg")}
                        </button>
                        <button className="np-member-chip-remove" onClick={() => removeMember(m.id)}>✕</button>
                      </div>
                      {isExp && (
                        <div className="np-bg-section">
                          <label className="np-label">Background & expertise</label>
                          <textarea className="np-textarea np-bg-textarea"
                            placeholder={"Describe their background, expertise, and style — the AI will respond accordingly.\n\ne.g. 10 years building React apps. Prefers functional components and TypeScript. Writes clean, well-commented code with a focus on performance."}
                            value={m.background || ""}
                            onChange={(e) => updateMember(m.id, { background: e.target.value })}
                            rows={3} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!showAddForm ? (
              <button className="np-add-btn np-add-btn-outline" onClick={() => setShowAddForm(true)}>+ Add another member</button>
            ) : (
              <div className="np-add-section">
                <div className="np-add-title">Add a team member</div>
                <div className="np-row">
                  <div className="np-field" style={{ flex: 3 }}>
                    <label className="np-label">Name</label>
                    <input className="np-input" placeholder="Alex Chen" value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
                  </div>
                  <div className="np-field" style={{ flex: 2 }}>
                    <label className="np-label">Short tag</label>
                    <input className="np-input" placeholder="PM" value={form.short}
                      onChange={(e) => setForm((f) => ({ ...f, short: e.target.value.toUpperCase().slice(0, 4) }))} />
                  </div>
                </div>
                <div className="np-field">
                  <label className="np-label">Role</label>
                  <input className="np-input" placeholder="Product Manager, Tech Lead, Growth Analyst…"
                    value={form.role}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({ ...f, role: v, short: f.short || autoShort(v) }));
                    }} />
                </div>
                <div className="np-field">
                  <label className="np-label">Background & expertise <span className="np-optional">optional</span></label>
                  <textarea className="np-textarea np-bg-textarea"
                    placeholder={"Describe their background, style, and specialisation — the AI responds as this person.\n\ne.g. Senior React developer, 8 years experience, TypeScript-first, opinionated about clean architecture."}
                    value={form.background}
                    onChange={(e) => setForm((f) => ({ ...f, background: e.target.value }))}
                    rows={3} />
                </div>
                <div className="np-field">
                  <label className="np-label">What they cover</label>
                  <div className="np-type-chips">
                    {NP_TYPES.map((t) => (
                      <button key={t}
                        className={"np-type-chip" + (formTypes.includes(t) ? " is-active" : "")}
                        style={formTypes.includes(t) ? { "--chip-hue": types[t].hue } : {}}
                        onClick={() => setFormTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])}>
                        <TypeDot type={t} size={6} />{types[t].plural}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="action-btn-cancel" style={{ flex: 1 }} onClick={() => setShowAddForm(false)}>Cancel</button>
                  <button className="np-add-btn" style={{ flex: 2 }} disabled={!form.name.trim() || !form.role.trim()} onClick={addMember}>+ Add member</button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="np-footer">
          {step === 1
            ? <button className="action-btn-cancel" onClick={onClose}>Cancel</button>
            : <button className="action-btn-cancel" onClick={() => setStep((s) => s - 1)}>← Back</button>}
          {step === 1 && <button className="action-btn-confirm" disabled={!typeId} onClick={() => setStep(2)}>Next →</button>}
          {step === 2 && <button className="action-btn-confirm" disabled={!name.trim() && !goals.trim()} onClick={() => setStep(3)}>Next →</button>}
          {step === 3 && <button className="action-btn-confirm" onClick={launch}>Launch project</button>}
        </div>
      </div>
    </div>
  );
}

function ProjectSwitcher({ projects, activeId, onSelect, onNewProject }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = projects.find((p) => p.id === activeId);
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div className="switcher" ref={ref}>
      <button className="switcher-btn" onClick={() => setOpen((o) => !o)}>
        <span className="switcher-dot" style={{ background: active.color }} />
        <span className="switcher-name">{active.name}</span>
        <svg className="switcher-caret" width="10" height="10" viewBox="0 0 10 10">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="switcher-menu">
          {projects.map((p) => (
            <button key={p.id} className={"switcher-item" + (p.id === activeId ? " is-active" : "")}
              onClick={() => { onSelect(p.id); setOpen(false); }}>
              <span className="switcher-dot" style={{ background: p.color }} />
              <span className="switcher-item-body">
                <span className="switcher-item-name">{p.name}</span>
                <span className="switcher-item-tag">{p.tagline}</span>
              </span>
              {p.id === activeId && <span className="switcher-check">✓</span>}
            </button>
          ))}
          <button className="switcher-new" onClick={() => { setOpen(false); onNewProject(); }}>
            <span className="switcher-new-icon">+</span>
            <span>New project</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Member pill (top nav) ─────────────────────────────────────────────────
function MemberPill({ member, active, onClick, isWorking }) {
  const isDir = !!member.director;
  return (
    <button
      className={"member-pill" + (active ? " is-active" : "") + (isDir ? " is-director" : "") + (isWorking ? " is-working" : "")}
      onClick={onClick}
    >
      {isDir
        ? <span className="dir-avatar" style={{ width: 22, height: 22, fontSize: 22 * 0.38 }}>◆</span>
        : <Avatar name={member.name} hue={member.avatarHue} size={22} />}
      <span className="pill-name">{isDir ? "Director" : member.name}</span>
      {isWorking
        ? <span className="member-working-dot" />
        : <span className="pill-badge">{member.short}</span>}
    </button>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────
function Tabs({ types, active, onSelect, counts }) {
  const all = ["all", ...types];
  return (
    <div className="tabs" role="tablist">
      {all.map((t) => {
        const meta = t === "all" ? { label: "All", hue: null } : window.HUB_DATA.types[t];
        const isOn = active === t;
        return (
          <button key={t} role="tab" aria-selected={isOn}
            className={"tab" + (isOn ? " is-active" : "")}
            style={meta.hue != null ? { "--tab-hue": meta.hue } : {}}
            onClick={() => onSelect(t)}>
            {meta.hue != null && <span className="tab-dot" style={{ background: `oklch(0.6 0.16 ${meta.hue})` }} />}
            <span>{t === "all" ? "All" : meta.plural}</span>
            <span className="tab-count">{counts[t] || 0}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const data = window.HUB_DATA;
  const [userProjects, setUserProjects] = useState(getStoredProjects);
  const allProjects = useMemo(() => [...data.projects, ...userProjects], [userProjects]);
  const [projectId, setProjectId] = useState(data.projects[0].id);
  const project = allProjects.find((p) => p.id === projectId) || allProjects[0];
  const [memberId, setMemberId] = useState(project.members[0].id);
  const member = project.members.find((m) => m.id === memberId) || project.members[0];
  const [tab, setTab] = useState("all");
  const [dateFilter, setDateFilter] = useState(null);
  const [focusedId, setFocusedId] = useState(null);
  const [extra, setExtra] = useState(getStoredChats);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [action, setAction] = useState(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [webhooks, setWebhooks] = useState(getWebhooks);
  const [autoThreads, setAutoThreads] = useState(getStoredAutoThreads);
  const [working, setWorking] = useState({});
  const [shipMode, setShipMode] = useState(getStoredShipMode);
  const justShipIt = !!shipMode[projectId];
  const feedRef = useRef(null);
  const workingRef = useRef({});
  const sessionCountRef = useRef({});
  const projectRef = useRef(project);
  const justShipItRef = useRef(justShipIt);
  const extraRef = useRef(extra);
  const autoThreadsRef = useRef(autoThreads);
  const hydratedRef = useRef(false);
  const streamingRef = useRef(false);

  function selectProject(id) {
    const p = allProjects.find((x) => x.id === id);
    setProjectId(id);
    setMemberId(p.members[0].id);
    setTab("all");
    setDateFilter(null);
    setFocusedId(null);
  }
  function selectMember(id) { setMemberId(id); setTab("all"); setDateFilter(null); setFocusedId(null); }

  function createProject(proj) {
    const next = [...userProjects, proj];
    setUserProjects(next);
    saveStoredProjects(next);
    setShowNewProject(false);
    setProjectId(proj.id);
    setMemberId(proj.members[0].id);
    setTab("all"); setDateFilter(null); setFocusedId(null);
  }

  function msgsFor(thread) { return [...thread.messages, ...(extra[thread.id] || [])]; }

  function getMemberThreads(mem) {
    return [...mem.threads, ...(autoThreads[mem.id] || [])];
  }

  function teamDigestFor(mem, proj) {
    return buildTeamDigest(proj || project, mem.id, autoThreadsRef.current, extraRef.current);
  }

  function threadDateLabel(th) {
    if (th && typeof th === "object" && th.ts) return labelFromTs(th.ts);
    const t = (th && typeof th === "object" ? th.time : th) || "";
    if (/^today/i.test(t))     return "Today";
    if (/^yesterday/i.test(t)) return "Yesterday";
    const m = t.match(/^([A-Za-z]+ \d+)/);
    return m ? m[1] : "Earlier";
  }

  const dateGroups = useMemo(() => {
    const seen = new Map();
    project.members.forEach(mem => {
      getMemberThreads(mem).forEach(th => {
        const label = threadDateLabel(th);
        if (!seen.has(label)) seen.set(label, seen.size);
      });
    });
    const labels = [...seen.keys()];
    return labels.sort((a, b) => {
      if (a === "Today") return -1; if (b === "Today") return 1;
      if (a === "Yesterday") return -1; if (b === "Yesterday") return 1;
      return seen.get(b) - seen.get(a);
    });
  }, [project, autoThreads]);

  const activeDateFilter = dateFilter || (dateGroups[0] || null);

  const filtered = useMemo(() => {
    return getMemberThreads(member).filter((th) => {
      if (activeDateFilter && threadDateLabel(th) !== activeDateFilter) return false;
      return true;
    });
  }, [member, activeDateFilter, autoThreads]);

  const counts = useMemo(() => {
    const threads = getMemberThreads(member);
    const c = { all: threads.length };
    threads.forEach((th) => { c[th.type] = (c[th.type] || 0) + 1; });
    return c;
  }, [member, autoThreads]);

  const focused = filtered.find((th) => th.id === focusedId) || filtered[0] || null;

  function selectTab(tb) { setTab(tb); setFocusedId(null); }

  function updateWebhook(platform, url) {
    saveWebhookUrl(platform, url);
    setWebhooks(getWebhooks());
  }

  function toggleShipMode() {
    setShipMode(prev => {
      const next = { ...prev, [projectId]: !prev[projectId] };
      saveShipMode(next);
      return next;
    });
  }

  async function decideForMe(thread) {
    if (streaming) return;
    const tid = thread.id;
    const founderText = "Decide for yourself and proceed with your best judgment.";
    const sentAt = formatMsgTime();
    setExtra(prev => ({
      ...prev,
      [tid]: [...(prev[tid] || []), { from: "founder", text: founderText, time: sentAt, ts: Date.now() }],
    }));
    setStreaming(true);
    try {
      await streamReply({
        tid, member, project, focused: thread,
        founderText,
        priorMessages: [...thread.messages, ...(extra[tid] || [])],
        setExtra,
        teamDigest: teamDigestFor(member),
      });
    } finally {
      setStreaming(false);
    }
  }

  async function doAutoUpdate(mem, proj) {
    if (!proj || !proj.goals) return;
    if (workingRef.current[mem.id]) return;

    setWorking(prev => ({ ...prev, [mem.id]: true }));
    workingRef.current[mem.id] = true;

    const systemPrompt = getSystemPrompt(mem, proj) + teamDigestFor(mem, proj);
    const autoShip = justShipItRef.current;
    const prompt = autoShip
      ? `Proactively generate an update based on the project goals. If you would normally ask a clarifying question, instead state your assumption and proceed.

Reply in EXACTLY this format (no text before or after):
TITLE: <one-line thread title>
TYPE: <status or proposal or learning>
BODY: <2-4 sentences — include any assumptions you're making>`
      : `Proactively generate either an update OR a question you need answered before you can proceed.

Reply in EXACTLY this format (no text before or after):
TITLE: <one-line thread title>
TYPE: <status or proposal or learning or question>
BODY: <2-4 sentences of your update, OR your specific question to the founder>`;

    let text = "";
    await callClaude({
      systemPrompt,
      messages: [{ role: "user", content: prompt }],
      onChunk: (chunk) => { text += chunk; },
      onDone: () => {},
    });

    const titleMatch = text.match(/^TITLE:\s*(.+)/m);
    const typeMatch  = text.match(/^TYPE:\s*(\w+)/m);
    const bodyMatch  = text.match(/^BODY:\s*([\s\S]+)/m);

    const title   = titleMatch ? titleMatch[1].trim() : "Update";
    const rawType = typeMatch ? typeMatch[1].trim().toLowerCase() : "status";
    const type    = ["status","proposal","learning","hygiene","blocker"].includes(rawType) ? rawType : "status";
    const body    = bodyMatch ? bodyMatch[1].trim() : text.trim();

    if (body) {
      const stamp = formatMsgTime();
      const now = Date.now();
      const newThread = {
        id: "ath_" + uid(), type, title,
        time: stamp, ts: now, body: {}, auto: true,
        messages: [{ from: "member", text: body, time: stamp, ts: now }],
      };
      setAutoThreads(prev => {
        const next = { ...prev, [mem.id]: [...(prev[mem.id] || []), newThread] };
        saveAutoThreads(next);
        return next;
      });
    }

    sessionCountRef.current[mem.id] = (sessionCountRef.current[mem.id] || 0) + 1;
    workingRef.current[mem.id] = false;
    setWorking(prev => ({ ...prev, [mem.id]: false }));
  }

  async function send() {
    const text = input.trim();
    if (!text || !focused || streaming) return;

    // Intercept post intents before sending to Claude
    const platform = detectPostIntent(text);
    if (platform) {
      const content = extractContent(focused, text);
      setAction({ platform, content, webhookUrl: webhooks[platform] || "" });
      setInput("");
      return;
    }

    const tid = focused.id;
    const currentMsgs = extra[tid] || [];

    // Add founder message immediately
    const sentAt = formatMsgTime();
    setExtra((prev) => ({
      ...prev,
      [tid]: [...(prev[tid] || []), { from: "founder", text, time: sentAt, ts: Date.now() }],
    }));
    setInput("");
    setStreaming(true);

    try {
      await streamReply({
        tid,
        member,
        project,
        focused,
        founderText: text,
        priorMessages: [...focused.messages, ...currentMsgs],
        setExtra,
        teamDigest: teamDigestFor(member),
      });
    } finally {
      setStreaming(false);
    }
  }

  // On mount: pull all state from server (overrides stale localStorage)
  useEffect(() => {
    fetchServerChats().then((serverChats) => {
      if (serverChats && Object.keys(serverChats).length > 0) {
        setExtra(serverChats);
        localStorage.setItem("hub_chats", JSON.stringify(serverChats));
      }
    });
    fetchServerState().then((s) => {
      if (s) {
        if (Array.isArray(s.projects) && s.projects.length > 0) {
          setUserProjects(s.projects);
          localStorage.setItem("hub_projects", JSON.stringify(s.projects));
        }
        if (s.autoThreads && Object.keys(s.autoThreads).length > 0) {
          setAutoThreads(s.autoThreads);
          localStorage.setItem("hub_auto_threads", JSON.stringify(s.autoThreads));
        }
        if (s.shipMode && Object.keys(s.shipMode).length > 0) {
          setShipMode(s.shipMode);
          localStorage.setItem("hub_ship_mode", JSON.stringify(s.shipMode));
        }
      }
    }).finally(() => {
      // Only allow server pushes after the initial load settles, so an empty
      // browser session can't overwrite server-stored projects.
      hydratedRef.current = true;
    });
  }, []);

  // On change: save chats to localStorage + debounced push to server
  useEffect(() => {
    const toSave = {};
    for (const [tid, msgs] of Object.entries(extra)) {
      const clean = msgs.filter((m) => !m.streaming);
      if (clean.length) toSave[tid] = clean;
    }
    localStorage.setItem("hub_chats", JSON.stringify(toSave));
    if (!hydratedRef.current) return; // don't push until initial server load settles
    const timer = setTimeout(() => pushServerChats(toSave), 1500);
    return () => clearTimeout(timer);
  }, [extra]);

  // On change: save projects/autoThreads/shipMode to localStorage + debounced push to server
  useEffect(() => {
    saveStoredProjects(userProjects);
    saveAutoThreads(autoThreads);
    saveShipMode(shipMode);
    if (!hydratedRef.current) return; // don't push until initial server load settles
    const state = { projects: userProjects, autoThreads, shipMode };
    const timer = setTimeout(() => pushServerState(state), 1500);
    return () => clearTimeout(timer);
  }, [userProjects, autoThreads, shipMode]);

  useEffect(() => { if (feedRef.current) feedRef.current.scrollTop = 0; }, [memberId, projectId, tab]);

  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { justShipItRef.current = justShipIt; }, [justShipIt]);
  useEffect(() => { extraRef.current = extra; }, [extra]);
  useEffect(() => { autoThreadsRef.current = autoThreads; }, [autoThreads]);
  useEffect(() => { streamingRef.current = streaming; }, [streaming]);

  useEffect(() => {
    if (!project.goals) return;
    const proj = project;
    const nonDirectors = proj.members.filter(m => !m.director);
    if (!nonDirectors.length) return;
    let cancelled = false;
    async function tick() {
      // Don't compete with the founder's own message for the Claude subscription.
      if (streamingRef.current) return;
      for (const mem of nonDirectors) {
        if (cancelled || projectRef.current.id !== proj.id) break;
        if (streamingRef.current) break;
        if ((sessionCountRef.current[mem.id] || 0) >= 2) continue;
        if (workingRef.current[mem.id]) continue;
        await doAutoUpdate(mem, projectRef.current);
      }
    }
    const t1 = setTimeout(tick, 12000);
    const iv = setInterval(tick, 120000);
    return () => { cancelled = true; clearTimeout(t1); clearInterval(iv); };
  }, [projectId]);

  const threadsForCards = filtered.map((th) => ({ ...th, messages: msgsFor(th) }));

  return (
    <div className="app" data-density={t.density} data-card={t.cardStyle} data-tab={t.tabStyle}>
      {/* TOP NAV */}
      <nav className="topnav">
        <div className="topnav-brand">
          <div className="brand">
            <span className="brand-mark">◆</span>
            <span className="brand-name">Project&nbsp;Hub</span>
          </div>
          <button
            className={"just-ship-toggle" + (justShipIt ? " is-on" : "")}
            onClick={toggleShipMode}
            title={justShipIt ? "Autonomous — team decides independently. Click to switch." : "Collaborative — team asks questions. Click for autonomous."}
          >
            <span className="just-ship-dot" />
            {justShipIt ? "Autonomous" : "Collaborative"}
          </button>
          <ProjectSwitcher projects={allProjects} activeId={projectId} onSelect={selectProject} onNewProject={() => setShowNewProject(true)} />
        </div>
        <div className="topnav-members">
          <span className="topnav-members-label">Team</span>
          {project.members.map((m) => (
            <MemberPill key={m.id} member={m} active={m.id === memberId}
              isWorking={!!working[m.id]}
              onClick={() => selectMember(m.id)} />
          ))}
          {project.goals && Object.values(working).some(Boolean) && (
            <span className="live-badge"><span className="live-dot" />Live</span>
          )}
        </div>
        <div className="topnav-context">
          <span className="topnav-ctx-role">{member.role}</span>
          <span className="topnav-ctx-sep">·</span>
          <span className="topnav-ctx-desc">{member.desc}</span>
          <span className="topnav-ctx-spacer" />
          {member.director
            ? <span className="topnav-dir-chip">Daily briefing</span>
            : <span className="topnav-ctx-stage">
                <span style={{ width: 7, height: 7, borderRadius: 99, background: project.color, marginRight: 7, display: "inline-block", flexShrink: 0 }} />
                {project.stage}
              </span>
          }
        </div>
      </nav>

      {/* MAIN */}
      <main className="main">

        <ProjectGoalsBanner project={project} />
        <div className="datebar">
          {dateGroups.map((label, i) => (
            <button
              key={label}
              className={"date-pill" + (activeDateFilter === label ? " date-pill-active" : "")}
              onClick={() => setDateFilter(label)}
            >
              {label}
              {i === 0 && <span className="date-pill-badge">Latest</span>}
            </button>
          ))}
        </div>

        <div className="feed" ref={feedRef}>
          <div className="feed-inner">
            {working[member.id] && !member.director && (
              <div className="card card-loading">
                <div className="card-loading-inner">
                  <Avatar name={member.name} hue={member.avatarHue} size={18} />
                  <span className="card-loading-text">{member.name} is working on an update…</span>
                  <span className="card-loading-dots"><span /><span /><span /></span>
                </div>
              </div>
            )}
            {threadsForCards.length === 0 && !working[member.id] && (
              <div className="empty">
                <div className="empty-mark">
                  {member.director ? <span className="dir-avatar" style={{ width: 40, height: 40, fontSize: 16 }}>◆</span>
                                   : <Avatar name={member.name} hue={member.avatarHue} size={40} />}
                </div>
                <div className="empty-title">No updates from {member.director ? "the Director" : member.name} yet</div>
                <div className="empty-sub">Type a message below to start the conversation — {member.director ? "ask for a briefing" : `brief them as your ${member.role}`}.</div>
              </div>
            )}
            {threadsForCards.map((th) => (
              <ThreadCard key={th.id} thread={th} member={member} project={project}
                focused={focused && th.id === focused.id}
                onFocus={() => setFocusedId(th.id)}
                onDecide={() => decideForMe(th)}
                onAnswer={() => setFocusedId(th.id)} />
            ))}
          </div>
        </div>

        <div className="composer">
          <div className="composer-context">
            <span className="composer-to">
              {member.director
                ? <span className="dir-avatar" style={{ width: 20, height: 20, fontSize: 8 }}>◆</span>
                : <Avatar name={member.name} hue={member.avatarHue} size={20} />}
              <span className="composer-to-name">{member.director ? "Director" : member.name}</span>
              <span className="composer-to-role">{member.role}</span>
            </span>
            {focused && (
              <span className="composer-context-title">
                <span className="composer-context-label">in</span>
                <TypeDot type={focused.type} size={6} />{focused.title}
              </span>
            )}
          </div>
          <div className="composer-bar">
            <input
              className="composer-input"
              placeholder={streaming ? "Waiting for response…" : (member.director ? "Ask the Director for a briefing or a decision…" : `Message ${member.name}…`)}
              value={input}
              disabled={streaming}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button className="composer-send" onClick={send} disabled={!input.trim() || streaming} aria-label="Send">
              {streaming
                ? <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3" fill="currentColor" opacity="0.4"><animate attributeName="opacity" values="0.4;1;0.4" dur="1s" repeatCount="indefinite"/></circle></svg>
                : <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 8H13M13 8L8.5 3.5M13 8L8.5 12.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </button>
          </div>
        </div>
      </main>

      {/* TWEAKS */}
      <TweaksPanel>
        <TweakSection label="Density" />
        <TweakRadio label="Feed density" value={t.density}
          options={["compact", "cozy", "comfortable"]}
          onChange={(v) => setTweak("density", v)} />
        <TweakSection label="Cards" />
        <TweakRadio label="Card style" value={t.cardStyle}
          options={["flat", "bordered", "raised"]}
          onChange={(v) => setTweak("cardStyle", v)} />
        <TweakSection label="Tabs" />
        <TweakRadio label="Active tab" value={t.tabStyle}
          options={["underline", "pill"]}
          onChange={(v) => setTweak("tabStyle", v)} />
        <TweakSection label="AI source" />
        <TweakRadio label="Powered by" value={getMode()}
          options={[{ value: "proxy", label: "Claude Code" }, { value: "direct", label: "API key" }]}
          onChange={(v) => { setMode(v); window.location.reload(); }} />
        <TweakSection label="Integrations" />
        <TweakText label="Instagram" value={webhooks.instagram || ""} placeholder="hooks.zapier.com/…"
          onChange={(v) => updateWebhook("instagram", v)} />
        <TweakText label="Mailchimp" value={webhooks.mailchimp || ""} placeholder="hooks.zapier.com/…"
          onChange={(v) => updateWebhook("mailchimp", v)} />
        <TweakSection label="Account" />
        <button className="tweak-clear-key" onClick={() => { localStorage.removeItem("hub_chats"); pushServerChats({}); setExtra({}); }}>
          Clear all chat history
        </button>
        <button className="tweak-clear-key" onClick={() => { localStorage.removeItem("hub_api_key"); window.location.reload(); }}>
          Clear API key — re-enter on next load
        </button>
      </TweaksPanel>

      {action && (
        <ActionModal
          platform={action.platform}
          content={action.content}
          webhookUrl={action.webhookUrl}
          onCancel={() => setAction(null)}
          onDone={() => setAction(null)}
        />
      )}

      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} onDone={createProject} />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ApiKeyGate><App /></ApiKeyGate>
);
