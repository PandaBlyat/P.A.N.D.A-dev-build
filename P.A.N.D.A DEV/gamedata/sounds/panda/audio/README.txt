P.A.N.D.A. PDA Audio Attachments
================================

Drop OGG Vorbis files into this directory to make them available as PDA
audio attachments in conversations.

Layout
------
  gamedata/sounds/panda/audio/<name>.ogg

The `<name>` token is what you reference from conversation XML via the
`_open_audio` / `_reply_N_audio` keys (or the editor's "Audio" fields).
Example: a file named `radio_call_static.ogg` is referenced as
`radio_call_static`. The runtime sanitiser will also accept the full
filename with extension and strip `.ogg` / `.wav` automatically.

Allowed characters in `<name>`: letters, digits, `_`, `-`, and `\` for
sub-folders. Anything else (`.`, `:`, leading `\`, spaces) is rejected
to prevent path traversal. See `sanitize_pda_audio_name` in
`gamedata/scripts/pda_interactive_conv.script`.

Format requirements
-------------------
- Container/codec: OGG Vorbis (`.ogg`). The X-Ray engine plays this via
  `sound_object()` in 2D mode.
- Channels: mono recommended (the player hears the message as 2D UI
  audio; stereo files work but have no spatial benefit).
- Sample rate: 22050 Hz or 44100 Hz.
- Length: keep short (<10 s). Long clips block the bubble UI flow.

Sample
------
`panda_test_beep.ogg` is a ~0.3 s 880 Hz tone you can wire into any
NPC reply to confirm the playback path works end-to-end.

Troubleshooting
---------------
If clicking the "Play audio" row in the PDA does nothing, check
`xray_*.log` for:

  PANDA_PRIVATE: audio file missing at gamedata/sounds/panda/audio/<name>.ogg

That indicates the file is not present (or has the wrong extension /
name). The path is logged exactly as the engine looked for it.
