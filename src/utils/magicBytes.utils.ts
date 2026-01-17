import fs from 'fs';

const FILE_SIGNATURES = {
  jpeg: [
    [0xFF, 0xD8, 0xFF, 0xE0],
    [0xFF, 0xD8, 0xFF, 0xE1],
    [0xFF, 0xD8, 0xFF, 0xE2],
    [0xFF, 0xD8, 0xFF, 0xE8],
  ],
  jpg: [
    [0xFF, 0xD8, 0xFF, 0xE0],
    [0xFF, 0xD8, 0xFF, 0xE1],
    [0xFF, 0xD8, 0xFF, 0xE2],
    [0xFF, 0xD8, 0xFF, 0xE8],
  ],
  png: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  gif: [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  ],
  webp: [[0x52, 0x49, 0x46, 0x46]],
  pdf: [[0x25, 0x50, 0x44, 0x46]],
};

export function validateMagicBytes(filePath: string, allowedTypes: string[]): boolean {
  try {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    for (const type of allowedTypes) {
      const signatures = FILE_SIGNATURES[type.toLowerCase() as keyof typeof FILE_SIGNATURES];
      if (!signatures) continue;

      for (const signature of signatures) {
        let matches = true;
        for (let i = 0; i < signature.length; i++) {
          if (buffer[i] !== signature[i]) {
            matches = false;
            break;
          }
        }

        if (matches) {
          if (type.toLowerCase() === 'webp') {
            const webpMarker = buffer.slice(8, 12);
            if (webpMarker.toString('ascii') !== 'WEBP') {
              continue;
            }
          }
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Magic bytes validation error:', error);
    return false;
  }
}