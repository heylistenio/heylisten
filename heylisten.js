/*jshint multistr: true */

var express = require('express');
var app = express();
var url = require('url');
var http = require('http').Server(app);
var https = require('https').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
//var cert = fs.readFileSync('/etc/letsencrypt/live/heylisten.io/fullchain.pem');
//var key = fs.readFileSync('/etc/letsencrypt/live/heylisten.io/privkey.pem');
var mongoClient = require('mongodb').Mongoclient;
var assert = require('assert');

var apiKeys = require('./config.js');
var maml = require('./maml.js');

//the message people see when they start a new room
var welcomeMessage = "Welcome to heylisten.io! As you can see the website is \
                    pretty far from finished. We are working on making it look \
                    better and adding more features. Feel free to let us know \
                    what you think of our efforts so far by tweeting at \
                    https://twitter.com/heylisten_io \
                    and checkout the devblog at http://blog.heylisten.io \
                    We support chat commands now use /help to find out more.";

var rooms = io.sockets.adapter.rooms;
fs.writeFile('./public/roomList.json', '', function(e){
    if (e) throw e;
});

app.use(express.static(__dirname + '/public'));

// serve the index file with express
app.get('/', function(req, res){
    res.sendFile(__dirname + '/public/index.html');
});

// serve the room file with express for any url that's not /
app.get('/*', function(req, res) {
    res.sendFile(__dirname + '/public/room.html');
});

//use this function instead of console.log for errors, logs etc

function terminalMessage(text) {
    var d = new Date();
    var year = d.getFullYear();
    var month = d.getMonth() + 1;
    var day = d.getDate();
    var hours = d.getHours().toString().length == 1 ? '0'+d.getHours() : d.getHours();
    var minutes = d.getMinutes().toString().length == 1 ? '0'+d.getMinutes() : d.getMinutes();
    var seconds = d.getSeconds().toString().length ==1 ? '0'+ d.getSeconds() : d.getSeconds();
    var timeStamp = "<" + year + "-" + month + "-" + day + " " + hours + ":" + minutes + ":" + seconds + "> ";
    console.log(timeStamp + text);
}

// ALL DATABASE RELATED FUNCITONS GO HERE
function getPlaylist(room) {

}

function setPlaylist(room) {

}

function getUsers(room){

}

function setUsers(room) {

}

function getRoomProperties(room) {

}

function setRoomProperties(room) {

}

// generate authentication tokens
function generateToken(length){
    var chars = 'abcdefghijklmnopqrstuvxyz0123456789ABCDEFGHIJKLMNOPQRSTUVXYZ!@#$%&*=+-_';
    var token = '';
    var num;
    for (var i = 0; i < length; i++) {
        token += chars[Math.floor(Math.random() * (chars.length))];
    }
    return token;
}

// find sockets connected to a room
function findClientsByRoomID(roomId) {
    var res = [];
    var room = io.sockets.adapter.rooms[roomId];
    if (room) {
        for (var id in room) {
            res.push(io.sockets.adapter.nsp.connected[id]);
        }
    }
    return res;
}

// update the playlist

function updateServerPlaylist(room, userId) {
    var clients = findClientsByRoomID(room);
    clients = clients.filter(Boolean);
    test = clients.length / 2;
    if (rooms[room].finished.indexOf(userId) === -1){
        rooms[room].finished.push(userId);
    }
    if (test < rooms[room].finished.length && rooms[room].playlist) {
        nextSong(room);
    }
}

//url parser
//when adding support for a new platform start here
function urlParser(uri) {
    var platform;
    var media = 0;
    var result;
    if (uri.indexOf("youtu") > -1 ) {
        media = YTUrlParser(uri);
        platform = "youtube";
    } else if (uri.indexOf("soundcloud") > -1) {
        media = uri;
        platform = "soundcloud";
    } else if (uri.indexOf("vimeo") > -1) {
        media = VimeoUrlParser(uri);
        platform = "vimeo";
    }
    if (media !== 0) {
        result = {
        "id": media,
        "platform": platform
        };
    } else {
        result = false;
    }
    return result;
}


