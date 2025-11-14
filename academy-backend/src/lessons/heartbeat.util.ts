export type Seg = [number, number]; // [start,end)

export function mergeSeg(arr: Seg[], seg: Seg) {
  if (seg[1] <= seg[0]) return arr;
  const res = [...arr, seg].sort((a, b) => a[0] - b[0]);
  const out: Seg[] = [];
  for (const cur of res) {
    if (!out.length || cur[0] > out[out.length - 1][1])
      out.push([...cur] as Seg);
    else out[out.length - 1][1] = Math.max(out[out.length - 1][1], cur[1]);
  }
  return out;
}

export const sumDistinct = (arr: Seg[]) =>
  arr.reduce((s, [a, b]) => s + Math.max(0, b - a), 0);
