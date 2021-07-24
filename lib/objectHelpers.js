function isObject(value) {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

function objectMap(object, method) {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => method([key, value]))
  );
}

module.exports = {
  isObject,
  objectMap,
};
