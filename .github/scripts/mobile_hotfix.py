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
