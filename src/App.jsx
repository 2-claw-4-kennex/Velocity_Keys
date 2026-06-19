import { useState, useRef, useCallback, useMemo, memo, useEffect, forwardRef } from "react";

// ---- CONSTANTS ---------------------------------------------------------------

const FINGER_MAP = {
  q:0,a:0,z:0, w:1,s:1,x:1, e:2,d:2,c:2,
  r:3,f:3,v:3,t:3,g:3,b:3, y:4,h:4,n:4,u:4,j:4,m:4,
  i:5,k:5, o:6,l:6, p:7,"[":7,"]":7,";":7,"'":7,
};
const FINGER_NAMES  = ["L. Pinky","L. Ring","L. Middle","L. Index","R. Index","R. Middle","R. Ring","R. Pinky"];
const FINGER_COLORS = ["#7F77DD","#5DCAA5","#378ADD","#D4537E","#EF9F27","#639922","#D85A30","#A32D2D"];

const QWERTY_ROWS = [
  ["q","w","e","r","t","y","u","i","o","p"],
  ["a","s","d","f","g","h","j","k","l"],
  ["z","x","c","v","b","n","m"],
];
const PUNCT_KEYS = [",",".",";","'","\"","/","?","!",":","-","(",")"  ];

// All 100% typeable on US keyboard — no em-dashes, no curly quotes
const SAMPLE_TEXTS = [
  `Can you believe it? The quick, brown fox jumps over the lazy dog; then it runs breathlessly through the forest.`,
  `She asked: "Why does practice matter?" He replied, "Because repetition builds the pathways your fingers need."`,
  `Type fast, but type right: commas, periods, colons; semicolons and question marks all slow you down.`,
  `The rhythm of typing flows naturally: fingers learn geometry, muscle memory builds, and hesitation disappears.`,
  `Consider this: "Speed without accuracy is noise." Fix your worst digraphs (th, er, he) and watch your WPM climb.`,
  `What separates 80 WPM from 160 WPM? Not raw speed, but the slow transitions: qu, wh, ck, and ph that cost you.`,
];

// ---- WORD ENGINE -------------------------------------------------------------

function getWords(text) {
  const words = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === " ") { i++; continue; }
    const start = i;
    while (i < text.length && text[i] !== " ") i++;
    words.push({ start, end: i, word: text.slice(start, i) });
  }
  return words;
}

function getCurrentWordIdx(words, typedLen) {
  // Find the word that owns the cursor position.
  // Cursor belongs to word i while typedLen is in range [word[i].start, word[i+1].start).
  // Once typedLen >= word[i+1].start the cursor has moved into word i+1.
  for (let i = 0; i < words.length; i++) {
    const nextStart = i < words.length - 1 ? words[i + 1].start : Infinity;
    if (typedLen < nextStart) return i;
  }
  return words.length - 1;
}

// ---- WORD-WRAP LAYOUT --------------------------------------------------------

function buildLayout(text, ctx, availW, padL, padT, lineH) {
  const chars  = text.split("");
  const widths = chars.map(ch => ctx.measureText(ch).width);
  const tokens = [];
  let i = 0;
  while (i < chars.length) {
    const start = i;
    if (chars[i] === " ") {
      while (i < chars.length && chars[i] === " ") i++;
      tokens.push({ space: true, start, end: i });
    } else {
      while (i < chars.length && chars[i] !== " ") i++;
      tokens.push({ space: false, start, end: i });
    }
  }

  const charMap = {};
  let x = padL, lineIdx = 0, lineCount = 1;

  for (const tok of tokens) {
    if (tok.space) {
      for (let k = tok.start; k < tok.end; k++) {
        charMap[k] = { x, y: padT + lineIdx * lineH, w: widths[k] };
        x += widths[k];
      }
    } else {
      let ww = 0;
      for (let k = tok.start; k < tok.end; k++) ww += widths[k];
      if (x + ww > padL + availW && x > padL) {
        lineIdx++; lineCount = lineIdx + 1; x = padL;
      }
      for (let k = tok.start; k < tok.end; k++) {
        charMap[k] = { x, y: padT + lineIdx * lineH, w: widths[k] };
        x += widths[k];
      }
    }
  }
  return { charMap, lineCount };
}

// ---- DRILL TEXT BUILDER (with symbols) ---------------------------------------
//
// Produces 3-4 short sentences that: (a) pack in words containing the slow
// digraphs, (b) include varied punctuation so symbol keys are practiced too.

const WORD_BANK = {
  th:["the","their","there","they","then","through","thought","think","things","this","that","these","though","other","whether","path","truth","worth"],
  he:["the","they","here","where","these","whether","there","she","her","held","help","ahead","together"],
  er:["every","never","often","under","enter","order","over","whether","rather","create","greater","together","better","letter","after","water"],
  ea:["great","treat","create","threat","breath","health","wealth","death","easy","read","each","reach","speak","break","clear","dream","learn","year"],
  re:["great","create","threat","reach","every","rather","where","there","three","free","tree","agree","break","dream","green","real"],
  in:["thinking","information","station","attention","string","spring","ring","thing","within","finding","kind","mind","wind","blind"],
  ti:["attention","station","question","action","patient","entire","notice","time","until","positive","active","native","motion","option"],
  io:["information","station","attention","action","motion","position","vision","region","opinion","million","union","option"],
  on:["information","station","attention","action","long","strong","wrong","gone","done","once","none","stone","alone","phone","zone"],
  ng:["string","strong","spring","bring","ring","thing","king","sing","wing","thinking","feeling","learning","running"],
  st:["string","strong","spring","street","station","start","stop","still","step","star","state","store","story","stay","style","study"],
  tr:["treat","create","street","threat","string","through","thought","travel","true","try","tree","train","trust","trouble","track"],
  pr:["practice","programming","prepared","problem","process","program","project","provide","produce","present","pretty","press"],
  ou:["through","thought","about","house","found","could","would","should","count","sound","round","doubt","ground","cloud","proud"],
  ow:["brown","know","how","now","show","slow","flow","grow","allow","follow","below","throw","power","town","down"],
  de:["deep","dead","dear","deal","decide","develop","deliver","depend","under","order","made","side","wide","mode","code"],
  al:["always","also","already","although","almost","along","allow","all","call","fall","small","shall","tall","real","deal","heal"],
  nt:["want","front","hunt","grant","plant","print","point","count","mount","paint","meant","event","rent","hint","bent"],
  an:["and","can","man","than","plan","span","hand","land","sand","stand","brand","grand","change","range","chance","dance"],
  en:["then","when","often","enter","seven","open","even","never","every","been","seen","green","queen","end","send","bend"],
  le:["people","little","middle","simple","single","table","able","eagle","example","purple","while","smile","style","mile","file"],
  or:["for","more","before","store","order","force","short","sport","sort","port","form","storm","word","world","work"],
};

// Sentence templates: {0} {1} {2} are placeholders for drill words
const SENTENCE_TEMPLATES = [
  (a,b,c) => `Can you ${a} the ${b}, or ${c}?`,
  (a,b,c) => `Yes: ${a}, ${b}, and ${c}.`,
  (a,b,c) => `Try ${a}; then ${b} and ${c}.`,
  (a,b,c) => `Note that ${a}, ${b}, and ${c} all matter.`,
  (a,b,c) => `"${a}" leads to ${b}; ${c} follows.`,
  (a,b,c) => `${a}, ${b}, ${c}: focus on each one.`,
  (a,b,c) => `Is ${a} better than ${b}? Or ${c}?`,
  (a,b,c) => `${a} and ${b} are key; so is ${c}.`,
];

function buildDrillText(slowPairs) {
  // Collect words for each slow pair
  const seen = new Set();
  const pool = [];
  for (const pair of slowPairs.slice(0, 5)) {
    const p = pair.toLowerCase().replace(/[^a-z]/g, "");
    if (!p) continue;
    if (WORD_BANK[p]) {
      for (const w of WORD_BANK[p]) { if (!seen.has(w)) { seen.add(w); pool.push(w); } }
    }
    for (const words of Object.values(WORD_BANK)) {
      for (const w of words) {
        if (!seen.has(w) && w.includes(p)) { seen.add(w); pool.push(w); }
      }
    }
  }
  // Fallback words
  for (const w of ["the","their","through","thought","there","then","great","treat","things","think","create","every"])
    if (!seen.has(w)) { seen.add(w); pool.push(w); }

  const words = [...new Set(pool)].slice(0, 18);

  // Build 4 sentences using templates, cycling through words
  const sentences = [];
  let wi = 0;
  const pick = () => { const w = words[wi % words.length]; wi++; return w; };
  for (let s = 0; s < 4; s++) {
    const tmpl = SENTENCE_TEMPLATES[s % SENTENCE_TEMPLATES.length];
    sentences.push(tmpl(pick(), pick(), pick()));
  }

  return sentences.join(" ");
}

