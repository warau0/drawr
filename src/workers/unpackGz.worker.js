import unpackGz from '../utils/unpackGz';
import amfToCanvasActions from '../utils/amfToCanvasActions';

/* eslint-disable no-restricted-globals */
self.addEventListener('message', e => {
  const { file, filterUndos } = e.data;

  unpackGz(file)
  .then(result => {
    const {
      dimensions,
      actions,
      repostUrl,
      repostFile,
    } = amfToCanvasActions(result, filterUndos);

    self.postMessage({
      name: file.name,
      dimensions,
      actions,
      repostUrl,
      repostFile,
      status: actions.length ? 'ready' : 'empty',
    });
  })
  .catch(e => {
    console.error('Bad file!', e);
    self.postMessage({
      name: file.name,
      dimensions: null,
      actions: [],
      repostUrl: null,
      repostFile: null,
      status: 'error',
    });
  });
}, false);
/* eslint-enable no-restricted-globals */
