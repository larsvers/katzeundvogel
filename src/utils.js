// Utility functions.
export function el(id) {
  return document.getElementById(id);
}
export function each(a, f) {
  for (let i = 0, l = a.length; i < l; i++) f(a[i], i);
}
export function padd(p1, p2) {
  return { x: p1.x + p2.x, y: p1.y + p2.y, z: p1.z + p2.z };
}
export function paddto(p1, p2) {
  p1.x += p2.x;
  p1.y += p2.y;
  p1.z += p2.z;
}
export function psub(p1, p2) {
  return { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
}
export function psubfrom(p1, p2) {
  p1.x -= p2.x;
  p1.y -= p2.y;
  p1.z -= p2.z;
}
export function pmul(p, c) {
  return { x: p.x * c, y: p.y * c, z: p.z * c };
}
export function pmulby(p, c) {
  p.x *= c;
  p.y *= c;
  p.z *= c;
}
export function metric(p1, p2) {
  let dx = p1.x - p2.x,
    dy = p1.y - p2.y,
    dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
export function magnitude(p) {
  return metric(p, { x: 0, y: 0, z: 0 });
}
export function near(p1, p2, r) {
  return metric(p1, p2) <= r;
}
export function yz(p) {
  return { x: 0, y: p.y, z: p.z };
}

// Draw helpers.
export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fill();
}
export function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.closePath();
  ctx.stroke();
}
