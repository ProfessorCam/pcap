/*
 * pcap.js - a deliberately small libpcap parser for teaching.
 *
 * Understands: libpcap file format (not pcapng), Ethernet II, ARP, IPv4,
 * ICMP, UDP (with DNS, DHCP and TFTP decoding), TCP (with HTTP first-line decoding).
 *
 * parsePcap(arrayBuffer) -> array of packets:
 *   { no, time, src, dst, proto, len, info, details: [ { title, rows: [[k, v], ...] } ] }
 *
 * Works in the browser (window.parsePcap) and in node (module.exports).
 */
(function (root) {
  'use strict';

  /* ---------- small helpers ---------- */

  function hex(n, width) {
    return '0x' + n.toString(16).padStart(width || 0, '0');
  }
  function mac(b, o) {
    var s = [];
    for (var i = 0; i < 6; i++) s.push(b[o + i].toString(16).padStart(2, '0'));
    return s.join(':');
  }
  function ip4(b, o) {
    return b[o] + '.' + b[o + 1] + '.' + b[o + 2] + '.' + b[o + 3];
  }
  function u16(b, o) { return (b[o] << 8) | b[o + 1]; }
  function u32(b, o) { return ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3]; }
  function ascii(b, o, n) {
    var s = '';
    for (var i = 0; i < n && o + i < b.length; i++) s += String.fromCharCode(b[o + i]);
    return s;
  }
  function isPrintable(b, o, n) {
    for (var i = 0; i < n && o + i < b.length; i++) {
      var c = b[o + i];
      if (c === 9 || c === 10 || c === 13) continue;
      if (c < 32 || c > 126) return false;
    }
    return true;
  }
  function section(title, rows) { return { title: title, rows: rows }; }

  /* TFTP only uses port 69 for the first packet; after that each transfer
   * runs between two freshly chosen ports. Remember which client endpoints
   * started a transfer so the later packets can be recognised. */
  var tftpSessions = {};

  /* ---------- file level ---------- */

  function parsePcap(buffer) {
    var bytes = new Uint8Array(buffer);
    var dv = new DataView(buffer);
    if (bytes.length < 24) throw new Error('File too short to be a pcap');
    var magic = dv.getUint32(0, false);
    var le, nano;
    switch (magic) {
      case 0xa1b2c3d4: le = false; nano = false; break;
      case 0xd4c3b2a1: le = true;  nano = false; break;
      case 0xa1b23c4d: le = false; nano = true;  break;
      case 0x4d3cb2a1: le = true;  nano = true;  break;
      case 0x0a0d0d0a: throw new Error('This is a pcapng file. Save it as classic pcap (File > Save As in Wireshark).');
      default: throw new Error('Not a libpcap file (magic ' + hex(magic, 8) + ')');
    }
    var linkType = dv.getUint32(20, le);
    if (linkType !== 1) throw new Error('Only Ethernet captures are supported (link type ' + linkType + ')');

    var packets = [];
    var off = 24, no = 1, t0 = null;
    tftpSessions = {};
    while (off + 16 <= bytes.length) {
      var sec = dv.getUint32(off, le);
      var frac = dv.getUint32(off + 4, le);
      var incl = dv.getUint32(off + 8, le);
      var orig = dv.getUint32(off + 12, le);
      off += 16;
      if (off + incl > bytes.length) break;
      var ts = sec + frac / (nano ? 1e9 : 1e6);
      if (t0 === null) t0 = ts;
      var frame = bytes.subarray(off, off + incl);
      off += incl;

      var p;
      try {
        p = decodeEthernet(frame);
      } catch (e) {
        p = { src: '?', dst: '?', proto: '?', info: 'Could not decode frame: ' + e.message, details: [] };
      }
      p.no = no++;
      p.time = ts - t0;
      p.abs = ts;
      p.len = orig;
      packets.push(p);
    }
    makeTcpSeqRelative(packets);
    return packets;
  }

  /* ---------- layer 2 ---------- */

  function decodeEthernet(b) {
    var dst = mac(b, 0), src = mac(b, 6), type = u16(b, 12);
    var typeName = { 0x0800: 'IPv4', 0x0806: 'ARP', 0x86dd: 'IPv6' }[type] || 'Unknown';
    var p = {
      src: src, dst: dst, proto: typeName, info: 'Ethertype ' + hex(type, 4),
      details: [section('Ethernet II', [
        ['Destination MAC', dst + (dst === 'ff:ff:ff:ff:ff:ff' ? '  (broadcast: everyone on the LAN)' : '')],
        ['Source MAC', src],
        ['Type', typeName + ' (' + hex(type, 4) + ')']
      ])]
    };
    p.srcMac = src; p.dstMac = dst;
    if (type === 0x0806) decodeArp(p, b, 14);
    else if (type === 0x0800) decodeIPv4(p, b, 14);
    return p;
  }

  function decodeArp(p, b, o) {
    var op = u16(b, o + 6);
    var sha = mac(b, o + 8), spa = ip4(b, o + 14), tha = mac(b, o + 18), tpa = ip4(b, o + 24);
    p.proto = 'ARP';
    p.arp = { op: op, sha: sha, spa: spa, tha: tha, tpa: tpa };
    var opName = op === 1 ? 'request' : op === 2 ? 'reply' : 'opcode ' + op;
    if (op === 1) {
      if (spa === tpa) p.info = 'Gratuitous ARP for ' + tpa + ' (announcing itself)';
      else if (spa === '0.0.0.0') p.info = 'ARP Probe: is anyone using ' + tpa + '?';
      else p.info = 'Who has ' + tpa + '? Tell ' + spa;
    } else if (op === 2) {
      p.info = spa + ' is at ' + sha;
    } else {
      p.info = 'ARP ' + opName;
    }
    p.details.push(section('Address Resolution Protocol', [
      ['Opcode', opName + ' (' + op + ')'],
      ['Sender MAC', sha],
      ['Sender IP', spa],
      ['Target MAC', tha + (tha === '00:00:00:00:00:00' ? '  (unknown, that is what we are asking for)' : '')],
      ['Target IP', tpa]
    ]));
  }

  /* ---------- layer 3 ---------- */

  function decodeIPv4(p, b, o) {
    var ihl = (b[o] & 0x0f) * 4;
    var totalLen = u16(b, o + 2), id = u16(b, o + 4);
    var flagsFrag = u16(b, o + 6), ttl = b[o + 8], proto = b[o + 9];
    var src = ip4(b, o + 12), dst = ip4(b, o + 16);
    var protoName = { 1: 'ICMP', 6: 'TCP', 17: 'UDP' }[proto] || ('protocol ' + proto);
    p.src = src; p.dst = dst; p.proto = protoName; p.ttl = ttl;
    p.info = protoName;
    var flags = [];
    if (flagsFrag & 0x4000) flags.push("Don't Fragment");
    if (flagsFrag & 0x2000) flags.push('More Fragments');
    p.details.push(section('Internet Protocol version 4', [
      ['Source IP', src],
      ['Destination IP', dst + (dst === '255.255.255.255' ? '  (broadcast)' : '')],
      ['Protocol', protoName + ' (' + proto + ')'],
      ['Time to live (TTL)', String(ttl)],
      ['Total length', totalLen + ' bytes'],
      ['Identification', hex(id, 4)],
      ['Flags', flags.length ? flags.join(', ') : 'none']
    ]));
    var end = Math.min(b.length, o + totalLen);
    var next = o + ihl;
    if (proto === 1) decodeIcmp(p, b, next, end);
    else if (proto === 17) decodeUdp(p, b, next, end);
    else if (proto === 6) decodeTcp(p, b, next, end);
  }

  function decodeIcmp(p, b, o, end) {
    var type = b[o], code = b[o + 1];
    var names = { 0: 'Echo (ping) reply', 8: 'Echo (ping) request', 3: 'Destination unreachable', 11: 'Time exceeded' };
    var name = names[type] || ('ICMP type ' + type);
    var rows = [['Type', name + ' (' + type + ')'], ['Code', String(code)]];
    p.proto = 'ICMP';
    if (type === 0 || type === 8) {
      var id = u16(b, o + 4), seq = u16(b, o + 6);
      var dataLen = end - (o + 8);
      p.info = name + '  id=' + id + ', seq=' + seq + ', ttl=' + p.ttl;
      rows.push(['Identifier', id + ' (' + hex(id, 4) + ')  - same for every ping in one run of the ping command']);
      rows.push(['Sequence number', seq + '  - goes up by one for each ping sent']);
      rows.push(['Data', dataLen + ' bytes of filler that the reply must echo back unchanged']);
    } else {
      p.info = name;
    }
    p.details.push(section('Internet Control Message Protocol', rows));
  }

  /* ---------- layer 4: UDP ---------- */

  function decodeUdp(p, b, o, end) {
    var sport = u16(b, o), dport = u16(b, o + 2), len = u16(b, o + 4);
    var payload = o + 8, payloadLen = Math.max(0, Math.min(end, o + len) - payload);
    p.proto = 'UDP';
    p.sport = sport; p.dport = dport;
    p.info = sport + ' → ' + dport + '  Len=' + payloadLen;
    p.details.push(section('User Datagram Protocol', [
      ['Source port', String(sport)],
      ['Destination port', String(dport) + portHint(dport)],
      ['Length', len + ' bytes (8 byte header + ' + payloadLen + ' bytes of data)'],
      ['Reliability', 'none: no handshake, no acknowledgements, no retransmission']
    ]));
    if (payloadLen <= 0) return;
    if (sport === 53 || dport === 53) decodeDns(p, b, payload, payload + payloadLen);
    else if ((sport === 67 || sport === 68) && (dport === 67 || dport === 68)) decodeDhcp(p, b, payload, payload + payloadLen);
    else if (dport === 69 || tftpSessions[p.src + ':' + sport] || tftpSessions[p.dst + ':' + dport]) decodeTftp(p, b, payload, payload + payloadLen);
  }

  function decodeTftp(p, b, o, end) {
    var op = u16(b, o);
    var names = { 1: 'Read Request', 2: 'Write Request', 3: 'Data Packet', 4: 'Acknowledgement', 5: 'Error', 6: 'Option Acknowledgement' };
    var rows = [['Opcode', (names[op] || 'unknown') + ' (' + op + ')']];
    p.proto = 'TFTP';
    p.tftp = { op: op };
    if (op === 1 || op === 2) {
      var z1 = o + 2; while (z1 < end && b[z1] !== 0) z1++;
      var filename = ascii(b, o + 2, z1 - (o + 2));
      var z2 = z1 + 1; while (z2 < end && b[z2] !== 0) z2++;
      var mode = ascii(b, z1 + 1, z2 - (z1 + 1));
      tftpSessions[p.src + ':' + p.sport] = true;
      p.tftp.filename = filename; p.tftp.mode = mode;
      p.info = names[op] + ', File: ' + filename + ', Transfer type: ' + mode;
      rows.push(['File name', filename]);
      rows.push(['Mode', mode + (mode.toLowerCase() === 'octet' ? '  (raw bytes, exactly as stored)' : mode.toLowerCase() === 'netascii' ? '  (text, line endings converted)' : '')]);
      rows.push(['Sent to port', '69  - the only packet that uses the well-known port']);
    } else if (op === 3) {
      var block = u16(b, o + 2), dlen = end - (o + 4);
      p.tftp.block = block; p.tftp.data = b.slice(o + 4, end);
      p.info = 'Data Packet, Block: ' + block + (dlen < 512 ? ' (last)' : '');
      rows.push(['Block number', String(block)]);
      rows.push(['Data', dlen + ' bytes' + (dlen < 512 ? '  - shorter than 512, so this is the last block of the file' : '  - a full block; more will follow')]);
    } else if (op === 4) {
      var ablock = u16(b, o + 2);
      p.tftp.block = ablock;
      p.info = 'Acknowledgement, Block: ' + ablock;
      rows.push(['Block number', ablock + '  - "I received block ' + ablock + ', send the next one"']);
    } else if (op === 5) {
      var code = u16(b, o + 2), z = o + 4; while (z < end && b[z] !== 0) z++;
      var msg = ascii(b, o + 4, z - (o + 4));
      p.info = 'Error Code: ' + code + ', Message: ' + msg;
      rows.push(['Error code', String(code)], ['Message', msg]);
    } else if (op === 6) {
      p.info = 'Option Acknowledgement';
    } else {
      p.info = 'TFTP opcode ' + op;
    }
    p.details.push(section('Trivial File Transfer Protocol', rows));
  }

  function portHint(port) {
    var known = { 53: 'DNS', 67: 'DHCP server', 68: 'DHCP client', 69: 'TFTP', 80: 'HTTP', 443: 'HTTPS', 22: 'SSH', 123: 'NTP' };
    return known[port] ? '  (' + known[port] + ')' : '';
  }

  function dnsName(b, o, base, depth) {
    /* returns { name, next } handling compression pointers */
    depth = depth || 0;
    var labels = [], pos = o, next = null;
    while (pos < b.length) {
      var len = b[pos];
      if (len === 0) { pos++; break; }
      if ((len & 0xc0) === 0xc0) {
        var ptr = ((len & 0x3f) << 8) | b[pos + 1];
        if (next === null) next = pos + 2;
        if (depth > 10) break;
        var r = dnsName(b, base + ptr, base, depth + 1);
        labels.push(r.name);
        pos = null;
        break;
      }
      labels.push(ascii(b, pos + 1, len));
      pos += 1 + len;
    }
    return { name: labels.join('.'), next: next === null ? pos : next };
  }

  function decodeDns(p, b, o, end) {
    var id = u16(b, o), flags = u16(b, o + 2);
    var qd = u16(b, o + 4), an = u16(b, o + 6);
    var isResponse = !!(flags & 0x8000);
    var rcode = flags & 0x000f;
    var typeNames = { 1: 'A', 2: 'NS', 5: 'CNAME', 12: 'PTR', 15: 'MX', 16: 'TXT', 28: 'AAAA' };
    var pos = o + 12, questions = [], answers = [];
    for (var i = 0; i < qd && pos < end; i++) {
      var q = dnsName(b, pos, o); pos = q.next;
      var qtype = u16(b, pos); pos += 4;
      questions.push({ name: q.name, type: typeNames[qtype] || qtype });
    }
    for (var j = 0; j < an && pos < end; j++) {
      var a = dnsName(b, pos, o); pos = a.next;
      var atype = u16(b, pos), ttl = u32(b, pos + 4), rdlen = u16(b, pos + 8); pos += 10;
      var rdata = '';
      if (atype === 1 && rdlen === 4) rdata = ip4(b, pos);
      else if (atype === 5 || atype === 2 || atype === 12) rdata = dnsName(b, pos, o).name;
      else rdata = rdlen + ' bytes';
      pos += rdlen;
      answers.push({ name: a.name, type: typeNames[atype] || atype, ttl: ttl, data: rdata });
    }
    p.proto = 'DNS';
    p.dns = { id: id, response: isResponse, questions: questions, answers: answers };
    var qtext = questions.map(function (q) { return q.type + ' ' + q.name; }).join(', ');
    if (!isResponse) {
      p.info = 'Standard query ' + hex(id, 4) + ' ' + qtext;
    } else {
      var atext = answers.map(function (a) { return a.type + ' ' + a.data; }).join(', ');
      p.info = 'Standard query response ' + hex(id, 4) + ' ' + qtext + (atext ? ' → ' + atext : rcode ? ' (error ' + rcode + ')' : '');
    }
    var rows = [
      ['Transaction ID', hex(id, 4) + '  - the answer carries the same ID so the client can match it to the question'],
      ['Type', isResponse ? 'response' : 'query'],
      ['Question', qtext || '(none)']
    ];
    answers.forEach(function (a) { rows.push(['Answer', a.name + ' ' + a.type + ' ' + a.data + '  (TTL ' + a.ttl + ' s)']); });
    p.details.push(section('Domain Name System', rows));
  }

  function decodeDhcp(p, b, o, end) {
    var op = b[o], xid = u32(b, o + 4), secs = u16(b, o + 8), flags = u16(b, o + 10);
    var ciaddr = ip4(b, o + 12), yiaddr = ip4(b, o + 16), siaddr = ip4(b, o + 20);
    var chaddr = mac(b, o + 28);
    var msgNames = { 1: 'Discover', 2: 'Offer', 3: 'Request', 4: 'Decline', 5: 'ACK', 6: 'NAK', 7: 'Release', 8: 'Inform' };
    var opts = {};
    var pos = o + 240; /* skip fixed header + magic cookie */
    if (u32(b, o + 236) !== 0x63825363) pos = end; /* no magic cookie: no options */
    while (pos < end) {
      var code = b[pos];
      if (code === 255) break;
      if (code === 0) { pos++; continue; }
      var len = b[pos + 1];
      opts[code] = b.subarray(pos + 2, pos + 2 + len);
      pos += 2 + len;
    }
    var msgType = opts[53] ? opts[53][0] : 0;
    var msgName = msgNames[msgType] || ('message type ' + msgType);
    p.proto = 'DHCP';
    p.info = 'DHCP ' + msgName + '  - Transaction ID ' + hex(xid, 8);
    var dnsList = [];
    if (opts[6]) for (var di = 0; di + 4 <= opts[6].length; di += 4) dnsList.push(ip4(opts[6], di));
    p.dhcp = {
      type: msgName, xid: xid, chaddr: chaddr, yiaddr: yiaddr, ciaddr: ciaddr,
      mask: opts[1] ? ip4(opts[1], 0) : null, router: opts[3] ? ip4(opts[3], 0) : null,
      dns: dnsList, serverId: opts[54] ? ip4(opts[54], 0) : null, lease: opts[51] ? u32(opts[51], 0) : null
    };
    var rows = [
      ['Message type', msgName + ' (option 53 = ' + msgType + ')'],
      ['Transaction ID', hex(xid, 8) + '  - stays the same for all four DORA messages'],
      ['Direction', op === 1 ? 'client → server (BOOTP request)' : 'server → client (BOOTP reply)'],
      ['Client MAC', chaddr],
      ['Client IP (ciaddr)', ciaddr + (ciaddr === '0.0.0.0' ? '  (client has no address yet)' : '')],
      ['Your IP (yiaddr)', yiaddr + (yiaddr === '0.0.0.0' ? '' : '  (the address being handed out)')]
    ];
    if (siaddr !== '0.0.0.0') rows.push(['Server IP (siaddr)', siaddr]);
    if (secs) rows.push(['Seconds elapsed', String(secs)]);
    rows.push(['Broadcast flag', (flags & 0x8000) ? 'set (please reply by broadcast)' : 'not set']);
    if (opts[50]) rows.push(['Requested IP (option 50)', ip4(opts[50], 0)]);
    if (opts[54]) rows.push(['DHCP server (option 54)', ip4(opts[54], 0)]);
    if (opts[51]) rows.push(['Lease time (option 51)', u32(opts[51], 0) + ' seconds (' + (u32(opts[51], 0) / 3600) + ' hours)']);
    if (opts[1]) rows.push(['Subnet mask (option 1)', ip4(opts[1], 0)]);
    if (opts[3]) rows.push(['Router / gateway (option 3)', ip4(opts[3], 0)]);
    if (opts[6]) {
      var dns = [];
      for (var i = 0; i + 4 <= opts[6].length; i += 4) dns.push(ip4(opts[6], i));
      rows.push(['DNS servers (option 6)', dns.join(', ')]);
    }
    if (opts[15]) rows.push(['Domain name (option 15)', ascii(opts[15], 0, opts[15].length)]);
    if (opts[61]) rows.push(['Client identifier (option 61)', opts[61][0] === 1 ? mac(opts[61], 1) : opts[61].length + ' bytes']);
    if (opts[55]) {
      var names = { 1: 'subnet mask', 3: 'router', 6: 'DNS', 15: 'domain name', 42: 'NTP', 119: 'search list' };
      var want = [];
      for (var k = 0; k < opts[55].length; k++) want.push(names[opts[55][k]] || opts[55][k]);
      rows.push(['Parameters requested (option 55)', want.join(', ')]);
    }
    p.details.push(section('Dynamic Host Configuration Protocol', rows));
  }

  /* ---------- layer 4: TCP ---------- */

  function decodeTcp(p, b, o, end) {
    var sport = u16(b, o), dport = u16(b, o + 2);
    var seq = u32(b, o + 4), ack = u32(b, o + 8);
    var dataOff = (b[o + 12] >> 4) * 4, flagBits = b[o + 13], win = u16(b, o + 14);
    var payload = o + dataOff, payloadLen = Math.max(0, end - payload);
    var names = [];
    if (flagBits & 0x02) names.push('SYN');
    if (flagBits & 0x01) names.push('FIN');
    if (flagBits & 0x04) names.push('RST');
    if (flagBits & 0x08) names.push('PSH');
    if (flagBits & 0x10) names.push('ACK');
    if (flagBits & 0x20) names.push('URG');
    var order = ['FIN', 'SYN', 'RST', 'PSH', 'ACK', 'URG'];
    names.sort(function (a, c) { return order.indexOf(a) - order.indexOf(c); });

    /* options (only the ones students meet in a handshake) */
    var optRows = [], mss = null, wscale = null, sack = false;
    var pos = o + 20;
    while (pos < o + dataOff) {
      var kind = b[pos];
      if (kind === 0) break;
      if (kind === 1) { pos++; continue; }
      var len = b[pos + 1];
      if (kind === 2) mss = u16(b, pos + 2);
      else if (kind === 3) wscale = b[pos + 2];
      else if (kind === 4) sack = true;
      pos += len || 2;
    }
    if (mss !== null) optRows.push(['Max segment size (MSS)', mss + ' bytes  - biggest chunk of data I can accept per packet']);
    if (wscale !== null) optRows.push(['Window scale', 'shift ' + wscale + '  (multiply the window by ' + Math.pow(2, wscale) + ')']);
    if (sack) optRows.push(['SACK permitted', 'yes  - selective acknowledgement allowed']);

    p.proto = 'TCP';
    p.sport = sport; p.dport = dport;
    p.tcp = { seq: seq, ack: ack, flags: names, syn: !!(flagBits & 0x02), hasAck: !!(flagBits & 0x10), win: win, len: payloadLen, mss: mss, wscale: wscale };
    p.tcpSection = section('Transmission Control Protocol', [
      ['Source port', String(sport) + portHint(sport)],
      ['Destination port', String(dport) + portHint(dport)],
      ['Flags', '[' + names.join(', ') + ']'],
      ['Sequence number', '(filled in below)'],
      ['Acknowledgement number', '(filled in below)'],
      ['Window size', win + (wscale !== null ? '  - bytes I can accept right now' : '  - multiply by the scale factor agreed in the SYN to get real bytes')],
      ['Payload', payloadLen + ' bytes']
    ].concat(optRows));
    p.details.push(p.tcpSection);

    if (payloadLen > 0 && (sport === 80 || dport === 80)) decodeHttp(p, b, payload, end);
  }

  function decodeHttp(p, b, o, end) {
    var n = Math.min(end - o, 512);
    if (!isPrintable(b, o, Math.min(n, 64))) {
      p.httpInfo = 'Continuation of HTTP data (' + (end - o) + ' bytes, not text)';
      return;
    }
    var text = ascii(b, o, n);
    var firstLine = text.split(/\r?\n/)[0];
    var isRequest = /^(GET|POST|HEAD|PUT|DELETE|OPTIONS|PATCH) /.test(firstLine);
    var isResponse = /^HTTP\/\d/.test(firstLine);
    if (!isRequest && !isResponse) {
      p.httpInfo = 'Continuation of HTTP data (' + (end - o) + ' bytes)';
      p.proto = 'HTTP';
      p.details.push(section('Hypertext Transfer Protocol', [['Body', 'more of the response body, ' + (end - o) + ' bytes; first characters: ' + JSON.stringify(text.slice(0, 60))]]));
      return;
    }
    var headerEnd = text.indexOf('\r\n\r\n');
    var headerText = headerEnd >= 0 ? text.slice(0, headerEnd) : text;
    var lines = headerText.split(/\r?\n/);
    var rows = [[isRequest ? 'Request line' : 'Status line', lines[0]]];
    var ctype = '';
    for (var i = 1; i < lines.length && i < 20; i++) {
      var idx = lines[i].indexOf(':');
      if (idx > 0) {
        var name = lines[i].slice(0, idx), val = lines[i].slice(idx + 1).trim();
        rows.push([name, val]);
        if (name.toLowerCase() === 'content-type') ctype = val;
      }
    }
    if (headerEnd >= 0) {
      var bodyStart = o + headerEnd + 4;
      var bodyBytes = end - bodyStart;
      if (bodyBytes > 0) rows.push(['Body (this packet)', bodyBytes + ' bytes; begins: ' + JSON.stringify(ascii(b, bodyStart, Math.min(bodyBytes, 60)))]);
    }
    p.proto = 'HTTP';
    p.httpInfo = lines[0] + (ctype ? '  (' + ctype.split(';')[0] + ')' : '');
    p.details.push(section('Hypertext Transfer Protocol', rows));
  }

  /* Wireshark shows sequence numbers relative to the first one seen in each
   * direction, which is far easier to read. Do the same here. */
  function makeTcpSeqRelative(packets) {
    var isn = {};
    packets.forEach(function (p) {
      if (!p.tcp) return;
      var fwd = p.src + ':' + p.sport + '>' + p.dst + ':' + p.dport;
      var rev = p.dst + ':' + p.dport + '>' + p.src + ':' + p.sport;
      if (isn[fwd] === undefined) isn[fwd] = p.tcp.seq;
      var relSeq = (p.tcp.seq - isn[fwd]) >>> 0;
      var relAck = p.tcp.hasAck && isn[rev] !== undefined ? (p.tcp.ack - isn[rev]) >>> 0 : null;
      var t = p.tcp;
      var parts = [p.sport + ' → ' + p.dport, '[' + t.flags.join(', ') + ']', 'Seq=' + relSeq];
      if (relAck !== null) parts.push('Ack=' + relAck);
      parts.push('Win=' + t.win, 'Len=' + t.len);
      if (t.syn && t.mss) parts.push('MSS=' + t.mss);
      p.info = p.httpInfo ? p.httpInfo : parts.join(' ');
      /* fill the placeholders in the detail rows */
      p.tcpSection.rows.forEach(function (r) {
        if (r[0] === 'Sequence number') r[1] = relSeq + ' (relative)   raw: ' + t.seq;
        if (r[0] === 'Acknowledgement number') r[1] = relAck === null ? (t.hasAck ? String(t.ack) : 'not used (ACK flag off)') : relAck + ' (relative)   raw: ' + t.ack;
      });
      if (p.httpInfo) p.tcpSection.rows.push(['TCP summary', parts.join(' ')]);
    });
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { parsePcap: parsePcap };
  else root.parsePcap = parsePcap;
})(typeof window !== 'undefined' ? window : this);
