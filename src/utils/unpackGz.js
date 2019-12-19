import Amf from 'amf-js';
import Pako from 'pako';

/**
 * Unpack and serialize a deflated AMF file.
 */
export default file => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = (event) => {
      try {
        const intBinaryBuffer = Pako.inflate(event.target.result);
        const actionsObject = Amf.deserialize(intBinaryBuffer.buffer);
        resolve(Object.keys(actionsObject).map((key) =>
          ({ ...actionsObject[key] }),
        ));
      } catch (e) {
        reject(e);
      }
    }
  });
}
