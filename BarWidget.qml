import QtQuick
import qs.Commons
import qs.Ui

BarWidget {
  id: root
  moduleName: "io.github.del.omarr"

  readonly property var service: bar && bar.shell && typeof bar.shell.serviceFor === "function"
    ? bar.shell.serviceFor(moduleName) : null
  readonly property bool configured: service ? service.configured === true : false
  readonly property bool badgeUrgent: service ? service.badgeUrgent === true : false
  readonly property int badgeCount: service ? Number(service.badgeCount || 0) : 0
  readonly property int unreadCount: service ? Number(service.unreadCount || 0) : 0
  readonly property color barColor: bar ? bar.barForeground : Color.foreground
  readonly property color urgentColor: bar && bar.urgent ? bar.urgent : Color.urgent
  readonly property color iconColor: !configured
    ? Qt.darker(barColor, 1.55)
    : (badgeUrgent ? urgentColor : barColor)

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
    if ("service" in target) target.service = root.service
  }

  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false
  readonly property bool popoutSwitchClosing: panelLoader.item ? panelLoader.item.popoutSwitchClosing === true : false

  function open() {
    if (panelLoader.item) panelLoader.item.open()
  }

  function close() {
    if (panelLoader.item) panelLoader.item.close()
  }

  function toggle() {
    if (panelLoader.item) panelLoader.item.toggle()
  }

  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()
  onServiceChanged: injectPanel()

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    tooltipText: service ? service.statusText : "omARR"
    iconComponent: Component {
      Item {
        OmarrIcon {
          anchors.centerIn: parent
          iconSize: Style.space(12)
          color: root.iconColor
          live: root.badgeCount > 0 && !root.badgeUrgent

          Behavior on color {
            enabled: !root.bar || root.bar.foregroundAnimationEnabled
            ColorAnimation { duration: 160 }
          }
        }

        Text {
          visible: root.unreadCount > 0 || (root.badgeCount > 0 && root.unreadCount === 0)
          anchors.right: parent.right
          anchors.bottom: parent.bottom
          text: root.unreadCount > 0 ? String(root.unreadCount) : String(root.badgeCount)
          color: root.iconColor
          font.family: root.bar ? root.bar.fontFamily : Style.font.family
          font.pixelSize: Style.font.caption
        }
      }
    }
    onPressed: function(buttonCode) {
      if (buttonCode === Qt.LeftButton) root.toggle()
    }
  }
}
