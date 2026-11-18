# DDR HP4 PC - technical notes (Hottest Party 4 / DDR, Wii 2010, RDDEA4 US)

Started 2026-11-16. Same engine and file formats as DDR II (Hottest Party 5): 56% of DDR II's game code
and 80-85% of its engine match this main.dol, so DDR II PC's readers work on its files.

## Start-up
- "Play DDR HP4 PC.bat" runs `server.py --hp4`: port 8768, its own settings_hp4.json, save_hp4.json and
  log_hp4.txt (DDR II's settings.json / save.json / log.txt are never touched). The game folder is found
  in Downloads ("Dance Dance Revolution (USA) ..." with ddr/DATA/sys/main.dol and
  files/sound/DDRHP4_SOUND.brsar). Hottest Party 1-3 discs are not loaded in this mode.

## main.dol tables found
- Song table 0x8027fc68: 96 records of 296 bytes (DDR II: 200 x 412). One record per song (DDR II has a
  full / cut pair of slots); slot = record + 1, chart ssq/ss4/MU_DDR_<slot>.ss4 (68 files), sound row slot - 1.
  +0 short name ('music' = an empty slot, 'lesson..' = lessons), +4 flags, +8 -1, +16 a pointer,
  +24 BPM (a range as hi << 16 | lo), +128 block A: 4 levels (BEGINNER, BASIC, DIFFICULT, EXPERT),
  4 x 5 radar bytes (per difficulty: chaos, stream, voltage, air, freeze - DDR II's order), 4 u16 step
  counts; +160 block B (the 0x1a / 0x4a charts' levels: [1, 2, 3, 4] style), +192 bytes, +216 / +220 two
  values, +224 / +256 blocks C / D (another chart set with fewer steps). No song-length field: DDR HP4 PC
  reads it from the song's wave (sample count / rate).
- Sound rows 0x8025fc00: (wave group, music sound, voice sound, 0, 0) per slot, DDR II's layout (groups
  0.., music 84, 86 ...). Previews: sound 16 + slot = stream/MU_SAM_<slot>.brstm (55 files).
- 53 playable songs (records with a name, a chart with single charts, and music).

## Charts (ss4)
- Single 0x14 (difficulty << 8: 4 beginner, 1 basic, 2 difficult, 3 expert) as in DDR II; no Double (0x18).
- The loader (0x8002d91c) files a chart by its style code into chart mode m (table +0x120504 + 16m + 4 x
  difficulty, read by 0x8002e76c): 0x14 -> 0, 0x1a -> 1, 0x18 -> 2, 0x24 -> 3, 0x34 -> 4, 0x2a -> 5, 0x3a -> 6,
  0x44 / 0x4a -> 7. Panel bytes are lane numbers (0-3 the arrows, 4 / 5 the hand markers in the 0x?a charts).
- FAMILY charts 0x24 / 0x34: checked on every song that has them - every step of the 0x14 chart is in one
  or both of them and they hold nothing else (e.g. Basic 67 steps = 40 + 41, 14 in both). 0x2a / 0x3a are
  the same split of the hand-marker chart 0x1a. 0x4a: the Balance Board charts (see Wii Balance Board MODE).
  ssq/GIMMICK holds the gimmick pictures (hand, hips, shoot, arrow ...).

## Stages (main.dol)
- A stage id n is the file stage/STG(n+1).bin (loader 0x80107a50, format "stage/STG%03d%s.bin"; + 100 and
  the suffix "_P" in cases not traced yet - STG101-111, STG042_P / 046_P). Stage records (28 bytes,
  lookup 0x80025f40): ids 0-7 at 0x8027fc68 + 29816, 40-54 at + 29088, 60-70 at + 29508, 200-205 at + 30040.
- The song's stage (0x8003aa04): flag 0x20 -> none; record +8 when not -1 (songs 52-54: 200 = STG201,
  the lessons and 56 / 62-64: 6 = STG007); flags 0x30000 -> none. Otherwise 0x800440a8: game mode
  +196 != 0 -> the mission's stage (0x800d0ce8); else a draw 0x80047a78 with the code at +220. +220 is set
  per song (0x80043824) from the STAGE setting (0x80026688): 1 -> code 1000, 2 -> 1001, 3 -> 1002, anything
  else -> a fixed stage (0x80026680). The draw (0x80047a78): codes -1 / 1000 / 1003 take the first 6
  entries of the stage list 0x80046ef0 builds (stages 0-5), 1001 the first 9, 1002 the first 19 (the list:
  0-5, then 38-46, then 60-78), any other code is that stage; it picks at random among them, leaving out
  the stages of the last few songs (the history 0x80026604 - DDR II's rule). DDR HP4 PC draws from stages
  0-5 (setting 1 / code -1); the in-game STAGE setting's other values aren't offered yet.
- Stage records (DDR II's 24-byte layout: start preset, channel mask, brightness, effect groups, 8 light
  presets x 148, palette): 0x8026d6a0 + 24 x stage for stages 0-7, 0x8026d790 for every other stage
  (0x80104e70). Effect slots: 12 bytes a slot at 0x8028b488 (DDR II 16 at 0x802bd620), names put in by
  0x800e4b78; r13 = 0x802bcc20. Read by ddr2fx with HP4_CFG: the effect groups, spots and banks play as on
  DDR II. Stages 0, 3, 4 (STG001 / 004 / 005) run the light show (below). Extra stage files: song record +12 = 0 on
  every HP4 song (none). No silhouettes, no boss stage.

- The light show (0x801002ac builds each channel, 0x801023ec applies a preset, 0x80100a28 steps them): 8
  channels, each with a current colour fading to a target, and a 16-colour palette (0x802617c8: ff5f5f
  5fff5f 5f5fff 5fffff ff5fff ffff5f bfffff ffbfff ffffbf bf5fff 5fbfff ffbf5f ff5fbf 5fffbf bfff5f bf5f5f).
  A preset (148 bytes: +0 fade time, +4 F, +8 G, +12 eight channel weights, +44 eight channel greys, +80
  channel mask, +116 eight colours) puts the channels in its mask on its colours (colour 0 for every
  channel when the mask's top bit is set) and every other channel on a random palette colour, not the
  one it shows ((r >> 8 ^ r) & 255, then (x >> 4 ^ x) & 15, +1 when equal), fading over the preset's +0
  (at once when the stage starts); then every channel gets period = the stage record's +8 float and a 1 s
  fade: each period it takes another random palette colour (its +116 flag is 1). Record +8 is 5.0 on
  stages 0, 3, 4 and 0 elsewhere (never changes). The light-show stages start on preset 3 (mask 0: every
  channel random; greys 1, 1, 1 = channels 0-2 on), and their cue sheets switch to preset 6 (all red) or
  7 (all blue) and back to 3. A channel lights the stage materials tagged 11-90 (channel (tag - 11) / 10)
  with colour x grey; the dancers' ambient is clamp(sum of colour x weight) x F (DDR2_SPEC.md). DDR HP4
  PC plays all of it (stage.js LightShow).

## Dances
- dance/DANCE_<slot>_FRE.bin + _MOT_010.bin (+ _CHO): one whole-song dance per song, no loop / ending
  parts (file name built by 0x801080f0: "%sDANCE_%03d%s_%s.bin" with "dance/", kind FRE / CHO; lessons
  use the "L" infix). FRE's ZAR rows are 44 bytes (DDR II: 52): +0 time, +4 position, +8 motion clip,
  +12 length, +16 k1, +20 f, +24 camera, +28 length, +32 8 cue bytes [k5 formation, light, fx, k23 face,
  k8, k9, k10, ?], +40 u32; the header row has time -1 and the rows start at header + 8 (ddr2fx.cues_hp4).

## Dancers
- sound/stream/character/CHR<id+1>00.bin + CHR<id+1><outfit>.bin ("CHR%02d00.bin" / "CHR%02d%02d.bin",
  0x801077f8). The 15 playable dancers are ids 60-74 (CHR61-75; CHR74/75 have 4 outfits), 81-90 and 101
  are other characters. Read with DDR II's character reader.

## Play screen
- No METER_* files: game/GAME_CMN_US.bin is DDR II's GAME_CMN_US with one more entry in front. Its
  /0/1-/0/10 are DDR II's entries 0-9 (same sizes for most; 3, 4, 7, 9 are bigger), and /0/0 holds the
  meter sets: /0/0/0-2 = METER_MULTI's three sets, /0/0/5 = METER_FS2, /0/0/6 = METER_FM (same entry
  counts, CAE layouts the same size - the only differences are a few animation commands and a slide-in
  starting at x 720 instead of 683). /0/0/3 is another 17-entry set like FS2's, /0/0/4 a DEMONSTRATION
  plate. The pictures are HP4's own (rounded pink / glassy panels, its BATTLE / MULTI style words, no
  CHALLENGE or DOUBLE). DDR HP4 PC reads them through the same paths (server Resources.hp4_path).
- ssq/SSQ_CMN.bin: 53 pictures (DDR II 17): 0-6 the arrow frames, 7 a new 256 x 64 sheet, 8 the mask,
  9 the freeze arrows, 14 / 15 the red / blue lesson arrows (DDR II 11 / 12), and the Hyper Move markers:
  the diagonal arrows and their holds (10, 11), the hand / body / punch icons (18-33), the shaker and
  swing plates (34-45), the gauges (46-50), the Balance Board plate (51), "Rotate your hips!!" (52).

- The play screen's opening (GAME_CMN /0/0/0, CAE 0x6f800 for 1-2 players, track 0): every part starts 200
  to the right (640-wide screen) and holds for its wait - player bars / gauges 3 frames, the title and style
  plates 7 - then eases in over 9 frames (offsets 110.5 74.6 50.9 34.1 21.9 13.1 6.9 2.9 0.7 0), 30 frames
  a second from when the song screen comes up. DDR HP4 PC slides its panel and STYLE badge that way, and
  the 3-4 player meters and the FRIENDSHIP / SYNC group panel (their plates with the 7-frame wait).

## Judging, score, grade, gauge
- Judge 0x8002afd8 (DDR II 0x8002d484): the same window table (0x80254c20 = DDR II 0x8026f638, rows and
  index table 0x80254c08 identical) - 5 MARVELOUS .. 1 ALMOST, else BOO.
- Score 0x80035654 (DDR II's whole-chart formula 0x80037dd4 is gone): Hottest Party's level score. The
  chart is worth M = table 0x80254ce8 [difficulty x 5 + level - 1] x 1000 (level clamped 1-10, 0x80027ef0;
  1,000 .. 10,000). T = steps + freeze arrows (player +400 + +408). Each step hit with GOOD or better
  (0x8002b448 sets the note's flag 0x10 for judgments >= 2) and each freeze O.K. adds w x k x floor(M /
  (T(T+1)/2)), where k = steps hit so far (+31112, counts ALMOST too) + freezes O.K. (+31164), the last
  one (k = T) taking what's left so a perfect chart adds up to M; w = 10 for PERFECT / MARVELOUS / O.K.,
  5 for GREAT / GOOD. A BOO or an N.G. adds nothing and doesn't move k. Capped at 999,999,999. Shown as
  9 digits ("%09d", 0x800c4df0). (Option bit +31048 & 1: just w per step - a mode not traced.)
- Grade 0x800357ac: DDR II's dance level (weights 0x80254d4c = -2 -1 0 1 2 2 / 2, freezes 0 -2 2 / 2)
  and cut-offs 0x80254d78 (4 rows, DDR II's first 4).
- Life gauge 0x800358cc / 0x80035a5c: DDR II's code and tables (0x80254df0.. identical bytes).

## Menus
- select/: selTitle_US (5 layout blocks), select_bin_us (96), selMusic_us (10), selResult_US, select_cmn -
  the same CAE_WII layout / animation format as DDR II, but different screens. DDR HP4 PC draws them with a
  generic player (game.js CAE.draw: every part at its track's state, screen positions - a part's 'parent'
  is the part it copies, not a transform; depth = command 1).
- Title (selTitle_US): block 3 = the logo on white with big white arrows turning round it (one 141-frame
  track; frames 101-141 repeat), block 4 = the prompt: part 0 "Point at the screen" (Wii pointer), part 1
  "Let's dance!" (track 3 = its idle wobble, 41 frames). Block 0 the Nunchuk notice, 1 the NOTICE /
  Dolby / (C) screen, 2 BEMANI.
- SELECT MODE (select_bin group 0): five modes - DANCE, WORKOUT, Wii Balance Board, TRAINING, DDR SCHOOL.
  Block 0 (0x140) = 16 dummies: 6-10 the five cards (394,103) (538,103) (249,254) (394,254) (538,254),
  11-15 their reflections (alpha 64, flipped), 0 the chosen mode's big dancer (108,213) (1-5 not traced);
  tracks 0 in / 1 out (slide 100-200 left, fade). Pictures: /0/1/0/0 the five numbered gradient cards,
  /0/1/0/1-5 each mode's dancer (shown in the card), /0/1/0/6 the card names, /0/3-7/0/0-1 the big dancer +
  its white shape. Block 2 (0xa0260): "SELECT MODE" + reflection (parts 0 / 1), the mode name (2 / 3) and
  line (4 / 5); track 0 keeps the name hidden, 2 brings it in, 1 takes it out. Blocks 3-7 have no tracks.

- SELECT NUMBER OF PLAYERS / STYLE (group 1): DDR II's layout; the cards /1/1/0/0 are 1-4 players, SYNC.
  GUEST, NORMAL, FRIENDSHIP, SYNC, FAMILY (no DOUBLE: HP4 has no Double charts).
- FAMILY (style 5: the enum SINGLE, BATTLE, MULTI, SYNC, FRIEND, FAMILY, NORMAL, BOARD at 0x802b1f38 in
  the file): two party lanes, 5 and 6 (0x80044c28: lane 5 for player 0, 6 for player 1); the players join
  them by 0x80046948 - with 2 players player n is party n, with 3 / 4 players indexes 0-1 are party 0 and
  2-3 party 1. 0x8003be98 gives lane 5 flag 4 and lane 6 flag 8 (other styles: flag 1, none for SYNC);
  SetupLane (0x80031394, at 0x800314e0) turns flag 4 / 8 into chart mode 3 / 4 = the 0x24 / 0x34 chart
  (5 / 6 with hand markers). So each side dances its half of the single chart. DDR HP4 PC: player 1 the
  0x24 chart, player 2 the 0x34 chart; with 3 / 4 players players 1-2 share 0x24 and 3-4 share 0x34,
  each pair judged the FRIENDSHIP way (they are members of one party lane, as in FRIENDSHIP - the party
  pooling rule itself is DDR II PC's, from the help text). Not traced: the member flag 2 every other style
  but BATTLE sets (0x80031638: +0x57954 = 1000 at the start), which FAMILY's members don't get.
- SELECT MUSIC (selMusic_us.bin, 10 blocks): block 0 (0xa24e0, 18 parts) the top half - "SELECT MUSIC" tab
  (101, 44; /0/0/0/4 = SELECT MUSIC, FAVORITE MUSIC, SELECT COURSE, SELECT RECORD), the song name box (320,
  52; a "WWW music name" placeholder the game writes over), BPM (520, 54) and its digits (600, 53), the big
  panel behind the jackets (/0/0/0/3: cyan, green, yellow, blue; 860 x 260 around 320, 142), SORT (213, 237;
  DEFAULT / ABC / BPM / PLAY COUNT / FOOT RATE), "2 STAGE" (423, 237), the scroll bar (ends 135 / 505, thumb =
  part 11) and the green arrows (80 / 560, 236). Block 1 (0xc50a0, 98 parts) the lower half - the radar
  (160, 356; axis ends = dummies 92-97, 48 long), its five labels (rotated -25), the difficulty bars (405,
  298 / 333 / 368 / 403), the level as 10 feet per row (442 + 8n; /0/1/0/24 = black (empty), cyan, yellow,
  pink, green), grade (314, /0/1/0/22 AAA-E), crown (290, rotated -15; /0/1/0/23), each player's marker
  sel_1p-4p (570.5), and the course list (parts 0-5, 32-43). The radar labels also have FOOT and HANDS
  (the Hyper Move radar).
- The jacket row: block /0/4 (0x11c440) = 10 places 80 apart at y 151 (x 0-720), each scaled 0.52, place 4
  (320) the chosen song - the row turns round it (track 4 moves every place 80 left over 6 frames; 0 in, 1
  out). Block /0/3 (0x119ee0) is drawn in each place: the green window (/0/3/0/3, the chosen song only),
  the jacket (256 square), its frame (/0/3/0/1: yellow chosen, grey not), the favourite star (-70, -68)
  and the "Specified Song" sticker (48.6, 63.6, -19 degrees, x2); tracks 2 = not chosen (x0.8), 0 = being
  chosen (0.8 -> 1 in 4 frames), 4 = chosen, 3 = decided (grows to 1.4 and fades). DDR HP4 PC draws it.
- "2 STAGE" (Wii Remote 2 Button) opens SELECT STAGE (class CselStage, vtable 0x802877dc, code 0x8005bdec-;
  select_bin group 3: /3/0/0/7 the names, /3/1/0/0 the pictures, both RANDOM last). Its list (0x8005d7d8) is
  RANDOM, then stages 0-7 - Night Cruising, Mixers, Fortress Core, Mainframe, Edo, Vinyl Fields, Inner Grid,
  Infernal White (STG001-008). Choosing (0x8005d184): RANDOM -> 1000 (the draw among stages 0-5), else the
  stage. The song select's STAGE box (block 0 part 17) shows the chosen name. Where the window places its
  pictures is set in code (the layout block has no tracks for parts 4-13) and isn't traced; DDR HP4 PC
  lays them out in a row (key T). Songs with their own stage (record +8) keep it.
- Block /0/6 (0x132c20): a record window (High Scores / MAX COMBO, /0/6/0/3) with the dance (CLASSIC, Wii
  Balance Board, CHOREOGRAPH), the style (NORMAL, PARTY (FRIENDSHIP), PARTY (SYNC), FAMILY A / B, ...),
  grade, crown, numbers and the no-Nunchuk icon, sliding in at (156, 348) over the radar - when the game
  shows it isn't traced, so it isn't drawn. Traced so far (CselMusic, vtable 0x80287b10): the window is
  layout 6 (handle +720) and shares the lower half with the radar - 0x80076c60 plays the same track on
  layout 1 and on it unless +4148 = 2; +4148 0 / 1 picks radar or record parts, and while it is 1 the
  difficulty keys are skipped (0x8006ccc4). +4148 flips 0 <-> 1 at 0x8006d49c each time layout 1's
  animation ends (0x800ffc9c) unless +4152 = 1 - whether that repeats on its own or waits on a button
  is open (to check on the Wii / Dolphin). Mode 6 (+4092; set when the mode data's +1820 = 0) cycles the
  window's style (+4740, 0-6) and dance (+4744, 0-2) on buttons 512 / 256.
  Traced further (Ghidra C, 2026-11-17): 0x80076c60(obj, view, animate) has three views of block 1 -
  view 0 = radar + difficulty bars, view 1 = the COURSE's six songs (icon_num01-06 + music_name01 on
  mu_course_panel, parts 0-5 / 32-43), view 2 = the record window (layout 6 played too). The song list
  is built by 0x800724c4: the songs, then tiles 0x83 (only when 0x800f00d0 says so), 0x84, 0x5b, 0x57
  (COURSE MUSIC), 0x56, 0x98. Picking 0x57 (0x8006c6cc: +4092 = 4) calls 0x800728f8, which lists the
  courses (ids 0x6f + n for each of 10 opened courses, then 0x8b-0x90; in modes 7-9 0x79 + n and
  0x91-0x96), then 0x84, 0x5b, 0x5d, 0x58 (back to the songs), 0x56 - and sets the mode data +0x718 = 4.
  MINUS (0x1000) while +4092 = 4 flips +4148 0 <-> 1: radar <-> the course's song list. SELECT RECORD
  (the mode data +0x71c != 0, +4092 = 6, set up by 0x80073628) starts on view 2 and its MINUS flips 2 <->
  1; there button 1 (0x200) cycles the style +4740 and +0x128c swaps the list between songs (0x57) and
  courses (0x58). So the record window belongs to SELECT RECORD only; normal song select never shows it.
  DDR HP4 PC: courses are played from COURSE on the mode menu (not a COURSE MUSIC tile in the row), and
  there is no SELECT RECORD screen yet, so neither view is drawn.

- RESULTS (selResult_US.bin): HP4 uses DDR II's 3-4 player layout for every count of players, on the 640
  screen around 320. /0/0 (CAE 0x8c6e0) = 1-2 players: RESULTS tab (320, 11 / 29), the jacket (320, 128,
  0.5x) in front of its pink frame (320, 139; depth 8 vs 9), the style word (320, 205; /0/0/0/4 NORMAL,
  BATTLE, MULTI, SYNC, FRIENDSHIP, FAMILY), the players' cards at (126, 122) (514, 122), and the table
  (320, 327; /0/0/0/1 - 0 with MARVELOUS, 1 without, 2-5 narrower / 1-column versions, 6-9 CALORIES
  BURNED (CUMULATIVE / TOTAL / HAND / FOOT), 10 / 11 the Hyper Move list: Awesome!! Pretty Cool!! Too
  Fast!! Too Slow!! Try Harder!!). Rows MARVELOUS PERFECT GREAT GOOD MISS O.K. NOT QUITE MAX COMBO SCORE;
  player 1's numbers at x 202 (rows 237 + 19n, score 239 / 390), player 2's at 478 / 515. /0/1 (0xd7f80)
  = 3-4 players (cards at the four corners). /0/2 = a card: PLAYER n, the dancer's name (Rena, U.G.,
  Harmony, Root, Chordia, NAOKI, jun, U1, Danca, Domi, Gaku, Pia, Forte, Gliss, Sharp, Bossa, Hip, Nova,
  Hop, Dyna, Bridget, Ceja, Mii), difficulty, counts / calories windows, six card colours. /0/3 the grade
  letters (+ WIN, DRAW, LOSE, MISS), /0/4 FULL COMBO / NEW RECORD.

- DDR SCHOOL / SELECT LESSON (select_bin group 11): the 15 lessons of DDR II (ssq/Lss4 LESSON01-15, the
  same chart layout and teacher's words in text_eng.bin), song records 81-95 (music: lesson n = record 80 + n;
  the step lessons share wave group 68, CHOREOGRAPH 1-5 69-73, the board lessons 74 / 74 / 74 / 75 - DDR II's
  201-215 pattern). CHOREOGRAPH lessons 7-11: one 0x11a chart with only the hands (lanes 4 / 5, the songs'
  gimmick flags), stage 6 (STG007), dances
  DANCE_<n>L (0x801081d8: lessons 1-5 -> 001L, 6-11 -> 006L-011L, 12-14 -> 012L, 15 -> 015L). Block 75
  the title, block 74 the screen: lesson name (338, 98; /11/0/0/0 = 15 names), grade (462.8, 98), the
  teacher (/11/0/0/1 jun's 5 poses at (62, 312), /11/0/0/2 her 6th at (193, 312), /11/0/0/3 = 5 poses of
  the white-suited teacher + 4 of NAOKI at (122, 312) - 6 / 5 / 4 = the step / choreograph / Balance Board
  lessons), the speech window (399, 248; /11/0/0/4: grey, pink, green, blue) with the lesson number and
  count boxes on its top, the arrows (278 / 559, 387). Only the 6 step lessons are playable here.
- Other select_bin groups: 2 dancer / Mii select, 3 SELECT STAGE, 4 Wii Remote / body / Mii setup, 5 name and
  weight entry, 6 controller setup, 7 SELECT STYLE, 8 TRAINING menu, 9 player data / diary / BMI, 10
  OPTIONS, 12 battle / dance messages, 13 SELECT RECORD DATA, 14 SELECT DANCE (DDR arrows or choreograph),
  15 WORKOUT.

- OPTIONS (select_bin group 10): the category words /10/8 (21: ARROW ASSIST CONFIRM CREDIT CUT EVALUATION
  FREEZE ARROW GAME PLAY GIMMICK GRAPHIC GUIDELINE INDIVIDUAL OPTIONS JUMP MY BACKUP DANCERS PUNCH ACTION
  ROTATE SAVE SCROLL SPEED USER SUPPORT DANCE) and the item words /10/9 (38: ... SET DANCER, PUNCH ACTION,
  SELECT Mii CHARACTER ...) hold DDR II's words at other places plus HP4's own; DDR HP4 PC picks them by
  name. HP4's own items (GIMMICK, MY BACKUP DANCERS, PUNCH ACTION, SET DANCER) aren't decoded yet.

- SELECT CHARACTER (group 2): block 12 the screen (title, DANCER plate (160, 374) + name (160, 404), page
  arrows (254 / 575, 240)), block 14 the board (282 x 360, 12 places 85 apart), block 13 a face (/2/3/0/0:
  Rena, Chordia, Dyna, Bridget, Ceja, U1, jun, NAOKI, U.G., Root, Harmony, Mii, Bossa, Nova, Hip, Hop,
  RANDOM, RANDOM female / male, then Mii body and outfit icons) with its green frame behind. Names /2/1/0/3
  in the same order. Faces -> files: taken in order (Rena = CHR61 checked; the rest assumed, Mii skipped).
- TRAINING MENU (group 8): block 48 - title (174, 35), the song's panel (475, 97) with name and difficulty,
  rows at x 476: START BAR 210, END BAR 289, PLAY 348, OPTIONS 389; block 49 a bar row (measure number at
  (22, 14.5)), block 50 a button (PLAY / OPTIONS).
- WORKOUT MENU (group 15): title (193, 35), rows at x 320, y 84 + 45n (block 94: 530-wide bar, name at -129,
  value at +126, arrows +20 / +235; names VOICE, MENU, GOAL, PLAYER 1-4, PARTY), CONFIRM button (block 93).

## CHOREOGRAPH (Hyper Move: the hand markers)
- SELECT DANCE (select_bin group 14; text_eng 4650 "CHOREOGRAPH requires you to use your whole body to
  play, while CLASSIC uses traditional DanceDanceRevolution rules"): CLASSIC plays the 0x?14 charts,
  CHOREOGRAPH the 0x?1a charts (FAMILY: 0x?2a / 0x?3a). Pictures: /14/0 title and windows, /14/1 the small
  per-player panels (PLAYER 1-4), /14/2 the big one (ALL PLAYERS / PLAYER 1), /14/3 / /14/4 the CLASSIC /
  CHOREOGRAPH buttons (small / big) with the green window and OK, /14/5 the explanation picture ("When the
  Nunchuk is not used, its notes are auto-played"), /14/6 the dimmer. Block /14/0's dummies: (320, 208) the
  big panel, x 99 / 246 / 395 / 543 the four small ones; a panel's buttons at its dummies (0, -18) / (0, 70).
- The 0x?1a charts exist for BASIC and DIFFICULT only (50 of the 53 songs). The song record's +160 block
  is their level block (shown at the same places as the single block's - not traced).
- Lanes 4 / 5 = left hand (Nunchuk) / right hand (Wii Remote). Their flag is two little-endian halves
  (0x8002c794): the gimmick type and a parameter. The kind (0x8003406c, jump table 0x80287300): type 1 ->
  16 punch, 2 -> 18 thrust, 3 -> 17 pose (param % 100, flag 8 when >= 100), 4 -> 19 swing (same; the swing
  has an end note - held), 5 -> 21 / 13 (Balance Board hip roll), 6 / 7 -> 11 (hip bump right / left),
  8 / 9 -> 0 (the lessons' foot markers); flag 2 for lane 4, 4 for lane 5. 0x80036ac8 turns kind + param
  into the motion the controller must make (punch: param 0-7 a direction, 8 none; thrust 36 + param; swing
  45 / 54 + param ...). The lesson texts (16322-16327) name them: Thrust Arrows, Punch Markers, Swing
  Arrows, Pose Strikers.
- The lane set for hands (0x80255698 type 2, 6 panels): panel 4 over column 0, panel 5 over column 3.
- SSQ_CMN /0/0 sheets 16-52 are the markers' pictures (gloves 28 / 29, PUNCH gloves 30-33, poses 18-23,
  direction arrows 24-27, bursts 34-42, bodies 46-50, hip-roll pieces 51 / 52). Which sheet the game draws
  for which kind, and how it shows the direction and animates the note (0x800a1900 swings the punch on a
  sine), isn't traced.
- DDR HP4 PC: SELECT DANCE after the style in DANCE MODE - one player the big panel, 2-4 players each their
  own small panel (player n at slot n; each picks CLASSIC or CHOREOGRAPH; a CHOREOGRAPH player on BEGINNER /
  EXPERT dances BASIC / DIFFICULT; FAMILY: player 1's choice for all); hand markers in
  their columns, judged with the arrows' windows on keys (Controls: Px Left hand / Right hand), or
  auto-played (DANCE options: CHOREOGRAPH HANDS - the default plays the left hand for you, like the game
  without a Nunchuk). Pictures picked by what they show: PUNCH glove for punches, a pose figure for poses,
  the glove for thrusts and swings (a swing's trail held to its end). The direction isn't shown, and a key
  press counts whatever the motion. CHOREOGRAPH records are kept apart from CLASSIC's.

## Wii Balance Board MODE
- Its charts are the 0x?4a ones (BASIC / DIFFICULT; 50 songs): arrows in lanes 0-3 plus lanes 4 / 5 with
  gimmick types 1 (punch - the Wii Remote), 5 (hip roll: kind 21 / 13, held to an end note), 6 / 7 (hip
  bump right / left: kind 11). Lessons 13-15 teach them (text_eng 16333-16336: Bump Arrows, Hip Rolls,
  Hopping Arrows). DDR HP4 PC plays the mode with keys: arrows on the arrow keys, lanes 4 / 5 on the hand
  keys (or auto-played), pictures as CHOREOGRAPH's (hip roll: the Balance Board picture 51, bump: the round
  marker 45 - picked by what they show). Its records are kept apart. How the game reads the board: below. The game's lessons (text_eng 16333-16336) say what each is: Bump Arrows =
  shake your hips at the right time, Hip Rolls = one full turn of the hips, Hopping Arrows = step on / off
  the board with the arrows. Its 0x?4a charts: all four arrows, lane 4 mostly bump left (type 7) and lane
  5 bump right (6), hip rolls (5) on both, and punches (1). The game's board code is class CzanWbc
  (0x801712b0-0x801737xx: sensors in kg as doubles at +7080-7104, total 0x8017266c) and a 96-byte state
  copy 0x801335cc.
- A real board on PC (web/board.js): WebHID in Chrome / Edge after pairing in Windows - extension on
  (0xa400f0 = 0x55, 0xa400fb = 0), calibration at 0xa40024, report 0x32; the board's button = START, arrows
  stay on keys / mat.
- The game's board reading (Ghidra C, 2026-11-17): 0x80108b60 runs every frame (from 0x80028504) on the
  centre of weight x / y (CzanWbc +0x1bc8 / +0x1bcc, copied with the four sensors by 0x801335cc). Below 2 kg
  in all (0x802b7c0c) everything is 0. Eight direction bits at 0.35 (0x802b7c10 / 14: one axis past, the
  other inside; or both past = a diagonal) and a second set at 0.25 (0x802b7c18 / 1c); x past +0.45 / -0.45
  (0x802b7c20 / 24) = the bump sides (direction masks 0xa8 / 0x54). Hip roll: while the centre is more than
  0.25 out, the change of atan2(y, x) (wrapped to -pi..pi) is added to a + total and taken from a - total;
  turning one way adds 2 x frame time to that way's timer (cap 0.4, 0x802b7c34), every timer runs down by
  the frame time and at 0 its total is cleared; a total >= 2 pi (0x802b7c28) with the centre in a 0.25
  direction = the roll. Each result is a timer: set to its duration (+0x120..0x13c, all 0.1 s, copied from
  0x8026dbe8 by 0x80108974) on every frame its rule holds and run down by the frame time, so a result stays
  on 0.1 s after its rule stops holding.
  DDR HP4 PC's board.js now uses these rules (the PC-only BUMP / HOLD LINE settings are gone).

## GROOVE CIRCUIT (left in the code, not on the game's menus)
- HP4's main.dol still holds a Groove Circuit Mode ("GCM"): classes CselGCMOpening, CgmDataManager,
  CgmLocation, CgmEvent, CgmEventStageHP3Boss, GCMClear; voices VO_NAR_SELECTVENUE, VO_NAR_GCMVENUECLEAR /
  GCMVENUEFAIL, VO_NAR_BOSSSELECT, VO_NAR_TOURBATTLE; SE_DDR_BOSS. Its data is DDR II's tournament table,
  carried over: 0x8025eb90, 4 venues x 8 events of 68 bytes [kind (1 songs of your choice, 3 specified,
  10 one of the specified, 8 / 9 battles), difficulty, stage id (40-69), condition (1 grade, 2 MAX COMBO,
  5 gauge, 6 PERFECT, 7 GREAT, 10 MISS), value, songs to clear, gimmick, 10 song ids], 16 song lists of 4
  at 0x8025ea50, and the 32 request texts in text_eng.bin (3179-3219, the same as DDR II's). Game mode
  +196 != 0 reads the event's stage (0x800440a8 -> 0x800d0ce8). HP4's SELECT MODE has five cards and none
  leads there, and the venues' names aren't on the disc. Venue 1's first request names the lesson songs
  (records 63 / 64, "lesson by ..."), which song select leaves out.
- DDR HP4 PC doesn't offer it: the real game's menus never reach it.

## Working now (DDR HP4 PC)
- Song list (HP4's jackets and titles from 2Dcommon/comAF_US.bin), single charts, music, 3D stages,
  dancers and dances, HP4's play screen pictures and score, HP4's title, SELECT MODE, players / style, SELECT MUSIC, RESULTS, SELECT LESSON (6 step and 5 CHOREOGRAPH lessons playable), SELECT CHARACTER, TRAINING and WORKOUT menus; DDR II's other menus.

## DDR POINTS unlocks and the challenge task
- Unlock table 0x80260bc0: 122 rows in DDR II's 24-byte form [points, type, id, a, b, message], 15,000 to
  1,477,500 points, 22,500 apart. Type 1 = song (slot = id + 1; HP4's songs aren't in pairs: 30 songs),
  type 2 = outfit (ids 60-74 = the dancers' second outfits, b = 1; ids 80-89 = Mii BODY parts, b = which),
  type 7 = Mii characters (240,000). The message is the 1-based number of the non-empty unlock texts in
  text_eng.bin from "Challenge completed!" (2585) on; its quoted name labels the row.
- Courses and workouts (0x800fbf14, unlock types 9 / 10): COURSE 1-10 and WORKOUT 1-10 are at 0x80260370
  (DDR II's form: 20 rows of 6 song ids, -1 = none). Their unlock texts (2741-2775, messages 107-126) name
  them: the courses are "Heat Wave", "Raining Heart", ... "Thunderstorm". 6-10 of each open when the last
  of their songs is unlocked (a song still locked - bit test 0x8008dfb0 - holds it back); 1-5 hold only
  songs open from the start. The texts for 1-5 exist but never show.
- The HP3-save import (375-383, 4550): DDR HP4 PC has no HP3 save to read, so it answers like the game
  with none: 382 (loading), then 377 (no save data found).
- Play points 0x8025faf8: 4 rows (BEGINNER-EXPERT) x [0, D..AAA], the same as DDR II's first 4
  (reader 0x800e404c).
- Challenge task (reader 0x8010dd98-0x8010eba4), tables at 0x8026de00: kind[20] +0; songs +80 (20),
  +160 (26), +264 (26); difficulty[15] +368 / +428 / +488; MAX COMBO halfwords[12] +552 / +576 / +600;
  rank[9] +624 / +660 / +696; gauge 7 bytes at 0x802b7cc0 + 8 x range. Ranges: up to 449,999 / up to
  899,999 / more. The song must be the very one (0x8010e804; DDR II also took its pair). Bonuses:
  difficulty 0-3 -> 500 / 750 / 1000 / 1500; gauge 60 / 75 / 90 / 100 -> 250 / 750 / 750 / 1000 (DDR II:
  75 -> 500); combo 50 / 100 / 200 / FULL -> 500 / 750 / 1000 / 1500; rank C / B / A / AA -> 250 / 500 /
  750 / 1000.

## Not decoded yet
- The song select's record window trigger and SELECT STAGE's own placement, the hand markers' own drawing (see CHOREOGRAPH), how the
  Balance Board is read, the STAGE setting's other values, Mii characters.
- Gimmicks: HP4's GIMMICK setting (text_eng 4482; class CselOptItemGimmick) holds PUNCH MARKER (4491:
  OFF = only the regular arrows) and FREEZE ARROW (4495) - its "gimmicks" are the hand markers. Its charts
  have no other gimmick notes (every lane 0-3 note on the disc is a plain step or a freeze end), and the
  loader (0x8002cf94) reads chunk types 1, 2, 3, 9, 10 and 16 only (type 17, measure ranges in 43 files,
  isn't read). The MINIMIZER / NORMALIZER / DIAGONAL ARROW lesson texts (16329 / 16331) and the
  "ssq/GIMMICK/%s.bin" path are left over from Hottest Party 3 (the same texts are on its disc; HP4 has no
  ssq/GIMMICK folder and 15 lessons with none of them). Groove Circuit, Foot Missiles and Screen Arrows are
  Hottest Party 1 / 2: nothing of them on this disc. DDR HP4 PC has PUNCH MARKER under the player options.
- Groove Trigger: no sign of it on the Wii disc (no "groove" / "trigger" text in main.dol or text_eng.bin)
  - it seems to be in the PS2 / Xbox versions only.

## CHOREOGRAPH markers on screen (from the Dolphin footage, 2026-11-16)
- Punch and thrust plates are drawn at the textures' own scale (64 px = one lane), so the 128 x 64 plates are
  two lanes wide, each hand centred over its half of the field (lane boundary 1 / 3).
- Punch: burst plate SSQ_CMN /0/0 sheet 34 + direction (gp % 100; gp 8 = sheet 42 confirmed on screen) under
  the PUNCH glove (30 left / 32 right).
- Thrust: plate 45 + sheet 7 cell 0 (three chevrons with a ring; grey on a magenta key, no alpha), turned to
  the direction and tinted green. Sheet 7 cells 1 / 2 are the swing arrows (curved, blue outline), cell 3 a
  long arrow.
- Swing (footage 164-174 s): a green box (sheet 48's head, 128 x 64 at x 2-125, its body rows 101-443) with
  a blue swing arrow; looks about 1.4 lanes wide, not 2 - scale not settled, so not ported yet.
- Pose strikers (186-194 s): yellow box (sheet 46) with the green figure; held ones grow a yellow body.
- The CHOREOGRAPH explanation has 6 pages: 29, 33, 31, 32, 34 and 11 (Freeze Arrow), with "n/6" at the
  header's right end.
- The song-start card: blocks fly in and build a frame, the jacket lands on a gold stand on the stage, then
  READY. No model file is named for it; probably built in code - not traced.
- Pose / swing ported (game.js hp4Held): sheet 46 / 48 head (128 x 64) + body rows 101-443 for held ones;
  swing = sheet 7 cell 2 tinted blue, turned by direction (up at 0 matches 2:44); pose = figure 18 clipped
  to the circle + arm 24 (its top 36 rows) from the right shoulder, turned by direction (PROVISIONAL
  joint, matched by eye to 3:10).

## Effects (HP4 main.dol)
- Effect start = 0x80160370 (DDR II 0x8017911c): r3 manager, r4 effect, r5 bank, r6 ?. Variants 0x80160514 /
  0x80160584. GAME_STG_EFF.bin is byte-identical to DDR II's (bank 1, 63 effects).
- Bank 1 is only started from 0x8004d534 (the stage spots, effect from a table) and the wrapper 0x8008bedc
  (called with bank 2). Bank 4 effects 1-3 from 0x800e3ad0 / bd0 / dcc.
- Bank 1 effects 24-27, 29, 30 use ge.tpl 26-29 (cyan / red / green / yellow tile pieces) - a lead for the
  song-start blocks, but no constant call starts them; not settled.
- The stage-spot effects use the same 260-slot system as DDR II: 0x8010223c walks a group's slots (260 ends
  it, a negative slot n is n + 260, slots 0-23 flagged) and 0x8004d4d4 starts slot n's effect from the
  table at 0x80284b88 (12 bytes a slot, effect at +4) - that table is filled at run time (all zero in the
  dol), so which effect the song start plays needs a Dolphin log: a breakpoint at 0x80160370 logging r4
  (effect) and r5 (bank) while the song card comes in. (Home list.)
- effwatch (Dolphin, 2026-11-16): the only effect started around the song card is bank 4 effect 3 (it
  runs ~6 s from the song screen opening). Bank 4 = select/select_cmn.bin entry 2 (TEB + TPL, 7 effects),
  loaded by 0x800bec14 -> 0x8015f980(mgr, 4, data); started by 0x800e3bd0. Ported: ddr2fx adds 'bank4' for
  HP4 stages; Play starts it as the song screen opens (at the stage origin - its real placement, the
  matrix built after 0x800e3bd4 from r31+1388/1400/1412, isn't traced). The card itself and its flying
  blocks are not an effect - still to find (probably drawn by the play code from the jacket).
- Effect manager = [0x802b5918]: +0 slot count (256), +420 slot list; a running effect: +300 bank,
  +301 byte, +304 effect (effwatch.py).

## The song card (GAME_CMN_US.bin /0/4, from the user's screenshots + the layout file)
- /0/4/1 = CAE block 10 (12 parts): mu_banner01 x2 (the jacket - picture 0 is a placeholder, the game
  puts the song's jacket there), music_name01 x2 (232 x 42 name plate, its "WWWW / music name" filled in
  with the title + artist), mu_ba_alph01 / music_name_alp0 (the reflection fades), music_cr01 x6 (300 x 300
  rounded square: the flying blocks and the stand). 4 tracks: 0 / 2 come in (51 frames: white blocks fly
  in, the stand forms, the jacket drops on), 1 / 3 go out (26 frames).
- /0/5/1 = block 11 (10 x music_cr01): the stand's orange gradient pieces (one frame).
- Unported yet: the parts' 3D tilt (commands 'angle' 22 / 'cell2' 95 -> 46 over the entrance look like a
  rotation the game draws in perspective - the card stands up in 3D on screen), and the stand colour: orange
  (EXPERT, Battlefield), blue (Love Shack), white (So Fine) - set by code, not in the file.
- Server: /api/cae/gcu + resource key 'gcu' read GAME_CMN_US.bin with its own paths (HP4's 'cmn' key is
  remapped to DDR II's layout).
- Ported (game.js drawHp4Card): block 10 track 0 in from the song screen's start, held through READY,
  track 1 out from t -0.9; jacket / name plate swapped in; commands 34-36 + 'angle' drawn flat (CAE.draw
  rot3d). Stand colour: random of block 11's 10 (the same song showed green, then blue - not a song field;
  rand() is 0x80119d10, LCG 0x41c64e6d + 12345 at r13 - 31456; the card's pick = rand() % 10, found later).
  Still off vs the Wii: the stand is flatter than on screen (the game shows the layout through its 3D camera)
  and the reflections aren't faded (mu_ba_alph01 / music_name_alp0 are alpha masks there).
- Stand colour = the next palette entry each song (memwatch 2026-11-16 22:38: cards black 7, white 8, sky
  blue 9, then red-orange 0 as the u32 at 0x8050cdd8 - a song counter - went 0, 1, 2; earlier Celebration
  green 5 then blue 6). Not stored as a plain index or pointer anywhere in memory at the time; the layout's
  own scripts stay orange. The first colour's source (random at boot? a saved counter?) isn't found.
- CORRECTION: the second memwatch run (22:42) gave green (song counter 3), red / pink (4), then blue with the
  counter back at 0 (a new game) - not one step per song, so the cycle idea is wrong. The u32 at 0x8050cdd8
  is the session's stage number (0 on the first song). The PC picks at random until the code is found.
- FOUND: the stand colour is picked at 0x800cebfc: rand() % 10 (0x80119d10, LCG state * 0x41c64e6d +
  12345, returns bits 16-30); 0x8015d434(layout, block 11, that part, corner) reads its colour, 0x8015ce14 puts
  it on block 10's parts 6, 7, 8, for the 4 corners. srand (0x80119d30) at start-up (0x8012aca4) from
  OSGetTime -> calendar: sec + min + hour + msec + usec. Ported as hp4Rand() in game.js.
- Random numbers (both games): DDR II 0x80131c0c is the same generator (77 callers, srand 0x80142f24 from the
  clock the same way). The PC now uses it everywhere (decode.js wiiRand / wiiRandom, seeded from the PC's time
  at start-up) in place of the browser's Math.random.

## Layout (CAE) player - from the Ghidra C (2026-11-16)
- Command handler 0x80158e34 (61 cases), part matrix 0x80156e64: move x,y,z * turn X(17) * Y(18) * Z(16) *
  second turns 34/35/36 about the part's own axes * scale (14/15/13). 12 = depth, not a cell. Full list in cae.py.
- Track header byte 2 bit 0 = 3D: 0x80159c50 draws the part with the layout camera (0x80158240): perspective
  0x80198020 (MTXPerspective) with fov from 39.6 / 30.22 (x 0.825 widescreen, 0.75 4:3), near 0.1, far 18000,
  look-at eye (w/2, h/2, -888.9) -> (w/2, h/2, 0), up (0, -1, 0). GXSetProjection = 0x801beb50.
- Track kind low bits 1 = masked: the mask is the part whose command 1 is one lower (0x80159c50); the masks
  aren't drawn alone. The song card's reflections are masked by mu_ba_alph01 / music_name_alp0.
- Ported: CAE.draw3d in game.js (perspective warp, masks, priority order); the song card uses it. Widescreen
  placement still set from the screenshots (the 16:9 screen value at the layout manager's +600 isn't traced).
- Draw order: 0x8015b854 quicksorts the parts by priority (command 1, + the part's offset at +0x168) lowest
  first and draws in that order. CAE.draw3d: flat blocks lowest first; blocks with 3D parts highest first (no
  depth buffer here - matches the song card screenshots).
- Title (selTitle block 3, 38 parts): the logo, the copyright, 6 white_panel01 (128 x 128, the top half
  opaque, pivot at the centre, scale 5 -> 2.25 while turning - half-screens), 2 mirror_alp01, arrows01 / 02
  (kind 0x21: each masked by the part one priority below - the panels), 18 @dummy. Now drawn through
  CAE.draw3d. Still not matching the footage: the intro's white / pink half-screens (drawing the panels by
  themselves leaves them over the logo, which the footage doesn't show), the pink stripes behind the title, and
  the particle burst (the @dummy parts, probably effect spots).
- Workout calories: HP4 has DDR II's constants unchanged at 0x802b68bc (3.1, 3.5, 150, 1.05, 3600, 0.33,
  1000, 176) - DDR II's rule (0x80038374, per judged step: 1000 x 1.05 x weight x MET x (length / 150 / 3600) /
  steps x 0.5 x 0.33, MET 3.1 on BASIC else 3.5) is HP4's too; game.js workoutKcal already does this.
- Weight is kept in pounds (the US games do; both rules use it as is) - SAVE.weightLb.
- Workout calories FINISHED from the code: DDR II 0x80038374 (HP4 identical table 0x8026f848 / constants
  0x802b68bc). Mat input: every press pattern is classified (8 kinds, presses within 2 frames = one move, a foot
  let go > 0.5 s = lifted) and adds BPM x a / 20 + weight x b / 60 thousandths of a kcal (0x80029e7c, table
  (1,31) (1,26) (4,19) (3,23) (2,120) (4,116) (0,124) (6,112), hands (1,26)); BPM from the tempo table at the
  song's start (0x8003088c). The other branch (input type 2: the song's MET calories shared over its steps,
  a step = a change in the panels held) is what the PC used before; which controller is type 2 isn't traced -
  the mat classifier gives realistic totals (~13 kcal for 300 steps at 60 kg), the other ~1 kcal a song.
  Ported: StepKcal in game.js, fed from Play.input; workouts use it.
- Draw order (corrected): flat layouts give each part a depth (command 12) equal to its priority, so with the
  Wii's depth test a higher number is behind whatever the draw order - CAE.draw3d draws highest first everywhere.
- SELECT STAGE ported from select_bin /3 (game.js drawStagePick): block 23 window (stage name = sprite 7 per
  stage), block 25 ten places 80 apart (place 4 = chosen; one step = 6 frames), block 24 per place (track 0
  chosen, facing; 1 / 2 left / right turned -40 / +40 about Y, x0.8; 3 = picked: x1.4, turn 10, fade over 21
  frames, then the window closes).

## Song card 16:9 position + hit effects (Ghidra C, 2026-11-17)
- 0x800ceb38 (the card's setup) ends with 0x8015c380(layout manager, card, offset): in 16:9 (render mode
  +0x4c) the whole card moves by x = +75 layout units (0x802b744c) when its side +0x1c is 1, -75 (0x802b7448)
  when 0; 4:3 = no move. Side = 1 unless the play info's +4 is 8 and its +16 is not 0, 3 or 4. DDR HP4 PC
  draws the card with +75 through the layout camera (no measured offset any more).
- The judge-time effect starts traced (0x800ecff4 -> 0x8004dc7c, bank 3 tables at 0x80256a48 / 0x80256ae8)
  are the stage's mood changes (by gauge state), not hand-marker hits. Hand-marker hit effects: still open.

## TRAINING MODE (Ghidra C, 2026-11-17)
- TRAINING MENU = scene 0x10 (class 0x800e5b94, update 0x800e6864). Rows START BAR, END BAR, PLAY, OPTIONS
  (+0x4c8, Up / Down wrap). START BAR +0x4d0 = a measure index 0..N-1, END BAR +0x4d4 = 1..N, N = the chart's
  song-end marker >> 12 (chart +0x38c2e4); START past END pushes END to START + 1, END below START pushes
  START to END - 1; sound 0xf0 a step, 0xf5 at a limit, 0xf1 moving rows. A on PLAY -> scene 8 (play), on
  OPTIONS -> scene 0x1d (the options), B -> 5 (song select). The bars go to the scene manager +0x138 / +0x13c,
  then the training settings (+0x124 / +0x125, 0x800e55c8 / d8; 0xff = to the end).
- The menu also scrolls the chart's arrows to START BAR as a preview (0x800e77d8 -> 0x80024b9c) - not drawn
  by the PC yet.
- Chart markers (ss4 chunk type 2: n positions + n 16-bit kinds; low byte 2, high byte 1..4 -> 0x800e5abc):
  1 the top, 2 the first step's measure, 3 the steps' end, 4 the song's end.
- The play (0x80024440): steps from START x 4096 (not before marker 2) to END x 4096 (not past marker 3).
  0x8003ea98 starts the music at measure START - 2 (from the top if that's below 1), fading in over 1 s, at
  MUSIC SPEED (play +0xe4: x0.5 - x1.0 from 0x80254050). After it, the scene manager goes straight back to
  the TRAINING MENU (play type 6 -> scene 0x10). No REPEAT, no tick (METRONOME is an ASSIST option).
- DDR HP4 PC now does all of this; MUSIC SPEED is under INDIVIDUAL OPTIONS (HP4 only), used by training.

## Song list tiles, COURSE MUSIC, SELECT RECORD (Ghidra C, 2026-11-17)
- Tile ids = HP4 comAF jacket sheet cells: 0x56 DANCE STAGE, 0x57 COURSE MUSIC, 0x58 FREE MUSIC, 0x5b
  OPTIONS, 0x5c MAX COMBO CHALLENGE, 0x5d ORDER EDIT, 0x83 CHALLENGE TASK, 0x84 RECORDS, 0x98 MY DANCERS,
  courses 0x6f + n, ORDER courses 0x8b + k. HP4 has no RANDOM tile and none of DDR II's (202-267).
- A on a tile (0x8006c6cc): 0x56 -> exit 3, 0x5b -> exit 2, 0x98 -> exit 4, 0x84 -> exit 6, 0x57 -> list 4,
  0x58 -> list 0, 0x5d -> list 1, 0x83 -> the task window (+0x1278 = 1).
- RECORDS (exit 6) opens the player select with +0x8e0 = 1 (0x8010a35c: the mode data +0x714 = 0x84); once
  every player is confirmed it sets the mode data +0x71c = 1 and goes back to the song select = SELECT RECORD.
- The record window (block /0/6, 0x80077c10): records by style +0x1284 (0-6), dance +0x1288 (0-2) and the
  difficulty; part 2 = best max combo (u16, 3 digits), 1 = best score (9 digits), 3 = grade (cell table
  0x80257f3c [6,5,4,3,2,1,0] by rank), 0 = crown (table 0x80257f58 [0,3,1,0,2] by the clear byte), 5 / 6 =
  dance / style cells, 7-9 icons by flag bits 8, 2|4, 1. Tiles 0x57 / 0x58 / 0x5c show it empty.
- The view switch (0x80076c60): view 1 shows only block 1 parts 0-5 and 32-43; view 2 hides 0-11 and 32-43
  and block 0 part 0, and plays block 6.
- DDR HP4 PC: the row ends RECORDS, OPTIONS, COURSE MUSIC, DANCE STAGE, MY DANCERS; COURSE MUSIC lists the ten
  courses (+ your ORDERs) then RECORDS, OPTIONS, ORDER EDIT, FREE MUSIC, DANCE STAGE; M = MINUS (a course's
  songs), RECORDS switches the lower half to the record window (1 = style, Shift+1 = dance). RECORDS opens
  the player select first in its record mode (one player, only the record slots, no GUEST / EDIT / NEW ENTRY,
  help line 'view'); picking a record opens SELECT RECORD with that player's records, B goes back to the songs.

## Hit effects / card jacket (2026-11-17)
- The only per-lane hit effect found: 0x80089870 -> 0x8008c2f4 -> 0x8008bedc, bank 2, for each of the six
  lanes (feet and hands) judged good or better, once the combo is 50-99 (effect id = player record +0x1c)
  or 100+ (+0x1e), the variant by judgment (MARVELOUS..GOOD -> 0..3), placed at the player's position +
  table 0x80258c20 (6 x 3 floats). Nothing specific to the hand markers was found; the ids are set at run
  time (not in the dol), so a Dolphin effwatch during a long combo would name them.
- The song card's jacket (0x800cf00c): the jacket texture (0x800f034c) goes on parts 0 / 1 at the
  placeholder's own size (0x8015cc0c with the original sprite's w / h) - no frame is drawn round it by code.

## Dancers' faces (2026-11-17)
- HP4's head models (CHRnn00.bin entry 1) list the face pictures (head, eye01-07, mouth01-03, refhair) like
  DDR II's, but the eye / mouth materials keep their face slot one level down: material +0x28 = number of
  layer records, +0x2c = where; the layer's +0x15 = slot (1 eyes, 2 mouth), +0x17 = how many, +0x18 = its
  texture list. The top record only names the plain head picture, which is why the PC drew blank faces.
  hp2char.py now follows the layer (DDR II's, slot on the material itself, unchanged). CHR64 has a mouth
  only; CHR81-90 are the Mii outfits (no head). The face / blink code is DDR II's byte for byte (HP4 0x80050520 = DDR II 0x800563ac: expression value 0-9,
  20-in-10000 blink chance a frame, eyes half / shut / half), and the PC runs it for HP4's dancers too.

## CHOREOGRAPH pose marker / masks (2026-11-17)
- Not found in code: the markers aren't CAE layouts (no part names), and the SSQ_CMN pictures (resident
  file 5 -> 0x800241b4 -> chart object +0x386cd0) are drawn by the 0x800a8xxx-0x800adxxx renderer, whose
  pose drawing wasn't located. The arm joint and the explanation / results masks stay as built from footage;
  a Dolphin texture dump / frame of a pose marker would settle the arm.

## Freeze arrows (verified in code)
- Same engine as DDR II: driver 0x800372bc, result 0x80038804, input grace 0x80030a0c (16-frame counter = 15 frames / 0.25 s, N.G. on the frame it runs out).
- Step missed -> freeze dead: no N.G., no gauge change, no score.
- Held to the end -> O.K.: score event 0x80035654(5) = weight 10 (and the count k moves on); gauge as PERFECT (0x800358cc index 0).
- Released -> N.G.: no score event; gauge as MISS (index 3) with the loss multipliers; combo untouched.
- Gauge tables 0x80254e60 / streak 0x80254e30 / levels 0x80254df0 equal the PC's.

## Score count k (rechecked 2026-11-17, corrects the earlier note)
- k = steps judged (+0x57988, bumped in 0x800381c8 for every judgment, misses too: 0x80036d88's miss pass calls it with 0) + freezes finished (+0x579bc, bumped in 0x80038804 for O.K., N.G. and dead freezes alike), capped at T.
- Points only for GOOD and up (note flag 0x10 from 0x8002b448: 5 for GOOD/GREAT, 10 for PERFECT/MARVELOUS) and for O.K. (10).
- HP3 (main.dol 0x8002d680, machine code read directly) is the same function with the same totals table.

## Note flag 0x100 (no gauge loss) - traced 2026-11-17
- The judge-apply gauge code zeroes a loss when the note's +0x24 has 0x100. Note +0x24 comes only from the per-kind table (DDR II 0x8026e76c, HP4 0x80253f94, kinds 0-23, identical in both) or is copied from another note; no kind has 0x100 and nothing ORs it in later. The branch never fires: no change needed.

## Combo hit bursts (traced 2026-11-17)
- Effect bank 2 = game/GAME_CMN_<region>.bin entry 0, its entry 7 (TEB + TPL, 4 effects), loaded by 0x800882c0 ->
  0x8008c450 -> 0x8015f980(mgr, 2, ..). Ids (0x8008c128 from the player count, 0x8008c450): 1-2 players 0 / 1,
  3-4 players 2 / 3 - the first at a shown combo (+0x57ba4) of 50-99, the second at 100+ (0x8008c2f4).
- Each lane judged GOOD or better this frame starts one on that lane (a new one stops the lane's last); its colour
  set (CzanEffMng set_color 0x80160484 -> the particles' palette entry) = MARVELOUS 0, PERFECT 1, GREAT 2, GOOD 3.
- Placed on the step zone in screen units: lanes x -62, -20.7, 20.7, 62, hands -41.35 / 41.35 (0x80258c20), times
  the chart's display scale. PC: Play.hp4HitFx (orthographic, 41.35 units = one lane).
- The freeze arrow's lit look: 0x800a0984 / 0x800a0848 - while a freeze is held its brightness pops 1 -> 1.5 over
  4 frames, then settles to 1.2 over 4 more while the panel is really down; the grace frames only hold the pop at
  its peak, so in practice there's no visible change. Brightness > 1 draws additively (0x800a0b9c).

## SELECT RECORD crown / icons, CHALLENGE TASK tile (traced 2026-11-17)
- Save record per song (0x800dae8c writes it after a play): per style x difficulty - best score u32 (+0), max
  combo u16 (+0x70), clear byte (+0xa8, kept highest), rank byte (+0xc4), flags (+0xe0). The clear byte is
  the full-combo tier (0x8008b9c8: MARVELOUS 4, PERFECT 3, GREAT 2, GOOD 1, else 0); the record window's crown
  is cell [-, 3, 1, 0, 2][clear] of /0/6/0/0 (part 0, hidden at 0).
- Flags: bit 8 rank, 2 score, 4 clear, 1 combo - set when that best came from a play with the step flag
  +0x5792c, which 0x800330cc sets when the controller has no Nunchuk (0x80030e2c bit 2 test). Parts 7 / 8 / 9
  show them. The PC always has its hand keys, so they never show.
- The 0x83 CHALLENGE TASK tile is in the row (before RECORDS) while the DDR points are under 10,000,000
  (0x800f00d0 -> 0x800f9f68: the points meter 0x800f9ea0 sets +4 = 1 at 10,000,000). The PC's task window
  lists the task's song and four conditions (its look isn't traced). Not done: the player select before
  SELECT RECORD (the PC has one profile).
- The task window itself (class 0x8010eda4 / 0x8010f984; resident file slot 8 = 2Dcommon/comAF_US.bin, its
  entry 8): /8/0 = the window (heading, panel, the song's title picture - title sheet cell = the song, 0x88 =
  ANY SONG -, its message picture 0 / 1, TOTAL DDR POINTS + the number on part 9), /8/1 = the CLEARED / TRY AGAIN
  stamp (only on the results' card). The four lines are text_eng group 15 (a ZMS table, 17 lines with a %s for
  the bonus): 0-3 difficulty, 4-7 gauge 60 / 75 / 90 / 100, 8-11 combo 50 / 100 / 200 / FULL, 12-16 rank C-AAA,
  at parts 10-13. The PC draws all of it from your disc; the lines use the PC's font, not the game's.

## Step input model (Ghidra C, 2026-11-17)
- The pads are read and steps judged once a frame (60 a second) at the frame's song time (step driver
  DDR II 0x800397c8 / HP4 0x80036d88). A panel going down sets its counter to 4 (input 0x80032eb8 / HP4
  0x80030a0c, replay +0x68); the 'fresh' mask (+0x50, step struct +0xd0) has the bit while the counter runs
  down: 4 frames. A step is judged on the first frame it is inside the window with every one of its panels
  fresh - so a jump's two feet must land within 4 frames (~67 ms) - and a press up to 3 frames before the
  window still counts when the window opens. Among the steps that could be judged, the best judgment wins,
  the earliest on a tie (plus any others at the same time). After judging, the steps left behind the window
  are judged 0 (misses).
- DDR II PC: OPTIONS > SCREEN > STEP TIMING = WII (default) does exactly this on ticks of 1/60 s of song time
  (the music clock), whatever the screen's refresh rate; each press goes into the tick it falls in. EXACT
  judges each press at its own moment (the old way, a PC extra).
- Hand marker windows (0x8002afd8 + kinds from 0x8003406c): punch / thrust (flag 2) -> table 1 of 0x80254c20,
  3 early to 22 late (MARVELOUS within 3 late, PERFECT 9, else GREAT); pose / swing / hip roll the same with flag
  0x20 = only a MARVELOUS takes the press (0x80036d88); hip bumps (flag 0x10) 0x80254cc0: 3 early to 30 late, all
  MARVELOUS, also 0x20; foot markers and the Balance Board hip roll (13) the arrows' table. DDR HP4 PC: hp4Judge.
- Footprints before a song: SSQ_CMN /9 picture 3 (HP4's /9 0 / 1 are the Wii Remote / Nunchuk plates, 2 the
  A-or-B message, 4 AUTO-PLAY); the PC used DDR II's 1 / 2 and showed the Remote plates.

## Hand marker pictures (renderer 0x800a22ec, traced 2026-11-17)
- Plate (0x8025bad0, 0xa8 a kind, the second half for the judgment-colour modes): punch sheet 34 + direction
  (capped at 8 = none), thrust 45, pose 46, a pose on both hands 47 (256 wide), swing 48; each also has body
  (u 0, v 128, h 256), body start (v 64) and tail (v 384) rectangles for held markers. 0x8025b054 is the same
  for the arrows' and freezes' styles.
- Layers per kind (0x8025d1d0..0x8025d220: count + list of 72-byte layers [flags, condition, slot, parent,
  sheet/u/v/w/h normal, sheet/u/v/w/h colour mode, pivot, offset]): flags 2 = the note's animation offset
  (+0x86/+0x87), 8 = its animation scale (+0x88/+0x8a over 16383), 4 = its angle, 0x20 = turned by the
  marker's direction x 45 degrees, 0x40 by the other hand's, 0x10000 = offset y mirrored in reverse scroll.
  Swing: sheet 7 (64,0) [(128,0) for parameter >= 100]; thrust sheet 7 (0,0); punch with a direction glove 28
  (pivot 36,32) turned, with the pointer sheet 7 (192,0) as its child (pivot 2,24); punch without one the
  PUNCH glove 30 (left) / 32 (right); pose left 18 / right 20 / both 22, arms: straight 24 (pivot 16,33 or
  17,29, offset -17 / +16) when the parameter is below 100, else the bent 26 (mirrored for some directions:
  left 0 / 6 / 7 plain, else mirrored; right below 3 mirrored) - condition bits 1 / 2 / 4, right hand << 16.
- Animation (0x800a18e8, the song's clock: ticks / ticks-per-second, +0x38c2dc / +0x10): punch f = 1 -
  sin(pi u / 1024), u = (2048 x seconds) mod 1024 - a cycle every half second; with a direction +0x87 = -16 f
  (the glove's offset, inside its turn, so it bobs along the direction) and the scale (1 - 0.2 f, 1 + 0.4 f) on
  the pointer; without one a scale of 1 + 0.2 f on the PUNCH glove. A swing being held: scale 1 - 0.2 sin(pi
  (1 - p^2)), p = held time / length. Layer matrix = parent x offset x turn x scale x animation offset.
- DDR HP4 PC draws them from these tables with these animations (Dancer.hp4Hand, HP4_HAND_LAYERS). Not yet:
  sheet 7's colours (grey art coloured at draw time: green thrust / light-blue swing kept from the footage).

## Explanation window before a song (traced)
- Scene 0x1d (0x80041ac0) builds the page list every song, via 0x800f0168 -> 0x800f4fb4. It is skipped only in game mode +200 == 6.
- Balance Board (+0xcc == 2): pages 18, 19, 17, 30.
- Otherwise:
  - FAMILY style (+0xd4 == 5) with 2 / 3 / 4 players: page 35 / 36 / 37 first.
  - With CHOREOGRAPH (a player's option +0 set → flag 2): 15, 33, 31, 32, 34. Page 29 replaces 15 only while the task object +0x10 == 1, i.e. the first-time tutorial play.
  - Then page 4 when the highest difficulty is BEGINNER without CHOREOGRAPH, or page 11 when anyone is above BEGINNER.
- Lessons (song id >= 0x50) use table 0x80260918: 5-10, 20-28.
- Left/right wraps around (0x800f4258 state 5). A closes it.
- Draw (0x800f5670): side panels 0 / 1 107 wide, the page at +107, alpha fade in. The page counter layout is anchored at (600, 40).

## Thrust / swing / pointer sheet colours (traced)
SSQ_CMN image 7 is C8 with a 256-entry RGB5A3 palette in 16-entry banks. Its file palette has magenta at entry 0 of each bank. Every frame the game rewrites the palette (0x800a9524 → 0x8009c64c → 0x8009fca4), starting from a saved copy of the file palette.

**Colour cycling (fill 0x8009fca4)**
- Entries 3..31 get the 29 colours at 0xa3.. (the green ramp), rotated by phase p1.
- Entries 0x23..0x3f get the colours at 0xc3.. (the blue ramp), rotated by p1.
- Entries 0x43..0x5f get the colours at 0xe3.. (the cyan ramp), rotated by p2.
- p1 = 28 − (((s·1024) mod 1024)·29 >> 10), where s is the song time in seconds (chart +0x38c2dc << 10 / rate +0x10). p2 uses s·2048.
- With the manager flag [0x1576] set, these entries are 0xe739 instead.

**Fix-up (0x8009c64c)**
- Entry 0 of banks 0, 2, 4, 6, 7 and 9 is cleared, which makes those pixels see-through.
- Entries 1 and 2 of banks 0, 2, 4 and 6 are restored from the saved copy.
- 0x71 / 0x72 are copied into 0x91 / 0x92.

**Hand marker colour**
- The hand marker's own colour (+0x54, set by 0x800a0b9c) is the lane colour at +0xd08 (white).
- In colour modes 1 and 2 it is instead taken from the judgment tables 0x8025ca20 / 0x8025ca38.

## Balance Board MODE judging (traced)
**Styles and lanes**
- Board mode is style 5 in the lane table 0x80255698, 0x144 bytes per style.
- Lanes 0-3 take presses only from the board's virtual button 0x40000. The mat and keys don't press them.
- Lanes 4 / 5 are the Wii Remote / Nunchuk lanes, as in CHOREOGRAPH.

**How a board note is pressed**
- For the next note, 0x80037794 → 0x80036bfc gives a board code for the press and one for the hold.
- 0x8002fc50 sets the press and held bit (0x40000) on every frame that code's condition holds. There is no edge detection, so a note is judged on the first frame it is in the window with the board showing its code.

**Board codes (tables at 0x80255200 / 30 / 60)**
| Codes | Name | Condition |
|---|---|---|
| 0-7 | Dir | word 0 & [0x31, 0x29, 0xa8, 0x8a, 0xc2, 0x46, 0x54, 0x15] |
| 8 | — | word 7 (left foot on) |
| 9 | — | word 5 (right foot on) |
| 10-17 | LStepOff | word 6 (x past +0.45, or nobody on the board) |
| 18-25 | RStepOff | word 4 (x past -0.45, or nobody on the board) |
| 0x1a | — | any of word 0 |
| 0x1b / 0x1c | — | word 2 / word 3 (a full roll one way / the other) |

**The result words (0x80108b60)**
- The side value is 0xa8 for x > 0.45, 0x54 for x < -0.45, 0xff when centred with weight on the board, and 0 with nobody on it.
- Word 5 / word 4 come from the 0xa8 directions, depending on whether the side value includes 0xa8.
- Word 7 / word 6 come from the 0x54 directions, depending on whether the side value includes 0x54.

**Note kinds (0x8003406c)**
- **Arrows** become kind 12 in board mode. Lanes L / D / U / R use Dir codes 6 / 4 / 0 / 2 (left / back / front / right) for both press and hold.
- **Gimmick 7** (kind 11, flag 2): code 10 + param, or code 8 when param >= 8. Press only.
- **Gimmick 6** (kind 11, flag 4): code 18 + param, or code 9 when param >= 8. Press only.
- **Gimmick 5** (hip roll, kind 13): press 0x1a; hold 0x1b, or 0x1c when param >= 100.
- The disc's board charts use these parameters:
  - gimmicks 6 / 7: 0, 2, 4, 6 and 8 (8 is the most common);
  - hip rolls: 8 and 108.

**Centre of weight (CzanWbc 0x801713b0)**
- A sensor at or below 0, or under 1 kg, counts as 1 kg.
- x = 2·((TR + BR) / all − 0.5)
- y = −2·((BR + BL) / all − 0.5)

## Play camera sideways shift (HP4)
- HP4's play camera is at controller +0x3ec. The shift is +0x58 = 216.0 (0x802b6938), set at play start next to 0x80020800.
- 0x80055bbc uses it only while +0x54 is non-zero: +0x50 = +0x58, else 0x802b6ba8.
- A machine-code scan of main.dol finds no store to +0x54 through a pointer loaded from +0x3ec, the same gap as DDR II. Whether 2-player / FAMILY play turns the shift off still needs a Dolphin capture.

## Hand-marker 3D models (checked: none for CHOREOGRAPH)
- 0x800a22ec can draw up to three 3D models in a marker (local_2fc, drawn by 0x80143704) from the lane's model
  lists (+0x20 + (kind + 1) x 4, counts +0x84). The lists are filled from the song's gimmick packs
  ssq/GIMMICK/<name>.bin (table 0x80253f90, 24 entries: 2 almighty, 3 double, 4 triple, 5 arrow, 6 hand, 7-9
  shoot_A-C, 10 screen; the rest have no name, so they are never loaded), loaded only for the packs the song
  asks for (0x80151xxx, song +0x30 +0x68..0x7c).
- CHOREOGRAPH's notes are kinds 0x10-0x15 -> lists 17-22: no pack, no models. Board kinds 0xb / 0xd use list 0
  (no pack) and kind 12 list 13 (none). So HP4's own markers are only the 2D layers; the models are DDR II's
  gimmick arrows. (The GIMMICK folder's c_mark / m_mark / p_mark / r_mark / punch / hips files are not named in
  main.dol - unused.)
- Colour mode (lane manager +4 = chart +0x38c2a8): 0 while playing (set at play start), 1 when the chart has
  finished (0x80024890) and in the training pause states (0x800d68d8 / 0x800d6afc: 1 or 2) - then judged
  markers take the judgment colour tables 0x8025ca20 / 38 and sheet 7's palette goes flat (0xe739).

## Dancer faces: layer passes (traced)

- A material's layers sit at +0x2c (count at +0x2a), 0x38 bytes each. The draw loop (0x80137714's caller,
  around 0x80138a00) draws the mesh once for the material, then once more for every layer whose +0x13 is 0,
  passing the layer number (1, 2, ...) as the 6th argument.
- In 0x80137714, when that layer number is non-zero and the mesh has an extra uv set (mesh record +4), the
  vertex loop sends the extra list (+0x14 of the 0x20-byte face record) as the texture coordinate instead of
  the usual one (+0x10) (0x801383d4-0x801383f4). So HP4's eyes / mouth: the head skin on uv set 1, then
  the eye / mouth picture on uv set 2.
- 0x8015e3d8 sets the blend from the material's (or layer's) byte +0x12: low 7 bits 3 = blend src alpha /
  inverse src alpha, 2 = (zero, inverse src alpha), 1 = additive (src alpha, one) with no z-write,
  0 = opaque; with a mode set, z-update is off and bit 7 picks alpha compare > 0 (else > 0xa0).
  The face layers are 0x83: ordinary alpha blending over the skin, pixels with alpha 0 dropped.
- Not yet drawn on PC: the other layers (0x81, additive), e.g. the hair shine pictures ("refhair").

## Dancer hair shine: layer type 4 (traced, one part open)

- Layers whose +0x13 is 4 (the head's "ref" pictures, blend byte 0x81 = additive, no z-write) are drawn by
  0x8014259c, only while the model object's +0x164 is 0 and +0x168 is set. +0x168 is set for every dancer at
  song start by 0x8005b348 <- 0x80101bb0: on when the play setup's +0x68 is below 3 (0x800e5954 starts it at 0).
- Each frame it writes one texture coordinate per corner: I = normalize(P - E), R = I - 2 (I.N) N
  (0x8012dc50, 2.0 at 0x802b8328), m = sqrt(Rx^2 + Ry^2 + (1 - Rz)^2), u = 0.5 + Rx / (2m),
  v = 0.5 + Ry / (2m). For type 4, E is the translation of the model's +0xc8 matrix, which is the identity
  for dancers (only POINTINGBOX nodes set the billboard mode +0x140 that changes it), so E = the origin.
  Type 2 uses E = +0x128 (the point passed to 0x80136998); type 3 uses the normal matrix.
- Checked in a Dolphin memory copy (shinewatch, 2026-11-17, a song with two dancers): each dancer's body and
  head are separate model objects (type 0x8028ef98, +4 = the model data). The body's +0x15c points at the
  dancer object + 0x1c (its stage spot, e.g. translation (0, 0, 12)); the head's points at the head bone's
  world matrix (about 12 units up, turned with the pose). +0x160 = 0 on all of them, so the last branch runs:
  P and N are moved by +0x15c into the world first. +0xc8 is NOT the identity: 0x80136998 copies its 2nd
  argument, the view matrix of that draw, into it (0x801369fc -> 0x8012d76c swaps the arguments for the copy
  at 0x80197540), so E = the view matrix's translation. +0x168 = 1 (shine on). +0x164 is set to 1 by
  0x8013706c after a pass and cleared by 0x8013f170 each update; +0x1a0 = 2, so each frame works out the
  coordinates for half the corners (+0x1a4 picks which half).
- 0x8013fbb8 sets the pass up: lighting off (channel from the vertex colour), the layer's blend
  (0x81: added by alpha, alpha > 0).
- DDR II PC: dancer.js draws the shine as a second pass with these coordinates worked out per vertex
  (every frame rather than half the corners every other frame).
- (Earlier reading, kept for the record) Which space P and N are in depends on two fields: if the model has no placement matrix (+0x15c) or +0x160
  is set, P / N are the node's own data as sent to the GPU (node-local: the GX position matrix is
  view x node world); otherwise each is first transformed by +0x15c. Dancers are drawn with a placement
  matrix (0x80053048 passes the dancer object + 0x1c). +0x160 of the model object: writer not found yet.
- Shine on/off checked in four Dolphin memory copies (markwatch, 2026-11-17: song select, a normal song, a
  2-player song, TRAINING): every dancer model's +0x168 was 1 in all three songs, so the shine is on in each.
  Not yet seen: WORKOUT, COURSE, LESSON, Balance Board. DDR II PC always shows it.

## HANDOFF (2026-11-17 18:35) - state of the DANCE VIEW work and what is open

Done and on the PC (all md5-verified): HP4 faces fixed (eyes / mouth on uv set 2 over the skin, pictures
loaded un-premultiplied - the smudge); hair shine (type-4 layers, sphere-map from the view matrix, vertex
colour); 4-player coloured columns; first-visit song-select flash; Space = SELECT opens SELECT STAGE on HP4's
song list; TRAINING MODE -> SELECT MODE screen with the TRAINING / DANCE VIEW cards (select_bin /7/1/0/9 and
/10, help text_eng 4472 / 4473, voices VO_NAR_TRTRAIN / VO_NAR_TRDANCEVIEW); the DANCE VIEW MENU (TrainSet
with TRAIN.view: START BAR / END BAR / PLAY, title /8/0/0/2, black dancer silhouettes dancing on the left).

OPEN - DANCE VIEW's PLAY (seen on the Wii, video 2026-11-17_18-15-32.mp4 and memory copies markwatch
mark_08..11 + mem2_08/10 in the user's DDR II PC\markwatch folder; 06 = song select, 07 = menu with dancers,
08/09 = playing, 10/11 = free camera):
- It is NOT a step-training play: a loading screen, then the song from START BAR with no arrows, no judging,
  no gauge; the usual opening (jacket card, READY, HERE WE GO); a BAR counter top right (1, 2, 3 ...);
  FIXED CAMERA / FREE CAMERA switch bottom left; in free camera the user swings round / zooms, with button
  hints bottom right.
- Stage: files/stage/STG202.bin (grey-white chequered floor in the dark; 507/511 samples of its model were in
  mem2_08; STG200 / STG204 are near-copies). The disc's STG2xx / STG4xx stages are not in the local copy
  /home/claude/hp4game - stage the needed ones from the user's disc folder (read-only) when building.
- Dancers at the usual spots: lead (0, 0, 12), backups (-12, 0, -9) and (12, 0, -9), each on a dance mat
  with arrow panels (mat model not yet identified; GAME_APL_MOT01-04 and GAME_APL_EFF were fully loaded).
- Still to read from the copies: the fixed camera's eye / target and the free camera state (compare mark_09
  vs mark_10/11; the PC's camera notes: DDR2_SPEC 'camera manager block', HP4 camera at +0x3ec).
- Code: training scene 0x800bf3cc; the menu 0x800e6864 / set-up 0x800e5d78 (kind 6 = DANCE VIEW: 3 items,
  PLAY = last -> next scene 0x1d and 0x800e9768 on leaving); DANCE VIEW's own routines 0x800e8074 (set-up) and
  0x800e83e8 (per frame; shine off while the silhouettes draw).
- PC code: TrainSet.hp4Input START with TRAIN.view currently starts the step-training play - replace with a
  viewing scene (song + dance from START BAR to END BAR, STG202, BAR counter, fixed / free camera).

OPEN - smaller: DANCE VIEW MENU silhouettes' exact size / place (video frame at 57.5 s: group spans x 253-600,
heads y 169, feet y 542 in 1280x720; lead centred x 395); the DANCE VIEW PLAY button picture (0x800e5d78 gives
picture 9 instead of 7 for the last slot); Explain's n/N counter (code anchor (600, 40)); held / two-hand
pose check; calibration screen; 2P camera; silver look; P2 footprint tint; shine on/off in WORKOUT / COURSE /
LESSON / BOARD (every mode seen so far has it on).

Tools: shinewatch / markwatch / facewatch .py + .bat (read-only Dolphin memory scripts) in the DDR II PC
folder; local HP4 test server: cd /home/claude/ddr2pc && python3 server.py --hp4 --no-browser
/home/claude/hp4game (port 8768); Playwright scripts in the scratchpad (dv.js walks to the DANCE VIEW MENU).
Push: cp to /mnt/user-data/outputs/ddr2pc_update/<path>, sync, device_commit_files (force) to
~/Downloads/DDR II PC/<path>, then device_stage_files + md5 compare. Never write settings.json / log.txt /
save.json / Custom Songs, or anything in the user's disc folder.

## DANCE VIEW playback - seen live in Dolphin (2026-11-17 18:44, According to You, bars 1-55)
- Keys in the user's Dolphin: keyboard = GameCube controller port 1 (arrows D-pad, Q = A, W = B, Z = START).
- DANCE VIEW MENU (clean frame, 640x480 layout units): silhouette group x 118-323, lead centred x 214, heads
  (hat top) y 112, feet y 379; backups either side about 85 units from the lead, a little higher / smaller.
- PLAY: the stage (STG202 chequered floor) with the jacket card on a white ring plate at the start, then the
  dancers on dance mats (arrow-panel mats under each dancer). No arrows, gauge or judging.
- BAR counter top right: a pink window, "BAR" over a 3-digit counter (e.g. 003, 010).
- FIXED CAMERA (bottom-left gold label) is the game's own moving camera script (wide at bar 1, close angled
  shots later), with the hint "(A) FREE CAMERA" bottom right.
- FREE CAMERA (green label): hints "(A) FIXED CAMERA  (B) RESET  (+pad) SCROLL / (1) ZOOM IN  (2) ZOOM OUT
  (+) CAMERA A". Free camera starts as a front view of the three dancers at a distance.

## DANCE VIEW playback - from sessionlog 20261117_185514 (Claude drove Dolphin; frames + full copies)
- Timeline (logger seconds): 0-55 menu (3 dancers), 56-60 loading, 61+ playback; chart clock +0x38c2e8
  rises ~2236 units/s (4096 a bar) from 61 s. Fixed camera ~61-82 s, free camera ~83-100 s (D-pad left held
  1.5 s, then up held 1 s), B reset ~100 s, fixed again after.
- Camera read from the lead's model object (+0xc8 = the view matrix of its last draw; NOTE: sometimes the
  shadow pass's - eye (0, 1.2, -1.2) looking (0, -0.71, 0.71), the constants at 0x80260650, ignore those):
    72.4 s fixed: eye (0, 14.5, 48) looking (0, -0.18, -0.98)
    88.7 s free (after left): eye (59.4, 7.0, -26.4) looking (-0.91, 0, 0.41)
    97.0 s free (after up): eye (-0.4, 71.0, -11.3) looking (0.01, -0.98, 0.17) - from above
   105.3 s fixed again: eye (14.5, 16.5, 0.2) looking (-0.29, -0.41, -0.87)
   113.4 s fixed: eye (0, 12.7, 36.1) looking (0, -0.18, -0.98)
  -> the free camera orbits the dancers at ~65-71 units; the fixed camera is a moving script.
- DANCE VIEW MENU set-up 0x800e7f28 (traced): fov 45, near 1, far 5000, eye (0, 10, 53), target (12, 7.7, 10)
  in 16:9 / (9, 7.7, 10) in 4:3; 0x800e83e8 builds the look-at + perspective from these every frame
  (aspect 1.7778 / 1.3333 from 0x802b76e8 / 0x802b76ec). Menu copy mark_07: the three silhouette dancers'
  placements translate (-2.225, 0.75, 80), (-7.725, 0.75, 50), (3.725, 0.75, 50) - not yet reconciled with the
  camera above (the copy may be mid-transition); trace 0x8005b6e8 (called with the menu matrix) next.
- sessionlog.py fix needed: its 'screen change' test fires every ~4 s (globals pointers change during play) -
  use a fixed scene field instead, and also log the dancers' model objects (+0xc8 view, +0x15c placement).

## Dolphin set-up for driving the game (user's PC)
- Dolphin: Dolphin 2609a (portable).
- GameCube port 1 = keyboard: arrows D-pad, Q = A, W = B, A = X, S = Y, D = Z, Z = START, Q / W also L / R.
  Port 2 = keyboard: R = A only (enough to join a second player).
- Focus: click the game window's title bar right before each key press (the Claude window pops up in front).
- sessionlog.py (v2): full copies on demand - write sessionlog_mark.txt (text = note) into the DDR II PC folder
  with device_commit_files; the logger takes a full copy and deletes the file. Routine copies every 60 s.
  Frame log 30/s: globals, chart clock, each dancer object (0x800) + its model object +0xc0..+0x170.

## 2-player / CHOREOGRAPH play and the camera (Dolphin sessionlog 20261117_190431, traced)
- With any CHOREOGRAPH player the song dances DANCE_<slot>_CHO.bin instead of _FRE (0x80107084: kind =
  set-up +0x38 = play controller +0xd0; 0x8003a6e8: +0xd0 = song record +4 flag 0x4000 -> 1, 0x2000 -> 0,
  else set-up +0x0c (controller +0xa4) == 2 -> 0, else +0xcc; +0xcc = 1 when +0xa4 == 0 and some player's
  style word has bit 2). Only lesson records 56 (0x4000) and 62-64 (0x2000) carry the forcing flags.
  Controller found at 0x809194c0 in both copies (its +0x3ec = the camera 0x8091b520): 1P CLASSIC Venus
  +0xcc / +0xd0 = 0 / 0; 2P (P2 CHOREOGRAPH) Dancing in the Street = 1 / 1 and the loaded WII container
  (0x6200 bytes = DANCE_011_CHO.bin) held the cameras DEF_CAM_04_xx.
- The CHO cameras are still shots (keys at 0 and 3 s, the same values): front-high, front-low, left 45 deg,
  right 45 deg, relative to the lead at (0, 0, 12): logged eyes (0, 15.45, 47.02), (-0.09, 10.69, 37.34),
  (-29.98, 10.69, 8.52), (29.85, 10.69, 8.64), one per 4 bars (cue sheet column +24). PC: game.js asks
  /api/dance/<n>?cho=1 when PCHOREO has a player; dance.dance_hp4(cho).
- With CHOREOGRAPH the dancers stand on arrow-panel dance mats (not in 1P CLASSIC) - the mat model is still
  to find (also seen in DANCE VIEW).
- Sideways shift: HP4's play camera (0x8091b520: +0x44 fov 45, +0x48 near 1, +0x4c far 5000, +0x58 = 216)
  has +0x54 = 0 in 1P and 2P, so 0x80055bbc never shifts; the 1P lead stands centred (screenshot). PC: no
  ndcShift on HP4 (DDR II keeps its measured 0.28384).
- Footprints before the song: player 1 CLASSIC shows SSQ_CMN /9 #3 in its lanes (blue); a CHOREOGRAPH
  player shows the AUTO-PLAY + Wii Remote plates instead. 2 players both CLASSIC (Dancing in the Street,
  19:39): player 2's footprints are the same blue picture, no tint - the PC already does this. No dance
  mats in that play either, so the mats come with CHOREOGRAPH, not with 2 players.
  (Port 2 keyboard now: R = A, J / K / L / ; = D-pad up / down / left / right.)
- Explanations: CHOREOGRAPH = 6 pages "Explanation of ..." n/6 (Wii Remote and Nunchuk, Punch Markers,
  Thrust Arrows, Pose Strikers, Swing Arrows; wraps), NEXT + "(+pad) SELECT", "Let's dance!" after a moment;
  CLASSIC with freeze arrows = "Explanation of Freeze Arrow 1/1". Full copies: full_0005/0006 (session above).

## Dancer accessories: the dance mat and light bars (traced 2026-11-17)
- main.dol 0x80107734 loads, for the OR of every dancer's set-up record +0x30 (records at set-up +0x230,
  0x38 each, count +0x22c), accessory/<joint>_<name>.bin from table 0x802543e8 (22 x 16 bytes: name, joint index
  into 0x80286dc0 = mii_head / AccLHand / AccRHand / AccLForeArm / AccRForeArm / trans, flags): 0 / 1 wii_con,
  2 shadow, 3-6 DDR_Mat / Mat2-4, 7 / 8 LightBar (right / left hand), 9 balance, 10-21 the costume pieces.
  Each file is a WII container: a ZMB model + its TPL; it hangs on the dancer's same-named joint (CHR skeletons
  have AccLHand / AccRHand / AccLForeArm / AccRForeArm / trans).
- 0x8003c988 sets every record's mask to 0x188 (DDR_Mat + both LightBars) when controller +0xd0 (the CHO flag)
  is set, else 0. Dolphin: 2P with a CHOREOGRAPH player 0x188, DANCE VIEW 0x188, 1P CLASSIC (DANCE / WORKOUT) 0.
- trans_DDR_Mat's materials 2-5 (the arrow panels) have blend byte 0x81 (added, no z-write); +0x2b = 0x66-0x69
  on them (probably what lights a panel on a step - not traced; the game's mat panels change colour).
- PC: /api/ddr2char/<id>/<outfit>?acc=<mask> (ddr2char.ACCESSORIES, hp2char.character(acc)); game.js asks
  acc=392 with a CHOREOGRAPH player or in DANCE VIEW; dancer.js draws 0x81 materials added. Only the lead (the
  PC draws HP4's backups as silhouettes). Light bars' glow colour not traced (the model is white bar_core).

## Shine in other modes
- WORKOUT (1P CLASSIC, sessionlog 20261117_194937): model +0x168 = 1 on every dancer, as in DANCE MODE (1P / 2P),
  so the shine is on. +0x164 flips per draw pass (1 most samples). Balance Board not played (needs a board).

- COURSE (Spiral Squall / Heat Wave, a memory copy during play - snap.bat, 2026-11-17): every dancer model
  object (0x8028ef98 with +0x15c on a dancer) has +0x168 = 1, so the shine is on in COURSE too. (Four objects
  with +0x168 = 0 are the stage's mats / props, as in the other modes.)

## Stage props on their spots (0x8004e3c8, fixed 2026-11-17 night)
- A prop part's key: its name without OBJA_N_ / OBJA_Z_ / OBJB_N_ / OBJB_Z_ (0x8004ff68), without the extension
  (0x8004fea8), then without a last _NC or _BC, then without a last _MOV (0x8004a9dc). Each COL_ node
  OBJSET_<name> goes to the first prop (OBJA_N, OBJA_Z, OBJB_N, OBJB_Z order) whose key starts <name>. The PC
  had needed a suffix, so props without one (STG002 / STG006 OBJA_N_speaker01 / 02, STG003 monitor01, STG004
  liga01, STG006 record02) were drawn once at the stage's middle instead of on their spots (STG002: 12 speakers
  at x +-100). hp2stage.py now follows the game's rule.
- The mat lights follow the stage light, not the steps (confirmed by the user on the Wii): see below.

## Mat panel colours (static trace, 2026-11-17 night)
- Each stage-draw pass (0x8004bdc0 / 0x8004c598) calls 0x80049074 per object with the stage's light colour
  (stage + 0xfc + set x 0x38), a group table (stage + 0x8c90 + set x 0x80: 8 groups of two RGBA colours, 0x10
  each), a 0x20 block (stage + 0x8e44 + set x 0x20) and stage + 0x9130 + set x 4.
- 0x80049074: the model's ambient / material colour = the light colour x the object's own colour (+0xbc /
  +0xc0); then for each of 8 groups, the materials listed at +0xc4 (10 per group) get light x group colour
  (0x80144220 / 0x80143f58). Then for tags 0x5a-0x63 the model's +0x60 table gets a value from 0x800239e4, and
  for tags 0x64-0x6d (the mat's arrow panels are 0x66-0x69) the model's +0x5c table gets the 0x20 block.
- The group colours are written by 0x80103e78 (through 0x8004d398, alpha always 0xff): a lerp of two colours
  (+0x84 / +0x88) by +0x7c, times a brightness lerp (+0x64 / +0x68 by +0x6c) - a stage light animation, not
  steps. So the panels' table alpha (0x10 / 0x08 -> 0x09 / 0x04 seen before) follows the stage light.
- Not found: what the 0x20 block at stage + 0x8e44 holds and who writes it (the likely per-step panel effect).
  A Dolphin write breakpoint on a panel's colour entry only caught the loader's memset (0x80004350 from
  0x80134f20 / 0x80136438 / 0x80052afc); the stage used by the course had no mats, and the next song failed
  before a step could be logged.

## Explanation screen details (traced 2026-11-17)
- Pages (0x800f4fb4): CHOREOGRAPH 15 (or 29 if 0x8010e14c(..+0x2a34) == 1), 33, 31, 32, 34, then Freeze Arrow
  11 when the highest chosen difficulty isn't BEGINNER - 6 pages on BASIC (seen "n/6"). The PC's list agrees.
- "n/N" always shown, "1/1" too. Hint bar (0x800f627c, comAF hints as a 64-bit mask): (+) SELECT = hint 5
  while N > 1, (A) Let's dance! = hint 34 once the scene's timer reaches 60 (1 s at 60 fps, DAT_802b78bc) and the
  song has loaded (0x8003f9fc -> 0x800f4fa8). START does nothing before then. Hints 100 x 16, packed from the
  right, right edge x 800 / 854, middle y 443 (Dolphin frame, cross-checked with the n/N counter).
- PC: Explain.ready() (1 s), counter always on HP4, hint 5 + 34 laid out as above.

## Pose markers (checked 2026-11-17)
- Dolphin frames of pose strikers (workout CHOREOGRAPH, Dancing in the Street BASIC): yellow plate, green figure in
  the middle circle, one straight arm from the shoulder (down-left, left, up-left on the left lane; down-right on
  the right). The PC's table-driven drawing (hp4Hand, layers 0x8025d1d0) gives the same pictures for d5 / d6 / d7
  (left) and d3 (right). Bent arms and two-hand poses were not in that chart. Judging stays as hp4Judge.

## Still open (2026-11-17 evening)
- Calibration screen: the Balance Board's (needs a board in Dolphin). Silver look: needs the DDR II disc.
- COURSE shine (expected on), the mat panels' lighting, the light bars' glow.

## DANCE VIEW playback (built 2026-11-17)
- Data: the song's FRE cue sheet (set-up +0x08 == 6 -> kind 3 = FRE; DANCE VIEW copy loaded DDR018_CAM101-118),
  stage 201 = STG202 (controller +0xd8 = 0xc9), dancers with mask 0x188 (mats + light bars).
- FREE CAMERA (0x80055e98 start, 0x80056800 each frame, A toggles via 0x80055e48): eye on a sphere of radius 65
  round (0, 7, 0), starting in front (0, 7, 65), fov 50. D-pad left / right turn it 2 degrees a frame about Y;
  up / down 2 degrees a frame about the side axis, up only while the eye is at most 71 high, down only while at
  least 8 high. 1 / 2: fov -2 / +2 a frame, 20..80. B (RESET) runs the start again. Checked against the
  sessionlog: free eyes (59.4, 7.0, -26.4) and (-0.4, 71.0, -11.3) are both 65.0 from (0, 7, 0).
- Screen: GAME_CMN_US /0/6/0 = the BAR window (MEASURE_wind_US slides in from x 742 to 542 over 30 frames, Num_00
  at 562 / 71 = the ones digit, comAF /0/0/0 digits, 19.4 apart, leading zeros dark), /0/6/1 = the camera label
  (pictures FIXED CAMERA, FREE CAMERA, CAMERA (A)-(D); two parts: the old label slides out left, the new one in
  over 10 frames). Hints: FIXED - 38 (A) FREE CAMERA; FREE - 39 FIXED CAMERA, 40 RESET, 41 SCROLL / 42 ZOOM IN,
  43 ZOOM OUT, 48 CAMERA A; right edge 800, rows y 443 / 460. Placement (traced 2026-11-17): the screen is drawn
  anamorphic in 16:9 - layout x 0-640 spreads over the 854-wide screen, pictures keep their size (the window's
  on-screen box in the layout manager's instance record, memory copy full_0044: 463-621 x 31-101 = MEASURE_wind
  at 542 / 66 with pivot 79 / 35; video centre 722 = 542 x 854 / 640). The camera label hangs on the counter
  layout's '@dummy' part (x 274 -> 159 over 24 frames, y 435, scale 0.8): video label centre 212 = 159 x 854 / 640.
  Digits: 0x800eebc4(handle, bar, 3 digits, leading-zero colour on): leading zeros in 0x80808080 (DAT_802576ac);
  digits drawn by the shared 9-digit number layout (memory block 0x920c1060 in the copy: nine Num_00 parts, part 0
  at 0, parts 1-8 its children at x -18, -36 ... -144, pivot 14 / 14) at the counter's Num_00: 18 apart on
  screen (child offsets aren't spread by the stretch; video: "1" -> "3" 19.4 by glyph centres).
- PC: Play.view (game.js): no steps / judging / gauge, START BAR to END BAR, the usual opening, drawView(),
  viewCam() (keys: START = A, arrows = D-pad, BACK = B reset (hold to quit), P1 hand keys = 1 / 2).
- (+) CAMERA A-D (0x80055fb4, FREE only): eye 65 from (0, 7, 0) along 0x80256f10's presets (46.8, 0, 45.2),
  (46.8, 0, -45.2), (-46.8, 0, -45.2), (-46.8, 0, 45.2), fov 50; each press the next, D -> A; the label shows
  CAMERA (A)-(D), the hint the next one. Dolphin 2026-11-17 (C = +): logged eyes exactly (+-46.8, 7.0, +-45.2).
  PC: SELECT (Space) = +. Whether B (RESET) puts the label back to FREE CAMERA isn't checked.
- Backup dancers (done 2026-11-17 night): the play set-up's dancer list (+0x22c count, 0x38-byte records at
  +0x230: +4 character, +8 outfit, +0x18..+0x24 per-part outfits, +0x30 accessory mask; 0x80107734 loads
  CHR<id+1>00 and CHR<id+1><outfit+1>) held 3 dancers in every Dolphin copy (set-up at 0x80919558): the lead and
  characters 73 / 74 (CHR74 the green-haired girl, CHR75 the red-haired boy). Outfits seen: 0 / 0 (4P), 1 / 2
  (2P), 1 / 2 and 2 / 1 (DANCE VIEW) - the MY BACKUP DANCERS choice (menu 0x8005f770 writes the records; ids
  0x47 / 0x48 there become 0x49 / 0x4a). PC: CHR74 / CHR75 first outfits at the dance's formation spots 2 / 3,
  same accessories as the lead; no silhouettes on HP4. Which ones: CSelect::setPlayerChr (0x800463dc) with kind
  0x2714 picks per backup one of the two characters at random (rand & 1) and an outfit at random among those
  nobody else wears - PC: hp4Backups(), once per song; the DANCE VIEW MENU shows the same three in black.
- The song card's effect (select_cmn bank 4 effect 3) has looping particles (flag 0x800); they now stop
  re-starting after the effect's end - in DANCE VIEW they had stayed as tall grey streaks over the stage.

## Checked 2026-11-17 (late evening)
- Bent-arm and two-hand poses (According to You, CHOREOGRAPH BASIC; held bent-arm pose on the right hand at
  5.5-11.5 s, two-hand straight-up poses at 34.8 s and 42.1 s): Dolphin frames match the PC's hp4Hand output -
  the bent arm (picture 26) folds up over the head on the figure's left; the two-hand pose is one 256-wide plate
  (47) across both lanes with both straight arms up; the held body is the orange 0x8025bad0 body rectangle.
- "Free" (unlocked 2026-11-17, CHOREOGRAPH BASIC, Dolphin frames vs the PC's hp4Hand): the 8.11 / 61.62 s pair
  (gp 1 + 7: one full-width plate, hands clasped over the head), the 11.35 / 64.86 s pair (gp 100 + 100: one
  full-width plate, both arms bent up) and the 89.18 s right-hand pose (gp 3 on lane 5: its own plate over the
  right two columns, the arm out low to the figure's left) all match.
- Dance mat panels: the mat's materials never change; each mat model object keeps its own colour table
  (model +0x2c, 0xdc bytes a material: +0x24 colour RGBA, +0x28 ambient). Two copies of a 2P CHOREOGRAPH play:
  materials 2-5 (the arrow panels, tags 0x66-0x69, blend 0x81) have colour ffffff with alpha 0x10 / 0x08 / 0x08 /
  0x10 and later 0x09 / 0x04 / 0x04 / 0x09 (left/right equal, up/down equal) - the panel glow; the ambient of every
  material follows the stage light (874a54 -> 87749d), which is the mat's colour change. 0x80144220 writes such a
  table entry (colour x the material's own colour / 255); 0x80049074 (from the stage draw 0x8004bdc0) feeds it the
  stage light and, for the materials in an object's list (+0xc4..), a second colour. Not traced: what sets the
  panel alpha each step.
- 4-player columns - TRACED from a Dolphin FIFO log (fifo_4p.dff, 3 frames of According to You, 4 players
  NORMAL, decoded GX command stream). The columns are GAME_CMN_US.bin /0/8/5 (its own CAE layout, 'cmn' /7/5 in
  the PC's numbering), drawn once per player in the 2D pass (ortho 853.3 x 480, centre origin) after the 3D scene:
  - back_board_whit: picture /0/8/5/0/0 (32 x 64 IA8: white, alpha 255 down to row ~33 then fading to 0 at row
    60), pivot 16 / 32, scale (8 x 0.55) x 7.5 = 140.8 x 480, opacity 153. Its two top corners and two bottom
    corners take the player's colours (TEV: texture x vertex colour, alpha the same; blend src-alpha / 1-src-alpha):
    P1 top 001eff bottom 6de2ff, P2 ff0000 / ff9d6d, P3 00ff12 / b2ffb2, P4 ffde00 / fffd6d.
  - back_board_line: picture /0/8/5/0/1 (16 x 16 IA4), pivot 8 / 8, scale y 30, at layout x -128 / 128 (scale x
    1) and -64 / 0 / 64 (scale x 0.5), all x 0.55 about the player's middle, opacity 255 - the lane lines.
  - The players' middles: -303.167 / -101.833 / 101.833 / 302.167 from the screen's middle. The step zone: lanes
    35.2 wide (the layout's 64 x 0.55), its row at y 134.2-169.4 (middle 151.8 of 480); fields start at x 52.9 /
    254.2 / 458.2 / 659.5.
  - 3 players (fifo_3p.dff, Free, 3 players): the same layout, x scaled 0.7 (board 179.2 wide, lanes 44.8),
    middles -280.167 / -0.167 / 279.5, colours P1 blue, P2 red, P3 green as above; step zone y 134.4-179.2
    (middle 156.8 of 480), fields start at x 57.47 / 337.47 / 617.47.
  - When (fifo_3p_go2.dff, 150 frames over the song's start): nothing of the board is drawn until HERE WE GO.
    On HERE WE GO's first frame (its picture appears, frame 65) the layout's second track starts: board opacity
    15, 31, 46, 61, 76, 92, 107, 122, 138, 153 and lines 25, 51 ... 255, one step every two 60 Hz frames (30/s),
    full from frame 83 on. (The step zone and the meters are drawn before it.)
  The colours aren't stored as bytes or floats in main.dol (they are set by code); the values above are what the
  GPU was given.

## 3D alpha test (HP4)
A FIFO log of an HP4 song shows the 3D alpha compare is only ever ALWAYS or GREATER 0 - never the DDR II cut of 160. So in HP4 every 3D texture is cut at alpha > 0 (stage.js drawGx). This is what turns the DANCE VIEW spot (A_24_signal3.tga) into a soft glow instead of a hard white circle.

## Combo performance (0x800ecc70 / 0x800ecff4)
Same rules as DDR II, except that level 2 and up need lv x 100 combo. On a break while the level is > 0 the type is 4 (the "break" clip), then the level becomes 1000.
The MOT/CAM/STG file set comes from the song record flags at 0x8027FC6C + (slot-1) x 0x128: bits 0x200000 / 0x400000 / 0x800000 / 0x1000000 -> files 01-04.
Clip index = type x 2, +1 when the dancer's flag bit0 is set. Flags: table 0x80286B68[group], groups by id 0-14, 20-31, 40-54, 60-74, 80-89.
0x800ecff4 then does the same calls as DDR II's 0x800fd1d0, at HP4's own addresses (traced 2026-11-18):
- Stage effects (0x8004dc7c): bank 3 = game/GAME_APL_EFF.bin (play file 0xb), effect A[set][clip] (0x80256a48, 10 a row) then B[set][type] (0x80256ae8, 5 a row), -1 = none, layer bytes 0x41 / 0x42. The set is the song's style (0x8003ac00 hands the same flag-derived number to 0x800eca3c and 0x8004a2e0). Rows: 0 [3,3,0,0,1,1,2,2,5,5] / B type 3 -> 4; 1 [14,14,11,11,12,12,13,19,5,5]; 2 [10,10,6,6,7,7,8,8,5,5] / B type 3 -> 9; 3 [17,17,18,18,15,15,16,16,5,5].
- While it runs the stage's own spot effects are switched off (0x8004adb0: visibility 0 while stage +0x8e10 is set).
- The performance stage (new in HP4): 0x8004a2e0 builds five models from game/GAME_APL_STGnn (play file 0xc): type k's ZMB is entry 0x80256b38[set x 5 + k] (sets 0-2: 0, 2, 4, 6, 8; set 3: 0, 2, 4, 6, 9), its TPL the next entry, and any entries up to the next model are ZAB animations. While a performance runs (+0x8e10) the stage draw (0x8004bdc0 and the others) skips the stage's models and props and draws only model 0x80256a34[type] (= type), animated from the performance's start (0x8004de24).
- The dancers (0x80040354): while the dancer manager's +0x84 is set only the performer (+0x88) is drawn, with an identity placement (at the stage's origin), the reference point (+0x41c +0x40) is the origin, the others aren't drawn and there are no shadows.
- Lights and faces: the stage controller's vtable 0x8028dcc0 +0x40 = 0x80104a44 (DDR II's 0x80115b80, same code): parameters 0x8028c4d8 [style x 60 + type x 12] = F, G, colour C (style 0: 46283c / 4b2d41 / 503246 / 503746 x 3.0 with G 0.5, break 283741 x 2.0 with G 0.6; styles 1-3: 323c46 / 37414b / 3c4650 / 414650 x 3.0, break the same) -> the dancers' ambient = clamp(C x F); light state 4 (+0x141c = 4). Face script 0x8028c8b8 [alt x 80 + style x 20 + type x 4]: (value, until-frame) entries. The end (+0x44 = 0x80104b88) restores the variant. G is light 0's grey (grey 255 x G, the directional light from the camera).
- How HP4's dancers are lit (traced 2026-11-18): the model draw (0x80137714 / 0x8013a4c4) uses the CHR_SHADER ramp only for models of kind 5 (0x801415d8: texture x ramp at (COLOR0.r, COLOR0.g) x 2 x material, COLOR0 = light 0 x N.L - GX_TG_SRTG), and kind 5 is set only by 0x80052c7c (stage side); HP4 has no kind 6 (DDR II's ambient + ramp shader). Everything else - the dancers - takes the plain material path: channel COLOR1 lit (0x801bc510(5, 1, REG, REG, light mask, CLAMP)), material colour = runtime material +0x24, ambient = +0x28 (the light show's / the performance's colour). So a dancer's colour = texture x material x clamp(ambient + grey G x N.L).
- DDR II PC: GAME STYLE now lights HP4's own dancer this way (shader mode 2): ambient = the light show's dancer colour, or clamp(C x F) during a performance; G = the light show's G (0x801002ac), or the table's G during a performance. With DDR II PC lighting the stand-in lights are scaled by performance G / the stage's G while a performance runs (e.g. 0.5 / 0.2 on the stage tested).
- Type 2 (200, 300, ... combo) also starts the screen ripple (0x800ebf70 on the play effect object, 0x800eb8e8): it waits 120 frames for style 0, 100 for style 2, 102 for styles 1 / 3 (72 for flagged dancers), then runs 30 frames (one less each 60th of a second, 0x800ec074). Each of those frames the screen is copied (0x800ec020) and drawn back (0x800ec110) through game/effmask.tpl (play file 3, a 256 x 256 I8 ring picture) on a square of 2560 x u game units round the screen's middle (427 / 320 across, half the height down), u = 1 - (left mod 30) / 30; the copy is read at the square's own place +d and -d (d = 0.04 x (1 - u^2) of the picture) and averaged (TEV: copy x vertex colour ffffffff, then half each), alpha = the mask, blended by alpha. (The copy's texture size against the widescreen layout isn't checked: drawn here as a straight copy of the screen.)
- The afterimage: every frame of a performance the screen is copied (0x800ebd84); its end (0x800ed164 -> 0x800ebcf8(20)) lays that last picture over the play view, alpha 255 x left / 20, one less each 60th of a second (0x800ebe0c / 0x800ebe8c). Both screen effects are drawn after the 3D scene, before the step zone.
- No sound is played by the performance code.

## Results dancer (0x800e2f4c, CselResult 0x800d464c)
Grade +0xa54: 0 = E ... 6 = AAA. Reaction slot: AAA 0, AA 1, A/B 2, C/D 3, E 4.
Motions are select_cmn.bin entry 1 (39 ZAB clips, loaded by 0x800bec14). Per flag set, phases 0 / 1 / 2 list the 5 slots:
- flag bit0: [12,18,24,30,36] / [13,19,25,31,37] / [14,20,26,32,38]
- flag bit1: [9,15,21,27,33] / [10,16,22,28,34] / [11,17,23,29,35]
Phase 0 loops while the screen opens, phase 1 plays once when the grade shows, then phase 2 loops.
Position (12.5, 2, 21) widescreen; bit1 sets in slot 0 use (12.5, 1.88, 23.5). Yaw -0.2. Camera eye (0,10,65), target (0,7.5,0), fov 45 / near 1 / far 5000 (0x800e7f28: 0x802b76a8 = 45).
Checked in a Dolphin memory copy of the results screen (snap_03, 2026-11-18): menu manager (0x802b5924) +0x34: slot 0 = dancer 63 outfit 1, yaw -0.2, position (+0x23108) (12.5, 1.88, 23.5); eye / target as above; camera +0x23150: fov 45, aspect 1.7778, near 1, far 5000, no camera node (+0x80 = 0); its projection has P00 1.8107, P11 3.219 - a vertical field of view of 34.52 = 2 atan(tan 22.5 x 3/4), i.e. in 16:9 the 45 keeps the 4:3 sideways view.
Drawn after the screen's layouts (in front of the cards and table); the scene's draw 0x800d9934 lays the fade-to-black /0/5 itself just before it.
The table for one player is /0/0/0/1 picture 2 (with MARVELOUS) / 3 (without) - no second player's column; the counts use 0x800eebc4 (4 digits, score 9) with the row part's colour (layout keys 37-39: MARVELOUS c7feff, PERFECT fff600, GREAT 36ff00, GOOD 21c6ec, MISS f12424, O.K. fff600, NOT QUITE ff0000, MAX COMBO f3fd00, SCORE white) and leading zeros in 0x80808080.
Sound: when the reaction (phase 1) starts, once (+0x5b4), player 1's grade's sound - AAA 0x11d SE_RES_RESULTAAA, AA 0x11e SE_RES_RESULTAA, A / B 0x11f SE_RES_RESULTAB, C / D 0x120 SE_RES_RESULTCD, E none (SE_RES_RESULTE 0x121 is never played in HP4). The announcer line is separate (0x800e2d84: the best grade - 0x18e AAA ... 0x196 / 0x197 E easy / hard, 399 FULL, 400 HIGH), as in DDR II.

## Menu background (traced 2026-11-18)
- A 3D scene, not a picture: select/select_cmn.bin /0, loaded by 0x80086020 into the menu manager (0x802b5924) +0x23794: model /0/0 (a_BG_panel, big stars, lines, clouds, rings; pictures /0/1, animation /0/2, 1800 frames), model /0/3 (a gradient wall at z -450; pictures /0/4), camera BG_Camera01 (node model /0/5) with ten moves /0/6-/0/15, and layout /0/16.
- The camera (Dolphin memory copy of the results screen, snap_03): eye (x, 0, 0), target (x, 0, -500), up (0, 1, 0), fov 45 (projection P11 3.219 = 34.52 high in 16:9), near 1, far 10000; x = 100 at page 1 (+0x230 = 1).
- Pages: 0x80086c08 (next) plays move 2p (x 100p -> 100p + 100, 90 frames) and sets page (p + 1) mod 5; 0x80086d6c (back) sets (p + 4) mod 5 and plays move 2p + 1 (back, 60 frames). Called by CselMode (forward, 0x8006727c), CselPlayer, CselStyle, CselOption, CselControler, CselData, CselWBC, CselDance, CselRecord. DDR II PC: MODE SELECT forward / back to it only so far.
- Results: layout /0/5 'black01' (black, alpha 0 -> 127 over 20 frames at 30 a second) over the background, drawn by the scene (0x800d9934) before the dancer; the cards and the table are drawn after it, undimmed (Dolphin screenshot: background pixels = scene x 0.5).
- Results effects (the grey band on an E): 0x800e3910 by player 1's grade (+0xa54): B-AAA effect 1, C / D none, E effect 3 (grey gloom lines); started by 0x800e3a6c when the grade shows; AA / AAA also effect 2 half a second later (0x800e3cec, DAT_802b752c = 0.5). Effect bank 4 (select_cmn.bin entry 2). Placement (16:9 / 4:3): effect 1 T(12, -11, 25) / (9.5, -11, 25) x S(0.55); effect 3 T(12, -10.7, 25) / (9.5, -10.7, 25) x S(0.55) x R_y(-15 degrees); effect 2 T(9.5, -10, 32) / (6.5, -10, 32) x S(0.55) x R_y(-15). Camera +0xdc4: eye (0, 0, 65), target origin, up (0, 1, 0), fov 45, near 1, far 10000. Drawn by 0x800d9934 after the dancer, sharing its depth buffer (DDR II PC: gloom behind the dancer, the rest in front - separate pictures here).
- Fixed 2026-11-18: /api/hp4bank4 read the bank at the entry's size instead of its offset, so bank 4 (and the title's particle burst) never loaded.
