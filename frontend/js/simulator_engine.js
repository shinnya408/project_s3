// ==========================================
// 1. ネットワーク計算・厳密検証・パース用ヘルパー関数
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
    if (firstOctet === 127 || firstOctet >= 224) return false;
    return true;
}

function normalizeInterfaceName(name) {
    if (!name) return "";
    const stripped = name.replace(/\s+/g, '');
    const match = stripped.match(/^([a-zA-Z\-]+)(.*)$/);
    if (!match) return stripped;
    
    const prefix = match[1].toLowerCase();
    const suffix = match[2];
    
    if (/^g/i.test(prefix)) return 'GigabitEthernet' + suffix;
    if (/^f/i.test(prefix)) return 'FastEthernet' + suffix;
    if (/^s/i.test(prefix)) return 'Serial' + suffix;
    if (/^e/i.test(prefix)) return 'Ethernet' + suffix;
    if (/^po/i.test(prefix)) return 'Port-channel' + suffix;
    
    return stripped;
}

function parseInterfaceRangeArgs(fullStr) {
    if (!fullStr) return null;
    const parts = fullStr.split(",");
    const resultScopes = [];
    
    for (let part of parts) {
        part = part.trim();
        if (!part) continue;
        const dashIndex = part.indexOf("-");
        
        if (dashIndex !== -1) {
            const startStr = part.substring(0, dashIndex).trim();
            const endStr = part.substring(dashIndex + 1).trim();
            const matchStart = startStr.match(/^([a-zA-Z\-]+)(\d*\/?.*?\/?)(\d+)$/);
            if (!matchStart) return null;
            
            const prefix = matchStart[1];
            const middle = matchStart[2];
            const startNum = parseInt(matchStart[3], 10);

            let endNum;
            const matchEnd = endStr.match(/^([a-zA-Z\-]+)?(\d*\/?.*?\/?)(\d+)$/);
            if (matchEnd) {
                endNum = parseInt(matchEnd[3], 10);
            } else {
                endNum = parseInt(endStr, 10);
            }
            if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) return null;

            for (let i = startNum; i <= endNum; i++) {
                resultScopes.push(normalizeInterfaceName(prefix + middle + i));
            }
        } else {
            resultScopes.push(normalizeInterfaceName(part));
        }
    }
    return resultScopes.length > 0 ? resultScopes : null;
}

// ==========================================
// 2. データ型の定義（自動ヘルプ・補完・バリデーション）
// ==========================================
const CommandTypes = {
    WORD: { 
        help: "  WORD        Single word string", 
        validate: (val) => val && val.length > 0 
    },
    IPV4: { 
        help: "  A.B.C.D     IP address", 
        validate: isValidIpAddress
    },
    IPV4_MASK: { 
        help: "  A.B.C.D     IP subnet mask", 
        validate: isValidSubnetMask
    },
    IF_ID: { 
        help: "  IF_NAME     FastEthernet, GigabitEthernet, Port-channel, etc.", 
        validate: (val) => {
            const stripped = val.replace(/\s+/g, '');
            const match = stripped.match(/^([a-zA-Z\-]+)(\d.*)$/);
            if (!match) return false;
            const prefix = match[1].toLowerCase();
            const validPrefixes = /^(f|fa|fastethernet|g|gi|gig|gigabitethernet|e|et|eth|ethernet|s|se|serial|po|por|port|port-channel|v|vl|vlan|lo|loopback)$/;
            return validPrefixes.test(prefix);
        },
        consumeRest: true,
        getCompletions: (val) => {
            const match = val.replace(/\s+/g, '').match(/^([a-zA-Z\-]+)(\d*.*)$/);
            if (!match) return [];
            const prefix = match[1].toLowerCase();
            const suffix = match[2];
            const types = ['FastEthernet', 'GigabitEthernet', 'Ethernet', 'Serial', 'Port-channel', 'Vlan', 'Loopback'];
            return types.filter(t => t.toLowerCase().startsWith(prefix)).map(m => m + suffix);
        }
    },
    IF_RANGE: {
        help: "  IF_RANGE    Interface range (e.g., FastEthernet0/1 - 3)",
        validate: (val) => parseInterfaceRangeArgs(val) !== null,
        consumeRest: true
    },
    VLAN_ID: {
        help: "  <1-4094>    VLAN ID",
        validate: (val) => { const n = parseInt(val, 10); return !isNaN(n) && n >= 1 && n <= 4094; }
    },
    PROCESS_ID: {
        help: "  <1-65535>   Process ID",
        validate: (val) => { const n = parseInt(val, 10); return !isNaN(n) && n >= 1 && n <= 65535; }
    },
    AREA_ID: {
        help: "  <0-4294967295> OSPF area ID as a decimal value",
        validate: (val) => /^\d+$/.test(val)
    },
    OSPF_COST: {
        help: "  <1-65535>   Cost",
        validate: (val) => { const n = parseInt(val, 10); return !isNaN(n) && n >= 1 && n <= 65535; }
    },
    OSPF_PRIORITY: {
        help: "  <0-255>     Priority",
        validate: (val) => { const n = parseInt(val, 10); return !isNaN(n) && n >= 0 && n <= 255; }
    },
    CHANNEL_GROUP: {
        help: "  <1-48>      Channel group number",
        validate: (val) => { const n = parseInt(val, 10); return !isNaN(n) && n >= 1 && n <= 48; }
    },
    CHANNEL_MODE: {
        help: "active      Enable LACP unconditionally\nauto        Enable PAgP only if a PAgP device is detected\ndesirable   Enable PAgP unconditionally\non          Enable Etherchannel only\npassive     Enable LACP only if a LACP device is detected",
        validate: (val) => /^(active|passive|desirable|auto|on)$/i.test(val)
    },
    // ★追加: ACL/NAT/STP用の型定義
    ACL_NUM: {
        help: "  <1-199>     Access list number",
        validate: (val) => { const n = parseInt(val, 10); return !isNaN(n) && n >= 1 && n <= 199; }
    },
    ACL_ACTION: {
        help: "  permit      Specify packets to forward\n  deny        Specify packets to reject",
        validate: (val) => /^(permit|deny)$/i.test(val)
    },
    TRAFFIC_DIR: {
        help: "  in          inbound packets\n  out         outbound packets",
        validate: (val) => /^(in|out)$/i.test(val)
    },
    NAT_DIR: {
        help: "  inside      Inside interface for NAT\n  outside     Outside interface for NAT",
        validate: (val) => /^(inside|outside)$/i.test(val)
    },
    STP_MODE: {
        help: "  pvst        Per-Vlan spanning tree mode\n  rapid-pvst  Per-Vlan rapid spanning tree mode",
        validate: (val) => /^(pvst|rapid-pvst)$/i.test(val)
    },
    STP_ROOT: {
        help: "  primary     Configure this switch as primary root\n  secondary   Configure switch as secondary root",
        validate: (val) => /^(primary|secondary)$/i.test(val)
    },
    STP_PRIORITY: {
        help: "  <0-61440>   bridge priority in increments of 4096",
        validate: (val) => { const n = parseInt(val, 10); return !isNaN(n) && n >= 0 && n <= 61440 && n % 4096 === 0; }
    },
    TEXT: {
        help: "  LINE        Text string (allows spaces)",
        validate: (val) => val && val.length > 0,
        consumeRest: true 
    }
};

