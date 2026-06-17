import { useState, useRef, useCallback, useMemo, memo, useEffect, forwardRef } from "react";

// ---- CONSTANTS ---------------------------------------------------------------
const FINGER_MAP = {
  q: 0, a: 0, z: 0,
  w: 1, s: 1, x: 1,
  e: 2, d: 2, c: 2,
  r: 3, f: 3, v: 3, t: 3, g: 3, b: 3,
  y: 4, h: 4, n: 4, u: 4, j: 4, m: 4,
  i: 5, k: 5,
  o: 6, l: 6,
  p: 7, "[": 7, "]": 7, ";": 7, "'": 7,
};

const FINGER_NAMES = [
  "L. Pinky", "L. Ring", "L. Middle", "L. Index",
  "R. Index", "R. Middle", "R. Ring", "R. Pinky"
];

const FINGER_COLORS = [
  "#7F77DD", "#5DCAA5", "#378ADD", "#D4537E",
  "#EF9F27", "#639922", "#D85A30", "#A32D2D"
];

// All letter rows for the letter heatmap
const QWERTY_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

// Punctuation keys to show in a separate heatmap row
const PUNCT_KEYS = [",", ".", ";", "'", "/", "[", "]", "\\", "-", "=", "`"];

// 100% typeable on a standard US keyboard -- no em-dashes, no curly quotes
const SAMPLE_TEXTS = [
  `Can you believe it? The quick, brown fox jumps over the lazy dog; then it runs breathlessly through the forest.`,
  `She asked: "Why does practice matter?" He replied, "Because repetition builds the pathways your fingers need."`,
  `Type fast, but type right: commas, periods, colons; semicolons and question marks all slow you down.`,
  `The rhythm of typing flows naturally: fingers learn geometry, muscle memory builds, and hesitation disappears.`,
  `Consider this: "Speed without accuracy is noise." Fix your worst digraphs (th, er, he) and watch your WPM climb.`,
  `What separates 80 WPM from 160 WPM? Not raw speed, but the slow transitions: qu, wh, ck, and ph that cost you.`,
];

// ---- WORD ENGINE -------------------------------------------------------------

// Split text into non-space tokens: [{start, end, word}]
function getWords(text) {
  const words = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === " ") {
      i++;
      continue;
    }
    const start = i;
    while (i < text.length && text[i] !== " ") i++;
    words.push({ start, end: i, word: text.slice(start, i) });
  }
  return words;
}

// Which word index does the cursor belong to?
function getCurrentWordIdx(words, typedLen) {
  for (let i = 0; i < words.length; i++) {
    const boundary = i < words.length - 1 ? words[i + 1].start : words[i].end;
    if (typedLen <= boundary) return i;
  }
  return words.length - 1;
}

// ---- WORD-WRAP LAYOUT --------------------------------------------------------

// Never splits a word across lines. Returns charMap: globalIdx -> {x,y,w}
function buildLayout(text, ctx, availW, padL, padT, lineH) {
  const chars = text.split("");
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  
  // Tokenise into words and spaces
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
  let x = padL, lineIdx = 0;
  let lineCount = 1;
  
  for (const tok of tokens) {
    if (tok.space) {
      for (let k = tok.start; k < tok.end; k++) {
        charMap[k] = { x, y: padT + lineIdx * lineH, w: widths[k] };
        x += widths[k];
      }
    } else {
      // Measure word width
      let ww = 0;
      for (let k = tok.start; k < tok.end; k++) ww += widths[k];
      
      // Wrap if needed
      if (x + ww > padL + availW && x > padL) {
        lineIdx++;
        lineCount = lineIdx + 1;
        x = padL;
      }
      for (let k = tok.start; k < tok.end; k++) {
        charMap[k] = { x, y: padT + lineIdx * lineH, w: widths[k] };
        x += widths[k];
      }
    }
  }
  return { charMap, lineCount };
}

// ---- WORD BANK ---------------------------------------------------------------
const WORD_BANK = {
  th: ["the", "their", "there", "they", "then", "through", "thought", "think", "things", "this", "that", "these", "those", "though", "other", "whether", "path", "truth", "worth"],
  he: ["the", "they", "here", "where", "these", "whether", "there", "she", "her", "held", "help", "ahead", "together"],
  er: ["every", "never", "often", "under", "enter", "order", "over", "whether", "rather", "create", "greater", "together", "better", "letter", "after", "water"],
  ea: ["great", "treat", "create", "threat", "breath", "health", "wealth", "death", "easy", "read", "each", "reach", "speak", "break", "clear", "dream", "learn", "year"],
  re: ["great", "create", "threat", "reach", "every", "rather", "where", "there", "three", "free", "tree", "agree", "break", "dream", "green", "real"],
  in: ["thinking", "information", "station", "attention", "string", "spring", "ring", "thing", "within", "finding", "kind", "mind", "wind", "blind"],
  ti: ["attention", "station", "question", "action", "patient", "entire", "notice", "time", "until", "positive", "active", "native", "motion", "option"],
  io: ["information", "station", "attention", "action", "motion", "position", "vision", "region", "opinion", "million", "union", "option"],
  on: ["information", "station", "attention", "action", "long", "strong", "wrong", "gone", "done", "once", "none", "stone", "alone", "phone", "zone"],
  ng: ["string", "strong", "spring", "bring", "ring", "thing", "king", "sing", "wing", "thinking", "feeling", "learning", "running"],
  st: ["string", "strong", "spring", "street", "station", "start", "stop", "still", "step", "star", "state", "store", "story", "stay", "style", "study"],
  tr: ["treat", "create", "street", "threat", "string", "through", "thought", "travel", "true", "try", "tree", "train", "trust", "trouble", "track"],
  pr: ["practice", "programming", "prepared", "problem", "process", "program", "project", "provide", "produce", "present", "pretty", "press"],
  ou: ["through", "thought", "about", "house", "found", "could", "would", "should", "count", "sound", "round", "doubt", "ground", "cloud", "proud"],
  ow: ["brown", "know", "how", "now", "show", "slow", "flow", "grow", "allow", "follow", "below", "throw", "power", "town", "down"],
  de: ["deep", "dead", "dear", "deal", "decide", "develop", "deliver", "depend", "under", "order", "made", "side", "wide", "mode", "code"],
  al: ["always", "also", "already", "although", "almost", "along", "allow", "all", "call", "fall", "small", "shall", "tall", "real", "deal", "heal"],
  nt: ["want", "front", "hunt", "grant", "plant", "print", "point", "count", "mount", "paint", "meant", "event", "rent", "hint", "bent"],
  an: ["and", "can", "man", "than", "plan", "span", "hand", "land", "sand", "stand", "brand", "grand", "change", "range", "chance", "dance"],
  en: ["then", "when", "often", "enter", "seven", "open", "even", "never", "every", "been", "seen", "green", "queen", "end", "send", "bend"],
  le: ["people", "little", "middle", "simple", "single", "table", "able", "eagle", "example", "purple", "while", "smile", "style", "mile", "file"],
  or: ["for", "more", "before", "store", "order", "force", "short", "sport", "sort", "port", "form", "storm", "word", "world", "work"],
};

