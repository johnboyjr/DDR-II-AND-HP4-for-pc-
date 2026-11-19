"""DDR II PC - local server.

Reads the extracted Dance Dance Revolution II (USA, Wii) files on request and serves
them to the browser game in web/. Nothing is converted or copied; the game folder is
only ever read. Standard library only.
"""
import base64, json, os, socket, struct, sys, threading, time, traceback, webbrowser, subprocess, re
from sfx import SoundIndex
import dance
import ddr2fx
import custom
import hp
import hp2
import hp3
import hp2stage
import cae
import hpstage
import hpchar
import hp2char
import ddr2char
from lights import LIGHTS
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, unquote, parse_qs

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, 'web')
# Hottest Party 4 (DDR, Wii 2010: "Play DDR HP4 PC.bat" starts this with --hp4). It keeps its own
# settings, save and log, so DDR II's are never touched, and runs on its own port.
HP4 = '--hp4' in sys.argv
SUFFIX = '_hp4' if HP4 else ''
SOUND_NAME = 'DDRHP4_SOUND.brsar' if HP4 else 'DDRHP5_SOUND.brsar'
SAVE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'save%s.json' % SUFFIX)
CUSTOM_DIR = os.path.join(HERE, 'Custom Songs')
LIB = None


# the custom song library (made the first time it's asked for)
def library():
    global LIB
    if LIB is None:
        LIB = custom.Library(CUSTOM_DIR)
    return LIB
SETTINGS = os.path.join(HERE, 'settings%s.json' % SUFFIX)
PORT = 8768 if HP4 else 8767

DB_VA = 0x802A44A8          # song table (US, SUREA4)
DB_STRIDE = 412
DB_COUNT = 200
SNDTAB_VA = 0x8027A5B8      # per slot: group, music sound, voice sound, 0, 0
CUSTOM_FLAG = 0x80000000


# write a line to the console window and to log.txt, with the time
def log(*a):
    msg = time.strftime('%H:%M:%S ') + ' '.join(str(x) for x in a)
    print(msg, flush=True)
    try:
        with open(os.path.join(HERE, 'log%s.txt' % SUFFIX), 'a', encoding='utf-8') as f:
            f.write(msg + '\n')
    except OSError:
        pass


