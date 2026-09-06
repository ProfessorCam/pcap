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
  image: 'professorcam/pcap',      /* Docker Hub image of this site; shown with a run command when the live section is unavailable */
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

var LESSONS = [
  {
    id: 'ping',
    title: 'Ping',
    subtitle: 'ICMP echo request and reply',
    file: 'icmp-echo-192.168.110.1.pcap',
    layer: 'Layer 3 (Network). ICMP rides directly inside IP. There are no port numbers.',
    command: 'ping -c 4 192.168.110.1',
    oneLiner: 'Ping shouts "are you there?" at another computer and times how long the answer takes to come back.',
    sections: [
      { h: 'What is ping?', p: [
        'Ping is the oldest and simplest network test. Your computer sends a tiny message to another machine and waits for it to be sent straight back. If the answer arrives, you know two things: the other machine is alive, and there is a working path to it and back.',
        'The time between sending and receiving is the <b>round-trip time</b> (RTT). On a local network it is well under a millisecond. Across the internet it is tens or hundreds of milliseconds.'
      ]},
      { h: 'The protocol underneath: ICMP', p: [
        'Ping uses <b>ICMP</b>, the Internet Control Message Protocol. ICMP is the messaging system built into IP for errors and diagnostics: "host unreachable", "time exceeded", and the two ping messages, <b>Echo Request</b> (type 8) and <b>Echo Reply</b> (type 0).',
        'Watch one ping packet being built, layer by layer. Notice what is missing: there is no TCP or UDP header at all.'
      ], anim: 'icmp-assembly', after: [
        'ICMP sits directly inside the IP packet, so there are no port numbers and no connection to set up. Each ping is a single, independent packet, built exactly like this and sent on its own.'
      ]},
      { h: 'How one ping works', p: [
        '1. The sender builds an Echo Request containing an <b>identifier</b> (the same for every ping in one run of the command), a <b>sequence number</b> (1, 2, 3, ...) and some filler data.',
        '2. The target receives it and sends back an Echo Reply with exactly the same identifier, sequence number and data.',
        '3. The sender matches the reply to its request using those numbers, and prints the time it took. If no reply arrives, that sequence number is counted as <b>packet loss</b>.'
      ]},
      { h: 'Why it matters', p: [
        'Ping is the first thing to try when "the network is down". It separates "the machine is off or unreachable" from "the machine is up but the service is broken". It also measures latency and reveals packet loss, which is why game players and network engineers both care about it.'
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
      'The identifier is 6699 in every packet, and the sequence number counts 1, 2, 3, 4.',
      'Requests are exactly one second apart. That is the default ping interval.',
      'Each reply lands about 0.4 ms after its request. That gap is the round-trip time ping prints.',
      'Every frame is 98 bytes: 14 Ethernet + 20 IP + 8 ICMP + 56 bytes of filler data.',
      'Click a packet and open the ICMP section to compare the request (type 8) with the reply (type 0).'
    ]
  },

  {
    id: 'udp',
    title: 'UDP',
    subtitle: 'DHCP: getting an IP address (Discover, Offer, Request, ACK)',
    file: 'dhcp-dora-192.168.110.50.pcap',
    layer: 'Layer 4 (Transport) for UDP, carrying DHCP, a Layer 7 application protocol, on ports 67 and 68.',
    command: 'dhclient -v eth0   (or simply plugging in the network cable)',
    oneLiner: 'UDP is the "postcard" protocol: send a message and hope. DHCP uses it to hand a new computer its IP address.',
    sections: [
      { h: 'What is UDP?', p: [
        '<b>UDP</b>, the User Datagram Protocol, is the simplest way to send data to a program on another computer. Each message (a <b>datagram</b>) is sent on its own. There is no connection to set up first, no acknowledgement that it arrived, and no retry if it was lost.',
        'Its header is only 8 bytes: source port, destination port, length and a checksum. Think of a postcard: cheap and quick, but nobody tells you if it got lost in the mail.'
      ]},
      { h: 'Why would anyone want that?', p: [
        'Because it is fast and light. For a single question with a single answer (DNS, DHCP) the application can simply ask again if nothing comes back. For voice, video and games, a late packet is useless anyway, so there is no point waiting for retransmissions.',
        'Compare this with TCP in row 3, which does all the bookkeeping for you at the cost of extra packets.'
      ]},
      { h: 'DHCP: the four-step DORA dance', p: [
        'When a computer joins a network it has no IP address at all. <b>DHCP</b> (Dynamic Host Configuration Protocol) fixes that with four UDP messages, remembered as <b>DORA</b>:',
        '1. <b>Discover</b>: the client shouts to everyone (broadcast) "is there a DHCP server out there?" Its source IP is 0.0.0.0 because it has none yet.',
        '2. <b>Offer</b>: a server answers "you can have 192.168.110.50, here is the subnet mask, gateway and DNS servers".',
        '3. <b>Request</b>: the client broadcasts again, "yes please, I will take 192.168.110.50 from server 192.168.110.1", so any other servers know to back off.',
        '4. <b>ACK</b>: the server confirms and starts the <b>lease</b> timer. The client can now use the address.'
      ]},
      { h: 'Why DHCP has to use UDP', p: [
        'The client has no IP address and does not know where the server is. It cannot open a TCP connection to an unknown address. A broadcast UDP datagram to 255.255.255.255 is the only tool that works with no configuration at all.',
        'Watch the Discover packet being built. Every layer has the same problem, "I do not know who I am talking to, and I have no address of my own", and each solves it the same way: broadcast.'
      ], anim: 'dhcp-discover', after: [
        'After the ACK, the client uses ARP (row 4) to probe whether anyone else already has the address, then announces it. You can see both ARP packets at the end of this capture.'
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
      'Packets 1 and 3 come from source IP 0.0.0.0: the client really has no address yet.',
      'Every DHCP packet goes to 255.255.255.255 and MAC ff:ff:ff:ff:ff:ff. That is a broadcast: every machine on the LAN hears it.',
      'The transaction ID 0x3d1f7a44 is identical in all four messages. That is how the client matches answers to its question.',
      'Open packet 2 (Offer): "Your IP" is 192.168.110.50, lease 86400 seconds (24 hours), mask 255.255.254.0, gateway 192.168.110.1, DNS 192.168.110.1 and 9.9.9.9.',
      'The mask 255.255.254.0 is a /23: the subnet runs from 192.168.110.0 to 192.168.111.255. The DHCP server only hands out leases from the 192.168.110.x half; 192.168.111.x addresses are on the same network but must be set by hand.',
      'Ports: the client always uses 68 and the server 67.',
      'The whole DORA exchange takes under 7 ms. Packets 5 and 6 are ARP, the client checking that nobody else owns .50.'
    ]
  },

  {
    id: 'tcp',
    title: 'TCP',
    subtitle: 'The three-way handshake (and the four-way goodbye)',
    file: 'tcp-handshake-192.168.110.1.pcap',
    layer: 'Layer 4 (Transport). TCP runs on top of IP and adds port numbers, reliability and ordering.',
    command: 'nc -z 192.168.110.1 80   (connect to port 80, then close without sending anything)',
    oneLiner: 'TCP is the "phone call" protocol: both sides agree to talk before any data is sent, and every byte is numbered and confirmed.',
    sections: [
      { h: 'What is TCP?', p: [
        '<b>TCP</b>, the Transmission Control Protocol, carries most of what you do online: web pages, email, file downloads, SSH. Unlike UDP it is <b>reliable</b> and <b>ordered</b>: every byte gets a <b>sequence number</b>, the receiver sends back <b>acknowledgements</b> (ACKs) saying how far it has got, and anything missing is sent again.',
        'Before any data flows, the two sides must set up a <b>connection</b>. That is the three-way handshake, and it is what this capture shows.'
      ]},
      { h: 'The three-way handshake', p: [
        '1. <b>SYN</b>: the client says "I want to talk to port 80. My sequence numbers start at X." (SYN stands for synchronise.)',
        '2. <b>SYN, ACK</b>: the server replies "OK. My numbers start at Y, and I have received up to X+1."',
        '3. <b>ACK</b>: the client says "Got it, I have received up to Y+1." The connection is now open in both directions.',
        'Here is the first of those three packets being built. Watch where the <b>port numbers</b> go: they are not in IP and not in Ethernet, they are TCP\'s job.'
      ], anim: 'tcp-syn', after: [
        'Both sides also advertise options in the SYN packets: the biggest chunk they can accept (<b>MSS</b>), how much data they can buffer (<b>window size</b>) and whether they support selective acknowledgements (<b>SACK</b>).'
      ]},
      { h: 'Reading sequence numbers', p: [
        'The real starting numbers are random (open a packet to see the raw values). Wireshark and this page show them <b>relative</b> to the start, so the handshake reads Seq=0, then Seq=0 Ack=1, then Seq=1 Ack=1. The SYN flag counts as one byte, which is why the first ACK says 1 even though no data was sent.'
      ]},
      { h: 'Closing politely: the four-way goodbye', p: [
        'Each side closes its own direction with a <b>FIN</b> (finish), and the other side ACKs it. Client FIN, server ACK, server FIN, client ACK. That is packets 4 to 7 here. Just like the SYN, a FIN uses up one sequence number, so the numbers tick up by one again.',
        'A rude close is an <b>RST</b> (reset), which slams the connection shut in a single packet. You will not see one in this capture.'
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
      'Packets 1, 2, 3 are the handshake: [SYN], [SYN, ACK], [ACK]. All three happen within 0.4 ms.',
      'The client picked a random high port (49832) to talk from. The server listens on the well-known port 80.',
      'Open packet 1: MSS=1460, window 64240, window scale 7, SACK permitted. Open packet 2 to see the server offer its own values.',
      'Seq and Ack in packet 3 are both 1: each side has "used up" one number for its SYN.',
      'Len=0 on every packet. No application data was ever sent; this was a pure connect-and-close.',
      'Packets 4 to 7 are the close. Notice Ack=2 after the FIN: the FIN consumed a sequence number too.'
    ]
  },

  {
    id: 'arp',
    title: 'ARP',
    subtitle: 'Turning an IP address into a MAC address',
    file: 'arp-request-192.168.110.0.pcap',
    layer: 'Layer 2 (Data link). ARP sits directly inside the Ethernet frame (type 0x0806). It never leaves the local network.',
    command: 'ip neigh flush all; ping 192.168.110.1; ping 192.168.110.77',
    oneLiner: 'ARP asks the whole local network "who has this IP address?" so the sender can learn which network card to deliver the frame to.',
    sections: [
      { h: 'Two kinds of address', p: [
        'Every machine on a network has two addresses. The <b>IP address</b> (like 192.168.110.1) is logical: it is assigned by DHCP or an admin and says where you are in the network. The <b>MAC address</b> (like 00:50:56:c0:00:01) is physical: it is baked into the network card and is what Ethernet actually uses to deliver frames on the local wire.',
        'Applications think in IP addresses. Ethernet only understands MAC addresses. Something has to translate between them, and that is <b>ARP</b>, the Address Resolution Protocol.'
      ]},
      { h: 'How ARP works', p: [
        '1. The sender broadcasts to every machine on the LAN (destination MAC ff:ff:ff:ff:ff:ff): "<b>Who has</b> 192.168.110.1? <b>Tell</b> 192.168.110.50."',
        '2. Only the owner of that IP answers, directly to the asker: "192.168.110.1 <b>is at</b> 00:50:56:c0:00:01."',
        '3. The sender stores the answer in its <b>ARP cache</b> for a few minutes so it does not have to ask again for every packet. You can view the cache with <code>ip neigh</code> on Linux or <code>arp -a</code> on Windows.',
        'Here is what one request looks like on the wire. Compare it with the ping packet in row 1: something is missing.'
      ], anim: 'arp-request' },
      { h: 'ARP and the wider internet', p: [
        'ARP only works on the local network. When you send to an address outside it, your computer does not ARP for the far-away host. It ARPs for the <b>gateway</b> (the router) and hands the frame to the router\'s MAC, and the router takes it from there. That is exactly what packet 1 does: it looks up the gateway.'
      ]},
      { h: 'When nobody answers, and when nobody asked', p: [
        'Packets 3 and 4 ask for 192.168.110.77 twice, a second apart, and never get a reply. No machine has that address. This is what produces the "Destination Host Unreachable" message from ping.',
        'Packet 5 is a <b>gratuitous ARP</b>: a machine (192.168.110.65) announces its own address without being asked. The sender IP and target IP are the same. Machines do this when they boot or change address so everyone can update their caches, and to detect if someone else already uses that IP.'
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
      'The Source and Destination columns show MAC addresses, not IPs. ARP lives below IP.',
      'Requests go to ff:ff:ff:ff:ff:ff (broadcast). The reply in packet 2 goes straight back to the asker.',
      'Open packet 1: the Target MAC is 00:00:00:00:00:00, because that is the thing being asked for.',
      'Packet 2 arrives 0.3 ms after packet 1. That is how fast a LAN answers.',
      'Packets 3 and 4 have no reply. Look at the timestamps: about one second apart, a retry.',
      'Packet 5 comes from a different MAC and has sender IP equal to target IP: a gratuitous ARP.',
      'Every frame is 60 bytes. ARP is smaller than that, so Ethernet pads it to the minimum frame size.'
    ]
  },

  {
    id: 'dns',
    title: 'DNS',
    subtitle: 'Looking up an A record for littletonpublicschools.net',
    file: 'dns-a-littletonpublicschools.net.pcap',
    layer: 'Layer 7 (Application), carried by UDP on port 53. The internet\'s phone book.',
    command: 'dig A littletonpublicschools.net   (or nslookup littletonpublicschools.net)',
    oneLiner: 'DNS turns a name people can remember into the IP address packets actually need.',
    sections: [
      { h: 'What is DNS?', p: [
        'Every packet on the internet is addressed with numbers, but nobody wants to type 34.238.178.141 to reach their school\'s website. The <b>Domain Name System</b> is a world-wide, distributed phone book that maps names like <code>littletonpublicschools.net</code> to addresses.',
        'Your computer does not search that phone book itself. It asks a <b>resolver</b>, the DNS server it was given by DHCP (row 2). In this lab that is the gateway, 192.168.110.1.'
      ]},
      { h: 'How one lookup works', p: [
        '1. Your computer sends a <b>query</b> to the resolver: "What is the <b>A record</b> for littletonpublicschools.net?" An A record is the IPv4 address of a name.',
        '2. If the resolver already knows (it has the answer <b>cached</b>), it replies straight away. If not, it works its way down the tree: it asks a <b>root</b> server, which points it to the <b>.net</b> servers, which point it to the school district\'s own name servers, which finally hold the answer. This chasing is called <b>recursion</b> and is not visible in this capture; only the question and the final answer are.',
        '3. The <b>response</b> comes back with the same transaction ID as the query, the original question repeated, and an <b>answer section</b> containing the record.'
      ]},
      { h: 'Record types you will meet', p: [
        '<b>A</b>: IPv4 address. <b>AAAA</b>: IPv6 address. <b>CNAME</b>: "this name is an alias for that name". <b>MX</b>: where to deliver email for the domain. <b>NS</b>: which servers hold the domain\'s records. <b>TXT</b>: free text, used for things like proving you own a domain.',
        'Each record carries a <b>TTL</b> (time to live) in seconds. That is how long the resolver may keep handing out the same answer before it must ask again. The answer here allows 7199 seconds, about two hours.'
      ]},
      { h: 'Why DNS uses UDP', p: [
        'A lookup is one small question and one small answer, so UDP (row 2) is a perfect fit: no handshake, one packet each way. If nothing comes back the client simply asks again. Only for very large answers, or for copying whole zones between servers, does DNS switch to TCP.',
        'Also notice: DNS is plain text. Anyone on the path can see which names you look up. That is why DNS over HTTPS and DNS over TLS exist.'
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
      'The transaction ID 0x5a3c appears in both. The client uses it to match the answer to the question it asked.',
      'The query goes to port 53 from a random high port (41207). The answer comes back from 53 to that same high port.',
      'The answer arrived about 22 ms after the question. Fast, but slower than the 0.4 ms of a LAN ping: the resolver may have had to ask other servers.',
      'Open packet 2: the answer section holds littletonpublicschools.net A 34.238.178.141 with a TTL of 7199 seconds.',
      'Sizes: the question frame is 86 bytes, the answer 102. The answer is bigger because it repeats the question and adds the record.',
      'Row 6 (HTTP) starts with exactly this kind of exchange before the browser can connect anywhere.'
    ]
  },

  {
    id: 'http',
    title: 'HTTP',
    subtitle: 'A complete web request: DNS, then TCP, then HTTP',
    file: 'http-httpforever.pcap',
    layer: 'Layer 7 (Application). HTTP text rides inside TCP, inside IP, inside Ethernet. The DNS lookup at the start is UDP.',
    command: 'curl http://httpforever.com/',
    oneLiner: 'Fetching one web page uses everything in the rows above: a UDP lookup to find the server, a TCP handshake to connect, then a plain-text HTTP conversation.',
    sections: [
      { h: 'The whole journey of one page', p: [
        'This capture is what happens when you run <code>curl http://httpforever.com/</code>. Fourteen packets, three protocols, four stages:',
        '1. <b>DNS over UDP</b> (packets 1 and 2): "what is the IP address of httpforever.com?" The answer: 146.190.62.39.',
        '2. <b>TCP handshake</b> (packets 3 to 5): SYN, SYN-ACK, ACK with the web server on port 80, exactly as in row 3.',
        '3. <b>HTTP request and response</b> (packets 6 to 10): the client sends <code>GET / HTTP/1.1</code>, the server sends back <code>HTTP/1.1 200 OK</code> followed by the HTML page.',
        '4. <b>TCP close</b> (packets 11 to 14): the four-way goodbye.'
      ]},
      { h: 'What an HTTP request looks like', p: [
        'HTTP is plain text, so you can read it in the capture. A request is a <b>request line</b> (method, path, version), then <b>headers</b> (one per line, like <code>Host: httpforever.com</code> and <code>User-Agent: curl/8.5.0</code>), then a blank line. The Host header matters: one server can host many websites, and this is how it knows which one you want.',
        'The response is the mirror image: a <b>status line</b> (<code>HTTP/1.1 200 OK</code>), headers such as <code>Content-Type: text/html</code> and <code>Content-Length: 1549</code>, a blank line, then the <b>body</b>: the HTML itself.'
      ]},
      { h: 'Status codes', p: [
        '<b>200</b> OK, <b>301</b> or <b>302</b> moved elsewhere, <b>403</b> forbidden, <b>404</b> not found, <b>500</b> the server crashed. The first digit tells you the family: 2xx success, 3xx redirection, 4xx your mistake, 5xx the server\'s mistake.'
      ]},
      { h: 'Why almost everything is HTTPS now', p: [
        'Open packet 6 or 8 and you can read every header and the page content. Anyone on the path between you and the server could too. <b>HTTPS</b> wraps the same HTTP conversation inside TLS encryption, so a capture shows only the handshake and scrambled bytes. httpforever.com is deliberately kept on plain HTTP so students can see the real thing.'
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
      'Packet 1 and 2 share DNS transaction ID 0x8f21, and the answer is 146.190.62.39. That IP is the destination of every packet after it.',
      'Compare the handshake timing: SYN to SYN-ACK is about 34 ms here, versus 0.4 ms in row 3. That is the difference between the LAN and the real internet.',
      'Open packet 6 and read the request: GET / HTTP/1.1, Host, User-Agent curl/8.5.0.',
      'Packet 8 is 1514 bytes, the biggest an Ethernet frame can be (1500 byte MTU + 14 header). The page did not fit, so packet 9 carries the rest.',
      'Content-Length says 1549. 1460 + 326 = 1786 bytes came back, so the headers took 237 bytes.',
      'Packet 11 comes half a second after the data: curl kept the connection open briefly, then closed it.'
    ]
  },

  {
    id: 'tftp',
    title: 'TFTP',
    subtitle: 'Copying a file 512 bytes at a time, and rebuilding it from the packets',
    file: 'tftp-mystery_image.pcap',
    reassemble: 'tftp',
    layer: 'Layer 7 (Application) on top of UDP. Starts on port 69, then moves to a fresh port per transfer.',
    command: 'tftp 192.168.110.1 -c get mystery_image.jpg',
    oneLiner: 'TFTP is the smallest possible file copy protocol: ask for a file, receive it in 512-byte blocks, acknowledge each one.',
    sections: [
      { h: 'What is TFTP?', p: [
        'The <b>Trivial File Transfer Protocol</b> does one thing: copy a file from A to B. No login, no passwords, no directory listing, no encryption. It is tiny enough to fit in the firmware of a network card, which is exactly where it lives: switches and routers fetch their configuration and firmware with it, desk phones pull their settings from it, and <b>PXE</b> network boot uses it to load an operating system onto a PC with an empty disk.'
      ]},
      { h: 'How a transfer works', p: [
        '1. The client sends a <b>Read Request</b> (RRQ) to port 69 naming the file and the mode. <b>octet</b> means "send the raw bytes exactly as stored"; the older <b>netascii</b> mode is for text files.',
        '2. The server does not answer from port 69. It picks a new port for this transfer (here 55019) and sends <b>DATA block 1</b>: the first 512 bytes of the file.',
        '3. The client replies <b>ACK 1</b>. Only then does the server send block 2. One block in flight at a time, in lock-step, until the end.',
        '4. A DATA block shorter than 512 bytes means "that was the last one". If the file is an exact multiple of 512, the server sends an empty block to say so.'
      ]},
      { h: 'Reliability without TCP', p: [
        'UDP (row 2) does not retransmit, so TFTP does it itself. If an ACK does not arrive in time the server resends the block; if a block does not arrive the client resends its last ACK. The block numbers keep everything in order.',
        'The price is speed. Each block needs a full round trip before the next one can go, so the transfer rate is roughly 512 bytes per round-trip time. On this LAN, with about a millisecond per block, that is around 400 KB/s. Across the internet at 50 ms it would be a painful 10 KB/s. This is why TFTP is only used on local networks, and why TCP (row 3) sends many packets before waiting for acknowledgements.'
      ]},
      { h: 'Nothing is hidden', p: [
        'Every byte of the file passes across the network in the clear. Scroll down: this page has taken the DATA blocks from the capture, glued them together in order, and displayed the result. Anyone else capturing on the same network could do exactly the same. Never move anything private over TFTP.'
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
      'Packet 1 is the only packet sent to port 69. From packet 2 on, the server talks from port 55019.',
      'DATA frames are 558 bytes on the wire: 14 Ethernet + 20 IP + 8 UDP + 4 TFTP header + 512 bytes of file. ACKs are padded to the 60-byte Ethernet minimum.',
      'Strict alternation: DATA, ACK, DATA, ACK. The server never sends block N+1 until it has seen ACK N.',
      'The block numbers climb from 1 to 104. 103 full blocks plus a final 397-byte block add up to 53,129 bytes, the size of the JPEG.',
      'Timing: about 1.3 ms per block, so the whole 53 KB file took roughly 0.14 seconds.',
      'The table is folded because the middle 189 packets all look alike. Expand it and click any DATA packet to see its block number.',
      'The image above the table is not stored on this page. It was rebuilt from the DATA blocks the moment the capture loaded.'
    ]
  }
];
