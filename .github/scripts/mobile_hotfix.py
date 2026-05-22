import json
import re
from pathlib import Path


APP_BUILD_LABEL = "1.0.0 build 18"
MIN_VERSION_CODE = 18


def replace_once(text, old, new):
    return text.replace(old, new) if old in text else text


app_path = Path("App.js")
text = app_path.read_text(encoding="utf-8")
text = re.sub(r'const APP_BUILD_LABEL = ".*?";', f'const APP_BUILD_LABEL = "{APP_BUILD_LABEL}";', text)
text = text.replace('const serverMode = mode === "MONTHLY" ? "REAL_MONTHLY" : mode;', 'const serverMode = mode === "MONTHLY" ? "MONTHLY" : mode;')

if "const [tradeMode, setTradeMode]" not in text:
    text = replace_once(
        text,
        '  const [settingsLoaded, setSettingsLoaded] = useState(false);\n',
        '  const [settingsLoaded, setSettingsLoaded] = useState(false);\n'
        '  const [tradeMode, setTradeMode] = useState("PAPER");\n'
        '  const [liveTradingEnabled, setLiveTradingEnabled] = useState(false);\n',
    )

if "setTradeMode(nextStatus" not in text:
    text = replace_once(
        text,
        '      setStatus(nextStatus);\n'
        '      setCapitalInput(String(nextStatus?.paper_capital || nextStatus?.capital || ""));',
        '      setStatus(nextStatus);\n'
        '      setTradeMode(nextStatus?.trade_mode || nextStatus?.mode || "PAPER");\n'
        '      setLiveTradingEnabled(Boolean(nextStatus?.live_trading_enabled));\n'
        '      setCapitalInput(String(nextStatus?.paper_capital || nextStatus?.capital || ""));',
    )

if "function updateTradeMode" not in text:
    text = replace_once(
        text,
        '  function updateCapital() {\n',
        '  function updateTradeMode(nextMode, nextLiveEnabled = liveTradingEnabled) {\n'
        '    const mode = String(nextMode || "PAPER").toUpperCase();\n'
        '    if (mode === "LIVE" && nextLiveEnabled) {\n'
        '      Alert.alert(\n'
        '        "Enable Live Trading?",\n'
        '        "LIVE mode sends real Angel One orders. Use only after checking capital, token, product type, and risk.",\n'
        '        [\n'
        '          { text: "Cancel", style: "cancel" },\n'
        '          {\n'
        '            text: "Enable LIVE",\n'
        '            style: "destructive",\n'
        '            onPress: () => postJson("/mode", { trade_mode: "LIVE", live_trading_enabled: true }, "Live mode"),\n'
        '          },\n'
        '        ],\n'
        '      );\n'
        '      return;\n'
        '    }\n'
        '    postJson("/mode", { trade_mode: mode, live_trading_enabled: Boolean(nextLiveEnabled) }, "Trade mode");\n'
        '  }\n\n'
        '  function updateCapital() {\n',
    )

if "<AiDecisionCard status={status}" not in text:
    text = replace_once(
        text,
        """            <View style={styles.panel}>
              <View style={styles.panelHeaderRow}>
                <Text style={styles.panelTitle}>Server Health</Text>""",
        """            <AiDecisionCard status={status} />

            <View style={styles.panel}>
              <View style={styles.panelHeaderRow}>
                <Text style={styles.panelTitle}>Server Health</Text>""",
    )

