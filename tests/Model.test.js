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
checkEqual(empty.pageSize, 20, "default page size")
checkEqual(empty.density, "comfortable", "default density")
check(empty.showCalendar === undefined && empty.showQueue === undefined, "no global panes")

var fromBar = Model.pluginSettings({
  bar: {
    layout: {
      right: [{
        id: Model.PLUGIN_ID,
        pollSeconds: 15,
        pageSize: 10,
        density: "compact",
        showCalendar: false,
        showArrQueue: true,
        showQueue: false,
        services: [
          { kind: "sonarr", url: "http://127.0.0.1:8989/", name: "TV" },
          { kind: "sabnzbd", url: "http://127.0.0.1:8080/", name: "SABnzbd" }
        ]
      }]
    }
  }
})
checkEqual(fromBar.pollSeconds, 15, "poll from shell.json")
checkEqual(fromBar.pageSize, 10, "page size from shell.json")
checkEqual(fromBar.density, "compact", "density from shell.json")
checkEqual(fromBar.services.length, 2, "two services")
checkEqual(fromBar.services[0].kind, "sonarr", "kind")
checkEqual(fromBar.services[0].url, "http://127.0.0.1:8989", "url stripped")
checkEqual(fromBar.services[0].group, "Media", "default group")
check(fromBar.services[0].notifyGrab === true, "notify grab default")
check(fromBar.services[0].showQueue === true, "legacy showArrQueue migrates")
check(fromBar.services[0].showCalendar === false, "legacy showCalendar migrates")
check(fromBar.services[1].showQueue === false, "legacy showQueue off migrates to sab")
check(fromBar.services[1].showCalendar === false, "sab has no calendar")
check(Model.normalizeService({ kind: "sonarr" }).showQueue === false, "sonarr queue off")
check(Model.normalizeService({ kind: "sonarr" }).showCalendar === true, "sonarr calendar on")
check(Model.normalizeService({ kind: "sabnzbd" }).showQueue === true, "sab queue on")
check(Model.normalizeService({ kind: "sonarr", showQueue: true }).showQueue === true, "sonarr queue opt in")
check(!("showQueue" in Model.settingsPayload({})), "payload drops global queue")
check(!("showCalendar" in Model.settingsPayload({})), "payload drops global calendar")
check(!("showArrQueue" in Model.settingsPayload({})), "payload drops global arr queue")

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
check(s1.services[0].showQueue === false, "add sonarr queue off")
check(s1.services[0].showCalendar === true, "add sonarr calendar on")
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

