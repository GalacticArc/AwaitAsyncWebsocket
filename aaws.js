const WebSocket = require('ws');

exports.makeClient = function()
{
  var client = {
    seq: 0,
    callbacks: {},
    socket: null,
    api: {},
    isServer: false
  };
  client.receive = async function(message)
  {
    try {
      var j = JSON.parse(message);
      if(!j.sequence && !j.instruction && !j.event) return;
      if(!j.instruction && !j.event){
        // Response
        if(!client.callbacks[j.sequence]){
          client.callbacks[j.sequence].y(null);
        } else {
          client.callbacks[j.sequence].y(j.data);
        }
      } else if(j.event && !j.instruction){
        if(!client.api[j.event]) return;
        client.api[j.event](j.data);
      } else {
        // Invoke
        if(client.api[j.instruction]){
          var response = await client.api[j.instruction](j.data);
          client.reply(j.sequence, response);
        } else {
          delete j;
          client.reply(j.sequence, null);
          throw new Error("No instruction for "+j.instruction);
        }
      }
    } catch(err){
      return;
    }
  }

  client.invoke = async function(instruction, data)
  {
    var promise = new Promise(async (y,n)=>{
      client.seq++;
      client.callbacks[client.seq] = {y:y,n:n,p:promise};
      var packet = {
        sequence: client.seq,
        data: data
      };
      if(instruction){
        packet.instruction = instruction;
      }
      client.socket.send(JSON.stringify(packet));
    });
    return promise;
  }

  // <Event name>e, <variant>data
  client.fire = async function(e, data)
  {
    if(!e) return;
    var packet = {
      event: e,
      data: data
    };
    client.socket.send(JSON.stringify(packet));
  }

  client.reply = function(sequence, data)
  {
    var packet = {
      sequence: sequence,
      data: data
    };
    client.socket.send(JSON.stringify(packet))
  }

  return client;
}

exports.CreateServer = function(serveropt, opt)
{
  opt = opt || {};
  if(!opt.api){ return "Clients require an api"; }
  var server = {
    socket: null,
    clients: [],
    seq: 0,
    callbacks: {},
    api: opt.api
  };

  server.socket = new WebSocket.Server(serveropt);

  // Waits for each client to be invoked, not ideal.
  server.invokeClients = async function(instruction, message)
  {
    var results = [];
    for(var i in server.clients){
      if(server.clients[i].socket.readyState != WebSocket.OPEN){
        continue;
      }
      var r = await server.clients[i].invoke(instruction, message);
      if(r) results.push(r);
    }
    return results;
  }

  // Fires all clients with <Event name>e
  server.fireClients = async function(e, message)
  {
    for(var i in server.clients){
      if(server.clients[i].socket.readyState != WebSocket.OPEN){
        continue;
      }
      server.clients[i].fire(e, message);
    }
  }

  server.receive = async function(message, flags, client)
  {
    try {
      var j = JSON.parse(message);
      if(j.instruction){
        // Invoke
        if(server.api[j.instruction]){
          var response = await server.api[j.instruction](j.data);
          client.reply(j.sequence, response);
        } else {
          throw new Error("No instruction for "+j.instruction);
        }
      } else {
        client.receive(message, flags);
      }
    } catch(err){
      return;
    }
  }

  server.socket.on("connection", wsc => {
    var client = exports.makeClient();
    client.isServer = true;
    client.socket = wsc;
    client.socket.on("error", function(){
      client.socket.close();
      delete wsc;
    });

    client.socket.on('message', (m,f)=>{
      server.receive(m,f,client);
    });
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
      exports.CreateClientSocket(client, location, opt);
    }, 1000);
  });

  client.socket.on('message', client.receive);
}

exports.CreateClient = function(location, opt)
{
  var client = exports.makeClient();
  client.api = opt.api;

  exports.CreateClientSocket(client, location, opt);

  return client;
}
