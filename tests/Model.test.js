#!/usr/bin/env node
var assert = require("assert")
var Model = require("../Model.js")

var fails = 0
function check(cond, msg) {
  try {
    assert.ok(cond, msg)
  } catch (e) {
    fails += 1
    console.error("fail:", msg)
  }
}

function checkEqual(actual, expected, msg) {
  try {
    assert.strictEqual(actual, expected, msg + " (got " + JSON.stringify(actual) + ")")
  } catch (e) {
    fails += 1
    console.error("fail:", msg, "got", JSON.stringify(actual), "expected", JSON.stringify(expected))
  }
}

checkEqual(Model.PLUGIN_ID, "io.github.luccast.omarr", "plugin id")
checkEqual(Model.API_MAX_BYTES, 2 * 1024 * 1024, "api max")
check(Model.curlBounds(0).join(" ") === "--connect-timeout 4 --max-time 20 --max-filesize 2097152", "curl bounds fallback")
check(Model.curlBounds(Model.IMAGE_MAX_BYTES).indexOf("8388608") !== -1, "image bounds")

checkEqual(Model.normalizeUrl(" http://box:8989/ "), "http://box:8989", "normalizeUrl trim")
checkEqual(Model.normalizeUrl(""), "", "normalizeUrl empty")
check(Model.isHttpUrl("http://127.0.0.1:8989") === true, "http ok")
check(Model.isHttpUrl("https://media.lan") === true, "https ok")
check(Model.isHttpUrl("ftp://x") === false, "ftp rejected")
check(Model.isHttpUrl("javascript:alert(1)") === false, "js rejected")
check(Model.isHttpUrl("") === false, "empty url rejected")

var empty = Model.defaultSettings()
check(Array.isArray(empty.services) && empty.services.length === 0, "default services")
checkEqual(empty.pollSeconds, 30, "default poll")
checkEqual(empty.density, "comfortable", "default density")
check(empty.showCalendar === true && empty.showQueue === true, "default panes")

var fromBar = Model.pluginSettings({
  bar: {
    layout: {
      right: [{
        id: Model.PLUGIN_ID,
        pollSeconds: 15,
        density: "compact",
        showCalendar: false,
        services: [{ kind: "sonarr", url: "http://127.0.0.1:8989/", name: "TV" }]
      }]
    }
  }
})
checkEqual(fromBar.pollSeconds, 15, "poll from shell.json")
checkEqual(fromBar.density, "compact", "density from shell.json")
check(fromBar.showCalendar === false, "calendar hidden")
checkEqual(fromBar.services.length, 1, "one service")
checkEqual(fromBar.services[0].kind, "sonarr", "kind")
checkEqual(fromBar.services[0].url, "http://127.0.0.1:8989", "url stripped")
checkEqual(fromBar.services[0].group, "Media", "default group")
check(fromBar.services[0].notifyGrab === true, "notify grab default")

checkEqual(Model.pluginSettings({}).services.length, 0, "missing config")
checkEqual(Model.pluginSettings({
  plugins: [{ id: Model.PLUGIN_ID, services: [{ kind: "radarr", url: "http://r:7878" }] }]
}).services[0].kind, "radarr", "plugins[] fallback")

var bogus = Model.normalizeService({ kind: "nope", url: "not-a-url" }, 0)
checkEqual(bogus.kind, "generic", "unknown kind")
checkEqual(bogus.url, "", "invalid url dropped")

var idA = Model.newServiceId([])
var idB = Model.newServiceId([{ id: "svc-1" }, { id: "svc-4" }])
check(idA.indexOf("svc-") === 0, "new id prefix")
checkEqual(idB, "svc-5", "new id increments")

