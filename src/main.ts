// Imports
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// Game parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const CACHE_COUNT = 50; // Total number of caches to randomly spawn
const MOVEMENT_DELTA = TILE_DEGREES;

// Wait for the DOM to load before initializing the map
document.addEventListener("DOMContentLoaded", () => {
  // Player variables
  let playerPoints = 0;
  let playerCoins = 0;
  const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
  statusPanel.innerHTML = "No points yet...";

  // Initialize map
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

  // Player marker
  const playerMarker = leaflet.marker(map.getCenter(), { draggable: false });
  playerMarker.bindTooltip("That's you!");
  playerMarker.addTo(map);

  // Caches map
  const cacheMap = new Map<
    string,
    { rect: leaflet.Rectangle; popup: HTMLElement }
  >();

  // Function to spawn caches
  function spawnCache(lat: number, lng: number) {
    const bounds = leaflet.latLngBounds([
      [lat, lng],
      [lat + TILE_DEGREES, lng + TILE_DEGREES],
    ]);

    let cacheCoins = 0;
    let pointValue = Math.floor(luck(`${lat},${lng}`) * 10) + 1;

    const rect = leaflet.rectangle(bounds, {
      color: "#ff0000",
      weight: 2,
    }).addTo(map);

    // Create popup
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>Cache at (${lat.toFixed(5)}, ${lng.toFixed(5)})</div>
      <div>Value: <span id="value">${pointValue}</span></div>
      <div>Coins: <span id="cacheCoins">${cacheCoins}</span></div>
      <button id="collect">Collect Coin</button>
      <button id="deposit">Deposit Coin</button>
    `;

    // Collect coins
    popupDiv.querySelector<HTMLButtonElement>("#collect")!.onclick = () => {
      if (pointValue > 0) {
        playerCoins += pointValue; // Collect all remaining points
        playerPoints += pointValue; // Add points to total
        pointValue = 0; // Cache is fully collected
        statusPanel.innerHTML =
          `Points: ${playerPoints} | Coins: ${playerCoins}`;

        // Remove the cache from the map and cacheMap
        rect.remove(); // Remove rectangle from map
        cacheMap.delete(`${lat}:${lng}`); // Remove cache entry
        console.log(
          `Cache at (${lat}, ${lng}) has been collected and removed.`,
        );
      }
    };

    // Deposit coins
    popupDiv.querySelector<HTMLButtonElement>("#deposit")!.onclick = () => {
      if (playerCoins > 0) {
        const depositAmount = Math.min(playerCoins, 5);
        cacheCoins += depositAmount;
        playerCoins -= depositAmount;

        popupDiv.querySelector("#cacheCoins")!.textContent = cacheCoins
          .toString();
        statusPanel.innerHTML =
          `Points: ${playerPoints} | Coins: ${playerCoins}`;
      }
    };

    rect.bindPopup(popupDiv);
    cacheMap.set(`${lat}:${lng}`, { rect, popup: popupDiv });
  }

  // Function to generate random latitude and longitude within map bounds
  function getRandomLatLng(
    center: leaflet.LatLng,
    radius: number,
  ): [number, number] {
    const latOffset = (Math.random() - 0.5) * 2 * radius;
    const lngOffset = (Math.random() - 0.5) * 2 * radius;
    return [center.lat + latOffset, center.lng + lngOffset];
  }

  // Populate map with random caches
  const center = map.getCenter();
  for (let i = 0; i < CACHE_COUNT; i++) {
    const [lat, lng] = getRandomLatLng(center, 0.01); // Radius of 0.01 degrees
    spawnCache(lat, lng);
  }

  // Handle player movement
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

    // Check for overlapping caches
    cacheMap.forEach(({ rect }, _key) => {
      if (rect.getBounds().contains(newPosition)) {
        rect.openPopup();
      }
    });
  }

  // Add movement controls
  document.getElementById("north")!.onclick = () => movePlayer("north");
  document.getElementById("south")!.onclick = () => movePlayer("south");
  document.getElementById("east")!.onclick = () => movePlayer("east");
  document.getElementById("west")!.onclick = () => movePlayer("west");
});
