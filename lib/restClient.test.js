/* eslint max-classes-per-file: 0 */
/* eslint lines-between-class-members: 0 */
const { expect } = require('chai');
const { RestClient } = require('./restClient');

describe('Rest Client', () => {
  const baseURL = 'https://example.com';

  describe('constructor', () => {
    it('should allow a client with an empty endpoint definition', () => {
      expect(() => new RestClient(baseURL, {})).not.to.throw();
    });
  
    it('should allow a client with endpoints definition', () => {
      const endpoints = {
        test: ['/tests', 'GET'],
      }
      expect(() => new RestClient(baseURL, endpoints)).not.to.throw();
    });

    it('should create functions for defined endpoints', () => {
      const endpoints = {
        test: ['/tests', 'GET'],
      }
      const testClient = new RestClient(baseURL, endpoints)
      expect(typeof testClient.test).to.equal("function");
    });

    it('should not allow a client with private endpoints', () => {
      const endpoints = {
        _test: ['/tests', 'GET'],
      }
      expect(() => new RestClient(baseURL, endpoints)).to.throw();
    });
  
    it('should not allow a client with hard to invoke endpoints', () => {
      const endpoints = {
        'two words': ['/tests', 'GET'],
      }
      expect(() => new RestClient(baseURL, endpoints)).to.throw();
    });
  });

  describe('_endpointDetails', () => {
    it('should retrieve path and method for an endpoint', () => {
      const endpoints = {
        test: ['/tests', 'GET'],
      }
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
      }
      const testClient = new RestClient(baseURL, endpoints);
      const { path, method } = testClient._endpointDetails('testCreate');
      expect(path).to.equal('/tests');
      expect(method).to.equal('POST');
    });

    it('should maintain path parameters', () => {
      const endpoints = {
        testInfo: ['/tests/:testId', 'GET'],
      }
      const testClient = new RestClient(baseURL, endpoints);
      const { path, method } = testClient._endpointDetails('testInfo');
      expect(path).to.equal('/tests/:testId');
      expect(method).to.equal('GET');
    });

    it('should return the user specified transformation', () => {
      class TestClient extends RestClient {
        _ignoreResult() { };
      };
      const endpoints = { test: ['/tests', 'GET', '_ignoreResult'] };

      const testClient = new TestClient(baseURL, endpoints);
      const { transforms } = testClient._endpointDetails('test');
      expect(transforms).to.deep.equal([testClient._ignoreResult]);
    });

    it('should allow multiple user specified transformations', () => {
      class TestClient extends RestClient {
        _transformOne() { };
        _transformTwo() { };
      };
      const endpoints = { test: ['/tests', 'GET', '_transformOne', '_transformTwo'] };

      const testClient = new TestClient(baseURL, endpoints);
      const { transforms } = testClient._endpointDetails('test');
      expect(transforms).to.deep.equal([
        testClient._transformOne,
        testClient._transformTwo,
      ]);
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
    function generateResponse(statusCode, content) {
      const response = { status: statusCode };
      if (content) {
        response.json = () => content;
      }
      return response;
    }


    it('should return undefined for a no content response', async () => {
      const response = generateResponse(204);
      const transforms = [];
      const result = await testClient._processResponse(
        response,
        transforms,
      );
      expect(result).to.be.undefined;
    });

    it('should return the JSON from a success response', async () => {
      const response = generateResponse(200, { key: "value" });
      const transforms = [];
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
      const context = { otherKey: "otherValue" };

      const result = await testClient._processResponse(
        response,
        transforms,
        context,
      );

      expect(result).to.deep.equal({
        key: "value",
        otherKey: "otherValue"
      });
    });
  });
});
