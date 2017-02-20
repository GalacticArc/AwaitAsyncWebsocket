# AwaitAsyncWebsocket

No guarantee to work.

A open source wrapper for websockets to make them use promises and await/async.

Client example:
```js
const aaws = require("./aaws.js");

var clientlibrary = {}; 
// The server can invoke the client and get "Bar" as a response.
clientlibrary.Foo = function(data)
{
  return "Bar";
}

var client = aaws.CreateClient("ws://127.0.0.1:8080", {api: myLibrary, reconnect: true});
client.socket.on("open", async function(){
    var response = await client.send("Foo");
    console.log("Got the second half of Foo"+response+" from the server!");
});
```

Server example:
```js

const aaws = require("./aaws.js");
var serverapi = {};

// Client will be able to invoke "Foo" on the server to get "Bar" as a response.
serverapi.Foo = function(client, message)
{
  return "Bar";
}

var central = aaws.CreateServer(8080, {api: serverapi});
```