if "function shortRegime" not in text:
    text = replace_once(
        text,
        'function formatBacktestReport(report) {\n',
        'function shortRegime(value) {\n'
        '  if (!value) return "--";\n'
        '  return String(value).replace(/_/g, " ").replace(/\\b\\w/g, (char) => char.toUpperCase()).slice(0, 22);\n'
        '}\n\n'
        'function weightedComponentRows(components) {\n'
        '  if (!components || typeof components !== "object") return [];\n'
        '  const labels = {\n'
        '    orb_breakout: "ORB",\n'
        '    vwap_alignment: "VWAP",\n'
        '    ema_alignment: "EMA",\n'
        '    volume_spike: "Volume",\n'
        '    strong_candle_close: "Candle",\n'
        '    option_chain_support: "Chain",\n'
        '    oi_buildup: "OI",\n'
        '    atr_volatility: "ATR",\n'
        '  };\n'
        '  return Object.entries(components)\n'
        '    .filter(([, value]) => value && typeof value === "object")\n'
        '    .map(([key, value]) => ({\n'
        '      key,\n'
        '      label: labels[key] || shortRegime(key),\n'
        '      score: Number(value.score || 0),\n'
        '      weight: Number(value.weight || 0),\n'
        '    }));\n'
        '}\n\n'
        'function formatBacktestReport(report) {\n',
    )

text = replace_once(
    text,
    'function SmallButton({ title, onPress, green, red, blue }) {\n'
    '  return (\n'
    '    <TouchableOpacity\n'
    '      style={[styles.button, green && styles.greenButton, red && styles.redButton, blue && styles.blueButton]}\n'
    '      onPress={onPress}\n'
    '    >\n'
    '      <Text style={styles.buttonText}>{title}</Text>\n'
    '    </TouchableOpacity>\n'
    '  );\n'
    '}',
    'function SmallButton({ title, onPress, green, red, blue }) {\n'
    '  const colored = Boolean(green || blue);\n'
    '  return (\n'
    '    <TouchableOpacity\n'
    '      activeOpacity={0.72}\n'
    '      style={[styles.button, green && styles.greenButton, red && styles.redButton, blue && styles.blueButton]}\n'
    '      onPress={onPress}\n'
    '    >\n'
    '      <Text style={[styles.buttonText, colored && styles.buttonTextDark, red && styles.buttonTextLight]}>{title}</Text>\n'
    '    </TouchableOpacity>\n'
    '  );\n'
    '}',
)