// ---- ANALYTICS ---------------------------------------------------------------

function computeMetrics(ksArray, text, duration, targetWpm) {
  const transitions = {}, fingerLats = Array(8).fill(null).map(() => []),
        keyLats = {}, keyErrors = {};
  let errors = 0;

  for (let i = 1; i < ksArray.length; i++) {
    const prev = ksArray[i - 1], curr = ksArray[i];
    const lat  = curr.t - prev.t;
    if (lat > 0 && lat < 1500) {
      const fk = prev.k, tk = curr.k;
      if (fk.length === 1 && tk.length === 1 && fk !== " " && tk !== " ") {
        const p = fk.toLowerCase() + tk.toLowerCase();
        if (!transitions[p]) transitions[p] = [];
        transitions[p].push(lat);
      }
      const fi = FINGER_MAP[tk.toLowerCase()];
      if (fi !== undefined) fingerLats[fi].push(lat);
      if (tk.length === 1) {
        if (!keyLats[tk]) keyLats[tk] = [];
        keyLats[tk].push(lat);
      }
    }
    if (!curr.ok) {
      errors++;
      if (curr.k.length === 1) keyErrors[curr.k] = (keyErrors[curr.k] || 0) + 1;
    }
  }

  const digraphStats = {};
  for (const [p, lats] of Object.entries(transitions))
    digraphStats[p] = { avg: Math.round(lats.reduce((a,b)=>a+b,0)/lats.length), count: lats.length };

  const fingerStats = fingerLats.map(lats => {
    if (!lats.length) return { avg:0, count:0, score:0 };
    const avg = lats.reduce((a,b)=>a+b,0)/lats.length;
    return { avg: Math.round(avg), count: lats.length, score: Math.max(0,Math.min(100,Math.round(100-(avg-60)*0.8))) };
  });

  const keyHeatmap = {};
  for (const [k, lats] of Object.entries(keyLats))
    keyHeatmap[k] = { avg: Math.round(lats.reduce((a,b)=>a+b,0)/lats.length), count: lats.length, errors: keyErrors[k]||0 };

  const wordCount = text.trim().split(/\s+/).length;
  const wpm       = Math.round(wordCount / Math.max(duration/60000, 0.001));
  const totalKeys = ksArray.length;
  const accuracy  = totalKeys > 0 ? Math.round(((totalKeys-errors)/totalKeys)*100) : 100;
  const tLat      = Math.round(60000/(targetWpm*5));

  const sortedDigraphs = Object.entries(digraphStats).sort((a,b)=>b[1].avg-a[1].avg).slice(0,20);
  const slowDigraphs   = sortedDigraphs.slice(0,6).map(([pair,s])=>({ pair, avg:s.avg, excess:Math.max(0,s.avg-tLat), count:s.count }));
  const worstFingers   = fingerStats.map((s,i)=>({name:FINGER_NAMES[i],...s,idx:i})).filter(f=>f.count>0).sort((a,b)=>a.score-b.score).slice(0,3);
  const sameFinger     = Object.entries(digraphStats).filter(([p])=>{
    const f1=FINGER_MAP[p[0]], f2=FINGER_MAP[p[1]];
    return f1!==undefined && f2!==undefined && f1===f2 && p[0]!==p[1];
  }).sort((a,b)=>b[1].avg-a[1].avg).slice(0,8);

  return { wpm, accuracy, errors, totalKeys, digraphStats, sortedDigraphs, fingerStats, keyHeatmap,
    targetLatency:tLat, currentLatency:Math.round(duration/Math.max(totalKeys,1)),
    wpmGap:targetWpm-wpm, slowDigraphs, worstFingers, sameFinger };
}

// ---- CANVAS ------------------------------------------------------------------

const FS   = 18;
const LH   = Math.round(FS * 2.1);
const PL   = 28;
const PT   = 32;
const PR   = 28;
const FONT = `${FS}px ui-monospace,"SF Mono","Cascadia Code",Menlo,monospace`;

function getColors() {
  const dk = window.matchMedia("(prefers-color-scheme:dark)").matches;
  return {
    pending: dk ? "#71717a" : "#9ca3af",
    correct: dk ? "#22c55e" : "#15803d",
    wrong:   dk ? "#f87171" : "#b91c1c",
    wrongBg: dk ? "rgba(239,68,68,0.20)" : "rgba(239,68,68,0.13)",
    wordHl:  dk ? "rgba(127,119,221,0.15)" : "rgba(127,119,221,0.10)",
    wordLn:  "#7F77DD",
    cursor:  "#7F77DD",
  };
}

