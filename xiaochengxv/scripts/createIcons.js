const fs = require('fs')
const path = require('path')

const createPNG = (width, height, r, g, b, a = 255) => {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
  
  const createChunk = (type, data) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const typeBuffer = Buffer.from(type)
    const crcData = Buffer.concat([typeBuffer, data])
    let crc = 0xFFFFFFFF
    for (let i = 0; i < crcData.length; i++) {
      crc ^= crcData[i]
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0)
      }
    }
    crc ^= 0xFFFFFFFF
    const crcBuffer = Buffer.alloc(4)
    crcBuffer.writeUInt32BE(crc >>> 0)
    return Buffer.concat([length, typeBuffer, data, crcBuffer])
  }
  
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  
  const rawData = []
  for (let y = 0; y < height; y++) {
    rawData.push(0)
    for (let x = 0; x < width; x++) {
      rawData.push(r, g, b, a)
    }
  }
  
  const zlib = require('zlib')
  const compressed = zlib.deflateSync(Buffer.from(rawData))
  
  const ihdrChunk = createChunk('IHDR', ihdr)
  const idatChunk = createChunk('IDAT', compressed)
  const iendChunk = createChunk('IEND', Buffer.alloc(0))
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
}

const iconsDir = path.join(__dirname, '../images')

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
}

const monitorIcon = createPNG(48, 48, 138, 138, 138)
const monitorActiveIcon = createPNG(48, 48, 26, 115, 232)
const chartIcon = createPNG(48, 48, 138, 138, 138)
const chartActiveIcon = createPNG(48, 48, 26, 115, 232)

fs.writeFileSync(path.join(iconsDir, 'monitor.png'), monitorIcon)
fs.writeFileSync(path.join(iconsDir, 'monitor-active.png'), monitorActiveIcon)
fs.writeFileSync(path.join(iconsDir, 'chart.png'), chartIcon)
fs.writeFileSync(path.join(iconsDir, 'chart-active.png'), chartActiveIcon)

console.log('Icons created successfully!')