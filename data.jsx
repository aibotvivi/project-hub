// data.jsx — placeholder data for Project Hub (Jazz Radar · Attune · Tilt)
// TODO: replace [bracket] fields with real project context as it develops.

(function () {
  const TYPES = {
    proposal: { id: "proposal", label: "Proposal", plural: "Proposals", hue: 255 },
    learning: { id: "learning", label: "Learning", plural: "Learnings", hue: 300 },
    hygiene:  { id: "hygiene",  label: "Hygiene",  plural: "Hygiene",   hue: 75  },
    blocker:  { id: "blocker",  label: "Blocker",  plural: "Blockers",  hue: 25  },
    status:   { id: "status",   label: "Status",   plural: "Status",    hue: 182 },
    script:   { id: "script",   label: "Script",   plural: "Scripts",   hue: 150 },
  };

  // Convert relative strings ("2h ago", "Today", "Yesterday", "3d ago") to real timestamps
  function fmtTime(str) {
    const now = new Date();
    const clock = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const date  = (d) => d.toLocaleDateString([], { month: "short", day: "numeric" });

    let m = (str || "").match(/^(\d+)h\s*ago$/i);
    if (m) { const d = new Date(now - +m[1] * 3600000); return `Today, ${clock(d)}`; }

    m = (str || "").match(/^(\d+)d\s*ago$/i);
    if (m) { const d = new Date(now - +m[1] * 86400000); return `${date(d)}, ${clock(d)}`; }

    if (/^today$/i.test(str))     return `Today, ${clock(now)}`;
    if (/^yesterday$/i.test(str)) { const d = new Date(now - 86400000); return `Yesterday, ${clock(d)}`; }

    return str; // already formatted — pass through
  }

  let _tid = 0;
  function thread(type, title, time, body, messages) {
    _tid += 1;
    return { id: "t" + _tid, type, title, time: fmtTime(time), body, messages: messages || [] };
  }
  function msg(from, text, time) { return { from, text, time: fmtTime(time) }; }

  // =========================================================================
  // JAZZ RADAR — jazz discovery & radar app
  // TODO: update with real product context
  // =========================================================================
  const jazzRadar = {
    id: "jazz-radar",
    name: "Jazz Radar",
    tagline: "Discover jazz you actually want to hear",
    color: "oklch(0.58 0.16 30)",
    stage: "Alpha · private testing",
    members: [
      {
        id: "jr-pm", name: "Product Manager", role: "Product Manager", short: "PM",
        avatarHue: 30,
        desc: "Owns the discovery loop and listener retention.",
        types: ["proposal", "learning"],
        threads: [
          thread("proposal", "Surface 'why this track' before the listener skips", "2h ago", {
            problem: "Users who skip in the first 15 seconds never return to that track — and often churn faster. We have no signal on why.",
            proposal: "Add a one-line 'why we picked this' under each track card — mood match, similar to X artist, trending in Y city.",
            whyNow: "Skip rate is our leading churn indicator. Reducing it 20% is this quarter's north-star.",
            ask: "Approve a 1-week design spike to test copy variants before building personalisation logic.",
          }, [
            msg("member", "Skip-rate data is clean enough to act on now — happy to walk through the funnel cut if useful.", "2h ago"),
          ]),
          thread("learning", "Listeners trust curators more than algorithms", "Yesterday", {
            signal: "Tracks surfaced via named curator playlists have 3.4× lower skip rate than algorithm-only recommendations.",
            learning: "Jazz listeners are sceptical of cold algorithms. A named human voice — even fictional — changes the trust dynamic.",
            implication: "Lean into editorial framing. Every recommendation should feel like a tip from a knowledgeable friend, not a ranked list.",
          }),
        ],
      },
      {
        id: "jr-tl", name: "Tech Lead", role: "Tech Lead", short: "TL",
        avatarHue: 200,
        desc: "Owns the recommendation pipeline and data infra.",
        types: ["hygiene", "blocker"],
        threads: [
          thread("hygiene", "Spotify API token refresh is silent on failure", "5h ago", {
            area: "Auth · Spotify API",
            status: "risk",
            detail: "When the OAuth token expires mid-session, the refresh call fails silently and the player stalls. Users see a spinner with no error.",
            recommendation: "Add explicit error handling on token refresh + a user-facing 'reconnect Spotify' prompt. Small fix, high impact on perceived reliability.",
          }),
          thread("hygiene", "Recommendation cache has no TTL", "3d ago", {
            area: "Performance · Cache",
            status: "watch",
            detail: "The in-memory recommendation cache grows unbounded per session. Fine at current scale, but will OOM under load.",
            recommendation: "Set a 30-minute TTL and cap at 500 entries. Estimated 30 minutes of work.",
          }),
        ],
      },
      {
        id: "jr-ux", name: "UX Lead", role: "UX Lead", short: "UX",
        avatarHue: 320,
        desc: "Owns the player experience and discovery flows.",
        types: ["learning", "proposal"],
        threads: [
          thread("learning", "The 'vibe dial' is loved but misplaced", "4h ago", {
            signal: "88% of users interact with the mood/vibe filter, but 60% only find it after their first track skip.",
            learning: "The vibe dial is the core differentiator — users light up when they find it. It's buried.",
            implication: "Promote it above the fold on the discovery screen. It shouldn't require discovery itself.",
          }),
          thread("proposal", "Let listeners annotate a moment in a track", "2d ago", {
            problem: "Jazz has micro-moments — a solo, a chord change — that listeners want to share. We have no way to capture that.",
            proposal: "A tap-to-mark gesture during playback that saves a timestamped note. Share as a link to that exact moment.",
            whyNow: "This is a social hook and a retention feature in one — listeners who annotate return to review their marks.",
            ask: "A 3-day design exploration before committing to eng.",
          }, [
            msg("member", "Prototype is already sketched — it's simpler than it sounds. Want to see it?", "2d ago"),
          ]),
        ],
      },
      {
        id: "jr-ga", name: "Growth Analyst", role: "Growth Analyst", short: "GA",
        avatarHue: 40,
        desc: "Owns acquisition channels, funnels, and listener LTV.",
        types: ["learning", "proposal"],
        threads: [
          thread("learning", "Referrals from 'share a track' convert at 4× the average", "1h ago", {
            signal: "Share-a-track links have a 31% install conversion rate vs 8% for paid social.",
            learning: "Listeners sharing specific tracks is the highest-intent acquisition signal we have. We're not amplifying it.",
            implication: "Add a frictionless share card to every track with a referral code baked in. We're leaving installs on the table.",
          }, [
            msg("member", "I can model the referral coefficient by Thursday — want me to run the numbers before we pitch eng?", "1h ago"),
          ]),
          thread("proposal", "Run a 'first week in jazz' email drip for new signups", "Yesterday", {
            channel: "Email · Onboarding",
            whyNow: "Day-7 retention is 22%. Users who receive at least one email in week 1 retain at 38%. We send nothing.",
            whatSuccess: "Day-7 retention lifts from 22% → 30%+ for the drip cohort.",
            effort: "Quick",
          }),
        ],
      },
    ],
  };

  // =========================================================================
  // ATTUNE — nervous system regulation via sound
  // =========================================================================
  const attune = {
    id: "attune",
    name: "Attune",
    tagline: "Sound healing for your nervous system",
    color: "oklch(0.6 0.13 195)",
    stage: "Pre-launch · waitlist open",
    members: [
      {
        id: "at-pm", name: "Product Manager", role: "Product Manager", short: "PM",
        avatarHue: 195,
        desc: "Owns the waitlist funnel and pre-launch strategy.",
        types: ["proposal", "learning"],
        threads: [
          thread("proposal", "Capture emails at the waitlist — not just Spotify follows", "3h ago", {
            problem: "The waitlist form submits to local state only. No email is captured to a backend. We're building an audience we can't contact.",
            proposal: "Wire the form to a simple email service (Resend + Airtable, or Mailchimp). Takes half a day.",
            whyNow: "Every week we delay is audience we can't retarget at launch. This is the highest-leverage hour we can spend.",
            ask: "Approve the integration. I'd suggest Resend + a simple Airtable base to keep it free until launch.",
          }, [
            msg("member", "This is blocking the entire pre-launch funnel. Happy to spec the exact implementation.", "3h ago"),
          ]),
          thread("learning", "Spotify playlist strategy is the fastest path to audience", "Yesterday", {
            signal: "Music therapy and nervous system regulation are trending on Spotify — playlists in that space are growing 40%+ YoY.",
            learning: "Building an audience via Spotify playlists before the app launches validates demand with zero product risk.",
            implication: "Prioritise 2–3 curated playlists as the first content asset. Each playlist is a funnel entry point.",
          }),
        ],
      },
      {
        id: "at-tl", name: "Tech Lead", role: "Tech Lead", short: "TL",
        avatarHue: 230,
        desc: "Owns the Next.js site, infra, and future app stack.",
        types: ["hygiene", "blocker"],
        threads: [
          thread("hygiene", "No analytics on the landing page", "6h ago", {
            area: "Observability · Analytics",
            status: "risk",
            detail: "The landing page has zero analytics. We don't know how many people visit, where they drop, or how long they stay. We're flying blind before launch.",
            recommendation: "Add Plausible or PostHog (both have free tiers). 20-minute setup. Do this before any paid traffic.",
          }),
          thread("hygiene", "Email form has no backend — silent data loss", "2d ago", {
            area: "Data · Waitlist form",
            status: "risk",
            detail: "The waitlist form submits to React state only. Form submissions are lost on page refresh. This is likely happening with real visitors now.",
            recommendation: "Block: wire to a real email endpoint before running any marketing. See PM proposal for stack choice.",
          }),
        ],
      },
      {
        id: "at-ux", name: "UX Lead", role: "UX Lead", short: "UX",
        avatarHue: 280,
        desc: "Owns the landing page experience and brand feel.",
        types: ["learning", "proposal"],
        threads: [
          thread("learning", "The hero doesn't communicate what 'nervous system regulation' means", "4h ago", {
            signal: "User tests show 4 out of 6 people couldn't say what the app does after reading the headline.",
            learning: "The phrase 'nervous system regulation' reads as clinical or academic to people outside the wellness space.",
            implication: "Lead with the felt experience — 'calm your nervous system in 10 minutes' — not the mechanism. Test a reframe.",
          }),
          thread("proposal", "Add a 60-second audio preview to the landing page", "Yesterday", {
            problem: "Visitors can read about the sound experience but can't feel it. The product is sensory — the page isn't.",
            proposal: "Embed a 60-second sample track directly on the landing page, auto-played muted with an unmute CTA.",
            whyNow: "Conversion from visit → waitlist signup is currently unknown (no analytics), but this is the single most likely lever.",
            ask: "One day of design + content to produce the sample and integrate it.",
          }, [
            msg("member", "I have a Figma comp ready for the audio player embed — can show at the next sync.", "Yesterday"),
          ]),
        ],
      },
    ],
  };

  // =========================================================================
  // SOUND HEALING — nervous system regulation through sound
  // Team drawn from awesome-claude-code-subagents:
  //   product-manager · content-marketer · ux-researcher · competitive-analyst
  // =========================================================================
  const soundHealing = {
    id: "sound-healing",
    name: "Sound Healing",
    tagline: "Nervous system regulation through sound",
    color: "oklch(0.6 0.13 280)",
    stage: "Brand building · audience first",
    members: [
      {
        id: "sh-pm", name: "Product Manager", role: "Product Manager", short: "PM",
        avatarHue: 280,
        desc: "Owns brand strategy, audience roadmap, and product direction.",
        types: ["proposal", "learning"],
        threads: [
          thread("proposal", "Build the Spotify audience before the app — not after", "Today", {
            problem: "There's no proven demand signal yet. Building the app first risks spending months on something the audience hasn't asked for.",
            proposal: "Launch 2–3 Spotify playlists in the next 30 days as the primary audience validation. Treat follower growth and save rate as the product's first north-star metrics.",
            whyNow: "Spotify's editorial team surfaces new playlists in niche categories fast. The nervous system regulation space has low supply and clear search intent.",
            ask: "Commit to a 30-day Spotify content sprint before any further app development. This is a low-cost, high-signal bet.",
          }, [
            msg("member", "I can draft the playlist brief and success metrics today — just need a go/no-go on the 30-day sprint framing.", "Today"),
          ]),
          thread("learning", "The audience calls it 'nervous system' — not 'sound healing'", "Yesterday", {
            signal: "Spotify search data and Reddit communities use 'nervous system regulation', 'vagus nerve', and 'somatic' — not 'sound healing', which skews toward new-age/spiritual.",
            learning: "The brand name matters less than the language used in descriptions, playlist titles, and tags. The audience has specific vocabulary.",
            implication: "Use clinically adjacent but accessible language throughout: 'regulate', 'calm your nervous system', 'somatic sound'. Reserve 'healing' for secondary copy only.",
          }),
        ],
      },
      {
        id: "sh-cm", name: "Content Marketer", role: "Content Marketer", short: "CM",
        avatarHue: 195,
        desc: "Owns Spotify strategy, social content, and distribution.",
        types: ["proposal", "learning", "script"],
        threads: [
          thread("proposal", "Name playlists after states, not genres", "Today", {
            problem: "Genre-named playlists ('ambient', 'binaural') don't surface in intent-based Spotify searches. People search for what they want to feel, not the format.",
            proposal: "Name playlists after the desired nervous system state: 'Calm After Stress', 'Morning Regulation', 'Deep Rest Before Sleep'. This matches search intent and positions us as a guide, not a DJ.",
            whyNow: "Spotify's algorithm weights title match to search query heavily for playlist discovery in the first 90 days.",
            ask: "Approve 3 playlist names this week so I can start optimising descriptions and cover art for search.",
          }),
          thread("learning", "Short-form content about 'why it works' outperforms the tracks themselves", "2d ago", {
            signal: "TikTok and Instagram accounts explaining the science behind nervous system sounds (vagus nerve, 40Hz gamma, 432Hz) get 10–50× more reach than posts sharing the music directly.",
            learning: "The audience wants to understand the mechanism before they trust the content. Education drives conversion to listeners.",
            implication: "Lead with 'why this sound regulates your nervous system' in every piece of social content. The track is the proof — the science is the hook.",
          }),
          thread("proposal", "Three Instagram launch captions for Waves by Chin", "Today", {
            problem: "We need to establish the Instagram voice for Waves by Chin. First post sets the tonal standard for everything that follows.",
            proposal: "A ✦ RECOMMENDED — \"The bowl doesn't ask you to be ready. It just asks you to be present. 🎶 Sound healing session dropping this week — come as you are.\" #soundhealing #tibetanbowl #wavesbyichin #soundbath #healingfrequencies #somatichealing #nervoussystemreset\n\nB — \"Some things can't be thought through. They have to be felt through. ✨ That's what the bowls are for. New sound healing video now live — link in bio.\" #soundhealing #soundbath #innerpeace #meditationmusic #healingjourney #432hz #chinesemedicine\n\nC — \"Your nervous system knows the way home. The sound just reminds it. 🫧 20-minute sound healing for when words aren't enough.\" #soundhealing #nervoussystemhealing #tibetansingingbowls #wavesbyichin #somatic #healingcommunity #meditationvibes",
            whyNow: "A wins: most conversational and lowest barrier to entry. 'Come as you are' removes the wellness gatekeeping that turns new audiences off. C has the strongest concept but lands better once the brand has an established audience that knows what somatic means. B is solid but middle-of-pack.",
            ask: "Approve Option A and I'll post it to Instagram immediately via Zapier — or reply with any edits to any of the three.",
          }, [
            msg("member", "Option A is ready to go. Just say the word and I'll post it — no other setup needed.", "Today"),
          ]),
          thread("proposal", "Waves by Chin YouTube — Bazi vs Astrology vs Tarot rotation", "Today", {
            problem: "The channel needs a weekly posting rhythm and a clear answer on which affirmation format builds the most loyal audience fastest.",
            proposal: "Twice weekly: Astrology (Mon) as the reach anchor, Bazi (Thu) as the differentiation play. Tarot/I-Ching once a month as a high-share special. Reels: 60–90 sec. Long form: 5–10 min to start, scaling to 10–20 min for sound healing sessions. Every video closes with the bowl strike — that's the Waves by Chin signature.",
            whyNow: "Astrology wins for discoverability — 10× higher search volume. Bazi wins for differentiation — almost no English-language Bazi creators in the healing space. At month 3, blend them as 'Your Bazi Element + This Week's Astrology' — a format nobody owns. Tarot/I-Ching pulls are the most shareable and saved format in this niche.",
            ask: "Confirm the twice-weekly rhythm and I'll prep the first 4 Astrology scripts + 2 Bazi scripts this week.",
          }, [
            msg("member", "The bowl strike at the end of every video is the right brand anchor. People will start waiting for it — that's how they remember you.", "Today"),
          ]),
          thread("script", "Script A — Astrology Affirmation Reel", "Today", {
            format: "Western Astrology · 60–90 sec · best for reach & algorithmic growth",
            hook: "This week, the energy asks you to slow down before you speak. Mercury is moving through [sign], and there's a tension between what you know and what you feel ready to say.",
            affirmation: "So today's affirmation is this — say it with me:\n\nI trust my timing. What is meant for me will not miss me. I release the urgency.\n\nSay it again. Slower.\n\nI trust my timing. What is meant for me will not miss me. I release the urgency.\n\nBreathe.",
            close: "[Pick up the bowl. Strike once. Let it ring out fully.]\n\nThat sound is your reset. Carry it with you this week.",
            duration: "Update [sign] each week · No music needed · Film in one take · End on the bowl ring",
          }, [
            msg("member", "This format compounds best over time. It's the anchor of the rotation — post it every Monday.", "Today"),
          ]),
          thread("script", "Script B — Bazi Element Affirmation Reel", "Today", {
            format: "Chinese Bazi · 60–90 sec · your long-term brand differentiator",
            hook: "In Chinese metaphysics, we're all born with a dominant element — Wood, Fire, Earth, Metal, or Water. And right now, the seasonal energy is [e.g. Wood rising / Fire season].\n\nIf you're a Wood person — this is your time to grow, but not to force.\nIf you're a Water person — you're being asked to trust your own depth.",
            affirmation: "No matter your element, this week's affirmation is the same:\n\nI am aligned with the natural rhythm of my life. I grow at the pace I was designed for.\n\nOne more time:\n\nI am aligned with the natural rhythm of my life. I grow at the pace I was designed for.",
            close: "[Strike the bowl.]\n\nThat's your anchor for the week.",
            duration: "Swap in current Bazi season each week · Post Thursdays · Almost no one in English does this — own it",
          }, [
            msg("member", "This is the format nobody else on YouTube is doing in English. It's slower to grow but the audience it builds is yours for life.", "Today"),
          ]),
          thread("script", "Script C — Tarot / I-Ching Affirmation Reel", "Today", {
            format: "Tarot or I-Ching · 60–90 sec · highest share & save rate of all three formats",
            hook: "[Open on a card being drawn or hexagram being shown]\n\nI pulled this for the collective energy this week — [e.g. The Star / Hexagram 29: Water].\n\nThis is an invitation to return to yourself. Not to fix anything. Not to push. Just to return.",
            affirmation: "The affirmation that came with this pull:\n\nI am not lost. I am returning. And returning is enough.\n\nSay it:\n\nI am not lost. I am returning. And returning is enough.",
            close: "[Strike the bowl. Hold the frame on the bowl ringing out.]\n\nTrust what came up for you just now.",
            duration: "Pull a real card before filming · Post monthly as a special · This format gets shared most — caption matters",
          }, [
            msg("member", "This one gets saved and shared more than anything else in the niche. Use it as the monthly spike, not the weekly anchor.", "Today"),
          ]),
        ],
      },
      {
        id: "sh-ux", name: "UX Researcher", role: "UX Researcher", short: "UXR",
        avatarHue: 320,
        desc: "Owns audience research, listening behaviour, and experience insights.",
        types: ["learning", "hygiene"],
        threads: [
          thread("learning", "People listen alone, in the dark, lying down", "3h ago", {
            signal: "5 listener interviews revealed a consistent pattern: all 5 listen at night, in bed, with eyes closed and phone face-down. Two use sleep timers.",
            learning: "This is a private, horizontal, eyes-closed experience — not background music. The product interaction model should reflect that: zero visual friction once play starts.",
            implication: "Any future app UI must be designed for one-tap start and no need to look at the screen again. Complexity after play begins is a UX failure.",
          }),
          thread("hygiene", "Spotify artist profile has no bio or link", "Yesterday", {
            where: "Spotify for Artists · Profile",
            what: "The artist profile has no biography, no website link, and no social handles. When someone discovers a playlist and clicks through to the artist, they hit a dead end.",
            fix: "Add a 150-word bio using the audience's language ('nervous system', 'regulation', 'somatic'), link to the waitlist, and connect Instagram.",
          }),
        ],
      },
      {
        id: "sh-ca", name: "Competitive Analyst", role: "Competitive Analyst", short: "CA",
        avatarHue: 40,
        desc: "Owns market positioning and competitive intelligence.",
        types: ["learning", "proposal"],
        threads: [
          thread("learning", "Calm and Headspace don't own the sound space — they abandoned it", "4h ago", {
            signal: "Calm's 'Sleep Stories' and Headspace's soundscapes peaked in 2021. Both have deprioritised pure audio — their roadmaps are moving toward AI coaching and therapy.",
            learning: "The two biggest players in the space are retreating from exactly what Sound Healing does. This is a real opening, not a crowded market.",
            implication: "Position explicitly as the audio-first alternative: 'no talking, no courses, no subscriptions — just sound that works'. Their retreat validates the category.",
          }, [
            msg("member", "I have a full competitor matrix ready — 12 players across Spotify, apps, and YouTube. Want me to share the positioning gaps?", "4h ago"),
          ]),
          thread("proposal", "Claim 'somatic audio' as the category name before anyone else does", "2d ago", {
            channel: "Category creation · SEO + PR",
            whyNow: "No one is using 'somatic audio' consistently yet. It combines clinical credibility (somatic therapy) with accessibility. Google search volume is low but trending, and zero competitors own the phrase.",
            whatSuccess: "Sound Healing is cited as the source of the 'somatic audio' category in at least 3 publications within 6 months.",
            effort: "Medium",
          }),
          thread("learning", "What makes sound healing videos dominate YouTube — competitive breakdown", "Today", {
            signal: "Top-performing sound healing videos (1M+ views) share four consistent patterns: Hz-specific or intention-led titles ('963Hz | Open Your Crown Chakra | 20 Min Sound Bath'), problem-first framing ('for anxiety', 'for sleep'), dark/black thumbnails with a single glowing bowl and no face, and timestamped YouTube chapters. Long-form (20–60 min) outperforms short on watch hours. Loopable endings drive the most total minutes watched.",
            learning: "The 0:00–0:30 spoken intention + 0:30–1:30 breath or body scan + sustained sound structure consistently holds viewers past the 30% watch-time threshold that YouTube's algorithm rewards. Thumbnails with faces underperform instruments in this niche — the bowl is the face. Channels that add chapters see 40–60% higher click-through on suggested videos.",
            implication: "Waves by Chin's bowl strike signature is the right closing anchor — mirror it with a 30-second opening intention to bookend each session. Structure every sound healing video: (1) spoken intention 0:00–0:30, (2) breath guide 0:30–1:30, (3) sustained bowl healing, (4) gentle close + bowl strike. Thumbnail formula: black background, single glowing bowl, gold or white minimal text, no face. Add chapters. Write description SEO with Hz, intention, and duration. Make the ending loop cleanly.",
          }, [
            msg("member", "The bowl strike at the end is exactly the kind of signature the top channels wish they'd built in from day one. Don't drop it.", "Today"),
          ]),
        ],
      },
    ],
  };

  // =========================================================================
  // WAVES MUSIC — ADHD & Relationship Healing Music · practitioner quality
  // Team: Prompt Engineer · Post-Production · Content Creator · Growth
  // =========================================================================
  const wavesMusic = {
    id: "waves-music",
    name: "Waves Music",
    tagline: "ADHD & relationship healing music — practitioner quality",
    color: "oklch(0.52 0.17 235)",
    stage: "Production · Vol. 1 in progress",
    members: [
      {
        id: "wm-pe", name: "Prompt Engineer", role: "Prompt Engineer", short: "PE",
        avatarHue: 235,
        desc: "Owns AI music generation, prompt strategy, and the shortlist process.",
        types: ["proposal", "learning", "hygiene"],
        threads: [
          thread("proposal", "GMIV framework — the formula for every Suno prompt", "Today", {
            problem: "Generic prompts produce generic output. The Creative Director's intention doc is specific — the prompt must be equally specific or the gap between brief and output stays wide.",
            proposal: "Use the GMIV structure for every prompt:\n\nG — Genre: 1–2 specific genres (not 'ambient' — 'drumless ambient', 'somatic lo-fi')\nM — Mood: one emotional anchor ('the feeling of your chest unclenching after sustained anxiety' — not 'calm')\nI — Instruments: 2–4 named (singing bowl, sparse piano, soft acoustic guitar, breath sounds)\nV — Vibe: one scene-setting sentence ('feels like breathing slowing in a warm room, no urgency anywhere')\n\nExample prompt:\n'Drumless ambient, somatic lo-fi. Aching-but-held emotional tone. Singing bowl, sparse piano, soft breath sounds. Feels like the first exhale after three days of low-grade anxiety. Wide reverb, no sharp transients, nothing above 8kHz that could startle. 5 minutes, fades to silence.'",
            whyNow: "Prompt quality is the single biggest lever on output quality. The Creative Director's time is the bottleneck — a bad prompt costs a full review cycle.",
            ask: "Use this framework for every prompt. Deviate only with a written reason.",
          }, [
            msg("member", "Never use artist names. Describe the feel: 'glacial piano, wide reverb, feels like breathing slowing' — not 'sounds like Brian Eno'. Description always beats reference.", "Today"),
          ]),
          thread("proposal", "Batch protocol — 3 variants, 15–20 tracks, rate immediately", "Today", {
            problem: "Generating one track at a time and hoping it lands is luck, not process. Systematic batching gives the Creative Director genuine quality options and reveals what the brief can actually produce.",
            proposal: "Per brief received:\n1. Write 3 prompt variants — change one variable each time (mood anchor, or one instrument, or the vibe sentence — not the whole prompt at once)\n2. Generate 5–7 tracks per variant = 15–21 total\n3. Rate each track immediately after first listen — not after comparing all 20. Score 1 (miss) / 2 (possible) / 3 (strong)\n4. Surface only 3/3 tracks to the Creative Director — maximum 3–5 files\n5. Include: track file, 3–5 mood tag candidates, one sentence on why it meets the brief\n\nWhen no 3/3 tracks emerge: write a short diagnostic — which variable was wrong, adjusted approach — and run another batch. Do not surface 2/3 tracks to fill a quota.",
            ask: "Never send raw dumps of 20 files. The shortlist discipline is what makes the Creative Director's review useful rather than exhausting.",
          }),
          thread("hygiene", "Prompt Library — what to log, how to rate, why it compounds", "Today", {
            area: "Knowledge management · Prompt quality",
            status: "action",
            detail: "Every prompt that produces a 3/3 track gets logged immediately:\n\n— Exact prompt wording (copy/paste — no paraphrase)\n— Brief it was written for (nervous system state + emotional arc)\n— Mood tags it maps to (2–3 words)\n— Generation settings (Suno tier, any style tags)\n— Track file reference\n— One note on why this prompt worked\n\nOrganise by sub-niche: ADHD regulation / Relationship healing / Sleep. Minimum 3 entries per sub-niche before the library is considered useful.",
            recommendation: "The Prompt Library is the compounding asset of this role. Iteration time on brief #10 should be half of brief #1. If it isn't, the library isn't being used.",
          }),
          thread("learning", "What makes a track fail the quality gate — pre-filter these before surfacing", "Today", {
            signal: "Tracking rejection reasons shows 80% of failures fall into four categories: sudden volume shifts, melodic hooks that grab attention (bad for ADHD regulation), busy high-frequency content above 8kHz, and tracks that sustain a mood rather than moving through one.",
            learning: "Pre-filtering for these before surfacing anything saves a review cycle. The Creative Director's quality question is: would I play this in an actual sound healing session? If the answer is uncertain, it's a reject.",
            implication: "Add a 60-second check to every track before rating it 3/3: (1) no volume spikes, (2) nothing that makes you focus on the music rather than sink into it, (3) no harsh high frequencies, (4) does it have an arc — does it feel slightly different at minute 1 vs minute 5?",
          }),
        thread("learning", "Three listener states — what each one needs from the music", "Today", {
          signal: "Polyvagal theory identifies three autonomic states relevant to every track. The Track Intention Doc section 02 must name which state the listener starts in and which they move toward. Same destination, different starting points, different sound requirements.",
          learning: "Sympathetic (fight/flight): racing thoughts, shallow breath, high cortisol. Where most ADHD listeners start. Needs slow entrainment, no demands, no surprises. Enter below the listener's current arousal threshold — lead quietly before leading anywhere.\n\nVentral vagal (safe and connected): soft focus, slowed breath, body feels heavy, emotionally present. The target end state for both ADHD and attachment healing tracks. Requires 6–20 minutes of sustained exposure — not 3.\n\nDorsal vagal (shutdown/freeze): numb, dissociated, emotionally flat. Where many relationship healing listeners start after heartbreak or emotional withdrawal. Critically different from calm — it is not low arousal, it is disconnection. Needs gentle upward activation — subtle warmth and rhythm — not more stillness. A 'calm' track designed for sympathetic activation will deepen freeze in a dorsal vagal listener.",
          implication: "Know which state transition each track is for before writing a single prompt word. ADHD focus: sympathetic → ventral vagal (entrainment approach). Heartbreak: dorsal vagal → gentle activation (warmth + subtle pulse needed, not more quiet). Anxious attachment: sympathetic → ventral vagal (similar to ADHD but emotional rather than cognitive framing). These are different briefs that require different prompts.",
        }),
        thread("learning", "Healing frequencies — use these in every Track Intention Doc and prompt", "Today", {
          signal: "Polyvagal research establishes a direct anatomical connection between sound and the autonomic nervous system via the vagus nerve. Specific frequencies have measurable effects on nervous system state. The target audience already knows these terms and searches for them on Spotify.",
          learning: "432 Hz tuning — warmer, softer base than 440 Hz standard. Specify in every Suno prompt as a default.\n\n40–60 Hz sub bass — felt somatically in the chest and body, not just heard. Grounding for dissociation and freeze states. Essential for relationship healing tracks. Tell Post-Production: do not roll off sub frequencies in the master.\n\n10 Hz alpha binaural — ADHD focus and regulation. Requires headphones to work. Always state this in descriptions and reel captions.\n\n4–8 Hz theta binaural — deep relaxation and emotional processing. For relationship healing tracks.\n\n528 Hz solfeggio — reduced cortisol in studies. The audience knows this by name. Include in titles and metadata tags.\n\n396 Hz solfeggio — associated with releasing fear and guilt. Strong resonance with attachment healing listeners specifically.",
          implication: "Every Track Intention Doc specifies which frequency applies. Every Suno prompt includes the relevant Hz or tuning. This is not flavour — it is what the audience is searching for on Spotify and YouTube, and it directly informs the track's functional design.",
        }),
        thread("hygiene", "Intention Doc #1 — ADHD Regulation · Sympathetic → Ventral Vagal", "Today", {
          area: "ADHD regulation · Nervous System Resets Series Vol. 1",
          status: "ready to brief",
          detail: "01 · The Listener\nShe is 32. It is 11pm. She has been context-switching since 7am — nothing finished, everything half-done. Her jaw is tight. She opened three apps looking for something to help and couldn't decide. She puts her phone face-down. She needs something that doesn't ask anything of her.\n\n02 · Nervous System State\nStart: sympathetic activation — racing internal monologue, chest tight, cannot land on a single thought.\nMin 0–2: the track enters below her arousal threshold. No melodic hook. No beat. Just texture that doesn't demand attention.\nMin 2–4: the track begins to anchor. Breath slows slightly without instruction.\nMin 4–6: the internal monologue quiets. The system is no longer trying to manage itself — it has stopped.\nEnd state: ventral vagal. Body feels heavy. Eyes would close if she let them.\n\n03 · The Sound\nGenre: drumless ambient, somatic lo-fi\nTuning: 432 Hz\nBinaural: 10 Hz alpha (headphones required — note in all descriptions and captions)\nTempo feel: no tempo. No pulse. Sustained texture only.\nInstruments: singing bowl (arc marker only, not constant texture), sparse piano (wide reverb, long sustain, no pedal chatter), breath sounds (barely audible, grounding)\nNO: melodic hooks, sudden volume changes, anything above 8kHz, percussion of any kind, dense arrangement, musical 'decisions' that grab attention\n\n04 · One-Line Brief\nThe music that holds the space while an ADHD nervous system stops trying to manage itself.\n\n05 · Reference Tracks\nSatoshi & Makoto — 'cf. (coda)' | Removes the sense of time passing without replacing it with anything. Borrow: the wide reverb that makes piano feel like memory, not music.\nHarold Budd — 'Arabesque' | Demonstrates that restraint is not emptiness — each note has enormous space around it. Borrow: the willingness to leave silence unresolved.\nBrian Eno — 'Ambient 1: Music for Airports' | The reference point for non-demanding texture. Borrow: the feeling that the music would be fine if no one was listening.\n\n06 · Production Notes\nPost-Production: bowl strike at min 3 as the release arc marker. Preserve 40–60 Hz sub — do not roll off. Wide reverb on piano, no dry signal. Headphone note required in all delivered metadata and descriptions.\nContent Creator: Canvas loop — cool tones, slow particles or breath condensation on glass, no warm colours. Reel hook angle: emotional mirror ('If your brain has 47 tabs open and none of them are loading, this is for you').\n\n07 · Pipeline Tracker\nSuno shortlist → Creative Director approval → Post-Production hybrid layer → Mastered WAV delivered → Spotify editorial pitch → DistroKid upload → Release\nAll stages: pending",
          recommendation: "Suno starting prompt: 'Drumless ambient, somatic lo-fi, 432Hz tuning, 10Hz alpha binaural, sparse piano wide reverb long sustain, singing bowl single strike midpoint only, breath sounds barely audible, no melody, no percussion, no transients above 8kHz, 6 minutes, fades to silence.' Generate 3 variants, 5–7 tracks each. Surface only 3/3 rated tracks.",
        }),
        thread("hygiene", "Intention Doc #2 — Relationship Healing · Dorsal Vagal → Gentle Activation", "Today", {
          area: "Relationship healing · Secure Attachment Series Vol. 1",
          status: "ready to brief",
          detail: "01 · The Listener\nHe is 29. It has been six weeks since the relationship ended and he is not sad anymore — he is nothing. He is lying on the floor of his flat at 2pm on a Saturday. He ate something this morning but doesn't remember what. He is not in pain. He is absent.\n\n02 · Nervous System State\nStart: dorsal vagal — shutdown, dissociated, emotionally flat. This is not calm. It is disconnection. A track that adds more stillness will deepen the freeze, not lift it.\nMin 0–2: warmth enters before asking anything. Sub frequencies arrive in the body before the mind registers sound. The track signals safety without demanding a response.\nMin 2–4: the faintest pulse introduces — not rhythm, not percussion, but the sense that something is moving. The system is coaxed upward, not pushed.\nMin 4–6: warmth accumulates without resolution. No emotional climax. Just the gentle sensation of being slightly more present than before.\nEnd state: not ventral vagal yet. A step toward it. Enough to get off the floor.\n\n03 · The Sound\nGenre: warm ambient, emotional chamber\nTuning: 396 Hz solfeggio (releasing fear and guilt — resonates with attachment healing listeners by name; use in titles and tags)\nSub bass: 40–60 Hz preserved in the master — the somatic entry point for a dorsal vagal listener. Critical.\nTempo feel: the faintest pulse — not a beat, a heartbeat. Approximately 55 BPM if it exists at all.\nInstruments: soft acoustic guitar (fingerpicked, no sharp attack), strings — cello or viola only (warmer register than violin), singing bowl (warmth arrival marker, not release)\nNO: more stillness (deepens freeze), cold or metallic textures, silence that feels like absence rather than held space, bright high frequencies, sentimentality\n\n04 · One-Line Brief\nMusic that coaxes a shutdown nervous system upward without demanding anything of it.\n\n05 · Reference Tracks\nNils Frahm — 'Says' | Creates a felt sense of something beginning, without naming what. Borrow: the gradual texture accumulation that doesn't announce itself.\nMax Richter — 'On the Nature of Daylight' | Holds emotional weight without tipping into grief. Borrow: the cello register choice — warmth over ache.\nLudovico Einaudi — cautionary reference: his work tips toward sentimentality. This track must feel held, not moving. The difference is restraint in the arrangement.\n\n06 · Production Notes\nPost-Production: bowl strike at min 1:30 — arrival marker, not release (different placement than ADHD tracks). Sub frequencies are critical — do not roll off below 60 Hz under any circumstances. Warmer reverb settings than the ADHD Regulation series. Live cello is the ideal hybrid element if available.\nContent Creator: Canvas loop — amber and rose tones, slow water or candlelight, no cool tones. Reel hook angle: emotional mirror ('If you've been numb for weeks and don't know how to start feeling again, this is a starting place').\n\n07 · Pipeline Tracker\nSuno shortlist → Creative Director approval → Post-Production hybrid layer → Mastered WAV delivered → Spotify editorial pitch → DistroKid upload → Release\nAll stages: pending",
          recommendation: "Suno starting prompt: 'Warm ambient, emotional chamber, 396Hz solfeggio, sub bass 40-60Hz preserved, soft acoustic guitar fingerpicked no sharp attack, cello or viola strings warm register, faint pulse 55BPM barely perceptible, no percussion, no cold textures, no bright highs, 7 minutes, builds very slowly from almost nothing.' Generate 3 variants. Prioritise warmth and sub frequency presence in rating over any other quality.",
        }),
        ],
      },
      {
        id: "wm-post", name: "Post-Production", role: "Post-Production", short: "POST",
        avatarHue: 280,
        desc: "Owns hybrid layer recording, mastering, and final WAV delivery.",
        types: ["hygiene", "proposal", "learning"],
        threads: [
          thread("proposal", "Singing bowls are the highest-value hybrid layer for this project", "Today", {
            problem: "Fully AI-generated tracks are excluded from Spotify's Discover Weekly and Release Radar. One human-performed layer changes the classification to 'AI-assisted' — which is eligible. The choice of layer matters beyond the technical fix.",
            proposal: "The Creative Director's singing bowl is the right instrument for every track that can accommodate it. It is: (1) authentically connected to the practitioner's practice, (2) distinctly human — impossible to fake algorithmically, (3) harmonically complementary to ambient textures, (4) the brand signature for Waves by Chin.\n\nProcess: extract stems with Moises.ai → record bowl strike or sustained ring in the Creative Director's space → blend into the mix at a level that feels native, not layered on top → this human element reclassifies the track.\n\nFor tracks where bowl doesn't fit sonically: soft live piano breath or acoustic guitar. Document what was used and why.",
            ask: "Bowl layer for every track, minimum. Record in the same space each time — room consistency becomes part of the brand signature.",
          }, [
            msg("member", "Blending matters as much as recording. The bowl should feel like it grew out of the track, not like it was placed on top of it.", "Today"),
          ]),
          thread("hygiene", "Export and delivery checklist — every file, every time", "Today", {
            area: "Audio quality · Distribution",
            status: "action",
            detail: "Before handing off any track to Growth + Content Creator:\n\n□ Stems extracted with Moises.ai or RipX before any layering\n□ Hybrid layer recorded and blended (not stacked on a busy mix)\n□ Quality check: no jarring transients, no sudden volume shifts, no harsh content above 8kHz\n□ Mastered to –14 LUFS integrated (Spotify standard)\n□ Peaks under –1 dBFS — no clipping\n□ Exported as 24-bit WAV, 44.1kHz minimum\n□ Suno auto-title and AI-identifying metadata wiped completely\n□ Clean metadata text file delivered alongside: track title, artist name, 2 genre labels, 3–5 mood tags, release year\n□ File named: Series_Vol_TrackName_FINAL.wav\n\nNever deliver an MP3. DistroKid requires WAV for quality and to avoid additional platform compression on upload.",
            recommendation: "100% of tracks pass this checklist before handoff. One exception becomes a precedent.",
          }),
          thread("learning", "Why –14 LUFS — what over-compression does to healing music", "Today", {
            signal: "Spotify normalises all tracks to –14 LUFS on playback. Tracks mastered louder are turned down; quieter tracks are turned up. The loudness war is over on streaming — but the dynamic range damage from over-compression is permanent and irreversible after export.",
            learning: "Healing music's emotional impact comes from dynamic range — the difference between the quiet moments and the slightly less quiet moments. A track mastered to –8 LUFS to 'sound louder' has had that range crushed. When Spotify normalises it to –14 LUFS, you get a squashed, fatiguing sound — the opposite of what these tracks need to do therapeutically.",
            implication: "Master to –14 LUFS and protect the dynamics. The soft moments are doing as much work as the full moments. Leave space in the mix — silence and breath are instrumentation.",
          }),
        thread("learning", "Tibetan bowls as arc markers — placement over texture", "Today", {
          signal: "Polyvagal research on Tibetan bowls: their complex harmonic overtones activate the social engagement system — the neural circuit that processes safe human connection. This is why they feel emotionally safe, not just acoustically pleasant. At close range (or with sub frequencies preserved in the master), bowl vibrations are felt in the chest — the somatic response bypasses the cognitive filter.",
          learning: "Used correctly: a single bowl strike is a moment of felt state change — the listener's nervous system recognises it as a transition signal. Used constantly: it becomes background texture and loses its effect entirely.\n\nPlacement guide for a 6–8 minute track:\n— 0:30–1:00 — arrival marker: a single strike to signal 'you have arrived, you can stop now'\n— 4:00–5:00 — release marker: the moment the emotional arc reaches resolution\n— Final 15 seconds — completion: a long ring that fades to silence, the signal to stay in the state\n\nRecord in the same room every time. Room consistency becomes part of the brand signature.",
          implication: "When receiving an approved Suno file, identify where in the emotional arc a bowl strike belongs — not where it sounds good, but where it serves the intended state transition documented in the Intention Doc section 02. Document the placement decision in the stem extraction report so the Creative Director can review it.",
        }),
        ],
      },
      {
        id: "wm-cc", name: "Content Creator", role: "Content Creator", short: "CC",
        avatarHue: 150,
        desc: "Owns Reels, Shorts, Spotify Canvas loops, and the discovery hook strategy.",
        types: ["proposal", "learning", "script"],
        threads: [
          thread("proposal", "Three hook templates to rotate — the discovery engine", "Today", {
            problem: "Most listeners will encounter this music for the first time in a 15-second reel. The hook decides whether they stop or scroll. One hook type won't work for every audience segment — rotating three templates and tracking performance tells us which angle to double down on.",
            proposal: "Rotate across every release, minimum 4–6 clips per track:\n\n1. Science/frequency angle — 'This frequency activates your parasympathetic nervous system. Here's what that sounds like.' Appeals to the intellectually curious ADHD brain that wants to understand the mechanism.\n\n2. Emotional mirror — 'If your nervous system feels like a browser with 47 tabs open, this is for you.' Meets the listener exactly where they are, no toxic positivity, no instruction to feel better.\n\n3. Practitioner behind-the-scenes — the Creative Director working with a bowl, in their space. No explanation needed. The authenticity is the hook.\n\nCaption structure is fixed: hook line (under 125 characters) → what the track does → 'Full track on Spotify, link in bio' → 7–10 hashtags. Don't reinvent per post.",
            ask: "Batch all 4–6 clips per track in one production session before release. No reactive posting — schedule in advance.",
          }, [
            msg("member", "Cover the audio and watch the first 1.5 seconds. If the visual alone doesn't create curiosity, the reel won't hold. That's the only test that matters before posting.", "Today"),
          ]),
          thread("proposal", "Spotify Canvas loop — spec and delivery for every release", "Today", {
            problem: "Spotify Canvas (the looping video in the player) increases save rate meaningfully. Listeners who see a Canvas save tracks at higher rates. It takes 2 hours to produce and it is one of the lowest-effort, highest-return deliverables in the whole pipeline.",
            proposal: "Spec for every track:\n— Duration: 3–8 seconds, seamless loop (no visible cut point)\n— Format: MP4, 1080×1920 (vertical)\n— Visual: abstract only — slow particles, water, soft geometric movement, nature macro (dewdrop, smoke, light through leaves)\n— No text. No face. No instrument close-up.\n— Colour mood: relationship healing tracks use warmer tones (amber, rose, soft gold). ADHD regulation tracks use cooler tones (blue, green, grey).\n— Delivery: uploaded via Spotify for Artists the same day the track goes live.",
            ask: "Canvas delivered for 100% of releases. Block 2 hours per track into the release schedule.",
          }),
          thread("learning", "The aesthetic that converts in this niche — and what breaks it", "Today", {
            signal: "Accounts in the nervous system / healing / ADHD space with 10K–100K followers consistently use: slow motion macro footage, natural textures (water, smoke, hands on instruments), cool or warm muted palettes, minimal or no text overlay. Fast cuts, jump cuts, loud sound effects, and talking-head content underperform significantly.",
            learning: "The aesthetic is doing nervous system work before the music even starts. An ADHD or anxious viewer who encounters a jarring visual cut before they hear the track is already dysregulated. The reel has to feel as safe as the music.",
            implication: "No jump cuts. No loud sound effects. No dramatic text animations. The reel should feel like a preview of what the track does — calm arrival is the brand. If the edit would feel at home in a gym promo, it's wrong for this project.",
          }),
        thread("learning", "The listener journey — six stages from stranger to ritual user", "Today", {
          signal: "Listeners who return daily are not returning because the music is good. They return because the music is theirs — it belongs to a specific moment in their life. Content at each stage must serve that stage's goal, not try to do everything at once.",
          learning: "Stage 1 — Discovery: A Reel or Spotify playlist drops them in cold. No context, no trust. The track does all the talking.\n\nStage 2 — First result: They feel something in the first 6 minutes. They save it. This is the most critical moment — the track must deliver a felt result, not just a pleasant experience. 'I used that track and I actually settled' is what creates a Stage 3 listener.\n\nStage 3 — Ritual formation: They use it 3× in the same context. It becomes 'their' track. They are now a user, not a listener.\n\nStage 4 — Channel discovery: They find YouTube. They subscribe for the series. This is where practitioner voice and readings matter — without a human to subscribe to, there is nothing to return for.\n\nStage 5 — Weekly habit: The I Ching or tarot reading becomes appointment content. They return on a schedule, like a podcast.\n\nStage 6 — Community member: Comments, shares, membership, waitlist for 1:1 sessions. Monetisation endpoint.",
          implication: "Every piece of content serves one specific stage. A Reel gets someone to save a track (Stage 1 → 2). A reading video keeps a subscriber returning (Stage 4 → 5). A community question in comments builds belonging (Stage 5 → 6). Don't try to do all six stages in one post — decide which stage it's for and optimise for that.",
        }),
        ],
      },
      {
        id: "wm-growth", name: "Growth", role: "Growth & Playlist Outreach", short: "GRW",
        avatarHue: 40,
        desc: "Owns Spotify editorial pitching, curator outreach, and weekly metrics.",
        types: ["proposal", "learning", "hygiene"],
        threads: [
          thread("proposal", "Save rate is the primary signal — not stream count", "Today", {
            problem: "Stream count is visible and tempting to optimise for. But a track with 10,000 streams and a 5% save rate is performing worse algorithmically than one with 2,000 streams and a 25% save rate.",
            proposal: "Track and report in this priority order:\n\n1. Save rate (target: 10–20% minimum) — the primary signal Spotify uses to decide whether to amplify a track further\n2. Stream-to-listener ratio (target: 1.5+) — a ratio above 1.5 means people are returning, which is the strongest retention signal\n3. Skip rate (ceiling: under 40%) — high skip rate actively suppresses algorithmic reach\n4. Top playlist sources — which placements are driving real engagement vs inflated stream counts\n\nWeekly snapshot delivered to Creative Director every Monday. Flag in red if save rate drops below 10% or skip rate rises above 40%.",
            ask: "Every month: identify the 1–2 tracks with the highest save rates and report them as 'the sound that's resonating'. This feeds directly into the next month's creative direction.",
          }, [
            msg("member", "A 500-follower playlist with a 25% save rate is worth more than a 50K-follower playlist at 2%. Placement quality over placement size.", "Today"),
          ]),
          thread("proposal", "Curator outreach tracker — building the 50–100 playlist database", "Today", {
            problem: "Mass-submit tools and generic outreach get ignored by independent curators. Personalised pitches to the right playlists with the right context convert. Building that context takes time — it needs to be done once, properly.",
            proposal: "Tracker columns: playlist name, curator handle/contact, follower count, sub-niche match (ADHD focus / healing / ambient / sleep / relationship), date pitched, personalisation note, response, placement status, streams driven.\n\nPersonalisation formula: 'I noticed your playlist includes [specific track by another artist]. Our track [name] sits in a similar emotional space — it's designed for [nervous system state]. Here's the Spotify link.'\n\nTarget: 10–15 personalised pitches per release from a pre-researched database of 50–100 playlists. The database grows with every release.",
            ask: "First 50 curators researched and logged before Vol. 1 release date. Pitched within release week.",
          }),
          thread("hygiene", "Spotify editorial pitch — the 7-day window is the hardest deadline", "Today", {
            area: "Spotify for Artists · Editorial submission",
            status: "action",
            detail: "The editorial pitch window opens when DistroKid submission is accepted and closes exactly 7 days before release date. Miss it and it cannot be reopened for that release.\n\nWhat the pitch must include (generic pitches are rejected by Spotify curators):\n— Exact mood: not 'ambient' — 'the feeling of arriving home after sustained emotional tension'\n— Activity context: therapy journaling, late-night study, ADHD focus work, anxious attachment healing\n— Listener type: spiritually-inclined adults 25–40, in therapy or doing inner work\n— Why this track fits a specific editorial mood or activity playlist\n— Instrumentation note: the singing bowl hybrid layer is worth naming — it signals human craft in an AI-saturated category\n\nSet a calendar reminder the moment DistroKid submission is accepted. Pitch that same day.",
            recommendation: "Submit the moment the release date is confirmed — not the day before the window closes. Curators receive thousands of pitches; early submissions get more review time.",
          }),
          thread("learning", "Daylist tagging — why multiple mood tags compound over time", "Today", {
            signal: "Spotify Daylist refreshes up to 6 times per day based on the listener's context and time of day. It is constructed from mood tags in track metadata — not just genre or listening history.",
            learning: "A track tagged with only one mood ('calm') surfaces in one Daylist context. A track tagged 'focus + calm + grounding + late-night + regulate' can surface in multiple Daylist states across the same day — reaching the same listener repeatedly without them choosing to replay it.",
            implication: "Every track needs 3–5 mood tags in metadata: e.g. 'focus, calm, grounding, late-night, regulate'. Submit these via DistroKid's genre/mood fields at upload. This is the lowest-effort algorithmic lever available and most projects don't use it intentionally.",
          }),
        thread("proposal", "One channel — all series on Waves by Chin", "Today", {
          problem: "The instinct is to separate healing music and divination readings into different channels — they feel like different content. Splitting them resets the algorithm for each channel, divides the subscriber base, and means neither channel reaches critical mass.",
          proposal: "Everything lives on one channel, organised by named playlist series:\n\n— Nervous System Resets (long-form healing music, 30–60 min)\n— ADHD Focus Sessions\n— Secure Attachment Series (relationship healing tracks)\n— Monthly I Ching / 梅花易數 Reading\n— Weekly Tarot / 八字 Reading\n\nThe same person drawn to ADHD regulation music is also drawn to I Ching for self-understanding — they are the same spiritually-inclined adult at different moments in their week. One channel serves all their moments and accumulates algorithmic weight as a single entity.\n\nSeries naming also activates YouTube's recommendation engine — listeners who watch one series are recommended the next. The algorithm learns the audience once and serves all content to them.",
          whyNow: "Series names are the Creative Director's decision, locked in the Track Intention Doc before the first brief. 'Nervous System Resets Vol. 1' trains listeners to expect Vol. 2. A generic track title trains them to forget it.",
          ask: "Confirm series naming structure before Vol. 1 production starts. These names frame the entire catalogue.",
        }),
        thread("learning", "What breaks the return habit — six failure modes to avoid", "Today", {
          signal: "Listeners who use healing music ritually are highly retainable — but the habit is fragile. All six patterns that break it are within the team's control.",
          learning: "1. Inconsistent release cadence — irregular posting breaks the habit loop and the algorithm deprioritises the channel. Release less, predictably, rather than more, randomly.\n\n2. Generic titles — 'Relaxing ambient music' competes with 10,000 channels. 'ADHD focus music — dopamine regulation without overstimulation' speaks to one person directly and is found via search.\n\n3. No practitioner voice — without a human anchor, there is nothing to subscribe to. Audio-only channels do not build subscriber relationships.\n\n4. No community signal — not asking questions, not responding to comments. The comment section is the most valuable real estate on the page for healing channels.\n\n5. Mixing emotional tones without series separation — listeners for ADHD regulation will skip attachment healing tracks if they feel like a different product. Series naming solves this without splitting the channel.\n\n6. Ads to single tracks instead of playlists — Meta ads to a playlist convert significantly better than ads to individual tracks. The playlist signals a body of work, not a random upload.",
          implication: "Growth owns items 1, 2, 4, and 6. Creative Director owns 3 and 5. Assign each to the right person before the first release. These are content design decisions, not afterthoughts.",
        }),
        ],
      },
    ],
  };

  // =========================================================================
  // DIRECTOR — synthesised daily status for each project
  // =========================================================================
  const directors = {
    "jazz-radar": {
      id: "jr-dir", name: "Director", role: "Director", short: "DIR",
      avatarHue: 220, director: true,
      desc: "Daily synthesised status across the whole team.",
      types: ["status"],
      threads: [
        thread("status", "Daily status · Alpha", "Today, 8:00 am", {
          overview: "Alpha is stable. Two quick wins on the table that would meaningfully move skip rate before the next cohort.",
          onTrack: "Recommendation pipeline healthy. Curator playlist framing validated in UX research. Growth referral data clean.",
          attention: "Spotify token refresh fails silently — affects session reliability. Skip-rate proposal needs a go/no-go.",
          blockers: "No hard blockers. Spotify token fix is a same-day job whenever TL has a window.",
          focus: "1. Approve skip-rate 'why this track' spike (PM). 2. Schedule Spotify token hotfix (TL).",
        }),
      ],
    },
    attune: {
      id: "at-dir", name: "Director", role: "Director", short: "DIR",
      avatarHue: 220, director: true,
      desc: "Daily synthesised status across the whole team.",
      types: ["status"],
      threads: [
        thread("status", "Daily status · Pre-launch", "Today, 8:00 am", {
          overview: "The waitlist funnel is broken — we're collecting no emails. This is the one thing to fix today.",
          onTrack: "Landing page is live. Spotify playlist strategy validated by PM. Audio player embed concept ready from UX.",
          attention: "Email form sends data nowhere (TL + PM both flagging). No analytics = flying blind. Hero copy not landing with non-wellness audience (UX).",
          blockers: "Waitlist data loss is an active problem right now — real visitors are submitting and we lose their emails.",
          focus: "1. Wire the waitlist form to a real email backend today (TL + PM aligned on this). 2. Add analytics before running any traffic.",
        }),
      ],
    },
    "waves-music": {
      id: "wm-dir", name: "Director", role: "Creative Director", short: "DIR",
      avatarHue: 220, director: true,
      desc: "Vision holder and quality gate — every track starts and ends here.",
      types: ["status", "hygiene"],
      threads: [
        thread("status", "Daily status · Vol. 1 — waiting on Intention Doc", "Today, 9:00 am", {
          overview: "Team is briefed, playbook is live, roles are clear. Nothing moves until the first Track Intention Doc is written. The brief is the product — vague in, generic out, regardless of how good the rest of the team is.",
          onTrack: "GMIV prompt framework ready with Prompt Engineer. Hybrid layer strategy confirmed: singing bowl first, every track. Content Creator has hook templates and Canvas spec. Growth has save rate targets and pitch checklist.",
          attention: "No Intention Doc written yet — this is the first deliverable and everything downstream depends on it. Spotify for Artists profile not yet set up — Growth needs this before the editorial pitch window opens.",
          blockers: "Everything waits on the Intention Doc. Suno Pro subscription must be active before Prompt Engineer starts the first batch.",
          focus: "1. Write Track Intention Doc #1 (nervous system state, emotional arc from→to, what resolution feels like, 5 reference tracks). 2. Set up Spotify for Artists (20 min). 3. Confirm Suno Pro active.",
        }),
        thread("hygiene", "Track Intention Doc — seven sections, fill 04 first", "Today", {
          area: "Creative Director · Track briefs",
          status: "template",
          detail: "Duplicate this doc for every release. Section 04 (the one-line brief) anchors every other section — write it first.\n\n01 · The Listener\nOne real person, one specific moment. Not a demographic — a scene. Forces you to picture who is actually putting this on and what state they're in.\n\n02 · The Nervous System State\nWhere the listener starts, where they end, and the arc in between — minute by minute. The most important section, and the one most briefs skip entirely. This is what the Prompt Engineer uses to rate emotional accuracy.\n\n03 · The Sound\nMood tags, genre, tempo feel, specific instrumentation, and the 'no' list. What must not be in the track is as useful as what should be. The 'no' list is what separates this project from generic AI ambient.\n\n04 · The One-Line Brief\nThe sentence every generation is tested against. If a track doesn't serve this sentence, it's a reject — regardless of how good it sounds.\n\n05 · Reference Tracks\nThree columns: track title, what it does emotionally, what to borrow (not copy). The distinction between borrowing and copying matters — describe the mechanism, not the sound.\n\n06 · Production Notes\nPre-fills direction for Post-Production (hybrid layer suggestion) and Content Creator (Canvas visual direction + reel hook idea). These roles start thinking before they receive the file — this section enables that.\n\n07 · Pipeline Tracker\nEvery stage from Suno shortlist through Spotify pitch submission, with a notes column and status field. This doc travels with the track through the whole team.",
          recommendation: "Fill 04 first — the one-line brief keeps every other section honest. Without it, the sound and reference tracks sections drift toward aesthetic preference rather than functional intention.",
        }),
      ],
    },
    "sound-healing": {
      id: "sh-dir", name: "Director", role: "Director", short: "DIR",
      avatarHue: 220, director: true,
      desc: "Daily synthesised status across the whole team.",
      types: ["status"],
      threads: [
        thread("status", "Daily status · Content launch", "Today, 9:00 am", {
          overview: "Big day. Instagram is connected and live, Mailchimp is live. CM has three Instagram captions ready to post and three YouTube reel scripts drafted. CA has the YouTube format playbook in. Everything is waiting on one decision: approve and go.",
          onTrack: "Zapier integrations live: Instagram for Business + Mailchimp both connected. YouTube format strategy from CA is solid — bowl strike + opening intention is the right structure. Bazi vs Astrology rotation framing is clear.",
          attention: "Nothing is posted yet — the Instagram caption (Option A) and YouTube scripts are sitting in the queue awaiting approval. Spotify artist profile still has no bio or link (UXR flagging for 2 days).",
          blockers: "No technical blockers. The only thing between here and the first post is a go/no-go.",
          focus: "1. Approve Instagram caption Option A → CM posts immediately via Zapier. 2. Confirm the twice-weekly YouTube rhythm (Astrology Mon, Bazi Thu). 3. Fix Spotify artist profile today — 30 minutes, blocks every playlist launch.",
        }),
      ],
    },
  };

  jazzRadar.members.unshift(directors["jazz-radar"]);
  attune.members.unshift(directors.attune);
  soundHealing.members.unshift(directors["sound-healing"]);
  wavesMusic.members.unshift(directors["waves-music"]);

  window.HUB_DATA = {
    types: TYPES,
    typeOrder: ["proposal", "learning", "hygiene", "blocker", "script"],
    projects: [jazzRadar, attune, soundHealing, wavesMusic],
  };
})();
