import sys
import re

target_path = sys.argv[1] if len(sys.argv) > 1 else 'node_modules/@capacitor-community/bluetooth-le/ios/Sources/BluetoothLe/Plugin.swift'

with open(target_path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Clean up any leftover helper extensions or error calls
code = re.sub(r'extension CAPPluginCall \{[\s\S]*?\}', '', code)
code = re.sub(r'call\.error\(', 'call.reject(', code)

# 2. Replace call.reject(arg) with call.reject(arg, nil, nil, nil)
code = re.sub(r'call\.reject\(([^\n,\)]+)\)', r'call.reject(\1, nil, nil, nil)', code)

# 3. Fix bridge?.viewController (removed in Capacitor 8)
code = code.replace('self.bridge?.viewController', 'nil')

# 4. Fix getConfig().getObject("displayStrings")
code = re.sub(r'let configDisplayStrings = [^\n]+', 'let configDisplayStrings = [String: String]()', code)

# 5. Fix getArray calls to use options dictionary
code = code.replace('call.getArray("services", String.self)', '(call.options["services"] as? [String])')
code = code.replace('call.getArray("deviceIds", String.self)', '(call.options["deviceIds"] as? [String])')
code = code.replace('guard let services = (call.getArray("services") as? [String]) else {', 'guard let services = (call.options["services"] as? [String]) else {')
code = re.sub(r'guard let manufacturerDataArray = call\.getArray\("manufacturerData"\) else \{', 'guard let manufacturerDataArray = (call.options["manufacturerData"] as? [JSObject]) else {', code)
code = re.sub(r'guard let serviceDataArray = call\.getArray\("serviceData"\) else \{', 'guard let serviceDataArray = (call.options["serviceData"] as? [JSObject]) else {', code)

# 6. Fix getBool and getDouble calls to use options dictionary
code = code.replace('call.getBool("skipDescriptorDiscovery") ?? false', '(call.options["skipDescriptorDiscovery"] as? Bool) ?? false')
code = code.replace('call.getBool("allowDuplicates") ?? false', '(call.options["allowDuplicates"] as? Bool) ?? false')
code = re.sub(r'guard let timeout = call\.getDouble\("timeout"\) else \{', 'guard let timeout = (call.options["timeout"] as? Double) ?? (call.options["timeout"] as? Int).map(Double.init) else {', code)
code = re.sub(r'call\.getInt\("timeout"\)', '(call.options["timeout"] as? Double) ?? 5.0', code)

# 7. Fix call.getString("key") -> (call.options["key"] as? String)
code = re.sub(r'guard let ([a-zA-Z0-9_]+) = call\.getStringHelper\("([^"]+)"\) else \{', r'guard let \1 = (call.options["\2"] as? String), !\1.isEmpty else {', code)
code = re.sub(r'guard let ([a-zA-Z0-9_]+) = call\.getString\("([^"]+)"\) else \{', r'guard let \1 = (call.options["\2"] as? String), !\1.isEmpty else {', code)
code = re.sub(r'let ([a-zA-Z0-9_]+) = call\.getStringHelper\("([^"]+)"\)', r'let \1 = (call.options["\2"] as? String) ?? ""', code)
code = re.sub(r'let ([a-zA-Z0-9_]+) = call\.getString\("([^"]+)"\)', r'let \1 = (call.options["\2"] as? String) ?? ""', code)
code = re.sub(r'call\.getStringHelper\("([^"]+)"\)', r'(call.options["\1"] as? String)', code)
code = re.sub(r'call\.getString\("([^"]+)"\)', r'(call.options["\1"] as? String)', code)

with open(target_path, 'w', encoding='utf-8') as f:
    f.write(code)

print(f"Successfully patched {target_path} for Capacitor 8 / Swift SPM!")