const TextDisplay = forwardRef(({ text }, fwdRef) => {
  const canvasRef   = useRef(null);
  const stateRef    = useRef({ typed:"", words:[], curWordIdx:0 });
  const blinkRef    = useRef(true);
  const layoutCache = useRef({ charMap:{}, lineCount:1, text:"", W:0 });

  const setRef = useCallback(node => {
    canvasRef.current = node;
    if (fwdRef) fwdRef.current = node;
  }, []);

  function getCtx() {
    const cvs = canvasRef.current;
    if (!cvs) return null;
    const dpr = window.devicePixelRatio || 1;
    const W = cvs.offsetWidth, H = cvs.offsetHeight;
    if (!W || !H) return null;
    cvs.width = W*dpr; cvs.height = H*dpr;
    const ctx = cvs.getContext("2d");
    ctx.scale(dpr,dpr); ctx.font = FONT;
    return { ctx, W };
  }

  function getLayout(ctx, W) {
    const t = text;
    if (layoutCache.current.text === t && layoutCache.current.W === W) return layoutCache.current;
    const r = buildLayout(t, ctx, W - PL - PR, PL, PT, LH);
    layoutCache.current = { ...r, text:t, W };
    return layoutCache.current;
  }

  function drawFrame() {
    const r = getCtx(); if (!r) return;
    const { ctx, W } = r;
    const C = getColors();
    const { typed, words, curWordIdx } = stateRef.current;
    const { charMap, lineCount } = getLayout(ctx, W);
    const t = text;

    ctx.clearRect(0, 0, W, (lineCount+1)*LH + PT*2);

    // Active word highlight
    if (words.length > 0 && curWordIdx < words.length) {
      const cw = words[curWordIdx];
      const sm = charMap[cw.start], em = charMap[cw.end - 1];
      if (sm && em) {
        const ux = sm.x - 2, uy = sm.y, uw = em.x + em.w - sm.x + 4;
        ctx.fillStyle = C.wordHl;
        ctx.beginPath(); ctx.roundRect(ux, uy - FS*1.3, uw, FS*1.76, 5); ctx.fill();
        ctx.fillStyle = C.wordLn;
        ctx.fillRect(ux, uy + FS*0.46, uw, 2.5);
      }
    }

    ctx.font = FONT;
    for (let gi = 0; gi < t.length; gi++) {
      const m = charMap[gi]; if (!m) continue;
      const ch = t[gi], tch = typed[gi];
      const isCursor = gi === typed.length;
      const isTyped  = tch !== undefined;
      const correct  = isTyped && tch === ch;
      const wrong    = isTyped && tch !== ch;

      if (wrong) { ctx.fillStyle = C.wrongBg; ctx.fillRect(m.x, m.y-FS*1.3, m.w+1, FS*1.76); }
      if (isCursor && blinkRef.current) { ctx.fillStyle = C.cursor; ctx.fillRect(m.x-2, m.y-FS*1.3, 2.5, FS*1.76); }
      ctx.font = FONT;
      ctx.fillStyle = correct ? C.correct : wrong ? C.wrong : C.pending;
      ctx.fillText(ch, m.x, m.y);
    }
    // Cursor at end
    if (typed.length >= t.length && blinkRef.current && t.length > 0) {
      const last = charMap[t.length - 1];
      if (last) { ctx.fillStyle = C.cursor; ctx.fillRect(last.x+last.w+1, last.y-FS*1.3, 2.5, FS*1.76); }
    }
  }

  useEffect(() => {
    const cvs = canvasRef.current; if (!cvs) return;
    layoutCache.current = { charMap:{}, lineCount:1, text:"", W:0 };
    cvs._update = (typed, words, curWordIdx) => {
      stateRef.current = { typed, words, curWordIdx };
      blinkRef.current = true;
      drawFrame();
    };
    const tid = setTimeout(() => drawFrame(), 30);
    return () => clearTimeout(tid);
  }, [text]);

  useEffect(() => {
    const id = setInterval(() => { blinkRef.current = !blinkRef.current; drawFrame(); }, 530);
    return () => clearInterval(id);
  }, [text]);

  useEffect(() => {
    const ro = new ResizeObserver(() => { layoutCache.current.W = 0; drawFrame(); });
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [text]);

  const estLines = useMemo(() => Math.max(3, Math.ceil(text.length / 52)), [text]);

  return (
    <div style={{ borderRadius:"var(--border-radius-lg)", border:"0.5px solid var(--color-border-secondary)", background:"var(--color-background-primary)", marginBottom:"1.25rem", overflow:"hidden", cursor:"text" }}>
      <canvas ref={setRef} style={{ display:"block", width:"100%", height: estLines * LH + PT * 2 }} />
    </div>
  );
});

// ---- HEATMAP KEY -------------------------------------------------------------

const HeatmapKey = memo(({ letter, data, targetLatency, size=54 }) => {
  const [tip, setTip] = useState(false);
  const avg = data?.avg || 0;
  let bg = "var(--color-background-secondary)", fg = "var(--color-text-secondary)";
  if (avg > 0) {
    const r = avg / targetLatency;
    if (r <= 1) { bg = "#1D9E75"; fg = "#fff"; }
    else if (r <= 1.5) { bg = "#EF9F27"; fg = "#fff"; }
    else { bg = "#E24B4A"; fg = "#fff"; }
  }
  return (
    <div style={{ position:"relative" }} onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}>
      <div style={{ width:size, height:size, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", borderRadius:8, background:bg, color:fg, border:"1px solid rgba(0,0,0,0.10)", cursor:"default", userSelect:"none", transform:tip?"scale(1.15)":"scale(1)", transition:"transform 0.1s", position:"relative", zIndex:tip?3:1 }}>
        <span style={{ fontWeight:700, fontSize:size>40?16:12, lineHeight:1 }}>{letter}</span>
        {avg > 0 && <span style={{ fontSize:size>40?10:8, opacity:0.9, marginTop:2 }}>{avg}ms</span>}
      </div>
      {tip && (
        <div style={{ position:"absolute", bottom:"calc(100% + 10px)", left:"50%", transform:"translateX(-50%)", background:"#111827", color:"#f9fafb", padding:"10px 14px", borderRadius:10, fontSize:12, whiteSpace:"nowrap", zIndex:999, pointerEvents:"none", lineHeight:1.8, border:"1px solid rgba(255,255,255,0.08)", boxShadow:"0 8px 24px rgba(0,0,0,0.35)" }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}><code style={{ fontFamily:"var(--font-mono)" }}>{letter}</code> key</div>
          {avg > 0 ? (<>
            <div>Avg latency: <b>{avg}ms</b></div>
            <div>Target: <b>{targetLatency}ms</b></div>
            <div>Samples: <b>{data.count}</b>{data.errors > 0 ? ` (${data.errors} errors)` : ""}</div>
            <div style={{ color:avg>targetLatency?"#FCA5A5":"#6EE7B7", marginTop:4, fontWeight:600 }}>
              {avg > targetLatency ? `+${avg-targetLatency}ms over target` : `-${targetLatency-avg}ms under target`}
            </div>
          </>) : <div style={{ color:"#9CA3AF" }}>Not typed this session</div>}
        </div>
      )}
    </div>
  );
});

// ---- STAT CARD ---------------------------------------------------------------

function StatCard({ label, value, sub, color, mono }) {
  return (
    <div style={{ background:"var(--color-background-secondary)", borderRadius:"var(--border-radius-lg)", padding:"14px 18px", borderTop:`3px solid ${color||"transparent"}` }}>
      <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:4, fontWeight:500, letterSpacing:0.5 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:500, color:color||"var(--color-text-primary)", fontFamily:mono?"var(--font-mono)":undefined, lineHeight:1.1 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:4 }}>{sub}</div>}
    </div>
  );
}

// ---- DRILL CHAIN PROGRESS PANEL ----------------------------------------------
// Shows a timeline of the current drill chain with per-digraph improvement bars

