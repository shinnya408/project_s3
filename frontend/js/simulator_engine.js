// ==========================================
// ネットワーク計算用ヘルパー関数
// ==========================================
function ipToUint32(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isValidIpAddress(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255 && String(num) === part;
    });
}

function isValidSubnetMask(mask) {
    if (!isValidIpAddress(mask)) return false;
    const binaryStr = mask.split('.')
        .map(octet => parseInt(octet, 10).toString(2).padStart(8, '0'))
        .join('');
    return /^1*0*$/.test(binaryStr);
}

function isNetworkAddress(ip, mask) {
    if (!isValidIpAddress(ip) || !isValidSubnetMask(mask)) return false;
    const ipNum = ipToUint32(ip);
    const maskNum = ipToUint32(mask);
    return ((ipNum & maskNum) >>> 0) === ipNum;
}

function isBroadcastAddress(ip, mask) {
    if (!isValidIpAddress(ip) || !isValidSubnetMask(mask)) return false;
    const ipNum = ipToUint32(ip);
    const maskNum = ipToUint32(mask);
    const invertedMask = (~maskNum) >>> 0;
    const broadcastNum = (ipNum | invertedMask) >>> 0;
    return (ipNum >>> 0) === broadcastNum;
}

function isUsableIpAddress(ip) {
    if (!isValidIpAddress(ip)) return false;
    const firstOctet = parseInt(ip.split('.')[0], 10);
    if (firstOctet === 127) return false;
    if (firstOctet >= 224 && firstOctet <= 239) return false;
    return true;
}

// ==========================================
// VirtualDevice クラス
// ==========================================
class VirtualDevice {
    constructor(hostname = "Router") {
        this.hostname = hostname;
        this.mode = "user";
        this.currentScope = "global"; 
        this.startupConfigSaved = false; 
        
        // ★追加: 存在するインターフェイスを記憶するリストと、初期化判定フラグ
        this.registeredInterfaces = new Set();
        this.isInitialized = false; 
        
        this.configStore = {
            "global": { "hostname": `hostname ${hostname}` }
        };
    }

    setConfig(key, commandString, scope = this.currentScope) {
        if (!this.configStore[scope]) this.configStore[scope] = {};
        if (commandString === null) {
            delete this.configStore[scope][key];
        } else {
            this.configStore[scope][key] = commandString;
        }
    }

    getPrompt() {
        switch(this.mode) {
            case "user": return `${this.hostname}>`;
            case "priv": return `${this.hostname}#`;
            case "global": return `${this.hostname}(config)#`;
            case "if": return `${this.hostname}(config-if)#`;
            case "router": return `${this.hostname}(config-router)#`;
            case "vlan": return `${this.hostname}(config-vlan)#`;
            default: return `${this.hostname}>`;
        }
    }

    _normalizeInterfaceName(name) {
        if (!name) return "";
        const lower = name.toLowerCase();
        if (lower.startsWith('g') && !lower.startsWith('gi')) return name.replace(/^g/i, 'GigabitEthernet');
        if (lower.startsWith('gi')) return name.replace(/^gi/i, 'GigabitEthernet');
        if (lower.startsWith('gig')) return name.replace(/^gig/i, 'GigabitEthernet');
        if (lower.startsWith('f') && !lower.startsWith('fa')) return name.replace(/^f/i, 'FastEthernet');
        if (lower.startsWith('fa')) return name.replace(/^fa/i, 'FastEthernet');
        if (lower.startsWith('s') && !lower.startsWith('se')) return name.replace(/^s/i, 'Serial');
        if (lower.startsWith('se')) return name.replace(/^se/i, 'Serial');
        
        if (lower.startsWith('e') && !lower.startsWith('et')) return name.replace(/^e/i, 'Ethernet');
        if (lower.startsWith('et')) return name.replace(/^et/i, 'Ethernet');
        
        return name;
    }

