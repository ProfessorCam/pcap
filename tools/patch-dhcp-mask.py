#!/usr/bin/env python3
"""
One-off fix: the DHCP capture handed out subnet mask 255.255.255.0, but the
EPIC-CompSci-WiFi-5GHz network is 192.168.110.0/23. This rewrites DHCP option 1
(subnet mask) in every DHCP packet of the capture and recomputes the UDP checksum.

Usage: python3 tools/patch-dhcp-mask.py site/pcaps/dhcp-dora-192.168.110.50.pcap 255.255.254.0
"""
import struct, sys

def checksum(data):
    if len(data) % 2: data += b'\0'
    s = sum(struct.unpack('!%dH' % (len(data) // 2), data))
    while s >> 16: s = (s & 0xffff) + (s >> 16)
    return (~s) & 0xffff

path, mask = sys.argv[1], bytes(int(x) for x in sys.argv[2].split('.'))
raw = bytearray(open(path, 'rb').read())
magic = struct.unpack('<I', raw[:4])[0]
le = magic in (0xa1b2c3d4, 0xa1b23c4d)
fmt = '<IIII' if le else '>IIII'
off, changed = 24, 0
while off + 16 <= len(raw):
    _, _, incl, _ = struct.unpack(fmt, raw[off:off + 16]); off += 16
    f = off; off += incl
    if raw[f + 12:f + 14] != b'\x08\x00' or raw[f + 23] != 17: continue
    ihl = (raw[f + 14] & 0x0f) * 4
    ip = f + 14; udp = ip + ihl
    sport, dport, ulen = struct.unpack('!HHH', raw[udp:udp + 6])
    if {sport, dport} != {67, 68}: continue
    opts = udp + 8 + 240
    end = udp + ulen
    p = opts
    while p < end and raw[p] != 255:
        if raw[p] == 0: p += 1; continue
        code, ln = raw[p], raw[p + 1]
        if code == 1 and ln == 4:
            raw[p + 2:p + 6] = mask; changed += 1
        p += 2 + ln
    # recompute UDP checksum over pseudo header + UDP
    raw[udp + 6:udp + 8] = b'\0\0'
    pseudo = bytes(raw[ip + 12:ip + 20]) + struct.pack('!BBH', 0, 17, ulen)
    c = checksum(pseudo + bytes(raw[udp:udp + ulen])) or 0xffff
    raw[udp + 6:udp + 8] = struct.pack('!H', c)
open(path, 'wb').write(raw)
print('rewrote option 1 in %d DHCP packet(s) of %s' % (changed, path))