if "function AiDecisionCard" not in text:
    text = replace_once(
        text,
        'function SmallButton({ title, onPress, green, red, blue }) {\n',
        'function AiDecisionCard({ status }) {\n'
        '  const decision = status?.weighted_decision_engine || {};\n'
        '  const gemini = status?.gemini_decision && Object.keys(status.gemini_decision).length ? status.gemini_decision : decision.gemini_decision || {};\n'
        '  const suggestion = status?.suggestion || {};\n'
        '  const score = Number(status?.weighted_score ?? decision.score ?? suggestion.weighted_score ?? status?.score ?? 0);\n'
        '  const confidence = Number(gemini.confidence ?? decision.confidence ?? suggestion.confidence ?? status?.confidence ?? 0);\n'
        '  const fake = Number(status?.fake_breakout_probability ?? gemini.fake_breakout_probability ?? decision.fake_breakout_probability ?? suggestion.fake_breakout_probability ?? 0);\n'
        '  const entryType = gemini.entry_type || decision.entry_type || suggestion.entry_type || "NONE";\n'
        '  const risk = gemini.risk || decision.risk || suggestion.risk || "--";\n'
        '  const signal = gemini.signal || decision.signal || suggestion.signal || status?.signal || "WAIT";\n'
        '  const regime = status?.market_regime || decision.market_regime || suggestion.market_regime?.regime || suggestion.market_regime || "--";\n'
        '  const reason = gemini.reason || decision.reason || suggestion.reason || "Waiting for market data";\n'
        '  const componentRows = weightedComponentRows(decision.components || suggestion.weighted_components || {});\n'
        '  const scorePct = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));\n'
        '  const confidencePct = Math.max(0, Math.min(100, Number.isFinite(confidence) ? confidence : 0));\n'
        '  const fakePct = Math.max(0, Math.min(100, Number.isFinite(fake) ? fake : 0));\n'
        '  const takeTrade = Boolean(gemini.take_trade || (signal !== "WAIT" && confidencePct > 75));\n\n'
        '  return (\n'
        '    <View style={styles.aiPanel}>\n'
        '      <View style={styles.panelHeaderRow}>\n'
        '        <View style={styles.modeTextBlock}>\n'
        '          <Text style={styles.panelTitle}>AI Decision Center</Text>\n'
        '          <Text style={styles.aiSubTitle}>{shortRegime(regime)} | {entryType} | {risk}</Text>\n'
        '        </View>\n'
        '        <Text style={[styles.modePill, takeTrade ? styles.modePillGood : styles.modePillBad]}>{signal}</Text>\n'
        '      </View>\n'
        '      <View style={styles.aiMetricRow}>\n'
        '        <AiMetric label="Weighted" value={`${scorePct.toFixed(0)}/100`} good={scorePct >= 70} />\n'
        '        <AiMetric label="Confidence" value={`${confidencePct.toFixed(0)}%`} good={confidencePct > 75} />\n'
        '        <AiMetric label="Fake Risk" value={`${fakePct.toFixed(0)}%`} bad={fakePct > 42} />\n'
        '      </View>\n'
        '      <ProgressLine label="Score" value={scorePct} good={scorePct >= 70} />\n'
        '      <ProgressLine label="Confidence" value={confidencePct} good={confidencePct > 75} />\n'
        '      <ProgressLine label="Fake Breakout" value={fakePct} bad={fakePct > 42} />\n'
        '      <Text style={styles.aiReason}>{reason}</Text>\n'
        '      {componentRows.length ? (\n'
        '        <View style={styles.componentGrid}>\n'
        '          {componentRows.map((item) => (\n'
        '            <View key={item.key} style={styles.componentChip}>\n'
        '              <Text style={styles.componentLabel}>{item.label}</Text>\n'
        '              <Text style={styles.componentScore}>{item.score}/{item.weight}</Text>\n'
        '            </View>\n'
        '          ))}\n'
        '        </View>\n'
        '      ) : (\n'
        '        <Text style={styles.connectionHelp}>Component scores will appear after the next live market decision.</Text>\n'
        '      )}\n'
        '    </View>\n'
        '  );\n'
        '}\n\n'
        'function AiMetric({ label, value, good, bad }) {\n'
        '  return (\n'
        '    <View style={styles.aiMetric}>\n'
        '      <Text style={styles.metricLabel}>{label}</Text>\n'
        '      <Text style={[styles.aiMetricValue, good && styles.good, bad && styles.bad]}>{value}</Text>\n'
        '    </View>\n'
        '  );\n'
        '}\n\n'
        'function ProgressLine({ label, value, good, bad }) {\n'
        '  const pct = Math.max(0, Math.min(100, Number(value || 0)));\n'
        '  return (\n'
        '    <View style={styles.progressWrap}>\n'
        '      <View style={styles.progressHeader}>\n'
        '        <Text style={styles.progressLabel}>{label}</Text>\n'
        '        <Text style={styles.progressValue}>{pct.toFixed(0)}%</Text>\n'
        '      </View>\n'
        '      <View style={styles.progressTrack}>\n'
        '        <View style={[styles.progressFill, { width: `${pct}%` }, good && styles.progressGood, bad && styles.progressBad]} />\n'
        '      </View>\n'
        '    </View>\n'
        '  );\n'
        '}\n\n'
        'function SmallButton({ title, onPress, green, red, blue }) {\n',
    )

