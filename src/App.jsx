import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";

// ─── CONSTANTS (defined once, never recreated) ─────────────────────────────

const FINGER_MAP = {
  q:0,a:0,z:0, w:1,s:1,x:1, e:2,d:2,c:2,
  r:3,f:3,v:3,t:3,g:3,b:3, y:4,h:4,n:4,u:4,j:4,m:4,
  i:5,k:5, o:6,l:6, p:7,"[":7,"]":7,";":7,"'":7,
};
const FINGER_NAMES = ["L. Pinky","L. Ring","L. Middle","L. Index","R. Index","R. Middle","R. Ring","R. Pinky"];
const FINGER_COLORS = ["#7F77DD","#5DCAA5","#378ADD","#D4537E","#EF9F27","#639922","#D85A30","#A32D2D"];
const QWERTY_ROWS = [
  ["q","w","e","r","t","y","u","i","o","p"],
  ["a","s","d","f","g","h","j","k","l",";"],
  ["z","x","c","v","b","n","m",",",".","/"],
];
const SAMPLE_TEXTS = [
  "the quick brown fox jumps over the lazy dog and then runs through the forest thinking about the journey ahead",
  "through the thought of thinking deeply we find that every word written contains the essence of communication between minds",
  "programming requires patience and practice to master the intricate patterns of logic that transform ideas into working systems",
  "the rhythm of typing flows naturally when fingers learn the geography of keys through repetition and focused deliberate practice",
  "great things never come from comfort zones so keep pushing your limits every single day with patience and determination",
];

// Large word bank keyed by digraph
const WORD_BANK = {
  th:["the","their","there","they","then","through","thought","think","things","this","that","these","those","though","other","whether","rather","with","both","within","without","path","math","teeth","truth","worth"],
  he:["the","they","then","here","where","these","whether","there","he","she","her","held","help","ahead","others","gather","whether","together","shelter"],
  er:["every","never","often","under","enter","order","over","whether","rather","create","greater","together","better","letter","after","water","later","cover","river","silver","paper","master"],
  ea:["great","treat","create","threat","breath","health","wealth","death","easy","read","each","reach","speak","break","clear","dream","learn","year","team","mean","seat","heat","beat","meat","feat","neat","peat"],
  re:["great","create","threat","breath","reach","every","rather","where","there","three","free","tree","agree","break","dream","green","real","read","rest","rent","rely","reef","reel","reed","reel"],
  in:["thinking","information","station","attention","mention","string","spring","ring","thing","within","finding","kind","mind","wind","blind","find","bind","hind","rind","lined","dined","fined","mined","vined"],
  ti:["attention","station","question","mention","action","patient","entire","notice","time","title","until","positive","active","native","ratio","nation","potion","motion","portion","option","lotion","notion"],
  io:["information","station","attention","mention","action","motion","position","vision","region","opinion","million","union","option","potion","lotion","notion","portion","emotion"],
  on:["information","station","attention","mention","action","long","strong","wrong","gone","done","once","none","stone","alone","phone","zone","bone","tone","cone","hone","lone","prone"],
  ng:["string","strong","spring","bring","ring","thing","king","sing","wing","thinking","feeling","learning","running","coming","going","having","being","seeing","doing","making","taking"],
  st:["string","strong","spring","street","station","start","stop","still","step","star","state","store","story","stay","style","study","stand","stone","storm","stock","steak","steam","steal","steel"],
  tr:["treat","create","street","threat","string","strong","spring","through","thought","travel","true","try","tree","train","trust","trouble","track","trade","trail","transfer","trick","trim","trip","trot"],
  pr:["practice","programming","prepared","problem","process","program","project","provide","produce","properly","present","pretty","press","price","print","private","prove","pride","prime","prize","probe","prose"],
  ou:["through","thought","about","house","found","could","would","should","count","sound","round","doubt","ground","bound","loud","cloud","proud","your","four","pour","hour","tour","sour","flour","court"],
  ow:["brown","know","how","now","show","slow","flow","grow","allow","follow","below","throw","power","town","down","crow","snow","blow","row","bow","cow","dow","how","low","mow","plow","sow","tow","vow","wow"],
  de:["deep","dead","dear","deal","decide","develop","deliver","depend","under","order","index","made","side","wide","mode","code","node","idea","model","modern","desk","dent","deft","deal","dean","debt"],
  al:["always","also","already","although","almost","along","allow","all","call","fall","hall","wall","small","shall","tall","real","deal","heal","meal","seal","feel","well","tell","bell","cell","fell","sell"],
  nt:["want","front","hunt","grant","plant","print","point","count","mount","paint","meant","event","rent","hint","bent","dent","tent","cent","went","sent","lent","vent","dent","pant","rant","cant","rant"],
  an:["and","can","man","than","plan","span","hand","land","sand","stand","brand","grand","change","range","chance","dance","grant","plant","slant","chant","rant","pant","cant","scan","ban","fan","pan","ran","tan","van"],
  en:["then","when","often","enter","seven","open","even","never","every","been","seen","keen","green","queen","pen","ten","hen","end","send","bend","tend","lend","spend","blend","trend","mend","fend","rend","wend"],
  le:["people","little","middle","simple","single","table","able","eagle","example","purple","while","smile","style","mile","file","pile","tile","role","hole","pole","sole","mole","tale","pale","sale","tale","male","bale"],
  or:["for","more","before","store","order","force","short","sport","sort","port","form","storm","morning","word","world","work","worn","born","corn","horn","torn","lorn","ford","cord","lord","word","cord"],
  it:["bit","sit","kit","hit","fit","wit","lit","pit","split","quite","write","white","kite","site","mite","bite","lite","smite","spite","kite","trite","mite","quite","write","sprite","ignite","invite","recite","unite"],
  un:["under","unless","until","upon","uncle","unique","united","unit","union","run","sun","fun","gun","bun","nun","pun","spun","stun","shun","dun","pun","run","nun","gun","fun","bun","sun","ton","won"],
  wo:["work","word","world","worry","would","won","wolf","woman","wood","worm","worn","worse","worst","worth","wound","wow","words","wrote","woke","wove","womb","wore","woke","work"],
  oo:["good","food","look","took","book","cook","hook","room","bloom","broom","doom","zoom","moon","noon","soon","spoon","tool","fool","pool","cool","wool","boot","hoot","loot","moot","root","soot","toot"],
  ee:["see","fee","bee","tree","free","three","agree","knee","flee","breed","creed","freed","greed","speed","seed","feed","need","deed","weed","reed","steel","wheel","feel","heel","keel","peel","reel","teel"],
};

