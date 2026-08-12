import sys
import re

target_path = sys.argv[1] if len(sys.argv) > 1 else 'node_modules/@capacitor-community/bluetooth-le/ios/Sources/BluetoothLe/Plugin.swift'

with open(target_path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Replace getConfig().getObject with getConfigObject
code = code.replace('getConfig().getObject("displayStrings")', 'getConfig().getConfigObject("displayStrings")')

# 2. Replace call.getArray("services", String.self)
code = code.replace('call.getArray("services", String.self)', '(call.getArray("services") as? [String])')

# 3. Add helper extension at top of file
helper = '''
extension CAPPluginCall {
    @objc func reject(_ message: String) {
        self.reject(message, nil, nil, nil)
    }
    @objc func getStringHelper(_ key: String) -> String? {
        if let s = self.options[key] as? String, !s.isEmpty {
            return s
        }
        let val = self.getString(key, "")
        return val.isEmpty ? nil : val
    }
}
'''
if 'getStringHelper' not in code:
    code = code + '\n' + helper

# 4. Replace call.getString("...") with call.getStringHelper("...")
code = re.sub(r'call\.getString\(([^,\)]+)\)', r'call.getStringHelper(\1)', code)

with open(target_path, 'w', encoding='utf-8') as f:
    f.write(code)

print(f"Successfully patched {target_path} for Capacitor 8 / Swift SPM!")
