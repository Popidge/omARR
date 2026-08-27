var PLUGIN_ID = "io.github.luccast.omarr"
var API_MAX_BYTES = 2 * 1024 * 1024
var IMAGE_MAX_BYTES = 8 * 1024 * 1024
var SEEN_LIMIT = 400
var DEFAULT_POLL_SECONDS = 30
var LIST_PAGE_SIZE = 20
var PAGE_SIZE_MIN = 5
var PAGE_SIZE_MAX = 50
var KINDS = ["generic", "sonarr", "radarr", "sabnzbd", "qbittorrent"]

var KIND_DEFAULTS = {
  generic: { name: "Service", group: "Other", port: 80 },
  sonarr: { name: "Sonarr", group: "Media", port: 8989 },
  radarr: { name: "Radarr", group: "Media", port: 7878 },
  sabnzbd: { name: "SABnzbd", group: "Downloads", port: 8080 },
  qbittorrent: { name: "qBittorrent", group: "Downloads", port: 8080 }
}

var PORT_KINDS = {
  "8989": "sonarr",
  "7878": "radarr",
  "9696": "generic",
  "8096": "generic",
  "32400": "generic",
  "8123": "generic",
  "5055": "generic",
  "8080": "generic"
}

var SCAN_TARGETS = [
  { kind: "sonarr", port: 8989, name: "Sonarr" },
  { kind: "radarr", port: 7878, name: "Radarr" },
  { kind: "sabnzbd", port: 8080, name: "SABnzbd" },
  { kind: "qbittorrent", port: 8080, name: "qBittorrent" },
  { kind: "generic", port: 8096, name: "Jellyfin" },
  { kind: "generic", port: 32400, name: "Plex" },
  { kind: "generic", port: 8123, name: "Home Assistant" },
  { kind: "generic", port: 9696, name: "Prowlarr" },
  { kind: "generic", port: 5055, name: "Jellyseerr" }
]

function curlBounds(maxBytes) {
  var n = parseInt(maxBytes, 10)
  if (!(n > 0)) n = API_MAX_BYTES
  return ["--connect-timeout", "4", "--max-time", "20", "--max-filesize", String(n)]
}

function scanCurlBounds() {
  return ["--max-time", "1", "--max-filesize", "65536"]
}

function normalizeUrl(url) {
  return String(url || "").replace(/^\s+|\s+$/g, "").replace(/\/+$/, "")
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(String(url || ""))
}

function kindOf(value) {
  var kind = String(value || "").toLowerCase()
  return KINDS.indexOf(kind) === -1 ? "generic" : kind
}

function kindLabel(kind) {
  var meta = KIND_DEFAULTS[kindOf(kind)]
  return meta ? meta.name : "Service"
}

function kindGroup(kind) {
  var meta = KIND_DEFAULTS[kindOf(kind)]
  return meta ? meta.group : "Other"
}

function normalizeGroup(value, fallback) {
  if (value === undefined || value === null) return String(fallback || "")
  return String(value).replace(/^\s+|\s+$/g, "")
}

function kindNeedsApiKey(kind) {
  var k = kindOf(kind)
  return k === "sonarr" || k === "radarr" || k === "sabnzbd"
}

function kindNeedsUserPass(kind) {
  return kindOf(kind) === "qbittorrent"
}

var ICON_SLUGS = [
  "adguard-home", "audiobookshelf", "bazarr", "calibre-web", "deluge", "emby",
  "grafana", "home-assistant", "immich", "jellyfin", "jellyseerr", "kavita",
  "kodi", "komga", "lidarr", "navidrome", "nextcloud", "nginx-proxy-manager",
  "nzbget", "overseerr", "paperless-ngx", "pi-hole", "plex", "portainer",
  "prowlarr", "qbittorrent", "radarr", "readarr", "sabnzbd", "sonarr",
  "syncthing", "tautulli", "traefik", "transmission", "uptime-kuma", "whisparr"
]

var ICON_ALIASES = {
  "adguard": "adguard-home",
  "adguardhome": "adguard-home",
  "ha": "home-assistant",
  "homeassistant": "home-assistant",
  "npm": "nginx-proxy-manager",
  "nginxproxymanager": "nginx-proxy-manager",
  "paperless": "paperless-ngx",
  "pihole": "pi-hole",
  "qbit": "qbittorrent",
  "sab": "sabnzbd",
  "uptimekuma": "uptime-kuma"
}

function iconSlugs() {
  return ICON_SLUGS.slice()
}

function iconPageUrl(slug) {
  var s = String(slug || "")
  return s ? "https://dashboardicons.com/icons/" + s : ""
}

function iconCdnUrl(slug) {
  var s = String(slug || "")
  return s ? "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/" + s + ".svg" : ""
}

function normalizeIconKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

function slugMatchesKey(key, slug) {
  if (!key || !slug) return false
  if (key === slug) return true
  if (key.indexOf(slug + "-") === 0) return true
  if (key.indexOf("-" + slug + "-") !== -1) return true
  var suffix = "-" + slug
  return key.length > suffix.length && key.slice(key.length - suffix.length) === suffix
}

function lookupIconSlug(value) {
  var key = normalizeIconKey(value)
  if (!key) return ""
  if (ICON_ALIASES[key]) return ICON_ALIASES[key]
  var best = ""
  for (var i = 0; i < ICON_SLUGS.length; i++) {
    var slug = ICON_SLUGS[i]
    if (slugMatchesKey(key, slug) && slug.length > best.length) best = slug
  }
  return best
}