check(Model.kindNeedsApiKey("sonarr") && Model.kindNeedsApiKey("radarr") && Model.kindNeedsApiKey("sabnzbd") && Model.kindNeedsApiKey("plex"), "arr/sab/plex need api key")
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
checkEqual(Model.LIST_PAGE_SIZE, 20, "page size")
checkEqual(Model.clampPageSize(10), 10, "page size ok")
checkEqual(Model.clampPageSize(1), 5, "page size min")
checkEqual(Model.clampPageSize(999), 50, "page size max")
checkEqual(Model.clampPageSize("nope"), 20, "page size fallback")
checkEqual(Model.normalizeSettings({ pageSize: 40 }).pageSize, 40, "normalize page size")
checkEqual(Model.listOffset(2, 10), 10, "offset custom size")
checkEqual(Model.arrQueueUrl("http://s:8989", 2, 10), "http://s:8989/api/v3/queue?page=2&pageSize=10", "arr custom page size")
check(Model.qbitTorrentsUrl("http://q:8080", 2, 10).indexOf("limit=10") !== -1, "qbit custom limit")
check(Model.qbitTorrentsUrl("http://q:8080", 2, 10).indexOf("offset=10") !== -1, "qbit custom offset")
check(Model.sabBody("k", "queue", null, 10).indexOf("limit=10") !== -1, "sab custom limit")
checkEqual(Model.listPager(1, 10, 25, 10).label, "1-10 of 25", "pager custom label")
checkEqual(Model.listPager(2, 10, 0, 10).hasNext, true, "pager custom full page")
checkEqual(Model.listPage(0), 1, "page min")
checkEqual(Model.listPage(-2), 1, "page negative")
checkEqual(Model.listPage(3), 3, "page 3")
checkEqual(Model.listOffset(1), 0, "offset page 1")
checkEqual(Model.listOffset(2), 20, "offset page 2")
checkEqual(Model.arrQueueUrl("http://s:8989"), "http://s:8989/api/v3/queue?page=1&pageSize=20", "queue url")
checkEqual(Model.arrQueueUrl("http://s:8989", 2), "http://s:8989/api/v3/queue?page=2&pageSize=20", "queue page 2")
checkEqual(Model.arrTotalRecords('{"totalRecords":247,"records":[]}'), 247, "arr total")
checkEqual(Model.arrTotalRecords("nope"), 0, "arr total junk")
var pager = Model.listPager(1, 20, 247)
checkEqual(pager.hasNext, true, "pager next")
checkEqual(pager.hasPrev, false, "pager prev")
checkEqual(pager.label, "1-20 of 247", "pager label")
var pageTwo = Model.listPager(2, 20, 0)
checkEqual(pageTwo.hasPrev, true, "unknown total prev")
checkEqual(pageTwo.hasNext, true, "full page implies more")
checkEqual(pageTwo.label, "21-40", "pager label no total")
var lastPage = Model.listPager(2, 5, 0)
checkEqual(lastPage.hasNext, false, "short page is last")
checkEqual(Model.listPager(1, 3, 3).hasNext, false, "exact total no next")
check(Model.arrCalendarUrl("http://s:8989", "2026-08-26", "2026-09-02").indexOf("start=2026-08-26") !== -1, "cal url")
check(Model.arrCalendarUrl("http://s:8989", "2026-08-26", "2026-09-02").indexOf("includeSeries=true") !== -1, "cal include series")
check(Model.arrWantedUrl("http://s:8989", "sonarr").indexOf("includeSeries=true") !== -1, "wanted include series")
check(Model.arrHistoryUrl("http://s:8989", "sonarr").indexOf("/api/v3/history?") !== -1, "arr history url")
check(Model.arrHistoryUrl("http://s:8989", "sonarr").indexOf("includeSeries=true") !== -1, "arr history series")
check(Model.arrHistoryUrl("http://r:7878", "radarr").indexOf("includeMovie=true") !== -1, "arr history movie")
checkEqual(Model.arrPosterUrl("http://s:8989", "sonarr", 12), "http://s:8989/api/v3/mediacover/12/poster-500.jpg", "poster url")
checkEqual(Model.arrFanartUrl("http://s:8989", 12), "http://s:8989/api/v3/mediacover/12/fanart.jpg", "fanart url")
checkEqual(Model.formatRating(8.4, "imdb"), "IMDb 8.4", "imdb rating label")
checkEqual(Model.formatRating(8.5, ""), "8.5", "generic rating")
checkEqual(Model.formatRating(0, "imdb"), "", "empty rating")

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
checkEqual(queue[0].protocol, "torrent", "arr queue protocol")
checkEqual(queue[0].timeleft, "00:10:00", "arr queue eta")
checkEqual(queue[0].status, "downloading", "arr queue status")
var warned = Model.parseArrQueue(JSON.stringify({
  records: [{ id: 2, title: "X", status: "downloading", trackedDownloadStatus: "warning", protocol: "usenet", timeleft: "00:05:00", size: 10, sizeleft: 5 }]
}), "sonarr")
checkEqual(warned[0].status, "warning", "arr queue warning status")
check(Model.isActiveDownload(warned[0]), "warning still downloading")
checkEqual(Model.queueLine(warned[0]), "warning · usenet · 5m", "queue line warning")
checkEqual(Model.queueLine(queue[0]), "downloading · torrent · 10m", "queue line eta")
checkEqual(Model.formatTimeLeft("00:10:00"), "10m", "format timeleft")
checkEqual(Model.formatTimeLeft("01:05:00"), "1h 5m", "format timeleft hours")
checkEqual(Model.formatTimeLeft("00:00:00"), "", "format timeleft zero")

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
checkEqual(cal[0].rating, 0, "cal no rating")

var calRated = Model.parseArrCalendar(JSON.stringify([
  {
    id: 40,
    airDate: "2026-08-26",
    seasonNumber: 1,
    episodeNumber: 1,
    title: "Pilot",
    series: { title: "Show", id: 3, ratings: { votes: 10, value: 8.5 } }
  }
]), "sonarr")
checkEqual(calRated[0].rating, 8.5, "sonarr series rating")
checkEqual(calRated[0].ratingSource, "", "sonarr rating is not imdb")

