// Draws the app icon (same design as public/favicon.svg) into PNGs without extra deps.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [0x25, 0x63, 0xeb]
const TILES = [
  // [x, y, color, alpha] in a 64-unit grid, matching favicon.svg
  [10, 10, [255, 255, 255], 1],
  [34, 10, [0x45, 0xd0, 0xea], 0.55],
  [10, 34, [0xff, 0xa0, 0x4a], 1],
  [34, 34, [255, 255, 255], 1],
]

function inRounded(px, py, x, y, w, h, r) {
  if (px < x || py < y || px > x + w || py > y + h) return false
  const cx = Math.min(Math.max(px, x + r), x + w - r)
  const cy = Math.min(Math.max(py, y + r), y + h - r)
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
}

function crc32(buf) {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

// `pad` shrinks the artwork toward the center (maskable safe zone).
function png(size, pad) {
  const rows = []
  const scale = (size * (1 - 2 * pad)) / 64
  const off = size * pad
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3)
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5 - off) / scale
      const v = (y + 0.5 - off) / scale
      let c = BG
      for (const [tx, ty, color, a] of TILES) {
        if (inRounded(u, v, tx, ty, 20, 20, 5)) {
          c = c.map((ch, i) => Math.round(ch * (1 - a) + color[i] * a))
        }
      }
      row.set(c, 1 + x * 3)
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

writeFileSync('public/pwa-192.png', png(192, 0.1))
writeFileSync('public/pwa-512.png', png(512, 0.1))
writeFileSync('public/apple-touch-icon.png', png(180, 0.1))
console.log('icons written')