function iconSlug(service) {
  var svc = service && typeof service === "object" ? service : {}
  var kind = kindOf(svc.kind)
  if (kind !== "generic") return kind
  var fromName = lookupIconSlug(svc.name)
  if (fromName) return fromName
  var url = String(svc.url || "")
  var host = url.replace(/^https?:\/\//i, "").split("/")[0].split(":")[0]
  var fromHost = lookupIconSlug(host)
  if (fromHost) return fromHost
  return lookupIconSlug(url)
}

function uniqueServiceName(services, kind, ignoreId) {
  var base = kindLabel(kind)
  var list = Array.isArray(services) ? services : []
  var skip = String(ignoreId || "")
  var used = {}
  for (var i = 0; i < list.length; i++) {
    if (skip && String(list[i].id || "") === skip) continue
    used[String(list[i].name || "")] = true
  }
  if (!used[base]) return base
  var n = 2
  while (used[base + " " + n]) n++
  return base + " " + n
}

function defaultUrlForKind(kind) {
  var meta = KIND_DEFAULTS[kindOf(kind)] || KIND_DEFAULTS.generic
  return "http://127.0.0.1:" + meta.port
}

function defaultSettings() {
  return {
    services: [],
    pollSeconds: DEFAULT_POLL_SECONDS,
    pageSize: LIST_PAGE_SIZE,
    density: "comfortable",
    showCalendar: true,
    showQueue: true
  }
}

function clampPoll(value) {
  var n = parseInt(value, 10)
  if (!(n > 0)) n = DEFAULT_POLL_SECONDS
  if (n < 5) n = 5
  if (n > 3600) n = 3600
  return n
}

function clampPageSize(value) {
  var n = parseInt(value, 10)
  if (!(n > 0)) n = LIST_PAGE_SIZE
  if (n < PAGE_SIZE_MIN) n = PAGE_SIZE_MIN
  if (n > PAGE_SIZE_MAX) n = PAGE_SIZE_MAX
  return n
}

function normalizeService(entry, index) {
  var raw = entry && typeof entry === "object" ? entry : {}
  var kind = kindOf(raw.kind)
  var meta = KIND_DEFAULTS[kind] || KIND_DEFAULTS.generic
  var url = normalizeUrl(raw.url)
  if (url && !isHttpUrl(url)) url = ""
  var order = parseInt(raw.order, 10)
  if (isNaN(order)) order = index || 0
  var id = String(raw.id || "")
  if (!id) id = "svc-" + (order + 1)
  return {
    id: id,
    kind: kind,
    name: String(raw.name || meta.name),
    url: url,
    group: Object.prototype.hasOwnProperty.call(raw, "group")
      ? normalizeGroup(raw.group, "")
      : String(meta.group),
    order: order,
    notifyGrab: raw.notifyGrab !== false,
    notifyImport: raw.notifyImport !== false,
    notifyHealth: raw.notifyHealth !== false,
    notifyDownload: raw.notifyDownload !== false
  }
}

function normalizeSettings(raw) {
  var base = defaultSettings()
  var data = raw && typeof raw === "object" ? raw : {}
  var services = Array.isArray(data.services) ? data.services : []
  var out = []
  for (var i = 0; i < services.length; i++) out.push(normalizeService(services[i], i))
  out.sort(function(a, b) { return a.order - b.order })
  for (var j = 0; j < out.length; j++) out[j].order = j
  uniquifyIds(out)
  base.services = out
  base.pollSeconds = clampPoll(data.pollSeconds)
  base.pageSize = clampPageSize(data.pageSize)
  base.density = String(data.density || "") === "compact" ? "compact" : "comfortable"
  base.showCalendar = data.showCalendar !== false
  base.showQueue = data.showQueue !== false
  return base
}

function pluginSettings(config, id) {
  var key = String(id || PLUGIN_ID)
  var empty = defaultSettings()
  if (!config || typeof config !== "object") return empty

  function fromEntry(entry) {
    if (!entry || typeof entry !== "object") return null
    if (String(entry.id || "") !== key) return null
    return normalizeSettings(entry)
  }

  var bar = config.bar && config.bar.layout ? config.bar.layout : {}
  var sections = ["left", "center", "right"]
  for (var s = 0; s < sections.length; s++) {
    var entries = bar[sections[s]] || []
    for (var i = 0; i < entries.length; i++) {
      var found = fromEntry(entries[i])
      if (found) return found
    }
  }
  var plugins = config.plugins || []
  for (var p = 0; p < plugins.length; p++) {
    var plugin = fromEntry(plugins[p])
    if (plugin) return plugin
  }
  return empty
}

function settingsPayload(settings) {
  var data = normalizeSettings(settings)
  return {
    id: PLUGIN_ID,
    pollSeconds: data.pollSeconds,
    pageSize: data.pageSize,
    density: data.density,
    showCalendar: data.showCalendar,
    showQueue: data.showQueue,
    services: data.services
  }
}

function uniquifyIds(services) {
  var list = Array.isArray(services) ? services : []
  var used = {}
  for (var i = 0; i < list.length; i++) {
    var id = String(list[i].id || "")
    if (!id || used[id]) {
      var max = 0
      for (var key in used) {
        var taken = String(key || "").match(/^svc-(\d+)$/)
        if (taken) max = Math.max(max, parseInt(taken[1], 10))
      }
      for (var j = 0; j < list.length; j++) {
        if (j === i) continue
        var other = String(list[j].id || "")
        if (used[other]) continue
        var later = other.match(/^svc-(\d+)$/)
        if (later) max = Math.max(max, parseInt(later[1], 10))
      }
      id = "svc-" + (max + 1)
      list[i].id = id
    }
    used[id] = true
  }
  return list
}

function newServiceId(services) {
  var list = Array.isArray(services) ? services : []
  var max = 0
  for (var i = 0; i < list.length; i++) {
    var match = String(list[i] && list[i].id || "").match(/^svc-(\d+)$/)
    if (match) {
      var n = parseInt(match[1], 10)
      if (n > max) max = n
    }
  }
  return "svc-" + (max + 1)
}

function addService(settings, draft) {
  var data = normalizeSettings(settings)
  var next = draft && typeof draft === "object" ? draft : {}
  next.id = newServiceId(data.services)
  next.order = data.services.length
  data.services.push(normalizeService(next, data.services.length))
  return data
}

function updateService(settings, id, patch) {
  var data = normalizeSettings(settings)
  var key = String(id || "")
  var extra = patch && typeof patch === "object" ? patch : {}
  for (var i = 0; i < data.services.length; i++) {
    if (data.services[i].id !== key) continue
    var merged = {}
    var current = data.services[i]
    for (var ck in current) merged[ck] = current[ck]
    for (var pk in extra) merged[pk] = extra[pk]
    data.services[i] = normalizeService(merged, i)
  }
  return data
}

function removeService(settings, id) {
  var data = normalizeSettings(settings)
  var key = String(id || "")
  var next = []
  for (var i = 0; i < data.services.length; i++) {
    if (data.services[i].id === key) continue
    next.push(data.services[i])
  }
  for (var j = 0; j < next.length; j++) next[j].order = j
  data.services = next
  return data
}

function moveService(settings, id, delta) {
  var data = normalizeSettings(settings)
  var key = String(id || "")
  var shift = parseInt(delta, 10) || 0
  var index = -1
  for (var i = 0; i < data.services.length; i++) {
    if (data.services[i].id === key) index = i
  }
  if (index < 0) return data
  var group = data.services[index].group
  var peers = []
  for (var p = 0; p < data.services.length; p++) {
    if (data.services[p].group === group) peers.push(p)
  }
  var at = -1
  for (var a = 0; a < peers.length; a++) if (peers[a] === index) at = a
  var destAt = at + shift
  if (destAt < 0 || destAt >= peers.length) return data
  var target = peers[destAt]
  var tmpOrder = data.services[index].order
  data.services[index].order = data.services[target].order
  data.services[target].order = tmpOrder
  data.services.sort(function(x, y) { return x.order - y.order })
  for (var j = 0; j < data.services.length; j++) data.services[j].order = j
  return data
}

function groupedServices(services) {
  var list = Array.isArray(services) ? services.slice() : []
  var buckets = {}
  var names = []
  for (var i = 0; i < list.length; i++) {
    var name = normalizeGroup(list[i].group, "")
    if (!buckets[name]) {
      buckets[name] = []
      names.push(name)
    }
    buckets[name].push(list[i])
  }
  names.sort(function(a, b) {
    if (!a && !b) return 0
    if (!a) return 1
    if (!b) return -1
    var left = a.toLowerCase()
    var right = b.toLowerCase()
    if (left < right) return -1
    if (left > right) return 1
    return 0
  })
  var groups = []
  for (var n = 0; n < names.length; n++) {
    var members = buckets[names[n]].slice()
    members.sort(function(a, b) { return (a.order || 0) - (b.order || 0) })
    groups.push({ group: names[n], services: members })
  }
  return groups
}

function applyServiceMeta(snapshot, service) {
  var prev = snapshot && typeof snapshot === "object" ? snapshot : {}
  var copy = emptySnapshot(prev)
  for (var key in prev) copy[key] = prev[key]
  var svc = service && typeof service === "object" ? service : {}
  if (svc.id) copy.id = String(svc.id)
  if (svc.kind) copy.kind = kindOf(svc.kind)
  if (svc.name !== undefined && svc.name !== null) copy.name = String(svc.name)
  if (svc.url !== undefined && svc.url !== null) copy.url = String(svc.url)
  if (Object.prototype.hasOwnProperty.call(svc, "group")) copy.group = normalizeGroup(svc.group, "")
  return copy
}

function parseCredentials(raw) {
  try {
    var data = JSON.parse(String(raw || "{}"))
    return data && typeof data === "object" && !Array.isArray(data) ? data : {}
  } catch (e) {
    return {}
  }
}

function serializeCredentials(obj) {
  var data = obj && typeof obj === "object" ? obj : {}
  return JSON.stringify(data, null, 2) + "\n"
}

function credentialFor(creds, id) {
  var data = creds && typeof creds === "object" ? creds : {}
  var row = data[String(id || "")] || {}
  return {
    apiKey: String(row.apiKey || ""),
    username: String(row.username || ""),
    password: String(row.password || "")
  }
}

function setCredential(creds, id, patch) {
  var data = {}
  var source = creds && typeof creds === "object" ? creds : {}
  for (var key in source) data[key] = source[key]
  var current = credentialFor(data, id)
  var extra = patch && typeof patch === "object" ? patch : {}
  for (var pk in extra) current[pk] = extra[pk]
  data[String(id || "")] = current
  return data
}

function parseSeenFile(raw) {
  try {
    var data = JSON.parse(String(raw || "[]"))
    return Array.isArray(data) ? data.map(String) : []
  } catch (e) {
    return []
  }
}

function serializeSeenFile(ids) {
  var list = Array.isArray(ids) ? ids.map(String) : []
  if (list.length > SEEN_LIMIT) list = list.slice(list.length - SEEN_LIMIT)
  return JSON.stringify(list) + "\n"
}

function rememberIds(seen, ids) {
  var next = Array.isArray(seen) ? seen.slice() : []
  var incoming = Array.isArray(ids) ? ids : []
  for (var i = 0; i < incoming.length; i++) {
    var id = String(incoming[i] || "")
    if (!id || next.indexOf(id) !== -1) continue
    next.push(id)
  }
  if (next.length > SEEN_LIMIT) next = next.slice(next.length - SEEN_LIMIT)
  return next
}

function pad2(n) {
  return n < 10 ? "0" + n : String(n)
}

function isoDate(date) {
  var d = date instanceof Date ? date : new Date(date)
  return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate())
}

