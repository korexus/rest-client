import type nodeFetch from 'node-fetch';
import type { RequestInfo, RequestInit } from 'node-fetch';

let _fetch: typeof nodeFetch | typeof fetch;
if (typeof fetch === "undefined") {
  _fetch = ((url: RequestInfo, init: RequestInit | undefined) => (
    import('node-fetch').then(({default: f}) => f(url, init))
  )) as unknown as typeof nodeFetch;
} else {
  // eslint-disable-next-line no-undef
  _fetch = fetch;
}

export default _fetch;
export { Response } from 'node-fetch';
