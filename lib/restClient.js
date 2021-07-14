const { ClientError, ServerError } = require('./errors');

let _fetch;
if (typeof(fetch) === "undefined") {
  // eslint-disable-next-line global-require
  _fetch = require('node-fetch');
} else {
  // eslint-disable-next-line no-undef
  _fetch = fetch;
}
class RestClient {
  constructor(baseURL, endpoints) {
    const self = this;
    this._baseURL = baseURL;
    this._endpoints = endpoints;
    const badEndpoint = Object.keys(endpoints).find(name => name.match(/[^a-zA-Z0-9]/));
    if (badEndpoint) {
      throw new Error(`Invalid endpoint name ${badEndpoint}`);
    }
    const callable = Object.keys(endpoints).filter(name => !name.startsWith('_'));
    callable.forEach(endpoint => {
      self[endpoint] = async ({ args, context, auth }) => (
        self.call({ endpoint, args, context, auth })
      );
    });
  }

  _endpointDetails(endpoint) {
    const [path, method, ...transformFunctions] = this._endpoints[endpoint];
    const transforms = transformFunctions.map(t => this[t]);
    return { path, method, transforms };
  }

  _buildParameters(pathTemplate, args) {
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

  _determineURL(method, path, args) {
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

  _buildRequestOptions(method, args, auth) {
    const options = {
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

  _buildRequest(endpoint, args, auth) {
    const { path, method } = this._endpointDetails(endpoint);
    const { resolvedPath, remainingArgs } = this._buildParameters(path, args);
    const url = this._determineURL(method, resolvedPath, remainingArgs);
    const options = this._buildRequestOptions(method, remainingArgs, auth);
    return { url, options };
  }

  async _processResponse(response, transforms, context) {
    let result;
    if (response.status !== 204) { // no content
      result = await response.json();
    }
    if (response.status >= 500) {
      throw new ServerError(response.status);
    }
    if (response.status >= 400) {
      throw new ClientError(response.status);
    }
    return transforms.reduce((res, t) => t(res, context), result);
  }

  async call({ endpoint, args, context, auth = {} }) {
    const { url, options } = this._buildRequest(endpoint, args, auth);
    const response = await _fetch(url, options);
    const { transforms } = this._endpointDetails(endpoint);
    const fullContext = { ...args, ...context };
    return this._processResponse(response, transforms, fullContext);
  }
}

// It seems es-lint can't understand these being defined in the class.
RestClient.ClientError = ClientError;
RestClient.ServerError = ServerError;

module.exports = {
  RestClient,
};
