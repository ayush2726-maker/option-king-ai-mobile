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
            <TouchableOpacity style={styles.topEmergencyButton} onPress={() => postJson("/stop", {}, "Emergency stop")}>
              <Text style={styles.emergencyText}>EMERGENCY STOP</Text>
            </TouchableOpacity>

            <View style={styles.marketStrip}>
              <MarketItem label="NIFTY" value={number(status?.nifty)} />
              <MarketItem label="Trend" value={status?.trend || "--"} />
              <MarketItem label="Supertrend" value={status?.supertrend || "--"} />
              <MarketItem label="Signal" value={status?.signal || "WAIT"} />
              <MarketItem label="Score" value={`${status?.score || 0}/5`} />
              <MarketItem label="Market" value={status?.market_open ? "OPEN" : "IDLE"} />
              <MarketItem label="End" value={status?.trade_end || status?.normal_trade_end || "--"} />
            </View>
            <Text style={styles.sessionText}>{status?.market_session || "Market session not loaded"}</Text>

            <View style={styles.kpiGrid}>
              <Kpi title="Bot" value={status?.running ? "RUNNING" : "STOPPED"} positive={status?.running} />
              <Kpi title="Health" value={status?.health_status || "--"} positive={status?.health_status === "READY"} />
              <Kpi title="Capital" value={money(status?.capital)} />
              <Kpi title="Live Equity" value={money(status?.live_equity || status?.capital)} positive={(status?.live_equity || status?.capital || 0) >= (status?.paper_capital || 0)} />
              <Kpi title="Daily P&L" value={money(status?.daily_pnl)} positive={(status?.daily_pnl || 0) >= 0} />
            </View>

            <View style={styles.panel}>
              <View style={styles.panelHeaderRow}>
                <Text style={styles.panelTitle}>Server Health</Text>
                <Text style={styles.modePill}>{status?.health_status || "--"}</Text>
              </View>
              <Text style={styles.bodyStrong}>{status?.health_summary || "Health not loaded"}</Text>
              <Text style={styles.body}>Angel: {status?.health?.angel || "--"} | Telegram: {status?.health?.telegram || "--"}</Text>
              <Text style={styles.body}>Auto Start: {status?.health?.auto_start_bot ? "ON" : "OFF"} | Expiry: {status?.expiry_day ? "YES" : "NO"} | Position: {status?.health?.position_open ? "OPEN" : "NONE"}</Text>
              <Text style={styles.body}>Update: {status?.update_status?.summary || "--"}</Text>
            </View>

            <TradingChartCard chartData={chartData} status={status} statusPriceHistory={statusPriceHistory} />

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Controls</Text>
              <View style={styles.row}>
                <SmallButton title="Start" onPress={() => postJson("/start", {}, "Start")} green />
                <SmallButton title="Stop" onPress={() => postJson("/stop", {}, "Stop")} red />
                <SmallButton title="Scan" onPress={() => postJson("/scan", {}, "Scan")} blue />
              </View>
              <View style={styles.spacer} />
              <View style={styles.row}>
                <SmallButton title="Close Pos" onPress={() => postJson("/close-position", {}, "Close position")} red />
                <SmallButton title="Refresh" onPress={() => refreshAll(true)} blue />
              </View>
              <View style={styles.spacer} />
              <SmallButton title="Send Health Alert" onPress={() => postJson("/health-test", {}, "Health alert")} />
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Open Position</Text>
              <Text style={styles.body}>{formatPosition(status?.position)}</Text>
            </View>

            <View style={styles.panel}>
              <View style={styles.panelHeaderRow}>
                <Text style={styles.panelTitle}>Trade Suggestion</Text>
                <Text style={styles.modePill}>{status?.suggestion?.action || "WAIT"}</Text>
              </View>
              <Text style={styles.bodyStrong}>{status?.suggestion_summary || status?.suggestion?.summary || "WAIT | No setup"}</Text>
              <Text style={styles.body}>{formatSuggestion(status?.suggestion)}</Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Market Scan</Text>
              <Text style={styles.bodyStrong}>{scan?.summary || "Market scan: --"}</Text>
              {(scan?.results || []).slice(0, 4).map((item, index) => (
                <View key={`${item.name}-${index}`} style={styles.scanRow}>
                  <Text style={styles.scanName}>{item.name}</Text>
                  <Text style={styles.scanDetail}>Score {item.score}/5 | {item.detail}</Text>
                </View>
              ))}
            </View>

            <RecentTrades trades={trades} />
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
    `Signal: ${suggestion.signal || "WAIT"} | Type: ${suggestion.trade_type || "NONE"} | Score: ${suggestion.score || 0}/5`,
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
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>Trade Report</Text>
        <Text style={styles.modePill}>{closedTrades.length} closed</Text>
      </View>
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
            <Text style={styles.tradeMeta}>{trade.reason || "--"}</Text>
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
  safe: { flex: 1, backgroundColor: "#07111f" },
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
});
