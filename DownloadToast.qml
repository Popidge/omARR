import QtQuick
import QtQuick.Layouts
import QtQuick.Window
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import qs.Commons
import qs.Ui
import "Model.js" as Model

Item {
  id: root

  property var shell: null
  property var service: null
  property var job: null
  property bool showToast: true

  signal dismissRequested()

  readonly property var row: job && job.key ? job : null
  readonly property bool opened: showToast && row
  readonly property string barPosition: shell && shell.barConfig ? String(shell.barConfig.position || "top") : "top"
  readonly property bool barVertical: barPosition === "left" || barPosition === "right"
  readonly property int defaultBarSize: barVertical ? Style.bar.sizeVertical : Style.bar.sizeHorizontal
  readonly property int liveBarSize: shell && shell.bar && !shell.bar.barHidden ? Math.max(0, shell.bar.barSize) : defaultBarSize
  readonly property int barClearance: liveBarSize + Style.gapsOut
  readonly property int topMargin: barPosition === "top" ? barClearance : Style.gapsOut
  readonly property int rightMargin: barPosition === "right" ? barClearance : Style.gapsOut
  readonly property string posterPath: {
    if (!service || !row || !row.posterId || !row.posterServiceId) return ""
    return service.posterPath(row.posterServiceId, row.posterId)
  }
  readonly property string posterUrl: {
    if (!posterPath) return ""
    var rev = service && service.artRev ? service.artRev[posterPath] : 0
    return "file://" + posterPath + "?" + (rev || 0)
  }
  readonly property bool posterReady: posterImage.status === Image.Ready
  readonly property string metaLine: {
    if (!row) return ""
    var parts = []
    if (row.serviceName) parts.push(row.serviceName)
    parts.push(Model.formatProgress(row.progress))
    if (row.speed > 0) parts.push(Model.formatSpeed(row.speed))
    var eta = Model.formatTimeLeft(row.timeleft)
    if (eta) parts.push(eta)
    return parts.join(" · ")
  }

  function summonPanel() {
    summonProc.command = ["omarchy-shell", "shell", "summon", Model.PLUGIN_ID, "{}"]
    summonProc.running = true
  }

  Process {
    id: summonProc
    running: false
  }

  PanelWindow {
    id: panel
    visible: root.opened
    anchors { top: true; bottom: true; left: true; right: true }
    color: "transparent"
    WlrLayershell.namespace: "omarchy-omarr-progress"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
    exclusionMode: ExclusionMode.Ignore
    mask: Region { item: card }

    BorderSurface {
      id: card
      anchors.right: parent.right
      anchors.top: parent.top
      anchors.topMargin: root.topMargin
      anchors.rightMargin: root.rightMargin
      implicitWidth: Style.space(380)
      implicitHeight: body.implicitHeight + borderTop + borderBottom
      radius: Style.cornerRadius
      color: Color.notifications.background
      borderSpec: Border.surfaceSpec("notifications", "border", Color.notifications.border, Math.max(1, Style.space(2)))
      clip: true

      MouseArea {
        anchors.fill: parent
        cursorShape: Qt.PointingHandCursor
        acceptedButtons: Qt.LeftButton | Qt.RightButton
        onClicked: function(mouse) {
          if (mouse.button === Qt.RightButton) root.dismissRequested()
          else root.summonPanel()
        }
      }

      RowLayout {
        id: body
        anchors.top: parent.top
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.topMargin: card.borderTop
        anchors.leftMargin: card.borderLeft
        anchors.rightMargin: card.borderRight
        spacing: Style.space(12)

        Item {
          Layout.preferredWidth: Style.space(56)
          Layout.preferredHeight: Style.space(56)
          Layout.leftMargin: Style.space(12)
          Layout.topMargin: Style.space(10)
          Layout.bottomMargin: Style.space(10)
          Layout.alignment: Qt.AlignTop

          Rectangle {
            anchors.fill: parent
            radius: Style.space(6)
            color: Qt.rgba(1, 1, 1, 0.08)
            clip: true

            Image {
              id: posterImage
              anchors.fill: parent
              visible: status === Image.Ready
              source: root.posterUrl
              sourceSize.width: Math.round(width * (Screen.devicePixelRatio || 1))
              sourceSize.height: Math.round(height * (Screen.devicePixelRatio || 1))
              fillMode: Image.PreserveAspectCrop
              asynchronous: true
              smooth: true
            }

            ServiceIcon {
              visible: !root.posterReady
              anchors.centerIn: parent
              iconSize: Style.space(28)
              service: root.row ? { kind: root.row.kind, name: root.row.serviceName } : ({})
            }
          }

          ServiceIcon {
            visible: root.posterReady
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            anchors.margins: Style.space(-2)
            iconSize: Style.space(16)
            service: root.row ? { kind: root.row.kind, name: root.row.serviceName } : ({})
          }
        }

        ColumnLayout {
          Layout.fillWidth: true
          Layout.rightMargin: Style.space(12)
          Layout.topMargin: Style.space(10)
          Layout.bottomMargin: Style.space(10)
          spacing: Style.space(4)

          RowLayout {
            Layout.fillWidth: true
            spacing: Style.space(8)

            Text {
              Layout.fillWidth: true
              text: root.row ? root.row.title : ""
              color: Color.notifications.text
              font.family: "Liberation Sans"
              font.pixelSize: Style.font.title
              font.bold: true
              elide: Text.ElideRight
              maximumLineCount: 2
              wrapMode: Text.WordWrap
              textFormat: Text.PlainText
            }

            Text {
              text: "󰅖"
              color: Qt.darker(Color.notifications.text, 1.4)
              font.pixelSize: Style.font.icon
              MouseArea {
                anchors.fill: parent
                anchors.margins: Style.space(-6)
                cursorShape: Qt.PointingHandCursor
                onClicked: root.dismissRequested()
              }
            }
          }

          Text {
            Layout.fillWidth: true
            visible: root.metaLine !== ""
            text: root.metaLine
            color: Qt.darker(Color.notifications.text, 1.4)
            font.family: "Liberation Sans"
            font.pixelSize: Style.font.caption
            elide: Text.ElideRight
            textFormat: Text.PlainText
          }

          Rectangle {
            Layout.fillWidth: true
            Layout.topMargin: Style.space(4)
            height: Style.space(4)
            radius: 2
            color: Qt.rgba(1, 1, 1, 0.12)

            Rectangle {
              width: parent.width * Math.max(0, Math.min(1, root.row ? root.row.progress : 0))
              height: parent.height
              radius: parent.radius
              color: Color.notifications.text
            }
          }
        }
      }
    }
  }
}
