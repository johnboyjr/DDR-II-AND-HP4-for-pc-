"""Miis: the Wii's own face library (RVL_SDK RFL, built into DDR II's main.dol) redone in Python.

  mii/RFLRes01.arc (on the disc)   a U8 archive holding RFL_Res.dat: every face part (shapes + pictures)
  RFL_DB.dat (the Wii's NAND)      the Mii Channel's Miis, 100 slots of 74 bytes ('RNOD' + data)

How a head is put together follows the SDK as decompiled by the Petari project (src/RVLFaceLib:
RFL_Model.c RFLiInitCharModelRes / RFLiInitShapeRes / RFLDrawOpaCore / RFLDrawXluCore, RFL_MakeTex.c
RFLiMakeTexture / RFLiSetFaceParts / RFLiDrawQuad, RFLi_Config.h for the tables), so the parts, their
places, sizes and colours are the library's own. Nothing from the disc is stored: the head is built
when the game asks for it.

What is NOT the library's: the face picture's layering is done with ordinary alpha blending (the SDK
draws the parts twice with destination-alpha tricks - the result for parts that don't overlap is the
same); the lighting is DDR II PC's own (the head gets the same light as the body it sits on).
"""
import math
import os
import struct

from array import array

# ------------------------------------------------------------------ the resource file
SECTIONS = ['Beard', 'Eye', 'Eyebrow', 'Faceline', 'FaceTex', 'ForeHead', 'Glass', 'GlassTex', 'Hair', 'Mask',
            'Mole', 'Mouth', 'Mustache', 'Nose', 'Nline', 'NlineTex', 'Cap', 'CapTex']


def u8_files(d):
    """a U8 archive -> {path: bytes}"""
    if d[:4] != b'\x55\xaa\x38\x2d':
        raise ValueError('not a U8 archive')
    root, hsize, data = struct.unpack_from('>III', d, 4)
    n = struct.unpack_from('>I', d, root + 8)[0]
    names = root + n * 12
    out, stack = {}, []
    path = ['']
    ends = []
    for i in range(1, n):
        while ends and i >= ends[-1]:
            ends.pop(); path.pop()
        t, no, a, b = d[root + i * 12], int.from_bytes(d[root + i * 12 + 1:root + i * 12 + 4], 'big'), \
            *struct.unpack_from('>II', d, root + i * 12 + 4)
        e = d.index(b'\0', names + no)
        nm = d[names + no:e].decode('latin-1')
        if t == 1:
            path.append(nm); ends.append(b)
        else:
            out['/'.join(p for p in path + [nm] if p)] = d[a:a + b]
    return out


class Res:
    """RFL_Res.dat: 18 sections (Beard ... CapTex), each a list of files"""

    def __init__(self, d):
        if d[:4] == b'\x55\xaa\x38\x2d':
            fs = u8_files(d)
            d = next(v for k, v in fs.items() if k.lower().endswith('rfl_res.dat'))
        self.d = d
        self.version = struct.unpack_from('>H', d, 2)[0]
        self.sec = {}
        for i, nm in enumerate(SECTIONS):
            so = struct.unpack_from('>I', d, 4 + 4 * i)[0]
            n = struct.unpack_from('>H', d, so)[0]
            offs = struct.unpack_from('>%dI' % (n + 1), d, so + 4)
            base = so + 4 + n * 4 + 4
            self.sec[nm] = [(base + offs[k], offs[k + 1] - offs[k]) for k in range(n)]

    def file(self, sec, i):
        fs = self.sec[sec]
        if i >= len(fs):
            return None
        o, n = fs[i]
        return self.d[o:o + n]

    @staticmethod
    def from_disc(files):
        p = os.path.join(files, 'mii', 'RFLRes01.arc')
        if not os.path.isfile(p):
            return None
        return Res(open(p, 'rb').read())


# ------------------------------------------------------------------ a Mii's data (RFLiCharData, 74 bytes)
def _bits(v, spec):
    """MSB-first bit fields of a big-endian word"""
    out, sh = {}, sum(w for _, w in spec)
    for name, w in spec:
        sh -= w
        out[name] = (v >> sh) & ((1 << w) - 1)
    return out