function arrCalendarRange(now, days) {
  var start = now instanceof Date ? new Date(now.getTime()) : new Date(now)
  var count = parseInt(days, 10)
  if (!(count > 0)) count = 7
  var end = new Date(start.getTime() + count * 86400000)
  return { start: isoDate(start), end: isoDate(end) }
}

function listPage(page) {
  var n = parseInt(page, 10)
  return n > 0 ? n : 1
}

function listOffset(page, pageSize) {
  return (listPage(page) - 1) * clampPageSize(pageSize)
}

function capList(list, max) {
  var n = clampPageSize(max)
  if (!Array.isArray(list) || list.length <= n) return Array.isArray(list) ? list : []
  return list.slice(0, n)
}

function listPager(page, count, total, pageSize) {
  var p = listPage(page)
  var size = clampPageSize(pageSize)
  var n = Array.isArray(count) ? count.length : (parseInt(count, 10) || 0)
  var tot = parseInt(total, 10) || 0
  var start = (p - 1) * size
  var from = n > 0 ? start + 1 : 0
  var to = start + n
  var hasPrev = p > 1
  var hasNext = tot > 0 ? to < tot : n >= size
  var label = ""
  if (from) label = tot ? from + "-" + to + " of " + tot : from + "-" + to
  return { page: p, hasPrev: hasPrev, hasNext: hasNext, from: from, to: to, total: tot, label: label }
}