const applyToScopes = (device, callback) => {
    const scopes = Array.isArray(device.currentScope) ? device.currentScope : [device.currentScope];
    scopes.forEach(scope => callback(device.state.interfaces[scope]));
};

// ==========================================
// 3. コマンドスキーマ
// ==========================================
const commandSchema = [
    // --- モード遷移・基本 ---
    { pattern: "enable", mode: "user", action: (d) => { d.mode = "priv"; } },
    { pattern: "disable", mode: "priv", action: (d) => { d.mode = "user"; } },
    { pattern: "configure terminal", mode: "priv", action: (d) => { d.mode = "global"; } },
    { pattern: "exit", mode: "global", action: (d) => { d.mode = "priv"; } },
    { pattern: "exit", mode: "if", action: (d) => { d.mode = "global"; } },
    { pattern: "exit", mode: "vlan", action: (d) => { d.mode = "global"; } },
    { pattern: "exit", mode: "router", action: (d) => { d.mode = "global"; } },
    { pattern: "end", mode: "global", action: (d) => { d.mode = "priv"; } },
    { pattern: "end", mode: "if", action: (d) => { d.mode = "priv"; } },
    { pattern: "end", mode: "vlan", action: (d) => { d.mode = "priv"; } },
    { pattern: "end", mode: "router", action: (d) => { d.mode = "priv"; } },

    // --- 必須/対話プロンプト系 (Privileged EXEC) ---
    {
        pattern: "clear ip ospf process",
        mode: "priv",
        help: "Reset OSPF process",
        action: (device) => {
            device.interactiveState = {
                promptText: "Reset ALL OSPF processes? [no]: ",
                handler: (dev, input) => {
                    const ans = input.trim().toLowerCase();
                    if (ans === 'y' || ans === 'yes') {
                        dev.ospfProcessCleared = true; 
                        return "OSPF processes reset";
                    }
                    return "";
                }
            };
            return ""; 
        }
    },
    {
        pattern: "copy running-config startup-config",
        mode: "priv",
        help: "Copy from current system configuration to startup configuration",
        action: (device) => {
            device.interactiveState = {
                promptText: "Destination filename [startup-config]? ",
                handler: (dev, input) => {
                    dev.startupConfigSaved = true; 
                    return "Building configuration...\n[OK]";
                }
            };
            return "";
        }
    },
    {
        pattern: "ping {ip:IPV4}",
        mode: "priv",
        help: "Send echo messages",
        action: (device, args) => {
            return `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${args.ip}, timeout is 2 seconds:\n!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms`;
        }
    },

    // --- グローバル設定 ---
    {
        pattern: "hostname {name:WORD}",
        mode: "global",
        action: (device, args) => { device.state.hostname = args.name; },
        noAction: (device) => { device.state.hostname = "Router"; }
    },
    {
        pattern: "vlan {id:VLAN_ID}",
        mode: "global",
        help: "Configure VLAN",
        action: (device, args) => {
            device.mode = "vlan";
            device.currentScope = parseInt(args.id, 10);
            if (!device.state.vlans[device.currentScope]) device.state.vlans[device.currentScope] = {};
        },
        noAction: (device, args) => { delete device.state.vlans[parseInt(args.id, 10)]; }
    },
    {
        pattern: "ip route {network:IPV4} {mask:IPV4_MASK} {nextHop:IPV4}",
        mode: "global",
        help: "Establish static routes",
        action: (device, args) => {
            if (!isNetworkAddress(args.network, args.mask)) return "% Inconsistent address and mask.";
            if (!isUsableIpAddress(args.nextHop)) return "% Invalid next hop address.";
            device.state.staticRoutes[`${args.network}/${args.mask}`] = args.nextHop;
        },
        noAction: (device, args) => { delete device.state.staticRoutes[`${args.network}/${args.mask}`]; }
    },
    {
        pattern: "router ospf {id:PROCESS_ID}",
        mode: "global",
        help: "Enable a routing process",
        action: (device, args) => {
            device.mode = "router";
            device.currentScope = args.id;
            if (!device.state.ospf[args.id]) device.state.ospf[args.id] = { networks: [], passiveInterfaces: [] };
        },
        noAction: (device, args) => { delete device.state.ospf[args.id]; }
    },
    
    // ★追加: ACL (Access Control List)
    {
        pattern: "no access-list {id:ACL_NUM}",
        mode: "global",
        help: "Remove an entire access list",
        action: (device, args) => { delete device.state.acls[args.id]; }
    },
    {
        pattern: "access-list {id:ACL_NUM} {action:ACL_ACTION} {rule:TEXT}",
        mode: "global",
        help: "Configure access-list rules (e.g. '10 permit 192.168.1.0 0.0.0.255' or '10 permit any')",
        action: (device, args) => {
            if (!device.state.acls[args.id]) device.state.acls[args.id] = [];
            // 同じルールがなければ追加
            if (!device.state.acls[args.id].some(r => r.action === args.action.toLowerCase() && r.rule === args.rule)) {
                device.state.acls[args.id].push({ action: args.action.toLowerCase(), rule: args.rule });
            }
        },
        noAction: (device, args) => {
            if (device.state.acls[args.id]) {
                device.state.acls[args.id] = device.state.acls[args.id].filter(r => !(r.action === args.action.toLowerCase() && r.rule === args.rule));
                if(device.state.acls[args.id].length === 0) delete device.state.acls[args.id];
            }
        }
    },
    
    // ★追加: NAT (Network Address Translation)
    {
        pattern: "ip nat inside source static {local:IPV4} {global:IPV4}",
        mode: "global",
        help: "Static NAT translation",
        action: (device, args) => {
            if (!device.state.nat.static) device.state.nat.static = [];
            if (!device.state.nat.static.some(n => n.local === args.local && n.global === args.global)) {
                device.state.nat.static.push({ local: args.local, global: args.global });
            }
        },
        noAction: (device, args) => {
            if (device.state.nat.static) {
                device.state.nat.static = device.state.nat.static.filter(n => !(n.local === args.local && n.global === args.global));
            }
        }
    },
    {
        pattern: "ip nat inside source list {acl:ACL_NUM} interface {id:IF_ID} overload",
        mode: "global",
        help: "Dynamic NAT (PAT) via interface",
        action: (device, args) => {
            if (!device.state.nat.dynamic) device.state.nat.dynamic = [];
            const intf = normalizeInterfaceName(args.id);
            if (!device.state.nat.dynamic.some(n => String(n.acl) === args.acl && n.intf === intf)) {
                device.state.nat.dynamic.push({ acl: args.acl, intf: intf });
            }
        },
        noAction: (device, args) => {
            if (device.state.nat.dynamic) {
                const intf = normalizeInterfaceName(args.id);
                device.state.nat.dynamic = device.state.nat.dynamic.filter(n => !(String(n.acl) === args.acl && n.intf === intf));
            }
        }
    },

    // ★追加: STP (Spanning Tree Protocol)
    {
        pattern: "spanning-tree mode {mode:STP_MODE}",
        mode: "global",
        help: "Spanning tree operating mode",
        action: (device, args) => { device.state.stpMode = args.mode.toLowerCase(); },
        noAction: (device) => { delete device.state.stpMode; }
    },
    {
        pattern: "spanning-tree vlan {id:VLAN_ID} root {type:STP_ROOT}",
        mode: "global",
        help: "Configure switch as root",
        action: (device, args) => {
            if(!device.state.stpRoot) device.state.stpRoot = {};
            device.state.stpRoot[args.id] = args.type.toLowerCase();
        },
        noAction: (device, args) => { if(device.state.stpRoot) delete device.state.stpRoot[args.id]; }
    },
    {
        pattern: "spanning-tree vlan {id:VLAN_ID} priority {prio:STP_PRIORITY}",
        mode: "global",
        help: "Set the bridge priority",
        action: (device, args) => {
            if(!device.state.stpPriority) device.state.stpPriority = {};
            device.state.stpPriority[args.id] = args.prio;
        },
        noAction: (device, args) => { if(device.state.stpPriority) delete device.state.stpPriority[args.id]; }
    },

    {
        pattern: "lldp run",
        mode: "global",
        help: "Enable LLDP globally",
        action: (device) => { device.state.lldpRun = true; },
        noAction: (device) => { device.state.lldpRun = false; }
    },
    {
        pattern: "cdp run",
        mode: "global",
        help: "Enable CDP globally",
        action: (device) => { device.state.cdpRun = true; },
        noAction: (device) => { device.state.cdpRun = false; }
    },
    {
        pattern: "interface range {range:IF_RANGE}",
        mode: "global",
        help: "interface range command",
        action: (device, args) => {
            const scopes = parseInterfaceRangeArgs(args.range);
            if (!scopes) return "% Invalid interface range";
            for (const ifName of scopes) {
                const isPhysical = /^(GigabitEthernet|FastEthernet|Ethernet|Serial)/i.test(ifName);
                if (isPhysical && device.isInitialized && !device.registeredInterfaces.has(ifName)) {
                    return `% Invalid interface range (Interface ${ifName} does not exist)`;
                }
                device.registeredInterfaces.add(ifName);
                if (!device.state.interfaces[ifName]) device.state.interfaces[ifName] = {};
            }
            device.mode = "if";
            device.currentScope = scopes;
        }
    },
    {
        pattern: "interface {id:IF_ID}",
        mode: "global",
        help: "Select an interface to configure",
        action: (device, args) => {
            const ifName = normalizeInterfaceName(args.id);
            const isPhysical = /^(GigabitEthernet|FastEthernet|Ethernet|Serial)/i.test(ifName);
            if (isPhysical) {
                if (!device.isInitialized) device.registeredInterfaces.add(ifName);
                else if (!device.registeredInterfaces.has(ifName)) return "% Invalid interface type and number";
            } else {
                device.registeredInterfaces.add(ifName);
            }
            device.mode = "if";
            device.currentScope = ifName;
            if (!device.state.interfaces[ifName]) device.state.interfaces[ifName] = {};
        }
    },

    // --- OSPF (Router) モード ---
    {
        pattern: "router-id {ip:IPV4}",
        mode: "router",
        help: "router-id for this OSPF process",
        action: (device, args) => { device.state.ospf[device.currentScope].routerId = args.ip; },
        noAction: (device) => { delete device.state.ospf[device.currentScope].routerId; }
    },
    {
        pattern: "network {ip:IPV4} {mask:IPV4_MASK} area {area:AREA_ID}",
        mode: "router",
        help: "Enable routing on an IP network",
        action: (device, args) => {
            device.state.ospf[device.currentScope].networks.push({ ip: args.ip, mask: args.mask, area: args.area });
        },
        noAction: (device, args) => {
            const nwList = device.state.ospf[device.currentScope].networks;
            device.state.ospf[device.currentScope].networks = nwList.filter(n => !(n.ip === args.ip && n.mask === args.mask && n.area === args.area));
        }
    },
    {
        pattern: "passive-interface default",
        mode: "router",
        action: (device) => { device.state.ospf[device.currentScope].passiveInterfaces.push("default"); },
        noAction: (device) => {
            const piList = device.state.ospf[device.currentScope].passiveInterfaces;
            device.state.ospf[device.currentScope].passiveInterfaces = piList.filter(n => n !== "default");
        }
    },
    {
        pattern: "passive-interface {id:IF_ID}",
        mode: "router",
        action: (device, args) => {
            const ifName = normalizeInterfaceName(args.id);
            device.state.ospf[device.currentScope].passiveInterfaces.push(ifName);
        },
        noAction: (device, args) => {
            const ifName = normalizeInterfaceName(args.id);
            const piList = device.state.ospf[device.currentScope].passiveInterfaces;
            device.state.ospf[device.currentScope].passiveInterfaces = piList.filter(n => n !== ifName);
        }
    },

    // --- VLAN モード ---
    {
        pattern: "name {name:WORD}",
        mode: "vlan",
        action: (device, args) => { device.state.vlans[device.currentScope].name = args.name; },
        noAction: (device) => { delete device.state.vlans[device.currentScope].name; }
    },

    // --- インターフェイス モード ---
    {
        pattern: "description {text:TEXT}",
        mode: "if",
        action: (device, args) => { applyToScopes(device, intf => intf.description = args.text); },
        noAction: (device) => { applyToScopes(device, intf => delete intf.description); }
    },
    {
        pattern: "shutdown",
        mode: "if",
        action: (device) => { applyToScopes(device, intf => intf.shutdown = true); },
        noAction: (device) => { applyToScopes(device, intf => intf.shutdown = false); }
    },
    {
        pattern: "ip address {ip:IPV4} {mask:IPV4_MASK}",
        mode: "if",
        action: (device, args) => {
            if (isNetworkAddress(args.ip, args.mask)) return `Bad mask /${args.mask} for address ${args.ip}`;
            if (isBroadcastAddress(args.ip, args.mask)) return `Bad mask /${args.mask} for address ${args.ip}`;
            if (!isUsableIpAddress(args.ip)) return `% Not a valid host address - ${args.ip}`;
            applyToScopes(device, intf => {
                intf.ipAddress = args.ip;
                intf.subnetMask = args.mask;
            });
        },
        noAction: (device) => {
            applyToScopes(device, intf => {
                delete intf.ipAddress;
                delete intf.subnetMask;
                intf._explicitNoIp = true;
            });
        }
    },
    {
        pattern: "switchport mode access",
        mode: "if",
        action: (device) => { applyToScopes(device, intf => intf.switchportMode = "access"); },
        noAction: (device) => { applyToScopes(device, intf => delete intf.switchportMode); }
    },
    {
        pattern: "switchport mode trunk",
        mode: "if",
        action: (device) => { applyToScopes(device, intf => intf.switchportMode = "trunk"); },
        noAction: (device) => { applyToScopes(device, intf => delete intf.switchportMode); }
    },
    {
        pattern: "switchport access vlan {id:VLAN_ID}",
        mode: "if",
        action: (device, args) => { applyToScopes(device, intf => intf.accessVlan = parseInt(args.id, 10)); },
        noAction: (device) => { applyToScopes(device, intf => delete intf.accessVlan); }
    },
    {
        pattern: "channel-group {id:CHANNEL_GROUP} mode {mode:CHANNEL_MODE}",
        mode: "if",
        action: (device, args) => {
            applyToScopes(device, intf => intf.channelGroup = { id: args.id, mode: args.mode.toLowerCase() });
        },
        noAction: (device) => { applyToScopes(device, intf => delete intf.channelGroup); }
    },
    {
        pattern: "ip ospf cost {cost:OSPF_COST}",
        mode: "if",
        action: (device, args) => { applyToScopes(device, intf => intf.ospfCost = args.cost); },
        noAction: (device) => { applyToScopes(device, intf => delete intf.ospfCost); }
    },
    {
        pattern: "ip ospf priority {priority:OSPF_PRIORITY}",
        mode: "if",
        help: "Router priority",
        action: (device, args) => { applyToScopes(device, intf => intf.ospfPriority = args.priority); },
        noAction: (device) => { applyToScopes(device, intf => delete intf.ospfPriority); }
    },
    {
        pattern: "ip ospf {pid:PROCESS_ID} area {area:AREA_ID}",
        mode: "if",
        action: (device, args) => { applyToScopes(device, intf => intf.ospfArea = { pid: args.pid, area: args.area }); },
        noAction: (device) => { applyToScopes(device, intf => delete intf.ospfArea); }
    },
    
    // ★追加: ACL (IF適用)
    {
        pattern: "ip access-group {acl:ACL_NUM} {dir:TRAFFIC_DIR}",
        mode: "if",
        help: "Access control list for packets",
        action: (device, args) => {
            applyToScopes(device, intf => {
                if (!intf.accessGroup) intf.accessGroup = {};
                intf.accessGroup[args.dir.toLowerCase()] = args.acl;
            });
        },
        noAction: (device, args) => {
            applyToScopes(device, intf => {
                if (intf.accessGroup) delete intf.accessGroup[args.dir.toLowerCase()];
            });
        }
    },
    // ★追加: NAT (IF適用)
    {
        pattern: "ip nat {dir:NAT_DIR}",
        mode: "if",
        help: "NAT interface commands",
        action: (device, args) => { applyToScopes(device, intf => intf.ipNat = args.dir.toLowerCase()); },
        noAction: (device) => { applyToScopes(device, intf => delete intf.ipNat); }
    },
    // ★追加: STP (IF適用)
    {
        pattern: "spanning-tree portfast",
        mode: "if",
        help: "Enable portfast on the interface",
        action: (device) => { applyToScopes(device, intf => intf.stpPortfast = true); },
        noAction: (device) => { applyToScopes(device, intf => intf.stpPortfast = false); }
    },
    {
        pattern: "spanning-tree bpduguard enable",
        mode: "if",
        help: "Enable BPDU guard on the interface",
        action: (device) => { applyToScopes(device, intf => intf.stpBpduGuard = true); },
        noAction: (device) => { applyToScopes(device, intf => intf.stpBpduGuard = false); }
    },

    {
        pattern: "cdp enable",
        mode: "if",
        action: (device) => { applyToScopes(device, intf => intf.cdpEnable = true); },
        noAction: (device) => { applyToScopes(device, intf => intf.cdpEnable = false); }
    },
    {
        pattern: "lldp transmit",
        mode: "if",
        action: (device) => { applyToScopes(device, intf => intf.lldpTransmit = true); },
        noAction: (device) => { applyToScopes(device, intf => intf.lldpTransmit = false); }
    },
    {
        pattern: "lldp receive",
        mode: "if",
        action: (device) => { applyToScopes(device, intf => intf.lldpReceive = true); },
        noAction: (device) => { applyToScopes(device, intf => intf.lldpReceive = false); }
    },

    // --- 確認 (show) コマンド ---
    {
        pattern: "show running-config",
        mode: "priv",
        action: (device) => device.generateRunningConfig()
    },
    {
        pattern: "show ip route",
        mode: "priv",
        help: "Display the IP routing table",
        action: (device) => {
            let out = "Codes: L - local, C - connected, S - static, O - OSPF\n\nGateway of last resort is not set\n\n";
            for (const [ifName, conf] of Object.entries(device.state.interfaces)) {
                if (conf.ipAddress && !conf.shutdown) {
                    out += `C    ${conf.ipAddress} is directly connected, ${ifName}\n`;
                }
            }
            for (const [netMask, nextHop] of Object.entries(device.state.staticRoutes)) {
                const [net, mask] = netMask.split('/');
                out += `S    ${net} via ${nextHop}\n`;
            }
            return out.trim();
        }
    },
    {
        pattern: "show ip interface brief",
        mode: "priv",
        action: (device) => {
            let out = "Interface              IP-Address      OK? Method Status                Protocol\n";
            for(const [ifName, conf] of Object.entries(device.state.interfaces)) {
                let ip = conf.ipAddress || "unassigned";
                let status = conf.shutdown ? "administratively down" : "up";
                let proto = conf.shutdown ? "down" : "up";
                out += `${ifName.padEnd(22)} ${ip.padEnd(15)} YES manual ${status.padEnd(21)} ${proto}\n`;
            }
            return out.trim() || "Interface              IP-Address      OK? Method Status                Protocol";
        }
    },
    {
        pattern: "show vlan",
        mode: "priv",
        help: "VLAN status",
        action: (device) => {
            let out = "VLAN Name                             Status    Ports\n---- -------------------------------- --------- -------------------------------";
            out += "\n1    default                          active    ";
            for (const [id, vlan] of Object.entries(device.state.vlans)) {
                if (parseInt(id, 10) === 1) continue; 
                out += `\n${String(id).padEnd(4)} ${(vlan.name || "VLAN" + String(id).padStart(4, '0')).padEnd(32)} active    `;
            }
            return out;
        }
    },
    {
        pattern: "show ip protocols",
        mode: "priv",
        help: "Active routing protocol process parameters and statistics",
        action: (device) => {
            let out = "";
            for (const [pid, ospf] of Object.entries(device.state.ospf)) {
                out += `Routing Protocol is "ospf ${pid}"\n`;
                out += `  Router ID ${ospf.routerId || "0.0.0.0"}\n`;
                out += `  Routing for Networks:\n`;
                ospf.networks.forEach(nw => {
                    out += `    ${nw.ip} ${nw.mask} area ${nw.area}\n`;
                });
                if (ospf.passiveInterfaces.length > 0) {
                    out += `  Passive Interface(s):\n`;
                    ospf.passiveInterfaces.forEach(pi => out += `    ${pi}\n`);
                }
            }
            return out.trim() || "No active routing protocols.";
        }
    }
];