function buildDrillText(slowPairs) {
  const seen = new Set();
  const pool = [];
  for (const pair of slowPairs.slice(0, 5)) {
    // Strip non-alpha for word-bank lookup only; keep symbols for display
    const p = pair.toLowerCase().replace(/[^a-z]/g, "");
    if (p && WORD_BANK[p]) {
      for (const w of WORD_BANK[p]) {
        if (!seen.has(w)) {
          seen.add(w);
          pool.push(w);
        }
      }
    }
    for (const words of Object.values(WORD_BANK)) {
      for (const w of words) {
        if (!seen.has(w) && p && w.includes(p)) {
          seen.add(w);
          pool.push(w);
        }
      }
    }
  }
  for (const w of ["the", "their", "through", "thought", "there", "then", "great", "treat", "things", "think"])
    if (!seen.has(w)) {
      seen.add(w);
      pool.push(w);
    }
  
  const words = [...new Set(pool)].slice(0, 14);
  const rev = [...words].reverse();
  const inter = words.map((w, i) => (i % 2 === 0 ? w : rev[i])).filter(Boolean);
  
  return [...words, ...inter, ...rev].join(" ");
}

// ---- ANALYTICS ---------------------------------------------------------------
function computeMetrics(ksArray, text, duration, targetWpm) {
  // Track ALL keys: letters AND punctuation -- no filtering on char type
  const transitions = {};
  const fingerLats = Array(8).fill(null).map(() => []);
  const keyLats = {};
  const keyErrors = {};
  let errors = 0;

  for (let i = 1; i < ksArray.length; i++) {
    const prev = ksArray[i - 1], curr = ksArray[i];
    const lat = curr.t - prev.t;

    if (lat > 0 && lat < 1500) {
      const fk = prev.k, tk = curr.k;
      
      // Digraph: any two non-space printable single chars
      if (fk.length === 1 && tk.length === 1 && fk !== " " && tk !== " ") {
        const p = fk.toLowerCase() + tk.toLowerCase();
        if (!transitions[p]) transitions[p] = [];
        transitions[p].push(lat);
      }
      
      // Finger map uses lowercase key
      const fi = FINGER_MAP[tk.toLowerCase()];
      if (fi !== undefined) fingerLats[fi].push(lat);
      
      // Key latency: ALL single-char keys including space and punctuation
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
    digraphStats[p] = { avg: Math.round(lats.reduce((a, b) => a + b, 0) / lats.length), count: lats.length };

  const fingerStats = fingerLats.map((lats) => {
    if (!lats.length) return { avg: 0, count: 0, score: 0 };
    const avg = lats.reduce((a, b) => a + b, 0) / lats.length;
    return { avg: Math.round(avg), count: lats.length, score: Math.max(0, Math.min(100, Math.round(100 - (avg - 60) * 0.8))) };
  });

  const keyHeatmap = {};
  for (const [k, lats] of Object.entries(keyLats))
    keyHeatmap[k] = {
      avg: Math.round(lats.reduce((a, b) => a + b, 0) / lats.length),
      count: lats.length,
      errors: keyErrors[k] || 0,
    };

  const wordCount = text.trim().split(/\s+/).length;
  const wpm = Math.round(wordCount / Math.max(duration / 60000, 0.001));
  const totalKeys = ksArray.length;
  const accuracy = totalKeys > 0 ? Math.round(((totalKeys - errors) / totalKeys) * 100) : 100;
  const tLat = Math.round(60000 / (targetWpm * 5));
  
  const sortedDigraphs = Object.entries(digraphStats)
    .sort((a, b) => b[1].avg - a[1].avg)
    .slice(0, 20);
    
  const slowDigraphs = sortedDigraphs.slice(0, 6).map(([pair, s]) => ({
    pair,
    avg: s.avg,
    excess: Math.max(0, s.avg - tLat),
    count: s.count,
  }));
  
  const worstFingers = fingerStats
    .map((s, i) => ({ name: FINGER_NAMES[i], ...s, idx: i }))
    .filter((f) => f.count > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
    
  const sameFinger = Object.entries(digraphStats)
    .filter(([p]) => {
      const f1 = FINGER_MAP[p[0]], f2 = FINGER_MAP[p[1]];
      return f1 !== undefined && f2 !== undefined && f1 === f2 && p[0] !== p[1];
    })
    .sort((a, b) => b[1].avg - a[1].avg)
    .slice(0, 8);

  return {
    wpm, accuracy, errors, totalKeys,
    digraphStats, sortedDigraphs, fingerStats, keyHeatmap,
    targetLatency: tLat,
    currentLatency: Math.round(duration / Math.max(totalKeys, 1)),
    wpmGap: targetWpm - wpm,
    slowDigraphs, worstFingers, sameFinger,
  };
}

// ---- CANVAS TEXT DISPLAY -----------------------------------------------------
const FS = 18;
const LINE_H = Math.round(FS * 2.1);
const PAD_L = 28;
const PAD_T = 32;
const PAD_R = 28;
const FONT = `${FS}px ui-monospace,"SF Mono","Cascadia Code",Menlo,monospace`;

function getColors() {
  const dk = window.matchMedia("(prefers-color-scheme:dark)").matches;
  return {
    pending: dk ? "#71717a" : "#9ca3af",
    correct: dk ? "#22c55e" : "#15803d",
    wrong: dk ? "#f87171" : "#b91c1c",
    wrongBg: dk ? "rgba(239,68,68,0.20)" : "rgba(239,68,68,0.13)",
    wordHl: dk ? "rgba(127,119,221,0.15)" : "rgba(127,119,221,0.10)",
    wordLine: "#7F77DD",
    cursor: "#7F77DD",
  };
}

const TextDisplay = forwardRef(({ text }, canvasForwardRef) => {
  const canvasRef = useRef(null);
  const stateRef = useRef({ typed: "", words: [], curWordIdx: 0 });
  const blinkRef = useRef(true);
  const layoutCache = useRef({ charMap: {}, lineCount: 1, text: "", W: 0 });

  // Resolve canvas to both local ref and forwarded ref
  const setCanvasRef = useCallback((node) => {
    canvasRef.current = node;
    if (canvasForwardRef) canvasForwardRef.current = node;
  }, []);

  function getCtx() {
    const cvs = canvasRef.current;
    if (!cvs) return null;
    const dpr = window.devicePixelRatio || 1;
    const W = cvs.offsetWidth;
    const H = cvs.offsetHeight;
    if (!W || !H) return null;
    cvs.width = W * dpr;
    cvs.height = H * dpr;
    const ctx = cvs.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.font = FONT;
    return { ctx, W, H };
  }

  function getLayout(ctx, W) {
    const t = text;
    if (layoutCache.current.text === t && layoutCache.current.W === W) return layoutCache.current;
    const { charMap, lineCount } = buildLayout(t, ctx, W - PAD_L - PAD_R, PAD_L, PAD_T, LINE_H);
    const cache = { charMap, lineCount, text: t, W };
    layoutCache.current = cache;
    return cache;
  }

  function drawFrame() {
    const r = getCtx();
    if (!r) return;
    const { ctx, W } = r;
    const C = getColors();
    const { typed, words, curWordIdx } = stateRef.current;
    const { charMap, lineCount } = getLayout(ctx, W);
    const t = text;
    
    ctx.clearRect(0, 0, W, (lineCount + 1) * LINE_H + PAD_T * 2);
    
    // Active word highlight
    if (words.length > 0 && curWordIdx < words.length) {
      const cw = words[curWordIdx];
      const sm = charMap[cw.start];
      const em = charMap[cw.end - 1];
      if (sm && em) {
        const ux = sm.x - 2;
        const uy = sm.y;
        const uw = em.x + em.w - sm.x + 4;
        ctx.fillStyle = C.wordHl;
        ctx.beginPath();
        ctx.roundRect(ux, uy - FS * 1.3, uw, FS * 1.76, 5);
        ctx.fill();
        ctx.fillStyle = C.wordLine;
        ctx.fillRect(ux, uy + FS * 0.46, uw, 2.5);
      }
    }
    
    // Draw each character
    ctx.font = FONT;
    for (let gi = 0; gi < t.length; gi++) {
      const m = charMap[gi];
      if (!m) continue;
      const ch = t[gi];
      const tch = typed[gi];
      const isCursor = gi === typed.length;
      const isTyped = tch !== undefined;
      const isCorrect = isTyped && tch === ch;
      const isWrong = isTyped && tch !== ch;
      
      if (isWrong) {
        ctx.fillStyle = C.wrongBg;
        ctx.fillRect(m.x, m.y - FS * 1.3, m.w + 1, FS * 1.76);
      }
      
      if (isCursor && blinkRef.current) {
        ctx.fillStyle = C.cursor;
        ctx.fillRect(m.x - 2, m.y - FS * 1.3, 2.5, FS * 1.76);
      }
      
      ctx.font = FONT;
      ctx.fillStyle = isCorrect ? C.correct : isWrong ? C.wrong : C.pending;
      ctx.fillText(ch, m.x, m.y);
    }
    
    // Cursor after last char
    if (typed.length >= t.length && blinkRef.current && t.length > 0) {
      const last = charMap[t.length - 1];
      if (last) {
        ctx.fillStyle = C.cursor;
        ctx.fillRect(last.x + last.w + 1, last.y - FS * 1.3, 2.5, FS * 1.76);
      }
    }
  }

  // Imperative API exposed via canvas element
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    layoutCache.current = { charMap: {}, lineCount: 1, text: "", W: 0 };
    cvs._update = (typed, words, curWordIdx) => {
      stateRef.current = { typed, words, curWordIdx };
      blinkRef.current = true;
      drawFrame();
    };
    const tid = setTimeout(() => drawFrame(), 30);
    return () => clearTimeout(tid);
  }, [text]);

  // Blink
  useEffect(() => {
    const id = setInterval(() => {
      blinkRef.current = !blinkRef.current;
      drawFrame();
    }, 530);
    return () => clearInterval(id);
  }, [text]);

  // Resize
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      layoutCache.current.W = 0;
      drawFrame();
    });
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [text]);

  const estLines = useMemo(() => Math.max(3, Math.ceil(text.length / 52)), [text]);
  
  return (
    <div style={{
      borderRadius: "var(--border-radius-lg)",
      border: "0.5px solid var(--color-border-secondary)",
      background: "var(--color-background-primary)",
      marginBottom: "1.25rem", overflow: "hidden", cursor: "text",
    }}>
      <canvas ref={setCanvasRef} style={{ display: "block", width: "100%", height: estLines * LINE_H + PAD_T * 2 }} />
    </div>
  );
});

