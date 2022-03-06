export function isObject(value: unknown): value is object {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

export function objectMap(object: object, method: ([string, any]) => any): object {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => method([key, value]))
  );
}
