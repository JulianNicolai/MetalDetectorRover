let map;
let position;
let activeCtrlElement;
let inactiveCtrlElement;
let axesLine;
let axesDot;
let flash;
let flashStatus = 0;
let lastButtonB = 0;
let consoleDisplay;
let consoleColorState = 0;
let intervals = [];

function displayConsole(eventType, eventText) {
    eventType = "EVENT";
    eventText = "Some text about the event.";
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
    if (gp.buttons[1].value && !lastButtonB) {
        if (flashStatus) {
            flash.setAttribute("fill", "#3b3b3b");
            flashStatus = 0;
        } else {
            flash.setAttribute("fill", "#ffffff");
            flashStatus = 1;
        }
    }
    lastButtonB = gp.buttons[1].value;
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

window.onload = () => {
    window.addEventListener("gamepadconnected", gamepadConnect);
    window.addEventListener("gamepaddisconnected", gamepadDisconnect);

    activeCtrlElement = document.getElementById("active-controller");
    inactiveCtrlElement = document.getElementById("inactive-controller");
    axesLine = document.getElementById("dir-line");
    axesDot = document.getElementById("dir-dot");
    flash = document.getElementById("flash-cir");
    consoleDisplay = document.getElementById("console");

    intervals[1] = setInterval(displayConsole, 1000);
};