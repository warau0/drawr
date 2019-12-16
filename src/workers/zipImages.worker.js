import JSZip from 'jszip';

/* eslint-disable no-restricted-globals */
self.addEventListener('message', e => {
  const imgStack = e.data;
  const zip = new JSZip();

  for (let i = 0; i < imgStack.length; i++) {
    zip.file(`frame-${i + 1}.png`, imgStack[i], {base64: true});
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
