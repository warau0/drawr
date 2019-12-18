import JSZip from 'jszip';
import chunkArray from '../utils/chunkArray';

const CHUNK_SIZE = 3000;

/* eslint-disable no-restricted-globals */
self.addEventListener('message', e => {
  const { frames, name } = e.data;
  
  const chunks = chunkArray(frames, CHUNK_SIZE);
  
  const zipChunk = (chunkIndex) => {
    const zip = new JSZip();

    if (!chunkIndex) {
      // Final image duplicated as first for video thumbnail.
      zip.file('frame-0.png', chunks[chunks.length - 1][chunks[chunks.length - 1].length - 1].frame, { type: 'blob' });      
    }

    for (let i = 0; i < chunks[chunkIndex].length; i++) {
      if (chunks[chunkIndex][i].frame) {
        zip.file(`frame-${i + (CHUNK_SIZE * chunkIndex) + 1}.png`, chunks[chunkIndex][i].frame, { type: 'blob' });
      }
    }

    zip.generateAsync({ type: 'blob' }).then(content => {
      const chunkZipName = chunks.length > 1 ? `${name}-${chunkIndex + 1}` : name;
      self.postMessage({ content, name: `${chunkZipName}.zip`, done: chunkIndex === chunks.length -1 })

      if (chunkIndex !== chunks.length -1) {
        zipChunk(chunkIndex + 1);
      }
    })
    .catch(e => {
      console.error(e);
      self.postMessage({ done: true });
    });
  };

  zipChunk(0);
}, false);
/* eslint-enable no-restricted-globals */