// Build deterministic drill text from slow pairs (no Math.random — stable across renders)
function buildDrillText(slowPairs) {
  const seen = new Set();
  const pool = [];
  for (const pair of slowPairs.slice(0, 5)) {
    const p = pair.trim().toLowerCase();
    // Direct match first
    if (WORD_BANK[p]) {
      for (const w of WORD_BANK[p]) {
        if (!seen.has(w)) { seen.add(w); pool.push(w); }
      }
    }
    // Words containing the pair from any bank entry
    for (const words of Object.values(WORD_BANK)) {
      for (const w of words) {
        if (!seen.has(w) && w.includes(p)) { seen.add(w); pool.push(w); }
      }
    }
  }
  if (pool.length < 8) {
    for (const w of ["the","their","through","thought","there","then","great","treat","things","think"]) {
      if (!seen.has(w)) { seen.add(w); pool.push(w); }
    }
  }
  const words = pool.slice(0, 14);
  // Three passes: forward, interleaved, reversed — deterministic, no random
  const rev = [...words].reverse();
  const interleaved = words.map((w, i) => i % 2 === 0 ? w : rev[i]).filter(Boolean);
  return [...words, ...interleaved, ...rev].join(" ");
}

// ─── ANALYTICS ENGINE ──────────────────────────────────────────────────────

function computeMetrics(ksArray, text, duration, targetWpm) {
  const transitions = {};
  const fingerLats = Array(8).fill(null).map(() => []);
  const keyLats = {};
  const keyErrors = {};
  let errors = 0;

  for (let i = 1; i < ksArray.length; i++) {
    const prev = ksArray[i - 1];
    const curr = ksArray[i];
    const lat = curr.t - prev.t;
    if (lat > 0 && lat < 1500) {
      const fk = prev.k, tk = curr.k;
      if (/^[a-z]$/.test(fk) && /^[a-z]$/.test(tk)) {
        const pair = fk + tk;
        if (!transitions[pair]) transitions[pair] = [];
        transitions[pair].push(lat);
      }
      const fi = FINGER_MAP[tk];
      if (fi !== undefined) fingerLats[fi].push(lat);
      if (/^[a-z ]$/.test(tk)) {
        if (!keyLats[tk]) keyLats[tk] = [];
        keyLats[tk].push(lat);
      }
    }
    if (!curr.ok) {
      errors++;
      keyErrors[curr.k] = (keyErrors[curr.k] || 0) + 1;
    }
  }

  const digraphStats = {};
  for (const [pair, lats] of Object.entries(transitions)) {
    digraphStats[pair] = {
      avg: Math.round(lats.reduce((a, b) => a + b, 0) / lats.length),
      count: lats.length,
    };
  }

  const fingerStats = fingerLats.map(lats => {
    if (!lats.length) return { avg: 0, count: 0, score: 0 };
    const avg = lats.reduce((a, b) => a + b, 0) / lats.length;
    return { avg: Math.round(avg), count: lats.length, score: Math.max(0, Math.min(100, Math.round(100 - (avg - 60) * 0.8))) };
  });

  const keyHeatmap = {};
  for (const [k, lats] of Object.entries(keyLats)) {
    keyHeatmap[k] = {
      avg: Math.round(lats.reduce((a, b) => a + b, 0) / lats.length),
      count: lats.length, errors: keyErrors[k] || 0,
    };
  }

  const words = text.trim().split(/\s+/).length;
  const wpm = Math.round(words / Math.max(duration / 60000, 0.001));
  const totalKeys = ksArray.length;
  const accuracy = totalKeys > 0 ? Math.round(((totalKeys - errors) / totalKeys) * 100) : 100;
  const tLat = Math.round(60000 / (targetWpm * 5));

  const sortedDigraphs = Object.entries(digraphStats)
    .sort((a, b) => b[1].avg - a[1].avg).slice(0, 20);

  const slowDigraphs = sortedDigraphs.slice(0, 6).map(([pair, s]) => ({
    pair, avg: s.avg, excess: Math.max(0, s.avg - tLat), count: s.count,
  }));

  const worstFingers = fingerStats
    .map((s, i) => ({ name: FINGER_NAMES[i], ...s, idx: i }))
    .filter(f => f.count > 0).sort((a, b) => a.score - b.score).slice(0, 3);

  const sameFinger = Object.entries(digraphStats)
    .filter(([p]) => {
      const f1 = FINGER_MAP[p[0]], f2 = FINGER_MAP[p[1]];
      return f1 !== undefined && f2 !== undefined && f1 === f2 && p[0] !== p[1];
    }).sort((a, b) => b[1].avg - a[1].avg).slice(0, 8);

  return {
    wpm, accuracy, errors, totalKeys, digraphStats, sortedDigraphs,
    fingerStats, keyHeatmap, targetLatency: tLat,
    currentLatency: Math.round(duration / Math.max(totalKeys, 1)),
    wpmGap: targetWpm - wpm, slowDigraphs, worstFingers, sameFinger,
  };
}

// ─── TEXT DISPLAY: Canvas-based for zero React overhead ────────────────────
// Renders once on mount, then updates via imperative canvas draw — no re-renders

