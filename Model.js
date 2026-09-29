// Parsing and formatting for the btop bar widget, kept Qt-free so it can be
// unit tested under node (node test/model-test.js).

// Interfaces whose traffic already shows up on a physical link, or never
// leaves the machine. Counting them would double every Docker pull or VPN
// transfer.
var VIRTUAL_IFACE = /^(lo|veth|docker|br-|virbr|vnet|vmnet|tun|tap|wg|tailscale|zt|podman|cni|flannel)/

var RATE_UNITS = ["B/s", "KB/s", "MB/s", "GB/s"]

// /proc/loadavg: "1.08 1.66 2.97 1/3540 2104010"
function parseLoad(text) {
  var fields = String(text || "").trim().split(/\s+/)
  var load = fields.slice(0, 3).map(Number)
  return load.length === 3 && load.every(isFinite) ? load : null
}

// /proc/meminfo. Used memory is what btop and free call used: total minus
// MemAvailable, which leaves reclaimable cache out.
function parseMem(text) {
  var values = {}
  String(text || "").split("\n").forEach(function (line) {
    var match = line.match(/^(\w+):\s+(\d+)/)
    if (match) values[match[1]] = Number(match[2])
  })

  var total = values.MemTotal
  var available = values.MemAvailable
  if (!total || available === undefined) return null
  return {
    totalKb: total,
    availableKb: available,
    usedKb: total - available,
    usedPct: (total - available) / total * 100
  }
}

// `df -B1 --output=avail,size <path>`: a header line, then bytes available to
// unprivileged users and the filesystem size.
function parseDf(text) {
  var lines = String(text || "").trim().split("\n")
  var fields = (lines[1] || "").trim().split(/\s+/).map(Number)
  if (fields.length < 2 || !fields.every(isFinite)) return null
  return { availBytes: fields[0], sizeBytes: fields[1] }
}

// Interface names from the `interfaces` setting: a comma separated string or
// an array. Empty means pick physical-looking interfaces automatically.
function parseNames(value) {
  var list = Array.isArray(value) ? value : String(value || "").split(",")
  return list.map(function (name) { return String(name).trim() }).filter(Boolean)
}

function includeIface(name, names) {
  return names.length > 0 ? names.indexOf(name) !== -1 : !VIRTUAL_IFACE.test(name)
}

// /proc/net/dev: two header lines, then "iface: rx_bytes ... (8 rx fields)
// tx_bytes ...". Sums the byte counters over the included interfaces.
function parseNetDev(text, names) {
  var wanted = parseNames(names)
  var result = { rx: 0, tx: 0, ifaces: [] }

  String(text || "").split("\n").forEach(function (line) {
    var colon = line.indexOf(":")
    if (colon === -1) return
    var name = line.slice(0, colon).trim()
    if (!name || !includeIface(name, wanted)) return

    var fields = line.slice(colon + 1).trim().split(/\s+/).map(Number)
    if (fields.length < 9) return
    result.rx += fields[0]
    result.tx += fields[8]
    result.ifaces.push(name)
  })

  return result
}

// Bytes per second between two counter readings. A counter that went
// backwards (interface removed, driver reset) reads as idle rather than as a
// huge negative spike.
function rate(prev, cur, dtMs) {
  if (!(dtMs > 0)) return 0
  var delta = cur - prev
  return delta > 0 ? delta / (dtMs / 1000) : 0
}

// "8.0 KB/s", "48 KB/s", "1.2 MB/s".
function formatRate(bytesPerSec) {
  var value = Math.max(0, Number(bytesPerSec) || 0)
  var unit = 0
  // Switch at 1000 rather than 1024 so the number never needs a fourth digit.
  while (value >= 1000 && unit < RATE_UNITS.length - 1) {
    value /= 1024
    unit++
  }
  var number = unit > 0 && value < 10 ? value.toFixed(1) : String(Math.round(value))
  return number + " " + RATE_UNITS[unit]
}

function formatLoad(value) {
  return isFinite(value) ? Number(value).toFixed(2) : "-"
}

function formatPct(pct) {
  return isFinite(pct) ? Math.round(pct) + "%" : "-"
}

// Disk sizes in base-10 units, like drive vendors and `df -H`: "77G", "7.5G",
// "1.2T".
function formatDisk(bytes) {
  var value = Math.max(0, Number(bytes) || 0) / 1e9
  var unit = "G"
  if (value >= 1000) {
    value /= 1000
    unit = "T"
  }
  return (value < 10 ? value.toFixed(1) : String(Math.round(value))) + unit
}

function formatGB(bytes) {
  return (bytes / 1e9).toFixed(1)
}

function formatGiB(kb) {
  return (kb / 1048576).toFixed(1)
}

// Logical CPUs, from the processor entries in /proc/cpuinfo.
function countCpus(text) {
  var matches = String(text || "").match(/^processor\s*:/gm)
  return matches ? matches.length : 0
}

// Left-pad to a minimum width so the bar doesn't shift as values change. The
// bar font is monospace, so a character is a fixed width.
function pad(text, width) {
  var s = String(text)
  while (s.length < width) s = " " + s
  return s
}

if (typeof module !== "undefined") {
  module.exports = {
    countCpus: countCpus,
    formatDisk: formatDisk,
    formatGB: formatGB,
    formatGiB: formatGiB,
    formatLoad: formatLoad,
    formatPct: formatPct,
    formatRate: formatRate,
    pad: pad,
    parseDf: parseDf,
    parseLoad: parseLoad,
    parseMem: parseMem,
    parseNames: parseNames,
    parseNetDev: parseNetDev,
    rate: rate
  }
}