// ==========================================
// 4. データモデル ＆ パーサーエンジン
// ==========================================
class VirtualDevice {
    constructor(hostname = "Router") {
        this.mode = "user";
        this.currentScope = null;
        this.isInitialized = false;
        this.registeredInterfaces = new Set();
        this.interactiveState = null; 
        this.startupConfigSaved = false;
        this.ospfProcessCleared = false;
        
        this.state = {
            hostname: hostname,
            cdpRun: false,
            lldpRun: false,
            interfaces: {},
            vlans: {},
            staticRoutes: {},
            ospf: {},
            // ★追加: 新規プロトコル用のステート
            acls: {},
            nat: { static: [], dynamic: [] },
            stpMode: null,
            stpRoot: {},
            stpPriority: {}
        };
    }

    getPrompt() {
        if (this.interactiveState) return this.interactiveState.promptText;
        switch(this.mode) {
            case "user": return `${this.state.hostname}>`;
            case "priv": return `${this.state.hostname}#`;
            case "global": return `${this.state.hostname}(config)#`;
            case "if": return Array.isArray(this.currentScope) ? `${this.state.hostname}(config-if-range)#` : `${this.state.hostname}(config-if)#`;
            case "vlan": return `${this.state.hostname}(config-vlan)#`;
            case "router": return `${this.state.hostname}(config-router)#`;
            default: return `${this.state.hostname}>`;
        }
    }

