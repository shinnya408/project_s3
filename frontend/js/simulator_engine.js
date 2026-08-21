// ==========================================
// simulator_engine.js (Pro Edition - Full Feature)
// ==========================================

class VirtualDevice {
    constructor(hostname = "Router") {
        this.hostname = hostname;
        this.mode = "user"; // user, priv, global, if, router, vlan
        this.currentInterface = null;
        this.currentVlan = null;
        
        this.runningConfig = {
            hostname: hostname,
            interfaces: {},
            routes: [], 
            ospf: null, 
            vlans: {}   
        };
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
        return name;
    }

    _getTreeForMode() {
        return { ...commandTree["_common"], ...commandTree[this.mode] };
    }

    // ★追加: Tabキー補完ロジック
    getCompletion(input) {
        const text = input.trimStart();
        if (!text) return input;
        
        let tokens = text.split(/\s+/);
        const endsWithSpace = input.endsWith(' ');
        if (endsWithSpace && tokens[tokens.length - 1] === "") {
            tokens.pop();
        }

        if (endsWithSpace) return input; // スペースの後は補完しない

        let node = this._getTreeForMode();
        const lastToken = tokens[tokens.length - 1].toLowerCase();

        for (let i = 0; i < tokens.length - 1; i++) {
            const t = tokens[i].toLowerCase();
            const matches = Object.keys(node).filter(k => k.toLowerCase().startsWith(t));
            if (matches.length === 0) return input;
            const exactMatch = matches.find(k => k.toLowerCase() === t);
            const matchKey = exactMatch || (matches.length === 1 ? matches[0] : null);
            if (!matchKey || node[matchKey].action) return input;
            node = node[matchKey];
        }

        const matches = Object.keys(node).filter(k => k.toLowerCase().startsWith(lastToken));
        if (matches.length === 1) {
            tokens[tokens.length - 1] = matches[0];
            const prefixSpace = input.match(/^\s*/)[0];
            return prefixSpace + tokens.join(' ') + " ";
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
                const prefixSpace = input.match(/^\s*/)[0];
                return prefixSpace + tokens.join(' ');
            }
        }
        return input;
    }

    // ★追加: ?キー ヘルプロジック
    getHelp(input) {
        const text = input.trimStart();
        if (!text && input.length === 0) return this._formatHelp(this._getTreeForMode());

        let tokens = text.split(/\s+/);
        const endsWithSpace = input.endsWith(' ');
        if (endsWithSpace && tokens[tokens.length - 1] === "") {
            tokens.pop();
        }

        let node = this._getTreeForMode();
        
        for (let i = 0; i < tokens.length; i++) {
            const isLast = (i === tokens.length - 1);
            const t = tokens[i].toLowerCase();
            
            if (isLast && !endsWithSpace) {
                const matches = Object.keys(node).filter(k => k.toLowerCase().startsWith(t));
                if (matches.length > 0) {
                    let helpObj = {};
                    matches.forEach(m => helpObj[m] = node[m]);
                    return this._formatHelp(helpObj);
                } else {
                    return "% Unrecognized command";
                }
            }
            
            const matches = Object.keys(node).filter(k => k.toLowerCase().startsWith(t));
            if (matches.length === 0) return "% Unrecognized command";
            
            const exactMatch = matches.find(k => k.toLowerCase() === t);
            const matchKey = exactMatch || (matches.length === 1 ? matches[0] : null);
            
            if (!matchKey) return "% Ambiguous command";
            
            if (node[matchKey].action) {
                if (isLast && endsWithSpace) return "  <cr>";
                return ""; 
            }
            node = node[matchKey];
        }
        
        if (endsWithSpace) return this._formatHelp(node);
        return "";
    }

    _formatHelp(nodeObj) {
        let out = "";
        const keys = Object.keys(nodeObj).sort();
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
        const result = this._resolveCommand(tokens, dictionary);

        if (result.error) return result.error;

        try {
            return result.action(this, result.args);
        } catch (e) {
            return "% Error executing command";
        }
    }

    _resolveCommand(tokens, node) {
        if (tokens.length === 0) return { error: "% Incomplete command." };
        const currentToken = tokens[0].toLowerCase();

        const matches = Object.keys(node).filter(k => k.toLowerCase().startsWith(currentToken));

        if (matches.length === 0) return { error: "% Unrecognized command" };
        if (matches.length > 1) {
            const exactMatch = matches.find(k => k.toLowerCase() === currentToken);
            if (!exactMatch) return { error: "% Ambiguous command: " + currentToken };
            matches[0] = exactMatch;
        }

        const nextNode = node[matches[0]];

        if (nextNode.action) {
            return { action: nextNode.action, args: tokens.slice(1) };
        } else {
            if (tokens.length === 1) return { error: "% Incomplete command." };
            return this._resolveCommand(tokens.slice(1), nextNode);
        }
    }

    generateRunningConfig() {
        let conf = "!\n";
        conf += `hostname ${this.runningConfig.hostname}\n!\n`;
        
        for (const [id, vlanConf] of Object.entries(this.runningConfig.vlans)) {
            conf += `vlan ${id}\n name ${vlanConf.name}\n!\n`;
        }

        for (const [ifName, ifConf] of Object.entries(this.runningConfig.interfaces)) {
            conf += `interface ${ifName}\n`;
            if (ifConf.switchportMode) conf += ` switchport mode ${ifConf.switchportMode}\n`;
            if (ifConf.accessVlan) conf += ` switchport access vlan ${ifConf.accessVlan}\n`;
            if (ifConf.ip) conf += ` ip address ${ifConf.ip} ${ifConf.subnet}\n`;
            if (ifConf.shutdown !== false) conf += ` shutdown\n`; 
            else conf += ` no shutdown\n`;
            conf += "!\n";
        }

        if (this.runningConfig.ospf) {
            conf += `router ospf ${this.runningConfig.ospf.processId}\n`;
            for (const net of this.runningConfig.ospf.networks) {
                conf += ` network ${net.network} ${net.wildcard} area ${net.area}\n`;
            }
            conf += "!\n";
        }

        for (const r of this.runningConfig.routes) {
            conf += `ip route ${r.network} ${r.mask} ${r.nextHop}\n`;
        }
        if (this.runningConfig.routes.length > 0) conf += "!\n";

        conf += "end";
        return conf;
    }
}