//parse yt url and get the id
function YTUrlParser(uri) {
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
    var match = uri.match(regExp);
    if (match && match[7].length===11) {
        return match[7];
    } else {
        terminalMessage('bad url');
    }
}

//parse vimeo url and get the id
function VimeoUrlParser(uri) {
    var regExp = /(\d+)/;
    var match = uri.match(regExp);
    return match[0];
}

//send a list of clients
function sendClients(roomID) {
    var clients = [];
    var clientsArr = rooms[roomID].users;
    clientsArr = clientsArr.filter(Boolean);
    for (var c in clientsArr) {
        clients.push(clientsArr[c].nick);
    }
    clients.sort();
    io.to(roomID).emit('client list', clients);
}

//check if user has a nickname and request one if he doesn't
//returns false if id has no assigned nickname
function checkNickname(roomID, userID) {
    for (var u in rooms[roomID].users) {
        if (rooms[roomID].users[u] == userID) {
            return true;
        }
    }
    return false;
}
// find a users position in users array based on id
function findUserArrPos(userId, roomId) {
    for (var u in rooms[roomId].users) {
        if (rooms[roomId].users[u].id == userId) {
            return u;
        }
    }

}
//check if user voted
function checkIfVoted(userId, roomId) {
    terminalMessage('vote');
    var vote = rooms[roomId].voteCount.indexOf(userId);
    if (vote !== -1) {
        return true;
    } else {
        return false;
    }
}

function averager(timeArr, users) {
    var totalTime;
    var avg;
    for (var t in timeArr) {
        totalTime +=  timeArr[t];
    }
    avg = totalTime / users;
    return avg;
}

//get current date in ms since Jan 1 1970
// if format is "s" return sencods
// else miliseconds
function getCurrentDate(format) {
    var d = new Date();
    var m = d.getTime();
    if (format === "s") {
        m = m  / 1000 - d.getTime() % 1000 / 1000;
    }
    return m;
}

// shift to the next song in the playlist for the given room
function nextSong(room) {
    rooms[room].playlist.shift();
    rooms[room].voteCount = [];
    rooms[room].finished = [];
    terminalMessage('next song in ' + room);
    io.to(room).emit('playlist', rooms[room].playlist);
    if (rooms[room].playlist.length > 0 ) {
        io.to(room).emit('server message', 'Now playing: ' + rooms[room].playlist[0].title);
    }
    rooms[room].timeStarted = getCurrentDate();
}

//update the timestamp in the playlist
//the platform should always be rooms[room].playlist[0].platform
//it asks for it as a parameter to avoid potential bugs
function updateTime(room, platform) {
    terminalMessage("updateTime");
    var newTime = getCurrentDate();
    var startAt;
    if (rooms[room].playlist[0]) {
        if (platform === "youtube") {
            startAt = newTime - rooms[room].timeStarted;
            startAt = startAt / 1000 - startAt % 1000 / 1000;
            terminalMessage("startAt:" + startAt);
            rooms[room].playlist[0].startAt = startAt;
        } else if (platform === "soundcloud"){
            rooms[room].playlist[0].startAt = newTime - rooms[room].timeStarted;
        } else if (platform === "vimeo") {
            startAt = newTime - rooms[room].timeStarted;
            startAt = startAt / 1000 - startAt % 1000 / 1000;
            terminalMessage("startAt:" + startAt);
            rooms[room].playlist[0].startAt = startAt;
        }
    }
}

//get playlist position by song id
function getPlaylistPositionById(room, id) {
    for (var i = 0; i < rooms[room].playlist.length; i++) {
        if (rooms[room].playlist[i].id === id) {
            return i;
        }
    }
    return false;
}

