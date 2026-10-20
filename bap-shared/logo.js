/** Shared PNG/JPEG bounds check; keeps Word and PDF logo proportions consistent. */
export function logoDimensions(value) {
  if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value))
    throw new Error("Logo harus PNG/JPEG.");
  let bytes;
  try {
    bytes = Uint8Array.from(atob(value.split(",")[1]), (c) => c.charCodeAt(0));
  } catch {
    throw new Error("File logo tidak valid.");
  }
  if (bytes.length > 350000) throw new Error("Logo maksimum 350 KB.");
  let width = 0,
    height = 0;
  if (value.startsWith("data:image/png")) {
    if (
      bytes.length < 24 ||
      [137, 80, 78, 71, 13, 10, 26, 10].some((b, i) => bytes[i] !== b)
    )
      throw new Error("File PNG tidak valid.");
    const view = new DataView(bytes.buffer);
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else {
    if (bytes[0] !== 255 || bytes[1] !== 216)
      throw new Error("File JPEG tidak valid.");
    for (let i = 2; i + 9 < bytes.length;) {
      if (bytes[i++] !== 255) break;
      let marker = bytes[i++];
      while (marker === 255) marker = bytes[i++];
      if (marker === 217 || marker === 218) break;
      const size = bytes[i] * 256 + bytes[i + 1];
      if (size < 2) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker)
      ) {
        height = bytes[i + 3] * 256 + bytes[i + 4];
        width = bytes[i + 5] * 256 + bytes[i + 6];
        break;
      }
      i += size;
    }
  }
  if (!width || !height || width > 4096 || height > 4096)
    throw new Error("Dimensi logo harus 1–4096 piksel.");
  return { width, height };
}
