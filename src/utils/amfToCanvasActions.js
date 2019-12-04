import decodeRepostUrl from './decodeRepostUrl';
import intToRgbaColor from './intToRgbaColor';

// Extract useful actions from AMF action array.
export default (amfActions, startId = 0) => {
  let dimensions = null;
  let repostUrl = null;
  let actions = [];

  let currentAction = null;

  for (let i = 0; i < amfActions.length; i++) {
    const action = amfActions[i];

    if (action.penType && action.penType !== 'SQUARE' && action.penType !== 'CIRCLE') {
      console.warn('Unknown pen type', action.penType);
    }

    switch (action.mode) {
      case 'mdown': {
        // TODO: layers?
        currentAction = {
          id: actions.length + startId + 1,
          action: 'draw',
          brushSize: action.large || 1,
          brushType: 'round', // TODO: Square brush
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
        actions.push({ id: actions.length + startId + 1, action: 'undo' });
        break;
      }
      case 'redo': {
        actions.push({ id: actions.length + startId + 1, action: 'redo' });
        break;
      }
      case 'csize': {
        // TODO: What is this?
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
