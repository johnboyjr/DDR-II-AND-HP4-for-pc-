# DDR II PC

A fan-made PC recreation of **Dance Dance Revolution II** (Wii, 2011, USA) that runs in your web browser.

It is not an emulator. The game's screens, rules and timing were rebuilt by studying the original game: its
code (`main.dol`), its data files, memory dumps and side-by-side comparisons with the real game running in
Dolphin. Everything you see and hear (charts, music, pictures, 3D stages, dancers, sounds, videos) is read
**from your own game disc** while it runs. No Konami files are included in this repository.

> **You need your own copy of Dance Dance Revolution II (Wii, USA).** Without it there is nothing to play.

## Features

### The real game, rebuilt
- **All of DDR II's modes:** DANCE MODE, WORKOUT MODE, TRAINING MODE, DDR SCHOOL and COURSE MODE (the
  game's own 10 courses and 10 workout courses, plus ORDER EDIT for your own).
- **The game's own screens** from the disc, animated with the game's own animation data: title, SELECT MODE,
  player data, SELECT STYLE, the song list, SHORT / FULL, SELECT DIFFICULTY, OPTIONS and results.
- **Gameplay as in the original:** arrows, freeze arrows, judgments (MARVELOUS to Boo, O.K. / NOT QUITE),
  combo colours, the dance gauge, READY / HERE WE GO, FULL COMBO / FINISHED / FAILED / TRY AGAIN.
- **Timing and scoring traced from the game's code:** the judgment windows, 1,000,000-point scoring, the
  8 gauge levels and the grade cut-offs.
- **3D stages and dancers:** each song's stage, the game's dancers performing the song's own routine with
  its camera moves, backup dancers, the combo performance and the results dancer.
- **1 to 4 players:** NORMAL, DOUBLE, VERSUS, FRIENDSHIP and SYNC, with the game's 3- and 4-player screens.
- **MAX COMBO CHALLENGE, DDR POINTS, unlocks and challenge tasks** on the game's own schedule.
- **WORKOUT MODE:** player profiles, calorie counting by the game's own rule, goals, the WORKOUT DIARY
  with weight and BMI graphs.
- **DDR SCHOOL:** the step lessons with their explanation pages and the teacher.
- **Per-player records, options and favorites,** saved on your PC.

### PC extras (not in the original)
- **ONLINE VERSUS:** play a friend over the internet by swapping two codes; no server needed.
- **BATTLE CPU:** dance against a computer opponent at four levels.
- **TEAM:** two players share one chart and take turns.
- **GHOST:** your best play of a chart dances beside you.
- **Custom songs:** import StepMania songs (`.sm` / `.ssc`, or whole packs).
- **Your own dancer model** (`.glb` / `.gltf`).
- **EARLY / LATE markers, a song progress bar, frame-rate options.**
- **Dance mats and gamepads:** map any control; 4-mat Double VERSUS.
- **Cabinet lights** through an Ultimarc PAC Drive.
- **Wii Balance Board** support for the Hottest Party 4 side (Chrome / Edge).
- **Other discs (optional):** add DDR Hottest Party 1, 2 or 3 and their songs join the song list.
- **DDR HP4 PC (early):** a separate start-up for DDR (Hottest Party 4, Wii 2010), still in progress.

## What you need
- **Windows** (the start-up files are `.bat`; the server itself is plain Python and also runs elsewhere).
- **Python 3.9 or newer** from [python.org](https://www.python.org/) (tick "Add Python to PATH" when installing).
  No extra packages are needed.
- **A modern browser:** Chrome, Edge or Firefox.
- **Your DDR II (USA) disc image** (`.iso`, `.wbfs`, `.rvz` ...) **or an extracted game folder.**
- **DolphinTool.exe** (comes with the [Dolphin emulator](https://dolphin-emu.org/)) to read a disc image.
  Not needed if you pick an extracted folder.
- *Optional:* **ffmpeg.exe**, only to add custom songs (their videos and pictures).

## How to play
1. Download this repository (green **Code** button > **Download ZIP**) and unzip it.
2. Double-click **`Play DDR II PC.bat`**. A small window opens (keep it open while you play) and the game
   opens in your browser.
3. The first time, **SETUP** asks for your DDR II disc image or extracted folder. A disc image is copied out
   once into a "Game Files" folder; your disc is only read, never changed.
4. Press **Enter** to start.

### Default keys
| Key | Does |
| --- | --- |
| Arrow keys | Player 1 arrows and menus |
| Numpad 4 2 8 6 | Player 2 arrows |
| Enter / Esc | OK / Back |
| Tab | Options (and other "-" button commands) |
| Space | SELECT (the "+" button) |
| 2 or Numpad Enter | Player 2 joins |
| F3 | Frame counter |

The keys for each command are also shown next to the button hints at the bottom of every screen. Dance mats
and gamepads: **Options > Controls**.

## Files it makes
Your settings, saves and logs stay in the game's folder: `settings.json`, `save.json`, `log.txt` and the
`Custom Songs` folder. They're listed in `.gitignore` so they never end up on GitHub.

## Status
DDR II is close to complete. Most of what's left is polish: how some banners animate in and out, a few
details of the results screen, and some menu backgrounds. The technical notes (addresses, file formats and
what was checked against the real game) are in [`DDR2_SPEC.md`](DDR2_SPEC.md) and
[`HP4_SPEC.md`](HP4_SPEC.md). The full guide to every mode and option is in [`README.txt`](README.txt).

If something goes wrong, open an issue with your `log.txt` and a screenshot.

## Legal
This is an unofficial fan project, not made or approved by Konami. Dance Dance Revolution and DDR are
trademarks of Konami Digital Entertainment. This repository contains only original code: no game files,
music, pictures or other Konami content. Please use your own legally owned copy of the game.
