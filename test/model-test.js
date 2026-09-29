// node test/model-test.js
const assert = require("node:assert/strict")
const fs = require("node:fs")
const Model = require("../Model.js")

const netDev = `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 800 10 0 0 0 0 0 0 800 10 0 0 0 0 0 0
wlp0s20f3: 1000 5 0 0 0 0 0 0 2000 5 0 0 0 0 0 0
br-90fb517dabb4: 50 1 0 0 0 0 0 0 60 1 0 0 0 0 0 0
docker0: 70 1 0 0 0 0 0 0 80 1 0 0 0 0 0 0
veth5c8c78a: 90 1 0 0 0 0 0 0 99 1 0 0 0 0 0 0
enp62s0u1: 300 2 0 0 0 0 0 0 400 2 0 0 0 0 0 0
`

assert.deepEqual(Model.parseLoad("1.08 1.66 2.97 1/3540 2104010\n"), [1.08, 1.66, 2.97])
assert.equal(Model.parseLoad(""), null)

const mem = Model.parseMem("MemTotal:       32408932 kB\nMemFree: 1 kB\nMemAvailable:   13756660 kB\n")
assert.equal(mem.usedKb, 32408932 - 13756660)
assert.equal(Math.round(mem.usedPct), 58)
assert.equal(Model.parseMem("MemFree: 1 kB"), null)

const net = Model.parseNetDev(netDev, "")
assert.deepEqual(net, { rx: 1300, tx: 2400, ifaces: ["wlp0s20f3", "enp62s0u1"] })
assert.deepEqual(Model.parseNetDev(netDev, "wlp0s20f3, docker0").ifaces, ["wlp0s20f3", "docker0"])
assert.deepEqual(Model.parseNames(["a", " b "]), ["a", "b"])

assert.equal(Model.rate(1000, 3000, 2000), 1000)
assert.equal(Model.rate(5000, 10, 2000), 0, "counter reset reads as idle")
assert.equal(Model.rate(0, 10, 0), 0)

assert.equal(Model.formatRate(0), "0 B/s")
assert.equal(Model.formatRate(999), "999 B/s")
assert.equal(Model.formatRate(1000), "1.0 KB/s")
assert.equal(Model.formatRate(8 * 1024), "8.0 KB/s")
assert.equal(Model.formatRate(48 * 1024), "48 KB/s")
assert.equal(Model.formatRate(1.2 * 1024 * 1024), "1.2 MB/s")
for (let b = 1; b < 1e12; b *= 1.37) {
  assert.ok(Model.formatRate(b).length <= 8, `rate label too wide for ${b}: ${Model.formatRate(b)}`)
}

assert.deepEqual(Model.parseDf("       Avail    1B-blocks\n76547997696 509943480320\n"),
                 { availBytes: 76547997696, sizeBytes: 509943480320 })
assert.equal(Model.parseDf("df: /nope: No such file or directory\n"), null)
assert.equal(Model.formatDisk(76547997696), "77G")
assert.equal(Model.formatDisk(7.5e9), "7.5G")
assert.equal(Model.formatDisk(1.2e12), "1.2T")
assert.equal(Model.formatGB(76547997696), "76.5")

assert.equal(Model.formatLoad(1.084), "1.08")
assert.equal(Model.formatPct(45.6), "46%")
assert.equal(Model.formatGiB(16252272), "15.5")
assert.equal(Model.countCpus("processor\t: 0\nfoo\nprocessor\t: 1\n"), 2)
assert.equal(Model.pad("5%", 3), " 5%")

// Real procfs on this machine parses.
if (fs.existsSync("/proc/loadavg")) {
  assert.ok(Model.parseLoad(fs.readFileSync("/proc/loadavg", "utf8")))
  assert.ok(Model.parseMem(fs.readFileSync("/proc/meminfo", "utf8")))
  assert.ok(Model.parseNetDev(fs.readFileSync("/proc/net/dev", "utf8"), "").ifaces.length > 0)
  assert.ok(Model.countCpus(fs.readFileSync("/proc/cpuinfo", "utf8")) > 0)
}

console.log("model tests passed")
