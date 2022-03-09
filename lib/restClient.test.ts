/* eslint max-classes-per-file: 0 */
/* eslint lines-between-class-members: 0 */
/* eslint-disable @typescript-eslint/no-empty-function */
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { Response as FetchResponse } from 'node-fetch';
import { RestClient, clientEndpoints, responseTransformFunctions } from './restClient';

chai.use(chaiAsPromised);
const { expect } = chai;


describe('Rest Client', () => {
  const baseURL = 'https://example.com';

  describe('constructor', () => {
    it('should allow a client with an empty endpoint definition', () => {
      expect(() => new RestClient(baseURL, {})).not.to.throw();
    });
  
    it('should allow a client with endpoints definition', () => {
      const endpoints = {
        test: ['/tests', 'GET'],
      } as clientEndpoints;
      expect(() => new RestClient(baseURL, endpoints)).not.to.throw();
    });

    it('should create functions for defined endpoints', () => {
      const endpoints = {
        test: ['/tests', 'GET'],
      } as clientEndpoints;
      const testClient = new RestClient(baseURL, endpoints);
      expect(typeof testClient.test).to.equal("function");
    });

    describe('endpoint validation', () => {
      it('should accept a valid endpoint definition', () => {
        const endpoints = {
          test: ['/tests', 'GET', ['transformFunc'], { 400: 'errorFunc' }],
        } as clientEndpoints;
        expect(() => new RestClient(baseURL, endpoints)).not.to.throw();  
      });  

      it('should not allow a client with private endpoints', () => {
        const endpoints = {
          _test: ['/tests', 'GET'],
        } as clientEndpoints;
        expect(() => new RestClient(baseURL, endpoints)).to.throw();
      });
    
      it('should not allow a client with hard to invoke endpoints', () => {
        const endpoints = {
          'two words': ['/tests', 'GET'],
        } as clientEndpoints;
        expect(() => new RestClient(baseURL, endpoints)).to.throw();
      });

      it('should not allow an unrecognised http method', () => {
        const endpoints = {
          test: ['/tests', 'CHECK'],
        } as unknown as clientEndpoints;
        expect(() => new RestClient(baseURL, endpoints)).to.throw();  
      });

      it('should require transforms to be a list if they are provided', () => {
        const endpoints = {
          test: ['/tests', 'GET', 'transformFunc'],
        } as unknown as clientEndpoints;
        expect(() => new RestClient(baseURL, endpoints)).to.throw();  
      });

      it('should require error handlers to be an object if they are provided', () => {
        const endpoints = {
          test: ['/tests', 'GET', [], []],
        } as clientEndpoints;
        expect(() => new RestClient(baseURL, endpoints)).to.throw();  
      });

      it('should require error handler keys to http status codes', () => {
        const endpoints = {
          test: ['/tests', 'GET', [], { 1000: 'errorFunc' }],
        } as clientEndpoints;
        expect(() => new RestClient(baseURL, endpoints)).to.throw();  
      });
    });
  });

  describe('_endpointDetails', () => {
    it('should retrieve path and method for an endpoint', () => {
      const endpoints = {
        test: ['/tests', 'GET'],
      } as clientEndpoints;
      const testClient = new RestClient(baseURL, endpoints);
      const { path, method } = testClient._endpointDetails('test');
      expect(path).to.equal('/tests');
      expect(method).to.equal('GET');
    });

    it('should find the right endpoint', () => {
      const endpoints = {
        testsList: ['/tests', 'GET'],
        testCreate: ['/tests', 'POST'],
        testsRemove: ['/tests', 'DELETE'],
      } as clientEndpoints;
      const testClient = new RestClient(baseURL, endpoints);
      const { path, method } = testClient._endpointDetails('testCreate');
      expect(path).to.equal('/tests');
      expect(method).to.equal('POST');
    });

    it('should maintain path parameters', () => {
      const endpoints = {
        testInfo: ['/tests/:testId', 'GET'],
      } as clientEndpoints;
      const testClient = new RestClient(baseURL, endpoints);
      const { path, method } = testClient._endpointDetails('testInfo');
      expect(path).to.equal('/tests/:testId');
      expect(method).to.equal('GET');
    });

    it('should return the user specified transformation', () => {
      class TestClient extends RestClient {
        _ignoreResult() { }
      }
      const endpoints = {
        test: ['/tests', 'GET', ['_ignoreResult']]
      } as clientEndpoints;

      const testClient = new TestClient(baseURL, endpoints);
      const { transforms } = testClient._endpointDetails('test');
      expect(transforms).to.deep.equal([testClient._ignoreResult]);
    });

    it('should allow multiple user specified transformations', () => {
      class TestClient extends RestClient {
        _transformOne() { }
        _transformTwo() { }
      }
      const endpoints = {
        test: ['/tests', 'GET', ['_transformOne', '_transformTwo']]
      } as clientEndpoints;

      const testClient = new TestClient(baseURL, endpoints);
      const { transforms } = testClient._endpointDetails('test');
      expect(transforms).to.deep.equal([
        testClient._transformOne,
        testClient._transformTwo,
      ]);
    });

    it('should return the user specified error handlers', () => {
      class TestClient extends RestClient {
        _ignoreResult() { }
      }
      const endpoints = {
        test: ['/tests', 'GET', [], { 404: '_ignoreResult' }]
      } as clientEndpoints;

      const testClient = new TestClient(baseURL, endpoints);
      const { handlers } = testClient._endpointDetails('test');
      expect(handlers).to.deep.equal({ 404: testClient._ignoreResult });
    });
  });

  describe('_buildParameters', () => {
    const testClient = new RestClient(baseURL, {});

    it('should return simple paths as they are', () => {
      const { resolvedPath } = testClient._buildParameters(
        '/tests',
        {},
      );
      expect(resolvedPath).to.equal('/tests');
    });

    it('should return all arguments if they are not used in the path', () => {
      const { remainingArgs } = testClient._buildParameters(
        '/tests',
        { a: 1, b: 2},
      );
      expect(remainingArgs).to.deep.equal({ a: 1, b: 2 });
    });

    it('should interpolate an argument into the path', () => {
      const { resolvedPath } = testClient._buildParameters(
        '/users/:userId',
        { userId: 123 },
      );
      expect(resolvedPath).to.equal('/users/123');
    });

    it('should interpolate multiple arguments into the path', () => {
      const { resolvedPath } = testClient._buildParameters(
        '/users/:userId/:otherParam',
        { userId: 123, otherParam: 'hello' },
      );
      expect(resolvedPath).to.equal('/users/123/hello');
    });

    it('should consume used arguments', () => {
      const { remainingArgs } = testClient._buildParameters(
        '/users/:userId/:otherParam',
        { userId: 123, otherParam: 'hello' },
      );
      expect(remainingArgs).to.deep.equal({});
    });

    it('should return unused arguments', () => {
      const { remainingArgs } = testClient._buildParameters(
        '/users/:userId',
        { userId: 123, otherParam: 'hello' },
      );
      expect(remainingArgs).to.deep.equal({ otherParam: 'hello' });
    });

    it('should error if a path parameter is absent', () => {
      const path ='/users/:userId/:otherParam';
      const args = { userId: 123 };
      expect(() => testClient._buildParameters(path, args)).to.throw(Error);
    });
  });

  describe('_determineURL', () => {
    const testClient = new RestClient('https://example.com', {});

    it('should include the base url and path', () => {
      const url = testClient._determineURL('GET', '/tests', {});
      expect(url).to.equal('https://example.com/tests');
    });

    it('should include a query string for GET parameters', () => {
      const url = testClient._determineURL('GET', '/tests', { a: 1 });
      expect(url).to.equal('https://example.com/tests?a=1');
    });

    it('should not include a query string for POST requests', () => {
      const url = testClient._determineURL('POST', '/tests', { a: 1 });
      expect(url).to.equal('https://example.com/tests');
    });
  });

  describe('_bulidRequestOptions', () => {
    const testClient = new RestClient('https://example.com', {});

    it('should return basic options', () => {
      const { mode, headers } = testClient._buildRequestOptions('GET', null, null);
      expect(mode).to.equal("cors");
      expect(headers).to.deep.equal({ "content-type": "application/json" });
    });

    it('should return a GET method for GET requests', () => {
      const { method } = testClient._buildRequestOptions('GET', null, null);
      expect(method).to.equal("GET");
    });

    it('should return a POST method for POST requests', () => {
      const { method } = testClient._buildRequestOptions('POST', null, null);
      expect(method).to.equal("POST");
    });

    it('should specify a JSON body for POST requests with arguments', () => {
      const { body } = testClient._buildRequestOptions('POST', { a: 1 }, null);
      expect(body).to.deep.equal('{"a":1}');
    });
    
    it('should not specify a JSON body for POST requests without arguments', () => {
      const { body } = testClient._buildRequestOptions('POST', null, null);
      expect(body).to.equal(undefined);
    });

    it('should not specify a JSON body for GET requests with arguments', () => {
      const { body } = testClient._buildRequestOptions('GET', { a: 1 }, null);
      expect(body).to.equal(undefined);
    });

    it('should provide a bearer Authorization header if a jwt is provided', () => {
      const jwt = "This is my JWT";
      const { headers } = testClient._buildRequestOptions('GET', null, { jwt });
      expect(headers.authorization).to.equal('bearer This is my JWT');
    });
  });

  describe('_processResponse', () => {
    const testClient = new RestClient('https://example.com', {});

    function generateResponse(statusCode: number, content?: object) {
      return new FetchResponse(JSON.stringify(content), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    describe('Successes', () => {
      it('should return undefined for a no content response', async () => {
        const response = generateResponse(204);
        const transforms: responseTransformFunctions = [];
        const result = await testClient._processResponse(
          response,
          transforms,
        );
        expect(result).to.be.undefined;
      });

      it('should return the JSON from a success response', async () => {
        const response = generateResponse(200, { key: "value" });
        const transforms: responseTransformFunctions = [];
        const result = await testClient._processResponse(
          response,
          transforms,
        );
        expect(result).to.deep.equal({ key: "value" });
      });

      it('should apply a transform', async () => {
        const response = generateResponse(200, { key: "value" });
        const ignoreResult = () => ({});
        const transforms = [ignoreResult];
        const result = await testClient._processResponse(
          response,
          transforms,
        );
        expect(result).to.deep.equal({});
      });

      it('should apply all transforms in order', async () => {
        const response = generateResponse(200, { value: 1 });
        const transforms = [
          ({ value }) => ({ value: value + 2 }),
          ({ value }) => ({ value: value * 3 }),
        ];
        const result = await testClient._processResponse(
          response,
          transforms,
        );
        expect(result).to.deep.equal({ value: 9 });
      });

      it('should apply a transform with context', async () => {
        const response = generateResponse(200, { key: "value" });
        const addFromContext = (res, con) => ({ ...res, ...con});
        const transforms = [addFromContext];
        const handlers = {};
        const context = { otherKey: "otherValue" };

        const result = await testClient._processResponse(
          response,
          transforms,
          handlers,
          context,
        );

        expect(result).to.deep.equal({
          key: "value",
          otherKey: "otherValue"
        });
      });

    });

    describe('Default Errors', () => {
      const { ClientError, ServerError } = RestClient;

      it('should throw a Bad Request error if there is a 400 response', async () => {
        const response = generateResponse(400, {});
        const transforms: responseTransformFunctions = [];
        const result = testClient._processResponse(response, transforms);
        await expect(result).to.be.rejectedWith(ClientError, "Bad Request");
      });

      it('should throw a Unauthorised error if there is a 401 response', async () => {
        const response = generateResponse(401, {});
        const transforms: responseTransformFunctions = [];
        const result = testClient._processResponse(response, transforms);
        await expect(result).to.be.rejectedWith(ClientError, "Unauthorised");
      });

      it('should throw a Forbidden error if there is a 403 response', async () => {
        const response = generateResponse(403, {});
        const transforms: responseTransformFunctions = [];
        const result = testClient._processResponse(response, transforms);
        await expect(result).to.be.rejectedWith(ClientError, "Forbidden");
      });

      it('should throw a Not Found error if there is a 404 response', async () => {
        const response = generateResponse(404, {});
        const transforms: responseTransformFunctions = [];
        const result = testClient._processResponse(response, transforms);
        await expect(result).to.be.rejectedWith(ClientError, "Not Found");
      });

      it('should throw a Method Not Allowed error if there is a 405 response', async () => {
        const response = generateResponse(405, {});
        const transforms: responseTransformFunctions = [];
        const result = testClient._processResponse(response, transforms);
        await expect(result).to.be.rejectedWith(ClientError, "Method Not Allowed");
      });

      it('should throw a Conflict error if there is a 409 response', async () => {
        const response = generateResponse(409, {});
        const transforms: responseTransformFunctions = [];
        const result = testClient._processResponse(response, transforms);
        await expect(result).to.be.rejectedWith(ClientError, "Conflict");
      });

      it('should throw a Payload Too Large error if there is a 413 response', async () => {
        const response = generateResponse(413, {});
        const transforms: responseTransformFunctions = [];
        const result = testClient._processResponse(response, transforms);
        await expect(result).to.be.rejectedWith(ClientError, "Payload Too Large");
      });

      it('should throw a Too Many Requests error if there is a 429 response', async () => {
        const response = generateResponse(429, {});
        const transforms: responseTransformFunctions = [];
        const result = testClient._processResponse(response, transforms);
        await expect(result).to.be.rejectedWith(ClientError, "Too Many Requests");
      });

      it('should throw an Internal Server Error if there is a 500 response', async () => {
        const response = generateResponse(500, {});
        const transforms: responseTransformFunctions = [];
        const result = testClient._processResponse(response, transforms);
        await expect(result).to.be.rejectedWith(ServerError, "Internal Server Error");
      });

      it('should throw a Bad Gateway error if there is a 502 response', async () => {
        const response = generateResponse(502, {});
        const transforms: responseTransformFunctions = [];
        const result = testClient._processResponse(response, transforms);
        await expect(result).to.be.rejectedWith(ServerError, "Bad Gateway");
      });

      it('should throw a Service Unavailable error if there is a 503 response', async () => {
        const response = generateResponse(503, {});
        const transforms: responseTransformFunctions = [];
        const result = testClient._processResponse(response, transforms);
        await expect(result).to.be.rejectedWith(ServerError, "Service Unavailable");
      });

      it('should throw a Gateway Timeout error if there is a 504 response', async () => {
        const response = generateResponse(504, {});
        const transforms: responseTransformFunctions = [];
        const result = testClient._processResponse(response, transforms);
        await expect(result).to.be.rejectedWith(ServerError, "Gateway Timeout");
      });
    });

    describe('Custom Error Handlers', () => {
      it('should use the defined handler for an error', async () => {
        const response = generateResponse(400, {});
        const transforms: responseTransformFunctions = [];
        const handlers = { 400: () => ({ success: false, errorCode: 400 })};
        const result = await testClient._processResponse(response, transforms, handlers);
        expect(result).to.deep.equal({ success: false, errorCode: 400 });
      });

      it('should not use the handler defined for a different error', async () => {
        const response = generateResponse(401, {});
        const transforms: responseTransformFunctions = [];
        const handlers = { 400: () => ({ success: false, errorCode: 400 })};
        const result = testClient._processResponse(response, transforms, handlers);
        await expect(result).to.be.rejectedWith(RestClient.ClientError, "Unauthorised");
      });

      it('should pass the response body to the error handler', async() => {
        const response = generateResponse(404, { message: "This is an expected result" });
        const transforms: responseTransformFunctions = [];
        const handlers = { 404: (responseBody) => responseBody.message };
        const result = await testClient._processResponse(response, transforms, handlers);
        expect(result).to.deep.equal("This is an expected result");
      });

      it('should pass the response body to the error handler', async() => {
        const response = generateResponse(404, {});
        const transforms: responseTransformFunctions = [];
        const handlers = { 404: (responseBody, context) => context.caller };
        const context = { caller: "Some user" };
        const result = await testClient._processResponse(response, transforms, handlers, context);
        expect(result).to.deep.equal("Some user");
      });
    });
  });
});
