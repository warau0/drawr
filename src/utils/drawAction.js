// Draws a line based on a single action.
export default (ctx, action) => {
    // Start line
    ctx.beginPath();
    ctx.lineCap = action.brushType;
    ctx.lineWidth = action.brushSize;
    ctx.strokeStyle = action.color;

    // Plot every movement of the line
    for (let i = 1; i < action.path.length; i++) {
      ctx.moveTo(action.path[i - 1].x, action.path[i - 1].y);
      ctx.lineTo(action.path[i].x, action.path[i].y);
    }

    // Draw the line
    ctx.stroke();
}
