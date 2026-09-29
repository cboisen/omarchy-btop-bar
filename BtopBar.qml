import QtQuick
import Quickshell.Io
import qs.Ui
import qs.Commons
import "Model.js" as Model

BarWidget {
  id: root
  moduleName: "cboisen.btop-bar"

  readonly property int intervalMs: Math.max(1, Number(setting("interval", 5)) || 5) * 1000
  readonly property var items: {
    var list = setting("items", [])
    return Array.isArray(list) && list.length > 0 ? list : ["load", "ram", "disk"]
  }
  readonly property var interfaces: Model.parseNames(setting("interfaces", ""))

  property var load: null
  property var mem: null
  property var disk: null
  property int cpus: 0
  property real downRate: 0
  property real upRate: 0
  property var netIfaces: []

  // Previous counter reading; null until the first sample so the first rate
  // is 0 rather than the total since boot.
  property var lastNet: null

  function shows(item) {
    return root.items.indexOf(item) !== -1
  }

  function sampleNet(text) {
    var now = Date.now()
    var cur = Model.parseNetDev(text, root.interfaces)
    if (root.lastNet) {
      var dt = now - root.lastNet.at
      root.downRate = Model.rate(root.lastNet.rx, cur.rx, dt)
      root.upRate = Model.rate(root.lastNet.tx, cur.tx, dt)
    }
    root.netIfaces = cur.ifaces
    root.lastNet = { rx: cur.rx, tx: cur.tx, at: now }
  }

  // A different interface set sums different counters, so the next delta
  // would be meaningless.
  onInterfacesChanged: lastNet = null

  readonly property string label: {
    var compact = root.vertical
    var parts = []
    if (shows("load")) parts.push(compact ? Model.formatLoad(root.load ? root.load[0] : NaN)
                                          : "󰓅 " + Model.formatLoad(root.load ? root.load[0] : NaN))
    if (shows("ram")) parts.push(compact ? Model.formatPct(root.mem ? root.mem.usedPct : NaN)
                                         : "󰍛 " + Model.pad(Model.formatPct(root.mem ? root.mem.usedPct : NaN), 3))
    if (shows("disk")) parts.push(compact ? Model.formatDisk(root.disk ? root.disk.availBytes : NaN)
                                          : "󰋊 " + Model.formatDisk(root.disk ? root.disk.availBytes : NaN))
    return parts.join(compact ? "\n" : "  ")
  }

  readonly property string tooltip: {
    var lines = []
    if (root.load) {
      lines.push("Load  " + root.load.map(Model.formatLoad).join("  ")
                 + (root.cpus > 0 ? "  (" + root.cpus + " cores)" : ""))
    }
    if (root.mem) {
      lines.push("RAM   " + Model.formatGiB(root.mem.usedKb) + " / " + Model.formatGiB(root.mem.totalKb)
                 + " GiB (" + Model.formatPct(root.mem.usedPct) + ")")
    }
    if (root.disk) {
      lines.push("Disk  " + Model.formatGB(root.disk.availBytes) + " GB free of "
                 + Model.formatGB(root.disk.sizeBytes) + " GB (/)")
    }
    lines.push("Net   ↓ " + Model.formatRate(root.downRate) + "  ↑ " + Model.formatRate(root.upRate)
               + (root.netIfaces.length > 0 ? "  (" + root.netIfaces.join(", ") + ")" : ""))
    return lines.join("\n")
  }

  FileView {
    id: loadFile
    path: "/proc/loadavg"
    onLoaded: root.load = Model.parseLoad(text())
  }

  FileView {
    id: memFile
    path: "/proc/meminfo"
    onLoaded: root.mem = Model.parseMem(text())
  }

  FileView {
    id: netFile
    path: "/proc/net/dev"
    onLoaded: root.sampleNet(text())
  }

  // statvfs isn't reachable from QML, and df is cheap enough to run on the tick.
  Process {
    id: dfProc
    command: ["df", "-B1", "--output=avail,size", "/"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.disk = Model.parseDf(text)
    }
  }

  FileView {
    path: "/proc/cpuinfo"
    onLoaded: root.cpus = Model.countCpus(text())
  }

  Timer {
    interval: root.intervalMs
    running: true
    repeat: true
    triggeredOnStart: true
    onTriggered: {
      if (root.shows("load")) loadFile.reload()
      if (root.shows("ram")) memFile.reload()
      if (root.shows("disk") && !dfProc.running) dfProc.running = true
      // The rates only appear in the tooltip, but they need a sample every
      // tick to be current when it opens.
      netFile.reload()
    }
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: root.label
    fontSize: root.vertical ? Style.font.caption : Style.font.body
    useActiveColor: false
    tooltipText: root.tooltip
    onPressed: function(b) {
      if (b === Qt.LeftButton && root.bar) root.bar.run("omarchy-launch-or-focus-tui btop")
    }
  }
}