var s1 = Model.addService(Model.defaultSettings(), { kind: "sonarr", url: "http://127.0.0.1:8989" })
checkEqual(s1.services.length, 1, "add service")
checkEqual(s1.services[0].name, "Sonarr", "kind default name")
var s2 = Model.addService(s1, { kind: "radarr", url: "http://127.0.0.1:7878" })
checkEqual(s2.services.length, 2, "second service")
var twoSonarr = Model.addService(s1, { kind: "sonarr", url: "http://192.168.2.200:8989", name: "Sonarr 4K" })
checkEqual(twoSonarr.services.length, 2, "two sonarrs")
checkEqual(twoSonarr.services[0].kind, "sonarr", "first remains sonarr")
checkEqual(twoSonarr.services[1].kind, "sonarr", "second is sonarr")
check(twoSonarr.services[0].id !== twoSonarr.services[1].id, "sonarrs get distinct ids")
var twoKeys = Model.setCredential({}, twoSonarr.services[0].id, { apiKey: "aaa" })
twoKeys = Model.setCredential(twoKeys, twoSonarr.services[1].id, { apiKey: "bbb" })
checkEqual(Model.credentialFor(twoKeys, twoSonarr.services[0].id).apiKey, "aaa", "first sonarr key")
checkEqual(Model.credentialFor(twoKeys, twoSonarr.services[1].id).apiKey, "bbb", "second sonarr key")

check(Model.kindNeedsApiKey("sonarr") && Model.kindNeedsApiKey("radarr") && Model.kindNeedsApiKey("sabnzbd"), "arr/sab need api key")
check(!Model.kindNeedsApiKey("generic") && !Model.kindNeedsApiKey("qbittorrent"), "generic/qbit no api key")
check(Model.kindNeedsUserPass("qbittorrent"), "qbit needs user/pass")
check(!Model.kindNeedsUserPass("sonarr"), "sonarr no user/pass")
checkEqual(Model.uniqueServiceName([], "sonarr"), "Sonarr", "first sonarr name")
checkEqual(Model.uniqueServiceName(s1.services, "sonarr"), "Sonarr 2", "second sonarr name")
checkEqual(Model.uniqueServiceName(twoSonarr.services, "sonarr"), "Sonarr 2", "third default skips 4K custom")

var collided = Model.normalizeSettings({
  services: [
    { id: "svc-2", kind: "sonarr", url: "http://a:8989" },
    { kind: "sonarr", url: "http://b:8989" }
  ]
})
checkEqual(collided.services.length, 2, "colliding ids kept both")
check(collided.services[0].id !== collided.services[1].id, "normalize uniquifies ids")
checkEqual(collided.services[0].kind, "sonarr", "collided first kind")
checkEqual(collided.services[1].kind, "sonarr", "collided second kind")
var s3 = Model.updateService(s2, s2.services[0].id, { name: "TV" })
checkEqual(s3.services[0].name, "TV", "rename")
var s4 = Model.moveService(s3, s3.services[0].id, 1)
checkEqual(s4.services[0].kind, "radarr", "moved down")
var s5 = Model.removeService(s4, s4.services[0].id)
checkEqual(s5.services.length, 1, "removed")
checkEqual(s5.services[0].kind, "sonarr", "remaining")

var grouped = Model.groupedServices([
  { id: "a", group: "Other", order: 2, name: "HA" },
  { id: "b", group: "Media", order: 0, name: "Sonarr" },
  { id: "c", group: "Media", order: 1, name: "Radarr" }
])
checkEqual(grouped.length, 2, "two groups")
checkEqual(grouped[0].group, "Media", "media first")
checkEqual(grouped[0].services.length, 2, "media members")
checkEqual(grouped[1].group, "Other", "other second")

var blankGroup = Model.normalizeService({ kind: "sonarr", url: "http://s:8989", group: "" }, 0)
checkEqual(blankGroup.group, "", "empty group is kept")
checkEqual(Model.normalizeService({ kind: "sonarr", url: "http://s:8989", group: "  Night  " }, 0).group, "Night", "group trimmed")
checkEqual(Model.normalizeService({ kind: "sonarr", url: "http://s:8989" }, 0).group, "Media", "missing group uses kind default")
var cleared = Model.updateService({
  services: [{ id: "svc-1", kind: "sonarr", url: "http://s:8989", group: "Other" }]
}, "svc-1", { group: "" })
checkEqual(cleared.services[0].group, "", "update can clear group")

