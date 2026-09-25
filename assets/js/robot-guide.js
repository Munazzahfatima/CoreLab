/**
 * ═══════════════════════════════════════════════════════════════
 *  CoreLab — CORE AI Guide  v4.0
 *  Premium redesign: JARVIS-style floating robot, mouse-tracking
 *  eyes, particle system, career quiz, context awareness.
 *  Brain (signals, scoring, quiz) preserved from v3.
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  if (window.__buddyInitialised) return;
  window.__buddyInitialised = true;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ═══════════════════════════════════════════════════════════
   *  1. PROGRAM DATABASE  (unchanged — real data only)
   * ═══════════════════════════════════════════════════════════ */
  const PROGRAMS = {
    creator: {
      id:'creator', title:'AI Content Creator Weekend',
      url:'ai-content-creator.html', dates:'28–29 September 2026',
      duration:'2-Day Intensive', price:'PKR 2,999 (Student Launch Pass)',
      level:'Beginner Friendly',
      focus:'AI image generation, poster design, copywriting, hook engines, short videos, AI voiceovers, subtitles, multi-platform content',
      outcome:'A complete ready-to-publish multi-platform content pack',
      tag:'🎨 Creator', color:'#e07040',
      reasons:['Perfect for content creators & freelancers','No coding required','2-day weekend format','AI images, videos & voiceovers'],
    },
    builder: {
      id:'builder', title:'AI From Zero to AI Builder',
      url:'ai-from-zero-to-builder.html', dates:'5–11 October 2026',
      duration:'7-Day Bootcamp', price:'PKR 4,999 Regular · PKR 5,999 Premium',
      level:'Beginner / Builder', tag:'🚀 Builder', color:'#3b82f6',
      focus:'AI productivity, research assistants, visual creation, code-free web apps, automation, video creation, custom AI projects',
      outcome:'Broad AI foundation — apps, automations, visuals, research assistants',
      reasons:['Ideal starting point for beginners','Build real projects across 7 days','Covers automation, apps & AI tools','No prior coding needed'],
    },
    technical: {
      id:'technical', title:'Data Science & Machine Learning',
      url:'data-science-machine-learning.html', dates:'5–15 October 2026',
      duration:'10-Day Bootcamp', price:'PKR 10,000 Early Bird · PKR 12,000 Regular',
      level:'Technical', tag:'📊 Data Science', color:'#2d7a4f',
      focus:'Python, data cleaning, EDA, statistics, ML foundations, regression, classification, Scikit-learn, Streamlit, GitHub portfolio',
      outcome:'Deployed Streamlit ML app + GitHub portfolio',
      reasons:['Great for CS/technical students','Python, ML models & real datasets','End-to-end project deployment','Strong portfolio outcome'],
    },
    advanced: {
      id:'advanced', title:'Generative AI, LLMs & AI Agents',
      url:'generative-ai-agents.html', dates:'12–22 October 2026',
      duration:'10-Day Bootcamp', price:'PKR 10,000 Early Bird · PKR 12,000 Regular',
      level:'Advanced AI', tag:'🤖 AI Agents', color:'#818cf8',
      focus:'LLM foundations, prompt engineering, APIs, RAG, embeddings, agent architecture, tool calling, n8n, AI memory, deployment',
      outcome:'Custom AI agent product deployed end-to-end',
      reasons:['Build autonomous AI agents','LLMs, RAG, APIs & n8n automation','Advanced technical track','Real deployable AI product'],
    },
  };

  /* ═══════════════════════════════════════════════════════════
   *  2. STATE
   * ═══════════════════════════════════════════════════════════ */
  const SM = { IDLE:'IDLE', SPEAKING:'SPEAKING', WAITING:'WAITING', USER_INTERACTING:'USER_INTERACTING', QUIET:'QUIET', CELEBRATING:'CELEBRATING' };
  const CD = { AUTONOMOUS:25000, HOVER:35000, CARD:35000, SAME:60000, MOVE:6000, POST:10000 };

  const S = {
    phase: SM.IDLE,
    isChatOpen: false, isTyping: false, isSpeaking: false,
    lastAutoAt: 0, lastHoverAt: 0, lastCardAt: 0, lastMoveAt: 0,
    recentMsgs: [], triggeredSections: new Set(), activeCard: null,
    idleFired: false, hasGreeted: false, lastInteraction: Date.now(),
    currentZone: 'bottom-right', lastScrollPct: -1,
    quizOpen: false,
    mouseX: window.innerWidth / 2, mouseY: window.innerHeight / 2,
  };

  /* ─── session persistence ─── */
  const PKEY = 'corelab_core_v4';
  function _save() {
    try {
      sessionStorage.setItem(PKEY, JSON.stringify({
        hasGreeted: S.hasGreeted, idleFired: S.idleFired,
        currentZone: S.currentZone, lastAutoAt: S.lastAutoAt,
        recentMsgKeys: S.recentMsgs.map(m=>({key:m.key,at:m.at})),
        triggered: [...S.triggeredSections],
        profile: brain.profile, savedAt: Date.now(),
      }));
    } catch(e){}
  }
  function _load() {
    try {
      const d = JSON.parse(sessionStorage.getItem(PKEY)||'null');
      if (!d || Date.now()-d.savedAt > 1800000) return false;
      S.hasGreeted = d.hasGreeted||false; S.idleFired = d.idleFired||false;
      S.currentZone = d.currentZone||'bottom-right';
      S.lastAutoAt  = d.lastAutoAt||0;
      if (d.recentMsgKeys) d.recentMsgKeys.forEach(m=>S.recentMsgs.push(m));
      if (d.triggered)     d.triggered.forEach(s=>S.triggeredSections.add(s));
      if (d.profile)       Object.assign(brain.profile, d.profile);
      return true;
    } catch(e){ return false; }
  }
  setInterval(_save, 5000);
  window.addEventListener('pagehide', _save);
  window.addEventListener('beforeunload', _save);

  /* ─── speak gate ─── */
  function wasSaid(key) {
    const now = Date.now();
    S.recentMsgs = S.recentMsgs.filter(m => now-m.at < CD.SAME);
    return S.recentMsgs.some(m => m.key === key);
  }
  function markSaid(key) { S.recentMsgs.push({key, at:Date.now()}); }
  function canAutoSpeak() {
    return !S.isSpeaking && !S.isChatOpen && !S.isTyping &&
           S.phase !== SM.QUIET && S.phase !== SM.USER_INTERACTING &&
           S.phase !== SM.CELEBRATING &&
           (Date.now()-S.lastAutoAt) >= CD.AUTONOMOUS;
  }

  /* ═══════════════════════════════════════════════════════════
   *  3. DOM STRUCTURE
   * ═══════════════════════════════════════════════════════════ */
  const root = document.createElement('div');
  root.id = 'core-guide';
  root.setAttribute('aria-label', 'CORE AI Guide');
  root.innerHTML = `
    <!-- ── Particles ── -->
    <div id="cg-particles">
      <span class="cgp"></span><span class="cgp"></span><span class="cgp"></span>
      <span class="cgp"></span><span class="cgp"></span><span class="cgp"></span>
    </div>

    <!-- ── Robot SVG ── -->
    <button id="cg-robot" aria-label="Open CORE AI Guide" title="Your AI Career Guide">
      <svg id="cg-svg" viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" overflow="visible">

        <!-- Glow halo -->
        <ellipse cx="60" cy="155" rx="38" ry="8" fill="#D85A30" opacity="0.15" id="cg-shadow"/>

        <!-- Antenna -->
        <line x1="60" y1="18" x2="60" y2="6" stroke="#A33E1A" stroke-width="3" stroke-linecap="round" id="cg-ant-line"/>
        <circle cx="60" cy="5" r="5" fill="#D85A30" id="cg-ant-ball"/>
        <circle cx="60" cy="5" r="2.5" fill="#FAECE7" opacity=".9"/>

        <!-- HEAD shell -->
        <rect x="18" y="18" width="84" height="62" rx="22" fill="#FAECE7" stroke="#D85A30" stroke-width="1.8" id="cg-head"/>
        <!-- Helmet stripe -->
        <rect x="18" y="18" width="84" height="22" rx="22" fill="#D85A30" id="cg-helmet"/>
        <rect x="18" y="32" width="84" height="8" fill="#D85A30"/>

        <!-- Visor light panel -->
        <rect x="26" y="36" width="68" height="38" rx="14" fill="#FAECE7" id="cg-visor"/>
        <rect x="27" y="37" width="66" height="36" rx="13" fill="none" stroke="#D85A30" stroke-width="1"/>

        <!-- Eyes -->
        <g id="cg-eyes">
          <ellipse cx="43" cy="53" rx="11" ry="13" fill="#fff" id="cg-eye-l-bg"/>
          <ellipse cx="43" cy="53" rx="7.5" ry="9" fill="#D85A30" opacity=".95" id="cg-eye-l-iris"/>
          <circle cx="43" cy="53" r="4.5" fill="#7c2010" id="cg-eye-l-pupil"/>
          <circle cx="45" cy="50" r="1.8" fill="#fff" opacity=".9"/>
          <ellipse cx="77" cy="53" rx="11" ry="13" fill="#fff" id="cg-eye-r-bg"/>
          <ellipse cx="77" cy="53" rx="7.5" ry="9" fill="#D85A30" opacity=".95" id="cg-eye-r-iris"/>
          <circle cx="77" cy="53" r="4.5" fill="#7c2010" id="cg-eye-r-pupil"/>
          <circle cx="79" cy="50" r="1.8" fill="#fff" opacity=".9"/>
        </g>

        <!-- Blink overlays -->
        <ellipse id="cg-blink-l" cx="43" cy="53" rx="11" ry="0" fill="#FAECE7"/>
        <ellipse id="cg-blink-r" cx="77" cy="53" rx="11" ry="0" fill="#FAECE7"/>

        <!-- Mouth -->
        <path id="cg-mouth" d="M40 68 Q60 76 80 68" stroke="#D85A30" stroke-width="2.5" stroke-linecap="round" fill="none"/>

        <!-- Ear panels -->
        <rect x="8"  y="40" width="11" height="22" rx="5.5" fill="#F0997B" stroke="#D85A30" stroke-width="1.5"/>
        <rect x="101" y="40" width="11" height="22" rx="5.5" fill="#F0997B" stroke="#D85A30" stroke-width="1.5"/>
        <circle cx="13.5"  cy="51" r="3.5" fill="#D85A30"/>
        <circle cx="106.5" cy="51" r="3.5" fill="#D85A30"/>

        <!-- Neck -->
        <rect x="48" y="80" width="24" height="10" rx="5" fill="#F0997B"/>

        <!-- BODY -->
        <rect x="14" y="90" width="92" height="58" rx="20" fill="#FAECE7" stroke="#D85A30" stroke-width="1.8" id="cg-body"/>
        <!-- Shoulder stripe -->
        <rect x="14" y="90" width="92" height="18" rx="20" fill="#D85A30"/>
        <rect x="14" y="100" width="92" height="8" fill="#D85A30"/>

        <!-- Chest panel -->
        <rect x="32" y="115" width="56" height="26" rx="11" fill="#fff" stroke="#F0997B" stroke-width="1"/>

        <!-- REACTOR CORE -->
        <circle cx="60" cy="126" r="10" fill="#D85A30" opacity=".15" id="cg-core-outer"/>
        <circle cx="60" cy="126" r="7"  fill="#D85A30" opacity=".55" id="cg-core-mid"/>
        <circle cx="60" cy="126" r="4"  fill="#D85A30" id="cg-core-inner"/>
        <circle cx="60" cy="126" r="2"  fill="#fff" opacity=".9"/>

        <!-- Side dots -->
        <circle cx="40" cy="133" r="3" fill="#D85A30" opacity=".6"/>
        <circle cx="80" cy="133" r="3" fill="#D85A30" opacity=".6"/>

        <!-- LEFT ARM -->
        <g id="cg-arm-l" style="transform-origin:14px 98px">
          <rect x="2"  y="98" width="13" height="36" rx="6.5" fill="#FAECE7" stroke="#D85A30" stroke-width="1.5"/>
          <rect x="2"  y="98" width="13" height="12"  rx="6.5" fill="#D85A30"/>
          <ellipse cx="8.5" cy="138" rx="8" ry="5.5" fill="#F0997B" stroke="#D85A30" stroke-width="1.2"/>
          <line x1="5.5" y1="136" x2="4.5" y2="143" stroke="#A33E1A" stroke-width="1.4" stroke-linecap="round"/>
          <line x1="8.5" y1="135" x2="8.5" y2="143" stroke="#A33E1A" stroke-width="1.4" stroke-linecap="round"/>
          <line x1="11.5" y1="136" x2="12.5" y2="143" stroke="#A33E1A" stroke-width="1.4" stroke-linecap="round"/>
        </g>

        <!-- RIGHT ARM -->
        <g id="cg-arm-r" style="transform-origin:106px 98px">
          <rect x="105" y="98" width="13" height="36" rx="6.5" fill="#FAECE7" stroke="#D85A30" stroke-width="1.5"/>
          <rect x="105" y="98" width="13" height="12"  rx="6.5" fill="#D85A30"/>
          <ellipse cx="111.5" cy="138" rx="8" ry="5.5" fill="#F0997B" stroke="#D85A30" stroke-width="1.2"/>
        </g>

        <!-- LEGS -->
        <g id="cg-leg-l" style="transform-origin:36px 148px">
          <rect x="26" y="148" width="22" height="16" rx="8" fill="#FAECE7" stroke="#D85A30" stroke-width="1.4"/>
          <rect x="26" y="148" width="22" height="8"  rx="8" fill="#D85A30"/>
          <rect x="21" y="160" width="32" height="10" rx="7" fill="#D85A30"/>
        </g>
        <g id="cg-leg-r" style="transform-origin:72px 148px">
          <rect x="72" y="148" width="22" height="16" rx="8" fill="#FAECE7" stroke="#D85A30" stroke-width="1.4"/>
          <rect x="72" y="148" width="22" height="8"  rx="8" fill="#D85A30"/>
          <rect x="67" y="160" width="32" height="10" rx="7" fill="#D85A30"/>
        </g>

        <!-- CORE label -->
        <text x="60" y="109" text-anchor="middle" font-family="Inter,sans-serif"
              font-size="7.5" font-weight="800" fill="#D85A30" letter-spacing="1.5">CORE AI</text>
      </svg>
    </button>

    <!-- ── Speech bubble ── -->
    <div id="cg-bubble" role="status" aria-live="polite">
      <button id="cg-bubble-x" aria-label="Dismiss">×</button>
      <p id="cg-bubble-text"></p>
      <div id="cg-bubble-btns"></div>
    </div>

    <!-- ── Chat panel (glassmorphism) ── -->
    <div id="cg-chat" role="dialog" aria-label="CORE AI Guide Chat" aria-modal="false">
      <div id="cg-chat-header">
        <div id="cg-chat-title">
          <span class="cg-status-dot"></span>
          <span>CORE AI Guide</span>
          <span class="cg-tagline">Your AI Career Guide</span>
        </div>
        <button id="cg-chat-close" aria-label="Close">×</button>
      </div>
      <div id="cg-chat-msgs"></div>
      <div id="cg-chat-typing" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
      <div id="cg-chat-chips"></div>
      <div id="cg-chat-input-wrap">
        <input id="cg-chat-input" type="text"
               placeholder="Ask me anything about AI careers..."
               aria-label="Your message" autocomplete="off"/>
        <button id="cg-chat-send" aria-label="Send">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- ── Confetti canvas ── -->
    <canvas id="cg-confetti" aria-hidden="true"></canvas>
  `;
  document.body.appendChild(root);

  /* ═══════════════════════════════════════════════════════════
   *  4. STYLES
   * ═══════════════════════════════════════════════════════════ */
  const css = document.createElement('style');
  css.textContent = `
    /* ── Root layer ── */
    #core-guide {
      position: fixed; z-index: 99990;
      pointer-events: none;
      bottom: 110px; right: 28px;
      display: flex; flex-direction: column; align-items: center;
      gap: 10px;
      /* entrance: hidden until JS triggers */
      opacity: 0; transform: translateY(80px) scale(.7);
      transition: opacity .6s ease, transform .6s cubic-bezier(.34,1.56,.64,1);
    }
    #core-guide.cg-visible {
      opacity: 1; transform: translateY(0) scale(1);
    }

    /* ── Float animation ── */
    @keyframes cgFloat {
      0%,100% { transform: translateY(0); }
      50%      { transform: translateY(-12px); }
    }

    /* ── Robot button ── */
    #cg-robot {
      width: 150px; height: 170px;
      background: none; border: none; padding: 0;
      cursor: pointer; pointer-events: all;
      position: relative;
      animation: ${prefersReduced ? 'none' : 'cgFloat 4.5s ease-in-out infinite'};
      transition: filter .25s;
      flex-shrink: 0;
    }
    #cg-robot:hover {
      animation: none;
    }
    #cg-svg { width:100%; height:100%; display:block; }

    /* ── Reactor pulse ── */
    @keyframes cgReactor {
      0%,100% { r:10; opacity:.15; }
      50%      { r:14; opacity:.28; }
    }
    #cg-core-outer { animation: ${prefersReduced?'none':'cgReactor 2s ease-in-out infinite'}; }

    @keyframes cgReactorMid {
      0%,100% { opacity:.55; }
      50%      { opacity:.9; }
    }
    #cg-core-mid { animation: ${prefersReduced?'none':'cgReactorMid 2s ease-in-out infinite'}; }

    /* ── Antenna pulse ── */
    @keyframes cgAnt { 0%,100%{r:5} 50%{r:7} }
    #cg-ant-ball { animation: ${prefersReduced?'none':'cgAnt 2s ease-in-out infinite'}; }

    /* ── Blink ── */
    @keyframes cgBlink { 0%,88%,100%{ry:0} 93%{ry:13} }
    #cg-blink-l { animation: ${prefersReduced?'none':'cgBlink 4.5s ease-in-out infinite'}; }
    #cg-blink-r { animation: ${prefersReduced?'none':'cgBlink 4.5s ease-in-out infinite .15s'}; }

    /* ── Arm wave ── */
    @keyframes cgWave { 0%,100%{transform:rotate(0)} 30%{transform:rotate(-40deg)} 70%{transform:rotate(15deg)} }
    #core-guide[data-anim="wave"]  #cg-arm-l { animation: ${prefersReduced?'none':'cgWave .75s ease-in-out infinite'}; }

    /* ── Walking legs ── */
    @keyframes cgLegL { 0%,100%{transform:rotate(0)} 50%{transform:rotate(-20deg)} }
    @keyframes cgLegR { 0%,100%{transform:rotate(0)} 50%{transform:rotate(20deg)} }
    #core-guide[data-anim="walk"] #cg-leg-l { animation:${prefersReduced?'none':'cgLegL .4s ease-in-out infinite'}; }
    #core-guide[data-anim="walk"] #cg-leg-r { animation:${prefersReduced?'none':'cgLegR .4s ease-in-out infinite'}; }

    /* ── Happy bounce ── */
    @keyframes cgHappy { 0%,100%{transform:translateY(0) scale(1)} 30%{transform:translateY(-16px) scale(1.06)} 60%{transform:translateY(-8px) scale(1.03)} }
    #core-guide[data-anim="happy"] #cg-robot { animation:${prefersReduced?'none':'cgHappy .55s ease-in-out 2'}; }

    /* ── Surprised ── */
    @keyframes cgSurp { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }
    #core-guide[data-anim="surprised"] #cg-robot { animation:${prefersReduced?'none':'cgSurp .5s ease-in-out'}; }

    /* ── Facing direction ── */
    #core-guide.facing-right #cg-robot { transform: scaleX(-1); }

    /* ── Shadow ── */
    @keyframes cgShadow { 0%,100%{rx:38;opacity:.18} 50%{rx:28;opacity:.10} }
    #cg-shadow { animation: ${prefersReduced?'none':'cgShadow 4.5s ease-in-out infinite'}; }

    /* ── Particles ── */
    #cg-particles {
      position: absolute; width:160px; height:180px;
      top:-10px; left:-5px; pointer-events:none;
    }
    .cgp {
      position: absolute; border-radius: 50%;
      background: #c2521a; pointer-events: none;
    }
    .cgp:nth-child(1) { width:5px; height:5px; top:20%; left:5%;  opacity:.5; animation:${prefersReduced?'none':'cgParticle1 3.2s ease-in-out infinite'}; }
    .cgp:nth-child(2) { width:4px; height:4px; top:60%; left:92%; opacity:.4; animation:${prefersReduced?'none':'cgParticle2 4.1s ease-in-out infinite .8s'}; }
    .cgp:nth-child(3) { width:6px; height:6px; top:10%; left:80%; opacity:.35; animation:${prefersReduced?'none':'cgParticle1 5s ease-in-out infinite 1.2s'}; }
    .cgp:nth-child(4) { width:3px; height:3px; top:75%; left:10%; opacity:.45; animation:${prefersReduced?'none':'cgParticle2 3.7s ease-in-out infinite .4s'}; }
    .cgp:nth-child(5) { width:5px; height:5px; top:40%; left:95%; opacity:.3; animation:${prefersReduced?'none':'cgParticle1 4.5s ease-in-out infinite 2s'}; }
    .cgp:nth-child(6) { width:4px; height:4px; top:88%; left:55%; opacity:.4; animation:${prefersReduced?'none':'cgParticle2 3.9s ease-in-out infinite .6s'}; }

    @keyframes cgParticle1 {
      0%,100% { transform:translateY(0)   translateX(0); opacity:.5; }
      33%      { transform:translateY(-14px) translateX(6px); opacity:.9; }
      66%      { transform:translateY(-8px)  translateX(-4px); opacity:.6; }
    }
    @keyframes cgParticle2 {
      0%,100% { transform:translateY(0)   translateX(0); opacity:.4; }
      40%      { transform:translateY(-10px) translateX(-8px); opacity:.85; }
      70%      { transform:translateY(-5px)  translateX(5px); opacity:.5; }
    }

    /* ══════════════════════════════════════════
       SPEECH BUBBLE
    ══════════════════════════════════════════ */
    #cg-bubble {
      position: absolute;
      bottom: 180px;
      right: 0;
      background: rgba(255,253,249,.97);
      border: 1.5px solid #e8d9c4;
      border-radius: 18px 18px 4px 18px;
      padding: 13px 36px 13px 15px;
      width: 240px;
      box-shadow: 0 8px 32px rgba(45,36,22,.16);
      pointer-events: all;
      opacity: 0; transform: scale(.85) translateX(8px);
      transform-origin: bottom right;
      transition: opacity .36s ease, transform .36s cubic-bezier(.34,1.56,.64,1);
    }
    #cg-bubble.show { opacity:1; transform:scale(1) translateX(0); }

    /* bubble tail pointing down-right (robot on right) */
    #cg-bubble::after {
      content:''; position:absolute;
      bottom:-9px; right:20px;
      border:9px solid transparent;
      border-top-color: #e8d9c4;
    }
    #cg-bubble::before {
      content:''; position:absolute;
      bottom:-6px; right:21px;
      border:8px solid transparent;
      border-top-color: rgba(255,253,249,.97);
      z-index:1;
    }

    /* When robot is on the left — bubble flips to the right side */
    #core-guide.bubble-right #cg-bubble {
      right: auto;
      left: 0;
      border-radius: 18px 18px 18px 4px;
      transform-origin: bottom left;
      transform: scale(.85) translateX(-8px);
    }
    #core-guide.bubble-right #cg-bubble.show {
      transform: scale(1) translateX(0);
    }
    /* flip tail to bottom-left */
    #core-guide.bubble-right #cg-bubble::after {
      right: auto; left: 20px;
    }
    #core-guide.bubble-right #cg-bubble::before {
      right: auto; left: 21px;
    }

    #cg-bubble-x {
      position:absolute; top:7px; right:9px;
      background:none; border:none; font-size:1rem;
      color:#b89a7a; cursor:pointer; padding:2px 5px; border-radius:4px;
      pointer-events:all;
    }
    #cg-bubble-x:hover { color:#c2521a; background:#f3ede4; }

    #cg-bubble-text {
      font-family:'Inter',sans-serif; font-size:.85rem;
      font-weight:600; color:#2d2416; line-height:1.5; margin:0 0 10px;
    }
    #cg-bubble-btns { display:flex; flex-wrap:wrap; gap:7px; pointer-events:all; }

    .cgb-btn {
      background: linear-gradient(135deg,#e07040,#c2521a);
      color:#fff; border:none; border-radius:10px;
      padding:8px 14px; font-family:'Inter',sans-serif;
      font-size:.78rem; font-weight:700; cursor:pointer;
      pointer-events:all; transition:filter .15s, transform .15s;
    }
    .cgb-btn:hover { filter:brightness(1.1); transform:translateY(-1px); }
    .cgb-btn.ghost {
      background:#f3ede4; color:#c2521a; border:1px solid #f0bfa0;
    }

    /* ══════════════════════════════════════════
       CHAT PANEL — Premium Glassmorphism
    ══════════════════════════════════════════ */
    #cg-chat {
      position: fixed;
      bottom: 120px; right: 28px; left: auto;
      width: 320px; max-height: 520px;
      background: rgba(255,253,249,.92);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(232,217,196,.85);
      border-radius: 24px;
      box-shadow: 0 20px 60px rgba(45,36,22,.18), 0 0 0 1px rgba(194,82,26,.08);
      display: flex; flex-direction: column;
      pointer-events: all; z-index: 99992;
      opacity: 0; transform: translateY(20px) scale(.93);
      transform-origin: bottom right;
      transition: opacity .32s ease, transform .32s cubic-bezier(.34,1.56,.64,1),
                  left .6s cubic-bezier(.4,0,.2,1), right .6s cubic-bezier(.4,0,.2,1);
      visibility: hidden;
    }
    #cg-chat.open { opacity:1; transform:none; visibility:visible; }
    /* When robot is on left — chat snaps to left side */
    #cg-chat.chat-left {
      right: auto;
      left: 28px;
      transform-origin: bottom left;
      border-radius: 24px;
    }

    #cg-chat-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 18px 13px;
      border-bottom: 1px solid rgba(232,217,196,.6);
      background: linear-gradient(135deg, #fdf0e8 0%, rgba(255,253,249,0) 100%);
      border-radius: 24px 24px 0 0;
    }
    #cg-chat-title {
      display:flex; align-items:center; gap:8px;
      font-family:'Inter',sans-serif; font-weight:800;
      font-size:.9rem; color:#2d2416;
    }
    .cg-status-dot {
      width:8px; height:8px; border-radius:50%;
      background:#22c55e;
      box-shadow:0 0 8px rgba(34,197,94,.6);
      animation: ${prefersReduced?'none':'cgDotPulse 2s infinite'};
    }
    @keyframes cgDotPulse { 0%,100%{opacity:1} 50%{opacity:.5} }
    .cg-tagline { font-size:.68rem; font-weight:600; color:#8b6e4e; margin-left:2px; }

    #cg-chat-close {
      background:none; border:none; font-size:1.15rem;
      color:#b89a7a; cursor:pointer; padding:3px 7px; border-radius:6px;
      transition:background .15s, color .15s;
    }
    #cg-chat-close:hover { background:#f3ede4; color:#c2521a; }

    #cg-chat-msgs {
      flex:1; overflow-y:auto; padding:14px 16px;
      display:flex; flex-direction:column; gap:10px;
      scroll-behavior:smooth;
    }
    #cg-chat-msgs::-webkit-scrollbar { width:4px; }
    #cg-chat-msgs::-webkit-scrollbar-thumb { background:#e8d9c4; border-radius:4px; }

    .cg-msg {
      max-width: 82%; padding: 10px 14px;
      font-family:'Inter',sans-serif; font-size:.83rem; line-height:1.55;
      animation: cgMsgIn .28s ease;
    }
    @keyframes cgMsgIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
    .cg-msg.bot {
      background: linear-gradient(135deg,#f3ede4,#fdf0e8);
      color:#2d2416; border-radius:14px 14px 14px 3px; align-self:flex-start;
      border:1px solid rgba(232,217,196,.6);
    }
    .cg-msg.user {
      background: linear-gradient(135deg,#e07040,#c2521a);
      color:#fff; border-radius:14px 14px 3px 14px; align-self:flex-end;
    }

    /* Program card inside chat */
    .cg-prog-card {
      background:#fffdf9; border:1.5px solid #e8d9c4; border-radius:14px;
      padding:12px 14px; margin-top:5px;
      transition:border-color .2s, transform .2s;
    }
    .cg-prog-card:hover { border-color:#c2521a; transform:translateY(-1px); }
    .cg-prog-card-tag {
      display:inline-block; font-size:.7rem; font-weight:800;
      letter-spacing:.05em; text-transform:uppercase;
      padding:3px 9px; border-radius:20px; margin-bottom:6px;
    }
    .cg-prog-card strong { font-size:.88rem; color:#1a1a2e; display:block; margin-bottom:3px; }
    .cg-prog-card span   { font-size:.76rem; color:#8b6e4e; display:block; margin-bottom:6px; }
    .cg-prog-card a {
      display:inline-flex; align-items:center; gap:5px;
      font-size:.78rem; font-weight:700; color:#c2521a; text-decoration:none;
      transition:gap .15s;
    }
    .cg-prog-card a:hover { gap:8px; }

    /* Recommendation result card */
    .cg-rec-card {
      background: linear-gradient(135deg,#fdf0e8,#fffdf9);
      border: 2px solid #c2521a; border-radius:16px;
      padding:16px; margin-top:6px;
    }
    .cg-rec-label {
      font-size:.68rem; font-weight:800; text-transform:uppercase;
      letter-spacing:.08em; color:#c2521a; margin-bottom:8px;
      display:flex; align-items:center; gap:6px;
    }
    .cg-rec-title { font-size:.95rem; font-weight:800; color:#1a1a2e; margin-bottom:8px; }
    .cg-rec-why { list-style:none; padding:0; margin:0 0 12px; display:flex; flex-direction:column; gap:5px; }
    .cg-rec-why li { font-size:.78rem; color:#5c4a32; display:flex; align-items:flex-start; gap:7px; }
    .cg-rec-why li::before { content:"✓"; color:#22c55e; font-weight:800; flex-shrink:0; }
    .cg-rec-btns { display:flex; gap:8px; flex-wrap:wrap; }

    /* Typing indicator */
    #cg-chat-typing {
      padding:6px 16px; display:none; align-items:center; gap:5px;
    }
    #cg-chat-typing.show { display:flex; }
    #cg-chat-typing span {
      width:7px; height:7px; border-radius:50%; background:#c2521a; opacity:.6;
      animation: ${prefersReduced?'none':'cgTyping 1.2s ease-in-out infinite'};
    }
    #cg-chat-typing span:nth-child(2) { animation-delay:.2s; }
    #cg-chat-typing span:nth-child(3) { animation-delay:.4s; }
    @keyframes cgTyping { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }

    /* Suggestion chips */
    #cg-chat-chips {
      padding:6px 14px 4px; display:flex; flex-wrap:wrap; gap:6px;
      border-top:1px solid rgba(232,217,196,.5);
    }
    .cg-chip {
      background:#f3ede4; border:1px solid #e8d9c4; border-radius:20px;
      padding:5px 11px; font-family:'Inter',sans-serif;
      font-size:.74rem; font-weight:600; color:#5c4a32; cursor:pointer;
      transition:background .15s, border-color .15s, color .15s;
    }
    .cg-chip:hover { background:#fdf0e8; border-color:#c2521a; color:#c2521a; }

    /* Input row */
    #cg-chat-input-wrap {
      display:flex; gap:8px; padding:10px 14px;
      border-top:1px solid rgba(232,217,196,.6);
    }
    #cg-chat-input {
      flex:1; border:1.5px solid #e8d9c4; border-radius:12px;
      padding:9px 13px; font-family:'Inter',sans-serif;
      font-size:.84rem; color:#2d2416; background:rgba(255,253,249,.8);
      outline:none; transition:border-color .2s;
    }
    #cg-chat-input:focus { border-color:#c2521a; }
    #cg-chat-send {
      width:38px; height:38px; flex-shrink:0;
      background:linear-gradient(135deg,#e07040,#c2521a);
      border:none; border-radius:12px; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      transition:filter .15s, transform .15s;
    }
    #cg-chat-send:hover { filter:brightness(1.1); transform:scale(1.05); }
    #cg-chat-send svg { width:16px; height:16px; stroke:#fff; }

    /* Inline button row inside chat */
    .cg-btn-row { display:flex; flex-wrap:wrap; gap:7px; margin-top:2px; }
    .cg-inline-btn {
      background:#f3ede4; border:1px solid #e8d9c4; border-radius:10px;
      padding:6px 12px; font-family:'Inter',sans-serif;
      font-size:.78rem; font-weight:600; color:#5c4a32; cursor:pointer;
      transition:background .15s,border-color .15s,color .15s;
    }
    .cg-inline-btn:hover { background:#fdf0e8; border-color:#c2521a; color:#c2521a; }
    .cg-inline-btn.primary {
      background:linear-gradient(135deg,#e07040,#c2521a); color:#fff; border:none;
    }
    .cg-inline-btn.primary:hover { filter:brightness(1.1); }

    /* Confetti canvas */
    #cg-confetti {
      position:fixed; top:0; left:0; width:100%; height:100%;
      pointer-events:none; z-index:99999; display:none;
    }

    /* ── DARK MODE ── */
    [data-theme="dark"] #cg-bubble {
      background: rgba(13,23,40,.94); border-color:rgba(56,189,248,.22);
    }
    [data-theme="dark"] #cg-bubble-text { color:#dbeafe; }
    [data-theme="dark"] #cg-bubble-x { color:#60a5fa; }
    [data-theme="dark"] .cgb-btn.ghost { background:rgba(56,189,248,.1); color:#38bdf8; border-color:rgba(56,189,248,.25); }
    [data-theme="dark"] #cg-chat { background:rgba(7,16,32,.88); border-color:rgba(56,189,248,.15); }
    [data-theme="dark"] #cg-chat-header { background:rgba(3,8,20,.6); }
    [data-theme="dark"] #cg-chat-title { color:#dbeafe; }
    [data-theme="dark"] .cg-tagline { color:#60a5fa; }
    [data-theme="dark"] #cg-chat-close { color:#60a5fa; }
    [data-theme="dark"] .cg-msg.bot { background:rgba(59,130,246,.1); color:#dbeafe; border-color:rgba(59,130,246,.2); }
    [data-theme="dark"] .cg-prog-card { background:rgba(7,20,45,.8); border-color:rgba(56,189,248,.18); }
    [data-theme="dark"] .cg-prog-card strong { color:#dbeafe; }
    [data-theme="dark"] .cg-prog-card span { color:#93c5fd; }
    [data-theme="dark"] .cg-rec-card { background:rgba(7,20,45,.9); border-color:#38bdf8; }
    [data-theme="dark"] .cg-rec-title { color:#dbeafe; }
    [data-theme="dark"] .cg-rec-why li { color:#93c5fd; }
    [data-theme="dark"] #cg-chat-typing span { background:#38bdf8; }
    [data-theme="dark"] .cg-chip { background:rgba(59,130,246,.1); border-color:rgba(56,189,248,.2); color:#93c5fd; }
    [data-theme="dark"] .cg-chip:hover { background:rgba(56,189,248,.15); border-color:#38bdf8; color:#38bdf8; }
    [data-theme="dark"] #cg-chat-input { background:rgba(3,8,20,.6); border-color:rgba(56,189,248,.2); color:#dbeafe; }
    [data-theme="dark"] #cg-chat-input:focus { border-color:#38bdf8; }
    [data-theme="dark"] .cg-inline-btn { background:rgba(59,130,246,.1); border-color:rgba(56,189,248,.2); color:#93c5fd; }
    [data-theme="dark"] .cg-inline-btn:hover { background:rgba(56,189,248,.15); color:#38bdf8; }
    [data-theme="dark"] #cg-robot { filter: none; }
    /* Dark mode robot — blue palette */
    [data-theme="dark"] #cg-head   { fill: #B5D4F4; stroke: #185FA5; }
    [data-theme="dark"] #cg-visor  { fill: #B5D4F4; stroke: #185FA5; }
    [data-theme="dark"] #cg-visor + rect { stroke: #185FA5; }
    [data-theme="dark"] #cg-body   { fill: #B5D4F4; stroke: #185FA5; }
    [data-theme="dark"] #cg-helmet { fill: #378ADD; }
    [data-theme="dark"] #cg-ant-ball    { fill: #378ADD; }
    [data-theme="dark"] #cg-shadow      { fill: #378ADD; }
    [data-theme="dark"] #cg-core-inner  { fill: #378ADD; }
    [data-theme="dark"] #cg-core-mid    { fill: #85B7EB; }
    [data-theme="dark"] #cg-core-outer  { fill: #85B7EB; }
    [data-theme="dark"] #cg-eye-l-iris,
    [data-theme="dark"] #cg-eye-r-iris  { fill: #378ADD; }
    [data-theme="dark"] #cg-eye-l-pupil,
    [data-theme="dark"] #cg-eye-r-pupil { fill: #185FA5; }
    [data-theme="dark"] #cg-blink-l,
    [data-theme="dark"] #cg-blink-r     { fill: #B5D4F4; }
    [data-theme="dark"] #cg-mouth       { stroke: #378ADD; }

    @media (max-width:600px) {
      #core-guide { bottom:90px; right:14px; }
      #cg-robot   { width:110px; height:125px; }
      #cg-chat    { width:calc(100vw - 24px); left:12px !important; right:12px !important; bottom:90px; max-height:70vh; }
      #cg-bubble  { width:200px; font-size:.8rem; }
    }
  `;
  document.head.appendChild(css);

  /* ═══════════════════════════════════════════════════════════
   *  5. ELEMENT REFS
   * ═══════════════════════════════════════════════════════════ */
  const robotEl   = document.getElementById('cg-robot');
  const bubbleEl  = document.getElementById('cg-bubble');
  const bubTxtEl  = document.getElementById('cg-bubble-text');
  const bubBtnsEl = document.getElementById('cg-bubble-btns');
  const bubXEl    = document.getElementById('cg-bubble-x');
  const chatEl    = document.getElementById('cg-chat');
  const chatMsgsEl= document.getElementById('cg-chat-msgs');
  const typingEl  = document.getElementById('cg-chat-typing');
  const chipsEl   = document.getElementById('cg-chat-chips');
  const inputEl   = document.getElementById('cg-chat-input');
  const sendEl    = document.getElementById('cg-chat-send');
  const closeEl   = document.getElementById('cg-chat-close');
  const confCanvas= document.getElementById('cg-confetti');
  const eyesEl    = document.getElementById('cg-eyes');
  const eyeLEl    = document.getElementById('cg-eye-l-iris');
  const eyeREl    = document.getElementById('cg-eye-r-iris');

  /* ═══════════════════════════════════════════════════════════
   *  6. ANIMATION HELPERS
   * ═══════════════════════════════════════════════════════════ */
  let _animTimer = null;
  function _anim(name, ms) {
    root.setAttribute('data-anim', name);
    clearTimeout(_animTimer);
    if (ms) _animTimer = setTimeout(() => root.setAttribute('data-anim','idle'), ms);
  }

  /* ─── Bubble speak ─── */
  let _bubbleHideTimer = null;
  function _showBubble(text, opts={}) {
    clearTimeout(_bubbleHideTimer);
    bubTxtEl.textContent = text;
    bubBtnsEl.innerHTML  = '';
    if (opts.btn) bubBtnsEl.appendChild(_makeBubBtn(opts.btn.label, opts.btn.action));
    if (opts.btns) opts.btns.forEach((b,i) => {
      const el = _makeBubBtn(b.label, b.action);
      if (i>0) el.classList.add('ghost');
      bubBtnsEl.appendChild(el);
    });
    bubbleEl.classList.add('show');
    if (!opts.btn && !opts.btns)
      _bubbleHideTimer = setTimeout(_hideBubble, opts.duration||7000);
  }
  function _hideBubble() { bubbleEl.classList.remove('show'); }

  function _makeBubBtn(label, action) {
    const b = document.createElement('button');
    b.className = 'cgb-btn'; b.textContent = label;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', () => {
      _hideBubble();
      if (action==='chat')     { _openChat(); }
      if (action==='quiz')     { _openChat(); setTimeout(()=>brain._startFullQuiz(),400); }
      if (action==='register') { window.location.href='register.html'; }
    });
    return b;
  }

  /* ─── Auto-speak (respects all gates) ─── */
  let _speakRelTimer = null;
  function autoSpeak(text, opts={}) {
    const key = opts.key || text.slice(0,40);
    if (!canAutoSpeak()) return false;
    if (wasSaid(key))    return false;
    markSaid(key);
    S.lastAutoAt = Date.now();
    S.isSpeaking = true; S.phase = SM.SPEAKING;
    _showBubble(text, opts);
    _anim('speak', 1400);
    const hold = opts.duration||7000;
    clearTimeout(_speakRelTimer);
    _speakRelTimer = setTimeout(()=>{
      S.isSpeaking=false; S.phase=SM.WAITING;
      setTimeout(()=>{ if(S.phase===SM.WAITING) S.phase=SM.IDLE; }, CD.POST);
    }, hold+300);
    return true;
  }

  /* ═══════════════════════════════════════════════════════════
   *  7. MOUSE-TRACKING EYES
   * ═══════════════════════════════════════════════════════════ */
  if (!prefersReduced) {
    let _eyeRafPending = false;
    function _updateEyes() {
      const rect = robotEl.getBoundingClientRect();
      if (!rect.width) return;
      const cx   = rect.left + rect.width/2;
      const cy   = rect.top  + rect.height/2;
      const dx   = S.mouseX - cx;
      const dy   = S.mouseY - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const max  = 4; // max px shift inside eye
      const nx   = dist > 1 ? (dx/dist)*Math.min(max, dist*0.06) : 0;
      const ny   = dist > 1 ? (dy/dist)*Math.min(max, dist*0.06) : 0;
      // shift both irises
      eyeLEl.setAttribute('cx', (43+nx).toFixed(2));
      eyeLEl.setAttribute('cy', (53+ny).toFixed(2));
      eyeREl.setAttribute('cx', (77+nx).toFixed(2));
      eyeREl.setAttribute('cy', (53+ny).toFixed(2));
      _eyeRafPending = false;
    }
    document.addEventListener('mousemove', e => {
      S.mouseX = e.clientX; S.mouseY = e.clientY;
      if (!_eyeRafPending) { _eyeRafPending=true; requestAnimationFrame(_updateEyes); }
    }, { passive:true });
  }

  /* ═══════════════════════════════════════════════════════════
   *  8. CHAT ENGINE
   * ═══════════════════════════════════════════════════════════ */
  function _openChat() {
    S.isChatOpen=true; S.phase=SM.USER_INTERACTING;

    // Position chat panel on the correct side based on where robot currently is
    const isLeft = S.currentZone && S.currentZone.includes('left');
    const chatEl2 = document.getElementById('cg-chat');
    if (chatEl2) {
      if (isLeft) {
        chatEl2.style.left  = '12px';
        chatEl2.style.right = 'auto';
      } else {
        chatEl2.style.right = '28px';
        chatEl2.style.left  = 'auto';
      }
    }

    chatEl.classList.add('open'); _hideBubble();
    _anim('wave',1800); inputEl.focus(); _initChips();
    if (!chatMsgsEl.children.length)
      setTimeout(()=>_botMsg("Hey! 👋 I'm CORE — your AI career guide. What are you looking to do with AI?"),300);
  }
  function _closeChat() {
    S.isChatOpen=false; chatEl.classList.remove('open');
    if (S.phase===SM.USER_INTERACTING) S.phase=SM.IDLE;
  }

  function _showTyping() { typingEl.classList.add('show'); chatMsgsEl.scrollTop=9999; }
  function _hideTyping() { typingEl.classList.remove('show'); }

  function _botMsg(html, isHtml) {
    _hideTyping();
    const d=document.createElement('div');
    d.className='cg-msg bot';
    if (isHtml) d.innerHTML=html; else d.textContent=html;
    chatMsgsEl.appendChild(d);
    chatMsgsEl.scrollTop=chatMsgsEl.scrollHeight;
  }
  function _userMsg(text) {
    const d=document.createElement('div');
    d.className='cg-msg user'; d.textContent=text;
    chatMsgsEl.appendChild(d);
    chatMsgsEl.scrollTop=chatMsgsEl.scrollHeight;
  }
  function _progCard(p) {
    _hideTyping();
    const d=document.createElement('div'); d.className='cg-msg bot';
    d.innerHTML=`<div class="cg-prog-card">
      <span class="cg-prog-card-tag" style="background:${p.color}22;color:${p.color}">${p.tag}</span>
      <strong>${p.title}</strong>
      <span>${p.duration} · ${p.level}</span>
      <span>${p.dates} · ${p.price}</span>
      <a href="${p.url}">View full program →</a>
    </div>`;
    chatMsgsEl.appendChild(d); chatMsgsEl.scrollTop=chatMsgsEl.scrollHeight;
  }

  /* Recommendation result card with reasons */
  function _recCard(p) {
    _hideTyping();
    const d=document.createElement('div'); d.className='cg-msg bot';
    const reasons = p.reasons||[];
    d.innerHTML=`<div class="cg-rec-card">
      <div class="cg-rec-label">🎯 Recommended Program</div>
      <div class="cg-rec-title">${p.title}</div>
      <ul class="cg-rec-why">${reasons.slice(0,3).map(r=>`<li>${r}</li>`).join('')}</ul>
      <div class="cg-rec-btns">
        <a href="${p.url}" class="cg-inline-btn primary">View Program</a>
        <a href="register.html" class="cg-inline-btn">Register Now →</a>
      </div>
    </div>`;
    chatMsgsEl.appendChild(d); chatMsgsEl.scrollTop=chatMsgsEl.scrollHeight;
  }

  function _inlineButtons(btns) {
    const row=document.createElement('div'); row.className='cg-btn-row';
    btns.forEach(def=>{
      const b=document.createElement('button');
      b.className='cg-inline-btn'; b.textContent=def.label;
      if (def.primary) b.classList.add('primary');
      b.addEventListener('click',()=>{ _userMsg(def.label); row.remove(); def.cb(); });
      row.appendChild(b);
    });
    chatMsgsEl.appendChild(row); chatMsgsEl.scrollTop=chatMsgsEl.scrollHeight;
  }

  function _initChips() {
    const chips=[
      "Find my program","I'm a CS student","I want to build AI agents",
      "I'm a complete beginner","I want to learn ML","What programs do you offer?",
    ];
    chipsEl.innerHTML='';
    chips.forEach(c=>{
      const b=document.createElement('button'); b.className='cg-chip'; b.textContent=c;
      b.addEventListener('click',()=>{ brain.handle(c); chipsEl.innerHTML=''; });
      chipsEl.appendChild(b);
    });
  }

  /* ═══════════════════════════════════════════════════════════
   *  9. CAREER QUIZ  (4 questions → scored recommendation)
   *  Plugs into the existing brain.score() engine
   * ═══════════════════════════════════════════════════════════ */
  const QUIZ = {
    q1: {
      prompt: "What do you want to become?",
      options:[
        {label:'🤖 AI Engineer',       key:'engineer'},
        {label:'💼 AI Freelancer',      key:'freelancer'},
        {label:'🎨 Content Creator',    key:'creator'},
        {label:'🚀 Startup Builder',    key:'builder'},
      ],
    },
    q2: {
      prompt: "Can you code?",
      options:[
        {label:'✅ Yes', key:'yes'},
        {label:'🔸 A little', key:'little'},
        {label:'❌ No', key:'no'},
      ],
    },
    q3: {
      prompt: "Current level?",
      options:[
        {label:'🌱 Beginner',       key:'beginner'},
        {label:'⚡ Intermediate',   key:'intermediate'},
        {label:'🔥 Advanced',       key:'advanced'},
      ],
    },
    q4: {
      prompt: "What interests you most?",
      options:[
        {label:'🤖 AI Agents',         key:'agents'},
        {label:'📊 Machine Learning',  key:'ml'},
        {label:'🎨 Content Creation',  key:'content'},
        {label:'⚙️ Automation',        key:'automation'},
        {label:'📈 Data Science',      key:'data'},
      ],
    },
  };

  // Map quiz answers → signals for brain.score()
  function _quizAnswersToSig(a) {
    return {
      isBeginner:    a.q3==='beginner',
      wantsTechnical:a.q2==='yes'||(a.q3==='advanced'),
      wantsNoCode:   a.q2==='no',
      wantsPractical:a.q1==='builder'||a.q1==='freelancer',
      wantsBroad:    false,
      wantsContent:  a.q1==='creator'||a.q4==='content',
      wantsMedia:    a.q1==='creator',
      wantsMarketing:a.q1==='freelancer',
      wantsML:       a.q4==='ml',
      wantsDeepML:   a.q4==='ml'&&a.q2==='yes',
      wantsData:     a.q4==='data',
      wantsStats:    a.q4==='data',
      wantsPython:   a.q2==='yes',
      wantsMLModels: a.q4==='ml',
      wantsRegClass: false,
      wantsAgents:   a.q4==='agents'||a.q1==='engineer'&&a.q4!=='ml',
      wantsLLMs:     a.q4==='agents',
      wantsRAG:      a.q4==='agents',
      wantsAPIs:     a.q2==='yes'&&(a.q4==='agents'||a.q4==='automation'),
      wantsAutomate: a.q4==='automation',
      wantsToolCall: a.q4==='automation'||a.q4==='agents',
      wantsAIProduct:a.q1==='builder'||a.q1==='engineer',
    };
  }

  /* ═══════════════════════════════════════════════════════════
   *  10. CONVERSATION BRAIN  (signals, score, topProgs preserved)
   * ═══════════════════════════════════════════════════════════ */
  const brain = {
    profile: { experience:null, techPref:null },
    quizAnswers: {},

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

    score(sig) {
      const sc={creator:0,builder:0,technical:0,advanced:0};
      if(sig.wantsContent)   sc.creator   +=40;
      if(sig.wantsMedia)     sc.creator   +=30;
      if(sig.isBeginner)     sc.creator   +=20;
      if(sig.wantsMarketing) sc.creator   +=10;
      if(sig.isBeginner)     sc.builder   +=40;
      if(sig.wantsBroad)     sc.builder   +=30;
      if(sig.wantsPractical) sc.builder   +=25;
      if(sig.wantsAutomate)  sc.builder   +=20;
      if(sig.wantsNoCode)    sc.builder   +=20;
      if(sig.wantsDeepML)    sc.builder   -=20;
      if(sig.wantsAgents)    sc.builder   -=20;
      if(sig.wantsML)        sc.technical +=40;
      if(sig.wantsData)      sc.technical +=35;
      if(sig.wantsStats)     sc.technical +=30;
      if(sig.wantsPython)    sc.technical +=25;
      if(sig.wantsMLModels)  sc.technical +=25;
      if(sig.wantsTechnical) sc.technical +=20;
      if(sig.wantsAgents)    sc.advanced  +=40;
      if(sig.wantsLLMs)      sc.advanced  +=35;
      if(sig.wantsRAG)       sc.advanced  +=30;
      if(sig.wantsAPIs)      sc.advanced  +=30;
      if(sig.wantsAutomate)  sc.advanced  +=25;
      if(sig.wantsToolCall)  sc.advanced  +=25;
      if(sig.wantsAIProduct) sc.advanced  +=20;
      if(sig.isBeginner&&!sig.wantsTechnical) sc.advanced-=20;
      return sc;
    },

    topProgs(scores, threshold) {
      return Object.entries(scores)
        .filter(([,v])=>v>=threshold).sort(([,a],[,b])=>b-a)
        .map(([k])=>PROGRAMS[k]);
    },

    handle(msg) {
      _userMsg(msg); chipsEl.innerHTML='';
      const lower=msg.toLowerCase();
      const sig=this.signals(lower);
      if(sig.isBeginner)     this.profile.experience='beginner';
      if(sig.wantsTechnical) this.profile.experience='technical';
      if(sig.wantsNoCode)    this.profile.techPref='nocode';
      if(sig.wantsTechnical) this.profile.techPref='technical';
      const m=Object.assign({},sig,{
        isBeginner:     sig.isBeginner    ||this.profile.experience==='beginner',
        wantsTechnical: sig.wantsTechnical||this.profile.techPref==='technical',
        wantsNoCode:    sig.wantsNoCode   ||this.profile.techPref==='nocode',
      });
      _showTyping();
      setTimeout(()=>this._respond(lower,m,sig), 680);
    },

    _respond(lower,m,sig) {
      /* list all */
      if(/offer|programs|bootcamp|available|list|all.*program/i.test(lower)){
        _botMsg("CoreLab has 4 bootcamps this Autumn:");
        setTimeout(()=>Object.values(PROGRAMS).forEach(_progCard),300); return;
      }
      /* register */
      if(/register|enroll|sign up|join|apply/i.test(lower)){
        _botMsg("Head to Register and pick your program. Want me to help you choose first?");
        setTimeout(()=>_inlineButtons([
          {label:'Help me choose',cb:()=>this._startFullQuiz()},
          {label:'Go to Register →',primary:true,cb:()=>{window.location.href='register.html';}},
        ]),400); return;
      }
      /* find path */
      if(/find.*path|find.*program|help.*choose|which.*program|don.t know|not sure|unsure|confused|^help$/i.test(lower)){
        _botMsg("Let me find your path. 🤖 I'll ask 4 quick questions.");
        setTimeout(()=>this._startCareerQuiz(),500); return;
      }
      /* beginner no goal */
      if(m.isBeginner&&!sig.wantsML&&!sig.wantsAgents&&!sig.wantsLLMs&&!sig.wantsContent){
        _botMsg("Since you're just starting out, AI From Zero to AI Builder is the broadest starting point. You'll explore multiple AI tools across 7 days before specialising.");
        setTimeout(()=>_inlineButtons([
          {label:"Show me",cb:()=>{_progCard(PROGRAMS.builder);}},
          {label:'I have a more specific goal',cb:()=>this._startCareerQuiz()},
        ]),400); return;
      }
      /* beginner + agents */
      if(m.isBeginner&&(sig.wantsAgents||sig.wantsLLMs)){
        _botMsg("Interested in AI agents but just starting? I'd show you both options — one for a foundation, one specifically for agents.");
        setTimeout(()=>_inlineButtons([
          {label:'Show both',cb:()=>{_progCard(PROGRAMS.builder);_progCard(PROGRAMS.advanced);}},
          {label:'Explain the difference',cb:()=>{_botMsg("AI From Zero to Builder: broad practical intro, no deep technical knowledge needed.\n\nGenerative AI & Agents: focused on LLMs, RAG, APIs, tool calling and autonomous agents — more technical.");}},
        ]),400); return;
      }
      /* content */
      if(sig.wantsContent||sig.wantsMedia){
        _botMsg("You're in the creator zone 🎨 AI Content Creator Weekend looks closely aligned.");
        setTimeout(()=>_recCard(PROGRAMS.creator),300); return;
      }
      /* ML + agents split */
      if((sig.wantsML||sig.wantsData)&&(sig.wantsAgents||sig.wantsLLMs)){
        _botMsg("You're between two directions 👀");
        setTimeout(()=>_inlineButtons([
          {label:'📊 Data & ML',cb:()=>{_recCard(PROGRAMS.technical);}},
          {label:'🤖 LLMs & Agents',cb:()=>{_recCard(PROGRAMS.advanced);}},
          {label:'Show both',cb:()=>{_progCard(PROGRAMS.technical);_progCard(PROGRAMS.advanced);}},
        ]),400); return;
      }
      /* ML/data */
      if(sig.wantsML||sig.wantsData||sig.wantsStats||sig.wantsMLModels){
        _botMsg("Data Science & Machine Learning looks like your direction.");
        setTimeout(()=>_recCard(PROGRAMS.technical),300); return;
      }
      /* agents/LLMs */
      if(sig.wantsAgents||sig.wantsLLMs||sig.wantsRAG||sig.wantsAPIs){
        _botMsg("Generative AI, LLMs & AI Agents is specifically focused on that direction.");
        setTimeout(()=>_recCard(PROGRAMS.advanced),300); return;
      }
      /* automation */
      if(sig.wantsAutomate){
        _botMsg("Automation goes two ways — beginner-friendly or LLM-powered. Which fits?");
        setTimeout(()=>_inlineButtons([
          {label:'Beginner-friendly',cb:()=>{_recCard(PROGRAMS.builder);}},
          {label:'LLM-powered',cb:()=>{_recCard(PROGRAMS.advanced);}},
        ]),400); return;
      }
      /* engineer/career */
      if(/engineer|career|profession/i.test(lower)){
        _botMsg("AI engineering can mean a few things. Which direction calls to you?");
        setTimeout(()=>_inlineButtons([
          {label:'🧠 LLMs & Agents',cb:()=>{_recCard(PROGRAMS.advanced);}},
          {label:'📊 ML & Data',cb:()=>{_recCard(PROGRAMS.technical);}},
          {label:'💻 Practical AI',cb:()=>{_recCard(PROGRAMS.builder);}},
        ]),400); return;
      }
      /* CS student */
      if(/cs\b|computer science|university|student/i.test(lower)){
        _botMsg("CS background 👀 Which direction are you most drawn to?");
        setTimeout(()=>_inlineButtons([
          {label:'📊 Data & ML',cb:()=>{_recCard(PROGRAMS.technical);}},
          {label:'🧠 LLMs & Agents',cb:()=>{_recCard(PROGRAMS.advanced);}},
          {label:'💻 AI Apps',cb:()=>{_recCard(PROGRAMS.builder);}},
          {label:'🎨 Creative AI',cb:()=>{_recCard(PROGRAMS.creator);}},
        ]),400); return;
      }
      /* score fallback */
      const scores=this.score(m);
      const top=this.topProgs(scores,40);
      if(top.length>0){
        _botMsg(top.length===1?"Here's the closest match:":"These look closely aligned:");
        setTimeout(()=>top.forEach(_recCard),300); return;
      }
      /* unclear → career quiz */
      _botMsg("Let me ask you a few quick questions to find your best fit.");
      setTimeout(()=>this._startCareerQuiz(),500);
    },

    /* ── Career Quiz (4 questions) ── */
    _careerAnswers: {},
    _startCareerQuiz() {
      this._careerAnswers={};
      _botMsg(`${QUIZ.q1.prompt}`);
      setTimeout(()=>_inlineButtons(QUIZ.q1.options.map(o=>({
        label:o.label, cb:()=>{ this._careerAnswers.q1=o.key; this._careerQ2(); }
      }))),400);
    },
    _careerQ2() {
      _botMsg(QUIZ.q2.prompt);
      setTimeout(()=>_inlineButtons(QUIZ.q2.options.map(o=>({
        label:o.label, cb:()=>{ this._careerAnswers.q2=o.key; this._careerQ3(); }
      }))),400);
    },
    _careerQ3() {
      _botMsg(QUIZ.q3.prompt);
      setTimeout(()=>_inlineButtons(QUIZ.q3.options.map(o=>({
        label:o.label, cb:()=>{ this._careerAnswers.q3=o.key; this._careerQ4(); }
      }))),400);
    },
    _careerQ4() {
      _botMsg(QUIZ.q4.prompt);
      setTimeout(()=>_inlineButtons(QUIZ.q4.options.map(o=>({
        label:o.label, cb:()=>{ this._careerAnswers.q4=o.key; this._careerResult(); }
      }))),400);
    },
    _careerResult() {
      const sig  = _quizAnswersToSig(this._careerAnswers);
      const sc   = this.score(sig);
      const recs = this.topProgs(sc,30);
      const final= recs.length>0 ? recs : [PROGRAMS.builder];
      _showTyping();
      setTimeout(()=>{
        _botMsg("Based on your answers, here's my recommendation:");
        setTimeout(()=>final.slice(0,2).forEach(_recCard),400);
      },800);
    },

    /* ── Legacy 3-question quiz (kept for chat handle flow) ── */
    quizAnswers:{},
    _startFullQuiz() { this._startCareerQuiz(); },
  }; /* end brain */

  /* ═══════════════════════════════════════════════════════════
   *  11. CONTEXT-AWARE SECTION TRIGGERS
   * ═══════════════════════════════════════════════════════════ */
  const SECTION_TRIGGERS = {
    hero:       { text:"Need help choosing your AI path?", key:'ctx_hero', btn:{label:"Find My Path",action:'quiz'} },
    upcoming:   { text:"Not sure which program fits you?", key:'ctx_upcoming', btn:{label:"Help me choose",action:'quiz'} },
    courses:    { text:"Not sure which program fits you?", key:'ctx_courses', btn:{label:"Help me choose",action:'quiz'} },
    schedule:   { text:"Not sure which program fits you?", key:'ctx_schedule', btn:{label:"Help me choose",action:'quiz'} },
    projects:   { text:"Want to build projects like these?", key:'ctx_projects', btn:{label:"See programs",action:'chat'} },
    faq:        { text:"Most students ask about prerequisites first.", key:'ctx_faq', btn:{label:"Ask me",action:'chat'} },
    register:   { text:"Ready to take the next step? 🚀", key:'ctx_register', btns:[{label:"Help me choose",action:'quiz'},{label:"Register now",action:'register'}] },
  };

  const _seenSections = new Set();
  let   _secDebounce  = null;

  function _onSection(id) {
    if (_seenSections.has(id)) return;
    if (S.phase===SM.USER_INTERACTING||S.phase===SM.QUIET) return;
    const def = SECTION_TRIGGERS[id];
    if (!def) return;
    _seenSections.add(id);
    setTimeout(()=>autoSpeak(def.text,{key:def.key,btn:def.btn,btns:def.btns,duration:8000}),1000);
  }

  const sectionSels = ['.hero','#upcoming','#courses','.schedule-section','#curriculum','#register','.faq-section','.projects-grid','.mentors-section','.pathways-section'];
  const obsEls = [];
  sectionSels.forEach(sel=>{
    document.querySelectorAll(sel).forEach(el=>{
      if (!el._cgId) { el._cgId=el.id||sel.replace(/[#.]/g,'').split(' ')[0]; obsEls.push(el); }
    });
  });
  const secIO = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if (!e.isIntersecting||e.intersectionRatio<0.3) return;
      clearTimeout(_secDebounce);
      _secDebounce=setTimeout(()=>_onSection(e.target._cgId),700);
    });
  },{threshold:0.3});
  obsEls.forEach(el=>secIO.observe(el));

  /* ═══════════════════════════════════════════════════════════
   *  12. PROGRAM CARD HOVER — robot reacts + moves
   * ═══════════════════════════════════════════════════════════ */
  const CARD_HOVER_MSGS = {
    creator:   {text:"Build real AI content — images, videos & voiceovers.",   key:'hover_creator'},
    builder:   {text:"Perfect if you're new to AI. Broad, practical & hands-on.", key:'hover_builder'},
    technical: {text:"Perfect if you enjoy Python, data and building ML models.", key:'hover_tech'},
    advanced:  {text:"Build real AI agents, RAG systems and automations.",         key:'hover_adv'},
  };
  document.querySelectorAll('[data-category]').forEach(card=>{
    card.addEventListener('mouseenter',()=>{
      if(Date.now()-S.lastHoverAt<CD.HOVER) return;
      if(S.isChatOpen||S.isSpeaking) return;
      const cat=card.getAttribute('data-category');
      const def=CARD_HOVER_MSGS[cat]; if (!def||wasSaid(def.key)) return;
      S.lastHoverAt=Date.now();
      _anim('point',1800);
      setTimeout(()=>autoSpeak(def.text,{key:def.key,duration:5000}),400);
    });
  });

  /* ═══════════════════════════════════════════════════════════
   *  13. REGISTER BUTTON — excited reaction
   * ═══════════════════════════════════════════════════════════ */
  document.querySelectorAll('[href*="register"], .btn-header').forEach(btn=>{
    btn.addEventListener('mouseenter',()=>{
      if(S.phase===SM.CELEBRATING) return;
      _anim('happy', 1500);
      // brighten reactor briefly
      const core = document.getElementById('cg-core-mid');
      if (core) { core.style.opacity='1'; setTimeout(()=>core.style.opacity='',1500); }
    });
    btn.addEventListener('click',()=>{
      if(!wasSaid('reg_celebrate')) {
        markSaid('reg_celebrate');
        S.phase=SM.CELEBRATING;
        _hideBubble();
        _showBubble("Awesome choice 🚀 Welcome to CoreLab!",{duration:4000});
        _anim('happy',2000);
        _launchConfetti();
        setTimeout(()=>{ S.phase=SM.QUIET; }, 4500);
      }
    });
  });

  /* ═══════════════════════════════════════════════════════════
   *  14. CONFETTI
   * ═══════════════════════════════════════════════════════════ */
  function _launchConfetti() {
    if (prefersReduced) return;
    confCanvas.style.display='block';
    const ctx=confCanvas.getContext('2d');
    confCanvas.width=window.innerWidth; confCanvas.height=window.innerHeight;
    const pieces=[];
    const colors=['#c2521a','#e07040','#1d4ed8','#2d7a4f','#818cf8','#fbbf24'];
    for(let i=0;i<90;i++) pieces.push({
      x:Math.random()*confCanvas.width, y:-10,
      vx:(Math.random()-.5)*4, vy:Math.random()*3+2,
      r:Math.random()*6+3, color:colors[Math.floor(Math.random()*colors.length)],
      rot:Math.random()*360, vrot:(Math.random()-.5)*8, alpha:1,
    });
    let frame=0;
    function tick(){
      ctx.clearRect(0,0,confCanvas.width,confCanvas.height);
      pieces.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy; p.rot+=p.vrot; p.alpha-=0.008;
        ctx.save(); ctx.globalAlpha=Math.max(0,p.alpha);
        ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
        ctx.fillStyle=p.color; ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.6);
        ctx.restore();
      });
      frame++;
      if(frame<180) requestAnimationFrame(tick);
      else { ctx.clearRect(0,0,confCanvas.width,confCanvas.height); confCanvas.style.display='none'; }
    }
    tick();
  }

  /* ═══════════════════════════════════════════════════════════
   *  15. ROAMING ZONES + SCROLL-BASED MOVEMENT
   * ═══════════════════════════════════════════════════════════ */
  let _robotX=0, _robotY=0;

  function _zone(name) {
    const vw=window.innerWidth, vh=window.innerHeight;
    const mob=vw<600, sz=mob?115:150, pad=mob?12:24, bot=100;
    return ({
      'bottom-right':{x:vw-sz-pad,y:vh-sz-bot},
      'bottom-left': {x:pad,      y:vh-sz-bot},
      'mid-right':   {x:vw-sz-pad,y:vh*.38},
      'mid-left':    {x:pad,      y:vh*.38},
      'bottom-center':{x:(vw-sz)/2,y:vh-sz-bot},
    })[name]||{x:vw-sz-pad,y:vh-sz-bot};
  }

  function _setPos(x,y) {
    _robotX=x; _robotY=y;
    root.style.right='auto';
    root.style.left  = x+'px';
    root.style.bottom= Math.max(window.innerHeight-y-170,bot_clearance())+'px';
  }
  function bot_clearance(){ return 100; }

  function _walkToZone(zoneName, onDone) {
    if (S.isWalking && !onDone) return;
    const target=_zone(zoneName);
    S.currentZone=zoneName; S.lastMoveAt=Date.now();

    // If zone is on the left half, flip bubble to the right side so it stays visible
    const isLeftZone = zoneName.includes('left');
    root.classList.toggle('bubble-right', isLeftZone);

    // Move chat panel to same side as robot so it never goes off-screen
    const chatEl2 = document.getElementById('cg-chat');
    if (chatEl2) {
      if (isLeftZone) {
        chatEl2.style.left  = '12px';
        chatEl2.style.right = 'auto';
      } else {
        chatEl2.style.right = '28px';
        chatEl2.style.left  = 'auto';
      }
    }

    if (prefersReduced) { _setPos(target.x,target.y); S.isWalking=false; onDone&&onDone(); return; }
    const dx=target.x-_robotX;
    root.classList.toggle('facing-right', dx>0);
    _anim('walk');
    S.isWalking=true;
    const speed=1.8;
    const tick=()=>{
      if(!S.isWalking) return;
      const rx=target.x-_robotX, ry=target.y-_robotY;
      const d=Math.sqrt(rx*rx+ry*ry);
      if(d<speed+1){ _setPos(target.x,target.y); S.isWalking=false; root.classList.remove('facing-right'); _anim('idle'); onDone&&onDone(); return; }
      _setPos(_robotX+rx/d*speed, _robotY+ry/d*speed);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* Scroll → zone map */
  const SCROLL_MAP=[
    {from:0,  to:15, zone:'bottom-right'},
    {from:15, to:30, zone:'mid-left'},
    {from:30, to:45, zone:'bottom-right'},
    {from:45, to:60, zone:'mid-right'},
    {from:60, to:75, zone:'bottom-left'},
    {from:75, to:90, zone:'mid-right'},
    {from:90, to:100,zone:'bottom-left'},
  ];
  function _zoneForPct(p){ for(const b of SCROLL_MAP) if(p>=b.from&&p<b.to) return b.zone; return 'bottom-right'; }

  let _scrollDeb=null;
  window.addEventListener('scroll',()=>{
    clearTimeout(_scrollDeb);
    _scrollDeb=setTimeout(()=>{
      if(S.isChatOpen||S.isTyping||S.phase===SM.USER_INTERACTING||S.isWalking) return;
      if(Date.now()-S.lastMoveAt<CD.MOVE) return;
      const docH=Math.max(document.body.scrollHeight-window.innerHeight,1);
      const pct=Math.round(window.scrollY/docH*100);
      if(Math.abs(pct-S.lastScrollPct)<8) return;
      S.lastScrollPct=pct;
      const z=_zoneForPct(pct);
      if(z!==S.currentZone) _walkToZone(z);
    },650);
  },{passive:true});

  /* Idle roam */
  const NEARBY={ 'bottom-right':['mid-right','bottom-center'], 'bottom-left':['mid-left','bottom-center'], 'bottom-center':['bottom-right','bottom-left'], 'mid-right':['bottom-right','bottom-center'], 'mid-left':['bottom-left','bottom-center'] };
  let _idleRoamT=null;
  function _schedIdleRoam(){ clearTimeout(_idleRoamT); _idleRoamT=setTimeout(()=>{ if(!S.isWalking&&!S.isChatOpen&&!S.isSpeaking&&S.phase!==SM.USER_INTERACTING&&S.phase!==SM.CELEBRATING&&Date.now()-S.lastMoveAt>18000){ const opts=NEARBY[S.currentZone]||['bottom-left','bottom-right']; _walkToZone(opts[Math.floor(Math.random()*opts.length)]); } _schedIdleRoam(); },24000+Math.random()*12000); }
  _schedIdleRoam();

  /* Idle visual only */
  const IDLE_ANIMS=['wave','lookleft','lookright'];
  let _idleVisT=null;
  function _schedIdleVis(){ clearTimeout(_idleVisT); _idleVisT=setTimeout(()=>{ if(!S.isSpeaking&&!S.isWalking&&!S.isChatOpen&&S.phase!==SM.USER_INTERACTING){ _anim(IDLE_ANIMS[Math.floor(Math.random()*IDLE_ANIMS.length)],2200); } _schedIdleVis(); },20000+Math.random()*15000); }
  _schedIdleVis();

  /* ═══════════════════════════════════════════════════════════
   *  16. CLICK / SEND WIRING
   * ═══════════════════════════════════════════════════════════ */
  robotEl.addEventListener('click',()=>{
    S.lastInteraction=Date.now();
    if(S.isChatOpen) _closeChat(); else _openChat();
  });
  bubXEl.addEventListener('click',()=>{ _hideBubble(); S.isSpeaking=false; S.phase=SM.IDLE; });
  closeEl.addEventListener('click',_closeChat);

  function _sendMsg(){
    const txt=inputEl.value.trim(); if(!txt) return;
    inputEl.value=''; chipsEl.innerHTML='';
    S.phase=SM.USER_INTERACTING; brain.handle(txt);
  }
  sendEl.addEventListener('click',_sendMsg);
  inputEl.addEventListener('keydown',e=>{ if(e.key==='Enter') _sendMsg(); });
  inputEl.addEventListener('focus', ()=>{ S.isTyping=true;  S.phase=SM.USER_INTERACTING; });
  inputEl.addEventListener('blur',  ()=>{ S.isTyping=false; if(!S.isChatOpen) S.phase=SM.IDLE; });

  ['mousemove','keydown','touchstart'].forEach(ev=>
    document.addEventListener(ev,()=>{ S.lastInteraction=Date.now(); },{passive:true})
  );

  /* ═══════════════════════════════════════════════════════════
   *  17. INITIAL ENTRY  (premium entrance timeline)
   * ═══════════════════════════════════════════════════════════ */
  (() => {
    const returning = _load();

    if (returning && S.hasGreeted) {
      /* Returning visitor — restore quietly */
      const p = _zone(S.currentZone||'bottom-right');
      root.style.left   = p.x+'px';
      root.style.bottom = Math.max(window.innerHeight-p.y-170,100)+'px';
      _robotX=p.x; _robotY=p.y;
      root.classList.add('cg-visible');
      setTimeout(()=>{
        const docH=Math.max(document.body.scrollHeight-window.innerHeight,1);
        const pct=Math.round(window.scrollY/docH*100);
        const z=_zoneForPct(pct);
        if(z!==S.currentZone) _walkToZone(z);
      },1500);
    } else {
      /* First visit — premium entrance sequence */
      const p = _zone('bottom-right');
      root.style.right='28px'; root.style.left='auto';
      root.style.bottom = '-200px';
      _robotX=p.x; _robotY=p.y;

      // 0.8s: fly in from bottom
      setTimeout(()=>{
        root.classList.add('cg-visible');
        root.style.bottom = Math.max(window.innerHeight-p.y-170,100)+'px';
      }, 800);

      // 1.8s: wave
      setTimeout(()=>_anim('wave',1600), 1800);

      // 2.5s: welcome bubble
      setTimeout(()=>{
        if (!S.hasGreeted) {
          S.hasGreeted=true;
          _showBubble("👋 New to AI?\nI can recommend the perfect CoreLab program in 30 seconds.",{
            btn:{label:"Find My Path",action:'quiz'}, duration:12000,
          });
          markSaid('greeting');
          S.lastAutoAt=Date.now();
        }
      }, 2500);
    }
  })();

  /* ═══════════════════════════════════════════════════════════
   *  18. RESIZE
   * ═══════════════════════════════════════════════════════════ */
  window.addEventListener('resize',()=>{
    if(!S.isWalking){ const p=_zone(S.currentZone); _setPos(p.x,p.y); }
  });

})();
