export default(a, b) =>
  a.name.toLowerCase().replace('_', '')
  .localeCompare(b.name.toLowerCase().replace('_', ''));
