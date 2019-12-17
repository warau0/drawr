import drawAction from '../utils/drawAction';
import drawUntil from '../utils/drawUntil';

const CHUNK_SIZE = 100;

const _chunkArray = (array = [], chunkSize) =>
  array.length ? [array.slice(0, chunkSize), ..._chunkArray(array.slice(chunkSize), chunkSize)] : [];

/* eslint-disable no-restricted-globals */
self.addEventListener('message', e => {
  const { canvasDimensions, name, actions, init } = e.data;
  const undoStack = [];

  var offscreen = new OffscreenCanvas(canvasDimensions.width, canvasDimensions.height);
  const ctx = offscreen.getContext('2d');

  if (init) {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasDimensions.width, canvasDimensions.height);
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
          const actionsIndex = index + (CHUNK_SIZE * chunkIndex);
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvasDimensions.width, canvasDimensions.height);
          drawUntil(ctx, actions, actionsIndex, undoStack);
          let lastDrawingIndex = null;
          for (let i = actionsIndex; i >= 0; i--) {
            if (actions[i].action === 'draw' && undoStack.indexOf(i) === -1) {
              lastDrawingIndex = i;
              break;
            }
          }
          undoStack.push(lastDrawingIndex);
          break;
        }
  
        case 'redo': {
          const redoActionIndex = undoStack.pop();
          if (redoActionIndex >= 0) {
            const undoneAction = actions[redoActionIndex];
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
        self.postMessage({ name, actions })
      } else {
        self.postMessage({ name, i: chunkIndex + 1, max: chunks.length });
        drawChunk(chunkIndex + 1)
          .then(resolveChunk);
      }
    });
  });

  drawChunk(0)
    .then((a) => {
      self.postMessage({ name, actions: a });
    });
}, false);
/* eslint-enable no-restricted-globals */
