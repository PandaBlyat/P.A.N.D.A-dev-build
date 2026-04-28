#!/usr/bin/env bash
# Convert <shortcode>.png source emoji into the locations the game and editor
# expect. See ./README.md.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
GAMEDATA_DDS_DIR="$REPO_ROOT/P.A.N.D.A DEV/gamedata/textures/ui"
EDITOR_PNG_DIR="$REPO_ROOT/tools/editor/public/emoji"

mkdir -p "$GAMEDATA_DDS_DIR" "$EDITOR_PNG_DIR"

if ! command -v magick >/dev/null 2>&1 && ! command -v convert >/dev/null 2>&1; then
  echo "ERROR: ImageMagick (magick or convert) not found on PATH." >&2
  exit 1
fi
IM=$(command -v magick || command -v convert)

if command -v nvcompress >/dev/null 2>&1; then
  ENCODER="nvcompress"
elif command -v texconv >/dev/null 2>&1; then
  ENCODER="texconv"
elif command -v compressonatorcli >/dev/null 2>&1; then
  ENCODER="compressonatorcli"
else
  echo "ERROR: No DDS encoder found. Install nvcompress, texconv, or compressonatorcli." >&2
  exit 1
fi
echo "Using ImageMagick: $IM"
echo "Using DDS encoder: $ENCODER"

shopt -s nullglob
COUNT=0
for src in "$SCRIPT_DIR"/*.png; do
  base="$(basename "$src" .png)"
  shortcode="${base,,}"
  tmp_png="$SCRIPT_DIR/.build_${shortcode}.png"
  out_dds="$GAMEDATA_DDS_DIR/panda_emoji_${shortcode}.dds"
  preview_png="$EDITOR_PNG_DIR/${shortcode}.png"

  # Resize/pad to 64x64 RGBA on transparent background.
  "$IM" "$src" -resize 64x64 -background none -gravity center -extent 64x64 PNG32:"$tmp_png"

  # Copy preview PNG for the editor.
  cp "$tmp_png" "$preview_png"

  # Encode DDS (DXT5 / BC3_UNORM, alpha preserved).
  case "$ENCODER" in
    nvcompress)
      nvcompress -bc3 -alpha "$tmp_png" "$out_dds" >/dev/null
      ;;
    texconv)
      texconv -nologo -y -f BC3_UNORM -o "$GAMEDATA_DDS_DIR" "$tmp_png" >/dev/null
      mv "$GAMEDATA_DDS_DIR/.build_${shortcode}.dds" "$out_dds"
      ;;
    compressonatorcli)
      compressonatorcli -fd BC3 "$tmp_png" "$out_dds" >/dev/null
      ;;
  esac

  rm -f "$tmp_png"
  printf '  %-12s -> %s\n' "$shortcode" "panda_emoji_${shortcode}.dds"
  COUNT=$((COUNT + 1))
done

if [ "$COUNT" -eq 0 ]; then
  echo "No <shortcode>.png files found in $SCRIPT_DIR. Drop your emoji PNGs in and re-run." >&2
  exit 1
fi

echo "Built $COUNT emoji DDS textures."
