let map;
let position;
let activeCtrlElement;
let inactiveCtrlElement;
let axesLine;
let axesDot;
let flash;
let flashStatus = 0;
let lastButtonB = 0;
let lastAnalogAxis = [0, 0];
let consoleDisplay;
let consoleColorState = 0;
let intervals = [];
let CoordListGPS = [];
let currLocation;
const baseAddress = "192.168.0.101";


function displayConsole(eventType, eventText) {
    // eventType = "EVENT";
    // eventText = "Some text about the event.";
    let currTime = new Date().toTimeString().slice(0, 8);
    consoleDisplay.innerHTML = "<div class='console-entry" + consoleColorState + "'>" + currTime + ": &lt;" + eventType + "&gt; " + eventText + "</div>" + consoleDisplay.innerHTML;
    consoleColorState = consoleColorState ? 0 : 1;
}

function convert(num) {
    return (num + 1) * 50 + 10;
}

function mapAxesToVisual(axes) {
    let coords = [convert(axes[0]), convert(axes[1])];
    axesLine.setAttribute("x2", coords[0]);
    axesLine.setAttribute("y2", coords[1]);
    axesDot.setAttribute("cx", coords[0]);
    axesDot.setAttribute("cy", coords[1]);
}

function update() {
    let gp = navigator.getGamepads()[0];
    mapAxesToVisual(gp.axes);
    let flashUpdated = false;
    if (gp.buttons[1].value && !lastButtonB) {
        flashUpdated = true;
        if (flashStatus) {
            flash.setAttribute("fill", "#3b3b3b");
            flashStatus = 0;
        } else {
            flash.setAttribute("fill", "#ffffff");
            flashStatus = 1;
        }
    }
    lastButtonB = gp.buttons[1].value;
    analogAxis = [Math.round(gp.axes[0] * 1023), Math.round(gp.axes[1] * 1023)];
    if (analogAxis[0] != lastAnalogAxis[0] || analogAxis[1] != lastAnalogAxis[1] || flashUpdated) {
        packet = JSON.stringify({"type": 0, "payload": {"analog": analogAxis, "flash": flashStatus}});
        socket.send(packet);
        lastAnalogAxis = analogAxis;
    }
}

function initMap() {
    coords = {latitude: 45.384698, longitude: -75.6983645};
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: coords.latitude, lng: coords.longitude },
        zoom: 18,
        mapTypeId: 'satellite'
    });

    map.setTilt(0);

    infoWindow = new google.maps.InfoWindow();

    const locationButton = document.createElement("button");

    locationButton.textContent = "Current Location";
    locationButton.classList.add("location-button");
    map.controls[google.maps.ControlPosition.TOP_CENTER].push(locationButton);
    locationButton.addEventListener("click", () => {
        // Try HTML5 geolocation.
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };

                map.setCenter(pos);
                }, () => {handleLocationError(true, infoWindow, map.getCenter());}
            );
        } else {
        // Browser doesn't support Geolocation
        handleLocationError(false, infoWindow, map.getCenter());
        }
    });

    currLocation = new google.maps.Marker({
        position: {lat: 0, lng: 0},
        map,
        title: `Current location: ${0}, ${0}`,
        icon: "curr_loc.svg"
    });
}

function gamepadConnect(e) {
    intervals[0] = setInterval(update, 20);
    console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
        e.gamepad.index, e.gamepad.id,
        e.gamepad.buttons.length, e.gamepad.axes.length);
    activeCtrlElement.style.display = "block";
    inactiveCtrlElement.style.display = "none";
    let axes = e.gamepad.axes;
    mapAxesToVisual(axes);
}

function gamepadDisconnect(e) {
    console.log("Gamepad disconnected from index %d: %s",
        e.gamepad.index, e.gamepad.id);
    activeCtrlElement.style.display = "none";
    inactiveCtrlElement.style.display = "block";
}

window.addEventListener('DOMContentLoaded', (event) => {
    window.addEventListener("gamepadconnected", gamepadConnect);
    window.addEventListener("gamepaddisconnected", gamepadDisconnect);

    activeCtrlElement = document.getElementById("active-controller");
    inactiveCtrlElement = document.getElementById("inactive-controller");
    axesLine = document.getElementById("dir-line");
    axesDot = document.getElementById("dir-dot");
    flash = document.getElementById("flash-cir");
    consoleDisplay = document.getElementById("console");

    // intervals[1] = setInterval(displayConsole, 1000);

    document.getElementById('stream').src = `http://${baseAddress}:81/stream`;
});

const socket = new WebSocket(`ws://${baseAddress}:8080`);

// Connection opened
socket.addEventListener('open', function (event) {
    socket.send('Hello Server!');
});

// Listen for messages
socket.addEventListener('message', function (event) {
    // console.log('Message from server ', event.data);
    let json;
    try {
        json = JSON.parse(event.data);
        switch (json.type) {
            case 0:
                displayConsole("UPDATE", json.payload);
                break;
            case 1: {
                
                let latitude = json.payload[0];
                let longitude = json.payload[1];

                displayConsole("METAL DETECT", `Detected metal at: ${latitude}, ${longitude}`);
                
                let unique = true;
                for (let coord of CoordListGPS) {
                    if (coord[0] == latitude && coord[1] == longitude) {
                        unique = false;
                        break;
                    }
                }

                if (unique) {
                    CoordListGPS.push([latitude, longitude]);
                    new google.maps.Marker({
                        position: {lat: latitude, lng: longitude},
                        map,
                        title: `Location ${CoordListGPS.length} @ ${latitude}, ${longitude}`,
                        icon: "metal.svg"
                    });
                }
                break;
            }
            case 2: {

                // let latitude = json.payload[0] + ((Math.random() - 0.5 ) / 1000);
                // let longitude = json.payload[1] + ((Math.random() - 0.5 ) / 1000);
                let latitude = json.payload[0];
                let longitude = json.payload[1];

                displayConsole("LOCATION", `Current location: ${latitude}, ${longitude}`);

                let latlng = new google.maps.LatLng(latitude, longitude);
                currLocation.setPosition(latlng);
                break;
            }
            default:
                displayConsole("UNKNOWN", event.data);
                break;
        }
    } catch (err) {
        displayConsole("ERROR", err.message);
        displayConsole("UNKNOWN", event.data);
    }
    
});