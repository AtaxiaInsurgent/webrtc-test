'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');

var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(process.env.PORT || 8080);

var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {

  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  // socket.on('message', function(room, message) {
  //   console.log('\[Room ' + room + '\] Client said: ', message);
  //   // for a real app, would be room-only (not broadcast)
  //   // socket.broadcast.emit('message', message);
  //   socket.to(room).emit('message', message)
  // });

  socket.on('message', function(data) {
    var room = data.room;
    var message = data.message;
    console.log('\[Room ' + room + '\] Client said: ', message);
    socket.to(room).emit('message', message)
  });

  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);

    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      socket.join(room);
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);

    } else if (numClients === 1) {
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } else { // max two clients
      socket.emit('full', room);
    }
  });

  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('bye', function(room){
    console.log('received bye');
    console.log('room ', room);
    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    console.log('Client count(BEFORE): ', numClients)
    console.log('Client ID ' + socket.id + ' left room ' + room);
    
    // var roomSockets = [];
    // io.sockets.adapter.clients([room], (err, clients) => {
    //   console.log(clients);
    //   roomSockets = clients;
    // });
    // roomSockets.forEach(function(socketId) {
    //   io.sockets.adapter.remoteLeave(socketId, false, function(err) {
    //     console.log('err', err);
    //   });
    // });

    io.sockets.in(room).clients((err, socketIds) => {
      if (err) throw err;

      socketIds.forEach((socketId) => { 
        console.log('socketId ', socketId);
        io.sockets.sockets[socketId].emit('destroyed', room)
        io.sockets.sockets[socketId].leave(room); 
      });

      numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
      console.log('Client count(AFTER): ', numClients)
    });

    // socket.leave(room);
  });

});