var regroup = Model.groupedServices([
  { id: "a", group: "", order: 0, name: "Ungrouped" },
  { id: "b", group: "Media", order: 2, name: "Later media" },
  { id: "c", group: "Media", order: 1, name: "First media" },
  { id: "d", group: "Downloads", order: 3, name: "SAB" }
])
checkEqual(regroup.length, 3, "named groups plus ungrouped")
checkEqual(regroup[0].group, "Downloads", "groups sort alphabetically")
checkEqual(regroup[1].group, "Media", "media after downloads")
checkEqual(regroup[1].services[0].name, "First media", "within group by order")
checkEqual(regroup[1].services[1].name, "Later media", "within group second")
checkEqual(regroup[2].group, "", "ungrouped last")
checkEqual(regroup[2].services[0].name, "Ungrouped", "ungrouped member")

var stale = Model.emptySnapshot({ id: "svc-1", kind: "sonarr", name: "Old", url: "http://old", group: "Other" })
stale.health = "up"
var synced = Model.applyServiceMeta(stale, { id: "svc-1", kind: "sonarr", name: "Sonarr LQ", url: "http://new", group: "Media" })
checkEqual(synced.group, "Media", "meta sync group")
checkEqual(synced.name, "Sonarr LQ", "meta sync name")
checkEqual(synced.health, "up", "meta sync keeps health")

var creds = Model.parseCredentials('{"svc-1":{"apiKey":"abc"}}')
checkEqual(Model.credentialFor(creds, "svc-1").apiKey, "abc", "cred read")
var creds2 = Model.setCredential(creds, "svc-1", { username: "admin" })
checkEqual(creds2["svc-1"].apiKey, "abc", "cred merge keeps key")
checkEqual(creds2["svc-1"].username, "admin", "cred merge username")
check(Model.parseCredentials("nope")["x"] === undefined, "bad creds")
check(Model.serializeCredentials({ "svc-1": { apiKey: "z" } }).indexOf("svc-1") !== -1, "serialize creds")

checkEqual(Model.parseSeenFile('["a","b"]').join(","), "a,b", "seen parse")
checkEqual(Model.parseSeenFile("x").length, 0, "seen bad")
checkEqual(Model.rememberIds(["1"], ["1", "2"]).join(","), "1,2", "remember")
var longSeen = []
for (var i = 0; i < Model.SEEN_LIMIT + 5; i++) longSeen.push(String(i))
checkEqual(Model.rememberIds(longSeen, ["new"]).length, Model.SEEN_LIMIT, "seen cap")

var range = Model.arrCalendarRange(new Date(Date.UTC(2026, 7, 26)), 7)
checkEqual(range.start, "2026-08-26", "cal start")
checkEqual(range.end, "2026-09-02", "cal end")

checkEqual(Model.arrStatusUrl("http://s:8989"), "http://s:8989/api/v3/system/status", "status url")
checkEqual(Model.arrQueueUrl("http://s:8989"), "http://s:8989/api/v3/queue?page=1&pageSize=20", "queue url")
check(Model.arrCalendarUrl("http://s:8989", "2026-08-26", "2026-09-02").indexOf("start=2026-08-26") !== -1, "cal url")
checkEqual(Model.arrPosterUrl("http://s:8989", "sonarr", 12), "http://s:8989/api/v3/mediacover/12/poster-250.jpg", "poster url")

var status = Model.parseArrStatus('{"version":"4.0.1","appName":"Sonarr"}')
checkEqual(status.version, "4.0.1", "arr version")
check(status.healthy === true, "arr healthy")
checkEqual(Model.parseArrStatus("nope").healthy, false, "arr status junk")