function arrStatusUrl(base) {
  return normalizeUrl(base) + "/api/v3/system/status"
}

function arrQueueUrl(base, page, pageSize) {
  return normalizeUrl(base) + "/api/v3/queue?page=" + listPage(page) + "&pageSize=" + clampPageSize(pageSize)
}

function arrTotalRecords(raw) {
  var data = parseJson(raw, {})
  var n = parseInt(data && data.totalRecords, 10)
  return n > 0 ? n : 0
}

function arrCalendarUrl(base, start, end) {
  return normalizeUrl(base) + "/api/v3/calendar?start=" + encodeURIComponent(start) +
    "&end=" + encodeURIComponent(end) + "&unmonitored=false"
}

function arrWantedUrl(base, kind) {
  var path = kindOf(kind) === "radarr" ? "/api/v3/wanted/missing?page=1&pageSize=10" :
    "/api/v3/wanted/missing?page=1&pageSize=10"
  return normalizeUrl(base) + path
}

function arrPosterUrl(base, kind, id) {
  return normalizeUrl(base) + "/api/v3/mediacover/" + encodeURIComponent(String(id || "")) + "/poster-250.jpg"
}

function arrCommandUrl(base) {
  return normalizeUrl(base) + "/api/v3/command"
}

function parseJson(raw, fallback) {
  try {
    var data = JSON.parse(String(raw || ""))
    return data == null ? fallback : data
  } catch (e) {
    return fallback
  }
}

function parseArrStatus(raw) {
  var data = parseJson(raw, null)
  if (!data || typeof data !== "object") return { version: "", appName: "", healthy: false }
  return {
    version: String(data.version || ""),
    appName: String(data.appName || ""),
    healthy: true
  }
}

function parseArrQueue(raw, kind, pageSize) {
  var data = parseJson(raw, {})
  var records = data && Array.isArray(data.records) ? data.records : (Array.isArray(data) ? data : [])
  var out = []
  for (var i = 0; i < records.length; i++) {
    var row = records[i] || {}
    var size = Number(row.size) || 0
    var left = Number(row.sizeleft) || 0
    var progress = size > 0 ? Math.max(0, Math.min(1, 1 - left / size)) : 0
    out.push({
      id: String(row.id || ""),
      title: String(row.title || ""),
      status: String(row.status || "").toLowerCase(),
      size: size,
      sizeleft: left,
      timeleft: String(row.timeleft || ""),
      progress: progress,
      protocol: String(row.protocol || ""),
      downloadId: String(row.downloadId || ""),
      kind: kindOf(kind),
      posterId: row.series && row.series.id ? String(row.series.id) : (row.movie && row.movie.id ? String(row.movie.id) : "")
    })
  }
  return capList(out, pageSize)
}

function episodeCode(season, episode) {
  return "S" + pad2(parseInt(season, 10) || 0) + "E" + pad2(parseInt(episode, 10) || 0)
}

function parseArrCalendar(raw, kind, pageSize) {
  var data = parseJson(raw, [])
  var list = Array.isArray(data) ? data : []
  var out = []
  var isRadarr = kindOf(kind) === "radarr"
  for (var i = 0; i < list.length; i++) {
    var row = list[i] || {}
    if (isRadarr) {
      out.push({
        id: String(row.id || ""),
        title: String(row.title || ""),
        subtitle: String(row.year || ""),
        airDate: String(row.inCinemas || row.digitalRelease || row.physicalRelease || ""),
        hasFile: !!row.hasFile,
        monitored: row.monitored !== false,
        posterId: String(row.id || ""),
        kind: "radarr"
      })
    } else {
      var series = row.series || {}
      out.push({
        id: String(row.id || ""),
        title: String(series.title || ""),
        subtitle: episodeCode(row.seasonNumber, row.episodeNumber) + (row.title ? " " + row.title : ""),
        airDate: String(row.airDate || row.airDateUtc || ""),
        hasFile: !!row.hasFile,
        monitored: row.monitored !== false,
        posterId: series.id ? String(series.id) : "",
        kind: "sonarr"
      })
    }
  }
  return capList(out, pageSize)
}

function parseArrWanted(raw, kind) {
  var data = parseJson(raw, {})
  var records = data && Array.isArray(data.records) ? data.records : []
  var out = []
  var isRadarr = kindOf(kind) === "radarr"
  for (var i = 0; i < records.length; i++) {
    var row = records[i] || {}
    if (isRadarr) {
      out.push({
        id: String(row.id || ""),
        title: String(row.title || ""),
        subtitle: String(row.year || ""),
        posterId: String(row.id || ""),
        kind: "radarr"
      })
    } else {
      var series = row.series || {}
      out.push({
        id: String(row.id || ""),
        title: String(series.title || ""),
        subtitle: episodeCode(row.seasonNumber, row.episodeNumber) + (row.title ? " " + row.title : ""),
        posterId: series.id ? String(series.id) : "",
        kind: "sonarr"
      })
    }
  }
  return capList(out)
}

function parseSpeedString(value, kbpersec) {
  var kb = Number(kbpersec)
  if (kb > 0) return kb * 1024
  var text = String(value || "")
  var match = text.match(/([\d.]+)\s*([KMGT])?/i)
  if (!match) return 0
  var n = parseFloat(match[1])
  var unit = (match[2] || "").toUpperCase()
  if (unit === "G") return n * 1024 * 1024 * 1024
  if (unit === "T") return n * 1024 * 1024 * 1024 * 1024
  if (unit === "K") return n * 1024
  return n * 1024 * 1024
}

