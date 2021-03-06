let map;
let position;
let axes;
let speedBarR;
let speedBarL;
let speedometer;
let turnRadZero;
let turnRadInf;
let turnRad;
let flash;
let displayLat;
let displayLng;
let displayAlt;
let displaySats;
let displayHDOP;
let flashStatus = 0;
let lastButtonB = 0;
let lastAnalogAxis = [0, 0];
let consoleDisplay;
let consoleColorState = 0;
let intervals = [];
let CoordListGPS = [];
let currLocation;
const topSpeed = 33.6; // top speed in meters/min
const baseAddress = "192.168.0.101";


function displayConsole(eventType, eventText) {
    let currTime = new Date().toTimeString().slice(0, 8);
    consoleDisplay.innerHTML = "<div class='console-entry" + consoleColorState + "'>" + currTime + ": &lt;" + eventType + "&gt; " + eventText + "</div>" + consoleDisplay.innerHTML;
    consoleColorState = consoleColorState ? 0 : 1;
}

function convert(num) {
    return (num + 1) * 50 + 10;
}

function mapAxesToVisual(axes) {
    let speedBarAxes_L = (-axes[1] + 1) * 50 + 10;
    let speedBarAxes_R = (-axes[3] + 1) * 50 + 10;
    speedBarL.setAttribute("y2", speedBarAxes_L);
    speedBarR.setAttribute("y2", speedBarAxes_R);
    // metres per minute
    let currentSpeedMPM = (axes[1] + axes[3]) / 2 * topSpeed; // calcuate current net speed magnitude (average of tracks)
    let currentSpeedMPS_L = axes[1] * topSpeed / 60 / 0.56 * 50;
    let currentSpeedMPS_R = axes[3] * topSpeed / 60 / 0.56 * 50;
    let currentSpeedDisplay = (Math.round(currentSpeedMPM * 10) / 10).toFixed(1);
    speedometer.innerHTML = currentSpeedDisplay;

    let distanceFromCentre;
    if ((currentSpeedMPS_L == 0 && currentSpeedMPS_R == 0)) {
        // rover not moving
        turnRad.style.display = "none";
        turnRadZero.style.display = "block";
        turnRadInf.style.display = "none";
        turnRadSpotCCW.style.display = "none";
        turnRadSpotCW.style.display = "none";

    } 
    else if ((currentSpeedMPS_L + currentSpeedMPS_R) < 1) { // fix this for reverse directions!
        // rover spinning in place
        turnRad.style.display = "none";
        turnRadZero.style.display = "none";
        turnRadInf.style.display = "none";
        if (currentSpeedMPS_L > currentSpeedMPS_R) {
            turnRadSpotCCW.style.display = "none";
            turnRadSpotCW.style.display = "block";
        } else {
            turnRadSpotCCW.style.display = "block";
            turnRadSpotCW.style.display = "none";
        }
        
    } 
    else if (Math.abs(currentSpeedMPS_L - currentSpeedMPS_R) < 2) {
        // going straight forward or backward
        turnRad.style.display = "none";
        turnRadZero.style.display = "none";
        turnRadInf.style.display = "block";
        turnRadSpotCCW.style.display = "none";
        turnRadSpotCW.style.display = "none";

    } else if (currentSpeedMPS_L < currentSpeedMPS_R) {
        // turning a specified curve left (left slower than right)
        turnRad.style.display = "block";
        turnRadZero.style.display = "none";
        turnRadInf.style.display = "none";
        turnRadSpotCCW.style.display = "none";
        turnRadSpotCW.style.display = "none";

        distanceFromCentre = currentSpeedMPS_R * 100 / (currentSpeedMPS_R - currentSpeedMPS_L) - 50;
        if (distanceFromCentre < 0) { 
            turnRad.setAttribute("cx", (60 + Math.abs(distanceFromCentre)).toString());
        } else {
            turnRad.setAttribute("cx", (60 - distanceFromCentre).toString());
        }
        turnRad.setAttribute("r", Math.abs(distanceFromCentre).toString());

    } else {
        // turning a specified curve right (right slower than left)
        turnRad.style.display = "block";
        turnRadZero.style.display = "none";
        turnRadInf.style.display = "none";
        turnRadSpotCCW.style.display = "none";
        turnRadSpotCW.style.display = "none";

        distanceFromCentre = currentSpeedMPS_L * 100 / (currentSpeedMPS_L - currentSpeedMPS_R) - 50;
        if (distanceFromCentre < 0) { 
            turnRad.setAttribute("cx", (60 - Math.abs(distanceFromCentre)).toString());
        } else {
            turnRad.setAttribute("cx", (60 + distanceFromCentre).toString());
        }
        turnRad.setAttribute("r", Math.abs(distanceFromCentre).toString());
    }
}

function getAxes() {
    let gp = navigator.getGamepads()[0];
    let axes = [0, 0, 0, 0];
    for (let i = 0; i < gp.axes.length; i++) {
        let axis = -1 * gp.axes[i];
        if (-0.25 < axis && axis < 0.25) {
            axes[i] = 0;
        } else if (axis > 0.25) {
            axes[i] = (axis - 0.25) / 0.75;
        } else {
            axes[i] = (axis + 0.25) / 0.75;
        }
    }
    return axes;
}

function updateVisuals() {
    axes = getAxes();
    mapAxesToVisual(axes);
}

