import QtQuick
import qs.Commons
import "Model.js" as Model

Item {
  id: root

  property var service: ({})
  property string slug: Model.iconSlug(service)
  property real iconSize: Style.space(16)
  property string health: ""
  property color healthColor: Color.foreground
  property bool showHealth: health !== ""

  width: iconSize
  height: iconSize
  implicitWidth: iconSize
  implicitHeight: iconSize

  Image {
    id: img
    anchors.fill: parent
    visible: root.slug !== "" && status !== Image.Error
    source: root.slug !== "" ? Qt.resolvedUrl("icons/" + root.slug + ".svg") : ""
    sourceSize.width: Math.round(root.iconSize * 2)
    sourceSize.height: Math.round(root.iconSize * 2)
    fillMode: Image.PreserveAspectFit
    asynchronous: true
    smooth: true
  }

  Rectangle {
    visible: !img.visible
    anchors.fill: parent
    radius: width * 0.22
    color: Qt.rgba(1, 1, 1, 0.08)
    border.color: Qt.rgba(1, 1, 1, 0.16)
    border.width: 1

    Text {
      anchors.centerIn: parent
      text: {
        var n = root.service && root.service.name ? String(root.service.name) : "?"
        return n.charAt(0).toUpperCase()
      }
      color: Qt.rgba(1, 1, 1, 0.72)
      font.pixelSize: Math.max(8, Math.round(root.iconSize * 0.46))
      font.bold: true
    }
  }

  Rectangle {
    visible: root.showHealth
    width: Math.max(6, Math.round(root.iconSize * 0.3))
    height: width
    radius: width / 2
    anchors.right: parent.right
    anchors.bottom: parent.bottom
    color: root.healthColor
    border.color: Qt.rgba(0, 0, 0, 0.55)
    border.width: 1
  }
}