function parseSabQueue(raw, pageSize) {
  var data = parseJson(raw, {})
  var queue = data && data.queue ? data.queue : {}
  var slots = Array.isArray(queue.slots) ? queue.slots : []
  var items = []
  for (var i = 0; i < slots.length; i++) {
    var row = slots[i] || {}
    var mb = parseFloat(row.mb) || 0
    var left = parseFloat(row.mbleft) || 0
    var pct = parseFloat(row.percentage)
    var progress = !isNaN(pct) ? pct / 100 : (mb > 0 ? Math.max(0, 1 - left / mb) : 0)
    items.push({
      id: String(row.nzo_id || ""),
      title: String(row.filename || row.name || ""),
      status: String(row.status || "").toLowerCase(),
      size: mb * 1024 * 1024,
      sizeleft: left * 1024 * 1024,
      timeleft: String(row.timeleft || ""),
      progress: progress,
      kind: "sabnzbd"
    })
  }
  return {
    paused: queue.paused === true,
    speed: parseSpeedString(queue.speed, queue.kbpersec),
    timeleft: String(queue.timeleft || ""),
    total: parseInt(queue.noofslots, 10) || items.length,
    queue: capList(items, pageSize)
  }
}

function parseSabHistory(raw) {
  var data = parseJson(raw, {})
  var history = data && data.history ? data.history : {}
  var slots = Array.isArray(history.slots) ? history.slots : []
  var out = []
  for (var i = 0; i < slots.length; i++) {
    var row = slots[i] || {}
    var status = String(row.status || "").toLowerCase()
    if (status === "completed" || status.indexOf("complete") !== -1) status = "completed"
    if (status.indexOf("fail") !== -1) status = "failed"
    out.push({
      id: String(row.nzo_id || ""),
      title: String(row.name || row.nzb_name || ""),
      status: status,
      kind: "sabnzbd"
    })
  }
  return out
}

function parseQbitTorrents(raw, pageSize) {
  var data = parseJson(raw, [])
  var list = Array.isArray(data) ? data : []
  var out = []
  for (var i = 0; i < list.length; i++) {
    var row = list[i] || {}
    out.push({
      id: String(row.hash || ""),
      title: String(row.name || ""),
      status: String(row.state || "").toLowerCase(),
      progress: Number(row.progress) || 0,
      dlspeed: Number(row.dlspeed) || 0,
      upspeed: Number(row.upspeed) || 0,
      eta: Number(row.eta) || 0,
      size: Number(row.size) || 0,
      sizeleft: (1 - (Number(row.progress) || 0)) * (Number(row.size) || 0),
      timeleft: formatEta(Number(row.eta) || 0),
      kind: "qbittorrent"
    })
  }
  return capList(out, pageSize)
}

function parseQbitTransfer(raw) {
  var data = parseJson(raw, {})
  return {
    speed: Number(data && data.dl_info_speed) || 0,
    upspeed: Number(data && data.up_info_speed) || 0
  }
}

function headerApiKey(key) {
  return "X-Api-Key: " + String(key || "") + "\n"
}

function formEncode(obj) {
  var parts = []
  for (var key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue
    parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(obj[key] == null ? "" : obj[key])))
  }
  return parts.join("&")
}

function sabBody(apiKey, mode, extra, pageSize) {
  var data = { apikey: String(apiKey || ""), mode: String(mode || "queue"), output: "json" }
  if (String(mode || "queue") === "queue") {
    data.limit = String(clampPageSize(pageSize))
    data.start = "0"
  }
  var more = extra && typeof extra === "object" ? extra : {}
  for (var key in more) data[key] = more[key]
  return formEncode(data)
}

function qbitLoginBody(username, password) {
  return formEncode({ username: String(username || ""), password: String(password || "") })
}

function qbitHashesBody(hashes) {
  var list = Array.isArray(hashes) ? hashes : [hashes]
  return formEncode({ hashes: list.join("|") })
}

function sabApiUrl(base) {
  return normalizeUrl(base) + "/api"
}

function qbitLoginUrl(base) {
  return normalizeUrl(base) + "/api/v2/auth/login"
}

function qbitTorrentsUrl(base, page, pageSize) {
  return normalizeUrl(base) + "/api/v2/torrents/info?limit=" + clampPageSize(pageSize) +
    "&offset=" + listOffset(page, pageSize) + "&sort=dlspeed&reverse=true"
}

function qbitTransferUrl(base) {
  return normalizeUrl(base) + "/api/v2/transfer/info"
}

function qbitPauseUrl(base) {
  return normalizeUrl(base) + "/api/v2/torrents/pause"
}

function qbitResumeUrl(base) {
  return normalizeUrl(base) + "/api/v2/torrents/resume"
}

function qbitStopUrl(base) {
  return normalizeUrl(base) + "/api/v2/torrents/stop"
}

function qbitStartUrl(base) {
  return normalizeUrl(base) + "/api/v2/torrents/start"
}

function qbitPauseAllUrl(base) {
  return normalizeUrl(base) + "/api/v2/torrents/pause"
}

function qbitResumeAllUrl(base) {
  return normalizeUrl(base) + "/api/v2/torrents/resume"
}

function emptySnapshot(service) {
  var svc = service && typeof service === "object" ? service : {}
  return {
    id: String(svc.id || ""),
    kind: kindOf(svc.kind),
    name: String(svc.name || kindLabel(svc.kind)),
    url: String(svc.url || ""),
    group: String(svc.group || ""),
    health: "unknown",
    statusText: "Waiting…",
    version: "",
    paused: false,
    speed: 0,
    queue: [],
    queuePage: 1,
    queueTotal: 0,
    calendar: [],
    activity: [],
    wanted: []
  }
}

function applyHttpHealth(snapshot, statusCode) {
  var next = snapshot && typeof snapshot === "object" ? snapshot : emptySnapshot({})
  var copy = emptySnapshot(next)
  for (var key in next) copy[key] = next[key]
  var code = parseInt(statusCode, 10) || 0
  if (code >= 200 && code < 400) {
    copy.health = "up"
    copy.statusText = copy.version ? copy.version : "Reachable"
  } else {
    copy.health = "down"
    copy.statusText = code ? "HTTP " + code : "Unreachable"
  }
  return copy
}