var calFlat = Model.parseArrCalendar(JSON.stringify([
  {
    id: 5,
    airDate: "2026-08-27",
    title: "The Episode",
    seasonNumber: 2,
    episodeNumber: 3,
    seriesTitle: "The Show",
    seriesId: 9
  }
]), "sonarr")
checkEqual(calFlat[0].title, "The Show", "cal seriesTitle fallback")
checkEqual(calFlat[0].subtitle, "S02E03 The Episode", "cal episode stays subtitle")
checkEqual(calFlat[0].posterId, "9", "cal seriesId poster")

var calBare = Model.parseArrCalendar(JSON.stringify([
  { id: 6, title: "Naked Episode", seasonNumber: 1, episodeNumber: 1 }
]), "sonarr")
checkEqual(calBare[0].title, "", "cal no series not episode title")
check(calBare[0].subtitle.indexOf("Naked Episode") !== -1, "cal episode in subtitle")

checkEqual(Model.calendarDayKey("2026-08-26"), "2026-08-26", "day key date")
checkEqual(Model.calendarDayKey("2026-08-26T02:00:00Z"), "2026-08-26", "day key iso")
checkEqual(Model.calendarDayKey(""), "", "day key empty")
var wed = new Date(2026, 7, 26)
checkEqual(Model.calendarDayLabel("2026-08-26", wed), "Today", "label today")
checkEqual(Model.calendarDayLabel("2026-08-27", wed), "Tomorrow", "label tomorrow")
checkEqual(Model.calendarDayLabel("2026-08-28", wed), "Friday", "label friday")
checkEqual(Model.calendarDayLabel("2026-09-02", wed), "Next Wednesday", "label next week")
checkEqual(Model.calendarDateMeta("2026-08-26"), "26-08-26", "date meta")
checkEqual(Model.calendarDateMeta("2026-08-26T18:00:00Z"), "26-08-26", "date meta iso")
var groupedCal = Model.groupedCalendar([
  { id: "1", title: "B", airDate: "2026-08-27" },
  { id: "2", title: "A", airDate: "2026-08-26" },
  { id: "3", title: "C", airDate: "2026-08-26T18:00:00Z" }
], wed)
checkEqual(groupedCal.length, 2, "grouped two days")
checkEqual(groupedCal[0].day, "Today", "grouped today first")
checkEqual(groupedCal[0].heading, "Today · 26-08-26", "grouped heading has date")
checkEqual(groupedCal[1].heading, "Tomorrow · 27-08-26", "grouped tomorrow heading")
checkEqual(groupedCal[0].items.length, 2, "grouped two on today")
checkEqual(groupedCal[1].day, "Tomorrow", "grouped tomorrow")

var mixedDates = Model.groupedCalendar([
  { id: "hq-1", title: "HQ Friday", airDate: new Date(2026, 7, 28) },
  { id: "lq-1", title: "LQ Today", airDate: "2026-08-26" },
  { id: "hq-2", title: "HQ Tomorrow", airDate: "2026-08-27T06:00:00Z" }
], wed)
checkEqual(mixedDates.map(function(g) { return g.day }).join(","), "Today,Tomorrow,Friday", "mixed services regroup by day")

var lqSnap = Model.emptySnapshot({ id: "lq", kind: "sonarr", name: "Sonarr LQ", showCalendar: true })
lqSnap.health = "up"
lqSnap.calendar = [
  { id: "1", title: "LQ Friday", airDate: "2026-08-28" },
  { id: "2", title: "LQ Today", airDate: "2026-08-26" }
]
var hqSnap = Model.emptySnapshot({ id: "hq", kind: "sonarr", name: "Sonarr HQ", showCalendar: true })
hqSnap.health = "up"
hqSnap.calendar = [
  { id: "3", title: "HQ Tomorrow", airDate: "2026-08-27T00:00:00Z" }
]
var mergedCal = Model.mergeNow([lqSnap, hqSnap])
var mergedGroups = Model.groupedCalendar(mergedCal.calendar, wed)
checkEqual(mergedGroups.map(function(g) { return g.day }).join(","), "Today,Tomorrow,Friday", "merged now calendar by day")