def parse(d):
    """74 bytes -> the fields RFL uses (RFL_Database.c convertRaw2InfoCore_)"""
    if len(d) < 74:
        return None
    w = lambda o: struct.unpack_from('>H', d, o)[0]
    m = {}
    m.update(_bits(w(0x00), [('pad0', 1), ('sex', 1), ('bmonth', 4), ('bday', 5), ('color', 4), ('favorite', 1)]))
    m['name'] = d[2:0x16].decode('utf-16-be', 'replace').split('\0')[0]
    m['height'], m['build'] = d[0x16], d[0x17]
    m['createID'] = d[0x18:0x20].hex()
    m.update(_bits(w(0x20), [('faceType', 3), ('faceColor', 3), ('faceTex', 4), ('p2', 3), ('localonly', 1), ('type', 2)]))
    m.update(_bits(w(0x22), [('hairType', 7), ('hairColor', 3), ('hairFlip', 1), ('p3', 5)]))
    m.update(_bits(w(0x24), [('eyebrowType', 5), ('eyebrowRotate', 5), ('p4', 6)]))
    m.update(_bits(w(0x26), [('eyebrowColor', 3), ('eyebrowScale', 4), ('eyebrowY', 5), ('eyebrowX', 4)]))
    m.update(_bits(w(0x28), [('eyeType', 6), ('eyeRotate', 5), ('eyeY', 5)]))
    m.update(_bits(w(0x2a), [('eyeColor', 3), ('eyeScale', 4), ('eyeX', 4), ('p5', 5)]))
    m.update(_bits(w(0x2c), [('noseType', 4), ('noseScale', 4), ('noseY', 5), ('p6', 3)]))
    m.update(_bits(w(0x2e), [('mouthType', 5), ('mouthColor', 2), ('mouthScale', 4), ('mouthY', 5)]))
    m.update(_bits(w(0x30), [('glassType', 4), ('glassColor', 3), ('glassScale', 4), ('glassY', 5)]))
    m.update(_bits(w(0x32), [('mustacheType', 2), ('beardType', 2), ('beardColor', 3), ('beardScale', 4), ('beardY', 5)]))
    m.update(_bits(w(0x34), [('moleType', 1), ('moleScale', 4), ('moleY', 5), ('moleX', 5), ('p8', 1)]))
    m['creator'] = d[0x36:0x4a].decode('utf-16-be', 'replace').split('\0')[0]
    return m


def database(d):
    """RFL_DB.dat -> [(slot, 74 bytes)] for every slot that holds a Mii ('RNOD', 100 x 74 bytes)"""
    if d[:4] != b'RNOD':
        return []
    out = []
    for i in range(100):
        o = 4 + 74 * i
        r = d[o:o + 74]
        if len(r) < 74:
            break
        if any(r[0x18:0x20]) and any(r[2:4]):       # a create ID and a name
            out.append((i, bytes(r)))
    return out


# the library's six stand-in Miis "Guest A-F" (RFL_DefaultDatabase.c scDefaultData), used when no Mii is set
GUESTS = [bytes.fromhex(h) for h in (
    '0008006e006f0020006e0061006d0065000000000000404080000000ecff82d2100488003180'
    '08a2088c0858144ab88d008a008a25040000000000000000000000000000000000000000',
    '000a006e006f0020006e0061006d0065000000000000404080000001ecff82d200046f803180'
    'c8a2088c8858144ab88d008a008a25040000000000000000000000000000000000000000',
    '0000006e006f0020006e0061006d0065000000000000404080000002ecff82d2040442403180'
    '28a2088c0858144ab88d008a008a25040000000000000000000000000000000000000000',
    '4004006e006f0020006e0061006d0065000000000000404080000003ecff82d2080430000180'
    '08a2106c0858144ab88d008a008a25040000000000000000000000000000000000000000',
    '400c006e006f0020006e0061006d0065000000000000404080000004ecff82d200041dc00180'
    'e8a2106ca858144ab88d008a008a25040000000000000000000000000000000000000000',
    '400e006e006f0020006e0061006d0065000000000000404080000005ecff82d2000418400180'
    '28a2106c0858144ab88d008a008a25040000000000000000000000000000000000000000')]

# ------------------------------------------------------------------ colours (RFL_Model.c, RFLi_Config.h)
FACELINE = [(240, 216, 196), (255, 188, 128), (216, 136, 80), (255, 176, 144), (152, 80, 48), (82, 46, 28)]
HAIR = [(30, 26, 24), (56, 32, 21), (85, 38, 23), (112, 64, 36), (114, 114, 120), (73, 54, 26), (122, 89, 40), (193, 159, 100)]
BEARD = HAIR
GLASS = [(16, 16, 16), (96, 56, 16), (152, 24, 16), (32, 48, 96), (144, 88, 0), (96, 88, 80)]
FAVORITE = [(184, 64, 48), (240, 120, 40), (248, 216, 32), (128, 200, 40), (0, 116, 40), (32, 72, 152), (64, 160, 216),
            (232, 96, 120), (112, 44, 168), (72, 56, 24), (224, 224, 224), (24, 24, 20)]
