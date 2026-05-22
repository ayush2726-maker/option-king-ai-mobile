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
