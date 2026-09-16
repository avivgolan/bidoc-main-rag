import { inflateRawSync } from "node:zlib";

const LOCAL_FILE_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;

export function unzipNamedEntry(archiveBytes, entryName) {
  const bytes = Buffer.isBuffer(archiveBytes) ? archiveBytes : Buffer.from(archiveBytes || []);
  const wanted = String(entryName || "").replaceAll("\\", "/");
  if (!wanted || bytes.length < 30) return null;

  let offset = 0;
  while (offset + 30 <= bytes.length) {
    const signature = bytes.readUInt32LE(offset);
    if (
      signature === CENTRAL_DIRECTORY_SIGNATURE
      || signature === EOCD_SIGNATURE
    ) {
      break;
    }
    if (signature !== LOCAL_FILE_SIGNATURE) return null;

    const flags = bytes.readUInt16LE(offset + 6);
    const method = bytes.readUInt16LE(offset + 8);
    let compressedSize = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    const dataStart = nameEnd + extraLength;
    if (dataStart > bytes.length) return null;

    const name = bytes.subarray(nameStart, nameEnd).toString("utf8").replaceAll("\\", "/");
    const usesDescriptor = Boolean(flags & 0x08);
    let dataEnd = dataStart + compressedSize;
    let nextOffset = dataEnd;

    if (usesDescriptor && compressedSize === 0) {
      const descriptor = findDataDescriptor(bytes, dataStart);
      if (!descriptor) return null;
      compressedSize = descriptor.compressedSize;
      dataEnd = descriptor.descriptorStart;
      nextOffset = descriptor.descriptorEnd;
    } else if (usesDescriptor) {
      nextOffset = dataEnd + descriptorLength(bytes, dataEnd);
    }

    if (name === wanted) {
      const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return Buffer.from(compressed);
      if (method === 8) {
        try {
          return inflateRawSync(compressed);
        } catch {
          return null;
        }
      }
      return null;
    }
    offset = nextOffset;
  }
  return null;
}

function descriptorLength(bytes, offset) {
  if (offset + 4 <= bytes.length && bytes.readUInt32LE(offset) === DATA_DESCRIPTOR_SIGNATURE) {
    return 16;
  }
  return 12;
}

function findDataDescriptor(bytes, dataStart) {
  for (let index = dataStart; index + 16 <= bytes.length; index += 1) {
    if (bytes.readUInt32LE(index) !== DATA_DESCRIPTOR_SIGNATURE) continue;
    return {
      compressedSize: bytes.readUInt32LE(index + 8),
      descriptorStart: index,
      descriptorEnd: index + 16
    };
  }
  return null;
}
