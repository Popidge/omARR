# omARR

A radar-room for locally hosted services, in the Omarchy bar.

Glance the icon for downloads and outages. Open the panel for a fleet roster, a merged “now” feed (queues, tonight’s *arr calendar, health), and per-service controls. Sonarr, Radarr, SABnzbd, and qBittorrent can log in with an API key or password; everything else is a generic tile that health-checks and opens in the browser.

Plugins run unsandboxed inside `omarchy-shell` with your user permissions. Read the code before you enable it.

## Install

```sh
omarchy plugin add https://github.com/luccast/omARR.git --enable
```

The widget lands on the right side of the bar. Move it with:

```sh
omarchy bar move io.github.luccast.omarr
```

Update later with `omarchy plugin update io.github.luccast.omarr`.

## Use

| Action | Result |
| --- | --- |
| Click the bar icon | Open or close the panel |
| `j` / `k` | Move through the fleet |
| Enter | Open the selected service in the browser |
| Space | Expand that service’s detail pane |
| `s` | Settings |
| `p` / `r` | Pause / resume all download clients |
| Escape | Close |

Toasts for grabs, finished or failed downloads, and services going down or coming back. Click a toast to summon the panel.

## Settings

First open is an empty radar. Add a service by kind, or **Scan local ports** to probe this machine (8989, 7878, 8080, 8096, 32400, 8123, 9696, 5055).

| Kind | Auth | Live data | Controls |
| --- | --- | --- | --- |
| Generic | none | Up / down | Open in browser |
| Sonarr | API key | Queue, 7-day calendar, missing | Open in browser |
| Radarr | API key | Queue, calendar, missing | Open in browser |
| SABnzbd | API key | Queue, history, speed | Pause / resume queue or a job |
| qBittorrent | username + password | Torrents, transfer speed | Pause / resume torrent or all |

Layout (names, URLs, groups, order, notification flags, poll interval, density) is stored in `~/.config/omarchy/shell.json`. API keys and passwords are stored only in `~/.local/state/omarchy/omarr/credentials.json` (`0600`).

## Remove

```sh
omarchy plugin remove io.github.luccast.omarr
```

## Develop

```sh
node tests/Model.test.js
omarchy plugin validate .
qmllint -I "$OMARCHY_PATH/shell" BarWidget.qml Panel.qml Service.qml SettingsView.qml OmarrIcon.qml
```