// ----------------------------------------------------
// Ciscoライク コマンド辞書
// ----------------------------------------------------
const commandTree = {
    "_common": {
        "exit": {
            action: (device) => {
                if (device.mode === "if" || device.mode === "router" || device.mode === "vlan") device.mode = "global";
                else if (device.mode === "global") device.mode = "priv";
                else if (device.mode === "priv") device.mode = "user";
                return "";
            }
        },
        "end": {
            action: (device) => {
                if (device.mode !== "user") device.mode = "priv";
                return "";
            }
        }
    },
    
    "user": {
        "enable": {
            action: (device) => { device.mode = "priv"; return ""; }
        }
    },
    
    "priv": {
        "disable": {
            action: (device) => { device.mode = "user"; return ""; }
        },
        "configure": {
            "terminal": {
                action: (device) => { device.mode = "global"; return "Enter configuration commands, one per line.  End with CNTL/Z."; }
            }
        },
        "show": {
            "running-config": {
                action: (device) => device.generateRunningConfig()
            },
            "interfaces": {
                action: (device) => {
                    let out = "";
                    for(const [name, conf] of Object.entries(device.runningConfig.interfaces)) {
                        const status = conf.shutdown !== false ? "administratively down" : "up";
                        out += `${name} is ${status}, line protocol is ${status}\n`;
                        if (conf.ip) out += `  Internet address is ${conf.ip}/${conf.subnet}\n`;
                    }
                    return out.trim() || "No interfaces configured.";
                }
            },
            "ip": {
                "interface": {
                    "brief": {
                        action: (device) => {
                            let out = "Interface              IP-Address      OK? Method Status                Protocol\n";
                            for(const [name, conf] of Object.entries(device.runningConfig.interfaces)) {
                                const ip = conf.ip || "unassigned";
                                const status = conf.shutdown !== false ? "administratively down" : "up";
                                const proto = conf.shutdown !== false ? "down" : "up";
                                out += `${name.padEnd(22)} ${ip.padEnd(15)} YES manual ${status.padEnd(21)} ${proto}\n`;
                            }
                            return out.trim() || "Interface              IP-Address      OK? Method Status                Protocol";
                        }
                    }
                },
                "route": {
                    action: (device) => {
                        let out = "Codes: L - local, C - connected, S - static, O - OSPF\n\n";
                        out += "Gateway of last resort is not set\n\n";
                        
                        for(const [name, conf] of Object.entries(device.runningConfig.interfaces)) {
                            if(conf.ip && conf.shutdown === false) {
                                out += `C    ${conf.ip} is directly connected, ${name}\n`;
                            }
                        }
                        for(const r of device.runningConfig.routes) {
                            out += `S    ${r.network} via ${r.nextHop}\n`;
                        }
                        return out.trim();
                    }
                }
            }
        }
    },
    
    "global": {
        "hostname": {
            action: (device, args) => {
                if (args.length === 0) return "% Incomplete command.";
                device.hostname = args[0];
                device.runningConfig.hostname = args[0];
                return "";
            }
        },
        "interface": {
            action: (device, args) => {
                if (args.length === 0) return "% Incomplete command.";
                const ifName = device._normalizeInterfaceName(args[0]);
                device.mode = "if";
                device.currentInterface = ifName;
                if (!device.runningConfig.interfaces[ifName]) {
                    device.runningConfig.interfaces[ifName] = { shutdown: true };
                }
                return "";
            }
        },
        "vlan": {
            action: (device, args) => {
                if (args.length === 0) return "% Incomplete command.";
                const vlanId = args[0];
                device.mode = "vlan";
                device.currentVlan = vlanId;
                if (!device.runningConfig.vlans[vlanId]) {
                    device.runningConfig.vlans[vlanId] = { name: `VLAN${vlanId.padStart(4, '0')}` };
                }
                return "";
            }
        },
        "ip": {
            "route": {
                action: (device, args) => {
                    if (args.length < 3) return "% Incomplete command.";
                    device.runningConfig.routes.push({ network: args[0], mask: args[1], nextHop: args[2] });
                    return "";
                }
            }
        },
        "router": {
            "ospf": {
                action: (device, args) => {
                    if (args.length === 0) return "% Incomplete command.";
                    device.mode = "router";
                    if (!device.runningConfig.ospf) {
                        device.runningConfig.ospf = { processId: args[0], networks: [] };
                    }
                    return "";
                }
            }
        }
    },
    
    "if": {
        "ip": {
            "address": {
                action: (device, args) => {
                    if (args.length < 2) return "% Incomplete command.";
                    device.runningConfig.interfaces[device.currentInterface].ip = args[0];
                    device.runningConfig.interfaces[device.currentInterface].subnet = args[1];
                    return "";
                }
            }
        },
        "switchport": {
            "mode": {
                "access": {
                    action: (device) => {
                        device.runningConfig.interfaces[device.currentInterface].switchportMode = "access";
                        return "";
                    }
                },
                "trunk": {
                    action: (device) => {
                        device.runningConfig.interfaces[device.currentInterface].switchportMode = "trunk";
                        return "";
                    }
                }
            },
            "access": {
                "vlan": {
                    action: (device, args) => {
                        if (args.length === 0) return "% Incomplete command.";
                        device.runningConfig.interfaces[device.currentInterface].accessVlan = args[0];
                        return "";
                    }
                }
            }
        },
        "no": {
            "shutdown": {
                action: (device) => {
                    device.runningConfig.interfaces[device.currentInterface].shutdown = false;
                    return "";
                }
            }
        },
        "shutdown": {
            action: (device) => {
                device.runningConfig.interfaces[device.currentInterface].shutdown = true;
                return "";
            }
        }
    },

    "router": {
        "network": {
            action: (device, args) => {
                if (args.length < 4 || args[2].toLowerCase() !== "area") return "% Incomplete command.";
                device.runningConfig.ospf.networks.push({ network: args[0], wildcard: args[1], area: args[3] });
                return "";
            }
        }
    },

    "vlan": {
        "name": {
            action: (device, args) => {
                if (args.length === 0) return "% Incomplete command.";
                device.runningConfig.vlans[device.currentVlan].name = args[0];
                return "";
            }
        }
    }
};