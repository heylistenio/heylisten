var nickname;
var playlist = [];
var currentSong;
var socket = io();
var placeholder = "<div id='placeholder' class='player'><img src='/public/img/addSongs.png' /></div>";
var YTplayerDIV = "<div id='YTplayer' class='player'></div>";
var SCplayerDIV = "<iframe id='SCplayer' class='player' src='https://w.soundcloud.com/player/?url='></iframe>";

function playerSwitch(song) {
    console.log("player switch " + song);
    var media = document.getElementById('media');
    switch (song.platform) {
        case "youtube":
            player.innerHTML = YTplayerDIV;
            onYouTubeIframeAPIReady();
            break;
        case "soundcloud":
            player.innerHTML = "<iframe id='SCplayer' class='player' src='https://w.soundcloud.com/player/?url=" + song.id + "&auto_play=true'></iframe>";
            onSCIframeApiReady();
            break;
        case "vimeo":
            player.innerHTML = "<iframe id='vimeoIframe' class='player' src='https://player.vimeo.com/video/" + song.id + "?api=1&player_id=vimeoIframe'></iframe>";
            onVimeoIframeApiReady();
            break;
        default:
            player.innerHTML = placeholder;
    }
}

//make sc iframe
function onSCIframeApiReady() {
    if (window.SC) {
        var widgetiframe = document.getElementById("SCplayer");
        window.SCplayer = SC.Widget(widgetiframe);
        SCplayer.bind(SC.Widget.Events.FINISH, function() {
            socket.emit("song finished");
            playlist.push();
            play(playlist[0].id);
        });
        SCplayer.bind(SC.Widget.Events.PLAY, function () {
            setVolume();
            SCplayer.seekTo(playlist[0].startAt);
        });
    }
}

//make yt iframe
function onYouTubeIframeAPIReady() {
    if (window.YT) {
        window.YTplayer = new YT.Player('YTplayer', {
            height: 315,
            width: 560,
            playerVars: {
                controls: 0
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });
    }
}

//make a vimeo iframe
function onVimeoIframeApiReady() {
    var iframe = document.getElementById('vimeoIframe');
    window.VimeoPlayer = $f(iframe);
    //add event listeners when player is ready
    VimeoPlayer.addEvent('ready', function() {
		if (playlist[0].startAt !== 0) {
        	VimeoPlayer.api('seekTo', playlist[0].startAt);
		}
		VimeoPlayer.addEvent('finish', function(){
			socket.emit("song finished");
        	playlist.push();
		});
        VimeoPlayer.api('play');
        setVolume();
    });
}

//player
function onPlayerReady(event) {
    console.log('YT ready');
    if (playlist.length > 0) {
        event.target.cueVideoById(playlist[0].id, playlist[0].startAt, 'medium');
        event.target.playVideo();
        setVolume();
    }
}


//inform the server that a video finished playing

function onPlayerStateChange(event) {
    if (event.data === 0) {
        socket.emit("song finished");
        playlist.push();
        //play(playlist[0].id);
    }
}

//get current time position
function getCurrentTime() {
    var timeVar = false;
    if (currentSong) {
        if (currentSong.platform === "youtube") {
            if (YTplayer.getCurrentTime) {
                timeVar = YTplayer.getCurrentTime();
                return timeVar;
            }
        } else if(currentSong.platform === "soundcloud") {
            if (widget.getPosition) {
                timeVar = widget.getPosition / 1000;
                return timeVar;
            }
        }
    } else {
        return timeVar;
    }

}



// play a song
function play(song, callback) {
  timeStamp = getCurrentTime();
    if (!currentSong || currentSong.id != song.id || (currentSong.id === song.id && timeStamp != song.startAt)) {
        if (!currentSong || currentSong.platform != song.platform) playerSwitch(song);
        currentSong = song;
        switch (playlist[0].platform) {
            case "youtube":
                if (YTplayer.loadVideoById) YTplayer.loadVideoById(song.id, song.startAt, 'medium');
                break;
            case "soundcloud":
                //SC.load(song.id, {auto_play: true});
                playerSwitch(song);
                SCplayer.seekTo(song.startAt);
                break;
            case "vimeo":
                break;
            }
        }
}

// change volume
function setVolume() {
    var volume = document.getElementById("volume").value;
    if (playlist[0].platform === "youtube") {
        YTplayer.setVolume(volume);
    } else if(playlist[0].platform === "soundcloud") {
        volume = volume / 100;
        SCplayer.setVolume(volume);
    } else if (playlist[0].platform === "vimeo") {
        volume = volume / 100;
        VimeoPlayer.api('setVolume', volume);
    }
}


//update playlist from array

function updatePlaylist(playlistArray) {
    if (playlist.length > 0) {
        document.getElementById('playlist').innerHTML = '';
        document.getElementById('current').innerHTML = playlistArray[0].title;
        document.title = playlistArray[0].title + " - heylisten.io";
        for (var i = 1; i < playlist.length; i++) {
            var playlistElement = document.createElement('LI');
            var playlistAdd = document.createTextNode(playlistArray[i].title);
            playlistElement.appendChild(playlistAdd);
            document.getElementById('playlist').appendChild(playlistElement);
        }
    }
}

//update the list of clients
function updateClientList(clientArray) {
    document.getElementById('clients').innerHTML = '';
    for (var c in clientArray) {
        var clientElement = document.createElement('LI');
        var clientAdd = document.createTextNode(clientArray[c]);
        clientElement.appendChild(clientAdd);
        document.getElementById('clients').appendChild(clientElement);
    }
}

//create a cookie with a nickname
function newCookie(nick) {
    var d = new Date();
    d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000));
    var expires = "expires=" + d.toUTCString();
    document.cookie = "nickname=" + nick + "; " + expires;
}
//check if there is a cookie with a nicname
function checkNickname() {
    if (document.cookie) {
        var co = document.cookie.split(';');
        for (var i in co) {
            var n = co[i];
            if (n.indexOf("nickname" === 0)) {
                return n.substring(9, n.length);
            }
        }
        return false;
    } else {
        return false;
    }
}

