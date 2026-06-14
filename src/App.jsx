import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const SAMPLE_TEXTS = [
  "the quick brown fox jumps over the lazy dog and then runs through the forest thinking about the journey ahead",
  "through the thought of thinking deeply we find that every word written contains the essence of communication between minds",
  "programming requires patience and practice to master the intricate patterns of logic that transform ideas into working systems",
  "the rhythm of typing flows naturally when fingers learn the geography of keys through repetition and focused deliberate practice",
  "great things never come from comfort zones so keep pushing your limits every single day with patience and determination",
];

const FINGER_MAP = {
  q:0,a:0,z:0,
  w:1,s:1,x:1,
  e:2,d:2,c:2,
  r:3,f:3,v:3,t:3,g:3,b:3,
  y:4,h:4,n:4,u:4,j:4,m:4,
  i:5,k:5,
  o:6,l:6,
  p:7,"[":7,"]":7,"\\":7,";":7,"'":7,
};

const FINGER_NAMES = ["L. Pinky","L. Ring","L. Middle","L. Index","R. Index","R. Middle","R. Ring","R. Pinky"];
const FINGER_COLORS = ["#7F77DD","#5DCAA5","#378ADD","#D4537E","#EF9F27","#639922","#D85A30","#A32D2D"];

const QWERTY_ROWS = [
  ["q","w","e","r","t","y","u","i","o","p"],
  ["a","s","d","f","g","h","j","k","l",";"],
  ["z","x","c","v","b","n","m",",",".","/"],
];

const WORD_BANK = {
  th: ["the","their","there","they","then","through","thought","think","things","this","that","these","those","though","other","whether","rather"],
  he: ["the","they","then","here","where","these","whether","other","there","he","she","her","held","help","hence"],
  er: ["every","never","often","under","enter","order","ever","over","other","whether","rather","create","street","greater","together"],
  ea: ["great","treat","create","street","threat","breath","health","wealth","death","easy","read","each","already","ahead","reach"],
  re: ["great","create","street","threat","breath","already","reach","every","rather","where","there","prepared","required"],
  in: ["thinking","information","nation","station","attention","question","mention","string","strong","spring","ring","thing","king","sing","wing","within"],
  ti: ["attention","nation","station","question","mention","action","patient","entire","notice"],
  io: ["information","nation","station","attention","question","mention","action","motion"],
  on: ["information","nation","station","attention","question","mention","action","long","strong","wrong","gone","done","once","none","bone"],
  ng: ["string","strong","spring","bring","ring","thing","king","sing","wing","thinking","feeling","learning"],
  st: ["string","strong","spring","street","station","start","stop","still","step","star","state","store","story","stay","style","study"],
  tr: ["treat","create","street","threat","string","strong","spring","through","thought","travel","true","try","tree","train","trust","trouble"],
  pr: ["practice","programming","prepared","problem","process","program","project","provide","produce","properly"],
  ou: ["through","thought","about","house","found","could","would","should","count","mount","sound","round","doubt"],
  ow: ["brown","know","how","now","show","slow","flow","grow","allow","follow","below","throw","power"],
  de: ["deep","dead","dear","deal","deck","deem","deer","desk","debt","den","decide","develop","deliver","depend"],
  al: ["always","also","already","although","almost","along","allow","all","call","fall","hall","wall","small","shall","tall"],
  nt: ["want","front","hunt","grant","plant","print","point","count","mount","paint","meant","event","rent"],
  an: ["and","can","man","than","plan","span","scan","fan","ban","ran","hand","land","sand","stand","brand","grand"],
  en: ["then","when","often","enter","seven","eleven","open","even","never","every","been","seen","keen","green","queen"],
  le: ["people","little","middle","simple","single","table","able","cable","fable","able","eagle","example","purple"],
};

function generateDrills(slowPairs) {
  const drillWords = new Set();
  for (const pair of slowPairs.slice(0, 4)) {
    const clean = pair.trim().toLowerCase();
    if (WORD_BANK[clean]) {
      WORD_BANK[clean].forEach(w => drillWords.add(w));
    }
    for (const [key, words] of Object.entries(WORD_BANK)) {
      if (key.includes(clean) || clean.includes(key)) {
        words.forEach(w => drillWords.add(w));
      }
    }
    for (const [, words] of Object.entries(WORD_BANK)) {
      words.filter(w => w.includes(clean)).forEach(w => drillWords.add(w));
    }
  }
  const selected = [...drillWords].slice(0, 10);
  if (selected.length < 5) {
    ["the","their","through","thought","there","then","great","treat","things"].forEach(w => selected.push(w));
  }
  return [...new Set(selected)].slice(0, 10);
}

