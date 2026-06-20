// components.jsx — Project Hub UI pieces
const { useState, useEffect, useRef } = React;

function Avatar({ name, hue, size = 26 }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <span className="avatar" style={{
      width: size, height: size, fontSize: size * 0.4,
      background: `oklch(0.93 0.04 ${hue})`,
      color: `oklch(0.42 0.11 ${hue})`,
    }}>{initials}</span>
  );
}

function TypeDot({ type, size = 7 }) {
  const hue = window.HUB_DATA.types[type].hue;
  return <span className="type-dot" style={{ width: size, height: size, background: `oklch(0.6 0.16 ${hue})` }} />;
}

const FIELD_MAP = {
  proposal: [["problem", "Problem"], ["proposal", "Proposal"], ["whyNow", "Why now"], ["ask", "The ask"]],
  learning: [["signal", "Signal"], ["learning", "What we learned"], ["implication", "Implication"]],
  hygiene:  [["area", "Area"], ["__status", "Status"], ["detail", "Detail"], ["recommendation", "Recommendation"]],
  blocker:  [["blockedOn", "Blocked on"], ["impact", "Impact"], ["need", "Need from you"]],
  status:   [["overview", "Overview"], ["onTrack", "On track"], ["attention", "Needs attention"], ["blockers", "Blockers"], ["focus", "Today's focus"]],
  script:   [["format", "Format"], ["hook", "Opening hook"], ["affirmation", "Affirmation"], ["close", "Close"], ["duration", "Notes"]],
};

function StatusPill({ status }) {
  const map = {
    healthy: { label: "Healthy", hue: 150 },
    watch:   { label: "Watch",   hue: 75 },
    risk:    { label: "At risk", hue: 25 },
  };
  const s = map[status] || map.watch;
  return (
    <span className="status-pill" style={{
      color: `oklch(0.45 0.13 ${s.hue})`,
      background: `oklch(0.95 0.04 ${s.hue})`,
      borderColor: `oklch(0.88 0.06 ${s.hue})`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: `oklch(0.6 0.16 ${s.hue})` }} />
      {s.label}
    </span>
  );
}

