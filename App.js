import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ─── Theme ──────────────────────────────────────────────────────────────────
const C = {
  bg:       "#040d18",
  s1:       "#080f1e",
  s2:       "#0c1628",
  s3:       "#111e30",
  border:   "#16243a",
  border2:  "#1d3050",
  accent:   "#f59e0b",
  accentLo: "#1c1405",
  blue:     "#38bdf8",
  blueLo:   "#04141e",
  green:    "#22c55e",
  greenLo:  "#041208",
  red:      "#ef4444",
  redLo:    "#180606",
  purple:   "#a78bfa",
  purpleLo: "#12082a",
  text:     "#f0f4f8",
  sub:      "#8fa0b4",
  muted:    "#3d5068",
  gold:     "#fbbf24",
  teal:     "#2dd4bf",
};

const W = Dimensions.get("window").width;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function money(v) {
  const n = Number(v ?? 0);
  return `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pnlText(v) {
  const n = Number(v ?? 0);
  return `${n >= 0 ? "+" : "-"}₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function num(v) { return Number(v ?? 0).toFixed(2); }
function pct(v) { const n = Number(v ?? 0); if (!isFinite(n) || n <= 0) return "--"; return `${Math.round(n)}%`; }
function safeStr(v, fb = "--") {
  if (v == null || v === "") return fb;
  if (typeof v === "object") {
    const t = v.text || v.label || v.summary || v.value || v.name || v.reason;
    if (t) return String(t);
    try { return JSON.stringify(v); } catch { return fb; }
  }
  return String(v);
}
function connMode(url = "") {
  if (!url) return "OFFLINE";
  if (url.includes("100.")) return "TAILSCALE";
  if (url.includes("192.168") || url.includes("10.")) return "WIFI";
  if (url.includes("localhost") || url.includes("127.")) return "LOCAL";
  return "CLOUD";
}
function normalizeUrl(v) {
  let s = (v || "").trim().replace(/\/+$/, "");
  if (s && !s.startsWith("http")) s = "http://" + s;
  return s;
}
function reasonList(r) {
  if (!r) return "--";
  if (Array.isArray(r)) return r.map((x, i) => `${i + 1}. ${safeStr(x)}`).join("\n");
  return safeStr(r);
}


function lotSizeFor(symbol = "", explicitLotSize = 0) {
  const n = Number(explicitLotSize || 0);
  if (n > 0) return n;
  const sym = String(symbol || "").toUpperCase();
  if (sym.includes("BANKNIFTY")) return 35;
  if (sym.includes("SENSEX")) return 20;
  return 65; // NIFTY default
}

function qtyLotsText(qty, symbol = "", explicitLotSize = 0) {
  const q = Number(qty || 0);
  if (!q || !isFinite(q)) return "--";
  const lot = lotSizeFor(symbol, explicitLotSize);
  const lots = lot > 0 ? q / lot : 0;
  const lotsText = Number.isInteger(lots) ? String(lots) : lots.toFixed(2);
  return `Qty: ${q} / Lots: ${lotsText}`;
}

// ─── Reusable primitives ─────────────────────────────────────────────────────
function Tag({ label, color = C.blue, bg }) {
  return (
    <View style={{ backgroundColor: bg || C.blueLo, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: color + "55" }}>
      <Text style={{ color, fontSize: 10, fontWeight: "900", letterSpacing: 0.6 }}>{label}</Text>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: C.border, marginVertical: 8 }} />;
}

function Row({ children, style }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, style]}>{children}</View>;
}

function Card({ children, style, glow }) {
  return (
    <View style={[{
      backgroundColor: C.s1,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: glow ? glow + "66" : C.border,
      padding: 14,
      shadowColor: glow || "transparent",
      shadowOpacity: glow ? 0.15 : 0,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    }, style]}>
      {children}
    </View>
  );
}

