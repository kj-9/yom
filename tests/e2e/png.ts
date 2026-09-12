import { inflateSync } from "node:zlib";

type DecodedPng = {
  width: number;
  height: number;
  channels: number;
  pixels: Buffer;
};

export function pngDifference(actual: Buffer, expected: Buffer) {
  const left = decodePng(actual);
  const right = decodePng(expected);
  if (
    left.width !== right.width ||
    left.height !== right.height ||
    left.channels !== right.channels
  ) {
    throw new Error("PNG dimensions or color types do not match");
  }

  let differingPixels = 0;
  let maxChannelDelta = 0;
  for (let offset = 0; offset < left.pixels.length; offset += left.channels) {
    let differs = false;
    for (let channel = 0; channel < left.channels; channel++) {
      const delta = Math.abs(
        left.pixels[offset + channel]! - right.pixels[offset + channel]!,
      );
      if (delta > 0) differs = true;
      maxChannelDelta = Math.max(maxChannelDelta, delta);
    }
    if (differs) differingPixels++;
  }

  return {
    differingPixelRatio: differingPixels / (left.width * left.height),
    maxChannelDelta,
  };
}

function decodePng(png: Buffer): DecodedPng {
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const data: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const chunk = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      channels = chunk[9] === 6 ? 4 : chunk[9] === 2 ? 3 : 0;
      if (chunk[8] !== 8 || channels === 0 || chunk[12] !== 0) {
        throw new Error("Screenshot PNG uses an unsupported format");
      }
    } else if (type === "IDAT") data.push(chunk);
    offset += length + 12;
  }

  const compressed = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  let source = 0;
  for (let y = 0; y < height; y++) {
    const filter = compressed[source++]!;
    for (let x = 0; x < stride; x++) {
      const raw = compressed[source++]!;
      const left = x >= channels ? pixels[y * stride + x - channels]! : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x]! : 0;
      const upperLeft =
        y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels]! : 0;
      const predictor =
        filter === 1
          ? left
          : filter === 2
            ? up
            : filter === 3
              ? Math.floor((left + up) / 2)
              : filter === 4
                ? paeth(left, up, upperLeft)
                : 0;
      pixels[y * stride + x] = (raw + predictor) & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

function paeth(left: number, up: number, upperLeft: number) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  return leftDistance <= upDistance && leftDistance <= upperLeftDistance
    ? left
    : upDistance <= upperLeftDistance
      ? up
      : upperLeft;
}
