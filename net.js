const md5 = require("md5");
const fs = require("fs");
const WebSocket = require('ws');

exports.makeClient = function()
{
  var client = {
    seq: 0,
    callbacks: {},
    socket: null,
    api: {}
  };
  client.receive = async function(m)
  {
    try {
      var j = JSON.parse(m);
      if(!j.sequence && !j.instruction) return;
      if(!j.instruction){
        // Response
        if(!client.callbacks[j.sequence]){
          throw new Error("No sequence callback for "+j.sequence);
        } else {
          client.callbacks[j.sequence].y(j.data);
        }
      } else {
        // Invoke
        if(client.api[j.instruction]){
          var response = await client.api[j.instruction](j.data);
          client.send(false, response);
        } else {
          throw new Error("No instruction for "+j.instruction);
        }
      }
    } catch(err){
      return;
    }
  }

  client.send = async function(instruction, data)
  {
    return new Promise(async (y,n)=>{
      client.seq++;
      client.callbacks[client.seq] = {y:y,n:n};
      var packet = {
        sequence: client.seq,
        data: data
      };
      if(instruction){
        packet.instruction = instruction;
      }
      client.socket.send(JSON.stringify(packet))
    });
  }

  return client;
}

exports.CreateServer = function(port, opt)
{
  opt = opt || {};
  if(!opt.api){ return "Clients require an api"; }
  var server = {
    socket: null,
    clients: [],
    seq: 0,
    callbacks: {}
  };

  server.socket = new WebSocket.Server({
      port: port
  });

  server.invokeClients = async function(instruction, message)
  {
    var results = [];
    for(var i in server.clients){
      if(server.clients[i].socket.readyState != WebSocket.OPEN){
        continue;
      }
      var r = await server.clients[i].send(instruction, message);
      results.push(r);
    }
    return results;
  }

  server.socket.on("connection", wsc => {
    var client = exports.makeClient();
    client.socket = wsc;
    client.socket.on("error", function(){
      client.socket.close();
      delete wsc;
    });

    client.socket.on('message', client.receive);
    server.clients.push(client);
  });

  return server;
}

exports.CreateClientSocket = async function(client, location, opt)
{

  client.socket = new WebSocket(location, {perMessageDeflate: false});
  client.socket.on('open', function open() {

  });

  client.socket.on('close', function open() {
    if(opt.reconnect && opt.reconnect === false) return;
    setTimeout(function(){
      exports.CreateClientSocket(client, location);
    }, 1000);
  });

  client.socket.on('message', client.receive);
}

exports.CreateClient = async function(location, opt)
{
  var client = exports.makeClient();
  client.api = opt.api;

  exports.CreateClientSocket(client, location, opt);
}
