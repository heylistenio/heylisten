/*jshint multistr: true */

var express = require('express');
var app = express();
var url = require('url');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var assert = require('assert');
var config = require('./config.js');
var apiKeys = config.apiKeys;
var dbUrl = config.url;
var settings = config.settings;
var welcomeMessage = config.welcome;
var maml = require('./maml.js');

//the message people see when they start a new room


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

// use this function for all stdOut that isn't debug related
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
// playlist object prototype
function playlistObject(id, title, platform, duration, startAt) {
    this.id = id;
    this.title = title;
    this.platform = platform;
    this.duration = duration;
    this.startAt = startAt;

}

// Mongoose Schemas
var playlistSchema = new Schema({
    room: String,
    playlist: Array
});

var Playlist = mongoose.model("Playlists", playlistSchema);

var roomSchema = new Schema({
    name: String, // name of the room
    opToken: String, // room operator token
    startTime: Number, // when the last song started
    votes: Array, // list of users who voted
    finished: Array, // list of users who finished playing the last song
    userList: Array // list of users in that room
});

var Room = mongoose.model("Rooms", roomSchema);

var userSchema = new Schema({
    token: String, //id token
    opToken: String, // room operator token
    room: String, // room the user is in
    nick: String, // nickname
    socketid: String // last socket id of that user
});

var User = mongoose.model("Users", userSchema);


// ALL DATABASE RELATED FUNCITONS GO HERE

mongoose.connect(dbUrl);

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function(callback){
    terminalMessage("connected to database ");
    http.listen(8080, 'localhost', function(){
    terminalMessage('listening on *:8080');
});
});

// adds user to the list in the rooms document
function UpdateUserList(room, names, callback) {
    db.collection('rooms').update(
        { name: room },
        {$set: { userList: names }}
    );
    callback();
}

// generate authentication tokens
// use this to generate user and op tokens
// consider writing a function that generates verifiable tokens
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
function findClientsByRoomName(roomId) {
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
    var clients = findClientsByRoomName(room);
    clients = clients.filter(Boolean);
    test = clients.length / 2;
    Room.findOne({name: room}, function(err, doc){
        if (doc.finished.indexOf(userId) === -1) {
            doc.finished.push(userId);
        }
        if (test < doc.finished.length) {
            nextSong(room);
        }
    });
}

// url parser
// when adding support for a new platform start here
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

// parse vimeo url and get the id
function VimeoUrlParser(uri) {
    var regExp = /(\d+)/;
    var match = uri.match(regExp);
    return match[0];
}

// send a list of clients
function sendNames(room, userList) {
        if (userList === undefined) {
            Room.findOne({name: room}, function(err, doc) {
                console.log(doc.userList);
                doc.userList.sort();
                io.to(room).emit('client list', doc.userList);
            });
        } else {
            userList.sort();
            console.log(userList);
            io.to(room).emit('client list', userList);
        }
}

// add user info to the user and room documents
function addUsrInfo(room, userId, nick) {
    console.log('adduserinfo');
    console.log(nick);
    nick = nick.substring(0, 16);
    console.log(nick);

// change nickname this has to be rewritten to support the new db
/*    var exists = false;
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
*/
    //check if nickname is already in use in that room
    Room.findOne({name: room},function (err, doc) {
        if (doc === []) {
            terminalMessage("253: Room " + room + "is not in the db");
        //} else if (doc && doc.userList.indexOf(nick) !== -1) {
            // request nick again if that nick is already being used in that room
            //io.to(userId).emit('info request');
        } else if (doc && doc.userList.indexOf(nick) === -1 ) {
            doc.userList.push(nick);
            doc.save(function(err, doc){
                if (err) return console.error(err);
                terminalMessage("inserted " + doc + " into the db");
            });
            var newUser = new User({
                token: generateToken(16),
                opToken: 1, //temp
                room: room,
                nick: nick,
                socketid: userId
            });
            newUser.save(function(err, newUser){
                if (err) return console.error(err);
                terminalMessage("inserted " + newUser + " into the db");
                io.to(room).emit('server message', nick + " connected");
                sendNames(room);
            });
        }
    });
}

// check if user voted
function checkIfVoted(userId, votes) {
    terminalMessage('vote');
    var vote = votes.indexOf(userId);
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

// get current date in ms since Jan 1 1970
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
    Playlist.findOne({room: room}, function(err, doc){
        doc.playlist.shift();
        terminalMessage('shifting to next song in ' + room);
        io.to(room).emit('playlist', doc.playlist);
        if (doc.playlist.length > 0 ) {
            io.to(room).emit('server message', 'Now playing: ' + doc.playlist[0].title);
        }
        doc.save(function(err){
            if (err) console.error(err);
        });
        Room.findOne({name: room}, function(err, roomDoc){
            roomDoc.votes = [];
            roomDoc.finished = [];
            roomDoc.startTime = getCurrentDate();
            roomDoc.save(function(err){
                if (err) console.error(err);
            });
        });
    });
}