// chat commands
function chatCommands(message, usrId, room) {
    // check if the message contains spaces
    if (message.msg.indexOf(' ') > -1) {
        command = message.msg.substr(0, message.msg.indexOf(' '));
    } else {
        command = message.msg;
    }
        command = command.toLowerCase();
    switch (command) {
        // /me the same as irc
        case '/me':
            does = message.msg.replace(command, "");
            io.to(room).emit('server message', "* " + message.nick + " " + does);
        break;

        case '/adduploads':
            getSongs(message, usrId, room);
        break;

        case '/addup':
            getSongs(message, usrId, room);
        break;

        case '/addplaylist':
            getPlaylist(message, usrId, room);
        break;

        case '/addpl':
            getPlaylist(message, usrId, room);
        break;

        case '/emoji':
            io.to(usrId).emit('server message', 'You can use both unicode and shortnames in the heylisten.io chat. For a full list of emoji shortnames visit http://emoji.codes');
        break;

        case '/help':
            io.to(usrId).emit('server message', '/help - print this message');
            io.to(usrId).emit('server message', '/adduploads <streaming service> <channel> <number of videos 1-20> - adds a number of newest videos from streaming service (currently only supports youtube)');
            io.to(usrId).emit('server message', '/addplaylist <playlistID> <number of videos 1-20> - adds a number of videos from a youtube playlist');
            io.to(usrId).emit('server message', '/me - identical to the IRC /me command');
            io.to(usrId).emit('server message', '/emoji - emoji help');
            io.to(usrId).emit('server message', 'Visit http://blog.heylisten.io for more information on commands');
        break;

        default:
            io.to(usrId).emit('server message', 'Unknown command ' + command + ' use /help for more info');

    }
}

// get multiple songs from a channel
// /add <streaming service> <channel> <number of videos 1-50>
// /add youtube mrsuicidesheep 10
function getSongs(message, userId, room) {
    command = message.msg.split(" ");
    if (command[1] === "youtube" && command[2] && !isNaN(command[3]) && command[3] < 21 && command[3] > 0) {
        maml.getYouTubeChannelUploads(command[2], command[3], apiKeys.YouTube, function (uploads) {
            if (uploads === null) {
                io.to(userId).emit('server message', "Couldn't find any songs");
            } else {
                var songAddr;
                for (var i = 0; i < uploads.length; i++) {
                    songAddr = "https://www.youtube.com/watch?v=" + uploads[i];
                    addSong(songAddr, room);
                }
                io.to(room).emit('server message', message.nick + " added " + uploads.length + " videos from YouTube channel " + command[2] + ".");
            }
            });
    } else {
        io.to(userId).emit('server message', 'Bad Parameters use /help for more info');
    }
}

//get multiple songs from a yt playlist
// /addplaylist <playlistID> <number of videos 1-50>
function getPlaylist(message, userId, room){
    command = message.msg.split(" ");
    if (command[1] && !isNaN(command[2]) && command[2] < 21 && command[2] > 0) {
        maml.getYouTubePlaylist(command[1], command[2], apiKeys.YouTube, function (videos){
            if (videos === null) {
                io.to(userId).emit('server message', "Couldn't find any songs");
            } else {
                var songAddr;
                for (var i = 0; i < videos.length; i++) {
                    songAddr = "https://www.youtube.com/watch?v=" + videos[i];
                    addSong(songAddr, room);
                }
                io.to(room).emit('server message', message.nick + " added " + videos.length + " videos from a YouTube playlist.");
            }
        });
    }
}



// get the list of rooms and save it in roomList.json
function saveRoomList() {
    var roomList = {
        rooms : [],
        users : [],
    };
    var rooms = io.sockets.adapter.rooms;
    if (rooms) {
        for (var room in rooms) {
            if (!rooms[room].hasOwnProperty(room)) {
                roomList.rooms.push(room);
                roomList.users.push(findClientsByRoomID(room).filter(Boolean).length);
            }
        }
    }
    fs.writeFile('./public/roomList.json', JSON.stringify(roomList), function(e){
        if (e) throw e;
    });
}

// add a song to the playlist

