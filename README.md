# Just another node REST client.

## What is this thing that I'm looking at?
### Why make a REST client for node?
This project happened due to a need to do similar things across several other projects. It's public because, well, why not?


### Yes, but why make another one?
The existing options all seemed to follow the same pattern. A client calls a remote API, with options on URLs request methods, and payloads. Then returns the resulting data (or perhaps passes it to a callback function). However, the job of a client should also be to translate from the data model of the called system to the data model of the calling system. This was often trickier than it should be.


### But that translation will be specific to the client and server involved in requests. How can this library solve it?
It doesn't. This library provides a base class, which can be extended to provide a translation layer between clients and servers. All of the request logic is out of site, allowing the extending class to define simple (testable) transformations from an API response to the shape the caller needs.


### So REST client probably isn't the right name then, is it?
Probably not. Naming things is hard!


## Ok then, how does it work?
You create a child class, and provide it with a base URL, and a object defining the endpoints. That endpoint definition can include any transformation and error handling logic you need.

**For example:**
```
const RestClient = require('@korexus/rest-client');

const BASE_URL = 'https://api.example.com';
const endpoints = {
  'status': ['/status', 'GET'],
};

class ApiClient extends RestClient {
  constructor() {
    super(BASE_URL, endpoints);
  }
}
```

An instance of `ApiClient` will have a single public method, `status`. Calling `apiClient.status` will make an HTTP GET request to https://api.example.com/status and return the result.

### But you said that the whole point was not to do that.
Yes, that's true. This is the default case, where you don't want the response to be transformed. You can allow for transforms by adding a third entry to the array.

```
const endpoints = {
  'status': ['/status', 'GET', ['transformStatusResponse']],
};
```
The client will now look for a method called `transformStatusResponse` and call it if it exists.

```
class ApiClient extends RestClient {
  constructor() {
    super(BASE_URL, endpoints);
  }

  transformStatusResponse(response, context) {
    const transformedResponse = // do some things here.
    return transformedResponse;
  }
}
```

### Where does that `context` come from?
It's additional information that can be provided when making the call. It's optional, so don't worry about it for now, but you can read more about it later.


### Ok then, so what about error handling.
There's one more option that can be provided in an endpoint's definition. An object mapping HTTP status codes to functions to call when that response happens.

```
const endpoints = {
  'status': ['/status', 'GET', [], { 500: 'badStatusResponse' }],
};
```
Just as with response transformations, this will call a function with that name and pass it the response information.
```
class ApiClient extends RestClient {
  constructor() {
    super(BASE_URL, endpoints);
  }

  badStatusResponse(response) {
    throw new Error('The system is down!');
  }
}
```

That's enough for now. More information (including making calls) to be filled in later.
