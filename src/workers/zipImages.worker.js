import JSZip from 'jszip';

/* eslint-disable no-restricted-globals */
self.addEventListener('message', e => {
  const frames = e.data;
  const zip = new JSZip();

  for (let i = 0; i < frames.length; i++) {
    if (frames[i].frame) {
      zip.file(`frame-${i + 1}.png`, frames[i].frame, { type: 'blob' });
    }
  }

  zip.generateAsync({ type: 'blob' }).then(content => {
    self.postMessage(content);
  })
  .catch(e => {
    self.postMessage(null);
    console.error(e);
  });
}, false);
/* eslint-enable no-restricted-globals */