function isURL(str) {
    var pattern = /((http(s)?):\/\/|(www\.)|(http(s)?):\/\/(www\.))[?a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/;
    var match = str.match(pattern);
    if (match && match[0] === str) {
        return true;
    } else {
        return false;
    }
}

function setNickname(reset) {
    var n;
    if (reset) {
        n = false;
    } else {
        n = checkNickname();
    }
    if (!n) {
        document.getElementById("nickbox").style.display = "inline";
        document.getElementById("nickinput").onsubmit = function() {
            nickname = document.getElementById('nick').value;
            if (nickname) {
                document.getElementById("nickbox").style.display = "none";
                document.getElementById("nickname").innerHTML = nickname;
                newCookie(nickname);
                socket.emit("nickname", nickname);
                return false;
            }
        };
    } else {
        nickname = n;
        document.getElementById("nickname").innerHTML = nickname;
        socket.emit("nickname", nickname);
    }
    return false;
}

//set nickname
socket.on('nick request', function() {
    setNickname();
});

//function for recieving messages
function newMessage(msg, srv) {
    var chatMsgElement = document.createElement('LI');
    if (srv === true) {
        chatMsgElement.className = "serverMessage";
    }
    var d = new Date();
    d.getTime();
    var s = d.getSeconds();
    var m = d.getMinutes();
    var h = d.getHours();
    if ( s < 10) {
        s = "0" + s;
    }
    if ( m < 10) {
        m = "0" + m;
    }
    if ( h < 10) {
        h = "0" + h;
    }
    msg = h + ":" + m + ":" + s + " | " + msg;
    //check if emojione is loaded if yes proceed to parse the massage for emojis
    var chatMsg;
    if (emojione) {
        var output = msg.split(" ");
        var msgPart;
        var parser = new DOMParser();
        for (var i = 0; i < output.length; i++) {
            msgPart = emojione.toImage(output[i]);
            if (msgPart != output[i]) {
                var emojis = parser.parseFromString(msgPart, "text/html").firstChild.childNodes[1].childNodes;
                emojis = Array.prototype.slice.call(emojis);
                for (var ii = 0; ii < emojis.length; ii ++) {
                    chatMsgElement.appendChild(emojis[ii]);
                }
            } else if (isURL(output[i])) {
                var link = output[i];
                if (link.indexOf("http://") === -1 && link.indexOf("https://") === -1) link = "http://" + link;
                msgPart = '<a target="_blank" href="' + link + '">' + output[i] + '</a>';
                chatMsg = parser.parseFromString(msgPart, "text/html").firstChild.childNodes[1].firstChild;
                chatMsgElement.appendChild(chatMsg);
                chatMsgElement.innerHTML += ' ';
            } else {
                chatMsg = document.createTextNode(output[i] + " ");
                chatMsgElement.appendChild(chatMsg);
            }
        }
    } else {
        chatMsg = document.createTextNode(msg);
        chatMsgElement.appendChild(chatMsg);
    }
    document.getElementById('messages').appendChild(chatMsgElement);
    var last = document.getElementById("messages").childNodes.length - 1;
    document.getElementById('messages').childNodes[last].scrollIntoView();

}


//send messages
document.getElementById("messageInput").onsubmit = function() {
    var chatMessage = {
        nick: nickname,
        msg: document.getElementById('m').value
    };
    socket.emit('chat message', chatMessage);
    document.getElementById('m').value = '';
    return false;
};

function vote() {
    socket.emit("vote skip", currentSong);
}

function resync() {
    socket.emit("resync");
}

//recieve updated playlist
socket.on('playlist', function(newPlaylist) {
    console.log('new playlist');
    playlist = newPlaylist;
    updatePlaylist(playlist);
    if (playlist.length > 0) {
        play(playlist[0]);
    }
});

//recieve chat messages
socket.on('chat message', function(msg) {
    newMessage(msg, false);
});

//recieve server message
socket.on('server message', function(msg) {
    newMessage(msg, true);
});

//Add song to playlist
document.getElementById("playlistAdd").onsubmit = function() {
    console.log('add');
    var vidID = document.getElementById('pla').value;
    if (vidID) {
        if (vidID != currentSong && vidID != playlist[1]) {
            socket.emit('playlist add', vidID);
        }
    }
    document.getElementById('pla').value = '';
    return false;
};


//recieve updated client list
socket.on('client list', function(newClientList) {
    updateClientList(newClientList);
});

//time stuff

socket.on('time', function() {
    var newTime = getCurrentTime();
    socket.emit('time', newTime);
});


// event listeners

document.getElementById('volume').addEventListener("input", function () {setVolume();});
document.getElementById('nickname').addEventListener("click", function () {setNickname(true);});