function isHealthKind(kind) {
  var k = String(kind || "")
  return k === "arr-status" || k === "sab-queue" || k === "generic"
    || k === "qbit-torrents" || k === "qbit-login"
}

function decideHealth(previousHealth, statusCode, missCount) {
  var code = parseInt(statusCode, 10) || 0
  if (code >= 200 && code < 400) return { health: "up", misses: 0, commit: true }
  var misses = (parseInt(missCount, 10) || 0) + 1
  var hard = code === 401 || code === 403
  if (!hard && previousHealth === "up" && misses < 2)
    return { health: "up", misses: misses, commit: false }
  return { health: "down", misses: misses, commit: true }
}

function isActiveDownload(item) {
  if (!item) return false
  var status = String(item.status || "").toLowerCase()
  if (status.indexOf("complete") !== -1 || status.indexOf("uploading") !== -1) return false
  if (status === "pausedup" || status === "stalledup" || status === "forcedup") return false
  if (item.progress >= 1 && item.kind === "qbittorrent") return false
  if (status === "queued" || status === "stalleddl") return true
  return status.indexOf("download") !== -1 || status === "active" || (item.progress > 0 && item.progress < 1)
}

function mergeNow(snapshots, opts) {
  var list = Array.isArray(snapshots) ? snapshots : []
  var options = opts && typeof opts === "object" ? opts : {}
  var showCalendar = options.showCalendar !== false
  var showQueue = options.showQueue !== false
  var downloads = []
  var calendar = []
  var warnings = []
  var downloadingCount = 0
  var downCount = 0
  for (var i = 0; i < list.length; i++) {
    var snap = list[i] || emptySnapshot({})
    if (snap.health === "down") {
      downCount += 1
      warnings.push({
        id: "down-" + snap.id,
        serviceId: snap.id,
        title: snap.name,
        body: snap.statusText || "Unreachable"
      })
    }
    if (showQueue && Array.isArray(snap.queue)) {
      for (var q = 0; q < snap.queue.length; q++) {
        var item = snap.queue[q]
        if (!isActiveDownload(item)) continue
        downloadingCount += 1
        downloads.push({
          id: snap.id + ":" + item.id,
          serviceId: snap.id,
          serviceName: snap.name,
          kind: snap.kind,
          title: item.title,
          progress: item.progress,
          status: item.status,
          timeleft: item.timeleft,
          speed: item.dlspeed || snap.speed || 0
        })
      }
    }
    if (showCalendar && Array.isArray(snap.calendar)) {
      for (var c = 0; c < snap.calendar.length; c++) {
        var ev = snap.calendar[c]
        calendar.push({
          id: snap.id + ":" + ev.id,
          serviceId: snap.id,
          serviceName: snap.name,
          kind: snap.kind,
          title: ev.title,
          subtitle: ev.subtitle,
          airDate: ev.airDate,
          posterId: ev.posterId
        })
      }
    }
  }
  calendar.sort(function(a, b) { return String(a.airDate).localeCompare(String(b.airDate)) })
  if (calendar.length > 12) calendar = calendar.slice(0, 12)
  if (downloads.length > 12) downloads = downloads.slice(0, 12)
  return {
    downloads: downloads,
    calendar: calendar,
    warnings: warnings,
    downloadingCount: downloadingCount,
    downCount: downCount
  }
}

function fleetLine(snapshot) {
  var snap = snapshot || emptySnapshot({})
  if (snap.health === "down") return "down"
  if (snap.health === "unknown") return "waiting"
  var active = 0
  var queue = Array.isArray(snap.queue) ? snap.queue : []
  for (var i = 0; i < queue.length; i++) if (isActiveDownload(queue[i])) active += 1
  if (active > 0) {
    if (snap.speed > 0) return formatSpeed(snap.speed)
    return active === 1 ? "1 downloading" : active + " downloading"
  }
  var cal = Array.isArray(snap.calendar) ? snap.calendar : []
  if (cal.length && cal[0].airDate) return cal[0].title || cal[0].airDate
  if (snap.version) return snap.version
  return "idle"
}

function oneDecimal(n) {
  var v = Math.round(Number(n) * 10) / 10
  return v.toFixed(1)
}

function formatSpeed(bytesPerSec) {
  var n = Number(bytesPerSec) || 0
  if (n < 1024) return Math.round(n) + " B/s"
  if (n < 1024 * 1024) return oneDecimal(n / 1024) + " KB/s"
  if (n < 1024 * 1024 * 1024) return oneDecimal(n / (1024 * 1024)) + " MB/s"
  return oneDecimal(n / (1024 * 1024 * 1024)) + " GB/s"
}

function formatBytes(n) {
  var v = Number(n) || 0
  if (v < 1024) return Math.round(v) + " B"
  if (v < 1024 * 1024) return oneDecimal(v / 1024) + " KB"
  if (v < 1024 * 1024 * 1024) return oneDecimal(v / (1024 * 1024)) + " MB"
  return oneDecimal(v / (1024 * 1024 * 1024)) + " GB"
}

function formatEta(seconds) {
  var s = parseInt(seconds, 10)
  if (!(s > 0) || s > 86400 * 30) return ""
  if (s < 60) return s + "s"
  if (s < 3600) return Math.floor(s / 60) + "m"
  if (s < 86400) return Math.floor(s / 3600) + "h " + Math.floor((s % 3600) / 60) + "m"
  return Math.floor(s / 86400) + "d"
}

function formatProgress(value) {
  var n = Number(value) || 0
  return Math.round(n * 100) + "%"
}

function barBadge(snapshots) {
  var merged = mergeNow(snapshots, { showCalendar: false, showQueue: true })
  return {
    count: merged.downCount > 0 ? merged.downCount : merged.downloadingCount,
    urgent: merged.downCount > 0
  }
}

