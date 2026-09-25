/**
 * ═══════════════════════════════════════════════════════════════
 *  CoreLab — Buddy Robot Mascot  v3.0
 *  State-machine controlled. One IIFE. Correct structure.
 *  ORDER: programs → DOM → styles → robot API → state machine → wiring
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
   *  0. GUARD — only init once
   * ═══════════════════════════════════════════════════════════ */
  if (window.__buddyInitialised) return;
  window.__buddyInitialised = true;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ═══════════════════════════════════════════════════════════
   *  1. PROGRAM DATABASE  (real data only — never invent)
   * ═══════════════════════════════════════════════════════════ */
  const PROGRAMS = {
    creator: {
      id: 'creator',
      title: 'AI Content Creator Weekend',
      url: 'ai-content-creator.html',
      dates: '28–29 September 2026',
      duration: '2-Day Intensive',
      price: 'PKR 2,999 (Student Launch Pass)',
      level: 'Beginner Friendly',
      focus: 'AI image generation, poster design, copywriting, hook engines, short videos, AI voiceovers, subtitles, multi-platform content distribution',
      outcome: 'A complete ready-to-publish multi-platform content pack',
      idealFor: 'Content creators, social media managers, designers, marketing students, small business owners, beginners wanting practical AI content skills',
      notFor: 'People wanting deep ML, model training, AI agents, or advanced data science',
    },
    builder: {
      id: 'builder',
      title: 'AI From Zero to AI Builder',
      url: 'ai-from-zero-to-builder.html',
      dates: '5–11 October 2026',
      duration: '7-Day Bootcamp',
      price: 'PKR 4,999 Regular · PKR 5,999 Premium',
      level: 'Beginner / Builder — Flagship Cohort 5',
      focus: 'AI productivity, research assistants, visual creation, code-free web apps, automation, video creation, web app building, custom AI projects',
      outcome: 'Broad AI foundation across multiple tools — apps, automations, visuals, research assistants',
      idealFor: 'Complete beginners, students wanting a broad AI intro, people unsure which AI field to pick yet',
      notFor: 'Deep ML/statistics, advanced LLM/agent architecture, dedicated content creation only',
    },
    technical: {
      id: 'technical',
      title: 'Data Science & Machine Learning',
      url: 'data-science-machine-learning.html',
      dates: '5–15 October 2026',
      duration: '10-Day Bootcamp',
      price: 'PKR 10,000 Early Bird · PKR 12,000 Regular · PKR 15,000 Premium',
      level: 'Technical',
      focus: 'Raw datasets, data cleaning, statistical modeling, machine learning, Scikit-learn, Streamlit, Python data science, EDA, statistics, regression, classification, real projects, GitHub portfolio',
      outcome: 'Deployed Streamlit ML application + GitHub portfolio',
      idealFor: 'Python learners, people wanting ML models, data science, statistics, regression/classification, technical ML portfolio',
      notFor: 'Social media/content focus, no-code AI, AI agents/LLMs, or complete non-technical beginners',
    },
    advanced: {
      id: 'advanced',
      title: 'Generative AI, LLMs & AI Agents',
      url: 'generative-ai-agents.html',
      dates: '12–22 October 2026',
      duration: '10-Day Bootcamp',
      price: 'PKR 10,000 Early Bird · PKR 12,000 Regular · PKR 15,000 Premium',
      level: 'Advanced AI',
      focus: 'LLM foundations, prompt engineering, LLM APIs, RAG, embeddings, agent architecture, tool calling, n8n automation, AI memory, multi-step workflows, custom AI agent products, deployment',
      outcome: 'Custom AI agent product deployed end-to-end',
      idealFor: 'People interested in LLMs, AI agents, RAG, APIs, automation, tool calling, custom AI products',
      notFor: 'Complete beginners needing a general foundation first, social media content focus, classical ML/statistics',
    },
  };

  /* ═══════════════════════════════════════════════════════════
   *  2. STATE MACHINE
   * ═══════════════════════════════════════════════════════════ */
  const SM = {
    IDLE:             'IDLE',
    OBSERVING:        'OBSERVING',
    WALKING:          'WALKING',
    SPEAKING:         'SPEAKING',
    WAITING:          'WAITING',
    USER_INTERACTING: 'USER_INTERACTING',
    QUIET:            'QUIET',
    REGISTRATION:     'REGISTRATION',
  };

  /* ═══════════════════════════════════════════════════════════
   *  3. COOLDOWN CONSTANTS  (ms)
   * ═══════════════════════════════════════════════════════════ */
  const CD = {
    AUTONOMOUS:  22000,  // min gap between any two auto-messages
    HOVER:       32000,  // hover cooldown per card
    CARD_ENTRY:  35000,  // card visibility cooldown
    SAME_MSG:    60000,  // same message repeat cooldown
    MOVE:         8000,  // min gap between moves
    POST_SPEAK:   9000,  // wait after auto-speak before next action
  };

  /* ═══════════════════════════════════════════════════════════
   *  4. RUNTIME STATE
   * ═══════════════════════════════════════════════════════════ */
  const S = {
    phase:              SM.IDLE,
    isWalking:          false,
    facing:             'left',
    currentAnim:        'idle',
    isChatOpen:         false,
    isTyping:           false,
    isSpeaking:         false,       // global speak lock
    lastAutoSpeakAt:    0,
    lastHoverAt:        0,
    lastCardAt:         0,
    lastMoveAt:         0,
    currentSection:     null,
    triggeredSections:  new Set(),
    activeCard:         null,
    recentMsgs:         [],          // [{ key, at }]
    idleFired:          false,
    hasGreeted:         false,
    lastInteraction:    Date.now(),
  };

  /* ─── dedup helpers ─── */
  function wasSaid(key) {
    const now = Date.now();
    S.recentMsgs = S.recentMsgs.filter(m => now - m.at < CD.SAME_MSG);
    return S.recentMsgs.some(m => m.key === key);
  }
  function markSaid(key) { S.recentMsgs.push({ key, at: Date.now() }); }

  /* ─── speak gate ─── */
  function canAutoSpeak() {
    if (S.isSpeaking)                                    return false;
    if (S.isChatOpen)                                    return false;
    if (S.isTyping)                                      return false;
    if (S.phase === SM.REGISTRATION)                     return false;
    if (S.phase === SM.USER_INTERACTING)                 return false;
    if (S.phase === SM.QUIET)                            return false;
    if (Date.now() - S.lastAutoSpeakAt < CD.AUTONOMOUS) return false;
    return true;
  }

  /* ─── controlled auto-speak ─── */
  let _speakReleaseTimer = null;
  function autoSpeak(text, opts = {}) {
    const key = opts.key || text.slice(0, 40);
    if (!canAutoSpeak())      return false;
    if (wasSaid(key))         return false;

    markSaid(key);
    S.lastAutoSpeakAt = Date.now();
    S.isSpeaking      = true;
    S.phase           = SM.SPEAKING;

    _doSpeak(text, opts);

    const hold = opts.duration || 6500;
    clearTimeout(_speakReleaseTimer);
    _speakReleaseTimer = setTimeout(() => {
      S.isSpeaking = false;
      S.phase      = SM.WAITING;
      setTimeout(() => {
        if (S.phase === SM.WAITING) S.phase = SM.IDLE;
      }, CD.POST_SPEAK);
    }, hold + 300);

    return true;
  }

  /* ═══════════════════════════════════════════════════════════
   *  5. BUILD DOM
   * ═══════════════════════════════════════════════════════════ */
  const layer = document.createElement('div');
  layer.id = 'buddy-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = `
    <div id="buddy-bubble" role="status" aria-live="polite">
      <button id="buddy-bubble-close" aria-label="Dismiss">×</button>
      <p id="buddy-bubble-text"></p>
      <div id="buddy-bubble-btns"></div>
    </div>

    <div id="buddy-char" data-anim="idle">
      <svg id="buddy-svg" viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" overflow="visible">
        <!-- ANTENNA -->
        <line x1="40" y1="12" x2="40" y2="3" stroke="#5c4a32" stroke-width="2.2" stroke-linecap="round"/>
        <circle id="b-antenna-ball" cx="40" cy="2.5" r="3.5" fill="#c2521a"/>
        <circle cx="40" cy="2.5" r="1.5" fill="#fdf0e8" opacity=".85"/>
        <!-- HEAD -->
        <g id="b-head">
          <rect x="12" y="12" width="56" height="42" rx="16" fill="#fffdf9" stroke="#e0c9b0" stroke-width="1.4"/>
          <rect x="12" y="12" width="56" height="16" rx="16" fill="#c2521a"/>
          <rect x="12" y="21" width="56" height="7" fill="#c2521a"/>
          <rect x="18" y="26" width="44" height="24" rx="10" fill="#1a1a2e"/>
          <!-- Eyes -->
          <ellipse cx="29" cy="37" rx="6" ry="7" fill="#0a0a18"/>
          <ellipse cx="51" cy="37" rx="6" ry="7" fill="#0a0a18"/>
          <ellipse cx="29" cy="37" rx="4.2" ry="5" fill="#c2521a" opacity=".9"/>
          <ellipse cx="51" cy="37" rx="4.2" ry="5" fill="#c2521a" opacity=".9"/>
          <circle cx="31" cy="35" r="1.5" fill="#fff" opacity=".7"/>
          <circle cx="53" cy="35" r="1.5" fill="#fff" opacity=".7"/>
          <!-- Blink overlays -->
          <ellipse id="b-blink-l" cx="29" cy="37" rx="6" ry="0" fill="#1a1a2e"/>
          <ellipse id="b-blink-r" cx="51" cy="37" rx="6" ry="0" fill="#1a1a2e"/>
          <!-- Smile -->
          <path id="b-mouth" d="M27 46 Q40 54 53 46" stroke="#c2521a" stroke-width="2" stroke-linecap="round" fill="none"/>
          <!-- Ear bolts -->
          <rect x="6"  y="28" width="7" height="14" rx="3.5" fill="#f0e6d6" stroke="#c2521a" stroke-width="1"/>
          <rect x="67" y="28" width="7" height="14" rx="3.5" fill="#f0e6d6" stroke="#c2521a" stroke-width="1"/>
          <circle cx="9.5"  cy="35" r="2.2" fill="#c2521a"/>
          <circle cx="70.5" cy="35" r="2.2" fill="#c2521a"/>
        </g>
        <!-- NECK -->
        <rect x="32" y="54" width="16" height="7" rx="3.5" fill="#e0c9b0"/>
        <!-- BODY -->
        <g id="b-body">
          <rect x="10" y="61" width="60" height="42" rx="14" fill="#fffdf9" stroke="#e0c9b0" stroke-width="1.4"/>
          <rect x="10" y="61" width="60" height="12" rx="14" fill="#c2521a"/>
          <rect x="10" y="67" width="60" height="6" fill="#c2521a"/>
          <rect x="22" y="79" width="36" height="18" rx="7" fill="#f3ede4" stroke="#e0c9b0" stroke-width="1"/>
          <circle cx="40" cy="87" r="6" fill="#c2521a" opacity=".2"/>
          <circle cx="40" cy="87" r="4" fill="#c2521a" opacity=".55"/>
          <circle cx="40" cy="87" r="2" fill="#fffdf9"/>
          <circle cx="27" cy="92" r="2" fill="#c2521a" opacity=".55"/>
          <circle cx="53" cy="92" r="2" fill="#c2521a" opacity=".55"/>
        </g>
        <!-- LEFT ARM (wave) -->
        <g id="b-arm-l" style="transform-origin:10px 68px">
          <rect x="1" y="68" width="10" height="28" rx="5" fill="#fffdf9" stroke="#e0c9b0" stroke-width="1.2"/>
          <rect x="1" y="68" width="10" height="9" rx="5" fill="#c2521a"/>
          <ellipse cx="6" cy="99" rx="6" ry="4.5" fill="#f0e6d6" stroke="#c2521a" stroke-width="1"/>
          <line x1="3.5" y1="97" x2="2.5" y2="103" stroke="#5c4a32" stroke-width="1.2" stroke-linecap="round"/>
          <line x1="6"   y1="96" x2="6"   y2="103" stroke="#5c4a32" stroke-width="1.2" stroke-linecap="round"/>
          <line x1="8.5" y1="97" x2="9.5" y2="103" stroke="#5c4a32" stroke-width="1.2" stroke-linecap="round"/>
        </g>
        <!-- RIGHT ARM -->
        <g id="b-arm-r" style="transform-origin:69px 68px">
          <rect x="69" y="68" width="10" height="28" rx="5" fill="#fffdf9" stroke="#e0c9b0" stroke-width="1.2"/>
          <rect x="69" y="68" width="10" height="9" rx="5" fill="#c2521a"/>
          <ellipse cx="74" cy="99" rx="6" ry="4.5" fill="#f0e6d6" stroke="#c2521a" stroke-width="1"/>
        </g>
        <!-- LEGS -->
        <g id="b-leg-l" style="transform-origin:27px 103px">
          <rect x="18" y="103" width="18" height="14" rx="7" fill="#fffdf9" stroke="#e0c9b0" stroke-width="1.2"/>
          <rect x="18" y="103" width="18" height="6" rx="7" fill="#c2521a"/>
          <rect x="14" y="113" width="26" height="8" rx="6" fill="#c2521a"/>
        </g>
        <g id="b-leg-r" style="transform-origin:53px 103px">
          <rect x="44" y="103" width="18" height="14" rx="7" fill="#fffdf9" stroke="#e0c9b0" stroke-width="1.2"/>
          <rect x="44" y="103" width="18" height="6" rx="7" fill="#c2521a"/>
          <rect x="40" y="113" width="26" height="8" rx="6" fill="#c2521a"/>
        </g>
      </svg>
    </div>

    <div id="buddy-chat" role="dialog" aria-label="CoreLab AI Assistant" aria-modal="false">
      <div id="buddy-chat-header">
        <span>CoreLab Assistant 🤖</span>
        <button id="buddy-chat-close" aria-label="Close chat">×</button>
      </div>
      <div id="buddy-chat-messages"></div>
      <div id="buddy-chat-suggestions"></div>
      <div id="buddy-chat-input-row">
        <input id="buddy-chat-input" type="text" placeholder="Ask me anything..." aria-label="Type your message"/>
        <button id="buddy-chat-send" aria-label="Send">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(layer);

  /* ═══════════════════════════════════════════════════════════
   *  6. STYLES
   * ═══════════════════════════════════════════════════════════ */
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    #buddy-layer { position:fixed; z-index:99990; top:0; left:0; width:100%; height:100%; pointer-events:none; }

    /* ── Robot ── */
    #buddy-char {
      position:fixed; width:80px; height:120px;
      pointer-events:all; cursor:pointer;
      user-select:none;
    }
    #buddy-svg { width:100%; height:100%; display:block; filter:drop-shadow(0 6px 14px rgba(194,82,26,.25)); transition:filter .2s; }
    #buddy-char:hover #buddy-svg { filter:drop-shadow(0 8px 20px rgba(194,82,26,.40)); }
    #buddy-char.facing-right { transform:scaleX(-1); }

    /* ── CSS animations ── */
    @keyframes buddyIdle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
    @keyframes buddyWalkL { 0%,100%{transform:rotate(0)} 50%{transform:rotate(-18deg)} }
    @keyframes buddyWalkR { 0%,100%{transform:rotate(0)} 50%{transform:rotate(18deg)} }
    @keyframes buddyWave  { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-35deg)} 75%{transform:rotate(12deg)} }
    @keyframes buddyPoint { 0%,100%{transform:rotate(-40deg) translateY(-4px)} 50%{transform:rotate(-50deg) translateY(-6px)} }
    @keyframes buddyThink { 0%,100%{transform:rotate(15deg) translateY(0)} 50%{transform:rotate(20deg) translateY(-3px)} }
    @keyframes buddySurprised { 0%,60%,100%{transform:translateY(0) scale(1)} 30%{transform:translateY(-10px) scale(1.08)} }
    @keyframes buddyHappy { 0%,100%{transform:translateY(0) rotate(0)} 25%{transform:translateY(-8px) rotate(-4deg)} 75%{transform:translateY(-8px) rotate(4deg)} }
    @keyframes buddyLookR { 0%,100%{transform:translateX(0)} 50%{transform:translateX(5px)} }
    @keyframes buddyLookL { 0%,100%{transform:translateX(0)} 50%{transform:translateX(-5px)} }
    @keyframes antPulse   { 0%,100%{r:3.5} 50%{r:4.5} }

    #buddy-char[data-anim="idle"]   #buddy-svg  { animation:${prefersReduced?'none':'buddyIdle 3s ease-in-out infinite'}; }
    #buddy-char[data-anim="walk"]   #b-leg-l    { animation:${prefersReduced?'none':'buddyWalkL .45s ease-in-out infinite'}; }
    #buddy-char[data-anim="walk"]   #b-leg-r    { animation:${prefersReduced?'none':'buddyWalkR .45s ease-in-out infinite'}; }
    #buddy-char[data-anim="wave"]   #b-arm-l    { animation:${prefersReduced?'none':'buddyWave .7s ease-in-out infinite'}; }
    #buddy-char[data-anim="point"]  #b-arm-l    { animation:${prefersReduced?'none':'buddyPoint .9s ease-in-out infinite'}; }
    #buddy-char[data-anim="think"]  #b-arm-r    { animation:${prefersReduced?'none':'buddyThink .9s ease-in-out infinite'}; }
    #buddy-char[data-anim="surprised"] #buddy-svg { animation:${prefersReduced?'none':'buddySurprised .6s ease-in-out'}; }
    #buddy-char[data-anim="happy"]  #buddy-svg  { animation:${prefersReduced?'none':'buddyHappy .5s ease-in-out infinite'}; }
    #buddy-char[data-anim="lookright"] #b-head  { animation:${prefersReduced?'none':'buddyLookR .8s ease-in-out'}; }
    #buddy-char[data-anim="lookleft"]  #b-head  { animation:${prefersReduced?'none':'buddyLookL .8s ease-in-out'}; }
    #b-antenna-ball { animation:${prefersReduced?'none':'antPulse 2s ease-in-out infinite'}; }

    /* ── Bubble ── */
    #buddy-bubble {
      position:fixed; background:#fffdf9; border:2px solid #c2521a;
      border-radius:16px 16px 16px 4px; padding:11px 32px 11px 13px;
      max-width:230px; min-width:140px;
      box-shadow:0 6px 22px rgba(194,82,26,.22);
      pointer-events:all; opacity:0;
      transform:scale(.86) translateY(6px); transform-origin:bottom left;
      transition:opacity .32s ease, transform .32s cubic-bezier(.34,1.56,.64,1);
    }
    #buddy-bubble.show { opacity:1; transform:scale(1) translateY(0); }
    #buddy-bubble-close { position:absolute; top:6px; right:8px; background:none; border:none; font-size:1rem; color:#b89a7a; cursor:pointer; padding:2px 5px; border-radius:4px; }
    #buddy-bubble-close:hover { color:#c2521a; background:#f3ede4; }
    #buddy-bubble-text { font-family:'Inter',sans-serif; font-size:.82rem; font-weight:600; color:#2d2416; line-height:1.55; margin:0 0 8px; }
    #buddy-bubble-btns { display:flex; flex-wrap:wrap; gap:6px; pointer-events:all; }
    .buddy-bub-btn { background:linear-gradient(135deg,#e07040,#c2521a); color:#fff; border:none; border-radius:8px; padding:6px 11px; font-family:'Inter',sans-serif; font-size:.76rem; font-weight:700; cursor:pointer; pointer-events:all; transition:filter .15s; }
    .buddy-bub-btn:hover { filter:brightness(1.1); }
    .buddy-bub-btn.secondary { background:#f3ede4; color:#c2521a; border:1px solid #f0bfa0; }

    /* ── Chat ── */
    #buddy-chat {
      position:fixed; bottom:110px; right:24px; width:320px; max-height:480px;
      background:#fffdf9; border:1.5px solid #e8d9c4; border-radius:20px;
      box-shadow:0 12px 40px rgba(45,36,22,.18);
      display:flex; flex-direction:column; pointer-events:all; z-index:99992;
      opacity:0; transform:translateY(16px) scale(.94); transform-origin:bottom right;
      transition:opacity .3s ease, transform .3s cubic-bezier(.34,1.56,.64,1); visibility:hidden;
    }
    #buddy-chat.open { opacity:1; transform:none; visibility:visible; }
    #buddy-chat-header { display:flex; align-items:center; justify-content:space-between; padding:13px 16px 11px; border-bottom:1px solid #e8d9c4; font-family:'Inter',sans-serif; font-size:.88rem; font-weight:800; color:#2d2416; background:linear-gradient(135deg,#fdf0e8,#fffdf9); border-radius:20px 20px 0 0; }
    #buddy-chat-close { background:none; border:none; font-size:1.1rem; color:#b89a7a; cursor:pointer; padding:2px 6px; border-radius:5px; }
    #buddy-chat-close:hover { color:#c2521a; background:#f3ede4; }
    #buddy-chat-messages { flex:1; overflow-y:auto; padding:12px 14px; display:flex; flex-direction:column; gap:10px; scroll-behavior:smooth; }
    .buddy-msg { max-width:85%; padding:8px 12px; border-radius:12px; font-family:'Inter',sans-serif; font-size:.82rem; line-height:1.5; }
    .buddy-msg.bot  { background:#f3ede4; color:#2d2416; border-radius:12px 12px 12px 3px; align-self:flex-start; }
    .buddy-msg.user { background:linear-gradient(135deg,#e07040,#c2521a); color:#fff; border-radius:12px 12px 3px 12px; align-self:flex-end; }
    .buddy-prog-card { background:#fffdf9; border:1.5px solid #e8d9c4; border-radius:10px; padding:8px 10px; margin-top:4px; }
    .buddy-prog-card strong { font-size:.82rem; color:#c2521a; display:block; }
    .buddy-prog-card span   { font-size:.76rem; color:#5c4a32; display:block; margin:2px 0 6px; }
    .buddy-prog-card a { font-size:.76rem; font-weight:700; color:#c2521a; text-decoration:none; }
    .buddy-prog-card a:hover { text-decoration:underline; }
    #buddy-chat-suggestions { padding:8px 12px 4px; display:flex; flex-wrap:wrap; gap:6px; border-top:1px solid #f0e8da; }
    .buddy-sugg-btn { background:#f3ede4; border:1px solid #e8d9c4; border-radius:20px; padding:5px 10px; font-family:'Inter',sans-serif; font-size:.74rem; font-weight:600; color:#5c4a32; cursor:pointer; transition:background .15s,border-color .15s; }
    .buddy-sugg-btn:hover { background:#fdf0e8; border-color:#c2521a; color:#c2521a; }
    #buddy-chat-input-row { display:flex; gap:8px; padding:10px 12px; border-top:1px solid #e8d9c4; }
    #buddy-chat-input { flex:1; border:1.5px solid #e8d9c4; border-radius:10px; padding:8px 11px; font-family:'Inter',sans-serif; font-size:.83rem; color:#2d2416; background:#faf8f5; outline:none; }
    #buddy-chat-input:focus { border-color:#c2521a; }
    #buddy-chat-send { width:36px; height:36px; background:linear-gradient(135deg,#e07040,#c2521a); border:none; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    #buddy-chat-send svg { width:16px; height:16px; stroke:#fff; }
    #buddy-chat-send:hover { filter:brightness(1.1); }

    /* dark mode */
    [data-theme="dark"] #buddy-bubble { background:#0d1728; border-color:#38bdf8; box-shadow:0 6px 22px rgba(56,189,248,.18); }
    [data-theme="dark"] #buddy-bubble-text { color:#dbeafe; }
    [data-theme="dark"] #buddy-bubble-close { color:#60a5fa; }
    [data-theme="dark"] #buddy-bubble-close:hover { background:rgba(56,189,248,.1); color:#38bdf8; }
    [data-theme="dark"] .buddy-bub-btn.secondary { background:rgba(56,189,248,.1); color:#38bdf8; border-color:rgba(56,189,248,.25); }
    [data-theme="dark"] #buddy-chat { background:#0d1728; border-color:rgba(147,197,253,.2); }
    [data-theme="dark"] #buddy-chat-header { background:#071020; color:#dbeafe; border-color:rgba(147,197,253,.15); }
    [data-theme="dark"] #buddy-chat-close { color:#60a5fa; }
    [data-theme="dark"] .buddy-msg.bot { background:rgba(59,130,246,.12); color:#dbeafe; }
    [data-theme="dark"] .buddy-prog-card { background:rgba(59,130,246,.08); border-color:rgba(147,197,253,.15); }
    [data-theme="dark"] .buddy-prog-card strong { color:#38bdf8; }
    [data-theme="dark"] .buddy-prog-card span { color:#93c5fd; }
    [data-theme="dark"] .buddy-prog-card a { color:#38bdf8; }
    [data-theme="dark"] #buddy-chat-suggestions { border-color:rgba(147,197,253,.1); }
    [data-theme="dark"] .buddy-sugg-btn { background:rgba(59,130,246,.1); border-color:rgba(147,197,253,.2); color:#93c5fd; }
    [data-theme="dark"] .buddy-sugg-btn:hover { background:rgba(56,189,248,.15); border-color:#38bdf8; color:#38bdf8; }
    [data-theme="dark"] #buddy-chat-input { background:#071020; border-color:rgba(147,197,253,.2); color:#dbeafe; }
    [data-theme="dark"] #buddy-chat-input:focus { border-color:#38bdf8; }
    [data-theme="dark"] #buddy-chat-input-row { border-color:rgba(147,197,253,.1); }
    [data-theme="dark"] #buddy-char { filter:none; }
    [data-theme="dark"] #buddy-svg { filter:drop-shadow(0 6px 14px rgba(56,189,248,.2)); }
    [data-theme="dark"] #buddy-char:hover #buddy-svg { filter:drop-shadow(0 8px 20px rgba(56,189,248,.35)); }

    @media (max-width:600px) {
      #buddy-char { width:62px; height:93px; }
      #buddy-chat { width:calc(100vw - 24px); right:12px; bottom:90px; }
      #buddy-bubble { max-width:calc(100vw - 100px); }
    }
  `;
  document.head.appendChild(styleEl);

  /* ═══════════════════════════════════════════════════════════
   *  7. ELEMENT REFS
   * ═══════════════════════════════════════════════════════════ */
  const charEl      = document.getElementById('buddy-char');
  const bubbleEl    = document.getElementById('buddy-bubble');
  const bubbleTxt   = document.getElementById('buddy-bubble-text');
  const bubbleBtns  = document.getElementById('buddy-bubble-btns');
  const bubbleClose = document.getElementById('buddy-bubble-close');
  const chatPanel   = document.getElementById('buddy-chat');
  const chatMsgs    = document.getElementById('buddy-chat-messages');
  const chatSuggs   = document.getElementById('buddy-chat-suggestions');
  const chatInput   = document.getElementById('buddy-chat-input');
  const chatSend    = document.getElementById('buddy-chat-send');
  const chatClose   = document.getElementById('buddy-chat-close');

  /* ═══════════════════════════════════════════════════════════
   *  8. ROBOT MOVEMENT & ANIMATION API
   * ═══════════════════════════════════════════════════════════ */
  let _robotX = window.innerWidth - 110;
  let _robotY = window.innerHeight - 200;

  function _safePos(side) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const mob = vw < 600;
    const sz  = mob ? 65 : 90;
    const pad = mob ? 14 : 22;
    const bot = mob ? 86 : 100; // clear whatsapp button
    const positions = {
      'bottom-right': { x: vw - sz - pad,  y: vh - sz - bot  },
      'bottom-left':  { x: pad,             y: vh - sz - bot  },
      'mid-right':    { x: vw - sz - pad,   y: vh * 0.42      },
      'mid-left':     { x: pad,             y: vh * 0.42      },
    };
    return positions[side] || positions['bottom-right'];
  }

  function _setPos(x, y) {
    _robotX = x; _robotY = y;
    charEl.style.left   = x + 'px';
    const cssBot = Math.max(window.innerHeight - y - 120, 100);
    charEl.style.bottom = cssBot + 'px';
    _updateBubblePos();
  }

  function _setAnim(name) {
    S.currentAnim = name;
    charEl.setAttribute('data-anim', name);
  }

  function _walk(side, onDone) {
    if (prefersReduced) {
      const p = _safePos(side);
      _setPos(p.x, p.y);
      _setAnim('idle');
      onDone && onDone();
      return;
    }
    const target = _safePos(side);
    const dx = target.x - _robotX;
    S.facing = dx > 0 ? 'right' : 'left';
    charEl.classList.toggle('facing-right', S.facing === 'right');
    _setAnim('walk');
    S.isWalking = true;
    const speed = 2.2;
    const tick  = () => {
      if (!S.isWalking) return;
      const rx = target.x - _robotX, ry = target.y - _robotY;
      const d  = Math.sqrt(rx*rx + ry*ry);
      if (d < speed + 1) {
        _setPos(target.x, target.y);
        S.isWalking = false;
        charEl.classList.remove('facing-right');
        _setAnim('idle');
        onDone && onDone();
        return;
      }
      _setPos(_robotX + rx/d*speed, _robotY + ry/d*speed);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function _updateBubblePos() {
    const vw = window.innerWidth;
    const bubW = 240;
    let bx;
    if (_robotX + 90 + bubW + 10 < vw) {
      bx = _robotX + 90;
      bubbleEl.style.borderRadius = '4px 16px 16px 16px';
    } else {
      bx = Math.max(8, _robotX - bubW - 10);
      bubbleEl.style.borderRadius = '16px 16px 16px 4px';
    }
    const by = window.innerHeight - _robotY - 160;
    bubbleEl.style.left   = bx + 'px';
    bubbleEl.style.bottom = Math.max(by, 108) + 'px';
    bubbleEl.style.top    = 'auto';
  }

  /* ─── animation shorthands ─── */
  let _animTimer = null;
  function _doAnim(name, ms) {
    _setAnim(name);
    clearTimeout(_animTimer);
    _animTimer = setTimeout(() => _setAnim('idle'), ms);
  }

  /* ─── speak (low-level) ─── */
  let _hideTimer = null;
  function _doSpeak(text, opts) {
    clearTimeout(_hideTimer);
    bubbleTxt.textContent = text;
    bubbleBtns.innerHTML  = '';

    if (opts.btn) {
      const b = _makeBtn(opts.btn.label, () => _handleBtnAction(opts.btn.action));
      bubbleBtns.appendChild(b);
    }
    if (opts.btns) {
      opts.btns.forEach((def, i) => {
        const b = _makeBtn(def.label, () => _handleBtnAction(def.action));
        if (i > 0) b.classList.add('secondary');
        bubbleBtns.appendChild(b);
      });
    }

    _updateBubblePos();
    bubbleEl.classList.add('show');
    _doAnim('speak', 1200);

    if (!opts.btn && !opts.btns) {
      _hideTimer = setTimeout(() => _hideSpeech(), opts.duration || 6500);
    }
  }

  function _hideSpeech() {
    bubbleEl.classList.remove('show');
    bubbleBtns.innerHTML = '';
  }

  function _makeBtn(label, cb) {
    const b = document.createElement('button');
    b.className   = 'buddy-bub-btn';
    b.textContent = label;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', cb);
    return b;
  }

  function _handleBtnAction(action) {
    _hideSpeech();
    if (action === 'chat')  { _openChat(); }
    if (action === 'quiz')  { _openChat(); setTimeout(() => brain._startFullQuiz(), 500); }
    if (action === 'register') { window.location.href = 'register.html'; }
  }

  /* ═══════════════════════════════════════════════════════════
   *  9. CHAT ENGINE
   * ═══════════════════════════════════════════════════════════ */
  function _openChat() {
    S.isChatOpen = true;
    S.phase      = SM.USER_INTERACTING;
    chatPanel.classList.add('open');
    _hideSpeech();
    _doAnim('wave', 1800);
    chatInput.focus();
    _initSuggestions();
    if (chatMsgs.children.length === 0) {
      _botMsg("Hey! 👋 I'm Buddy — CoreLab's guide. What can I help you with?");
    }
  }

  function _closeChat() {
    S.isChatOpen = false;
    chatPanel.classList.remove('open');
    if (S.phase === SM.USER_INTERACTING) S.phase = SM.IDLE;
  }

  function _botMsg(text, isHtml) {
    const d = document.createElement('div');
    d.className = 'buddy-msg bot';
    if (isHtml) d.innerHTML = text; else d.textContent = text;
    chatMsgs.appendChild(d);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  function _userMsg(text) {
    const d = document.createElement('div');
    d.className = 'buddy-msg user';
    d.textContent = text;
    chatMsgs.appendChild(d);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  function _progCard(p) {
    const d = document.createElement('div');
    d.className = 'buddy-msg bot';
    d.innerHTML = `<div class="buddy-prog-card">
      <strong>${p.title}</strong>
      <span>${p.duration} · ${p.level} · ${p.dates}</span>
      <span style="color:#8b6e4e">${p.price}</span>
      <a href="${p.url}">View full program →</a>
    </div>`;
    chatMsgs.appendChild(d);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  function _inlineButtons(btns) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:0 0 4px;';
    btns.forEach(def => {
      const b = document.createElement('button');
      b.className   = 'buddy-sugg-btn';
      b.textContent = def.label;
      b.addEventListener('click', () => {
        _userMsg(def.label);
        row.remove();
        def.cb();
      });
      row.appendChild(b);
    });
    chatMsgs.appendChild(row);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  function _initSuggestions() {
    const suggs = [
      "Which program suits me?",
      "What programs do you offer?",
      "How do I register?",
      "I'm a beginner — where should I start?",
      "I want to build AI agents",
      "I want to learn machine learning",
    ];
    chatSuggs.innerHTML = '';
    suggs.forEach(s => {
      const b = document.createElement('button');
      b.className   = 'buddy-sugg-btn';
      b.textContent = s;
      b.addEventListener('click', () => { brain.handle(s); chatSuggs.innerHTML = ''; });
      chatSuggs.appendChild(b);
    });
  }

  /* ═══════════════════════════════════════════════════════════
   *  10. CONVERSATION BRAIN
   * ═══════════════════════════════════════════════════════════ */
  const brain = {

    /* persistent profile across messages */
    profile: { experience: null, techPref: null },
    quizAnswers: {},

    /* ── signal extractor ── */
    signals(lower) {
      return {
        isBeginner:    /beginner|new to|no experience|zero|just start|never|don.t know|no background/i.test(lower),
        wantsTechnical:/technical|developer|cs student|computer science|engineer|cod/i.test(lower),
        wantsNoCode:   /no.?code|no coding|practical|non.?technical|without cod/i.test(lower),
        wantsPractical:/practical|build|application|product|project|hands.?on/i.test(lower),
        wantsBroad:    /broad|general|overview|foundation|intro|not sure|unsure|all|explore/i.test(lower),
        wantsContent:  /content|instagram|post|social media|reel|tiktok|youtube|copywriting|hook|caption/i.test(lower),
        wantsMedia:    /image|poster|design|graphic|visual|voiceover|ai image|ai video|thumbnail/i.test(lower),
        wantsMarketing:/marketing|brand|freelanc|business|audience/i.test(lower),
        wantsML:       /machine learning|ml\b|train|model|supervised|scikit|sklearn/i.test(lower),
        wantsDeepML:   /deep learning|neural|ml model|train model|regression|classification/i.test(lower),
        wantsData:     /\bdata\b|dataset|csv|analysis|analytics|data science/i.test(lower),
        wantsStats:    /statistic|probability|eda|exploratory/i.test(lower),
        wantsPython:   /python/i.test(lower),
        wantsMLModels: /train|model|predict|regression|classification|fit model/i.test(lower),
        wantsAgents:   /agent|autonomous|agentic|tool.calling|multi.step/i.test(lower),
        wantsLLMs:     /llm|language model|chatgpt|gpt|openai|gemini|claude|prompt/i.test(lower),
        wantsRAG:      /\brag\b|retrieval|vector|embedding|knowledge base/i.test(lower),
        wantsAPIs:     /\bapi\b|integration|connect|endpoint/i.test(lower),
        wantsAutomate: /automat|workflow|n8n|pipeline|trigger/i.test(lower),
        wantsToolCall: /tool|function.call|action|plugin/i.test(lower),
        wantsAIProduct:/product|startup|build.*ai|ai.*build|system|saas/i.test(lower),
      };
    },

    /* ── scoring ── */
    score(sig) {
      const sc = { creator:0, builder:0, technical:0, advanced:0 };
      if (sig.wantsContent)    sc.creator   += 40;
      if (sig.wantsMedia)      sc.creator   += 30;
      if (sig.isBeginner)      sc.creator   += 20;
      if (sig.wantsMarketing)  sc.creator   += 10;
      if (sig.isBeginner)      sc.builder   += 40;
      if (sig.wantsBroad)      sc.builder   += 30;
      if (sig.wantsPractical)  sc.builder   += 25;
      if (sig.wantsAutomate)   sc.builder   += 20;
      if (sig.wantsNoCode)     sc.builder   += 20;
      if (sig.wantsDeepML)     sc.builder   -= 20;
      if (sig.wantsAgents)     sc.builder   -= 20;
      if (sig.wantsML)         sc.technical += 40;
      if (sig.wantsData)       sc.technical += 35;
      if (sig.wantsStats)      sc.technical += 30;
      if (sig.wantsPython)     sc.technical += 25;
      if (sig.wantsMLModels)   sc.technical += 25;
      if (sig.wantsTechnical)  sc.technical += 20;
      if (sig.wantsAgents)     sc.advanced  += 40;
      if (sig.wantsLLMs)       sc.advanced  += 35;
      if (sig.wantsRAG)        sc.advanced  += 30;
      if (sig.wantsAPIs)       sc.advanced  += 30;
      if (sig.wantsAutomate)   sc.advanced  += 25;
      if (sig.wantsToolCall)   sc.advanced  += 25;
      if (sig.wantsAIProduct)  sc.advanced  += 20;
      if (sig.isBeginner && !sig.wantsTechnical) sc.advanced -= 20;
      return sc;
    },

    topProgs(scores, threshold) {
      return Object.entries(scores)
        .filter(([,v]) => v >= threshold)
        .sort(([,a],[,b]) => b-a)
        .map(([k]) => PROGRAMS[k]);
    },

    /* ── main handler (one response per user message) ── */
    handle(msg) {
      _userMsg(msg);
      chatSuggs.innerHTML = '';
      const lower = msg.toLowerCase();
      const sig   = this.signals(lower);

      // update profile
      if (sig.isBeginner)     this.profile.experience = 'beginner';
      if (sig.wantsTechnical) this.profile.experience = 'technical';
      if (sig.wantsNoCode)    this.profile.techPref   = 'nocode';
      if (sig.wantsTechnical) this.profile.techPref   = 'technical';

      // merge profile
      const m = Object.assign({}, sig, {
        isBeginner:     sig.isBeginner     || this.profile.experience === 'beginner',
        wantsTechnical: sig.wantsTechnical || this.profile.techPref   === 'technical',
        wantsNoCode:    sig.wantsNoCode    || this.profile.techPref   === 'nocode',
      });

      // ONE response, then wait
      setTimeout(() => this._respond(lower, m, sig), 480);
    },

    _respond(lower, m, sig) {

      /* list all */
      if (/offer|programs|bootcamp|available|list|what.*have|all.*program/i.test(lower)) {
        _botMsg("CoreLab has 4 bootcamps this Autumn:");
        setTimeout(() => Object.values(PROGRAMS).forEach(_progCard), 300);
        return;
      }

      /* register */
      if (/register|enroll|sign up|join|apply|how.*register/i.test(lower)) {
        _botMsg("Head to the Register page and pick your program there. Want help picking the right one first?");
        setTimeout(() => _inlineButtons([
          { label: 'Help me choose', cb: () => this._startFullQuiz() },
          { label: 'Go to Register →', cb: () => { window.location.href='register.html'; } }
        ]), 400);
        return;
      }

      /* unsure */
      if (/don.t know|not sure|unsure|no idea|help me choose|confused|which one|^help$/i.test(lower)) {
        _botMsg("That's completely fine. 😄 Let me ask you 3 quick things.");
        setTimeout(() => this._startFullQuiz(), 600);
        return;
      }

      /* beginner, no specific goal */
      if (m.isBeginner && !sig.wantsML && !sig.wantsAgents && !sig.wantsLLMs && !sig.wantsContent) {
        _botMsg("Since you're just starting out, I'd first look at AI From Zero to AI Builder 👀\n\nIt's a broad 7-day intro — productivity tools, research assistants, web apps, automations and video creation. A solid foundation before going deeper.");
        setTimeout(() => _inlineButtons([
          { label: "Show me what I'd build", cb: () => { _progCard(PROGRAMS.builder); } },
          { label: 'I have more specific goals', cb: () => this._startFullQuiz() }
        ]), 400);
        return;
      }

      /* beginner + agents */
      if (m.isBeginner && (sig.wantsAgents || sig.wantsLLMs)) {
        _botMsg("Since you're starting out and interested in AI agents, I'd show you two options:\n\n→ AI From Zero to AI Builder — practical foundation first.\n→ Generative AI, LLMs & AI Agents — specifically LLMs, RAG and agents.\n\nWant me to explain the difference?");
        setTimeout(() => _inlineButtons([
          { label: 'Explain the difference', cb: () => {
            _botMsg("AI From Zero to Builder: practical, no deep technical knowledge needed. Multiple AI tools.\n\nGenerative AI & Agents: specifically LLMs, RAG, APIs, tool calling, autonomous agents. More focused and technical.");
            setTimeout(() => { _progCard(PROGRAMS.builder); _progCard(PROGRAMS.advanced); }, 300);
          }},
          { label: 'Show both', cb: () => { _progCard(PROGRAMS.builder); _progCard(PROGRAMS.advanced); } }
        ]), 400);
        return;
      }

      /* content / social / media */
      if (sig.wantsContent || sig.wantsMedia) {
        _botMsg("You're in the creator zone. 🎨\n\nAI Content Creator Weekend looks closely aligned — AI image generation, poster design, copywriting, short videos, voiceovers and multi-platform content. It's a 2-day intensive.");
        setTimeout(() => _inlineButtons([
          { label: 'View Content Creator', cb: () => { window.location.href = PROGRAMS.creator.url; } },
          { label: 'Tell me more', cb: () => { _progCard(PROGRAMS.creator); } }
        ]), 400);
        return;
      }

      /* ML + agents (split) */
      if ((sig.wantsML || sig.wantsData || sig.wantsStats) && (sig.wantsAgents || sig.wantsLLMs)) {
        _botMsg("You're between two pretty different directions 👀\n\n→ Data Science & ML — data, statistics, Python, ML models.\n→ Generative AI & Agents — LLMs, RAG, APIs, tool calling, autonomous agents.\n\nWhich sounds closer to what you want to do?");
        setTimeout(() => _inlineButtons([
          { label: 'Data & ML', cb: () => { _progCard(PROGRAMS.technical); } },
          { label: 'LLMs & Agents', cb: () => { _progCard(PROGRAMS.advanced); } },
          { label: 'Show both', cb: () => { _progCard(PROGRAMS.technical); _progCard(PROGRAMS.advanced); } }
        ]), 400);
        return;
      }

      /* ML / data */
      if (sig.wantsML || sig.wantsData || sig.wantsStats || sig.wantsMLModels) {
        _botMsg("Data Science & Machine Learning is the one I'd have you look at.\n\nIt covers Python data science, data cleaning, EDA, statistics, ML foundations, regression, classification and deploying a Streamlit app.");
        setTimeout(() => _inlineButtons([
          { label: 'View Data Science & ML', cb: () => { window.location.href = PROGRAMS.technical.url; } },
          { label: 'Show details', cb: () => { _progCard(PROGRAMS.technical); } }
        ]), 400);
        return;
      }

      /* agents / LLMs / RAG */
      if (sig.wantsAgents || sig.wantsLLMs || sig.wantsRAG || sig.wantsAPIs) {
        _botMsg("Okay, now we're talking. 🤖\n\nGenerative AI, LLMs & AI Agents is specifically focused on that — LLM foundations, APIs, RAG, embeddings, agent architecture, tool calling, n8n automation and a custom AI agent product.");
        setTimeout(() => _inlineButtons([
          { label: 'View AI Agents program', cb: () => { window.location.href = PROGRAMS.advanced.url; } },
          { label: 'Show details', cb: () => { _progCard(PROGRAMS.advanced); } }
        ]), 400);
        return;
      }

      /* automation */
      if (sig.wantsAutomate) {
        _botMsg("Automation can go two ways:\n\n→ AI From Zero to AI Builder — broad, beginner-friendly, includes practical automation tools.\n→ Generative AI & Agents — LLM-powered automation, n8n, tool calling, AI workflows.");
        setTimeout(() => _inlineButtons([
          { label: 'Beginner-friendly', cb: () => { _progCard(PROGRAMS.builder); } },
          { label: 'LLM automation', cb: () => { _progCard(PROGRAMS.advanced); } }
        ]), 400);
        return;
      }

      /* AI engineer */
      if (/engineer|career|profession/i.test(lower)) {
        _botMsg("AI engineering can mean a few different things. Which sounds more interesting?");
        setTimeout(() => _inlineButtons([
          { label: '🧠 LLMs, RAG & AI agents', cb: () => {
            _botMsg("Then Generative AI, LLMs & AI Agents looks like the direction to explore.");
            setTimeout(() => _progCard(PROGRAMS.advanced), 300);
          }},
          { label: '📊 ML models & data', cb: () => {
            _botMsg("Then Data Science & Machine Learning is the one to look at.");
            setTimeout(() => _progCard(PROGRAMS.technical), 300);
          }},
          { label: '💻 Practical AI applications', cb: () => {
            _botMsg("Then AI From Zero to AI Builder gives a broad practical foundation.");
            setTimeout(() => _progCard(PROGRAMS.builder), 300);
          }},
        ]), 400);
        return;
      }

      /* CS student */
      if (/cs\b|computer science|university|student/i.test(lower)) {
        _botMsg("Nice 👀 Since you have a CS background, which direction sounds more interesting?");
        setTimeout(() => _inlineButtons([
          { label: '📊 Train ML models & data', cb: () => {
            _botMsg("Then Data Science & ML looks like your direction.");
            setTimeout(() => _progCard(PROGRAMS.technical), 300);
          }},
          { label: '🧠 LLMs, RAG & AI agents', cb: () => {
            _botMsg("Then Generative AI & Agents is the more focused choice.");
            setTimeout(() => _progCard(PROGRAMS.advanced), 300);
          }},
          { label: '💻 Practical AI apps', cb: () => {
            _botMsg("Then AI From Zero to AI Builder gives a broad practical intro.");
            setTimeout(() => _progCard(PROGRAMS.builder), 300);
          }},
          { label: '🎨 Creative AI', cb: () => {
            _botMsg("Then AI Content Creator Weekend might be a fun starting point.");
            setTimeout(() => _progCard(PROGRAMS.creator), 300);
          }},
        ]), 400);
        return;
      }

      /* money — no promises */
      if (/money|income|earn|freelanc|salary|profit/i.test(lower)) {
        _botMsg("That can mean a few things 😄 Which sounds closest to what you're thinking about?");
        setTimeout(() => _inlineButtons([
          { label: '🎨 Content & services', cb: () => { _progCard(PROGRAMS.creator); } },
          { label: '💻 AI applications', cb: () => { _progCard(PROGRAMS.builder); } },
          { label: '🤖 AI products', cb: () => { _progCard(PROGRAMS.advanced); } },
          { label: '📊 Technical AI career', cb: () => {
            _botMsg("For a technical AI path — Data Science & ML or Generative AI & Agents, depending on whether you prefer data/models or LLMs/agents.");
            setTimeout(() => { _progCard(PROGRAMS.technical); _progCard(PROGRAMS.advanced); }, 300);
          }},
        ]), 400);
        return;
      }

      /* practical / no-code */
      if (sig.wantsPractical || sig.wantsNoCode) {
        _botMsg("AI From Zero to AI Builder looks like a good starting point.\n\nPractical building — AI productivity, research assistants, visual creation, code-free web apps and automation. No deep technical background needed.");
        setTimeout(() => _inlineButtons([
          { label: 'View AI Builder', cb: () => { window.location.href = PROGRAMS.builder.url; } },
          { label: 'Show details', cb: () => { _progCard(PROGRAMS.builder); } }
        ]), 400);
        return;
      }

      /* score-based fallback */
      const scores = this.score(m);
      const top    = this.topProgs(scores, 40);
      if (top.length > 0) {
        _botMsg(top.length === 1
          ? "Based on what you've told me, this looks like the closest match:"
          : "Based on what you've told me, these look closely aligned:");
        setTimeout(() => top.forEach(_progCard), 300);
        return;
      }

      /* truly unclear */
      _botMsg("I want to make sure I point you in the right direction. 😄 Let me ask you a couple of quick things.");
      setTimeout(() => this._startFullQuiz(), 500);
    },

    /* ── 3-question quiz ── */
    _startFullQuiz() {
      this.quizAnswers = {};
      _botMsg("Let me ask you 3 quick questions. 🤖\n\nQuestion 1: What would you rather build?");
      setTimeout(() => _inlineButtons([
        { label: '🎨 AI content',      cb: () => { this.quizAnswers.q1='creator';   this._quizQ2(); } },
        { label: '💻 AI applications', cb: () => { this.quizAnswers.q1='builder';   this._quizQ2(); } },
        { label: '📊 ML models',       cb: () => { this.quizAnswers.q1='technical'; this._quizQ2(); } },
        { label: '🤖 AI agents',       cb: () => { this.quizAnswers.q1='advanced';  this._quizQ2(); } },
        { label: '🤷 Not sure',        cb: () => { this.quizAnswers.q1='unsure';    this._quizQ2(); } },
      ]), 400);
    },

    _quizQ2() {
      _botMsg("Question 2: How technical do you want to get?");
      setTimeout(() => _inlineButtons([
        { label: 'Keep it practical',            cb: () => { this.quizAnswers.q2='nocode';    this._quizQ3(); } },
        { label: 'Some technical work',          cb: () => { this.quizAnswers.q2='some';      this._quizQ3(); } },
        { label: 'I want the technical stuff',   cb: () => { this.quizAnswers.q2='technical'; this._quizQ3(); } },
      ]), 400);
    },

    _quizQ3() {
      _botMsg("Question 3: What's your current level?");
      setTimeout(() => _inlineButtons([
        { label: 'Complete beginner',         cb: () => { this.quizAnswers.q3='beginner';  this._quizCalc(); } },
        { label: "I've experimented with AI", cb: () => { this.quizAnswers.q3='some';      this._quizCalc(); } },
        { label: "I'm already technical",     cb: () => { this.quizAnswers.q3='technical'; this._quizCalc(); } },
      ]), 400);
    },

    _quizCalc() {
      const a = this.quizAnswers;
      const sig = {
        isBeginner:    a.q3 === 'beginner',
        wantsTechnical:a.q3 === 'technical' || a.q2 === 'technical',
        wantsNoCode:   a.q2 === 'nocode',
        wantsPractical:a.q2 === 'nocode' || a.q2 === 'some',
        wantsBroad:    a.q1 === 'unsure',
        wantsContent:  a.q1 === 'creator',
        wantsMedia: false, wantsMarketing: false,
        wantsML:       a.q1 === 'technical',
        wantsDeepML:   a.q1 === 'technical' && a.q2 === 'technical',
        wantsData:     a.q1 === 'technical',
        wantsStats: false, wantsPython: a.q1 === 'technical',
        wantsMLModels: a.q1 === 'technical', wantsRegClass: false,
        wantsAgents:   a.q1 === 'advanced',
        wantsLLMs:     a.q1 === 'advanced',
        wantsRAG: false, wantsAPIs: false, wantsAutomate: false,
        wantsToolCall: false,
        wantsAIProduct:a.q1 === 'builder' || a.q1 === 'advanced',
      };
      if (a.q1 === 'unsure' && a.q3 === 'beginner') { sig.wantsBroad = true; sig.isBeginner = true; }

      const scores = this.score(sig);
      const recs   = this.topProgs(scores, 30);
      const final  = recs.length > 0 ? recs : [PROGRAMS.builder];

      setTimeout(() => {
        _botMsg(final.length === 1
          ? "Based on what you selected, this looks like the closest match:"
          : "Based on what you selected, these look closely aligned:");
        setTimeout(() => final.forEach(_progCard), 350);
      }, 600);
    },
  }; /* end brain */

  /* ═══════════════════════════════════════════════════════════
   *  11. SECTION & CARD DATA
   * ═══════════════════════════════════════════════════════════ */
  const SECTION_POSITIONS = {
    hero: 'bottom-right', upcoming: 'bottom-left', courses: 'bottom-left',
    schedule: 'bottom-left', curriculum: 'bottom-right', register: 'bottom-right',
    faq: 'bottom-left', projects: 'bottom-right', mentors: 'bottom-left',
    pathways: 'bottom-right', about: 'bottom-left',
  };

  /* ONE message per section per page load */
  const SECTION_MSGS = {
    upcoming:   { text: "Checking out the programs? 👀 Not sure which fits?", key: 'section_upcoming', btn: { label: 'Help me choose', action: 'quiz' } },
    courses:    { text: "Four programs, four directions.", key: 'section_courses', btn: { label: 'Help me choose', action: 'quiz' } },
    schedule:   { text: "Four programs, four directions.", key: 'section_schedule', btn: { label: 'Help me choose', action: 'quiz' } },
    curriculum: { text: "Deep-diving into the curriculum — nice.", key: 'section_curriculum' },
    register:   { text: "Thinking about joining? 👀", key: 'section_register',
                  btns: [{ label: 'Help me choose', action: 'quiz' }, { label: 'Register now', action: 'register' }] },
    faq:        { text: "Questions? You can ask me too.", key: 'section_faq', btn: { label: 'Ask me', action: 'chat' } },
    projects:   { text: "These are the kinds of things you can actually build. 😎", key: 'section_projects' },
    about:      { text: "Want to know who's behind CoreLab? Take a look.", key: 'section_about' },
    pathways:   { text: "Different tracks for different directions. Which calls to you?", key: 'section_pathways' },
    mentors:    { text: "The team behind CoreLab — FAST-NUCES alumni.", key: 'section_mentors' },
  };

  const HOVER_MSGS = {
    creator:   { text: "Creator mode activated. 🎨",     key: 'hover_creator'   },
    builder:   { text: "Starting your AI journey?",       key: 'hover_builder'   },
    technical: { text: "Ready for some Python + ML? 📊",  key: 'hover_technical' },
    advanced:  { text: "Agent territory. 👀",              key: 'hover_advanced'  },
  };

  const CARD_ENTRY_MSGS = {
    creator:   { text: "👀 Looking at the creator track? If you want AI-powered content, this one's worth a look.", key: 'card_creator'   },
    builder:   { text: "New to AI? This is the broadest starting point of the four.",                               key: 'card_builder'   },
    technical: { text: "Okay... things are getting technical 📊 Python, statistics and ML are waiting.",            key: 'card_technical' },
    advanced:  { text: "Ahhh... the advanced stuff 🤖 LLMs, RAG, tools and agents.",                               key: 'card_advanced'  },
  };

  /* ═══════════════════════════════════════════════════════════
   *  12. SECTION OBSERVER  (debounced, fires once per section)
   * ═══════════════════════════════════════════════════════════ */
  const _seenSections  = new Set();
  let   _sectionDebounce = null;

  function _onSectionVisible(sectionId) {
    if (_seenSections.has(sectionId))           return;
    if (S.phase === SM.REGISTRATION)            return;
    if (S.phase === SM.USER_INTERACTING)        return;

    const def = SECTION_MSGS[sectionId];
    if (!def) return;

    _seenSections.add(sectionId);

    const side      = SECTION_POSITIONS[sectionId] || 'bottom-right';
    const sinceMove = Date.now() - S.lastMoveAt;
    const doMove    = !S.isWalking && sinceMove > CD.MOVE;

    const afterMove = () => {
      _doAnim('lookright', 1400);
      setTimeout(() => autoSpeak(def.text, { key: def.key, btn: def.btn, btns: def.btns, duration: 6500 }), 1200);
    };

    if (doMove) {
      S.lastMoveAt = Date.now();
      S.phase = SM.WALKING;
      _walk(side, () => { S.phase = SM.IDLE; afterMove(); });
    } else {
      afterMove();
    }
  }

  const sectionSelectors = [
    '.hero','#upcoming','#courses','.schedule-section',
    '#curriculum','#register','.faq-section',
    '.projects-grid','.mentors-section','.pathways-section',
  ];
  const observedEls = [];
  sectionSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      if (!el._buddyId) {
        el._buddyId = el.id || sel.replace(/[#.]/g,'').split(' ')[0];
        observedEls.push(el);
      }
    });
  });

  const secIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting || e.intersectionRatio < 0.35) return;
      clearTimeout(_sectionDebounce);
      _sectionDebounce = setTimeout(() => _onSectionVisible(e.target._buddyId), 700);
    });
  }, { threshold: 0.35 });
  observedEls.forEach(el => secIO.observe(el));

  /* ═══════════════════════════════════════════════════════════
   *  13. PROGRAM CARD ENTRY OBSERVER  (debounced)
   * ═══════════════════════════════════════════════════════════ */
  let _cardDebounce = null;

  const cardIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting || e.intersectionRatio < 0.5) return;
      const cat = e.target.getAttribute('data-category');
      if (!cat) return;
      clearTimeout(_cardDebounce);
      _cardDebounce = setTimeout(() => {
        if (S.activeCard === cat)                            return;
        if (Date.now() - S.lastCardAt < CD.CARD_ENTRY)      return;
        if (!canAutoSpeak())                                 return;
        const def = CARD_ENTRY_MSGS[cat];
        if (!def || wasSaid(def.key))                        return;
        S.activeCard = cat;
        S.lastCardAt = Date.now();
        const side      = (cat === 'creator' || cat === 'builder') ? 'bottom-left' : 'bottom-right';
        const sinceMove = Date.now() - S.lastMoveAt;
        if (!S.isWalking && sinceMove > CD.MOVE) {
          S.lastMoveAt = Date.now();
          S.phase = SM.WALKING;
          _walk(side, () => { S.phase = SM.IDLE; setTimeout(() => autoSpeak(def.text, { key: def.key, duration: 6000 }), 600); });
        } else {
          autoSpeak(def.text, { key: def.key, duration: 6000 });
        }
      }, 800);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-category]').forEach(el => cardIO.observe(el));

  /* ═══════════════════════════════════════════════════════════
   *  14. CARD HOVER  (low-priority, cooldown-gated)
   * ═══════════════════════════════════════════════════════════ */
  document.querySelectorAll('.course-card, .program-card-filterable, [data-category]').forEach(card => {
    card.addEventListener('mouseenter', () => {
      if (S.isChatOpen || S.isSpeaking)                    return;
      if (S.phase === SM.REGISTRATION)                     return;
      if (S.phase === SM.USER_INTERACTING)                 return;
      if (Date.now() - S.lastHoverAt < CD.HOVER)          return;
      const cat = card.getAttribute('data-category');
      const def = HOVER_MSGS[cat];
      if (!def || wasSaid(def.key))                        return;
      S.lastHoverAt = Date.now();
      _doAnim('point', 1800);
      setTimeout(() => autoSpeak(def.text, { key: def.key, duration: 4000 }), 450);
    });
    card.addEventListener('mouseleave', () => {
      if (S.phase !== SM.SPEAKING && S.phase !== SM.WALKING && S.phase !== SM.USER_INTERACTING)
        S.phase = SM.IDLE;
    });
  });

  /* ═══════════════════════════════════════════════════════════
   *  15. REGISTER BUTTON — say one thing, then go quiet
   * ═══════════════════════════════════════════════════════════ */
  document.querySelectorAll('a[href*="register"], .btn-header').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!wasSaid('reg_nice_choice')) {
        markSaid('reg_nice_choice');
        S.isSpeaking = true;
        _doSpeak("Nice choice! 🚀", { duration: 3000 });
        setTimeout(() => {
          S.isSpeaking = false;
          S.phase = SM.REGISTRATION; // stay quiet
          _hideSpeech();
        }, 3500);
      }
    });
  });

  /* ═══════════════════════════════════════════════════════════
   *  16. CLICK ROBOT → open/close chat
   * ═══════════════════════════════════════════════════════════ */
  charEl.addEventListener('click', () => {
    S.lastInteraction = Date.now();
    if (S.isChatOpen) { _closeChat(); } else { _openChat(); }
  });

  bubbleClose.addEventListener('click', () => {
    _hideSpeech();
    S.isSpeaking = false;
    clearTimeout(_speakReleaseTimer);
    S.phase = SM.IDLE;
    S.lastInteraction = Date.now();
  });

  chatClose.addEventListener('click', () => _closeChat());

  /* ═══════════════════════════════════════════════════════════
   *  17. CHAT SEND
   * ═══════════════════════════════════════════════════════════ */
  function _sendChat() {
    const txt = chatInput.value.trim();
    if (!txt) return;
    chatInput.value = '';
    chatSuggs.innerHTML = '';
    S.phase = SM.USER_INTERACTING;
    brain.handle(txt);
  }
  chatSend.addEventListener('click', _sendChat);
  chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') _sendChat(); });
  chatInput.addEventListener('focus',  () => { S.isTyping = true;  S.phase = SM.USER_INTERACTING; });
  chatInput.addEventListener('blur',   () => { S.isTyping = false; if (!S.isChatOpen) S.phase = SM.IDLE; });

  /* ═══════════════════════════════════════════════════════════
   *  18. IDLE VISUAL ACTIONS  (no autonomous speaking)
   * ═══════════════════════════════════════════════════════════ */
  const idleAnims = ['wave', 'lookright', 'lookleft', 'think'];
  let _idleTimer  = null;

  function _scheduleIdle() {
    clearTimeout(_idleTimer);
    _idleTimer = setTimeout(() => {
      if (S.isSpeaking || S.isWalking || S.isChatOpen ||
          S.isTyping || S.phase === SM.USER_INTERACTING ||
          S.phase === SM.REGISTRATION) {
        _scheduleIdle(); return;
      }
      const anim = idleAnims[Math.floor(Math.random() * idleAnims.length)];
      _doAnim(anim, 2000);

      // once-only inactivity message (after 2 min)
      if (!S.idleFired && Date.now() - S.lastInteraction > 120000) {
        S.idleFired = true;
        setTimeout(() => autoSpeak("Still exploring? Take your time. 😄", { key: 'idle_once', duration: 5000 }), 2000);
      }
      _scheduleIdle();
    }, 18000 + Math.random() * 14000);
  }
  _scheduleIdle();

  ['mousemove','keydown','touchstart'].forEach(evt =>
    document.addEventListener(evt, () => { S.lastInteraction = Date.now(); }, { passive: true })
  );

  /* ═══════════════════════════════════════════════════════════
   *  19. INITIAL ENTRY  (one-time walk-on)
   * ═══════════════════════════════════════════════════════════ */
  (() => {
    const p = _safePos('bottom-right');
    const initBottom = Math.max(window.innerHeight - p.y - 120, 100);
    charEl.style.bottom = initBottom + 'px';
    charEl.style.left   = (window.innerWidth + 50) + 'px';
    _robotX = window.innerWidth + 50;
    _robotY = p.y;

    setTimeout(() => {
      S.phase = SM.WALKING;
      _walk('bottom-right', () => {
        S.phase = SM.IDLE;
        _doAnim('wave', 1800);
        if (!S.hasGreeted) {
          S.hasGreeted = true;
          setTimeout(() => autoSpeak("Hey! 👋 Welcome to CoreLab.", { key: 'greeting', duration: 5000 }), 900);
        }
      });
    }, prefersReduced ? 400 : 2500);
  })();

  /* ═══════════════════════════════════════════════════════════
   *  20. RESIZE
   * ═══════════════════════════════════════════════════════════ */
  window.addEventListener('resize', () => {
    if (!S.isWalking) {
      const side = _robotX < window.innerWidth / 2 ? 'bottom-left' : 'bottom-right';
      const p = _safePos(side);
      _setPos(p.x, p.y);
    }
  });

})();
