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
  var responses = await central.invokeClients("InvokableFunction", {some: "Data"});
  console.log("All clients returned their responses: InvokableFunction ", responses);
}, 2000);
