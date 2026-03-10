std = "lua51"

-- XRay/Anomaly script globals and singleton APIs.
globals = {
  "RegisterScriptCallback", "UnregisterScriptCallback", "ResetTimeEvent",
  "time_global", "db", "level", "printf", "math", "ui_mcm", "pda_interactive_conv",
  "has_alife_info", "IsStoryMode", "on_key_press", "get_actor_true_community",
  "class", "LuaTimeEvent", "LuaEvent", "send_tip", "pick_random_from_table"
}

ignore = {"212"} -- allow some legacy globals injected by engine
max_line_length = 180