text = replace_once(
    text,
    """              <View style={styles.modeSwitchBox}>
                <View>
                  <Text style={styles.bodyStrong}>Trading Mode: {tradeMode}</Text>
                  <Text style={styles.connectionHelp}>LIVE sends real Angel One orders. Keep OFF for testing.</Text>
                </View>
                <Switch
                  value={tradeMode === "LIVE" && liveTradingEnabled}
                  onValueChange={(value) => {
                    setTradeMode(value ? "LIVE" : "PAPER");
                    setLiveTradingEnabled(value);
                    updateTradeMode(value ? "LIVE" : "PAPER", value);
                  }}
                  trackColor={{ false: "#334155", true: "#7f1d1d" }}
                  thumbColor={tradeMode === "LIVE" && liveTradingEnabled ? "#ff5c7a" : "#94a3b8"}
                />
              </View>""",
    """              <View style={styles.modeSwitchBox}>
                <View style={styles.modeSwitchHeader}>
                  <View style={styles.modeTextBlock}>
                    <Text style={styles.bodyStrong}>Trading Mode: {tradeMode}</Text>
                    <Text style={styles.connectionHelp}>LIVE sends real Angel One orders. Keep OFF for testing.</Text>
                  </View>
                  <Text style={[styles.modePill, tradeMode === "LIVE" && liveTradingEnabled ? styles.modePillBad : styles.modePillGood]}>
                    {tradeMode === "LIVE" && liveTradingEnabled ? "LIVE ON" : "PAPER SAFE"}
                  </Text>
                </View>
                <View style={styles.liveSwitchRow}>
                  <View style={styles.modeTextBlock}>
                    <Text style={styles.autoText}>Live Trading</Text>
                    <Text style={styles.connectionHelp}>Manual confirmation required before real orders.</Text>
                  </View>
                  <Switch
                    value={tradeMode === "LIVE" && liveTradingEnabled}
                    onValueChange={(value) => {
                      setTradeMode(value ? "LIVE" : "PAPER");
                      setLiveTradingEnabled(value);
                      updateTradeMode(value ? "LIVE" : "PAPER", value);
                    }}
                    trackColor={{ false: "#334155", true: "#7f1d1d" }}
                    thumbColor={tradeMode === "LIVE" && liveTradingEnabled ? "#ff5c7a" : "#94a3b8"}
                  />
                </View>
              </View>""",
)

text = replace_once(
    text,
    """            <View style={styles.panel}>
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
            </View>""",
    """            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Controls</Text>
              <View style={styles.modeSwitchBox}>
                <View style={styles.modeSwitchHeader}>
                  <View style={styles.modeTextBlock}>
                    <Text style={styles.bodyStrong}>Trading Mode: {tradeMode}</Text>
                    <Text style={styles.connectionHelp}>LIVE sends real Angel One orders. Keep OFF for testing.</Text>
                  </View>
                  <Text style={[styles.modePill, tradeMode === "LIVE" && liveTradingEnabled ? styles.modePillBad : styles.modePillGood]}>
                    {tradeMode === "LIVE" && liveTradingEnabled ? "LIVE ON" : "PAPER SAFE"}
                  </Text>
                </View>
                <View style={styles.liveSwitchRow}>
                  <View style={styles.modeTextBlock}>
                    <Text style={styles.autoText}>Live Trading</Text>
                    <Text style={styles.connectionHelp}>Manual confirmation required before real orders.</Text>
                  </View>
                  <Switch
                    value={tradeMode === "LIVE" && liveTradingEnabled}
                    onValueChange={(value) => {
                      setTradeMode(value ? "LIVE" : "PAPER");
                      setLiveTradingEnabled(value);
                      updateTradeMode(value ? "LIVE" : "PAPER", value);
                    }}
                    trackColor={{ false: "#334155", true: "#7f1d1d" }}
                    thumbColor={tradeMode === "LIVE" && liveTradingEnabled ? "#ff5c7a" : "#94a3b8"}
                  />
                </View>
              </View>
              <View style={styles.spacer} />
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
            </View>""",
)

text = replace_once(
    text,
    """              <View style={styles.infoBox}>
                <Text style={styles.infoText}>{trimText(infoPanels[activeInfo], activeInfo === "reports" ? 500 : 90)}</Text>
              </View>""",
    """              <View style={styles.infoBox}>
                <ScrollView style={styles.infoScroll} nestedScrollEnabled showsVerticalScrollIndicator>
                  <Text style={styles.infoText}>{trimText(infoPanels[activeInfo], activeInfo === "reports" ? 500 : 140)}</Text>
                </ScrollView>
              </View>""",
)

