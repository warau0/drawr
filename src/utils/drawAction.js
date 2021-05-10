/**
 * Draws a line based on a single action.
 */
export default (svg, action) => {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  path.setAttributeNS(null, 'stroke', action.color);
  path.setAttributeNS(null, 'stroke-width', action.brushSize);
  path.setAttributeNS(null, 'stroke-linecap', action.brushType);
  path.setAttributeNS(null, 'stroke-linejoin', action.brushType);
  path.setAttributeNS(null, 'd', action.path);
  path.setAttributeNS(null, 'fill', 'none');

  svg.appendChild(path);
}
