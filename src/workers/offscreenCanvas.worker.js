import drawAction from '../utils/drawAction';
import drawUntil from '../utils/drawUntil';

const CHUNK_SIZE = 100;

const _chunkArray = (array = [], chunkSize) =>
  array.length ? [array.slice(0, chunkSize), ..._chunkArray(array.slice(chunkSize), chunkSize)] : [];

/* eslint-disable no-restricted-globals */
self.addEventListener('message', e => {
  const { canvasDimensions, name, prevActions, actions, undoStack } = e.data;

  var offscreen = new OffscreenCanvas(canvasDimensions.width, canvasDimensions.height);
  const ctx = offscreen.getContext('2d');

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvasDimensions.width, canvasDimensions.height);

  if (prevActions.length) {
    drawUntil(ctx, prevActions, prevActions.length, undoStack);
  }

  // Chunk to force blob converting. Nukes memory if not chunked.
  const chunks = _chunkArray(actions, CHUNK_SIZE);

  const drawChunk = (chunkIndex) => new Promise((resolveChunk) => {
    const promises = chunks[chunkIndex].map((action, index) => new Promise((resolveAction) => {  
      switch (action.action) {
        case 'draw': {
          drawAction(ctx, action);
          break;
        }

        case 'undo': {
          const actionsIndex = index + (CHUNK_SIZE * chunkIndex) + prevActions.length;
          const totalActions = prevActions.concat(actions);

          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvasDimensions.width, canvasDimensions.height);
          drawUntil(ctx, totalActions, actionsIndex, undoStack);
          for (let i = actionsIndex; i >= 0; i--) {
            if (totalActions[i].action === 'draw' && undoStack.indexOf(i) === -1) {
              undoStack.push(i);
              break;
            }
          }
          break;
        }
  
        case 'redo': {
          const redoActionIndex = undoStack.pop();
          if (redoActionIndex >= 0) {
            const undoneAction = prevActions.concat(actions)[redoActionIndex];
            if (undoneAction) {
              drawAction(ctx, undoneAction);
            } else {
              console.warn('Redo action doesn\'t exist.')
            }
          } else {
            console.warn('Redo action but no correlated undo.');
          }
          break;
        }
  
        default: console.warn('Unknown action', action.action); break;
      }
  
      offscreen.convertToBlob()
        .then(blob => {
          action.frame = blob;
          resolveAction();
        })
        .catch(e => {
          console.error(e);
          action.frame = null;
          resolveAction();
        });
    }));

    Promise.all(promises).then(() => {
      if (chunkIndex === chunks.length -1) {
        self.postMessage({ name, actions, undoStack });
      } else {
        self.postMessage({ name, i: chunkIndex + 1, max: chunks.length });
        drawChunk(chunkIndex + 1)
          .then(resolveChunk);
      }
    });
  });

  drawChunk(0)
    .then((a) => {
      self.postMessage({ name, actions: a, undoStack });
    });
}, false);
/* eslint-enable no-restricted-globals */
