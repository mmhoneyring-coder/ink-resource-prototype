from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8')
repls = {
    "      coreRadius: [7.2, 10.2],": "      coreRadius: [8.4, 12.0],",
    "      dropletRadius: [2.8, 4.4],": "      dropletRadius: [3.2, 5.2],",
    "      speckRadius: [1.0, 1.8],": "      speckRadius: [1.1, 2.0],",
    "      coreSpread: 25,": "      coreSpread: 30,",
    "      spread: 40,": "      spread: 48,",
    "      farSpread: 58,": "      farSpread: 68,",
}
for old, new in repls.items():
    if old not in text:
        raise SystemExit(f'missing: {old}')
    text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
