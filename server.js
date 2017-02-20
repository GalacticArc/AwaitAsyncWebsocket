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

var central = aaws.CreateServer(8080, {api: serverapi});

setInterval(async ()=>{
  var responses = await central.invokeClients("InvokableFunction", {msg: "Give me your greeting!"});
  var responses2 = await central.invokeClients("InvokableFunction", {msg: "Give me your greeting!"});
  console.log("InvokableFunction returned: ", responses);
  console.log("InvokableFunctionImmediate returned: ", responses2);
}, 2000);