function barStatusText(snapshots) {
  var list = Array.isArray(snapshots) ? snapshots : []
  if (!list.length) return "omARR"
  var down = []
  var downloading = 0
  for (var i = 0; i < list.length; i++) {
    if (list[i].health === "down") down.push(list[i].name)
    var queue = Array.isArray(list[i].queue) ? list[i].queue : []
    for (var q = 0; q < queue.length; q++) if (isActiveDownload(queue[q])) downloading += 1
  }
  var parts = []
  if (downloading) parts.push(downloading + " downloading")
  if (down.length) parts.push(down.join(", ") + " unreachable")
  if (!parts.length) parts.push(list.length === 1 ? list[0].name + " idle" : list.length + " services")
  return parts.join(" · ")
}

function eventsFromPoll(prev, next, service) {
  var before = prev || emptySnapshot(service)
  var after = next || emptySnapshot(service)
  var svc = service || after
  var events = []
  if (before.health === "up" && after.health === "down") {
    events.push({
      id: "health-down-" + after.id,
      type: "service-down",
      serviceId: after.id,
      serviceName: after.name,
      title: after.name,
      body: after.statusText || "Unreachable"
    })
  }
  if (before.health === "down" && after.health === "up") {
    events.push({
      id: "health-up-" + after.id,
      type: "service-up",
      serviceId: after.id,
      serviceName: after.name,
      title: after.name,
      body: "Back online"
    })
  }
  var seenPrev = {}
  var prevQueue = Array.isArray(before.queue) ? before.queue : []
  for (var i = 0; i < prevQueue.length; i++) seenPrev[String(prevQueue[i].id)] = true
  var nextQueue = Array.isArray(after.queue) ? after.queue : []
  if (after.kind === "sonarr" || after.kind === "radarr") {
    for (var q = 0; q < nextQueue.length; q++) {
      var item = nextQueue[q]
      if (!item.id || seenPrev[item.id]) continue
      events.push({
        id: "grab-" + after.id + "-" + item.id,
        type: "grabbed",
        serviceId: after.id,
        serviceName: after.name,
        title: after.name,
        body: item.title
      })
    }
  }
  var prevAct = {}
  var beforeAct = Array.isArray(before.activity) ? before.activity : []
  for (var a = 0; a < beforeAct.length; a++) prevAct[String(beforeAct[a].id)] = true
  var afterAct = Array.isArray(after.activity) ? after.activity : []
  for (var b = 0; b < afterAct.length; b++) {
    var act = afterAct[b]
    if (!act.id || prevAct[act.id]) continue
    if (act.status === "completed") {
      events.push({
        id: "done-" + after.id + "-" + act.id,
        type: "download-finished",
        serviceId: after.id,
        serviceName: after.name,
        title: after.name,
        body: act.title
      })
    } else if (act.status === "failed") {
      events.push({
        id: "fail-" + after.id + "-" + act.id,
        type: "download-failed",
        serviceId: after.id,
        serviceName: after.name,
        title: after.name,
        body: act.title
      })
    }
  }
  if (after.kind === "qbittorrent") {
    var prevMap = {}
    for (var p = 0; p < prevQueue.length; p++) prevMap[String(prevQueue[p].id)] = prevQueue[p]
    for (var n = 0; n < nextQueue.length; n++) {
      var torrent = nextQueue[n]
      var was = prevMap[torrent.id]
      if (!was) continue
      var finished = torrent.progress >= 1 || String(torrent.status).indexOf("up") !== -1
      var wasActive = isActiveDownload(was)
      if (finished && wasActive) {
        events.push({
          id: "done-" + after.id + "-" + torrent.id,
          type: "download-finished",
          serviceId: after.id,
          serviceName: after.name,
          title: after.name,
          body: torrent.title
        })
      }
    }
  }
  return events
}

function shouldNotify(event, service, seen) {
  if (!event || !event.id) return false
  var list = Array.isArray(seen) ? seen : []
  if (list.indexOf(String(event.id)) !== -1) return false
  var svc = service && typeof service === "object" ? service : {}
  var type = String(event.type || "")
  if (type === "grabbed") return svc.notifyGrab !== false
  if (type === "import") return svc.notifyImport !== false
  if (type === "service-down" || type === "service-up") return svc.notifyHealth !== false
  if (type === "download-finished" || type === "download-failed") return svc.notifyDownload !== false
  return true
}

function toastTitle(event) {
  var row = event || {}
  if (row.type === "service-down") return row.serviceName + " is down"
  if (row.type === "service-up") return row.serviceName + " is back"
  if (row.type === "grabbed") return row.serviceName + " grabbed"
  if (row.type === "download-finished") return row.serviceName + " finished"
  if (row.type === "download-failed") return row.serviceName + " failed"
  return row.serviceName || "omARR"
}

function toastBody(event) {
  return String((event && event.body) || "")
}

function toastGlyph(event) {
  var type = event && event.type
  if (type === "service-down") return "󰀦"
  if (type === "service-up") return "󰗠"
  if (type === "grabbed") return "󰑓"
  if (type === "download-failed") return "󰅙"
  return "󰕙"
}

function scanTargets() {
  return SCAN_TARGETS.slice()
}

function scanUrl(host, port) {
  return "http://" + String(host || "127.0.0.1") + ":" + parseInt(port, 10)
}

function kindFromPort(port) {
  var key = String(parseInt(port, 10))
  return PORT_KINDS[key] || "generic"
}

function pauseAllActions(snapshots) {
  var list = Array.isArray(snapshots) ? snapshots : []
  var out = []
  for (var i = 0; i < list.length; i++) {
    var snap = list[i]
    if (!snap || snap.health === "down") continue
    if (snap.kind === "sabnzbd" && !snap.paused) {
      out.push({ serviceId: snap.id, kind: "sabnzbd", action: "pause-all" })
    }
    if (snap.kind === "qbittorrent") {
      out.push({ serviceId: snap.id, kind: "qbittorrent", action: "pause-all" })
    }
  }
  return out
}

