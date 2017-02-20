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
          client.reply(j.sequence, response);
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
      client.socket.send(JSON.stringify(packet));
    });
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

exports.CreateServer = function(port, opt)
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

  server.socket = new WebSocket.Server({
      port: port
  });

  // Waits for each client to be invoked, not ideal.
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
      exports.CreateClientSocket(client, location);
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
