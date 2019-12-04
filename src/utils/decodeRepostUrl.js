// Decode an obfuscated repost url.
export default string => {
  if (string.indexOf('http://') !== -1) {
    return null; // The required drawr API is broken.
  }

  const encodedRepost = string.split('!');

  const encoderArrayLength = parseInt(encodedRepost[0], 10);
  const encodedRepostUrl = encodedRepost[1];
  
  // Build the password map
  const encoderKey = encodedRepostUrl.slice(0, encoderArrayLength);
  const encoderArray = encoderKey.split('').sort();
  const repostPasswordMap = {};
  for (let i = 0; i < encoderKey.length; i++) {
      repostPasswordMap[encoderKey[i]] = encoderArray[i]
  }

  // Get repost url using password map
  const repostStr = encodedRepostUrl.slice(encoderArrayLength).split('');
  let repostImg = '';
  for (let i = 0; i < repostStr.length; i++) {
      // Look up character in password map, use plain character if no hit.
      repostImg += repostPasswordMap[repostStr[i]] || repostStr[i];
  }

  return repostImg;
}
