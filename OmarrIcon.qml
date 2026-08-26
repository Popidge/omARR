import QtQuick
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

  Rectangle {
    width: root.s * 0.88
    height: width
    radius: width / 2
    color: "transparent"
    border.color: root.color
    border.width: Math.max(1, root.s * 0.08)
    anchors.centerIn: parent
    opacity: 0.95
  }

  Rectangle {
    width: root.s * 0.54
    height: width
    radius: width / 2
    color: "transparent"
    border.color: root.color
    border.width: Math.max(1, root.s * 0.07)
    anchors.centerIn: parent
    opacity: 0.7
  }

  Rectangle {
    width: Math.max(1.5, root.s * 0.08)
    height: root.s * 0.42
    radius: width / 2
    color: root.color
    anchors.horizontalCenter: parent.horizontalCenter
    anchors.bottom: parent.verticalCenter
    transform: Rotation {
      origin.x: Math.max(0.75, root.s * 0.04)
      origin.y: root.s * 0.42
      angle: 38
    }
  }

  Rectangle {
    width: Math.max(2, root.s * 0.16)
    height: width
    radius: width / 2
    color: root.color
    anchors.centerIn: parent
  }
}
