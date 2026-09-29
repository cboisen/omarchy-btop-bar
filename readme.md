# Omarchy btop bar
Status monitor for Omarchy. Just the bare metrics to know how your machine is doing.

```
󰓅 3.21  󰍛 61%  󰋊 77G
```

A bar widget for the Omarchy shell that shows:

- **Load average**: the 1-minute value from `/proc/loadavg`
- **RAM usage**: used memory in percent (`MemTotal - MemAvailable`, same as `free` and btop)
- **Free disk space**: space on `/` that a normal user can write (df's `Avail`), in GB (base 10)

Hover to see the 1/5/15 load, RAM and disk in detail, and network down/up rates. The rates are summed over physical interfaces; Docker, bridge, VPN and loopback interfaces are skipped so traffic isn't counted twice. Left click to open btop.

Load, RAM and network are read straight from `/proc`. Disk space comes from `df`, which runs once per refresh.

## Install

```bash
omarchy plugin add https://github.com/cboisen/omarchy-btop-bar.git --enable
omarchy bar move cboisen.btop-bar --section right --index 0
```

For development, symlink the checkout instead:

```bash
ln -s "$PWD" ~/.config/omarchy/plugins/cboisen.btop-bar
omarchy-shell shell rescanPlugins
omarchy plugin enable cboisen.btop-bar --section right --index 0
```

The shell's file watcher doesn't follow symlinks, so run `omarchy restart shell` to pick up changes.

## Settings

Set these on the widget's entry in `~/.config/omarchy/shell.json`, with `omarchy bar set cboisen.btop-bar <key> <value>`, or from the settings panel.

| Key          | Default | Description |
|--------------|---------|-------------|
| `interval`   | `5`     | Refresh interval in seconds (1–60) |
| `items`      | `[]`    | Metrics to show, from `load`, `ram`, `disk`. Empty shows all. |
| `interfaces` | `""`    | Comma separated interfaces to count for the tooltip network rates, e.g. `"wlp0s20f3"`. Empty auto-detects. |

## Tests

```bash
node test/model-test.js
```
