/**
 * Projects a point onto the circumference
 * of a circle with given centre and radius.
 * @param  {Object} point     Point to project with x and y properties.
 * @param  {Object} centre    Circle centre with x and y properties.
 * @param  {number} r         Circle radius.
 * @return {Object}           Projected point with x and y properties.
 */
export function projectOnCircle(point, centre, r) {
  // 1) Get a vector v from circle to point:
  const v = [point.x - centre.x, point.y - centre.y];

  // 2) Get the magnitude:
  const m = Math.sqrt(v[0] ** 2 + v[1] ** 2);

  // 3) Normalise the vector:
  const n = v.map(d => d / m);

  // 4) Maultiply n by the radius
  const nr = n.map(d => d * r);

  // 5) Add it to the original point to get the projected vector p:
  const p = { x: centre.x + nr[0], y: centre.y + nr[1] };

  return p;
}