text = replace_once(
    text,
    """            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Live Logs</Text>
              {logs.slice(-18).reverse().map((line, index) => (
                <Text key={`${line}-${index}`} style={styles.logLine}>{line}</Text>
              ))}
              {logs.length === 0 ? <Text style={styles.body}>No logs yet</Text> : null}
            </View>""",
    """            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Live Logs</Text>
              <ScrollView style={styles.logScroll} nestedScrollEnabled showsVerticalScrollIndicator>
                {logs.slice(-80).reverse().map((line, index) => (
                  <Text key={`${line}-${index}`} style={styles.logLine}>{line}</Text>
                ))}
                {logs.length === 0 ? <Text style={styles.body}>No logs yet</Text> : null}
              </ScrollView>
            </View>""",
)

style_replacements = {
    '  button: { flex: 1, backgroundColor: "#16263f", borderRadius: 8, paddingVertical: 12, alignItems: "center" },':
        '  button: { flex: 1, backgroundColor: "#213656", borderColor: "#3f5f8d", borderRadius: 8, borderWidth: 1, paddingVertical: 12, alignItems: "center" },',
    '  greenButton: { backgroundColor: "#2ee59d" },':
        '  greenButton: { backgroundColor: "#2ee59d", borderColor: "#2ee59d" },',
    '  redButton: { backgroundColor: "#ff5c7a" },':
        '  redButton: { backgroundColor: "#ff5c7a", borderColor: "#ff5c7a" },',
    '  blueButton: { backgroundColor: "#55c7ff" },':
        '  blueButton: { backgroundColor: "#55c7ff", borderColor: "#55c7ff" },',
    '  buttonText: { color: "#06111f", fontWeight: "900", fontSize: 14 },':
        '  buttonText: { color: "#f8fafc", fontWeight: "900", fontSize: 14 },\n'
        '  buttonTextDark: { color: "#06111f" },\n'
        '  buttonTextLight: { color: "#ffffff" },',
    '  modeSwitchBox: { alignItems: "center", backgroundColor: "#08111f", borderColor: "#2f4363", borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 10, justifyContent: "space-between", padding: 10 },':
        '  modeSwitchBox: { alignItems: "stretch", backgroundColor: "#08111f", borderColor: "#2f4363", borderRadius: 8, borderWidth: 1, gap: 10, padding: 12 },\n'
        '  modeSwitchHeader: { alignItems: "flex-start", flexDirection: "row", gap: 10, justifyContent: "space-between" },\n'
        '  modeTextBlock: { flex: 1, minWidth: 0 },\n'
        '  liveSwitchRow: { alignItems: "center", backgroundColor: "#0d1b2e", borderColor: "#263954", borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 10, justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 9 },',
    '  infoBox: { backgroundColor: "#08111f", borderColor: "#2f4363", borderRadius: 8, borderWidth: 1, marginTop: 10, maxHeight: 520, padding: 10 },':
        '  infoBox: { backgroundColor: "#08111f", borderColor: "#2f4363", borderRadius: 8, borderWidth: 1, marginTop: 10, padding: 10 },\n'
        '  infoScroll: { maxHeight: 330 },\n'
        '  logScroll: { backgroundColor: "#08111f", borderColor: "#2f4363", borderRadius: 8, borderWidth: 1, maxHeight: 360, padding: 10 },',
}
for old, new in style_replacements.items():
    text = replace_once(text, old, new)

if "  modeSwitchHeader: {" not in text:
    text = replace_once(
        text,
        '  autoRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },\n'
        '  autoText: { color: "#f8fafc", fontSize: 14, fontWeight: "800" },',
        '  autoRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },\n'
        '  modeSwitchBox: { alignItems: "stretch", backgroundColor: "#08111f", borderColor: "#2f4363", borderRadius: 8, borderWidth: 1, gap: 10, padding: 12 },\n'
        '  modeSwitchHeader: { alignItems: "flex-start", flexDirection: "row", gap: 10, justifyContent: "space-between" },\n'
        '  modeTextBlock: { flex: 1, minWidth: 0 },\n'
        '  liveSwitchRow: { alignItems: "center", backgroundColor: "#0d1b2e", borderColor: "#263954", borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 10, justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 9 },\n'
        '  autoText: { color: "#f8fafc", fontSize: 14, fontWeight: "800" },',
    )

