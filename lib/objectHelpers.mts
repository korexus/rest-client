export function isObject(value: unknown): boolean {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

export function objectMap(object: object, method: Function): object {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => method([key, value]))
  );
}
