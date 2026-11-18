DDR II PC
=========

A PC recreation of Dance Dance Revolution II (Wii, USA) that runs in your web browser. Everything it
shows and plays (charts, music, pictures, 3D stages, dancers, sounds) is read from YOUR game disc or
extracted game folder while it runs. Your disc and game files are only read, never changed or copied
into this folder. Your own settings and saves stay in settings.json and save.json.

Things marked "PC extra" are additions that the real DDR II doesn't have. Everything else is meant to
match the real game, worked out from its code (main.dol), its files, memory dumps and recordings.


START
  Double-click "Play DDR II PC.bat". A small window opens (keep it open while you play) and your
  browser opens the game. Press Enter or click to start.
  First start: SETUP asks for your DDR II disc image (.iso, .nkit.iso, .wbfs, .rvz) or an extracted
  game folder. A disc image is copied out once into "Game Files" with DolphinTool.exe (found in your
  Dolphin folder). Options > GAME FOLDER opens SETUP again.
  If something goes wrong, send log.txt from this folder and a screenshot.

KEYS (default)
  Arrow keys .......... player 1 arrows (and menus)
  Numpad 4 2 8 6 ...... player 2 arrows (Double uses P1 + P2)
  Enter / Esc / Tab ... OK / Back / Options
  2 or Numpad Enter ... player 2 joins (song select)
  F3 .................. frame counter on / off
  Dance mats and gamepads: Options > Controls, pick an action, press the panel. Arrow keys, Enter and
  Esc always work in menus. For 4 mats (Double VERSUS) the game asks each player to step on their
  mats once so it knows which is which (Options > Check dance mats).


