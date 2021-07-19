function objectMap(object, method) {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => method([key, value]))
  );
}

module.exports = {
  objectMap,
};
