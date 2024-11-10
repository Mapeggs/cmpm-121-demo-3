import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// Constants for the game setup
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 0.0001;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
let playerCoins = 0;

// Map for storing cache cells (Flyweight pattern)
const cacheMap = new Map<string, CacheCell>();

// Class to represent a grid cell (Flyweight pattern)
class CacheCell {
  coins: Coin[] = [];
  constructor(public i: number, public j: number) {}
}

// Class to represent a coin with a unique ID based on cache location and serial number
class Coin {
  constructor(public i: number, public j: number, public serial: number) {}
  get id() {
    return `${this.i}:${this.j}#${this.serial}`;
  }
}

// Initialize the map
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Add a tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Place the player marker
const playerMarker = leaflet.marker(OAKES_CLASSROOM).addTo(map);
playerMarker.bindTooltip("You are here!");

// Display player's current coin count
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "Coins: 0";

// Convert latitude and longitude to grid coordinates anchored at Null Island
function latLngToGrid(lat: number, lng: number): { i: number; j: number } {
  return {
    i: Math.floor(lat / TILE_DEGREES),
    j: Math.floor(lng / TILE_DEGREES),
  };
}

// Function to get or create a cache cell (Flyweight pattern)
function getOrCreateCacheCell(i: number, j: number): CacheCell {
  const key = `${i}:${j}`;
  if (!cacheMap.has(key)) {
    cacheMap.set(key, new CacheCell(i, j));
  }
  return cacheMap.get(key)!;
}

// Function to generate caches around the player
function spawnCache(i: number, j: number) {
  const cacheCell = getOrCreateCacheCell(i, j);

  // Generate coins for this cache with unique serial numbers
  const coinCount = Math.floor(luck(`${i},${j},coins`) * 10) + 1;
  for (let serial = 0; serial < coinCount; serial++) {
    cacheCell.coins.push(new Coin(i, j, serial));
  }

  // Convert grid coordinates back to lat/lng bounds for the rectangle
  const bounds = leaflet.latLngBounds([
    [
      OAKES_CLASSROOM.lat + i * TILE_DEGREES,
      OAKES_CLASSROOM.lng + j * TILE_DEGREES,
    ],
    [
      OAKES_CLASSROOM.lat + (i + 1) * TILE_DEGREES,
      OAKES_CLASSROOM.lng + (j + 1) * TILE_DEGREES,
    ],
  ]);

  // Add a rectangle as the cache marker
  const rect = leaflet.rectangle(bounds, { color: "#646cff", weight: 1 }).addTo(
    map,
  );

  // Popup for cache with collect and deposit functionality
  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>Cache at ${i}:${j}</div>
      <div>Coins: ${cacheCell.coins.map((coin) => coin.id).join(", ")}</div>
      <button id="collect">Collect Coins</button>
      <button id="deposit">Deposit Coins</button>`;

    // Collect coins from the cache
    popupDiv.querySelector<HTMLButtonElement>("#collect")!.onclick = () => {
      playerCoins += cacheCell.coins.length;
      cacheCell.coins = [];
      statusPanel.innerHTML = `Coins: ${playerCoins}`;
      popupDiv.querySelector("div:nth-child(2)")!.textContent = "Coins: 0";
    };

    // Deposit coins to the cache
    popupDiv.querySelector<HTMLButtonElement>("#deposit")!.onclick = () => {
      if (playerCoins > 0) {
        const newCoin = new Coin(i, j, cacheCell.coins.length);
        cacheCell.coins.push(newCoin);
        playerCoins--;
        popupDiv.querySelector("div:nth-child(2)")!.textContent = `Coins: ${
          cacheCell.coins.map((coin) => coin.id).join(", ")
        }`;
        statusPanel.innerHTML = `Coins: ${playerCoins}`;
      }
    };

    return popupDiv;
  });
}

// Determine the grid cell for OAKES_CLASSROOM and spawn caches around it
const playerGrid = latLngToGrid(OAKES_CLASSROOM.lat, OAKES_CLASSROOM.lng);
for (let di = -NEIGHBORHOOD_SIZE; di <= NEIGHBORHOOD_SIZE; di++) {
  for (let dj = -NEIGHBORHOOD_SIZE; dj <= NEIGHBORHOOD_SIZE; dj++) {
    const gridI = playerGrid.i + di;
    const gridJ = playerGrid.j + dj;
    if (luck(`${gridI},${gridJ}`) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(gridI, gridJ);
    }
  }
}