function addSong(newSong, room, userId) {
    var titleVar = 'Checking Title...';
    var parsed = urlParser(newSong);
    if (parsed !== false) {
        var plObj = {
            'id': parsed.id,
            'title': titleVar,
            'platform': parsed.platform,
            'duration': 0,
            'startAt': 0
        };
        for (var i = 0; i < rooms[room].playlist.length; i++) {
            if (rooms[room].playlist[i].id === plObj.id) {
                io.to(userId).emit('server message', 'That song is already in the playlist');
                return;
            }
        }

        // start the timer for the current song
        if (rooms[room].playlist.length < 1) {
            rooms[room].timeStarted = getCurrentDate();
            terminalMessage("timeStarted set");
        }
        rooms[room].playlist.push(plObj);
        io.to(room).emit('playlist', rooms[room].playlist);
        terminalMessage("playlist with no title sent");
        // get media info from MAML
        maml.getMediaInfo(plObj.platform, plObj.id, apiKeys, function(newTitle){
            var playPos = getPlaylistPositionById(room, plObj.id);
            if (newTitle) {
                if (playPos === false) {
                    return;
                }
                rooms[room].playlist[playPos].title = newTitle;
                io.to(room).emit('playlist', rooms[room].playlist);
                terminalMessage("sending updated playlist with title");
                if (rooms[room].playlist.length === 1) {
                    io.to(room).emit('server message', 'Now playing: ' + rooms[room].playlist[0].title);
                }
            } else if(!newTitle) {
                rooms[room].playlist.splice(playPos, 1);
                terminalMessage("could not resolve ulr, removing song from playlist");
                io.to(room).emit('playlist', rooms[room].playlist);
            }
        });

    } else {
        io.to(userId).emit('server message', "Bad URL");
        terminalMessage('bad url');
        terminalMessage(newSong);
    }
}

// vote to skip
function voteSkip(currentSong , userId, room) {
    if (rooms[room].playlist[0]) {
        terminalMessage('got vote');
        if (currentSong.id && currentSong.id === rooms[room].playlist[0].id) {
            var ifVoted = checkIfVoted(userId, room);
            terminalMessage('voted: ' + ifVoted);
            if (!ifVoted) {
                rooms[room].voteCount.push(userId);
                var usr = findUserArrPos(userId, room);
                if (usr !== undefined) {
                    var message = rooms[room].users[usr].nick + " voted to skip " + rooms[room].playlist[0].title;
                    io.to(room).emit('server message', message);
                }
            } else {
                io.to(userId).emit('server message', "You already voted");
            }
            var clients = findClientsByRoomID(room);
            clients = clients.filter(Boolean);
            var test = clients.length / 2;
            if (rooms[room].voteCount.length > test) {
                io.to(room).emit('server message', 'More than half of the users voted to skip');
                nextSong(room);
            }
        } else {
            terminalMessage('currentSong != rooms[room].playlist[0].id');
        }

    }
}

// add nickname to the users array
function addNick(room, userId, nick) {
    nick = nick.substring(0, 16);
    var exists = false;
    for (var i = 0; i < rooms[room].users.length; i++) {
        if (rooms[room].users[i].id === userId) {
            io.to(room).emit("server message", rooms[room].users[i].nick + " changed his name to " + nick);
            rooms[room].users[i].nick = nick;
            exists = true;
            break;
        }
    }
    if (exists === false) {
        newUsr = {
            'id': userId,
            'nick': nick
        };
        rooms[room].users.push(newUsr);
    }
    sendClients(room);
}

// server client communication
// chat message - message in the chat
// playlist - updated playlist, server to client only
// playlist requrest - client to server only, only used when a client first joins a room
// playlist add - add a video to playlist, cliet to server only
// song finished - song finished playing, remove pos 0 from playlist, client to server only
// client list - list clients connected to a room, server to client only
// server message - server massages, server to client only
// nickname - nickname to be assigned to the id, client to server only
// nick request - nickname request, server to client only
// vote skip - cast a vote to skip a song, client to server only
// time - spot in the song the client is in, / not implemented
// startat                                   /not implemented



