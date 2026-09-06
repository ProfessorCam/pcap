/*
 * lessons.js - the teaching content, one object per row in the left column.
 *
 * To add a row: drop a classic .pcap into site/pcaps/, append an object here.
 *
 *   id        short word used in the URL hash (#tcp)
 *   title     big label in the left column
 *   subtitle  one line under the title
 *   file      file name inside site/pcaps/
 *   layer     where the protocol lives in the stack
 *   command   the command that produced the capture (shown to students)
 *   oneLiner  the whole idea in one sentence
 *   sections  [{ h: heading, p: [paragraphs, may contain <b> <code>],
 *               anim: optional key from ANIMATIONS in app.js (a looping
 *               packet-assembly diagram shown after the paragraphs),
 *               after: optional paragraphs shown below the animation }]
 *   actors    [{ name, addr }] columns of the sequence diagram, left to right
 *   steps     [{ from, to, label, dashed }] to: actor index or 'all' (broadcast)
 *   lookFor   bullets pointing at concrete things in the packet table
 */
/* Site settings. labName / labNetwork describe the network the captures were
 * recorded on; the welcome page compares the machine's live addresses against
 * it and uses it for the network, mask and broadcast of the captures section. */
var SITE = {
  image: 'professorcryan/pcap',      /* Docker Hub image of this site; shown with a run command when the live section is unavailable */
  port: 8080,
  labName: 'Lab WiFi',
  labNetwork: '192.168.110.0/23',
  /* DHCP only hands out leases from this part of the subnet; the rest of the
   * /23 (192.168.111.x) is in the same network but is never assigned by DHCP. */
  dhcpScope: '192.168.110.0/24',
  /* Top menu. href null = not built yet (shown greyed out, "coming soon");
   * current: true marks the site you are on. */
  menu: [
    { label: 'Frames & Packets', href: 'https://professorcam.github.io/frames/' },
    { label: 'Protocols', href: '#', current: true },
    { label: 'Encryption and Protocols', href: 'https://professorcam.github.io/encryption/' }
  ]
};

/* Reading levels: any prose entry below may be a plain string (same at every
 * level) or { s: ..., m: ..., e: ... } for Simple / Moderate / Engineer.
 * See level.js. {{row:id}} becomes "row N" when rendered. */