lqSnap.calendar[1].rating = 8.5
lqSnap.calendar[1].ratingSource = ""
var mergedRated = Model.mergeNow([lqSnap])
var todayItems = mergedRated.calendar.filter(function(ev) { return ev.title === "LQ Today" })
checkEqual(todayItems[0].rating, 8.5, "merged rating")

var movies = Model.parseArrCalendar(JSON.stringify([
  { id: 8, title: "Film", year: 2024, inCinemas: "2026-08-27", hasFile: false, monitored: true }
]), "radarr")
checkEqual(movies[0].title, "Film", "radarr cal")
checkEqual(movies[0].subtitle, "2024", "radarr year")

var movieRated = Model.parseArrCalendar(JSON.stringify([
  {
    id: 9,
    title: "Rated Film",
    year: 2025,
    inCinemas: "2026-08-27",
    ratings: { imdb: { votes: 100, value: 7.3 }, tmdb: { value: 6.1 } }
  }
]), "radarr")
checkEqual(movieRated[0].rating, 7.3, "radarr imdb rating")
checkEqual(movieRated[0].ratingSource, "imdb", "radarr rating source")

var wanted = Model.parseArrWanted(JSON.stringify({
  records: [{ id: 1, title: "Pilot", seasonNumber: 1, episodeNumber: 1, series: { title: "Show", id: 3 } }]
}), "sonarr")
checkEqual(wanted[0].title, "Show", "wanted series")

var wantedFlat = Model.parseArrWanted(JSON.stringify({
  records: [{ id: 2, title: "Pilot", seasonNumber: 1, episodeNumber: 1, seriesTitle: "Flat Show", seriesId: 8 }]
}), "sonarr")
checkEqual(wantedFlat[0].title, "Flat Show", "wanted seriesTitle fallback")
checkEqual(wantedFlat[0].posterId, "8", "wanted seriesId poster")

var arrHist = Model.parseArrHistory(JSON.stringify({
  records: [
    { id: 11, eventType: "grabbed", sourceTitle: "Show.S01E01", series: { title: "Show" }, episode: { seasonNumber: 1, episodeNumber: 1, title: "Pilot" } },
    { id: 12, eventType: "downloadFolderImported", sourceTitle: "Show.S01E01", series: { title: "Show" }, episode: { seasonNumber: 1, episodeNumber: 1, title: "Pilot" } },
    { id: 13, eventType: "downloadFailed", sourceTitle: "Show.S01E02", series: { title: "Show" } },
    { id: 14, eventType: "rssSync" }
  ]
}), "sonarr")
checkEqual(arrHist.length, 3, "arr history skips rss")
checkEqual(arrHist[0].status, "grabbed", "arr hist grab")
checkEqual(arrHist[1].status, "imported", "arr hist import")
checkEqual(arrHist[2].status, "failed", "arr hist fail")
checkEqual(arrHist[0].title, "Show", "arr hist series title")

var radHist = Model.parseArrHistory(JSON.stringify({
  records: [{ id: 21, eventType: "downloadFolderImported", sourceTitle: "Film.mkv", movie: { title: "Film" } }]
}), "radarr")
checkEqual(radHist[0].title, "Film", "radarr hist movie")
checkEqual(radHist[0].status, "imported", "radarr hist import")