// ---- HEATMAP KEY -------------------------------------------------------------
const HeatmapKey = memo(({ letter, data, targetLatency, size = 54 }) => {
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
    <div style={{ position: "relative" }}
      onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}>
      <div style={{
        width: size, height: size,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        borderRadius: 8, background: bg, color: fg,
        border: "1px solid rgba(0,0,0,0.10)",
        cursor: "default", userSelect: "none",
        transform: tip ? "scale(1.15)" : "scale(1)",
        transition: "transform 0.1s",
        position: "relative", zIndex: tip ? 3 : 1,
      }}>
        <span style={{ fontWeight: 700, fontSize: size > 40 ? 17 : 13, lineHeight: 1 }}>{letter}</span>
        {avg > 0 && <span style={{ fontSize: size > 40 ? 10 : 8, opacity: 0.9, marginTop: 2 }}>{avg}ms</span>}
      </div>
      
      {tip && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 10px)", left: "50%",
          transform: "translateX(-50%)",
          background: "#111827", color: "#f9fafb",
          padding: "10px 14px", borderRadius: 10, fontSize: 12,
          whiteSpace: "nowrap", zIndex: 999, pointerEvents: "none", lineHeight: 1.8,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
            <code style={{ fontFamily: "var(--font-mono)" }}>{letter}</code> key
          </div>
          {avg > 0 ? (<>
            <div>Avg latency: <b>{avg}ms</b></div>
            <div>Target: <b>{targetLatency}ms</b></div>
            <div>Samples: <b>{data.count}</b>{data.errors > 0 ? ` (${data.errors} errors)` : ""}</div>
            <div style={{ color: avg > targetLatency ? "#FCA5A5" : "#6EE7B7", marginTop: 4, fontWeight: 600 }}>
              {avg > targetLatency ? `+${avg - targetLatency}ms over target` : `-${targetLatency - avg}ms under target`}
            </div>
          </>) : <div style={{ color: "#9CA3AF" }}>Not typed this session</div>}
        </div>
      )}
    </div>
  );
});

