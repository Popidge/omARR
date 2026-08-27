import QtQuick
import QtQuick.Effects
import QtQuick.Window
import qs.Commons

Item {
  id: root

  property real iconSize: Style.font.icon
  property color color: Color.foreground
  property bool live: false

  width: iconSize
  height: iconSize
  implicitWidth: iconSize
  implicitHeight: iconSize

  readonly property real s: Math.max(8, iconSize)
  readonly property real dpr: Screen.devicePixelRatio || 1

  Image {
    id: mark
    anchors.centerIn: parent
    width: root.s
    height: root.s
    source: Qt.resolvedUrl("icons/omarr.svg")
    sourceSize.width: Math.round(root.s * root.dpr)
    sourceSize.height: Math.round(root.s * root.dpr)
    fillMode: Image.PreserveAspectFit
    smooth: false
    asynchronous: true
    visible: false
    layer.enabled: true
  }

  MultiEffect {
    anchors.fill: mark
    source: mark
    colorization: 1
    colorizationColor: root.color
  }
}
