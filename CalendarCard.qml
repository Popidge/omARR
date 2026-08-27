import QtQuick
import QtQuick.Effects
import qs.Commons
import "Model.js" as Model

Item {
  id: root

  property var item: ({})
  property string posterUrl: ""
  property string fanartUrl: ""
  property bool compact: false
  property string fontFamily: Style.font.family

  readonly property color overlayText: Qt.rgba(1, 1, 1, 0.96)
  readonly property color overlayDim: Qt.rgba(1, 1, 1, 0.78)
  readonly property string ratingLabel: Model.formatRating(item && item.rating, item && item.ratingSource)

  width: parent ? parent.width : implicitWidth
  height: Math.round(width * 9 / 16)

  Rectangle {
    id: card
    anchors.fill: parent
    radius: Style.space(8)
    color: Qt.rgba(0, 0, 0, 0.5)
    layer.enabled: true
    layer.smooth: true
    layer.effect: MultiEffect {
      maskEnabled: true
      maskSource: roundMask
      maskThresholdMin: 0.5
      maskSpreadAtMin: 0.3
    }

    Image {
      id: fanart
      anchors.fill: parent
      visible: root.fanartUrl !== "" && status === Image.Ready
      source: root.fanartUrl
      fillMode: Image.PreserveAspectCrop
      asynchronous: true
      cache: true
      smooth: true
    }

    Image {
      id: poster
      anchors.fill: parent
      visible: !fanart.visible && root.posterUrl !== "" && status === Image.Ready
      source: root.posterUrl
      fillMode: Image.PreserveAspectCrop
      asynchronous: true
      cache: true
      smooth: true
    }

    Rectangle {
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.bottom: parent.bottom
      height: parent.height * 0.42
      gradient: Gradient {
        orientation: Gradient.Vertical
        GradientStop { position: 0.0; color: Qt.rgba(0, 0, 0, 0) }
        GradientStop { position: 1.0; color: Qt.rgba(0, 0, 0, 0.82) }
      }
    }

    Column {
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.bottom: parent.bottom
      anchors.margins: Style.space(8)
      spacing: Style.space(1)

      Item {
        width: parent.width
        height: titleText.implicitHeight

        Text {
          id: titleText
          anchors.left: parent.left
          anchors.right: ratingBadge.left
          anchors.rightMargin: root.ratingLabel !== "" ? Style.space(8) : 0
          text: root.item && root.item.title ? root.item.title : ""
          color: root.overlayText
          font.family: root.fontFamily
          font.pixelSize: Style.font.bodySmall
          font.bold: true
          elide: Text.ElideRight
          textFormat: Text.PlainText
        }

        Text {
          id: ratingBadge
          anchors.right: parent.right
          anchors.verticalCenter: parent.verticalCenter
          visible: root.ratingLabel !== ""
          width: visible ? implicitWidth : 0
          text: root.ratingLabel
          color: root.overlayText
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          font.bold: true
          textFormat: Text.PlainText
        }
      }

      Text {
        width: parent.width
        visible: root.item && root.item.subtitle
        text: root.item && root.item.subtitle ? root.item.subtitle : ""
        color: root.overlayDim
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
        elide: Text.ElideRight
        textFormat: Text.PlainText
      }
    }
  }

  Rectangle {
    id: roundMask
    width: card.width
    height: card.height
    radius: card.radius
    color: "#ffffff"
    visible: false
    layer.enabled: true
  }
}
