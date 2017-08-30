# AwaitAsyncWebsocket

No guarantee to work, but please review the client/server example provided.

A open source wrapper for websockets to make them use promises and await/async allowing client or server to invoke one another and get a response for certain messages.

Client example:
```js
var aaws = require("./aaws.js");
var comm = aaws.CreateClient("ws://127.0.0.1:4999", {api: api, reconnect: true});

(async ()=>{
	var data = await comm.invoke("getStoredData"); 
	// Wait for the data from the server
	
	comm.fire("storeData", [1,2,3,4]);
	// Update the data
})();

setTimeout(async ()=>{
	var data = await comm.invoke("getStoredData"); 
	// Get the data again.
}, 500);
```

Server example:
```js
var aaws = require("./aaws.js");
var myData = [];

// Declare my functions the clients can call.
var myserverFunctions = {}
myserverFunctions.getStoredData = function()
{
	return myData;
}

myserverFunctions.storeData = function(data)
{
	myData = data;
}

var server = aaws.CreateServer({ port: 4999 },{ api: myserverFunctions }); // Begin listening
console.log("Listening on port 4999");
```