function StructuredBody({ type, body }) {
  const fields = FIELD_MAP[type] || [];
  return (
    <div className="struct">
      {fields.map(([key, label]) => {
        if (key === "__status") {
          return (
            <div className="struct-row" key={key}>
              <div className="struct-label">{label}</div>
              <div className="struct-val"><StatusPill status={body.status} /></div>
            </div>
          );
        }
        if (!body[key]) return null;
        return (
          <div className="struct-row" key={key}>
            <div className="struct-label">{label}</div>
            <div className="struct-val">{body[key]}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Inline markdown: **bold** only
function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part || null;
  });
}

// ── Inline code (`backtick`)
function renderInlineWithCode(text) {
  const parts = text.split(/(`[^`]+`)/);
  return parts.map((p, i) => {
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) {
      return <code key={i} className="msg-inline-code">{p.slice(1, -1)}</code>;
    }
    return renderInline(p) || null;
  });
}

// ── Block renderer: code fences, headers, paragraphs, bullets, numbered lists
function renderTextBlocks(raw, keyPrefix, isLastSection, streaming) {
  const blocks = raw.split(/\n\n+/);
  return blocks.map((block, bi) => {
    const isLast = isLastSection && bi === blocks.length - 1;
    const lines = block.split("\n");
    const nonEmpty = lines.filter((l) => l.trim());

    // Heading (## or ###)
    if (nonEmpty.length === 1 && /^#{1,3}\s/.test(nonEmpty[0])) {
      const level = nonEmpty[0].match(/^(#+)/)[1].length;
      const content = nonEmpty[0].replace(/^#+\s/, "");
      const Tag = level <= 2 ? "h4" : "h5";
      return <Tag key={`${keyPrefix}-${bi}`} className={`msg-h${level}`}>{renderInlineWithCode(content)}</Tag>;
    }

    // Bullet list
    if (nonEmpty.length && nonEmpty.every((l) => /^[\-\*]\s/.test(l.trimStart()))) {
      return (
        <ul key={`${keyPrefix}-${bi}`} className="msg-list">
          {nonEmpty.map((l, li) => (
            <li key={li}>
              {renderInlineWithCode(l.replace(/^[\s\-\*]+/, ""))}
              {isLast && li === nonEmpty.length - 1 && streaming && <span className="caret" />}
            </li>
          ))}
        </ul>
      );
    }

    // Numbered list
    if (nonEmpty.length && nonEmpty.every((l) => /^\d+\.\s/.test(l.trimStart()))) {
      return (
        <ol key={`${keyPrefix}-${bi}`} className="msg-list">
          {nonEmpty.map((l, li) => (
            <li key={li}>
              {renderInlineWithCode(l.replace(/^\d+\.\s+/, ""))}
              {isLast && li === nonEmpty.length - 1 && streaming && <span className="caret" />}
            </li>
          ))}
        </ol>
      );
    }

    return (
      <p key={`${keyPrefix}-${bi}`} className="msg-para">
        {lines.map((line, li) => (
          <span key={li}>
            {renderInlineWithCode(line)}
            {li < lines.length - 1 && <br />}
          </span>
        ))}
        {isLast && streaming && <span className="caret" />}
      </p>
    );
  });
}

function copyCode(text) {
  navigator.clipboard.writeText(text).catch(() => {});
}

// Shared cache of which cross-check models the server has keys for
let _modelsCache = null;
function useAvailableModels() {
  const [models, setModels] = React.useState(_modelsCache || { openai: false, gemini: false });
  React.useEffect(() => {
    if (_modelsCache) return;
    fetch("/api/models").then((r) => r.json()).then((m) => { _modelsCache = m; setModels(m); }).catch(() => {});
  }, []);
  return models;
}

// ── Persisted cross-check reviews (keyed by content hash, synced to server) ──
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return Math.abs(h).toString(36);
}
let _reviewsCache = null;
let _reviewsLoad = null;
function loadReviews() {
  if (_reviewsCache) return Promise.resolve(_reviewsCache);
  if (_reviewsLoad) return _reviewsLoad;
  let local = {};
  try { local = JSON.parse(localStorage.getItem("hub_reviews") || "{}"); } catch {}
  _reviewsLoad = fetch("/api/reviews")
    .then((r) => r.json())
    .then((server) => { _reviewsCache = { ...local, ...server }; return _reviewsCache; })
    .catch(() => { _reviewsCache = local; return _reviewsCache; });
  return _reviewsLoad;
}
function saveReview(key, entry) {
  _reviewsCache = { ...(_reviewsCache || {}), [key]: entry };
  localStorage.setItem("hub_reviews", JSON.stringify(_reviewsCache));
  fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(_reviewsCache),
  }).catch(() => {});
}

function renderMsgText(text, streaming) {
  const raw = text || "";
  const parts = [];
  let last = 0;
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) parts.push({ type: "text", content: raw.slice(last, m.index) });
    parts.push({ type: "code", lang: m[1] || "", content: m[2] });
    last = m.index + m[0].length;
  }
  if (last < raw.length) parts.push({ type: "text", content: raw.slice(last) });

  return parts.map((part, pi) => {
    if (part.type === "code") {
      const [copied, setCopied] = [false, () => {}]; // placeholder — use component below
      return <CodeBlock key={pi} lang={part.lang} code={part.content.trimEnd()} />;
    }
    return renderTextBlocks(part.content, pi, pi === parts.length - 1, streaming);
  });
}

function PreviewModal({ code, onClose }) {
  const isHtml = /<(!DOCTYPE|html|head|body)/i.test(code);
  const src = isHtml ? code : `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:system-ui,sans-serif;padding:24px;background:#fafafa;color:#222}</style></head><body><pre style="white-space:pre-wrap;font-size:13px">${code.replace(/</g,"&lt;")}</pre></body></html>`;
  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <span className="preview-title">Preview</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="preview-open-btn" onClick={() => {
              const blob = new Blob([code], { type: "text/html" });
              window.open(URL.createObjectURL(blob), "_blank");
            }}>Open in tab ↗</button>
            <button className="action-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <iframe className="preview-iframe" srcDoc={src} sandbox="allow-scripts allow-same-origin" title="App preview" />
      </div>
    </div>
  );
}

const CROSS_LABELS = { openai: "ChatGPT", gemini: "Gemini" };
function CrossCheckPanel({ content, context }) {
  const models = useAvailableModels();
  const [running, setRunning] = React.useState(null);   // model id currently running
  const [results, setResults] = React.useState({});     // { [model]: { text, ts } }
  const [errors, setErrors] = React.useState({});       // { [model]: { msg, needsKey } }
  const keyOf = (model) => hashStr(content) + "-" + model;

  // Load any previously-saved reviews for this exact content
  React.useEffect(() => {
    let alive = true;
    loadReviews().then((all) => {
      if (!alive) return;
      const found = {};
      ["openai", "gemini"].forEach((m) => { if (all[keyOf(m)]) found[m] = all[keyOf(m)]; });
      if (Object.keys(found).length) setResults((r) => ({ ...found, ...r }));
    });
    return () => { alive = false; };
  }, [content]);

  async function review(model) {
    setRunning(model);
    setErrors((e) => ({ ...e, [model]: null }));
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, content, context }),
      });
      const data = await res.json();
      if (data.text) {
        const entry = { text: data.text, ts: Date.now() };
        setResults((r) => ({ ...r, [model]: entry }));
        saveReview(keyOf(model), entry);
      } else {
        setErrors((e) => ({ ...e, [model]: { msg: data.error || "Review failed.", needsKey: !!data.needsKey } }));
      }
    } catch {
      setErrors((e) => ({ ...e, [model]: { msg: "Couldn't reach the server.", needsKey: false } }));
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="crosscheck">
      <div className="crosscheck-head">
        <span className="crosscheck-label">Cross-check with another model</span>
        <div className="crosscheck-btns">
          {["openai", "gemini"].map((m) => {
            const has = !!results[m];
            return (
              <button key={m} className="crosscheck-btn"
                disabled={running !== null || (!models[m] && _modelsCache)}
                onClick={() => review(m)}>
                {running === m ? "Reviewing…" : (has ? "Re-run " + CROSS_LABELS[m] : CROSS_LABELS[m])}
                {_modelsCache && !models[m] && " (no key)"}
              </button>
            );
          })}
        </div>
      </div>
      {["openai", "gemini"].map((m) => results[m] && (
        <div className="crosscheck-result" key={m}>
          <span className="crosscheck-result-by">{CROSS_LABELS[m]}'s review · saved</span>
          <div className="crosscheck-result-body">{renderMsgText(results[m].text, false)}</div>
        </div>
      ))}
      {["openai", "gemini"].map((m) => errors[m] && (
        <div className="crosscheck-error" key={m}>
          {errors[m].msg}
          {errors[m].needsKey && (
            <div className="crosscheck-hint">
              Set the key in your terminal before launching the server, e.g.{" "}
              <code>{m === "gemini" ? "export GEMINI_API_KEY=…" : "export OPENAI_API_KEY=…"}</code>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CodeBlock({ lang, code }) {
  const [copied, setCopied] = React.useState(false);
  const [previewing, setPreviewing] = React.useState(false);
  const [publishState, setPublishState] = React.useState("idle"); // idle | publishing | done | error
  const [publishedUrl, setPublishedUrl] = React.useState("");
  const [linkCopied, setLinkCopied] = React.useState(false);
  const [crossOpen, setCrossOpen] = React.useState(false);
  const [hasReview, setHasReview] = React.useState(false);
  const isPreviewable = lang === "html" || (!lang && /<(!DOCTYPE|html)/i.test(code));
  const lineCount = React.useMemo(() => code.split("\n").length, [code]);
  const isLong = lineCount > 14;
  const [collapsed, setCollapsed] = React.useState(isLong); // long blocks start collapsed

  React.useEffect(() => {
    let alive = true;
    loadReviews().then((all) => {
      if (!alive) return;
      const k = hashStr(code);
      if (all[k + "-openai"] || all[k + "-gemini"]) setHasReview(true);
    });
    return () => { alive = false; };
  }, [code]);

  function doCopy() {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function doPublish() {
    setPublishState("publishing");
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, id: "app" }),
      });
      const data = await res.json();
      if (data.path) {
        setPublishedUrl(window.location.origin + data.path);
        setPublishState("done");
      } else {
        setPublishState("error");
      }
    } catch {
      setPublishState("error");
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(publishedUrl).catch(() => {});
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1800);
  }

  return (
    <>
      <div className="msg-code">
        <div className="msg-code-header">
          <button className="msg-code-toggle" onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand code" : "Collapse code"}>
            <span className={"msg-code-caret" + (collapsed ? "" : " is-open")}>▶</span>
            {lang && <span className="msg-code-lang">{lang}</span>}
            <span className="msg-code-lines">{lineCount} lines</span>
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            {isPreviewable && (
              <button className="msg-code-preview" onClick={() => setPreviewing(true)}>Preview ▶</button>
            )}
            {isPreviewable && (
              <button className="msg-code-publish" onClick={doPublish} disabled={publishState === "publishing"}>
                {publishState === "publishing" ? "Publishing…" : publishState === "done" ? "Published ✓" : "Publish ↗"}
              </button>
            )}
            <button className={"msg-code-cross" + (crossOpen ? " is-open" : "")} onClick={() => setCrossOpen((o) => !o)}>
              Cross-check ⚖{hasReview && <span className="msg-code-cross-badge">✓</span>}
            </button>
            <button className="msg-code-copy" onClick={doCopy}>{copied ? "Copied ✓" : "Copy"}</button>
          </div>
        </div>
        {collapsed
          ? <button className="msg-code-collapsed" onClick={() => setCollapsed(false)}>
              {lineCount} lines hidden — click to expand
            </button>
          : <pre className="msg-code-pre"><code>{code}</code></pre>}
        {crossOpen && <CrossCheckPanel content={code} context={"This is " + (lang || "code") + " produced by an AI team member."} />}
        {publishState === "done" && (
          <div className="msg-code-published">
            <span className="msg-code-published-label">Live link</span>
            <a className="msg-code-published-url" href={publishedUrl} target="_blank" rel="noreferrer">{publishedUrl}</a>
            <button className="msg-code-published-copy" onClick={copyLink}>{linkCopied ? "Copied ✓" : "Copy link"}</button>
          </div>
        )}
        {publishState === "error" && (
          <div className="msg-code-published msg-code-published-error">Couldn't publish — is the local server running?</div>
        )}
      </div>
      {previewing && <PreviewModal code={code} onClose={() => setPreviewing(false)} />}
    </>
  );
}

function dateLabel(m) {
  if (m && typeof m === "object" && m.ts) {
    const d = new Date(m.ts);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yest = new Date(today); yest.setDate(yest.getDate() - 1);
    const dd = new Date(d); dd.setHours(0, 0, 0, 0);
    if (dd.getTime() === today.getTime()) return "Today";
    if (dd.getTime() === yest.getTime()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  const t = (m && typeof m === "object" ? m.time : m) || "";
  if (/^today/i.test(t))     return "Today";
  if (/^yesterday/i.test(t)) return "Yesterday";
  const mm = t.match(/^([A-Za-z]+ \d+)/);
  return mm ? mm[1] : "Earlier";
}

function groupByDate(messages) {
  const groups = [];
  const idx = {};
  messages.forEach(m => {
    const label = dateLabel(m);
    if (idx[label] === undefined) { idx[label] = groups.length; groups.push({ label, msgs: [] }); }
    groups[idx[label]].msgs.push(m);
  });
  return groups;
}

const THINKING_PHASES = ["Thinking", "Working on it", "Drafting a response", "Almost there"];
function ThinkingIndicator({ name }) {
  const [phase, setPhase] = React.useState(0);
  React.useEffect(() => {
    const iv = setInterval(() => setPhase((p) => Math.min(p + 1, THINKING_PHASES.length - 1)), 4000);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="thinking">
      <span className="thinking-dots"><span /><span /><span /></span>
      <span className="thinking-label">{name ? name + " is " + THINKING_PHASES[phase].toLowerCase() : THINKING_PHASES[phase]}…</span>
    </div>
  );
}

function ThreadMessages({ messages, member }) {
  const groups = React.useMemo(() => groupByDate(messages), [messages]);
  const latestLabel = groups.length ? groups[groups.length - 1].label : null;
  const [active, setActive] = React.useState(latestLabel);

  if (!messages.length) return null;

  const activeGroup = groups.find(g => g.label === active) || groups[groups.length - 1];

  return (
    <div className="thread-msgs">
      {groups.length > 1 && (
        <div className="msg-tabs">
          {groups.map((g, gi) => {
            const isLatest = gi === groups.length - 1;
            const isActive = g.label === (active || latestLabel);
            return (
              <button
                key={g.label}
                className={"msg-tab" + (isActive ? " msg-tab-active" : "")}
                onClick={() => setActive(g.label)}
              >
                {g.label}
                {isLatest && <span className="msg-tab-badge">Latest</span>}
              </button>
            );
          })}
        </div>
      )}
      <div className="msg-tab-body">
        {activeGroup && activeGroup.msgs.map((m, i) => (
          <div className={"msg msg-" + m.from} key={i}>
            <div className="msg-meta">
              {m.from === "member"
                ? <><Avatar name={member.name} hue={member.avatarHue} size={20} /><span>{member.name}</span></>
                : <span className="msg-you">You</span>}
              <span className="msg-time">{m.time}</span>
            </div>
            <div className="msg-text">
              {m.streaming && !m.text
                ? <ThinkingIndicator name={m.from === "member" ? member.name : null} />
                : renderMsgText(m.text, m.streaming)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThreadCard({ thread, member, project, focused, onFocus, onDecide, onAnswer }) {
  const t = window.HUB_DATA.types[thread.type] || window.HUB_DATA.types.status;
  const isQuestion = thread.type === "question";
  const hasReply = thread.messages && thread.messages.some(m => m.from === "founder");
  return (
    <article
      className={"card" + (focused ? " card-focused" : "") + (isQuestion ? " card-question" : "")}
      style={{ "--accent-hue": t.hue }}
      onClick={onFocus}
    >
      <div className="card-rail" />
      <header className="card-head">
        <div className="card-type">
          {isQuestion
            ? <span className="question-mark">?</span>
            : <TypeDot type={thread.type} />}
          <span className="card-type-label">{isQuestion ? "Needs your input" : t.label}</span>
        </div>
        <span className="card-time">{thread.time}</span>
      </header>
      <h3 className="card-title">{thread.title}</h3>
      <StructuredBody type={thread.type} body={thread.body} />
      <ThreadMessages messages={thread.messages} member={member} />
      {isQuestion && !hasReply && (
        <div className="question-actions" onClick={(e) => e.stopPropagation()}>
          <button className="question-btn-answer" onClick={onAnswer}>Answer</button>
          <button className="question-btn-decide" onClick={onDecide}>Decide for me</button>
        </div>
      )}
      <footer className="card-foot">
        <span className="card-project">
          <span className="card-project-dot" style={{ background: project.color }} />
          {project.name}
        </span>
        {focused
          ? <span className="card-replying">Replying here →</span>
          : <span className="card-reply-hint">{isQuestion && !hasReply ? "Type your answer below" : "Click to reply in this thread"}</span>}
      </footer>
    </article>
  );
}

function DirectorAvatar({ size = 30 }) {
  return (
    <span className="dir-avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>◆</span>
  );
}

function MemberRow({ member, active, onClick }) {
  const isDir = !!member.director;
  return (
    <button
      className={"member-row" + (active ? " is-active" : "") + (isDir ? " is-director" : "")}
      onClick={onClick}
    >
      {isDir
        ? <DirectorAvatar size={30} />
        : <Avatar name={member.name} hue={member.avatarHue} size={30} />}
      <span className="member-body">
        <span className="member-name">{member.name}</span>
        <span className="member-types">
          {member.types.map((t) => (
            <span className="member-type" key={t}>
              <TypeDot type={t} size={6} />{window.HUB_DATA.types[t].label}
            </span>
          ))}
        </span>
      </span>
      <span className="member-short" style={isDir ? { background: "oklch(0.93 0.05 182)", color: "oklch(0.42 0.13 182)", borderColor: "oklch(0.84 0.08 182)" } : {}}>{member.short}</span>
    </button>
  );
}

function splitGoals(text) {
  const t = (text || "").trim();
  if (!t) return [];
  // Prefer explicit lines / bullet markers
  let parts = t.split(/\n+/).map((s) => s.replace(/^[\s\-*•\d.]+/, "").trim()).filter(Boolean);
  // Single blob → split into sentences so it still reads as points
  if (parts.length <= 1) {
    parts = t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  }
  return parts;
}

function ProjectGoalsBanner({ project }) {
  const [expanded, setExpanded] = React.useState(false);
  if (!project.goals) return null;
  const points = splitGoals(project.goals);
  const COLLAPSED = 2;
  const hasMore = points.length > COLLAPSED;
  const shown = expanded ? points : points.slice(0, COLLAPSED);
  return (
    <div className={"goals-banner" + (expanded ? " is-expanded" : "")}>
      <div className="goals-banner-icon">◎</div>
      <div className="goals-banner-body">
        <span className="goals-banner-label">Project goals</span>
        <ul className="goals-banner-list">
          {shown.map((pt, i) => <li key={i}>{pt}</li>)}
        </ul>
      </div>
      {hasMore && (
        <button className="goals-banner-toggle" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Less" : `+${points.length - COLLAPSED} more`}
        </button>
      )}
    </div>
  );
}

Object.assign(window, { Avatar, DirectorAvatar, MemberRow, TypeDot, StatusPill, StructuredBody, ThreadMessages, ThreadCard, ProjectGoalsBanner });
