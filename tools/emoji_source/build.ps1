# Convert <shortcode>.png source emoji into the locations the game and editor
# expect. See ./README.md.
$ErrorActionPreference = 'Stop'

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot    = (Resolve-Path (Join-Path $ScriptDir '..' '..')).Path
$GamedataDir = Join-Path $RepoRoot 'P.A.N.D.A DEV/gamedata/textures/ui'
$EditorDir   = Join-Path $RepoRoot 'tools/editor/public/emoji'

New-Item -ItemType Directory -Force -Path $GamedataDir, $EditorDir | Out-Null

$im = (Get-Command magick -ErrorAction SilentlyContinue) ?? (Get-Command convert -ErrorAction SilentlyContinue)
if (-not $im) { throw "ImageMagick (magick or convert) not found on PATH." }

$encoder = $null
foreach ($name in @('texconv','nvcompress','compressonatorcli')) {
    if (Get-Command $name -ErrorAction SilentlyContinue) { $encoder = $name; break }
}
if (-not $encoder) { throw "No DDS encoder found. Install texconv, nvcompress, or compressonatorcli." }

Write-Host "Using ImageMagick: $($im.Source)"
Write-Host "Using DDS encoder: $encoder"

$pngs = Get-ChildItem -Path $ScriptDir -Filter '*.png' -File
if ($pngs.Count -eq 0) {
    throw "No <shortcode>.png files found in $ScriptDir. Drop your emoji PNGs in and re-run."
}

foreach ($src in $pngs) {
    $shortcode  = $src.BaseName.ToLower()
    $tmp        = Join-Path $ScriptDir (".build_$shortcode.png")
    $outDds     = Join-Path $GamedataDir ("panda_emoji_$shortcode.dds")
    $previewPng = Join-Path $EditorDir   ("$shortcode.png")

    & $im.Source $src.FullName -resize 64x64 -background none -gravity center -extent 64x64 "PNG32:$tmp" | Out-Null
    Copy-Item -Force $tmp $previewPng

    switch ($encoder) {
        'texconv'           { & texconv -nologo -y -f BC3_UNORM -o $GamedataDir $tmp | Out-Null
                              Move-Item -Force (Join-Path $GamedataDir ".build_$shortcode.dds") $outDds }
        'nvcompress'        { & nvcompress -bc3 -alpha $tmp $outDds | Out-Null }
        'compressonatorcli' { & compressonatorcli -fd BC3 $tmp $outDds | Out-Null }
    }
    Remove-Item -Force $tmp
    Write-Host ("  {0,-12} -> panda_emoji_{0}.dds" -f $shortcode)
}

Write-Host ("Built {0} emoji DDS textures." -f $pngs.Count)