const TextDisplay = memo(({ text, typed, onComplete }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const textRef = useRef(text);
  textRef.current = text;

  // Draw function — called imperatively from parent via ref
  const draw = useCallback((typedStr) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W, H);
    const fontSize = 19;
    const lineH = fontSize * 1.9;
    ctx.font = `${fontSize}px ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace`;

    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const colors = {
      pending: isDark ? "#888" : "#aaa",
      correct: isDark ? "#1D9E75" : "#0F6E56",
      wrong:   isDark ? "#E24B4A" : "#A32D2D",
      wrongBg: isDark ? "rgba(162,45,45,0.22)" : "rgba(252,235,235,0.9)",
      cursorBg: isDark ? "rgba(127,119,221,0.22)" : "rgba(238,237,254,0.9)",
      cursorLine: "#7F77DD",
    };

    const chars = textRef.current.split("");
    const charW = ctx.measureText("m").width;
    const maxCharsPerLine = Math.floor((W - 32) / charW);
    const lines = [];
    let line = [];
    for (const ch of chars) {
      line.push(ch);
      if (line.length >= maxCharsPerLine || ch === "\n") { lines.push(line); line = []; }
    }
    if (line.length) lines.push(line);

    let globalIdx = 0;
    const padL = 28, padT = 24;

    for (let li = 0; li < lines.length; li++) {
      const row = lines[li];
      let x = padL;
      const y = padT + li * lineH;
      for (let ci = 0; ci < row.length; ci++) {
        const ch = row[ci];
        const typedCh = typedStr[globalIdx];
        const isCursor = globalIdx === typedStr.length;
        const isTyped = typedCh !== undefined;
        const isCorrect = isTyped && typedCh === ch;
        const isWrong = isTyped && typedCh !== ch;
        const cw = ch === " " ? charW : ctx.measureText(ch).width;

        if (isCursor) {
          ctx.fillStyle = colors.cursorBg;
          ctx.fillRect(x - 1, y - fontSize * 1.3, cw + 2, fontSize * 1.7);
          ctx.fillStyle = colors.cursorLine;
          ctx.fillRect(x - 1, y - fontSize * 1.3, 2, fontSize * 1.7);
        }
        if (isWrong) {
          ctx.fillStyle = colors.wrongBg;
          ctx.fillRect(x, y - fontSize * 1.3, cw + 1, fontSize * 1.7);
        }

        ctx.fillStyle = isCorrect ? colors.correct : isWrong ? colors.wrong : colors.pending;
        ctx.fillText(ch, x, y);
        x += cw;
        globalIdx++;
      }
    }
  }, []);

  // Expose draw to parent
  useEffect(() => {
    if (canvasRef.current) { canvasRef.current._draw = draw; }
  }, [draw]);

  // Initial draw
  useEffect(() => { draw(typed || ""); }, [text]);

  // Compute canvas height
  const lineCount = useMemo(() => {
    if (!text) return 3;
    const approxCharsPerLine = 52;
    return Math.max(3, Math.ceil(text.length / approxCharsPerLine));
  }, [text]);

  return (
    <div ref={containerRef} style={{
      position: "relative", borderRadius: "var(--border-radius-lg)",
      border: "0.5px solid var(--color-border-secondary)",
      background: "var(--color-background-primary)",
      marginBottom: "1.25rem", overflow: "hidden",
    }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: lineCount * 36 + 48 }}
      />
    </div>
  );
}, (prev, next) => prev.text === next.text);
// NOTE: We intentionally ignore `typed` prop changes in memo comparison
// — the parent calls canvas._draw() directly for zero-overhead updates

// ─── HEATMAP KEY ──────────────────────────────────────────────────────────

const HeatmapKey = memo(({ letter, data, targetLatency }) => {
  const [tip, setTip] = useState(false);
  const avg = data?.avg || 0;
  let bg = "var(--color-background-secondary)", fg = "var(--color-text-secondary)";
  if (avg > 0) {
    const r = avg / targetLatency;
    if (r <= 1)      { bg = "#1D9E75"; fg = "#fff"; }
    else if (r <= 1.5) { bg = "#EF9F27"; fg = "#fff"; }
    else             { bg = "#E24B4A"; fg = "#fff"; }
  }
  return (
    <div style={{ position: "relative" }}
      onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}>
      <div style={{
        width: 54, height: 54, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", borderRadius: 8,
        background: bg, color: fg, border: "1px solid rgba(0,0,0,0.1)",
        cursor: "default", userSelect: "none",
        transform: tip ? "scale(1.15)" : "scale(1)",
        transition: "transform 0.1s", position: "relative", zIndex: tip ? 3 : 1,
      }}>
        <span style={{ fontWeight: 700, fontSize: 17, lineHeight: 1 }}>{letter.toUpperCase()}</span>
        {avg > 0 && <span style={{ fontSize: 10, opacity: 0.9, marginTop: 2 }}>{avg}ms</span>}
      </div>
      {tip && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 10px)", left: "50%",
          transform: "translateX(-50%)",
          background: "#111827", color: "#f9fafb",
          padding: "10px 14px", borderRadius: 10,
          fontSize: 12, whiteSpace: "nowrap", zIndex: 999,
          pointerEvents: "none", lineHeight: 1.8,
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{letter.toUpperCase()} key</div>
          {avg > 0 ? <>
            <div>Avg latency: <b>{avg}ms</b></div>
            <div>Target: <b>{targetLatency}ms</b></div>
            <div>Samples: <b>{data.count}</b>{data.errors > 0 ? ` · Errors: ${data.errors}` : ""}</div>
            <div style={{ color: avg > targetLatency ? "#FCA5A5" : "#6EE7B7", marginTop: 4, fontWeight: 600 }}>
              {avg > targetLatency ? `${avg - targetLatency}ms over target` : `${targetLatency - avg}ms under target`}
            </div>
          </> : <div style={{ color: "#9CA3AF" }}>Not typed in this session</div>}
        </div>
      )}
    </div>
  );
});

// ─── STAT CARD ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, mono }) {
  return (
    <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-lg)", padding: "14px 18px", borderTop: `3px solid ${color || "transparent"}` }}>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4, fontWeight: 500, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 500, color: color || "var(--color-text-primary)", fontFamily: mono ? "var(--font-mono)" : undefined, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── DRILL PROGRESS PANEL ─────────────────────────────────────────────────

