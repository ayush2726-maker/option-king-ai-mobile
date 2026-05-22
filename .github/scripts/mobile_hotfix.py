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