var sab = Model.parseSabQueue(JSON.stringify({
  queue: {
    paused: false,
    speed: "1.5 M",
    speedlimit: "",
    mbleft: "100",
    timeleft: "0:12:00",
    kbpersec: 1536,
    noofslots: 40,
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
checkEqual(sab.total, 40, "sab total")
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
check(Model.sabBody("k", "queue").indexOf("limit=20") !== -1, "sab queue limit")
check(Model.sabBody("k", "queue").indexOf("start=0") !== -1, "sab queue start")
check(Model.sabBody("k", "queue", { start: "20" }).indexOf("start=20") !== -1, "sab queue page 2")
check(Model.qbitLoginBody("admin", "p a").indexOf("username=admin") !== -1, "qbit login")

checkEqual(Model.qbitLoginUrl("http://q:8080"), "http://q:8080/api/v2/auth/login", "qbit login url")
check(Model.qbitTorrentsUrl("http://q:8080").indexOf("/api/v2/torrents/info?") !== -1, "qbit torrents url")
check(Model.qbitTorrentsUrl("http://q:8080").indexOf("limit=20") !== -1, "qbit limit")
check(Model.qbitTorrentsUrl("http://q:8080").indexOf("offset=0") !== -1, "qbit offset 0")
check(Model.qbitTorrentsUrl("http://q:8080", 2).indexOf("offset=20") !== -1, "qbit page 2")
var manyTorrents = []
for (var ti = 0; ti < 25; ti++) {
  manyTorrents.push({ hash: "h" + ti, name: "t" + ti, state: "pausedUP", progress: 1, dlspeed: 0, upspeed: 0, eta: 0, size: 1 })
}
checkEqual(Model.parseQbitTorrents(JSON.stringify(manyTorrents)).length, 20, "qbit parse cap")
checkEqual(Model.parseQbitTorrents(JSON.stringify(manyTorrents), 10).length, 10, "qbit parse custom cap")
checkEqual(Model.qbitPauseUrl("http://q:8080"), "http://q:8080/api/v2/torrents/pause", "qbit pause url")
checkEqual(Model.qbitResumeUrl("http://q:8080"), "http://q:8080/api/v2/torrents/resume", "qbit resume url")

checkEqual(Model.plexIdentityUrl("http://p:32400"), "http://p:32400/identity", "plex identity url")
checkEqual(Model.plexSessionsUrl("http://p:32400"), "http://p:32400/status/sessions", "plex sessions url")
checkEqual(Model.plexOnDeckUrl("http://p:32400"), "http://p:32400/library/onDeck", "plex ondeck url")
check(Model.plexRecentlyAddedUrl("http://p:32400").indexOf("/library/recentlyAdded") !== -1, "plex recent url")
check(Model.plexRecentlyAddedUrl("http://p:32400", 10).indexOf("X-Plex-Container-Size=10") !== -1, "plex recent size")
check(Model.headerPlex("tok").indexOf("X-Plex-Token: tok\n") !== -1, "plex token header")
check(Model.headerPlex("tok").indexOf("Accept: application/json") !== -1, "plex json accept")
check(Model.headerIsConfig(Model.headerPlex("tok")), "plex headers need curl config")
check(!Model.headerIsConfig(Model.headerApiKey("k")), "api key is one header")
check(Model.curlHeaderConfig(Model.headerPlex("tok")).indexOf("header = \"X-Plex-Token: tok\"") !== -1, "curl config token")
checkEqual(Model.plexArtUrl("http://p:32400", "/library/metadata/1/thumb/2"), "http://p:32400/library/metadata/1/thumb/2?width=720&height=405&minSize=1", "plex relative art")
checkEqual(Model.plexArtUrl("http://p:32400", "https://plex.tv/photo.jpg"), "", "plex skips remote art")
checkEqual(Model.plexCachePath("/tmp/omarr", "svc-1", "99"), "/tmp/omarr/svc-1-99-plex-hd.jpg", "plex cache path")

var plexIdent = Model.parsePlexIdentity(JSON.stringify({ MediaContainer: { version: "1.41.2", machineIdentifier: "abc" } }))
checkEqual(plexIdent.version, "1.41.2", "plex version")
check(plexIdent.healthy === true, "plex identity ok")

var plexRecent = Model.parsePlexLibrary(JSON.stringify({
  MediaContainer: {
    Metadata: [
      {
        ratingKey: "11",
        type: "episode",
        title: "Pilot",
        grandparentTitle: "Show",
        parentIndex: 1,
        index: 1,
        thumb: "/library/metadata/11/thumb/1",
        art: "/library/metadata/9/art/1",
        audienceRating: 8.2
      },
      { ratingKey: "12", type: "movie", title: "Film", year: 2024, thumb: "/library/metadata/12/thumb/1" }
    ]
  }
}))
checkEqual(plexRecent.length, 2, "plex recent len")
checkEqual(plexRecent[0].title, "Show", "plex episode uses show title")
checkEqual(plexRecent[0].subtitle.indexOf("S01E01") !== -1, true, "plex episode code")
checkEqual(plexRecent[0].artPath, "/library/metadata/9/art/1", "plex prefers art")
checkEqual(plexRecent[0].rating, 8.2, "plex audience rating")
checkEqual(plexRecent[1].title, "Film", "plex movie title")
checkEqual(plexRecent[1].subtitle, "2024", "plex movie year")

var plexDeck = Model.parsePlexLibrary(JSON.stringify({
  MediaContainer: {
    Metadata: [{
      ratingKey: "21",
      type: "episode",
      title: "Next",
      grandparentTitle: "Show",
      parentIndex: 2,
      index: 4,
      viewOffset: 600000,
      duration: 2400000,
      thumb: "/library/metadata/21/thumb/1"
    }]
  }
}))
checkEqual(plexDeck[0].progress, 0.25, "plex ondeck progress")
check(plexDeck[0].subtitle.indexOf("%") === -1, "plex ondeck has no percent text")
check(plexDeck[0].watched !== true, "plex ondeck in progress is not watched")

var plexWatched = Model.parsePlexLibrary(JSON.stringify({
  MediaContainer: {
    Metadata: [{
      ratingKey: "22",
      type: "movie",
      title: "Done",
      year: 2020,
      viewCount: 1,
      duration: 1000
    }]
  }
}))
check(plexWatched[0].watched === true, "plex viewCount is watched")
checkEqual(plexWatched[0].progress, 0, "plex watched has no leftover progress")

var plexDone = Model.parsePlexLibrary(JSON.stringify({
  MediaContainer: {
    Metadata: [{
      ratingKey: "23",
      type: "movie",
      title: "Finished",
      viewOffset: 400,
      duration: 400
    }]
  }
}))
checkEqual(plexDone[0].progress, 1, "plex complete progress")
check(plexDone[0].watched === true, "plex complete is watched")
check(plexDone[0].subtitle.indexOf("%") === -1, "plex complete has no percent text")

var plexNow = Model.parsePlexSessions(JSON.stringify({
  MediaContainer: {
    Metadata: [{
      ratingKey: "31",
      type: "movie",
      title: "Film",
      viewOffset: 100,
      duration: 400,
      User: { title: "del" },
      Player: { title: "TV", state: "playing" }
    }]
  }
}))
checkEqual(plexNow.length, 1, "plex session")
checkEqual(plexNow[0].title, "Film", "plex watching title")
check(plexNow[0].subtitle.indexOf("del") !== -1, "plex watching user")
checkEqual(plexNow[0].progress, 0.25, "plex session progress")
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
check(Model.isHealthKind("plex-identity"), "plex identity is health")
check(!Model.isHealthKind("plex-ondeck"), "plex ondeck is not health")
check(!Model.isHealthKind("plex-recent"), "plex recent is not health")
check(!Model.isHealthKind("plex-sessions"), "plex sessions is not health")
check(!Model.isHealthKind("arr-calendar"), "calendar is not health")
check(!Model.isHealthKind("arr-queue"), "queue is not health")
check(!Model.isHealthKind("arr-wanted"), "wanted is not health")
check(!Model.isHealthKind("arr-history"), "history is not health")
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
sonarrSnap.showCalendar = true
var radarrSnap = Model.emptySnapshot({ id: "r", kind: "radarr", name: "Radarr", url: "http://r:7878", group: "Media" })
radarrSnap.health = "down"
radarrSnap.statusText = "Unreachable"
var sabSnap = Model.emptySnapshot({ id: "z", kind: "sabnzbd", name: "SABnzbd", url: "http://z:8080", group: "Downloads" })
sabSnap.health = "up"
sabSnap.queue = sab.queue
sabSnap.speed = sab.speed
sabSnap.showQueue = true
var nowClients = Model.mergeNow([sonarrSnap, radarrSnap, sabSnap])
checkEqual(nowClients.downloads.length, 1, "arr queue hidden by default")
checkEqual(nowClients.downloads[0].kind, "sabnzbd", "download clients only")
check(nowClients.showQueue === true, "queue pane from sab")
check(nowClients.showCalendar === true, "calendar pane from sonarr")
sonarrSnap.showQueue = true
var now = Model.mergeNow([sonarrSnap, radarrSnap, sabSnap])
check(now.downloads.length >= 2, "merged downloads")
checkEqual(now.downloads[0].protocol, "torrent", "merged protocol")
check(now.calendar.length >= 1, "merged calendar")
check(now.warnings.length === 1, "warning for down")
check(now.downloadingCount >= 1, "download count")
checkEqual(now.downCount, 1, "down count")

check(Model.fleetLine(radarrSnap).indexOf("down") !== -1, "fleet down")
check(Model.fleetLine(sabSnap).length > 0, "fleet sab")

var plexSnap = Model.emptySnapshot({ id: "p", kind: "plex", name: "Plex" })
plexSnap.health = "up"
plexSnap.sessions = plexNow
plexSnap.onDeck = plexDeck
plexSnap.recent = plexRecent
check(Model.fleetLine(plexSnap).indexOf("Watching") !== -1, "fleet watching")
var plexIdle = Model.emptySnapshot({ id: "p", kind: "plex", name: "Plex" })
plexIdle.health = "up"
plexIdle.onDeck = plexDeck
check(Model.fleetLine(plexIdle).indexOf("on deck") !== -1, "fleet on deck")
var plexNowFeed = Model.mergeNow([plexSnap])
checkEqual(plexNowFeed.sessions.length, 1, "merged sessions")
check(plexNowFeed.onDeck.length >= 1, "merged ondeck")
check(plexNowFeed.recent.length >= 2, "merged recent")

var plexPrev = Model.emptySnapshot({ id: "p", kind: "plex", name: "Plex" })
plexPrev.health = "up"
plexPrev.recent = []
var plexNext = Model.emptySnapshot({ id: "p", kind: "plex", name: "Plex" })
plexNext.health = "up"
plexNext.recent = plexRecent
var plexEvents = Model.eventsFromPoll(plexPrev, plexNext, { id: "p", kind: "plex", notifyGrab: true })
check(plexEvents.some(function(e) { return e.type === "library-added" }), "plex added event")
var added = plexEvents.filter(function(e) { return e.type === "library-added" })[0]
check(Model.shouldNotify(added, { notifyGrab: true }, []) === true, "notify plex added")
check(Model.shouldNotify(added, { notifyGrab: false }, []) === false, "plex added flag off")
check(Model.toastTitle(added).indexOf("added") !== -1, "plex added toast")

var badge = Model.barBadge([sonarrSnap, radarrSnap, sabSnap])
check(badge.urgent === true, "badge urgent when down")
check(badge.count >= 1, "badge count")
sonarrSnap.showQueue = false
checkEqual(Model.barBadge([sonarrSnap]).count, 0, "arr queue not in badge by default")
sonarrSnap.showQueue = true
check(Model.barBadge([sonarrSnap]).count >= 1, "arr queue in badge when on")
check(Model.barStatusText([sonarrSnap, radarrSnap]).indexOf("Radarr") !== -1, "bar status names down")
sonarrSnap.showQueue = false
check(Model.barStatusText([sonarrSnap]).indexOf("downloading") === -1, "bar status skips arr queue")
sonarrSnap.showQueue = true
check(Model.barStatusText([sonarrSnap]).indexOf("downloading") !== -1, "bar status counts arr queue")
sonarrSnap.showQueue = false

var prev = Model.emptySnapshot({ id: "s", kind: "sonarr", name: "Sonarr", url: "http://s", group: "Media" })
prev.health = "up"
prev.activity = []
var next = Model.emptySnapshot({ id: "s", kind: "sonarr", name: "Sonarr", url: "http://s", group: "Media" })
next.health = "up"
next.activity = arrHist
var svc = { id: "s", kind: "sonarr", notifyGrab: true, notifyHealth: true, notifyDownload: true, notifyImport: true }
var events = Model.eventsFromPoll(prev, next, svc)
check(events.some(function(e) { return e.type === "grabbed" }), "grabbed event")
check(events.some(function(e) { return e.type === "import" }), "import event")
check(events.some(function(e) { return e.type === "download-failed" }), "arr failed event")
var queueOnly = Model.emptySnapshot({ id: "s", kind: "sonarr", name: "Sonarr" })
queueOnly.health = "up"
queueOnly.queue = queue
check(!Model.eventsFromPoll(prev, queueOnly, svc).some(function(e) { return e.type === "grabbed" }), "queue does not fake grab")

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
var imported = events.filter(function(e) { return e.type === "import" })[0]
check(Model.shouldNotify(imported, svc, []) === true, "notify import")
check(Model.shouldNotify(imported, { notifyImport: false }, []) === false, "import flag off")
check(Model.toastTitle(imported).indexOf("imported") !== -1, "import toast title")
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
checkEqual(Model.kindFromPort(32400), "plex", "port plex")
checkEqual(Model.defaultUrlForKind("plex"), "http://127.0.0.1:32400", "default plex url")
checkEqual(Model.kindLabel("plex"), "Plex", "plex label")
checkEqual(Model.iconSlug({ kind: "plex", name: "Living Room" }), "plex", "plex kind icon")

var actions = Model.pauseAllActions([sabSnap, sonarrSnap])
check(actions.some(function(a) { return a.kind === "sabnzbd" }), "pause sab")
check(!actions.some(function(a) { return a.kind === "sonarr" }), "arr not a downloader pause")

checkEqual(Model.formatSpeed(1536), "1.5 KB/s", "speed")
checkEqual(Model.formatBytes(1048576), "1.0 MB", "bytes")
check(Model.formatEta(90).indexOf("m") !== -1 || Model.formatEta(90).indexOf("s") !== -1, "eta")
checkEqual(Model.kindLabel("qbittorrent"), "qBittorrent", "kind label")

checkEqual(Model.iconSlug({ kind: "radarr" }), "radarr", "radarr kind icon")
checkEqual(Model.iconSlug({ kind: "sonarr", name: "Sonarr LQ" }), "sonarr", "sonarr kind wins")
checkEqual(Model.iconSlug({ kind: "sabnzbd" }), "sabnzbd", "sab icon")
checkEqual(Model.iconSlug({ kind: "qbittorrent" }), "qbittorrent", "qbit icon")
checkEqual(Model.iconSlug({ kind: "generic", name: "Jellyfin" }), "jellyfin", "jellyfin by name")
checkEqual(Model.iconSlug({ kind: "generic", name: "Home Assistant" }), "home-assistant", "ha by name")
checkEqual(Model.iconSlug({ kind: "generic", name: "Plex" }), "plex", "plex by name")
checkEqual(Model.iconSlug({ kind: "generic", name: "Prowlarr" }), "prowlarr", "prowlarr by name")
checkEqual(Model.iconSlug({ kind: "generic", name: "Mystery Box" }), "", "unknown has no icon")
checkEqual(Model.iconSlug({ kind: "generic", name: "Transmission" }), "transmission", "transmission by name")
checkEqual(Model.iconSlug({ kind: "generic", name: "Lidarr" }), "lidarr", "lidarr by name")
checkEqual(Model.iconPageUrl("radarr"), "https://dashboardicons.com/icons/radarr", "icon page")
checkEqual(Model.iconPageUrl(""), "", "empty icon page")
checkEqual(Model.iconCdnUrl("radarr"), "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/radarr.svg", "icon cdn")
check(Model.iconSlugs().indexOf("sonarr") !== -1, "bundled sonarr")
check(Model.iconSlugs().indexOf("radarr") !== -1, "bundled radarr")

var fs = require("fs")
var path = require("path")
var slugs = Model.iconSlugs()
check(slugs.length >= 30, "bundled icon count")
for (var i = 0; i < slugs.length; i++) {
  check(fs.existsSync(path.join(__dirname, "..", "icons", slugs[i] + ".svg")), "svg " + slugs[i])
}

checkEqual(Model.posterCachePath("/tmp/omarr", "svc-1", "12"), "/tmp/omarr/svc-1-12-poster-hd.jpg", "poster path")
checkEqual(Model.fanartCachePath("/tmp/omarr", "svc-1", "12"), "/tmp/omarr/svc-1-12-fanart-hd.jpg", "fanart path")

var keep = [{ id: "a", title: "Old", progress: 0.2 }]
var newer = [{ id: "a", title: "New", progress: 0.8 }]
var reused = Model.reuseFeedList(keep, newer)
check(reused === keep, "reuse same ids")
checkEqual(keep[0].title, "New", "reuse patches fields")
checkEqual(keep[0].progress, 0.8, "reuse patches progress")
var swapped = Model.reuseFeedList(keep, [{ id: "b", title: "Other" }])
check(swapped !== keep, "new ids replace list")

if (fails) {
  console.error(fails + " failed")
  process.exit(1)
}
console.log("Model.test.js ok")
