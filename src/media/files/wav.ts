export function wavSamples(buf: ArrayBuffer): Float32Array {
  const v = new DataView(buf);
  let o = 12;
  while (o + 8 <= v.byteLength) {
    const id = String.fromCharCode(
      v.getUint8(o),
      v.getUint8(o + 1),
      v.getUint8(o + 2),
      v.getUint8(o + 3),
    );
    const size = v.getUint32(o + 4, true);
    if (id === "data") {
      const n = Math.floor(Math.min(size, v.byteLength - o - 8) / 2);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++)
        out[i] = v.getInt16(o + 8 + i * 2, true) / 32768;
      return out;
    }
    o += 8 + size + (size % 2);
  }
  throw new Error("Couldn't read the extracted audio.");
}