    generateRunningConfig() {
        let conf = "!\n";
        conf += `hostname ${this.state.hostname}\n!\n`;
        
        if (this.state.lldpRun) conf += "lldp run\n!\n";
        if (this.state.cdpRun) conf += "cdp run\n!\n";

        // ★追加: STP Global設定
        if (this.state.stpMode) conf += `spanning-tree mode ${this.state.stpMode}\n`;
        if (this.state.stpRoot) {
            for (const [v, root] of Object.entries(this.state.stpRoot)) conf += `spanning-tree vlan ${v} root ${root}\n`;
        }
        if (this.state.stpPriority) {
            for (const [v, prio] of Object.entries(this.state.stpPriority)) conf += `spanning-tree vlan ${v} priority ${prio}\n`;
        }

        for (const [vlanId, settings] of Object.entries(this.state.vlans)) {
            conf += `vlan ${vlanId}\n`;
            if (settings.name) conf += ` name ${settings.name}\n`;
            conf += "!\n";
        }
        
        for (const [ifName, settings] of Object.entries(this.state.interfaces)) {
            conf += `interface ${ifName}\n`;
            if (settings.description) conf += ` description ${settings.description}\n`;
            if (settings.switchportMode) conf += ` switchport mode ${settings.switchportMode}\n`;
            if (settings.accessVlan) conf += ` switchport access vlan ${settings.accessVlan}\n`;
            if (settings.ipAddress) conf += ` ip address ${settings.ipAddress} ${settings.subnetMask}\n`;
            else if (settings._explicitNoIp) conf += ` no ip address\n`;
            
            // ★追加: IFのNAT, ACL, STP設定
            if (settings.ipNat) conf += ` ip nat ${settings.ipNat}\n`;
            if (settings.accessGroup) {
                if (settings.accessGroup.in) conf += ` ip access-group ${settings.accessGroup.in} in\n`;
                if (settings.accessGroup.out) conf += ` ip access-group ${settings.accessGroup.out} out\n`;
            }
            if (settings.stpPortfast) conf += ` spanning-tree portfast\n`;
            if (settings.stpBpduGuard) conf += ` spanning-tree bpduguard enable\n`;

            if (settings.ospfCost) conf += ` ip ospf cost ${settings.ospfCost}\n`;
            if (settings.ospfPriority !== undefined) conf += ` ip ospf priority ${settings.ospfPriority}\n`; 
            if (settings.ospfArea) conf += ` ip ospf ${settings.ospfArea.pid} area ${settings.ospfArea.area}\n`;
            if (settings.channelGroup) conf += ` channel-group ${settings.channelGroup.id} mode ${settings.channelGroup.mode}\n`;
            if (settings.cdpEnable !== undefined) conf += settings.cdpEnable ? ` cdp enable\n` : ` no cdp enable\n`;
            if (settings.lldpTransmit !== undefined) conf += settings.lldpTransmit ? ` lldp transmit\n` : ` no lldp transmit\n`;
            if (settings.lldpReceive !== undefined) conf += settings.lldpReceive ? ` lldp receive\n` : ` no lldp receive\n`;
            if (settings.shutdown === true) conf += ` shutdown\n`;
            conf += "!\n";
        }

        for (const [pid, settings] of Object.entries(this.state.ospf)) {
            conf += `router ospf ${pid}\n`;
            if (settings.routerId) conf += ` router-id ${settings.routerId}\n`;
            settings.passiveInterfaces.forEach(pi => { conf += ` passive-interface ${pi}\n`; });
            settings.networks.forEach(nw => { conf += ` network ${nw.ip} ${nw.mask} area ${nw.area}\n`; });
            conf += "!\n";
        }

        for (const [netMask, nextHop] of Object.entries(this.state.staticRoutes)) {
            const [net, mask] = netMask.split('/');
            conf += `ip route ${net} ${mask} ${nextHop}\n`;
        }

        // ★追加: ACL と NAT のGlobal設定出力
        if (this.state.nat.static) {
            this.state.nat.static.forEach(n => conf += `ip nat inside source static ${n.local} ${n.global}\n`);
        }
        if (this.state.nat.dynamic) {
            this.state.nat.dynamic.forEach(n => conf += `ip nat inside source list ${n.acl} interface ${n.intf} overload\n`);
        }
        for (const [id, rules] of Object.entries(this.state.acls)) {
            rules.forEach(r => conf += `access-list ${id} ${r.action} ${r.rule}\n`);
        }

        conf += "!\nend";
        return conf;
    }