function DrillProgress({ baseline, current }) {
  if (!baseline || !current) return null;
  const pairs = baseline.slowDigraphs.map(d => d.pair);
  const improvements = pairs.map(pair => {
    const before = baseline.digraphStats[pair]?.avg;
    const after  = current.digraphStats[pair]?.avg;
    if (!before || !after) return null;
    const delta = before - after;
    const pct   = Math.abs(Math.round((delta / before) * 100));
    return { pair, before, after, delta, pct, improved: delta > 0 };
  }).filter(Boolean);

  const wpmDelta = current.wpm - baseline.wpm;
  const accDelta = current.accuracy - baseline.accuracy;

  return (
    <div style={{ padding: "1.25rem 1.5rem", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-lg)", borderLeft: "3px solid #7F77DD", marginBottom: "1.5rem" }}>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: "1rem", color: "var(--color-text-primary)" }}>
        Drill results vs diagnostic baseline
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10, marginBottom: "1.25rem" }}>
        {[
          { label: "WPM change", val: wpmDelta, fmt: v => `${v >= 0 ? "+" : ""}${v}`, col: wpmDelta >= 0 ? "#1D9E75" : "#E24B4A" },
          { label: "Accuracy", val: accDelta, fmt: v => `${v >= 0 ? "+" : ""}${v}%`, col: accDelta >= 0 ? "#1D9E75" : "#E24B4A" },
          { label: "Baseline WPM", val: baseline.wpm, fmt: v => v, col: undefined },
          { label: "Drill WPM", val: current.wpm, fmt: v => v, col: "#7F77DD" },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, fontFamily: "var(--font-mono)", color: s.col || "var(--color-text-primary)" }}>{s.fmt(s.val)}</div>
          </div>
        ))}
      </div>

      {improvements.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8, fontWeight: 500 }}>Bottleneck digraph improvements</div>
          {improvements.map(({ pair, before, after, delta, pct, improved }) => (
            <div key={pair} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <code style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 700, width: 36, letterSpacing: 3 }}>{pair}</code>
              <div style={{ flex: 1, position: "relative", height: 16, background: "var(--color-background-primary)", borderRadius: 8, overflow: "hidden" }}>
                {/* Baseline bar */}
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(100,(before/400)*100)}%`, background: "#E24B4A44", borderRadius: 8 }} />
                {/* Current bar */}
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(100,(after/400)*100)}%`, background: improved ? "#1D9E75" : "#E24B4A", borderRadius: 8, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ minWidth: 100, textAlign: "right", fontSize: 12, fontFamily: "var(--font-mono)" }}>
                <span style={{ color: "var(--color-text-secondary)" }}>{before}ms</span>
                <span style={{ color: "var(--color-text-secondary)", margin: "0 4px" }}>→</span>
                <span style={{ color: improved ? "#1D9E75" : "#E24B4A", fontWeight: 700 }}>{after}ms</span>
              </div>
              <div style={{ minWidth: 48, fontSize: 12, fontWeight: 600, color: improved ? "#1D9E75" : "#E24B4A", textAlign: "right" }}>
                {improved ? `↓${pct}%` : `↑${pct}%`}
              </div>
            </div>
          ))}
        </>
      )}
      {improvements.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>
          Not enough overlap between drill and diagnostic digraphs for comparison. Try another drill.
        </p>
      )}
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────

