/** Soft pastel nature palette. Mirrored as CSS variables in styles/main.css. */
export type RGB = [number, number, number];

export const PALETTE = {
  // terrain
  lush: [118, 192, 104] as RGB,
  green: [150, 204, 112] as RGB,
  dry: [218, 210, 128] as RGB,
  straw: [226, 196, 126] as RGB,
  soil: [190, 152, 108] as RGB,
  soilDark: [164, 128, 92] as RGB,
  water: [126, 194, 226] as RGB,
  waterDeep: [96, 168, 214] as RGB,
  waterFoam: [226, 244, 252] as RGB,
  ford: [168, 214, 226] as RGB,
  trunk: [138, 102, 76] as RGB,
  leaf: [92, 160, 104] as RGB,
  leafLight: [130, 192, 118] as RGB,
  leafDark: [70, 132, 92] as RGB,
  bush: [108, 172, 100] as RGB,
  bushLight: [150, 200, 120] as RGB,
  berry: [232, 120, 130] as RGB,
  flower: [[250, 214, 120], [246, 168, 190], [200, 178, 240], [255, 255, 255]] as RGB[],
  // animals
  fur: [240, 232, 220] as RGB,
  furShade: [214, 198, 182] as RGB,
  earIn: [244, 180, 186] as RGB,
  wolf: [132, 150, 176] as RGB,
  wolfDark: [96, 112, 140] as RGB,
  wolfLight: [206, 214, 226] as RGB,
  ink: [58, 66, 62] as RGB,
  // status
  healthy: '#4fae5c',
  hungry: '#e5a72c',
  starving: '#d9534a',
  // chart series
  seriesPlant: '#5fae5a',
  seriesRabbit: '#c98b4e',
  seriesWolf: '#5f7fae',
  night: [24, 34, 82] as RGB,
};

export function rgb(c: RGB, a = 1): string {
  return a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** plant % → ground colour (bare soil → straw → dry → green → lush) */
export function plantColor(p: number, out: RGB = [0, 0, 0]): RGB {
  const P = PALETTE;
  let a: RGB, b: RGB, t: number;
  if (p < 8) { a = P.soilDark; b = P.soil; t = p / 8; }
  else if (p < 25) { a = P.soil; b = P.straw; t = (p - 8) / 17; }
  else if (p < 45) { a = P.straw; b = P.dry; t = (p - 25) / 20; }
  else if (p < 70) { a = P.dry; b = P.green; t = (p - 45) / 25; }
  else { a = P.green; b = P.lush; t = Math.min(1, (p - 70) / 30); }
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}
