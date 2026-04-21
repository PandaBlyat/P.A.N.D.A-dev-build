# P.A.N.D.A modding tooling

This repo is mostly **Lua scripts** and **XRay XML string/UI configs**, so the fastest quality loop is:

1. Install syntax/lint helpers.
2. Run one command (`make check`) before every commit.

## Quick start

```bash
make setup-tools
make check
make doctor-strict  # optional: fail fast if XML parse errors exist
```

## Added helpers

- `tools/setup_modding_env.sh`
  - Installs base tools for Ubuntu/Debian environments:
    - `lua5.1` (runtime/parser compatibility with classic XRay Lua)
    - `luacheck` (Lua static lint)
    - `xmllint` (XML parse validation)
    - `shellcheck` (for any helper shell scripts)
- `tools/mod_doctor.py`
  - Runs repository-specific sanity checks:
    - XML parsing checks across `gamedata/configs`
    - warns on duplicate `<string id="...">` entries across string tables
    - warns on empty string-table values
    - script hygiene checks (trailing whitespace + rough Lua block mismatch signal)
- `.luacheckrc`
  - Preconfigures common XRay/Anomaly globals so lint results are focused.
- `Makefile`
  - `make check`: repo-safe report that runs without external Lua tools
  - does **not** fail the command by default (good for baseline-heavy projects)
- `make doctor-strict`: same checks, but exits non-zero when errors are found
  - `make lua-lint` / `make xml-lint`: deeper checks when toolchain is installed

## Notes for constrained CI/dev containers

If package mirrors are blocked, `make setup-tools` may fail due to network policy. `make check` still works because `mod_doctor.py` only needs Python 3.

## Web editor collaboration

Pair-collab publish credit requires the editor Express proxy (`tools/editor/server`) to run. Supabase Realtime carries live edit traffic, but co-author verification, publish XP, daily co-author XP caps, and host/guest publish checks run server-side before writing `community_conversations`.
