import type nodeFetch from 'node-fetch';
import type { Response } from 'node-fetch';
import { ClientError, ServerError } from './errors';
import { isObject, objectMap } from './objectHelpers';

let _fetch: typeof nodeFetch | typeof fetch;
if (typeof(fetch) === "undefined") {
  import('node-fetch').then(m => { _fetch = m as unknown as typeof nodeFetch; });
} else {
  // eslint-disable-next-line no-undef
  _fetch = fetch;
}

type endpointNamePrefix = 'a'|'b'|'c'|'d'|'e'|'f'|'g'|'h'|'i'|'j'|'k'|'l'|'m'|'n'|'o'|'p'|'q'|'r'|'s'|'t'|'u'|'v'|'w'|'x'|'y'|'z';
type endpointName = `${endpointNamePrefix}${string}`;
type endpointPath = string;
type HTTPMethod = 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT';
type HTTPStatusCode = number;
type privatePropertyName = `_${string}`;
type transformName = privatePropertyName;
type errorHandlerName = privatePropertyName;
export type callContext = Record<string, any>

type handlerFunction = ((arg1: Response, arg2: callContext) => any) | ((arg1: Response) => any);
export type responseTransformFunctions = Array<handlerFunction>;
type errorHandlerFunctions = Record<HTTPStatusCode, handlerFunction>;

type endpointDefinition = [
  endpointPath,
  HTTPMethod,
  Array<transformName>?,
  Record<HTTPStatusCode, errorHandlerName>?,
]
type endpointDetails = {
  path: endpointPath,
  method: HTTPMethod,
  transforms: responseTransformFunctions,
  handlers: errorHandlerFunctions
};

export type clientEndpoints = Record<endpointName, endpointDefinition>;

type callArgs = Record<string, any>;
type callAuth = Record<string, string>;

type requestOptions = {
  method: HTTPMethod,
  mode: "cors",
  headers: {
    "content-type": "application/json",
    authorization?: string,
  },
  body?: string,
}

type request = {
  url: string,
  options: requestOptions,
}

export type callResponse = any;

export type genericApiRequest = {
  endpoint: endpointName,
  args?: callArgs,
  context?: callContext,
  auth?: callAuth,
};

export type apiRequest = {
  args?: callArgs,
  context?: callContext,
  auth?: callAuth,
};
export type callFunction = (call: apiRequest) => any;


class RestClient {
  [index: endpointName]: callFunction | ((call: genericApiRequest) => any);

  [index: privatePropertyName]: any;

  _baseURL: string;

  _endpoints: clientEndpoints;

  static ClientError: typeof ClientError;

  static ServerError: typeof ServerError;

  constructor(baseURL: string, endpoints: clientEndpoints) {
    this._baseURL = baseURL;
    this._validateEndpoints(endpoints);
    this._endpoints = endpoints;
    this._makeEndpointFunctions();
  }

  _validateEndpoints(endpoints: clientEndpoints) {
    Object.entries(endpoints).forEach(([endpoint, definition]) => {
      if (endpoint.match(/[^a-zA-Z0-9]/)) {
        throw new Error(`Invalid endpoint name ${endpoint}`);
      }

      const [path, method, transforms, errorHandlers] = definition;
      if (typeof path !== 'string' || !path.startsWith('/')) {
        throw new Error(`Invalid path ${path} for  ${endpoint}`);
      }

      if (!['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'].includes(method)) {
        throw new Error(`Unsupported method ${method} for  ${endpoint}`);
      }

      if (transforms && !Array.isArray(transforms)) {
        throw new Error(`Transforms should be a list of callables for ${endpoint}`);
      }

      if (errorHandlers) {
        if (!isObject(errorHandlers)) {
          throw new Error(`Error handlers should be an object of handlers for ${endpoint}`);
        }
        Object.keys(errorHandlers).forEach(errorCase => {
          const statusCode = parseInt(errorCase, 10);
          // https://fetch.spec.whatwg.org/#statuses
          if (Number.isNaN(statusCode) || statusCode < 0 || statusCode > 999) {
            throw new Error(`Error handler keys should be http status codes ${endpoint}`);
          }
        });
      }
    });
  }