# ------------------------------------------------------------------ settings
def load_settings():
    try:
        with open(SETTINGS, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


# write settings.json (to a temporary file first, then swapped in, so a crash can't leave half a file)
def save_settings(s):
    tmp = SETTINGS + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(s, f, indent=1)
    os.replace(tmp, SETTINGS)


# ------------------------------------------------------------------ game files
def locate(root):
    """Return (main.dol path, files root) for an extracted disc, or None."""
    if not root or not os.path.isdir(root):
        return None
    cands = [(os.path.join(root, 'sys', 'main.dol'), root),
             (os.path.join(root, 'sys', 'main.dol'), os.path.join(root, 'files')),
             (os.path.join(root, 'DATA', 'sys', 'main.dol'), os.path.join(root, 'DATA', 'files'))]
    for dol, files in cands:
        if os.path.isfile(dol) and os.path.isfile(os.path.join(files, 'sound', SOUND_NAME)):
            return dol, files
    for depth in (1, 2):                       # e.g. a disc extracted into a sub-folder
        for dp, dirs, _ in os.walk(root):
            if dp[len(root):].count(os.sep) >= depth:
                dirs[:] = []
                continue
            for d in dirs:
                hit = locate_here(os.path.join(dp, d))
                if hit:
                    return hit
    return None


# is the game in this folder? Returns (main.dol, the files folder) or None (the files are in root or root/files)
def locate_here(root):
    for dol, files in [(os.path.join(root, 'sys', 'main.dol'), root),
                       (os.path.join(root, 'sys', 'main.dol'), os.path.join(root, 'files'))]:
        if os.path.isfile(dol) and os.path.isfile(os.path.join(files, 'sound', SOUND_NAME)):
            return dol, files
    return None


# look in Downloads, Desktop and the home folder for an extracted game
def default_game_folder():
    home = os.path.expanduser('~')
    for base in (os.path.join(home, 'Downloads'), os.path.join(home, 'Desktop'), home):
        if not os.path.isdir(base):
            continue
        for name in sorted(os.listdir(base)):
            if ('dance dance revolution (usa)' in name.lower()) if HP4 else ('revolution ii' in name.lower()):
                p = os.path.join(base, name)
                if locate(p):
                    return p
    return None


# main.dol, the game's program: read values at the game's memory addresses
class Dol:
    def __init__(self, path):
        self.d = open(path, 'rb').read()
        d = self.d
        self.secs = [s for s in zip(struct.unpack_from('>18I', d, 0), struct.unpack_from('>18I', d, 0x48),
                                    struct.unpack_from('>18I', d, 0x90)) if s[2]]

    # memory address -> place in the file (None if it isn't in the file)
    def off(self, va):
        for o, a, s in self.secs:
            if a <= va < a + s:
                return o + va - a
        return None

    # the 32-bit number at a memory address
    def u32(self, va):
        return struct.unpack_from('>I', self.d, self.off(va))[0]

    # place in the file -> memory address
    def va(self, off):
        for o, a, s in self.secs:
            if o <= off < o + s:
                return a + off - o
        return None

    # n bytes at a memory address
    def bytes(self, va, n):
        o = self.off(va)
        return self.d[o:o + n]

    # the text (ending in a zero byte) at a memory address
    def cstr(self, va):
        o = self.off(va)
        if o is None:
            return ''
        return self.d[o:self.d.index(b'\0', o)].decode('latin1')


class Rsar:
    """Just enough of the NW4R sound archive index to find songs and previews."""

    def __init__(self, path):
        self.path = path
        with open(path, 'rb') as f:
            hdr = f.read(0x40)
            symb, symb_sz, info, info_sz = struct.unpack_from('>4I', hdr, 0x10)
            f.seek(info)
            self.d = f.read(info_sz)
            f.seek(symb)
            sy = f.read(symb_sz)
        st = 8 + struct.unpack_from('>I', sy, 8)[0]
        self.strings = []
        for i in range(struct.unpack_from('>I', sy, st)[0]):
            o = 8 + struct.unpack_from('>I', sy, st + 4 + 4 * i)[0]
            self.strings.append(sy[o:sy.index(b'\0', o)].decode('latin1'))
        self.ib = 8
        U = lambda o: struct.unpack_from('>I', self.d, o)[0]
        self.U = U

        def table(ref):
            t = self.ib + U(ref + 4)
            return [self.ib + U(t + 4 + 8 * i + 4) for i in range(U(t))]
        self.sounds = table(self.ib + 0)
        self.files = table(self.ib + 24)
        self.groups = table(self.ib + 32)

    # sound number -> its file number
    def sound_file(self, i):
        return self.U(self.sounds[i] + 4)

    # a file's outside path (music kept as its own .brstm file), or None
    def file_ext(self, i):
        ext = self.U(self.files[i] + 16)
        if not ext:
            return None
        o = self.ib + ext
        return self.d[o:self.d.index(b'\0', o)].decode('latin1')

    # a sound group's wave data: (offset, size) in the archive
    def group_wave(self, g):
        o = self.groups[g]
        woff, wsize = struct.unpack_from('>II', self.d, o + 24)
        return woff, wsize


# the entries of a 'WII' archive block starting at base: [(size, offset) ...]
def wii_entries(d, base):
    n = struct.unpack_from('>I', d, base + 8)[0]
    return [struct.unpack_from('>II', d, base + 0x10 + 8 * i) for i in range(n)]


class Art:
    """Jacket (/9) and title (/10) textures in 2Dcommon/comAF_US.bin."""

    def __init__(self, path):
        self.d = open(path, 'rb').read()
        ents = wii_entries(self.d, 0)
        self.tpl = {'jacket': ents[9][0], 'title': ents[10][0]}

    # one picture of a kind, as PNG
    def image(self, kind, idx):
        d, a = self.d, self.tpl[kind]
        n, table = struct.unpack_from('>II', d, a + 4)
        if not 0 <= idx < n:
            return None
        io = struct.unpack_from('>I', d, a + table + 8 * idx)[0]
        h, w, fmt, off = struct.unpack_from('>HHII', d, a + io)
        if w <= 8 or h <= 8:
            return None
        bw, bh = {14: (8, 8), 5: (4, 4)}.get(fmt, (0, 0))
        if not bw:
            return None
        size = ((w + bw - 1) // bw) * ((h + bh - 1) // bh) * {14: 32, 5: 32}[fmt]
        data = d[a + off:a + off + size]
        return struct.pack('>HHII', w, h, fmt, len(data)) + data


# Files the browser may read pieces of (graphics), by short name. US versions first.
RES_FILES = {
    'gui': ['game/gui_us.tpl', 'game/gui.tpl'],
    'cmn': ['game/GAME_CMN_US.bin'],
    'gcu': ['game/GAME_CMN_US.bin'],          # (the same file, its own paths - HP4's song card)
    'mfm': ['game/METER_FM_US.bin'],
    'mmu': ['game/METER_MULTI_US.bin'],
    'fs2': ['game/METER_FS2_US.bin'],
    'ssq': ['ssq/SSQ_CMN.bin'],
    'bg': ['game/bg.tpl'],
    'pvbg': ['game/pv_bg.tpl'],
    'res': ['select/selResult_us.bin'],
    'mus': ['select/selMusic_us.bin'],
    'sel': ['select/select_bin_us.bin'],
    'scm': ['select/select_cmn.bin'],
    'ttl': ['select/selTitle_US.bin', 'select/selTitle_us.bin'],
    'af': ['2Dcommon/comAF_US.bin'],
    'font': ['font/font_us.bin', 'font/font_uk.bin'],
    'logo': ['logo/logo_ENG.tpl'],
    'eff': ['game/GAME_APL_EFF.bin'],
}


class Resources:
    """Hands out pieces of the game's WII containers (usually TPL texture sets)."""

    def __init__(self, files):
        self.files = files
        self.cache = {}

    # an archive's bytes (read once and kept)
    def data(self, key):
        if key not in self.cache:
            for rel in RES_FILES.get(key, []):
                p = os.path.join(self.files, rel.replace('/', os.sep))
                if not os.path.isfile(p):          # (the discs' names differ in case: selResult_us / _US)
                    d, fn = os.path.split(p)
                    hit = next((x for x in os.listdir(d) if x.lower() == fn.lower()), None) if os.path.isdir(d) else None
                    p = os.path.join(d, hit) if hit else p
                if os.path.isfile(p):
                    with open(p, 'rb') as f:
                        self.cache[key] = f.read()
                    break
            else:
                self.cache[key] = None
        return self.cache[key]

    # HP4 keeps DDR II's play screen files inside game/GAME_CMN_US.bin: DDR II's GAME_CMN_US entries 0-9 are
    # its /0/1-/0/10, and its /0/0 holds the meter sets (by their entry counts and identical CAE layout
    # sizes): /0/0/0-2 = METER_MULTI's 3 sets, /0/0/5 = METER_FS2, /0/0/6 = METER_FM (/0/0/3 and /0/0/4 are
    # HP4's own: a 17-entry set like FS2's and a 3-entry DEMONSTRATION plate)
    HP4_PATHS = {'mmu': '/0/0', 'fs2': '/0/0/5', 'mfm': '/0/0/6'}
    hp4 = False

    # HP4 keeps the same pictures in other places: the DDR II name -> HP4's archive and path
    def hp4_path(self, key, path):
        if key in self.HP4_PATHS:
            return 'cmn', self.HP4_PATHS[key] + path
        if key == 'cmn':
            parts = [x for x in path.split('/') if x]
            return 'cmn', '/0' + ''.join('/' + (str(int(x) + 1) if i == 0 else x) for i, x in enumerate(parts))
        return key, path

    # one entry of an archive by its path (the page's /api/res/...)
    def get(self, key, path):
        if self.hp4:
            key, path = self.hp4_path(key, path)
        d = self.data(key)
        if d is None:
            return None
        base, size = 0, len(d)
        for part in [x for x in path.split('/') if x]:
            if d[base:base + 4] != b'WII\0':
                return None
            ents = wii_entries(d, base)
            i = int(part)
            if not 0 <= i < len(ents):
                return None
            o, size = ents[i]
            base += o
        return d[base:base + size]


class Thp:
    """THP movie (Motion-JPEG frames, optional DSP-ADPCM audio)."""

    def __init__(self, path):
        self.path = path
        with open(path, 'rb') as f:
            h = f.read(0x30)
            (magic, ver, maxbuf, maxaudio, fps, nframes, first, datasize, comp_off, _, data_off,
             last_off) = struct.unpack('>4sIIIfIIIIIII', h)
            if magic != b'THP\0':
                raise ValueError('not a THP movie')
            f.seek(comp_off)
            c = f.read(0x60)
        ncomp = struct.unpack_from('>I', c, 0)[0]
        self.types = [t for t in c[4:4 + 16][:ncomp]]
        p = 20
        self.w = self.h = 0
        self.audio = None
        for t in self.types:
            if t == 0:
                self.w, self.h = struct.unpack_from('>II', c, p); p += 12 if ver >= 0x11000 else 8
            elif t == 1:
                nch, freq, nsamp = struct.unpack_from('>III', c, p)
                self.audio = {'channels': nch, 'rate': freq, 'samples': nsamp}
                p += 16 if ver >= 0x11000 else 12
        self.fps, self.n, self.first, self.data_off = fps, nframes, first, data_off
        self.frames = None

    # find every frame's place in the movie file (once)
    def index(self):
        if self.frames is None:
            fr = []
            with open(self.path, 'rb') as f:
                off, size = self.data_off, self.first
                hdr = 8 + 4 * len(self.types)
                for _ in range(self.n):
                    f.seek(off)
                    h = f.read(hdr)
                    if len(h) < hdr:
                        break
                    nxt = struct.unpack_from('>I', h, 0)[0]
                    sizes = struct.unpack_from('>%dI' % len(self.types), h, 8)
                    fr.append((off + hdr, sizes))
                    off += size
                    size = nxt
            self.frames = fr
        return self.frames

    # the movie's size, frame rate, frame count and sound, for the page
    def info(self):
        return {'fps': self.fps, 'frames': self.n, 'w': self.w, 'h': self.h, 'audio': self.audio}

    # one frame's JPEG made readable for a browser
    @staticmethod
    def fix_jpeg(v):
        # THP leaves out JPEG byte stuffing in the scan data; browsers need it back.
        i = 2
        while i + 4 <= len(v) and v[i] == 0xFF:
            m = v[i + 1]
            ln = (v[i + 2] << 8) | v[i + 3]
            if m == 0xDA:
                sos = i + 2 + ln
                end = v.rfind(b'\xff\xd9')
                if end < sos:
                    end = len(v)
                return v[:sos] + v[sos:end].replace(b'\xff', b'\xff\x00') + b'\xff\xd9'
            i += 2 + ln
        return v

    def audio_blocks(self):
        """All audio blocks back to back (each: u32 length + block)."""
        fr = self.index()
        ai = self.types.index(1)
        out = []
        with open(self.path, 'rb') as f:
            for off, sizes in fr:
                f.seek(off + sum(sizes[:ai]))
                b = f.read(sizes[ai])
                out.append(struct.pack('>I', len(b)) + b)
        return b''.join(out)

    # count frames from start (and their sound) packed for the page
    def chunk(self, start, count, want_audio):
        fr = self.index()
        out = []
        with open(self.path, 'rb') as f:
            for k in range(start, min(start + count, len(fr))):
                off, sizes = fr[k]
                f.seek(off)
                blob = f.read(sum(sizes))
                p = 0
                vid, aud = b'', b''
                for t, sz in zip(self.types, sizes):
                    part = blob[p:p + sz]; p += sz
                    if t == 0:
                        vid = self.fix_jpeg(part)
                    elif t == 1 and want_audio:
                        aud = part
                out.append(struct.pack('>II', len(vid), len(aud)) + vid + aud)
        return struct.pack('>I', len(out)) + b''.join(out)


# an opened DDR II game folder: its songs, charts, music, pictures, movies and tables from main.dol
class Game:
    DB_VA, DB_STRIDE, DB_COUNT, SNDTAB_VA = DB_VA, DB_STRIDE, DB_COUNT, SNDTAB_VA
    WRONG_DOL = 'This main.dol is not the US version of DDR II (SUREA4).'
    hp4 = False

    def __init__(self, root):
        loc = locate(root)
        if not loc:
            raise ValueError('Could not find sys/main.dol and sound/%s in %s' % (SOUND_NAME, root))
        self.root = root
        self.dol_path, self.files = loc
        self.dol = Dol(self.dol_path)
        self.rsar = Rsar(os.path.join(self.files, 'sound', SOUND_NAME))
        self.art = Art(os.path.join(self.files, '2Dcommon', 'comAF_US.bin'))
        self.res = Resources(self.files)
        self.res.hp4 = bool(getattr(self, 'hp4', False))
        self.sfx = SoundIndex(self.rsar.path, self.rsar.d, self.rsar.ib)
        self.sfx.set_strings(self.rsar.strings)
        self.movies = {}
        if self.dol.cstr(self.dol.u32(self.DB_VA)) == '':
            raise ValueError(self.WRONG_DOL)
        self.songs = self._songs()
        log('game folder', root, 'songs', len(self.songs))

    # COURSE 1-10 then WORKOUT 1-10: 24-byte records of six numbers (slot - 1, -1 = none)
    COURSE_VA = 0x8027B688

    # the game's 10 courses and 10 workout courses (main.dol table)
    def courses(self):
        rows = []
        for k in range(20):
            w = struct.unpack('>6i', self.dol.bytes(self.COURSE_VA + 24 * k, 24))
            if not all(-1 <= x < DB_COUNT for x in w):
                return None
            rows.append([x + 1 for x in w if x >= 0])
        return dict(courses=rows[:10], workouts=rows[10:])

    # TOURNAMENT MODE: 4 stages x 8 requests, 68-byte records [kind, difficulty, ?, condition, value,
    # songs to clear, gimmick, then up to 10 song numbers (slot - 1, -1 = none)].
    #   kind 1 songs of your choice, 3 specified songs (clear n of them), 8 beat a dancer (1 of their
    #   songs + 1 of yours), 9 the final (4 songs), 10 clear 1 of the specified songs
    #   condition 1 rank (2 C, 3 B, 4 A), 2 MAX COMBO at least, 5 Dance Gauge at least %, 6 PERFECT at
    #   least, 7 GREAT at least, 10 MISS at most. Before it: 18 dancers' song lists (4 songs each).
    TOUR_VA = 0x80279560
    TOUR_POOLS_VA = 0x80279420
    TOUR_POOLS_N = 18

    # TOURNAMENT's 32 requests (main.dol table) with their wording
    def tournament(self):
        rows = []
        for k in range(32):
            w = struct.unpack('>17i', self.dol.bytes(self.TOUR_VA + 68 * k, 68))
            if not (1 <= w[0] <= 12 and 0 <= w[1] <= 4):
                return None
            rows.append(dict(kind=w[0], diff=w[1], cond=w[3], value=w[4], n=w[5], gimmick=w[6],
                             songs=[x + 1 for x in w[7:17] if x >= 0]))
        pools = []
        for k in range(self.TOUR_POOLS_N):
            w = struct.unpack('>5i', self.dol.bytes(self.TOUR_POOLS_VA + 20 * k, 20))
            pools.append([x + 1 for x in w if x >= 0])
        texts = []
        try:
            d = open(os.path.join(self.files, 'text', 'text_eng.bin'), 'rb').read()
            try:
                _, o, sz = hp2stage.wii_entries(d)[6]
                lines = [x.decode('utf-8', 'replace') for x in d[o:o + sz].split(b'\0')]
                next(k for k, t in enumerate(lines) if t.startswith('Clear 1 of the 3 specified'))
            except (IndexError, StopIteration, ValueError):
                lines = [x.decode('utf-8', 'replace') for x in d.split(b'\0')]
            i = next(k for k, t in enumerate(lines) if t.startswith('Clear 1 of the 3 specified'))
            for t in lines[i:]:
                t = re.sub(r'\s+', ' ', t).strip()
                if re.match(r'^(Clear|Beat|Win) ', t):
                    texts.append(t)
                if len(texts) == 32:
                    break
        except (OSError, StopIteration, IndexError, ValueError):
            texts = []
        return dict(rows=rows, pools=pools, texts=texts)

    # DDR points unlocks: 24-byte records [points, type, id, a, b, c]; type 1 = a song (slot = id + 1),
    # 2 = an outfit (id 200-205) or a Mii body part (id 82-89, b = its number - 1), 7 = Mii characters
    UNLOCK_VA = 0x8027BF38

    # DDR II's 3D stage for a song (main.dol 0x8003d1f0 / 0x8004c0f4): the song DB's word at +8 is the
    # song's own stage (the video songs' screen stages 27-29, 18, 200); -1 with flag bits 0x30000 = no
    # stage; otherwise song select draws one at random from stages 10-29 (files STG011-STG030),
    # leaving out the ones used recently. A stage id n is the file stage/STG(n+1).bin.
    STAGE_HISTORY = []

    def stage_extras(self, slot):
        """the two extra stage files a song loads beside its stage (0x80118724 -> 0x8011919c into slots 1
        and 2): song record +16 points to a pair of stage ids in main.dol (0x802e7c48..); the game counts
        the pair's leading ids (record +12 = 2 in memory, -1 ends it). Wings of an Angel: 420, 405 ->
        STG421 (its light spots and the background video bgv16) and STG406 (a backdrop with two monitors);
        all three Dolphin plays loaded both, at the origin, beside STG012 / 014 / 017"""
        if not 1 <= slot <= 200:
            return []
        try:
            ptr = struct.unpack('>I', self.entry(slot)[16:20])[0]     # (record = slot - 1, like entry())
            if not 0x80000000 <= ptr < 0x81800000:
                return []
            out = []
            for v in struct.unpack('>2i', self.dol.bytes(ptr, 8)):
                if v < 0:
                    break
                out.append(v)
            return out
        except Exception:
            return []

    def dancer_ambient(self, n):
        """the dancers' ambient colour on stage n (DDR2_SPEC.md "the light show decoded"): light preset 0 of
        the stage's light record (0x80290970 + 24 x (n - 10) for 10-29, 0x802908b0 + 24 x n for 0-7; extra
        stages 400-439: 0x802bef50 [n - 400]) -> clamp(colour +116 x sum of the masked channel weights x F)"""
        try:
            if 10 <= n <= 29:
                p = self.dol.u32(0x80290970 + 24 * (n - 10) + 16)
            elif 0 <= n <= 7:
                p = self.dol.u32(0x802908B0 + 24 * n + 16)
            elif 400 <= n <= 439:
                p = self.dol.u32(0x802BEF50 + 4 * (n - 400))
            else:
                return None
            if self.dol.off(p) is None or self.dol.off(p + 120) is None:
                return None
            f = lambda va: struct.unpack('>f', self.dol.bytes(va, 4))[0]
            F, mask, c = f(p + 4), self.dol.u32(p + 80), self.dol.u32(p + 116)
            w = sum(f(p + 12 + 4 * k) for k in range(8) if mask >> k & 1)
            # (single-precision products, truncated like the game's fctiwz: c8b4ff x 0.65 = 8274a5)
            f32 = lambda v: struct.unpack('>f', struct.pack('>f', v))[0]
            return [min(255, int(f32(f32(((c >> sh) & 255) * w) * F))) for sh in (24, 16, 8)]
        except Exception:
            return None

    # the stage a song plays on (its stage file number)
    def stage_for(self, slot):
        # the step lessons: stage 19 (STG020.bin, the STG110 models - the yellow-grid floor; Dolphin camtrace of
        # Step Lesson 1: STG110 was the stage in memory). STG023.bin is the same file.
        if self.LESSON_BASE < slot <= self.LESSON_BASE + 6:
            return 19
        if not 1 <= slot <= 200:
            return None
        b = self.entry(slot)[:12]                    # (record = slot - 1: a song's full and cut slots share data)
        flags, st = struct.unpack_from('>Ii', b, 4)
        if st != -1:
            return st
        if flags & 0x30000:
            return None
        d = os.path.join(self.files, 'stage')
        # The random pool (0x8004b16c builds it, 0x8004c0f4 draws): the stages 10-29 whose bit is set in the
        # save's stage word (save +32, bit = stage id; 0x8009ba94 sets one). A new save starts with
        # 0x3fc00 (0x8009ac64 / 0x8009b59c) = stages 10-17, and the player's Dolphin save still had only
        # those. Nothing sets another stage bit: the only setter is reward type 3 (0x8010d0d0) and none of the
        # reward builders (0x8010c080 / 0x8010c448 / 0x8010cbcc) ever makes one, so 18-29 stay out of the draw.
        have = [n for n in range(10, 18) if os.path.isfile(os.path.join(d, 'STG%03d.bin' % (n + 1)))]
        if not have:
            return None
        recent = self.STAGE_HISTORY[-(len(have) - 1):] if len(have) > 1 else []
        pool = [n for n in have if n not in recent] or have
        import random
        n = random.choice(pool)
        self.STAGE_HISTORY.append(n)
        del self.STAGE_HISTORY[:-20]
        return n

    # DDR II's demo play (attract mode), main.dol: 16 entries of 6 bytes at 0x8027b878, played in turn
    # (0x800f3ebc steps the index, wrapping at 16): [type (0 = normal, 6 = stage 18), dancers, song code
    # (a slot, or 1000 = any song), b4 (stored per player beside 9; read as difficulty 0/1)]. Run as game
    # mode 8 (0x800452b0 / 0x800457c8): auto play, 1,000,000-point scoring, any button quits.
    DEMO_VA = 0x8027b878

    # the 16 demo plays of the attract mode (main.dol table)
    def demos(self):
        out = []
        b = self.dol.bytes(self.DEMO_VA, 16 * 6)
        for i in range(16):
            t, n, song, b4, b5 = struct.unpack_from('>bbhbb', b, 6 * i)
            d = dict(type=t, dancers=n, song=song, b4=b4)
            # the entry's song is a game id (the record number: slot = id + 1, 0x8004be98 -> DB 0x802a44a8 + id * 412).
            # Id 136 is "lesson by dj" (slot 137), which SELECT MUSIC leaves out: it comes along here
            if song != 1000 and 1 <= song + 1 <= DB_COUNT:
                sl = song + 1
                d['slot'] = sl
                if not any(sg.get('slot') == sl for sg in self.songs):
                    try:
                        e = self.entry(sl)
                        nm = self.dol.cstr(struct.unpack_from('>I', e, 0)[0])
                        if nm and os.path.isfile(self.chart_path(sl)) and self.has_audio(sl):
                            sd = dict(full=sl, short=False, cut=None, name=nm, flags=struct.unpack_from('>I', e, 4)[0],
                                      tier=struct.unpack_from('>i', e, 24)[0], movie=self.song_movie(sl), jacket=sl - 1, alt=None)
                            sd.update(self.song_info(sl, e))
                            d['songInfo'] = sd
                    except (OSError, IndexError, struct.error, ValueError):
                        pass
            out.append(d)
        return out

    # the unlock table (main.dol): what opens at how many DDR POINTS
    def unlocks(self):
        rows = []
        for k in range(400):
            w = struct.unpack('>6i', self.dol.bytes(self.UNLOCK_VA + 24 * k, 24))
            if not (0 < w[0] <= 5000000) or w[1] not in (1, 2, 3, 4, 5, 6, 7):
                break
            rows.append(list(w))
        return rows or None

    # a song's record in the song table
    def entry(self, slot):
        return self.dol.bytes(self.DB_VA + (slot - 1) * self.DB_STRIDE, self.DB_STRIDE)

    # a song's row in the sound table (its sound groups)
    def sound_row(self, slot):
        return struct.unpack('>5I', self.dol.bytes(self.SNDTAB_VA + (slot - 1) * 20, 20))

    def chart_keys(self, slot):
        """difficulty/style keys present in a chart file (e.g. 0x614 = Challenge single)"""
        keys = set()
        try:
            with open(self.chart_path(slot), 'rb') as f:
                d = f.read()
        except OSError:
            return keys
        p = 0
        while p + 12 <= len(d):
            size, typ, p2 = struct.unpack_from('<IHH', d, p)
            if not size:
                break
            if typ == 16:
                keys.add(p2)
            p += size
        return keys

    def song_info(self, slot, e):
        """levels / radar for one version. Index 4 is CHALLENGE (level at +208, radar at +188)."""
        keys = self.chart_keys(slot)
        chal = e[208]
        single = list(e[164:168]) + [chal if 0x614 in keys else 0]
        double = list(e[204:208]) + [chal if 0x618 in keys else 0]
        bpm = struct.unpack_from('>I', e, 28)[0]
        bmin, bmax = (bpm >> 16, bpm & 0xFFFF) if bpm > 0xFFFF else (bpm, bpm)
        return dict(slot=slot, single=single, double=double,
                    bpm=[min(bmin, bmax), max(bmin, bmax)], length=round(struct.unpack_from('>f', e, 36)[0], 2),
                    radar=[list(e[168 + 5 * k:173 + 5 * k]) for k in range(5)],
                    preview=bool(self.preview_path(slot)), title=slot - 1)

    # does the song have its music on the disc?
    def has_audio(self, slot):
        try:
            return self.rsar.group_wave(self.sound_row(slot)[0])[1] >= 200000
        except (IndexError, struct.error):
            return False

    # a menu music's .brstm file by its sound name
    def bgm_path(self, name):
        i = self.sfx.names.get(name)
        if i is None:
            return None
        fid = struct.unpack_from('>I', self.sfx.d, self.sfx.sounds[i] + 4)[0]
        p = self.rsar.file_ext(fid)
        if not p or 'DUMMY' in p.upper() or 'MUTE' in p.upper():
            return None
        full = os.path.join(self.files, 'sound', p.replace('/', os.sep))
        return full if os.path.isfile(full) else None

    # a song's chart file
    def chart_path(self, slot):
        return os.path.join(self.files, 'ssq', 'ss4', 'MU_DDR_%03d.ss4' % slot)

    # a song's preview clip (the song select sample)
    def preview_path(self, slot):
        for s in (slot, slot - 1 if slot % 2 == 0 else slot + 1):
            try:
                p = self.rsar.file_ext(self.rsar.sound_file(16 + s))
            except (IndexError, struct.error):
                continue
            if p and 'dummy' not in p.lower():
                full = os.path.join(self.files, 'sound', p.replace('/', os.sep))
                if os.path.isfile(full):
                    return full
        return None

    # the .thp movies in a movie sub-folder
    def movie_list(self, sub):
        d = os.path.join(self.files, 'movie', sub)
        try:
            return sorted(n for n in os.listdir(d) if n.lower().endswith('.thp'))
        except OSError:
            return []

    def song_movie(self, slot):
        """The song's own video if the disc has one (licensed songs), else one of the background loops."""
        pv = 'ddr%03d.thp' % slot
        if os.path.isfile(os.path.join(self.files, 'movie', 'zz_pv', pv)):
            return {'file': 'zz_pv/' + pv, 'sync': True}
        bgv = self.movie_list('bgv')
        if bgv:
            return {'file': 'bgv/' + bgv[(slot // 2) % len(bgv)], 'sync': False}
        return None

    # a movie by its path inside the movie folder (checked so nothing outside can be asked for)
    def movie(self, rel):
        rel = rel.replace('\\', '/')
        if '..' in rel or not re.match(r'^[A-Za-z0-9_/]+\.thp$', rel):
            raise ValueError('bad movie name')
        if rel not in self.movies:
            self.movies[rel] = Thp(os.path.join(self.files, 'movie', rel.replace('/', os.sep)))
        return self.movies[rel]

    # build the song list from the song table
    def _songs(self):
        out = []
        titles = {}
        for slot in range(1, DB_COUNT + 1):
            e = self.entry(slot)
            titles[slot] = struct.unpack_from('>I', e, 0)[0]
        for full in range(2, DB_COUNT + 1, 2):        # full version = even slot, cut = slot - 1
            fe = self.entry(full)
            tptr = struct.unpack_from('>I', fe, 0)[0]
            name = self.dol.cstr(tptr)
            # (DUMMY_music: a placeholder left on the disc, never shown in the real game)
            if not name or name in ('music',) or name.startswith('lesson') or 'DUMMY' in name.upper():
                continue
            # Many Konami songs only exist as the short (cut) version: their full slot has no charts.
            slot = full
            if not any(fe[164:168]) and not any(fe[204:208]):
                ce = self.entry(full - 1)
                if titles.get(full - 1) == tptr and (any(ce[164:168]) or any(ce[204:208])):
                    slot = full - 1
            e = self.entry(slot)
            flags = struct.unpack_from('>I', e, 4)[0]
            if not os.path.isfile(self.chart_path(slot)) or not self.has_audio(slot):
                continue
            info = self.song_info(slot, e)
            # songs with both versions: the short one becomes the SHORT tab
            alt = None
            if slot == full:
                c = full - 1
                ce = self.entry(c)
                if titles.get(c) == tptr and (any(ce[164:168]) or any(ce[204:208])) \
                        and os.path.isfile(self.chart_path(c)) and self.has_audio(c):
                    alt = self.song_info(c, ce)
                    alt['jacket'] = c - 1
            cut = full - 1 if slot == full and titles.get(full - 1) == tptr and os.path.isfile(self.chart_path(full - 1)) else None
            song = dict(full=full, short=slot != full, cut=cut, name=name, flags=flags,
                        tier=struct.unpack_from('>i', fe, 24)[0], movie=self.song_movie(full),
                        jacket=(cut or slot) - 1, alt=alt)
            song.update(info)
            out.append(song)
        return self._versions(out)

    # London EVOLVED: three songs (game ids 92 / 94 / 96 = slots 93 / 95 / 97, Ver.A / B / C - each with
    # its own chart and its own dance, HP4U_053 / 054 / 055) shown as one. Song select lists only id 92
    # (0x80076628); starting it (0x8004be98) turns id 92 into 92 + 2 x (rand() % 3) in every mode but 5.
    VERSION_GROUPS = [(93, 95, 97)]

    # join songs that are versions of one song (London EVOLVED A / B / C)
    def _versions(self, out):
        for grp in self.VERSION_GROUPS:
            vers = []
            for sl in grp:
                try:
                    e = self.entry(sl)
                    if not os.path.isfile(self.chart_path(sl)) or not self.has_audio(sl):
                        continue
                    v = self.song_info(sl, e)
                    v['jacket'] = sl - 1
                    vers.append(v)
                except (OSError, IndexError, struct.error, ValueError):
                    continue
            if len(vers) < 2:
                continue
            listed = [s for s in out if s.get('slot') in grp or (s.get('alt') or {}).get('slot') in grp]
            if not listed:
                continue
            base = next((s for s in listed if s.get('slot') == grp[0]), listed[0])
            for s in listed:
                if s is not base:
                    out.remove(s)
            base['alt'] = None
            base['cut'] = None
            base['versions'] = vers
        return out

    # DDR SCHOOL (main.dol: chart file ssq/Lss4/LESSON%02d.ss4 for lesson songs, text_eng entry 14 for the
    # teacher's words, select_bin group 11 for its screen): STEP LESSON 1-6 = LESSON01-06, CHOREOGRAPH
    # LESSON 1-5 = LESSON07-11, Wii Balance Board LESSON 1-4 = LESSON12-15. The step lessons are written
    # for the foot markers (style 0x1a, lanes 4/5, the arrow's direction in the note's flag byte 1:
    # 0 up, 2 right, 4 down, 6 left; 0x100 = freeze end). Their music: the lessons are songs 201-215 in the
    # sound table (SNDTAB, one row a lesson): the six step lessons share wave group 200 (music 577),
    # CHOREOGRAPH 1-5 groups 201-205, the balance board lessons 206 / 206 / 206 / 207 - so lesson n plays
    # slot 200 + n (not the "Lesson by DJ" song, slot 137, as assumed before).
    LESSON_BASE = 800

    # DDR SCHOOL's lessons: names and wording from the text file
    def lessons(self):
        words = []
        try:
            d = open(os.path.join(self.files, 'text', 'text_eng.bin'), 'rb').read()
            _, o, sz = hp2stage.wii_entries(d)[14]
            words = [p.decode('utf-8', 'replace') for p in d[o:o + sz].split(b'\0') if len(p) > 3]
        except (OSError, IndexError, struct.error):
            pass
        out = []
        for n in range(1, 16):
            if not os.path.isfile(os.path.join(self.files, 'ssq', 'Lss4', 'LESSON%02d.ss4' % n)):
                continue
            kind, k, w = (('STEP LESSON', n, n) if n <= 6 else ('CHOREOGRAPH LESSON', n - 6, n) if n <= 11
                          else ('Wii Balance Board LESSON', n - 11, n + 2))
            text = re.sub(r'#[a-z]{2}', '', words[w]) if w < len(words) else ''
            out.append(dict(slot=self.LESSON_BASE + n, n=n, name='%s %d' % (kind, k), kind=kind.split(' LESSON')[0].upper(),
                            artist='DDR SCHOOL', words=text, lesson=n, playable=n <= (15 if getattr(self, 'hp4', False) else 6),
                            single=[1, 0, 0, 0, 0], double=[0, 0, 0, 0, 0], bpm=[120, 120], radar=[[0] * 5] * 5,
                            preview=False, title=None, movie=None, folder='DDR SCHOOL',
                            # (DDR II: comAF /9 pictures 211-216 are the teacher with the step lessons' numbers - the
                            # song card and the results' jacket, fifo_ddr2_lessonres.dff: lesson 6 = 216)
                            jacket=210 + n if n <= 6 and not getattr(self, 'hp4', False) else None))
        return out

    def lesson_chart(self, n):
        """a step or CHOREOGRAPH lesson's chart as an ordinary BEGINNER single chart (key 0x414)"""
        d = bytearray(open(os.path.join(self.files, 'ssq', 'Lss4', 'LESSON%02d.ss4' % n), 'rb').read())
        p = 0
        lane_of = {0: 2, 2: 3, 4: 1, 6: 0}                    # direction -> L D U R lane
        while p + 12 <= len(d):
            size, typ, p2, cnt = struct.unpack_from('<IHHI', d, p)
            if not size:
                break
            if typ == 16 and (p2 & 0xff) == 0x4a and 12 <= n <= 15:
                # a Wii Balance Board lesson (12 bump arrows, 13 hip rolls, 14 hopping, 15 all): its board chart
                # (0x14a, the 0x?4a layout) served as the lesson's one chart; the game plays it in board style
                struct.pack_into('<H', d, p + 6, 0x414)
            elif typ == 16 and 12 <= n <= 15:
                pass
            elif typ == 16 and (p2 & 0xff) == 0x1a and 7 <= n <= 11:
                # a CHOREOGRAPH lesson: only the hands (lanes 4 / 5, flags = gimmick type and parameter, as
                # in the songs' 0x?1a charts), served as the lesson's one chart
                struct.pack_into('<H', d, p + 6, 0x414)
            elif typ == 16 and (p2 & 0xff) == 0x1a:
                base = p + 12 + 4 * cnt
                fb = (base + cnt + 3) & ~3
                last = {}
                for i in range(cnt):
                    fl = struct.unpack_from('>I', d, fb + 4 * i)[0]
                    foot = d[base + i]
                    # the foot (lane 4 = left: lesson 1's left arrows; 5 = right) stays in the flag's top bits
                    # (1 left, 2 right) - the lesson colours its arrows by foot: left blue, right red
                    # (the game's explanation text, and the footage)
                    fk = (1 if foot == 4 else 2) << 28
                    if fl & 0x100:                            # freeze end: same arrow as this foot's last
                        d[base + i] = last.get(foot, 0)
                        struct.pack_into('>I', d, fb + 4 * i, 0x100 | fk)
                    else:
                        d[base + i] = last[foot] = lane_of.get((fl >> 8) & 0xff, 0)
                        struct.pack_into('>I', d, fb + 4 * i, fk)
                struct.pack_into('<H', d, p + 6, 0x414)
            p += size
        return bytes(d)

    # a song's music: the bytes of its wave archive, cut out of the sound archive (the page decodes it)
    def audio(self, slot):
        if self.LESSON_BASE < slot <= self.LESSON_BASE + 15:
            slot = 200 + (slot - self.LESSON_BASE)
        woff, wsize = self.rsar.group_wave(self.sound_row(slot)[0])
        with open(self.rsar.path, 'rb') as f:
            f.seek(woff)
            return f.read(wsize)


class Hp4Game(Game):
    """Hottest Party 4 (DDR, Wii 2010, RDDEA4 US). The same engine and file formats as DDR II, with its
    own main.dol tables (found by their shapes, checked against the disc's files):
      song table 0x8027fc68: 296-byte records, one per song (slot = record + 1, chart ssq/ss4/MU_DDR_slot.ss4,
        sound row slot - 1): +0 short name, +4 flags, +24 BPM (hi/lo halves for a range), +128 single
        block (4 levels BEGINNER-EXPERT, 5 x 5 radar, 4 u16 step counts), +160 a second block (style 0x1a/
        0x4a hand-marker charts), +224 / +256 two more blocks (not traced: on the disc +224 always
        equals +128 and +256 equals +160); FAMILY's 0x24 / 0x34 charts have no levels of their own here;
      sound rows 0x8025fc00 (group, music, voice, 0, 0 - DDR II's layout); previews: sound 16 + slot.
    Songs named 'music' are empty slots."""
    DB_VA, DB_STRIDE, DB_COUNT, SNDTAB_VA = 0x8027fc68, 296, 96, 0x8025fc00
    WRONG_DOL = 'This main.dol is not the US version of DDR (Hottest Party 4, RDDEA4).'
    hp4 = True
    LESSON_BASE = 800

    # HP4: build the song list from its song table
    def _songs(self):
        out = []
        for slot in range(1, self.DB_COUNT + 1):
            e = self.entry(slot)
            name = self.dol.cstr(struct.unpack_from('>I', e, 0)[0])
            if not name or name == 'music' or name.startswith('lesson'):
                continue
            if not os.path.isfile(self.chart_path(slot)) or not self.has_audio(slot):
                continue
            keys = self.chart_keys(slot)
            if not any(((k << 8) | 0x14) in keys for k in (4, 1, 2, 3)):
                continue
            out.append(self.song_dict(slot, e, name))
        return out

    # HP4: one song as the page wants it
    def song_dict(self, slot, e, name):
        song = dict(full=slot, short=False, cut=None, name=name, flags=struct.unpack_from('>I', e, 4)[0],
                    tier=0, movie=self.song_movie(slot), jacket=slot - 1, alt=None)
        song.update(self.song_info(slot, e))
        return song

    # HP4: GROOVE CIRCUIT's requests (the same table shape as TOURNAMENT)
    def tournament(self):
        t = super().tournament()
        if t:
            # GROOVE CIRCUIT's first request names the lesson songs (records 57 / 63 / 64 - "lesson 4 c...",
            # "lesson by ..."), which SELECT MUSIC leaves out: they come along here
            have = {sg['slot'] for sg in self.songs}
            extra = []
            for r in t['rows']:
                for sl in r['songs']:
                    if sl in have or not 1 <= sl <= self.DB_COUNT or any(x['slot'] == sl for x in extra):
                        continue
                    e = self.entry(sl)
                    if not os.path.isfile(self.chart_path(sl)) or not self.has_audio(sl):
                        continue
                    keys = self.chart_keys(sl)
                    if not any(((k << 8) | 0x14) in keys for k in (4, 1, 2, 3)):
                        continue
                    nm = self.dol.cstr(struct.unpack_from('>I', e, 0)[0])
                    if not nm or nm == 'music':           # (empty records)
                        continue
                    extra.append(self.song_dict(sl, e, nm))
            t['songs'] = extra
        return t

    # HP4: a song's levels, BPM, length and other details from its record
    def song_info(self, slot, e):
        keys = self.chart_keys(slot)
        single = [e[128 + i] if ((d << 8) | 0x14) in keys else 0 for i, d in enumerate((4, 1, 2, 3))] + [0]
        bpm = struct.unpack_from('>I', e, 24)[0]
        bmin, bmax = (bpm >> 16, bpm & 0xFFFF) if bpm > 0xFFFF else (bpm, bpm)
        # FAMILY: the 0x24 / 0x34 charts - the single chart split in two (every step is in one or both;
        # the play setup 0x8003be98 gives party lane 5 flag 4 -> chart mode 3 = 0x?24, lane 6 flag 8 ->
        # mode 4 = 0x?34: 0x800314e0 / 0x8002e76c, the loader's style codes 0x8002d91c)
        family = [int(((d << 8) | 0x24) in keys and ((d << 8) | 0x34) in keys) for d in (4, 1, 2, 3)] + [0]
        # CHOREOGRAPH (SELECT DANCE, select_bin /14): the 0x?1a charts - the arrows plus the hand markers in
        # lanes 4 / 5 - with the +160 block's levels; FAMILY's own split of them is 0x?2a / 0x?3a
        choreo = [e[160 + i] if ((d << 8) | 0x1a) in keys else 0 for i, d in enumerate((4, 1, 2, 3))] + [0]
        choreoFamily = [int(((d << 8) | 0x2a) in keys and ((d << 8) | 0x3a) in keys) for d in (4, 1, 2, 3)] + [0]
        # Wii Balance Board MODE: the 0x?4a charts (arrows = which way to lean / hop, lanes 4 / 5 the hip moves
        # and the Wii Remote's punches); the same +160 level block (the docstring)
        board = [e[160 + i] if ((d << 8) | 0x4a) in keys else 0 for i, d in enumerate((4, 1, 2, 3))] + [0]
        return dict(slot=slot, single=single, double=[0, 0, 0, 0, 0], family=family, choreo=choreo, choreoFamily=choreoFamily, board=board,
                    bpm=[min(bmin, bmax), max(bmin, bmax)], length=self.audio_length(slot),
                    radar=[list(e[132 + 5 * k:137 + 5 * k]) for k in range(4)] + [[0, 0, 0, 0, 0]],
                    preview=bool(self.preview_path(slot)), title=slot - 1)

    def audio_length(self, slot):
        """seconds of the song's wave (the RWAR's first RWAV: sample count and rate)"""
        try:
            woff, wsize = self.rsar.group_wave(self.sound_row(slot)[0])
            with open(self.rsar.path, 'rb') as f:
                f.seek(woff)
                h = f.read(0x400)
            U = lambda o: struct.unpack_from('>I', h, o)[0]
            tabl, data = U(0x10), U(0x18)
            w = data + U(tabl + 16)
            with open(self.rsar.path, 'rb') as f:
                f.seek(woff + w)
                rw = f.read(0x100)
            wi = struct.unpack_from('>I', rw, 0x10)[0] + 8
            rate = struct.unpack_from('>H', rw, wi + 4)[0]
            end = struct.unpack_from('>I', rw, wi + 12)[0]
            n = (end - 2) // 16 * 14 + (end - 2) % 16 + 1
            return round(n / rate, 2) if rate else 0
        except (OSError, struct.error, IndexError):
            return 0

    def dancer_ambient(self, n):
        """DDR II's rule on HP4's stage records (ddr2fx.stage_table with HP4_CFG: preset 0 of the record's
        light presets)"""
        try:
            rec = ddr2fx.stage_table(self.dol, n, ddr2fx.HP4_CFG)
            # (stages 0, 3, 4 - STG001 / 004 / 005 - have record +0 = 3 (start on preset 3) and +4 = 0: their
            # lights run the random-colour light show (ddr2fx.light_show, played by stage.js LightShow), so
            # the dancers' ambient changes with it - no fixed one here)
            if self.dol.u32(rec + 4) & 0xff != 0xff:
                return None
            p = self.dol.u32(rec + 16)
            if not p or self.dol.off(p) is None or self.dol.off(p + 120) is None:
                return None
            f = lambda va: struct.unpack('>f', self.dol.bytes(va, 4))[0]
            F, mask, c = f(p + 4), self.dol.u32(p + 80), self.dol.u32(p + 116)
            w = sum(f(p + 12 + 4 * k) for k in range(8) if mask >> k & 1)
            f32 = lambda v: struct.unpack('>f', struct.pack('>f', v))[0]
            return [min(255, int(f32(f32(((c >> sh) & 255) * w) * F))) for sh in (24, 16, 8)]
        except Exception:
            return None

    # DDR II's own tables do not exist here (yet): no courses, tournament or unlocks
    # COURSE 1-10 and WORKOUT 1-10 (0x80260370, DDR II's form: 20 rows of 6 song ids, -1 = none). The
    # courses' names are their unlock messages (text_eng 2741-2756: "Heat Wave" ...). Unlocking
    # (0x800fbf14): courses / workouts 6-10 (unlock types 9 / 10, messages 107 + n / 117 + n) open when
    # the last of their songs is unlocked; 1-5 hold only songs that are open from the start.
    COURSE_VA = 0x80260370

    # HP4: its courses, with the songs' unlock points
    def courses(self):
        c = Game.courses(self)
        if not c:
            return c
        try:
            d = open(os.path.join(self.files, 'text', 'text_eng.bin'), 'rb').read()
            L = [x.decode('utf-8', 'replace') for x in d.split(b'\0')]
            i = next(k for k, t in enumerate(L) if t.endswith('Challenge completed!'))
            texts = [t for t in L[i:i + 400] if t]
            nm = lambda n: (re.search(r'"([^"]+)"', texts[n - 1]) or [None, ''])[1] if n <= len(texts) else ''
            c['names'] = [nm(107 + k) for k in range(10)]
            c['workoutNames'] = [nm(117 + k) for k in range(10)]
        except (OSError, StopIteration):
            pass
        return c

    # GROOVE CIRCUIT (HP4's "GCM": classes CselGCMOpening, CgmDataManager, CgmLocation, CgmEvent, GCMClear;
    # voices VO_NAR_SELECTVENUE, VO_NAR_GCMVENUECLEAR / FAIL, VO_NAR_BOSSSELECT): DDR II's tournament table,
    # carried over - 0x8025eb90, 4 venues x 8 events of 68 bytes [kind, difficulty, stage, condition,
    # value, songs to clear, gimmick, 10 song ids] (game mode +196 != 0 reads it, 0x800440a8 / 0x800d0ce8),
    # its 16 song lists of 4 at 0x8025ea50 (20 bytes each), and the same 32 request texts in text_eng.bin
    # (3179-3219). No menu of the game leads there: HP4's SELECT MODE has five cards.
    TOUR_VA = 0x8025EB90
    TOUR_POOLS_VA = 0x8025EA50
    TOUR_POOLS_N = 16
    # DDR POINTS unlocks (0x80260bc0): DDR II's 24-byte rows [points, type, id, a, b, message] - type 1 song
    # (slot = id + 1; HP4's songs are not in pairs), 2 outfit (ids 60-74 = the dancers' second outfits,
    # 80-89 Mii BODY parts, b = which), 7 Mii characters. The message is the 1-based number of the unlock
    # texts in text_eng.bin (the non-empty entries from "Challenge completed!" on), whose quoted name labels it.
    UNLOCK_VA = 0x80260BC0
    # challenge tasks (reader 0x8010dd98-0x8010eba4): the tables at 0x8026de00, gauge bytes at 0x802b7cc0
    TASK_VA = 0x8026DE00
    TASK_GAUGE_VA = 0x802B7CC0

    # HP4: its unlock table
    def unlocks(self):
        rows = Game.unlocks(self)
        if not rows:
            return rows
        texts = []
        try:
            d = open(os.path.join(self.files, 'text', 'text_eng.bin'), 'rb').read()
            L = [x.decode('utf-8', 'replace') for x in d.split(b'\0')]
            i = next(k for k, t in enumerate(L) if t.endswith('Challenge completed!'))
            texts = [t for t in L[i:i + 400] if t]
        except (OSError, StopIteration):
            pass
        for r in rows:
            c = r[5]
            t = texts[c - 1] if 0 < c <= len(texts) else ''
            m = re.search(r'"([^"]+)"', t)
            name = re.sub(r'\s+', ' ', m.group(1)).strip() if m else ''
            if r[1] == 7:
                name = 'Mii Character'
            elif r[1] == 2 and name and not name.startswith('Mii'):
                name = 'Outfit "%s"' % name
            r.append(name)
        return rows

    def tasks(self):
        """HP4's challenge task tables: kind[20], songs per DDR-point range (20 / 26 / 26 ids), and per range
        difficulty (15), gauge (7 bytes), MAX COMBO (12 halfwords, -1 = FULL COMBO), rank (9). The ranges are
        up to 449,999 / up to 899,999 / more (0x8010e174), the song must be the very one (no pair), and the
        bonuses are the reader's: difficulty 0-3 -> 500/750/1000/1500, gauge 60/75/90/100 -> 250/750/750/1000,
        combo 50/100/200/FULL -> 500/750/1000/1500, rank C/B/A/AA -> 250/500/750/1000."""
        B = self.TASK_VA
        i32 = lambda va: struct.unpack('>i', self.dol.bytes(va, 4))[0]
        ws = lambda o, n: [i32(B + o + 4 * k) for k in range(n)]
        hs = lambda o, n: list(struct.unpack('>%dh' % n, self.dol.bytes(B + o, 2 * n)))
        return dict(
            kind=ws(0, 20),
            songs=[ws(80, 20), ws(160, 26), ws(264, 26)],
            diff=[ws(368, 15), ws(428, 15), ws(488, 15)],
            gauge=[list(self.dol.bytes(self.TASK_GAUGE_VA + 8 * r, 7)) for r in range(3)],
            combo=[hs(552, 12), hs(576, 12), hs(600, 12)],
            rank=[ws(624, 9), ws(660, 9), ws(696, 9)],
            ranges=[449999, 899999], pair=False,
            pts=dict(diff=[500, 750, 1000, 1500], gauge={'60': 250, '75': 750, '90': 750, '100': 1000},
                     combo={'50': 500, '100': 750, '200': 1000, '-1': 1500}, rank={'2': 250, '3': 500, '4': 750, '5': 1000}))

    def stage_for(self, slot, pick=None):
        """the stage the game plays a song on (main.dol 0x8003aa04 + 0x800440a8; stage file = id + 1, loaded
        by 0x80107a50 as stage/STG%03d.bin): song flag 0x20 -> none; the record's +8 stage when set (52-54:
        200, the lessons and 56 / 62-64: 6); flag 0x30000 -> none; otherwise a random draw (0x80047a78, code
        -1) from the pool 0x80046cc0 builds - its first part is stages 0-5 (STG001-006), a stage played in
        the last few songs left out, as DDR II. The lessons (records 81-96: +8 = 6) dance on stage 6, STG007."""
        if self.LESSON_BASE < slot <= self.LESSON_BASE + 15:
            return 6
        if not 1 <= slot <= self.DB_COUNT:
            return None
        flags, st = struct.unpack_from('>Ii', self.entry(slot)[:12], 4)
        if flags & 0x20:
            return None
        if st != -1:
            return st
        if flags & 0x30000:
            return None
        d = os.path.join(self.files, 'stage')
        # SELECT STAGE's choice (CselStage, 0x8005d184): stage 0-7 instead of the draw
        if pick is not None and 0 <= pick <= 7 and os.path.isfile(os.path.join(d, 'STG%03d.bin' % (pick + 1))):
            return pick
        have = [n for n in range(6) if os.path.isfile(os.path.join(d, 'STG%03d.bin' % (n + 1)))]
        if not have:
            return None
        recent = self.STAGE_HISTORY[-(len(have) - 1):] if len(have) > 1 else []
        pool = [n for n in have if n not in recent] or have
        import random
        n = random.choice(pool)
        self.STAGE_HISTORY.append(n)
        del self.STAGE_HISTORY[:-20]
        return n

    # HP4 has no extra stage parts
    def stage_extras(self, slot):
        return []

    def movie(self, rel):
        """HP4's menu background is a THP movie inside movie/bg/bg_movie.bin (a WII container, entry 0): it is
        copied out once to the temp folder and played like the other movies ('bg/bg_movie.thp')."""
        if rel.replace('\\', '/') == 'bg/bg_movie.thp':
            if rel not in self.movies:
                import tempfile
                src = os.path.join(self.files, 'movie', 'bg', 'bg_movie.bin')
                d = open(src, 'rb').read()
                o, sz = wii_entries(d, 0)[0]
                out = os.path.join(tempfile.gettempdir(), 'ddrhp4pc_bg_movie_%d.thp' % len(d))
                if not os.path.isfile(out) or os.path.getsize(out) != sz:
                    with open(out, 'wb') as f:
                        f.write(d[o:o + sz])
                self.movies[rel] = Thp(out)
            return self.movies[rel]
        return Game.movie(self, rel)

    def preview_path(self, slot):
        """HP4's song-select previews: sound file 15 + slot (stream/MU_SAM_<slot>.brstm; DDR II's are 16 + slot,
        one on, and in pairs). HP4's songs aren't in pairs, so no neighbour is tried."""
        try:
            p = self.rsar.file_ext(self.rsar.sound_file(15 + slot))
        except (IndexError, struct.error):
            return None
        if p and 'dummy' not in p.lower():
            full = os.path.join(self.files, 'sound', p.replace('/', os.sep))
            if os.path.isfile(full):
                return full
        return None

    def audio(self, slot):
        """HP4's lessons are song records 81-95 (DDR II's 201-215, the same pattern: the 6 step lessons share
        one wave group (68), CHOREOGRAPH 1-5 have 69-73, the board lessons 74 / 74 / 74 / 75), so lesson n
        plays record 80 + n"""
        if self.LESSON_BASE < slot <= self.LESSON_BASE + 15:
            slot = 80 + (slot - self.LESSON_BASE)
        woff, wsize = self.rsar.group_wave(self.sound_row(slot)[0])
        with open(self.rsar.path, 'rb') as f:
            f.seek(woff)
            return f.read(wsize)

    # DDR SCHOOL: the same 15 lessons as DDR II's (ssq/Lss4/LESSON01-15.ss4, 6 step / 5 choreograph / 4
    # Balance Board, the same chart layout), so DDR II's reader is used (Game.lessons / lesson_chart)


# ------------------------------------------------------------------ http
STAGE_CACHE = {}
STATE = {'game': None, 'error': None, 'hp': None, 'hpError': None, 'hp2': None, 'hp2Error': None, 'hp3': None, 'hp3Error': None}
LOCK = threading.Lock()


def open_hp(path):
    """the Hottest Party disc (extracted folder): its songs go in their own folder on the song list"""
    with LOCK:
        try:
            STATE['hp'] = hp.HPGame(path, Dol, Rsar)
            STATE['hpError'] = None
            s = load_settings()
            s['hp_folder'] = path
            s.pop('hp_off', None)
            save_settings(s)
            log('Hottest Party folder', path, 'songs', len(STATE['hp'].songs))
        except Exception as ex:
            STATE['hp'] = None
            STATE['hpError'] = str(ex)
            log('Hottest Party open failed:', ex)


def open_hp2(path):
    """the Hottest Party 2 disc (extracted folder): its songs are the third game's"""
    with LOCK:
        try:
            STATE['hp2'] = hp2.HP2Game(path, Dol, Rsar)
            STATE['hp2Error'] = None
            s = load_settings()
            s['hp2_folder'] = path
            s.pop('hp2_off', None)
            save_settings(s)
            log('Hottest Party 2 folder', path, 'songs', len(STATE['hp2'].songs))
        except Exception as ex:
            STATE['hp2'] = None
            STATE['hp2Error'] = str(ex)
            log('Hottest Party 2 open failed:', ex)


def open_hp3(path):
    """the Hottest Party 3 disc (extracted folder): its songs are the fourth game's"""
    with LOCK:
        try:
            hp3.Thp = Thp
            STATE['hp3'] = hp3.HP3Game(path, Dol, Rsar)
            STATE['hp3Error'] = None
            s = load_settings()
            s['hp3_folder'] = path
            s.pop('hp3_off', None)
            save_settings(s)
            log('Hottest Party 3 folder', path, 'songs', len(STATE['hp3'].songs))
        except Exception as ex:
            STATE['hp3'] = None
            STATE['hp3Error'] = str(ex)
            log('Hottest Party 3 open failed:', ex)


# every song for the page: the game's, then the other discs', then custom songs
def all_songs(g):
    out = list(g.songs)
    h = STATE['hp']
    if h:
        bgv = g.movie_list('bgv')
        for i, s in enumerate(h.songs):
            s = dict(s)
            if bgv:
                s['movie'] = {'file': 'bgv/' + bgv[i % len(bgv)], 'sync': False}
            out.append(s)
    h2 = STATE['hp2']
    if h2:
        bgv = g.movie_list('bgv')
        for i, s in enumerate(h2.songs):
            s = dict(s)
            if bgv:
                s['movie'] = {'file': 'bgv/' + bgv[(i * 7) % len(bgv)], 'sync': False}
            out.append(s)
    h3 = STATE['hp3']
    if h3:
        bgv = g.movie_list('bgv')
        for i, s in enumerate(h3.songs):
            s = dict(s)
            s['movie'] = s.pop('movieHP3', None) or ({'file': 'bgv/' + bgv[(i * 5) % len(bgv)], 'sync': False} if bgv else None)
            out.append(s)
    return out


# open a game folder and make it the one being served
def open_game(path):
    with LOCK:
        try:
            STATE['game'] = (Hp4Game if HP4 else Game)(path)
            STATE['error'] = None
            s = load_settings()
            s['game_folder'] = path
            save_settings(s)
        except Exception as ex:
            STATE['game'] = None
            STATE['error'] = str(ex)
            log('open failed:', ex)


# ------------------------------------------------------------------ first-run setup: disc + ffmpeg
GAME_FILES = os.path.join(HERE, 'Game Files')        # where the disc's files are copied out to
DISC_EXTS = ('.iso', '.wbfs', '.rvz', '.gcz', '.ciso', '.wia')
SETUP = {'busy': False, 'msg': ''}


def find_dolphin_tool():
    """DolphinTool.exe (it comes with Dolphin): from settings, or Dolphin's usual places"""
    p = load_settings().get('dolphin_tool')
    if p and os.path.isfile(p):
        return p
    import glob
    home = os.path.expanduser('~')
    pats = [os.path.join(HERE, 'DolphinTool.exe'), os.path.join(HERE, '*', 'DolphinTool.exe')]
    for base in (os.path.join(home, 'Downloads'), os.path.join(home, 'Desktop'), os.path.join(home, 'Documents'),
                 os.environ.get('ProgramFiles', r'C:\Program Files'), os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)'),
                 os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Programs')):
        pats += [os.path.join(base, '*olphin*', 'DolphinTool.exe'), os.path.join(base, '*olphin*', '*', 'DolphinTool.exe')]
    for pat in pats:
        hits = sorted(glob.glob(pat))
        if hits:
            return hits[-1]
    import shutil
    return shutil.which('DolphinTool')


# is ffmpeg set up (needed for custom songs only)?
def ffmpeg_ok():
    return custom.ffmpeg() is not None


# what SETUP shows: which folders and tools are set and whether they work
def setup_status():
    st = load_settings()
    g = STATE['game']
    return {'gameOk': g is not None, 'folder': g.root if g else st.get('game_folder'), 'iso': st.get('iso'),
            'ffmpeg': custom.ffmpeg(), 'ffmpegOk': ffmpeg_ok(), 'ffmpegSkip': bool(st.get('ffmpeg_skip')),
            'dolphinTool': find_dolphin_tool(), 'busy': SETUP['busy'], 'msg': SETUP['msg'], 'error': STATE['error'],
            'hpOk': STATE['hp'] is not None, 'hpFolder': STATE['hp'].root if STATE['hp'] else st.get('hp_folder'),
            'hpSongs': len(STATE['hp'].songs) if STATE['hp'] else 0, 'hpError': STATE['hpError'],
            'hp2Ok': STATE['hp2'] is not None, 'hp2Folder': STATE['hp2'].root if STATE['hp2'] else st.get('hp2_folder'),
            'hp2Songs': len(STATE['hp2'].songs) if STATE['hp2'] else 0, 'hp2Error': STATE['hp2Error'],
            'hp3Ok': STATE['hp3'] is not None, 'hp3Folder': STATE['hp3'].root if STATE['hp3'] else st.get('hp3_folder'),
            'hp3Songs': len(STATE['hp3'].songs) if STATE['hp3'] else 0, 'hp3Error': STATE['hp3Error'],
            'hp4Mode': HP4, 'hp4Folder': hp4_folder()}


def hp4_folder():
    """Hottest Party 4 runs as its own game ("Play DDR HP4 PC.bat"): its disc is the one set up there. Only read
    here (settings_hp4.json is never written from the DDR II side)."""
    try:
        with open(os.path.join(HERE, 'settings_hp4.json'), encoding='utf-8') as f:
            return json.load(f).get('game_folder')
    except (OSError, ValueError):
        return None


HP_FILES = os.path.join(HERE, 'Game Files (Hottest Party)')


def use_hp_disc(iso):
    """Hottest Party disc: same as use_disc - copied out once with DolphinTool, the disc is only read"""
    for cand in (os.path.dirname(iso), HP_FILES):
        marker = os.path.join(cand, '.from_disc')
        same = cand != HP_FILES or (os.path.isfile(marker) and open(marker, encoding='utf-8').read().strip() == iso)
        if same and hp.find_files(cand):
            open_hp(cand)
            SETUP['msg'] = 'Hottest Party added.' if STATE['hp'] else 'That folder could not be read: %s' % STATE['hpError']
            return
    tool = find_dolphin_tool()
    if not tool:
        SETUP['msg'] = 'DolphinTool.exe was not found. Press D and pick the DolphinTool.exe in your Dolphin folder.'
        return
    SETUP['busy'] = True
    SETUP['msg'] = 'Copying Hottest Party\'s files out of the disc (a few minutes, once only)...'

    def work():
        try:
            import shutil
            if os.path.isdir(HP_FILES):
                shutil.rmtree(HP_FILES, ignore_errors=True)
            os.makedirs(HP_FILES, exist_ok=True)
            flags = 0x08000000 if os.name == 'nt' else 0
            r = subprocess.run([tool, 'extract', '-i', iso, '-o', HP_FILES, '-g', '-q'],
                               capture_output=True, text=True, creationflags=flags)
            if not hp.find_files(HP_FILES):
                r = subprocess.run([tool, 'extract', '-i', iso, '-o', HP_FILES, '-q'],
                                   capture_output=True, text=True, creationflags=flags)
            if not hp.find_files(HP_FILES):
                SETUP['msg'] = 'Could not copy the files out of that disc. ' + ((r.stderr or r.stdout or '').strip()[:200])
                return
            with open(os.path.join(HP_FILES, '.from_disc'), 'w', encoding='utf-8') as f:
                f.write(iso)
            open_hp(HP_FILES)
            SETUP['msg'] = 'Hottest Party added.' if STATE['hp'] else 'The disc was copied but could not be read: %s' % STATE['hpError']
        except Exception as ex:
            SETUP['msg'] = 'Copying failed: %s' % ex
        finally:
            SETUP['busy'] = False
    threading.Thread(target=work, daemon=True).start()


def disc_kind(path):
    """'hp' for a Hottest Party disc image, 'ddr2' for DDR II, None if it can't tell (the game ID
    sits near the start of .iso / .wbfs / .rvz / .wia / .ciso images)"""
    try:
        with open(path, 'rb') as f:
            head = f.read(0x10000)
    except OSError:
        return None
    if re.search(rb'RDD[EPJ]A4', head):
        return 'hp'
    if re.search(rb'SURE[A-Z0-9]{2}', head):
        return 'ddr2'
    return None


def use_disc(iso):
    """Read the game from a Wii disc image. The disc itself is only read, never changed: its files
    are copied out once (with Dolphin's DolphinTool) into 'Game Files' next to this program."""
    s = load_settings(); s['iso'] = iso; save_settings(s)
    # already extracted right next to the disc image (or here before)?
    for cand in (os.path.dirname(iso), GAME_FILES):
        marker = os.path.join(cand, '.from_disc')
        same = cand != GAME_FILES or (os.path.isfile(marker) and open(marker, encoding='utf-8').read().strip() == iso)
        if same and locate(cand):
            open_game(cand)
            SETUP['msg'] = 'Ready.' if STATE['game'] else 'That folder could not be read: %s' % STATE['error']
            return
    tool = find_dolphin_tool()
    if not tool:
        SETUP['msg'] = ('DolphinTool.exe was not found. It comes with Dolphin: press D and pick the '
                        'DolphinTool.exe in your Dolphin folder.')
        return
    SETUP['busy'] = True
    SETUP['msg'] = 'Copying the game\'s files out of the disc (a few minutes, once only)...'

    def work():
        try:
            import shutil
            if os.path.isdir(GAME_FILES):
                shutil.rmtree(GAME_FILES, ignore_errors=True)
            os.makedirs(GAME_FILES, exist_ok=True)
            flags = 0x08000000 if os.name == 'nt' else 0
            r = subprocess.run([tool, 'extract', '-i', iso, '-o', GAME_FILES, '-g', '-q'],
                               capture_output=True, text=True, creationflags=flags)
            if not locate(GAME_FILES):           # older DolphinTool: no -g, take the whole disc
                r = subprocess.run([tool, 'extract', '-i', iso, '-o', GAME_FILES, '-q'],
                                   capture_output=True, text=True, creationflags=flags)
            if not locate(GAME_FILES):
                SETUP['msg'] = 'Could not copy the files out of that disc. ' + ((r.stderr or r.stdout or '').strip()[:200])
                log('extract failed:', r.returncode, r.stdout[-500:], r.stderr[-500:])
                return
            with open(os.path.join(GAME_FILES, '.from_disc'), 'w', encoding='utf-8') as f:
                f.write(iso)
            open_game(GAME_FILES)
            SETUP['msg'] = 'Ready.' if STATE['game'] else 'The disc was copied but could not be read: %s' % STATE['error']
        except Exception as ex:
            SETUP['msg'] = 'Copying failed: %s' % ex
            log('extract failed:', ex)
        finally:
            SETUP['busy'] = False
    threading.Thread(target=work, daemon=True).start()


def pick_path(title, filt):
    """Windows file picker; filt like 'Wii discs (*.iso;*.wbfs)|*.iso;*.wbfs'"""
    if os.name != 'nt':
        return None
    ps = ("Add-Type -AssemblyName System.Windows.Forms;"
          "$f=New-Object System.Windows.Forms.OpenFileDialog;"
          "$f.Title='%s';$f.Filter='%s|All files (*.*)|*.*';"
          "if($f.ShowDialog() -eq 'OK'){$f.FileName}") % (title.replace("'", "''"), filt)
    r = subprocess.run(['powershell', '-NoProfile', '-STA', '-Command', ps],
                       capture_output=True, text=True, creationflags=0x08000000)
    return r.stdout.strip() or None


# tell custom.py where ffmpeg is (from settings.json)
def apply_ffmpeg_setting():
    p = load_settings().get('ffmpeg')
    custom.FFMPEG = p if p and os.path.isfile(p) else None


def pick_file():
    """Windows file picker for a dancer model (.glb / .gltf)"""
    if os.name != 'nt':
        return None
    ps = ("Add-Type -AssemblyName System.Windows.Forms;"
          "$f=New-Object System.Windows.Forms.OpenFileDialog;"
          "$f.Title='Pick a dancer model (.glb or .gltf)';"
          "$f.Filter='3D models (*.glb;*.gltf)|*.glb;*.gltf';"
          "if($f.ShowDialog() -eq 'OK'){$f.FileName}")
    r = subprocess.run(['powershell', '-NoProfile', '-STA', '-Command', ps],
                       capture_output=True, text=True, creationflags=0x08000000)
    return r.stdout.strip() or None


def pick_songs(kind):
    """Windows picker: kind 'files' -> .sm/.ssc files (several at once), 'folder' -> one folder"""
    if os.name != 'nt':
        return []
    if kind == 'folder':
        ps = ("Add-Type -AssemblyName System.Windows.Forms;"
              "$f=New-Object System.Windows.Forms.FolderBrowserDialog;"
              "$f.Description='Pick a song folder or a pack of song folders (StepMania .sm / .ssc)';"
              "if($f.ShowDialog() -eq 'OK'){$f.SelectedPath}")
    else:
        ps = ("Add-Type -AssemblyName System.Windows.Forms;"
              "$f=New-Object System.Windows.Forms.OpenFileDialog;"
              "$f.Title='Pick StepMania songs (.sm or .ssc)';$f.Multiselect=$true;"
              "$f.Filter='StepMania songs (*.sm;*.ssc)|*.sm;*.ssc';"
              "if($f.ShowDialog() -eq 'OK'){$f.FileNames -join \"`n\"}")
    r = subprocess.run(['powershell', '-NoProfile', '-STA', '-Command', ps],
                       capture_output=True, text=True, creationflags=0x08000000)
    return [p.strip() for p in r.stdout.splitlines() if p.strip()]


DANCE_CACHE = {}


# Windows' folder picker (the SETUP screen's Browse); returns the folder or None
def pick_folder():
    if os.name != 'nt':
        return None
    ps = ("Add-Type -AssemblyName System.Windows.Forms;"
          "$f=New-Object System.Windows.Forms.FolderBrowserDialog;"
          "$f.Description='Pick your extracted Dance Dance Revolution II folder';"
          "if($f.ShowDialog() -eq 'OK'){$f.SelectedPath}")
    r = subprocess.run(['powershell', '-NoProfile', '-STA', '-Command', ps],
                       capture_output=True, text=True, creationflags=0x08000000)
    return r.stdout.strip() or None


MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css', '.png': 'image/png', '.json': 'application/json'}


# answers the page's requests: files from web/, and everything under /api/
class H(BaseHTTPRequestHandler):
    # (no line per request in the console)
    def log_message(self, *a):
        pass

    # send an answer: JSON for a dict or list, otherwise the bytes as they are
    def send(self, code, body, ctype='application/octet-stream'):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
            ctype = 'application/json'
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def send_file_range(self, path, ctype):
        """a file with Range support, so the browser can seek in videos"""
        size = os.path.getsize(path)
        rng = re.match(r'bytes=(\d*)-(\d*)', self.headers.get('Range') or '')
        start, end = 0, size - 1
        if rng and (rng.group(1) or rng.group(2)):
            if rng.group(1):
                start = int(rng.group(1)); end = int(rng.group(2)) if rng.group(2) else size - 1
            else:
                start = max(0, size - int(rng.group(2)))
            end = min(end, size - 1)
        n = max(0, end - start + 1)
        self.send_response(206 if rng and (rng.group(1) or rng.group(2)) else 200)
        self.send_header('Content-Type', ctype)
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(n))
        if rng and (rng.group(1) or rng.group(2)):
            self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        self.end_headers()
        with open(path, 'rb') as f:
            f.seek(start)
            left = n
            while left > 0:
                chunk = f.read(min(1 << 20, left))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    return
                left -= len(chunk)

    # a GET request: work out the path and query, then route_get
    def do_GET(self):
        try:
            u = urlparse(self.path)
            self.query = {k: v[0] for k, v in parse_qs(u.query).items()}
            self.route_get(unquote(u.path))
        except Exception as ex:
            log('GET', self.path, 'failed:', ex, traceback.format_exc())
            self.send(500, {'error': str(ex)})

    # a POST request: read its JSON body, then route_post
    def do_POST(self):
        try:
            n = int(self.headers.get('Content-Length') or 0)
            body = json.loads(self.rfile.read(n) or b'{}')
            self.route_post(urlparse(self.path).path, body)
        except Exception as ex:
            log('POST', self.path, 'failed:', ex, traceback.format_exc())
            self.send(500, {'error': str(ex)})

    # every GET address the page can ask for (one 'if p == ...' per address)
    def route_get(self, p):
        g = STATE['game']
        q = self.query
        if p == '/api/version':
            return self.send(200, {'version': VERSION})
        if p == '/api/alive':
            PAGES['last'] = time.time()
            return self.send(200, {'ok': True})
        if p == '/' or p.startswith('/web/'):
            name = 'index.html' if p == '/' else p[5:]
            full = os.path.normpath(os.path.join(WEB, name))
            if not full.startswith(WEB) or not os.path.isfile(full):
                return self.send(404, 'not found', 'text/plain')
            return self.send(200, open(full, 'rb').read(), MIME.get(os.path.splitext(full)[1], 'application/octet-stream'))
        if p == '/api/status':
            return self.send(200, {'ok': g is not None, 'error': STATE['error'], 'hp4': HP4,
                                   'folder': g.root if g else load_settings().get('game_folder')})
        if p == '/api/settings':
            return self.send(200, load_settings())
        if p == '/api/setup':
            return self.send(200, setup_status())
        if p == '/api/lights':
            return self.send(200, LIGHTS.status())
        if g is None:
            return self.send(409, {'error': 'no game folder'})
        if p == '/api/songs':
            return self.send(200, all_songs(g))
        # (Hottest Party 4: DDR II's own main.dol tables - dances, combo performances, courses - are not
        # decoded for it yet)
        if p == '/api/hp4menumot':
            # (DDR II: the same file layout and the same results code - 0x800f14d8, tables 0x80279f18-0x8027a010
            # identical to HP4's; its dancers' flags: 0x802b8824[group][id - 0x8026e898[group]], groups 0x8002754c:
            # 0-14, 20-31, 40-54, 60-74, 200-208, 80-89, 100)
            # HP4's menu dancers' motions: select/select_cmn.bin entry 1 (39 ZAB clips), loaded at boot by
            # 0x800bec14 into the menu dancer manager's +0x2313c; a clip is picked by index (0x800e9cf8). The
            # results screen uses 9-38 (0x800e2f4c).
            try:
                d = open(os.path.join(g.files, 'select', 'select_cmn.bin'), 'rb').read()
                o, s2 = dance.wii_entries(d)[1]
                sub = d[o:o + s2]
                clips = []
                for eo, es in dance.wii_entries(sub):
                    c = dance.clip(sub[eo:eo + es]) if es else None
                    clips.append(dict(frames=struct.unpack_from('>I', sub, eo + 0x10)[0], bones=c) if c else None)
                flags = {}                    # the dancer's flags (0x80286b68[group][id - base]): bit 0 / bit 1 pick its set
                groups = ((0, 15), (20, 12), (40, 15), (60, 15), (80, 10)) if g.hp4 else \
                    ((0, 15), (20, 12), (40, 15), (60, 15), (200, 9), (80, 10), (100, 1))
                for grp, (base, n) in enumerate(groups):
                    tab = g.dol.u32((0x80286B68 if g.hp4 else 0x802B8824) + 4 * grp)
                    for i in range(n):
                        flags['%02d' % (base + i + 1)] = g.dol.u32(tab + 4 * i)
                return self.send(200, dict(clips=clips, flags=flags))
            except Exception as ex:
                log('hp4 menu motions failed:', ex)
                return self.send(404, {'error': str(ex)})
        if p == '/api/hp4menubg':                 # (DDR II's own select_cmn.bin has the same scene: loader 0x800982a8, menu manager +0x28168)
            # HP4's menu background (select/select_cmn.bin /0, loaded by 0x80086020 into the menu manager +0x23794):
            # a 3D scene - model /0/0 (a_BG_panel, stars, lines, clouds; pictures /0/1, animation /0/2) and model
            # /0/3 (pictures /0/4) - seen by camera BG_Camera01 (node model /0/5) whose ten moves /0/6-/0/15 slide
            # it sideways: move 2p goes from x = 100p to 100p + 100, move 2p + 1 back again (0x80086c08 / 0x80086d6c)
            if 'hp4menubg' not in STAGE_CACHE:
                try:
                    d = open(os.path.join(g.files, 'select', 'select_cmn.bin'), 'rb').read()
                    o, s2 = dance.wii_entries(d)[0]
                    sub = d[o:o + s2]
                    E = dance.wii_entries(sub)
                    ent = lambda i: sub[E[i][0]:E[i][0] + E[i][1]]
                    models = [hp2stage.model(ent(0), sub, E[1][0], hp2stage.zab(ent(2)), True),
                              hp2stage.model(ent(3), sub, E[4][0], None, True)]
                    moves = []
                    for i in range(6, 16):
                        a = hp2stage.zab(ent(i))
                        nd = (a.get('nodes') or {}).get('BG_Camera01') or {}
                        moves.append(dict(len=a.get('len'), x=[[k[0], k[1]] for k in (nd.get(0) or nd.get('0') or [])]))
                    STAGE_CACHE['hp4menubg'] = json.dumps(dict(models=models, cameras=[], spots={}, moves=moves)).encode()
                except Exception as ex:
                    log('hp4 menu background failed:', ex)
                    return self.send(404, {'error': str(ex)})
            return self.send(200, STAGE_CACHE['hp4menubg'], 'application/json')
        if g.hp4 and p == '/api/hp4effmask':
            # game/effmask.tpl (play file 3): the ripple mask of the 200-combo performance's screen effect (0x800eba18
            # registers it, 0x800ec110 draws with it) - one 256 x 256 I8 picture
            try:
                d = open(os.path.join(g.files, 'game', 'effmask.tpl'), 'rb').read()
                w, h, fmt, o = hp2.tpl_list(d, 0)[0]
                return self.send(200, hp2.tpl_png(d, w, h, fmt, o), 'image/png')
            except Exception as ex:
                return self.send(404, {'error': str(ex)})
        if g.hp4 and p == '/api/appeal':
            # HP4's combo performance (traced 2026-11-17 night): the song record's flags (0x8027fc6c + record
            # x 0x128) pick the set - 0x200000 / 0x400000 / 0x800000 / 0x1000000 = game/GAME_APL_MOT01-04,
            # CAM01-04 and STG01-04 (loader 0x80107734). Each MOT file holds 10 clips (type x 2, +1 for flagged
            # dancers); the flag is bit 0 of table 0x80286b68[group][id - group base] (0x800ecff4; groups by id
            # 0-14 / 20-31 / 40-54 / 60-74 / 80-89 / 100, 0x80025a80). Its stage effects, light change and face
            # script aren't traced for HP4 yet (none sent).
            try:
                slot = int(q.get('slot', 0))
                fl = g.dol.u32(0x8027FC6C + (slot - 1) * 0x128)
                style = next((k for k, b in enumerate((0x200000, 0x400000, 0x800000, 0x1000000)) if fl & b), -1)
                if style < 0:
                    return self.send(404, {'error': 'no performance for this song'})
                gd = os.path.join(g.files, 'game')
                d = open(os.path.join(gd, 'GAME_APL_MOT%02d.bin' % (style + 1)), 'rb').read()
                clips = []
                for o, s2 in dance.wii_entries(d):
                    c = dance.clip(d[o:o + s2]) if s2 else None
                    clips.append(dict(frames=struct.unpack_from('>I', d, o + 0x10)[0], bones=c) if c else None)
                cams = hp2stage.appeal_cameras(os.path.join(gd, 'GAME_APL_CAM%02d.bin' % (style + 1)))
                alt = {}
                for grp, (base, n) in enumerate(((0, 15), (20, 12), (40, 15), (60, 15), (80, 10))):
                    tab = g.dol.u32(0x80286B68 + 4 * grp)
                    for i in range(n):
                        alt['%02d' % (base + i + 1)] = g.dol.u32(tab + 4 * i) & 1     # (key: the CHR file number)
                # 0x800ecff4 then does what DDR II's 0x800fd1d0 does, at HP4's own addresses (traced 2026-11-18):
                # stage effects (0x8004dc7c): bank 3 = game/GAME_APL_EFF.bin (file 0xb of the play's file list,
                # 0x8003ac00 -> 0x8004a2e0), effect A[set][clip] (0x80256a48, 10 a row) then B[set][type]
                # (0x80256ae8, 5 a row), -1 = none, layer bytes 0x41 / 0x42; the set is the same style (0x800ed1d8)
                i32 = lambda va: struct.unpack('>i', struct.pack('>I', g.dol.u32(va)))[0]
                ea = [i32(0x80256A48 + 40 * style + 4 * k) for k in range(10)]
                eb = [i32(0x80256AE8 + 20 * style + 4 * k) for k in range(5)]
                try:
                    eff = ddr2fx.bank(open(os.path.join(gd, 'GAME_APL_EFF.bin'), 'rb').read(), 0)
                except Exception as ex:
                    log('hp4 appeal effects failed:', ex)
                    eff = None
                # the light change and the face script (the stage controller's vtable 0x8028dcc0 +0x40 =
                # 0x80104a44, DDR II's 0x80115b80): parameters 0x8028c4d8 [style x 60 + type x 12] = F, G,
                # colour C (state 4: the dancers' ambient = clamp(C x F), light 0 = grey x G); the face script
                # 0x8028c8b8 [alt x 80 + style x 20 + type x 4] -> (value 0-9, until-frame) entries, frame 0 = to
                # the end (lists in .sbss read as all zero, as in DDR II)
                f32 = lambda va: struct.unpack('>f', g.dol.bytes(va, 4))[0]

                def u32s(va):
                    try:
                        v = g.dol.u32(va)
                        return v if v is not None else 0
                    except Exception:
                        return 0
                lights = []
                for k in range(5):
                    a = 0x8028C4D8 + 60 * style + 12 * k
                    c = g.dol.u32(a + 8)
                    lights.append(dict(F=round(f32(a), 4), G=round(f32(a + 4), 4),
                                       amb=[min(255, int(((c >> sh) & 255) * f32(a))) for sh in (24, 16, 8)]))
                faces = []
                for a2 in range(2):
                    row = []
                    for k in range(5):
                        ptr, ents = u32s(0x8028C8B8 + 80 * a2 + 20 * style + 4 * k), []
                        for e in range(32):
                            v, fr = u32s(ptr + 8 * e), u32s(ptr + 8 * e + 4)
                            ents.append([v if 0 <= v <= 9 else 0, fr])
                            if fr == 0:
                                break
                        row.append(ents)
                    faces.append(row)
                # the performance stage (0x8004a2e0 loads game/GAME_APL_STGnn = file 0xc; the stage draw 0x8004e9xx
                # draws, while a performance runs, only model 0x80256a34[type] in place of the whole stage): for
                # each type the ZMB at entry 0x80256b38[set x 5 + type] with its TPL after it and any ZAB after that
                stg = []
                try:
                    sd = open(os.path.join(gd, 'GAME_APL_STG%02d.bin' % (style + 1)), 'rb').read()
                    ents = dance.wii_entries(sd)
                    for k in range(5):
                        e0 = g.dol.u32(0x80256B38 + 20 * style + 4 * k)
                        e1 = g.dol.u32(0x80256B38 + 20 * style + 4 * k + 4) if k < 4 else len(ents)
                        md = None
                        if 0 <= e0 < len(ents) and sd[ents[e0][0]:ents[e0][0] + 4] == b'ZMB ':
                            o, s2 = ents[e0]
                            tpl = ents[e0 + 1][0] if e0 + 1 < len(ents) and sd[ents[e0 + 1][0]:ents[e0 + 1][0] + 4] == b'\x00\x20\xaf\x30' else None
                            anim = None
                            for o3, s3 in ents[e0 + 2:e1]:
                                if sd[o3:o3 + 4] == b'ZAB ':
                                    anim = hp2stage.zab(sd[o3:o3 + s3])
                                    break
                            md = hp2stage.model(sd[o:o + s2], sd if tpl is not None else None, tpl or 0, anim, True)
                            md['name'] = 'APL_STG%d' % k
                        stg.append(md)
                except Exception as ex:
                    log('hp4 appeal stage failed:', ex)
                    stg = []
                stgOf = [g.dol.u32(0x80256A34 + 4 * k) for k in range(5)]
                return self.send(200, dict(style=style, clips=clips, cams=cams, alt=alt, hp4=True, effA=ea, effB=eb,
                                           bank3=eff, lights=lights, faces=faces, stg=stg, stgOf=stgOf))
            except Exception as ex:
                log('hp4 appeal failed:', ex)
                return self.send(404, {'error': str(ex)})
        if g.hp4 and (re.match(r'^/api/(appeal|ddr2demo)$', p)):
            return self.send(404, {'error': 'not in Hottest Party 4 yet'})
        if p == '/api/save':
            try:
                with open(SAVE, encoding='utf-8') as f:
                    return self.send(200, json.load(f))
            except (OSError, ValueError):
                return self.send(200, {})
        if p == '/api/res':
            d = g.res.get(q.get('f', ''), q.get('p', ''))
            return self.send(200, d) if d else self.send(404, {'error': 'no such resource'})
        def movie_of(f):
            if f.startswith('hp3:'):
                if not STATE['hp3']:
                    raise ValueError('no Hottest Party 3')
                return STATE['hp3'].movie(f[4:])
            return g.movie(f)
        if p == '/api/movie/info':
            try:
                return self.send(200, movie_of(q.get('f', '')).info())
            except Exception as ex:
                log('movie', q.get('f', ''), 'failed:', ex)
                return self.send(404, {'error': str(ex)})
        if p == '/api/movie/frames':
            if q.get('s') == '0':
                log('movie frames', q.get('f', ''))
            m = movie_of(q.get('f', ''))
            return self.send(200, m.chunk(int(q.get('s', 0)), min(240, int(q.get('n', 30))), q.get('a') == '1'))
        if p == '/api/sfx':
            name = q.get('n', '')
            if not re.match(r'^(SE|VO)_[A-Z0-9_]+$', name):
                return self.send(400, {'error': 'bad name'})
            notes = g.sfx.play(name)
            parts = [struct.pack('>I', len(notes))]
            for n in notes:
                ratio = 2 ** ((n['key'] - n['root']) / 12.0) * (n['tune'] or 1.0)
                parts.append(struct.pack('>fffI', n['t'], ratio, n['vol'], len(n['wave'])) + n['wave'])
            return self.send(200, b''.join(parts))
        if p.startswith('/api/bgm/'):
            path = g.bgm_path(p.rsplit('/', 1)[1])
            return self.send(200, open(path, 'rb').read()) if path else self.send(404, {'error': 'no bgm'})
        if p == '/api/movie/audio':
            m = movie_of(q.get('f', ''))
            return self.send(200, m.audio_blocks()) if m.audio else self.send(404, {'error': 'no audio'})
        if p == '/api/custom/songs':
            lib = library()
            return self.send(200, {'folders': lib.folders(), 'songs': lib.public()})
        m = re.match(r'^/api/custom/video/(c[0-9a-f]{10})$', p)
        if m:
            s = library().songs.get(m.group(1))
            path = s and s.get('_video')
            if not path or not os.path.isfile(path):
                return self.send(404, {'error': 'no video'})
            return self.send_file_range(path, custom.MIME.get(os.path.splitext(path)[1].lower(), 'video/mp4'))
        m = re.match(r'^/api/custom/(chart|audio|image|bg)/(c[0-9a-f]{10})$', p)
        if m:
            s = library().songs.get(m.group(2))
            if not s:
                return self.send(404, {'error': 'no such song'})
            if m.group(1) == 'chart':
                return self.send(200, custom.convert(s['_file'])[0])
            path = s['_music'] if m.group(1) == 'audio' else s.get('_bg') if m.group(1) == 'bg' else s['_image']
            if not path or not os.path.isfile(path):
                return self.send(404, {'error': 'missing file'})
            return self.send(200, open(path, 'rb').read(), custom.MIME.get(os.path.splitext(path)[1].lower(), 'application/octet-stream'))
        # DDR II's own dancers, built from your disc as a .glb when asked for (see ddr2char.py)
        if p == '/api/ddr2shader':
            # character/CHR_SHADER.bin's first texture (256 x 256): the game's lighting ramp, read by the
            # GAME STYLE dancer lighting (DDR2_SPEC.md); only used on DDR II PC's own dancer
            g = STATE.get('game')
            path = g and os.path.join(g.files, 'character', 'CHR_SHADER.bin')
            if not path or not os.path.isfile(path):
                return self.send(404, {'error': 'no shader file'})
            d = open(path, 'rb').read()
            ents = hp2stage.wii_entries(d)
            pngs = ddr2fx.tpl_pngs(d, ents[0][1]) if ents else []
            if not pngs or not pngs[0]:
                return self.send(404, {'error': 'no ramp'})
            return self.send(200, base64.b64decode(pngs[0]), 'image/png')
        if p == '/api/ddr2chars':
            g = STATE.get('game')
            out = ddr2char.dancers(g.files) if g else []
            # each dancer's sex for MY CHARACTER's RANDOM (girls) / RANDOM (boys): the low 2 bits of the
            # character flags 0x8026e9b0 [game id - 200] (1 = girl, 2 = boy; EMI, RUBY, YUNI, Rena, jun = 1)
            for c in out:
                try:
                    gid = int(c['id']) - 1
                    c['sex'] = g.dol.u32(0x8026E9B0 + 4 * (gid - 200)) & 3 if 200 <= gid <= 208 else 0
                except Exception:
                    c['sex'] = 0
            return self.send(200, out)
        m = re.match(r'^/api/ddr2char/(\d{2,3})/(\d{1,2})$', p)
        if m:
            g = STATE.get('game')
            acc = int(q.get('acc', '0') or 0) if (q.get('acc', '0') or '0').isdigit() else 0
            key = ('ddr2char', m.group(1), int(m.group(2)), acc)
            if key not in STAGE_CACHE:
                try:
                    data = ddr2char.glb(g.files, m.group(1), m.group(2), acc) if g else None
                except Exception as ex:
                    log('ddr2 dancer', m.group(1), 'failed:', ex)
                    data = None
                if not data:
                    return self.send(404, {'error': 'no dancer'})
                if len(STAGE_CACHE) > 8:
                    STAGE_CACHE.pop(next(iter(STAGE_CACHE)))
                STAGE_CACHE[key] = data
            return self.send(200, STAGE_CACHE[key], 'model/gltf-binary')
        if p == '/api/dancermodel':
            path = load_settings().get('dancer_model')
            if not path or not os.path.isfile(path):
                return self.send(404, {'error': 'no model'})
            return self.send(200, open(path, 'rb').read())
        if p == '/api/dancermodel/res':
            # files a .gltf points to (its .bin and textures), only from the model's own folder
            path = load_settings().get('dancer_model')
            if not path:
                return self.send(404, {'error': 'no model'})
            folder = os.path.dirname(os.path.abspath(path))
            full = os.path.normpath(os.path.join(folder, q.get('u', '')))
            if not full.startswith(folder + os.sep) or not os.path.isfile(full):
                return self.send(404, {'error': 'not found'})
            return self.send(200, open(full, 'rb').read())
        m = re.match(r'^/api/dance/(\d+)$', p)
        if m:
            slot = int(m.group(1))
            pm = [re.match(r'^(HP\d[UJE]?)_(\d{3})_([SLE])(\d{2})$', x) for x in q.get('parts', '').split(',') if x]
            if len(pm) == 5 and all(pm):
                # a given set of picks (the five parts a Dolphin dump shows), for checking against camtrace
                d = dance.pool_dance_parts(os.path.join(g.files, 'dance'),
                                           [(x.group(1), int(x.group(2)), x.group(3), int(x.group(4))) for x in pm])
                return self.send(200, d) if d else self.send(404, {'error': 'no dance'})
            cho = bool(g.hp4 and q.get('cho') == '1')     # (HP4: a CHOREOGRAPH player -> the CHO cue sheet)
            ck = (slot, cho)
            if ck not in DANCE_CACHE:
                if len(DANCE_CACHE) > 3:
                    DANCE_CACHE.pop(next(iter(DANCE_CACHE)))
                try:
                    lesson = slot - g.LESSON_BASE if g.LESSON_BASE < slot <= g.LESSON_BASE + 15 else None
                    DANCE_CACHE[ck] = (dance.dance_hp4(g.files, slot, lesson, cho) if g.hp4 else dance.dance_for(g.files, g.dol, slot))
                except (OSError, struct.error, ValueError) as ex:
                    log('dance', slot, 'failed:', ex)
                    DANCE_CACHE[ck] = None
            d = DANCE_CACHE[ck]
            if d and d.get('parts'):
                DANCE_CACHE.pop(ck, None)      # a pool song's dance is picked anew every play (dance.pool_picks)
                log('dance', slot, d['parts'])
            return self.send(200, d) if d else self.send(404, {'error': 'no dance'})
        if p == '/api/menumovie':
            for rel in ('select/OP.thp', 'select/OP43.thp'):
                if os.path.isfile(os.path.join(g.files, 'movie', rel.replace('/', os.sep))):
                    return self.send(200, {'file': rel})
            return self.send(404, {'error': 'none'})
        m = re.match(r'^/api/hp(dance|char)/(\d+)$', p)
        if m:
            h = STATE['hp']
            if not h:
                return self.send(404, {'error': 'no disc'})
            if m.group(1) == 'dance':
                path = h.dance_path(int(m.group(2)))
            else:
                path = h.char_path(m.group(2)) if re.match(r'^\d{3}$', m.group(2)) else None
            if not path:
                return self.send(404, {'error': 'not found'})
            if path not in STAGE_CACHE:
                if len(STAGE_CACHE) > 8:
                    STAGE_CACHE.pop(next(iter(STAGE_CACHE)))
                if m.group(1) == 'dance':
                    d000 = os.path.join(h.files, 'dll', 'd000Dll.rel')
                    data = hpchar.dance(path, d000 if os.path.isfile(d000) else None, h.song(int(m.group(2)))['ssq'])
                else:
                    data = hpchar.character(path)
                STAGE_CACHE[path] = json.dumps(data).encode()
            return self.send(200, STAGE_CACHE[path], 'application/json')
        # Hottest Party 2's (and 3's) dancers: /api/hp2char/<base CHR number xy0>/<outfit 1-4>, /api/hp2dance/<slot>
        # (HP3 keeps its models in sound/stream/character, like DDR II; the same reader works for them)
        m = re.match(r'^/api/hp([23])(char/(\d{2})0/(\d)|dance/(\d+))$', p)
        if m:
            g2 = STATE.get('hp' + m.group(1))
            m = re.match(r'^/api/hp[23](char/(\d{2})0/(\d)|dance/(\d+))$', p)
            if not g2:
                return self.send(404, {'error': 'no disc'})
            if m.group(2):
                cd = os.path.join(g2.files, 'character')
                if not os.path.isdir(cd):
                    cd = os.path.join(g2.files, 'sound', 'stream', 'character')
                path = os.path.join(cd, 'CHR%s0.bin' % m.group(2))
                outfit = os.path.join(cd, 'CHR%s%s.bin' % (m.group(2), m.group(3)))
                key = outfit
            else:
                s = g2.song(int(m.group(4)))
                path = s and os.path.join(g2.files, 'motion', 'MOT010_SSQ%03d.bin' % (s['ssq'] + 1))
                key = path
            if not path or not os.path.isfile(path):
                return self.send(404, {'error': 'not found'})
            if key not in STAGE_CACHE:
                if len(STAGE_CACHE) > 8:
                    STAGE_CACHE.pop(next(iter(STAGE_CACHE)))
                try:
                    if m.group(2):
                        data = hp2char.character(path, outfit)
                    else:
                        bpm = s.get('bpm') or [120]
                        data = hp2char.dance(path, (bpm[0] if isinstance(bpm, list) else bpm) or 120)
                except Exception as ex:
                    log('hp2', p, 'failed:', ex)
                    return self.send(404, {'error': str(ex)})
                STAGE_CACHE[key] = json.dumps(data).encode()
            return self.send(200, STAGE_CACHE[key], 'application/json')
        m = re.match(r'^/api/hpbgm/(\d{3})$', p)
        if m:
            h = STATE['hp']
            d = h and os.path.join(h.files, 'sound', 'stream')
            hit = d and next((f for f in os.listdir(d) if f.lower() == 'mu_bgm_%s.brstm' % m.group(1)), None)
            return self.send(200, open(os.path.join(d, hit), 'rb').read()) if hit else self.send(404, {'error': 'no bgm'})
        m = re.match(r'^/api/hpidx/(arrow)/(\d+)$', p)
        if m:
            h = STATE['hp']
            img = h and h.ui_index(m.group(1), int(m.group(2)))
            return self.send(200, img, 'image/png') if img else self.send(404, {'error': 'no image'})
        m = re.match(r'^/api/hpui/(ddrmodesel|selcom|win|playersel|chrsel|ctrsel|ddrresultsp|gamemes|matcheck|effect|arrow)/(\d+)$', p)
        if m:
            h = STATE['hp']
            img = h and h.ui(m.group(1), int(m.group(2)))
            return self.send(200, img, 'image/png') if img else self.send(404, {'error': 'no image'})
        if p == '/api/hpimg/logo':
            h = STATE['hp']
            img = h and h.logo()
            return self.send(200, img, 'image/png') if img else self.send(404, {'error': 'no logo'})
        if p == '/api/hpstages':
            h = STATE['hp']
            return self.send(200, h.stage_list() if h else [])
        if p == '/api/hpmenu':
            h = STATE['hp']
            path = h and os.path.join(h.files, 'data', 'win.bin')
            if not path or not os.path.isfile(path):
                return self.send(404, {'error': 'no menu'})
            if 'menu' not in STAGE_CACHE:
                STAGE_CACHE['menu'] = json.dumps(hpstage.menu(path)).encode()
            return self.send(200, STAGE_CACHE['menu'], 'application/json')
        m = re.match(r'^/api/ddr2stage/(\d+)$', p)
        if m:                                       # DDR II's own 3D stage for this song (see Game.stage_for)
            g0 = STATE.get('game')
            pk = int(q['pick']) if g0 and getattr(g0, 'hp4', False) and re.match(r'^[0-7]$', q.get('pick', '')) else None
            n = (g0.stage_for(int(m.group(1)), pk) if pk is not None else g0.stage_for(int(m.group(1)))) if g0 else None
            if g0 and re.match(r'^\d{1,3}$', q.get('n', '')):     # a stage by its id (for testing)
                n = int(q['n'])
            path = n is not None and os.path.join(g0.files, 'stage', 'STG%03d.bin' % (n + 1))
            if not path or not os.path.isfile(path):
                return self.send(404, {'error': 'no stage'})
            extras = [] if q.get('n') and not q.get('x') else g0.stage_extras(int(m.group(1)))
            key = path + '|' + ','.join(map(str, extras))
            if key not in STAGE_CACHE:
                if len(STAGE_CACHE) > 2:
                    STAGE_CACHE.pop(next(iter(STAGE_CACHE)))
                try:
                    st = hp2stage.stage(path, ddr2=True)
                    st['id'] = n
                    # the song's two extra stage files = the stage's variants 1 and 2, which the dance's cues
                    # switch to (column 9: 0x80113838 -> 0x80129308 / 0x8005386c); each has its own movie
                    # (0x80055590 slots 1, 2 - Dolphin memory 0x808b13e4 kinds 3 / 1 / 2 = single06 / bgv16 /
                    # quarter for STG017 + STG421 + STG406). A kind-1 (bgv) variant is the movie behind the
                    # dancers in place of a stage
                    try:
                        sc0 = ddr2fx.stage_screen(path)
                    except Exception:
                        sc0 = None
                    st['variantKinds'] = [sc0.get('kind') if sc0 else -1]
                    st['extras'] = []
                    for k, x in enumerate(extras):
                        p2 = os.path.join(g0.files, 'stage', 'STG%03d.bin' % (x + 1))
                        if not os.path.isfile(p2):
                            continue
                        try:
                            s2 = hp2stage.stage(p2, ddr2=True)
                        except Exception as ex:
                            log('ddr2 extra stage', x, 'failed:', ex)
                            continue
                        for md in s2.get('models', []):
                            md['movieSlot'] = k + 1
                        try:
                            sc2 = ddr2fx.stage_screen(p2)
                        except Exception:
                            sc2 = None
                        st['variantKinds'].append(sc2.get('kind') if sc2 else -1)
                        st['models'] = st.get('models', []) + s2.get('models', [])
                        st['extras'].append(x)
                    # the backup silhouettes' picture: main.dol's 32-byte stage records at 0x802b8eb0
                    # (record = stage id - 4), word +28: 0-2 = stage/STG_SILHOUETTE01-03.tpl, else none
                    # (0x80118724 loads STG_SILHOUETTE%02d with +28 + 1; checked against Dolphin logs/memory)
                    # the dancers' ambient colour for each variant (the stage, then its extra files)
                    # (HP4: its own stage records and effect slots - ddr2fx.HP4_CFG; no silhouettes or boss stage)
                    st['dancerAmb'] = [g0.dancer_ambient(v) for v in [n] + st['extras']]
                    st['silhouette'] = 0
                    if 4 <= n < 36 and not g0.hp4:
                        try:
                            v = struct.unpack('>i', g0.dol.bytes(0x802B8EB0 + 32 * (n - 4) + 28, 4))[0]
                            st['silhouette'] = v + 1 if 0 <= v <= 2 else 0
                        except Exception:
                            pass
                    if n in (200, 204, 205) and not g0.hp4:
                        # the boss stage (STG201 and its _02 / _03 copies): the OBJA_Z_ props are the
                        # opening scene played before READY (the grass island with the record player,
                        # its sky and the wormhole); the song itself is danced in the neon tunnel
                        # (DRAW_STG201_0n) in space (BG_STG201), the dancers flying through it
                        # (Dolphin footage: the opening - a wipe onto the island, the three dancers on the
                        # grass at night, the portal opening above them, the flight up - then READY in the
                        # tunnel). The OBJA_Z_ props are drawn only during the opening, with its cameras
                        for md in st['models']:
                            if md.get('name', '').startswith('OBJA_Z_'):
                                md['intro'] = True
                        st['introCams'] = hp2stage.intro_cameras(path)
                    cam = os.path.join(g0.files, 'game', 'GAME_DEF_CAM.bin')
                    if os.path.isfile(cam):             # the game's own gameplay camera moves
                        cams = hp2stage.ddr2_cameras(cam)
                        if cams:
                            st['cameras'] = cams
                    try:                                # effects, their spots and the stage's light (ddr2fx.py)
                        st['fx'] = ddr2fx.stage_effects(path, g0.files, g0.dol, n, ddr2fx.HP4_CFG if g0.hp4 else None)
                    except Exception as ex:
                        log('ddr2 stage effects', n, 'failed:', ex)
                    # materials tagged 11-90 take their light channel's colours (0x8004d91c): material white,
                    # ambient = the channel's (ddr2fx.stage_fx light.channel) - only the boss portal has them
                    chans = ((st.get('fx') or {}).get('light') or {}).get('channel')
                    if chans:
                        for md in st.get('models', []):
                            if md.get('movieSlot'):
                                continue
                            for mt in md.get('materials', []):
                                gx = mt.get('gx') or {}
                                tg = gx.get('tag') or 0
                                if 11 <= tg <= 90 and (tg - 11) // 10 < len(chans):
                                    gx['mat'] = [255, 255, 255, gx.get('mat', [0, 0, 0, 255])[3]]
                                    gx['amb'] = chans[(tg - 11) // 10]
                    STAGE_CACHE[key] = json.dumps(st).encode()
                    log('ddr2 stage', n, 'for song', m.group(1), 'extras', st['extras'], 'models', len(st['models']), 'screens',
                        sum(1 for md in st['models'] for mt in md.get('materials', []) if (mt.get('gx') or {}).get('movie')),
                        'silhouette', st.get('silhouette'))
                except Exception as ex:
                    log('ddr2 stage', n, 'failed:', ex)
                    return self.send(404, {'error': 'no stage'})
            return self.send(200, STAGE_CACHE[key], 'application/json')
        m = re.match(r'^/api/ddr2sil/([1-3])/(\d{1,2})$', p)
        if m:                                       # stage/STG_SILHOUETTE0n.tpl: 40 frames of the backup silhouettes' texture
            g0 = STATE.get('game')
            path = g0 and os.path.join(g0.files, 'stage', 'STG_SILHOUETTE%02d.tpl' % int(m.group(1)))
            if not path or not os.path.isfile(path):
                return self.send(404, {'error': 'no silhouette'})
            key = ('sil', path)
            if key not in STAGE_CACHE:
                d = open(path, 'rb').read()
                STAGE_CACHE[key] = [hp2.tpl_png(d, w, h, f, o) for w, h, f, o in hp2.tpl_list(d, 0)]
            fr = STAGE_CACHE[key]
            i = int(m.group(2))
            return self.send(200, fr[i % len(fr)], 'image/png') if fr else self.send(404, {'error': 'empty'})
        m = re.match(r'^/api/ddr2movie/(\d+)$', p)
        if m:                                       # the movie on the stage's screens (ddr2fx.screen_movie)
            g0 = STATE.get('game')
            n = g0.stage_for(int(m.group(1))) if g0 else None
            if g0 and re.match(r'^\d{1,3}$', q.get('n', '')):
                n = int(q['n'])
            path = n is not None and os.path.join(g0.files, 'stage', 'STG%03d.bin' % (n + 1))
            mv, scr = None, None
            if path and os.path.isfile(path):
                try:
                    scr = ddr2fx.stage_screen(path)
                    import random as _r
                    mv = ddr2fx.screen_movie(g0.files, scr, int(m.group(1)), _r.Random())
                except Exception as ex:
                    log('ddr2 stage movie failed:', ex)
            # the extra stage files' screens: each plays its own (0x80055590 is run for slots 0-2)
            movies = [mv]
            if g0 and not q.get('n2'):
                import random as _r2
                for x in g0.stage_extras(int(m.group(1))):
                    p2 = os.path.join(g0.files, 'stage', 'STG%03d.bin' % (x + 1))
                    try:
                        movies.append(ddr2fx.screen_movie(g0.files, ddr2fx.stage_screen(p2), int(m.group(1)), _r2.Random())
                                      if os.path.isfile(p2) else None)
                    except Exception:
                        movies.append(None)
            log('ddr2 stage movie', n, '->', movies, '| screen', scr)
            return self.send(200, {'movie': mv, 'movies': movies})
        if p == '/api/hp4tasktext':
            # HP4's challenge task window lines (text_eng.bin group 15, a ZMS table: 17 entries at +0x60, 8 bytes
            # each, the string at entry + 0x20; each has a %s for the bonus): 0-3 difficulty, 4-7 gauge 60 / 75 /
            # 90 / 100, 8-11 combo 50 / 100 / 200 / FULL, 12-16 rank C..AAA (0x8010f984 -> 0x800edb04)
            g0 = STATE.get('game')
            lines = []
            try:
                d = open(os.path.join(g0.files, 'text', 'text_eng.bin'), 'rb').read()
                _, o, sz = hp2stage.wii_entries(d)[15]
                b = d[o:o + sz]
                if b[:4] == b'ZMS\0':
                    n = struct.unpack_from('>I', b, 0x28)[0]
                    for i in range(min(n, 64)):
                        of = struct.unpack_from('>I', b, 0x60 + 8 * i)[0] + 0x20
                        lines.append(b[of:].split(b'\0')[0].decode('utf-8', 'replace'))
            except (OSError, IndexError, struct.error, AttributeError):
                lines = []
            return self.send(200, {'lines': lines})
        if p == '/api/hp4bank2':
            # HP4's effect bank 2 (game/GAME_CMN_<region>.bin entry 0, its entry 7): the combo hit bursts on the
            # step zone (0x80089870 -> 0x8008c2f4 -> 0x8008bedc), loaded by 0x800882c0 -> 0x8008c450
            g0 = STATE.get('game')
            b2 = None
            try:
                import glob as _g
                for gp in sorted(_g.glob(os.path.join(g0.files, 'game', 'GAME_CMN_*.bin')), key=lambda q: 'GAME_CMN_US' not in q):
                    gd = open(gp, 'rb').read()
                    top0 = hp2stage.wii_entries(gd)
                    sub = hp2stage.wii_entries(gd, top0[0][1]) if top0 else []
                    b2 = ddr2fx.bank(gd, sub[7][1]) if len(sub) > 7 else None
                    if b2:
                        break
            except Exception as ex:
                log('hp4 bank 2 failed:', ex)
                b2 = None
            return self.send(200, {'bank2': b2})
        if p == '/api/hp4bank4':
            # HP4's effect bank 4 (select/select_cmn.bin entry 2): the title starts its effect 0 at frame 200
            # (0x800d3a1c state 0xd, through 0x800f2a6c), the song card its effect 3
            g0 = STATE.get('game')
            try:
                sd = open(os.path.join(g0.files, 'select', 'select_cmn.bin'), 'rb').read()
                ents = dance.wii_entries(sd)
                b4 = ddr2fx.bank(sd, ents[2][0]) if len(ents) > 2 else None     # (entry = (offset, size))
            except Exception as ex:
                log('hp4 bank 4 failed:', ex)
                b4 = None
            return self.send(200, {'bank4': b4})
        if p == '/api/ddr2demo':
            g0 = STATE.get('game')
            return self.send(200, {'demos': g0.demos() if g0 else []})
        m = re.match(r'^/api/cae/([a-zA-Z0-9_]+)$', p)
        if m:                                       # a menu file's 2D layouts + animation scripts (cae.py)
            g0 = STATE.get('game')
            key = m.group(1)
            rel = {'mus': 'select/selMusic_us.bin', 'res': 'select/selResult_US.bin', 'ttl': 'select/selTitle_US.bin',
                   'sel': 'select/select_bin_us.bin', 'scm': 'select/select_cmn.bin', 'af': '2Dcommon/comAF_US.bin',
                   'mmu': 'game/METER_MULTI_US.bin', 'fs2': 'game/METER_FS2_US.bin',
                   'gcu': 'game/GAME_CMN_US.bin'}.get(key)    # (gcu: HP4's song card, /0/4 + /0/5)
            path = None
            if g0 and rel:                          # the disc's file names differ in case (selResult_us / _US)
                folder, fname = os.path.split(os.path.join(g0.files, rel))
                if os.path.isdir(folder):
                    path = next((os.path.join(folder, f) for f in os.listdir(folder) if f.lower() == fname.lower()), None)
            if g0 and g0.hp4 and key in Resources.HP4_PATHS:   # (HP4: the meter sets inside GAME_CMN_US.bin)
                d = g0.res.get(key, '')
                path = None
            elif not path or not os.path.isfile(path):
                return self.send(404, {'error': 'no such file'})
            else:
                d = open(path, 'rb').read()
            if not d:
                return self.send(404, {'error': 'no such file'})
            out = []
            # (each block's WII node: its pictures are that node's entry 0, picture n = a part's sprite)
            nodes = {}

            def walk(base, path):
                if d[base:base + 4] != b'WII\0':
                    return
                ents = wii_entries(d, base)
                for i, (eo, es) in enumerate(ents):
                    if d[base + eo:base + eo + 8] == b'CAE_WII\0':
                        nodes[base + eo] = path
                    walk(base + eo, path + '/' + str(i))
            try:
                walk(0, '')
            except Exception:
                pass
            for o in cae.blocks(d):
                try:
                    out.append({'at': o, 'node': nodes.get(o), 'parts': cae.parse(d, o)})
                except Exception as ex:
                    out.append({'at': o, 'error': str(ex)})
            return self.send(200, {'blocks': out})
        if p == '/api/appeal':
            # the combo performance (main.dol 0x800fd1d0): the performing dancer's motion is clip
            # type x 2 (+1 for dancers whose flag bit 0 is set, table 0x8026e898 / 0x802b8824) of
            # game/GAME_APL_MOT01.bin, the camera the same-numbered move of GAME_APL_CAM0n (n = style + 1)
            g0 = STATE['game']
            try:
                style = max(0, min(3, int(q.get('style', 0))))
                gd = os.path.join(g0.files, 'game')
                d = open(os.path.join(gd, 'GAME_APL_MOT01.bin'), 'rb').read()
                clips = []
                for o, s2 in dance.wii_entries(d):
                    c = dance.clip(d[o:o + s2]) if s2 else None
                    clips.append(dict(frames=struct.unpack_from('>I', d, o + 0x10)[0], bones=c) if c else None)
                cams = hp2stage.appeal_cameras(os.path.join(gd, 'GAME_APL_CAM%02d.bin' % (style + 1)))
                alt = {}
                for i in range(9):                  # DDR II's dancers, ids 200-208 (files CHR201-209)
                    alt[str(201 + i)] = g0.dol.u32(0x8026E9B0 + 4 * i) & 1
                for i in range(10):                 # Mii bodies 80-89
                    alt['m%d' % (80 + i)] = g0.dol.u32(0x8026E9D8 + 4 * i) & 1
                # its stage effects (0x800535f0): GAME_APL_EFF.bin's TEB (bank 3), effect A[style][clip]
                # (0x80271200, 10 a row) and B[style][type] (0x802712a0, 5 a row), -1 = none
                i32 = lambda va: struct.unpack('>i', struct.pack('>I', g0.dol.u32(va)))[0]
                ea = [i32(0x80271200 + 40 * style + 4 * k) for k in range(10)]
                eb = [i32(0x802712A0 + 20 * style + 4 * k) for k in range(5)]
                eff = None
                try:
                    eff = ddr2fx.bank(open(os.path.join(gd, 'GAME_APL_EFF.bin'), 'rb').read(), 0)
                except Exception as ex:
                    log('appeal effects failed:', ex)
                # its light show (0x80115b80): table 0x802bea80 [style x 60 + type x 12] = F, G, colour C;
                # the dancers' ambient becomes clamp(C x F) at once, light 0 stays G (1.0 = white)
                f32 = lambda va: struct.unpack('>f', g0.dol.bytes(va, 4))[0]
                lights = []
                for k in range(5):
                    a = 0x802BEA80 + 60 * style + 12 * k
                    c = g0.dol.u32(a + 8)
                    lights.append(dict(F=round(f32(a), 4), G=round(f32(a + 4), 4),
                                       amb=[min(255, int(struct.unpack('>f', struct.pack('>f', ((c >> sh) & 255) * f32(a)))[0]))
                                            for sh in (24, 16, 8)]))
                # its face script (0x80114d18 steps it, 60 a second): 0x802bee60 [alt x 80 + style x 20 + type x 4]
                # -> (value 0-9, until-frame) entries, frame 0 = to the end; a list in .bss (not in the file)
                # is all zero at run time = value 0 throughout (checked in a Dolphin dump)
                def u32s(va):
                    try:
                        return g0.dol.u32(va)
                    except Exception:
                        return 0
                faces = []
                for a2 in range(2):
                    row = []
                    for k in range(5):
                        ptr, ents = u32s(0x802BEE60 + 80 * a2 + 20 * style + 4 * k), []
                        for e in range(32):
                            v, fr = u32s(ptr + 8 * e), u32s(ptr + 8 * e + 4)
                            ents.append([v if 0 <= v <= 9 else 0, fr])
                            if fr == 0:
                                break
                        row.append(ents)
                    faces.append(row)
                return self.send(200, dict(clips=clips, cams=cams, alt=alt, effA=ea, effB=eb, bank3=eff, lights=lights, faces=faces))
            except Exception as ex:
                log('appeal failed:', ex)
                return self.send(404, {'error': str(ex)})
        if p == '/api/hp4text':                     # a few of the game's own messages (text_eng.bin entries by number)
            g0 = STATE.get('game')
            out = {}
            try:
                d = open(os.path.join(g0.files, 'text', 'text_eng.bin'), 'rb').read()
                L = d.split(b'\0')
                for k in (q.get('ids') or '').split(','):
                    if k.isdigit() and int(k) < len(L):
                        t = L[int(k)].decode('utf-8', 'replace')
                        t = re.sub(r'#sl\S*', '', re.sub(r'#t[a-z]', '', t))
                        out[k] = re.sub(r'[ \t]+', ' ', t).strip()
            except (OSError, AttributeError):
                pass
            return self.send(200, out)
        if p == '/api/ddr2credits':                 # the game's staff credits (text_eng.bin, the entry holding "STAFF")
            g0 = STATE.get('game')
            out = []
            try:
                d = open(os.path.join(g0.files, 'text', 'text_eng.bin'), 'rb').read()
                for _, o, sz in hp2stage.wii_entries(d):
                    blob = d[o:o + sz]
                    if b'#cfDIRECTOR' not in blob:
                        continue
                    on = False
                    for raw in blob.split(b'\0'):
                        t = raw.decode('utf-8', 'replace')
                        if t.startswith('DanceDanceRevolution'):
                            on = True
                        if not on or len(t) < 2 or any(ord(c) < 32 and c != '\n' for c in t) or t in ('ZMS', 'WII'):
                            continue
                        kind = 'head' if t.startswith('#cf') else 'section' if t.startswith('#cd') else 'name'
                        out.append([kind, re.sub(r'#c[a-z]', '', t).strip()])
                    break
            except (OSError, AttributeError):
                pass
            return self.send(200, {'lines': out})
        if p == '/api/ddr2tour':                    # DDR II's TOURNAMENT MODE (main.dol table + text_eng.bin)
            g0 = STATE.get('game')
            return self.send(200, g0.tournament() if g0 else None)
        if p == '/api/ddr2tasks':
            # DDR II's challenge task tables (main.dol 0x80291bc8; DDR2_SPEC.md "Challenge task"): which
            # task is ANY SONG (20), the specified songs for the three DDR-point ranges (27 / 19 / 19 song
            # ids), and per range the required difficulty (15), gauge (7 bytes at 0x802e9600 + 8 x range),
            # MAX COMBO (12 halfwords, -1 = FULL COMBO) and rank (9: 2 C .. 5 AA)
            g = STATE.get('game')
            if not g:
                return self.send(404, {'error': 'no game'})
            if g.hp4:
                return self.send(200, g.tasks())
            B = 0x80291BC8
            i32 = lambda va: struct.unpack('>i', g.dol.bytes(va, 4))[0]
            ws = lambda o, n: [i32(B + o + 4 * k) for k in range(n)]
            hs = lambda o, n: list(struct.unpack('>%dh' % n, g.dol.bytes(B + o, 2 * n)))
            return self.send(200, dict(
                kind=ws(0, 20),
                songs=[ws(80, 27), ws(188, 19), ws(264, 19)],
                diff=[ws(340, 15), ws(400, 15), ws(460, 15)],
                gauge=[list(g.dol.bytes(0x802E9600 + 8 * r, 7)) for r in range(3)],
                combo=[hs(520, 12), hs(544, 12), hs(568, 12)],
                rank=[ws(592, 9), ws(628, 9), ws(664, 9)]))
        if p == '/api/ddr2unlocks':                 # DDR II's own DDR-points unlock table (main.dol)
            g0 = STATE.get('game')
            return self.send(200, g0.unlocks() if g0 else None)
        if p == '/api/ddr2courses':                 # DDR II's own COURSE 1-10 and WORKOUT 1-10 (main.dol)
            g0 = STATE.get('game')
            return self.send(200, g0.courses() if g0 else None)
        if p == '/api/hp1gc':                      # GROOVE CIRCUIT (Hottest Party's requests, from its disc)
            h = STATE['hp']
            r = hp.gc_requests(h.files) if h else None
            if r:
                hid = getattr(h, 'hidden', [])
                r['lesson'] = hid[0]['slot'] if hid else None
                r['lessonSong'] = hid[0] if hid else None
                r['table'] = hp.gc_table(h.sysdir)          # the game's own request table (main.dol)
            return self.send(200, r)
        if p == '/api/hp2ga':                      # GROOVE ARENA (Hottest Party 2's requests, from its disc)
            h2 = STATE['hp2']
            r = hp2.ga_texts(h2.files) if h2 else None
            if r:
                r['rounds'] = hp2.ga_rounds(h2.sysdir, r['requests'])     # the game's own table (main.dol)
                r['courses'] = hp2.ga_courses(h2.sysdir)                    # and its 20 courses
            return self.send(200, r)
        if p == '/api/lessons' and q.get('game') == 'ddr2':   # DDR II's own DDR SCHOOL
            g0 = STATE.get('game')
            return self.send(200, g0.lessons() if g0 else [])
        if p == '/api/lessons':                    # DDR SCHOOL (Hottest Party 3's lessons)
            h3 = STATE['hp3']
            return self.send(200, h3.lessons() if h3 else [])
        m = re.match(r'^/api/hp3(art/(\d+)|sel/([0-9.]+))$', p)
        if m:
            h3 = STATE['hp3']
            img = h3 and (h3.art(int(m.group(2))) if m.group(2) else h3.sel([int(x) for x in m.group(3).split('.') if x]))
            return self.send(200, img, 'image/png') if img else self.send(404, {'error': 'no image'})
        m = re.match(r'^/api/hp2art/(\d+)$', p)
        if m:
            h2 = STATE['hp2']
            img = h2 and h2.art(int(m.group(1)))
            return self.send(200, img, 'image/png') if img else self.send(404, {'error': 'no image'})
        m = re.match(r'^/api/hp2(gui|sel)/(\d+)$', p)
        if m:
            h2 = STATE['hp2']
            img = h2 and (h2.gui if m.group(1) == 'gui' else h2.sel)(int(m.group(2)))
            return self.send(200, img, 'image/png') if img else self.send(404, {'error': 'no image'})
        # Hottest Party 2's and 3's stages (the same formats): /api/hp2stages, /api/hp3stage/NNN ...
        m = re.match(r'^/api/hp([23])stages$', p)
        if m:
            h2 = STATE['hp' + m.group(1)]
            d = h2 and os.path.join(h2.files, 'stage')
            names = sorted(n[3:6] for n in os.listdir(d) if re.match(r'^STG\d{3}\.bin$', n)) if d and os.path.isdir(d) else []
            # (Hottest Party 3's 2xx stages put the camera inside their sky dome: left out until that's sorted)
            return self.send(200, [n for n in names if n != '000' and not (m.group(1) == '3' and n.startswith('2'))])
        m = re.match(r'^/api/hp([23])stage/(\d{3})$', p)
        if m:
            h2 = STATE['hp' + m.group(1)]
            path = h2 and os.path.join(h2.files, 'stage', 'STG%s.bin' % m.group(2))
            if not path or not os.path.isfile(path):
                return self.send(404, {'error': 'no stage'})
            if path not in STAGE_CACHE:
                if len(STAGE_CACHE) > 2:
                    STAGE_CACHE.pop(next(iter(STAGE_CACHE)))
                STAGE_CACHE[path] = json.dumps(hp2stage.stage(path)).encode()
            return self.send(200, STAGE_CACHE[path], 'application/json')
        m = re.match(r'^/api/hpstage/(\d+)$', p)
        if m:
            h = STATE['hp']
            path = h and h.stage_path(int(m.group(1)), q.get('stage', 'random'))
            if h and re.match(r'^\d\d$', q.get('n', '')):          # a stage by its number (for testing)
                path = os.path.join(h.files, 'data', 'stg%s.bin' % q['n'])
                path = path if os.path.isfile(path) else None
            if not path:
                return self.send(404, {'error': 'no stage'})
            if path not in STAGE_CACHE:
                if len(STAGE_CACHE) > 2:
                    STAGE_CACHE.pop(next(iter(STAGE_CACHE)))
                STAGE_CACHE[path] = json.dumps(hpstage.stage(path)).encode()
            return self.send(200, STAGE_CACHE[path], 'application/json')
        m = re.match(r'^/api/(chart|audio|preview|jacket|title)/(\d+)$', p)
        if m and int(m.group(2)) >= hp.SLOT_BASE:
            kind, n = m.group(1), int(m.group(2))
            h = STATE['hp3'] if n >= hp3.SLOT_BASE else STATE['hp2'] if n >= hp2.SLOT_BASE else STATE['hp']
            if not h or not h.song(n):
                return self.send(404, {'error': 'no such song'})
            if kind == 'chart':
                return self.send(200, h.chart(n))
            if kind == 'audio':
                return self.send(200, h.audio(n))
            if kind == 'preview':
                path = h.preview_path(n)
                return self.send(200, open(path, 'rb').read()) if path else self.send(404, {'error': 'no preview'})
            img = h.jacket(n) if kind == 'jacket' else None
            return self.send(200, img, 'image/png') if img else self.send(404, {'error': 'no image'})
        if m:
            kind, n = m.group(1), int(m.group(2))
            if kind == 'chart' and g.LESSON_BASE < n <= g.LESSON_BASE + 15:
                return self.send(200, g.lesson_chart(n - g.LESSON_BASE))
            if kind == 'chart':
                path = g.chart_path(n)
                return self.send(200, open(path, 'rb').read()) if os.path.isfile(path) else self.send(404, {'error': 'no chart'})
            if kind == 'audio':
                return self.send(200, g.audio(n))
            if kind == 'preview':
                path = g.preview_path(n)
                return self.send(200, open(path, 'rb').read()) if path else self.send(404, {'error': 'no preview'})
            img = g.art.image('jacket' if kind == 'jacket' else 'title', n)
            return self.send(200, img) if img else self.send(404, {'error': 'no image'})
        self.send(404, {'error': 'unknown'})

    # every POST address (saving settings and saves, setup, custom songs, lights ...)
    def route_post(self, p, body):
        if p == '/api/quit':
            # (a newer copy starting up asks an older one to make way - main())
            log('a newer copy asked this one to quit - shutting down')
            self.send(200, {'ok': True})
            threading.Timer(0.3, lambda: os._exit(0)).start()
            return
        if p == '/api/bye':
            PAGES['bye'] = time.time()
            return self.send(200, {'ok': True})
        if p == '/api/save':
            tmp = SAVE + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(body, f, indent=1)
            os.replace(tmp, SAVE)
            return self.send(200, {'ok': True})
        if p == '/api/settings':
            s = load_settings()
            s.update(body)
            save_settings(s)
            return self.send(200, {'ok': True})
        if p == '/api/dancermodel':
            # {pick: true} opens a file window; {path: ''} goes back to the built-in dancer
            path = pick_file() if body.get('pick') else body.get('path', '')
            if path is None:
                return self.send(200, {'ok': False, 'path': load_settings().get('dancer_model', '')})
            s = load_settings()
            s['dancer_model'] = path
            save_settings(s)
            return self.send(200, {'ok': True, 'path': path})
        if p == '/api/custom':
            # {create: name} | {delete: folder} | {remove: song id} | {import: folder, pick: 'files'|'folder'} | {import, paths}
            lib = library()
            try:
                if 'create' in body:
                    return self.send(200, {'ok': True, 'folder': lib.create(body['create'])})
                if 'delete' in body:
                    lib.delete(body['delete'])
                    return self.send(200, {'ok': True})
                if 'remove' in body:
                    lib.remove(body['remove'])
                    return self.send(200, {'ok': True})
                if 'import' in body:
                    paths = body.get('paths') or pick_songs(body.get('pick', 'files'))
                    if not paths:
                        return self.send(200, {'ok': False, 'error': 'Nothing picked.'})
                    added, skipped, noconv = lib.import_paths(body['import'], paths)
                    return self.send(200, {'ok': True, 'added': added, 'skipped': skipped, 'noVideo': noconv})
                if 'rescan' in body:
                    lib.scan()
                    return self.send(200, {'ok': True})
            except (OSError, ValueError) as ex:
                return self.send(200, {'ok': False, 'error': str(ex)})
            return self.send(400, {'error': 'bad request'})
        if p == '/api/lights':
            if 'bits' in body:
                LIGHTS.set(body['bits'])
                return self.send(200, {'ok': True})
            if body.get('pick'):
                path = pick_path('Pick PacDrive64.dll (from Ultimarc\'s PacDrive SDK)', 'PacDrive DLL (PacDrive*.dll)|PacDrive*.dll')
                if path:
                    st = load_settings(); st['pacdrive_dll'] = path; save_settings(st)
                    LIGHTS.start(path)
            elif body.get('start'):
                LIGHTS.start(load_settings().get('pacdrive_dll'))
            return self.send(200, LIGHTS.status())
        if p == '/api/setup':
            what = body.get('pick')
            if SETUP['busy']:
                return self.send(200, setup_status())
            if what == 'iso':
                path = body.get('path') or pick_path('Pick your Dance Dance Revolution II (USA) Wii disc',
                                                     'Wii discs (*.iso;*.wbfs;*.rvz;*.gcz;*.ciso;*.wia)|*.iso;*.wbfs;*.rvz;*.gcz;*.ciso;*.wia')
                if path and disc_kind(path) == 'hp':
                    use_hp_disc(path)           # the Hottest Party disc picked on this row: add it as the extra disc
                elif path:
                    use_disc(path)
                else:
                    SETUP['msg'] = 'No disc picked.'
            elif what == 'ffmpeg':
                path = body.get('path') or pick_path('Pick ffmpeg.exe', 'ffmpeg (ffmpeg.exe)|ffmpeg.exe')
                if path and os.path.isfile(path):
                    st = load_settings(); st['ffmpeg'] = path; st.pop('ffmpeg_skip', None); save_settings(st)
                    apply_ffmpeg_setting()
                    SETUP['msg'] = 'ffmpeg found.' if ffmpeg_ok() else 'That file is not ffmpeg.exe.'
                else:
                    SETUP['msg'] = 'No ffmpeg picked.'
            elif what == 'dolphintool':
                path = body.get('path') or pick_path('Pick DolphinTool.exe (in your Dolphin folder)', 'DolphinTool (DolphinTool.exe)|DolphinTool.exe')
                if path and os.path.isfile(path):
                    st = load_settings(); st['dolphin_tool'] = path; save_settings(st)
                    SETUP['msg'] = 'DolphinTool found. Now pick your disc.'
            elif what == 'folder':
                path = body.get('path') or pick_folder()
                if path and hp3.find_files(path) and not locate_here(path):
                    open_hp3(path)                # a Hottest Party 3 folder: added as the fourth game
                    SETUP['msg'] = ('Hottest Party 3 added (%d songs).' % len(STATE['hp3'].songs)) if STATE['hp3'] \
                        else 'That folder could not be read: %s' % STATE['hp3Error']
                elif path and hp2.find_files(path) and not locate_here(path):
                    open_hp2(path)                # a Hottest Party 2 folder: added as the third game
                    SETUP['msg'] = ('Hottest Party 2 added (%d songs).' % len(STATE['hp2'].songs)) if STATE['hp2'] \
                        else 'That folder could not be read: %s' % STATE['hp2Error']
                elif path and hp.find_files(path) and not locate_here(path):
                    open_hp(path)                 # a Hottest Party folder: added as the extra disc
                    SETUP['msg'] = ('Hottest Party added (%d songs).' % len(STATE['hp'].songs)) if STATE['hp'] \
                        else 'That folder could not be read: %s' % STATE['hpError']
                elif path:
                    old = STATE['game']
                    open_game(path)
                    if not STATE['game'] and old:     # keep the game that was working
                        err = STATE['error']
                        STATE['game'] = old
                        SETUP['msg'] = 'That folder could not be read (%s). Still using %s.' % (err, old.root)
                    else:
                        SETUP['msg'] = 'Ready.' if STATE['game'] else 'That folder could not be read: %s' % STATE['error']
            elif what in ('hpiso', 'hpfolder'):
                if what == 'hpiso':
                    path = body.get('path') or pick_path('Pick your Dance Dance Revolution Hottest Party (USA) Wii disc',
                                                         'Wii discs (*.iso;*.wbfs;*.rvz;*.gcz;*.ciso;*.wia)|*.iso;*.wbfs;*.rvz;*.gcz;*.ciso;*.wia')
                    if path and disc_kind(path) == 'ddr2':
                        SETUP['msg'] = 'That is the DDR II disc - pick the Hottest Party one on this row.'
                        path = 'x'
                    elif path:
                        use_hp_disc(path)
                else:
                    path = body.get('path') or pick_folder()
                    if path:
                        open_hp(path)
                        SETUP['msg'] = 'Hottest Party added.' if STATE['hp'] else 'That folder could not be read: %s' % STATE['hpError']
                if not path:
                    SETUP['msg'] = 'Nothing picked.'
            elif what == 'hp2folder':
                path = body.get('path') or pick_folder()
                if path:
                    open_hp2(path)
                    SETUP['msg'] = ('Hottest Party 2 added (%d songs).' % len(STATE['hp2'].songs)) if STATE['hp2'] \
                        else 'That folder could not be read: %s' % STATE['hp2Error']
                else:
                    SETUP['msg'] = 'Nothing picked.'
            elif what == 'hp3folder':
                path = body.get('path') or pick_folder()
                if path:
                    open_hp3(path)
                    SETUP['msg'] = ('Hottest Party 3 added (%d songs).' % len(STATE['hp3'].songs)) if STATE['hp3'] \
                        else 'That folder could not be read: %s' % STATE['hp3Error']
                else:
                    SETUP['msg'] = 'Nothing picked.'
            elif what == 'hp3remove':
                STATE['hp3'] = None
                st = load_settings(); st.pop('hp3_folder', None); st['hp3_off'] = True; save_settings(st)
                SETUP['msg'] = 'Hottest Party 3 songs removed from the list (your disc and files are untouched).'
            elif what == 'hp2remove':
                STATE['hp2'] = None
                st = load_settings(); st.pop('hp2_folder', None); st['hp2_off'] = True; save_settings(st)
                SETUP['msg'] = 'Hottest Party 2 songs removed from the list (your disc and files are untouched).'
            elif what == 'hpremove':
                STATE['hp'] = None
                st = load_settings(); st.pop('hp_folder', None); st['hp_off'] = True; save_settings(st)
                SETUP['msg'] = 'Hottest Party songs removed from the list (your disc and files are untouched).'
            elif what == 'skipffmpeg':
                st = load_settings(); st['ffmpeg_skip'] = True; save_settings(st)
            return self.send(200, setup_status())
        if p == '/api/game':
            path = body.get('path') or pick_folder()
            if path:
                open_game(path)
            g = STATE['game']
            return self.send(200, {'ok': g is not None, 'error': STATE['error'], 'folder': path})
        self.send(404, {'error': 'unknown'})


# this copy's version: when server.py or any web file was last changed
def _version():
    try:
        ts = [os.path.getmtime(os.path.abspath(__file__))]
        for f in os.listdir(WEB):
            ts.append(os.path.getmtime(os.path.join(WEB, f)))
        return int(max(ts))
    except Exception:
        return 0


VERSION = _version()


# is the copy already running on this port older than this one?
def other_copy_is_older(url):
    # ask the copy on the port for its version; an older one (or one too old to have /api/version) is asked to
    # quit, and this one waits for the port
    import urllib.request
    try:
        with urllib.request.urlopen(url + 'api/version', timeout=3) as r:
            v = json.loads(r.read() or b'{}').get('version', 0)
    except Exception:
        v = 0
    if v >= VERSION:
        return False
    try:
        urllib.request.urlopen(urllib.request.Request(url + 'api/quit', data=b'{}', method='POST'), timeout=3).read()
    except Exception:
        pass
    for _ in range(50):
        time.sleep(0.2)
        try:
            urllib.request.urlopen(url + 'api/status', timeout=0.5).read()
        except Exception:
            log('the older copy has quit - starting this one')
            return True
    log('the older copy did not quit')
    return False


# the web server (one thread per request)
class Server(ThreadingHTTPServer):
    # one copy per port: no address reuse, and on Windows exclusive use (SO_REUSEADDR there lets a second
    # server bind the same port while the first keeps answering)
    # (elsewhere SO_REUSEADDR only lets a restart through a closed copy's TIME_WAIT, so it stays on)
    allow_reuse_address = os.name != 'nt'

    # take the port for this copy alone
    def server_bind(self):
        if os.name == 'nt' and hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


# the game page says it's there (GET /api/alive every 5 s) and goodbye when it closes (POST /api/bye);
# once a page has been seen, the server quits a few seconds after the goodbye (unless a page comes back -
# a reload), or after 3 minutes without a word (a crashed browser; hidden tabs still ping once a minute).
# --keep-running turns this off.
PAGES = {'last': None, 'bye': None}


# quit the program a few seconds after the game's page is closed (or 3 minutes after it was last heard from)
def watch_pages():
    while True:
        time.sleep(1)
        now, last, bye = time.time(), PAGES['last'], PAGES['bye']
        if last is None:
            continue
        gone = (bye is not None and bye >= last and now - bye > 6) or now - last > 180
        if gone:
            log('the game window was closed - shutting down')
            time.sleep(0.5)
            os._exit(0)


# start-up: read settings, open the game, start the server, open the browser
def main():
    apply_ffmpeg_setting()
    try:
        LIGHTS.start(load_settings().get('pacdrive_dll'))
        log('lights:', LIGHTS.msg)
    except Exception as ex:
        log('lights failed:', ex)
    folder = load_settings().get('game_folder') or default_game_folder()
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if args:
        folder = args[0]
    if folder:
        open_game(folder)
    st = load_settings()
    if HP4:                     # (Hottest Party 4 is its own game: no other discs' songs)
        st = dict(st, hp_off=True, hp2_off=True, hp3_off=True, hp_folder=None, hp2_folder=None, hp3_folder=None)
    hpf = st.get('hp_folder') or (None if st.get('hp_off') else hp.default_folder())
    if hpf:
        open_hp(hpf)
    hp2f = st.get('hp2_folder') or (None if st.get('hp2_off') else hp2.default_folder())
    if hp2f:
        open_hp2(hp2f)
    hp3.Thp = Thp
    hp3f = st.get('hp3_folder') or (None if st.get('hp3_off') else hp3.default_folder())
    if hp3f:
        open_hp3(hp3f)
    url = 'http://127.0.0.1:%d/' % PORT
    srv = None
    for attempt in range(2):
        try:
            srv = Server(('127.0.0.1', PORT), H)
            break
        except OSError as ex:
            err = ex
            # (an older copy - from before an update - makes way for this one; the same version is just opened)
            if attempt == 0 and other_copy_is_older(url):
                continue
            break
    if srv is None:
        ex = err
        # (another copy already has the port: open that one instead of starting a second, which on Windows
        # could share the port and leave the old copy answering)
        log('already running at', url, '- opening it (', ex, ')')
        if '--no-browser' not in sys.argv:
            webbrowser.open(url)
        time.sleep(2)
        return
    if '--keep-running' not in sys.argv:
        threading.Thread(target=watch_pages, daemon=True).start()
    log('DDR HP4 PC' if HP4 else 'DDR II PC', 'running at', url, '- close this window to quit')
    if '--no-browser' not in sys.argv:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    srv.serve_forever()


if __name__ == '__main__':
    main()
