const aaws = require("./aaws.js");
var serverapi = {};

serverapi.Foo = function(client, message)
{
  return new Promise((resolve, reject)=>{
    // Do some DB work or something then resolve it.
    setTimeout(()=>{
      resolve("Bar");
    }, 1000);
  });
}

var central = aaws.CreateServer({port: 8080}, {api: serverapi});

setInterval(async ()=>{
  var responses = await central.invokeClients("InvokableFunction", {msg: "Give me your greeting!"});
  var responses2 = await central.invokeClients("InvokableFunctionImmediate", {msg: "Give me your greeting!"});
  central.fireClients("onMessage", "This is a message being sent to all clients that will not return anything.");
  console.log("InvokableFunction returned: ", responses);
  console.log("InvokableFunctionImmediate returned: ", responses2);

  // Send the first client a mesage.
  if(central.clients[0]) central.clients[0].fire("Message", "Hello, you're the first!");

}, 2000);