  _makeEndpointFunctions() {
    Object.keys(this._endpoints).forEach(e => {
      const endpoint = e as endpointName;
      this[endpoint] = async ({ args, context, auth }: apiRequest) => (
        this.call({ endpoint, args, context, auth })
      );
    });
  }

  _endpointDetails(endpoint: endpointName): endpointDetails {
    const [path, method, transformFunctions, handlerFunctions] = this._endpoints[endpoint];
    const transforms = (transformFunctions || []).map(t => this[t]);
    const handlers = objectMap(handlerFunctions || {}, ([k, v]) => [k, this[v]]) as errorHandlerFunctions;
    return { path, method, transforms, handlers };
  }

  _buildParameters(pathTemplate: endpointPath, args?: callArgs) {
    let resolvedPath = pathTemplate;
    const remainingArgs = { ...args };
    const parameters = pathTemplate.match(/:[^/]+/g) || [];
    parameters.forEach(parameter => {
      const key = parameter.substring(1);
      if (remainingArgs[key] === undefined) {
        throw new Error(`Path parameter ${key} required in call to ${pathTemplate}`);
      }
      resolvedPath = resolvedPath.replace(parameter, remainingArgs[key]);
      delete remainingArgs[key];
    });

    return { resolvedPath, remainingArgs };
  }

  _determineURL(method: HTTPMethod, path: endpointPath, args: callArgs): string {
    // It would be more elegant to do new URL()
    // but that doesn't work in nativescript where this library is being used.
    let url = `${this._baseURL}${path}`;
    if (method === 'GET') {
      const qs = Object.entries(args).map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
      if (qs.length) {
        url = `${url}?${qs.join('&')}`;
      }
    }
    return url;
  }

  _buildRequestOptions(method: HTTPMethod, args?: callArgs, auth?: callAuth): requestOptions {
    const options: requestOptions = {
      method,
      mode: "cors",
      headers: {
        "content-type": "application/json",
      },
    };
    if (args && ['PATCH', 'POST', 'PUT'].includes(method)) {
      options.body = JSON.stringify(args);
    }
    if (auth && auth.jwt) {
      options.headers.authorization = `bearer ${auth.jwt}`;
    }
    return options;
  }

  _buildRequest(endpoint: endpointName, args?: callArgs, auth?: callAuth): request {
    const { path, method } = this._endpointDetails(endpoint);
    const { resolvedPath, remainingArgs } = this._buildParameters(path, args);
    const url = this._determineURL(method, resolvedPath, remainingArgs);
    const options = this._buildRequestOptions(method, remainingArgs, auth);
    return { url, options };
  }

  async _processResponse(
    response: callResponse,
    transforms: Array<handlerFunction>=[],
    handlers: Record<HTTPStatusCode, handlerFunction>={},
    context: callContext={},
  ) {
    let result;
    if (response.status !== 204) { // no content
      result = await response.json();
    }
    if (handlers[response.status]) {
      return handlers[response.status](result, context);
    }

    if (response.status >= 500) {
      throw new ServerError(response.status);
    }
    if (response.status >= 400) {
      throw new ClientError(response.status);
    }
    return transforms.reduce((res, t) => t(res, context), result);
  }

  async call({ endpoint, args, context, auth = {} }: genericApiRequest) {
    const { url, options } = this._buildRequest(endpoint, args, auth);
    const response = await _fetch(url, options);
    const { transforms, handlers } = this._endpointDetails(endpoint);
    const fullContext = { ...args, ...context };
    return this._processResponse(response, transforms, handlers, fullContext);
  }
}

RestClient.ClientError = ClientError;
RestClient.ServerError = ServerError;
export { RestClient };
