import sys
import re

target_path = sys.argv[1] if len(sys.argv) > 1 else 'node_modules/@capacitor-community/bluetooth-le/ios/Sources/BluetoothLe/Plugin.swift'

with open(target_path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Fix bridge?.viewController (removed in Capacitor 8)
code = code.replace('self.bridge?.viewController', 'nil')

# 2. Fix getConfig().getObject("displayStrings")
code = re.sub(r'let configDisplayStrings = [^\n]+', 'let configDisplayStrings = [String: String]()', code)

# 3. Fix getArray with String.self or without default
code = code.replace('call.getArray("services", String.self)', '(call.options["services"] as? [String])')
code = code.replace('call.getArray("deviceIds", String.self)', '(call.options["deviceIds"] as? [String])')
code = code.replace('guard let services = (call.getArray("services") as? [String]) else {', 'guard let services = (call.options["services"] as? [String]) else {')
code = code.replace('guard let manufacturerDataArray = call.getArray("manufacturerData") else {', 'guard let manufacturerDataArray = (call.options["manufacturerData"] as? [JSObject]) else {')

# 4. Fix getBool and getInt calls
code = code.replace('call.getBool("skipDescriptorDiscovery") ?? false', 'call.getBool("skipDescriptorDiscovery", false)')
code = code.replace('call.getBool("allowDuplicates") ?? false', 'call.getBool("allowDuplicates", false)')
code = code.replace('call.getInt("timeout")', 'call.getInt("timeout", 5)')

# 5. Fix call.getString("key") -> (call.options["key"] as? String)
code = re.sub(r'guard let ([a-zA-Z0-9_]+) = call\.getString\("([^"]+)"\) else \{', r'guard let \1 = (call.options["\2"] as? String), !\1.isEmpty else {', code)
code = re.sub(r'let ([a-zA-Z0-9_]+) = call\.getString\("([^"]+)"\)', r'let \1 = (call.options["\2"] as? String) ?? ""', code)
code = re.sub(r'call\.getString\("([^"]+)"\)', r'(call.options["\1"] as? String)', code)

# Remove any previously added helper extensions
code = re.sub(r'extension CAPPluginCall \{[\s\S]*?\}', '', code)

with open(target_path, 'w', encoding='utf-8') as f:
    f.write(code)

print(f"Successfully patched {target_path} for Capacitor 8 / Swift SPM!")