    _getTreeForMode() {
        const tree = { ...commandTree["_common"], ...commandTree[this.mode] };
        if (this.mode === "user") {
            delete tree["end"];
        }
        return tree;
    }

    getCompletion(input) {
        const prefixMatch = input.match(/^(\s*no\s+)(.*)/i);
        if (prefixMatch) {
            const prefix = prefixMatch[1];
            const rest = prefixMatch[2];
            
            const explicitResult = this._getCompletionCore(input);
            if (explicitResult !== input) return explicitResult;
            
            const autoResult = this._getCompletionCore(rest);
            if (autoResult !== rest) return prefix + autoResult;
            return input;
        }
        return this._getCompletionCore(input);
    }

    _getCompletionCore(input) {
        const text = input.trimStart();
        if (!text) return input;
        
        let tokens = text.split(/\s+/);
        const endsWithSpace = input.endsWith(' ');
        if (endsWithSpace && tokens[tokens.length - 1] === "") tokens.pop();
        if (endsWithSpace) return input;

        let node = this._getTreeForMode();
        const lastToken = tokens[tokens.length - 1].toLowerCase();

        for (let i = 0; i < tokens.length - 1; i++) {
            const t = tokens[i].toLowerCase();
            const subCmds = Object.keys(node).filter(k => typeof node[k] === 'object' && node[k] !== null);
            const matches = subCmds.filter(k => k.toLowerCase().startsWith(t));
            if (matches.length === 0) return input;
            const matchKey = matches.find(k => k.toLowerCase() === t) || (matches.length === 1 ? matches[0] : null);
            if (!matchKey) return input;
            
            const nextSubCmds = Object.keys(node[matchKey]).filter(k => typeof node[matchKey][k] === 'object' && node[matchKey][k] !== null);
            if (nextSubCmds.length === 0 && node[matchKey].action) return input;
            node = node[matchKey];
        }

        const subCmds = Object.keys(node).filter(k => typeof node[k] === 'object' && node[k] !== null);
        const matches = subCmds.filter(k => k.toLowerCase().startsWith(lastToken));
        if (matches.length === 1) {
            tokens[tokens.length - 1] = matches[0];
            return input.match(/^\s*/)[0] + tokens.join(' ') + " ";
        } else if (matches.length > 1) {
            let prefix = matches[0];
            for (let i = 1; i < matches.length; i++) {
                while (!matches[i].startsWith(prefix)) {
                    prefix = prefix.slice(0, -1);
                    if (!prefix) break;
                }
            }
            if (prefix.length > lastToken.length) {
                tokens[tokens.length - 1] = prefix;
                return input.match(/^\s*/)[0] + tokens.join(' ');
            }
        }
        return input;
    }

    getHelp(input) {
        const prefixMatch = input.match(/^(\s*no\s+)(.*)/i);
        if (prefixMatch) {
            const prefix = prefixMatch[1];
            const rest = prefixMatch[2];
            
            const explicitResult = this._getHelpCore(input);
            if (explicitResult && !explicitResult.startsWith("% Unrecognized command") && !explicitResult.startsWith("% Ambiguous command")) {
                return explicitResult;
            }
            return this._getHelpCore(rest);
        }
        return this._getHelpCore(input);
    }

