import QtQuick
import QtQuick.Controls
import qs.Commons
import qs.Ui
import "Model.js" as Model

Panel {
  id: root
  moduleName: "io.github.del.omarr"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  property var service: null
  property bool showSettings: false
  property int selectedIndex: 0
  property string detailId: ""
  property bool enterConsumed: false

  readonly property var barIdentity: hostWidget || root
  readonly property color contentForeground: bar ? bar.foreground : Color.foreground
  readonly property string contentFontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property color dim: Qt.darker(contentForeground, 1.4)
  readonly property color urgent: bar && bar.urgent ? bar.urgent : Color.urgent
  readonly property var snapshots: service && service.snapshots ? service.snapshots : []
  readonly property var nowFeed: service && service.nowFeed ? service.nowFeed : ({ downloads: [], calendar: [], warnings: [], downloadingCount: 0, downCount: 0 })
  readonly property bool compact: service && service.density === "compact"
  readonly property int rowPad: compact ? Style.space(4) : Style.space(8)
  readonly property int fleetWidth: Style.space(220)
  readonly property bool hasDownloader: Model.anyDownloader(snapshots)
  readonly property var selectedSnap: selectedIndex >= 0 && selectedIndex < snapshots.length ? snapshots[selectedIndex] : null
  readonly property var detailSnap: Model.snapshotById(snapshots, detailId)
  readonly property bool settingsBlocked: settingsLoader.item ? settingsLoader.item.editorOpen === true : false

  function open() {
    if (root.service) {
      root.service.panelOpen = true
      root.service.clearUnread()
    }
    root.controller.show()
    Qt.callLater(function() {
      if (root.opened) setCenterHoverRevealSuppressed(true)
    })
  }

  function close() {
    setCenterHoverRevealSuppressed(false)
    if (root.service) root.service.panelOpen = false
    root.controller.hide()
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open()
  }

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }

  function setCenterHoverRevealSuppressed(value) {
    if (root.bar && "centerHoverRevealSuppressed" in root.bar)
      root.bar.centerHoverRevealSuppressed = value
  }

  function clampSelection() {
    if (root.snapshots.length === 0) {
      root.selectedIndex = 0
      return
    }
    if (root.selectedIndex < 0) root.selectedIndex = 0
    if (root.selectedIndex >= root.snapshots.length)
      root.selectedIndex = root.snapshots.length - 1
  }

  function moveCursor(dx, dy) {
    if (root.showSettings) return
    if (dx > 0 && root.selectedSnap) {
      root.detailId = root.selectedSnap.id
      return
    }
    if (dx < 0) {
      root.detailId = ""
      return
    }
    root.selectedIndex += dy
    root.clampSelection()
  }

  function activateCursor() {
    if (root.enterConsumed) {
      root.enterConsumed = false
      return
    }
    if (root.showSettings) return
    if (!root.selectedSnap) {
      root.showSettings = true
      return
    }
    if (root.detailId === root.selectedSnap.id) root.detailId = ""
    else root.detailId = root.selectedSnap.id
  }

  function openSelected() {
    root.enterConsumed = true
    if (root.selectedSnap && root.service) root.service.openService(root.selectedSnap.id)
  }

  function healthColor(health) {
    if (health === "down") return root.urgent
    if (health === "up") return root.contentForeground
    return root.dim
  }

  function posterSource(serviceId, posterId) {
    if (!root.service || !posterId) return ""
    return "file://" + root.service.posterPath(serviceId, posterId) + "?" + root.service.posterRevision
  }

  onSnapshotsChanged: root.clampSelection()

  Component {
    id: settingsComp
    SettingsView {
      width: content.width
      service: root.service
      foreground: root.contentForeground
      fontFamily: root.contentFontFamily
      compact: root.compact
      onCloseSettings: root.showSettings = false
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    centerOnBar: true
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(720))
    contentHeight: panel.cappedContentHeight(Style.space(640))

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      blocked: root.settingsBlocked
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onMoveRequested: function(dx, dy) { root.moveCursor(dx, dy) }
      onActivateRequested: root.activateCursor()
      onReturnRequested: root.openSelected()
      onTextKey: function(t) {
        if (t === "s" || t === "S") root.showSettings = !root.showSettings
        else if (t === "p" || t === "P") { if (root.service) root.service.pauseAll() }
        else if (t === "r" || t === "R") { if (root.service) root.service.resumeAll() }
        else if (t === "o" || t === "O") root.openSelected()
      }

      Flickable {
        id: panelFlick
        anchors.fill: parent
        contentWidth: width
        contentHeight: content.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        flickableDirection: Flickable.VerticalFlick
        interactive: contentHeight > height
        ScrollBar.vertical: ScrollBar { policy: ScrollBar.AsNeeded }

        Column {
          id: content
          width: panelFlick.width
          spacing: root.rowPad

          Item {
            width: parent.width
            height: Math.max(hero.implicitHeight, headerActions.implicitHeight)

            PanelHero {
              id: hero
              anchors.left: parent.left
              anchors.right: headerActions.left
              anchors.rightMargin: Style.space(8)
              title: "omARR"
              meta: root.service ? root.service.statusText : ""
              foreground: root.contentForeground
              fontFamily: root.contentFontFamily
              iconComponent: Component {
                OmarrIcon {
                  iconSize: Style.font.display
                  color: root.contentForeground
                }
              }
            }

            Row {
              id: headerActions
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              spacing: Style.space(2)

              PanelActionButton {
                visible: root.hasDownloader && !root.showSettings
                iconText: "󰏤"
                tooltipText: "Pause all downloads"
                foreground: root.contentForeground
                fontFamily: root.contentFontFamily
                onClicked: if (root.service) root.service.pauseAll()
              }

              PanelActionButton {
                visible: root.hasDownloader && !root.showSettings
                iconText: "󰐊"
                tooltipText: "Resume all downloads"
                foreground: root.contentForeground
                fontFamily: root.contentFontFamily
                onClicked: if (root.service) root.service.resumeAll()
              }

              PanelActionButton {
                iconText: "󰒓"
                tooltipText: root.showSettings ? "Back" : "Settings"
                foreground: root.showSettings ? Color.accent : root.contentForeground
                fontFamily: root.contentFontFamily
                onClicked: root.showSettings = !root.showSettings
              }
            }
          }

          Loader {
            id: settingsLoader
            width: parent.width
            active: root.showSettings
            visible: active
            height: visible ? implicitHeight : 0
            sourceComponent: settingsComp
          }

          Text {
            visible: !root.showSettings && root.snapshots.length === 0
            width: parent.width
            text: "Nothing on the radar yet. Open settings to add Sonarr, Radarr, SABnzbd, qBittorrent, or any local URL — or scan this machine."
            wrapMode: Text.WordWrap
            color: root.dim
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            font.italic: true
          }

          Button {
            visible: !root.showSettings && root.snapshots.length === 0
            text: "Open settings"
            foreground: root.contentForeground
            onClicked: root.showSettings = true
          }

          Row {
            width: parent.width
            spacing: Style.space(12)
            visible: !root.showSettings && root.snapshots.length > 0
            height: visible ? implicitHeight : 0

            Column {
              width: root.fleetWidth
              spacing: Style.space(6)

              PanelSectionHeader {
                text: "FLEET"
                foreground: root.contentForeground
                fontFamily: root.contentFontFamily
              }

              Repeater {
                model: Model.groupedServices(root.snapshots)

                Column {
                  required property var modelData
                  width: parent.width
                  spacing: Style.space(2)

                  Text {
                    visible: parent.modelData.group !== ""
                    width: parent.width
                    text: parent.modelData.group
                    color: root.dim
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption
                    font.bold: true
                    textFormat: Text.PlainText
                  }

                  Repeater {
                    model: parent.modelData.services

                    CursorSurface {
                      id: fleetRow
                      required property var modelData
                      width: parent.width
                      implicitHeight: fleetCol.implicitHeight + root.rowPad
                      hasCursor: {
                        var idx = -1
                        for (var i = 0; i < root.snapshots.length; i++) {
                          if (root.snapshots[i].id === fleetRow.modelData.id) idx = i
                        }
                        return idx === root.selectedIndex
                      }
                      current: root.detailId === fleetRow.modelData.id
                      foreground: root.contentForeground
                      accent: Color.accent

                      MouseArea {
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                          for (var i = 0; i < root.snapshots.length; i++) {
                            if (root.snapshots[i].id === fleetRow.modelData.id) root.selectedIndex = i
                          }
                          root.detailId = fleetRow.modelData.id
                        }
                        onDoubleClicked: if (root.service) root.service.openService(fleetRow.modelData.id)
                      }

                      Row {
                        anchors.left: parent.left
                        anchors.right: parent.right
                        anchors.verticalCenter: parent.verticalCenter
                        anchors.margins: Style.space(6)
                        spacing: Style.space(8)

                        Rectangle {
                          width: Style.space(7)
                          height: Style.space(7)
                          radius: width / 2
                          anchors.verticalCenter: parent.verticalCenter
                          color: root.healthColor(fleetRow.modelData.health)
                        }

                        Column {
                          id: fleetCol
                          width: parent.width - Style.space(15)
                          spacing: Style.space(1)

                          Text {
                            width: parent.width
                            text: fleetRow.modelData.name
                            color: root.contentForeground
                            font.family: root.contentFontFamily
                            font.pixelSize: Style.font.bodySmall
                            font.bold: true
                            elide: Text.ElideRight
                            textFormat: Text.PlainText
                          }

                          Text {
                            width: parent.width
                            text: Model.fleetLine(fleetRow.modelData)
                            color: root.dim
                            font.family: root.contentFontFamily
                            font.pixelSize: Style.font.caption
                            elide: Text.ElideRight
                            textFormat: Text.PlainText
                          }
                        }
                      }
                    }
                  }
                }
              }
            }

            Column {
              width: parent.width - root.fleetWidth - parent.spacing
              spacing: Style.space(8)

              Column {
                width: parent.width
                spacing: Style.space(6)
                visible: !root.detailSnap
                height: visible ? implicitHeight : 0

                Item {
                  width: parent.width
                  height: nowHeader.implicitHeight
                  visible: root.nowFeed.warnings && root.nowFeed.warnings.length > 0

                  PanelSectionHeader {
                    id: nowHeader
                    text: "WARNINGS"
                    foreground: root.urgent
                    fontFamily: root.contentFontFamily
                  }
                }

                Repeater {
                  model: root.nowFeed.warnings || []

                  Text {
                    required property var modelData
                    width: parent.width
                    text: modelData.title + " · " + modelData.body
                    color: root.urgent
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption
                    elide: Text.ElideRight
                    textFormat: Text.PlainText
                    wrapMode: Text.WordWrap
                  }
                }

                PanelSectionHeader {
                  visible: root.service && root.service.showQueue && (root.nowFeed.downloads || []).length > 0
                  text: "DOWNLOADING"
                  foreground: root.contentForeground
                  fontFamily: root.contentFontFamily
                }

                Repeater {
                  model: root.nowFeed.downloads || []

                  Column {
                    required property var modelData
                    width: parent.width
                    spacing: Style.space(2)

                    Text {
                      width: parent.width
                      text: parent.modelData.title
                      color: root.contentForeground
                      font.family: root.contentFontFamily
                      font.pixelSize: Style.font.bodySmall
                      elide: Text.ElideRight
                      textFormat: Text.PlainText
                    }

                    Text {
                      width: parent.width
                      text: parent.modelData.serviceName + " · " + Model.formatProgress(parent.modelData.progress)
                        + (parent.modelData.timeleft ? " · " + parent.modelData.timeleft : "")
                      color: root.dim
                      font.family: root.contentFontFamily
                      font.pixelSize: Style.font.caption
                      elide: Text.ElideRight
                      textFormat: Text.PlainText
                    }

                    Rectangle {
                      width: parent.width
                      height: Style.space(2)
                      color: Qt.darker(root.contentForeground, 2.2)
                      radius: 1

                      Rectangle {
                        width: parent.width * Math.max(0, Math.min(1, parent.parent.modelData.progress || 0))
                        height: parent.height
                        color: root.contentForeground
                        radius: 1
                      }
                    }
                  }
                }

                Text {
                  visible: root.service && root.service.showQueue && (!root.nowFeed.downloads || root.nowFeed.downloads.length === 0)
                  width: parent.width
                  text: "Queue is quiet."
                  color: root.dim
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption
                  font.italic: true
                }

                PanelSectionHeader {
                  visible: root.service && root.service.showCalendar && (root.nowFeed.calendar || []).length > 0
                  text: "TONIGHT"
                  foreground: root.contentForeground
                  fontFamily: root.contentFontFamily
                }

                Repeater {
                  model: root.nowFeed.calendar || []

                  Row {
                    required property var modelData
                    width: parent.width
                    spacing: Style.space(8)

                    Image {
                      visible: !!parent.modelData.posterId
                      width: Style.space(28)
                      height: Style.space(42)
                      fillMode: Image.PreserveAspectCrop
                      asynchronous: true
                      cache: false
                      source: root.posterSource(parent.modelData.serviceId, parent.modelData.posterId)
                    }

                    Column {
                      width: parent.width - (parent.modelData.posterId ? Style.space(36) : 0)
                      spacing: Style.space(1)

                      Text {
                        width: parent.width
                        text: parent.parent.modelData.title
                        color: root.contentForeground
                        font.family: root.contentFontFamily
                        font.pixelSize: Style.font.bodySmall
                        font.bold: true
                        elide: Text.ElideRight
                        textFormat: Text.PlainText
                      }

                      Text {
                        width: parent.width
                        text: parent.parent.modelData.subtitle + (parent.parent.modelData.airDate ? " · " + parent.parent.modelData.airDate : "")
                        color: root.dim
                        font.family: root.contentFontFamily
                        font.pixelSize: Style.font.caption
                        elide: Text.ElideRight
                        textFormat: Text.PlainText
                      }
                    }
                  }
                }
              }

              Column {
                width: parent.width
                spacing: Style.space(6)
                visible: !!root.detailSnap
                height: visible ? implicitHeight : 0

                Item {
                  width: parent.width
                  height: Math.max(detailHeader.implicitHeight, openBtn.implicitHeight)

                  PanelSectionHeader {
                    id: detailHeader
                    anchors.left: parent.left
                    anchors.verticalCenter: parent.verticalCenter
                    text: root.detailSnap ? String(root.detailSnap.name).toUpperCase() : ""
                    foreground: root.contentForeground
                    fontFamily: root.contentFontFamily
                  }

                  Row {
                    anchors.right: parent.right
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: Style.space(2)

                    PanelActionButton {
                      id: openBtn
                      iconText: "󰖟"
                      tooltipText: "Open in browser"
                      foreground: root.contentForeground
                      fontFamily: root.contentFontFamily
                      onClicked: if (root.service && root.detailSnap) root.service.openUrl(root.detailSnap.url)
                    }

                    PanelActionButton {
                      iconText: "󰅖"
                      tooltipText: "Back to now"
                      foreground: root.contentForeground
                      fontFamily: root.contentFontFamily
                      onClicked: root.detailId = ""
                    }
                  }
                }

                Text {
                  width: parent.width
                  text: root.detailSnap ? (root.detailSnap.statusText || Model.fleetLine(root.detailSnap)) : ""
                  color: root.dim
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                  wrapMode: Text.WordWrap
                  textFormat: Text.PlainText
                }

                Repeater {
                  model: root.detailSnap && root.detailSnap.queue ? root.detailSnap.queue : []

                  CursorSurface {
                    id: qRow
                    required property var modelData
                    width: parent.width
                    implicitHeight: qCol.implicitHeight + Style.space(10)
                    hasCursor: qMouse.containsMouse
                    foreground: root.contentForeground
                    accent: Color.accent

                    MouseArea {
                      id: qMouse
                      anchors.fill: parent
                      hoverEnabled: true
                    }

                    Row {
                      anchors.fill: parent
                      anchors.margins: Style.space(6)
                      spacing: Style.space(6)

                      Column {
                        id: qCol
                        width: parent.width - Style.space(52)
                        spacing: Style.space(2)

                        Text {
                          width: parent.width
                          text: qRow.modelData.title
                          color: root.contentForeground
                          font.family: root.contentFontFamily
                          font.pixelSize: Style.font.caption
                          elide: Text.ElideRight
                          textFormat: Text.PlainText
                        }

                        Rectangle {
                          width: parent.width
                          height: Style.space(2)
                          color: Qt.darker(root.contentForeground, 2.2)

                          Rectangle {
                            width: parent.width * Math.max(0, Math.min(1, qRow.modelData.progress || 0))
                            height: parent.height
                            color: root.contentForeground
                          }
                        }
                      }

                      PanelActionButton {
                        visible: root.detailSnap && (root.detailSnap.kind === "sabnzbd" || root.detailSnap.kind === "qbittorrent")
                        iconText: "󰏤"
                        tooltipText: "Pause"
                        foreground: root.contentForeground
                        fontFamily: root.contentFontFamily
                        onClicked: if (root.service && root.detailSnap)
                          root.service.runControl(root.detailSnap.id, "pause-item", qRow.modelData.id)
                      }

                      PanelActionButton {
                        visible: root.detailSnap && (root.detailSnap.kind === "sabnzbd" || root.detailSnap.kind === "qbittorrent")
                        iconText: "󰐊"
                        tooltipText: "Resume"
                        foreground: root.contentForeground
                        fontFamily: root.contentFontFamily
                        onClicked: if (root.service && root.detailSnap)
                          root.service.runControl(root.detailSnap.id, "resume-item", qRow.modelData.id)
                      }
                    }
                  }
                }

                Repeater {
                  model: root.detailSnap && root.detailSnap.calendar ? root.detailSnap.calendar : []

                  Row {
                    required property var modelData
                    width: parent.width
                    spacing: Style.space(8)

                    Image {
                      visible: !!parent.modelData.posterId
                      width: Style.space(32)
                      height: Style.space(48)
                      fillMode: Image.PreserveAspectCrop
                      asynchronous: true
                      cache: false
                      source: root.detailSnap ? root.posterSource(root.detailSnap.id, parent.modelData.posterId) : ""
                    }

                    Column {
                      width: parent.width - Style.space(40)
                      spacing: Style.space(1)

                      Text {
                        width: parent.width
                        text: parent.parent.modelData.title
                        color: root.contentForeground
                        font.family: root.contentFontFamily
                        font.pixelSize: Style.font.bodySmall
                        font.bold: true
                        elide: Text.ElideRight
                        textFormat: Text.PlainText
                      }

                      Text {
                        width: parent.width
                        text: parent.parent.modelData.subtitle
                        color: root.dim
                        font.family: root.contentFontFamily
                        font.pixelSize: Style.font.caption
                        elide: Text.ElideRight
                        textFormat: Text.PlainText
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