MOLE0 = (18, 15, 15)
EYE1 = [(0, 0, 0), (124, 128, 128), (112, 80, 64), (112, 110, 64), (88, 104, 184), (72, 128, 104)]
EYEBROW0 = HAIR
MOUTH0 = [(190, 78, 38), (216, 48, 40), (207, 68, 71)]
MOUTH1 = [(113, 42, 4), (120, 21, 16), (126, 37, 40)]
MUSTACHE0 = HAIR
EYE_ROT_OFFSET = [29, 28, 28, 28, 29, 28, 28, 28, 29, 28, 28, 28, 28, 29, 29, 28, 28, 28, 29, 29, 28, 29, 28, 29, 29, 28,
                  29, 28, 28, 29, 28, 28, 28, 29, 29, 29, 28, 28, 29, 29, 29, 28, 28, 29, 29, 29, 29, 29, 28, 28]
EYEBROW_ROT_OFFSET = [26, 26, 27, 25, 26, 25, 26, 25, 28, 25, 26, 24, 27, 27, 26, 26, 25, 25, 26, 26, 27, 26, 25, 27]

# ------------------------------------------------------------------ pictures (plain Python: the server needs no add-ons)
class Img:
    """an RGBA picture, floats 0..1, row by row (px[4 * (y * w + x) + c])"""

    def __init__(self, w, h, px=None):
        self.w, self.h = w, h
        self.px = px if px is not None else array('f', bytes(16 * w * h))

    def get(self, x, y):
        o = 4 * (y * self.w + x)
        return self.px[o:o + 4]

    def map(self, fn):
        """a new picture with fn(r, g, b, a) -> (r, g, b, a) for every pixel"""
        px, out = self.px, array('f', bytes(16 * self.w * self.h))
        for o in range(0, len(px), 4):
            out[o:o + 4] = array('f', fn(px[o], px[o + 1], px[o + 2], px[o + 3]))
        return Img(self.w, self.h, out)

    def mirrored_twice(self):
        """the picture and its left-right mirror image side by side (2w x h)"""
        w, h, px = self.w, self.h, self.px
        out = array('f')
        for y in range(h):
            row = px[4 * y * w:4 * (y + 1) * w]
            back = array('f')
            for x in range(w - 1, -1, -1):
                back.extend(row[4 * x:4 * x + 4])
            out.extend(row)
            out.extend(back)
        return Img(2 * w, h, out)

    def sample(self, s, t):
        """bilinear, clamped; s, t in 0..1"""
        w, h, px = self.w, self.h, self.px
        sx = min(max(s * w - 0.5, 0.0), w - 1.0)
        sy = min(max(t * h - 0.5, 0.0), h - 1.0)
        x0, y0 = int(sx), int(sy)
        x1, y1 = min(x0 + 1, w - 1), min(y0 + 1, h - 1)
        fx, fy = sx - x0, sy - y0
        a, b = 4 * (y0 * w + x0), 4 * (y0 * w + x1)
        c, d = 4 * (y1 * w + x0), 4 * (y1 * w + x1)
        k0, k1, k2, k3 = (1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy
        return [px[a + i] * k0 + px[b + i] * k1 + px[c + i] * k2 + px[d + i] * k3 for i in range(4)]

    def nearest(self, s, t):
        x = min(max(int(s * self.w), 0), self.w - 1)
        y = min(max(int(t * self.h), 0), self.h - 1)
        o = 4 * (y * self.w + x)
        return self.px[o:o + 4]


def texture(f):
    """an RFL picture (RFLiTexture: format, alpha, width, height, ... image offset at +0x1c) -> Img"""
    fmt = f[0]
    w, h = struct.unpack_from('>HH', f, 2)
    img = struct.unpack_from('>I', f, 0x1c)[0]
    return gx_decode(f[img:], w, h, fmt)


def gx_decode(d, w, h, fmt):
    """GX texture formats 0 I4, 1 I8, 2 IA4, 3 IA8, 4 RGB565, 5 RGB5A3, 6 RGBA8 (tiled) -> Img"""
    bw, bh = {0: (8, 8), 1: (8, 4), 2: (8, 4), 3: (4, 4), 4: (4, 4), 5: (4, 4), 6: (4, 4)}[fmt]
    out = Img(w, h)
    px = out.px
    p = 0

    def put(x, y, r, g, b, a):
        if x < w and y < h:
            o = 4 * (y * w + x)
            px[o], px[o + 1], px[o + 2], px[o + 3] = r, g, b, a
    for ty in range(0, h, bh):
        for tx in range(0, w, bw):
            if fmt == 6:
                ar, gb = d[p:p + 32], d[p + 32:p + 64]
                p += 64
                for i in range(16):
                    put(tx + (i & 3), ty + (i >> 2), ar[2 * i + 1] / 255.0, gb[2 * i] / 255.0, gb[2 * i + 1] / 255.0, ar[2 * i] / 255.0)
                continue
            for y in range(bh):
                for x in range(bw):
                    if fmt == 0:
                        v = d[p + ((y * bw + x) >> 1)]
                        v = ((v >> 4) if not x & 1 else (v & 15)) / 15.0
                        put(tx + x, ty + y, v, v, v, v)
                    elif fmt == 1:
                        v = d[p + y * bw + x] / 255.0
                        put(tx + x, ty + y, v, v, v, v)
                    elif fmt == 2:
                        v = d[p + y * bw + x]
                        i = (v & 15) / 15.0
                        put(tx + x, ty + y, i, i, i, (v >> 4) / 15.0)
                    elif fmt == 3:
                        q = p + 2 * (y * bw + x)
                        i = d[q + 1] / 255.0
                        put(tx + x, ty + y, i, i, i, d[q] / 255.0)
                    else:
                        q = p + 2 * (y * bw + x)
                        v = (d[q] << 8) | d[q + 1]
                        if fmt == 4:
                            put(tx + x, ty + y, (v >> 11) / 31.0, ((v >> 5) & 63) / 63.0, (v & 31) / 31.0, 1.0)
                        elif v & 0x8000:
                            put(tx + x, ty + y, ((v >> 10) & 31) / 31.0, ((v >> 5) & 31) / 31.0, (v & 31) / 31.0, 1.0)
                        else:
                            put(tx + x, ty + y, ((v >> 8) & 15) / 15.0, ((v >> 4) & 15) / 15.0, (v & 15) / 15.0, ((v >> 12) & 7) / 7.0)
            p += 32
    return out


# ------------------------------------------------------------------ shapes (RFLiInitShapeRes)
def shape(f, txc, transform=None, flip=False):
    """a shape file -> dict(pos, nrm, uv, tris, extra) in RFL units (positions fixed point / 256);
    transform = (scale, (tx, ty, tz)) as RFLiInitShapeRes does it (in the 1/256 fixed point)"""
    p = 4
    extra = None
    if f[:4] == b'face':
        extra = [struct.unpack_from('>3f', f, 4 + 12 * k) for k in range(3)]      # nose, beard, hair places
        p += 36
    n = struct.unpack_from('>H', f, p)[0]
    if n == 0:
        return dict(pos=[], nrm=[], uv=[], tris=[], extra=extra)
    p += 2
    raw = struct.unpack_from('>%dh' % (3 * n), f, p); p += 6 * n
    pos = []
    for i in range(n):
        x, y, z = raw[3 * i:3 * i + 3]
        if transform:
            s = int(256.0 * transform[0])
            tx, ty, tz = (int(256.0 * c) for c in transform[1])
            x = tx + (((-x if flip else x) * s) >> 8)
            y = ty + ((y * s) >> 8)
            z = tz + ((z * s) >> 8)
            x, y, z = (((v + 0x8000) & 0xffff) - 0x8000 for v in (x, y, z))     # (stored as s16)
        elif flip:
            x = -x
        pos.append((x / 256.0, y / 256.0, z / 256.0))
    nn = struct.unpack_from('>H', f, p)[0]; p += 2
    rn = struct.unpack_from('>%dh' % (3 * nn), f, p); p += 6 * nn
    nrm = [((-rn[3 * i] if flip else rn[3 * i]) / 16384.0, rn[3 * i + 1] / 16384.0, rn[3 * i + 2] / 16384.0) for i in range(nn)]
    uv = []
    if txc:
        nt = struct.unpack_from('>H', f, p)[0]; p += 2
        rt = struct.unpack_from('>%dh' % (2 * nt), f, p); p += 4 * nt
        uv = [(rt[2 * i] / 8192.0, rt[2 * i + 1] / 8192.0) for i in range(nt)]
    # display list: primitive count, then per primitive: vertex count, GX primitive, indices (pos, nrm[, txc])
    prims = f[p]; p += 1
    verts, tris = [], []
    for _ in range(prims):
        vn, prim = f[p], f[p + 1]; p += 2
        ids = []
        for _ in range(vn):
            if txc:
                ids.append((f[p], f[p + 1], f[p + 2])); p += 3
            else:
                ids.append((f[p], f[p + 1], 0)); p += 2
        base = len(verts)
        verts.extend(ids)
        k = list(range(base, base + vn))
        if prim == 0x90:                            # triangles
            tris += [(k[i], k[i + 1], k[i + 2]) for i in range(0, vn - 2, 3)]
        elif prim == 0x98:                          # strip
            tris += [(k[i], k[i + 1], k[i + 2]) if i % 2 == 0 else (k[i + 1], k[i], k[i + 2]) for i in range(vn - 2)]
        elif prim == 0xa0:                          # fan
            tris += [(k[0], k[i], k[i + 1]) for i in range(1, vn - 1)]
        elif prim == 0x80:                          # quads
            for i in range(0, vn - 3, 4):
                tris += [(k[i], k[i + 1], k[i + 2]), (k[i], k[i + 2], k[i + 3])]
    if flip:                                        # mirrored: keep the faces facing out
        tris = [(a, c, b) for a, b, c in tris]
    P = [pos[v[0]] if v[0] < len(pos) else (0, 0, 0) for v in verts]
    N = [nrm[v[1]] if v[1] < len(nrm) else (0, 1, 0) for v in verts]
    T = [uv[v[2]] if v[2] < len(uv) else (0, 0) for v in verts] if txc else []
    return dict(pos=P, nrm=N, uv=T, tris=tris, extra=extra)


# ------------------------------------------------------------------ the face picture (RFL_MakeTex.c)
TEX_SCALE_X, TEX_SCALE_Y = 0.88961464, 0.9276675
S2D = lambda s: 1.0 + 0.4 * s
ROT = lambda r: (360.0 / 32.0) * (r % 32)
U = lambda x: x / 64.0


def _colorize(tex, kind, info):
    """a part's picture -> its colours as its TEV stages make them (RFLiSetTev4Eye / Mouth / Eyebrow ...):
    eyes R x colour 0 + B x eye colour + G (white), mouth R x colour 0 + G x colour 1 + B; the rest one
    colour with the picture's alpha"""
    c = lambda t: [v / 255.0 for v in t]
    if kind == 'eye':
        t = info['eyeType']
        c0 = c((255, 130, 0) if t == 9 else (0, 255, 255) if t == 20 else (0, 0, 0))
        c1 = c(EYE1[min(info['eyeColor'], 5)])
        f = lambda r, g, b, a: [min(1.0, r * c0[k] + b * c1[k] + g) for k in range(3)] + [a]
    elif kind == 'mouth':
        c0, c1 = c(MOUTH0[min(info['mouthColor'], 2)]), c(MOUTH1[min(info['mouthColor'], 2)])
        f = lambda r, g, b, a: [min(1.0, r * c0[k] + g * c1[k] + b) for k in range(3)] + [a]
    else:
        k0 = c(EYEBROW0[info['eyebrowColor']] if kind == 'eyebrow' else MUSTACHE0[info['beardColor']] if kind == 'mustache' else MOLE0)
        f = lambda r, g, b, a: k0 + [a]
    return tex.map(f)


def _quad(canvas, part, x, y, w, h, ang, origin):
    """RFLiDrawQuad into the picture: a w x h quad turned ang degrees about its origin point (x, y), y down
    (the SDK's 2D camera); drawn under what is there already, so what is drawn first stays on top"""
    th = math.radians(ang)
    co, si = math.cos(th), math.sin(th)
    base = {'center': -0.5, 'right': -1.0, 'left': 0.0}[origin]
    # the quad's corners on the canvas -> a box to look at
    pts = []
    for lx, ly in ((base, -0.5), (base + 1, -0.5), (base, 0.5), (base + 1, 0.5)):
        ux, uy = lx * w, ly * h
        pts.append((x + (co * ux - si * uy) * TEX_SCALE_X, y + (si * ux + co * uy) * TEX_SCALE_Y))
    W, H, px = canvas.w, canvas.h, canvas.px
    x0, x1 = max(0, int(min(p[0] for p in pts))), min(W - 1, int(max(p[0] for p in pts)) + 1)
    y0, y1 = max(0, int(min(p[1] for p in pts))), min(H - 1, int(max(p[1] for p in pts)) + 1)
    for py in range(y0, y1 + 1):
        qy = (py + 0.5 - y) / TEX_SCALE_Y
        for pxx in range(x0, x1 + 1):
            qx = (pxx + 0.5 - x) / TEX_SCALE_X
            lx = (co * qx + si * qy) / w
            ly = (-si * qx + co * qy) / h
            if lx < base or lx > base + 1 or ly < -0.5 or ly > 0.5:
                continue
            s = 1.0 - (lx - base) if origin == 'left' else lx - base     # (left: mirrored, s = 1 at x = 0)
            r, g, b, a = part.sample(s, ly + 0.5)
            o = 4 * (py * W + pxx)
            k = (1 - px[o + 3]) * a
            px[o] += k * r
            px[o + 1] += k * g
            px[o + 2] += k * b
            px[o + 3] += k


def face_picture(res, info, size=256, expression=0):
    """the face mask picture (eyes, brows, mouth, moustache, mole) -> RGBA float (size, size, 4), not
    premultiplied (an Img). expression: 0 normal, 5 blink (eye type 26), 6 open mouth (mouth 24), 1 smile (eye 48)"""
    info = dict(info)
    if expression in (1, 4, 5):
        nt = {1: 48, 4: 49, 5: 26}[expression]
        ch = EYE_ROT_OFFSET[info['eyeType']] - EYE_ROT_OFFSET[nt]
        info['eyeType'] = nt
        info['eyeRotate'] = max(0, min(7, info['eyeRotate'] + ch))
        if expression == 4:
            info['eyebrowY'] -= 2
    if expression == 6:
        info['mouthType'] = 24
    r = size / 64.0
    eyeX = U(0) + TEX_SCALE_X * info['eyeX']
    eyeY = 18.451525 + 1.1600001 * TEX_SCALE_Y * info['eyeY']
    eyeW, eyeH = U(342) * S2D(info['eyeScale']), U(288) * S2D(info['eyeScale'])
    eyeA = ROT(info['eyeRotate'] + EYE_ROT_OFFSET[info['eyeType']])
    ebX = U(0) + TEX_SCALE_X * info['eyebrowX']
    ebY = 16.549807 + 1.1600001 * TEX_SCALE_Y * info['eyebrowY']
    ebW, ebH = U(324) * S2D(info['eyebrowScale']), U(288) * S2D(info['eyebrowScale'])
    ebA = ROT(info['eyebrowRotate'] + EYEBROW_ROT_OFFSET[info['eyebrowType']])
    mY = 29.25885 + 1.1600001 * TEX_SCALE_Y * info['mouthY']
    mW, mH = U(396) * S2D(info['mouthScale']), U(288) * S2D(info['mouthScale'])
    muY = 31.763554 + 1.1600001 * TEX_SCALE_Y * info['beardY']
    muW, muH = U(288) * S2D(info['beardScale']), U(576) * S2D(info['beardScale'])
    moX = 17.766165 + 2.0 * TEX_SCALE_X * info['moleX']
    moY = 17.95986 + 1.1600001 * TEX_SCALE_Y * info['moleY']
    moW, moH = U(0) + S2D(info['moleScale']), U(0) + S2D(info['moleScale'])

    pic = lambda sec, i, kind: _colorize(texture(res.file(sec, i)), kind, info)
    canvas = Img(size, size)
    # the SDK's order (RFLiCapture): moustache, mouth, eyebrows, eyes, mole
    t = pic('Mustache', info['mustacheType'], 'mustache')
    _quad(canvas, t, r * 32, r * muY, r * muW, r * muH, 0, 'right')
    _quad(canvas, t, r * 32, r * muY, r * muW, r * muH, 0, 'left')
    _quad(canvas, pic('Mouth', info['mouthType'], 'mouth'), r * 32, r * mY, r * mW, r * mH, 0, 'center')
    t = pic('Eyebrow', info['eyebrowType'], 'eyebrow')
    _quad(canvas, t, r * (32 - ebX), r * ebY, r * ebW, r * ebH, ebA, 'right')
    _quad(canvas, t, r * (32 + ebX), r * ebY, r * ebW, r * ebH, 360 - ebA, 'left')
    t = pic('Eye', info['eyeType'], 'eye')
    _quad(canvas, t, r * (32 - eyeX), r * eyeY, r * eyeW, r * eyeH, eyeA, 'right')
    _quad(canvas, t, r * (32 + eyeX), r * eyeY, r * eyeW, r * eyeH, 360 - eyeA, 'left')
    if info['moleType']:
        _quad(canvas, pic('Mole', info['moleType'], 'mole'), r * moX, r * moY, r * moW, r * moH, 0, 'center')
    # (added up premultiplied; back to plain colours)
    return canvas.map(lambda r_, g, b, a: (r_ / a, g / a, b / a, a) if a > 1e-6 else (0, 0, 0, 0))


# ------------------------------------------------------------------ the head (RFLiInitCharModelRes + draw)
def head(res, info, size=256, expression=0):
    """-> [part]: part = dict(name, pos, nrm, uv, tris, color (r, g, b) 0-255 or None, tex (Img)
    or None, blend (alpha blended, drawn after the solid parts), cull ('back' | 'front' | 'none'))"""
    fl = shape(res.file('Faceline', info['faceType']), True)
    noseT, beardT, hairT = fl['extra']
    flip = bool(info['hairFlip'])
    parts = []

    def add(name, sh, color=None, tex=None, blend=False, cull='back', mirror=False):
        if sh['tris']:
            uv = sh['uv']
            if mirror and tex is not None and uv and max(u for u, _ in uv) > 1.001:
                # the picture repeats mirrored across u (its wrapS = 2): u runs 0..2 over the two halves; laid
                # out here as one picture twice as wide (left half + its mirror image), u halved
                tex = tex.mirrored_twice()
                uv = [(u / 2.0, v) for u, v in uv]
            parts.append(dict(name=name, color=color, tex=tex, blend=blend, cull=cull, pos=sh['pos'], nrm=sh['nrm'], uv=uv, tris=sh['tris']))

    # solid parts (RFLDrawOpaCore): beard, nose, forehead, hair (hair colour), cap (favourite colour), face
    beard = shape(res.file('Beard', info['beardType']), False, (1.0, beardT))
    add('beard', beard, BEARD[info['beardColor']])
    ns = 0.4 + 0.175 * info['noseScale']
    nt = (noseT[0], noseT[1] + -1.5 * (info['noseY'] - 8), noseT[2])
    add('nose', shape(res.file('Nose', info['noseType']), False, (ns, nt)), FACELINE[info['faceColor']])
    add('forehead', shape(res.file('ForeHead', info['hairType']), False, (1.0, hairT), flip), FACELINE[info['faceColor']])
    add('hair', shape(res.file('Hair', info['hairType']), False, (1.0, hairT), flip), HAIR[info['hairColor']])
    cap = shape(res.file('Cap', info['hairType']), True, (1.0, hairT), flip)
    if cap['tris']:
        # colour = favourite x (1 + picture) / 2 (TEV: KONST + TEXC x KONST, divided by 2)
        fav = [v / 255.0 for v in FAVORITE[min(info['color'], 11)]]
        add('cap', cap, None, texture(res.file('CapTex', info['hairType'])).map(
            lambda r, g, b, a: (fav[0] * (1 + r) / 2, fav[1] * (1 + g) / 2, fav[2] * (1 + b) / 2, 1.0)))
    # the face: lerp(skin, picture rgb, picture "alpha") with the swap table (R, A, B, G) -> rgb = (R, A, B), mix = G
    sk = [v / 255.0 for v in FACELINE[info['faceColor']]]
    face_rgba = texture(res.file('FaceTex', info['faceTex'])).map(
        lambda r, g, b, a: (sk[0] * (1 - g) + r * g, sk[1] * (1 - g) + a * g, sk[2] * (1 - g) + b * g, 1.0))
    add('face', fl, None, face_rgba, mirror=_mirror(res, 'FaceTex', info['faceTex']))
    # see-through parts (RFLDrawXluCore): the face picture on the mask, the nose line, the glasses
    add('mask', shape(res.file('Mask', info['faceType']), True), None, face_picture(res, info, size, expression), True)
    nl = shape(res.file('Nline', info['noseType']), True, (ns, nt))
    if nl['tris']:
        t = texture(res.file('NlineTex', info['noseType']))
        add('noseline', nl, None, t.map(lambda r, g, b, a: (0, 0, 0, a)), True)
    if info['glassType']:
        gs = 0.15 * info['glassScale'] + 0.4
        gt = (noseT[0], 5.0 + noseT[1] + -1.5 * (info['glassY'] - 11), 2.0 + noseT[2])
        t = texture(res.file('GlassTex', info['glassType']))
        gc = [v / 255.0 for v in GLASS[info['glassColor']]]
        add('glasses', shape(res.file('Glass', 0), True, (gs, gt)), None,
            t.map(lambda r, g, b, a: (gc[0] * r, gc[1] * g, gc[2] * b, a)), True, 'none', _mirror(res, 'GlassTex', info['glassType']))
    return parts


def _mirror(res, sec, i):
    """does that picture repeat mirrored across u (RFLiTexture +6 wrapS = 2, GX_MIRROR)?"""
    f = res.file(sec, i)
    return bool(f) and f[6] == 2


def png(img):
    """Img -> PNG bytes"""
    import hp
    b = bytes(min(255, max(0, int(v * 255 + 0.5))) for v in img.px)
    return hp.png(img.w, img.h, b)


# ------------------------------------------------------------------ the Mii's picture (RFL_Icon.c RFLiMakeIcon)
def icon(parts, size=96):
    """the head drawn as the SDK draws a Mii's icon -> Img (size x size), transparent behind it:
    perspective fovy 2 x atan(43.2 / 500), camera (0, 34.5, 600) looking at (0, 34.5, 0), one white light
    at (1600, 1500, 6000), ambient 160 grey, diffuse clamped; the see-through parts drawn after the solid
    ones with ordinary alpha blending (no depth writes). Lit per corner, nearest texel: a small picture."""
    W = H = size
    f = 1.0 / math.tan(math.atan2(43.2, 500.0))
    cx, cy, cz = 0.0, 34.5, 600.0
    out = Img(W, H)
    px = out.px
    zb = [1e30] * (W * H)
    for pt in [p for p in parts if not p['blend']] + [p for p in parts if p['blend']]:
        S_, lit = [], []
        for (x, y, z), (nx, ny, nz) in zip(pt['pos'], pt['nrm']):
            d = cz - z
            S_.append((W / 2 + (x - cx) / d * f * W / 2, H / 2 - (y - cy) / d * f * H / 2, d))
            lx, ly, lz = 1600.0 - x, 1500.0 - y, 6000.0 - z
            ln = math.sqrt(lx * lx + ly * ly + lz * lz) or 1.0
            nn = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
            lit.append(min(1.0, 160 / 255.0 + max(0.0, min(1.0, (nx * lx + ny * ly + nz * lz) / ln / nn))))
        tex, uv = pt['tex'], pt['uv']
        col = [v / 255.0 for v in (pt['color'] or (255, 255, 255))]
        blend, cull = pt['blend'], pt['cull'] != 'none'
        for a, b, c in pt['tris']:
            A, B, C = S_[a], S_[b], S_[c]
            area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0])
            if abs(area) < 1e-9 or (cull and area <= 0):
                continue
            x0, x1 = max(0, int(min(A[0], B[0], C[0]))), min(W - 1, int(max(A[0], B[0], C[0])) + 1)
            y0, y1 = max(0, int(min(A[1], B[1], C[1]))), min(H - 1, int(max(A[1], B[1], C[1])) + 1)
            for yy in range(y0, y1 + 1):
                py = yy + 0.5
                for xx in range(x0, x1 + 1):
                    pxx = xx + 0.5
                    w0 = ((B[0] - pxx) * (C[1] - py) - (B[1] - py) * (C[0] - pxx)) / area
                    w1 = ((C[0] - pxx) * (A[1] - py) - (C[1] - py) * (A[0] - pxx)) / area
                    w2 = 1 - w0 - w1
                    if w0 < 0 or w1 < 0 or w2 < 0:
                        continue
                    z = w0 * A[2] + w1 * B[2] + w2 * C[2]
                    k = yy * W + xx
                    if z > zb[k] + (0.05 if blend else 0):
                        continue
                    l = w0 * lit[a] + w1 * lit[b] + w2 * lit[c]
                    if tex is not None and uv:
                        u = w0 * uv[a][0] + w1 * uv[b][0] + w2 * uv[c][0]
                        v = w0 * uv[a][1] + w1 * uv[b][1] + w2 * uv[c][1]
                        t = tex.nearest(u, v)
                        r, g, bb, al = t[0] * col[0], t[1] * col[1], t[2] * col[2], t[3]
                    else:
                        r, g, bb, al = col[0], col[1], col[2], 1.0
                    o = 4 * k
                    px[o] = px[o] * (1 - al) + r * l * al
                    px[o + 1] = px[o + 1] * (1 - al) + g * l * al
                    px[o + 2] = px[o + 2] * (1 - al) + bb * l * al
                    px[o + 3] = px[o + 3] * (1 - al) + al
                    if not blend:
                        zb[k] = z
    return out


