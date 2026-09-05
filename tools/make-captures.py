#!/usr/bin/env python3
"""
Builds two synthetic captures for the lab network (192.168.110.0/24):

  site/pcaps/dns-a-littletonpublicschools.net.pcap
      one DNS A query and its answer (record values taken from a real lookup)

  site/pcaps/tftp-mystery_image.pcap
      a complete TFTP read of site/pcaps/mystery_image.jpg (RRQ, DATA, ACK ...)

Usage:  python3 tools/make-captures.py [path/to/source-image.png]

The source image is downscaled to a small JPEG first so the transfer stays a
few hundred packets instead of many thousands. Only the standard library plus
Pillow (for the resize) are needed.
"""
import os, random, struct, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
PCAPS = os.path.join(HERE, '..', 'site', 'pcaps')

CLIENT_MAC = bytes.fromhex('000c294b1fa2'); CLIENT_IP = '192.168.110.50'
SERVER_MAC = bytes.fromhex('005056c00001'); SERVER_IP = '192.168.110.1'

# ---------- packet building ----------

def ip2b(ip): return bytes(int(x) for x in ip.split('.'))

def checksum(data):
    if len(data) % 2: data += b'\0'
    s = sum(struct.unpack('!%dH' % (len(data) // 2), data))
    while s >> 16: s = (s & 0xffff) + (s >> 16)
    return (~s) & 0xffff

def udp_frame(src_mac, dst_mac, src_ip, dst_ip, sport, dport, payload, ident, ttl=64):
    udp_len = 8 + len(payload)
    pseudo = ip2b(src_ip) + ip2b(dst_ip) + struct.pack('!BBH', 0, 17, udp_len)
    udp = struct.pack('!HHHH', sport, dport, udp_len, 0) + payload
    udp = udp[:6] + struct.pack('!H', checksum(pseudo + udp) or 0xffff) + udp[8:]
    total = 20 + len(udp)
    ip = struct.pack('!BBHHHBBH4s4s', 0x45, 0, total, ident, 0x4000, ttl, 17, 0, ip2b(src_ip), ip2b(dst_ip))
    ip = ip[:10] + struct.pack('!H', checksum(ip)) + ip[12:]
    frame = dst_mac + src_mac + b'\x08\x00' + ip + udp
    return frame + b'\0' * max(0, 60 - len(frame))

class Pcap:
    def __init__(self, path, t0):
        self.f = open(path, 'wb'); self.t = t0
        self.f.write(struct.pack('<IHHiIII', 0xa1b2c3d4, 2, 4, 0, 0, 65535, 1))
    def add(self, frame, gap):
        self.t += gap
        sec = int(self.t); usec = int(round((self.t - sec) * 1e6))
        self.f.write(struct.pack('<IIII', sec, usec, len(frame), len(frame)) + frame)
    def close(self): self.f.close()

# ---------- DNS ----------

def dns_name(name):
    return b''.join(bytes([len(l)]) + l.encode() for l in name.split('.')) + b'\0'

def make_dns(path):
    name, answer_ip, ttl = 'littletonpublicschools.net', '34.238.178.141', 7199
    xid, sport, ident = 0x5a3c, 41207, 0x2a10
    q = struct.pack('!HHHHHH', xid, 0x0100, 1, 0, 0, 0) + dns_name(name) + struct.pack('!HH', 1, 1)
    r = struct.pack('!HHHHHH', xid, 0x8180, 1, 1, 0, 0) + dns_name(name) + struct.pack('!HH', 1, 1)
    r += b'\xc0\x0c' + struct.pack('!HHIH', 1, 1, ttl, 4) + ip2b(answer_ip)
    pc = Pcap(path, time.mktime((2026, 9, 5, 9, 15, 0, 0, 0, -1)))
    pc.add(udp_frame(CLIENT_MAC, SERVER_MAC, CLIENT_IP, SERVER_IP, sport, 53, q, ident), 0)
    pc.add(udp_frame(SERVER_MAC, CLIENT_MAC, SERVER_IP, CLIENT_IP, 53, sport, r, ident + 1), 0.021_884)
    pc.close()
    print('wrote', path, '(2 packets)')

# ---------- TFTP ----------

def make_tftp(path, filename, data):
    client_port, server_port = 45123, 55019
    pc = Pcap(path, time.mktime((2026, 9, 5, 9, 20, 0, 0, 0, -1)))
    ident = 0x3100
    rrq = b'\x00\x01' + filename.encode() + b'\0' + b'octet\0'
    pc.add(udp_frame(CLIENT_MAC, SERVER_MAC, CLIENT_IP, SERVER_IP, client_port, 69, rrq, ident), 0); ident += 1
    blocks = [data[i:i + 512] for i in range(0, len(data), 512)]
    if not blocks or len(blocks[-1]) == 512: blocks.append(b'')   # a short (or empty) block means "end of file"
    n = 0
    rnd = random.Random(7)
    for i, blk in enumerate(blocks, 1):
        d = b'\x00\x03' + struct.pack('!H', i & 0xffff) + blk
        pc.add(udp_frame(SERVER_MAC, CLIENT_MAC, SERVER_IP, CLIENT_IP, server_port, client_port, d, ident), 0.0009 + rnd.random() * 0.0004); ident += 1
        a = b'\x00\x04' + struct.pack('!H', i & 0xffff)
        pc.add(udp_frame(CLIENT_MAC, SERVER_MAC, CLIENT_IP, SERVER_IP, client_port, server_port, a, ident), 0.0002 + rnd.random() * 0.0002); ident += 1
        n += 2
    pc.close()
    print('wrote', path, '(%d packets, %d data blocks, %d bytes)' % (n + 1, len(blocks), len(data)))

def make_small_jpeg(src, dst, width=640, quality=72):
    from PIL import Image
    im = Image.open(src).convert('RGB')
    im.thumbnail((width, width))
    im.save(dst, 'JPEG', quality=quality, optimize=True)
    print('wrote', dst, os.path.getsize(dst), 'bytes', im.size)

if __name__ == '__main__':
    os.makedirs(PCAPS, exist_ok=True)
    make_dns(os.path.join(PCAPS, 'dns-a-littletonpublicschools.net.pcap'))
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Downloads/mystery_image.png')
    jpg = os.path.join(PCAPS, 'mystery_image.jpg')
    if os.path.exists(src): make_small_jpeg(src, jpg)
    with open(jpg, 'rb') as f: data = f.read()
    make_tftp(os.path.join(PCAPS, 'tftp-mystery_image.pcap'), 'mystery_image.jpg', data)