var LESSONS = [
  {
    id: 'arp',
    stack: 2,
    title: 'ARP',
    subtitle: 'Turning an IP address into a MAC address',
    file: 'arp-request-192.168.110.0.pcap',
    layer: {
      s: 'Works only on your own local network, right underneath IP. It never crosses the router.',
      m: 'Layer 2 (Data link). ARP sits directly inside the Ethernet frame (type 0x0806). It never leaves the local network.',
      e: 'Between layers 2 and 3. EtherType 0x0806, 28-byte payload for Ethernet/IPv4 (RFC 826), never routed, padded to the 60-byte Ethernet minimum.'
    },
    command: 'ip neigh flush all; ping 192.168.110.1; ping 192.168.110.77',
    oneLiner: {
      s: 'ARP is how your computer shouts "who has this address?" so it knows which network card to hand the message to.',
      m: 'ARP asks the whole local network "who has this IP address?" so the sender can learn which network card to deliver the frame to.',
      e: 'ARP resolves a next-hop IPv4 address to a MAC address with a broadcast request and a unicast reply, and caches the result per neighbour.'
    },
    sections: [
      { h: 'Two kinds of address', p: [
        { s: 'Your computer has two addresses. The <b>IP address</b> is like a street address: it changes when you move to a different network. The <b>MAC address</b> is like a name stamped on the network card at the factory: it goes wherever the card goes.',
          m: 'Every machine on a network has two addresses. The <b>IP address</b> (like 192.168.110.1) is logical: it is assigned by DHCP or an admin and says where you are in the network. The <b>MAC address</b> (like 00:50:56:c0:00:01) is physical: it is baked into the network card and is what Ethernet actually uses to deliver frames on the local wire.',
          e: 'IPv4 addresses are logical, assigned by DHCP or configuration, and are what routing works on. MAC addresses are 48-bit link-layer identifiers, and Ethernet delivers frames by MAC only. ARP (RFC 826) maps a next-hop IPv4 address to a MAC address within one broadcast domain.' },
        { s: 'Programs use IP addresses. The cable and the switch only understand MAC addresses. <b>ARP</b> is the translator between the two.',
          m: 'Applications think in IP addresses. Ethernet only understands MAC addresses. Something has to translate between them, and that is <b>ARP</b>, the Address Resolution Protocol.',
          e: '' }
      ]},
      { h: 'How ARP works', p: [
        { s: '1. Your computer asks everyone on the network at once: "Who has 192.168.110.1? Tell 192.168.110.50." In plain words: "which card do I send this to?"',
          m: '1. The sender broadcasts to every machine on the LAN (destination MAC ff:ff:ff:ff:ff:ff): "<b>Who has</b> 192.168.110.1? <b>Tell</b> 192.168.110.50."',
          e: '1. Request: opcode 1, sender MAC and IP filled in, target MAC 00:00:00:00:00:00, target IP 192.168.110.1, Ethernet destination ff:ff:ff:ff:ff:ff.' },
        { s: '2. Only the owner of that address answers, straight back: "That is me, and here is my card number."',
          m: '2. Only the owner of that IP answers, directly to the asker: "192.168.110.1 <b>is at</b> 00:50:56:c0:00:01."',
          e: '2. Reply: opcode 2, unicast to the requester, with the sender fields carrying the answer: 192.168.110.1 is-at 00:50:56:c0:00:01.' },
        { s: '3. Your computer writes the answer in a small list, the <b>ARP cache</b>, so it does not have to ask again for a while.',
          m: '3. The sender stores the answer in its <b>ARP cache</b> for a few minutes so it does not have to ask again for every packet. You can view the cache with <code>ip neigh</code> on Linux or <code>arp -a</code> on Windows.',
          e: '3. The requester stores the mapping in its neighbour cache (<code>ip neigh</code>, <code>arp -a</code>). Linux keeps an entry REACHABLE for a randomised 15 to 45 s, then re-confirms it with a unicast probe before falling back to broadcast.' },
        'Here is what one request looks like on the wire. Compare it with the ping packet in {{row:ping}}: something is missing.'
      ], anim: 'arp-request' },
      { h: 'ARP and the wider internet', p: [
        { s: 'ARP only works on your own network. To reach something far away, your computer asks for the <b>router</b>\'s card instead and hands the message to the router. That is what packet 1 is doing: finding the router.',
          m: 'ARP only works on the local network. When you send to an address outside it, your computer does not ARP for the far-away host. It ARPs for the <b>gateway</b> (the router) and hands the frame to the router\'s MAC, and the router takes it from there. That is exactly what packet 1 does: it looks up the gateway.',
          e: 'ARP is never sent for an off-link destination. The host consults its routing table, picks the next hop (here the default gateway 192.168.110.1) and resolves that address; the frame goes to the gateway MAC while the IP destination stays the far host. Packet 1 is that gateway lookup.' }
      ]},
      { h: 'When nobody answers, and when nobody asked', p: [
        { s: 'Packets 3 and 4 ask about 192.168.110.77 twice and nobody answers, because no machine has that address. That is what makes ping print "Destination Host Unreachable".',
          m: 'Packets 3 and 4 ask for 192.168.110.77 twice, a second apart, and never get a reply. No machine has that address. This is what produces the "Destination Host Unreachable" message from ping.',
          e: 'Packets 3 and 4: two requests for 192.168.110.77 about 1 s apart with no reply. The kernel sends a few probes, marks the neighbour entry FAILED, and ping reports Destination Host Unreachable.' },
        { s: 'Packet 5 is a machine announcing its own address without being asked, like saying "hello, I am here" to the whole room. Machines do that when they start up.',
          m: 'Packet 5 is a <b>gratuitous ARP</b>: a machine (192.168.110.65) announces its own address without being asked. The sender IP and target IP are the same. Machines do this when they boot or change address so everyone can update their caches, and to detect if someone else already uses that IP.',
          e: 'Packet 5 is a gratuitous ARP from 192.168.110.65: opcode 1, broadcast, sender IP equal to target IP. It refreshes neighbour caches after boot or an address change and doubles as duplicate detection (RFC 5227 formalises the probe/announce sequence).' }
      ]}
    ],
    actors: [{ name: 'Student VM', addr: '192.168.110.50' }, { name: 'Gateway', addr: '192.168.110.1' }, { name: 'Other host', addr: '192.168.110.65' }],
    steps: [
      { from: 0, to: 'all', label: 'Who has .1? Tell .50   (broadcast)' },
      { from: 1, to: 0, label: '.1 is at 00:50:56:c0:00:01' },
      { from: 0, to: 'all', label: 'Who has .77? Tell .50   (no answer)' },
      { from: 0, to: 'all', label: 'Who has .77? Tell .50   (retry, no answer)' },
      { from: 2, to: 'all', label: 'Gratuitous: .65 is at 3c:22:fb:8e:04:d7' }
    ],
    lookFor: [
      { s: 'The Source and Destination columns show card numbers (MAC addresses), not IP addresses. ARP works underneath IP.',
        m: 'The Source and Destination columns show MAC addresses, not IPs. ARP lives below IP.',
        e: 'Source and Destination are MAC addresses: there is no IP header, and the EtherType is 0x0806.' },
      { s: 'Requests go to everyone (the all-f address). The reply in packet 2 goes straight back to the asker.',
        m: 'Requests go to ff:ff:ff:ff:ff:ff (broadcast). The reply in packet 2 goes straight back to the asker.',
        e: 'Requests are broadcast to ff:ff:ff:ff:ff:ff; the reply in packet 2 is unicast to the requester\'s MAC.' },
      { s: 'Open packet 1: the target card number is all zeros, because that is the blank being asked about.',
        m: 'Open packet 1: the Target MAC is 00:00:00:00:00:00, because that is the thing being asked for.',
        e: 'Packet 1: target hardware address 00:00:00:00:00:00, opcode 1. Packet 2: opcode 2 with the sender fields swapped and filled in.' },
      'Packet 2 arrives 0.3 ms after packet 1. That is how fast a LAN answers.',
      'Packets 3 and 4 have no reply. Look at the timestamps: about one second apart, a retry.',
      { s: 'Packet 5 comes from a different card and asks about its own address: an announcement, not a question.',
        m: 'Packet 5 comes from a different MAC and has sender IP equal to target IP: a gratuitous ARP.',
        e: 'Packet 5: sender IP equals target IP (192.168.110.65), source MAC 3c:22:fb:8e:04:d7, broadcast: a gratuitous ARP.' },
      { s: 'Every frame is 60 bytes. An ARP message is smaller than that, so it is padded out to the smallest size a frame is allowed to be.',
        m: 'Every frame is 60 bytes. ARP is smaller than that, so Ethernet pads it to the minimum frame size.',
        e: '60 bytes captured: 14 Ethernet + 28 ARP + 18 bytes of padding to the 64-byte minimum (the 4-byte FCS is not captured).' }
    ]
  },

  {
    id: 'ping',
    stack: 3,
    title: 'Ping',
    subtitle: 'ICMP echo request and reply',
    file: 'icmp-echo-192.168.110.1.pcap',
    layer: {
      s: 'Lives inside IP itself, one level below the "ports" that web pages and games use.',
      m: 'Layer 3 (Network). ICMP rides directly inside IP. There are no port numbers.',
      e: 'Layer 3. ICMP (RFC 792) is IP protocol 1, carried directly in the IPv4 payload: no transport header, no ports.'
    },
    command: 'ping -c 4 192.168.110.1',
    oneLiner: {
      s: 'Ping sends a tiny "are you there?" to another computer and times how long the answer takes to come back.',
      m: 'Ping shouts "are you there?" at another computer and times how long the answer takes to come back.',
      e: 'Ping sends ICMP Echo Requests (type 8) and measures the round-trip time to the matching Echo Replies (type 0).'
    },
    sections: [
      { h: 'What is ping?', p: [
        { s: 'Ping is the simplest network test there is. Your computer sends a tiny message and the other machine sends it straight back. If it comes back, the other machine is switched on and there is a working path there and back.',
          m: 'Ping is the oldest and simplest network test. Your computer sends a tiny message to another machine and waits for it to be sent straight back. If the answer arrives, you know two things: the other machine is alive, and there is a working path to it and back.',
          e: 'Ping sends an ICMP Echo Request and waits for the Echo Reply. A reply proves the host is up and that a forward and a return path exist at layer 3; it says nothing about whether any service on the host works.' },
        { s: 'The time it takes to come back is the <b>round-trip time</b>. On your own network it is a tiny fraction of a second. Across the internet it is noticeably longer.',
          m: 'The time between sending and receiving is the <b>round-trip time</b> (RTT). On a local network it is well under a millisecond. Across the internet it is tens or hundreds of milliseconds.',
          e: 'The RTT is measured from the send timestamp, usually carried in the payload, to the reply\'s arrival: sub-millisecond on a LAN, tens to hundreds of milliseconds across the internet.' }
      ]},
      { h: 'The protocol underneath: ICMP', p: [
        { s: 'Ping uses a small helper protocol called <b>ICMP</b> that is built right into IP. It carries short messages such as "that address cannot be reached" and the two ping messages: the request and the reply.',
          m: 'Ping uses <b>ICMP</b>, the Internet Control Message Protocol. ICMP is the messaging system built into IP for errors and diagnostics: "host unreachable", "time exceeded", and the two ping messages, <b>Echo Request</b> (type 8) and <b>Echo Reply</b> (type 0).',
          e: 'ICMP (RFC 792) is IP protocol 1. Echo Request is type 8 code 0, Echo Reply type 0 code 0. The 8-byte header holds type, code, checksum, identifier and sequence number, followed by arbitrary data the reply must echo unchanged.' },
        { s: 'Watch one ping packet being built. Notice that there is no layer for port numbers at all.',
          m: 'Watch one ping packet being built, layer by layer. Notice what is missing: there is no TCP or UDP header at all.',
          e: 'Watch the packet being built: there is no layer 4 header between IP and ICMP.' }
      ], anim: 'icmp-assembly', after: [
        { s: 'ICMP sits right inside IP, so ping has no ports and no connection to set up. Each ping is one message sent on its own.',
          m: 'ICMP sits directly inside the IP packet, so there are no port numbers and no connection to set up. Each ping is a single, independent packet, built exactly like this and sent on its own.',
          e: 'With no ports, the identifier (normally the process ID) is what lets the OS hand the reply to the right ping process. Each request is an independent datagram; nothing is set up or torn down.' }
      ]},
      { h: 'How one ping works', p: [
        { s: '1. Your computer sends a request with a run number (1, 2, 3, ...) and some filler.',
          m: '1. The sender builds an Echo Request containing an <b>identifier</b> (the same for every ping in one run of the command), a <b>sequence number</b> (1, 2, 3, ...) and some filler data.',
          e: '1. Echo Request: identifier fixed per ping process (6699 here), sequence number incrementing from 1, 56 bytes of payload (the Linux default), giving 64 bytes of ICMP.' },
        { s: '2. The other machine copies the message and sends it straight back.',
          m: '2. The target receives it and sends back an Echo Reply with exactly the same identifier, sequence number and data.',
          e: '2. The target swaps source and destination, sets type 0, recomputes the checksum and echoes identifier, sequence and payload verbatim.' },
        { s: '3. Your computer matches the answer to the question by the run number and prints how long it took. If an answer never comes, that counts as a lost packet.',
          m: '3. The sender matches the reply to its request using those numbers, and prints the time it took. If no reply arrives, that sequence number is counted as <b>packet loss</b>.',
          e: '3. The sender matches by identifier and sequence and prints the RTT; a sequence with no reply before the deadline is reported as loss.' }
      ]},
      { h: 'Why it matters', p: [
        { s: 'Ping is the first thing to try when something "is not working". It tells you whether the other machine can be reached at all, and how slow the path to it is.',
          m: 'Ping is the first thing to try when "the network is down". It separates "the machine is off or unreachable" from "the machine is up but the service is broken". It also measures latency and reveals packet loss, which is why game players and network engineers both care about it.',
          e: 'Ping isolates reachability and latency from application faults and exposes loss and jitter. Firewalls often drop ICMP, so no reply is not proof that a host is down.' }
      ]}
    ],
    actors: [{ name: 'Student VM', addr: '192.168.110.50' }, { name: 'Gateway', addr: '192.168.110.1' }],
    steps: [
      { from: 0, to: 1, label: 'Echo request  seq=1' },
      { from: 1, to: 0, label: 'Echo reply  seq=1' },
      { from: 0, to: 1, label: 'Echo request  seq=2  (1 s later)' },
      { from: 1, to: 0, label: 'Echo reply  seq=2' },
      { from: 0, to: 1, label: 'Echo request  seq=3' },
      { from: 1, to: 0, label: 'Echo reply  seq=3' },
      { from: 0, to: 1, label: 'Echo request  seq=4' },
      { from: 1, to: 0, label: 'Echo reply  seq=4' }
    ],
    lookFor: [
      'Packets come in pairs: a request from .50 followed almost instantly by a reply from .1.',
      { s: 'The same identifier is in every packet, and the run number counts 1, 2, 3, 4.',
        m: 'The identifier is 6699 in every packet, and the sequence number counts 1, 2, 3, 4.',
        e: 'Identifier 6699 in every packet; sequence 1 to 4. The reply repeats both, which is how the sender pairs them up.' },
      'Requests are exactly one second apart. That is the default ping interval.',
      'Each reply lands about 0.4 ms after its request. That gap is the round-trip time ping prints.',
      { s: 'Every frame is 98 bytes: the four layers added together.',
        m: 'Every frame is 98 bytes: 14 Ethernet + 20 IP + 8 ICMP + 56 bytes of filler data.',
        e: '98 bytes per frame: 14 Ethernet + 20 IPv4 (total length 84, TTL 64, protocol 1) + 8 ICMP + 56 bytes of payload.' },
      { s: 'Click a packet and open the ICMP section: the request says type 8, the reply says type 0.',
        m: 'Click a packet and open the ICMP section to compare the request (type 8) with the reply (type 0).',
        e: 'Open the ICMP section: type 8/code 0 out, type 0/code 0 back, checksum recomputed, payload identical.' }
    ]
  },

  {
    id: 'udp',
    stack: 4,
    title: 'UDP',
    subtitle: 'DHCP: getting an IP address (Discover, Offer, Request, ACK)',
    file: 'dhcp-dora-192.168.110.50.pcap',
    layer: {
      s: 'UDP is the "send it and hope" way of delivering messages. DHCP, the thing that gives your computer its address, uses it.',
      m: 'Layer 4 (Transport) for UDP, carrying DHCP, a Layer 7 application protocol, on ports 67 and 68.',
      e: 'Layer 4: UDP (RFC 768), IP protocol 17, 8-byte header. DHCP (RFC 2131) is the layer 7 payload: server port 67, client port 68.'
    },
    command: 'dhclient -v eth0   (or simply plugging in the network cable)',
    oneLiner: {
      s: 'UDP is like a postcard: you send it and hope it arrives. DHCP uses it to hand a new computer its address.',
      m: 'UDP is the "postcard" protocol: send a message and hope. DHCP uses it to hand a new computer its IP address.',
      e: 'UDP is a connectionless, unreliable datagram service that adds only ports and a checksum to IP; DHCP uses it because a client with no address cannot do anything more.'
    },
    sections: [
      { h: 'What is UDP?', p: [
        { s: '<b>UDP</b> is the simplest way to send a message to a program on another computer. Each message goes on its own. Nothing is set up first, nobody confirms it arrived, and nothing is sent again if it got lost.',
          m: '<b>UDP</b>, the User Datagram Protocol, is the simplest way to send data to a program on another computer. Each message (a <b>datagram</b>) is sent on its own. There is no connection to set up first, no acknowledgement that it arrived, and no retry if it was lost.',
          e: 'UDP (RFC 768) adds four 16-bit fields to IP: source port, destination port, length and checksum. No connection state, no acknowledgement, no retransmission, no ordering; each datagram is independent and delivery is best effort.' },
        { s: 'Think of a postcard: cheap and quick, but nobody tells you if it got lost in the mail.',
          m: 'Its header is only 8 bytes: source port, destination port, length and a checksum. Think of a postcard: cheap and quick, but nobody tells you if it got lost in the mail.',
          e: '' }
      ]},
      { h: 'Why would anyone want that?', p: [
        { s: 'Because it is fast. For a quick question with a quick answer, the program can just ask again if nothing comes back. For voice calls and games a late message is useless anyway, so waiting to resend it makes no sense.',
          m: 'Because it is fast and light. For a single question with a single answer (DNS, DHCP) the application can simply ask again if nothing comes back. For voice, video and games, a late packet is useless anyway, so there is no point waiting for retransmissions.',
          e: 'One-request, one-response protocols (DNS, DHCP, NTP) handle their own retry cheaply. Real-time media and QUIC prefer loss to head-of-line blocking, and a server holds no per-client state.' },
        { s: 'Compare this with TCP in {{row:tcp}}, which checks everything but needs more packets to do it.',
          m: 'Compare this with TCP in {{row:tcp}}, which does all the bookkeeping for you at the cost of extra packets.',
          e: 'Compare TCP in {{row:tcp}}: a handshake before the first byte and an ACK stream afterwards.' }
      ]},
      { h: 'DHCP: the four-step DORA dance', p: [
        { s: 'When a computer joins a network it has no address at all. <b>DHCP</b> gives it one in four messages, remembered as <b>DORA</b>:',
          m: 'When a computer joins a network it has no IP address at all. <b>DHCP</b> (Dynamic Host Configuration Protocol) fixes that with four UDP messages, remembered as <b>DORA</b>:',
          e: 'DHCP (RFC 2131) uses BOOTP-format messages; option 53 carries the message type:' },
        { s: '1. <b>Discover</b>: the new computer shouts to everyone "is there anyone here who hands out addresses?"',
          m: '1. <b>Discover</b>: the client shouts to everyone (broadcast) "is there a DHCP server out there?" Its source IP is 0.0.0.0 because it has none yet.',
          e: '1. DHCPDISCOVER: broadcast from 0.0.0.0:68 to 255.255.255.255:67, xid chosen by the client, its MAC in chaddr, option 55 listing the parameters it wants (mask, router, DNS, domain, broadcast, NTP, static routes here).' },
        { s: '2. <b>Offer</b>: a server answers "you can have 192.168.110.50, and here are the router and the name server to use".',
          m: '2. <b>Offer</b>: a server answers "you can have 192.168.110.50, here is the subnet mask, gateway and DNS servers".',
          e: '2. DHCPOFFER: yiaddr 192.168.110.50, server identifier (option 54) 192.168.110.1, lease 86400 s with T1 43200 s and T2 75600 s, mask 255.255.254.0, router, two DNS servers, domain lab.local.' },
        { s: '3. <b>Request</b>: the computer shouts again "yes please, I will take that one", so any other server knows to stop.',
          m: '3. <b>Request</b>: the client broadcasts again, "yes please, I will take 192.168.110.50 from server 192.168.110.1", so any other servers know to back off.',
          e: '3. DHCPREQUEST: broadcast again with option 50 (requested IP) and option 54 naming the chosen server, so any other servers withdraw their offers.' },
        { s: '4. <b>ACK</b>: the server says "it is yours" and starts a timer. When the timer runs out the computer has to ask to keep it.',
          m: '4. <b>ACK</b>: the server confirms and starts the <b>lease</b> timer. The client can now use the address.',
          e: '4. DHCPACK: the binding is committed and the lease clock starts. Renewal at T1 is unicast to the server; at T2 the client broadcasts to any server.' }
      ]},
      { h: 'Why DHCP has to use UDP', p: [
        { s: 'The new computer has no address and does not know where the server is. It cannot start a proper two-way conversation with someone it cannot name. Shouting to everyone with UDP is the only thing that works.',
          m: 'The client has no IP address and does not know where the server is. It cannot open a TCP connection to an unknown address. A broadcast UDP datagram to 255.255.255.255 is the only tool that works with no configuration at all.',
          e: 'With no address and no known server, the client can neither complete a TCP handshake nor unicast. A UDP datagram from 0.0.0.0 to the limited broadcast 255.255.255.255 in a frame to ff:ff:ff:ff:ff:ff needs no configuration; relay agents (giaddr, option 82) carry it across routers.' },
        { s: 'Watch the Discover message being built. Every layer has the same problem, "I have no address and I do not know who I am talking to", and every layer solves it the same way: send it to everybody.',
          m: 'Watch the Discover packet being built. Every layer has the same problem, "I do not know who I am talking to, and I have no address of my own", and each solves it the same way: broadcast.',
          e: 'Watch the Discover being built: every layer has to fall back on its broadcast or null address.' }
      ], anim: 'dhcp-discover', after: [
        { s: 'After the ACK the computer double-checks that nobody else is already using the address, using ARP ({{row:arp}}). Those are the last two packets in this capture.',
          m: 'After the ACK, the client uses ARP ({{row:arp}}) to probe whether anyone else already has the address, then announces it. You can see both ARP packets at the end of this capture.',
          e: 'After the ACK the client sends an ARP probe for 192.168.110.50 (duplicate address detection, RFC 5227) and then a gratuitous ARP announcing it ({{row:arp}}): packets 5 and 6.' }
      ]}
    ],
    actors: [{ name: 'New client', addr: 'no IP yet (0.0.0.0)' }, { name: 'DHCP server', addr: '192.168.110.1' }],
    steps: [
      { from: 0, to: 'all', label: 'DISCOVER  "any DHCP servers?"' },
      { from: 1, to: 'all', label: 'OFFER  "take 192.168.110.50"' },
      { from: 0, to: 'all', label: 'REQUEST  "yes, I want 192.168.110.50"' },
      { from: 1, to: 'all', label: 'ACK  "it is yours for 24 hours"' },
      { from: 0, to: 'all', label: 'ARP probe: anyone using .50?', dashed: true },
      { from: 0, to: 'all', label: 'Gratuitous ARP: .50 is me', dashed: true }
    ],
    lookFor: [
      { s: 'Packets 1 and 3 come from address 0.0.0.0, which means "I have no address yet".',
        m: 'Packets 1 and 3 come from source IP 0.0.0.0: the client really has no address yet.',
        e: 'Packets 1 and 3: source 0.0.0.0:68, the broadcast flag set in the BOOTP header, TTL 255.' },
      { s: 'Every DHCP packet is sent to everybody on the network, at both the IP and the card-number level.',
        m: 'Every DHCP packet goes to 255.255.255.255 and MAC ff:ff:ff:ff:ff:ff. That is a broadcast: every machine on the LAN hears it.',
        e: 'All four messages go to 255.255.255.255 / ff:ff:ff:ff:ff:ff, including the server\'s, because the client set the broadcast flag.' },
      { s: 'The same transaction number appears in all four messages. That is how the computer knows which answers belong to its question.',
        m: 'The transaction ID 0x3d1f7a44 is identical in all four messages. That is how the client matches answers to its question.',
        e: 'xid 0x3d1f7a44 in all four messages; the Request also carries secs 1.' },
      { s: 'Open packet 2 to see the address on offer, how long it may be kept (24 hours), and which router and name servers to use.',
        m: 'Open packet 2 (Offer): "Your IP" is 192.168.110.50, lease 86400 seconds (24 hours), mask 255.255.254.0, gateway 192.168.110.1, DNS 192.168.110.1 and 9.9.9.9.',
        e: 'Packet 2 options: 53 Offer, 54 server 192.168.110.1, 51 lease 86400, 58 renewal 43200, 59 rebinding 75600, 1 mask 255.255.254.0, 3 router, 6 DNS 192.168.110.1 and 9.9.9.9, 15 domain lab.local.' },
      { s: 'The mask means the network is bigger than the addresses the server hands out: 192.168.111.x addresses are on the same network but must be set by hand.',
        m: 'The mask 255.255.254.0 is a /23: the subnet runs from 192.168.110.0 to 192.168.111.255. The DHCP server only hands out leases from the 192.168.110.x half; 192.168.111.x addresses are on the same network but must be set by hand.',
        e: 'Mask 255.255.254.0 = /23, 192.168.110.0 to 192.168.111.255. The DHCP scope covers only 192.168.110.0/24; the other half is static.' },
      'Ports: the client always uses 68 and the server 67.',
      { s: 'The whole exchange takes a few thousandths of a second. Packets 5 and 6 are the computer checking that nobody else owns its new address.',
        m: 'The whole DORA exchange takes under 7 ms. Packets 5 and 6 are ARP, the client checking that nobody else owns .50.',
        e: 'DORA completes in under 7 ms. Packets 5 and 6: ARP probe (sender IP 0.0.0.0) then gratuitous ARP for 192.168.110.50.' }
    ]
  },

  {
    id: 'tcp',
    stack: 4,
    title: 'TCP',
    subtitle: 'The three-way handshake (and the four-way goodbye)',
    file: 'tcp-handshake-192.168.110.1.pcap',
    layer: {
      s: 'Sits on top of IP and adds ports, so the message reaches the right program, and checking, so nothing gets lost.',
      m: 'Layer 4 (Transport). TCP runs on top of IP and adds port numbers, reliability and ordering.',
      e: 'Layer 4: TCP (RFC 9293), IP protocol 6, 20-byte header plus options. A connection-oriented, reliable, ordered byte stream with flow and congestion control.'
    },
    command: 'nc -z 192.168.110.1 80   (connect to port 80, then close without sending anything)',
    oneLiner: {
      s: 'TCP is like a phone call: both sides say hello before anything is said, and every piece is numbered and confirmed.',
      m: 'TCP is the "phone call" protocol: both sides agree to talk before any data is sent, and every byte is numbered and confirmed.',
      e: 'TCP opens a connection with a three-way handshake, numbers every byte, acknowledges what arrived and retransmits what did not.'
    },
    sections: [
      { h: 'What is TCP?', p: [
        { s: '<b>TCP</b> carries most of what you do online: web pages, email, downloads. Unlike UDP it makes sure everything arrives, in order. Every piece gets a number, the receiver reports which numbers it has, and anything missing is sent again.',
          m: '<b>TCP</b>, the Transmission Control Protocol, carries most of what you do online: web pages, email, file downloads, SSH. Unlike UDP it is <b>reliable</b> and <b>ordered</b>: every byte gets a <b>sequence number</b>, the receiver sends back <b>acknowledgements</b> (ACKs) saying how far it has got, and anything missing is sent again.',
          e: 'TCP (RFC 9293) provides a reliable, ordered byte stream over IP. Every byte has a sequence number; the receiver returns cumulative ACKs (plus SACK blocks) and the sender retransmits on timeout or duplicate ACKs. The receive window throttles the sender, and congestion control throttles it further.' },
        { s: 'Before any data is sent, both sides agree to talk. That is the three-way handshake, and it is what this capture shows.',
          m: 'Before any data flows, the two sides must set up a <b>connection</b>. That is the three-way handshake, and it is what this capture shows.',
          e: 'A connection must be established before data flows: the three-way handshake in this capture.' }
      ]},
      { h: 'The three-way handshake', p: [
        { s: '1. <b>SYN</b>: "Hello, I want to talk to your web server. I will number my pieces starting here."',
          m: '1. <b>SYN</b>: the client says "I want to talk to port 80. My sequence numbers start at X." (SYN stands for synchronise.)',
          e: '1. SYN: flags [S], client ISN 3231822531, options MSS 1460, SACK permitted, timestamps, window scale 7, window 64240.' },
        { s: '2. <b>SYN, ACK</b>: "Hello back. I got yours, and here is where my numbers start."',
          m: '2. <b>SYN, ACK</b>: the server replies "OK. My numbers start at Y, and I have received up to X+1."',
          e: '2. SYN-ACK: flags [S.], server ISN 1564376848, ack 3231822532 (client ISN + 1), its own options, window 65535.' },
        { s: '3. <b>ACK</b>: "Got it." Now both sides know each other\'s numbers and can send.',
          m: '3. <b>ACK</b>: the client says "Got it, I have received up to Y+1." The connection is now open in both directions.',
          e: '3. ACK: flags [.], ack = server ISN + 1. Both ends are ESTABLISHED; the client may already carry data on this segment.' },
        { s: 'Here is the first of those three packets being built. Watch where the <b>port numbers</b> go: they are TCP\'s job, not IP\'s and not Ethernet\'s.',
          m: 'Here is the first of those three packets being built. Watch where the <b>port numbers</b> go: they are not in IP and not in Ethernet, they are TCP\'s job.',
          e: 'Here is the SYN being built. Ports live in the TCP header, not in IP or Ethernet.' }
      ], anim: 'tcp-syn', after: [
        { s: 'The first two packets also carry a few settings, such as the biggest chunk each side can accept.',
          m: 'Both sides also advertise options in the SYN packets: the biggest chunk they can accept (<b>MSS</b>), how much data they can buffer (<b>window size</b>) and whether they support selective acknowledgements (<b>SACK</b>).',
          e: 'SYN options negotiate MSS (1460, matching 1500-byte frames), window scaling (shift 7, so advertised windows are multiplied by 128 after the handshake), SACK, and timestamps for RTT measurement and PAWS. Options are only exchanged in SYN segments.' }
      ]},
      { h: 'Reading sequence numbers', p: [
        { s: 'The real starting numbers are big random values. Wireshark and this page count from zero instead, so the handshake reads 0, then 0 and 1, then 1 and 1. Saying hello uses up one number, which is why the first "got it" says 1 even though nothing was sent yet.',
          m: 'The real starting numbers are random (open a packet to see the raw values). Wireshark and this page show them <b>relative</b> to the start, so the handshake reads Seq=0, then Seq=0 Ack=1, then Seq=1 Ack=1. The SYN flag counts as one byte, which is why the first ACK says 1 even though no data was sent.',
          e: 'ISNs are randomised (RFC 6528); Wireshark shows relative numbers by default. SYN and FIN each occupy one sequence number, so the handshake reads Seq=0, Seq=0 Ack=1, Seq=1 Ack=1, and the close ends with Ack=2.' }
      ]},
      { h: 'Closing politely: the four-way goodbye', p: [
        { s: 'Each side says "I am done" with a <b>FIN</b>, and the other side confirms. That takes four packets: numbers 4 to 7 here.',
          m: 'Each side closes its own direction with a <b>FIN</b> (finish), and the other side ACKs it. Client FIN, server ACK, server FIN, client ACK. That is packets 4 to 7 here. Just like the SYN, a FIN uses up one sequence number, so the numbers tick up by one again.',
          e: 'Each direction closes separately: client FIN (FIN_WAIT_1), server ACK (CLOSE_WAIT), server FIN (LAST_ACK), client ACK, after which the client sits in TIME_WAIT for 2 MSL. Packets 4 to 7. A FIN consumes one sequence number, hence Ack=2.' },
        { s: 'A rude way to end is a <b>RST</b> (reset), which hangs up in one packet. There is none in this capture.',
          m: 'A rude close is an <b>RST</b> (reset), which slams the connection shut in a single packet. You will not see one in this capture.',
          e: 'RST aborts a connection in one segment with no acknowledgement; none appears here.' }
      ]}
    ],
    actors: [{ name: 'Client', addr: '192.168.110.50 : 49832' }, { name: 'Server', addr: '192.168.110.1 : 80' }],
    steps: [
      { from: 0, to: 1, label: 'SYN  Seq=0' },
      { from: 1, to: 0, label: 'SYN, ACK  Seq=0 Ack=1' },
      { from: 0, to: 1, label: 'ACK  Seq=1 Ack=1   (connected)' },
      { from: 0, to: 1, label: 'FIN, ACK  "I am done sending"' },
      { from: 1, to: 0, label: 'ACK' },
      { from: 1, to: 0, label: 'FIN, ACK  "so am I"' },
      { from: 0, to: 1, label: 'ACK   (closed)' }
    ],
    lookFor: [
      { s: 'Packets 1, 2, 3 are the hello: SYN, then SYN and ACK, then ACK. All three happen in well under a thousandth of a second.',
        m: 'Packets 1, 2, 3 are the handshake: [SYN], [SYN, ACK], [ACK]. All three happen within 0.4 ms.',
        e: 'Packets 1 to 3: [S], [S.], [.] within 0.4 ms. Raw ISNs 3231822531 and 1564376848; Wireshark shows them as 0.' },
      { s: 'The client made up a random high port number (49832) to talk from. The server listens on the well-known web port, 80.',
        m: 'The client picked a random high port (49832) to talk from. The server listens on the well-known port 80.',
        e: 'Client ephemeral port 49832, server port 80. The 4-tuple identifies the connection for both hosts.' },
      { s: 'Open packet 1 to see the settings the client proposed; packet 2 has the server\'s.',
        m: 'Open packet 1: MSS=1460, window 64240, window scale 7, SACK permitted. Open packet 2 to see the server offer its own values.',
        e: 'Packet 1 options: MSS 1460, SACK permitted, timestamps, wscale 7, window 64240. Packet 2: same option set, window 65535. Packet 3 onwards: timestamps only, window 502 (scaled).' },
      { s: 'In packet 3 both counters read 1: each side used up one number by saying hello.',
        m: 'Seq and Ack in packet 3 are both 1: each side has "used up" one number for its SYN.',
        e: 'Packet 3: Seq=1 Ack=1 relative; the SYN consumed one sequence number in each direction.' },
      'Len=0 on every packet. No application data was ever sent; this was a pure connect-and-close.',
      { s: 'Packets 4 to 7 are the goodbye. The counters tick up by one again, because saying goodbye uses a number too.',
        m: 'Packets 4 to 7 are the close. Notice Ack=2 after the FIN: the FIN consumed a sequence number too.',
        e: 'Packets 4 to 7: [F.] from the client, [.] ack 2, [F.] from the server, [.] ack 2. Both FINs consumed a sequence number.' }
    ]
  },

  {
    id: 'dns',
    stack: 7,
    title: 'DNS',
    subtitle: 'Looking up an A record for littletonpublicschools.net',
    file: 'dns-a-littletonpublicschools.net.pcap',
    layer: {
      s: 'A program-level conversation: one question and one answer, sent with UDP.',
      m: 'Layer 7 (Application), carried by UDP on port 53. The internet\'s phone book.',
      e: 'Layer 7: DNS (RFC 1035) over UDP port 53; TCP for truncated responses and zone transfers.'
    },
    command: 'dig A littletonpublicschools.net   (or nslookup littletonpublicschools.net)',
    oneLiner: {
      s: 'DNS is the internet\'s phone book: it turns a name you can remember into the number packets need.',
      m: 'DNS turns a name people can remember into the IP address packets actually need.',
      e: 'DNS resolves names to resource records through a recursive resolver that walks the delegation tree; this capture shows only the stub query and the final answer.'
    },
    sections: [
      { h: 'What is DNS?', p: [
        { s: 'Every message on the internet is addressed with numbers, but nobody wants to remember 34.238.178.141. The <b>Domain Name System</b> is a world-wide phone book that turns names like <code>littletonpublicschools.net</code> into numbers.',
          m: 'Every packet on the internet is addressed with numbers, but nobody wants to type 34.238.178.141 to reach their school\'s website. The <b>Domain Name System</b> is a world-wide, distributed phone book that maps names like <code>littletonpublicschools.net</code> to addresses.',
          e: 'DNS (RFC 1035) is a distributed, hierarchical database of resource records keyed by name, type and class.' },
        { s: 'Your computer does not search the whole book itself. It asks a helper, the <b>resolver</b>, whose address it was given by DHCP ({{row:udp}}). Here that helper is the gateway.',
          m: 'Your computer does not search that phone book itself. It asks a <b>resolver</b>, the DNS server it was given by DHCP ({{row:udp}}). In this lab that is the gateway, 192.168.110.1.',
          e: 'The stub resolver on the host sends the query to a recursive resolver learned from DHCP ({{row:udp}}), here 192.168.110.1, which does the iterative work and caches the results.' }
      ]},
      { h: 'How one lookup works', p: [
        { s: '1. Your computer asks the resolver: "what number goes with littletonpublicschools.net?"',
          m: '1. Your computer sends a <b>query</b> to the resolver: "What is the <b>A record</b> for littletonpublicschools.net?" An A record is the IPv4 address of a name.',
          e: '1. Query: ID 0x5a3c, RD set, one question: littletonpublicschools.net, type A, class IN.' },
        { s: '2. If the resolver already knows, it answers at once. If not, it asks the servers at the top of the tree, which point it further down, step by step, until it reaches the server that holds the answer. None of that asking-around is in this capture: only the question and the final answer.',
          m: '2. If the resolver already knows (it has the answer <b>cached</b>), it replies straight away. If not, it works its way down the tree: it asks a <b>root</b> server, which points it to the <b>.net</b> servers, which point it to the school district\'s own name servers, which finally hold the answer. This chasing is called <b>recursion</b> and is not visible in this capture; only the question and the final answer are.',
          e: '2. On a cache miss the resolver iterates: the root servers refer it to the .net servers, which refer it to the zone\'s authoritative servers, which answer. Only the stub query and the final response cross this LAN.' },
        { s: '3. The answer comes back with the question repeated and the number attached.',
          m: '3. The <b>response</b> comes back with the same transaction ID as the query, the original question repeated, and an <b>answer section</b> containing the record.',
          e: '3. Response: same ID, QR=1, RA set, the question repeated, and an answer section with one A record.' }
      ]},
      { h: 'Record types you will meet', p: [
        { s: 'There are different kinds of entries: the IPv4 number (<b>A</b>), the IPv6 number (<b>AAAA</b>), "this name is a nickname for that one" (<b>CNAME</b>), and where to deliver email (<b>MX</b>).',
          m: '<b>A</b>: IPv4 address. <b>AAAA</b>: IPv6 address. <b>CNAME</b>: "this name is an alias for that name". <b>MX</b>: where to deliver email for the domain. <b>NS</b>: which servers hold the domain\'s records. <b>TXT</b>: free text, used for things like proving you own a domain.',
          e: 'A (IPv4), AAAA (IPv6), CNAME (alias, followed by the resolver), MX (mail exchangers with preference), NS (delegation), TXT (SPF, DKIM, ownership proofs), PTR (reverse lookups), SOA (zone header and negative-cache TTL).' },
        { s: 'Every answer comes with a time limit, the <b>TTL</b>, saying how long it may be remembered before asking again. Here it is about two hours.',
          m: 'Each record carries a <b>TTL</b> (time to live) in seconds. That is how long the resolver may keep handing out the same answer before it must ask again. The answer here allows 7199 seconds, about two hours.',
          e: 'Each RR carries a TTL in seconds and caches may serve it until it expires: 7199 s here. Negative answers are cached per the SOA minimum (RFC 2308).' }
      ]},
      { h: 'Why DNS uses UDP', p: [
        { s: 'A lookup is one short question and one short answer, so UDP ({{row:udp}}) is perfect: no hello, one message each way. If nothing comes back, ask again.',
          m: 'A lookup is one small question and one small answer, so UDP ({{row:udp}}) is a perfect fit: no handshake, one packet each way. If nothing comes back the client simply asks again. Only for very large answers, or for copying whole zones between servers, does DNS switch to TCP.',
          e: 'One datagram each way, client retry on timeout, no per-client state on the resolver ({{row:udp}}). Responses over 512 bytes, or over the EDNS0 advertised size, set TC and the client retries over TCP; zone transfers always use TCP.' },
        { s: 'Also notice: the question and the answer can be read by anyone on the path. That is why encrypted DNS exists.',
          m: 'Also notice: DNS is plain text. Anyone on the path can see which names you look up. That is why DNS over HTTPS and DNS over TLS exist.',
          e: 'The exchange is cleartext. DNS over TLS (RFC 7858) and DNS over HTTPS (RFC 8484) encrypt it between stub and resolver.' }
      ]}
    ],
    actors: [{ name: 'Student VM', addr: '192.168.110.50' }, { name: 'Resolver', addr: '192.168.110.1 : 53' }, { name: 'Root / .net / school NS', addr: 'the wider internet' }],
    steps: [
      { from: 0, to: 1, label: 'Query 0x5a3c: A littletonpublicschools.net?' },
      { from: 1, to: 2, label: 'asks around if not cached  (not in this capture)', dashed: true },
      { from: 2, to: 1, label: 'A 34.238.178.141, TTL 7199  (not in this capture)', dashed: true },
      { from: 1, to: 0, label: 'Response 0x5a3c: A 34.238.178.141' }
    ],
    lookFor: [
      'Only two packets: one question, one answer. That is the whole lookup.',
      { s: 'The same number tag appears in both packets, so the computer can match the answer to its question.',
        m: 'The transaction ID 0x5a3c appears in both. The client uses it to match the answer to the question it asked.',
        e: 'Transaction ID 0x5a3c in both; the response has QR=1 and RA=1 and repeats the question section.' },
      { s: 'The question goes to port 53, the name-server port, from a random port on the computer. The answer comes back to that same port.',
        m: 'The query goes to port 53 from a random high port (41207). The answer comes back from 53 to that same high port.',
        e: 'Query from ephemeral port 41207 to 53; response from 53 back to 41207. Source-port randomisation is part of cache-poisoning defence.' },
      { s: 'The answer arrived about 22 thousandths of a second later: fast, but slower than a ping on the local network, because the resolver may have had to ask other servers.',
        m: 'The answer arrived about 22 ms after the question. Fast, but slower than the 0.4 ms of a LAN ping: the resolver may have had to ask other servers.',
        e: 'Response after about 22 ms, far above the 0.4 ms LAN RTT: consistent with a cache miss and upstream iteration.' },
      'Open packet 2: the answer section holds littletonpublicschools.net A 34.238.178.141 with a TTL of 7199 seconds.',
      { s: 'The answer frame is a little bigger than the question frame, because it repeats the question and adds the number.',
        m: 'Sizes: the question frame is 86 bytes, the answer 102. The answer is bigger because it repeats the question and adds the record.',
        e: 'Frames: 86 bytes (44-byte DNS query) and 102 bytes (60-byte response); the 16-byte difference is one compressed A record.' },
      '{{Row:http}} (HTTP) starts with exactly this kind of exchange before the browser can connect anywhere.'
    ]
  },

  {
    id: 'http',
    stack: 7,
    title: 'HTTP',
    subtitle: 'A complete web request: DNS, then TCP, then HTTP',
    file: 'http-httpforever.pcap',
    layer: {
      s: 'The language browsers and web servers speak. It rides inside TCP, which rides inside IP, which rides inside the frame.',
      m: 'Layer 7 (Application). HTTP text rides inside TCP, inside IP, inside Ethernet. The DNS lookup at the start is UDP.',
      e: 'Layer 7: HTTP/1.1 (RFC 9112) text over TCP port 80. The DNS lookup in packets 1 and 2 is UDP.'
    },
    command: 'curl http://httpforever.com/',
    oneLiner: {
      s: 'Getting one web page uses everything above: a lookup to find the server, a hello to connect, then a plain-text request and answer.',
      m: 'Fetching one web page uses everything in the rows above: a UDP lookup to find the server, a TCP handshake to connect, then a plain-text HTTP conversation.',
      e: 'One curl fetch: a UDP DNS lookup, a TCP handshake, a 129-byte GET, a 1786-byte response in two segments, and a four-segment close.'
    },
    sections: [
      { h: 'The whole journey of one page', p: [
        { s: 'This capture is what happens when you ask for <code>http://httpforever.com/</code>. Fourteen packets, four stages:',
          m: 'This capture is what happens when you run <code>curl http://httpforever.com/</code>. Fourteen packets, three protocols, four stages:',
          e: '<code>curl http://httpforever.com/</code>: 14 packets.' },
        { s: '1. <b>Look up the name</b> (packets 1 and 2): "what number is httpforever.com?" Answer: 146.190.62.39.',
          m: '1. <b>DNS over UDP</b> (packets 1 and 2): "what is the IP address of httpforever.com?" The answer: 146.190.62.39.',
          e: '1. DNS: A query for httpforever.com from port 57310 to 192.168.110.1:53, ID 0x8f21, answer 146.190.62.39 after 14 ms.' },
        { s: '2. <b>Say hello</b> (packets 3 to 5): the TCP handshake from {{row:tcp}}.',
          m: '2. <b>TCP handshake</b> (packets 3 to 5): SYN, SYN-ACK, ACK with the web server on port 80, exactly as in {{row:tcp}}.',
          e: '2. TCP handshake to 146.190.62.39:80 from port 51544: MSS 1460, wscale 8, SACK; the SYN-ACK arrives after 34 ms ({{row:tcp}}).' },
        { s: '3. <b>Ask and answer</b> (packets 6 to 10): "please send me the page", and the page comes back.',
          m: '3. <b>HTTP request and response</b> (packets 6 to 10): the client sends <code>GET / HTTP/1.1</code>, the server sends back <code>HTTP/1.1 200 OK</code> followed by the HTML page.',
          e: '3. GET / HTTP/1.1 (129 bytes, PSH), server ACK, then 200 OK as one full 1460-byte segment plus a 326-byte PSH segment, client ACK 1787.' },
        { s: '4. <b>Say goodbye</b> (packets 11 to 14).',
          m: '4. <b>TCP close</b> (packets 11 to 14): the four-way goodbye.',
          e: '4. Client FIN about 0.5 s later, server ACK, server FIN, client ACK.' }
      ]},
      { h: 'What an HTTP request looks like', p: [
        { s: 'HTTP is ordinary text, so you can read it in the capture. The request says what it wants (<code>GET /</code>), which website it means (<code>Host: httpforever.com</code>) and what program is asking, then a blank line.',
          m: 'HTTP is plain text, so you can read it in the capture. A request is a <b>request line</b> (method, path, version), then <b>headers</b> (one per line, like <code>Host: httpforever.com</code> and <code>User-Agent: curl/8.5.0</code>), then a blank line. The Host header matters: one server can host many websites, and this is how it knows which one you want.',
          e: 'Request = request line (method, target, version) plus CRLF-terminated header fields and an empty line. Host is mandatory in HTTP/1.1 for virtual hosting; here User-Agent is curl/8.5.0 and Accept is */*.' },
        { s: 'The reply is the mirror image: a status line saying it went fine (<code>200 OK</code>), a few lines describing the page, a blank line, then the page itself.',
          m: 'The response is the mirror image: a <b>status line</b> (<code>HTTP/1.1 200 OK</code>), headers such as <code>Content-Type: text/html</code> and <code>Content-Length: 1549</code>, a blank line, then the <b>body</b>: the HTML itself.',
          e: 'Response = status line, headers (Content-Type: text/html, Content-Length: 1549, Server, Date), CRLF, body. Content-Length delimits the body so the connection can stay open for further requests.' }
      ]},
      { h: 'Status codes', p: [
        { s: '<b>200</b> means fine, <b>404</b> means not found, <b>500</b> means the server broke. The first digit is the family: 2 good, 3 look elsewhere, 4 your mistake, 5 the server\'s mistake.',
          m: '<b>200</b> OK, <b>301</b> or <b>302</b> moved elsewhere, <b>403</b> forbidden, <b>404</b> not found, <b>500</b> the server crashed. The first digit tells you the family: 2xx success, 3xx redirection, 4xx your mistake, 5xx the server\'s mistake.',
          e: '1xx informational; 2xx success (200, 204); 3xx redirection (301 permanent, 302/307 temporary, 304 not modified); 4xx client error (400, 401, 403, 404, 429); 5xx server error (500, 502, 503). Defined in RFC 9110.' }
      ]},
      { h: 'Why almost everything is HTTPS now', p: [
        { s: 'Open packet 6 or 8 and you can read everything. So could anyone in between. <b>HTTPS</b> scrambles the same conversation so a capture shows only gibberish. httpforever.com stays on plain HTTP on purpose, so students can see the real thing.',
          m: 'Open packet 6 or 8 and you can read every header and the page content. Anyone on the path between you and the server could too. <b>HTTPS</b> wraps the same HTTP conversation inside TLS encryption, so a capture shows only the handshake and scrambled bytes. httpforever.com is deliberately kept on plain HTTP so students can see the real thing.',
          e: 'Packets 6, 8 and 9 are cleartext to any on-path observer. HTTPS runs the identical HTTP exchange inside TLS 1.2/1.3; a capture then shows the handshake, the SNI and record sizes only. httpforever.com is intentionally plain HTTP.' }
      ]}
    ],
    actors: [{ name: 'Student VM', addr: '192.168.110.50' }, { name: 'DNS server', addr: '192.168.110.1' }, { name: 'Web server', addr: '146.190.62.39 : 80' }],
    steps: [
      { from: 0, to: 1, label: 'DNS query: A httpforever.com?  (UDP)' },
      { from: 1, to: 0, label: 'DNS answer: 146.190.62.39  (UDP)' },
      { from: 0, to: 2, label: 'SYN' },
      { from: 2, to: 0, label: 'SYN, ACK' },
      { from: 0, to: 2, label: 'ACK   (connected)' },
      { from: 0, to: 2, label: 'GET / HTTP/1.1   Host: httpforever.com' },
      { from: 2, to: 0, label: 'ACK' },
      { from: 2, to: 0, label: 'HTTP/1.1 200 OK + first 1460 bytes of HTML' },
      { from: 2, to: 0, label: 'rest of the HTML (326 bytes)' },
      { from: 0, to: 2, label: 'ACK' },
      { from: 0, to: 2, label: 'FIN, ACK', dashed: true },
      { from: 2, to: 0, label: 'ACK', dashed: true },
      { from: 2, to: 0, label: 'FIN, ACK', dashed: true },
      { from: 0, to: 2, label: 'ACK   (closed)', dashed: true }
    ],
    lookFor: [
      { s: 'Packets 1 and 2 are the lookup, and the number that comes back is where every later packet goes.',
        m: 'Packet 1 and 2 share DNS transaction ID 0x8f21, and the answer is 146.190.62.39. That IP is the destination of every packet after it.',
        e: 'Packets 1 and 2: DNS ID 0x8f21, answer 146.190.62.39. Every later packet uses that address and the same client port, 51544.' },
      { s: 'The hello takes much longer here than on the local network in {{row:tcp}}: the server is out on the real internet.',
        m: 'Compare the handshake timing: SYN to SYN-ACK is about 34 ms here, versus 0.4 ms in {{row:tcp}}. That is the difference between the LAN and the real internet.',
        e: 'SYN to SYN-ACK is about 34 ms against 0.4 ms in {{row:tcp}}: the internet RTT dominates everything that follows.' },
      'Open packet 6 and read the request: GET / HTTP/1.1, Host, User-Agent curl/8.5.0.',
      { s: 'Packet 8 is as big as a frame is allowed to be. The page did not fit, so packet 9 carries the rest.',
        m: 'Packet 8 is 1514 bytes, the biggest an Ethernet frame can be (1500 byte MTU + 14 header). The page did not fit, so packet 9 carries the rest.',
        e: 'Packet 8 is 1514 bytes: a full MSS of 1460 plus 40 bytes of headers and 14 of Ethernet. Packet 9 carries the remaining 326 bytes with PSH set.' },
      { s: 'Add up the two pieces of the reply and you get a little more than the page size: the extra is the headers.',
        m: 'Content-Length says 1549. 1460 + 326 = 1786 bytes came back, so the headers took 237 bytes.',
        e: 'Content-Length 1549; 1460 + 326 = 1786 bytes of response, so the status line and headers took 237 bytes.' },
      { s: 'Packet 11 comes half a second after the page: the program waited a moment, then hung up.',
        m: 'Packet 11 comes half a second after the data: curl kept the connection open briefly, then closed it.',
        e: 'Packet 11 (client FIN) comes about 0.5 s after the last data segment; curl initiated the close.' }
    ]
  },

  {
    id: 'tftp',
    stack: 7,
    title: 'TFTP',
    subtitle: 'Copying a file 512 bytes at a time, and rebuilding it from the packets',
    file: 'tftp-mystery_image.pcap',
    reassemble: 'tftp',
    layer: {
      s: 'A file-copy program that uses UDP. It knocks on port 69, then the server moves the conversation to a fresh port.',
      m: 'Layer 7 (Application) on top of UDP. Starts on port 69, then moves to a fresh port per transfer.',
      e: 'Layer 7: TFTP (RFC 1350) over UDP. RRQ to port 69; the server answers from an ephemeral TID (55019) and both ports stay fixed for the transfer.'
    },
    command: 'tftp 192.168.110.1 -c get mystery_image.jpg',
    oneLiner: {
      s: 'TFTP is the smallest file copier there is: ask for a file, get it in small numbered pieces, say "got it" after each one.',
      m: 'TFTP is the smallest possible file copy protocol: ask for a file, receive it in 512-byte blocks, acknowledge each one.',
      e: 'TFTP moves a file as 512-byte DATA blocks in lock-step with per-block ACKs over UDP; a short block ends the transfer.'
    },
    sections: [
      { h: 'What is TFTP?', p: [
        { s: 'The <b>Trivial File Transfer Protocol</b> copies one file from one place to another and nothing else. No password, no folders, no encryption. It is so small that it fits inside network hardware: switches, routers and desk phones use it to fetch their settings, and a PC with an empty disk can boot over the network with it.',
          m: 'The <b>Trivial File Transfer Protocol</b> does one thing: copy a file from A to B. No login, no passwords, no directory listing, no encryption. It is tiny enough to fit in the firmware of a network card, which is exactly where it lives: switches and routers fetch their configuration and firmware with it, desk phones pull their settings from it, and <b>PXE</b> network boot uses it to load an operating system onto a PC with an empty disk.',
          e: 'TFTP (RFC 1350) has five packet types: RRQ, WRQ, DATA, ACK, ERROR. No authentication, listing or encryption, and small enough for firmware: switches and routers use it for config and image transfer, IP phones for provisioning, PXE boot for the bootloader and kernel.' }
      ]},
      { h: 'How a transfer works', p: [
        { s: '1. The client asks the server on port 69: "please send me mystery_image.jpg".',
          m: '1. The client sends a <b>Read Request</b> (RRQ) to port 69 naming the file and the mode. <b>octet</b> means "send the raw bytes exactly as stored"; the older <b>netascii</b> mode is for text files.',
          e: '1. RRQ (opcode 1) from port 45123 to 192.168.110.1:69: filename, mode octet (raw bytes; netascii translates line endings).' },
        { s: '2. The server answers from a new port of its own and sends piece number 1: 512 bytes.',
          m: '2. The server does not answer from port 69. It picks a new port for this transfer (here 55019) and sends <b>DATA block 1</b>: the first 512 bytes of the file.',
          e: '2. The server picks TID 55019 and sends DATA (opcode 3) block 1 with 512 bytes; both TIDs are fixed for the rest of the transfer.' },
        { s: '3. The client says "got 1". Only then does the server send piece 2. One piece at a time, all the way through.',
          m: '3. The client replies <b>ACK 1</b>. Only then does the server send block 2. One block in flight at a time, in lock-step, until the end.',
          e: '3. ACK (opcode 4) block 1 from the client; the server sends block N+1 only after ACK N. Window of one (RFC 7440 adds a windowsize option; not used here).' },
        { s: '4. A piece shorter than 512 bytes means "that was the last one".',
          m: '4. A DATA block shorter than 512 bytes means "that was the last one". If the file is an exact multiple of 512, the server sends an empty block to say so.',
          e: '4. A DATA block shorter than 512 bytes terminates the transfer; an exact multiple ends with a zero-length DATA block.' }
      ]},
      { h: 'Reliability without TCP', p: [
        { s: 'UDP ({{row:udp}}) never resends anything, so TFTP does it itself. If "got it" does not arrive, the server sends the piece again. The piece numbers keep everything in order.',
          m: 'UDP ({{row:udp}}) does not retransmit, so TFTP does it itself. If an ACK does not arrive in time the server resends the block; if a block does not arrive the client resends its last ACK. The block numbers keep everything in order.',
          e: 'Retransmission is timer-driven at both ends over UDP ({{row:udp}}): the server resends DATA N if ACK N does not arrive, the client resends its last ACK if DATA N+1 does not. 16-bit block numbers give ordering and duplicate detection.' },
        { s: 'The cost is speed: every piece has to be confirmed before the next can go. On a local network that is fine. Over the internet it would crawl, which is why TFTP stays on local networks and why TCP ({{row:tcp}}) sends many pieces before waiting.',
          m: 'The price is speed. Each block needs a full round trip before the next one can go, so the transfer rate is roughly 512 bytes per round-trip time. On this LAN, with about a millisecond per block, that is around 400 KB/s. Across the internet at 50 ms it would be a painful 10 KB/s. This is why TFTP is only used on local networks, and why TCP ({{row:tcp}}) sends many packets before waiting for acknowledgements.',
          e: 'Throughput is bounded at one block per RTT: about 512 B per 1.3 ms here, roughly 400 KB/s; at a 50 ms RTT it drops to about 10 KB/s. TCP ({{row:tcp}}) keeps a window of many segments in flight.' }
      ]},
      { h: 'Nothing is hidden', p: [
        { s: 'Every byte of the file goes across the network for anyone to see. This page took the pieces from the capture, put them back in order, and shows the picture below. Anyone else listening could do the same. Never send anything private with TFTP.',
          m: 'Every byte of the file passes across the network in the clear. Scroll down: this page has taken the DATA blocks from the capture, glued them together in order, and displayed the result. Anyone else capturing on the same network could do exactly the same. Never move anything private over TFTP.',
          e: 'The payload is cleartext. This page concatenates the DATA blocks in block order and renders the result; any on-path capture can do the same. Config files with credentials are the classic TFTP leak.' }
      ]}
    ],
    actors: [{ name: 'Client', addr: '192.168.110.50 : 45123' }, { name: 'TFTP server', addr: '192.168.110.1 : 69 → 55019' }],
    steps: [
      { from: 0, to: 1, label: 'RRQ "mystery_image.jpg", octet   (to port 69)' },
      { from: 1, to: 0, label: 'DATA block 1  (512 bytes, from port 55019)' },
      { from: 0, to: 1, label: 'ACK 1' },
      { from: 1, to: 0, label: 'DATA block 2  (512 bytes)' },
      { from: 0, to: 1, label: 'ACK 2' },
      { from: 1, to: 0, label: '... blocks 3 to 103, each followed by its ACK ...', dashed: true },
      { from: 1, to: 0, label: 'DATA block 104  (397 bytes: shorter, so the last)' },
      { from: 0, to: 1, label: 'ACK 104   (transfer complete)' }
    ],
    lookFor: [
      { s: 'Packet 1 is the only one sent to port 69. After that the server talks from a port of its own.',
        m: 'Packet 1 is the only packet sent to port 69. From packet 2 on, the server talks from port 55019.',
        e: 'Only packet 1 goes to port 69. The server\'s TID 55019 and the client\'s 45123 stay fixed from packet 2 on.' },
      { s: 'Each piece arrives in a frame of 558 bytes: 512 bytes of the file plus the headers of every layer. The "got it" messages are tiny.',
        m: 'DATA frames are 558 bytes on the wire: 14 Ethernet + 20 IP + 8 UDP + 4 TFTP header + 512 bytes of file. ACKs are padded to the 60-byte Ethernet minimum.',
        e: 'DATA frames: 14 + 20 + 8 + 4 + 512 = 558 bytes. ACKs are 4 bytes of TFTP (opcode 4, block), padded to the 60-byte minimum.' },
      'Strict alternation: DATA, ACK, DATA, ACK. The server never sends block N+1 until it has seen ACK N.',
      { s: 'The piece numbers climb from 1 to 104, and the last piece is short. Together they add up to the size of the picture.',
        m: 'The block numbers climb from 1 to 104. 103 full blocks plus a final 397-byte block add up to 53,129 bytes, the size of the JPEG.',
        e: 'Blocks 1 to 104: 103 × 512 + 397 = 53,129 bytes. The short block 104 terminates the transfer.' },
      { s: 'The whole picture arrived in well under a second.',
        m: 'Timing: about 1.3 ms per block, so the whole 53 KB file took roughly 0.14 seconds.',
        e: 'About 1.3 ms per DATA/ACK pair, so roughly 0.14 s for 53 KB: one RTT per block.' },
      'The table is folded because the middle 189 packets all look alike. Expand it and click any DATA packet to see its block number.',
      'The image above the table is not stored on this page. It was rebuilt from the DATA blocks the moment the capture loaded.'
    ]
  }
];
