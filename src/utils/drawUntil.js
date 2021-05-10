import drawAction from './drawAction';

/**
 * Draw every action up till an index.
 */
export default (svg, actions, index, undoStack, draw = drawAction) => {
  const drawingActions = actions.filter((action, fi) =>
    action.action === 'draw' &&
    undoStack.indexOf(fi) === -1 &&
    fi <= index
  );

  for (let k = 0; k < drawingActions.length - 1; k++) {
    draw(svg, drawingActions[k]);
  }

  return null;
};