// update the timestamp in the playlist
// the platform should always be rooms[room].playlist[0].platform
// it asks for it as a parameter to avoid potential bugs
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
// /add <streaming service> <channel> <number of videos 1-20>
// /add youtube mrsuicidesheep 10
function getSongs(message, userId, room) {
    command = message.msg.split(" ");
    if (command[1] === "youtube" && command[2] && !isNaN(command[3]) && command[3] < 21 && command[3] > 0) {
        maml.getYouTubeChannelUploads(command[2], command[3], apiKeys.YouTube, function (uploads) {
            if (uploads === null) {
                io.to(userId).emit('server message', "Couldn't find any songs");
            } else {
                var songArray = [];
                for (var i = 0; i < uploads.length; i++) {
                    songArray.push("https://www.youtube.com/watch?v=" + uploads[i]);

                }
                addSong(songArray, room);
                io.to(room).emit('server message', message.nick + " added " + uploads.length + " videos from YouTube channel " + command[2] + ".");
            }
            });
    } else {
        io.to(userId).emit('server message', 'Bad Parameters use /help for more info');
    }
}

//get multiple songs from a yt playlist
// /addplaylist <playlistID> <number of videos 1-20>
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
    Room.find({}, function(err, docs){
        if (err) console.error(err);
        for (var i = 0; i < docs.length; i++) {
            roomList.rooms.push(docs[i].name);
            roomList.users.push(findClientsByRoomName(docs[i].name).filter(Boolean).length);
        }
        fs.writeFile('./public/roomList.json', JSON.stringify(roomList), function(e){
            if (e) throw e;
        });
    });
}

// add a song to the playlist
// new song can be either a link to a song or an array of links
function addSong(newSong, room, userId) {
    var plObj = [];
    var parsed;
    if (typeof newSong === "string"){
        newSong = [newSong];
    }
    for (var i = 0; i < newSong.length; i ++) {
        parsed = urlParser(newSong[i]);
        if (parsed !== false ){
            plObj.push(new playlistObject(parsed.id, 'Checking Title...', parsed.platform, 0, 0));
        } else if (parsed === false) {
            io.to(userId).emit('server message', "Bad URL");
            terminalMessage('bad url');
            terminalMessage(newSong);
        }
        if (plObj.length === 0) {
            return;
        }
    }
    Playlist.findOne({room: room}, function(err, doc) {
        if (!doc) {
            doc = new Playlist({
                room: room,
                playlist: []
            });
        }

        for (var i = 0; i < plObj.length; i++) {
            for (var n = 0; n < doc.playlist.length; n++) {
                if (doc.playlist[n].id === plObj[i].id) {
                    io.to(userId).emit('server message', 'That song is already in the playlist');
                    return;
                }
            }
        }
        if (doc.playlist.length < 1) {
            // start the timer for the current song
            Room.findOne({name: room}, function(err, doc) {
                if (err) console.error(err);
                doc.startTime = getCurrentDate();
                terminalMessage("time Started set");
                doc.save(function(err) {
                    if (err) console.error(err);
                });
            });
        }
        doc.playlist = doc.playlist.concat(plObj);
        io.to(room).emit('playlist', doc.playlist);
        terminalMessage("playlist with no title sent");
        doc.save(function(err, docdoc){
            if (err) console.error(518, err);
            console.log(519, docdoc);
        });

        // get media info from MAML
        maml.getMediaInfo(plObj, apiKeys, doc, function (newPlObj){
            console.log(newPlObj);
            console.log(523, doc.playlist);
            var playPos = false;
            for (var e=0; e < doc.playlist.length; e++) {
                if (newPlObj.id === doc.playlist[e].id) {
                    console.log(e);
                    playPos = e;
                    break;
                }
            }
            if (playPos !== false) {
                doc.playlist[playPos] = newPlObj;
                doc.markModified('playlist');
                console.log(534, doc.playlist);
                doc.save(function (err) {
                    console.log('saveddoc', doc.playlist);
                    if (540, err) {
                        console.error(err);
                    } else {
                        io.to(room).emit('playlist', doc.playlist);
                        terminalMessage("sending updated playlist with title");
                        if (doc.playlist.length === 1) {
                            io.to(room).emit('server message', 'Now playing: ' + doc.playlist[0].title);
                        }
                    }
                });
            }
        });

    });
}

// vote to skip
function voteSkip(currentSong , userId, room) {
    Playlist.findOne({room: room}, function (err, playlistDoc) {
        if (playlistDoc.playlist[0]) {
            terminalMessage('got Vote');
            // check if the song the user voted on is actually the song on the top of the playlist
            if (currentSong.id && currentSong.id === playlistDoc.playlist[0].id) {
                Room.findOne({name: room}, function (err, roomDoc){
                    if (err) console.error(err);
                    var ifVoted = checkIfVoted(userId, roomDoc.votes);
                    terminalMessage('voted: ' + ifVoted);
                    if (!ifVoted) {
                        roomDoc.votes.push(userId);
                        roomDoc.save(function(err){
                            if (err) console.error(err);
                        });
                        User.findOne({socketid: userId}, function(err, userDoc) {
                            var message = userDoc.nick + " voted to skip " + playlistDoc.playlist[0].title;
                            io.to(room).emit('server message', message);
                        });
                    } else {
                        io.to(userId).emit('server message', "You already voted");
                    }
                    var clients = findClientsByRoomName(room);
                    clients = clients.filter(Boolean);
                    var test = clients.length / 2;
                    if (roomDoc.votes.length > test) {
                        io.to(room).emit('server message', 'More than half of the users voted to skip');
                        nextSong(room);
                    }

                });
            } else {
                terminalMessage('currentSong != rooms[room].playlist[0].id');
            }
        }
    });
}

