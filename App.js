import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const DEFAULT_TAILSCALE_URL = "http://100.118.218.98:8765";
const DEFAULT_LOCAL_URL = "http://192.168.29.245:8765";
const DEFAULT_CLOUD_URL = "http://YOUR_CLOUD_IP:8765";
const DEFAULT_PHONE_SERVER_URL = "http://127.0.0.1:8765";
const DEFAULT_SERVER_PHONE_URL = DEFAULT_LOCAL_URL;
const DEFAULT_TOKEN = "optionking-local";
const REFRESH_MS = 3000;
const STORAGE_KEY = "optionKingMobileSettingsV3";
const APP_BUILD_LABEL = "1.0.0 build 13";
const DEFAULT_UPDATE_URL = "https://expo.dev/accounts/ayush2726/projects/option-king-ai-mobile";

function currentMonthText(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
const TERMUX_COMMANDS = `cd /sdcard/Download/cloud_bot
bash ./termux_setup.sh
nano config.json
bash ./termux_start.sh`;
const TERMUX_STATUS_COMMANDS = `cd /sdcard/Download/cloud_bot
bash ./termux_status.sh`;

export default function App() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_TAILSCALE_URL);
  const [apiToken, setApiToken] = useState(DEFAULT_TOKEN);
  const [status, setStatus] = useState(null);
  const [trades, setTrades] = useState([]);
  const [backtest, setBacktest] = useState(null);
  const [scan, setScan] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [statusPriceHistory, setStatusPriceHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [appUpdate, setAppUpdate] = useState(null);
  const [infoPanels, setInfoPanels] = useState({
    live: "Live Bot panel not loaded yet.",
    risk: "Risk panel not loaded yet.",
    reports: "Reports panel not loaded yet.",
    health: "Health panel not loaded yet.",
    settings: "Settings panel not loaded yet.",
  });
  const [activeInfo, setActiveInfo] = useState("live");
  const [activeScreen, setActiveScreen] = useState("dashboard");
  const [capitalInput, setCapitalInput] = useState("");
  const [backtestDate, setBacktestDate] = useState("");
  const [backtestMonth, setBacktestMonth] = useState(currentMonthText());
  const [backtestMode, setBacktestMode] = useState("FAST");
  const [loading, setLoading] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [tradesExpanded, setTradesExpanded] = useState(false);
  const [manualExpanded, setManualExpanded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState("Open. Press Refresh.");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    loadSavedSettings();
    return () => stopAutoRefresh();
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ baseUrl, apiToken })).catch(() => {});
  }, [baseUrl, apiToken, settingsLoaded]);

  useEffect(() => {
    if (autoRefresh) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
    return () => stopAutoRefresh();
  }, [autoRefresh, baseUrl, apiToken]);

  function startAutoRefresh() {
    stopAutoRefresh();
    refreshAll(false);
    timerRef.current = setInterval(() => refreshAll(false), REFRESH_MS);
  }

  function stopAutoRefresh() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function loadSavedSettings() {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.baseUrl) setBaseUrl(parsed.baseUrl);
        if (parsed.apiToken) setApiToken(parsed.apiToken);
      }
    } catch {
      setLastMessage("Saved settings could not be loaded.");
    } finally {
      setSettingsLoaded(true);
    }
  }

  async function apiFetch(path, options = {}) {
    const cleanUrl = normalizeServerUrl(baseUrl);
    const url = `${cleanUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Api-Token": apiToken.trim(),
        ...(options.headers || {}),
      },
    });
    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      const preview = raw ? raw.replace(/\s+/g, " ").slice(0, 140) : "empty response";
      throw new Error(`Invalid JSON from ${url}. Reply: ${preview}`);
    }
    if (!response.ok || !data.ok) throw new Error(friendlyApiError(data.error || "API error"));
    return data;
  }

  async function testConnection() {
    setLoading(true);
    try {
      setBaseUrl(normalizeServerUrl(baseUrl));
      const data = await apiFetch("/status");
      setConnected(true);
      const server = data?.data?.app || "Option King AI server";
      const running = data?.data?.running ? "RUNNING" : "STOPPED";
      const message = `Connected to ${server}. Bot ${running}.`;
      setLastMessage(message);
      Alert.alert("Connection OK", message);
    } catch (error) {
      setConnected(false);
      const message = friendlyNetworkError(error.message, normalizeServerUrl(baseUrl));
      setLastMessage(message);
      Alert.alert("Connection Failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshAll(showAlert = true) {
    setLoading(true);
    try {
      const statusData = await apiFetch("/status");
      const nextStatus = statusData.data;
      setStatus(nextStatus);
      setCapitalInput(String(nextStatus?.paper_capital || nextStatus?.capital || ""));
      updateStatusPriceHistory(nextStatus?.nifty);
      if (Array.isArray(nextStatus?.chart?.close) && nextStatus.chart.close.length > 1) {
        setChartData(nextStatus.chart);
      }
      setConnected(true);
      setLastMessage(`Connected ${new Date().toLocaleTimeString()}`);

      await Promise.all([
        loadOptional("/trades", (data) => setTrades(data.data || []), () => setTrades([])),
        loadOptional("/chart", (data) => setChartData(data.data), () => setChartData(null)),
        loadOptional("/backtest", (data) => setBacktest(data), () => setBacktest({ summary: nextStatus?.backtest_summary || "Backtest unavailable" })),
        loadOptional("/scan", (data) => setScan(data.data), () => setScan({ summary: "Scan unavailable", results: [] })),
        loadOptional("/logs", (data) => setLogs(data.data || []), () => setLogs(["Logs unavailable"])),
        loadOptional("/live", (data) => setInfoPanel("live", data.text), () => setInfoPanel("live", "Live Bot window unavailable")),
        loadOptional("/risk", (data) => setInfoPanel("risk", data.text), () => setInfoPanel("risk", "Risk window unavailable")),
        loadOptional("/reports", (data) => setInfoPanel("reports", data.text), () => setInfoPanel("reports", "Reports window unavailable")),
        loadOptional("/health", (data) => setInfoPanel("health", data.text), () => setInfoPanel("health", "Health window unavailable")),
        loadOptional("/settings-info", (data) => setInfoPanel("settings", data.text), () => setInfoPanel("settings", "Settings info unavailable")),
        loadOptional("/mobile-app-update", (data) => setAppUpdate(data.data || null), () => {}),
      ]);
    } catch (error) {
      setConnected(false);
      const message = friendlyNetworkError(error.message, baseUrl);
      setLastMessage(message);
      if (showAlert) Alert.alert("Connection Error", message);
    } finally {
      setLoading(false);
    }
  }

  async function loadOptional(path, onSuccess, onError) {
    try {
      const data = await apiFetch(path);
      onSuccess(data);
    } catch {
      onError();
    }
  }

  function setInfoPanel(key, text) {
    setInfoPanels((current) => ({ ...current, [key]: text || "No data." }));
  }

  function updateStatusPriceHistory(price) {
    const n = Number(price);
    if (!Number.isFinite(n) || n <= 0) return;
    setStatusPriceHistory((current) => {
      const last = current[current.length - 1];
      const next = last === n ? current : [...current, n];
      return next.slice(-60);
    });
  }

  async function postJson(path, body, label) {
    setLoading(true);
    try {
      const data = await apiFetch(path, { method: "POST", body: JSON.stringify(body || {}) });
      setLastMessage(data.message || `${label} requested`);
      setTimeout(() => refreshAll(false), 700);
    } catch (error) {
      setConnected(false);
      const message = friendlyNetworkError(error.message, baseUrl);
      setLastMessage(message);
      Alert.alert("Action Error", message);
    } finally {
      setLoading(false);
    }
  }

  function updateCapital() {
    const amount = Number(capitalInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Invalid Capital", "Enter capital greater than 0.");
      return;
    }
    postJson("/capital", { capital: amount }, "Capital update");
  }

  function runMobileBacktest(mode) {
    setBacktestMode(mode);
    setBacktest({ summary: `${mode} backtest running...`, report: "Backtest running. Refresh after a few seconds." });
    const serverMode = mode === "MONTHLY" ? "REAL_MONTHLY" : mode;
    const payload =
      mode === "MONTHLY"
        ? { mode: serverMode, month: backtestMonth.trim() || currentMonthText() }
        : { mode: serverMode, date: backtestDate.trim() };
    postJson("/backtest", payload, `${serverMode} backtest`);
    [1800, 4500, 9000, 18000, 30000].forEach((delay) => setTimeout(() => refreshAll(false), delay));
  }

  async function checkAppUpdate() {
    setLoading(true);
    try {
      const data = await apiFetch("/mobile-app-update");
      const update = data.data || {};
      setAppUpdate(update);
      const url = update.apk_url || DEFAULT_UPDATE_URL;
      const notes = update.release_notes ? `\n\n${update.release_notes}` : "";
      Alert.alert(
        "App Update",
        `Installed: ${APP_BUILD_LABEL}\nLatest: ${update.latest_version || "--"}${notes}`,
        [
          { text: "Later", style: "cancel" },
          { text: "Open Download", onPress: () => Linking.openURL(url) },
        ],
      );
    } catch (error) {
      const message = friendlyNetworkError(error.message, baseUrl);
      setLastMessage(message);
      Alert.alert("Update Check Failed", message);
    } finally {
      setLoading(false);
    }
  }

  function openAppUpdate() {
    Linking.openURL(appUpdate?.apk_url || DEFAULT_UPDATE_URL).catch((error) => {
      Alert.alert("Open Failed", String(error?.message || error));
    });
  }

  const pnlChart = buildPnlChart(trades);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => refreshAll(true)} tintColor="#55c7ff" />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Option King AI</Text>
            <Text style={styles.title}>Mobile Control</Text>
          </View>
          <View style={[styles.badge, connected ? styles.badgeGood : styles.badgeBad]}>
            <Text style={styles.badgeText}>{connected ? connectionMode(baseUrl) : "OFFLINE"}</Text>
          </View>
        </View>

        <ScreenTabs active={activeScreen} onChange={setActiveScreen} />

        {activeScreen === "dashboard" ? (
          <>
            {/* ── 1. TOP STATUS BAR ── */}
            <View style={styles.topBar}>
              <View style={[styles.statusPill,
                status?.running ? styles.statusPillLive :
                !connected      ? styles.statusPillOffline :
                styles.statusPillPaper]}>
                <Text style={styles.statusPillText}>
                  {!connected ? "OFFLINE" : status?.running ? (status?.mode === "LIVE" ? "LIVE" : "PAPER") : "STOPPED"}
                </Text>
              </View>
              <View style={styles.topBarCenter}>
                <Text style={styles.topNifty}>{number(status?.nifty)}</Text>
                <Text style={styles.topNiftyLabel}>NIFTY</Text>
              </View>
              <TouchableOpacity style={styles.emergencyPill} onPress={() => postJson("/stop", {}, "Emergency stop")}>
                <Text style={styles.emergencyPillText}>■ STOP</Text>
              </TouchableOpacity>
            </View>

            {/* ── 2. LIVE METRICS ROW ── */}
            <View style={styles.metricsRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricBoxLabel}>P&L</Text>
                <Text style={[styles.metricBoxValue, (status?.daily_pnl || 0) >= 0 ? styles.good : styles.bad]}>
                  {money(status?.daily_pnl)}
                </Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricBoxLabel}>Signal</Text>
                <Text style={[styles.metricBoxValue,
                  status?.signal === "CE" ? styles.good :
                  status?.signal === "PE" ? styles.bad : styles.neutral]}>
                  {status?.signal || (status == null ? "..." : "WAIT")}
                </Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricBoxLabel}>Score</Text>
                <Text style={styles.metricBoxValue}>
                  {status?.score != null ? `${status.score}/100` : (status == null ? "..." : "--")}
                </Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricBoxLabel}>Capital</Text>
                <Text style={styles.metricBoxValue}>{money(status?.capital)}</Text>
              </View>
            </View>

            {/* ── 3. OPEN POSITION (compact) ── */}
            <CompactPosition position={status?.position} />

            {/* ── 4. CONTROLS (compact) ── */}
            <View style={styles.controlsRow}>
              <TouchableOpacity style={[styles.ctrlBtn, styles.ctrlGreen]} onPress={() => postJson("/start", {}, "Start")}>
                <Text style={styles.ctrlText}>▶ Start</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ctrlBtn, styles.ctrlRed]} onPress={() => postJson("/stop", {}, "Stop")}>
                <Text style={styles.ctrlText}>■ Stop</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ctrlBtn, styles.ctrlBlue]} onPress={() => postJson("/scan", {}, "Scan")}>
                <Text style={styles.ctrlText}>⟳ Scan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ctrlBtn, styles.ctrlRed]} onPress={() => postJson("/close-position", {}, "Close position")}>
                <Text style={styles.ctrlText}>✕ Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ctrlBtn, styles.ctrlBlue]} onPress={() => refreshAll(true)}>
                <Text style={styles.ctrlText}>↺ Refresh</Text>
              </TouchableOpacity>
            </View>

            {/* ── 5. AI DECISION (collapsible) ── */}
            <CollapsibleAiCard
              status={status}
              expanded={aiExpanded}
              onToggle={() => setAiExpanded(v => !v)}
            />

            {/* ── 6. TRADE SUGGESTION (compact) ── */}
            <TradeSuggestionCard status={status} />

            {/* ── 7. LIVE LOGS (collapsed by default) ── */}
            <View style={styles.panel}>
              <TouchableOpacity style={styles.panelHeaderRow} onPress={() => setLogsExpanded(v => !v)}>
                <Text style={styles.panelTitle}>Live Logs</Text>
                <View style={styles.rowGap}>
                  <Text style={styles.modePill}>{logs.length} lines</Text>
                  <Text style={styles.expandChevron}>{logsExpanded ? "▲" : "▼"}</Text>
                </View>
              </TouchableOpacity>
              {logs.slice(-2).reverse().map((line, i) => (
                <Text key={i} style={styles.logLine} numberOfLines={1}>{line}</Text>
              ))}
              {logsExpanded && logs.length > 2 && logs.slice(0, -2).reverse().map((line, i) => (
                <Text key={`ex-${i}`} style={styles.logLine}>{line}</Text>
              ))}
              {logs.length === 0 ? <Text style={styles.body}>No logs yet</Text> : null}
            </View>

            {/* ── 8. TRADE REPORT (compact: 3 trades, expandable) ── */}
            <CompactTradeReport
              trades={trades}
              expanded={tradesExpanded}
              onToggle={() => setTradesExpanded(v => !v)}
            />

            {/* ── 9. MANUAL TRADE (collapsed by default) ── */}
            <View style={styles.panel}>
              <TouchableOpacity style={styles.panelHeaderRow} onPress={() => setManualExpanded(v => !v)}>
                <Text style={styles.panelTitle}>Manual Trade</Text>
                <Text style={styles.expandChevron}>{manualExpanded ? "▲" : "▼"}</Text>
              </TouchableOpacity>
              {manualExpanded ? (
                <View style={{ marginTop: 8, gap: 8 }}>
                  <View style={styles.row}>
                    <SmallButton title="Manual Buy CE" onPress={() => postJson("/manual-buy", { signal: "CE" }, "Manual CE")} green />
                    <SmallButton title="Manual Buy PE" onPress={() => postJson("/manual-buy", { signal: "PE" }, "Manual PE")} red />
                  </View>
                  <SmallButton title="Close Position" onPress={() => postJson("/close-position", {}, "Close position")} red />
                  <SmallButton title="Health Alert" onPress={() => postJson("/health-test", {}, "Health alert")} />
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {activeScreen === "chart" ? (
          <>
            <TradingChartCard chartData={chartData} status={status} statusPriceHistory={statusPriceHistory} tall />
            <ChartCard title={pnlChart.title} subtitle={pnlChart.subtitle} values={pnlChart.values} labels={pnlChart.labels} pnl />
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Chart Data</Text>
              <Text style={styles.body}>Source: {chartSource(chartData, statusPriceHistory)}</Text>
              <Text style={styles.body}>Candles: {Array.isArray(chartData?.close) ? chartData.close.length : 0} | Status points: {statusPriceHistory.length}</Text>
              <Text style={styles.body}>Last refresh: {chartData?.timestamp || status?.timestamp || "--"}</Text>
            </View>
          </>
        ) : null}

        {activeScreen === "backtest" ? (
          <View style={styles.panel}>
            <View style={styles.panelHeaderRow}>
              <Text style={styles.panelTitle}>Mobile Backtest</Text>
              <Text style={styles.modePill}>{backtestMode}</Text>
            </View>
            <Text style={styles.bodyStrong}>{backtest?.summary || status?.backtest_summary || "No backtest yet"}</Text>
            <TextInput
              value={backtestDate}
              onChangeText={setBacktestDate}
              placeholder="Date optional: YYYY-MM-DD"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              style={styles.input}
            />
            <View style={styles.row}>
              <SmallButton title="Latest Day" onPress={() => setBacktestDate("")} />
              <SmallButton title="Refresh" onPress={() => refreshAll(true)} blue />
            </View>
            <View style={styles.spacer} />
            <View style={styles.row}>
              <SmallButton title="Run FAST" onPress={() => runMobileBacktest("FAST")} blue />
              <SmallButton title="Run REAL" onPress={() => runMobileBacktest("REAL")} />
            </View>
            <View style={styles.spacer} />
            <TextInput
              value={backtestMonth}
              onChangeText={setBacktestMonth}
              placeholder="Month: YYYY-MM"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              style={styles.input}
            />
            <View style={styles.row}>
              <SmallButton title="This Month" onPress={() => setBacktestMonth(currentMonthText())} />
              <SmallButton title="Run MONTH" onPress={() => runMobileBacktest("MONTHLY")} green />
            </View>
            <View style={styles.spacer} />
            <SmallButton title="Refresh Angel Master" onPress={() => postJson("/master-cache", {}, "Master cache")} />
            <View style={styles.reportBox}>
              <Text style={styles.reportText}>{formatBacktestReport(backtest?.report)}</Text>
            </View>
          </View>
        ) : null}

        {activeScreen === "info" ? (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Information</Text>
              <View style={styles.tabRow}>
                <TabButton title="Live" active={activeInfo === "live"} onPress={() => setActiveInfo("live")} />
                <TabButton title="Risk" active={activeInfo === "risk"} onPress={() => setActiveInfo("risk")} />
                <TabButton title="Reports" active={activeInfo === "reports"} onPress={() => setActiveInfo("reports")} />
                <TabButton title="Health" active={activeInfo === "health"} onPress={() => setActiveInfo("health")} />
                <TabButton title="Settings" active={activeInfo === "settings"} onPress={() => setActiveInfo("settings")} />
              </View>
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>{trimText(infoPanels[activeInfo], activeInfo === "reports" ? 500 : 90)}</Text>
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Live Logs</Text>
              {logs.slice(-18).reverse().map((line, index) => (
                <Text key={`${line}-${index}`} style={styles.logLine}>{line}</Text>
              ))}
              {logs.length === 0 ? <Text style={styles.body}>No logs yet</Text> : null}
            </View>
          </>
        ) : null}

        {activeScreen === "settings" ? (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Connection</Text>
              <TextInput value={baseUrl} onChangeText={setBaseUrl} onBlur={() => setBaseUrl(normalizeServerUrl(baseUrl))} autoCapitalize="none" style={styles.input} />
              <TextInput value={apiToken} onChangeText={setApiToken} autoCapitalize="none" style={styles.input} />
              <View style={styles.row}>
                <SmallButton title="Tailscale" onPress={() => setBaseUrl(DEFAULT_TAILSCALE_URL)} green />
                <SmallButton title="WiFi" onPress={() => setBaseUrl(DEFAULT_SERVER_PHONE_URL)} />
                <SmallButton title="Cloud" onPress={() => setBaseUrl(DEFAULT_CLOUD_URL)} />
              </View>
              <View style={styles.spacer} />
              <View style={styles.row}>
                <SmallButton title="This Phone" onPress={() => setBaseUrl(DEFAULT_PHONE_SERVER_URL)} />
                <SmallButton title="Test URL" onPress={testConnection} green />
                <SmallButton title="Refresh" onPress={() => refreshAll(true)} blue />
              </View>
              <View style={styles.spacer} />
              <View style={styles.autoRow}>
                <Text style={styles.autoText}>Auto Refresh</Text>
                <Switch
                  value={autoRefresh}
                  onValueChange={setAutoRefresh}
                  trackColor={{ false: "#334155", true: "#14532d" }}
                  thumbColor={autoRefresh ? "#2ee59d" : "#94a3b8"}
                />
              </View>
              <Text style={styles.connectionHelp}>Tailscale works without same WiFi. WiFi works only when both phones are on the same network. URL/token auto-save.</Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Capital</Text>
              <TextInput value={capitalInput} onChangeText={setCapitalInput} keyboardType="numeric" style={styles.input} />
              <SmallButton title="Update Capital" onPress={updateCapital} blue />
            </View>

            <View style={styles.panel}>
              <View style={styles.panelHeaderRow}>
                <Text style={styles.panelTitle}>App Update</Text>
                <Text style={styles.modePill}>{APP_BUILD_LABEL}</Text>
              </View>
              <Text style={styles.body}>Latest: {appUpdate?.latest_version || "--"}</Text>
              <Text style={styles.connectionHelp}>{appUpdate?.release_notes || "Check for latest APK from your phone server."}</Text>
              <View style={styles.row}>
                <SmallButton title="Check Update" onPress={checkAppUpdate} blue />
                <SmallButton title="Download APK" onPress={openAppUpdate} green />
              </View>
              <Text style={styles.connectionHelp}>Android APK can be downloaded from here. Silent auto-install is not allowed outside Play Store, so install prompt will open manually.</Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Phone Server Setup</Text>
              <Text style={styles.bodyStrong}>Termux setup command:</Text>
              <View style={styles.commandBox}>
                <Text selectable style={styles.commandText}>{TERMUX_COMMANDS}</Text>
              </View>
              <Text style={styles.bodyStrong}>Server URL check:</Text>
              <View style={styles.commandBox}>
                <Text selectable style={styles.commandText}>{TERMUX_STATUS_COMMANDS}</Text>
              </View>
              <SmallButton title="Check Server Update" onPress={() => postJson("/server-update", {}, "Server update")} blue />
              <View style={styles.spacer} />
              <Text style={styles.body}>Update: {status?.update_status?.summary || "--"}</Text>
              <Text style={styles.connectionHelp}>Unauthorized = token mismatch. Offline = Termux server stopped, wrong IP, or Tailscale disconnected.</Text>
            </View>
          </>
        ) : null}

        <View style={styles.statusBox}>
          {loading ? <ActivityIndicator color="#55c7ff" /> : null}
          <Text style={styles.statusText}>{lastMessage}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function money(value) {
  const n = Number(value || 0);
  return `Rs ${n.toFixed(2)}`;
}

// Safely render any value — prevents [object Object]
function safeStr(value, fallback = "--") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") {
    // Try common text fields
    const text = value.text || value.label || value.summary || value.value || value.name || value.reason;
    if (text) return String(text);
    try { return JSON.stringify(value); } catch { return fallback; }
  }
  return String(value);
}

// Confidence: never show 0%, show -- if not calculated
function formatConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "--";
  return `${Math.round(n)}%`;
}

// Format a reason list (array or string)
function formatReasonList(reasons) {
  if (!reasons) return "--";
  if (Array.isArray(reasons)) {
    return reasons.map((r, i) => `${i + 1}. ${safeStr(r)}`).join("\n");
  }
  return safeStr(reasons);
}

function number(value) {
  if (value === null || value === undefined || value === "") return "--";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : String(value);
}

function trimText(text, maxLines) {
  if (!text) return "No data.";
  return String(text).split("\n").slice(0, maxLines).join("\n");
}

function formatPosition(position) {
  if (!position) return "No open position";
  return `${position.symbol}\n${position.signal} | ${position.trade_type}\nEntry ${money(position.entry)} | LTP ${money(position.ltp)}\nQty ${position.qty}\nSL ${money(position.sl)} | Target ${money(position.target)}`;
}

function formatSuggestion(suggestion) {
  if (!suggestion) return "No suggestion yet. Press Scan or wait for next decision.";
  const lines = [
    `Signal: ${suggestion.signal || "WAIT"} | Type: ${suggestion.trade_type || "NONE"} | Score: ${suggestion.score != null ? suggestion.score : "--"}/100`,
    `Supertrend: ${suggestion.supertrend || "--"} ${suggestion.supertrend_value ? `@ ${number(suggestion.supertrend_value)}` : ""}`,
    `Reason: ${suggestion.reason || "--"}`,
  ];
  if (suggestion.symbol) {
    lines.push(`Option: ${suggestion.symbol}`);
    lines.push(`Premium: ${money(suggestion.premium)} | Qty: ${suggestion.qty || 0} | Lot: ${suggestion.lot_size || "--"}`);
    lines.push(`Breakeven: ${money(suggestion.breakeven)} | Est. charges: ${money(suggestion.estimated_charges)}`);
    lines.push(`SL: ${money(suggestion.sl)} | Target: ${money(suggestion.target)}`);
  }
  return lines.join("\n");
}

function formatBacktestReport(report) {
  if (!report) return "No full report yet.";
  return trimText(report, 30);
}

function connectionMode(url) {
  const text = String(url);
  if (text.includes("100.118.218.98") || text.includes("100.")) return "TAILSCALE";
  if (text.includes("192.168.")) return "PHONE SERVER";
  if (text.includes("127.0.0.1") || text.includes("localhost")) return "THIS PHONE";
  if (text.includes("YOUR_CLOUD_IP")) return "CLOUD?";
  return "SERVER";
}

function friendlyApiError(message) {
  const text = String(message || "");
  if (text.toLowerCase().includes("unauthorized")) {
    return "Unauthorized: app token and server api_auth_token do not match.";
  }
  return text || "API error";
}

function friendlyNetworkError(message, url) {
  const text = String(message || "");
  if (text.toLowerCase().includes("network request failed") || text.toLowerCase().includes("failed to fetch")) {
    return `Offline: cannot reach ${String(url).trim()}. Check Termux server, Tailscale/WiFi, and port 8765.`;
  }
  if (text.toLowerCase().includes("unauthorized")) return friendlyApiError(text);
  return text || "Connection failed";
}

function normalizeServerUrl(value) {
  let text = String(value || DEFAULT_TAILSCALE_URL).trim();
  if (!text) text = DEFAULT_TAILSCALE_URL;
  text = text.replace(/\/+$/, "");
  text = text.replace(/\/(status|chart|health|trades|logs|scan|backtest|live|risk|reports|settings-info|update-status|server-update|mobile-app-update)$/i, "");
  return text || DEFAULT_TAILSCALE_URL;
}

function chartSource(chartData, statusPriceHistory) {
  const count = Array.isArray(chartData?.close) ? chartData.close.length : 0;
  if (chartData?.message === "OK" && count > 1) return "Live NIFTY candles";
  if (Array.isArray(statusPriceHistory) && statusPriceHistory.length > 1) return "Live NIFTY status stream";
  return "Fallback from trades/status";
}

function buildMainChart(chartData, trades, status, statusPriceHistory) {
  const close = Array.isArray(chartData?.close) ? chartData.close.map(Number).filter(Number.isFinite) : [];
  if (close.length > 1) {
    return {
      title: "NIFTY Live Chart",
      subtitle: `${chartData?.labels?.[0] || "--"} to ${chartData?.labels?.[chartData.labels.length - 1] || "--"} | Last ${number(close[close.length - 1])}`,
      values: close,
      labels: chartData?.labels || [],
    };
  }

  const statusPoints = Array.isArray(statusPriceHistory) ? statusPriceHistory.map(Number).filter(Number.isFinite) : [];
  if (statusPoints.length > 1) {
    return {
      title: "NIFTY Live Chart",
      subtitle: `Live status stream | Last ${number(statusPoints[statusPoints.length - 1])}`,
      values: statusPoints,
      labels: [],
    };
  }

  const equity = buildEquityValues(trades, status);
  if (equity.length > 1) {
    return {
      title: "Paper Equity Chart",
      subtitle: "Fallback until live candle chart endpoint is updated on server",
      values: equity,
      labels: [],
    };
  }

  const nifty = Number(status?.nifty || 0);
  return {
    title: "NIFTY Live Chart",
    subtitle: chartData?.message || "Waiting for market data",
    values: Number.isFinite(nifty) && nifty > 0 ? [nifty, nifty] : [],
    labels: [],
  };
}

function buildEquityValues(trades, status) {
  const start = Number(status?.paper_capital || status?.capital || 0);
  if (!Array.isArray(trades) || trades.length === 0 || !Number.isFinite(start)) return [];
  let equity = start;
  const values = [start];
  trades.slice(-40).forEach((trade) => {
    equity += Number(trade.net_pnl ?? trade.pnl ?? 0);
    values.push(equity);
  });
  return values;
}

function buildPnlChart(trades) {
  const values = Array.isArray(trades) ? trades.slice(-30).map((trade) => Number(trade.net_pnl ?? trade.pnl ?? 0)) : [];
  return {
    title: "Trade P&L Chart",
    subtitle: values.length ? "Last closed trades" : "No closed trades yet",
    values,
    labels: [],
  };
}

function AiDecisionCard({ status }) {
  const decision = status?.ai_decision || status?.last_ai_decision || {};
  const suggestion = status?.suggestion || {};
  const isLoading = status == null;

  const decisionText   = safeStr(decision.decision   || suggestion.signal, isLoading ? "Loading..." : "WAIT");
  const confidence     = formatConfidence(decision.confidence || suggestion.confidence);
  const regime         = safeStr(decision.market_regime || status?.market_regime, isLoading ? "Loading..." : "Waiting first candle");
  const trend          = safeStr(decision.trend || status?.trend, isLoading ? "Loading..." : "Waiting first candle");
  const fakeRisk       = safeStr(decision.fake_risk || decision.fake_signal_risk, isLoading ? "Loading..." : "--");
  const geminiStatus   = safeStr(decision.gemini_status || decision.gemini, isLoading ? "Loading..." : "--");
  const recommendation = safeStr(decision.recommendation || suggestion.summary || status?.suggestion_summary, isLoading ? "Loading..." : "No recommendation yet");
  const reasons        = formatReasonList(decision.reasons || decision.reason_list || decision.details);
  const decisionColor  = decisionText === "BUY" ? styles.good : decisionText === "SELL" ? styles.bad : decisionText === "WAIT" ? styles.neutral : styles.neutral;

  return (
    <View style={styles.aiCard}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>AI Decision Center</Text>
        <View style={[styles.decisionBadge,
          decisionText === "BUY"  ? styles.decisionBuy  :
          decisionText === "SELL" ? styles.decisionSell :
          styles.decisionWait]}>
          <Text style={styles.decisionBadgeText}>{decisionText}</Text>
        </View>
      </View>

      {/* Confidence + Regime row */}
      <View style={styles.aiMetricRow}>
        <View style={styles.aiMetricCell}>
          <Text style={styles.aiMetricLabel}>Confidence</Text>
          <Text style={[styles.aiMetricValue, confidence === "--" ? styles.neutral : styles.good]}>{confidence}</Text>
        </View>
        <View style={styles.aiMetricCell}>
          <Text style={styles.aiMetricLabel}>Market Regime</Text>
          <Text style={styles.aiMetricValue}>{regime}</Text>
        </View>
      </View>

      {/* Trend + Fake Risk row */}
      <View style={styles.aiMetricRow}>
        <View style={styles.aiMetricCell}>
          <Text style={styles.aiMetricLabel}>Trend</Text>
          <Text style={styles.aiMetricValue}>{trend}</Text>
        </View>
        <View style={styles.aiMetricCell}>
          <Text style={styles.aiMetricLabel}>Fake Risk</Text>
          <Text style={[styles.aiMetricValue, fakeRisk === "HIGH" ? styles.bad : fakeRisk === "LOW" ? styles.good : styles.neutral]}>{fakeRisk}</Text>
        </View>
      </View>

      {/* Gemini Status */}
      <View style={styles.aiRow}>
        <Text style={styles.aiRowLabel}>Gemini</Text>
        <Text style={styles.aiRowValue}>{geminiStatus}</Text>
      </View>

      {/* Reason List */}
      {reasons !== "--" ? (
        <View style={styles.aiReasonBox}>
          <Text style={styles.aiReasonTitle}>Analysis Details</Text>
          <Text style={styles.aiReasonText}>{reasons}</Text>
        </View>
      ) : null}

      {/* Recommendation */}
      <View style={styles.aiRecommendBox}>
        <Text style={styles.aiReasonTitle}>Recommendation</Text>
        <Text style={styles.aiRecommendText}>{recommendation}</Text>
      </View>
    </View>
  );
}

function TradeSuggestionCard({ status }) {
  const s = status?.suggestion || {};
  const isLoading = status == null;

  const signal    = safeStr(s.signal, isLoading ? "Loading..." : "WAIT");
  const entry     = s.premium    ? money(s.premium)    : isLoading ? "Loading..." : "--";
  const sl        = s.sl         ? money(s.sl)         : isLoading ? "Loading..." : "--";
  const target    = s.target     ? money(s.target)     : isLoading ? "Loading..." : "--";
  const reason    = safeStr(s.reason || s.summary, isLoading ? "Loading..." : "No setup yet");
  const symbol    = safeStr(s.symbol, "");
  const qty       = s.qty        ? String(s.qty)       : "--";
  const lotSize   = s.lot_size   ? String(s.lot_size)  : "--";

  // Risk:Reward
  let rr = "--";
  if (s.premium && s.sl && s.target) {
    const risk   = Math.abs(Number(s.premium) - Number(s.sl));
    const reward = Math.abs(Number(s.target)  - Number(s.premium));
    if (risk > 0) rr = `1 : ${(reward / risk).toFixed(1)}`;
  }

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>Trade Suggestion</Text>
        <View style={[styles.decisionBadge,
          signal === "CE" || signal === "BUY" ? styles.decisionBuy :
          signal === "PE" || signal === "SELL" ? styles.decisionSell :
          styles.decisionWait]}>
          <Text style={styles.decisionBadgeText}>{signal}</Text>
        </View>
      </View>

      {symbol ? <Text style={styles.suggSymbol}>{symbol}</Text> : null}

      <View style={styles.suggGrid}>
        <View style={styles.suggCell}>
          <Text style={styles.suggLabel}>Entry</Text>
          <Text style={styles.suggValue}>{entry}</Text>
        </View>
        <View style={styles.suggCell}>
          <Text style={styles.suggLabel}>Stop Loss</Text>
          <Text style={[styles.suggValue, styles.bad]}>{sl}</Text>
        </View>
        <View style={styles.suggCell}>
          <Text style={styles.suggLabel}>Target</Text>
          <Text style={[styles.suggValue, styles.good]}>{target}</Text>
        </View>
        <View style={styles.suggCell}>
          <Text style={styles.suggLabel}>Risk:Reward</Text>
          <Text style={styles.suggValue}>{rr}</Text>
        </View>
        <View style={styles.suggCell}>
          <Text style={styles.suggLabel}>Qty</Text>
          <Text style={styles.suggValue}>{qty}</Text>
        </View>
        <View style={styles.suggCell}>
          <Text style={styles.suggLabel}>Lot Size</Text>
          <Text style={styles.suggValue}>{lotSize}</Text>
        </View>
      </View>

      <View style={styles.aiReasonBox}>
        <Text style={styles.aiReasonTitle}>Reason</Text>
        <Text style={styles.aiReasonText}>{reason}</Text>
      </View>
    </View>
  );
}

function CompactPosition({ position }) {
  if (!position || !position.symbol) {
    return (
      <View style={styles.compactPosition}>
        <Text style={styles.noPositionText}>No open position</Text>
      </View>
    );
  }
  const pnl = Number(position.live_pnl ?? position.pnl ?? 0);
  return (
    <View style={[styles.compactPosition, styles.compactPositionActive]}>
      <View style={styles.posRow}>
        <Text style={styles.posSymbol}>{position.symbol}</Text>
        <Text style={[styles.posPnl, pnl >= 0 ? styles.good : styles.bad]}>{money(pnl)}</Text>
      </View>
      <View style={styles.posGrid}>
        <View style={styles.posCell}><Text style={styles.posCellLabel}>Qty</Text><Text style={styles.posCellValue}>{position.qty || "--"}</Text></View>
        <View style={styles.posCell}><Text style={styles.posCellLabel}>Entry</Text><Text style={styles.posCellValue}>{money(position.entry)}</Text></View>
        <View style={styles.posCell}><Text style={styles.posCellLabel}>LTP</Text><Text style={styles.posCellValue}>{money(position.ltp)}</Text></View>
        <View style={styles.posCell}><Text style={styles.posCellLabel}>SL</Text><Text style={[styles.posCellValue, styles.bad]}>{money(position.sl)}</Text></View>
        <View style={styles.posCell}><Text style={styles.posCellLabel}>Target</Text><Text style={[styles.posCellValue, styles.good]}>{money(position.target)}</Text></View>
      </View>
    </View>
  );
}

function CollapsibleAiCard({ status, expanded, onToggle }) {
  const decision   = status?.ai_decision || status?.last_ai_decision || {};
  const suggestion = status?.suggestion  || {};
  const isLoading  = status == null;

  const decisionText = safeStr(decision.decision || suggestion.signal, isLoading ? "..." : "WAIT");
  const confidence   = formatConfidence(decision.confidence || suggestion.confidence);
  const regime       = safeStr(decision.market_regime || status?.market_regime, isLoading ? "..." : "--");
  const score        = status?.score != null ? `${status.score}/100` : "--";
  const reasonSummary = safeStr(
    (Array.isArray(decision.reasons) ? decision.reasons[0] : null) ||
    decision.reason || suggestion.reason || suggestion.summary || status?.suggestion_summary,
    isLoading ? "Loading..." : "No reason yet"
  );
  const trend      = safeStr(decision.trend || status?.trend, "--");
  const fakeRisk   = safeStr(decision.fake_risk || decision.fake_signal_risk, "--");
  const gemini     = safeStr(decision.gemini_status || decision.gemini, "--");
  const recommend  = safeStr(decision.recommendation || suggestion.summary || status?.suggestion_summary, "--");
  const fullReasons = formatReasonList(decision.reasons || decision.reason_list || decision.details);

  const badgeStyle = decisionText === "BUY" || decisionText === "CE" ? styles.decisionBuy
    : decisionText === "SELL" || decisionText === "PE"               ? styles.decisionSell
    : styles.decisionWait;

  return (
    <View style={styles.aiCard}>
      {/* Header row — always visible, tap to expand */}
      <TouchableOpacity style={styles.panelHeaderRow} onPress={onToggle}>
        <Text style={styles.panelTitle}>AI Decision</Text>
        <View style={styles.rowGap}>
          <View style={[styles.decisionBadge, badgeStyle]}>
            <Text style={styles.decisionBadgeText}>{decisionText}</Text>
          </View>
          <Text style={styles.expandChevron}>{expanded ? "▲" : "▼"}</Text>
        </View>
      </TouchableOpacity>

      {/* Summary row — always visible */}
      <View style={styles.aiSummaryRow}>
        <View style={styles.aiSummaryCell}>
          <Text style={styles.aiMetricLabel}>Score</Text>
          <Text style={styles.aiMetricValue}>{score}</Text>
        </View>
        <View style={styles.aiSummaryCell}>
          <Text style={styles.aiMetricLabel}>Confidence</Text>
          <Text style={[styles.aiMetricValue, confidence === "--" ? styles.neutral : styles.good]}>{confidence}</Text>
        </View>
        <View style={styles.aiSummaryCell}>
          <Text style={styles.aiMetricLabel}>Regime</Text>
          <Text style={styles.aiMetricValue} numberOfLines={1}>{regime}</Text>
        </View>
      </View>
      <Text style={styles.aiReasonSummary} numberOfLines={expanded ? undefined : 2}>{reasonSummary}</Text>

      {/* Expanded details */}
      {expanded ? (
        <>
          <View style={styles.aiMetricRow}>
            <View style={styles.aiMetricCell}>
              <Text style={styles.aiMetricLabel}>Trend</Text>
              <Text style={styles.aiMetricValue}>{trend}</Text>
            </View>
            <View style={styles.aiMetricCell}>
              <Text style={styles.aiMetricLabel}>Fake Risk</Text>
              <Text style={[styles.aiMetricValue, fakeRisk === "HIGH" ? styles.bad : fakeRisk === "LOW" ? styles.good : styles.neutral]}>{fakeRisk}</Text>
            </View>
          </View>
          <View style={styles.aiRow}>
            <Text style={styles.aiRowLabel}>Gemini</Text>
            <Text style={styles.aiRowValue}>{gemini}</Text>
          </View>
          {fullReasons !== "--" ? (
            <View style={styles.aiReasonBox}>
              <Text style={styles.aiReasonTitle}>Analysis Details</Text>
              <Text style={styles.aiReasonText}>{fullReasons}</Text>
            </View>
          ) : null}
          <View style={styles.aiRecommendBox}>
            <Text style={styles.aiReasonTitle}>Recommendation</Text>
            <Text style={styles.aiRecommendText}>{recommend}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

function CompactTradeReport({ trades, expanded, onToggle }) {
  const closed = Array.isArray(trades) ? [...trades].reverse() : [];
  const pnls   = closed.map(t => Number(t.net_pnl ?? t.pnl ?? 0));
  const winners = pnls.filter(p => p > 0);
  const losers  = pnls.filter(p => p < 0);
  const winRate = pnls.length ? `${Math.round((winners.length / pnls.length) * 100)}%` : "--";
  const totalPnl = pnls.reduce((a, b) => a + b, 0);

  const displayTrades = expanded ? closed : closed.slice(0, 3);

  return (
    <View style={styles.panel}>
      <TouchableOpacity style={styles.panelHeaderRow} onPress={onToggle}>
        <Text style={styles.panelTitle}>Trade Report</Text>
        <View style={styles.rowGap}>
          <Text style={[styles.modePill, totalPnl >= 0 ? styles.modePillGood : styles.modePillBad]}>
            {money(totalPnl)}
          </Text>
          <Text style={styles.modePill}>{closed.length} trades</Text>
          <Text style={styles.expandChevron}>{expanded ? "▲" : "▼"}</Text>
        </View>
      </TouchableOpacity>

      {/* Mini stats always visible */}
      {closed.length > 0 ? (
        <View style={styles.miniStatsRow}>
          <Text style={styles.miniStat}>Win <Text style={styles.good}>{winRate}</Text></Text>
          <Text style={styles.miniStat}>W <Text style={styles.good}>{winners.length}</Text></Text>
          <Text style={styles.miniStat}>L <Text style={styles.bad}>{losers.length}</Text></Text>
        </View>
      ) : null}

      {displayTrades.map((trade, index) => (
        <View key={`${trade.time}-${index}`} style={styles.tradeRowCompact}>
          <View style={styles.tradeTextBlock}>
            <Text style={styles.tradeSymbol} numberOfLines={1}>{trade.symbol || "DEMO"}</Text>
            <Text style={styles.tradeMeta}>{trade.date || "--"} | {trade.signal || "--"} | Qty {trade.qty || 0}</Text>
            <Text style={styles.tradeMeta}>{safeStr(trade.reason, "--")}</Text>
          </View>
          <Text style={[styles.tradePnl, Number(trade.net_pnl ?? trade.pnl ?? 0) >= 0 ? styles.good : styles.bad]}>
            {money(trade.net_pnl ?? trade.pnl)}
          </Text>
        </View>
      ))}

      {!expanded && closed.length > 3 ? (
        <TouchableOpacity onPress={onToggle} style={styles.viewAllBtn}>
          <Text style={styles.viewAllText}>View All {closed.length} Trades ▼</Text>
        </TouchableOpacity>
      ) : null}
      {closed.length === 0 ? <Text style={styles.body}>No trades yet</Text> : null}
    </View>
  );
}

function ScreenTabs({ active, onChange }) {
  const tabs = [
    ["dashboard", "Dash"],
    ["chart", "Chart"],
    ["backtest", "Backtest"],
    ["info", "Info"],
    ["settings", "Settings"],
  ];
  return (
    <View style={styles.screenTabs}>
      {tabs.map(([key, label]) => (
        <TouchableOpacity key={key} style={[styles.screenTab, active === key && styles.screenTabActive]} onPress={() => onChange(key)}>
          <Text style={[styles.screenTabText, active === key && styles.screenTabTextActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function buildCandles(chartData, statusPriceHistory, status) {
  const open = Array.isArray(chartData?.open) ? chartData.open.map(Number) : [];
  const high = Array.isArray(chartData?.high) ? chartData.high.map(Number) : [];
  const low = Array.isArray(chartData?.low) ? chartData.low.map(Number) : [];
  const close = Array.isArray(chartData?.close) ? chartData.close.map(Number) : [];
  const labels = Array.isArray(chartData?.labels) ? chartData.labels : [];
  const timestamps = Array.isArray(chartData?.timestamps) ? chartData.timestamps : [];
  const count = Math.min(open.length, high.length, low.length, close.length);
  if (count > 1) {
    const windowSize = Math.min(count, 240);
    return close.slice(-windowSize).map((_, index, slicedClose) => {
      const sourceIndex = count - slicedClose.length + index;
      return {
        open: open[sourceIndex],
        high: high[sourceIndex],
        low: low[sourceIndex],
        close: close[sourceIndex],
        label: labels[sourceIndex] || "",
        timestamp: timestamps[sourceIndex] || labels[sourceIndex] || "",
      };
    }).filter((c) => [c.open, c.high, c.low, c.close].every(Number.isFinite));
  }

  const points = Array.isArray(statusPriceHistory) ? statusPriceHistory.map(Number).filter(Number.isFinite).slice(-180) : [];
  if (points.length > 1) {
    return points.map((price, index) => {
      const prev = index > 0 ? points[index - 1] : price;
      return {
        open: prev,
        high: Math.max(prev, price),
        low: Math.min(prev, price),
        close: price,
        label: "",
        timestamp: "",
      };
    });
  }

  const nifty = Number(status?.nifty || 0);
  if (Number.isFinite(nifty) && nifty > 0) {
    return [{ open: nifty, high: nifty, low: nifty, close: nifty, label: "", timestamp: "" }];
  }
  return [];
}

function TradingChartCard({ chartData, status, statusPriceHistory, tall }) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const candles = buildCandles(chartData, statusPriceHistory, status);
  const lows = candles.map((c) => c.low);
  const highs = candles.map((c) => c.high);
  const min = lows.length ? Math.min(...lows) : 0;
  const max = highs.length ? Math.max(...highs) : 0;
  const range = max - min || 1;
  const first = candles[0];
  const last = candles[candles.length - 1];
  const change = first && last ? last.close - first.open : 0;
  const changePct = first?.open ? (change / first.open) * 100 : 0;
  const up = change >= 0;
  const ema9 = lastValue(chartData?.ema9);
  const ema21 = lastValue(chartData?.ema21);
  const vwap = lastValue(chartData?.vwap);
  const supertrend = lastValue(chartData?.supertrend);
  const supertrendDir = Array.isArray(chartData?.supertrend_dir) ? chartData.supertrend_dir[chartData.supertrend_dir.length - 1] : status?.supertrend;
  const source = chartSource(chartData, statusPriceHistory);
  const startLabel = candles.find((c) => c.label)?.label || "--";
  const endLabel = [...candles].reverse().find((c) => c.label)?.label || "--";
  const chartWidth = Math.max(760, candles.length * 12);
  const currentBottom = last ? ((last.close - min) / range) * 100 : 0;
  const mid = min + range / 2;
  const labelEvery = Math.max(1, Math.ceil(candles.length / 5));
  const selectedCandle = selectedIndex !== null && candles[selectedIndex] ? candles[selectedIndex] : last;
  const selectedText = selectedCandle
    ? `${selectedCandle.timestamp || selectedCandle.label || "--"} | O ${number(selectedCandle.open)} H ${number(selectedCandle.high)} L ${number(selectedCandle.low)} C ${number(selectedCandle.close)}`
    : "Tap a candle to see exact day/time and OHLC";

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>NIFTY Trading Chart</Text>
        <Text style={[styles.modePill, up ? styles.modePillGood : styles.modePillBad]}>{last ? number(last.close) : "--"}</Text>
      </View>
      <Text style={styles.chartSubtitle}>{source} | {startLabel} to {endLabel} | {change >= 0 ? "+" : ""}{number(change)} ({changePct.toFixed(2)}%)</Text>
      <View style={[styles.chartWithScale, tall && styles.chartAreaTall]}>
        <View style={styles.priceScale}>
          <Text style={styles.scaleText}>{number(max)}</Text>
          <Text style={styles.scaleText}>{number(mid)}</Text>
          <Text style={styles.scaleText}>{number(min)}</Text>
        </View>
        <ScrollView
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator
          contentContainerStyle={[styles.tradingChartArea, tall && styles.chartAreaTall, { width: chartWidth }]}
        >
          <View style={[styles.gridLine, { bottom: "25%" }]} />
          <View style={[styles.gridLine, { bottom: "50%" }]} />
          <View style={[styles.gridLine, { bottom: "75%" }]} />
          {last ? (
            <View style={[styles.currentPriceLine, { bottom: `${currentBottom}%` }]}>
              <Text style={styles.currentPriceLabel}>Last {number(last.close)}</Text>
            </View>
          ) : null}
          {candles.length < 2 ? (
            <Text style={styles.chartEmpty}>Waiting for market data</Text>
          ) : (
            candles.map((candle, index) => {
              const candleUp = candle.close >= candle.open;
              const wickBottom = ((candle.low - min) / range) * 100;
              const wickHeight = Math.max(1, ((candle.high - candle.low) / range) * 100);
              const bodyLow = Math.min(candle.open, candle.close);
              const bodyHigh = Math.max(candle.open, candle.close);
              const bodyBottom = ((bodyLow - min) / range) * 100;
              const bodyHeight = Math.max(2, ((bodyHigh - bodyLow) / range) * 100);
              const showLabel = index === 0 || index === candles.length - 1 || index % labelEvery === 0;
              return (
                <TouchableOpacity
                  key={`${candle.timestamp || candle.close}-${index}`}
                  activeOpacity={0.75}
                  onPress={() => setSelectedIndex(index)}
                  style={[styles.candleSlot, selectedIndex === index && styles.candleSlotSelected]}
                >
                  <View
                    style={[
                      styles.candleWick,
                      { bottom: `${wickBottom}%`, height: `${wickHeight}%` },
                      candleUp ? styles.candleUp : styles.candleDown,
                    ]}
                  />
                  <View
                    style={[
                      styles.candleBody,
                      { bottom: `${bodyBottom}%`, height: `${bodyHeight}%` },
                      candleUp ? styles.candleUp : styles.candleDown,
                    ]}
                  />
                  {showLabel ? <Text style={styles.candleTimeLabel}>{candle.label || index + 1}</Text> : null}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
      <Text style={styles.selectedCandleText}>Selected: {selectedText}</Text>
      <Text style={styles.chartHint}>Hold and swipe left/right for old candles. Showing {candles.length} candles. Last: O {number(last?.open)} H {number(last?.high)} L {number(last?.low)} C {number(last?.close)}</Text>
      <View style={styles.ohlcGrid}>
        <Metric label="O" value={number(last?.open)} />
        <Metric label="H" value={number(max)} />
        <Metric label="L" value={number(min)} />
        <Metric label="C" value={number(last?.close)} />
      </View>
      <View style={styles.ohlcGrid}>
        <Metric label="EMA9" value={number(ema9)} />
        <Metric label="EMA21" value={number(ema21)} />
        <Metric label="VWAP" value={number(vwap)} />
        <Metric label={`ST ${supertrendDir || "--"}`} value={number(supertrend)} />
      </View>
    </View>
  );
}

function lastValue(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const n = Number(values[values.length - 1]);
  return Number.isFinite(n) ? n : null;
}

function Metric({ label, value }) {
  return (
    <View style={styles.metricCell}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function ChartCard({ title, subtitle, values, tall, pnl }) {
  const points = Array.isArray(values) ? values.map(Number).filter(Number.isFinite).slice(-60) : [];
  const min = points.length ? Math.min(...points) : 0;
  const max = points.length ? Math.max(...points) : 0;
  const range = max - min || 1;
  const last = points.length ? points[points.length - 1] : null;
  const first = points.length ? points[0] : null;
  const up = last !== null && first !== null ? last >= first : true;
  const total = points.reduce((sum, value) => sum + value, 0);
  const wins = pnl ? points.filter((value) => value > 0).length : 0;
  const losses = pnl ? points.filter((value) => value < 0).length : 0;
  const chartWidth = Math.max(520, points.length * 62);
  const pnlAbs = Math.max(Math.abs(min), Math.abs(max), 1);

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>{title}</Text>
        <Text style={[styles.modePill, up ? styles.modePillGood : styles.modePillBad]}>{last === null ? "--" : number(last)}</Text>
      </View>
      <Text style={styles.chartSubtitle}>{subtitle}</Text>
      {pnl ? (
        <View style={styles.pnlSummaryRow}>
          <Metric label="Total" value={money(total)} />
          <Metric label="Wins" value={String(wins)} />
          <Metric label="Losses" value={String(losses)} />
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={[styles.chartArea, tall && styles.chartAreaTall, { width: chartWidth }]}>
        {pnl && points.length > 1 ? <View style={styles.zeroLine}><Text style={styles.zeroLabel}>0</Text></View> : null}
        {points.length < 2 ? (
          <Text style={styles.chartEmpty}>Waiting for chart data</Text>
        ) : (
          points.map((value, index) => {
            const positive = value >= 0 || !pnl;
            const normalized = pnl ? Math.min(48, (Math.abs(value) / pnlAbs) * 48) : ((value - min) / range) * 92;
            const height = Math.max(5, normalized);
            return (
              <View key={`${value}-${index}`} style={styles.barSlot}>
                <Text style={[styles.barValue, positive ? styles.good : styles.bad]}>{pnl ? money(value).replace("Rs ", "") : number(value)}</Text>
                <View
                  style={[
                    pnl ? styles.pnlBar : styles.chartBar,
                    pnl ? { height: `${height}%`, bottom: positive ? "50%" : `${50 - height}%` } : { height: `${height}%` },
                    positive ? styles.chartBarGood : styles.chartBarBad,
                  ]}
                />
                <Text style={styles.barLabel}>T{index + 1}</Text>
              </View>
            );
          })
        )}
      </ScrollView>
      <Text style={styles.chartHint}>Swipe left/right. Tap report below for full trade details.</Text>
      <View style={styles.chartStats}>
        <Text style={styles.chartStat}>Low {number(min)}</Text>
        <Text style={styles.chartStat}>High {number(max)}</Text>
      </View>
    </View>
  );
}

function RecentTrades({ trades }) {
  const closedTrades = Array.isArray(trades) ? [...trades].reverse() : [];

  // Compute stats
  const pnls      = closedTrades.map((t) => Number(t.net_pnl ?? t.pnl ?? 0));
  const winners   = pnls.filter((p) => p > 0);
  const losers    = pnls.filter((p) => p < 0);
  const winRate   = pnls.length ? `${Math.round((winners.length / pnls.length) * 100)}%` : "--";
  const avgWin    = winners.length ? money(winners.reduce((a, b) => a + b, 0) / winners.length) : "--";
  const avgLoss   = losers.length  ? money(Math.abs(losers.reduce((a, b) => a + b, 0) / losers.length)) : "--";
  const grossProfit = winners.reduce((a, b) => a + b, 0);
  const grossLoss   = Math.abs(losers.reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : winners.length ? "∞" : "--";
  // Max drawdown
  let peak = 0, equity = 0, maxDD = 0;
  [...pnls].reverse().forEach((p) => {
    equity += p;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  });
  const drawdown = maxDD > 0 ? money(maxDD) : "--";

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>Trade Report</Text>
        <Text style={styles.modePill}>{closedTrades.length} closed</Text>
      </View>

      {/* Stats grid */}
      {closedTrades.length > 0 ? (
        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Win Rate</Text>
            <Text style={[styles.statValue, styles.good]}>{winRate}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Profit Factor</Text>
            <Text style={styles.statValue}>{profitFactor}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Avg Winner</Text>
            <Text style={[styles.statValue, styles.good]}>{avgWin}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Avg Loser</Text>
            <Text style={[styles.statValue, styles.bad]}>{avgLoss}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Max Drawdown</Text>
            <Text style={[styles.statValue, styles.bad]}>{drawdown}</Text>
          </View>
        </View>
      ) : null}

      {closedTrades.map((trade, index) => (
        <View key={`${trade.time}-${trade.exit_time}-${index}`} style={styles.tradeRow}>
          <View style={styles.tradeTextBlock}>
            <Text style={styles.tradeSymbol}>{trade.symbol || "DEMO"}</Text>
            <Text style={styles.tradeMeta}>
              {(trade.date || "--")} | {trade.signal || "--"} | Qty {trade.qty || 0}
            </Text>
            <View style={styles.orderSplitBox}>
              <View style={styles.orderSplitRow}>
                <Text style={styles.buyTag}>BUY</Text>
                <Text style={styles.orderSplitText}>
                  {trade.time || "--"} | Price {number(trade.entry)} | Charges {money(trade.buy_charges ?? (Number(trade.charges || 0) / 2))}
                </Text>
              </View>
              <View style={styles.orderSplitRow}>
                <Text style={styles.sellTag}>SELL</Text>
                <Text style={styles.orderSplitText}>
                  {trade.exit_time || "--"} | Price {number(trade.exit)} | Charges {money(trade.sell_charges ?? (Number(trade.charges || 0) / 2))}
                </Text>
              </View>
            </View>
            <Text style={styles.tradeMeta}>{safeStr(trade.reason, "--")}</Text>
            <Text style={styles.tradeMeta}>
              Gross {money(trade.gross_pnl ?? trade.pnl)} | Charges {money(trade.charges)} | Net {money(trade.net_pnl ?? trade.pnl)}
            </Text>
          </View>
          <Text style={[styles.tradePnl, Number(trade.net_pnl ?? trade.pnl ?? 0) >= 0 ? styles.good : styles.bad]}>{money(trade.net_pnl ?? trade.pnl)}</Text>
        </View>
      ))}
      {closedTrades.length === 0 ? <Text style={styles.body}>No trades yet</Text> : null}
    </View>
  );
}

function MarketItem({ label, value }) {
  return (
    <View style={styles.marketItem}>
      <Text style={styles.marketLabel}>{label}</Text>
      <Text style={styles.marketValue}>{value}</Text>
    </View>
  );
}

function Kpi({ title, value, positive }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiTitle}>{title}</Text>
      <Text style={[styles.kpiValue, positive === true && styles.good, positive === false && styles.bad]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function SmallButton({ title, onPress, green, red, blue }) {
  return (
    <TouchableOpacity
      style={[styles.button, green && styles.greenButton, red && styles.redButton, blue && styles.blueButton]}
      onPress={onPress}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

function TabButton({ title, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // ── AI Decision Card ──────────────────────────────────────────
  aiCard: { backgroundColor: "#0d1f35", borderColor: "#1e3a5f", borderWidth: 1.5, borderRadius: 12, padding: 16 },
  decisionBadge: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  decisionBuy:   { backgroundColor: "#0d3d2b" },
  decisionSell:  { backgroundColor: "#3d0d1a" },
  decisionWait:  { backgroundColor: "#1e2d44" },
  decisionBadgeText: { color: "#f8fafc", fontSize: 12, fontWeight: "900" },
  aiMetricRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  aiMetricCell: { backgroundColor: "#08111f", borderColor: "#1e3a5f", borderWidth: 1, borderRadius: 10, flex: 1, padding: 12 },
  aiMetricLabel: { color: "#64748b", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  aiMetricValue: { color: "#f8fafc", fontSize: 15, fontWeight: "900", marginTop: 4 },
  aiRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderTopColor: "#1e3a5f", borderTopWidth: 1, marginBottom: 4 },
  aiRowLabel: { color: "#64748b", fontSize: 12, fontWeight: "900" },
  aiRowValue: { color: "#f8fafc", fontSize: 13, fontWeight: "800", flex: 1, textAlign: "right" },
  aiReasonBox: { backgroundColor: "#07111f", borderColor: "#1e3a5f", borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 10 },
  aiReasonTitle: { color: "#55c7ff", fontSize: 11, fontWeight: "900", marginBottom: 6, textTransform: "uppercase" },
  aiReasonText: { color: "#cbd5e1", fontSize: 13, lineHeight: 20 },
  aiRecommendBox: { backgroundColor: "#0d1f35", borderColor: "#2ee59d", borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 10 },
  aiRecommendText: { color: "#f8fafc", fontSize: 14, fontWeight: "800", lineHeight: 21 },
  neutral: { color: "#94a3b8" },
  // ── Trade Suggestion Card ─────────────────────────────────────
  suggSymbol: { color: "#55c7ff", fontSize: 14, fontWeight: "900", marginBottom: 10 },
  suggGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  suggCell: { backgroundColor: "#07111f", borderColor: "#2f4363", borderWidth: 1, borderRadius: 10, padding: 12, width: "48%" },
  suggLabel: { color: "#64748b", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  suggValue: { color: "#f8fafc", fontSize: 15, fontWeight: "900", marginTop: 4 },
  // ── Reports Stats Grid ────────────────────────────────────────
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  statCell: { backgroundColor: "#07111f", borderColor: "#2f4363", borderWidth: 1, borderRadius: 10, padding: 12, width: "48%" },
  statLabel: { color: "#64748b", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  statValue: { color: "#f8fafc", fontSize: 16, fontWeight: "900", marginTop: 4 },
  page: { padding: 16, gap: 12 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  eyebrow: { color: "#55c7ff", fontSize: 13, fontWeight: "800" },
  title: { color: "#f8fafc", fontSize: 27, fontWeight: "900", marginTop: 4 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  badgeGood: { backgroundColor: "#153f35" },
  badgeBad: { backgroundColor: "#451c28" },
  badgeText: { color: "#f8fafc", fontSize: 11, fontWeight: "900" },
  screenTabs: { backgroundColor: "#101b2d", borderColor: "#2f4363", borderRadius: 8, borderWidth: 1, flexDirection: "row", padding: 4 },
  screenTab: { alignItems: "center", borderRadius: 6, flex: 1, paddingVertical: 9 },
  screenTabActive: { backgroundColor: "#55c7ff" },
  screenTabText: { color: "#cbd5e1", fontSize: 11, fontWeight: "900" },
  screenTabTextActive: { color: "#06111f" },
  marketStrip: { backgroundColor: "#101b2d", borderColor: "#2f4363", borderRadius: 8, borderWidth: 1, flexDirection: "row", flexWrap: "wrap" },
  marketItem: { borderColor: "#263954", borderRightWidth: 1, padding: 12, width: "50%" },
  marketLabel: { color: "#94a3b8", fontSize: 11, fontWeight: "800" },
  marketValue: { color: "#f8fafc", fontSize: 17, fontWeight: "900", marginTop: 4 },
  sessionText: { color: "#94a3b8", fontSize: 12, fontWeight: "800", marginTop: -4 },
  panel: { backgroundColor: "#101b2d", borderColor: "#2f4363", borderWidth: 1, borderRadius: 8, padding: 14 },
  panelHeaderRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  panelTitle: { color: "#f8fafc", fontSize: 17, fontWeight: "800", marginBottom: 10 },
  modePill: { backgroundColor: "#16263f", borderRadius: 999, color: "#55c7ff", fontSize: 11, fontWeight: "900", paddingHorizontal: 10, paddingVertical: 5 },
  modePillGood: { color: "#2ee59d" },
  modePillBad: { color: "#ff5c7a" },
  input: { backgroundColor: "#08111f", borderColor: "#2f4363", borderWidth: 1, borderRadius: 8, color: "#f8fafc", fontSize: 14, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 10 },
  row: { flexDirection: "row", gap: 10 },
  tabRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  spacer: { height: 10 },
  button: { flex: 1, backgroundColor: "#16263f", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  topEmergencyButton: { backgroundColor: "#ff315f", borderRadius: 8, paddingVertical: 16, alignItems: "center" },
  emergencyText: { color: "#ffffff", fontSize: 16, fontWeight: "900" },
  greenButton: { backgroundColor: "#2ee59d" },
  redButton: { backgroundColor: "#ff5c7a" },
  blueButton: { backgroundColor: "#55c7ff" },
  buttonText: { color: "#06111f", fontWeight: "900", fontSize: 14 },
  tabButton: { backgroundColor: "#16263f", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  tabButtonActive: { backgroundColor: "#55c7ff" },
  tabText: { color: "#cbd5e1", fontWeight: "900", fontSize: 12 },
  tabTextActive: { color: "#06111f" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: { width: "48%", backgroundColor: "#101b2d", borderColor: "#2f4363", borderWidth: 1, borderRadius: 8, padding: 12 },
  kpiTitle: { color: "#94a3b8", fontSize: 11, fontWeight: "800" },
  kpiValue: { color: "#f8fafc", fontSize: 18, fontWeight: "900", marginTop: 5 },
  chartSubtitle: { color: "#94a3b8", fontSize: 12, fontWeight: "700", marginBottom: 10 },
  chartArea: { alignItems: "center", backgroundColor: "#08111f", borderColor: "#2f4363", borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 6, height: 170, padding: 8, position: "relative" },
  chartAreaTall: { height: 250 },
  chartWithScale: { flexDirection: "row", gap: 6, height: 230 },
  priceScale: { justifyContent: "space-between", paddingVertical: 12, width: 54 },
  scaleText: { color: "#94a3b8", fontSize: 10, fontWeight: "800", textAlign: "right" },
  tradingChartArea: { backgroundColor: "#08111f", borderColor: "#2f4363", borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 3, height: 230, overflow: "hidden", padding: 8, position: "relative" },
  gridLine: { backgroundColor: "#1d334f", height: 1, left: 8, opacity: 0.75, position: "absolute", right: 8 },
  currentPriceLine: { backgroundColor: "#55c7ff", height: 1, left: 8, opacity: 0.9, position: "absolute", right: 8, zIndex: 3 },
  currentPriceLabel: { alignSelf: "flex-end", backgroundColor: "#16263f", borderRadius: 999, color: "#f8fafc", fontSize: 10, fontWeight: "900", marginTop: -12, paddingHorizontal: 8, paddingVertical: 2 },
  candleSlot: { height: "100%", position: "relative", width: 9 },
  candleSlotSelected: { backgroundColor: "rgba(85,199,255,0.12)", borderRadius: 4 },
  candleWick: { borderRadius: 2, left: "45%", position: "absolute", width: 2 },
  candleBody: { borderRadius: 2, left: "15%", position: "absolute", right: "15%" },
  candleTimeLabel: { bottom: 2, color: "#94a3b8", fontSize: 8, fontWeight: "800", left: -8, position: "absolute", width: 34 },
  candleUp: { backgroundColor: "#2ee59d" },
  candleDown: { backgroundColor: "#ff5c7a" },
  chartEmpty: { alignSelf: "center", color: "#94a3b8", flex: 1, fontSize: 14, fontWeight: "800", textAlign: "center" },
  barSlot: { alignItems: "center", height: "100%", justifyContent: "center", position: "relative", width: 56 },
  chartBar: { borderRadius: 3, minHeight: 4, width: 34 },
  pnlBar: { borderRadius: 3, minHeight: 4, position: "absolute", width: 34 },
  zeroLine: { backgroundColor: "#94a3b8", height: 1, left: 8, opacity: 0.8, position: "absolute", right: 8, top: "50%" },
  zeroLabel: { backgroundColor: "#08111f", color: "#94a3b8", fontSize: 9, fontWeight: "900", marginTop: -9, paddingRight: 4 },
  barValue: { fontSize: 9, fontWeight: "900", position: "absolute", textAlign: "center", top: 2, width: 58 },
  barLabel: { bottom: 2, color: "#94a3b8", fontSize: 9, fontWeight: "800", position: "absolute" },
  chartBarGood: { backgroundColor: "#55c7ff" },
  chartBarBad: { backgroundColor: "#ff5c7a" },
  chartHint: { color: "#64748b", fontSize: 11, fontWeight: "700", marginTop: 7 },
  selectedCandleText: { backgroundColor: "#08111f", borderColor: "#263954", borderRadius: 7, borderWidth: 1, color: "#dbeafe", fontSize: 11, fontWeight: "800", marginTop: 8, padding: 8 },
  chartStats: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  chartStat: { color: "#94a3b8", fontSize: 11, fontWeight: "800" },
  ohlcGrid: { flexDirection: "row", gap: 8, marginTop: 10 },
  pnlSummaryRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  metricCell: { backgroundColor: "#08111f", borderColor: "#263954", borderRadius: 7, borderWidth: 1, flex: 1, paddingHorizontal: 8, paddingVertical: 7 },
  metricLabel: { color: "#94a3b8", fontSize: 10, fontWeight: "900" },
  metricValue: { color: "#f8fafc", fontSize: 12, fontWeight: "900", marginTop: 3 },
  body: { color: "#cbd5e1", fontSize: 14, lineHeight: 21 },
  bodyStrong: { color: "#f8fafc", fontSize: 15, fontWeight: "800", lineHeight: 22 },
  connectionHelp: { color: "#94a3b8", fontSize: 12, lineHeight: 18, marginTop: 10 },
  autoRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  autoText: { color: "#f8fafc", fontSize: 14, fontWeight: "800" },
  good: { color: "#2ee59d" },
  bad: { color: "#ff5c7a" },
  scanRow: { borderTopColor: "#2f4363", borderTopWidth: 1, paddingTop: 9, marginTop: 9 },
  scanName: { color: "#f8fafc", fontSize: 14, fontWeight: "900" },
  scanDetail: { color: "#cbd5e1", fontSize: 12, marginTop: 2 },
  tradeRow: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomColor: "#2f4363", borderBottomWidth: 1, gap: 10 },
  tradeTextBlock: { flex: 1 },
  tradeSymbol: { color: "#f8fafc", fontWeight: "900", fontSize: 13 },
  tradeMeta: { color: "#94a3b8", fontSize: 11, fontWeight: "700", lineHeight: 16, marginTop: 2 },
  tradePnl: { fontWeight: "900", minWidth: 76, textAlign: "right" },
  orderSplitBox: { backgroundColor: "#081426", borderColor: "#263957", borderRadius: 8, borderWidth: 1, marginTop: 6, padding: 7, gap: 5 },
  orderSplitRow: { alignItems: "center", flexDirection: "row", gap: 7 },
  buyTag: { backgroundColor: "#123c33", borderRadius: 5, color: "#2ee59d", fontSize: 10, fontWeight: "900", minWidth: 36, paddingHorizontal: 6, paddingVertical: 3, textAlign: "center" },
  sellTag: { backgroundColor: "#421829", borderRadius: 5, color: "#ff5c7a", fontSize: 10, fontWeight: "900", minWidth: 36, paddingHorizontal: 6, paddingVertical: 3, textAlign: "center" },
  orderSplitText: { color: "#cbd5e1", flex: 1, fontSize: 10, fontWeight: "800", lineHeight: 14 },
  logLine: { color: "#cbd5e1", fontSize: 12, lineHeight: 18, marginBottom: 4 },
  reportBox: { backgroundColor: "#08111f", borderColor: "#2f4363", borderRadius: 8, borderWidth: 1, marginTop: 10, padding: 10 },
  reportText: { color: "#cbd5e1", fontSize: 12, lineHeight: 18 },
  commandBox: { backgroundColor: "#07111f", borderColor: "#385272", borderRadius: 8, borderWidth: 1, marginBottom: 10, marginTop: 8, padding: 10 },
  commandText: { color: "#dbeafe", fontFamily: "monospace", fontSize: 12, lineHeight: 18 },
  infoBox: { backgroundColor: "#08111f", borderColor: "#2f4363", borderRadius: 8, borderWidth: 1, marginTop: 10, maxHeight: 520, padding: 10 },
  infoText: { color: "#cbd5e1", fontSize: 12, lineHeight: 18 },
  statusBox: { backgroundColor: "#08111f", borderColor: "#2f4363", borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: "row", gap: 10 },
  statusText: { color: "#cbd5e1", flex: 1 },
  // ── Compact Dashboard ─────────────────────────────────────────
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#101b2d", borderColor: "#2f4363", borderWidth: 1, borderRadius: 10, padding: 10 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusPillLive:    { backgroundColor: "#0d3d2b" },
  statusPillPaper:   { backgroundColor: "#1e2d44" },
  statusPillOffline: { backgroundColor: "#3d1a1a" },
  statusPillText: { color: "#f8fafc", fontSize: 11, fontWeight: "900" },
  topBarCenter: { alignItems: "center" },
  topNifty: { color: "#f8fafc", fontSize: 22, fontWeight: "900" },
  topNiftyLabel: { color: "#64748b", fontSize: 10, fontWeight: "800" },
  emergencyPill: { backgroundColor: "#ff315f", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  emergencyPillText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  metricsRow: { flexDirection: "row", gap: 6 },
  metricBox: { flex: 1, backgroundColor: "#101b2d", borderColor: "#2f4363", borderWidth: 1, borderRadius: 8, padding: 10, alignItems: "center" },
  metricBoxLabel: { color: "#64748b", fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  metricBoxValue: { color: "#f8fafc", fontSize: 13, fontWeight: "900", marginTop: 3 },
  controlsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  ctrlBtn: { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 10, alignItems: "center", flex: 1, minWidth: "18%" },
  ctrlGreen: { backgroundColor: "#0d3d2b" },
  ctrlRed:   { backgroundColor: "#3d0d1a" },
  ctrlBlue:  { backgroundColor: "#0d2a4a" },
  ctrlText: { color: "#f8fafc", fontSize: 11, fontWeight: "900" },
  compactPosition: { backgroundColor: "#101b2d", borderColor: "#2f4363", borderWidth: 1, borderRadius: 8, padding: 10 },
  compactPositionActive: { borderColor: "#2ee59d", borderWidth: 1.5 },
  noPositionText: { color: "#64748b", fontSize: 13, fontWeight: "800", textAlign: "center", paddingVertical: 4 },
  posRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  posSymbol: { color: "#55c7ff", fontSize: 13, fontWeight: "900" },
  posPnl: { fontSize: 16, fontWeight: "900" },
  posGrid: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  posCell: { backgroundColor: "#08111f", borderRadius: 6, padding: 7, minWidth: "18%" },
  posCellLabel: { color: "#64748b", fontSize: 9, fontWeight: "900" },
  posCellValue: { color: "#f8fafc", fontSize: 12, fontWeight: "900", marginTop: 2 },
  aiSummaryRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  aiSummaryCell: { flex: 1, backgroundColor: "#08111f", borderRadius: 8, padding: 8 },
  aiReasonSummary: { color: "#cbd5e1", fontSize: 12, lineHeight: 18, marginBottom: 4 },
  miniStatsRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  miniStat: { color: "#94a3b8", fontSize: 12, fontWeight: "800" },
  tradeRowCompact: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingVertical: 7, borderTopColor: "#2f4363", borderTopWidth: 1, gap: 8 },
  viewAllBtn: { alignItems: "center", paddingVertical: 8, borderTopColor: "#2f4363", borderTopWidth: 1, marginTop: 4 },
  viewAllText: { color: "#55c7ff", fontSize: 13, fontWeight: "900" },
  rowGap: { flexDirection: "row", alignItems: "center", gap: 8 },
  expandChevron: { color: "#64748b", fontSize: 14, fontWeight: "900" },
});
