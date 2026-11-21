"""Hottest Party 2's dancers, for web/stage.js (the same shape hpchar.py gives for Hottest Party).

  files/character/CHRxy0.bin   a dancer: a WII container with two ZMB models
                                 0  the body: a 44-joint skeleton (Hips, legs, Spine, arms, fingers,
                                    Neck, Head, mii_head) and one skinned mesh node (n_01_body)
                                 1  the head: a rigid model (face, eyes, mouth) worn on mii_head
  files/character/CHRxyN.bin   outfit N of that dancer: two TPLs (body texture, head textures)
  files/motion/MOT010_SSQnnn.bin  song nnn's dance: ZAB clips that play one after another from the
                                 start of the song, 60 frames a second

Skin weights: each mesh's weight offset leads to one (count, offset) pair per position; each
influence is 0x40 bytes: a 32-byte joint name ... and the weight (f32) at +0x3c.
Positions are in model space (the bind pose), so the browser poses the skeleton and blends.
"""
import base64
import math
import os
import struct
from array import array

import hp2
import hp2stage as S
from hp2stage import Zmb, wii_entries, b64f, zab, quat_euler


# 16-bit numbers -> base64 text for the page
def u16b64(v):
    return base64.b64encode(array('H', v).tobytes()).decode()


def mesh(z, r):
    """like Zmb.mesh, for character meshes: header word 1's high half = extra uv sets per corner"""
    Z = z.z
    (mid, kind, nf, npos, _, nnrm, nuv, ncol, fo, po, wo, no, uo, co) = struct.unpack_from('>14I', Z, r)
    extra = kind >> 16
    P = [struct.unpack_from('>3f', Z, po + 12 * i) for i in range(npos)]
    N = [struct.unpack_from('>3f', Z, no + 12 * i) for i in range(nnrm)] if no else []
    T = [struct.unpack_from('>2f', Z, uo + 8 * i) for i in range(nuv)] if uo else []
    C = [tuple(Z[co + 4 * i:co + 4 * i + 4]) for i in range(ncol)] if co else []
    faces, p = [], fo
    for _ in range(nf):
        k, nc = struct.unpack_from('>HH', Z, p)
        lists = struct.unpack_from('>%dI' % (4 + extra), Z, p + 4)
        p += 20 + 12 * extra                         # (extra uv set offset, then two zero words)
        # (an extra uv set's index list is the 5th: HP4's eyes / mouth meshes use it for the face picture
        # laid over the head skin, while set 1 maps the skin under it)
        faces.append([tuple(struct.unpack_from('>I', Z, lst + 4 * c)[0] if lst else 0 for lst in lists[:5])
                      for c in range(nc)])
    W = []
    if wo:
        for i in range(npos):
            cnt, off = struct.unpack_from('>II', Z, wo + 8 * i)
            inf = []
            for j in range(min(cnt, 8)):
                e = off + 0x40 * j
                nm = Z[e:e + 32]
                inf.append((nm[:nm.index(b'\0')].decode('latin1'), struct.unpack_from('>f', Z, e + 0x3c)[0]))
            W.append(inf)
    return mid, P, N, T, C, faces, W


def decompose(m):
    """a ZMB node matrix (row vectors, translation last) -> pos, rotation in degrees (Rz.Ry.Rx), scale"""
    s = [math.sqrt(m[4 * r] ** 2 + m[4 * r + 1] ** 2 + m[4 * r + 2] ** 2) or 1.0 for r in range(3)]
    R = [[m[4 * r + c] / s[r] for c in range(3)] for r in range(3)]      # R[r] = image of axis r
    m00, m10, m20 = R[0][0], R[0][1], R[0][2]
    m21, m22 = R[1][2], R[2][2]
    ry = math.asin(max(-1.0, min(1.0, -m20)))
    if abs(m20) < 0.9999:
        rx = math.atan2(m21, m22)
        rz = math.atan2(m10, m00)
    else:                                                    # gimbal lock: put it all in x
        rz = 0.0
        rx = math.atan2(-R[2][1], R[1][1])
    return [m[12], m[13], m[14]], [math.degrees(rx), math.degrees(ry), math.degrees(rz)], s