var fs = require("fs")
var path = require("path")
var fixtureQueue = fs.readFileSync(path.join(__dirname, "fixtures/sonarr-queue.json"), "utf8")
var queue = Model.parseArrQueue(fixtureQueue, "sonarr")
checkEqual(queue.length, 1, "arr queue len")
checkEqual(queue[0].progress, 0.75, "arr progress")
checkEqual(queue[0].title, "Show.S01E01", "arr queue title")

var cal = Model.parseArrCalendar(JSON.stringify([
  {
    id: 4,
    airDate: "2026-08-26",
    hasFile: false,
    monitored: true,
    series: { title: "Show", id: 3 },
    seasonNumber: 1,
    episodeNumber: 2,
    title: "Next"
  }
]), "sonarr")
checkEqual(cal[0].title, "Show", "cal series")
checkEqual(cal[0].subtitle, "S01E02 Next", "cal episode")
checkEqual(cal[0].posterId, "3", "cal poster")

var movies = Model.parseArrCalendar(JSON.stringify([
  { id: 8, title: "Film", year: 2024, inCinemas: "2026-08-27", hasFile: false, monitored: true }
]), "radarr")
checkEqual(movies[0].title, "Film", "radarr cal")
checkEqual(movies[0].subtitle, "2024", "radarr year")

var wanted = Model.parseArrWanted(JSON.stringify({
  records: [{ id: 1, title: "Pilot", seasonNumber: 1, episodeNumber: 1, series: { title: "Show", id: 3 } }]
}), "sonarr")
checkEqual(wanted[0].title, "Show", "wanted series")

var sab = Model.parseSabQueue(JSON.stringify({
  queue: {
    paused: false,
    speed: "1.5 M",
    speedlimit: "",
    mbleft: "100",
    timeleft: "0:12:00",
    kbpersec: 1536,
    slots: [{
      nzo_id: "SABnzbd_nzo_x",
      filename: "Show.nzb",
      status: "Downloading",
      mb: "800",
      mbleft: "200",
      percentage: "75"
    }]
  }
}))
check(sab.paused === false, "sab not paused")
checkEqual(sab.queue.length, 1, "sab slots")
checkEqual(sab.queue[0].id, "SABnzbd_nzo_x", "sab id")
check(sab.speed > 0, "sab speed")

var sabHist = Model.parseSabHistory(JSON.stringify({
  history: {
    slots: [
      { nzo_id: "done1", name: "A", status: "Completed" },
      { nzo_id: "fail1", name: "B", status: "Failed" }
    ]
  }
}))
checkEqual(sabHist[0].status, "completed", "hist complete")
checkEqual(sabHist[1].status, "failed", "hist fail")

var torrents = Model.parseQbitTorrents(JSON.stringify([
  { hash: "aa", name: "ubuntu.iso", state: "downloading", progress: 0.4, dlspeed: 1024, upspeed: 0, eta: 90, size: 1000 }
]))
checkEqual(torrents[0].id, "aa", "qbit hash")
checkEqual(torrents[0].progress, 0.4, "qbit progress")
var xfer = Model.parseQbitTransfer('{"dl_info_speed":2048,"up_info_speed":10}')
checkEqual(xfer.speed, 2048, "qbit xfer")

checkEqual(Model.headerApiKey("secret"), "X-Api-Key: secret\n", "api header")
check(Model.sabBody("k", "queue").indexOf("apikey=k") !== -1, "sab body key")
check(Model.sabBody("k", "queue").indexOf("mode=queue") !== -1, "sab body mode")
check(Model.qbitLoginBody("admin", "p a").indexOf("username=admin") !== -1, "qbit login")

checkEqual(Model.qbitLoginUrl("http://q:8080"), "http://q:8080/api/v2/auth/login", "qbit login url")
checkEqual(Model.qbitTorrentsUrl("http://q:8080"), "http://q:8080/api/v2/torrents/info", "qbit torrents url")
checkEqual(Model.qbitPauseUrl("http://q:8080"), "http://q:8080/api/v2/torrents/pause", "qbit pause url")
checkEqual(Model.qbitResumeUrl("http://q:8080"), "http://q:8080/api/v2/torrents/resume", "qbit resume url")

