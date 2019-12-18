const chunkArray = (array = [], chunkSize) =>
  array.length ? [array.slice(0, chunkSize), ...chunkArray(array.slice(chunkSize), chunkSize)] : [];

  export default chunkArray;
  