# each vertex's bone weights cut to the 4 biggest (what the page's skinning takes)
def pack4(ws):
    J, Wt = [], []
    for pairs in ws:
        pairs = sorted(pairs, key=lambda x: -x[1])[:4]
        t = sum(w for _, w in pairs) or 1.0
        pairs = [(j, w / t) for j, w in pairs] + [(0, 0.0)] * (4 - len(pairs))
        for j, w in pairs:
            J.append(j)
            Wt.append(w)
    return J, Wt


def _tpls(path):
    """an outfit file -> its TPLs as (data, offset)"""
    d = open(path, 'rb').read()
    return [(d, o) for _, o, _ in wii_entries(d)]


# a TPL file's pictures by name
def _bitmaps(tpl, names):
    out = []
    if not tpl:
        return out
    d, off = tpl
    for i, (w, h, fmt, o) in enumerate(hp2.tpl_list(d, off)):
        png = hp2.tpl_png(d, w, h, fmt, o)
        out.append(dict(name=names[i] if i < len(names) else '', w=w, h=h,
                        png=base64.b64encode(png).decode() if png else ''))
    return out


# does any of these mesh rows have skin data (its 11th field is not 0)?
def _skinned(model, rows):
    for r in rows:
        try:
            if struct.unpack_from('>14I', model.z, r)[10]:
                return True
        except struct.error:
            pass
    return False


# DDR II's Mii head on a Mii body: main.dol 0x80057d14 puts the face library's model (RFL) at the body's
# 'mii_head' joint, moved (0, -0.2, 0) and scaled 0.05 x 0.7 = 0.035 (0x802715dc-f0 x 0x802e84d0; the
# head object's matrix is built by 0x80188828 as joint x translate x scale x rotate, rotation 0)
MII_HEAD_MOVE = (0.0, -0.2, 0.0)
MII_HEAD_SCALE = 0.05 * 0.7


def _mii_head(heads, mj, place, materials, meshes, bitmaps, attrs):
    """heads = [parts per face picture] from mii.head (index 0 normal, then smile, blink): adds the head's
    meshes, held rigidly by joint mj; the face picture switches like DDR II's own heads (material face slot 3)"""
    import mii as MII
    parts = heads[0]
    tx, ty, tz = MII_HEAD_MOVE
    k = MII_HEAD_SCALE

    def bitmap(rgba, name):
        bitmaps.append(dict(name=name, w=rgba.w, h=rgba.h, png=base64.b64encode(MII.png(rgba)).decode()))
        attrs.append(dict(bitmap=len(bitmaps) - 1, wrapS=1, wrapT=1))
        return len(attrs) - 1
    for pi_, pt in enumerate(parts):
        m = dict(color=[255, 255, 255], vtx=1, alpha=1.0, flags=0, attrs=[], cut=None)
        if pt['color']:
            m['rgba'] = [c / 255.0 for c in pt['color']] + [1.0]
        if pt['tex'] is not None:
            m['attrs'] = [bitmap(pt['tex'], 'mii_' + pt['name'])]
        if pt['blend']:
            m['blend'] = True
        m['cull'] = pt['cull']
        if pt['name'] == 'mask' and len(heads) > 1:     # face slot 3: [normal, smile, blink] (0x80188a04)
            m['face'] = 3
            m['faceAttrs'] = [m['attrs'][0]] + [bitmap(h[pi_]['tex'], 'mii_mask%d' % e) for e, h in enumerate(heads[1:], 1)]
        materials.append(m)
        mat = len(materials) - 1
        P, N, U = [], [], []
        for tri in pt['tris']:
            for v in (tri[0], tri[2], tri[1]):          # (GX's front faces turn the other way from glTF's)
                x, y, z = pt['pos'][v]
                P.append(S.mat_mul_point(place, (x * k + tx, y * k + ty, z * k + tz)))
                N.append(S.mat_mul_dir(place, pt['nrm'][v]))
                U.extend(pt['uv'][v] if pt['uv'] else (0.0, 0.0))
        if not P:
            continue
        idx = list(range(len(P)))
        vj, vwt = pack4([[(mj, 1.0)]] * len(P))
        meshes.append(dict(obj=mj, nv=len(P), nn=len(N), pos=b64f([c for p in P for c in p]), nrm=b64f([c for n in N for c in n]),
                           groups=[dict(mat=mat, n=len(idx), pi=u16b64(idx), ni=u16b64(idx), uv=b64f(U),
                                        col=base64.b64encode(bytes([255] * 4 * len(idx))).decode())],
                           vj=u16b64(vj), vw=b64f(vwt), nj=u16b64(vj), nw=b64f(vwt)))