var snap = Model.emptySnapshot({ id: "svc-1", kind: "sonarr", name: "Sonarr", url: "http://s:8989", group: "Media" })
checkEqual(snap.health, "unknown", "empty health")
var up = Model.applyHttpHealth(snap, 200)
checkEqual(up.health, "up", "http 200")
var down = Model.applyHttpHealth(snap, 0)
checkEqual(down.health, "down", "http fail")
var unauthorized = Model.applyHttpHealth(snap, 401)
checkEqual(unauthorized.statusText, "HTTP 401", "http 401 text")

check(Model.isHealthKind("arr-status"), "status is health")
check(Model.isHealthKind("sab-queue"), "sab queue is health")
check(Model.isHealthKind("generic"), "generic is health")
check(Model.isHealthKind("qbit-torrents"), "qbit torrents is health")
check(Model.isHealthKind("qbit-login"), "qbit login is health")
check(!Model.isHealthKind("arr-calendar"), "calendar is not health")
check(!Model.isHealthKind("arr-queue"), "queue is not health")
check(!Model.isHealthKind("arr-wanted"), "wanted is not health")
check(!Model.isHealthKind("sab-history"), "sab history is not health")
check(!Model.isHealthKind("poster"), "poster is not health")

var hold = Model.decideHealth("up", 0, 0)
checkEqual(hold.health, "up", "one timeout keeps up")
checkEqual(hold.misses, 1, "timeout counted")
checkEqual(hold.commit, false, "timeout does not rewrite")
var secondMiss = Model.decideHealth("up", 0, 1)
checkEqual(secondMiss.health, "down", "two timeouts mark down")
checkEqual(secondMiss.commit, true, "second timeout commits")
var authDown = Model.decideHealth("up", 401, 0)
checkEqual(authDown.health, "down", "401 marks down now")
checkEqual(authDown.commit, true, "401 commits")
var recovered = Model.decideHealth("down", 200, 4)
checkEqual(recovered.health, "up", "200 recovers")
checkEqual(recovered.misses, 0, "success clears misses")
checkEqual(recovered.commit, true, "recovery commits")
var unknownFail = Model.decideHealth("unknown", 0, 0)
checkEqual(unknownFail.health, "down", "first fail from unknown is down")

var sonarrSnap = Model.emptySnapshot({ id: "s", kind: "sonarr", name: "Sonarr", url: "http://s:8989", group: "Media" })
sonarrSnap.health = "up"
sonarrSnap.queue = queue
sonarrSnap.calendar = cal
var radarrSnap = Model.emptySnapshot({ id: "r", kind: "radarr", name: "Radarr", url: "http://r:7878", group: "Media" })
radarrSnap.health = "down"
radarrSnap.statusText = "Unreachable"
var sabSnap = Model.emptySnapshot({ id: "z", kind: "sabnzbd", name: "SABnzbd", url: "http://z:8080", group: "Downloads" })
sabSnap.health = "up"
sabSnap.queue = sab.queue
sabSnap.speed = sab.speed
var now = Model.mergeNow([sonarrSnap, radarrSnap, sabSnap], { showCalendar: true, showQueue: true })
check(now.downloads.length >= 2, "merged downloads")
check(now.calendar.length >= 1, "merged calendar")
check(now.warnings.length === 1, "warning for down")
check(now.downloadingCount >= 1, "download count")
checkEqual(now.downCount, 1, "down count")

check(Model.fleetLine(radarrSnap).indexOf("down") !== -1, "fleet down")
check(Model.fleetLine(sabSnap).length > 0, "fleet sab")

var badge = Model.barBadge([sonarrSnap, radarrSnap, sabSnap])
check(badge.urgent === true, "badge urgent when down")
check(badge.count >= 1, "badge count")
check(Model.barStatusText([sonarrSnap, radarrSnap]).indexOf("Radarr") !== -1, "bar status names down")

