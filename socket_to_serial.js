const SOCKET_SERVER_ADDRESS = 'https://ion.clicker.lu';
var args = process.argv.slice(2);
if (args.length != 2) {
    console.log('Missing args');
    process.exit(1);
}
var serialPortDevice = args[0];
var serverPort = args[1];
var ready = false;
var commandBuffer = [];
var userArrTmp = {};
var userArr = [];
var currentUserID;
var previousUserID;
var numLED = 50;
var brightness = 100;

console.log('SERIAL PORT DEVICE: ' + serialPortDevice + ' SERVER PORT: ' + serverPort);

// SERIALPORT SECTION //

var SerialPort = require('serialport');

var serialPort = new SerialPort(serialPortDevice, {
    baudRate: 250000,
    // parser: SerialPort.parsers.raw
    parser: SerialPort.parsers.readline('\n')
});

serialPort.on('open', function () {
    ready = true;
});

serialPort.on('error', function (error) {
    console.log('serialPort error');
    console.log(error);
    process.exit();
});

serialPort.on('disconnect', function () {
    console.log('serialPort disconnect');
    process.exit();
});

serialPort.on('close', function () {
    console.log('serialPort close');
    process.exit();
});

serialPort.on('data', function (data) {
    console.log(data);
});


// SERVER SECTION //

// const fs = require('fs');
// const ssl = {
//     key: fs.readFileSync(__dirname + '/ssl/localhost_wiges_lu.key'),
//     cert: fs.readFileSync(__dirname + '/ssl/localhost_wiges_lu.crt')
// };

// var ledServer = require('https').createServer(ssl);
var ledServer = require('http').createServer();
var ledServerIO = require('socket.io')(ledServer);
ledServer.listen(serverPort);

ledServerIO.on('connection', function (client) {
    if (ready) {
        client.on('data', function (data) {
            addCommandToArduinoQueue(data);
        });
    } else {
        client.emit('data', 'LED NOT READY');
    }
});

// CLIENT SECTION //

var clickerClient = require('socket.io-client')(SOCKET_SERVER_ADDRESS);

clickerClient.on('connect', function () {
    clickerClient.emit('JOIN_STATES');
    userArrTmp = Array();
});

clickerClient.on('STATE_UPDATE', function (data) {
    if (!userArrTmp[data.publicUUID]) {
        userArrTmp[data.publicUUID] = 'init';
    } else {
        userArrTmp[data.publicUUID] = 'update';
        var user = getUser(data.publicUUID);
        if (!user) {
            userArr.push({
                'id': data.publicUUID,
                'name': data.state.name,
                'lightsOn': data.state.lightsOn,
                'battery': data.state.items.battery,
                'energy': data.state.energy,
                'lightsPower': data.state.lightsPower || 0,
                'lightbulb': data.state.items.lightbulb || 0,
                'lightBulbColors': data.state.lightBulbColors,
                'time': new Date().getTime()
            });
        } else {
            user.name = data.state.name;
            user.lightsOn = data.state.lightsOn;
            user.battery = data.state.items.battery;
            user.energy = data.state.energy;
            user.lightsPower = data.state.lightsPower || 0,
            user.lightbulb = data.state.items.lightbulb || 0;
            user.lightBulbColors = data.state.lightBulbColors,
            user.time = new Date().getTime();

            if (user.id == currentUserID) {
                animateLedForUser(user);
            }
        }
    }
});


// INTERVAL SECTION //

// switch user every 10 seconds
setInterval(function () {
    switchUser();
}, 10000);

// clean inactive users every 30 seconds
setInterval(function () {
    for (var uuid in userArrTmp) {
        var user = getUser(uuid);
        if (user && expiredUser(user.time)) {
            deleteUser(user);
        }
    }
}, 30000);


// queue commands for arduino
setInterval(function () {
    if (commandBuffer.length > 0) {
        var command = commandBuffer[0];
        sendCommand(command);
        commandBuffer.shift();
    }
}, 3);


// // update user led
// setInterval(function () {
//animateLedForUser();
// }, 1000);

// FUNCTION SECTION //

function addCommandToArduinoQueue(command) {
    if (!command.endsWith('#')) {
        command += '#';
    }
    commandBuffer.push(command);
}

function expiredUser(time) {
    return (new Date().getTime() - time) > 20000;
}

function getUser(uuid) {
    for (var key in userArr) {
        if (userArr[key].id == uuid) {
            return userArr[key];
        }
    }
    return null;
}


function deleteUser(user) {
    userArr.splice(userArr.indexOf(user), 1);
}

function switchUser() {
    if (userArr.length > 0) {
        var tmpArr = userArr;
        var currentUser = tmpArr[0];
        currentUserID = currentUser.id;
        tmpArr.push(currentUser);
        tmpArr.shift();
    } else {
        currentUser = null;
    }
}

function sendCommand(command) {
    if (ready) {
        console.log('S:' + command);
        serialPort.write(command, function (err, bytesWritten) {
            if (err) {
                console.log(err.message);
            }
        });
    }
}

function animateLedForUser(user) {
    if (!user) {
        user = getUser(currentUserID);
    }
    if (!user || !user.lightsOn) {
        switchUser();
    } else {
        var percent = user.lightsPower;
        var percentRound = Math.round(percent);
        var countLed = Math.round(numLED * percent);

        for (i = 1; i <= numLED; i++) {
            if (i > countLed) {
                addCommandToArduinoQueue(i + ',0,0,0,0');
            } else {
                var c = user.lightBulbColors[i-1];
                var r = parseInt(c.substring(1,3), 16);
                var g = parseInt(c.substring(3,5), 16);
                var b = parseInt(c.substring(5,7), 16);
                var command = ',' + r + ',' + g + ',' + b + ',' + brightness;
                addCommandToArduinoQueue(i + command);
            }
        }
        addCommandToArduinoQueue('show');
    }
}
