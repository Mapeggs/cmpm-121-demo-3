// Imports
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// Coordinate conversion function
function toGridCell(
  latitude: number,
  longitude: number,
): { i: number; j: number } {
  const latFactor = Math.round(latitude * 1e4);
  const lngFactor = Math.round(longitude * 1e4);
  return { i: latFactor, j: lngFactor };
}

class Cell {
  constructor(public latitude: number, public longitude: number) {}
}

// Flyweight pattern for cells
class CellFactory {
  private static cells = new Map<string, Cell>();

  public static getCell(latitude: number, longitude: number): Cell {
    const key = `${latitude},${longitude}`;
    if (!CellFactory.cells.has(key)) {
      CellFactory.cells.set(key, new Cell(latitude, longitude));
    }
    return CellFactory.cells.get(key)!;
  }
}

// Game parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Wait for the DOM to load before initializing the map
document.addEventListener("DOMContentLoaded", () => {
  // Convert the center position to grid cells (log this info)
  const centerGrid = toGridCell(36.98949379578401, -122.06277128548504);
  console.log(`Center Grid Cell: ${centerGrid.i}, ${centerGrid.j}`);

  // Use CellFactory if part of the planned pattern
  const centerCell = CellFactory.getCell(
    36.98949379578401,
    -122.06277128548504,
  );
  console.log(`Obtained cell for center location: `, centerCell);

  // Create map reference centered at Oakes College
  const map = leaflet.map(document.getElementById("map")!, {
    center: leaflet.latLng(36.98949379578401, -122.06277128548504),
    zoom: GAMEPLAY_ZOOM_LEVEL,
    minZoom: GAMEPLAY_ZOOM_LEVEL,
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
    scrollWheelZoom: false,
  });

  // Add tile layer to the map
  leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  // Add a player marker to the map
  const playerMarker = leaflet.marker(map.getCenter());
  playerMarker.bindTooltip("That's you!");
  playerMarker.addTo(map);

  // Player points display
  let playerPoints = 0;
  let playerCoins = 0;
  const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
  statusPanel.innerHTML = "No points yet...";

  let coinSerial = 0; // Tracking serial for unique coin IDs

  // Function to spawn caches on the map
  function spawnCache(i: number, j: number) {
    const origin = map.getCenter();
    const bounds = leaflet.latLngBounds([
      [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
      [
        origin.lat + (i + 1) * TILE_DEGREES,
        origin.lng + (j + 1) * TILE_DEGREES,
      ],
    ]);

    const rect = leaflet.rectangle(bounds, {
      color: "#000000",
      weight: 2,
    });
    rect.addTo(map);

    // Random point value and coin count
    let pointValue = Math.floor(luck([i, j, "initialValue"].toString()) * 10) +
      1;
    let cacheCoins = 0;

    // Unique ID for each coin based on spawning cache
    const coinId = `${i}:${j}#${coinSerial++}`;

    rect.bindPopup(() => {
      const popupDiv = document.createElement("div");
      popupDiv.innerHTML = `
        <div>Coin ID: ${coinId}</div>
        <div>Cache at "${i},${j}"</div>
        <div>Value: <span id="value">${pointValue}</span></div>
        <div>Coins: <span id="cacheCoins">${cacheCoins}</span></div>
        <button id="collect">Collect Coin</button>
        <button id="deposit">Deposit Coin</button>`;

      // Button click to collect coin
      popupDiv.querySelector<HTMLButtonElement>("#collect")!.onclick = () => {
        if (pointValue > 0) {
          pointValue--;
          cacheCoins++;
          playerCoins++;
          playerPoints++;
          popupDiv.querySelector<HTMLSpanElement>("#value")!.textContent =
            pointValue.toString();
          popupDiv.querySelector<HTMLSpanElement>("#cacheCoins")!.textContent =
            cacheCoins.toString();
          statusPanel.innerHTML =
            `Points: ${playerPoints} | Coins: ${playerCoins}`;
          console.log(`Collected a coin from cache at (${i}, ${j}).`);
        }
      };

      // Button click to deposit coin
      popupDiv.querySelector<HTMLButtonElement>("#deposit")!.onclick = () => {
        if (playerCoins > 0) {
          const depositAmount = Math.min(playerCoins, 5); // Max deposit: 5 coins
          cacheCoins += depositAmount;
          playerCoins -= depositAmount;
          popupDiv.querySelector<HTMLSpanElement>("#cacheCoins")!.textContent =
            cacheCoins.toString();
          statusPanel.innerHTML =
            `Points: ${playerPoints} | Coins: ${playerCoins}`;
          console.log(
            `Deposited ${depositAmount} coin(s) into cache at (${i}, ${j}).`,
          );
        }
      };

      return popupDiv;
    });
  }

  // Populate the map with caches
  for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(i, j);
      }
    }
  }
});