function updateESP() {
    let gp = navigator.getGamepads()[0];

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
    analogAxis = [Math.round(axes[1] * 16383), Math.round(axes[3] * 16383)]; // 14 bit resolution
    // if ((analogAxis[0] != lastAnalogAxis[0] && analogAxis[1] != lastAnalogAxis[1]) || flashUpdated) {
        
    // }
    // lastAnalogAxis = analogAxis;

    packet = JSON.stringify({"type": 0, "payload": {"analog": analogAxis, "flash": flashStatus}});
    socket.send(packet);
    console.log(packet);
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

    let currLocIcon = {
        url: "curr_loc.svg", 
        anchor: new google.maps.Point(15, 15)
    };

    currLocation = new google.maps.Marker({
        position: {lat: 0, lng: 0},
        map,
        title: `Current location: ${0}, ${0}`,
        icon: currLocIcon
    });
}

function gamepadConnect(e) {
    intervals.push(setInterval(updateVisuals, 20));
    intervals.push(setInterval(updateESP, 50));
    console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.", e.gamepad.index, e.gamepad.id, e.gamepad.buttons.length, e.gamepad.axes.length);
    let activeArr = document.getElementsByClassName("active-controller");
    let inactiveArr = document.getElementsByClassName("inactive-controller");
    for (let i = 0; i < activeArr.length; i++) {
        activeArr[i].style.display = "block";
        inactiveArr[i].style.display = "none";
    }
    let axes = e.gamepad.axes;
    mapAxesToVisual(axes);
}

function gamepadDisconnect(e) {
    console.log("Gamepad disconnected from index %d: %s", e.gamepad.index, e.gamepad.id);
    let activeArr = document.getElementsByClassName("active-controller");
    let inactiveArr = document.getElementsByClassName("inactive-controller");
    for (let i = 0; i < activeArr.length; i++) {
        activeArr[i].style.display = "block";
        inactiveArr[i].style.display = "none";
    }
    for (let interval of intervals) {
        clearInterval(interval);
    }
    intervals = [];
}

window.addEventListener('DOMContentLoaded', (event) => {
    window.addEventListener("gamepadconnected", gamepadConnect);
    window.addEventListener("gamepaddisconnected", gamepadDisconnect);

    flash = document.getElementById("flash-cir");
    speedBarR = document.getElementById("speedbar-right");
    speedBarL = document.getElementById("speedbar-left");
    speedometer = document.getElementById("speedometer");
    turnRadZero = document.getElementById("turn-radius-zero");
    turnRadInf = document.getElementById("turn-radius-inf");
    turnRadSpotCW = document.getElementById("turn-radius-spot-cw");
    turnRadSpotCCW = document.getElementById("turn-radius-spot-ccw");
    turnRad = document.getElementById("turn-radius");
    displayLat = document.getElementById("display-lat");
    displayLng = document.getElementById("display-lng");
    displayAlt = document.getElementById("display-alt");
    displaySats = document.getElementById("display-sats");
    displayHDOP = document.getElementById("display-hdop");
    consoleDisplay = document.getElementById("console");

    document.getElementById('stream').src = `http://${baseAddress}:81/stream`;
});


const socket = new WebSocket(`ws://${baseAddress}:8080`);

// Connection opened
socket.addEventListener('open', function (event) {
    socket.send('Hello Server!');
});

// Listen for messages
socket.addEventListener('message', function (event) {
    let json;
    try {
        json = JSON.parse(event.data);
        switch (json.type) {
            case 0:
                displayConsole("UPDATE", json.payload);
                console.log("UPDATE", json.payload);
                break;
            case 1: {
                
                let latitude = json.payload.location[0];
                let longitude = json.payload.location[1];

                displayConsole("DETECTED METAL", `Found at: ${latitude}, ${longitude}`);
                
                if (!isNaN(latitude) && !isNaN(longitude) && longitude !== 0 && latitude !== 0) {

                    let unique = true;
                    for (let coord of CoordListGPS) {
                        if (coord[0] == latitude && coord[1] == longitude) {
                            unique = false;
                            break;
                        }
                    }

                    if (unique) {

                        let metalLocIcon = {
                            url: "metal.svg", 
                            anchor: new google.maps.Point(15, 15)
                        };

                        CoordListGPS.push([latitude, longitude]);
                        new google.maps.Marker({
                            position: {lat: latitude, lng: longitude},
                            map,
                            title: `Location ${CoordListGPS.length} @ ${latitude}, ${longitude}`,
                            icon: metalLocIcon
                        });
                    }
                }
                break;
            }
            case 2: {

                let latitude = json.payload.location[0];
                let longitude = json.payload.location[1];
                let sats = json.payload.sats;
                let alt = json.payload.alt;
                let hdop = json.payload.hdop;

                displayConsole("LOCATION", `@ ${latitude}, ${longitude} | Sats: ${sats} | Alt: ${alt} | HDOP: ${hdop}`);
                
                let latStr = isNaN(latitude) ? "-" : latitude.toFixed(8);
                let lngStr = isNaN(longitude) ? "-" : longitude.toFixed(8);
                let satsStr = isNaN(sats) ? "-" : sats.toString();
                let altStr = isNaN(alt) ? "-" : alt.toFixed(1);
                let hdopStr = isNaN(hdop) ? "-" : hdop.toString();

                displayLat.innerHTML = latStr + "&deg;";
                displayLng.innerHTML = lngStr + "&deg;";
                displayAlt.innerHTML = altStr;
                displaySats.innerHTML = satsStr;
                displayHDOP.innerHTML = hdopStr;

                if (!isNaN(latitude) && !isNaN(longitude) && longitude !== 0 && latitude !== 0) {
                    let latlng = new google.maps.LatLng(latitude, longitude);
                    currLocation.setPosition(latlng);
                    map.setCenter(latlng);
                }
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