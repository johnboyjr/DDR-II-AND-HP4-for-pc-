"""Konami 'CAE_WII' 2D layout / animation blocks (DDR II menus: select/sel*.bin, select_bin, 2Dcommon/comAF).

Layout of a block (big-endian):
  0   'CAE_WII\\0'
  8   u16 part count
  12  u32 offset of the part table
  part (32 bytes): name[16], u16 sprite, u16 parent part, u16 flags (0x100 = has parent),
                   u16 ?, u16 ?, u16 ?, u32 offset of its track headers
  track header (16 bytes): u16 kind (0x20 / 0x10), u16 sub, u16 0, u16 fps (30), u16 0,
                   u16 count, u32 offset of the script
  script: (command, value) float pairs, ending with command 0. Named from how the menus use them
  (the player in main.dol is not found yet, so names marked ? are inferred):
     8 X   9 Y   24 opacity (0-255)   21 wait N frames   22 wait (looping parts)?
     14 / 15 scale X / Y   13 scale (both)?   16 rotation   18 angle (degrees, +-40)?
     1 depth (higher = further back; comAF's loading ring)   12 ?   6 / 7 pivot X / Y   31 / 32 drawn size W / H?
     4, 5, 17, 33-36 always 0 in selMusic
Commands are applied in order; 21 advances time. Each part has its tracks in pairs (in / out).
From HP4's own player (main.dol 0x80158e34, its draw 0x80156e64 - same engine as DDR II):
     1 priority (higher further back; also links a masked part to the part one below)   4 texture frame
     5 / 6 / 7 pivot Z / X / Y   8 / 9 X / Y   12 Z (depth)   13 / 14 / 15 scale Z / X / Y
     16 / 17 / 18 turn about Z / X / Y   34 / 35 / 36 a second turn about X / Y / Z (the part's own axes)
     21 / 22 wait   24 opacity   37 / 38 / 39 red / green / blue of all four corners   40-51 the corners' RGB
     54 / 55, 57-64 texture coordinates   65 / 66 the sprite's width / height   31 / 32 and 67-70 do nothing
Track header: kind low bits 1 = masked by the part numbered one below (its alpha), byte 2 bit 0 = drawn in 3D
through the layout camera (0x80158240: eye 888.9 in front of the screen's middle, the plane at depth 0 shown 1:1),
bit 1 = pivot from the sprite's size."""
import struct

CMD = {8: 'x', 9: 'y', 24: 'alpha', 21: 'wait', 22: 'loopwait', 14: 'sx', 15: 'sy', 13: 'scale', 16: 'rot',
       18: 'angle', 1: 'cell', 12: 'cell2', 6: 'px', 7: 'py', 31: 'w', 32: 'h'}


def blocks(d, start=0):
    """every CAE block in a buffer: (offset, size)"""
    out, o = [], start
    while True:
        o = d.find(b'CAE_WII\0', o)
        if o < 0:
            return out
        out.append(o)
        o += 8


# a track's animation script: the list of commands from offset o
def script(d, o, limit=4096):
    cmds, t = [], 0
    for i in range(limit):
        if o + 8 * i + 8 > len(d):
            break
        c, v = struct.unpack_from('>ff', d, o + 8 * i)
        c = int(c)
        if c == 0:
            break
        if c in (21, 22):
            t += int(v)
        cmds.append((t, CMD.get(c, c), round(v, 3)))
    return cmds


# a CAE layout block: its parts, each with its tracks
def parse(d, o):
    n = struct.unpack_from('>H', d, o + 8)[0]
    tab = struct.unpack_from('>I', d, o + 12)[0]
    parts = []
    for i in range(n):
        p = o + tab + 32 * i
        name = d[p:p + 16].split(b'\0')[0].decode('latin1')
        sprite, parent, flags, a, b, c, toff = struct.unpack_from('>HHHHHHI', d, p + 16)
        parts.append(dict(name=name, sprite=sprite, parent=parent if flags & 0x100 else None,
                          flags=flags, a=a, b=b, c=c, toff=toff))
    # each part's own track headers: 'a' of them (16 bytes each) at its offset. (Track kinds seen: 0x10 /
    # 0x11 / 0x20 / 0x21, 0 = an empty one. An earlier reading walked the headers in one run from the first
    # part and split them evenly, which stopped at the first 0x11 / 0x21 track and mixed up blocks whose parts
    # have different track counts.)
    for p in parts:
        tracks = []
        for k in range(p['a']):
            h = o + p['toff'] + 16 * k
            if h + 16 > len(d):
                break
            kind, sub, _, fps, _, cnt, soff = struct.unpack_from('>HHHHHHI', d, h)
            tracks.append(dict(kind=kind, sub=sub, fps=fps, count=cnt, script=script(d, o + soff) if soff else []))
        p['tracks'] = tracks
        del p['toff']
    return parts
