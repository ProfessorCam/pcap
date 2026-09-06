/* app.js - wires the left column to the right column. No frameworks. */
(function () {
  'use strict';

  var nav = document.getElementById('nav');
  var main = document.getElementById('main');
  var content = document.getElementById('content');
  var pcapCache = {};

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- expanding site menu (the whole left rail is the button) ---------- */

  function buildMenu() {
    var panel = document.getElementById('sitemenu'), btn = document.getElementById('menu-btn');
    if (!panel || !btn || !SITE.menu) return;
    panel.innerHTML = '<div class="sitemenu-title">Sites</div>' + SITE.menu.map(function (m) {
      if (!m.href) return '<span class="menu-item soon"><span>' + esc(m.label) + '</span><small>coming soon</small></span>';
      return '<a class="menu-item' + (m.current ? ' current' : '') + '" href="' + esc(m.href) + '"' + (m.current ? ' aria-current="page"' : '') + '>' + esc(m.label) + (m.current ? '<small>you are here</small>' : '') + '</a>';
    }).join('') + '<div class="sitemenu-foot">Click anywhere else, or press Escape, to close.</div>';

    var leaveTimer = null;
    function setOpen(open) {
      panel.classList.toggle('open', open);
      btn.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close site menu' : 'Open site menu');
      if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    }
    function isOpen() { return panel.classList.contains('open'); }

    btn.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!isOpen()); });
    panel.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.target.closest('a.menu-item')) setOpen(false);   /* chose a site */
    });
    document.addEventListener('click', function () { if (isOpen()) setOpen(false); });          /* clicked elsewhere */
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) { setOpen(false); btn.focus(); } });
    /* not in use: mouse wandered off the menu for a moment */
    panel.addEventListener('mouseleave', function () { if (isOpen()) leaveTimer = setTimeout(function () { setOpen(false); }, 1200); });
    panel.addEventListener('mouseenter', function () { if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; } });
    panel.addEventListener('focusout', function (e) { if (!panel.contains(e.relatedTarget) && e.relatedTarget !== btn) setOpen(false); });
  }

  /* ---------- left column ---------- */

  var STACK_GROUPS = { 2: 'Layer 2 · Link', 3: 'Layer 3 · Network', 4: 'Layer 4 · Transport', 7: 'Layer 7 · Application', tls: 'Between 4 and 7 · TLS', files: 'Not packets · files', stack: 'All layers' };
  var STACK_CHIPS = { 2: 'L2', 3: 'L3', 4: 'L4', 7: 'L7', tls: 'TLS', files: 'files', stack: 'L2–7' };

  function buildNav() {
    var last = null;
    LESSONS.forEach(function (l, i) {
      if (l.stack !== undefined && l.stack !== last) {
        var g = document.createElement('div');
        g.className = 'nav-group';
        g.textContent = STACK_GROUPS[l.stack] || String(l.stack);
        nav.appendChild(g);
        last = l.stack;
      }
      var b = document.createElement('button');
      b.className = 'row';
      b.type = 'button';
      b.dataset.id = l.id;
      b.innerHTML =
        '<span class="text"><span class="title">' + esc(l.title) + '</span>' +
        '<span class="sub">' + esc(l.subtitle) + '</span></span>' +
        (l.stack !== undefined ? '<span class="lay">' + esc(l.chip || STACK_CHIPS[l.stack] || l.stack) + '</span>' : '');
      b.addEventListener('click', function () { location.hash = l.id; });
      nav.appendChild(b);
    });
  }

  function setActive(id) {
    Array.prototype.forEach.call(nav.querySelectorAll('.row'), function (b) {
      b.classList.toggle('active', b.dataset.id === id);
    });
  }

  /* ---------- sequence diagram ---------- */

  function diagram(lesson) {
    var actors = lesson.actors, steps = lesson.steps;
    var colW = 280, left = 140, top = 70, rowH = 34;
    var width = left * 2 + colW * (actors.length - 1);
    var height = top + rowH * steps.length + 30;
    var xs = actors.map(function (a, i) { return left + colW * i; });
    var out = [];
    out.push('<svg class="seq" viewBox="0 0 ' + width + ' ' + height + '" style="max-width:' + width + 'px" role="img" aria-label="Sequence diagram">');
    var head = '<path d="M0 0 L10 5 L0 10 z"/>';
    function marker(id) { return '<marker id="' + id + '" class="' + id + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">' + head + '</marker>'; }
    out.push('<defs>' + marker('arrow') + marker('arrow-bcast') + marker('arrow-dashed') + '</defs>');
    actors.forEach(function (a, i) {
      out.push('<line class="life" x1="' + xs[i] + '" y1="' + (top - 10) + '" x2="' + xs[i] + '" y2="' + (height - 10) + '"/>');
      out.push('<text class="actor" x="' + xs[i] + '" y="24" text-anchor="middle">' + esc(a.name) + '</text>');
      out.push('<text class="addr" x="' + xs[i] + '" y="42" text-anchor="middle">' + esc(a.addr) + '</text>');
    });
    steps.forEach(function (s, i) {
      var y = top + rowH * i + 12;
      var x1 = xs[s.from], x2, cls = 'msg' + (s.dashed ? ' dashed' : '');
      if (s.to === 'all') {
        /* broadcast: a line across the whole LAN, with a dot at the sender */
        cls += ' bcast';
        out.push('<line class="' + cls + '" x1="40" y1="' + y + '" x2="' + (width - 20) + '" y2="' + y + '" marker-start="url(#arrow-bcast)" marker-end="url(#arrow-bcast)"/>');
        out.push('<circle class="origin" cx="' + x1 + '" cy="' + y + '" r="4"/>');
        out.push('<text class="label" x="' + (width / 2) + '" y="' + (y - 6) + '" text-anchor="middle">' + esc(s.label) + '</text>');
      } else {
        x2 = xs[s.to];
        out.push('<line class="' + cls + '" x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" marker-end="url(#' + (s.dashed ? 'arrow-dashed' : 'arrow') + ')"/>');
        out.push('<text class="label" x="' + ((x1 + x2) / 2) + '" y="' + (y - 6) + '" text-anchor="middle">' + esc(s.label) + '</text>');
      }
      out.push('<text class="stepno" x="18" y="' + (y + 4) + '" text-anchor="middle">' + (i + 1) + '</text>');
    });
    out.push('</svg>');
    return out.join('');
  }

  /* ---------- looping packet-assembly animations ---------- */

  /* Each animation: html() returns the markup, stages[] lists what is
   * switched on at each step (segment ids) with a caption and a hold time.
   * The loop runs until the lesson changes. */
  function assemblyHtml(key, a) {
    var h = ['<div class="asm" data-anim="' + key + '" aria-label="Animation: ' + esc(a.label) + '">'];
    h.push('<div class="asm-caption"><span class="asm-dots">' + a.stages.map(function (s, i) { return '<i data-i="' + i + '"></i>'; }).join('') + '</span><span class="asm-text"></span></div>');
    h.push('<div class="asm-bar">');
    a.segments.forEach(function (g) {
      h.push('<div class="seg seg-' + (g.color || g.id) + (g.ghost ? ' seg-ghost' : '') + '" data-seg="' + g.id + '" style="--w:' + g.width + '%">' +
        '<div class="seg-name">' + esc(g.name) + '</div>' +
        '<div class="seg-bytes">' + g.bytes + ' bytes</div>' +
        '<div class="seg-fields">' + g.fields.map(function (f) { return '<span>' + esc(f) + '</span>'; }).join('') + '</div></div>');
    });
    h.push('</div>');
    h.push('<div class="asm-foot"><div class="asm-ctl">' +
      '<button type="button" class="asm-btn" data-act="prev" title="Back one step" aria-label="Back one step">&#9664;</button>' +
      '<button type="button" class="asm-btn asm-toggle" data-act="toggle" title="Pause" aria-label="Pause">&#10074;&#10074;</button>' +
      '<button type="button" class="asm-btn" data-act="next" title="Forward one step" aria-label="Forward one step">&#9654;</button>' +
      '<span class="asm-step"></span></div>' +
      '<div class="asm-total"><span class="asm-total-label">Frame so far</span> <b class="asm-bytes">0</b> bytes</div></div>');
    h.push('</div>');
    return h.join('');
  }

  var ANIMATIONS = {
    'icmp-assembly': {
      label: 'how one ping packet is assembled',
      segments: [
        { id: 'eth',   name: 'Ethernet header', bytes: 14, width: 19, fields: ['dst 00:50:56:c0:00:01', 'src 00:0c:29:4b:1f:a2', 'type 0x0800 = IPv4'] },
        { id: 'ip',    name: 'IP header',       bytes: 20, width: 23, fields: ['from 192.168.110.50', 'to 192.168.110.1', 'protocol 1 = ICMP', 'TTL 64'] },
        { id: 'ghost', name: 'TCP / UDP header', bytes: 0, width: 18, ghost: true, fields: ['none', 'no ports', 'no connection'] },
        { id: 'icmp',  name: 'ICMP header',     bytes: 8,  width: 19, fields: ['type 8 (echo request)', 'code 0', 'checksum', 'id 6699, seq 1'] },
        { id: 'data',  name: 'Ping data',       bytes: 56, width: 35, fields: ['56 bytes of filler', 'the reply must echo', 'these back unchanged'] }
      ],
      stages: [
        { on: ['data'],                          hold: 2600, caption: { s: 'Start with what ping wants to send: a little filler data, 56 bytes.', m: 'Start with what ping wants to send: 56 bytes of filler data (usually a timestamp and a pattern of letters).', e: '56-byte payload: an 8-byte send timestamp followed by a repeating byte pattern (the Linux ping default).' } },
        { on: ['icmp', 'data'],                  hold: 3400, caption: { s: 'ICMP puts a small label in front: "this is a ping request", plus a run number so the reply can be matched up.', m: 'ICMP puts its 8-byte header in front: type 8 means Echo Request, plus an identifier and a sequence number so the reply can be matched up.', e: 'ICMP header, 8 bytes: type 8, code 0, checksum, identifier 6699, sequence 1.' } },
        { on: ['ghost', 'icmp', 'data'],         hold: 3400, caption: { s: 'This gap is where the "port" layer would go for a web page. Ping has none.', m: 'This is where TCP or UDP would go for a web page or a DNS lookup. For ping there is nothing here: no port numbers, no connection.', e: 'No transport header: ICMP is IP protocol 1 and has no ports.' } },
        { on: ['ip', 'icmp', 'data'],            hold: 3400, caption: { s: 'IP adds the addresses: who it is from and who it is for.', m: 'IP wraps it in a 20-byte header: source and destination address, TTL 64, and protocol 1, which tells the receiver "an ICMP message is inside".', e: 'IPv4 header, 20 bytes: total length 84, TTL 64, protocol 1, source .50, destination .1, header checksum.' } },
        { on: ['eth', 'ip', 'icmp', 'data'],     hold: 3600, caption: { s: 'Ethernet adds the card numbers for this hop. The finished frame is 98 bytes and goes on the wire.', m: 'Ethernet adds the last 14 bytes: destination MAC, source MAC and type 0x0800 for IPv4. The finished frame is 98 bytes and goes on the wire.', e: 'Ethernet header, 14 bytes: destination MAC, source MAC, EtherType 0x0800. 98 bytes on the wire plus a 4-byte FCS that is not captured.' } },
        { on: ['eth', 'ip', 'icmp', 'data'], done: true, hold: 2600, caption: { s: 'Sent. The reply is built the same way coming back, then it all starts again with the next run number.', m: 'Sent. The Echo Reply is built the same way in the other direction, with ICMP type 0 and the same data. Then it starts again with the next sequence number.', e: 'Sent. The reply is type 0 with identical identifier, sequence and payload; the next request uses sequence 2.' } }
      ]
    },

    'dhcp-discover': {
      label: 'how a DHCP Discover is assembled by a machine with no address',
      segments: [
        { id: 'eth',  name: 'Ethernet header', bytes: 14,  width: 19, fields: ['dst ff:ff:ff:ff:ff:ff', 'src 00:0c:29:4b:1f:a2', 'type 0x0800 = IPv4'] },
        { id: 'ip',   name: 'IP header',       bytes: 20,  width: 22, fields: ['from 0.0.0.0', 'to 255.255.255.255', 'protocol 17 = UDP', 'TTL 255'] },
        { id: 'udp',  name: 'UDP header',      bytes: 8,   width: 16, fields: ['src port 68', 'dst port 67', 'length 308', 'checksum'] },
        { id: 'dhcp', name: 'DHCP message',    bytes: 300, width: 39, color: 'data', fields: ['op 1 = request, xid 0x3d1f7a44', 'client MAC 00:0c:29:4b:1f:a2', 'option 53: 1 = DISCOVER', 'option 55: mask, router, DNS'] }
      ],
      stages: [
        { on: ['dhcp'],                     hold: 3200, caption: { s: 'The message: "I am this network card and I need an address."', m: 'The message itself: "I am 00:0c:29:4b:1f:a2 and I need an address." Option 53 makes it a Discover, and a random transaction ID lets the client recognise the answers.', e: 'DHCP message, 300 bytes: op 1, htype 1, xid 0x3d1f7a44, chaddr 00:0c:29:4b:1f:a2, option 53 = 1 (Discover), options 61, 12, 57 and 55.' } },
        { on: ['udp', 'dhcp'],              hold: 3400, caption: { s: 'UDP adds the port numbers: from 68 (the one asking) to 67 (the server).', m: 'UDP adds 8 bytes: from port 68 (DHCP client) to port 67 (DHCP server). No connection to set up, which is essential, because with no address the client could not open one anyway.', e: 'UDP header, 8 bytes: source port 68, destination port 67, length 308, checksum.' } },
        { on: ['ip', 'udp', 'dhcp'],        hold: 3800, caption: { s: 'IP has a problem: the computer has no address yet. So it writes "nobody" as the sender and "everybody" as the receiver.', m: 'IP has a problem: the client has no address. So the source is 0.0.0.0, meaning "nobody yet", and the destination is 255.255.255.255, meaning "everybody on this network".', e: 'IPv4 header: source 0.0.0.0, destination 255.255.255.255 (limited broadcast), protocol 17, total length 328.' } },
        { on: ['eth', 'ip', 'udp', 'dhcp'], hold: 3800, caption: { s: 'Ethernet has the same problem: it does not know the server\'s card. So it sends to everyone. 342 bytes, on the wire.', m: 'Ethernet has the same problem: the client does not know the server\'s MAC. So the destination is ff:ff:ff:ff:ff:ff, the broadcast address every network card listens for. 342 bytes, on the wire.', e: 'Ethernet header: destination ff:ff:ff:ff:ff:ff, source 00:0c:29:4b:1f:a2, EtherType 0x0800. 342 bytes on the wire.' } },
        { on: ['eth', 'ip', 'udp', 'dhcp'], done: true, hold: 2800, caption: { s: 'Every machine on the network receives it. Only address servers answer, also to everyone, because the new computer still has no address.', m: 'Every machine on the LAN receives this frame. Only DHCP servers act on it: they reply with an Offer, also broadcast, because the client still has no address to send to.', e: 'All hosts receive the frame; DHCP servers respond with DHCPOFFER, also broadcast, because the client has no address yet and set the broadcast flag.' } }
      ]
    },

    'tcp-syn': {
      label: 'how a TCP SYN is assembled and where the port numbers live',
      segments: [
        { id: 'eth',    name: 'Ethernet header', bytes: 14, width: 18, fields: ['dst 00:50:56:c0:00:01', 'src 00:0c:29:4b:1f:a2', 'type 0x0800 = IPv4'] },
        { id: 'ip',     name: 'IP header',       bytes: 20, width: 21, fields: ['from 192.168.110.50', 'to 192.168.110.1', 'protocol 6 = TCP', 'TTL 64'] },
        { id: 'tcp',    name: 'TCP header',      bytes: 20, width: 22, fields: ['src port 49832 (random)', 'dst port 80 (HTTP)', 'flags [SYN]', 'seq 3231822531 (random)', 'window 64240'] },
        { id: 'opts',   name: 'TCP options',     bytes: 20, width: 17, fields: ['MSS 1460', 'SACK permitted', 'timestamps', 'window scale 7'] },
        { id: 'nodata', name: 'Data',            bytes: 0,  width: 18, ghost: true, fields: ['none yet', 'sent only after', 'the handshake'] }
      ],
      stages: [
        { on: ['nodata'],                             hold: 2800, caption: { s: 'A hello packet carries no data at all. Its only job is to agree on how to talk.', m: 'A SYN carries no application data at all. Its whole job is to agree on how to talk before anything is said.', e: 'Zero payload: a SYN segment carries no application data.' } },
        { on: ['tcp', 'nodata'],                      hold: 4000, caption: { s: 'The TCP layer holds the port numbers: 80 names the web server, and 49832 is a random number the client made up so replies find their way back.', m: 'The TCP header is where the ports live. Destination port 80 names the program on the server (a web server). Source port 49832 was picked at random by the client so replies find the right program on its side. The SYN flag is on and the sequence number starts at a random value.', e: 'TCP header, 20 bytes: source port 49832, destination port 80, ISN 3231822531, flags SYN, window 64240, checksum.' } },
        { on: ['tcp', 'opts', 'nodata'],              hold: 3400, caption: { s: 'A few extra settings ride along: the biggest chunk each side can accept, and so on.', m: '20 bytes of options ride along on a SYN: the biggest segment I can take (MSS 1460), window scaling, selective ACK and timestamps. The other side answers with its own.', e: 'Options, 20 bytes: MSS 1460, SACK permitted, timestamps, NOP, window scale 7.' } },
        { on: ['ip', 'tcp', 'opts', 'nodata'],        hold: 3400, caption: { s: 'IP adds the addresses of the two computers. Addresses find the machine; ports find the program.', m: 'IP adds the addresses of the two machines and protocol 6, which tells the receiver "a TCP segment is inside". Addresses find the machine; ports find the program.', e: 'IPv4 header, 20 bytes: protocol 6, TTL 64, DF set, total length 60.' } },
        { on: ['eth', 'ip', 'tcp', 'opts'],           hold: 3600, caption: { s: 'Ethernet adds the card numbers for this hop. 74 bytes, and not one byte of data. On the wire.', m: 'Ethernet adds the MACs for this hop on the LAN. The finished SYN is 74 bytes: 14 + 20 + 20 + 20, and not a single byte of data. On the wire.', e: 'Ethernet header, 14 bytes, EtherType 0x0800: 74 bytes on the wire (14 + 20 + 20 + 20).' } },
        { on: ['eth', 'ip', 'tcp', 'opts'], done: true, hold: 2800, caption: { s: 'Sent. The server answers with its own hello, and only after the third packet can data flow.', m: 'Sent. The server answers from port 80 back to port 49832 with a SYN-ACK built the same way, and only after the third packet does real data start to flow.', e: 'Sent. The SYN-ACK returns from 80 to 49832 with ack = ISN + 1; data can flow after the third segment.' } }
      ]
    },

    'arp-request': {
      label: 'how an ARP request is assembled without any IP header',
      segments: [
        { id: 'eth',  name: 'Ethernet header', bytes: 14, width: 22, fields: ['dst ff:ff:ff:ff:ff:ff', '= broadcast', 'src 00:0c:29:4b:1f:a2', 'type 0x0806 = ARP'] },
        { id: 'noip', name: 'IP header',       bytes: 0,  width: 20, ghost: true, fields: ['none', 'ARP is not inside IP', 'it comes before IP'] },
        { id: 'arp',  name: 'ARP message',     bytes: 28, width: 38, fields: ['opcode 1 = request', 'sender MAC 00:0c:29:4b:1f:a2', 'sender IP 192.168.110.50', 'target MAC 00:00:00:00:00:00 = blank', 'target IP 192.168.110.1'] },
        { id: 'pad',  name: 'Padding',         bytes: 18, width: 16, fields: ['18 zero bytes', 'up to the 60-byte', 'Ethernet minimum'] }
      ],
      stages: [
        { on: ['arp'],                 hold: 3600, caption: { s: 'The question: "Who has 192.168.110.1? Tell 192.168.110.50." The blank to fill in is the card number of .1.', m: 'The question: "Who has 192.168.110.1? Tell 192.168.110.50." The sender fills in its own MAC and IP. The target MAC is all zeros: that is the blank it wants filled in.', e: 'ARP payload, 28 bytes: hardware type 1, protocol 0x0800, lengths 6 and 4, opcode 1, sender 00:0c:29:4b:1f:a2 / 192.168.110.50, target 00:00:00:00:00:00 / 192.168.110.1.' } },
        { on: ['noip', 'arp'],         hold: 3800, caption: { s: 'There is no IP layer at all. ARP is the helper that makes IP delivery possible, so it goes straight into the frame.', m: 'There is no IP header. ARP is not carried inside IP; it is the tool that makes IP delivery possible on a LAN, so it sits directly inside the Ethernet frame. No IP addresses in the outer packet, no TTL, no ports.', e: 'No IPv4 header: ARP has its own EtherType and is not an IP payload.' } },
        { on: ['eth', 'arp'],          hold: 3800, caption: { s: 'Ethernet adds its header, marked "ARP inside" and addressed to everyone, because nobody knows the answer yet.', m: 'Ethernet adds its header with type 0x0806, which means "ARP inside", and destination ff:ff:ff:ff:ff:ff. It has to be broadcast: the whole point is that the sender does not yet know the MAC it wants.', e: 'Ethernet header: destination ff:ff:ff:ff:ff:ff, source 00:0c:29:4b:1f:a2, EtherType 0x0806.' } },
        { on: ['eth', 'arp', 'pad'],   hold: 3400, caption: { s: '42 bytes is smaller than a frame is allowed to be, so zeros are added at the end to reach 60.', m: '14 + 28 = 42 bytes is below the 60-byte minimum an Ethernet frame must have, so 18 zero bytes are added at the end. That is why every ARP packet in the capture shows as 60 bytes.', e: '14 + 28 = 42 bytes; 18 bytes of zero padding bring it to the 60-byte minimum (64 with the FCS).' } },
        { on: ['eth', 'arp', 'pad'], done: true, hold: 2800, caption: { s: 'Every machine reads it. Only 192.168.110.1 answers, straight back to the asker, with the blank filled in.', m: 'Every machine on the LAN reads it. Only 192.168.110.1 answers, and its reply goes straight back to 00:0c:29:4b:1f:a2, not broadcast, with the blank filled in.', e: 'All hosts process it; only 192.168.110.1 replies with opcode 2, unicast to 00:0c:29:4b:1f:a2.' } }
      ]
    }
  };

  var animTimers = [];
  function stopAnimations() { animTimers.forEach(clearTimeout); animTimers = []; }

  /* Each animation loops on its own timer. The buttons under the bar pause it,
   * or step one stage back or forward (stepping pauses, so the reader can
   * take their time; play resumes the loop from that stage). */
  function startAnimations() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    Array.prototype.forEach.call(main.querySelectorAll('[data-anim]'), function (el) {
      var a = ANIMATIONS[el.dataset.anim];
      if (!a) return;
      var n = a.stages.length;
      var segs = {}; Array.prototype.forEach.call(el.querySelectorAll('.seg'), function (s) { segs[s.dataset.seg] = s; });
      var text = el.querySelector('.asm-text'), dots = el.querySelectorAll('.asm-dots i'), bytesEl = el.querySelector('.asm-bytes');
      var stepEl = el.querySelector('.asm-step'), toggleBtn = el.querySelector('.asm-toggle');
      var i = 0, timer = null, playing = !reduce;
      function apply(k) {
        var st = a.stages[k], total = 0;
        a.segments.forEach(function (g) {
          var on = st.on.indexOf(g.id) >= 0;
          segs[g.id].classList.toggle('on', on);
          if (on) total += g.bytes;
        });
        el.classList.toggle('done', !!st.done);
        text.textContent = lv(st.caption);
        bytesEl.textContent = total;
        stepEl.textContent = 'step ' + (k + 1) + ' of ' + n;
        Array.prototype.forEach.call(dots, function (d, j) { d.classList.toggle('on', j === k); });
      }
      function clearTimer() {
        if (timer === null) return;
        clearTimeout(timer);
        animTimers = animTimers.filter(function (t) { return t !== timer; });
        timer = null;
      }
      function schedule() {
        clearTimer();
        if (!playing) return;
        timer = setTimeout(function () { go((i + 1) % n); }, a.stages[i].hold);
        animTimers.push(timer);
      }
      function go(k) { i = k; apply(i); schedule(); }
      function setPlaying(p) {
        playing = p;
        el.classList.toggle('paused', !p);
        toggleBtn.innerHTML = p ? '&#10074;&#10074;' : '&#9654;';
        toggleBtn.title = p ? 'Pause' : 'Play';
        toggleBtn.setAttribute('aria-label', p ? 'Pause' : 'Play');
        schedule();
      }
      el.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-act], .asm-dots i') : null;
        if (!b || !el.contains(b)) return;
        if (b.dataset.act === 'toggle') { setPlaying(!playing); return; }
        setPlaying(false);
        if (b.dataset.act === 'prev') go((i - 1 + n) % n);
        else if (b.dataset.act === 'next') go((i + 1) % n);
        else if (b.dataset.i !== undefined) go(+b.dataset.i);
      });
      if (reduce) { i = n - 1; }
      setPlaying(playing);
      apply(i);
    });
  }

  /* ---------- right column ---------- */

  function renderWelcome() {
    content.innerHTML =
      '<article class="welcome">' +
      '<h1>Packet Lessons</h1>' +
      '<p class="lead">Pick a packet type on the left. Each row is a real capture from the lab network, decoded and explained.</p>' +
      '<h2>How to use this page</h2>' +
      '<ol>' +
      '<li>Click a row. Read the explanation and follow the arrows in the diagram.</li>' +
      '<li>Scroll to the packet table. It shows the actual packets from the capture, like Wireshark\'s main window.</li>' +
      '<li>Click any packet to open its details, layer by layer.</li>' +
      '<li>Use the <b>Download .pcap</b> button to open the same capture in Wireshark yourself.</li>' +
      '</ol>' +
      '<p class="hint"><b>Reading level.</b> The <b>Simple</b>, <b>Moderate</b> and <b>Engineer</b> buttons at the top right change how deep every explanation goes. Simple is the big idea in plain words, Moderate is CCNA-student depth, Engineer is the full technical detail kept short. Your choice is remembered on this browser, and a link with <code>?level=simple</code> (or moderate, engineer) opens the site at that level.</p>' +
      '<section id="livenet-section">' +
      '<h2>Your network right now</h2>' +
      '<p class="hint">Live, from the Wi-Fi and wired interfaces of the machine running this site. It refreshes every few seconds, so it changes when you move to another network.</p>' +
      '<div id="livenet"><p class="loading">Reading the network interfaces...</p></div>' +
      '</section>' +
      '<section id="runlocal-section" hidden>' +
      '<h2>See your own network on this page</h2>' +
      '<p class="hint">This copy of the site is static, so it cannot look at your interfaces. Run the same site as a Docker container on your own machine and this section turns into a live view of your Wi-Fi or wired IP address, mask, network, broadcast and gateway.</p>' +
      '<pre class="cmd">docker run --rm -it --name pcap-lessons --network host ' + esc(SITE.image) + '</pre>' +
      '<p class="hint">Then open <a href="http://127.0.0.1:' + SITE.port + '/">http://127.0.0.1:' + SITE.port + '/</a> on that machine. The container listens on port ' + SITE.port + ' with host networking, which is what lets it see the real interfaces. If you cannot use host networking (Docker Desktop on Mac or Windows without it enabled), <code>-p ' + SITE.port + ':' + SITE.port + '</code> instead of <code>--network host</code> still serves the lessons, but the live section will only see Docker\'s own network. The container runs in the foreground; press Ctrl+C to stop it, and it removes itself.</p>' +
      '</section>' +
      '<h2>' + esc(SITE.labName) + '</h2>' +
      '<p class="hint">The lab network the captures were recorded on: ' + esc(SITE.labNetwork) + '. The hosts below are not typed in by hand; the page reads every capture and works them out from the packets themselves.</p>' +
      '<div id="labnet"><p class="loading">Reading the captures...</p></div>' +
      '<h2>Reading the packet table</h2>' +
      '<ul>' +
      '<li><b>No.</b> the packet\'s position in the capture.</li>' +
      '<li><b>Time</b> seconds since the first packet. Small gaps mean fast answers.</li>' +
      '<li><b>Source / Destination</b> IP addresses, or MAC addresses for ARP because ARP lives below IP.</li>' +
      '<li><b>Protocol</b> the highest protocol the page could recognise in that packet.</li>' +
      '<li><b>Length</b> size of the whole Ethernet frame in bytes.</li>' +
      '<li><b>Info</b> a one-line summary, in the same style Wireshark uses.</li>' +
      '</ul>' +
      '</article>';
    startLiveNetwork();
    detectLabNetwork();
  }

  /* ---------- live network of the machine running the site ---------- */

  var liveTimer = null;
  function stopLiveNetwork() { if (liveTimer) { clearTimeout(liveTimer); liveTimer = null; } }

  function parseCidr(cidr) {
    var parts = cidr.split('/'), prefix = +parts[1];
    var mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return { network: (ipToInt(parts[0]) & mask) >>> 0, mask: mask, prefix: prefix };
  }
  function inCidr(ip, cidr) { var c = parseCidr(cidr); return ((ipToInt(ip) & c.mask) >>> 0) === c.network; }
  function prefixToMask(prefix) { return intToIp(prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0); }

  /* Interfaces that belong to Docker, VMs, tunnels or loopback are not "the network you are on". */
  var VIRTUAL_IF = /^(lo$|docker|br-|veth|virbr|vnet|tun|tap|wg|tailscale|zt|utun|vmnet|lxc|cni|flannel)/;

  function interfacesFrom(info) {
    var defaults = {};
    (info.route || []).forEach(function (r) { if (r.dst === 'default' && r.dev) defaults[r.dev] = r.gateway; });
    var wifi = info.wireless || [];
    var list = [];
    (info.addr || []).forEach(function (i) {
      var v4 = (i.addr_info || []).filter(function (a) { return a.family === 'inet'; });
      if (!v4.length || VIRTUAL_IF.test(i.ifname)) return;
      var isWifi = wifi.indexOf(i.ifname) >= 0 || /^wl/.test(i.ifname);
      v4.forEach(function (a) {
        var m = prefixToMask(a.prefixlen);
        list.push({
          name: i.ifname, type: isWifi ? 'Wi-Fi' : /^(en|eth|em|eno|ens|enp)/.test(i.ifname) ? 'Wired' : 'Other',
          ip: a.local, prefix: a.prefixlen, mask: m,
          network: intToIp((ipToInt(a.local) & ipToInt(m)) >>> 0),
          broadcast: a.broadcast || intToIp(((ipToInt(a.local) & ipToInt(m)) | (~ipToInt(m) >>> 0)) >>> 0),
          gateway: defaults[i.ifname] || null, mac: i.address || '', state: i.operstate || '',
          isDefault: !!defaults[i.ifname]
        });
      });
    });
    list.sort(function (a, b) { return (b.isDefault - a.isDefault) || a.name.localeCompare(b.name); });
    return list;
  }

  function renderLiveNetwork(info) {
    var box = document.getElementById('livenet');
    if (!box) return;
    var ifs = interfacesFrom(info);
    var lab = SITE.labNetwork, onLab = ifs.filter(function (i) { return inCidr(i.ip, lab); });
    var h = [];
    if (!ifs.length) {
      h.push('<p class="error">No Wi-Fi or wired interface with an IPv4 address was found. Is the machine connected to a network? (If the container is not running with network_mode: host, it can only see Docker\'s own interfaces.)</p>');
    } else {
      h.push('<div class="banner ' + (onLab.length ? 'ok' : 'warn') + '">' +
        (onLab.length ? '<b>You are on ' + esc(SITE.labName) + '</b> (' + esc(lab) + ') via ' + esc(onLab[0].name) + '.'
                      : '<b>You are not on ' + esc(SITE.labName) + '.</b> The captures were recorded on ' + esc(lab) + '; right now this machine is on ' +
                        ifs.map(function (i) { return esc(i.network) + '/' + i.prefix + ' (' + i.type + ')'; }).join(' and ') + '.') +
        '</div>');
      h.push('<div class="table-wrap"><table class="lab live"><tr><th>Interface</th><th>Type</th><th>IP address</th><th>Mask</th><th>Network</th><th>Broadcast</th><th>Gateway</th><th>MAC address</th></tr>');
      ifs.forEach(function (i) {
        h.push('<tr' + (i.isDefault ? ' class="primary"' : '') + '><td>' + esc(i.name) + (i.isDefault ? ' <span class="tag">default route</span>' : '') +
          (i.state && i.state !== 'UP' ? ' <span class="tag off">' + esc(i.state.toLowerCase()) + '</span>' : '') + '</td>' +
          '<td>' + i.type + '</td><td>' + esc(i.ip) + '/' + i.prefix + '</td><td>' + esc(i.mask) + '</td><td>' + esc(i.network) + '</td>' +
          '<td>' + esc(i.broadcast) + '</td><td>' + esc(i.gateway || '') + '</td><td>' + esc(i.mac) + '</td></tr>');
      });
      h.push('</table></div>');
    }
    var dns = (info.dns || []).filter(function (d) { return !/^127\./.test(d); });
    h.push('<p class="hint">Machine <code>' + esc(info.hostname || '?') + '</code>' + (dns.length ? ', DNS ' + esc(dns.join(', ')) : '') +
      ', read at ' + esc((info.generated || '').replace('T', ' ').replace('Z', ' UTC')) + '. <span id="whoami"></span></p>');
    box.innerHTML = h.join('');
  }

  /* network.json only exists when the site runs from the Docker container
   * (netinfo.sh writes it). On a plain static host such as GitHub Pages the
   * file is missing, so the whole section hides itself. */
  function startLiveNetwork() {
    stopLiveNetwork();
    var shown = false;
    function tick() {
      fetch('network.json', { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (info) { renderLiveNetwork(info); shown = true; })
        .catch(function () {
          if (!shown) {
            var sec = document.getElementById('livenet-section'); if (sec) sec.hidden = true;
            var run = document.getElementById('runlocal-section'); if (run && SITE.image) run.hidden = false;
          }
        })
        .then(function () { var sec = document.getElementById('livenet-section'); if (sec && !sec.hidden) liveTimer = setTimeout(tick, 5000); });
    }
    tick();
    fetch('whoami', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (w) {
      var ip = (w.forwarded && w.forwarded.split(',')[0].trim()) || w.ip;
      var el = document.getElementById('whoami');
      if (el) el.textContent = 'Your browser is connecting from ' + ip + (ip === '127.0.0.1' || ip === '::1' ? ' (this same machine).' : '.');
    }).catch(function () {});
  }

  /* ---------- lab network detection ---------- */

  function ipToInt(ip) { return ip.split('.').reduce(function (a, o) { return (a << 8) + (+o); }, 0) >>> 0; }
  function intToIp(n) { return [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255].join('.'); }
  function maskBits(mask) { var n = ipToInt(mask), c = 0; while (n & 0x80000000) { c++; n = (n << 1) >>> 0; } return c; }
  function isPrivate(ip) { return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(ip); }

  function loadAllCaptures() {
    return Promise.all(LESSONS.map(function (l) {
      if (pcapCache[l.file]) return Promise.resolve(pcapCache[l.file]);
      return fetch('pcaps/' + encodeURIComponent(l.file))
        .then(function (r) { if (!r.ok) throw new Error(l.file + ': HTTP ' + r.status); return r.arrayBuffer(); })
        .then(function (buf) { var p = parsePcap(buf); pcapCache[l.file] = p; return p; })
        .catch(function () { return []; });
    }));
  }

  /* Work out who is who from the packets: DHCP tells us the client address,
   * subnet mask, gateway and DNS servers; the frames give the MAC addresses;
   * the broadcast address is calculated from address + mask. */
  function analyseNetwork(captures) {
    var all = [].concat.apply([], captures);
    var net = { client: null, mask: null, router: null, dns: [], lease: null, macs: {}, ipCount: {}, hosts: {} };
    all.forEach(function (p) {
      if (p.dhcp && (p.dhcp.type === 'ACK' || p.dhcp.type === 'Offer')) {
        net.client = net.client || p.dhcp.yiaddr;
        net.mask = net.mask || p.dhcp.mask;
        net.router = net.router || p.dhcp.router || p.dhcp.serverId;
        if (!net.dns.length) net.dns = p.dhcp.dns;
        net.lease = net.lease || p.dhcp.lease;
        if (p.dhcp.chaddr) net.macs[p.dhcp.yiaddr] = p.dhcp.chaddr;
      }
      if (p.arp) {
        if (p.arp.spa !== '0.0.0.0') net.macs[p.arp.spa] = net.macs[p.arp.spa] || p.arp.sha;
        [p.arp.spa, p.arp.tpa].forEach(function (ip) { if (ip !== '0.0.0.0') net.hosts[ip] = true; });
      }
      if (p.dns && p.dns.response) p.dns.answers.forEach(function (a) { if (a.type === 'A') net.dnsHosts = Object.assign(net.dnsHosts || {}, (function (o) { o[a.data] = a.name; return o; })({})); });
      if (/^\d+\.\d+\.\d+\.\d+$/.test(p.src)) {
        if (p.src !== '0.0.0.0') { net.ipCount[p.src] = (net.ipCount[p.src] || 0) + 1; net.hosts[p.src] = true; net.macs[p.src] = net.macs[p.src] || p.srcMac; }
        if (p.dst !== '255.255.255.255') net.hosts[p.dst] = true;
      }
    });
    /* fallbacks when there is no DHCP capture: busiest private address is the client */
    var byCount = Object.keys(net.ipCount).sort(function (a, b) { return net.ipCount[b] - net.ipCount[a]; });
    var assumed = [];
    if (!net.client) { net.client = byCount.filter(isPrivate)[0] || byCount[0] || null; assumed.push('client address (busiest host in the captures)'); }
    if (!net.mask) { net.mask = '255.255.255.0'; assumed.push('subnet mask (/24)'); }
    if (!net.router && net.client) { net.router = byCount.filter(function (ip) { return ip !== net.client && isPrivate(ip); })[0] || null; assumed.push('gateway (second busiest host)'); }
    net.assumed = assumed;
    if (net.client && net.mask) {
      var m = ipToInt(net.mask), a = ipToInt(net.client);
      net.network = intToIp((a & m) >>> 0);
      net.broadcast = intToIp(((a & m) | (~m >>> 0)) >>> 0);
      net.prefix = maskBits(net.mask);
    }
    net.dhcpMask = net.mask;
    if (SITE.labNetwork) {
      var lab = parseCidr(SITE.labNetwork);
      net.network = intToIp(lab.network); net.prefix = lab.prefix; net.mask = intToIp(lab.mask);
      net.broadcast = intToIp((lab.network | (~lab.mask >>> 0)) >>> 0);
      net.assumed = net.assumed.filter(function (a) { return a.indexOf('subnet mask') < 0; });
    }
    net.dns.forEach(function (ip) { net.hosts[ip] = true; });
    net.inside = function (ip) { return net.network && (ipToInt(ip) & ipToInt(net.mask)) >>> 0 === ipToInt(net.network); };
    return net;
  }

  function detectLabNetwork() {
    var box = document.getElementById('labnet');
    loadAllCaptures().then(function (captures) {
      var net = analyseNetwork(captures);
      if (!net.client) { box.innerHTML = '<p class="error">Could not find any IPv4 hosts in the captures.</p>'; return; }
      var rows = [];
      function row(role, ip, mac, note) {
        rows.push('<tr><td>' + role + '</td><td>' + esc(ip || '?') + '</td><td>' + esc(mac || '') + '</td><td class="note">' + note + '</td></tr>');
      }
      row('Student VM (the one doing the capturing)', net.client, net.macs[net.client], 'from the DHCP ACK: "your IP address"');
      if (net.router) row('Gateway' + (net.dns.indexOf(net.router) >= 0 ? ', DHCP and DNS server' : ' and DHCP server'), net.router, net.macs[net.router], 'DHCP option 3 (router)' + (net.macs[net.router] ? ', MAC from its ARP reply' : ''));
      net.dns.filter(function (ip) { return ip !== net.router; }).forEach(function (ip) {
        row('DNS server', ip, '', net.inside(ip) ? 'DHCP option 6' : 'DHCP option 6, outside the lab (on the internet)');
      });
      row('Everyone on the LAN at once (broadcast)', net.broadcast, 'ff:ff:ff:ff:ff:ff', 'calculated: network ' + esc(net.network) + '/' + net.prefix + ' with all host bits set to 1');
      Object.keys(net.hosts).sort(function (a, b) { return ipToInt(a) - ipToInt(b); }).forEach(function (ip) {
        if (ip === net.client || ip === net.router || net.dns.indexOf(ip) >= 0 || ip === net.broadcast) return;
        if (net.inside(ip)) row('Another host on the lab network', ip, net.macs[ip], net.macs[ip] ? 'seen in the ARP capture' : 'asked for by ARP, but never answered');
        else row('Outside the lab', ip, '', 'on the internet, reached through the gateway' + (net.dnsHosts && net.dnsHosts[ip] ? ' (' + esc(net.dnsHosts[ip]) + ')' : ''));
      });
      Object.keys(net.dnsHosts || {}).forEach(function (ip) {
        if (net.hosts[ip]) return;
        row('Outside the lab', ip, '', 'answer to the DNS lookup for ' + esc(net.dnsHosts[ip]) + ', never contacted in these captures');
      });
      var h = ['<table class="lab"><tr><th>Machine</th><th>IP address</th><th>MAC address</th><th>How the page knows</th></tr>' + rows.join('') + '</table>'];
      h.push('<div class="facts netfacts">' +
        '<div><span class="k">Network</span><span class="v">' + esc(net.network) + '/' + net.prefix + '</span></div>' +
        '<div><span class="k">Subnet mask</span><span class="v">' + esc(net.mask) + '</span></div>' +
        '<div><span class="k">Broadcast</span><span class="v">' + esc(net.broadcast) + '</span></div>' +
        '<div><span class="k">Usable hosts</span><span class="v">' + esc(intToIp(ipToInt(net.network) + 1)) + ' to ' + esc(intToIp(ipToInt(net.broadcast) - 1)) + '</span></div>' +
        (SITE.dhcpScope ? (function () {
          var sc = parseCidr(SITE.dhcpScope), scBcast = (sc.network | (~sc.mask >>> 0)) >>> 0;
          var restFrom = intToIp(scBcast + 1), restTo = intToIp(ipToInt(net.broadcast) - 1);
          return '<div><span class="k">DHCP hands out leases from</span><span class="v">' + esc(intToIp(sc.network + 1)) + ' to ' + esc(intToIp(scBcast - 1)) + '</span></div>' +
            (scBcast + 1 < ipToInt(net.broadcast) ? '<div><span class="k">In the subnet, but never leased</span><span class="v">' + esc(restFrom) + ' to ' + esc(restTo) + '  (static only)</span></div>' : '');
        })() : '') +
        (net.lease ? '<div><span class="k">DHCP lease</span><span class="v">' + net.lease + ' s (' + (net.lease / 3600) + ' h)</span></div>' : '') +
        '</div>');
      if (net.assumed.length) h.push('<p class="hint">No DHCP capture found, so these were assumed: ' + esc(net.assumed.join(', ')) + '.</p>');
      if (net.dhcpMask && net.dhcpMask !== net.mask) {
        h.push('<p class="hint">Note: the DHCP Offer and ACK in the capture hand out subnet mask ' + esc(net.dhcpMask) + ' (/' + maskBits(net.dhcpMask) +
          '). This page uses the configured lab network ' + esc(SITE.labNetwork) + ' instead; open the DHCP packets in {{row:udp}} and you will still see the mask the server actually sent.</p>');
      }
      box.innerHTML = h.join('');
    });
  }

  function sectionHtml(s) {
    var h = ['<section><h2>' + esc(s.h) + '</h2>'];
    lv(s.p || []).forEach(function (p) { h.push('<p>' + p + '</p>'); });
    if (s.steps) { h.push('<ol class="steps">'); lv(s.steps).forEach(function (t) { h.push('<li>' + t + '</li>'); }); h.push('</ol>'); }
    if (s.anim && ANIMATIONS[s.anim]) h.push(assemblyHtml(s.anim, ANIMATIONS[s.anim]));
    lv(s.after || []).forEach(function (p) { h.push('<p>' + p + '</p>'); });
    h.push('</section>');
    return h.join('');
  }

  function renderLesson(lesson, index) {
    var h = [];
    h.push('<article class="lesson" id="lesson-' + lesson.id + '">');
    h.push('<p class="crumb">' + esc(STACK_GROUPS[lesson.stack] || 'Lesson') + '</p>');
    h.push('<h1>' + esc(lesson.title) + ' <small>' + esc(lesson.subtitle) + '</small></h1>');
    h.push('<p class="lead">' + esc(lv(lesson.oneLiner)) + '</p>');
    h.push('<div class="facts"><div><span class="k">Where it lives</span><span class="v">' + esc(lv(lesson.layer)) + '</span></div>');
    h.push('<div><span class="k">Command that made this capture</span><span class="v"><code>' + esc(lesson.command) + '</code></span></div></div>');
    lesson.sections.forEach(function (s) { h.push(sectionHtml(s)); });
    h.push('<section><h2>The conversation, step by step</h2><div class="diagram">' + diagram(lesson) + '</div></section>');
    h.push('<section><h2>What to look for in this capture</h2><ul class="lookfor">');
    lv(lesson.lookFor).forEach(function (t) { h.push('<li>' + esc(t) + '</li>'); });
    h.push('</ul></section>');
    if (lesson.reassemble) h.push('<section id="reassembled"></section>');
    h.push('<section class="packets"><div class="packets-head"><h2>The packets</h2>' +
      '<a class="dl" href="pcaps/' + encodeURIComponent(lesson.file) + '" download>Download .pcap</a></div>' +
      '<p class="hint">Click a packet to expand its details. File: <code>' + esc(lesson.file) + '</code></p>' +
      '<div id="table" class="table-wrap"><p class="loading">Loading capture...</p></div></section>');
    h.push('</article>');
    content.innerHTML = h.join('');
    main.scrollTop = 0;
    startAnimations();
    loadPackets(lesson);
  }

  function loadPackets(lesson) {
    var box = document.getElementById('table');
    function show(packets) {
      box.innerHTML = packetTable(packets);
      wireDetails(box, packets);
      wireCollapse(box);
      if (lesson.reassemble === 'tftp') showReassembled(packets);
    }
    if (pcapCache[lesson.file]) { show(pcapCache[lesson.file]); return; }
    fetch('pcaps/' + encodeURIComponent(lesson.file))
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(function (buf) { var p = parsePcap(buf); pcapCache[lesson.file] = p; show(p); })
      .catch(function (e) {
        box.innerHTML = '<p class="error">Could not load the capture: ' + esc(e.message) +
          '. This page must be served over HTTP (run the Docker container), not opened as a file.</p>';
      });
  }

  /* Long captures: show the first and last few packets, fold the middle. */
  var FOLD_ABOVE = 40, FOLD_HEAD = 14, FOLD_TAIL = 6;

  function packetTable(packets) {
    var h = ['<table class="pk"><thead><tr><th>No.</th><th>Time</th><th>Source</th><th>Destination</th><th>Protocol</th><th>Length</th><th>Info</th></tr></thead><tbody>'];
    var fold = packets.length > FOLD_ABOVE;
    packets.forEach(function (p, i) {
      var cls = 'proto-' + p.proto.toLowerCase().replace(/[^a-z0-9]/g, '');
      var folded = fold && i >= FOLD_HEAD && i < packets.length - FOLD_TAIL;
      if (fold && i === FOLD_HEAD) {
        h.push('<tr class="fold"><td colspan="7"><button type="button" class="fold-btn">Show the other ' +
          (packets.length - FOLD_HEAD - FOLD_TAIL) + ' packets (they repeat the same DATA / ACK pattern)</button></td></tr>');
      }
      h.push('<tr class="pkt ' + cls + (folded ? ' folded' : '') + '" data-i="' + i + '" tabindex="0"' + (folded ? ' hidden' : '') + '>' +
        '<td class="n">' + p.no + '</td><td class="t">' + p.time.toFixed(6) + '</td>' +
        '<td>' + esc(p.src) + '</td><td>' + esc(p.dst) + '</td>' +
        '<td class="p">' + esc(p.proto) + '</td><td class="n">' + p.len + '</td>' +
        '<td class="info">' + esc(p.info) + '</td></tr>');
      h.push('<tr class="det" hidden><td colspan="7"><div class="det-inner">' + details(p) + '</div></td></tr>');
    });
    h.push('</tbody></table>');
    return h.join('');
  }

  function details(p) {
    var h = ['<div class="frame-line">Frame ' + p.no + ': ' + p.len + ' bytes on the wire, captured ' + p.time.toFixed(6) + ' s after the first packet</div>'];
    p.details.forEach(function (sec) {
      h.push('<div class="sec"><div class="sec-title">' + esc(sec.title) + '</div><table class="kv">');
      sec.rows.forEach(function (r) { h.push('<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'); });
      h.push('</table></div>');
    });
    return h.join('');
  }

  function wireCollapse(box) {
    var btn = box.querySelector('.fold-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      Array.prototype.forEach.call(box.querySelectorAll('tr.pkt.folded'), function (tr) { tr.hidden = false; });
      btn.parentNode.parentNode.remove();
    });
  }

  /* TFTP: glue the DATA blocks back together and show the file that crossed the wire. */
  function showReassembled(packets) {
    var blocks = packets.filter(function (p) { return p.tftp && p.tftp.op === 3 && p.tftp.data; })
      .sort(function (a, b) { return a.tftp.block - b.tftp.block; });
    var slot = document.getElementById('reassembled');
    if (!slot || !blocks.length) return;
    var name = ''; packets.some(function (p) { if (p.tftp && p.tftp.filename) { name = p.tftp.filename; return true; } return false; });
    var total = 0; blocks.forEach(function (p) { total += p.tftp.data.length; });
    var first = blocks[0].tftp.data;
    var type = first[0] === 0xff && first[1] === 0xd8 ? 'image/jpeg' : first[0] === 0x89 && first[1] === 0x50 ? 'image/png' : 'application/octet-stream';
    var url = URL.createObjectURL(new Blob(blocks.map(function (p) { return p.tftp.data; }), { type: type }));
    slot.innerHTML = '<h2>The file, rebuilt from the packets</h2>' +
      '<p>This picture was not stored on this page. It was put back together in your browser from the ' + blocks.length +
      ' DATA blocks below (' + total.toLocaleString() + ' bytes of <code>' + esc(name) + '</code>). Anyone else on the network could have done the same.</p>' +
      (type.indexOf('image/') === 0 ? '<img class="rebuilt" src="' + url + '" alt="File reassembled from TFTP DATA blocks">' :
        '<p><a href="' + url + '" download="' + esc(name) + '">Download the reassembled file</a></p>');
  }

  function wireDetails(box, packets) {
    Array.prototype.forEach.call(box.querySelectorAll('tr.pkt'), function (tr) {
      function toggle() {
        var det = tr.nextElementSibling;
        det.hidden = !det.hidden;
        tr.classList.toggle('open', !det.hidden);
      }
      tr.addEventListener('click', toggle);
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
  }

  /* ---------- routing ---------- */

  function route() {
    stopAnimations();
    stopLiveNetwork();
    var id = location.hash.replace('#', '');
    var idx = -1;
    LESSONS.forEach(function (l, i) { if (l.id === id) idx = i; });
    setActive(idx >= 0 ? id : null);
    if (idx >= 0) renderLesson(LESSONS[idx], idx);
    else renderWelcome();
    document.title = (idx >= 0 ? LESSONS[idx].title + ' - ' : '') + 'Packet Lessons';
  }

  buildMenu();
  buildNav();
  (function () { var c = document.getElementById('net-cidr'); if (c) c.textContent = SITE.labNetwork; })();
  window.rerender = function () { var y = main.scrollTop; route(); main.scrollTop = y; };
  wireLevelBar(document.getElementById('level-bar'));
  window.addEventListener('hashchange', route);
  route();
})();
