document.getElementById("roomForm").onsubmit = function(){
    var link = 'https://heylisten.io/' + document.getElementById('r').value;
    window.location.href = link;
    return false;
};

//get list of rooms
function getRoomList() {
    var req;
    var rooms;
    req = new XMLHttpRequest();
    req.onreadystatechange = function loadState() {
        if (req.readyState === 4 && req.status === 200){
            rooms = JSON.parse(req.responseText);
            if (rooms.rooms.length > 0) {
                listRooms(rooms);
            } else {
                document.getElementById('roomList').children[1].innerHTML = "<h2>There are no active rooms right now. You should make one.</h2>";
            }
        }

    };
    req.open("GET", "https://heylisten.io/roomList.json", true);
    req.send(null);
}

function listRooms(rooms) {
    var list = '';
    for (var i=0; i < rooms.rooms.length; i++) {
        if (rooms.users[i] > 99) rooms.users[i] = '99+';
        list +='<li><a href="https://heylisten.io' + decodeURI(rooms.rooms[i]) + '"><span>'+ rooms.users[i] + "</span>" + decodeURI(rooms.rooms[i].substring(1)) + '</a>';
    }
    document.getElementById('roomList').children[1].innerHTML = list;

}

function onLoadEvents() {
    getRoomList();
    window.setInterval(getRoomList, 10000);
}

window.onload = function () {onLoadEvents();};