    _getHelpCore(input) {
        const text = input.trimStart();
        if (!text && input.length === 0) return this._formatHelp(this._getTreeForMode());

        let tokens = text.split(/\s+/);
        const endsWithSpace = input.endsWith(' ');
        if (endsWithSpace && tokens[tokens.length - 1] === "") tokens.pop();

        let node = this._getTreeForMode();
        
        for (let i = 0; i < tokens.length - 1; i++) {
            const t = tokens[i].toLowerCase();
            const subCmds = Object.keys(node).filter(k => typeof node[k] === 'object' && node[k] !== null);
            const matches = subCmds.filter(k => k.toLowerCase().startsWith(t));
            if (matches.length === 0) return "% Unrecognized command";
            
            const matchKey = matches.find(k => k.toLowerCase() === t) || (matches.length === 1 ? matches[0] : null);
            if (!matchKey) return "% Ambiguous command";
            
            const nextSubCmds = Object.keys(node[matchKey]).filter(k => typeof node[matchKey][k] === 'object' && node[matchKey][k] !== null);
            if (nextSubCmds.length === 0 && node[matchKey].action) return endsWithSpace ? "  <cr>" : "";
            node = node[matchKey];
        }
        
        const lastToken = tokens[tokens.length - 1].toLowerCase();
        const subCmds = Object.keys(node).filter(k => typeof node[k] === 'object' && node[k] !== null);
        
        if (!endsWithSpace) {
            const matches = subCmds.filter(k => k.toLowerCase().startsWith(lastToken));
            if (matches.length > 0) {
                let helpObj = {};
                matches.forEach(m => helpObj[m] = node[m]);
                return this._formatHelp(helpObj);
            } else {
                return "% Unrecognized command";
            }
        } else {
            const matches = subCmds.filter(k => k.toLowerCase().startsWith(lastToken));
            const matchKey = matches.find(k => k.toLowerCase() === lastToken) || (matches.length === 1 ? matches[0] : null);
            
            if (matchKey && node[matchKey]) {
                const nextSubCmds = Object.keys(node[matchKey]).filter(k => typeof node[matchKey][k] === 'object' && node[matchKey][k] !== null);
                if (nextSubCmds.length === 0 && node[matchKey].action) return "  <cr>";
                return this._formatHelp(node[matchKey]);
            }
            return "% Unrecognized command";
        }
    }

    _formatHelp(nodeObj) {
        let out = "";
        const keys = Object.keys(nodeObj).filter(k => typeof nodeObj[k] === 'object' && nodeObj[k] !== null).sort();
        for (const k of keys) {
            out += `  ${k.padEnd(20)} \n`;
        }
        return out.trimEnd();
    }

    // ★安全に改修された自動noコマンド・引数バリデーション付き
    processCommand(input) {
        const text = input.trim();
        if (!text) return ""; 

        const tokens = text.split(/\s+/);
        const dictionary = this._getTreeForMode();
        let result = this._resolveCommand(tokens, dictionary);
        let isAutoNo = false;

        if (result.error && tokens.length > 1 && tokens[0].toLowerCase() === "no") {
            result = this._resolveCommand(tokens.slice(1), dictionary);
            if (!result.error) {
                isAutoNo = true; 
            } else {
                return "% Unrecognized command";
            }
        } else if (result.error) {
            return result.error;
        }

        if (result.maxArgs !== undefined && result.args.length > result.maxArgs) {
            return "% Invalid input detected at '^' marker.";
        }

        try {
            if (isAutoNo) {
                // 安全なオーバーライド（プロトタイプメソッドを直接呼ぶ）
                this.setConfig = (key, val, scope = this.currentScope) => {
                    VirtualDevice.prototype.setConfig.call(this, key, null, scope);
                };
            }
            
            const output = result.action(this, result.args);
            
            if (isAutoNo) {
                delete this.setConfig; // 確実に元に戻す
            }
            return output;
            
        } catch (e) {
            if (isAutoNo) delete this.setConfig;
            return "% Error executing command";
        }
    }

    _resolveCommand(tokens, node) {
        if (tokens.length === 0) return { error: "% Incomplete command." };
        const currentToken = tokens[0].toLowerCase();

        const subKeys = Object.keys(node).filter(k => typeof node[k] === 'object' && node[k] !== null);
        const matches = subKeys.filter(k => k.toLowerCase().startsWith(currentToken));

        if (matches.length === 0) return { error: "% Unrecognized command" };
        if (matches.length > 1) {
            const exactMatch = matches.find(k => k.toLowerCase() === currentToken);
            if (!exactMatch) return { error: "% Ambiguous command: " + currentToken };
            matches[0] = exactMatch;
        }

        const nextNode = node[matches[0]];

        if (nextNode.action) {
            return { 
                action: nextNode.action, 
                args: tokens.slice(1),
                maxArgs: nextNode.maxArgs 
            };
        } else {
            if (tokens.length === 1) return { error: "% Incomplete command." };
            return this._resolveCommand(tokens.slice(1), nextNode);
        }
    }