function resumeAllActions(snapshots) {
  var list = Array.isArray(snapshots) ? snapshots : []
  var out = []
  for (var i = 0; i < list.length; i++) {
    var snap = list[i]
    if (!snap || snap.health === "down") continue
    if (snap.kind === "sabnzbd" && snap.paused) {
      out.push({ serviceId: snap.id, kind: "sabnzbd", action: "resume-all" })
    }
    if (snap.kind === "qbittorrent") {
      out.push({ serviceId: snap.id, kind: "qbittorrent", action: "resume-all" })
    }
  }
  return out
}

function posterCachePath(cacheDir, serviceId, itemId) {
  var safe = function(value) {
    return String(value || "").replace(/[^A-Za-z0-9._-]/g, "_")
  }
  return String(cacheDir || "") + "/" + safe(serviceId) + "-" + safe(itemId) + ".jpg"
}

function splitHttp(text) {
  var raw = String(text || "")
  var nl = raw.lastIndexOf("\n")
  if (nl === -1) return { body: raw, status: 0 }
  return { body: raw.slice(0, nl), status: parseInt(raw.slice(nl + 1), 10) || 0 }
}

function anyDownloader(snapshots) {
  var list = Array.isArray(snapshots) ? snapshots : []
  for (var i = 0; i < list.length; i++) {
    if (list[i].kind === "sabnzbd" || list[i].kind === "qbittorrent") return true
  }
  return false
}

function snapshotById(snapshots, id) {
  var list = Array.isArray(snapshots) ? snapshots : []
  var key = String(id || "")
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === key) return list[i]
  }
  return null
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PLUGIN_ID: PLUGIN_ID,
    API_MAX_BYTES: API_MAX_BYTES,
    IMAGE_MAX_BYTES: IMAGE_MAX_BYTES,
    SEEN_LIMIT: SEEN_LIMIT,
    LIST_PAGE_SIZE: LIST_PAGE_SIZE,
    PAGE_SIZE_MIN: PAGE_SIZE_MIN,
    PAGE_SIZE_MAX: PAGE_SIZE_MAX,
    KINDS: KINDS,
    KIND_DEFAULTS: KIND_DEFAULTS,
    curlBounds: curlBounds,
    scanCurlBounds: scanCurlBounds,
    normalizeUrl: normalizeUrl,
    isHttpUrl: isHttpUrl,
    kindOf: kindOf,
    kindLabel: kindLabel,
    kindGroup: kindGroup,
    normalizeGroup: normalizeGroup,
    kindNeedsApiKey: kindNeedsApiKey,
    kindNeedsUserPass: kindNeedsUserPass,
    ICON_SLUGS: ICON_SLUGS,
    iconSlugs: iconSlugs,
    iconPageUrl: iconPageUrl,
    iconCdnUrl: iconCdnUrl,
    iconSlug: iconSlug,
    uniqueServiceName: uniqueServiceName,
    defaultUrlForKind: defaultUrlForKind,
    defaultSettings: defaultSettings,
    normalizeService: normalizeService,
    normalizeSettings: normalizeSettings,
    clampPageSize: clampPageSize,
    pluginSettings: pluginSettings,
    settingsPayload: settingsPayload,
    newServiceId: newServiceId,
    addService: addService,
    updateService: updateService,
    removeService: removeService,
    moveService: moveService,
    groupedServices: groupedServices,
    applyServiceMeta: applyServiceMeta,
    parseCredentials: parseCredentials,
    serializeCredentials: serializeCredentials,
    credentialFor: credentialFor,
    setCredential: setCredential,
    parseSeenFile: parseSeenFile,
    serializeSeenFile: serializeSeenFile,
    rememberIds: rememberIds,
    arrCalendarRange: arrCalendarRange,
    listPage: listPage,
    listOffset: listOffset,
    listPager: listPager,
    arrStatusUrl: arrStatusUrl,
    arrQueueUrl: arrQueueUrl,
    arrTotalRecords: arrTotalRecords,
    arrCalendarUrl: arrCalendarUrl,
    arrWantedUrl: arrWantedUrl,
    arrPosterUrl: arrPosterUrl,
    arrCommandUrl: arrCommandUrl,
    parseArrStatus: parseArrStatus,
    parseArrQueue: parseArrQueue,
    parseArrCalendar: parseArrCalendar,
    parseArrWanted: parseArrWanted,
    parseSabQueue: parseSabQueue,
    parseSabHistory: parseSabHistory,
    parseQbitTorrents: parseQbitTorrents,
    parseQbitTransfer: parseQbitTransfer,
    headerApiKey: headerApiKey,
    sabBody: sabBody,
    qbitLoginBody: qbitLoginBody,
    qbitHashesBody: qbitHashesBody,
    sabApiUrl: sabApiUrl,
    qbitLoginUrl: qbitLoginUrl,
    qbitTorrentsUrl: qbitTorrentsUrl,
    qbitTransferUrl: qbitTransferUrl,
    qbitPauseUrl: qbitPauseUrl,
    qbitResumeUrl: qbitResumeUrl,
    qbitStopUrl: qbitStopUrl,
    qbitStartUrl: qbitStartUrl,
    qbitPauseAllUrl: qbitPauseAllUrl,
    qbitResumeAllUrl: qbitResumeAllUrl,
    emptySnapshot: emptySnapshot,
    applyHttpHealth: applyHttpHealth,
    isHealthKind: isHealthKind,
    decideHealth: decideHealth,
    isActiveDownload: isActiveDownload,
    mergeNow: mergeNow,
    fleetLine: fleetLine,
    formatSpeed: formatSpeed,
    formatBytes: formatBytes,
    formatEta: formatEta,
    formatProgress: formatProgress,
    barBadge: barBadge,
    barStatusText: barStatusText,
    eventsFromPoll: eventsFromPoll,
    shouldNotify: shouldNotify,
    toastTitle: toastTitle,
    toastBody: toastBody,
    toastGlyph: toastGlyph,
    scanTargets: scanTargets,
    scanUrl: scanUrl,
    kindFromPort: kindFromPort,
    pauseAllActions: pauseAllActions,
    resumeAllActions: resumeAllActions,
    posterCachePath: posterCachePath,
    splitHttp: splitHttp,
    anyDownloader: anyDownloader,
    snapshotById: snapshotById
  }
}