def character(base, outfit=None, acc=(), mii=None, parts=None):
    """CHRxy0.bin (+ an outfit CHRxyN.bin) -> {objects, meshes, materials, attrs, bitmaps}
    acc: accessory files to wear, (joint name, path) - files/accessory/<joint>_<name>.bin, a WII container of
    a ZMB model and its TPL, held rigidly by the same-named joint (HP4 0x80107734, table 0x802543e8)
    mii: a Mii for the body's 'mii_head' joint: dict(heads=[parts] per face picture (mii.head), skin=(r, g, b),
    fav=(r, g, b)) - the skin and favourite colours also go on the body's tagged materials
    parts: {group 1-4: outfit file} - a Mii body's materials tagged 10 x group + n take their pictures from
    that file instead (DDR II's OUTFIT 1-4: Dolphin 2026-11-21, a new jacket changed only the jacket)"""
    d = open(base, 'rb').read()
    es = wii_entries(d)
    body = Zmb(d[es[0][1]:es[0][1] + es[0][2]])
    head = Zmb(d[es[1][1]:es[1][1] + es[1][2]]) if len(es) > 1 else None
    tpls = _tpls(outfit) if outfit and os.path.isfile(outfit) else []

    nodes = body.nodes()
    index = {n['name']: i for i, n in enumerate(nodes)}
    world = {}

    def wm(i):
        if i not in world:
            w = nodes[i]['m']
            p = nodes[i]['parent']
            if 0 <= p < len(nodes) and p != i:
                w = S.mat4mul(w, wm(p))
            world[i] = w
        return world[i]
    objects = []
    for n in nodes:
        pos, rot, scl = decompose(n['m'])
        objects.append(dict(name=n['name'], type=2 if n['meshes'] else 0, parent=n['parent'], pos=pos, rot=rot, scl=scl))

    # textures: body pictures, then head pictures; attrs = one per picture
    bitmaps = _bitmaps(tpls[0] if tpls else None, body.textures())
    nb = len(bitmaps)
    bitmaps += _bitmaps(tpls[1] if len(tpls) > 1 else None, head.textures() if head else [])
    # (a Mii body's parts dressed from other outfit files: their body pictures, after the rest)
    part_base = {}
    for grp, pf in (parts or {}).items():
        try:
            pt = _tpls(pf)
        except Exception:
            pt = []
        if pt:
            part_base[grp] = len(bitmaps)
            bitmaps += _bitmaps(pt[0], body.textures())
    attrs = [dict(bitmap=i, wrapS=1, wrapT=1) for i in range(len(bitmaps))]
    materials = []

    def mats_of(model):
        """character materials: 0x38-byte records (RGBA bytes x3, f32, 4 flag bytes, texture count,
        offset of the texture index list)"""
        Z = model.z
        o = model.u32(0x1c)
        n, _, p = struct.unpack_from('>IfI', Z, o)
        out = []
        for i in range(min(n, 64)):
            r = p + 0x38 * i
            nt, to = struct.unpack_from('>II', Z, r + 0x14)
            # +0x15 face slot (1 eyes, 2 mouth; 0x80057d14 swaps its texture at run time), +0x17 how many
            # of the texture list it cycles through (7 eyes, 3 mouths)
            # (+0x28 high half: a colour tag - 0x8015d224 gives every material whose tag is k + 1 the colour
            # set for k: on a Mii body, tag 2 = the Mii's skin, tag 3 = its favourite colour, 0x80057d14)
            rec = dict(flags=list(Z[r + 0x10:r + 0x14]), slot=Z[r + 0x15], count=Z[r + 0x17], tag=struct.unpack_from('>h', Z, r + 0x28)[0] if r + 0x2a <= len(Z) else 0,
                       tex=[model.u32(to + 4 * k) for k in range(min(nt, 8))] if 0 < to < len(Z) else [])
            rec['base'] = rec['tex'][:1]
            # HP4 nests the eyes / mouth one level down: +0x28 = how many layer records, +0x2c = where; a layer
            # with face slot 1 / 2 (its own count and texture list) is the face (CHR6100's head: materials 1 /
            # 2 -> eyes 1-7, mouth 8-10). DDR II keeps them on the material itself.
            nl, lp = struct.unpack_from('>II', Z, r + 0x28) if r + 0x30 <= len(Z) else (0, 0)
            if rec['slot'] not in (1, 2) and 0 < nl < 8 and 0 < lp and lp + 0x1c <= len(Z) and lp != r:
                s2 = Z[lp + 0x15]
                if s2 in (1, 2):
                    to2 = struct.unpack_from('>I', Z, lp + 0x18)[0]
                    cnt = Z[lp + 0x17]
                    if 0 < to2 < len(Z):
                        rec.update(slot=s2, count=cnt, tex=[model.u32(to2 + 4 * k) for k in range(min(max(cnt, 1), 8))])
            # HP4's shine layers (+0x13 = 4, e.g. the hair's 'ref' pictures; blend byte +0x12 0x81 = added):
            # 0x8014259c works their texture coordinates out every frame (see HP4_SPEC.md, 'hair shine')
            for k in range(nl if 0 < nl < 8 else 0):
                l = lp + 0x38 * k
                if l + 0x1c <= len(Z) and l != r and Z[l + 0x13] == 4:
                    lnt, lto = struct.unpack_from('>II', Z, l + 0x14)
                    if 0 < lto < len(Z) and lnt:
                        rec['shine'] = model.u32(lto)
                        rec['shineBlend'] = Z[l + 0x12]
                    break
            out.append(rec)
        return out
    mtab = {id(body): mats_of(body), id(head): mats_of(head) if head else []}
    accs = []
    for joint, path in acc or ():
        try:
            ad = open(path, 'rb').read()
            ae = wii_entries(ad)
            am = Zmb(ad[ae[0][1]:ae[0][1] + ae[0][2]])
        except (OSError, ValueError, IndexError, struct.error):
            continue
        ab = len(bitmaps)
        bitmaps += _bitmaps((ad, ae[1][1]) if len(ae) > 1 else None, am.textures())
        accs.append((joint, am, ab))
        mtab[id(am)] = mats_of(am)
    attrs = [dict(bitmap=i, wrapS=1, wrapT=1) for i in range(len(bitmaps))]

    def mat_for(model, mid, base_tex):
        ms = mtab[id(model)]
        mt = ms[mid] if mid < len(ms) else None
        if model is body and mt and part_base and mt.get('tag', 0) >= 10 and mt['tag'] // 10 in part_base:
            base_tex = part_base[mt['tag'] // 10]
        tex = mt['tex'][0] if mt and mt['tex'] else None
        ok = lambda t: t is not None and base_tex + t < len(bitmaps) and bitmaps[base_tex + t]['png']
        a = base_tex + tex if ok(tex) else None
        b2 = mt['flags'][2] if mt and len(mt['flags']) > 2 else 0
        face = mt['slot'] if mt and model is head and mt['slot'] in (1, 2) else 0
        m = dict(color=[255, 255, 255], vtx=1, alpha=1.0, flags=0, attrs=[a] if a is not None else [],
                 cut=0.5 if (b2 == 3 or face) else None)
        if mt and model is body and mt.get('tag', 0) >= 10:   # (a Mii body's part: OUTFIT 1-4 = tag 1x-4x)
            m['part'] = mt['tag'] // 10
        if mt and mii and mt.get('tag') in (2, 3):     # a Mii body's skin / favourite-colour parts
            col = mii['skin'] if mt['tag'] == 2 else mii['fav']
            m['rgba'] = [c / 255.0 for c in col] + [1.0]
        # (0x8015e3d8: blend byte +0x12, low 7 bits 1 = added (src alpha, one) with no z-write - the dance mat's
        # arrow panels; 3 = ordinary alpha blending)
        if mt and not face and (b2 & 0x7f) == 1:
            m['add'] = True
        if mt and mt.get('shine') is not None and ok(mt['shine']):
            m['shineAttr'] = base_tex + mt['shine']
        if face:                                     # the eyes / mouth: every picture it can show, in order
            m['face'] = face
            m['faceAttrs'] = [base_tex + t if ok(t) else None for t in mt['tex'][:mt['count'] or 1]]
            bt = mt['base'][0] if mt.get('base') and mt['base'] != mt['tex'][:1] else None
            if bt is not None:
                # HP4: the material's own picture (the head skin, uv set 1) under the face layer (uv set 2)
                m['attrs'] = [base_tex + bt] if ok(bt) else []
                m['cut'] = None
                m['faceLayer'] = 1
        materials.append(m)
        return len(materials) - 1

    meshes = []

    def build(model, node_index, rows, base_tex, rigid_joint=None, place=None):
        for r in rows:
            try:
                mid, P, N, T, C, faces, W = mesh(model, r)
            except struct.error:
                continue
            if place:
                P = [S.mat_mul_point(place, p) for p in P]
                N = [S.mat_mul_dir(place, n) for n in N]
            mat = mat_for(model, mid, base_tex)
            pi, ni, uv, uv2, col = [], [], [], [], []
            nw = [[] for _ in N]
            two = materials[mat].get('faceLayer') and any(len(cr) > 4 for cs in faces for cr in cs)
            for corners in faces:
                for tri in S.strip(corners):                   # each face is a triangle strip
                    for cr in tri:
                        p, n, c, t = cr[:4]
                        pi.append(p if p < len(P) else 0)
                        ni.append(n if n < len(N) else 0)
                        uv.extend(T[t] if t < len(T) else (0, 0))
                        if two:
                            t2 = cr[4] if len(cr) > 4 else t
                            uv2.extend(T[t2] if t2 < len(T) else (0, 0))
                        col.extend(C[c] if c < len(C) else (255, 255, 255, 255))
                        if W and p < len(W) and n < len(N) and not nw[n]:
                            nw[n] = W[p]
            if not pi:
                continue
            m = dict(obj=node_index, nv=len(P), nn=len(N), pos=b64f([x for v in P for x in v]),
                     nrm=b64f([x for v in N for x in v]),
                     groups=[dict(mat=mat, n=len(pi), pi=u16b64(pi), ni=u16b64(ni), uv=b64f(uv),
                                  col=base64.b64encode(bytes(col)).decode(), **({'uv2': b64f(uv2)} if uv2 else {}))])
            if W:
                vw = [[(index.get(nm, 0), w) for nm, w in inf] for inf in W]
                nww = [[(index.get(nm, 0), w) for nm, w in inf] or [(0, 1.0)] for inf in nw]
            else:
                vw = [[(rigid_joint, 1.0)]] * len(P)
                nww = [[(rigid_joint, 1.0)]] * len(N)
            vj, vwt = pack4(vw)
            nj, nwt = pack4(nww)
            m.update(vj=u16b64(vj), vw=b64f(vwt), nj=u16b64(nj), nw=b64f(nwt))
            meshes.append(m)

    for i, n in enumerate(nodes):
        if n['meshes']:
            # a mesh with no skin weights (bracelets, wings) is stored in its own node's space
            build(body, i, n['meshes'], 0, rigid_joint=i, place=None if _skinned(body, n['meshes']) else wm(i))
    if head:
        mj = index.get('mii_head', index.get('Head', 0))
        for n in head.nodes():
            if n['meshes']:
                build(head, mj, n['meshes'], nb, rigid_joint=mj, place=S.mat4mul(n['m'], wm(mj)))
    if mii and 'mii_head' in index:
        _mii_head(mii['heads'], index['mii_head'], wm(index['mii_head']), materials, meshes, bitmaps, attrs)
    for joint, am, ab in accs:
        j = index.get(joint)
        if j is None:
            continue
        an = am.nodes()
        aw = {}

        def awm(i):
            if i not in aw:
                w = an[i]['m']
                p = an[i]['parent']
                if 0 <= p < len(an) and p != i:
                    w = S.mat4mul(w, awm(p))
                aw[i] = w
            return aw[i]
        for i, n in enumerate(an):
            if n['meshes']:
                build(am, j, n['meshes'], ab, rigid_joint=j, place=S.mat4mul(awm(i), wm(j)))
    return dict(objects=objects, meshes=meshes, materials=materials, attrs=attrs, bitmaps=bitmaps)


def dance(path, bpm, fps=30):
    """a song's MOT010_SSQnnn.bin -> {clips, timeline, perMeasure} for stage.js: the clips play one
    after another from the start of the song, in real time (60 frames a second in the file)"""
    d = open(path, 'rb').read()
    clips, tl, at = {}, [], 0.0
    per_measure = fps * 240.0 / (bpm or 120)                 # samples per measure at this tempo
    for k, (_, o, sz) in enumerate(wii_entries(d)):
        a = zab(d[o:o + sz])
        if not a or not a['len']:
            continue
        n = int(a['len'] * fps / 60) + 1
        tracks = {}
        for name, tr in a['nodes'].items():
            chs = {}
            T, R = tr.get(0), tr.get(1)
            if T:
                for c, ch in enumerate(('px', 'py', 'pz')):
                    chs[ch] = b64f([_lin(T, i * 60.0 / fps, c) for i in range(n)])
            if R:
                eul = [quat_euler(*_slerp(R, i * 60.0 / fps)) for i in range(n)]
                for c, ch in enumerate(('rx', 'ry', 'rz')):
                    vals, prev = [], None
                    for e in eul:
                        v = e[c]
                        if prev is not None:
                            while v - prev > 180:
                                v -= 360
                            while v - prev < -180:
                                v += 360
                        vals.append(v)
                        prev = v
                    chs[ch] = b64f(vals)
            if chs:
                tracks[name] = chs
        clips[k] = dict(frames=n, tracks=tracks)
        tl.append([at, k, k])
        at += (a['len'] / 60.0) * (bpm or 120) / 240.0       # its length in measures
    return dict(fps=fps, perMeasure=per_measure, clips=clips, timeline=tl, cameras=[])


# the two keys round frame f and how far between them (0-1)
def _seg(keys, f):
    if f <= keys[0][0]:
        return keys[0], keys[0], 0.0
    if f >= keys[-1][0]:
        return keys[-1], keys[-1], 0.0
    lo, hi = 0, len(keys) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if keys[mid][0] <= f:
            lo = mid
        else:
            hi = mid
    a, b = keys[lo], keys[hi]
    return a, b, (f - a[0]) / ((b[0] - a[0]) or 1)


# a value at frame f, straight line between keys
def _lin(keys, f, c):
    a, b, u = _seg(keys, f)
    return a[1 + c] + (b[1 + c] - a[1 + c]) * u


# a rotation at frame f, turned smoothly between keys (slerp)
def _slerp(keys, f):
    a, b, u = _seg(keys, f)
    qa, qb = a[1:5], b[1:5]
    dot = sum(x * y for x, y in zip(qa, qb))
    if dot < 0:
        qb, dot = [-x for x in qb], -dot
    if dot > 0.9995:
        q = [x + (y - x) * u for x, y in zip(qa, qb)]
    else:
        th = math.acos(dot)
        s = math.sin(th)
        wa, wb = math.sin((1 - u) * th) / s, math.sin(u * th) / s
        q = [x * wa + y * wb for x, y in zip(qa, qb)]
    l = math.sqrt(sum(x * x for x in q)) or 1.0
    return [x / l for x in q]


if __name__ == '__main__':
    import json, sys, time
    t = time.time()
    c = character(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    print(len(c['objects']), 'joints', len(c['meshes']), 'meshes', len(c['bitmaps']), 'pictures',
          len(json.dumps(c)) // 1024, 'KB', round(time.time() - t, 2), 's')
