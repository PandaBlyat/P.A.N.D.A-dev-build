# P.A.N.D.A. Emoji Source Pipeline

This directory holds the **source PNGs** for the inline emoji set used by
P.A.N.D.A. conversations. It is a build-time staging area: drop PNGs in here,
run `build.sh` (or `build.ps1`), and DDS textures + editor preview PNGs are
produced and placed where the game and editor can find them.

## Why this exists

S.T.A.L.K.E.R. Anomaly's X-Ray engine renders text via bitmap fonts and has
no Unicode/UTF-8 emoji glyph support. The mod uses a *shortcode + DDS* pattern
instead: text contains `:smile:` tokens, and `pda_private_tab.script` swaps
each known token for a 64x64 DDS texture rendered as a small icon next to the
text bubble. To get **actual emoji-looking icons** (rather than the generic UI
placeholders the project shipped with), one DDS per shortcode is required.

## Authoring workflow

1. **Pick an emoji set.** Recommended: [Twemoji](https://github.com/twitter/twemoji)
   (CC-BY 4.0). OpenMoji (CC-BY-SA 4.0) and Noto Emoji (Apache 2.0) also work.
   Use the 72x72 PNGs; they will be downscaled to 64x64.

2. **Name the files.** For each shortcode in the catalog, drop a PNG named
   `<shortcode>.png` into this directory. The catalog (single source of
   truth) is the `PANDA_EMOJI_CATALOG` array in
   `tools/editor/src/components/PropertiesPanel.ts`. The Lua side
   (`PANDA_INLINE_EMOJI_TEXTURES` in
   `P.A.N.D.A DEV/gamedata/scripts/pda_private_tab.script`) and the
   `textures_descr/ui_panda_emoji.xml` registration must list the same set.

3. **Run the build script:**
   - Linux/macOS: `./build.sh`
   - Windows: `./build.ps1`

   Each script:
   - Resizes/pads each `<shortcode>.png` to a 64x64 RGBA canvas.
   - Encodes it as a DXT5 (BC3_UNORM) DDS.
   - Writes the DDS to `P.A.N.D.A DEV/gamedata/textures/ui/panda_emoji_<shortcode>.dds`.
   - Copies the 64x64 PNG to `tools/editor/public/emoji/<shortcode>.png` so the
     in-browser editor preview renders the same image.

4. **Commit** the resulting DDS files and PNG copies. The source PNGs in this
   directory are also kept under version control so that anyone can rebuild
   the set without re-downloading the upstream emoji repo.

## Required shortcodes

Mirror of `PANDA_EMOJI_CATALOG` (39 entries):

```
smile, laugh, wink, ok, sad, cry, angry, fear, love,
thumbsup, thumbsdown, clap, wave, warning, exclaim, question,
radio, pda, map, target, stash, key, money, artifact, anomaly,
zone, rad, fire, skull, mutant, gun, knife, ammo, helmet, armor,
medkit, food, drink, doc
```

## Tool requirements

- **ImageMagick** (`magick` / `convert`) — for PNG resizing.
- One of the following DDS encoders:
  - `nvcompress` (NVIDIA Texture Tools) — recommended on Linux/macOS.
  - `texconv` (DirectXTex) — recommended on Windows.
  - `compressonator` — cross-platform GUI/CLI option.

The build scripts auto-detect which encoder is on `$PATH` and call it with
`bc3` / `BC3_UNORM` parameters (DXT5 with alpha).

## Adding a new shortcode

1. Add the entry to `PANDA_EMOJI_CATALOG` in `PropertiesPanel.ts`.
2. Add the same shortcode to `PANDA_INLINE_EMOJI_TEXTURES` in
   `pda_private_tab.script`.
3. Add a `<file>...<texture></file>` line in
   `configs/ui/textures_descr/ui_panda_emoji.xml`.
4. Drop `<shortcode>.png` here.
5. Run `build.sh` / `build.ps1`.

The runtime falls back to `panda_emoji_question` for unknown shortcodes, so
forgetting any one of these steps still produces a sensible render rather
than a crash.