function TabBtn({ id, label, active, onClick }) {
  return (
    <button onClick={() => onClick(id)} style={{
      padding: "10px 16px", fontSize: 13, border: "none",
      background: active ? "var(--color-background-primary)" : "transparent",
      color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
      borderRadius: "var(--border-radius-md) var(--border-radius-md) 0 0",
      fontWeight: active ? 500 : 400, cursor: "pointer",
      borderBottom: active ? "2px solid #7F77DD" : "2px solid transparent",
    }}>{label}</button>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────

export default function TypeForge() {
  const [targetWpm, setTargetWpm] = useState(120);

  // mode: "diagnostic" | "drill"
  const modeRef     = useRef("diagnostic");
  const drillTextRef = useRef("");
  const [mode, setMode] = useState("diagnostic"); // only for rendering

  const [textIdx, setTextIdx] = useState(0);

  // All hot-path typing state lives in refs — zero re-render cost on every keypress
  const typedRef      = useRef("");
  const ksRef         = useRef([]);         // [{k, t, ok}]
  const startTimeRef  = useRef(null);
  const isRunningRef  = useRef(false);

  // These useState hooks are ONLY for driving re-renders at the right moments
  const [typedDisplay, setTypedDisplay] = useState(""); // mirror of typedRef for TextDisplay
  const [typedLen,  setTypedLen]  = useState(0);        // cheap progress bar
  const [liveWpm,   setLiveWpm]   = useState(0);        // per-keystroke update
  const [running,   setRunning]   = useState(false);    // for stat card display

  const [metrics,     setMetrics]     = useState(null);
  const [drillBaseline, setDrillBaseline] = useState(null);
  const [history,     setHistory]     = useState([]);
  const [view,        setView]        = useState("test");
  const [activeTab,   setActiveTab]   = useState("overview");

  const inputRef  = useRef(null);
  const canvasRef = useRef(null); // to call _draw directly

  const currentText = () =>
    modeRef.current === "drill" ? drillTextRef.current : SAMPLE_TEXTS[textIdx];

  // ── Full reset ──────────────────────────────────────────────────────────
  const startTest = useCallback((opts = {}) => {
    const { newMode, drillText, nextIdx } = opts;
    typedRef.current = "";
    ksRef.current    = [];
    startTimeRef.current  = null;
    isRunningRef.current  = false;
    if (newMode)    { modeRef.current = newMode; setMode(newMode); }
    if (drillText !== undefined) drillTextRef.current = drillText;
    if (nextIdx !== undefined)   setTextIdx(nextIdx);
    setTypedDisplay("");
    setTypedLen(0);
    setLiveWpm(0);
    setRunning(false);
    setMetrics(null);
    setView("test");
    setActiveTab("overview");
    // Draw blank canvas for new text
    setTimeout(() => {
      const cvs = canvasRef.current;
      if (cvs?._draw) cvs._draw("");
      inputRef.current?.focus();
    }, 30);
  }, []);

  const startDrillSession = useCallback((baseline) => {
    const dt = buildDrillText(baseline.slowDigraphs.map(d => d.pair));
    setDrillBaseline(baseline);
    startTest({ newMode: "drill", drillText: dt });
  }, [startTest]);

  const nextDiagnostic = useCallback(() => {
    startTest({
      newMode: "diagnostic",
      drillText: "",
      nextIdx: (textIdx + 1) % SAMPLE_TEXTS.length,
    });
  }, [startTest, textIdx]);

  // ── Paste & Tab block ──────────────────────────────────────────────────
  const handlePaste = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Tab") { e.preventDefault(); return; }
  }, []);

  // ── HOT PATH: runs on every keypress ───────────────────────────────────
  const handleChange = useCallback((e) => {
    const val    = e.target.value;
    const text   = currentText();
    const prev   = typedRef.current;

    // Block paste: reject multi-character jumps
    if (val.length > prev.length + 1) {
      e.target.value = prev;
      return;
    }
    if (val.length > text.length) return;

    const now = performance.now();

    if (!isRunningRef.current && val.length > 0) {
      isRunningRef.current = true;
      startTimeRef.current = now;
      setRunning(true);
    }

    // Only record additions, not backspace
    if (val.length > prev.length) {
      const ch = val[val.length - 1];
      const pos = val.length - 1;
      const ok = pos < text.length && ch === text[pos];
      ksRef.current.push({ k: ch, t: now, ok });

      // Live WPM: calculated inline, no interval
      if (startTimeRef.current) {
        const elapsed = (now - startTimeRef.current) / 60000;
        const spaces  = val.split(" ").length - 1;
        const wordCt  = spaces + (val[val.length - 1] === " " ? 0 : 1);
        const wpm     = Math.min(300, Math.round(wordCt / Math.max(elapsed, 0.0001)));
        setLiveWpm(wpm); // cheap int, triggers only StatCard re-render
      }
    }

    typedRef.current = val;

    // Update canvas directly — bypasses React reconciler entirely
    const cvs = canvasRef.current;
    if (cvs?._draw) cvs._draw(val);

    // Drive progress bar (cheap int state)
    setTypedLen(val.length);

    // Mirror for textarea controlled value (needed for paste-block to work)
    setTypedDisplay(val);

    // Completion
    if (val.length >= text.length) {
      isRunningRef.current = false;
      const dur = now - (startTimeRef.current || now);
      const m   = computeMetrics(ksRef.current, text, dur, targetWpm);
      setMetrics(m);
      setHistory(prev => [{
        date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        wpm: m.wpm, accuracy: m.accuracy,
        worstDigraph: m.slowDigraphs[0]?.pair || "—",
        mode: modeRef.current, id: Date.now(),
      }, ...prev.slice(0, 19)]);
      setTimeout(() => { setView("results"); setActiveTab("overview"); }, 150);
    }
  }, [targetWpm]);

  const text = currentText();
  const progress = text.length > 0 ? Math.min(1, typedLen / text.length) : 0;
  const expLat   = Math.round(60000 / (targetWpm * 5));

  // ─── RENDER ─────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "var(--font-sans)", maxWidth: 870, margin: "0 auto", padding: "0 0 4rem" }}>
      <h2 className="sr-only">TypeForge — Typing Performance Analytics</h2>

      {/* ══ HEADER ══ */}
      <div style={{ padding: "1.5rem 0 1.25rem", borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: "1.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 24, fontWeight: 500, letterSpacing: -0.5 }}>TypeForge</span>
            <span style={{
              fontSize: 11, fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: 20, fontWeight: 500,
              color: mode === "drill" ? "#EF9F27" : "#7F77DD",
              background: mode === "drill" ? "#FAEEDA" : "#EEEDFE",
            }}>{mode === "drill" ? "DRILL MODE" : "DIAGNOSTIC"}</span>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
            {mode === "drill" ? "Targeting your weak digraphs — focus on consistency" : "Diagnose every bottleneck. Train what actually matters."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)" }}>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Target</span>
            <select value={targetWpm} onChange={e => setTargetWpm(Number(e.target.value))} style={{ fontSize: 14, border: "none", background: "transparent", color: "var(--color-text-primary)", fontWeight: 500, cursor: "pointer" }}>
              {[60, 80, 100, 120, 140, 160, 180, 200].map(v => <option key={v} value={v}>{v} WPM</option>)}
            </select>
          </div>
          {mode === "drill" && (
            <button onClick={nextDiagnostic} style={{ fontSize: 13, padding: "7px 14px" }}>← Back to diagnostic</button>
          )}
          {view !== "test" && (
            <button onClick={nextDiagnostic} style={{ fontSize: 13, padding: "7px 14px" }}>New test ↺</button>
          )}
          {view === "test" && mode === "diagnostic" && (
            <button onClick={nextDiagnostic} style={{ fontSize: 13, padding: "7px 14px" }}>New text ↺</button>
          )}
          {history.length > 0 && view !== "history" && (
            <button onClick={() => setView("history")} style={{ fontSize: 13, padding: "7px 14px" }}>History ({history.length})</button>
          )}
        </div>
      </div>

      {/* ══ TEST VIEW ══ */}
      {view === "test" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: "1.5rem" }}>
            <StatCard label="LIVE WPM" value={running ? liveWpm : "—"} mono />
            <StatCard label="TARGET" value={targetWpm} sub="WPM goal" color="#7F77DD" mono />
            <StatCard
              label="GAP"
              value={running ? Math.abs(targetWpm - liveWpm) : "—"}
              sub={running ? (liveWpm < targetWpm ? "WPM behind" : "WPM ahead!") : "start typing"}
              color={running ? (liveWpm < targetWpm ? "#E24B4A" : "#1D9E75") : undefined}
              mono
            />
            <StatCard label="KEY TARGET" value={`${expLat}ms`} sub="per keystroke" mono />
          </div>

          <div style={{ height: 4, background: "var(--color-background-secondary)", borderRadius: 2, marginBottom: "1.25rem", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress * 100}%`, background: "linear-gradient(90deg,#7F77DD,#5DCAA5)", borderRadius: 2 }} />
          </div>

          {/* Canvas-based text display — ref forwarded for imperative draw calls */}
          <TextDisplay
            ref={canvasRef}
            text={text}
            typed={typedDisplay}
          />

          <textarea
            ref={inputRef}
            value={typedDisplay}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            autoFocus
            placeholder="Click here and start typing…"
            style={{
              width: "100%", boxSizing: "border-box",
              fontFamily: "var(--font-mono)", fontSize: 16,
              padding: "14px 18px", lineHeight: 1.6,
              borderRadius: "var(--border-radius-md)",
              resize: "none", height: 80,
              background: "var(--color-background-primary)",
              color: "var(--color-text-primary)",
            }}
          />
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 8, margin: "8px 0 0" }}>
            Paste blocked. Keystroke timing captured on every keypress.
            {mode === "drill" && <span style={{ color: "#EF9F27", marginLeft: 8 }}>Drill text targets your personal bottlenecks.</span>}
          </p>
        </div>
      )}

      {/* ══ RESULTS VIEW ══ */}
      {view === "results" && metrics && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: "1.5rem" }}>
            <StatCard label="WPM" value={metrics.wpm} sub={mode === "drill" ? "drill session" : "diagnostic"} color="#7F77DD" mono />
            <StatCard label="ACCURACY" value={`${metrics.accuracy}%`} sub={`${metrics.errors} error${metrics.errors !== 1 ? "s" : ""}`} color="#5DCAA5" mono />
            <StatCard label="TARGET" value={targetWpm} sub="WPM goal" mono />
            <StatCard label="GAP" value={Math.abs(metrics.wpmGap)} sub={metrics.wpmGap > 0 ? "WPM behind" : "Target reached!"} color={metrics.wpmGap > 0 ? "#E24B4A" : "#1D9E75"} mono />
            <StatCard label="AVG LATENCY" value={`${metrics.currentLatency}ms`} sub={`target ${metrics.targetLatency}ms`} mono />
          </div>

          {mode === "drill" && drillBaseline && (
            <DrillProgress baseline={drillBaseline} current={metrics} />
          )}

          <div style={{ display: "flex", gap: 2, overflowX: "auto", borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: "1.5rem" }}>
            {[
              { id: "overview", label: "Overview" },
              { id: "digraphs", label: "Digraph analysis" },
              { id: "heatmap",  label: "Keyboard heatmap" },
              { id: "fingers",  label: "Finger analytics" },
              { id: "drills",   label: "Personalized drills" },
            ].map(t => <TabBtn key={t.id} {...t} active={activeTab === t.id} onClick={setActiveTab} />)}
          </div>

          {/* ─ OVERVIEW ─ */}
          {activeTab === "overview" && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 1rem" }}>Slowest digraph transitions</h3>
              {metrics.slowDigraphs.length === 0
                ? <p style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>Not enough data — type a longer passage.</p>
                : metrics.slowDigraphs.map((d, i) => {
                  const col = d.avg > metrics.targetLatency * 1.5 ? "#E24B4A" : d.avg > metrics.targetLatency ? "#EF9F27" : "#1D9E75";
                  const baseline = drillBaseline?.digraphStats[d.pair]?.avg;
                  return (
                    <div key={d.pair} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--color-text-secondary)", flexShrink: 0 }}>{i + 1}</span>
                      <code style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, width: 44, letterSpacing: 4 }}>{d.pair}</code>
                      <div style={{ flex: 1, height: 10, background: "var(--color-background-secondary)", borderRadius: 5, position: "relative", overflow: "hidden" }}>
                        {baseline && (
                          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(100,(baseline/500)*100)}%`, background: "#E24B4A33", borderRadius: 5 }} />
                        )}
                        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(100,(d.avg/500)*100)}%`, background: col, borderRadius: 5 }} />
                      </div>
                      <div style={{ minWidth: 100, textAlign: "right" }}>
                        <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--font-mono)", color: col }}>{d.avg}ms</div>
                        {baseline && (
                          <div style={{ fontSize: 11, color: d.avg < baseline ? "#1D9E75" : "#E24B4A" }}>
                            {d.avg < baseline ? `↓ ${baseline - d.avg}ms improved` : `↑ ${d.avg - baseline}ms worse`}
                          </div>
                        )}
                        {!baseline && <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>+{d.excess}ms over target</div>}
                      </div>
                    </div>
                  );
                })
              }

              <h3 style={{ fontSize: 16, fontWeight: 500, margin: "1.75rem 0 1rem" }}>Weakest fingers</h3>
              {metrics.worstFingers.map(f => (
                <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 80, fontSize: 12, color: "var(--color-text-secondary)", textAlign: "right", flexShrink: 0 }}>{f.name}</div>
                  <div style={{ flex: 1, height: 16, background: "var(--color-background-secondary)", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ width: `${f.score}%`, height: "100%", background: FINGER_COLORS[f.idx], borderRadius: 8 }} />
                  </div>
                  <div style={{ width: 56, fontSize: 13, fontWeight: 500, fontFamily: "var(--font-mono)", textAlign: "right" }}>{f.score}/100</div>
                  <div style={{ width: 48, fontSize: 12, color: "var(--color-text-secondary)" }}>{f.avg}ms</div>
                </div>
              ))}

              <div style={{ marginTop: "1.75rem", padding: "1.25rem 1.5rem", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-lg)", borderLeft: "3px solid #7F77DD" }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: "0.75rem" }}>Fastest path to {targetWpm} WPM</div>
                <ol style={{ margin: 0, paddingLeft: "1.25rem", fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 2.2 }}>
                  {metrics.slowDigraphs.slice(0, 3).map(d => (
                    <li key={d.pair}>
                      Train <code style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: "var(--color-text-primary)", background: "var(--color-background-primary)", padding: "1px 6px", borderRadius: 4 }}>{d.pair}</code>
                      {" "}→ reduce <span style={{ fontFamily: "var(--font-mono)", color: "#E24B4A", fontWeight: 600 }}>{d.avg}ms</span> → <span style={{ fontFamily: "var(--font-mono)", color: "#1D9E75", fontWeight: 600 }}>{metrics.targetLatency}ms</span>
                    </li>
                  ))}
                  {metrics.worstFingers[0] && <li>Improve {metrics.worstFingers[0].name} (score: {metrics.worstFingers[0].score}/100)</li>}
                </ol>
              </div>
            </div>
          )}

          {/* ─ DIGRAPHS ─ */}
          {activeTab === "digraphs" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
                <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>All digraph latencies</h3>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Target: {metrics.targetLatency}ms</span>
              </div>
              <div style={{ display: "flex", gap: 16, marginBottom: 14, fontSize: 12, color: "var(--color-text-secondary)" }}>
                {[{ c: "#1D9E75", l: `At target (≤${metrics.targetLatency}ms)` }, { c: "#EF9F27", l: "Slightly slow" }, { c: "#E24B4A", l: "Bottleneck" }].map(x => (
                  <span key={x.c} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: x.c, display: "inline-block" }} />{x.l}
                  </span>
                ))}
              </div>
              {metrics.sortedDigraphs.slice(0, 18).map(([pair, s], i) => {
                const col = s.avg > metrics.targetLatency * 1.5 ? "#E24B4A" : s.avg > metrics.targetLatency ? "#EF9F27" : "#1D9E75";
                const isBottleneck = metrics.slowDigraphs.some(d => d.pair === pair);
                return (
                  <div key={pair} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "0.5px solid var(--color-border-tertiary)", background: isBottleneck ? "var(--color-background-secondary)" : undefined, borderRadius: isBottleneck ? 4 : undefined, paddingLeft: isBottleneck ? 8 : undefined }}>
                    <span style={{ width: 20, fontSize: 11, color: "var(--color-text-secondary)", textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
                    <code style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, width: 40, letterSpacing: 3 }}>{pair}</code>
                    <div style={{ flex: 1, height: 8, background: "var(--color-background-secondary)", borderRadius: 4 }}>
                      <div style={{ height: "100%", borderRadius: 4, width: `${Math.min(100,(s.avg/400)*100)}%`, background: col }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500, fontFamily: "var(--font-mono)", minWidth: 56, textAlign: "right", color: col }}>{s.avg}ms</span>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)", minWidth: 52 }}>{s.count}×</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─ HEATMAP ─ */}
          {activeTab === "heatmap" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Keyboard latency heatmap</h3>
                <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {[{ c: "#1D9E75", l: "Fast" }, { c: "#EF9F27", l: "Moderate" }, { c: "#E24B4A", l: "Slow" }].map(x => (
                    <span key={x.c} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: x.c, display: "inline-block" }} />{x.l}
                    </span>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "1.25rem" }}>
                Hover any key for full stats. Target: <b>{metrics.targetLatency}ms</b> per keystroke.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                {QWERTY_ROWS.map((row, ri) => (
                  <div key={ri} style={{ display: "flex", gap: 5, paddingLeft: ri === 1 ? 30 : ri === 2 ? 60 : 0 }}>
                    {row.map(k => <HeatmapKey key={k} letter={k} data={metrics.keyHeatmap[k]} targetLatency={metrics.targetLatency} />)}
                  </div>
                ))}
                <div style={{ paddingLeft: 148 }}>
                  <div style={{
                    width: 234, height: 54, display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontWeight: 500, fontSize: 13,
                    background: metrics.keyHeatmap[" "] ? "#1D9E75" : "var(--color-background-secondary)",
                    color: metrics.keyHeatmap[" "] ? "#fff" : "var(--color-text-secondary)",
                  }}>
                    {metrics.keyHeatmap[" "] ? `space · ${metrics.keyHeatmap[" "].avg}ms` : "space"}
                  </div>
                </div>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 500, margin: "1.75rem 0 0.75rem" }}>Slowest individual keys</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8 }}>
                {Object.entries(metrics.keyHeatmap).filter(([k]) => /^[a-z]$/.test(k))
                  .sort((a, b) => b[1].avg - a[1].avg).slice(0, 8)
                  .map(([k, d]) => {
                    const col = d.avg > metrics.targetLatency * 1.5 ? "#E24B4A" : d.avg > metrics.targetLatency ? "#EF9F27" : "#1D9E75";
                    return (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", borderLeft: `3px solid ${col}` }}>
                        <code style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, width: 20 }}>{k}</code>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: col, fontFamily: "var(--font-mono)" }}>{d.avg}ms</div>
                          <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{d.count} samples</div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ─ FINGERS ─ */}
          {activeTab === "fingers" && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 1.25rem" }}>Finger efficiency scores</h3>
              {metrics.fingerStats.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 80, fontSize: 12, color: "var(--color-text-secondary)", textAlign: "right", flexShrink: 0 }}>{FINGER_NAMES[i]}</div>
                  <div style={{ flex: 1, height: 20, background: "var(--color-background-secondary)", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ width: `${f.score}%`, height: "100%", background: FINGER_COLORS[i], borderRadius: 10 }} />
                  </div>
                  <div style={{ width: 56, fontSize: 13, fontWeight: 500, fontFamily: "var(--font-mono)", textAlign: "right" }}>{f.count > 0 ? `${f.score}/100` : "—"}</div>
                  <div style={{ width: 56, fontSize: 12, color: "var(--color-text-secondary)" }}>{f.count > 0 ? `${f.avg}ms` : "no data"}</div>
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10, marginTop: "1.5rem" }}>
                {metrics.fingerStats.map((f, i) => f.count > 0 && (
                  <div key={i} style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "14px 16px", borderTop: `3px solid ${FINGER_COLORS[i]}` }}>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>{FINGER_NAMES[i]}</div>
                    <div style={{ fontSize: 22, fontWeight: 500, fontFamily: "var(--font-mono)" }}>{f.score}<span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>/100</span></div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{f.avg}ms avg · {f.count} keys</div>
                  </div>
                ))}
              </div>
              {metrics.sameFinger.length > 0 && <>
                <h3 style={{ fontSize: 15, fontWeight: 500, margin: "1.75rem 0 0.5rem" }}>Same-finger bigrams</h3>
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 1rem", lineHeight: 1.6 }}>One finger typing twice in a row — a key speed bottleneck.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {metrics.sameFinger.map(([pair, s]) => (
                    <div key={pair} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)" }}>
                      <code style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700 }}>{pair}</code>
                      <span style={{ fontSize: 12, color: "#EF9F27", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{s.avg}ms</span>
                    </div>
                  ))}
                </div>
              </>}
            </div>
          )}

          {/* ─ DRILLS ─ */}
          {activeTab === "drills" && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 0.5rem" }}>
                {mode === "drill" ? "Run another drill" : "Personalized drill"}
              </h3>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 1.25rem", lineHeight: 1.6 }}>
                {mode === "drill"
                  ? "Drill session complete. Run it again to consolidate muscle memory, or return to diagnostic."
                  : <>Targets your slowest digraphs:{" "}
                    {metrics.slowDigraphs.slice(0, 4).map((d, i) => (
                      <span key={d.pair}>
                        {i > 0 && ", "}
                        <code style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: "var(--color-text-primary)", background: "var(--color-background-secondary)", padding: "1px 6px", borderRadius: 4 }}>{d.pair}</code>
                        <span style={{ fontSize: 11, color: "#E24B4A", marginLeft: 2 }}>({d.avg}ms)</span>
                      </span>
                    ))}</>
                }
              </p>

              {/* Focus digraph cards */}
              {mode !== "drill" && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: "1.25rem" }}>
                  {metrics.slowDigraphs.slice(0, 5).map(d => {
                    const col = d.avg > metrics.targetLatency * 1.5 ? "#E24B4A" : d.avg > metrics.targetLatency ? "#EF9F27" : "#1D9E75";
                    return (
                      <div key={d.pair} style={{ textAlign: "center", padding: "12px 18px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", borderTop: `3px solid ${col}`, minWidth: 72 }}>
                        <code style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, letterSpacing: 5, display: "block", color: "var(--color-text-primary)" }}>{d.pair}</code>
                        <div style={{ fontSize: 12, color: col, fontFamily: "var(--font-mono)", fontWeight: 600, marginTop: 4 }}>{d.avg}ms</div>
                        <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 2 }}>target {metrics.targetLatency}ms</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Drill text preview */}
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, lineHeight: 2, padding: "1.25rem 1.5rem", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-lg)", marginBottom: "1.5rem", color: "var(--color-text-primary)", wordBreak: "break-word" }}>
                <div style={{ fontSize: 11, marginBottom: 6, color: "var(--color-text-secondary)", fontFamily: "var(--font-sans)" }}>Drill text preview (words containing your bottleneck digraphs):</div>
                {buildDrillText(metrics.slowDigraphs.map(d => d.pair)).slice(0, 140)}…
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: "1.5rem" }}>
                <div style={{ padding: "1rem 1.25rem", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", borderTop: "3px solid #EF9F27" }}>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8, fontWeight: 500 }}>Session goal</div>
                  {metrics.slowDigraphs[0] && (
                    <div style={{ fontSize: 14, lineHeight: 1.8 }}>
                      Reduce <code style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 15, background: "var(--color-background-primary)", padding: "1px 6px", borderRadius: 4 }}>{metrics.slowDigraphs[0].pair}</code>{" "}
                      from <span style={{ fontFamily: "var(--font-mono)", color: "#E24B4A", fontWeight: 600 }}>{metrics.slowDigraphs[0].avg}ms</span>
                      {" "}→ <span style={{ fontFamily: "var(--font-mono)", color: "#1D9E75", fontWeight: 600 }}>{metrics.targetLatency}ms</span>
                    </div>
                  )}
                </div>
                <div style={{ padding: "1rem 1.25rem", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", borderTop: "3px solid #5DCAA5" }}>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8, fontWeight: 500 }}>Estimated time to {targetWpm} WPM</div>
                  <div style={{ fontSize: 32, fontWeight: 500, fontFamily: "var(--font-mono)", lineHeight: 1 }}>~{Math.max(5, Math.round(Math.abs(metrics.wpmGap) / 3))}</div>
                  <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 4 }}>days of focused practice</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => startDrillSession(metrics)}
                  style={{ fontSize: 14, padding: "11px 28px", background: "#7F77DD", color: "#fff", border: "none", borderRadius: "var(--border-radius-md)", cursor: "pointer", fontWeight: 500 }}
                >
                  Start drill session →
                </button>
                {mode === "drill" && (
                  <button onClick={nextDiagnostic} style={{ fontSize: 14, padding: "11px 20px" }}>
                    Back to diagnostic
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ HISTORY ══ */}
      {view === "history" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Session history</h3>
            <button onClick={() => setView(metrics ? "results" : "test")} style={{ fontSize: 13, padding: "6px 14px" }}>← Back</button>
          </div>
          {history.length === 0
            ? <p style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>Complete a typing test to see your history.</p>
            : <>
              {history.length > 1 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: "1.5rem" }}>
                  <StatCard label="BEST WPM" value={Math.max(...history.map(h => h.wpm))} color="#1D9E75" mono />
                  <StatCard label="AVG WPM" value={Math.round(history.reduce((a, b) => a + b.wpm, 0) / history.length)} mono />
                  <StatCard label="BEST ACC" value={`${Math.max(...history.map(h => h.accuracy))}%`} color="#5DCAA5" mono />
                  <StatCard label="SESSIONS" value={history.length} mono />
                </div>
              )}
              {history.map((h, i) => (
                <div key={h.id} style={{ display: "grid", gridTemplateColumns: "28px 1fr 90px 80px 80px 60px", gap: 12, padding: "12px 0", borderBottom: "0.5px solid var(--color-border-tertiary)", alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", textAlign: "right" }}>#{history.length - i}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{h.date}</div>
                  <div style={{ fontFamily: "var(--font-mono)" }}><span style={{ fontSize: 18, fontWeight: 500 }}>{h.wpm}</span> <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>WPM</span></div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 500 }}>{h.accuracy}%</div>
                  <code style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14 }}>{h.worstDigraph}</code>
                  <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 20, background: h.mode === "drill" ? "#FAEEDA" : "#EEEDFE", color: h.mode === "drill" ? "#BA7517" : "#534AB7" }}>
                    {h.mode === "drill" ? "DRILL" : "DIAG"}
                  </span>
                </div>
              ))}
            </>
          }
        </div>
      )}
    </div>
  );
}
