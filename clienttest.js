const aaws = require("./aaws.js");

var myLibrary = {};
var client = null;
// This will return "Hello world!" after 5 seconds.
myLibrary.InvokableFunction = function(data)
{
  return new Promise((resolve, reject)=>{
    setTimeout(()=>{
      resolve("Hello world!");
    }, 1000);
  });
}


var client = aaws.CreateClient("ws://127.0.0.1:8080", {api: myLibrary, reconnect: true});
client.socket.on("open", async function(){
  setInterval(async ()=>{
    var response = await client.send("Foo");
    console.log("Foo"+response);
  }, 1000)
});