// destroys a room and all entries in the db of that room

// handshake on the beginning of the connection, checks room name
// makes sure the user has a nickname
// returns the room name
function handshake(s, callback) {
    terminalMessage("STARTING HANDSHAKE");
    // make sure heylisten is connected to db before starting to accept clients
    if (db) {
        // determine the proper room name
        var room = s.handshake.headers.referer;
        if (!room) {
            return;
        }
        var n;
        // if (room) is the fix for --> var n = room.lastIndexOf('/') TypeError: Cannot call method 'lastIndexOf' of undefined //
        if (room) n = room.lastIndexOf('/');
        room = room.slice(n, room.length);
        room = room.toLowerCase();
        roomCheck = encodeURI(room);
        if (roomCheck !== room) {
            room = roomCheck;
        }
        // check if room already exists in db and add it if it doesn't
        Room.findOne({ name: room}, function(err, doc){
            console.log(615, doc);
            if(!doc) {
                terminalMessage('Creating a new room ' + room);
                var newRoom = new Room({
                    name: room,
                    opToken: generateToken(16),
                    startTime: 0,
                    votes: [],
                    finished: [],
                    userList: []
                });
                newRoom.save(function(err, newRoom){
                    if(err) return console.error(err);
                    terminalMessage("inserted " + newRoom + " into db");
                });
            }
        });
        //var check = findClientsByRoomID(room); //change
        callback(room);
    }

}

// destroy a room
function destroyRoom(room) {
    var clients = findClientsByRoomName(room);
    if (clients < 1) { //if room is empty destroy it
            terminalMessage('destroying empty room ' + room);
            delete rooms[room];
            var query = Room.remove({name: room});
            query.exec();
            query = Playlist.remove({room: room});
            query.exec();
            query = User.remove({room: room});
            query.exec();

    }
}

// server client communication
// chat message - message in the chat
// playlist - updated playlist, server to client only
// playlist requrest - client to server only, only used when a client first joins a room
// playlist add - add a video to playlist, cliet to server only
// song finished - song finished playing, remove pos 0 from playlist, client to server only
// client list - list clients connected to a room, server to client only
// server message - server massages, server to client only
// info - nickname to be assigned to the id, client to server only
// info request - nickname request, server to client only
// vote skip - cast a vote to skip a song, client to server only
// time - spot in the song the client is in, / not implemented
// startat                                   /not implemented



io.on('connection', function(socket) {
    // perform handshake
    var room = '';
    handshake(socket, function(r){
        room = r;
        socket.join(room);
        // get information about the user
        io.to(socket.id).emit('info request');
        io.to(socket.id).emit('server message', welcomeMessage);
        terminalMessage('user ' + socket.id + ' joined room ' +room);
        // send the new playlist to that user
        Playlist.findOne({room:room}, function(err, doc){
            if (err) console.error(err);
            if (doc) {
                io.to(socket.id).emit('playlist', doc.playlist);
            }
        });
        saveRoomList();
    });

    //disconnection
    socket.on('disconnect', function () {
        socket.leave(room);
        terminalMessage('user ' + socket.id + ' disconnected from ' + room);
        var clients = findClientsByRoomName(room);
        clients = clients.filter(Boolean).length;
        // update list of people in the room
        User.findOne({socketid: socket.id}, function(err, userDoc){
            if (userDoc) {
                var message = userDoc.nick + " disconnected";
                io.to(room).emit('Server Message', message);
                // Update the room document
                Room.findOne({name: room}, function(err, roomDoc){
                    var test = roomDoc.votes.indexOf(socket.id);
                    // if user voted remove the socket id from array
                    if (test !== -1) {
                        roomDoc.votes.splice(test, 1);
                    }
                    test = roomDoc.finished.indexOf(socket.id);
                    // if user finished playing the song remove the socket id from array
                    if (test !== -1) {
                    roomDoc.finished.splice(test, 1);
                    }
                    // send the updated list of names to users
                    sendNames(room, roomDoc.userList);
                });
            }
        });
        if (clients < 1) {
             //start the timeout to destroy the room
            setTimeout(destroyRoom(room), settings.roomTimeout);
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
        sendNames(room, rooms[room].users);
    });

    //vote to skip a song
    socket.on('vote skip', function (currentSong) {
        voteSkip(currentSong, socket.id, room);
    });


    //get a nickname and add it to an array for that room
    socket.on('info', function (nick) {
        addUsrInfo(room, socket.id, nick);
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
