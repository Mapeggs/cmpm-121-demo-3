import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import _luck from "./luck.ts"; // Prefixed with `_` since it's not currently used

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const CACHE_COUNT = 50; // Total number of caches to randomly spawn
const MOVEMENT_DELTA = TILE_DEGREES;

// Define the Cache type
type Cache = {
  key: string;
  lat: number;
  lng: number;
  cacheCoins: number;
  value: number;
};

document.addEventListener("DOMContentLoaded", () => {
  let playerPoints = 0;
  let playerCoins = 0;
  let totalDepositedCoins = 0; // Track total deposited coins
  let geoWatchId: number | null = null;

  const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
  statusPanel.innerHTML = "No points yet...";

  const map = leaflet.map(document.getElementById("map")!, {
    center: leaflet.latLng(36.98949379578401, -122.06277128548504),
    zoom: GAMEPLAY_ZOOM_LEVEL,
    minZoom: GAMEPLAY_ZOOM_LEVEL,
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
    scrollWheelZoom: false,
  });

  leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  const playerMarker = leaflet.marker(map.getCenter(), { draggable: false });
  playerMarker.bindTooltip("That's you!");
  playerMarker.addTo(map);

  const movementPolyline = leaflet.polyline([], { color: "blue" }).addTo(map);

  const cacheMap = new Map<
    string,
    { rect: leaflet.Rectangle; popup: HTMLElement }
  >();

  // Function to update the status panel
  function updateStatusPanel() {
    statusPanel.innerHTML =
      `Points: ${playerPoints} | Coins: ${playerCoins} | Deposited: ${totalDepositedCoins}`;
  }

  // Standalone function to create the popup content
  function createCachePopup(
    lat: number,
    lng: number,
    pointValue: number,
    cacheCoins: number,
  ): HTMLDivElement {
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>Cache at (${lat.toFixed(5)}, ${lng.toFixed(5)})</div>
      <div>Value: <span id="value">${pointValue}</span></div>
      <div>Coins: <span id="cacheCoins">${cacheCoins}</span></div>
      <button id="collect">Collect Coin</button>
      <button id="deposit">Deposit Coin</button>
      <button id="centerMap">Center on Cache</button>
    `;
    return popupDiv;
  }

  function spawnCache(
    lat: number,
    lng: number,
    pointValue: number = Math.floor(Math.random() * 10) + 1,
    cacheCoins: number = 0,
  ) {
    const bounds = leaflet.latLngBounds([
      [lat, lng],
      [lat + TILE_DEGREES, lng + TILE_DEGREES],
    ]);

    const rect = leaflet.rectangle(bounds, {
      color: "#ff0000",
      weight: 2,
    }).addTo(map);

    const popupDiv = createCachePopup(lat, lng, pointValue, cacheCoins);

    // Bind specific logic to the popup
    popupDiv.querySelector<HTMLButtonElement>("#collect")!.onclick = () => {
      if (pointValue > 0) {
        playerCoins += pointValue;
        playerPoints += pointValue;
        pointValue = 0;
        rect.remove(); // Remove cache from map
        cacheMap.delete(`${lat}:${lng}`); // Remove from tracking
        updateStatusPanel(); // Update UI
        saveGameState(); // Persist changes
      }
    };

    popupDiv.querySelector<HTMLButtonElement>("#deposit")!.onclick = () => {
      if (playerCoins > 0) {
        const depositAmount = Math.min(playerCoins, 5);
        cacheCoins += depositAmount;
        playerCoins -= depositAmount;
        totalDepositedCoins += depositAmount; // Track deposits
        popupDiv.querySelector("#cacheCoins")!.textContent = cacheCoins
          .toString();
        updateStatusPanel(); // Update UI
        saveGameState(); // Persist changes
      }
    };

    popupDiv.querySelector<HTMLButtonElement>("#centerMap")!.onclick = () => {
      map.setView(rect.getBounds().getCenter(), GAMEPLAY_ZOOM_LEVEL);
    };

    rect.bindPopup(popupDiv);
    cacheMap.set(`${lat}:${lng}`, { rect, popup: popupDiv });
  }

  // Load game state and use it
  function loadGameState() {
    const state = JSON.parse(localStorage.getItem("gameState") || "{}");

    playerPoints = state.playerPoints || 0;
    playerCoins = state.playerCoins || 0;
    totalDepositedCoins = state.totalDepositedCoins || 0; // Load total deposited coins
    const playerPosition = state.playerPosition || map.getCenter();
    playerMarker.setLatLng(playerPosition);
    map.setView(playerPosition, GAMEPLAY_ZOOM_LEVEL);

    (state.caches || []).forEach((cache: Cache) => {
      spawnCache(cache.lat, cache.lng, cache.value, cache.cacheCoins);
    });

    updateStatusPanel(); // Update the status panel after loading
  }

  // Invoke loadGameState on page load
  if (localStorage.getItem("gameState")) {
    loadGameState();
  } else {
    // Generate new caches if no saved state exists
    const center = map.getCenter();
    for (let i = 0; i < CACHE_COUNT; i++) {
      const [lat, lng] = [
        center.lat + (Math.random() - 0.5) * 0.01,
        center.lng + (Math.random() - 0.5) * 0.01,
      ];
      spawnCache(lat, lng);
    }
  }

  // Reset game state
  document.getElementById("reset")!.onclick = () => {
    if (
      confirm("Are you sure you want to erase your game state and start over?")
    ) {
      playerPoints = 0;
      playerCoins = 0;
      totalDepositedCoins = 0; // Reset total deposited coins
      movementPolyline.setLatLngs([]);
      cacheMap.forEach(({ rect }) => rect.remove());
      cacheMap.clear();
      localStorage.clear();

      const originalSpawnPoint = leaflet.latLng(
        36.98949379578401,
        -122.06277128548504,
      );
      playerMarker.setLatLng(originalSpawnPoint);
      map.setView(originalSpawnPoint, GAMEPLAY_ZOOM_LEVEL);

      for (let i = 0; i < CACHE_COUNT; i++) {
        const [lat, lng] = [
          originalSpawnPoint.lat + (Math.random() - 0.5) * 0.01,
          originalSpawnPoint.lng + (Math.random() - 0.5) * 0.01,
        ];
        spawnCache(lat, lng);
      }

      updateStatusPanel(); // Update status panel
    }
  };

  // Function to save the game state
  function saveGameState() {
    const gameState = {
      playerPoints,
      playerCoins,
      totalDepositedCoins, // Save total deposited coins
      playerPosition: playerMarker.getLatLng(),
      caches: Array.from(cacheMap.entries()).map(([key, { rect, popup }]) => {
        const bounds = rect.getBounds();
        const lat = bounds.getSouthWest().lat;
        const lng = bounds.getSouthWest().lng;
        const cacheCoins = parseInt(
          popup.querySelector("#cacheCoins")?.textContent || "0",
        );
        const value = parseInt(
          popup.querySelector("#value")?.textContent || "0",
        );
        return { key, lat, lng, cacheCoins, value };
      }),
    };
    localStorage.setItem("gameState", JSON.stringify(gameState));
  }

  // Enable/Disable geolocation
  document.getElementById("sensor")!.onclick = () => {
    if (geoWatchId !== null) {
      navigator.geolocation.clearWatch(geoWatchId);
      geoWatchId = null;
      alert("Geolocation disabled.");
    } else {
      if ("geolocation" in navigator) {
        geoWatchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const newLatLng = leaflet.latLng(latitude, longitude);
            playerMarker.setLatLng(newLatLng);
            map.setView(newLatLng, GAMEPLAY_ZOOM_LEVEL);
            updatePolyline(newLatLng);
            saveGameState(); // Save updated state
          },
          (error) => {
            console.error("Geolocation error:", error.message);
            alert("Unable to access your location.");
          },
        );
        alert("Geolocation enabled.");
      } else {
        alert("Geolocation is not supported by your browser.");
      }
    }
  };

  // Function to update movement polyli
  function updatePolyline(newLatLng: leaflet.LatLng) {
    const latLngs = movementPolyline.getLatLngs() as leaflet.LatLng[];
    latLngs.push(newLatLng);
    movementPolyline.setLatLngs(latLngs);
  }

  // Movement function
  function movePlayer(direction: string) {
    const playerPosition = playerMarker.getLatLng();
    let newLat = playerPosition.lat;
    let newLng = playerPosition.lng;

    switch (direction) {
      case "north":
        newLat += MOVEMENT_DELTA;
        break;
      case "south":
        newLat -= MOVEMENT_DELTA;
        break;
      case "east":
        newLng += MOVEMENT_DELTA;
        break;
      case "west":
        newLng -= MOVEMENT_DELTA;
        break;
    }

    const newPosition = leaflet.latLng(newLat, newLng);
    playerMarker.setLatLng(newPosition);
    saveGameState(); // Save player position

    cacheMap.forEach(({ rect }, _key) => {
      if (rect.getBounds().contains(newPosition)) {
        rect.openPopup();
      }
    });
  }

  // Buttons for player movement
  document.getElementById("north")!.onclick = () => movePlayer("north");
  document.getElementById("south")!.onclick = () => movePlayer("south");
  document.getElementById("east")!.onclick = () => movePlayer("east");
  document.getElementById("west")!.onclick = () => movePlayer("west");

  // Save the game state on window unload
  globalThis.addEventListener("beforeunload", saveGameState);
});
