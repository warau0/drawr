/**
 * Convert a hex color in base 10 to an rgba color.
 */
export default (color, alpha) => {
  const hex = !color || color === 0 ? `000000` : `${color.toString(16)}`;

  let r = parseInt(hex.slice(0, 2), 16);
  let g = parseInt(hex.slice(2, 4), 16);
  let b = parseInt(hex.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha === 100 ? 1 : alpha})`;
}
