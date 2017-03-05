const aaws = require("./aaws.js");

// These are functions that can be invoked by the server.
var ClientFunctions = {};

// This will return "Hello world!" after a second back to the server.
ClientFunctions.InvokableFunction = function(data)
{
  return new Promise((resolve, reject)=>{
    setTimeout(()=>{
      resolve("Hello world!");
    }, 1000);
  });
}

// This will return immediately.
ClientFunctions.InvokableFunctionImmediate = function(data)
{
  return "Hello immediate world!";
}

// This is setup as an event, no return needed.
ClientFunctions.onMessage = function(data)
{
  console.log("onMessage fired!",data);
}

// Output message from the server.
ClientFunctions.Message = function(data)
{
  console.log("The server told us something! ", data);
  return;
}

var client = aaws.CreateClient("ws://127.0.0.1:8080", {api: ClientFunctions, reconnect: true});
client.socket.on("open", async function(){
  setInterval(async ()=>{
    var response = await client.invoke("Foo");
    console.log("Got the second half of Foo"+response+" from the server!");
  }, 1000)
});