THE GAME (like DDR II)
  Menus: (each screen slides in and out with the game's own animation data, and the chosen card grows
  into place and bounces when confirmed) TITLE > SELECT MODE > number of players > SELECT RECORD DATA (your player) > SELECT STYLE >
  song list > song length (SHORT / FULL) > SELECT DIFFICULTY (Enter confirms everyone; P2 Start
  confirms player 2 alone, whose badge then moves onto their button with OK). The announcer says each screen's name,
  and on SELECT MODE / SELECT STYLE the card you rest on (read from the game's code).

  SELECT MODE
    DANCE MODE      normal play, with the MAX COMBO CHALLENGE (below).
    WORKOUT MODE    your weight and a target (play time or calories), a calorie counter while you
                    dance, WORKOUT RESULTS and a WORKOUT LOG. Calories follow the game's own rule
                    (main.dol 0x80038374): every move you make on the mat counts - steps, jumps,
                    even ones between arrows - sorted into 8 kinds, each worth a set amount by your
                    weight and the song's BPM (the same in HP4). Hand moves count too.
    TRAINING MODE   speed 50-150%, from / to measure, repeat, assist tick. Keeps no records.
    DDR SCHOOL      the lessons, on their own stage and dance with the game's red / blue arrows,
                    each step lesson starting with its explanation page.
    RELAXED MODE    the Dance Gauge never runs out. Keeps no records.
    COURSE MODE     DDR II's own 10 courses and 10 workout courses (read from main.dol), plus ORDER
                    EDIT for up to six of your own. One Dance Gauge for the whole course.
  (DDR II's disc also carries the data of a TOURNAMENT MODE the released game never uses: 4 stages
  of 8 requests at main.dol 0x80279560. It isn't part of the real game, so it isn't shown. Its code is
  kept in web/game.js (GC_DDR2).)

  SELECT STYLE
    NORMAL, DOUBLE, and with 2-4 players VERSUS, FRIENDSHIP (everyone gets the best judgment of the
    group on each arrow) and SYNC (everyone gets the worst; a miss fails everyone), as the game's own
    help text describes them. 3 and 4 players use the game's 3 / 4 player screens.
    In DANCE MODE the style screen also has two PC extras: BATTLE CPU (1 player, in SYNC's place) and
    TEAM (2 players) - see PC EXTRAS.

  SONG LIST
    It starts like the real game's: OPTIONS, COURSE MUSIC, MY CHARACTER, FAVORITE MUSIC, RANDOM, then
    the songs (Q stars a favorite). DOUBLE hides songs without Double charts. Replicant D-action, the
    boss folder, sits at the end (R jumps there). (Earlier versions drew "medals" for AA on its songs:
    the disc has no such pictures or text, so they are gone.)
    A SPECIFIED SONG card from DDR POINTS takes you to that song. With Song unlocks ON (Options), songs
    appear on the game's own DDR POINTS schedule.

  PLAYING
    DDR II's own screen: arrows and freeze arrows, step zone, top panel with the gauge and score,
    judgments, combo, READY / HERE WE GO / FULL COMBO / FINISH / FAILED, all from the disc. 3D: the
    song's stage (stage 16 and its kind draw their light-panel walls round the camera, as the real
    game shows them), DDR II's own dancers dancing the song's routine with the song's cameras, the
    backup silhouettes and the combo performance (from 50 combo on BASIC and up); the dancers blink and
    change expression with the dance, as the game's code does.
    Timing and scoring from the game's code: Marvelous 13 ms, Perfect 40/47 ms, Great 107/100 ms,
    Good 167/200 ms (early / late); 1,000,000 points; the game's 8 gauge levels and grade cut-offs.

  MAX COMBO CHALLENGE (DANCE MODE)
    From the game's code (main.dol 0x800eb078): one streak at a time - player 1's in NORMAL (also with 2
    players) and DOUBLE, both players' together in FRIENDSHIP and SYNC. A full combo starts it ("Start!!",
    the song's max combo); each next full combo adds its max combo ("KEEP GOING!!"); the first song without
    one ends it ("End!!", adding the combo before the first break). Changing style drops a running streak.
    NEW RECORD shows (and the best is saved) whenever the total beats that style's best. The last tile of
    the song list, MAX COMBO CHALLENGE, shows your best: Up / Down there picks the style (the Wii's 1 button).

  RESULTS AND DDR POINTS
    The game's results screens for 1-4 players, records per chart (save.json), DDR points from the
    game's own table, the "Any song" challenges and DDR POINTS COMPLETE.

  PLAYERS
    Each player (record data) has their own name, records, points, options, favorites and ghosts.
    Controls, audio offset and screen settings are shared.


OPTIONS
  Laid out like DDR II's: a grid of pages (INDIVIDUAL OPTIONS, GAME PLAY, DANCE, GRAPHIC, SOUND ...),
  each with a row per player where it matters.
  Player options: SPEED, APPEARANCE, ROTATE, ARROW colors, FREEZE ARROW, JUMP, CUT, GUIDELINE,
  EVALUATION, MARVELOUS, N.G. COMBO, GAME OVER.
  Others: style, GAME LEVEL (the game's 8 levels), announcer, song unlocks, song videos and size,
  screen shape, full screen, DDR II DANCER, DANCER LIGHTING (DDR II PC or GAME STYLE), audio offset.
  SCREEN: FRAME RATE (monitor / 60 / 120 - timing doesn't change), FPS COUNTER, SONG PROGRESS,
  3D BUFFER (FAST by default; ORIGINAL keeps a spare copy of each 3D frame - restart after changing).
  PC SETTINGS: JUDGMENT, EARLY / LATE, GHOST, TEAM TURN, and the PC-only settings below.


PC EXTRAS (not in the real DDR II)
  BATTLE CPU      DANCE MODE, 1 player, SELECT STYLE. Pick LEVEL 1-4 and dance against a computer on
                  the 2-player screen (no second dancer). The opponent plays the way Hottest Party 2's
                  battle opponents do (decoded from the games' shared code): its judgments are shared out
                  by weights for each judgment and scored by your own rules - no fake score. Its four
                  levels are Hottest Party 2's four opponent strengths. WIN / LOSE record per level.
  TEAM            DANCE MODE, 2 players, SELECT STYLE. One chart, one life bar, one score, one combo,
                  on the 2-player screen: the song switches between you, each player's turns on their own
                  side. 3 seconds before a switch, GET READY flashes on the next player's side with a
                  3-2-1 count and their first arrows waiting at the bottom. Turns: PC SETTINGS > TEAM TURN
                  (AUTO = about 8 turns a song, or 16 / 32 / 64 steps), each switch moved to the nearest
                  pause, never during a freeze. Results add who got what. Keeps no solo records.
  ONLINE VERSUS   SELECT MODE > ONLINE VERSUS. Play a friend over the internet, no server needed: the host
                  sends a code, the friend sends a reply code back, and the two games connect directly.
                  The host picks the song, the friend picks their own difficulty, both start together.
                  Each game judges its own steps, so lag never touches your timing. Both players need
                  DDR II PC and their own disc. Some strict networks can't connect directly; a free
                  virtual-LAN app (Tailscale, ZeroTier) fixes that.
  GHOST           PC SETTINGS > GHOST. Your best play of a chart dances beside you on the player 2
                  side, step for step (DANCE MODE, 1 player). Plays are recorded automatically.
  EARLY / LATE    PC SETTINGS > EARLY / LATE. Small EARLY (blue) / LATE (pink) under every judgment
                  below MARVELOUS.
  SONG PROGRESS   SCREEN > SONG PROGRESS. A rainbow bar up the left edge that fills as the song goes.
  CUSTOM SONGS    Options > Custom songs: import StepMania songs (.sm / .ssc, or a whole pack) into
                  folders of your own. They're copied into "Custom Songs"; your originals stay put.
                  Older video formats need ffmpeg (Setup can point to it).
  DANCER MODEL    Options > DANCE > dancer model: your own .glb / .gltf humanoid dances instead.
  CABINET LIGHTS  Ultimarc PAC Drive: panel lights while stepped on (Options > LIGHTS; needs
                  PacDrive64.dll next to DDR II PC).
  DEMO player     a player named DEMO plays every song by itself (keeps no records).


DDR HP4 PC (Hottest Party 4 / DDR, Wii 2010) - just started
  Double-click "Play DDR HP4 PC.bat" (DDR II PC's window can stay open: it uses another port). It finds
  "Dance Dance Revolution (USA)" in Downloads and keeps its own settings_hp4.json, save_hp4.json and
  log_hp4.txt. So far: its 53 songs with their jackets, music and single charts; its own 3D stages,
  dancers (the 15 playable ones, at random) and each song's own dance with its camera moves; FAMILY
  style for 2-4 players (each side dances its half of the chart, the game's own split charts); SELECT
  DANCE: CLASSIC or CHOREOGRAPH (the hand markers - keys Z / X for left / right hand, or auto-played: DANCE
  options > CHOREOGRAPH HANDS); DDR POINTS unlocks (Options > SONG UNLOCKS: EARN THEM) on HP4's own
  schedule - 30 songs, the dancers' second outfits, courses and workouts 6-10 - HP4's own challenge
  tasks, and its own 10 courses ("Heat Wave" ...) and 10 workouts. A real Wii Balance Board for its
  Wii Balance Board MODE: pair it in Windows Bluetooth (red SYNC button under the battery cover), open the
  game in Chrome or Edge, then Options > PC SETTINGS > BALANCE BOARD > CONNECT. Still DDR
  II's screens: HP4's own menus, play screen, stage lights / effects and hand / gimmick charts are still
  to be decoded (notes in HP4_SPEC.md).


OTHER DISCS (optional)
  If the Hottest Party 1, 2 or 3 discs are found (Setup, or a folder in Downloads), their songs appear
  as folders in the song list and play with DDR II's look. Code for those games' own screens, stages,
  dancers and story modes is kept in DDR II PC, but DDR II is the game this recreates.


STILL BEING WORKED ON (DDR II)
  - Double play: whether the picture stays shifted like 1 player (2 players is centred, as in the footage).
  - The boss song's silver-white dancer look (the game adds a reflection texture to the dancers there).

The technical notes (addresses, file formats, what was checked against what) are in DDR2_SPEC.md.


Closing the game
- Close the game's browser tab/window and the server shuts itself down a few seconds later (a reload doesn't
  count). If the browser crashes, it shuts down after 3 minutes without hearing from the page.
- Start it with --keep-running to turn this off.
- Starting it while it's already running just opens the running copy (only one copy can use the port).