# ------------------------------------------------------------------ where your Miis are (read only)
def nand_candidates():
    """Dolphin's Wii NAND copies of the Mii Channel's Miis: the usual Dolphin user folders"""
    home = os.path.expanduser('~')
    roots = [os.path.join(home, 'Documents', 'Dolphin Emulator'), os.path.join(home, 'OneDrive', 'Documents', 'Dolphin Emulator'),
             os.path.join(os.environ.get('APPDATA', ''), 'Dolphin Emulator') if os.environ.get('APPDATA') else None,
             os.path.join(home, '.local', 'share', 'dolphin-emu'), os.path.join(home, '.dolphin-emu'),
             os.path.join(home, 'Library', 'Application Support', 'Dolphin')]
    out = []
    for r in roots:
        if r:
            out.append(os.path.join(r, 'Wii', 'shared2', 'menu', 'FaceLib', 'RFL_DB.dat'))
    return out


def all_miis(extra_db=None, folder=None):
    """-> [dict(key, name, creator, sex, color, favorite, src, hex)]: the Miis in Dolphin's NAND (RFL_DB.dat,
    or extra_db), then single Mii files (.mii / .rcd / .rsd, 74 or 76 bytes) in folder, then the library's
    six Guests. Files are only read."""
    out, seen = [], set()

    def add(key, raw, src, name=None):
        m = parse(raw)
        if not m:
            return
        sig = raw[:74]
        if sig in seen:
            return
        seen.add(sig)
        out.append(dict(key=key, name=name or m['name'] or 'no name', creator=m['creator'], sex=m['sex'], color=m['color'],
                        favorite=m['favorite'], src=src, hex=raw[:74].hex()))
    for p in ([extra_db] if extra_db else []) + nand_candidates():
        try:
            if p and os.path.isfile(p):
                for slot, raw in database(open(p, 'rb').read()):
                    add('n%d' % slot, raw, 'wii')
                break
        except OSError:
            pass
    if folder and os.path.isdir(folder):
        for f in sorted(os.listdir(folder)):
            if os.path.splitext(f)[1].lower() in ('.mii', '.rcd', '.rsd', '.miigx'):
                try:
                    raw = open(os.path.join(folder, f), 'rb').read()
                except OSError:
                    continue
                if len(raw) in (74, 76):
                    add('f' + f, raw, 'file')
    for i, g in enumerate(GUESTS):
        add('g%d' % i, g, 'guest', 'Guest ' + 'ABCDEF'[i])
    return out
