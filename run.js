const SOCKET_SERVER_ADDRESS = 'http://192.168.0.184:8000';

console.log('Emulating a socket to serial [' + SOCKET_SERVER_ADDRESS + ']');

var socket = require('socket.io-client')(SOCKET_SERVER_ADDRESS);

var readline = require('readline');
var log = console.log;

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

socket.on('connect', function(){
    console.log('connect');
    recursiveAsyncReadLine();
});

socket.on('event', function(data){
    console.log('event ' + data);
});
socket.on('disconnect', function(){
    console.log('disconnect');
});

var recursiveAsyncReadLine = function () {
    console.log('');
    rl.question('Data to submit: ', function (answer) {
        if (answer == 'exit' || answer == 'quit' || answer == 'q' || answer == '') {
            process.exit();
        }
        console.log('SOCKET EMIT ' + answer);
        socket.emit('data', answer);
        recursiveAsyncReadLine(); //Calling this function again to ask new question
    });
};