function CardHeader({ title, right, sub }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Text style={{ color: C.sub, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" }}>{title}</Text>
        {right}
      </Row>
      {sub ? <Text style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

function StatBox({ label, value, color = C.text, sub }) {
  return (
    <View style={{ backgroundColor: C.s2, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, flex: 1 }}>
      <Text style={{ color: C.muted, fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</Text>
      <Text style={{ color, fontSize: 16, fontWeight: "900", marginTop: 4 }}>{value}</Text>
      {sub ? <Text style={{ color: C.muted, fontSize: 9, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

function PrimaryBtn({ label, onPress, color = C.accent, icon }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ backgroundColor: color + "22", borderRadius: 10, borderWidth: 1, borderColor: color + "55", paddingVertical: 12, alignItems: "center", flex: 1 }}>
      <Text style={{ color, fontSize: 12, fontWeight: "900" }}>{icon ? `${icon} ${label}` : label}</Text>
    </TouchableOpacity>
  );
}

function GhostBtn({ label, onPress, color = C.sub, icon }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ backgroundColor: C.s2, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingVertical: 11, alignItems: "center", flex: 1 }}>
      <Text style={{ color, fontSize: 11, fontWeight: "800" }}>{icon ? `${icon} ${label}` : label}</Text>
    </TouchableOpacity>
  );
}

// ─── App State ───────────────────────────────────────────────────────────────
const DEFAULT_URL = "http://127.0.0.1:18765";
const DEFAULT_TOKEN = "optionking-local";
const REFRESH_MS = 4000;

export default function App() {
  const [baseUrl, setBaseUrl]         = useState(DEFAULT_URL);
  const [apiToken, setApiToken]       = useState(DEFAULT_TOKEN);
  const [status, setStatus]           = useState(null);
  const [trades, setTrades]           = useState([]);
  const [logs, setLogs]               = useState([]);
  const [chartData, setChartData]     = useState(null);
  const [scan, setScan]               = useState(null);
  const [connected, setConnected]     = useState(false);
  const [loading, setLoading]         = useState(false);
  const [activeScreen, setActiveScreen] = useState("dashboard");
  const [activeInfoTab, setActiveInfoTab] = useState("live");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [statusPriceHistory, setStatusPriceHistory] = useState([]);
  const [urlInput, setUrlInput]       = useState(DEFAULT_URL);
  const [tokenInput, setTokenInput]   = useState(DEFAULT_TOKEN);
  const [backtestResult, setBacktestResult] = useState(null);
  const [backtestRunning, setBacktestRunning] = useState(false);
  const [aiExpanded, setAiExpanded]   = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [tradesExpanded, setTradesExpanded] = useState(false);
  const [manualExpanded, setManualExpanded] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    AsyncStorage.multiGet(["baseUrl", "apiToken"]).then(pairs => {
      const u = pairs[0][1], t = pairs[1][1];
      if (u) { setBaseUrl(u); setUrlInput(u); }
      if (t) { setApiToken(t); setTokenInput(t); }
    });
  }, []);

  const baseUrlRef  = useRef(baseUrl);
  const apiTokenRef = useRef(apiToken);
  const loadingRef  = useRef(false);

  useEffect(() => { baseUrlRef.current  = baseUrl;  }, [baseUrl]);
  useEffect(() => { apiTokenRef.current = apiToken; }, [apiToken]);

  async function apiFetch(path, opts = {}) {
    const res = await fetch(normalizeUrl(baseUrlRef.current) + path, {
      ...opts,
      headers: { "Content-Type": "application/json", "X-Api-Token": apiTokenRef.current, ...(opts.headers || {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function refreshAll(force = false) {
    if (loadingRef.current && !force) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const [s, t, l, c, sc] = await Promise.allSettled([
        apiFetch("/status"),
        apiFetch("/trades"),
        apiFetch("/logs"),
        apiFetch("/chart"),
        apiFetch("/scan"),
      ]);
      if (s.status === "fulfilled") {
        const val = s.value?.data ?? s.value;
        setStatus(val);
        setConnected(true);
        if (val?.nifty) setStatusPriceHistory(p => [...p.slice(-59), { price: Number(val.nifty), time: new Date().toLocaleTimeString() }]);
      } else {
        setConnected(false);
      }
      if (t.status === "fulfilled") {
        const val = t.value?.data ?? t.value;
        setTrades(Array.isArray(val) ? val : val?.trades || []);
      }
      if (l.status === "fulfilled") {
        const val = l.value?.data ?? l.value;
        setLogs(Array.isArray(val) ? val : val?.logs || []);
      }
      if (c.status === "fulfilled") setChartData(c.value?.data ?? c.value);
      if (sc.status === "fulfilled") setScan(sc.value?.data ?? sc.value);
    } catch {
      setConnected(false);
    }
    loadingRef.current = false;
    setLoading(false);
  }

  // Auto refresh — uses ref so interval always has fresh function
  const refreshRef = useRef(refreshAll);
  useEffect(() => { refreshRef.current = refreshAll; });

  useEffect(() => {
    refreshRef.current(true);
    if (!autoRefresh) return;
    const id = setInterval(() => refreshRef.current(), REFRESH_MS);
    return () => clearInterval(id);
  }, [baseUrl, apiToken, autoRefresh]);

  async function postJson(path, body, label) {
    try {
      await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
      setTimeout(() => refreshAll(true), 600);
    } catch (e) { Alert.alert("Error", `${label}: ${e.message}`); }
  }

  async function saveSettings() {
    const u = normalizeUrl(urlInput), t = tokenInput.trim();
    await AsyncStorage.multiSet([["baseUrl", u], ["apiToken", t]]);
    setBaseUrl(u); setApiToken(t);
    setTimeout(() => refreshAll(true), 300);
  }

  // ─── Dashboard screen ──────────────────────────────────────────────────────
  function DashboardScreen() {
    const s = status;
    const pnl = Number(s?.daily_pnl ?? 0);
    const signal = safeStr(s?.signal, s == null ? "..." : "WAIT");
    const score = s?.score != null ? `${s.score}/100` : "--";
    const isLive = s?.mode === "LIVE" || s?.trade_mode === "LIVE";
    const running = s?.running;
    const nifty = s?.nifty ? num(s.nifty) : "--";
    // Capital: use live_equity for LIVE mode, capital for PAPER
    const capitalVal = isLive
      ? (s?.live_equity || s?.capital || 0)
      : (s?.paper_capital || s?.capital || 0);
    const capitalStr = capitalVal ? `₹${Number(capitalVal).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "--";

    return (
      <>
        {/* ── Hero Status Bar ─── */}
        <Card glow={running ? (isLive ? C.green : C.blue) : null}>
          <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <Row style={{ gap: 8 }}>
              <View style={{
                width: 10, height: 10, borderRadius: 5,
                backgroundColor: connected ? (running ? C.green : C.blue) : C.red
              }} />
              <Text style={{ color: C.sub, fontSize: 11, fontWeight: "800" }}>
                {!connected ? "OFFLINE" : running ? (isLive ? "LIVE TRADING" : "PAPER MODE") : "BOT STOPPED"}
              </Text>
            </Row>
            <TouchableOpacity
              onPress={() => postJson("/stop", {}, "Emergency stop")}
              style={{ backgroundColor: C.redLo, borderRadius: 8, borderWidth: 1, borderColor: C.red + "66", paddingHorizontal: 14, paddingVertical: 7 }}>
              <Text style={{ color: C.red, fontSize: 11, fontWeight: "900" }}>■ EMERGENCY STOP</Text>
            </TouchableOpacity>
          </Row>

          <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
            <View>
              <Text style={{ color: C.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" }}>NIFTY 50</Text>
              <Text style={{ color: C.text, fontSize: 34, fontWeight: "900", letterSpacing: -1, marginTop: 2 }}>{nifty}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: C.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" }}>TODAY P&L</Text>
              <Text style={{ color: pnl >= 0 ? C.green : C.red, fontSize: 24, fontWeight: "900", marginTop: 2 }}>{pnlText(pnl)}</Text>
            </View>
          </Row>

          <Divider />

          <Row style={{ justifyContent: "space-between" }}>
            {[
              { l: "SIGNAL", v: signal, c: signal === "CE" ? C.green : signal === "PE" ? C.red : C.sub },
              { l: "SCORE",  v: score,  c: C.gold },
              { l: "CAPITAL", v: capitalStr, c: C.text },
              { l: "TRADES", v: `${s?.trades_today ?? 0}/${s?.max_trades ?? 3}`, c: C.blue },
            ].map(({ l, v, c }) => (
              <View key={l} style={{ alignItems: "center" }}>
                <Text style={{ color: C.muted, fontSize: 8, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>{l}</Text>
                <Text style={{ color: c, fontSize: 14, fontWeight: "900", marginTop: 3 }}>{v}</Text>
              </View>
            ))}
          </Row>
        </Card>

        {/* ── Open Position ─── */}
        <PositionCard position={s?.position} />

        {/* ── Quick Controls ─── */}
        <Card>
          <CardHeader title="Controls" />
          <Row style={{ marginBottom: 8 }}>
            <PrimaryBtn label="Start" icon="▶" color={C.green} onPress={() => postJson("/start", {}, "Start")} />
            <PrimaryBtn label="Stop"  icon="■" color={C.red}   onPress={() => postJson("/stop",  {}, "Stop")} />
            <PrimaryBtn label="Scan"  icon="◎" color={C.blue}  onPress={() => postJson("/scan",  {}, "Scan")} />
          </Row>
          <Row>
            <GhostBtn label="Close Position" icon="✕" onPress={() => postJson("/close-position", {}, "Close")} />
            <GhostBtn label="Refresh"        icon="↺" onPress={() => refreshAll(true)} />
          </Row>
        </Card>

        {/* ── AI Decision (collapsible) ─── */}
        <AiDecisionCard
          status={s}
          expanded={aiExpanded}
          onToggle={() => setAiExpanded(v => !v)}
        />

        {/* ── Trade Suggestion ─── */}
        <TradeSuggestionCard status={s} />

        {/* ── Live Logs ─── */}
        <Card>
          <TouchableOpacity onPress={() => setLogsExpanded(v => !v)}>
            <Row style={{ justifyContent: "space-between" }}>
              <Text style={{ color: C.sub, fontSize: 10, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" }}>Live Logs</Text>
              <Row style={{ gap: 8 }}>
                <Tag label={`${logs.length} lines`} color={C.blue} />
                <Text style={{ color: C.muted, fontSize: 12 }}>{logsExpanded ? "▲" : "▼"}</Text>
              </Row>
            </Row>
          </TouchableOpacity>
          <View style={{ marginTop: 10, gap: 3 }}>
            {(logsExpanded ? logs : logs.slice(-3)).reverse().map((line, i) => (
              <Text key={i} style={{ color: C.sub, fontSize: 11, fontFamily: "monospace", lineHeight: 17 }} numberOfLines={1}>
                <Text style={{ color: C.muted }}>› </Text>{line}
              </Text>
            ))}
          </View>
        </Card>

        {/* ── Trade Report ─── */}
        <CompactTradeReport trades={trades} expanded={tradesExpanded} onToggle={() => setTradesExpanded(v => !v)} />

        {/* ── Manual Trade ─── */}
        <Card>
          <TouchableOpacity onPress={() => setManualExpanded(v => !v)}>
            <Row style={{ justifyContent: "space-between" }}>
              <Text style={{ color: C.sub, fontSize: 10, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" }}>Manual Trade</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>{manualExpanded ? "▲" : "▼"}</Text>
            </Row>
          </TouchableOpacity>
          {manualExpanded && (
            <View style={{ marginTop: 12, gap: 8 }}>
              <Row>
                <PrimaryBtn label="Buy CE" icon="▲" color={C.green} onPress={() => postJson("/manual-buy", { signal: "CE" }, "CE")} />
                <PrimaryBtn label="Buy PE" icon="▼" color={C.red}   onPress={() => postJson("/manual-buy", { signal: "PE" }, "PE")} />
              </Row>
              <GhostBtn label="Close All Positions" icon="✕" onPress={() => postJson("/close-position", {}, "Close")} />
            </View>
          )}
        </Card>
      </>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={st.safe}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={st.page}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={st.header}>
          <Row style={{ gap: 10 }}>
            <View style={st.logo}>
              <Text style={st.logoText}>OK</Text>
            </View>
            <View>
              <Text style={st.headerTitle}>OPTION KING AI</Text>
              <Text style={st.headerSub}>F&O Intelligence Engine</Text>
            </View>
          </Row>
          <Row style={{ gap: 8 }}>
            {loading ? <ActivityIndicator color={C.accent} size="small" /> : null}
            <View style={[st.connBadge, connected ? st.connOn : st.connOff]}>
              <View style={[st.connDot, { backgroundColor: connected ? C.green : C.red }]} />
              <Text style={st.connText}>{connected ? connMode(baseUrl) : "OFFLINE"}</Text>
            </View>
          </Row>
        </View>

        {/* Tabs */}
        <NavTabs active={activeScreen} onChange={setActiveScreen} />

        {/* Screen content */}
        {activeScreen === "dashboard" && <DashboardScreen />}

        {activeScreen === "chart" && (
          <>
            <Card>
              <CardHeader title="NIFTY Chart" sub="Live 1-min price history" />
              <MiniPriceChart history={statusPriceHistory} status={status} />
            </Card>

            {/* Indicators card */}
            <Card>
              <CardHeader title="Live Indicators" sub="From NIFTY index candles" />
              {(() => {
                const ind = status?.indicators || {};
                const adxVal = ind.adx != null ? ind.adx.toFixed(2) : "--";
                const adxColor = ind.adx == null ? C.muted : ind.adx >= 25 ? C.green : ind.adx >= 18 ? C.gold : C.red;
                const rows = [
                  { l: "EMA 9",       v: ind.ema9  ? ind.ema9.toFixed(2)  : "--", c: C.blue },
                  { l: "EMA 21",      v: ind.ema21 ? ind.ema21.toFixed(2) : "--", c: C.purple },
                  { l: "VWAP",        v: ind.vwap  ? ind.vwap.toFixed(2)  : "--", c: C.gold },
                  { l: "Supertrend",  v: safeStr(ind.supertrend, "--"), c: ind.supertrend === "UP" ? C.green : ind.supertrend === "DOWN" ? C.red : C.sub },
                  { l: "ADX(14)",     v: adxVal,   c: adxColor },
                  { l: "+DI",         v: ind.adx_plus_di  != null ? ind.adx_plus_di.toFixed(2)  : "--", c: C.green },
                  { l: "-DI",         v: ind.adx_minus_di != null ? ind.adx_minus_di.toFixed(2) : "--", c: C.red },
                  { l: "ORB High",    v: ind.orb_high ? ind.orb_high.toFixed(2) : "--", c: C.green },
                  { l: "ORB Low",     v: ind.orb_low  ? ind.orb_low.toFixed(2)  : "--", c: C.red },
                  { l: "Day High",    v: ind.nifty_high ? ind.nifty_high.toFixed(2) : "--", c: C.text },
                  { l: "Day Low",     v: ind.nifty_low  ? ind.nifty_low.toFixed(2)  : "--", c: C.text },
                  { l: "Candles",     v: ind.candles != null ? `${ind.candles} (${ind.adx_ready ? "ADX ready" : "ADX building..."})` : "--", c: C.muted },
                ];
                return rows.map(({ l, v, c }) => (
                  <Row key={l} style={{ justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border }}>
                    <Text style={{ color: C.muted, fontSize: 12, fontWeight: "800" }}>{l}</Text>
                    <Text style={{ color: c, fontSize: 13, fontWeight: "900" }}>{v}</Text>
                  </Row>
                ));
              })()}
            </Card>
          </>
        )}

        {activeScreen === "backtest" && (
          <BacktestScreen apiFetch={apiFetch} />
        )}

        {activeScreen === "info" && (
          <InfoScreen status={status} trades={trades} logs={logs} activeInfoTab={activeInfoTab} setActiveInfoTab={setActiveInfoTab} />
        )}

        {activeScreen === "settings" && (
          <SettingsScreen
            urlInput={urlInput} setUrlInput={setUrlInput}
            tokenInput={tokenInput} setTokenInput={setTokenInput}
            autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh}
            baseUrl={baseUrl} onSave={saveSettings}
            status={status}
            postJson={postJson}
            apiFetch={apiFetch}
          />
        )}

        {/* Footer */}
        <Text style={st.footer}>
          {connected ? `● Connected  ${new Date().toLocaleTimeString()}` : "○ Disconnected"}
        </Text>

      </ScrollView>
    </View>
  );
}

// ─── Nav Tabs ─────────────────────────────────────────────────────────────────
function NavTabs({ active, onChange }) {
  const TABS = [
    { key: "dashboard", icon: "◈", label: "Dash" },
    { key: "chart",     icon: "◌", label: "Chart" },
    { key: "backtest",  icon: "◎", label: "Test" },
    { key: "info",      icon: "◉", label: "Info" },
    { key: "settings",  icon: "⊙", label: "Config" },
  ];
  return (
    <View style={{ flexDirection: "row", backgroundColor: C.s1, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 4, gap: 2 }}>
      {TABS.map(({ key, icon, label }) => {
        const isActive = active === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            style={{
              flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 9,
              backgroundColor: isActive ? C.s3 : "transparent",
            }}>
            <Text style={{ fontSize: 15, color: isActive ? C.accent : C.muted }}>{icon}</Text>
            <Text style={{ fontSize: 9, fontWeight: "900", marginTop: 2, color: isActive ? C.text : C.muted }}>
              {label}
            </Text>
            {isActive && <View style={{ position: "absolute", bottom: 2, width: 16, height: 2, borderRadius: 1, backgroundColor: C.accent }} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Position Card ─────────────────────────────────────────────────────────
function PositionCard({ position }) {
  if (!position?.symbol) {
    return (
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Text style={{ color: C.sub, fontSize: 10, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" }}>Open Position</Text>
          <Tag label="NONE" color={C.muted} />
        </Row>
        <Text style={{ color: C.muted, fontSize: 13, marginTop: 10, textAlign: "center" }}>No active position</Text>
      </Card>
    );
  }
  const pnl = Number(position.live_pnl ?? position.pnl ?? 0);
  const isProfit = pnl >= 0;
  return (
    <Card glow={isProfit ? C.green : C.red}>
      <Row style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={{ color: C.sub, fontSize: 10, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" }}>Open Position</Text>
        <Tag label={position.signal || "OPEN"} color={position.signal === "CE" ? C.green : C.red} />
      </Row>
      <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <Text style={{ color: C.text, fontSize: 14, fontWeight: "900" }}>{position.symbol}</Text>
        <Text style={{ color: isProfit ? C.green : C.red, fontSize: 20, fontWeight: "900" }}>{pnlText(pnl)}</Text>
      </Row>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {[
          { l: "Qty",    v: qtyLotsText(position.qty, position.symbol, position.lot_size || position.lotSize) },
          { l: "Entry",  v: money(position.entry) },
          { l: "LTP",    v: money(position.ltp) },
          { l: "SL",     v: money(position.sl),     c: C.red },
          { l: "Target", v: money(position.target), c: C.green },
        ].map(({ l, v, c }) => (
          <View key={l} style={{ backgroundColor: C.s2, borderRadius: 8, padding: 9, minWidth: "18%", borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.muted, fontSize: 8, fontWeight: "900", textTransform: "uppercase" }}>{l}</Text>
            <Text style={{ color: c || C.text, fontSize: 12, fontWeight: "900", marginTop: 3 }}>{v || "--"}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

// ─── AI Decision Card ────────────────────────────────────────────────────────
function AiDecisionCard({ status, expanded, onToggle }) {
  const d = status?.ai_decision || status?.last_ai_decision || {};
  const sg = status?.suggestion || {};
  const isLoading = status == null;

  const decision   = safeStr(d.decision || sg.signal, isLoading ? "..." : "WAIT");
  const confidence = pct(d.confidence || sg.confidence);
  const regime     = safeStr(d.market_regime || status?.market_regime, "--");
  const score      = status?.score != null ? `${status.score}/100` : "--";
  const summary    = safeStr((Array.isArray(d.reasons) ? d.reasons[0] : null) || d.reason || sg.reason || sg.summary || status?.suggestion_summary, isLoading ? "Loading..." : "Waiting for market data");
  const trend      = safeStr(d.trend || status?.trend, "--");
  const fakeRisk   = safeStr(d.fake_risk, "--");
  const gemini     = safeStr(d.gemini_status || d.gemini, "--");
  const recommend  = safeStr(d.recommendation || sg.summary || status?.suggestion_summary, "--");
  const fullReasons = reasonList(d.reasons || d.reason_list || d.details);

  // Score breakdown components
  const components = d.components || status?.score_components || sg.components || {};
  const compKeys = Object.keys(components);

  const isBuy  = decision === "BUY" || decision === "CE";
  const isSell = decision === "SELL" || decision === "PE";
  const decColor = isBuy ? C.green : isSell ? C.red : C.sub;

  return (
    <Card glow={isBuy ? C.green : isSell ? C.red : null}>
      <TouchableOpacity onPress={onToggle}>
        <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <Text style={{ color: C.sub, fontSize: 10, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" }}>AI Decision</Text>
          <Row style={{ gap: 8 }}>
            <View style={{ backgroundColor: decColor + "22", borderRadius: 8, borderWidth: 1, borderColor: decColor + "55", paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ color: decColor, fontSize: 13, fontWeight: "900" }}>{decision}</Text>
            </View>
            <Text style={{ color: C.muted, fontSize: 12 }}>{expanded ? "▲" : "▼"}</Text>
          </Row>
        </Row>
      </TouchableOpacity>

      {/* Always visible summary */}
      <View style={{ flexDirection: "row", gap: 7, marginBottom: 10 }}>
        {[
          { l: "Score", v: score, c: C.gold },
          { l: "Confidence", v: confidence, c: C.blue },
          { l: "Regime", v: regime, c: C.text },
        ].map(({ l, v, c }) => (
          <View key={l} style={{ flex: 1, backgroundColor: C.s2, borderRadius: 9, padding: 10, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.muted, fontSize: 8, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 }}>{l}</Text>
            <Text style={{ color: c, fontSize: 13, fontWeight: "900", marginTop: 3 }} numberOfLines={1}>{v}</Text>
          </View>
        ))}
      </View>

      <Text style={{ color: C.sub, fontSize: 12, lineHeight: 18 }} numberOfLines={expanded ? undefined : 2}>{summary}</Text>

      {/* Expanded */}
      {expanded && (
        <View style={{ marginTop: 12, gap: 8 }}>
          <Divider />

          {/* Score Breakdown */}
          {compKeys.length > 0 && (
            <View style={{ backgroundColor: C.s2, borderRadius: 9, padding: 11, borderWidth: 1, borderColor: C.border2 }}>
              <Text style={{ color: C.gold, fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Score Breakdown</Text>
              {compKeys.map(k => {
                const comp = components[k];
                const s = Number(comp?.score ?? comp ?? 0);
                const w = Number(comp?.weight ?? 0);
                const r = safeStr(comp?.reason, "");
                const label = k.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                const barW = Math.min(100, Math.round((s / Math.max(w, 1)) * 100));
                return (
                  <View key={k} style={{ marginBottom: 7 }}>
                    <Row style={{ justifyContent: "space-between", marginBottom: 3 }}>
                      <Text style={{ color: C.sub, fontSize: 11, fontWeight: "800" }}>{label}</Text>
                      <Text style={{ color: s > 0 ? C.green : C.muted, fontSize: 11, fontWeight: "900" }}>{s}/{w || "?"}</Text>
                    </Row>
                    <View style={{ height: 3, backgroundColor: C.border, borderRadius: 2 }}>
                      <View style={{ height: 3, width: `${barW}%`, backgroundColor: s > 0 ? C.green : C.border2, borderRadius: 2 }} />
                    </View>
                    {r ? <Text style={{ color: C.muted, fontSize: 9, marginTop: 2 }}>{r}</Text> : null}
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 7 }}>
            {[
              { l: "Trend", v: trend },
              { l: "Fake Risk", v: fakeRisk, c: fakeRisk === "HIGH" ? C.red : fakeRisk === "LOW" ? C.green : C.sub },
            ].map(({ l, v, c }) => (
              <View key={l} style={{ flex: 1, backgroundColor: C.s2, borderRadius: 9, padding: 10, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ color: C.muted, fontSize: 8, fontWeight: "900", textTransform: "uppercase" }}>{l}</Text>
                <Text style={{ color: c || C.text, fontSize: 13, fontWeight: "800", marginTop: 3 }}>{v}</Text>
              </View>
            ))}
          </View>
          <Row style={{ justifyContent: "space-between" }}>
            <Text style={{ color: C.muted, fontSize: 11 }}>Gemini</Text>
            <Text style={{ color: C.sub, fontSize: 11, fontWeight: "800" }}>{gemini}</Text>
          </Row>
          {fullReasons !== "--" && (
            <View style={{ backgroundColor: C.s2, borderRadius: 9, padding: 11, borderWidth: 1, borderColor: C.border2 }}>
              <Text style={{ color: C.blue, fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Analysis</Text>
              <Text style={{ color: C.sub, fontSize: 12, lineHeight: 19 }}>{fullReasons}</Text>
            </View>
          )}
          <View style={{ backgroundColor: C.greenLo, borderRadius: 9, padding: 11, borderWidth: 1, borderColor: C.green + "44" }}>
            <Text style={{ color: C.green, fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>Recommendation</Text>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "700", lineHeight: 20 }}>{recommend}</Text>
          </View>
        </View>
      )}
    </Card>
  );
}


// ─── Trade Suggestion Card ───────────────────────────────────────────────────
function TradeSuggestionCard({ status }) {
  const s = status?.suggestion || {};
  const isLoading = status == null;

  const signal  = safeStr(s.signal, isLoading ? "..." : "WAIT");
  const entry   = s.premium  ? money(s.premium)  : isLoading ? "..." : "--";
  const sl      = s.sl       ? money(s.sl)        : "--";
  const target  = s.target   ? money(s.target)    : "--";
  const symbol  = safeStr(s.symbol, "");
  const qty     = qtyLotsText(s.qty, s.symbol, s.lot_size || s.lotSize);
  const reason  = safeStr(s.reason || s.summary, isLoading ? "Loading..." : "No setup yet");

  let rr = "--";
  if (s.premium && s.sl && s.target) {
    const risk = Math.abs(Number(s.premium) - Number(s.sl));
    const reward = Math.abs(Number(s.target) - Number(s.premium));
    if (risk > 0) rr = `1 : ${(reward / risk).toFixed(1)}`;
  }

  const isCE = signal === "CE" || signal === "BUY";
  const isPE = signal === "PE" || signal === "SELL";
  const sigColor = isCE ? C.green : isPE ? C.red : C.sub;

  return (
    <Card>
      <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <Text style={{ color: C.sub, fontSize: 10, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" }}>Trade Suggestion</Text>
        <Tag label={signal} color={sigColor} />
      </Row>

      {symbol ? <Text style={{ color: C.blue, fontSize: 13, fontWeight: "900", marginBottom: 10 }}>{symbol}</Text> : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
        {[
          { l: "Entry",  v: entry,  c: C.text },
          { l: "Stop Loss", v: sl,  c: C.red },
          { l: "Target", v: target, c: C.green },
          { l: "Risk:Reward", v: rr, c: C.gold },
          { l: "Qty",    v: qty,    c: C.blue },
        ].map(({ l, v, c }) => (
          <View key={l} style={{ backgroundColor: C.s2, borderRadius: 9, padding: 10, width: "48%", borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.muted, fontSize: 8, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 }}>{l}</Text>
            <Text style={{ color: c, fontSize: 14, fontWeight: "900", marginTop: 3 }}>{v}</Text>
          </View>
        ))}
      </View>

      <View style={{ backgroundColor: C.s2, borderRadius: 9, padding: 10, borderWidth: 1, borderColor: C.border }}>
        <Text style={{ color: C.blue, fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>Reason</Text>
        <Text style={{ color: C.sub, fontSize: 12, lineHeight: 18 }}>{reason}</Text>
      </View>
    </Card>
  );
}

// ─── Compact Trade Report ────────────────────────────────────────────────────
function CompactTradeReport({ trades, expanded, onToggle }) {
  const closed = Array.isArray(trades) ? [...trades].reverse() : [];
  const pnls   = closed.map(t => Number(t.net_pnl ?? t.pnl ?? 0));
  const wins   = pnls.filter(p => p > 0);
  const losses = pnls.filter(p => p < 0);
  const total  = pnls.reduce((a, b) => a + b, 0);
  const wr     = pnls.length ? `${Math.round((wins.length / pnls.length) * 100)}%` : "--";
  const gp     = wins.reduce((a, b) => a + b, 0);
  const gl     = Math.abs(losses.reduce((a, b) => a + b, 0));
  const pf     = gl > 0 ? (gp / gl).toFixed(2) : wins.length ? "∞" : "--";

  const display = expanded ? closed : closed.slice(0, 3);

  return (
    <Card>
      <TouchableOpacity onPress={onToggle}>
        <Row style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <Text style={{ color: C.sub, fontSize: 10, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" }}>Trade Report</Text>
          <Row style={{ gap: 8 }}>
            <Tag label={`${closed.length} trades`} color={C.blue} />
            <Tag label={pnlText(total)} color={total >= 0 ? C.green : C.red} />
            <Text style={{ color: C.muted, fontSize: 12 }}>{expanded ? "▲" : "▼"}</Text>
          </Row>
        </Row>
      </TouchableOpacity>

      {closed.length > 0 && (
        <Row style={{ marginBottom: 10, gap: 6 }}>
          <StatBox label="Win Rate"     value={wr}               color={C.green} />
          <StatBox label="Profit Factor" value={pf}              color={C.gold} />
          <StatBox label="W / L"        value={`${wins.length} / ${losses.length}`} color={C.sub} />
        </Row>
      )}

      {display.map((t, i) => (
        <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: C.border }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 12, fontWeight: "900" }}>{t.symbol || "DEMO"}</Text>
            <Text style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>{t.date || "--"} · {t.signal || "--"} · Qty {t.qty || 0}</Text>
            <Text style={{ color: C.muted, fontSize: 10, marginTop: 1 }} numberOfLines={1}>{safeStr(t.reason, "--")}</Text>
          </View>
          <Text style={{ color: Number(t.net_pnl ?? t.pnl ?? 0) >= 0 ? C.green : C.red, fontSize: 14, fontWeight: "900" }}>
            {pnlText(t.net_pnl ?? t.pnl)}
          </Text>
        </View>
      ))}

      {!expanded && closed.length > 3 && (
        <TouchableOpacity onPress={onToggle} style={{ alignItems: "center", paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
          <Text style={{ color: C.blue, fontSize: 12, fontWeight: "900" }}>View All {closed.length} Trades ▼</Text>
        </TouchableOpacity>
      )}
      {closed.length === 0 && <Text style={{ color: C.muted, fontSize: 12, textAlign: "center", marginTop: 8 }}>No trades yet</Text>}
    </Card>
  );
}

// ─── Mini Price Chart ─────────────────────────────────────────────────────────
function MiniPriceChart({ history }) {
  if (!history || history.length < 2) {
    return <View style={{ height: 100, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: C.muted, fontSize: 12 }}>Waiting for data...</Text>
    </View>;
  }
  const prices = history.map(h => h.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const h = 100, w = W - 60;
  const pts = prices.map((p, i) => `${(i / (prices.length - 1)) * w},${h - ((p - min) / range) * h}`).join(" ");
  const last = prices[prices.length - 1];
  const first = prices[0];
  const isUp = last >= first;

  return (
    <View style={{ backgroundColor: C.s2, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.border }}>
      <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: "900" }}>{num(last)}</Text>
        <Tag label={`${isUp ? "+" : ""}${((last - first) / first * 100).toFixed(2)}%`} color={isUp ? C.green : C.red} />
      </Row>
      <View style={{ height: h + 4 }}>
        <View style={{ position: "absolute", left: 0, right: 0, height: h }}>
          {/* Simple polyline simulation with view dots */}
          <Row style={{ height: h, alignItems: "flex-end", gap: 1 }}>
            {prices.slice(-40).map((p, i) => {
              const barH = Math.max(2, ((p - min) / range) * (h - 10));
              return (
                <View key={i} style={{ flex: 1, height: barH, borderRadius: 1, backgroundColor: (isUp ? C.green : C.red) + "88" }} />
              );
            })}
          </Row>
        </View>
      </View>
      <Row style={{ justifyContent: "space-between", marginTop: 6 }}>
        <Text style={{ color: C.muted, fontSize: 9 }}>L: {num(min)}</Text>
        <Text style={{ color: C.muted, fontSize: 9 }}>H: {num(max)}</Text>
      </Row>
    </View>
  );
}

// ─── Backtest Screen ──────────────────────────────────────────────────────────
function BacktestScreen({ apiFetch }) {
  const [running, setRunning]   = useState(false);
  const [result, setResult]     = useState(null);
  const [report, setReport]     = useState(null);
  const [dateInput, setDateInput] = useState("");
  const [mode, setMode]         = useState("FAST");
  const [btType, setBtType]     = useState("daily"); // daily | monthly

  const todayStr = new Date().toISOString().split("T")[0];
  const thisMonth = todayStr.substring(0, 7); // YYYY-MM

  async function runBacktest() {
    setRunning(true);
    setResult(null);
    setReport(null);
    try {
      const isMonthly = btType === "monthly";
      const endpoint  = isMonthly ? "/backtest-month" : "/backtest";
      const body = isMonthly
        ? { mode, month: dateInput || thisMonth }
        : { mode, date: dateInput || todayStr };

      await apiFetch(endpoint, { method: "POST", body: JSON.stringify(body) }).catch(() => null);

      // Poll for result
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const r = await apiFetch(endpoint);
          const val = r?.data ?? r;
          const rpt = val?.report || val?.summary || "";
          if (!rpt || rpt.includes("running") || rpt.includes("not run")) {
            if (attempts > 25) { clearInterval(poll); setRunning(false); setResult("Timeout — check server logs"); }
            return;
          }
          clearInterval(poll);
          setRunning(false);
          setResult(val?.summary || "");
          setReport(rpt);
        } catch { /* keep polling */ }
      }, 3000);
    } catch (e) {
      setResult(`Error: ${e.message}`);
      setRunning(false);
    }
  }

  function parseReport(text) {
    if (!text) return null;
    const lines = text.split("\n");
    const get = (key) => {
      const line = lines.find(l => l.startsWith(key + ":") || l.startsWith(key + " :"));
      return line ? line.replace(key + ":", "").replace(key + " :", "").trim() : "--";
    };
    const tradeLines = lines.filter(l => l.match(/\|.*Entry|ENTRY|EXIT|CE|PE/i) && l.includes("|"));
    return {
      date: get("Date") !== "--" ? get("Date") : (btType === "monthly" ? (dateInput || thisMonth) : (dateInput || todayStr)),
      mode: get("Mode"),
      netPnl: get("Net P&L") !== "--" ? get("Net P&L") : get("Net PnL"),
      grossPnl: get("Gross P&L") !== "--" ? get("Gross P&L") : get("Gross PnL"),
      charges: get("Charges"),
      ret: get("Return"),
      trades: get("Trades"),
      wins: get("Wins"),
      losses: get("Losses"),
      winRate: get("Win Rate"),
      tradeLines,
      rawText: text,
    };
  }

  const parsed = parseReport(report);
  const pnlVal = parsed ? parseFloat((parsed.netPnl || "0").replace(/[₹,]/g, "")) : 0;

  return (
    <>
      <Card>
        <CardHeader title="Backtest" sub="Simulate strategy on historical data" />

        {/* Daily / Monthly toggle */}
        <Row style={{ marginBottom: 10, gap: 7 }}>
          {[["daily", "Daily"], ["monthly", "Monthly"]].map(([k, l]) => (
            <TouchableOpacity key={k} onPress={() => { setBtType(k); setResult(null); setReport(null); }}
              style={{ flex: 1, backgroundColor: btType === k ? C.blueLo : C.s2, borderRadius: 9, borderWidth: 1, borderColor: btType === k ? C.blue + "66" : C.border, paddingVertical: 10, alignItems: "center" }}>
              <Text style={{ color: btType === k ? C.blue : C.sub, fontSize: 12, fontWeight: "900" }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </Row>

        {/* Mode */}
        <Row style={{ marginBottom: 10, gap: 7 }}>
          {["FAST", "FULL"].map(m => (
            <TouchableOpacity key={m} onPress={() => setMode(m)}
              style={{ flex: 1, backgroundColor: mode === m ? C.accentLo : C.s2, borderRadius: 9, borderWidth: 1, borderColor: mode === m ? C.accent + "55" : C.border, paddingVertical: 10, alignItems: "center" }}>
              <Text style={{ color: mode === m ? C.accent : C.sub, fontSize: 12, fontWeight: "900" }}>{m}</Text>
            </TouchableOpacity>
          ))}
        </Row>

        {/* Date input */}
        <TextInput
          style={{ backgroundColor: C.s2, borderColor: C.border2, borderWidth: 1, borderRadius: 10, color: C.text, fontSize: 13, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 10 }}
          value={dateInput}
          onChangeText={setDateInput}
          placeholder={btType === "monthly" ? `Month YYYY-MM (default: ${thisMonth})` : `Date YYYY-MM-DD (default: ${todayStr})`}
          placeholderTextColor={C.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <PrimaryBtn
          label={running ? "⏳ Running..." : `▶  Run ${btType === "monthly" ? "Monthly" : "Daily"} ${mode} Backtest`}
          color={C.accent}
          onPress={running ? undefined : runBacktest}
        />
      </Card>

      {result && !parsed && (
        <Card>
          <Text style={{ color: result.startsWith("Error") || result.startsWith("Timeout") ? C.red : C.sub, fontSize: 12, lineHeight: 19 }}>{result}</Text>
        </Card>
      )}

      {parsed && (
        <>
          <Card glow={pnlVal >= 0 ? C.green : C.red}>
            <CardHeader title={`${parsed.mode !== "--" ? parsed.mode + " · " : ""}${parsed.date}`} />
            <Row style={{ gap: 7, marginBottom: 8 }}>
              <StatBox label="Net P&L"  value={`₹${parsed.netPnl}`}  color={pnlVal >= 0 ? C.green : C.red} />
              <StatBox label="Return"   value={parsed.ret}            color={pnlVal >= 0 ? C.green : C.red} />
            </Row>
            <Row style={{ gap: 7, marginBottom: 8 }}>
              <StatBox label="Trades"   value={parsed.trades}  color={C.blue} />
              <StatBox label="Win Rate" value={parsed.winRate} color={C.green} />
            </Row>
            <Row style={{ gap: 7 }}>
              <StatBox label="Wins"    value={parsed.wins}   color={C.green} />
              <StatBox label="Losses"  value={parsed.losses} color={C.red} />
            </Row>
            {(parsed.grossPnl !== "--" || parsed.charges !== "--") && (
              <>
                <Divider />
                <Row style={{ justifyContent: "space-between" }}>
                  <Text style={{ color: C.muted, fontSize: 11 }}>Gross P&L</Text>
                  <Text style={{ color: C.text, fontSize: 11, fontWeight: "800" }}>₹{parsed.grossPnl}</Text>
                </Row>
                <Row style={{ justifyContent: "space-between", marginTop: 5 }}>
                  <Text style={{ color: C.muted, fontSize: 11 }}>Charges</Text>
                  <Text style={{ color: C.red, fontSize: 11, fontWeight: "800" }}>₹{parsed.charges}</Text>
                </Row>
              </>
            )}
          </Card>

          {parsed.tradeLines.length > 0 && (
            <Card>
              <CardHeader title="Trades" sub={`${parsed.tradeLines.length} entries`} />
              {parsed.tradeLines.slice(0, 20).map((line, i) => {
                const parts = line.split("|").map(s => s.trim());
                const netPart = parts.find(p => /net|pnl/i.test(p)) || "";
                const netNum  = parseFloat(netPart.replace(/[^0-9.-]/g, "")) || 0;
                return (
                  <View key={i} style={{ paddingVertical: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: C.border }}>
                    <Row style={{ justifyContent: "space-between" }}>
                      <Text style={{ color: C.text, fontSize: 11, fontWeight: "900", flex: 1 }} numberOfLines={1}>{parts.slice(0, 3).join(" · ")}</Text>
                      <Text style={{ color: netNum >= 0 ? C.green : C.red, fontSize: 12, fontWeight: "900" }}>{netNum >= 0 ? "+" : ""}₹{Math.abs(netNum).toFixed(2)}</Text>
                    </Row>
                    <Text style={{ color: C.muted, fontSize: 10, marginTop: 2 }} numberOfLines={1}>{parts.slice(3).join(" · ")}</Text>
                  </View>
                );
              })}
            </Card>
          )}

          {/* Raw report fallback */}
          {parsed.tradeLines.length === 0 && parsed.rawText && (
            <Card>
              <CardHeader title="Report" />
              <Text style={{ color: C.sub, fontSize: 11, lineHeight: 18, fontFamily: "monospace" }}>{parsed.rawText.substring(0, 2000)}</Text>
            </Card>
          )}
        </>
      )}
    </>
  );
}

  async function runBacktest() {
    setRunning(true);
    setResult(null);
    setReport(null);
    try {
      // POST to start backtest
      const body = { mode, date: dateInput || todayStr };
      await apiFetch("/backtest", { method: "POST", body: JSON.stringify(body) });

      // Poll GET /backtest every 3s for result (max 60s)
      setPolling(true);
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const r = await apiFetch("/backtest");
          const rpt = r?.report || r?.data?.report || "";
          const smry = r?.summary || r?.data?.summary || "";
          // Not ready yet
          if (rpt.includes("running") || rpt.includes("not run yet")) {
            if (attempts > 20) { clearInterval(poll); setPolling(false); setRunning(false); }
            return;
          }
          clearInterval(poll);
          setPolling(false);
          setRunning(false);
          setResult(smry);
          setReport(rpt);
        } catch { /* keep polling */ }
      }, 3000);
    } catch (e) {
      setResult(`Error: ${e.message}`);
      setRunning(false);
    }
  }

  // Parse report text into structured data
  function parseReport(text) {
    if (!text) return null;
    const lines = text.split("\n");
    const get = (key) => {
      const line = lines.find(l => l.startsWith(key + ":"));
      return line ? line.replace(key + ":", "").trim() : "--";
    };
    const tradeLines = lines.filter(l => l.match(/^\d{2}:\d{2}:\d{2}/));
    return {
      date:     get("Date"),
      mode:     get("Mode"),
      netPnl:   get("Net P&L"),
      grossPnl: get("Gross P&L"),
      charges:  get("Charges"),
      ret:      get("Return"),
      trades:   get("Trades"),
      wins:     get("Wins"),
      losses:   get("Losses"),
      winRate:  get("Win Rate"),
      tradeLines,
    };
  }

  const parsed = parseReport(report);

// ─── Info Screen ──────────────────────────────────────────────────────────────
function InfoScreen({ status, trades, logs, activeInfoTab, setActiveInfoTab }) {
  const TABS = ["live", "risk", "reports", "health"];
  const s = status;

  return (
    <>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <TouchableOpacity key={t}
            onPress={() => setActiveInfoTab(t)}
            style={{ backgroundColor: activeInfoTab === t ? C.accentLo : C.s2, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: activeInfoTab === t ? C.accent + "55" : C.border }}>
            <Text style={{ color: activeInfoTab === t ? C.accent : C.sub, fontWeight: "900", fontSize: 12, textTransform: "uppercase" }}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeInfoTab === "live" && (
        <Card>
          <CardHeader title="Live Status" />
          {[
            ["Mode",        s?.mode || "--"],
            ["Running",     s?.running ? "YES" : "NO"],
            ["Capital",     money(s?.capital)],
            ["Live Equity", money(s?.live_equity || s?.capital)],
            ["NIFTY",       num(s?.nifty)],
            ["Signal",      safeStr(s?.signal, "WAIT")],
            ["Score",       s?.score != null ? `${s.score}/100` : "--"],
            ["Supertrend",  safeStr(s?.supertrend, "--")],
            ["Position",    s?.position?.symbol || "None"],
          ].map(([l, v]) => (
            <Row key={l} style={{ justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: "800" }}>{l}</Text>
              <Text style={{ color: C.text, fontSize: 12, fontWeight: "900" }}>{v}</Text>
            </Row>
          ))}
        </Card>
      )}

      {activeInfoTab === "risk" && (
        <Card>
          <CardHeader title="Risk Settings" />
          <Text style={{ color: C.sub, fontSize: 12, lineHeight: 19 }}>{safeStr(s?.risk_text || s?.risk_info, "Risk info not loaded")}</Text>
        </Card>
      )}

      {activeInfoTab === "reports" && (
        <Card>
          <CardHeader title="Reports" />
          <Text style={{ color: C.sub, fontSize: 12, lineHeight: 19 }}>{safeStr(s?.reports_text || s?.reports, "Reports not loaded")}</Text>
        </Card>
      )}

      {activeInfoTab === "health" && (
        <Card>
          <CardHeader title="System Health" />
          {[
            ["Angel One",  s?.health?.angel || "--"],
            ["Telegram",   s?.health?.telegram || "--"],
            ["Auto Start", s?.health?.auto_start_bot ? "ON" : "OFF"],
            ["Expiry Day", s?.expiry_day ? "YES" : "NO"],
            ["Position",   s?.health?.position_open ? "OPEN" : "NONE"],
          ].map(([l, v]) => (
            <Row key={l} style={{ justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: "800" }}>{l}</Text>
              <Text style={{ color: C.text, fontSize: 12, fontWeight: "900" }}>{v}</Text>
            </Row>
          ))}
          {/* Update status — only show if NOT auto-update-fail */}
          {s?.update_status?.summary && !s.update_status.summary.includes("Auto update failed") ? (
            <Row style={{ justifyContent: "space-between", paddingVertical: 7 }}>
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: "800" }}>Update</Text>
              <Text style={{ color: C.text, fontSize: 12, fontWeight: "900" }}>{s.update_status.summary}</Text>
            </Row>
          ) : null}
        </Card>
      )}
    </>
  );
}

// ─── Settings Screen ──────────────────────────────────────────────────────────
function SettingsScreen({ urlInput, setUrlInput, tokenInput, setTokenInput, autoRefresh, setAutoRefresh, baseUrl, onSave, status, postJson, apiFetch }) {
  const [capitalInput, setCapitalInput] = useState("");
  const [capitalSaving, setCapitalSaving] = useState(false);

  async function updateCapital() {
    const val = parseFloat(capitalInput);
    if (!val || val <= 0) { Alert.alert("Invalid", "Enter valid capital amount"); return; }
    setCapitalSaving(true);
    try {
      await apiFetch("/set-capital", { method: "POST", body: JSON.stringify({ capital: val }) });
      Alert.alert("Done", `Capital updated to ₹${val.toLocaleString("en-IN")}`);
      setCapitalInput("");
    } catch (e) {
      Alert.alert("Error", e.message);
    }
    setCapitalSaving(false);
  }

  return (
    <>
      <Card>
        <CardHeader title="Connection" />
        <TextInput style={st.input} value={urlInput} onChangeText={setUrlInput} placeholder="http://..." placeholderTextColor={C.muted} autoCapitalize="none" autoCorrect={false} />
        <TextInput style={[st.input, { marginBottom: 12 }]} value={tokenInput} onChangeText={setTokenInput} placeholder="API token" placeholderTextColor={C.muted} autoCapitalize="none" />
        <Row style={{ marginBottom: 12, justifyContent: "space-between" }}>
          <Text style={{ color: C.text, fontSize: 13, fontWeight: "800" }}>Auto Refresh (4s)</Text>
          <Switch value={autoRefresh} onValueChange={setAutoRefresh} trackColor={{ false: C.s3, true: C.accent + "88" }} thumbColor={autoRefresh ? C.accent : C.muted} />
        </Row>
        <Row style={{ marginBottom: 12, gap: 6 }}>
          {["Tailscale", "WiFi", "Cloud", "Local"].map(m => (
            <TouchableOpacity key={m} onPress={() => {
              const map = { Tailscale: "http://100.", WiFi: "http://192.168.", Cloud: "http://", Local: "http://127.0.0.1:18765" };
              setUrlInput(map[m]);
            }} style={{ flex: 1, backgroundColor: C.s2, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingVertical: 9, alignItems: "center" }}>
              <Text style={{ color: C.sub, fontSize: 10, fontWeight: "900" }}>{m}</Text>
            </TouchableOpacity>
          ))}
        </Row>
        <PrimaryBtn label="Save & Connect" icon="⚡" color={C.accent} onPress={onSave} />
      </Card>

      {/* Paper Capital Update */}
      <Card>
        <CardHeader title="Paper Capital" sub={`Current: ₹${Number(status?.paper_capital || status?.capital || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} />
        <TextInput
          style={st.input}
          value={capitalInput}
          onChangeText={setCapitalInput}
          placeholder="Enter new capital amount e.g. 50000"
          placeholderTextColor={C.muted}
          keyboardType="numeric"
        />
        <PrimaryBtn
          label={capitalSaving ? "Updating..." : "Update Paper Capital"}
          icon="₹"
          color={C.blue}
          onPress={capitalSaving ? undefined : updateCapital}
        />
      </Card>

      <Card>
        <CardHeader title="Trading Mode" />
        <Row style={{ marginBottom: 8 }}>
          <PrimaryBtn label="Paper Mode" icon="◌" color={C.blue}  onPress={() => postJson("/set-paper-mode", {}, "Paper")} />
          <PrimaryBtn label="Live Mode"  icon="◈" color={C.green} onPress={() => postJson("/set-live-mode",  {}, "Live")} />
        </Row>
        <Text style={{ color: C.muted, fontSize: 11, lineHeight: 17 }}>
          Live mode sends real orders to Angel One. Keep Live Safety switch ON before enabling.
        </Text>
        <Text style={{ color: C.sub, fontSize: 12, marginTop: 8, fontWeight: "800" }}>
          Current: {status?.mode || "--"} | Live Enabled: {status?.live_trading_enabled ? "YES" : "NO"}
        </Text>
      </Card>

      <Card>
        <CardHeader title="Server Info" sub="Termux setup" />
        <View style={{ backgroundColor: C.s2, borderRadius: 9, padding: 11, borderWidth: 1, borderColor: C.border }}>
          {["cd /sdcard/Download/cloud_bot", "bash ./termux_start.sh"].map((cmd, i) => (
            <Text key={i} style={{ color: C.teal, fontFamily: "monospace", fontSize: 12, marginBottom: 3 }}>{cmd}</Text>
          ))}
        </View>
      </Card>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  page:   { padding: 14, gap: 10, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  logo:   { width: 40, height: 40, borderRadius: 11, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  logoText:    { color: "#000", fontSize: 13, fontWeight: "900" },
  headerTitle: { color: C.text, fontSize: 16, fontWeight: "900", letterSpacing: 0.8 },
  headerSub:   { color: C.muted, fontSize: 10, fontWeight: "700", marginTop: 1 },
  connBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  connOn:    { backgroundColor: C.greenLo, borderColor: C.green + "44" },
  connOff:   { backgroundColor: C.redLo,   borderColor: C.red   + "44" },
  connDot:   { width: 6, height: 6, borderRadius: 3 },
  connText:  { color: C.text, fontSize: 10, fontWeight: "900" },
  input: { backgroundColor: C.s2, borderColor: C.border2, borderWidth: 1, borderRadius: 10, color: C.text, fontSize: 13, paddingHorizontal: 13, paddingVertical: 12, marginBottom: 9 },
  footer: { color: C.muted, fontSize: 10, fontWeight: "700", textAlign: "center", marginTop: 8 },
});
