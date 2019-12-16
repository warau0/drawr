import decodeRepostUrl from './decodeRepostUrl';
import intToRgbaColor from './intToRgbaColor';

// Extract useful actions from AMF action array.
export default (amfActions, filterUndos = false) => {
  let dimensions = null;
  let repostUrl = null;
  let repostFile = null;
  let actions = [];

  let currentAction = null;
  const undoStack = [];

  for (let i = 0; i < amfActions.length; i++) {
    const action = amfActions[i];

    switch (action.mode) {
      case 'mdown': {
        currentAction = {
          action: 'draw',
          brushSize: action.large || 1,
          // Canvas lineCap's butt and square look terrible, round is the most accurate by far.
          brushType: 'round', // action.penType: SQUARE / CIRCLE
          color: intToRgbaColor(action.color, action.alpha),
          path: [{ x: action.x, y: action.y }],
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
          actions.push({ action: 'undo' });
        }
        break;
      }
      case 'redo': {
        if (filterUndos) {
          actions.push(undoStack.pop());
        } else {
          actions.push({ action: 'redo' });
        }
        break;
      }
      case 'csize': {
        break;
      }
      case 'repost': {
        repostUrl = decodeRepostUrl(action.color);
        const repostSplit = repostUrl.split('/');
        repostFile = repostSplit[repostSplit.length - 1].replace('.png', '.gz');
        break;
      }
      case 'start': {
        dimensions = {
            width: action.width,
            height: action.height,
        };
        break;
      }
      default: console.warn('Unknown action', action); break;
    }
  }

  return {
    dimensions,
    actions,
    repostUrl,
    repostFile,
  };
}
