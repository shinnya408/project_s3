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
        
        this.registeredInterfaces = new Set();
        this.isInitialized = false; 
        
        this.configStore = {
            "global": { "hostname": `hostname ${hostname}` }
        };
    }

    setConfig(key, commandString, scope = this.currentScope) {
        if (Array.isArray(scope)) {
            scope.forEach(s => this._setConfigSingle(key, commandString, s));
        } else {
            this._setConfigSingle(key, commandString, scope);
        }
    }

    _setConfigSingle(key, commandString, scope) {
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
            case "if": 
                return Array.isArray(this.currentScope) ? `${this.hostname}(config-if-range)#` : `${this.hostname}(config-if)#`;
            case "router": return `${this.hostname}(config-router)#`;
            case "vlan": return `${this.hostname}(config-vlan)#`;
            default: return `${this.hostname}>`;
        }
    }

    getRegisteredInterfaces() {
        return Array.from(this.registeredInterfaces);
    }

    _normalizeInterfaceName(name) {
        if (!name) return "";
        const match = name.match(/^([a-zA-Z]+)(.*)$/);
        if (!match) return name;
        
        const prefix = match[1].toLowerCase();
        const suffix = match[2];
        
        if (/^g$|^gi$|^gig$|^gigabitethernet$/i.test(prefix)) return 'GigabitEthernet' + suffix;
        if (/^f$|^fa$|^fastethernet$/i.test(prefix)) return 'FastEthernet' + suffix;
        if (/^s$|^se$|^serial$/i.test(prefix)) return 'Serial' + suffix;
        if (/^e$|^et$|^eth$|^ethernet$/i.test(prefix)) return 'Ethernet' + suffix;
        if (/^vl$|^vlan$/i.test(prefix)) return 'Vlan' + suffix;
        if (/^lo$|^loopback$/i.test(prefix)) return 'Loopback' + suffix;
        if (/^po$|^port-channel$/i.test(prefix)) return 'Port-channel' + suffix; 
        
        return name;
    }

    _parseInterfaceRangeArgs(args) {
        const fullStr = args.join(""); 
        const parts = fullStr.split(",");
        const resultScopes = [];

        for (const part of parts) {
            if (!part) continue;
            
            const dashIndex = part.indexOf("-");
            if (dashIndex !== -1) {
                const startStr = part.substring(0, dashIndex);
                const endStr = part.substring(dashIndex + 1);
                
                const matchStart = startStr.match(/^([a-zA-Z]+)(\d*\/?.*?\/?)(\d+)$/);
                if (!matchStart) return "% Invalid interface range";
                
                const prefix = matchStart[1];
                const middle = matchStart[2];
                const startNum = parseInt(matchStart[3], 10);
                
                let endNum;
                const matchEnd = endStr.match(/^([a-zA-Z]+)?(\d*\/?.*?\/?)(\d+)$/);
                if (matchEnd) {
                    if (matchEnd[1] && matchEnd[1].toLowerCase() !== prefix.toLowerCase()) {
                        return "% Invalid interface range";
                    }
                    endNum = parseInt(matchEnd[3], 10);
                } else {
                    endNum = parseInt(endStr, 10);
                }
                
                if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) {
                    return "% Invalid interface range";
                }
                
                for (let i = startNum; i <= endNum; i++) {
                    const rawIfName = prefix + middle + i;
                    const ifName = this._normalizeInterfaceName(rawIfName);
                    
                    const validTypes = /^(GigabitEthernet|FastEthernet|Ethernet|Serial|Vlan|Loopback|Port-channel)/i;
                    if (!validTypes.test(ifName)) return "% Invalid interface range";
                    
                    const isPhysical = /^(GigabitEthernet|FastEthernet|Ethernet|Serial)/i.test(ifName);
                    if (isPhysical) {
                        if (!this.isInitialized) {
                            this.registeredInterfaces.add(ifName);
                        } else if (!this.registeredInterfaces.has(ifName)) {
                            return "% Invalid interface range"; 
                        }
                    } else {
                        this.registeredInterfaces.add(ifName);
                    }
                    resultScopes.push(`interface ${ifName}`);
                }
            } else {
                const ifName = this._normalizeInterfaceName(part);
                const validTypes = /^(GigabitEthernet|FastEthernet|Ethernet|Serial|Vlan|Loopback|Port-channel)/i;
                if (!validTypes.test(ifName)) return "% Invalid interface range";

                const isPhysical = /^(GigabitEthernet|FastEthernet|Ethernet|Serial)/i.test(ifName);
                if (isPhysical) {
                    if (!this.isInitialized) {
                        this.registeredInterfaces.add(ifName);
                    } else if (!this.registeredInterfaces.has(ifName)) {
                        return "% Invalid interface range";
                    }
                } else {
                    this.registeredInterfaces.add(ifName);
                }
                resultScopes.push(`interface ${ifName}`);
            }
        }
        return resultScopes;
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
        
        // ★追加: 変数(IP等)の後に続く「area」のTab補完を動的に割り込ませる
        if (this.mode === "router") {
            const match = input.match(/^(\s*network\s+\S+\s+\S+\s+)(a[a-z]*)$/i);
            if (match && "area".startsWith(match[2].toLowerCase())) return match[1] + "area ";
        }
        if (this.mode === "if") {
            const match = input.match(/^(\s*ip\s+ospf\s+\d+\s+)(a[a-z]*)$/i);
            if (match && "area".startsWith(match[2].toLowerCase())) return match[1] + "area ";
        }
        
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

        // ★追加: 変数(IP等)の後に続く「area」の「?」ヘルプを動的に割り込ませる
        if (this.mode === "router") {
            const match = input.match(/^\s*network\s+\S+\s+\S+\s+([a-z]*)$/i);
            if (match) {
                const t = match[1].toLowerCase();
                if (!t || "area".startsWith(t)) return "  area  Set the OSPF area ID";
                return "% Unrecognized command";
            }
        }
        if (this.mode === "if") {
            const match = input.match(/^\s*ip\s+ospf\s+\d+\s+([a-z]*)$/i);
            if (match) {
                const t = match[1].toLowerCase();
                if (!t || "area".startsWith(t)) return "  area  Set the OSPF area ID";
                return "% Unrecognized command";
            }
        }

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
                this.setConfig = (key, val, scope = this.currentScope) => {
                    VirtualDevice.prototype.setConfig.call(this, key, null, scope);
                };
            }
            
            const output = result.action(this, result.args, isAutoNo);
            
            if (isAutoNo) delete this.setConfig;
            return output;
            
        } catch (e) {
            if (isAutoNo) delete this.setConfig;
            return "% Error executing command";
        }
    }

    _resolveCommand(tokens, node) {
        if (tokens.length === 0) {
            if (node.action) return { action: node.action, args: [], maxArgs: node.maxArgs };
            return { error: "% Incomplete command." };
        }
        const currentToken = tokens[0].toLowerCase();

        const subKeys = Object.keys(node).filter(k => typeof node[k] === 'object' && node[k] !== null);
        let matches = subKeys.filter(k => k.toLowerCase().startsWith(currentToken));

        if (matches.length === 0) {
            if (node.action) {
                return { action: node.action, args: tokens, maxArgs: node.maxArgs };
            }
            return { error: "% Unrecognized command" };
        }
        
        if (matches.length > 1) {
            const exactMatch = matches.find(k => k.toLowerCase() === currentToken);
            if (!exactMatch) {
                if (node.action) return { action: node.action, args: tokens, maxArgs: node.maxArgs };
                return { error: "% Ambiguous command: " + currentToken };
            }
            matches[0] = exactMatch;
        }

        const nextNode = node[matches[0]];
        return this._resolveCommand(tokens.slice(1), nextNode);
    }

    generateRunningConfig() {
        let conf = "!\n";
        
        for (const val of Object.values(this.configStore["global"] || {})) {
            conf += `${val}\n`;
        }
        conf += "!\n";
        
        const scopesToPrint = new Set(Object.keys(this.configStore).filter(s => s !== "global"));
        this.registeredInterfaces.forEach(ifName => scopesToPrint.add(`interface ${ifName}`));

        for (const scopeName of Array.from(scopesToPrint)) {
            conf += `${scopeName}\n`;
            const settings = this.configStore[scopeName] || {};
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
// 賢いインターフェイス用アクション生成関数
// ==========================================
const makeIfAction = (prefix) => (device, args, isAutoNo) => {
    if (args.length === 0 && prefix === "") return "% Incomplete command.";
    if (args.length === 0 && prefix !== "") return "% Incomplete command."; 
    
    let rawIfName = prefix + args.join(""); 
    const ifName = device._normalizeInterfaceName(rawIfName);
    
    const validTypes = /^(GigabitEthernet|FastEthernet|Ethernet|Serial|Vlan|Loopback|Port-channel)/i;
    if (!validTypes.test(ifName)) {
        return "% Invalid interface type and number";
    }

    const isPhysical = /^(GigabitEthernet|FastEthernet|Ethernet|Serial)/i.test(ifName);
    if (isPhysical) {
        if (!device.isInitialized) {
            device.registeredInterfaces.add(ifName);
        } else {
            if (!device.registeredInterfaces.has(ifName)) {
                return "% Invalid interface type and number";
            }
        }
    } else {
        device.registeredInterfaces.add(ifName);
    }

    if (isAutoNo) {
        delete device.configStore[`interface ${ifName}`];
        if (!isPhysical) device.registeredInterfaces.delete(ifName);
        return "";
    }
    
    device.mode = "if";
    device.currentScope = `interface ${ifName}`;
    return "";
};

const makeShowIfAction = (prefix) => (device, args) => {
    let rawIfName = prefix + args.join("");
    
    if (rawIfName === "") {
        let out = "";
        const scopesToPrint = new Set(Object.keys(device.configStore).filter(s => s.startsWith("interface ")));
        device.registeredInterfaces.forEach(ifName => scopesToPrint.add(`interface ${ifName}`));
        
        for(const scope of Array.from(scopesToPrint)) {
            const conf = device.configStore[scope] || {};
            const name = scope.replace("interface ", "");
            const isDown = conf["shutdown"] === "shutdown" || !conf["shutdown"];
            const status = isDown ? "administratively down" : "up";
            out += `${name} is ${status}, line protocol is ${status}\n`;
            if (conf["ip_address"]) {
                const match = conf["ip_address"].match(/ip address (\S+) (\S+)/);
                if (match) out += `  Internet address is ${match[1]}/${match[2]}\n`;
            }
        }
        return out.trim() || "No interfaces configured.";
    } else {
        const ifName = device._normalizeInterfaceName(rawIfName);
        
        const validTypes = /^(GigabitEthernet|FastEthernet|Ethernet|Serial|Vlan|Loopback|Port-channel)/i;
        if (!validTypes.test(ifName)) {
            return "% Invalid interface type and number";
        }

        const scope = `interface ${ifName}`;
        
        // ★修正: 物理・論理に関わらず、未作成（未登録）のインターフェイスの show は弾く
        if (!device.registeredInterfaces.has(ifName)) {
            return "% Invalid interface type and number";
        }
        
        const conf = device.configStore[scope] || {};
        const isDown = conf["shutdown"] === "shutdown" || !conf["shutdown"];
        const status = isDown ? "administratively down" : "up";
        let out = `${ifName} is ${status}, line protocol is ${status}\n`;
        if (conf["ip_address"]) {
            const match = conf["ip_address"].match(/ip address (\S+) (\S+)/);
            if (match) out += `  Internet address is ${match[1]}/${match[2]}\n`;
        }
        return out.trim();
    }
};

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
                        device.startupConfigSaved = true;
                        return "Destination filename [startup-config]? \nBuilding configuration...\n[OK]";
                    }
                }
            }
        },
        "ping": {
            maxArgs: 1,
            action: (device, args) => {
                if (args.length === 0) return "% Incomplete command.";
                const target = args[0];
                console.log(`🚀 [Simulator] Ping started to ${target}`);
                const out = `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:\n!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms`;
                console.log(`✅ [Simulator] Ping finished to ${target}`);
                return out;
            }
        },
        "show": {
            "running-config": {
                maxArgs: 0,
                action: (device) => device.generateRunningConfig()
            },
            "etherchannel": {
                "summary": {
                    maxArgs: 0,
                    action: (device) => {
                        let out = "Flags:  D - down        P - bundled in port-channel\n        I - stand-alone s - suspended\n        H - Hot-standby (IPv4 only)\n        R - Layer3      S - Layer2\n        U - in use      f - failed to allocate aggregator\n\n        M - not in use, minimum links not met\n        u - unsuitable for bundling\n        w - waiting to be aggregated\n        d - default port\n";
                        
                        const groups = {};
                        for (const [scope, conf] of Object.entries(device.configStore)) {
                            if (scope.startsWith("interface ")) {
                                const ifName = scope.replace("interface ", "");
                                if (conf["channel_group"]) {
                                    const match = conf["channel_group"].match(/channel-group (\d+) mode (\S+)/);
                                    if (match) {
                                        const grp = match[1];
                                        const mode = match[2];
                                        if (!groups[grp]) groups[grp] = [];
                                        groups[grp].push({ifName, mode});
                                    }
                                }
                            }
                        }

                        const groupKeys = Object.keys(groups);
                        if (groupKeys.length === 0) {
                            return out + "\nNumber of channel-groups in use: 0\nNumber of aggregators:           0\n\nNo EtherChannel configured.";
                        }

                        out += `\nNumber of channel-groups in use: ${groupKeys.length}\nNumber of aggregators:           ${groupKeys.length}\n\nGroup  Port-channel  Protocol    Ports\n------+-------------+-----------+-----------------------------------------------`;
                        
                        for (const grp of groupKeys.sort((a,b) => a - b)) {
                            const poName = `Po${grp}(SU)`;
                            
                            let protocol = "-";
                            const firstMode = groups[grp][0].mode;
                            if (['active', 'passive'].includes(firstMode)) protocol = "LACP";
                            else if (['desirable', 'auto'].includes(firstMode)) protocol = "PAgP";

                            const ports = groups[grp].map(p => {
                                const shortName = p.ifName.replace(/Ethernet/i, 'E').replace(/FastEthernet/i, 'Fa').replace(/GigabitEthernet/i, 'Gi');
                                return `${shortName}(P)`;
                            }).join(" ");

                            out += `\n${grp.padEnd(6)} ${poName.padEnd(13)} ${protocol.padEnd(11)} ${ports}`;
                        }
                        return out;
                    }
                }
            },
            "interfaces": {
                maxArgs: 0,
                action: makeShowIfAction("")
            },
            "interface": {
                "FastEthernet": { maxArgs: 1, action: makeShowIfAction("FastEthernet") },
                "GigabitEthernet": { maxArgs: 1, action: makeShowIfAction("GigabitEthernet") },
                "Ethernet": { maxArgs: 1, action: makeShowIfAction("Ethernet") },
                "Serial": { maxArgs: 1, action: makeShowIfAction("Serial") },
                "vlan": { maxArgs: 1, action: makeShowIfAction("Vlan") },
                "Port-channel": { maxArgs: 1, action: makeShowIfAction("Port-channel") },
                maxArgs: 2,
                action: makeShowIfAction("")
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
                "ospf": {
                    "neighbor": {
                        maxArgs: 0,
                        action: (device) => {
                            let hasOspf = false;
                            for (const [scope, conf] of Object.entries(device.configStore)) {
                                if (scope.startsWith("router ospf")) hasOspf = true;
                            }
                            if (!hasOspf) return "";
                            return "Neighbor ID     Pri   State           Dead Time   Address         Interface\n192.168.1.2       1   FULL/BDR        00:00:34    10.0.0.2        GigabitEthernet0/1";
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
            "range": {
                action: (device, args, isAutoNo) => {
                    if (args.length === 0) return "% Incomplete command.";
                    const scopes = device._parseInterfaceRangeArgs(args);
                    if (typeof scopes === 'string') {
                        return scopes; 
                    }
                    if (scopes.length === 0) {
                        return "% Invalid interface range";
                    }
                    if (isAutoNo) {
                        scopes.forEach(scope => {
                            delete device.configStore[scope];
                            const ifName = scope.replace("interface ", "");
                            const isPhysical = /^(GigabitEthernet|FastEthernet|Ethernet|Serial)/i.test(ifName);
                            if (!isPhysical) device.registeredInterfaces.delete(ifName);
                        });
                        return "";
                    }
                    device.mode = "if";
                    device.currentScope = scopes;
                    return "";
                }
            },
            "FastEthernet": { maxArgs: 1, action: makeIfAction("FastEthernet") },
            "GigabitEthernet": { maxArgs: 1, action: makeIfAction("GigabitEthernet") },
            "Ethernet": { maxArgs: 1, action: makeIfAction("Ethernet") },
            "Serial": { maxArgs: 1, action: makeIfAction("Serial") },
            "vlan": { maxArgs: 1, action: makeIfAction("Vlan") },
            "Port-channel": { maxArgs: 1, action: makeIfAction("Port-channel") },
            maxArgs: 2,
            action: makeIfAction("")
        },
        "vlan": {
            maxArgs: 1,
            action: (device, args, isAutoNo) => {
                if (args.length === 0) return "% Incomplete command.";
                if (isAutoNo) {
                    delete device.configStore[`vlan ${args[0]}`];
                    return "";
                }
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
                action: (device, args, isAutoNo) => {
                    if (args.length === 0) return "% Incomplete command.";
                    if (isAutoNo) {
                        delete device.configStore[`router ospf ${args[0]}`];
                        return "";
                    }
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
                    device.setConfig("lldp", "lldp run", "global");
                    return "";
                }
            }
        },
        "cdp": {
            "run": {
                maxArgs: 0,
                action: (device) => {
                    device.setConfig("cdp", "cdp run", "global");
                    return "";
                }
            }
        }
    },
    
    "if": {
        "channel-group": {
            maxArgs: 3,
            action: (device, args) => {
                if (args.length < 3 || args[1].toLowerCase() !== "mode") return "% Incomplete command.";
                const groupNum = args[0];
                const mode = args[2].toLowerCase();
                const validModes = ["active", "passive", "desirable", "auto", "on"];
                if (!validModes.includes(mode)) return "% Invalid input detected at '^' marker.";
                
                device.setConfig("channel_group", `channel-group ${groupNum} mode ${mode}`);
                return "";
            }
        },
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
            },
            "ospf": {
                "cost": {
                    maxArgs: 1,
                    action: (device, args) => {
                        if (args.length === 0) return "% Incomplete command.";
                        device.setConfig("ip_ospf_cost", `ip ospf cost ${args[0]}`);
                        return "";
                    }
                },
                "priority": {
                    maxArgs: 1,
                    action: (device, args) => {
                        if (args.length === 0) return "% Incomplete command.";
                        device.setConfig("ip_ospf_priority", `ip ospf priority ${args[0]}`);
                        return "";
                    }
                },
                action: (device, args) => {
                    if (args.length === 0) return "% Incomplete command.";
                    // ★追加: 実行時にも省略形を許容する
                    if (args.length >= 3 && "area".startsWith(args[1].toLowerCase())) {
                        device.setConfig("ip_ospf_area", `ip ospf ${args[0]} area ${args[2]}`);
                        return "";
                    }
                    return "% Invalid input detected at '^' marker.";
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
        "router-id": {
            maxArgs: 1,
            action: (device, args) => {
                if (args.length === 0) return "% Incomplete command.";
                if (!isValidIpAddress(args[0])) return "% OSPF: Invalid address";
                device.setConfig("router_id", `router-id ${args[0]}`);
                return "";
            }
        },
        "network": {
            maxArgs: 4,
            action: (device, args) => {
                // ★追加: 実行時にも省略形を許容し、正規化して保存
                if (args.length < 4 || !"area".startsWith(args[2].toLowerCase())) return "% Incomplete command.";
                device.setConfig(`network_${args[0]}_${args[1]}`, `network ${args[0]} ${args[1]} area ${args[3]}`);
                return "";
            }
        },
        "passive-interface": {
            maxArgs: 1,
            action: (device, args) => {
                if (args.length === 0) return "% Incomplete command.";
                const ifName = args[0].toLowerCase() === "default" ? "default" : device._normalizeInterfaceName(args[0]);
                device.setConfig(`passive_interface_${ifName}`, `passive-interface ${ifName}`);
                return "";
            }
        },
        "default-information": {
            maxArgs: 2,
            action: (device, args) => {
                if (args.length === 0 || args[0].toLowerCase() !== "originate") return "% Incomplete command.";
                const always = args[1] && args[1].toLowerCase() === "always" ? " always" : "";
                device.setConfig("default_information", `default-information originate${always}`);
                return "";
            }
        },
        "auto-cost": {
            maxArgs: 2,
            action: (device, args) => {
                if (args.length < 2 || args[0].toLowerCase() !== "reference-bandwidth") return "% Incomplete command.";
                device.setConfig("auto_cost", `auto-cost reference-bandwidth ${args[1]}`);
                return "% OSPF: Reference bandwidth is changed.\n        Please ensure reference bandwidth is consistent across all routers.";
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