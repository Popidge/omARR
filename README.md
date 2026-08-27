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

Toasts for grabs, imports, finished or failed downloads, and services going down or coming back. Click a toast to summon the panel.

## Settings

First open is an empty radar. Add a service by kind, or **Scan local ports** to probe this machine (8989, 7878, 8080, 8096, 32400, 8123, 9696, 5055).

| Kind | Auth | Live data | Controls |
| --- | --- | --- | --- |
| Generic | none | Up / down | Open in browser |
| Sonarr | API key | Queue, history, 7-day calendar, missing | Open in browser |
| Radarr | API key | Queue, history, calendar, missing | Open in browser |
| SABnzbd | API key | Queue, history, speed | Pause / resume queue or a job |
| qBittorrent | username + password | Torrents, transfer speed | Pause / resume torrent or all |

Layout (names, URLs, groups, order, notification flags, poll interval, queue page size, density) is stored in `~/.config/omarchy/shell.json`. API keys and passwords are stored only in `~/.local/state/omarchy/omarr/credentials.json` (`0600`).

## Icons

Fleet and settings tiles use [Dashboard Icons](https://dashboardicons.com) from [Homarr Labs](https://github.com/homarr-labs/dashboard-icons) (Apache 2.0). The colorful SVGs are bundled under `icons/` so the panel never fetches a CDN at runtime. Kind tiles (Sonarr, Radarr, SABnzbd, qBittorrent) always get that icon; generic tiles match on the service name.

| Service | Icon |
| --- | --- |
| Sonarr | [sonarr](https://dashboardicons.com/icons/sonarr) |
| Radarr | [radarr](https://dashboardicons.com/icons/radarr) |
| Lidarr | [lidarr](https://dashboardicons.com/icons/lidarr) |
| Prowlarr | [prowlarr](https://dashboardicons.com/icons/prowlarr) |
| Bazarr | [bazarr](https://dashboardicons.com/icons/bazarr) |
| Readarr | [readarr](https://dashboardicons.com/icons/readarr) |
| Whisparr | [whisparr](https://dashboardicons.com/icons/whisparr) |
| SABnzbd | [sabnzbd](https://dashboardicons.com/icons/sabnzbd) |
| qBittorrent | [qbittorrent](https://dashboardicons.com/icons/qbittorrent) |
| NZBGet | [nzbget](https://dashboardicons.com/icons/nzbget) |
| Transmission | [transmission](https://dashboardicons.com/icons/transmission) |
| Deluge | [deluge](https://dashboardicons.com/icons/deluge) |
| Jellyfin | [jellyfin](https://dashboardicons.com/icons/jellyfin) |
| Plex | [plex](https://dashboardicons.com/icons/plex) |
| Emby | [emby](https://dashboardicons.com/icons/emby) |
| Jellyseerr | [jellyseerr](https://dashboardicons.com/icons/jellyseerr) |
| Overseerr | [overseerr](https://dashboardicons.com/icons/overseerr) |
| Tautulli | [tautulli](https://dashboardicons.com/icons/tautulli) |
| Kodi | [kodi](https://dashboardicons.com/icons/kodi) |
| Navidrome | [navidrome](https://dashboardicons.com/icons/navidrome) |
| Audiobookshelf | [audiobookshelf](https://dashboardicons.com/icons/audiobookshelf) |
| Komga | [komga](https://dashboardicons.com/icons/komga) |
| Kavita | [kavita](https://dashboardicons.com/icons/kavita) |
| Calibre-Web | [calibre-web](https://dashboardicons.com/icons/calibre-web) |
| Immich | [immich](https://dashboardicons.com/icons/immich) |
| Home Assistant | [home-assistant](https://dashboardicons.com/icons/home-assistant) |
| Portainer | [portainer](https://dashboardicons.com/icons/portainer) |
| Grafana | [grafana](https://dashboardicons.com/icons/grafana) |
| AdGuard Home | [adguard-home](https://dashboardicons.com/icons/adguard-home) |
| Pi-hole | [pi-hole](https://dashboardicons.com/icons/pi-hole) |
| Uptime Kuma | [uptime-kuma](https://dashboardicons.com/icons/uptime-kuma) |
| Syncthing | [syncthing](https://dashboardicons.com/icons/syncthing) |
| Nextcloud | [nextcloud](https://dashboardicons.com/icons/nextcloud) |
| Nginx Proxy Manager | [nginx-proxy-manager](https://dashboardicons.com/icons/nginx-proxy-manager) |
| Traefik | [traefik](https://dashboardicons.com/icons/traefik) |
| Paperless-ngx | [paperless-ngx](https://dashboardicons.com/icons/paperless-ngx) |

Name a generic tile after one of those (or a close alias like `pihole`) and the matching icon shows up. Unknown names fall back to a letter tile. The bar keeps the omARR radar glyph.

## Remove

```sh
omarchy plugin remove io.github.luccast.omarr
```

## Develop

```sh
node tests/Model.test.js
omarchy plugin validate .
qmllint -I "$OMARCHY_PATH/shell" BarWidget.qml Panel.qml Service.qml SettingsView.qml OmarrIcon.qml ServiceIcon.qml CalendarCard.qml
```
