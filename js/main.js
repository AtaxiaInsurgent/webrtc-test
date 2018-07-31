'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;

var pcConfig = {
  'iceServers': {
    'stun': [
      {
        'url': 'stun:stun.l.google.com:19302'
      }
    ],
    'turn': [
      {
        'url': 'turn:numb.viagenie.ca',
        'credential': 'muazkh',
        'username': 'webrtc@live.com'
      },
      {
          'url': 'turn:192.158.29.39:3478?transport=udp',
          'credential': 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
          'username': '28224511:1379330808'
      },
      {
          'url': 'turn:192.158.29.39:3478?transport=tcp',
          'credential': 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
          'username': '28224511:1379330808'
      },
      {
          'url': 'turn:turn.bistri.com:80',
          'credential': 'homeo',
          'username': 'homeo'
      },
      {
          'url': 'turn:turn.anyfirewall.com:443?transport=tcp',
          'credential': 'webrtc',
          'username': 'webrtc'
      }
    ]
  }
};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};

/////////////////////////////////////////////

var room = 'shaqfoo';
// Could prompt for room name:
// room = prompt('Enter room name:');

// if (room == null) {
//   room = 'shaqfoo';
//   console.log('room', room);
// }

var socket = io.connect();

// if (room !== '') {
//   socket.emit('create or join', room);
//   console.log('Attempted to create or  join room', room);
// }

function createJoinRoom() {
  var textInput = document.getElementById('roomInput').value;
  
  if (textInput !== '' || textInput != null) {
    room = textInput;
    socket.emit('create or join', room);
    console.log('Attempted to create or  join room', room);
  }
}

socket.on('created', function(room) {
  console.log('Created room ' + room);
  document.getElementById("submitButton").disabled = true
  document.getElementById("hangupButton").disabled = false
  isInitiator = true;
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
  alert('Room ' + room + ' is full');
});

socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  document.getElementById("submitButton").disabled = true
  document.getElementById("hangupButton").disabled = false
  getUserMedia();
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('joined: ' + room);
  document.getElementById("submitButton").disabled = true
  document.getElementById("hangupButton").disabled = false
  getUserMedia();
  isChannelReady = true;
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

socket.on('destroyed', function(room) {
  console.log('Room ' + room + ' destroyed');
  document.getElementById("submitButton").disabled = false
  document.getElementById("hangupButton").disabled = true
  isChannelReady = false;
  isInitiator = false;
});

////////////////////////////////////////////////

function sendMessage(message) {
  console.log('Client sending message: ', message);
  if (room !== '' || room != null) {
    socket.emit('message', room, message);
  }
}

// This client receives a message
socket.on('message', function(message) {
  console.log('Client received message:', message);
  if (message === 'got user media') {
    maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var localAudio = document.querySelector('#localAudio');
var remoteAudio = document.querySelector('#remoteAudio');

// navigator.mediaDevices.getUserMedia({
//   audio: true,
//   video: false
// })
// .then(gotStream)
// .catch(function(e) {
//   alert('getUserMedia() error: ' + e.name);
// });

function getUserMedia() {
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false
  })
  .then(gotStream)
  .catch(function(e) {
    alert('getUserMedia() error: ' + e.name);
  });
}

function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localAudio.srcObject = stream;
  sendMessage('got user media');
  if (isInitiator) {
    maybeStart();
  }
}

var constraints = {
  video: false,
  audio: true
};

console.log('Getting user media with constraints', constraints);

if (location.hostname !== 'localhost') {
  requestTurn(
    'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
  );
}

function maybeStart() {
  console.log('>>>>>>> maybeStart ', isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

window.onbeforeunload = function() {
  console.log('window.onbeforeunload');
  socket.emit('bye', room);
  sendMessage('bye');
};

/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    // pc.ontrack = handleRemoteStreamAdded
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function requestTurn(turnURL) {
  console.log('requestTurn');
  console.log(pcConfig);
  var turnExists = false;
  if (pcConfig.iceServers.turn.length !== 0) {
    turnExists = true;
    turnReady = true;
  }
  // for (var i in pcConfig.iceServers) {
  //   if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
  //     turnExists = true;
  //     turnReady = true;
  //     break;
  //   } 
  // }
  if (!turnExists) {
    console.log('Getting TURN server from ', turnURL);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
        console.log('Got TURN server: ', turnServer);
        pcConfig.iceServers.turn.push({
          'url': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turnURL, true);
    xhr.send();
  }
}

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteStream = event.stream;
  remoteAudio.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  console.log('Hanging up.');
  stop();
  socket.emit('bye', room);
  sendMessage('bye');
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}
