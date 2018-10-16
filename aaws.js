const WebSocket = require('ws');

exports.makeClient = function()
{
  var client = {
    seq: 0,
    callbacks: {},
    socket: null,
    api: {},
    isServer: false,
    invokeTimeout: 10000,
    sendcheck: 0,
    queue: []
  };
  client.receive = async function(message)
  {
    try {
      let j = JSON.parse(message);
      j.sequence=j.sequence.toString();
      if(!j.sequence && !j.instruction && !j.event) return;
      if(!j.instruction && !j.event){
        // Response

        if(!client.callbacks[j.sequence]){
          await client.callbacks[j.sequence].finish(null);
        } else {
          await client.callbacks[j.sequence].finish(j.data);
        }
        clearTimeout(client.callbacks[j.sequence].to);
        client.sendcheck--;
        delete client.callbacks[j.sequence];
      } else if(j.event && !j.instruction){
        if(!client.api[j.event]) return;
        client.api[j.event](j.data);
      } else {
        // Invoke
        if(client.api[j.instruction]){
          try {
            let response = await client.api[j.instruction](j.data);
            client.reply(j.sequence, response);
          } catch(err2){
            console.log(err2);
            client.reply(j.sequence, null);
          }
        } else {
          client.reply(j.sequence, null);
          throw new Error("No instruction for "+j.instruction);
        }
      }
    } catch(err){
      console.log(err);
      return;
    }
  }

  client.timeoutpacket = async function(sequence, timeouterror)
  {
    try {
      sequence=sequence.toString();
      let n = Math.floor(Date.now() / 1000);
      if(client.callbacks[sequence]){
        if(timeouterror){
          client.callbacks[sequence].stop(new Error("Timeout occurred."));

        } else {
          console.log("Returning null");
          client.callbacks[sequence].finish(null);
        }

        delete client.callbacks[sequence];
        client.sendcheck--;
      } else {
        console.log("No sequence for "+sequence+"???", Object.keys(client.callbacks));
      }
    } catch (e) {
      console.log(e);
    }
  }

  client.invoke = async function(instruction, data, opt)
  {
    let timeout = client.invokeTimeout;
    let errorontimeout = false;
    if(opt && opt.timeout){
      timeout = opt.timeout;
    }
    if(opt && opt.error){
      errorontimeout = true;
    }
    let promise;
    promise = new Promise(async (finish,stop)=>{
      client.seq++;
      let rid = client.seq;
      let tof = setTimeout(client.timeoutpacket, timeout, rid, errorontimeout);
      // client.seq++;
      client.callbacks[rid.toString()] = {
        finish: finish,
        stop: stop,
        t: Math.floor(Date.now() / 1000),
        to: tof
      };
      client.sendcheck++;
      let packet = {
        sequence: rid,
        data: data
      };
      if(instruction){
        packet.instruction = instruction;
      }
      let jpack = JSON.stringify(packet);
      if(client.socket.readyState == WebSocket.OPEN){
        client.socket.send(jpack);
      } else {
        client.queue.push(jpack);
      }
    });
    return promise;
  }

  // <Event name>e, <variant>data
  client.fire = async function(e, data)
  {
    if(!e) return;
    let packet = {
      event: e,
      data: data
    };
    let jpack = JSON.stringify(packet);
    if(client.socket.readyState == WebSocket.OPEN){
      client.socket.send(jpack);
    } else {
      client.queue.push(jpack);
    }
  }

  client.reply = function(sequence, data)
  {
    var packet = {
      sequence: sequence,
      data: data
    };
    client.socket.send(JSON.stringify(packet))
  }

  client.close = function()
  {
    client.socket.close(1000,"Client close");
    client.closeClient = true;
  }
  return client;
}

exports.CreateServer = function(serveropt, opt)
{
  opt = opt || {};
  if(!opt.api){ return "Clients require an api"; }
  let server = {
    socket: null,
    clients: [],
    seq: 0,
    callbacks: {},
    api: opt.api,
    stats: {
      events: 0,
      invokes: 0,
      errors: 0
    }
  };

  server.socket = new WebSocket.Server(serveropt);

  // Waits for each client to be invoked, not ideal.
  server.invokeClients = async function(instruction, message)
  {
    let results = [];
    for(let i in server.clients){
      if(server.clients[i].socket.readyState != WebSocket.OPEN){
        continue;
      }
      let r = await server.clients[i].invoke(instruction, message);
      if(r) results.push(r);
    }
    return results;
  }

  // Clears unused clients.
  server.collectGarbage = function()
  {
    let newlist = [];
    for(let client of server.clients){
      if(client.socket.readyState == WebSocket.OPEN || client.socket.readyState == WebSocket.CONNECTING){
        newlist.push(client);
      }
    }

    server.clients = newlist;
  }

  // Fires all clients with <Event name>e
  server.fireClients = async function(e, message)
  {
    for(let i in server.clients){
      if(server.clients[i].socket.readyState != WebSocket.OPEN){
        continue;
      }
      server.clients[i].fire(e, message);
    }
  }

  // Fires first client available
  server.fireFirst = async function(e, message)
  {
    for(var i in server.clients){
      if(server.clients[i].socket.readyState == WebSocket.OPEN){
        server.clients[i].fire(e, message);
        break;
      }
    }
  }

  server.receive = async function(message, flags, client)
  {
    try {
      let j = JSON.parse(message);
      if(j.instruction){
        server.stats.invokes++;
        // Invoke
        if(server.api[j.instruction]){
          let response = await server.api[j.instruction](j.data, client);
          client.reply(j.sequence, response);
        } else {
          throw new Error("No instruction for "+j.instruction);
        }
      } else if(j.event){
        server.stats.events++;
        if(server.api[j.event])
          server.api[j.event](j.data, client);
      } else {
        client.receive(message, flags);
      }
    } catch(err){
      server.stats.errors++;
      console.log(err);
      return;
    }
  }

  server.socket.on("connection", wsc => {
    let client = exports.makeClient();
    client.isServer = true;
    client.socket = wsc;
    client.socket.on("error", function(){
      client.socket.close();
      server.collectGarbage();
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
  try {
    if(client.closeClient){
      return;
    }
    client.socket = new WebSocket(location, {perMessageDeflate: false});
    client.socket.on('open', function open() {
      while(true){
        let packet = client.queue.shift();
        if(!packet) break;
        client.socket.send(packet);
        if(client.queue.length == 0){
          break;
        }
      }
    });

    client.socket.on('error', function handleError(err) {

    });

    client.socket.on('close', function open() {
      if(opt.reconnect && opt.reconnect === false || client.closeClient) return;
      setTimeout(function(){
        exports.CreateClientSocket(client, location, opt);
      }, opt.reconnect_time || 1000);
    });

    client.socket.on('message', client.receive);
  } catch(err){
    if(opt.reconnect && opt.reconnect === false || client.closeClient) return;
    if(client.socket.readyState == WebSocket.OPEN) return;
    setTimeout(function(){
      exports.CreateClientSocket(client, location, opt);
    }, opt.reconnect_time || 1000);
  }
}

exports.CreateClient = function(location, opt)
{
  let client = exports.makeClient();
  client.api = opt.api;
  exports.CreateClientSocket(client, location, opt);
  return client;
}
