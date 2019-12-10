import decodeRepostUrl from './decodeRepostUrl';
import intToRgbaColor from './intToRgbaColor';

// Extract useful actions from AMF action array.
export default (amfActions, startId = 0, filterUndos = false) => {
  let dimensions = null;
  let repostUrl = null;
  let actions = [];

  let currentAction = null;
  const undoStack = [];

  for (let i = 0; i < amfActions.length; i++) {
    const action = amfActions[i];

    switch (action.mode) {
      case 'mdown': {
        currentAction = {
          id: actions.length + startId + 1,
          action: 'draw',
          brushSize: action.large || 1,
          brushType: 'round', // TODO action.penType: empty (CIRCLE) / SQUARE / CIRCLE
          color: intToRgbaColor(action.color, action.alpha),
          path: [{ x: action.x, y: action.y }],
          // action.layer needed?
        }
        break;
      }
      case 'mmove': {
        currentAction.path.push({ x: action.x, y: action.y});
        break;
      }
      case 'mup': {
        actions.push(currentAction);
        break;
      }
      case 'undo': {
        if (filterUndos) {
          undoStack.push(actions.pop());
        } else {
          actions.push({ id: actions.length + startId + 1, action: 'undo' });
        }
        break;
      }
      case 'redo': {
        if (filterUndos) {
          actions.push(undoStack.pop());
        } else {
          actions.push({ id: actions.length + startId + 1, action: 'redo' });
        }
        break;
      }
      case 'csize': {
        // TODO What does csize do?
        break;
      }
      case 'repost': {
        repostUrl = decodeRepostUrl(action.color);
        break;
      }
      case 'start': {
        dimensions = {
            width: action.width,
            height: action.height,
        };
        break;
      }
      default: console.log('Unknown action', action); break;
    }
  }

  return {
    dimensions,
    actions,
    repostUrl,
  };
}