    getAvailableSchemas() {
        const schemas = [];
        for (const s of commandSchema) {
            if (s.mode === this.mode) {
                schemas.push(s);
                if (s.noAction) {
                    schemas.push({
                        ...s,
                        pattern: "no " + s.pattern,
                        help: "Negate a command or set its defaults",
                        action: s.noAction
                    });
                }
            }
        }
        return schemas;
    }

    getCompletion(input) {
        if (this.interactiveState) return input; 

        const text = input.trimStart();
        const endsWithSpace = input.endsWith(' ');
        const tokens = text.split(/\s+/).filter(t => t !== '');
        if (endsWithSpace) tokens.push('');
        if (tokens.length === 0) return input;

        const currentToken = tokens[tokens.length - 1].toLowerCase();
        const availableSchemas = this.getAvailableSchemas();
        let candidates = new Set();

        for (const schema of availableSchemas) {
            const pTokens = schema.pattern.split(" ");
            const lastPToken = pTokens[pTokens.length - 1];
            const match = lastPToken.match(/^\{[a-zA-Z]+:([A-Z_0-9]+)\}$/);
            if (tokens.length > pTokens.length && !(match && CommandTypes[match[1]].consumeRest)) continue;

            let matchUpToNow = true;
            for (let i = 0; i < tokens.length - 1; i++) {
                if (i >= pTokens.length) break;
                const pToken = pTokens[i];
                const isVar = pToken.startsWith('{');
                if (!isVar && !pToken.startsWith(tokens[i].toLowerCase())) {
                    matchUpToNow = false;
                    break;
                }
            }
            
            if (matchUpToNow && tokens.length <= pTokens.length) {
                const targetPToken = pTokens[tokens.length - 1];
                if (targetPToken) {
                    const isVar = targetPToken.startsWith('{');
                    if (isVar) {
                        const typeName = targetPToken.match(/^\{[a-zA-Z]+:([A-Z_0-9]+)\}$/)[1];
                        if (CommandTypes[typeName].getCompletions) {
                            const typeCands = CommandTypes[typeName].getCompletions(currentToken);
                            typeCands.forEach(c => candidates.add(c));
                        }
                    } else if (targetPToken.startsWith(currentToken)) {
                        candidates.add(targetPToken);
                    }
                }
            }
        }

        const candArray = Array.from(candidates);
        if (candArray.length === 1) {
            tokens[tokens.length - 1] = candArray[0];
            return input.match(/^\s*/)[0] + tokens.join(' ') + " ";
        } else if (candArray.length > 1) {
            let prefix = candArray[0];
            for (let i = 1; i < candArray.length; i++) {
                while (!candArray[i].startsWith(prefix)) prefix = prefix.slice(0, -1);
            }
            if (prefix.length > currentToken.length) {
                tokens[tokens.length - 1] = prefix;
                return input.match(/^\s*/)[0] + tokens.join(' ');
            }
        }
        return input;
    }

