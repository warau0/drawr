export default files => {
  let sorted = files.slice();

  sorted.sort((a, b) => {
    const firstName = a.name.toLowerCase().replace('_', '')
    const secondName = b.name.toLowerCase().replace('_', '')
    return firstName.localeCompare(secondName);
  });

  return sorted;
};
