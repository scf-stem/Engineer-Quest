/** Small Manhattan router for the four teaching cards. No electrical semantics. */
export function routeWire(from, to, obstacles) {
  const padding = 12;
  const boxes = obstacles.map(b => ({left: b.x - padding, right: b.x + b.width + padding, top: b.y - padding, bottom: b.y + b.height + padding}));
  const xs = [...new Set([from.exit.x, to.exit.x, ...boxes.flatMap(b => [b.left, b.right])])].sort((a, b) => a - b);
  const ys = [...new Set([from.exit.y, to.exit.y, ...boxes.flatMap(b => [b.top, b.bottom])])].sort((a, b) => a - b);
  const inside = p => boxes.some(b => p.x > b.left && p.x < b.right && p.y > b.top && p.y < b.bottom);
  const key = (x, y) => `${x},${y}`;
  const start = key(from.exit.x, from.exit.y), finish = key(to.exit.x, to.exit.y);
  const distances = new Map([[start, 0]]), previous = new Map(), queue = [{...from.exit, id: start, distance: 0}];
  let found = false;
  while (queue.length) {
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift();
    if (current.distance !== distances.get(current.id)) continue;
    if (current.id === finish) { found = true; break; }
    const ix = xs.indexOf(current.x), iy = ys.indexOf(current.y);
    for (const [nx, ny] of [[ix - 1, iy], [ix + 1, iy], [ix, iy - 1], [ix, iy + 1]]) {
      if (nx < 0 || ny < 0 || nx >= xs.length || ny >= ys.length) continue;
      const next = {x: xs[nx], y: ys[ny]};
      if (inside(next) || inside({x: (next.x + current.x) / 2, y: (next.y + current.y) / 2})) continue;
      const id = key(next.x, next.y), distance = current.distance + Math.abs(current.x - next.x) + Math.abs(current.y - next.y);
      if (distance >= (distances.get(id) ?? Infinity)) continue;
      distances.set(id, distance); previous.set(id, current); queue.push({...next, id, distance});
    }
  }
  const middle = [];
  if (found) {
    let current = {...to.exit, id: finish};
    while (current.id !== start) { middle.unshift({x: current.x, y: current.y}); current = previous.get(current.id); }
  } else middle.push(to.exit); // Overlapping cards can remove the free corridor.
  const points = [{x: from.x, y: from.y}, from.exit, ...middle, {x: to.x, y: to.y}];
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
}