if "  aiPanel: {" not in text:
    text = replace_once(
        text,
        '  panel: { backgroundColor: "#101b2d", borderColor: "#2f4363", borderWidth: 1, borderRadius: 8, padding: 14 },\n',
        '  panel: { backgroundColor: "#101b2d", borderColor: "#2f4363", borderWidth: 1, borderRadius: 8, padding: 14 },\n'
        '  aiPanel: { backgroundColor: "#0d1b2e", borderColor: "#55c7ff", borderWidth: 1, borderRadius: 8, padding: 14 },\n',
    )

if "  aiMetricRow: {" not in text:
    text = replace_once(
        text,
        '  metricValue: { color: "#f8fafc", fontSize: 12, fontWeight: "900", marginTop: 3 },\n',
        '  metricValue: { color: "#f8fafc", fontSize: 12, fontWeight: "900", marginTop: 3 },\n'
        '  aiSubTitle: { color: "#94a3b8", fontSize: 11, fontWeight: "900", marginTop: -6 },\n'
        '  aiMetricRow: { flexDirection: "row", gap: 8, marginBottom: 10 },\n'
        '  aiMetric: { backgroundColor: "#08111f", borderColor: "#263954", borderRadius: 7, borderWidth: 1, flex: 1, paddingHorizontal: 8, paddingVertical: 9 },\n'
        '  aiMetricValue: { color: "#f8fafc", fontSize: 16, fontWeight: "900", marginTop: 4 },\n'
        '  progressWrap: { marginTop: 8 },\n'
        '  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },\n'
        '  progressLabel: { color: "#cbd5e1", fontSize: 11, fontWeight: "900" },\n'
        '  progressValue: { color: "#94a3b8", fontSize: 11, fontWeight: "900" },\n'
        '  progressTrack: { backgroundColor: "#08111f", borderColor: "#263954", borderRadius: 999, borderWidth: 1, height: 10, overflow: "hidden" },\n'
        '  progressFill: { backgroundColor: "#55c7ff", borderRadius: 999, height: "100%" },\n'
        '  progressGood: { backgroundColor: "#2ee59d" },\n'
        '  progressBad: { backgroundColor: "#ff5c7a" },\n'
        '  aiReason: { backgroundColor: "#08111f", borderColor: "#263954", borderRadius: 7, borderWidth: 1, color: "#dbeafe", fontSize: 12, fontWeight: "800", lineHeight: 18, marginTop: 12, padding: 9 },\n'
        '  componentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },\n'
        '  componentChip: { backgroundColor: "#16263f", borderColor: "#2f4363", borderRadius: 7, borderWidth: 1, minWidth: "30%", paddingHorizontal: 9, paddingVertical: 8 },\n'
        '  componentLabel: { color: "#94a3b8", fontSize: 10, fontWeight: "900" },\n'
        '  componentScore: { color: "#f8fafc", fontSize: 13, fontWeight: "900", marginTop: 3 },\n',
    )

app_path.write_text(text, encoding="utf-8")

app_json_path = Path("app.json")
app_json = json.loads(app_json_path.read_text(encoding="utf-8"))
android = app_json.setdefault("expo", {}).setdefault("android", {})
android["versionCode"] = max(int(android.get("versionCode", 0) or 0), MIN_VERSION_CODE)
app_json_path.write_text(json.dumps(app_json, indent=2) + "\n", encoding="utf-8")

eas_json_path = Path("eas.json")
if eas_json_path.exists():
    eas_json = json.loads(eas_json_path.read_text(encoding="utf-8"))
    eas_json.setdefault("cli", {})["appVersionSource"] = "local"
    eas_json_path.write_text(json.dumps(eas_json, indent=2) + "\n", encoding="utf-8")

print("Mobile hotfix applied")