function DrillChainProgress({ chain }) {
  if (!chain || chain.length === 0) return null;

  // Gather all unique digraph pairs across the chain
  const allPairs = [...new Set(chain.flatMap(c => c.targetPairs))];

  return (
    <div style={{ marginBottom:"1.5rem" }}>
      <div style={{ fontSize:14, fontWeight:500, marginBottom:"1rem", color:"var(--color-text-primary)" }}>
        Drill chain progress
        <span style={{ fontSize:12, fontWeight:400, color:"var(--color-text-secondary)", marginLeft:8 }}>
          {chain.length} session{chain.length !== 1 ? "s" : ""} in this chain
        </span>
      </div>

      {/* Chain timeline */}
      <div style={{ display:"flex", gap:0, marginBottom:"1.25rem", overflowX:"auto" }}>
        {chain.map((entry, idx) => (
          <div key={idx} style={{ display:"flex", alignItems:"center", gap:0 }}>
            <div style={{
              padding:"10px 14px", background:"var(--color-background-secondary)",
              borderRadius:"var(--border-radius-md)", borderLeft:`3px solid ${idx === 0 ? "#5DCAA5" : "#7F77DD"}`,
              minWidth:130, flexShrink:0,
            }}>
              <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginBottom:3, fontWeight:500 }}>
                {idx === 0 ? "BASELINE" : `DRILL ${idx}`}
                <span style={{ marginLeft:6, opacity:0.7 }}>{entry.date}</span>
              </div>
              <div style={{ fontSize:18, fontWeight:600, fontFamily:"var(--font-mono)", color: idx === 0 ? "var(--color-text-primary)" : "#7F77DD" }}>
                {entry.wpm} WPM
              </div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:2 }}>
                {entry.accuracy}% acc
              </div>
              {idx > 0 && (
                <div style={{ fontSize:11, marginTop:4, color: entry.wpm >= chain[idx-1].wpm ? "#1D9E75" : "#E24B4A", fontWeight:600 }}>
                  {entry.wpm >= chain[idx-1].wpm ? "+" : ""}{entry.wpm - chain[idx-1].wpm} WPM
                </div>
              )}
              {/* Target pairs for this drill */}
              <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:6 }}>
                {(entry.targetPairs || []).slice(0, 4).map(p => (
                  <code key={p} style={{ fontFamily:"var(--font-mono)", fontSize:11, fontWeight:700, padding:"1px 5px", borderRadius:4, background:"var(--color-background-primary)", color:"var(--color-text-primary)" }}>{p}</code>
                ))}
              </div>
            </div>
            {idx < chain.length - 1 && (
              <div style={{ width:24, height:2, background:"var(--color-border-tertiary)", flexShrink:0 }} />
            )}
          </div>
        ))}
      </div>

      {/* Per-digraph improvement across chain */}
      {allPairs.length > 0 && chain.length >= 2 && (
        <>
          <div style={{ fontSize:12, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:8 }}>Digraph latency across chain</div>
          {allPairs.map(pair => {
            const baseline = chain[0].digraphAvgs?.[pair];
            const latest   = chain[chain.length - 1].digraphAvgs?.[pair];
            if (!baseline) return null;
            const improved = latest && latest < baseline;
            const delta    = latest ? baseline - latest : null;
            const pct      = delta !== null ? Math.round(Math.abs(delta / baseline) * 100) : null;
            return (
              <div key={pair} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <code style={{ fontFamily:"var(--font-mono)", fontSize:15, fontWeight:700, width:32, letterSpacing:3 }}>{pair}</code>
                <div style={{ flex:1, position:"relative", height:14, background:"var(--color-background-secondary)", borderRadius:7, overflow:"hidden" }}>
                  <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${Math.min(100,(baseline/400)*100)}%`, background:"#E24B4A44", borderRadius:7 }} />
                  {latest && <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${Math.min(100,(latest/400)*100)}%`, background:improved?"#1D9E75":"#E24B4A", borderRadius:7, transition:"width 0.6s" }} />}
                </div>
                <div style={{ fontSize:12, fontFamily:"var(--font-mono)", minWidth:120, textAlign:"right" }}>
                  <span style={{ color:"var(--color-text-secondary)" }}>{baseline}ms</span>
                  {latest && (<>
                    <span style={{ color:"var(--color-text-secondary)", margin:"0 4px" }}>-&gt;</span>
                    <span style={{ color:improved?"#1D9E75":"#E24B4A", fontWeight:700 }}>{latest}ms</span>
                  </>)}
                </div>
                {pct !== null && delta !== null && (
                  <div style={{ minWidth:44, fontSize:12, fontWeight:600, color:improved?"#1D9E75":"#E24B4A", textAlign:"right" }}>
                    {improved ? `-${pct}%` : `+${pct}%`}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ---- TAB BUTTON --------------------------------------------------------------

function TabBtn({ id, label, active, onClick }) {
  return (
    <button onClick={() => onClick(id)} style={{
      padding:"10px 16px", fontSize:13, border:"none",
      background:active?"var(--color-background-primary)":"transparent",
      color:active?"var(--color-text-primary)":"var(--color-text-secondary)",
      borderRadius:"var(--border-radius-md) var(--border-radius-md) 0 0",
      fontWeight:active?500:400, cursor:"pointer",
      borderBottom:active?"2px solid #7F77DD":"2px solid transparent",
    }}>{label}</button>
  );
}

// ---- MAIN APP ----------------------------------------------------------------

export default function TypeForge() {
  const [targetWpm, setTargetWpm] = useState(120);

  // Mode tracking
  const modeRef      = useRef("diagnostic");
  const drillTextRef = useRef("");
  const [mode, setMode] = useState("diagnostic");
  const [textIdx, setTextIdx] = useState(0);

  // Hot-path refs
  const typedRef      = useRef("");
  const ksRef         = useRef([]);
  const startTimeRef  = useRef(null);
  const isRunRef      = useRef(false);
  const wordsRef      = useRef([]);
  const activeTextRef = useRef(SAMPLE_TEXTS[0]);

  // Drill chain state
  // drillChain: array of {wpm, accuracy, date, targetPairs, digraphAvgs, chainId}
  // chainId groups sessions from the same diagnostic origin
  const [drillChain,    setDrillChain]    = useState(null);  // active chain (null if in diagnostic)
  const drillChainRef   = useRef(null);
  const drillChainIdRef = useRef(null);   // uuid for this chain
  const drillNumRef     = useRef(0);      // how many drills in current chain

  // Render-gate state
  const [typedDisplay, setTypedDisplay] = useState("");
  const [typedLen,  setTypedLen]   = useState(0);
  const [liveWpm,   setLiveWpm]    = useState(0);
  const [running,   setRunning]    = useState(false);
  const [wordError, setWordError]  = useState(false);

  const [metrics,   setMetrics]   = useState(null);
  const [history,   setHistory]   = useState([]);
  const [view,      setView]      = useState("test");
  const [activeTab, setActiveTab] = useState("overview");

  const inputRef  = useRef(null);
  const canvasRef = useRef(null);

  const currentText = () => activeTextRef.current;

  const pushCanvas = useCallback((typed) => {
    const cvs = canvasRef.current;
    if (cvs?._update) cvs._update(typed, wordsRef.current, getCurrentWordIdx(wordsRef.current, typed.length));
  }, []);

  // ---- Reset / start ----------------------------------------------------------
  const startTest = useCallback((opts = {}) => {
    const { newMode, drillText, nextIdx } = opts;
    typedRef.current     = "";
    ksRef.current        = [];
    startTimeRef.current = null;
    isRunRef.current     = false;

    const resolvedMode = newMode ?? modeRef.current;
    const resolvedIdx  = nextIdx !== undefined ? nextIdx : textIdx;
    const resolvedText = resolvedMode === "drill"
      ? (drillText ?? drillTextRef.current)
      : SAMPLE_TEXTS[resolvedIdx];

    if (newMode  !== undefined) { modeRef.current = newMode; setMode(newMode); }
    if (drillText !== undefined) drillTextRef.current = drillText;
    if (nextIdx  !== undefined) setTextIdx(nextIdx);

    activeTextRef.current = resolvedText;
    wordsRef.current      = getWords(resolvedText);

    setTypedDisplay(""); setTypedLen(0); setLiveWpm(0);
    setRunning(false); setWordError(false);
    setMetrics(null); setView("test"); setActiveTab("overview");

    setTimeout(() => {
      const cvs = canvasRef.current;
      if (cvs?._update) cvs._update("", wordsRef.current, 0);
      inputRef.current?.focus();
    }, 40);
  }, [textIdx]);

  // Start a new drill from a diagnostic OR continue the chain from a drill result
  // baselineMetrics: the metrics to compare against (always the ORIGINAL diagnostic)
  // targetPairs: digraph pairs this drill targets
  const startDrillSession = useCallback((fromMetrics, existingChain) => {
    const targetPairs = fromMetrics.slowDigraphs.slice(0, 4).map(d => d.pair);
    const dt = buildDrillText(targetPairs);

    if (!existingChain) {
      // Starting a fresh chain from diagnostic
      const chainId = Date.now().toString();
      drillChainIdRef.current = chainId;
      drillNumRef.current     = 1;
      // Seed chain with the diagnostic baseline entry
      const baselineEntry = {
        wpm:          fromMetrics.wpm,
        accuracy:     fromMetrics.accuracy,
        date:         new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
        targetPairs:  targetPairs,
        digraphAvgs:  Object.fromEntries(fromMetrics.slowDigraphs.map(d => [d.pair, d.avg])),
        chainId,
        isDiagnostic: true,
      };
      const newChain = [baselineEntry];
      drillChainRef.current = newChain;
      setDrillChain(newChain);
    } else {
      // Continuing an existing chain — same chainId, increment drill num
      drillNumRef.current += 1;
      drillChainRef.current = existingChain; // already up to date (set after last completion)
    }

    drillTextRef.current = dt;
    startTest({ newMode:"drill", drillText:dt });
  }, [startTest]);

  const nextDiagnostic = useCallback(() => {
    // Leaving drill mode — reset chain
    drillChainRef.current   = null;
    drillChainIdRef.current = null;
    drillNumRef.current     = 0;
    setDrillChain(null);
    startTest({ newMode:"diagnostic", drillText:"", nextIdx:(textIdx+1)%SAMPLE_TEXTS.length });
  }, [startTest, textIdx]);

  useEffect(() => {
    activeTextRef.current = SAMPLE_TEXTS[0];
    wordsRef.current      = getWords(SAMPLE_TEXTS[0]);
  }, []);

  const handlePaste = useCallback(e => e.preventDefault(), []);

  // ---- Core keydown -----------------------------------------------------------
  const handleKeyDown = useCallback(e => {
    if ((e.ctrlKey || e.metaKey) && ["v","V","a","A","c","C","x","X"].includes(e.key)) {
      e.preventDefault(); return;
    }
    if (e.key === "Tab") { e.preventDefault(); return; }

    const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!isPrintable && e.key !== "Backspace") return;
    e.preventDefault();

    const text = currentText();
    const prev = typedRef.current;
    const now  = performance.now();
    let next   = prev;

    if (e.key === "Backspace") {
      if (!prev.length) return;
      const cwIdx     = getCurrentWordIdx(wordsRef.current, prev.length);
      const wordStart = wordsRef.current[cwIdx]?.start ?? 0;
      if (prev.length > wordStart) {
        next = prev.slice(0, -1);
        if (ksRef.current.length > 0) ksRef.current.pop();
      }
    } else {
      const ch  = e.key;
      const pos = prev.length;
      if (pos >= text.length) return;

      // Always find which word the cursor is currently inside
      const cwIdx = getCurrentWordIdx(wordsRef.current, pos);
      const cw    = wordsRef.current[cwIdx];

      if (ch === " ") {
        // Space only allowed when current word is fully and correctly typed
        if (!cw) return;
        if (pos !== cw.end) {
          setWordError(true); setTimeout(() => setWordError(false), 500); return;
        }
        const wordTyped  = prev.slice(cw.start, cw.end);
        const wordTarget = text.slice(cw.start, cw.end);
        if (wordTyped !== wordTarget) {
          setWordError(true); setTimeout(() => setWordError(false), 500); return;
        }
        if (text[pos] !== " ") return;
      } else {
        // Non-space character: must still be inside the current word's bounds.
        // If pos >= cw.end it means we've reached the space after the word.
        // The only way to pass that boundary is via a correct space keystroke above.
        // Block if cursor has somehow reached or passed word end (safety net).
        if (cw && pos >= cw.end) {
          // cursor is sitting in the inter-word space — force space to be typed first
          setWordError(true); setTimeout(() => setWordError(false), 500); return;
        }
      }

      const ok = ch === text[pos];
      ksRef.current.push({ k:ch, t:now, ok });
      next = prev + ch;

      if (!isRunRef.current) {
        isRunRef.current     = true;
        startTimeRef.current = now;
        setRunning(true);
      }

      if (startTimeRef.current) {
        const elapsed = (now - startTimeRef.current) / 60000;
        const spaces  = next.split(" ").length - 1;
        const wc      = spaces + (next[next.length-1] === " " ? 0 : 1);
        setLiveWpm(Math.min(300, Math.round(wc / Math.max(elapsed, 0.0001))));
      }
    }

    typedRef.current = next;
    setTypedDisplay(next);
    setTypedLen(next.length);
    pushCanvas(next);

    // Completion gate
    if (next.length === text.length && next === text) {
      isRunRef.current = false;
      const dur = now - (startTimeRef.current || now);
      const m   = computeMetrics(ksRef.current, text, dur, targetWpm);
      setMetrics(m);

      const iDrill = modeRef.current === "drill";
      const chainId = drillChainIdRef.current;
      const drillNum = drillNumRef.current;

      // Build history entry
      const historyEntry = {
        id:           Date.now(),
        date:         new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
        wpm:          m.wpm,
        accuracy:     m.accuracy,
        mode:         modeRef.current,
        // For drill: which pairs were targeted this session
        targetPairs:  iDrill ? (drillChainRef.current?.[0]?.targetPairs ?? []) : [],
        // For drill: which run in the chain
        drillNum:     iDrill ? drillNum : 0,
        chainId:      iDrill ? chainId : null,
        worstDigraph: m.slowDigraphs[0]?.pair || "--",
      };

      // If this was a drill, append result to chain
      if (iDrill && drillChainRef.current) {
        const newEntry = {
          wpm:         m.wpm,
          accuracy:    m.accuracy,
          date:        historyEntry.date,
          targetPairs: drillChainRef.current[0].targetPairs,
          digraphAvgs: Object.fromEntries(
            (drillChainRef.current[0].targetPairs || []).map(p => [p, m.digraphStats[p]?.avg]).filter(([,v]) => v)
          ),
          chainId,
          drillNum,
        };
        const updatedChain = [...drillChainRef.current, newEntry];
        drillChainRef.current = updatedChain;
        setDrillChain(updatedChain);
      }

      setHistory(ph => [historyEntry, ...ph.slice(0, 29)]);
      setTimeout(() => { setView("results"); setActiveTab("overview"); }, 150);
    }
  }, [targetWpm, pushCanvas]);

  const text     = currentText();
  const progress = text.length > 0 ? Math.min(1, typedLen / text.length) : 0;
  const expLat   = Math.round(60000 / (targetWpm * 5));

  // What pairs does the current drill target (shown in header)
  const currentTargetPairs = drillChain?.[0]?.targetPairs ?? [];

  // ---- RENDER -----------------------------------------------------------------
  return (
    <div style={{ fontFamily:"var(--font-sans)", maxWidth:870, margin:"0 auto", padding:"0 0 4rem" }}>

      {/* HEADER */}
      <div style={{ padding:"1.5rem 0 1.25rem", borderBottom:"0.5px solid var(--color-border-tertiary)", marginBottom:"1.75rem", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ display:"flex", alignItems:"baseline", gap:10, flexWrap:"wrap" }}>
            <span style={{ fontSize:24, fontWeight:500, letterSpacing:-0.5 }}>TypeForge</span>
            <span style={{ fontSize:11, fontFamily:"var(--font-mono)", padding:"2px 8px", borderRadius:20, fontWeight:500,
              color:mode==="drill"?"#EF9F27":"#7F77DD", background:mode==="drill"?"#FAEEDA":"#EEEDFE" }}>
              {mode === "drill" ? `DRILL ${drillNumRef.current > 0 ? `#${drillNumRef.current}` : ""}` : "DIAGNOSTIC"}
            </span>
            {/* Show targeted pairs in the header badge during drill */}
            {mode === "drill" && currentTargetPairs.length > 0 && (
              <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
                targeting:
                {currentTargetPairs.slice(0,4).map(p => (
                  <code key={p} style={{ fontFamily:"var(--font-mono)", fontWeight:700, fontSize:12, marginLeft:5, color:"var(--color-text-primary)", background:"var(--color-background-secondary)", padding:"1px 5px", borderRadius:4 }}>{p}</code>
                ))}
              </span>
            )}
          </div>
          <p style={{ margin:"3px 0 0", fontSize:13, color:"var(--color-text-secondary)" }}>
            {mode === "drill"
              ? `Drill session ${drillNumRef.current > 0 ? drillNumRef.current : ""} — fix every word before moving on.`
              : "100% accuracy required -- you cannot advance past a wrong word."}
          </p>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 12px", background:"var(--color-background-secondary)", borderRadius:"var(--border-radius-md)" }}>
            <span style={{ fontSize:12, color:"var(--color-text-secondary)" }}>Target</span>
            <select value={targetWpm} onChange={e => setTargetWpm(Number(e.target.value))} style={{ fontSize:14, border:"none", background:"transparent", color:"var(--color-text-primary)", fontWeight:500, cursor:"pointer" }}>
              {[60,80,100,120,140,160,180,200].map(v => <option key={v} value={v}>{v} WPM</option>)}
            </select>
          </div>
          {mode === "drill" && <button onClick={nextDiagnostic} style={{ fontSize:13, padding:"7px 14px" }}>End chain</button>}
          {view !== "test"  && <button onClick={nextDiagnostic} style={{ fontSize:13, padding:"7px 14px" }}>New test</button>}
          {view === "test" && mode === "diagnostic" && <button onClick={nextDiagnostic} style={{ fontSize:13, padding:"7px 14px" }}>New text</button>}
          {history.length > 0 && view !== "history" && <button onClick={() => setView("history")} style={{ fontSize:13, padding:"7px 14px" }}>History ({history.length})</button>}
        </div>
      </div>

      {/* TEST VIEW */}
      {view === "test" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10, marginBottom:"1.5rem" }}>
            <StatCard label="LIVE WPM"   value={running ? liveWpm : "--"} mono />
            <StatCard label="TARGET"     value={targetWpm} sub="WPM goal" color="#7F77DD" mono />
            <StatCard label="GAP"        value={running ? Math.abs(targetWpm-liveWpm) : "--"} sub={running?(liveWpm<targetWpm?"WPM behind":"WPM ahead!"):"start typing"} color={running?(liveWpm<targetWpm?"#E24B4A":"#1D9E75"):undefined} mono />
            <StatCard label="KEY TARGET" value={`${expLat}ms`} sub="per keystroke" mono />
          </div>

          <div style={{ height:4, background:"var(--color-background-secondary)", borderRadius:2, marginBottom:"1.25rem", overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${progress*100}%`, background:"linear-gradient(90deg,#7F77DD,#5DCAA5)", borderRadius:2 }} />
          </div>

          <div onClick={() => inputRef.current?.focus()}>
            <TextDisplay ref={canvasRef} text={text} />
          </div>

          <input ref={inputRef} value={typedDisplay} onChange={() => {}} onKeyDown={handleKeyDown} onPaste={handlePaste} autoFocus
            style={{ position:"absolute", opacity:0, pointerEvents:"none", width:1, height:1, top:0, left:0 }} />

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:8, flexWrap:"wrap", gap:8 }}>
            <p style={{ fontSize:12, margin:0, color:wordError?"#E24B4A":"var(--color-text-secondary)", fontWeight:wordError?500:400, transition:"color 0.2s" }}>
              {wordError ? "Fix the current word completely before pressing Space" : "Click text to focus  |  Fix each word before advancing  |  Paste blocked"}
            </p>
            <div style={{ display:"flex", gap:12, fontSize:12, color:"var(--color-text-secondary)" }}>
              {[{c:"#22c55e",l:"correct"},{c:"#f87171",l:"wrong"},{c:"#9ca3af",l:"pending"}].map(x => (
                <span key={x.l} style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:9, height:9, borderRadius:"50%", background:x.c, display:"inline-block" }}/>{x.l}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RESULTS VIEW */}
      {view === "results" && metrics && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:"1.5rem" }}>
            <StatCard label="WPM"         value={metrics.wpm}              sub={mode==="drill"?`Drill #${drillNumRef.current}`:"diagnostic"} color="#7F77DD" mono />
            <StatCard label="ACCURACY"    value={`${metrics.accuracy}%`}   sub={`${metrics.errors} errors`} color="#5DCAA5" mono />
            <StatCard label="TARGET"      value={targetWpm}                sub="WPM goal" mono />
            <StatCard label="GAP"         value={Math.abs(metrics.wpmGap)} sub={metrics.wpmGap>0?"WPM behind":"Target reached!"} color={metrics.wpmGap>0?"#E24B4A":"#1D9E75"} mono />
            <StatCard label="AVG LATENCY" value={`${metrics.currentLatency}ms`} sub={`target ${metrics.targetLatency}ms`} mono />
          </div>

          {/* Drill chain progress — shown when in drill mode and chain has results */}
          {mode === "drill" && drillChain && drillChain.length >= 2 && (
            <DrillChainProgress chain={drillChain} />
          )}

          <div style={{ display:"flex", gap:2, overflowX:"auto", borderBottom:"0.5px solid var(--color-border-tertiary)", marginBottom:"1.5rem" }}>
            {[{id:"overview",label:"Overview"},{id:"digraphs",label:"Digraph analysis"},{id:"heatmap",label:"Keyboard heatmap"},{id:"fingers",label:"Finger analytics"},{id:"drills",label:"Drills"}]
              .map(t => <TabBtn key={t.id} {...t} active={activeTab===t.id} onClick={setActiveTab} />)}
          </div>

          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div>
              <h3 style={{ fontSize:16, fontWeight:500, margin:"0 0 1rem" }}>Slowest digraph transitions</h3>
              {metrics.slowDigraphs.length === 0
                ? <p style={{ color:"var(--color-text-secondary)", fontSize:14 }}>Not enough data yet.</p>
                : metrics.slowDigraphs.map((d, i) => {
                  const col = d.avg > metrics.targetLatency*1.5 ? "#E24B4A" : d.avg > metrics.targetLatency ? "#EF9F27" : "#1D9E75";
                  // Compare to chain baseline if in drill mode
                  const bsl = drillChain?.[0]?.digraphAvgs?.[d.pair];
                  return (
                    <div key={d.pair} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
                      <span style={{ width:22, height:22, borderRadius:6, background:"var(--color-background-secondary)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"var(--color-text-secondary)", flexShrink:0 }}>{i+1}</span>
                      <code style={{ fontFamily:"var(--font-mono)", fontSize:22, fontWeight:700, width:48, letterSpacing:4 }}>{d.pair}</code>
                      <div style={{ flex:1, height:10, background:"var(--color-background-secondary)", borderRadius:5, position:"relative", overflow:"hidden" }}>
                        {bsl && <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${Math.min(100,(bsl/500)*100)}%`, background:"#E24B4A33", borderRadius:5 }} />}
                        <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${Math.min(100,(d.avg/500)*100)}%`, background:col, borderRadius:5 }} />
                      </div>
                      <div style={{ minWidth:120, textAlign:"right" }}>
                        <div style={{ fontSize:15, fontWeight:600, fontFamily:"var(--font-mono)", color:col }}>{d.avg}ms</div>
                        {bsl
                          ? <div style={{ fontSize:11, color:d.avg<bsl?"#1D9E75":"#E24B4A" }}>{d.avg<bsl?`-${bsl-d.avg}ms from baseline`:`+${d.avg-bsl}ms vs baseline`}</div>
                          : <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>+{d.excess}ms over target</div>}
                      </div>
                    </div>
                  );
                })}

              <h3 style={{ fontSize:16, fontWeight:500, margin:"1.75rem 0 1rem" }}>Weakest fingers</h3>
              {metrics.worstFingers.map(f => (
                <div key={f.name} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                  <div style={{ width:80, fontSize:12, color:"var(--color-text-secondary)", textAlign:"right", flexShrink:0 }}>{f.name}</div>
                  <div style={{ flex:1, height:16, background:"var(--color-background-secondary)", borderRadius:8, overflow:"hidden" }}>
                    <div style={{ width:`${f.score}%`, height:"100%", background:FINGER_COLORS[f.idx], borderRadius:8 }} />
                  </div>
                  <div style={{ width:56, fontSize:13, fontWeight:500, fontFamily:"var(--font-mono)", textAlign:"right" }}>{f.score}/100</div>
                  <div style={{ width:48, fontSize:12, color:"var(--color-text-secondary)" }}>{f.avg}ms</div>
                </div>
              ))}

              <div style={{ marginTop:"1.75rem", padding:"1.25rem 1.5rem", background:"var(--color-background-secondary)", borderRadius:"var(--border-radius-lg)", borderLeft:"3px solid #7F77DD" }}>
                <div style={{ fontSize:14, fontWeight:500, marginBottom:"0.75rem" }}>
                  {mode === "drill" ? `Next target — Drill #${drillNumRef.current + 1}` : `Fastest path to ${targetWpm} WPM`}
                </div>
                <ol style={{ margin:0, paddingLeft:"1.25rem", fontSize:13, color:"var(--color-text-secondary)", lineHeight:2.2 }}>
                  {metrics.slowDigraphs.slice(0,3).map(d => (
                    <li key={d.pair}>
                      Train <code style={{ fontFamily:"var(--font-mono)", fontWeight:700, fontSize:14, color:"var(--color-text-primary)", background:"var(--color-background-primary)", padding:"1px 6px", borderRadius:4 }}>{d.pair}</code>
                      {" "}from <span style={{ fontFamily:"var(--font-mono)", color:"#E24B4A", fontWeight:600 }}>{d.avg}ms</span> to <span style={{ fontFamily:"var(--font-mono)", color:"#1D9E75", fontWeight:600 }}>{metrics.targetLatency}ms</span>
                    </li>
                  ))}
                  {metrics.worstFingers[0] && <li>Improve {metrics.worstFingers[0].name} (score: {metrics.worstFingers[0].score}/100)</li>}
                </ol>
              </div>
            </div>
          )}

          {/* DIGRAPHS */}
          {activeTab === "digraphs" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"1rem" }}>
                <h3 style={{ fontSize:16, fontWeight:500, margin:0 }}>All digraph latencies (letters + symbols)</h3>
                <span style={{ fontSize:12, color:"var(--color-text-secondary)" }}>Target: {metrics.targetLatency}ms</span>
              </div>
              {metrics.sortedDigraphs.slice(0, 20).map(([pair, s], i) => {
                const col = s.avg > metrics.targetLatency*1.5 ? "#E24B4A" : s.avg > metrics.targetLatency ? "#EF9F27" : "#1D9E75";
                const isTarget = currentTargetPairs.includes(pair);
                return (
                  <div key={pair} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:"0.5px solid var(--color-border-tertiary)", background:isTarget?"var(--color-background-secondary)":undefined, borderRadius:isTarget?4:undefined, paddingLeft:isTarget?8:undefined }}>
                    <span style={{ width:20, fontSize:11, color:"var(--color-text-secondary)", textAlign:"right", flexShrink:0 }}>{i+1}</span>
                    <code style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:700, width:44, letterSpacing:3 }}>{pair}</code>
                    {isTarget && <span style={{ fontSize:10, fontWeight:600, padding:"1px 6px", borderRadius:10, background:"#FAEEDA", color:"#BA7517" }}>target</span>}
                    <div style={{ flex:1, height:8, background:"var(--color-background-secondary)", borderRadius:4 }}>
                      <div style={{ height:"100%", borderRadius:4, width:`${Math.min(100,(s.avg/400)*100)}%`, background:col }} />
                    </div>
                    <span style={{ fontSize:14, fontWeight:500, fontFamily:"var(--font-mono)", minWidth:56, textAlign:"right", color:col }}>{s.avg}ms</span>
                    <span style={{ fontSize:11, color:"var(--color-text-secondary)", minWidth:36 }}>{s.count}x</span>
                  </div>
                );
              })}
              {metrics.sortedDigraphs.length === 0 && <p style={{ color:"var(--color-text-secondary)" }}>Not enough data.</p>}
            </div>
          )}

          {/* HEATMAP */}
          {activeTab === "heatmap" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.75rem", flexWrap:"wrap", gap:8 }}>
                <h3 style={{ fontSize:16, fontWeight:500, margin:0 }}>Keyboard latency heatmap</h3>
                <div style={{ display:"flex", gap:14, fontSize:12, color:"var(--color-text-secondary)" }}>
                  {[{c:"#1D9E75",l:"Fast"},{c:"#EF9F27",l:"Moderate"},{c:"#E24B4A",l:"Slow"}].map(x => (
                    <span key={x.c} style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ width:12, height:12, borderRadius:3, background:x.c, display:"inline-block" }}/>{x.l}</span>
                  ))}
                </div>
              </div>
              <p style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:"1.25rem" }}>
                Hover any key for stats. Grey = not typed this session. Target: <b>{metrics.targetLatency}ms</b>.
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-start", marginBottom:16 }}>
                {QWERTY_ROWS.map((row, ri) => (
                  <div key={ri} style={{ display:"flex", gap:5, paddingLeft:ri===1?30:ri===2?57:0 }}>
                    {row.map(k => <HeatmapKey key={k} letter={k.toUpperCase()} data={metrics.keyHeatmap[k]} targetLatency={metrics.targetLatency} />)}
                  </div>
                ))}
                <div style={{ paddingLeft:114 }}>
                  <div style={{
                    width:240, height:54, display:"flex", alignItems:"center", justifyContent:"center",
                    borderRadius:8, border:"1px solid rgba(0,0,0,0.10)", fontWeight:500, fontSize:13,
                    background: metrics.keyHeatmap[" "] ? (metrics.keyHeatmap[" "].avg/metrics.targetLatency <= 1 ? "#1D9E75" : metrics.keyHeatmap[" "].avg/metrics.targetLatency <= 1.5 ? "#EF9F27" : "#E24B4A") : "var(--color-background-secondary)",
                    color: metrics.keyHeatmap[" "] ? "#fff" : "var(--color-text-secondary)",
                  }}>
                    {metrics.keyHeatmap[" "] ? `SPACE  ${metrics.keyHeatmap[" "].avg}ms` : "SPACE"}
                  </div>
                </div>
              </div>
              <div style={{ marginBottom:"1.5rem" }}>
                <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:8 }}>Punctuation & symbols</div>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                  {PUNCT_KEYS.map(k => <HeatmapKey key={k} letter={k} data={metrics.keyHeatmap[k]} targetLatency={metrics.targetLatency} size={48} />)}
                  {Object.entries(metrics.keyHeatmap)
                    .filter(([k]) => k.length===1 && !/^[a-z ]$/.test(k) && !PUNCT_KEYS.includes(k))
                    .map(([k,d]) => <HeatmapKey key={k} letter={k} data={d} targetLatency={metrics.targetLatency} size={48} />)}
                </div>
              </div>
              <h3 style={{ fontSize:15, fontWeight:500, margin:"0 0 0.75rem" }}>Slowest keys (all)</h3>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))", gap:8 }}>
                {Object.entries(metrics.keyHeatmap)
                  .filter(([k]) => k.length===1 && k!==" ")
                  .sort((a,b) => b[1].avg - a[1].avg).slice(0,10)
                  .map(([k,d]) => {
                    const col = d.avg>metrics.targetLatency*1.5?"#E24B4A":d.avg>metrics.targetLatency?"#EF9F27":"#1D9E75";
                    return (
                      <div key={k} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"var(--color-background-secondary)", borderRadius:"var(--border-radius-md)", borderLeft:`3px solid ${col}` }}>
                        <code style={{ fontFamily:"var(--font-mono)", fontSize:20, fontWeight:700, width:22 }}>{k}</code>
                        <div>
                          <div style={{ fontSize:14, fontWeight:500, color:col, fontFamily:"var(--font-mono)" }}>{d.avg}ms</div>
                          <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{d.count} samples</div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* FINGERS */}
          {activeTab === "fingers" && (
            <div>
              <h3 style={{ fontSize:16, fontWeight:500, margin:"0 0 1.25rem" }}>Finger efficiency scores</h3>
              {metrics.fingerStats.map((f,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                  <div style={{ width:80, fontSize:12, color:"var(--color-text-secondary)", textAlign:"right", flexShrink:0 }}>{FINGER_NAMES[i]}</div>
                  <div style={{ flex:1, height:20, background:"var(--color-background-secondary)", borderRadius:10, overflow:"hidden" }}>
                    <div style={{ width:`${f.score}%`, height:"100%", background:FINGER_COLORS[i], borderRadius:10 }} />
                  </div>
                  <div style={{ width:56, fontSize:13, fontWeight:500, fontFamily:"var(--font-mono)", textAlign:"right" }}>{f.count>0?`${f.score}/100`:"--"}</div>
                  <div style={{ width:56, fontSize:12, color:"var(--color-text-secondary)" }}>{f.count>0?`${f.avg}ms`:"no data"}</div>
                </div>
              ))}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10, marginTop:"1.5rem" }}>
                {metrics.fingerStats.map((f,i) => f.count>0 && (
                  <div key={i} style={{ background:"var(--color-background-secondary)", borderRadius:"var(--border-radius-md)", padding:"14px 16px", borderTop:`3px solid ${FINGER_COLORS[i]}` }}>
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:6 }}>{FINGER_NAMES[i]}</div>
                    <div style={{ fontSize:22, fontWeight:500, fontFamily:"var(--font-mono)" }}>{f.score}<span style={{ fontSize:13, color:"var(--color-text-secondary)" }}>/100</span></div>
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:4 }}>{f.avg}ms avg  {f.count} keys</div>
                  </div>
                ))}
              </div>
              {metrics.sameFinger.length > 0 && (<>
                <h3 style={{ fontSize:15, fontWeight:500, margin:"1.75rem 0 0.5rem" }}>Same-finger bigrams</h3>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {metrics.sameFinger.map(([pair,s]) => (
                    <div key={pair} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 14px", background:"var(--color-background-secondary)", border:"0.5px solid var(--color-border-secondary)", borderRadius:"var(--border-radius-md)" }}>
                      <code style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:700 }}>{pair}</code>
                      <span style={{ fontSize:12, color:"#EF9F27", fontFamily:"var(--font-mono)", fontWeight:500 }}>{s.avg}ms</span>
                    </div>
                  ))}
                </div>
              </>)}
            </div>
          )}

          {/* DRILLS TAB */}
          {activeTab === "drills" && (
            <div>
              <h3 style={{ fontSize:16, fontWeight:500, margin:"0 0 0.5rem" }}>
                {mode === "drill" ? `Continue drilling (Drill #${drillNumRef.current + 1})` : "Start a drill session"}
              </h3>
              <p style={{ fontSize:13, color:"var(--color-text-secondary)", margin:"0 0 1.25rem", lineHeight:1.6 }}>
                {mode === "drill"
                  ? (<>
                    Drill #{drillNumRef.current} complete. The next drill targets the same digraphs from the original diagnostic.
                    {drillChain && drillChain.length >= 2 && (
                      <span style={{ marginLeft:6 }}>
                        Chain so far: {drillChain.length} sessions, WPM {drillChain[0].wpm} {"→"} {drillChain[drillChain.length-1].wpm}.
                      </span>
                    )}
                  </>)
                  : (<>
                    Targets your slowest digraphs:{" "}
                    {metrics.slowDigraphs.slice(0,4).map((d,i) => (
                      <span key={d.pair}>
                        {i > 0 && ", "}
                        <code style={{ fontFamily:"var(--font-mono)", fontWeight:700, fontSize:14, color:"var(--color-text-primary)", background:"var(--color-background-secondary)", padding:"1px 6px", borderRadius:4 }}>{d.pair}</code>
                        <span style={{ fontSize:11, color:"#E24B4A", marginLeft:2 }}>({d.avg}ms)</span>
                      </span>
                    ))}
                  </>)}
              </p>

              {/* Target digraph cards */}
              <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:"1.25rem" }}>
                {(mode === "drill" ? (drillChain?.[0]?.targetPairs ?? []) : metrics.slowDigraphs.slice(0,5).map(d=>d.pair)).map(pair => {
                  const current = metrics.digraphStats[pair];
                  const baseline = drillChain?.[0]?.digraphAvgs?.[pair];
                  const col = !current ? "#9ca3af" : current.avg > metrics.targetLatency*1.5 ? "#E24B4A" : current.avg > metrics.targetLatency ? "#EF9F27" : "#1D9E75";
                  return (
                    <div key={pair} style={{ textAlign:"center", padding:"12px 18px", background:"var(--color-background-secondary)", borderRadius:"var(--border-radius-md)", borderTop:`3px solid ${col}`, minWidth:80 }}>
                      <code style={{ fontFamily:"var(--font-mono)", fontSize:24, fontWeight:700, letterSpacing:5, display:"block" }}>{pair}</code>
                      <div style={{ fontSize:12, color:col, fontFamily:"var(--font-mono)", fontWeight:600, marginTop:4 }}>{current ? `${current.avg}ms` : "--"}</div>
                      {baseline && current && (
                        <div style={{ fontSize:10, color:current.avg < baseline ? "#1D9E75" : "#E24B4A", marginTop:2, fontWeight:600 }}>
                          {current.avg < baseline ? `-${baseline - current.avg}ms` : `+${current.avg - baseline}ms`} from start
                        </div>
                      )}
                      {!baseline && <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginTop:2 }}>target {metrics.targetLatency}ms</div>}
                    </div>
                  );
                })}
              </div>

              {/* Drill text preview */}
              <div style={{ fontFamily:"var(--font-mono)", fontSize:14, lineHeight:2, padding:"1.25rem 1.5rem", background:"var(--color-background-secondary)", border:"0.5px solid var(--color-border-secondary)", borderRadius:"var(--border-radius-lg)", marginBottom:"1.5rem", wordBreak:"break-word" }}>
                <div style={{ fontSize:11, marginBottom:6, color:"var(--color-text-secondary)", fontFamily:"var(--font-sans)" }}>
                  Drill text preview (sentences with punctuation):
                </div>
                {buildDrillText(
                  mode === "drill"
                    ? (drillChain?.[0]?.targetPairs ?? metrics.slowDigraphs.slice(0,4).map(d=>d.pair))
                    : metrics.slowDigraphs.slice(0,4).map(d=>d.pair)
                ).slice(0, 180)}...
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:12, marginBottom:"1.5rem" }}>
                <div style={{ padding:"1rem 1.25rem", background:"var(--color-background-secondary)", borderRadius:"var(--border-radius-md)", borderTop:"3px solid #EF9F27" }}>
                  <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:8, fontWeight:500 }}>Session goal</div>
                  {metrics.slowDigraphs[0] && (
                    <div style={{ fontSize:14, lineHeight:1.8 }}>
                      Reduce <code style={{ fontFamily:"var(--font-mono)", fontWeight:700, fontSize:15, background:"var(--color-background-primary)", padding:"1px 6px", borderRadius:4 }}>{mode==="drill"?(drillChain?.[0]?.targetPairs?.[0]??metrics.slowDigraphs[0].pair):metrics.slowDigraphs[0].pair}</code>{" "}
                      to <span style={{ fontFamily:"var(--font-mono)", color:"#1D9E75", fontWeight:600 }}>{metrics.targetLatency}ms</span>
                    </div>
                  )}
                </div>
                <div style={{ padding:"1rem 1.25rem", background:"var(--color-background-secondary)", borderRadius:"var(--border-radius-md)", borderTop:"3px solid #5DCAA5" }}>
                  <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:8, fontWeight:500 }}>
                    {mode === "drill" ? "Chain progress" : `Estimated time to ${targetWpm} WPM`}
                  </div>
                  {mode === "drill" && drillChain && drillChain.length >= 2
                    ? (<>
                      <div style={{ fontSize:22, fontWeight:500, fontFamily:"var(--font-mono)" }}>+{drillChain[drillChain.length-1].wpm - drillChain[0].wpm} WPM</div>
                      <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:4 }}>across {drillChain.length-1} drill{drillChain.length>2?"s":""}</div>
                    </>)
                    : (<>
                      <div style={{ fontSize:32, fontWeight:500, fontFamily:"var(--font-mono)", lineHeight:1 }}>~{Math.max(5, Math.round(Math.abs(metrics.wpmGap)/3))}</div>
                      <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginTop:4 }}>days of focused practice</div>
                    </>)}
                </div>
              </div>

              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                <button
                  onClick={() => startDrillSession(metrics, mode==="drill" ? drillChain : null)}
                  style={{ fontSize:14, padding:"11px 28px", background:"#7F77DD", color:"#fff", border:"none", borderRadius:"var(--border-radius-md)", cursor:"pointer", fontWeight:500 }}
                >
                  {mode === "drill" ? `Run Drill #${drillNumRef.current + 1}` : "Start drill session"}
                </button>
                {mode === "drill" && (
                  <button onClick={nextDiagnostic} style={{ fontSize:14, padding:"11px 20px" }}>End chain / new diagnostic</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* HISTORY */}
      {view === "history" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
            <h3 style={{ fontSize:16, fontWeight:500, margin:0 }}>Session history</h3>
            <button onClick={() => setView(metrics?"results":"test")} style={{ fontSize:13, padding:"6px 14px" }}>Back</button>
          </div>
          {history.length === 0
            ? <p style={{ color:"var(--color-text-secondary)", fontSize:14 }}>Complete a typing test to see history.</p>
            : (<>
              {history.length > 1 && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10, marginBottom:"1.5rem" }}>
                  <StatCard label="BEST WPM"  value={Math.max(...history.map(h=>h.wpm))} color="#1D9E75" mono />
                  <StatCard label="AVG WPM"   value={Math.round(history.reduce((a,b)=>a+b.wpm,0)/history.length)} mono />
                  <StatCard label="BEST ACC"  value={`${Math.max(...history.map(h=>h.accuracy))}%`} color="#5DCAA5" mono />
                  <StatCard label="SESSIONS"  value={history.length} mono />
                </div>
              )}

              {history.map((h, i) => (
                <div key={h.id} style={{ padding:"12px 0", borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                    {/* Rank */}
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)", minWidth:28, textAlign:"right" }}>#{history.length-i}</div>
                    {/* Time */}
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)", minWidth:50 }}>{h.date}</div>
                    {/* WPM */}
                    <div style={{ fontFamily:"var(--font-mono)", minWidth:72 }}>
                      <span style={{ fontSize:18, fontWeight:500 }}>{h.wpm}</span>
                      <span style={{ fontSize:11, color:"var(--color-text-secondary)", marginLeft:3 }}>WPM</span>
                    </div>
                    {/* Accuracy */}
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:15, fontWeight:500, minWidth:48 }}>{h.accuracy}%</div>
                    {/* Mode badge */}
                    <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20,
                      background:h.mode==="drill"?"#FAEEDA":"#EEEDFE",
                      color:h.mode==="drill"?"#BA7517":"#534AB7" }}>
                      {h.mode === "drill" ? `DRILL #${h.drillNum}` : "DIAG"}
                    </span>
                    {/* Worst digraph or target pairs */}
                    {h.mode === "drill" && h.targetPairs?.length > 0 ? (
                      <div style={{ display:"flex", gap:4, alignItems:"center", flexWrap:"wrap" }}>
                        <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>targeting:</span>
                        {h.targetPairs.slice(0,4).map(p => (
                          <code key={p} style={{ fontFamily:"var(--font-mono)", fontWeight:700, fontSize:12, padding:"1px 5px", borderRadius:4, background:"var(--color-background-secondary)", color:"var(--color-text-primary)" }}>{p}</code>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                        <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>worst:</span>
                        <code style={{ fontFamily:"var(--font-mono)", fontWeight:700, fontSize:13 }}>{h.worstDigraph}</code>
                      </div>
                    )}
                    {/* Chain indicator */}
                    {h.mode === "drill" && h.chainId && (
                      <span style={{ fontSize:10, color:"var(--color-text-secondary)", marginLeft:"auto" }}>
                        chain {String(h.chainId).slice(-4)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </>)}
        </div>
      )}
    </div>
  );
}