    getHelp(input) {
        if (this.interactiveState) return ""; 

        const text = input.trimStart();
        const endsWithSpace = input.endsWith(' ');
        const tokens = text.split(/\s+/).filter(t => t !== '');
        if (endsWithSpace) tokens.push('');
        if (tokens.length === 0) tokens.push('');

        const currentToken = tokens[tokens.length - 1].toLowerCase();
        const availableSchemas = this.getAvailableSchemas();
        
        let helpLines = new Map();
        let exactMatchSchema = null;

        for (const schema of availableSchemas) {
            const pTokens = schema.pattern.split(" ");
            const lastPToken = pTokens[pTokens.length - 1];
            const isLastVarRest = lastPToken.match(/^\{[a-zA-Z]+:([A-Z_0-9]+)\}$/) && CommandTypes[lastPToken.match(/^\{[a-zA-Z]+:([A-Z_0-9]+)\}$/)[1]].consumeRest;
            if (!isLastVarRest && tokens.length > pTokens.length + 1) continue;

            let matchUpToNow = true;
            for (let i = 0; i < tokens.length - 1; i++) {
                if (i >= pTokens.length) break;
                const pToken = pTokens[i];
                const iToken = tokens[i];
                const isVar = pToken.startsWith('{');
                
                if (isVar) {
                    const typeName = pToken.match(/^\{[a-zA-Z]+:([A-Z_0-9]+)\}$/)[1];
                    if (!CommandTypes[typeName].consumeRest && !CommandTypes[typeName].validate(iToken)) matchUpToNow = false;
                } else {
                    if (!pToken.startsWith(iToken.toLowerCase())) matchUpToNow = false;
                }
                if (!matchUpToNow) break;
            }

            if (matchUpToNow) {
                if (tokens.length > pTokens.length) {
                    if (endsWithSpace && !exactMatchSchema) exactMatchSchema = schema;
                    continue;
                }
                
                const targetPToken = pTokens[tokens.length - 1];
                const isVar = targetPToken.startsWith('{');
                
                if (isVar) {
                    const typeName = targetPToken.match(/^\{[a-zA-Z]+:([A-Z_0-9]+)\}$/)[1];
                    const formattedHelp = CommandTypes[typeName].help
                        .split('\n')
                        .map(line => '  ' + line.trimStart())
                        .join('\n');
                    helpLines.set(typeName, formattedHelp);
                } else if (targetPToken.startsWith(currentToken)) {
                    helpLines.set(targetPToken, `  ${targetPToken.padEnd(20)} ${schema.help || ''}`);
                }
            }
        }

        if (helpLines.size === 0) {
            if (exactMatchSchema && endsWithSpace) return "  <cr>";
            return "% Unrecognized command";
        }

        let out = "";
        Array.from(helpLines.values()).sort().forEach(line => { out += line + "\n"; });
        return out.trimEnd();
    }

