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
    } = amfToCanvasActions(file.name, result, filterUndos);

    self.postMessage({
      name: file.name,
      dimensions,
      actions,
      repostUrl,
      status: actions.length ? 'ready' : 'empty',
    });
  })
  .catch(e => {
    console.error('Bad input!', e);
    self.postMessage({
      name: file.name,
      dimensions: null,
      actions: [],
      repostUrl: null,
      status: 'error',
    });
  });
}, false);
/* eslint-enable no-restricted-globals */