// ---- STAT CARD ---------------------------------------------------------------
function StatCard({ label, value, sub, color, mono }) {
  return (
    <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-lg)", padding: "14px 18px", borderTop: `3px solid ${color || "transparent"}` }}>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4, fontWeight: 500, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 500, color: color || "var(--color-text-primary)", fontFamily: mono ? "var(--font-mono)" : undefined, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ---- DRILL PROGRESS ----------------------------------------------------------
function DrillProgress({ baseline, current }) {
  if (!baseline || !current) return null;
  const improvements = baseline.slowDigraphs.map((d) => {
    const before = baseline.digraphStats[d.pair]?.avg;
    const after = current.digraphStats[d.pair]?.avg;
    if (!before || !after) return null;
    const delta = before - after, pct = Math.abs(Math.round((delta / before) * 100));
    return { pair: d.pair, before, after, delta, pct, improved: delta > 0 };
  }).filter(Boolean);
  
  const wpmDelta = current.wpm - baseline.wpm;
  const accDelta = current.accuracy - baseline.accuracy;
  
  return (
    <div style={{ padding: "1.25rem 1.5rem", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-lg)", borderLeft: "3px solid #7F77DD", marginBottom: "1.5rem" }}>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: "1rem" }}>Drill results vs diagnostic baseline</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10, marginBottom: "1.25rem" }}>
        {[
          { label: "WPM change", val: wpmDelta, fmt: (v) => `${v >= 0 ? "+" : ""}${v}`, col: wpmDelta >= 0 ? "#1D9E75" : "#E24B4A" },
          { label: "Accuracy", val: accDelta, fmt: (v) => `${v >= 0 ? "+" : ""}${v}%`, col: accDelta >= 0 ? "#1D9E75" : "#E24B4A" },
          { label: "Baseline WPM", val: baseline.wpm, fmt: (v) => v },
          { label: "Drill WPM", val: current.wpm, fmt: (v) => v, col: "#7F77DD" },
        ].map((s) => (
          <div key={s.label}>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, fontFamily: "var(--font-mono)", color: s.col || "var(--color-text-primary)" }}>{s.fmt(s.val)}</div>
          </div>
        ))}
      </div>
      
      {improvements.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8, fontWeight: 500 }}>Bottleneck digraph improvements</div>
          {improvements.map(({ pair, before, after, pct, improved }) => (
            <div key={pair} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <code style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, width: 34, letterSpacing: 3 }}>{pair}</code>
              <div style={{ flex: 1, position: "relative", height: 16, background: "var(--color-background-primary)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(100, (before / 400) * 100)}%`, background: "#E24B4A33", borderRadius: 8 }} />
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(100, (after / 400) * 100)}%`, background: improved ? "#1D9E75" : "#E24B4A", borderRadius: 8, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ minWidth: 100, textAlign: "right", fontSize: 12, fontFamily: "var(--font-mono)" }}>
                <span style={{ color: "var(--color-text-secondary)" }}>{before}ms</span>
                <span style={{ color: "var(--color-text-secondary)", margin: "0 4px" }}>{"->"}</span>
                <span style={{ color: improved ? "#1D9E75" : "#E24B4A", fontWeight: 700 }}>{after}ms</span>
              </div>
              <div style={{ minWidth: 48, fontSize: 12, fontWeight: 600, color: improved ? "#1D9E75" : "#E24B4A", textAlign: "right" }}>
                {improved ? `-${pct}%` : `+${pct}%`}
              </div>
            </div>
          ))}
        </>
      )}
      {improvements.length === 0 && <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>Not enough digraph overlap. Try another session.</p>}
    </div>
  );
}

// ---- TAB BUTTON --------------------------------------------------------------
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

// ---- MAIN APP ----------------------------------------------------------------
export default function TypeForge() {
  const [targetWpm, setTargetWpm] = useState(120);
  const modeRef = useRef("diagnostic");
  const drillTextRef = useRef("");
  const [mode, setMode] = useState("diagnostic");
  const [textIdx, setTextIdx] = useState(0);
  
  // Hot-path refs -- zero re-render cost per keypress
  const typedRef = useRef("");
  const ksRef = useRef([]);
  const startTimeRef = useRef(null);
  const isRunRef = useRef(false);
  const wordsRef = useRef([]);
  const activeTextRef = useRef(SAMPLE_TEXTS[0]);
  
  // Render-gate state
  const [typedDisplay, setTypedDisplay] = useState("");
  const [typedLen, setTypedLen] = useState(0);
  const [liveWpm, setLiveWpm] = useState(0);
  const [running, setRunning] = useState(false);
  const [wordError, setWordError] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [drillBaseline, setDrillBaseline] = useState(null);
  const [history, setHistory] = useState([]);
  const [view, setView] = useState("test");
  const [activeTab, setActiveTab] = useState("overview");
  
  const inputRef = useRef(null);
  const canvasRef = useRef(null);
  
  const currentText = () => activeTextRef.current;
  
  const pushCanvas = useCallback((typed) => {
    const cvs = canvasRef.current;
    if (!cvs?._update) return;
    cvs._update(typed, wordsRef.current, getCurrentWordIdx(wordsRef.current, typed.length));
  }, []);

  // ---- Reset ------------------------------------------------------------------
  const startTest = useCallback((opts = {}) => {
    const { newMode, drillText, nextIdx } = opts;
    typedRef.current = "";
    ksRef.current = [];
    startTimeRef.current = null;
    isRunRef.current = false;
    
    const resolvedMode = newMode ?? modeRef.current;
    const resolvedIdx = nextIdx !== undefined ? nextIdx : textIdx;
    const resolvedText = resolvedMode === "drill"
      ? (drillText ?? drillTextRef.current)
      : SAMPLE_TEXTS[resolvedIdx];
      
    if (newMode !== undefined) { modeRef.current = newMode; setMode(newMode); }
    if (drillText !== undefined) drillTextRef.current = drillText;
    if (nextIdx !== undefined) setTextIdx(nextIdx);
    
    activeTextRef.current = resolvedText;
    wordsRef.current = getWords(resolvedText);
    
    setTypedDisplay("");
    setTypedLen(0);
    setLiveWpm(0);
    setRunning(false);
    setWordError(false);
    setMetrics(null);
    setView("test");
    setActiveTab("overview");
    
    setTimeout(() => {
      const cvs = canvasRef.current;
      if (cvs?._update) cvs._update("", wordsRef.current, 0);
      inputRef.current?.focus();
    }, 40);
  }, [textIdx]);

  const startDrillSession = useCallback((baseline) => {
    const dt = buildDrillText(baseline.slowDigraphs.map((d) => d.pair));
    setDrillBaseline(baseline);
    startTest({ newMode: "drill", drillText: dt });
  }, [startTest]);

  const nextDiagnostic = useCallback(() => {
    startTest({ newMode: "diagnostic", drillText: "", nextIdx: (textIdx + 1) % SAMPLE_TEXTS.length });
  }, [startTest, textIdx]);

  useEffect(() => {
    activeTextRef.current = SAMPLE_TEXTS[0];
    wordsRef.current = getWords(SAMPLE_TEXTS[0]);
  }, []);

  // ---- Paste block ------------------------------------------------------------
  const handlePaste = useCallback((e) => e.preventDefault(), []);

  // ---- Core keydown handler ---------------------------------------------------
  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && ["v", "V", "a", "A", "c", "C", "x", "X"].includes(e.key)) {
      e.preventDefault();
      return;
    }
    if (e.key === "Tab") { e.preventDefault(); return; }
    
    const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!isPrintable && e.key !== "Backspace") return;
    e.preventDefault();
    
    const text = currentText();
    const prev = typedRef.current;
    const now = performance.now();
    let next = prev;
    
    if (e.key === "Backspace") {
      if (!prev.length) return;
      // Only delete back to the start of the current word -- cannot enter previous word
      const cwIdx = getCurrentWordIdx(wordsRef.current, prev.length);
      const wordStart = wordsRef.current[cwIdx]?.start ?? 0;
      if (prev.length > wordStart) {
        next = prev.slice(0, -1);
        if (ksRef.current.length > 0) ksRef.current.pop();
      }
    } else {
      const ch = e.key;
      const pos = prev.length;
      if (pos >= text.length) return;
      
      // Space gate: only accepted when current word is complete and correct
      if (ch === " ") {
        const cwIdx = getCurrentWordIdx(wordsRef.current, pos);
        const cw = wordsRef.current[cwIdx];
        if (!cw) return;
        
        // pos must point exactly past the end of the word
        if (pos !== cw.end) {
          // Word not fully typed yet
          setWordError(true);
          setTimeout(() => setWordError(false), 500);
          return;
        }
        
        // Check every char of the word matches
        const wordTyped = prev.slice(cw.start, cw.end);
        const wordTarget = text.slice(cw.start, cw.end);
        if (wordTyped !== wordTarget) {
          setWordError(true);
          setTimeout(() => setWordError(false), 500);
          return;
        }
        
        // Make sure the character at this position in the text is actually a space
        if (text[pos] !== " ") return;
      }
      
      const ok = ch === text[pos];
      ksRef.current.push({ k: ch, t: now, ok });
      next = prev + ch;
      
      if (!isRunRef.current) {
        isRunRef.current = true;
        startTimeRef.current = now;
        setRunning(true);
      }
      
      // Per-keystroke live WPM
      if (startTimeRef.current) {
        const elapsed = (now - startTimeRef.current) / 60000;
        const spaces = next.split(" ").length - 1;
        const wc = spaces + (next[next.length - 1] === " " ? 0 : 1);
        setLiveWpm(Math.min(300, Math.round(wc / Math.max(elapsed, 0.0001))));
      }
    }
    
    typedRef.current = next;
    setTypedDisplay(next);
    setTypedLen(next.length);
    pushCanvas(next);
    
    // Completion: typed must exactly equal text (100% accuracy gate)
    if (next.length === text.length && next === text) {
      isRunRef.current = false;
      const dur = now - (startTimeRef.current || now);
      const m = computeMetrics(ksRef.current, text, dur, targetWpm);
      setMetrics(m);
      setHistory((ph) => [{
        date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        wpm: m.wpm, accuracy: m.accuracy,
        worstDigraph: m.slowDigraphs[0]?.pair || "--",
        mode: modeRef.current, id: Date.now(),
      }, ...ph.slice(0, 19)]);
      setTimeout(() => { setView("results"); setActiveTab("overview"); }, 150);
    }
  }, [targetWpm, pushCanvas]);

  const text = currentText();
  const progress = text.length > 0 ? Math.min(1, typedLen / text.length) : 0;
  const expLat = Math.round(60000 / (targetWpm * 5));

  // ---- RENDER -----------------------------------------------------------------
  return (
    <div style={{ fontFamily: "var(--font-sans)", maxWidth: 870, margin: "0 auto", padding: "0 0 4rem" }}>
      {/* HEADER */}
      <div style={{ padding: "1.5rem 0 1.25rem", borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: "1.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 24, fontWeight: 500, letterSpacing: -0.5 }}>TypeForge</span>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: 20, fontWeight: 500, color: mode === "drill" ? "#EF9F27" : "#7F77DD", background: mode === "drill" ? "#FAEEDA" : "#EEEDFE" }}>
              {mode === "drill" ? "DRILL MODE" : "DIAGNOSTIC"}
            </span>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
            {mode === "drill"
              ? "Targeting your weak digraphs -- fix every word before moving on."
              : "100% accuracy required -- you cannot advance past a wrong word."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)" }}>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Target</span>
            <select value={targetWpm} onChange={(e) => setTargetWpm(Number(e.target.value))} style={{ fontSize: 14, border: "none", background: "transparent", color: "var(--color-text-primary)", fontWeight: 500, cursor: "pointer" }}>
              {[60, 80, 100, 120, 140, 160, 180, 200].map((v) => <option key={v} value={v}>{v} WPM</option>)}
            </select>
          </div>
          {mode === "drill" && <button onClick={nextDiagnostic} style={{ fontSize: 13, padding: "7px 14px" }}>Back to diagnostic</button>}
          {view !== "test" && <button onClick={nextDiagnostic} style={{ fontSize: 13, padding: "7px 14px" }}>New test</button>}
          {view === "test" && mode === "diagnostic" && <button onClick={nextDiagnostic} style={{ fontSize: 13, padding: "7px 14px" }}>New text</button>}
          {history.length > 0 && view !== "history" && <button onClick={() => setView("history")} style={{ fontSize: 13, padding: "7px 14px" }}>History ({history.length})</button>}
        </div>
      </div>

      {/* TEST VIEW */}
      {view === "test" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: "1.5rem" }}>
            <StatCard label="LIVE WPM" value={running ? liveWpm : "--"} mono />
            <StatCard label="TARGET" value={targetWpm} sub="WPM goal" color="#7F77DD" mono />
            <StatCard label="GAP" value={running ? Math.abs(targetWpm - liveWpm) : "--"} sub={running ? (liveWpm < targetWpm ? "WPM behind" : "WPM ahead!") : "start typing"} color={running ? (liveWpm < targetWpm ? "#E24B4A" : "#1D9E75") : undefined} mono />
            <StatCard label="KEY TARGET" value={`${expLat}ms`} sub="per keystroke" mono />
          </div>
          <div style={{ height: 4, background: "var(--color-background-secondary)", borderRadius: 2, marginBottom: "1.25rem", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress * 100}%`, background: "linear-gradient(90deg,#7F77DD,#5DCAA5)", borderRadius: 2 }} />
          </div>
          <div onClick={() => inputRef.current?.focus()}>
            <TextDisplay ref={canvasRef} text={text} />
          </div>
          {/* Invisible input captures all keyboard events */}
          <input
            ref={inputRef}
            value={typedDisplay}
            onChange={() => {}}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            autoFocus
            style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1, top: 0, left: 0 }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
            <p style={{ fontSize: 12, margin: 0, color: wordError ? "#E24B4A" : "var(--color-text-secondary)", fontWeight: wordError ? 500 : 400, transition: "color 0.2s" }}>
              {wordError
                ? "Fix the current word completely before pressing Space"
                : "Click the text to focus  |  Fix each word before advancing  |  Paste blocked"}
            </p>
            <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--color-text-secondary)" }}>
              {[{ c: "#22c55e", l: "correct" }, { c: "#f87171", l: "wrong" }, { c: "#9ca3af", l: "pending" }].map((x) => (
                <span key={x.l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: x.c, display: "inline-block" }} />{x.l}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RESULTS VIEW */}
      {view === "results" && metrics && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: "1.5rem" }}>
            <StatCard label="WPM" value={metrics.wpm} sub={mode === "drill" ? "drill" : "diagnostic"} color="#7F77DD" mono />
            <StatCard label="ACCURACY" value={`${metrics.accuracy}%`} sub={`${metrics.errors} errors`} color="#5DCAA5" mono />
            <StatCard label="TARGET" value={targetWpm} sub="WPM goal" mono />
            <StatCard label="GAP" value={Math.abs(metrics.wpmGap)} sub={metrics.wpmGap > 0 ? "WPM behind" : "Target reached!"} color={metrics.wpmGap > 0 ? "#E24B4A" : "#1D9E75"} mono />
            <StatCard label="AVG LATENCY" value={`${metrics.currentLatency}ms`} sub={`target ${metrics.targetLatency}ms`} mono />
          </div>
          {mode === "drill" && drillBaseline && <DrillProgress baseline={drillBaseline} current={metrics} />}
          <div style={{ display: "flex", gap: 2, overflowX: "auto", borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: "1.5rem" }}>
            {[
              { id: "overview", label: "Overview" },
              { id: "digraphs", label: "Digraph analysis" },
              { id: "heatmap", label: "Keyboard heatmap" },
              { id: "fingers", label: "Finger analytics" },
              { id: "drills", label: "Personalized drills" },
            ].map((t) => <TabBtn key={t.id} {...t} active={activeTab === t.id} onClick={setActiveTab} />)}
          </div>
          
          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 1rem" }}>Slowest digraph transitions</h3>
              {metrics.slowDigraphs.length === 0
                ? <p style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>Not enough data yet.</p>
                : metrics.slowDigraphs.map((d, i) => {
                  const col = d.avg > metrics.targetLatency * 1.5 ? "#E24B4A" : d.avg > metrics.targetLatency ? "#EF9F27" : "#1D9E75";
                  const bsl = drillBaseline?.digraphStats[d.pair]?.avg;
                  return (
                    <div key={d.pair} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--color-text-secondary)", flexShrink: 0 }}>{i + 1}</span>
                      <code style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, width: 48, letterSpacing: 4 }}>{d.pair}</code>
                      <div style={{ flex: 1, height: 10, background: "var(--color-background-secondary)", borderRadius: 5, position: "relative", overflow: "hidden" }}>
                        {bsl && <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(100, (bsl / 500) * 100)}%`, background: "#E24B4A33", borderRadius: 5 }} />}
                        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(100, (d.avg / 500) * 100)}%`, background: col, borderRadius: 5 }} />
                      </div>
                      <div style={{ minWidth: 110, textAlign: "right" }}>
                        <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--font-mono)", color: col }}>{d.avg}ms</div>
                        {bsl
                          ? <div style={{ fontSize: 11, color: d.avg < bsl ? "#1D9E75" : "#E24B4A" }}>{d.avg < bsl ? `-${bsl - d.avg}ms improved` : `+${d.avg - bsl}ms worse`}</div>
                          : <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>+{d.excess}ms over target</div>}
                      </div>
                    </div>
                  );
                })}
              <h3 style={{ fontSize: 16, fontWeight: 500, margin: "1.75rem 0 1rem" }}>Weakest fingers</h3>
              {metrics.worstFingers.map((f) => (
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
                  {metrics.slowDigraphs.slice(0, 3).map((d) => (
                    <li key={d.pair}>
                      Train <code style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: "var(--color-text-primary)", background: "var(--color-background-primary)", padding: "1px 6px", borderRadius: 4 }}>{d.pair}</code>
                      {" "}from <span style={{ fontFamily: "var(--font-mono)", color: "#E24B4A", fontWeight: 600 }}>{d.avg}ms</span> to <span style={{ fontFamily: "var(--font-mono)", color: "#1D9E75", fontWeight: 600 }}>{metrics.targetLatency}ms</span>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
                <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>All digraph latencies (letters + symbols)</h3>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Target: {metrics.targetLatency}ms</span>
              </div>
              <div style={{ display: "flex", gap: 16, marginBottom: 14, fontSize: 12, color: "var(--color-text-secondary)" }}>
                {[{ c: "#1D9E75", l: `Fast (under ${metrics.targetLatency}ms)` }, { c: "#EF9F27", l: "Slightly slow" }, { c: "#E24B4A", l: "Bottleneck" }].map((x) => (
                  <span key={x.c} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: x.c, display: "inline-block" }} />{x.l}
                  </span>
                ))}
              </div>
              {metrics.sortedDigraphs.length === 0 && <p style={{ color: "var(--color-text-secondary)" }}>Not enough data.</p>}
              {metrics.sortedDigraphs.slice(0, 20).map(([pair, s], i) => {
                const col = s.avg > metrics.targetLatency * 1.5 ? "#E24B4A" : s.avg > metrics.targetLatency ? "#EF9F27" : "#1D9E75";
                return (
                  <div key={pair} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    <span style={{ width: 20, fontSize: 11, color: "var(--color-text-secondary)", textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
                    <code style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, width: 44, letterSpacing: 3 }}>{pair}</code>
                    <div style={{ flex: 1, height: 8, background: "var(--color-background-secondary)", borderRadius: 4 }}>
                      <div style={{ height: "100%", borderRadius: 4, width: `${Math.min(100, (s.avg / 400) * 100)}%`, background: col }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500, fontFamily: "var(--font-mono)", minWidth: 56, textAlign: "right", color: col }}>{s.avg}ms</span>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)", minWidth: 40 }}>{s.count}x</span>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* HEATMAP */}
          {activeTab === "heatmap" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Keyboard latency heatmap</h3>
                <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {[{ c: "#1D9E75", l: "Fast" }, { c: "#EF9F27", l: "Moderate" }, { c: "#E24B4A", l: "Slow" }].map((x) => (
                    <span key={x.c} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: x.c, display: "inline-block" }} />{x.l}
                    </span>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "1.25rem" }}>
                Hover any key for stats. Target: <b>{metrics.targetLatency}ms</b>. Grey = not typed this session.
              </p>
              {/* Letter rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", marginBottom: 16 }}>
                {QWERTY_ROWS.map((row, ri) => (
                  <div key={ri} style={{ display: "flex", gap: 5, paddingLeft: ri === 1 ? 30 : ri === 2 ? 57 : 0 }}>
                    {row.map((k) => (
                      <HeatmapKey key={k} letter={k.toUpperCase()} data={metrics.keyHeatmap[k]} targetLatency={metrics.targetLatency} />
                    ))}
                  </div>
                ))}
                {/* Space bar */}
                <div style={{ paddingLeft: 114 }}>
                  <div style={{
                    width: 240, height: 54, display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: 8, border: "1px solid rgba(0,0,0,0.10)", fontWeight: 500, fontSize: 13,
                    background: metrics.keyHeatmap[" "] ? (metrics.keyHeatmap[" "].avg / metrics.targetLatency <= 1 ? "#1D9E75" : metrics.keyHeatmap[" "].avg / metrics.targetLatency <= 1.5 ? "#EF9F27" : "#E24B4A") : "var(--color-background-secondary)",
                    color: metrics.keyHeatmap[" "] ? "#fff" : "var(--color-text-secondary)",
                  }}>
                    {metrics.keyHeatmap[" "] ? `SPACE  ${metrics.keyHeatmap[" "].avg}ms` : "SPACE"}
                  </div>
                </div>
              </div>
              {/* Punctuation row */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 8 }}>Punctuation & symbols</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {PUNCT_KEYS.map((k) => (
                    <HeatmapKey key={k} letter={k} data={metrics.keyHeatmap[k]} targetLatency={metrics.targetLatency} size={48} />
                  ))}
                  {/* Also show any other symbol typed that isn't in PUNCT_KEYS */}
                  {Object.entries(metrics.keyHeatmap)
                    .filter(([k]) => k.length === 1 && !/^[a-z ]$/.test(k) && !PUNCT_KEYS.includes(k))
                    .map(([k, d]) => (
                      <HeatmapKey key={k} letter={k} data={d} targetLatency={metrics.targetLatency} size={48} />
                    ))}
                </div>
              </div>
              {/* Slowest keys table */}
              <h3 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 0.75rem" }}>Slowest individual keys (all)</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 8 }}>
                {Object.entries(metrics.keyHeatmap)
                  .filter(([k]) => k.length === 1 && k !== " ")
                  .sort((a, b) => b[1].avg - a[1].avg)
                  .slice(0, 10)
                  .map(([k, d]) => {
                    const col = d.avg > metrics.targetLatency * 1.5 ? "#E24B4A" : d.avg > metrics.targetLatency ? "#EF9F27" : "#1D9E75";
                    return (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", borderLeft: `3px solid ${col}` }}>
                        <code style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, width: 22 }}>{k}</code>
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
          
          {/* FINGERS */}
          {activeTab === "fingers" && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 1.25rem" }}>Finger efficiency scores</h3>
              {metrics.fingerStats.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 80, fontSize: 12, color: "var(--color-text-secondary)", textAlign: "right", flexShrink: 0 }}>{FINGER_NAMES[i]}</div>
                  <div style={{ flex: 1, height: 20, background: "var(--color-background-secondary)", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ width: `${f.score}%`, height: "100%", background: FINGER_COLORS[i], borderRadius: 10 }} />
                  </div>
                  <div style={{ width: 56, fontSize: 13, fontWeight: 500, fontFamily: "var(--font-mono)", textAlign: "right" }}>{f.count > 0 ? `${f.score}/100` : "--"}</div>
                  <div style={{ width: 56, fontSize: 12, color: "var(--color-text-secondary)" }}>{f.count > 0 ? `${f.avg}ms` : "no data"}</div>
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10, marginTop: "1.5rem" }}>
                {metrics.fingerStats.map((f, i) => f.count > 0 && (
                  <div key={i} style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "14px 16px", borderTop: `3px solid ${FINGER_COLORS[i]}` }}>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>{FINGER_NAMES[i]}</div>
                    <div style={{ fontSize: 22, fontWeight: 500, fontFamily: "var(--font-mono)" }}>{f.score}<span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>/100</span></div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{f.avg}ms avg  {f.count} keys</div>
                  </div>
                ))}
              </div>
              {metrics.sameFinger.length > 0 && (
                <>
                  <h3 style={{ fontSize: 15, fontWeight: 500, margin: "1.75rem 0 0.5rem" }}>Same-finger bigrams</h3>
                  <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 1rem", lineHeight: 1.6 }}>One finger typing twice in a row -- a key speed bottleneck.</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {metrics.sameFinger.map(([pair, s]) => (
                      <div key={pair} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)" }}>
                        <code style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700 }}>{pair}</code>
                        <span style={{ fontSize: 12, color: "#EF9F27", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{s.avg}ms</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* DRILLS */}
          {activeTab === "drills" && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 0.5rem" }}>
                {mode === "drill" ? "Run another drill" : "Personalized drill"}
              </h3>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 1.25rem", lineHeight: 1.6 }}>
                {mode === "drill"
                  ? "Drill complete. Run again to consolidate, or return to diagnostic."
                  : (<>Targets your slowest digraphs: {metrics.slowDigraphs.slice(0, 4).map((d, i) => (
                    <span key={d.pair}>
                      {i > 0 && ", "}
                      <code style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: "var(--color-text-primary)", background: "var(--color-background-secondary)", padding: "1px 6px", borderRadius: 4 }}>{d.pair}</code>
                      <span style={{ fontSize: 11, color: "#E24B4A", marginLeft: 2 }}>({d.avg}ms)</span>
                    </span>
                  ))}</>)}
              </p>
              {mode !== "drill" && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: "1.25rem" }}>
                  {metrics.slowDigraphs.slice(0, 5).map((d) => {
                    const col = d.avg > metrics.targetLatency * 1.5 ? "#E24B4A" : d.avg > metrics.targetLatency ? "#EF9F27" : "#1D9E75";
                    return (
                      <div key={d.pair} style={{ textAlign: "center", padding: "12px 18px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", borderTop: `3px solid ${col}`, minWidth: 72 }}>
                        <code style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, letterSpacing: 5, display: "block" }}>{d.pair}</code>
                        <div style={{ fontSize: 12, color: col, fontFamily: "var(--font-mono)", fontWeight: 600, marginTop: 4 }}>{d.avg}ms</div>
                        <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 2 }}>target {metrics.targetLatency}ms</div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, lineHeight: 2, padding: "1.25rem 1.5rem", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-lg)", marginBottom: "1.5rem", wordBreak: "break-word" }}>
                <div style={{ fontSize: 11, marginBottom: 6, color: "var(--color-text-secondary)", fontFamily: "var(--font-sans)" }}>Drill text preview:</div>
                {buildDrillText(metrics.slowDigraphs.map((d) => d.pair)).slice(0, 150)}...
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: "1.5rem" }}>
                <div style={{ padding: "1rem 1.25rem", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", borderTop: "3px solid #EF9F27" }}>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8, fontWeight: 500 }}>Session goal</div>
                  {metrics.slowDigraphs[0] && (
                    <div style={{ fontSize: 14, lineHeight: 1.8 }}>
                      Reduce <code style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 15, background: "var(--color-background-primary)", padding: "1px 6px", borderRadius: 4 }}>{metrics.slowDigraphs[0].pair}</code>{" "}
                      from <span style={{ fontFamily: "var(--font-mono)", color: "#E24B4A", fontWeight: 600 }}>{metrics.slowDigraphs[0].avg}ms</span>{" "}
                      to <span style={{ fontFamily: "var(--font-mono)", color: "#1D9E75", fontWeight: 600 }}>{metrics.targetLatency}ms</span>
                    </div>
                  )}
                </div>
                <div style={{ padding: "1rem 1.25rem", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", borderTop: "3px solid #5DCAA5" }}>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8, fontWeight: 500 }}>Estimated time to {targetWpm} WPM</div>
                  <div style={{ fontSize: 32, fontWeight: 500, fontFamily: "var(--font-mono)", lineHeight: 1 }}>~{Math.max(5, Math.round(Math.abs(metrics.wpmGap) / 3))}</div>
                  <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 4 }}>days of focused practice</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => startDrillSession(metrics)}
                  style={{ fontSize: 14, padding: "11px 28px", background: "#7F77DD", color: "#fff", border: "none", borderRadius: "var(--border-radius-md)", cursor: "pointer", fontWeight: 500 }}
                >
                  Start drill session
                </button>
                {mode === "drill" && (
                  <button onClick={nextDiagnostic} style={{ fontSize: 14, padding: "11px 20px" }}>Back to diagnostic</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* HISTORY */}
      {view === "history" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Session history</h3>
            <button onClick={() => setView(metrics ? "results" : "test")} style={{ fontSize: 13, padding: "6px 14px" }}>Back</button>
          </div>
          {history.length === 0
            ? <p style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>Complete a typing test to see history.</p>
            : (
              <>
                {history.length > 1 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: "1.5rem" }}>
                    <StatCard label="BEST WPM" value={Math.max(...history.map((h) => h.wpm))} color="#1D9E75" mono />
                    <StatCard label="AVG WPM" value={Math.round(history.reduce((a, b) => a + b.wpm, 0) / history.length)} mono />
                    <StatCard label="BEST ACC" value={`${Math.max(...history.map((h) => h.accuracy))}%`} color="#5DCAA5" mono />
                    <StatCard label="SESSIONS" value={history.length} mono />
                  </div>
                )}
                {history.map((h, i) => (
                  <div key={h.id} style={{ display: "grid", gridTemplateColumns: "28px 1fr 90px 80px 80px 60px", gap: 12, padding: "12px 0", borderBottom: "0.5px solid var(--color-border-tertiary)", alignItems: "center" }}>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", textAlign: "right" }}>#{history.length - i}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{h.date}</div>
                    <div style={{ fontFamily: "var(--font-mono)" }}>
                      <span style={{ fontSize: 18, fontWeight: 500 }}>{h.wpm}</span>
                      <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginLeft: 3 }}>WPM</span>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 500 }}>{h.accuracy}%</div>
                    <code style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14 }}>{h.worstDigraph}</code>
                    <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 20, background: h.mode === "drill" ? "#FAEEDA" : "#EEEDFE", color: h.mode === "drill" ? "#BA7517" : "#534AB7" }}>
                      {h.mode === "drill" ? "DRILL" : "DIAG"}
                    </span>
                  </div>
                ))}
              </>
            )}
        </div>
      )}
    </div>
  );
}