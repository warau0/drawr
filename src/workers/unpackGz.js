import unpackGz from '../utils/unpackGz';
import amfToCanvasActions from '../utils/amfToCanvasActions';

/* eslint-disable no-restricted-globals */
export default () => {
  self.addEventListener('message', e => {
    const { file, filterUndos } = e.data;

    unpackGz(file)
    .then(result => {
      const {
        dimensions,
        actions,
        repostUrl,
      } = amfToCanvasActions(result, filterUndos);
      const undos = actions.filter(a => a.action === 'undo').map(a => ({ value: a.id }));

      self.postMessage({
        name: file.name,
        dimensions,
        actions,
        undos,
        repostUrl,
        status: actions.length ? 'ready' : 'empty',
      });
    })
    .catch(e => {
      console.error('Bad input!', e);
      self.postMessage({
        name: file.name,
        status: 'error',
      });
    });
  }, false);
};
/* eslint-enable no-restricted-globals */