    processCommand(input) {
        if (this.interactiveState) {
            const state = this.interactiveState;
            this.interactiveState = null; 
            return state.handler(this, input);
        }

        const tokens = input.trim().split(/\s+/);
        if (tokens.length === 0 || tokens[0] === "") return "";

        const availableSchemas = this.getAvailableSchemas();

        for (const schema of availableSchemas) {
            const parsedArgs = this._matchTokensToSchema(tokens, schema.pattern);
            if (parsedArgs !== null) {
                const output = schema.action(this, parsedArgs);
                return output || "";
            }
        }
        return "% Invalid input or unrecognized command";
    }

    _matchTokensToSchema(inputTokens, patternStr) {
        const patternTokens = patternStr.split(" ");
        const lastPToken = patternTokens[patternTokens.length - 1];
        const lastMatch = lastPToken.match(/^\{[a-zA-Z]+:([A-Z_0-9]+)\}$/);
        const hasRestType = lastMatch && CommandTypes[lastMatch[1]].consumeRest;

        if (!hasRestType && inputTokens.length !== patternTokens.length) return null;
        if (hasRestType && inputTokens.length < patternTokens.length) return null;

        const args = {};
        for (let i = 0; i < patternTokens.length; i++) {
            const pToken = patternTokens[i];
            const iToken = inputTokens[i];

            const varMatch = pToken.match(/^\{([a-zA-Z]+):([A-Z_0-9]+)\}$/);
            if (varMatch) {
                const argName = varMatch[1];
                const typeName = varMatch[2];
                const typeDef = CommandTypes[typeName];
                
                if (typeDef.consumeRest) {
                    const restStr = inputTokens.slice(i).join(" ");
                    if (!typeDef.validate(restStr)) return null;
                    args[argName] = restStr;
                    return args; 
                } else {
                    if (!typeDef.validate(iToken)) return null; 
                    args[argName] = iToken;
                }
            } else {
                if (!pToken.startsWith(iToken.toLowerCase())) return null;
            }
        }
        return args; 
    }