io.on('connection', function(socket) {
    var room = socket.handshake.headers.referer;
    if (!room) {
        return;
    }
    var n;
    if (room) n = room.lastIndexOf('/'); // if (room) is the fix for --> var n = room.lastIndexOf('/') TypeError: Cannot call method 'lastIndexOf' of undefined //
    room = room.slice(n, room.length);
    room = room.toLowerCase();
    roomCheck = encodeURI(room);
    if (roomCheck !== room) {
        room = roomCheck;
    }
    var check = findClientsByRoomID(room);
    socket.join(room);
    // list of users
    if (!rooms[room].users) {
        rooms[room].users = [];
    }
    //check if user has a nickname and request one if he doesnt
    var nickTest = checkNickname(room, socket.id);
    if (!nickTest) {
        io.to(socket.id).emit('nick request');
    }
    // number of people who finished playing current song
    if (!rooms[room].finished){
        rooms[room].finished = [];
    }
    // number of people who voted to skip current song
    if (!rooms[room].voteCount) {
        rooms[room].voteCount = [];
    }
    // playlist
    if (!rooms[room].playlist) {
        rooms[room].playlist = [];
    } else if(rooms[room].playlist[0]) {
        updateTime(room, rooms[room].playlist[0].platform);
        io.to(socket.id).emit('playlist', rooms[room].playlist);
        io.to(room).emit('server message', "New user connected");
    }
    //time in seconds from 1 Jan 1970 rounded down when the current song in the room started playing
    if (!rooms[room].timeStarted) {
        rooms[room].timestarted = 0;
    }
    if (!rooms[room].currentTime) {
        rooms[room].currentTime = 0;
    }
    //temporary
    if(!rooms[room].times) {
        rooms[room].times = [];
    }
    io.to(socket.id).emit('server message', welcomeMessage);
    terminalMessage('user ' + socket.id + ' joined room ' +room);
    sendClients(room);

    //save the new list of rooms
    saveRoomList();

    //disconnection
    socket.on('disconnect', function () {
        socket.leave(room);
        terminalMessage('user ' + socket.id + ' disconnected from ' + room);
        var clients = findClientsByRoomID(room);
        clients = clients.filter(Boolean);
        var ifVoted = rooms[room].voteCount.indexOf(socket.id);
        if (ifVoted !== -1) {
            rooms[room].voteCount.splice(ifVoted, 1);
        }
        var ifFinished = rooms[room].finished.indexOf(socket.id);
        if (ifVoted !== -1) {
            rooms[room].finished.splice(ifFinished, 1);
        }
        if (clients < 1) { //if room is empty destroy it
            terminalMessage('destroying empty room ' + room);
            delete rooms[room];
        } else { //otherwise just send an updated client list
            var thisUser = findUserArrPos(socket.id, room);
            if (thisUser !== undefined) {
                var message = rooms[room].users[thisUser].nick + " disconnected";
                io.to(room).emit('server message', message);
                rooms[room].users.splice(thisUser, 1);
            }
            sendClients(room);
        }
        saveRoomList();
    });

    //chat messages
    socket.on('chat message', function(msg) {
        if (msg.msg[0] === '/') {
            chatCommands(msg, socket.id, room);
        } else {
            msg.msg = msg.msg.substring(0, 512);
            msg.nick = msg.nick.substring(0, 16);
            terminalMessage(room + ': ' + msg.msg);
            io.to(room).emit('chat message', msg.nick + ': ' + msg.msg);
        }
    });

    // add song to playlist
    socket.on('playlist add', function(newSong) {
        addSong(newSong, room, socket.id);
    });

    //song finished playinsg
    socket.on('song finished', function (){
        updateServerPlaylist(room, socket.id);
    });

    socket.on('client list', function (){
        sendClients(room, rooms[room].users);
    });

    //vote to skip a song
    socket.on('vote skip', function (currentSong) {
        voteSkip(currentSong, socket.id, room);
    });


    //get a nickname and add it to an array for that room
    socket.on('nickname', function (nick) {
        addNick(room, socket.id, nick);
    });

    //recieve times from users in a room
    socket.on('time', function (time) {
        rooms[room].times.push(time);
        if (rooms[room].times.length === rooms[room].users.length) {
            sendPlaylistWithTimeStamp(room);
            rooms[room].playlist[0].time = time;
        }

    });

});

http.listen(8080, 'localhost', function(){
    terminalMessage('listening on *:8080');
});

https.liste