function computeMetrics(keystrokes, text, duration, targetWpm) {
  const transitions = {};
  const fingerLatencies = Array(8).fill(null).map(() => []);
  const keyLatencies = {};
  const keyErrors = {};
  let errors = 0;

  for (let i = 1; i < keystrokes.length; i++) {
    const prev = keystrokes[i - 1];
    const curr = keystrokes[i];
    const lat = curr.timestamp - prev.timestamp;
    if (lat > 0 && lat < 2000) {
      const fromKey = prev.key.toLowerCase();
      const toKey = curr.key.toLowerCase();
      if (/^[a-z]$/.test(fromKey) && /^[a-z]$/.test(toKey)) {
        const pair = fromKey + toKey;
        if (!transitions[pair]) transitions[pair] = [];
        transitions[pair].push(lat);
      }
      const fi = FINGER_MAP[toKey];
      if (fi !== undefined) fingerLatencies[fi].push(lat);
      if (/^[a-z ]$/.test(toKey)) {
        if (!keyLatencies[toKey]) keyLatencies[toKey] = [];
        keyLatencies[toKey].push(lat);
      }
    }
    if (!curr.correct) {
      errors++;
      const k = curr.key.toLowerCase();
      keyErrors[k] = (keyErrors[k] || 0) + 1;
    }
  }

  const digraphStats = {};
  for (const [pair, lats] of Object.entries(transitions)) {
    const avg = lats.reduce((a, b) => a + b, 0) / lats.length;
    digraphStats[pair] = { avg: Math.round(avg), count: lats.length };
  }

  const fingerStats = fingerLatencies.map(lats => {
    if (!lats.length) return { avg: 0, count: 0, score: 0 };
    const avg = lats.reduce((a, b) => a + b, 0) / lats.length;
    const score = Math.max(0, Math.min(100, Math.round(100 - (avg - 60) * 0.8)));
    return { avg: Math.round(avg), count: lats.length, score };
  });

  const keyHeatmap = {};
  for (const [k, lats] of Object.entries(keyLatencies)) {
    const avg = lats.reduce((a, b) => a + b, 0) / lats.length;
    keyHeatmap[k] = { avg: Math.round(avg), count: lats.length, errors: keyErrors[k] || 0 };
  }

  const words = text.trim().split(/\s+/).length;
  const durationMin = duration / 60000;
  const wpm = Math.round(words / Math.max(durationMin, 0.01));
  const totalKeys = keystrokes.length;
  const accuracy = totalKeys > 0 ? Math.round(((totalKeys - errors) / totalKeys) * 100) : 100;

  const sortedDigraphs = Object.entries(digraphStats)
    .filter(([, s]) => s.count >= 1)
    .sort((a, b) => b[1].avg - a[1].avg)
    .slice(0, 20);

  const tLat = Math.round(60000 / (targetWpm * 5));
  const currentLatency = totalKeys > 0 ? Math.round(duration / totalKeys) : 0;
  const wpmGap = targetWpm - wpm;

  const slowDigraphs = sortedDigraphs.slice(0, 6).map(([pair, s]) => ({
    pair,
    avg: s.avg,
    excess: Math.max(0, s.avg - tLat),
    count: s.count,
  }));

  const worstFingers = fingerStats
    .map((s, i) => ({ name: FINGER_NAMES[i], ...s, idx: i }))
    .filter(f => f.count > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  const drills = generateDrills(slowDigraphs.map(d => d.pair));

  const sameFinger = Object.entries(digraphStats)
    .filter(([pair]) => {
      const f1 = FINGER_MAP[pair[0]];
      const f2 = FINGER_MAP[pair[1]];
      return f1 !== undefined && f2 !== undefined && f1 === f2 && pair[0] !== pair[1];
    })
    .sort((a, b) => b[1].avg - a[1].avg)
    .slice(0, 8);

  return {
    wpm, accuracy, duration, errors, totalKeys,
    digraphStats, sortedDigraphs,
    fingerStats, keyHeatmap,
    targetLatency: tLat, currentLatency,
    wpmGap, slowDigraphs, worstFingers,
    drills, sameFinger,
  };
}

function latencyColor(avg, targetLatency) {
  if (avg === 0) return null;
  const ratio = avg / targetLatency;
  if (ratio <= 1) return { bg: "#1D9E75", text: "#fff" };
  if (ratio <= 1.5) return { bg: "#EF9F27", text: "#fff" };
  return { bg: "#E24B4A", text: "#fff" };
}

function HeatmapKey({ letter, data, targetLatency, maxAvg }) {
  const [tooltip, setTooltip] = useState(false);
  const avg = data?.avg || 0;
  const colors = latencyColor(avg, targetLatency);
  const bg = colors ? colors.bg : "var(--color-background-secondary)";
  const textCol = colors ? colors.text : "var(--color-text-secondary)";

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setTooltip(true)}
      onMouseLeave={() => setTooltip(false)}
    >
      <div style={{
        width: 52, height: 52,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        borderRadius: 8, background: bg,
        color: textCol, cursor: "default",
        border: "1px solid rgba(0,0,0,0.08)",
        transition: "transform 0.1s",
        transform: tooltip ? "scale(1.1)" : "scale(1)",
        zIndex: tooltip ? 2 : 1,
        position: "relative",
      }}>
        <span style={{ fontWeight: 600, fontSize: 16, lineHeight: 1 }}>{letter.toUpperCase()}</span>
        {avg > 0 && (
          <span style={{ fontSize: 11, opacity: 0.9, marginTop: 2, lineHeight: 1 }}>{avg}ms</span>
        )}
      </div>
      {tooltip && avg > 0 && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
          transform: "translateX(-50%)",
          background: "#1a1a2e", color: "#fff",
          padding: "8px 12px", borderRadius: 8,
          fontSize: 12, whiteSpace: "nowrap",
          zIndex: 999, pointerEvents: "none",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{letter.toUpperCase()} key</div>
          <div>Avg latency: <strong>{avg}ms</strong></div>
          <div>Target: <strong>{targetLatency}ms</strong></div>
          <div>Typed: <strong>{data.count}×</strong></div>
          {data.errors > 0 && <div style={{ color: "#F09595" }}>Errors: {data.errors}</div>}
          <div style={{
            marginTop: 4, fontSize: 11, color: avg > targetLatency ? "#F09595" : "#5DCAA5",
          }}>
            {avg > targetLatency ? `${avg - targetLatency}ms over target` : `${targetLatency - avg}ms under target`}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color, mono }) {
  return (
    <div style={{
      background: "var(--color-background-secondary)",
      borderRadius: "var(--border-radius-lg)",
      padding: "16px 20px",
      borderTop: color ? `3px solid ${color}` : "3px solid transparent",
    }}>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4, fontWeight: 500, letterSpacing: 0.3 }}>
        {label}
      </div>
      <div style={{
        fontSize: 28, fontWeight: 500, color: color || "var(--color-text-primary)",
        fontFamily: mono ? "var(--font-mono)" : undefined, lineHeight: 1.1,
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function TabBtn({ id, label, active, onClick }) {
  return (
    <button onClick={() => onClick(id)} style={{
      padding: "10px 18px", fontSize: 13, border: "none",
      background: active ? "var(--color-background-primary)" : "transparent",
      color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
      borderRadius: "var(--border-radius-md) var(--border-radius-md) 0 0",
      fontWeight: active ? 500 : 400, cursor: "pointer",
      borderBottom: active ? "2px solid #7F77DD" : "2px solid transparent",
      transition: "color 0.15s",
    }}>{label}</button>
  );
}

export default function TypeForge() {
  const [targetWpm, setTargetWpm] = useState(120);
  const [textIdx, setTextIdx] = useState(0);
  const text = SAMPLE_TEXTS[textIdx];

  const [typed, setTyped] = useState("");
  const [keystrokes, setKeystrokes] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState([]);
  const [liveWpm, setLiveWpm] = useState(0);
  const [view, setView] = useState("test");
  const [activeTab, setActiveTab] = useState("overview");

  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const keystrokesRef = useRef([]);
  keystrokesRef.current = keystrokes;

  const resetTest = useCallback((newIdx) => {
    const idx = newIdx !== undefined ? newIdx : (textIdx + 1) % SAMPLE_TEXTS.length;
    setTextIdx(idx);
    setTyped("");
    setKeystrokes([]);
    keystrokesRef.current = [];
    setStartTime(null);
    setIsRunning(false);
    setMetrics(null);
    setLiveWpm(0);
    setView("test");
    clearInterval(timerRef.current);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [textIdx]);

  useEffect(() => {
    if (isRunning && startTime) {
      timerRef.current = setInterval(() => {
        const elapsed = (performance.now() - startTime) / 60000;
        const words = typed.trim().split(/\s+/).filter(Boolean).length;
        setLiveWpm(Math.round(words / Math.max(elapsed, 0.001)));
      }, 400);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, startTime, typed]);

  const handleChange = useCallback((e) => {
    const val = e.target.value;
    if (val.length > text.length) return;

    const now = performance.now();
    if (!isRunning && val.length > 0) {
      setStartTime(now);
      setIsRunning(true);
    }

    const lastChar = val[val.length - 1];
    if (lastChar !== undefined) {
      const pos = val.length - 1;
      const correct = pos < text.length && lastChar === text[pos];
      const newKs = [...keystrokesRef.current, { key: lastChar, timestamp: now, correct, position: pos }];
      setKeystrokes(newKs);
      keystrokesRef.current = newKs;
    }

    setTyped(val);

    if (val.length >= text.length) {
      const endT = performance.now();
      setIsRunning(false);
      clearInterval(timerRef.current);
      const dur = endT - (startTime || endT);
      const m = computeMetrics(keystrokesRef.current, text, dur, targetWpm);
      setMetrics(m);
      setHistory(prev => [{
        date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        wpm: m.wpm, accuracy: m.accuracy,
        worstDigraph: m.slowDigraphs[0]?.pair || "—",
        id: Date.now(),
      }, ...prev.slice(0, 14)]);
      setTimeout(() => { setView("results"); setActiveTab("overview"); }, 200);
    }
  }, [isRunning, text, startTime, targetWpm]);

  const progress = text.length > 0 ? Math.min(1, typed.length / text.length) : 0;
  const expectedLatency = Math.round(60000 / (targetWpm * 5));
  const liveGap = liveWpm > 0 ? targetWpm - liveWpm : null;

  const maxKeyAvg = useMemo(() => {
    if (!metrics) return 200;
    const vals = Object.values(metrics.keyHeatmap).map(d => d.avg);
    return vals.length > 0 ? Math.max(...vals) : 200;
  }, [metrics]);

  return (
    <div style={{ fontFamily: "var(--font-sans)", maxWidth: 860, margin: "0 auto", padding: "0 0 4rem" }}>
      <h2 className="sr-only">TypeForge — Typing Performance Analytics</h2>

      {/* ── HEADER ── */}
      <div style={{
        padding: "1.5rem 0 1.25rem",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        marginBottom: "1.75rem",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 24, fontWeight: 500, letterSpacing: -0.5 }}>TypeForge</span>
            <span style={{
              fontSize: 11, fontFamily: "var(--font-mono)",
              color: "#7F77DD", background: "#EEEDFE",
              padding: "2px 8px", borderRadius: 20, fontWeight: 500,
            }}>BETA</span>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
            Diagnose every bottleneck. Train what actually matters.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)" }}>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Target</span>
            <select value={targetWpm} onChange={e => setTargetWpm(Number(e.target.value))} style={{ fontSize: 14, border: "none", background: "transparent", color: "var(--color-text-primary)", fontWeight: 500, cursor: "pointer" }}>
              {[60, 80, 100, 120, 140, 160, 180, 200].map(v => <option key={v} value={v}>{v} WPM</option>)}
            </select>
          </div>
          {view !== "test" && (
            <button onClick={() => resetTest()} style={{ fontSize: 13, padding: "7px 16px" }}>
              New test ↺
            </button>
          )}
          {history.length > 0 && view !== "history" && (
            <button onClick={() => setView("history")} style={{ fontSize: 13, padding: "7px 16px" }}>
              History ({history.length})
            </button>
          )}
        </div>
      </div>

      {/* ── TEST VIEW ── */}
      {view === "test" && (
        <div>
          {/* Live stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: "1.5rem" }}>
            <StatCard label="LIVE WPM" value={isRunning ? liveWpm : "—"} mono />
            <StatCard label="TARGET" value={`${targetWpm}`} sub="WPM goal" color="#7F77DD" mono />
            <StatCard
              label="GAP"
              value={liveGap !== null ? Math.abs(liveGap) : "—"}
              sub={liveGap !== null ? (liveGap > 0 ? "WPM behind" : "WPM ahead!") : "start typing"}
              color={liveGap !== null ? (liveGap > 0 ? "#E24B4A" : "#1D9E75") : undefined}
              mono
            />
            <StatCard label="KEY TARGET" value={`${expectedLatency}ms`} sub="per keystroke" mono />
          </div>

          {/* Progress */}
          <div style={{ height: 4, background: "var(--color-background-secondary)", borderRadius: 2, marginBottom: "1.25rem", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${progress * 100}%`,
              background: "linear-gradient(90deg, #7F77DD, #5DCAA5)",
              borderRadius: 2, transition: "width 0.1s linear",
            }} />
          </div>

          {/* Text display */}
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 19, lineHeight: 1.9,
            letterSpacing: 0.3, marginBottom: "1.25rem",
            padding: "1.5rem 1.75rem",
            background: "var(--color-background-primary)",
            border: "0.5px solid var(--color-border-secondary)",
            borderRadius: "var(--border-radius-lg)",
            userSelect: "none",
          }}>
            {text.split("").map((ch, i) => {
              const typedCh = typed[i];
              let col = "var(--color-text-secondary)";
              let bg = "transparent";
              if (typedCh !== undefined) col = typedCh === ch ? "#0F6E56" : "#A32D2D";
              if (typedCh !== undefined && typedCh !== ch) bg = "#FCEBEB";
              const isCursor = i === typed.length;
              return (
                <span key={i} style={{
                  color: col, background: isCursor ? "#EEEDFE" : bg,
                  borderLeft: isCursor ? "2px solid #7F77DD" : undefined,
                }}>{ch}</span>
              );
            })}
          </div>

          {/* Input */}
          <textarea
            ref={inputRef}
            value={typed}
            onChange={handleChange}
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

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>
              Keystroke timing captured automatically. Type the passage above exactly.
            </p>
            <button onClick={() => resetTest((textIdx + 1) % SAMPLE_TEXTS.length)} style={{ fontSize: 12, padding: "4px 12px" }}>
              New text ↺
            </button>
          </div>
        </div>
      )}

      {/* ── RESULTS VIEW ── */}
      {view === "results" && metrics && (
        <div>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: "1.75rem" }}>
            <StatCard label="WPM" value={metrics.wpm} sub="this session" color="#7F77DD" mono />
            <StatCard label="ACCURACY" value={`${metrics.accuracy}%`} sub={`${metrics.errors} error${metrics.errors !== 1 ? "s" : ""}`} color="#5DCAA5" mono />
            <StatCard label="TARGET WPM" value={targetWpm} sub="your goal" mono />
            <StatCard
              label="GAP TO CLOSE"
              value={Math.abs(metrics.wpmGap)}
              sub={metrics.wpmGap > 0 ? "WPM behind" : "Target reached! 🎉"}
              color={metrics.wpmGap > 0 ? "#E24B4A" : "#1D9E75"}
              mono
            />
            <StatCard label="AVG LATENCY" value={`${metrics.currentLatency}ms`} sub={`target: ${metrics.targetLatency}ms`} mono />
          </div>

          {/* Tab bar */}
          <div style={{
            display: "flex", gap: 2, overflowX: "auto",
            borderBottom: "0.5px solid var(--color-border-tertiary)",
            marginBottom: "1.5rem",
          }}>
            {[
              { id: "overview", label: "Overview" },
              { id: "digraphs", label: "Digraph analysis" },
              { id: "heatmap", label: "Keyboard heatmap" },
              { id: "fingers", label: "Finger analytics" },
              { id: "drills", label: "Personalized drills" },
            ].map(t => <TabBtn key={t.id} {...t} active={activeTab === t.id} onClick={setActiveTab} />)}
          </div>

          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 1rem" }}>Slowest digraph transitions</h3>
              {metrics.slowDigraphs.length === 0 && (
                <p style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>Not enough data — type a longer passage.</p>
              )}
              {metrics.slowDigraphs.map((d, i) => (
                <div key={d.pair} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 0", borderBottom: "0.5px solid var(--color-border-tertiary)",
                }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: "var(--color-background-secondary)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, color: "var(--color-text-secondary)",
                  }}>{i + 1}</span>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 600,
                    width: 44, letterSpacing: 4, color: "var(--color-text-primary)",
                  }}>{d.pair}</span>
                  <div style={{ flex: 1, height: 8, background: "var(--color-background-secondary)", borderRadius: 4 }}>
                    <div style={{
                      height: "100%", borderRadius: 4,
                      width: `${Math.min(100, (d.avg / 500) * 100)}%`,
                      background: d.avg > metrics.targetLatency * 1.5 ? "#E24B4A" : d.avg > metrics.targetLatency ? "#EF9F27" : "#1D9E75",
                    }} />
                  </div>
                  <div style={{ textAlign: "right", minWidth: 90 }}>
                    <div style={{
                      fontSize: 16, fontWeight: 500, fontFamily: "var(--font-mono)",
                      color: d.avg > metrics.targetLatency * 1.5 ? "#E24B4A" : d.avg > metrics.targetLatency ? "#EF9F27" : "#1D9E75",
                    }}>{d.avg}ms</div>
                    <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                      +{d.excess}ms over {metrics.targetLatency}ms target
                    </div>
                  </div>
                </div>
              ))}

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

              {/* Action plan */}
              <div style={{
                marginTop: "1.75rem", padding: "1.25rem 1.5rem",
                background: "var(--color-background-secondary)",
                borderRadius: "var(--border-radius-lg)",
                borderLeft: "3px solid #7F77DD",
              }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: "0.75rem", color: "var(--color-text-primary)" }}>
                  Fastest path to {targetWpm} WPM
                </div>
                <ol style={{ margin: 0, paddingLeft: "1.25rem", fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 2.2 }}>
                  {metrics.slowDigraphs.slice(0, 3).map(d => (
                    <li key={d.pair}>
                      Train{" "}
                      <code style={{
                        fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 15,
                        color: "var(--color-text-primary)",
                        background: "var(--color-background-primary)",
                        padding: "1px 6px", borderRadius: 4,
                      }}>{d.pair}</code>
                      {" "}→ reduce from{" "}
                      <span style={{ color: "#E24B4A", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{d.avg}ms</span>
                      {" "}to{" "}
                      <span style={{ color: "#1D9E75", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{metrics.targetLatency}ms</span>
                    </li>
                  ))}
                  {metrics.worstFingers[0] && (
                    <li>Improve {metrics.worstFingers[0].name} efficiency (current score: {metrics.worstFingers[0].score}/100)</li>
                  )}
                </ol>
              </div>
            </div>
          )}

          {/* ── DIGRAPHS ── */}
          {activeTab === "digraphs" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
                <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>All digraph latencies</h3>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Target: {metrics.targetLatency}ms per key</span>
              </div>
              <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 12, color: "var(--color-text-secondary)", flexWrap: "wrap" }}>
                {[{ col: "#1D9E75", label: `At target (≤${metrics.targetLatency}ms)` }, { col: "#EF9F27", label: "Slightly slow" }, { col: "#E24B4A", label: "Bottleneck" }].map(x => (
                  <span key={x.col} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: x.col, display: "inline-block" }} />
                    {x.label}
                  </span>
                ))}
              </div>
              {metrics.sortedDigraphs.slice(0, 18).map(([pair, s], i) => {
                const col = s.avg > metrics.targetLatency * 1.5 ? "#E24B4A" : s.avg > metrics.targetLatency ? "#EF9F27" : "#1D9E75";
                return (
                  <div key={pair} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    <span style={{ width: 22, fontSize: 11, color: "var(--color-text-secondary)", textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 600, width: 44, letterSpacing: 3 }}>{pair}</span>
                    <div style={{ flex: 1, height: 8, background: "var(--color-background-secondary)", borderRadius: 4 }}>
                      <div style={{ height: "100%", borderRadius: 4, width: `${Math.min(100, (s.avg / 400) * 100)}%`, background: col }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500, fontFamily: "var(--font-mono)", minWidth: 56, textAlign: "right", color: col }}>{s.avg}ms</span>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)", minWidth: 52 }}>{s.count} sample{s.count !== 1 ? "s" : ""}</span>
                  </div>
                );
              })}
              {metrics.sortedDigraphs.length === 0 && (
                <p style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>Type more to generate digraph data.</p>
              )}
            </div>
          )}

          {/* ── HEATMAP ── */}
          {activeTab === "heatmap" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Keyboard latency heatmap</h3>
                <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {[{ col: "#1D9E75", label: "Fast" }, { col: "#EF9F27", label: "Moderate" }, { col: "#E24B4A", label: "Slow" }, { col: "var(--color-background-secondary)", label: "No data", border: true }].map(x => (
                    <span key={x.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: x.col, border: x.border ? "1px solid var(--color-border-secondary)" : undefined, display: "inline-block" }} />
                      {x.label}
                    </span>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "1.25rem" }}>
                Hover any key to see exact latency stats. Colors show average inter-keystroke latency vs your {metrics.targetLatency}ms target.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                {QWERTY_ROWS.map((row, ri) => (
                  <div key={ri} style={{ display: "flex", gap: 5, paddingLeft: ri === 1 ? 26 : ri === 2 ? 52 : 0 }}>
                    {row.map(k => (
                      <HeatmapKey key={k} letter={k} data={metrics.keyHeatmap[k]} targetLatency={metrics.targetLatency} maxAvg={maxKeyAvg} />
                    ))}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 5, paddingLeft: 130 }}>
                  <div style={{
                    width: 220, height: 52, display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: 8, background: metrics.keyHeatmap[" "] ? "#1D9E75" : "var(--color-background-secondary)",
                    border: "1px solid rgba(0,0,0,0.08)",
                    fontSize: 13, color: metrics.keyHeatmap[" "] ? "#fff" : "var(--color-text-secondary)",
                    fontWeight: 500,
                  }}>
                    {metrics.keyHeatmap[" "] ? `space · ${metrics.keyHeatmap[" "].avg}ms` : "space"}
                  </div>
                </div>
              </div>

              {/* Slowest keys table */}
              <h3 style={{ fontSize: 15, fontWeight: 500, margin: "1.75rem 0 0.75rem" }}>Slowest individual keys</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                {Object.entries(metrics.keyHeatmap)
                  .filter(([k]) => /^[a-z]$/.test(k))
                  .sort((a, b) => b[1].avg - a[1].avg)
                  .slice(0, 8)
                  .map(([k, d]) => {
                    const col = d.avg > metrics.targetLatency * 1.5 ? "#E24B4A" : d.avg > metrics.targetLatency ? "#EF9F27" : "#1D9E75";
                    return (
                      <div key={k} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                        background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)",
                        borderLeft: `3px solid ${col}`,
                      }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 600, width: 20 }}>{k}</span>
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

          {/* ── FINGERS ── */}
          {activeTab === "fingers" && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 1.25rem" }}>Finger efficiency scores</h3>
              {metrics.fingerStats.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 80, fontSize: 12, color: "var(--color-text-secondary)", textAlign: "right", flexShrink: 0 }}>{FINGER_NAMES[i]}</div>
                  <div style={{ flex: 1, height: 20, background: "var(--color-background-secondary)", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{
                      width: `${f.score}%`, height: "100%", background: FINGER_COLORS[i],
                      borderRadius: 10, transition: "width 0.6s ease",
                    }} />
                  </div>
                  <div style={{ width: 56, fontSize: 13, fontWeight: 500, fontFamily: "var(--font-mono)", textAlign: "right" }}>
                    {f.count > 0 ? `${f.score}/100` : "—"}
                  </div>
                  <div style={{ width: 52, fontSize: 12, color: "var(--color-text-secondary)" }}>
                    {f.count > 0 ? `${f.avg}ms` : "no data"}
                  </div>
                </div>
              ))}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginTop: "1.5rem" }}>
                {metrics.fingerStats.map((f, i) => f.count > 0 && (
                  <div key={i} style={{
                    background: "var(--color-background-secondary)",
                    borderRadius: "var(--border-radius-md)",
                    padding: "14px 16px",
                    borderTop: `3px solid ${FINGER_COLORS[i]}`,
                  }}>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>{FINGER_NAMES[i]}</div>
                    <div style={{ fontSize: 22, fontWeight: 500, fontFamily: "var(--font-mono)" }}>{f.score}<span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>/100</span></div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{f.avg}ms avg · {f.count} keys</div>
                  </div>
                ))}
              </div>

              {metrics.sameFinger.length > 0 && (
                <>
                  <h3 style={{ fontSize: 15, fontWeight: 500, margin: "1.75rem 0 0.5rem" }}>Same-finger bigrams</h3>
                  <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 1rem", lineHeight: 1.6 }}>
                    These pairs force one finger to type twice in a row — a known speed bottleneck.
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {metrics.sameFinger.map(([pair, s]) => (
                      <div key={pair} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 14px",
                        background: "var(--color-background-secondary)",
                        border: "0.5px solid var(--color-border-secondary)",
                        borderRadius: "var(--border-radius-md)",
                      }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 600 }}>{pair}</span>
                        <span style={{ fontSize: 12, color: "#EF9F27", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{s.avg}ms</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── DRILLS ── */}
          {activeTab === "drills" && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 0.5rem" }}>Personalized drill</h3>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 1.25rem", lineHeight: 1.6 }}>
                Generated from your slowest digraphs:{" "}
                {metrics.slowDigraphs.slice(0, 3).map((d, i) => (
                  <span key={d.pair}>
                    {i > 0 && ", "}
                    <code style={{
                      fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 14,
                      color: "var(--color-text-primary)",
                      background: "var(--color-background-secondary)",
                      padding: "1px 6px", borderRadius: 4,
                    }}>{d.pair}</code>
                    <span style={{ fontSize: 12, color: "#E24B4A", marginLeft: 3 }}>({d.avg}ms)</span>
                  </span>
                ))}
              </p>

              {/* Drill text block */}
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 18, lineHeight: 2.4, letterSpacing: 0.5,
                padding: "1.5rem 2rem",
                background: "var(--color-background-secondary)",
                border: "0.5px solid var(--color-border-secondary)",
                borderRadius: "var(--border-radius-lg)",
                marginBottom: "1.5rem",
                color: "var(--color-text-primary)",
              }}>
                {metrics.drills.join("  ")}
                <br />
                {[...metrics.drills].reverse().join("  ")}
                <br />
                {metrics.drills.slice(0, 6).join("  ")}
              </div>

              {/* Three info cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                {/* Focus digraphs */}
                <div style={{ padding: "1rem 1.25rem", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", borderTop: "3px solid #7F77DD" }}>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10, fontWeight: 500 }}>Focus digraphs</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {metrics.slowDigraphs.slice(0, 5).map(d => (
                      <div key={d.pair} style={{ textAlign: "center" }}>
                        <div style={{
                          fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700,
                          padding: "6px 12px",
                          background: "var(--color-background-primary)",
                          border: "1px solid var(--color-border-secondary)",
                          borderRadius: 8, letterSpacing: 3,
                          color: "var(--color-text-primary)",
                          marginBottom: 3,
                        }}>{d.pair}</div>
                        <div style={{ fontSize: 11, color: "#E24B4A", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{d.avg}ms</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Session goal */}
                <div style={{ padding: "1rem 1.25rem", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", borderTop: "3px solid #EF9F27" }}>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8, fontWeight: 500 }}>Session goal</div>
                  {metrics.slowDigraphs[0] && (
                    <div style={{ fontSize: 14, lineHeight: 1.8, color: "var(--color-text-primary)" }}>
                      Reduce{" "}
                      <code style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 15, background: "var(--color-background-primary)", padding: "1px 6px", borderRadius: 4 }}>
                        {metrics.slowDigraphs[0].pair}
                      </code>
                      {" "}from{" "}
                      <span style={{ fontFamily: "var(--font-mono)", color: "#E24B4A", fontWeight: 600 }}>{metrics.slowDigraphs[0].avg}ms</span>
                      {" "}→{" "}
                      <span style={{ fontFamily: "var(--font-mono)", color: "#1D9E75", fontWeight: 600 }}>{metrics.targetLatency}ms</span>
                    </div>
                  )}
                </div>

                {/* Estimated time */}
                <div style={{ padding: "1rem 1.25rem", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", borderTop: "3px solid #5DCAA5" }}>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8, fontWeight: 500 }}>Estimated time to {targetWpm} WPM</div>
                  <div style={{ fontSize: 32, fontWeight: 500, fontFamily: "var(--font-mono)", color: "var(--color-text-primary)", lineHeight: 1 }}>
                    ~{Math.max(5, Math.round(Math.abs(metrics.wpmGap) / 3))}
                  </div>
                  <div style={{ fontSize: 14, color: "var(--color-text-secondary)", marginTop: 4 }}>days of focused practice</div>
                </div>
              </div>

              <button onClick={() => resetTest()} style={{ marginTop: "1.5rem", fontSize: 14, padding: "10px 24px" }}>
                Start practice session →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY VIEW ── */}
      {view === "history" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Session history</h3>
            <button onClick={() => setView(metrics ? "results" : "test")} style={{ fontSize: 13, padding: "6px 14px" }}>← Back</button>
          </div>

          {history.length === 0 ? (
            <p style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>Complete a typing test to see your history.</p>
          ) : (
            <>
              {history.length > 1 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: "1.5rem" }}>
                  <StatCard label="BEST WPM" value={Math.max(...history.map(h => h.wpm))} color="#1D9E75" mono />
                  <StatCard label="AVG WPM" value={Math.round(history.reduce((a, b) => a + b.wpm, 0) / history.length)} mono />
                  <StatCard label="BEST ACCURACY" value={`${Math.max(...history.map(h => h.accuracy))}%`} color="#5DCAA5" mono />
                  <StatCard label="SESSIONS" value={history.length} mono />
                </div>
              )}
              {history.map((h, i) => (
                <div key={h.id} style={{
                  display: "grid", gridTemplateColumns: "32px 1fr 100px 100px 100px",
                  gap: 12, padding: "12px 0",
                  borderBottom: "0.5px solid var(--color-border-tertiary)",
                  alignItems: "center",
                }}>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", textAlign: "right" }}>#{history.length - i}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{h.date}</div>
                  <div style={{ fontFamily: "var(--font-mono)" }}>
                    <span style={{ fontSize: 20, fontWeight: 500 }}>{h.wpm}</span>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginLeft: 3 }}>WPM</span>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)" }}>
                    <span style={{ fontSize: 16, fontWeight: 500 }}>{h.accuracy}%</span>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginLeft: 3 }}>acc</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    Worst:{" "}
                    <code style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-primary)", fontWeight: 600, fontSize: 13 }}>{h.worstDigraph}</code>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