    verifyState(scopeStr, conditionStr) {
        if (!scopeStr || !conditionStr) return null;
        
        const normCond = conditionStr.trim().toLowerCase().replace(/\s+/g, ' ');
        const isNo = normCond.startsWith('no ');
        const baseCond = isNo ? normCond.substring(3).trim() : normCond;

        let scopeType = 'global';
        let scopeId = null;

        const normScope = scopeStr.trim().toLowerCase().replace(/\s+/g, ' ');
        if (normScope.startsWith('interface ')) {
            scopeType = 'if';
            scopeId = normalizeInterfaceName(normScope.replace('interface ', '').trim());
        } else if (normScope.startsWith('vlan ')) {
            scopeType = 'vlan';
            scopeId = parseInt(normScope.replace('vlan ', ''), 10);
        } else if (normScope.startsWith('router ospf ')) {
            scopeType = 'router';
            scopeId = normScope.replace('router ospf ', '').trim();
        }

        const state = this.state;

        try {
            if (scopeType === 'global') {
                if (baseCond === 'copy running-config startup-config' || baseCond === 'copy run start') {
                    return isNo ? !this.startupConfigSaved : this.startupConfigSaved === true;
                }
                if (baseCond === 'clear ip ospf process') {
                    return isNo ? !this.ospfProcessCleared : this.ospfProcessCleared === true;
                }
                if (baseCond.startsWith('hostname ')) {
                    const hn = baseCond.substring(9).trim();
                    return isNo ? state.hostname.toLowerCase() !== hn : state.hostname.toLowerCase() === hn;
                }
                if (baseCond === 'lldp run') return isNo ? !state.lldpRun : state.lldpRun === true;
                if (baseCond === 'cdp run') return isNo ? !state.cdpRun : state.cdpRun === true;
                if (baseCond.startsWith('ip route ')) {
                    const parts = baseCond.split(' ');
                    const key = `${parts[2]}/${parts[3]}`;
                    const exists = state.staticRoutes[key] === parts[4];
                    return isNo ? !exists : exists;
                }
                // ★追加: ACL/NAT/STP のGlobal採点判定
                if (baseCond.startsWith('access-list ')) {
                    const parts = baseCond.split(' ');
                    const id = parts[1];
                    const action = parts[2];
                    const rule = parts.slice(3).join(' ');
                    const exists = state.acls[id] && state.acls[id].some(r => r.action === action && r.rule === rule);
                    return isNo ? !exists : exists;
                }
                if (baseCond.startsWith('ip nat inside source static ')) {
                    const parts = baseCond.split(' ');
                    const exists = state.nat.static && state.nat.static.some(n => n.local === parts[5] && n.global === parts[6]);
                    return isNo ? !exists : exists;
                }
                if (baseCond.startsWith('ip nat inside source list ')) {
                    const parts = baseCond.split(' ');
                    const exists = state.nat.dynamic && state.nat.dynamic.some(n => String(n.acl) === parts[5] && n.intf.toLowerCase() === parts[7].toLowerCase());
                    return isNo ? !exists : exists;
                }
                if (baseCond.startsWith('spanning-tree mode ')) {
                    return isNo ? state.stpMode !== baseCond.split(' ')[2] : state.stpMode === baseCond.split(' ')[2];
                }
                if (baseCond.startsWith('spanning-tree vlan ') && baseCond.includes(' root ')) {
                    const parts = baseCond.split(' ');
                    return isNo ? !(state.stpRoot && state.stpRoot[parts[2]] === parts[4]) : (state.stpRoot && state.stpRoot[parts[2]] === parts[4]);
                }
                if (baseCond.startsWith('spanning-tree vlan ') && baseCond.includes(' priority ')) {
                    const parts = baseCond.split(' ');
                    return isNo ? !(state.stpPriority && state.stpPriority[parts[2]] === parts[4]) : (state.stpPriority && state.stpPriority[parts[2]] === parts[4]);
                }

            } else if (scopeType === 'if') {
                const intf = state.interfaces[scopeId];
                if (!intf) return isNo ? true : false; 
                
                if (baseCond.startsWith('description ')) {
                    const matches = (intf.description || '').toLowerCase() === baseCond.substring(12).trim();
                    return isNo ? !matches : matches;
                }
                if (baseCond === 'shutdown') return isNo ? intf.shutdown === false : intf.shutdown === true;
                if (baseCond.startsWith('ip address ')) {
                    const parts = baseCond.split(' ');
                    const matches = (intf.ipAddress === parts[2] && intf.subnetMask === parts[3]);
                    return isNo ? !matches : matches;
                }
                if (baseCond === 'switchport mode access') return isNo ? intf.switchportMode !== 'access' : intf.switchportMode === 'access';
                if (baseCond === 'switchport mode trunk') return isNo ? intf.switchportMode !== 'trunk' : intf.switchportMode === 'trunk';
                if (baseCond.startsWith('switchport access vlan ')) {
                    const v = parseInt(baseCond.split(' ')[3], 10);
                    return isNo ? intf.accessVlan !== v : intf.accessVlan === v;
                }
                if (baseCond.startsWith('channel-group ')) {
                    const parts = baseCond.split(' ');
                    const matches = intf.channelGroup && intf.channelGroup.id === parts[1] && intf.channelGroup.mode === parts[3];
                    return isNo ? !matches : matches;
                }
                if (baseCond.startsWith('ip ospf cost ')) {
                    const cost = baseCond.split(' ')[3];
                    return isNo ? intf.ospfCost !== cost : intf.ospfCost === cost;
                }
                if (baseCond.startsWith('ip ospf priority ')) {
                    const prio = baseCond.split(' ')[3];
                    return isNo ? intf.ospfPriority !== prio : intf.ospfPriority === prio;
                }
                if (baseCond.startsWith('ip ospf ') && baseCond.includes(' area ')) {
                    const parts = baseCond.split(' ');
                    const matches = intf.ospfArea && intf.ospfArea.pid === parts[2] && intf.ospfArea.area === parts[4];
                    return isNo ? !matches : matches;
                }
                if (baseCond === 'cdp enable') return isNo ? intf.cdpEnable === false : intf.cdpEnable === true;
                if (baseCond === 'lldp transmit') return isNo ? intf.lldpTransmit === false : intf.lldpTransmit === true;
                if (baseCond === 'lldp receive') return isNo ? intf.lldpReceive === false : intf.lldpReceive === true;
                
                // ★追加: ACL/NAT/STP のIF採点判定
                if (baseCond.startsWith('ip nat ')) {
                    const dir = baseCond.split(' ')[2];
                    return isNo ? intf.ipNat !== dir : intf.ipNat === dir;
                }
                if (baseCond.startsWith('ip access-group ')) {
                    const parts = baseCond.split(' ');
                    const dir = parts[3];
                    return isNo ? !(intf.accessGroup && intf.accessGroup[dir] === parts[2]) : (intf.accessGroup && intf.accessGroup[dir] === parts[2]);
                }
                if (baseCond === 'spanning-tree portfast') return isNo ? !intf.stpPortfast : intf.stpPortfast === true;
                if (baseCond === 'spanning-tree bpduguard enable') return isNo ? !intf.stpBpduGuard : intf.stpBpduGuard === true;

            } else if (scopeType === 'vlan') {
                const vlan = state.vlans[scopeId];
                if (!vlan) return isNo ? true : false;
                if (baseCond.startsWith('name ')) {
                    const matches = (vlan.name || '').toLowerCase() === baseCond.substring(5).trim();
                    return isNo ? !matches : matches;
                }
            } else if (scopeType === 'router') {
                const ospf = state.ospf[scopeId];
                if (!ospf) return isNo ? true : false;
                
                if (baseCond.startsWith('router-id ')) {
                    const matches = ospf.routerId === baseCond.substring(10).trim();
                    return isNo ? !matches : matches;
                }
                if (baseCond.startsWith('network ')) {
                    const parts = baseCond.split(' ');
                    const matches = ospf.networks.some(n => n.ip === parts[1] && n.mask === parts[2] && String(n.area) === parts[4]);
                    return isNo ? !matches : matches;
                }
                if (baseCond.startsWith('passive-interface ')) {
                    let pi = baseCond.substring(18).trim();
                    if (pi !== 'default') pi = normalizeInterfaceName(pi);
                    const matches = ospf.passiveInterfaces.includes(pi);
                    return isNo ? !matches : matches;
                }
            }
        } catch (e) {
            return null;
        }
        return null; 
    }
}