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
      self[endpoint] = async ({ user, args, context }) => (
        self.call({ user, endpoint, args, context })
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

  _buildRequestOptions(method, args, additionalOptions) {
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
    if (additionalOptions && additionalOptions.jwt) {
      options.headers.authorization = `bearer ${additionalOptions.jwt}`;
    }
    return options;
  }

  async _call(endpoint, args, additionalOptions, context) {
    const { path, method, transforms } = this._endpointDetails(endpoint);
    const { resolvedPath, remainingArgs } = this._buildParameters(path, args);
    const url = this._determineURL(method, resolvedPath, remainingArgs);
    const options = this._buildRequestOptions(method, remainingArgs, additionalOptions);
    const response = await _fetch(url, options);
    let result;
    if (response.status !== 204) { // no content
      result = await response.json();
    }
    return transforms.reduce((res, t) => t(res, context), result);
  }

  async call({ user, endpoint, args, context }) {
    let additionalOptions = {};
    if (user) {
      const auth = await user.getAuth();
      additionalOptions = { ...additionalOptions, ...auth };
    }
    const fullContext = { user, ...args, ...context };
    return this._call(endpoint, args, additionalOptions, fullContext);
  }  
}

module.exports = {
  RestClient,
};