    generateRunningConfig() {
        let conf = "!\n";
        
        for (const val of Object.values(this.configStore["global"] || {})) {
            conf += `${val}\n`;
        }
        conf += "!\n";
        
        // ★追加: 登録済みのインターフェイスは設定が空でも出力する
        this.registeredInterfaces.forEach(ifName => {
            const scopeName = `interface ${ifName}`;
            if (!this.configStore[scopeName]) {
                this.configStore[scopeName] = {};
            }
        });

        for (const [scopeName, settings] of Object.entries(this.configStore)) {
            if (scopeName === "global") continue;
            conf += `${scopeName}\n`;
            for (const val of Object.values(settings)) {
                conf += ` ${val}\n`; 
            }
            conf += "!\n";
        }
        conf += "end";
        return conf;
    }
}

// ==========================================
// コマンド辞書
// ==========================================
const commandTree = {
    "_common": {
        "no": {},
        "exit": {
            maxArgs: 0,
            action: (device) => {
                if (device.mode === "if" || device.mode === "router" || device.mode === "vlan") {
                    device.mode = "global";
                    device.currentScope = "global";
                }
                else if (device.mode === "global") {
                    device.mode = "priv";
                    device.currentScope = "global";
                }
                else if (device.mode === "priv") {
                    device.mode = "user";
                    device.currentScope = "global";
                }
                return "";
            }
        },
        "end": {
            maxArgs: 0,
            action: (device) => {
                if (device.mode !== "user") {
                    device.mode = "priv";
                    device.currentScope = "global";
                }
                return "";
            }
        }
    },
    
    "user": {
        "enable": {
            maxArgs: 0,
            action: (device) => { device.mode = "priv"; return ""; }
        }
    },
    
    "priv": {
        "disable": {
            maxArgs: 0,
            action: (device) => { device.mode = "user"; return ""; }
        },
        "configure": {
            "terminal": {
                maxArgs: 0,
                action: (device) => { 
                    device.mode = "global"; 
                    device.currentScope = "global";
                    return "Enter configuration commands, one per line.  End with CNTL/Z."; 
                }
            }
        },
        "copy": {
            "running-config": {
                "startup-config": {
                    maxArgs: 0,
                    action: (device) => {
                        device.startupConfigSaved = true; // 保存フラグをONにする
                        return "Destination filename [startup-config]? \nBuilding configuration...\n[OK]";
                    }
                }
            }
        },
        "show": {
            "running-config": {
                maxArgs: 0,
                action: (device) => device.generateRunningConfig()
            },
            "interfaces": {
                maxArgs: 0,
                action: (device) => {
                    let out = "";
                    for(const [scope, conf] of Object.entries(device.configStore)) {
                        if (scope.startsWith("interface ")) {
                            const name = scope.replace("interface ", "");
                            const isDown = conf["shutdown"] === "shutdown" || !conf["shutdown"];
                            const status = isDown ? "administratively down" : "up";
                            out += `${name} is ${status}, line protocol is ${status}\n`;
                            if (conf["ip_address"]) {
                                const match = conf["ip_address"].match(/ip address (\S+) (\S+)/);
                                if (match) out += `  Internet address is ${match[1]}/${match[2]}\n`;
                            }
                        }
                    }
                    return out.trim() || "No interfaces configured.";
                }
            },
            "ip": {
                "interface": {
                    "brief": {
                        maxArgs: 0,
                        action: (device) => {
                            let out = "Interface              IP-Address      OK? Method Status                Protocol\n";
                            for(const [scope, conf] of Object.entries(device.configStore)) {
                                if (scope.startsWith("interface ")) {
                                    const name = scope.replace("interface ", "");
                                    let ip = "unassigned";
                                    if (conf["ip_address"]) {
                                        const match = conf["ip_address"].match(/ip address (\S+)/);
                                        if (match) ip = match[1];
                                    }
                                    const isDown = conf["shutdown"] === "shutdown" || !conf["shutdown"];
                                    const status = isDown ? "administratively down" : "up";
                                    const proto = isDown ? "down" : "up";
                                    out += `${name.padEnd(22)} ${ip.padEnd(15)} YES manual ${status.padEnd(21)} ${proto}\n`;
                                }
                            }
                            return out.trim() || "Interface              IP-Address      OK? Method Status                Protocol";
                        }
                    }
                },
                "route": {
                    maxArgs: 0,
                    action: (device) => {
                        let out = "Codes: L - local, C - connected, S - static, O - OSPF\n\nGateway of last resort is not set\n\n";
                        for(const [scope, conf] of Object.entries(device.configStore)) {
                            if (scope.startsWith("interface ")) {
                                const name = scope.replace("interface ", "");
                                if (conf["ip_address"] && conf["shutdown"] === "no shutdown") {
                                    const match = conf["ip_address"].match(/ip address (\S+)/);
                                    if (match) out += `C    ${match[1]} is directly connected, ${name}\n`;
                                }
                            }
                        }
                        const globals = device.configStore["global"] || {};
                        for(const [key, val] of Object.entries(globals)) {
                            if (key.startsWith("route_")) {
                                const match = val.match(/ip route (\S+) (\S+) (\S+)/);
                                if (match) out += `S    ${match[1]} via ${match[3]}\n`;
                            }
                        }
                        return out.trim();
                    }
                }
            }
        }
    },
    
    "global": {
        "hostname": {
            maxArgs: 1,
            action: (device, args) => {
                if (args.length === 0) return "% Incomplete command.";
                device.hostname = args[0];
                device.setConfig("hostname", `hostname ${args[0]}`);
                return "";
            }
        },
        "interface": {
            "FastEthernet": {}, "GigabitEthernet": {}, "Ethernet": {}, "Serial": {}, "vlan": {},
            maxArgs: 2,
            action: (device, args) => {
                if (args.length === 0) return "% Incomplete command.";
                let rawIfName = args[0];
                if (args.length === 2) rawIfName += args[1]; // "g" "0/0" を結合
                const ifName = device._normalizeInterfaceName(rawIfName);
                
                const isPhysical = /^(GigabitEthernet|FastEthernet|Ethernet|Serial)/i.test(ifName);
                
                if (isPhysical) {
                    if (!device.isInitialized) {
                        device.registeredInterfaces.add(ifName);
                    } else {
                        if (!device.registeredInterfaces.has(ifName)) {
                            return "% Invalid interface type and number";
                        }
                    }
                }
                
                device.mode = "if";
                device.currentScope = `interface ${ifName}`;
                return "";
            }
        },
        "vlan": {
            maxArgs: 1,
            action: (device, args) => {
                if (args.length === 0) return "% Incomplete command.";
                device.mode = "vlan";
                device.currentScope = `vlan ${args[0]}`;
                return "";
            }
        },
        "ip": {
            "route": {
                maxArgs: 3,
                action: (device, args) => {
                    if (args.length < 3) return "% Incomplete command.";
                    const [network, mask, nextHop] = args;
                    if (!isValidIpAddress(network) || !isValidIpAddress(mask) || !isValidIpAddress(nextHop)) {
                        return "% Invalid IP address or subnet mask.";
                    }
                    if (!isValidSubnetMask(mask)) {
                        return "% Invalid subnet mask.";
                    }
                    if (!isNetworkAddress(network, mask)) {
                        return "% Inconsistent address and mask.";
                    }
                    if (!isUsableIpAddress(nextHop)) {
                        return "% Invalid next hop address.";
                    }
                    device.setConfig(`route_${network}_${mask}`, `ip route ${network} ${mask} ${nextHop}`, "global");
                    return "";
                }
            }
        },
        "router": {
            "ospf": {
                maxArgs: 1,
                action: (device, args) => {
                    if (args.length === 0) return "% Incomplete command.";
                    device.mode = "router";
                    device.currentScope = `router ospf ${args[0]}`;
                    return "";
                }
            }
        },
        "lldp": {
            "run": {
                maxArgs: 0,
                action: (device) => {
                    device.setConfig("lldp", "lldp run");
                    return "";
                }
            }
        },
        "cdp": {
            "run": {
                maxArgs: 0,
                action: (device) => {
                    device.setConfig("cdp", "cdp run");
                    return "";
                }
            }
        }
    },
    
    "if": {
        "ip": {
            "address": {
                maxArgs: 2,
                action: (device, args) => {
                    if (args.length < 2) return "% Incomplete command.";
                    const ip = args[0];
                    const mask = args[1];

                    if (!isValidIpAddress(ip) || !isValidSubnetMask(mask)) return "% Invalid IP address or subnet mask.";
                    if (isNetworkAddress(ip, mask)) return "Bad mask /" + mask + " for address " + ip;
                    if (isBroadcastAddress(ip, mask)) return "Bad mask /" + mask + " for address " + ip;
                    if (!isUsableIpAddress(ip)) return "% Not a valid host address - " + ip;

                    device.setConfig("ip_address", `ip address ${ip} ${mask}`);
                    return "";
                }
            }
        },
        "switchport": {
            "mode": {
                "access": {
                    maxArgs: 0,
                    action: (device) => {
                        device.setConfig("switchport_mode", "switchport mode access");
                        return "";
                    }
                },
                "trunk": {
                    maxArgs: 0,
                    action: (device) => {
                        device.setConfig("switchport_mode", "switchport mode trunk");
                        return "";
                    }
                }
            },
            "access": {
                "vlan": {
                    maxArgs: 1,
                    action: (device, args) => {
                        if (args.length === 0) return "% Incomplete command.";
                        device.setConfig("switchport_access_vlan", `switchport access vlan ${args[0]}`);
                        return "";
                    }
                }
            }
        },
        "shutdown": {
            maxArgs: 0,
            action: (device) => {
                device.setConfig("shutdown", `shutdown`);
                return "";
            }
        },
        "no": {
            "shutdown": {
                maxArgs: 0,
                action: (device) => {
                    device.setConfig("shutdown", `no shutdown`);
                    return "";
                }
            }
        },
        "description": {
            action: (device, args) => {
                device.setConfig("description", `description ${args.join(" ")}`);
                return "";
            }
        },
        "cdp": {
            "enable": {
                maxArgs: 0,
                action: (device) => {
                    device.setConfig("cdp", "cdp enable");
                    return "";
                }
            }
        },
        "lldp": {
            "transmit": {
                maxArgs: 0,
                action: (device) => {
                    device.setConfig("lldp-transmit", "lldp transmit");
                    return "";
                }
            },
            "receive": {
                maxArgs: 0,
                action: (device) => {
                    device.setConfig("lldp-receive", "lldp receive");
                    return "";
                }
            }
        }
    },

    "router": {
        "network": {
            maxArgs: 4,
            action: (device, args) => {
                if (args.length < 4 || args[2].toLowerCase() !== "area") return "% Incomplete command.";
                device.setConfig(`network_${args[0]}_${args[1]}`, `network ${args[0]} ${args[1]} area ${args[3]}`);
                return "";
            }
        }
    },

    "vlan": {
        "name": {
            maxArgs: 1,
            action: (device, args) => {
                if (args.length === 0) return "% Incomplete command.";
                device.setConfig("name", `name ${args[0]}`);
                return "";
            }
        }
    }
};