var prev = Model.emptySnapshot({ id: "s", kind: "sonarr", name: "Sonarr", url: "http://s", group: "Media" })
prev.health = "up"
prev.queue = []
var next = Model.emptySnapshot({ id: "s", kind: "sonarr", name: "Sonarr", url: "http://s", group: "Media" })
next.health = "up"
next.queue = queue
var svc = { id: "s", kind: "sonarr", notifyGrab: true, notifyHealth: true, notifyDownload: true, notifyImport: true }
var events = Model.eventsFromPoll(prev, next, svc)
check(events.some(function(e) { return e.type === "grabbed" }), "grabbed event")

var downPrev = Model.emptySnapshot({ id: "s", kind: "sonarr", name: "Sonarr", url: "http://s", group: "Media" })
downPrev.health = "up"
var downNext = Model.emptySnapshot({ id: "s", kind: "sonarr", name: "Sonarr", url: "http://s", group: "Media" })
downNext.health = "down"
var healthEvents = Model.eventsFromPoll(downPrev, downNext, svc)
check(healthEvents.some(function(e) { return e.type === "service-down" }), "service down event")

var recovered = Model.eventsFromPoll(downNext, downPrev, svc)
check(recovered.some(function(e) { return e.type === "service-up" }), "service up event")

var grab = events.filter(function(e) { return e.type === "grabbed" })[0]
check(Model.shouldNotify(grab, svc, []) === true, "notify new grab")
check(Model.shouldNotify(grab, svc, [grab.id]) === false, "skip seen")
check(Model.shouldNotify(grab, { notifyGrab: false }, []) === false, "flag off")
check(Model.toastTitle(grab).length > 0, "toast title")
check(Model.toastBody(grab).length > 0, "toast body")
check(Model.toastGlyph(grab).length > 0, "toast glyph")

var sabPrev = Model.emptySnapshot({ id: "z", kind: "sabnzbd", name: "SABnzbd", url: "http://z", group: "Downloads" })
sabPrev.health = "up"
sabPrev.activity = []
var sabNext = Model.emptySnapshot({ id: "z", kind: "sabnzbd", name: "SABnzbd", url: "http://z", group: "Downloads" })
sabNext.health = "up"
sabNext.activity = sabHist
var sabEvents = Model.eventsFromPoll(sabPrev, sabNext, { id: "z", kind: "sabnzbd", notifyDownload: true })
check(sabEvents.some(function(e) { return e.type === "download-finished" }), "sab finished")
check(sabEvents.some(function(e) { return e.type === "download-failed" }), "sab failed")

check(Model.scanTargets().length >= 8, "scan list")
checkEqual(Model.scanUrl("127.0.0.1", 8989), "http://127.0.0.1:8989", "scan url")
checkEqual(Model.kindFromPort(8989), "sonarr", "port sonarr")
checkEqual(Model.kindFromPort(7878), "radarr", "port radarr")
checkEqual(Model.kindFromPort(8080), "generic", "port 8080 ambiguous")
checkEqual(Model.kindFromPort(8096), "generic", "jellyfin generic")
checkEqual(Model.defaultUrlForKind("sonarr"), "http://127.0.0.1:8989", "default sonarr url")

var actions = Model.pauseAllActions([sabSnap, sonarrSnap])
check(actions.some(function(a) { return a.kind === "sabnzbd" }), "pause sab")
check(!actions.some(function(a) { return a.kind === "sonarr" }), "arr not a downloader pause")

checkEqual(Model.formatSpeed(1536), "1.5 KB/s", "speed")
checkEqual(Model.formatBytes(1048576), "1.0 MB", "bytes")
check(Model.formatEta(90).indexOf("m") !== -1 || Model.formatEta(90).indexOf("s") !== -1, "eta")
checkEqual(Model.kindLabel("qbittorrent"), "qBittorrent", "kind label")

checkEqual(Model.posterCachePath("/tmp/omarr", "svc-1", "12"), "/tmp/omarr/svc-1-12.jpg", "poster path")

if (fails) {
  console.error(fails + " failed")
  process.exit(1)
}
console.log("Model.test.js ok")
