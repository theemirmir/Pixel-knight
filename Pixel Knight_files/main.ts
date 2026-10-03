import "/src/style.css?t=1791012289299";
import { Input } from "/src/game/input.ts";
import { MAP_H, MAP_W, createMap, drawMap, drawSky } from "/src/game/map.ts";
import {
  KNIGHT_H,
  KNIGHT_W,
  createKnight,
  drawKnight,
  slashJustStarted,
  updateKnight
} from "/src/game/knight.ts";
import { TILE } from "/src/game/tiles.ts";
import { CAM_TILES_H, CAM_TILES_W, createCamera, updateCamera } from "/src/game/camera.ts";
import { PALETTES } from "/src/game/palette.ts";
import { drawHealthBar } from "/src/game/healthBar.ts";
import { fetchLobbies, LobbyClient } from "/src/net/lobby.ts";
document.querySelectorAll(".title-red-dot, .title-blue-dot, .title-pink-dot").forEach((dot) => {
  dot.remove();
});
const SCALE = 4;
const titleScreen = document.querySelector("#title-screen");
const nameInput = document.querySelector("#name-input");
const createBtn = document.querySelector("#create-btn");
const refreshBtn = document.querySelector("#refresh-btn");
const lobbyListEl = document.querySelector("#lobby-list");
const titleStatus = document.querySelector("#title-status");
const canvas = document.querySelector("#game");
const hud = document.querySelector("#hud");
const rosterEl = document.querySelector("#roster");
const matchLine = document.querySelector("#match-line");
const banner = document.querySelector("#banner");
const rawCtx = canvas.getContext("2d");
if (!rawCtx) throw new Error("Canvas 2D unavailable");
const ctx = rawCtx;
const VIEW_W = CAM_TILES_W * TILE;
const VIEW_H = CAM_TILES_H * TILE;
canvas.width = VIEW_W * SCALE;
canvas.height = VIEW_H * SCALE;
const map = createMap();
const camera = createCamera();
const input = new Input(canvas);
let knight = createKnight(6 * TILE, (MAP_H - 5) * TILE - KNIGHT_H);
let myId = "";
let myColor = "blue";
let phase = "lobby";
let matchNumber = 1;
let maxHp = 25;
let netPlayers = [];
let playing = false;
let titleBusy = false;
let last = performance.now();
let bannerTimer = 0;
let lobbyId = "";
const lobby = new LobbyClient({
  onWelcome: (info) => {
    myId = info.id;
    myColor = info.color;
    maxHp = info.maxHp;
    matchNumber = info.matchNumber;
    phase = info.phase;
    lobbyId = info.lobbyId;
    titleStatus.textContent = info.host ? `Lobby ${info.lobbyId} created · you are ${info.color.toUpperCase()} · waiting…` : `Joined ${info.lobbyId} as ${info.color.toUpperCase()}`;
    showGame();
  },
  onState: (state) => {
    phase = state.phase;
    matchNumber = state.matchNumber;
    maxHp = state.maxHp;
    lobbyId = state.lobbyId || lobbyId;
    netPlayers = state.players;
    const me = state.players.find((p) => p.id === myId);
    if (me) {
      myColor = me.color;
      if (phase === "playing" && (Math.abs(me.x - knight.x) > 80 || Math.abs(me.y - knight.y) > 80)) {
        knight.x = me.x;
        knight.y = me.y;
      }
    }
    renderRoster();
    updateMatchLine();
  },
  onMatchStart: (n, hp, players) => {
    matchNumber = n;
    maxHp = hp;
    phase = "playing";
    netPlayers = players;
    const me = players.find((p) => p.id === myId);
    if (me) {
      myColor = me.color;
      knight = createKnight(me.x, me.y);
    }
    renderRoster();
    showBanner(`Match ${n} — Fight!`);
    updateMatchLine();
  },
  onMatchEnd: (winnerName, n) => {
    phase = "results";
    showBanner(`${winnerName} wins match ${n}! Next match soon…`);
    updateMatchLine();
  },
  onHit: () => {
  },
  onEliminated: (name) => {
    showBanner(`${name} is out!`);
  },
  onError: (message) => {
    titleStatus.textContent = message;
    setTitleBusy(false);
    void refreshLobbyList();
    if (!playing) return;
    showBanner(message);
  },
  onClose: () => {
    if (!playing) {
      setTitleBusy(false);
      return;
    }
    titleStatus.textContent = "Disconnected from lobby.";
    showBanner("Disconnected");
  }
});
function setTitleBusy(busy) {
  titleBusy = busy;
  createBtn.disabled = busy;
  refreshBtn.disabled = busy;
  lobbyListEl.querySelectorAll("button").forEach((b) => {
    b.disabled = busy;
  });
}
async function refreshLobbyList() {
  if (playing || titleBusy) return;
  const result = await fetchLobbies();
  lobbyListEl.innerHTML = "";
  if (!result.ok) {
    createBtn.disabled = true;
    titleStatus.textContent = "Cannot reach the lobby server. Reload the desktop index (v4 public), or open the GAME_URL from Artifacts. Do not use browser “Save webpage as”.";
    const empty = document.createElement("p");
    empty.className = "lobby-empty";
    empty.textContent = "Cannot load lobbies — download a fresh index.html from the agent.";
    lobbyListEl.appendChild(empty);
    return;
  }
  const open = result.lobbies.filter((l) => l.joinable);
  createBtn.disabled = false;
  if (titleStatus.textContent.includes("Game server is not running")) {
    titleStatus.textContent = "";
  }
  if (open.length === 0) {
    const empty = document.createElement("p");
    empty.className = "lobby-empty";
    empty.textContent = "No open lobbies. Create one to start.";
    lobbyListEl.appendChild(empty);
    return;
  }
  for (const item of open) {
    const row = document.createElement("div");
    row.className = "lobby-row";
    const info = document.createElement("span");
    info.textContent = `${item.id} · host ${item.hostName} · ${item.players}/${item.maxPlayers}`;
    const join = document.createElement("button");
    join.type = "button";
    join.className = "join-btn";
    join.textContent = "Join";
    join.addEventListener("click", () => {
      const name = nameInput.value.trim() || "Knight";
      setTitleBusy(true);
      titleStatus.textContent = `Joining ${item.id}…`;
      lobby.connect(name, "join", item.id);
    });
    row.appendChild(info);
    row.appendChild(join);
    lobbyListEl.appendChild(row);
  }
}
function showGame() {
  playing = true;
  titleScreen.hidden = true;
  canvas.hidden = false;
  hud.hidden = false;
}
function showBanner(text) {
  banner.hidden = false;
  banner.textContent = text;
  bannerTimer = 2.4;
}
function updateMatchLine() {
  const code = lobbyId ? ` ${lobbyId}` : "";
  if (phase === "lobby") {
    matchLine.textContent = netPlayers.length < 2 ? `Lobby${code} · ${netPlayers.length}/5 · need 2 to start` : `Lobby${code} · ${netPlayers.length}/5 · starting…`;
  } else if (phase === "playing") {
    matchLine.textContent = `Lobby${code} · Match ${matchNumber} · Live`;
  } else {
    matchLine.textContent = `Lobby${code} · Match ${matchNumber} over · next soon`;
  }
}
function renderRoster() {
  rosterEl.innerHTML = "";
  for (const p of netPlayers) {
    const row = document.createElement("div");
    row.className = "roster-row" + (p.alive ? "" : " dead");
    const sw = document.createElement("i");
    sw.className = `swatch ${p.color}`;
    const meta = document.createElement("div");
    const label = document.createElement("div");
    label.textContent = `${p.name}${p.id === myId ? " (you)" : ""}`;
    const bar = document.createElement("div");
    bar.className = "hp-bar";
    const fill = document.createElement("div");
    fill.className = "hp-fill";
    fill.style.width = `${Math.max(0, p.hp / maxHp * 100)}%`;
    fill.style.background = PALETTES[p.color].jacket;
    bar.appendChild(fill);
    meta.appendChild(label);
    meta.appendChild(bar);
    const hp = document.createElement("div");
    hp.textContent = `${p.hp}/${maxHp}`;
    row.appendChild(sw);
    row.appendChild(meta);
    row.appendChild(hp);
    rosterEl.appendChild(row);
  }
}
function netToKnight(p) {
  return {
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    facing: p.facing,
    onGround: false,
    canDoubleJump: false,
    wallDir: 0,
    canWallJump: false,
    animTime: p.animTime,
    pose: p.pose,
    doubleJumpT: 0,
    jumpFlashT: 0,
    landFlashT: 0,
    wallJumpAnimT: 0,
    wallJumpLockT: 0,
    lastWallKick: 0,
    slashT: p.slashT,
    dashT: p.dashT
  };
}
function localAlive() {
  const me = netPlayers.find((p) => p.id === myId);
  return !me || me.alive;
}
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1e3);
  last = now;
  if (bannerTimer > 0) {
    bannerTimer -= dt;
    if (bannerTimer <= 0) banner.hidden = true;
  }
  if (playing && localAlive() && (phase === "playing" || phase === "lobby")) {
    updateKnight(
      knight,
      map,
      input.axisX(),
      input.jumpPressed(),
      input.slashPressed(),
      input.dashPressed(),
      dt
    );
    if (slashJustStarted && phase === "playing") lobby.sendSlash();
    lobby.sendUpdate({
      x: knight.x,
      y: knight.y,
      facing: knight.facing,
      pose: knight.pose,
      animTime: knight.animTime,
      slashT: knight.slashT,
      dashT: knight.dashT
    });
  }
  updateCamera(camera, knight.x + KNIGHT_W / 2, knight.y + KNIGHT_H / 2);
  input.endFrame();
  if (playing) {
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    drawSky(ctx, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
    drawMap(ctx, map);
    for (const p of netPlayers) {
      if (p.id === myId) continue;
      if (!p.alive && phase === "playing") continue;
      drawKnight(ctx, netToKnight(p), PALETTES[p.color]);
      drawHealthBar(ctx, p.x, p.y, KNIGHT_W, p.hp, maxHp, PALETTES[p.color].jacket);
    }
    if (localAlive() || phase !== "playing") {
      drawKnight(ctx, knight, PALETTES[myColor]);
      const me = netPlayers.find((p) => p.id === myId);
      const hp = me?.hp ?? maxHp;
      drawHealthBar(ctx, knight.x, knight.y, KNIGHT_W, hp, maxHp, PALETTES[myColor].jacket);
    }
    ctx.restore();
  }
  requestAnimationFrame(frame);
}
createBtn.addEventListener("click", () => {
  const name = nameInput.value.trim() || "Knight";
  setTitleBusy(true);
  titleStatus.textContent = "Creating lobby…";
  lobby.connect(name, "create");
});
refreshBtn.addEventListener("click", () => {
  void refreshLobbyList();
});
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createBtn.click();
});
void refreshLobbyList();
setInterval(() => {
  if (!playing) void refreshLobbyList();
}, 2500);
requestAnimationFrame(frame);
void MAP_W;

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4udHM/dj12OC0xNzkxMDEyNDUwMTA2Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAnLi9zdHlsZS5jc3MnXG5pbXBvcnQgeyBJbnB1dCB9IGZyb20gJy4vZ2FtZS9pbnB1dCdcbmltcG9ydCB7IE1BUF9ILCBNQVBfVywgY3JlYXRlTWFwLCBkcmF3TWFwLCBkcmF3U2t5IH0gZnJvbSAnLi9nYW1lL21hcCdcbmltcG9ydCB7XG4gIEtOSUdIVF9ILFxuICBLTklHSFRfVyxcbiAgY3JlYXRlS25pZ2h0LFxuICBkcmF3S25pZ2h0LFxuICBzbGFzaEp1c3RTdGFydGVkLFxuICB1cGRhdGVLbmlnaHQsXG4gIHR5cGUgS25pZ2h0U3RhdGUsXG59IGZyb20gJy4vZ2FtZS9rbmlnaHQnXG5pbXBvcnQgeyBUSUxFIH0gZnJvbSAnLi9nYW1lL3RpbGVzJ1xuaW1wb3J0IHsgQ0FNX1RJTEVTX0gsIENBTV9USUxFU19XLCBjcmVhdGVDYW1lcmEsIHVwZGF0ZUNhbWVyYSB9IGZyb20gJy4vZ2FtZS9jYW1lcmEnXG5pbXBvcnQgeyBQQUxFVFRFUywgdHlwZSBQbGF5ZXJDb2xvcklkIH0gZnJvbSAnLi9nYW1lL3BhbGV0dGUnXG5pbXBvcnQgeyBkcmF3SGVhbHRoQmFyIH0gZnJvbSAnLi9nYW1lL2hlYWx0aEJhcidcbmltcG9ydCB7IGZldGNoTG9iYmllcywgTG9iYnlDbGllbnQsIHR5cGUgTG9iYnlQaGFzZSwgdHlwZSBOZXRQbGF5ZXIgfSBmcm9tICcuL25ldC9sb2JieSdcblxuZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLnRpdGxlLXJlZC1kb3QsIC50aXRsZS1ibHVlLWRvdCwgLnRpdGxlLXBpbmstZG90JykuZm9yRWFjaCgoZG90KSA9PiB7XG4gIGRvdC5yZW1vdmUoKVxufSlcblxuY29uc3QgU0NBTEUgPSA0XG5cbmNvbnN0IHRpdGxlU2NyZWVuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJyN0aXRsZS1zY3JlZW4nKSFcbmNvbnN0IG5hbWVJbnB1dCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTElucHV0RWxlbWVudD4oJyNuYW1lLWlucHV0JykhXG5jb25zdCBjcmVhdGVCdG4gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxCdXR0b25FbGVtZW50PignI2NyZWF0ZS1idG4nKSFcbmNvbnN0IHJlZnJlc2hCdG4gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxCdXR0b25FbGVtZW50PignI3JlZnJlc2gtYnRuJykhXG5jb25zdCBsb2JieUxpc3RFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCcjbG9iYnktbGlzdCcpIVxuY29uc3QgdGl0bGVTdGF0dXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignI3RpdGxlLXN0YXR1cycpIVxuY29uc3QgY2FudmFzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MQ2FudmFzRWxlbWVudD4oJyNnYW1lJykhXG5jb25zdCBodWQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignI2h1ZCcpIVxuY29uc3Qgcm9zdGVyRWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignI3Jvc3RlcicpIVxuY29uc3QgbWF0Y2hMaW5lID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJyNtYXRjaC1saW5lJykhXG5jb25zdCBiYW5uZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignI2Jhbm5lcicpIVxuXG5jb25zdCByYXdDdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKVxuaWYgKCFyYXdDdHgpIHRocm93IG5ldyBFcnJvcignQ2FudmFzIDJEIHVuYXZhaWxhYmxlJylcbmNvbnN0IGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEID0gcmF3Q3R4XG5cbmNvbnN0IFZJRVdfVyA9IENBTV9USUxFU19XICogVElMRVxuY29uc3QgVklFV19IID0gQ0FNX1RJTEVTX0ggKiBUSUxFXG5jYW52YXMud2lkdGggPSBWSUVXX1cgKiBTQ0FMRVxuY2FudmFzLmhlaWdodCA9IFZJRVdfSCAqIFNDQUxFXG5cbmNvbnN0IG1hcCA9IGNyZWF0ZU1hcCgpXG5jb25zdCBjYW1lcmEgPSBjcmVhdGVDYW1lcmEoKVxuY29uc3QgaW5wdXQgPSBuZXcgSW5wdXQoY2FudmFzKVxuXG5sZXQga25pZ2h0ID0gY3JlYXRlS25pZ2h0KDYgKiBUSUxFLCAoTUFQX0ggLSA1KSAqIFRJTEUgLSBLTklHSFRfSClcbmxldCBteUlkID0gJydcbmxldCBteUNvbG9yOiBQbGF5ZXJDb2xvcklkID0gJ2JsdWUnXG5sZXQgcGhhc2U6IExvYmJ5UGhhc2UgPSAnbG9iYnknXG5sZXQgbWF0Y2hOdW1iZXIgPSAxXG5sZXQgbWF4SHAgPSAyNVxubGV0IG5ldFBsYXllcnM6IE5ldFBsYXllcltdID0gW11cbmxldCBwbGF5aW5nID0gZmFsc2VcbmxldCB0aXRsZUJ1c3kgPSBmYWxzZVxubGV0IGxhc3QgPSBwZXJmb3JtYW5jZS5ub3coKVxubGV0IGJhbm5lclRpbWVyID0gMFxubGV0IGxvYmJ5SWQgPSAnJ1xuXG5jb25zdCBsb2JieSA9IG5ldyBMb2JieUNsaWVudCh7XG4gIG9uV2VsY29tZTogKGluZm8pID0+IHtcbiAgICBteUlkID0gaW5mby5pZFxuICAgIG15Q29sb3IgPSBpbmZvLmNvbG9yXG4gICAgbWF4SHAgPSBpbmZvLm1heEhwXG4gICAgbWF0Y2hOdW1iZXIgPSBpbmZvLm1hdGNoTnVtYmVyXG4gICAgcGhhc2UgPSBpbmZvLnBoYXNlXG4gICAgbG9iYnlJZCA9IGluZm8ubG9iYnlJZFxuICAgIHRpdGxlU3RhdHVzLnRleHRDb250ZW50ID0gaW5mby5ob3N0XG4gICAgICA/IGBMb2JieSAke2luZm8ubG9iYnlJZH0gY3JlYXRlZCDCtyB5b3UgYXJlICR7aW5mby5jb2xvci50b1VwcGVyQ2FzZSgpfSDCtyB3YWl0aW5n4oCmYFxuICAgICAgOiBgSm9pbmVkICR7aW5mby5sb2JieUlkfSBhcyAke2luZm8uY29sb3IudG9VcHBlckNhc2UoKX1gXG4gICAgc2hvd0dhbWUoKVxuICB9LFxuICBvblN0YXRlOiAoc3RhdGUpID0+IHtcbiAgICBwaGFzZSA9IHN0YXRlLnBoYXNlXG4gICAgbWF0Y2hOdW1iZXIgPSBzdGF0ZS5tYXRjaE51bWJlclxuICAgIG1heEhwID0gc3RhdGUubWF4SHBcbiAgICBsb2JieUlkID0gc3RhdGUubG9iYnlJZCB8fCBsb2JieUlkXG4gICAgbmV0UGxheWVycyA9IHN0YXRlLnBsYXllcnNcbiAgICBjb25zdCBtZSA9IHN0YXRlLnBsYXllcnMuZmluZCgocCkgPT4gcC5pZCA9PT0gbXlJZClcbiAgICBpZiAobWUpIHtcbiAgICAgIG15Q29sb3IgPSBtZS5jb2xvclxuICAgICAgaWYgKHBoYXNlID09PSAncGxheWluZycgJiYgKE1hdGguYWJzKG1lLnggLSBrbmlnaHQueCkgPiA4MCB8fCBNYXRoLmFicyhtZS55IC0ga25pZ2h0LnkpID4gODApKSB7XG4gICAgICAgIGtuaWdodC54ID0gbWUueFxuICAgICAgICBrbmlnaHQueSA9IG1lLnlcbiAgICAgIH1cbiAgICB9XG4gICAgcmVuZGVyUm9zdGVyKClcbiAgICB1cGRhdGVNYXRjaExpbmUoKVxuICB9LFxuICBvbk1hdGNoU3RhcnQ6IChuLCBocCwgcGxheWVycykgPT4ge1xuICAgIG1hdGNoTnVtYmVyID0gblxuICAgIG1heEhwID0gaHBcbiAgICBwaGFzZSA9ICdwbGF5aW5nJ1xuICAgIG5ldFBsYXllcnMgPSBwbGF5ZXJzXG4gICAgY29uc3QgbWUgPSBwbGF5ZXJzLmZpbmQoKHApID0+IHAuaWQgPT09IG15SWQpXG4gICAgaWYgKG1lKSB7XG4gICAgICBteUNvbG9yID0gbWUuY29sb3JcbiAgICAgIGtuaWdodCA9IGNyZWF0ZUtuaWdodChtZS54LCBtZS55KVxuICAgIH1cbiAgICByZW5kZXJSb3N0ZXIoKVxuICAgIHNob3dCYW5uZXIoYE1hdGNoICR7bn0g4oCUIEZpZ2h0IWApXG4gICAgdXBkYXRlTWF0Y2hMaW5lKClcbiAgfSxcbiAgb25NYXRjaEVuZDogKHdpbm5lck5hbWUsIG4pID0+IHtcbiAgICBwaGFzZSA9ICdyZXN1bHRzJ1xuICAgIHNob3dCYW5uZXIoYCR7d2lubmVyTmFtZX0gd2lucyBtYXRjaCAke259ISBOZXh0IG1hdGNoIHNvb27igKZgKVxuICAgIHVwZGF0ZU1hdGNoTGluZSgpXG4gIH0sXG4gIG9uSGl0OiAoKSA9PiB7XG4gICAgLyogcm9zdGVyIHVwZGF0ZXMgdmlhIHN0YXRlICovXG4gIH0sXG4gIG9uRWxpbWluYXRlZDogKG5hbWUpID0+IHtcbiAgICBzaG93QmFubmVyKGAke25hbWV9IGlzIG91dCFgKVxuICB9LFxuICBvbkVycm9yOiAobWVzc2FnZSkgPT4ge1xuICAgIHRpdGxlU3RhdHVzLnRleHRDb250ZW50ID0gbWVzc2FnZVxuICAgIHNldFRpdGxlQnVzeShmYWxzZSlcbiAgICB2b2lkIHJlZnJlc2hMb2JieUxpc3QoKVxuICAgIGlmICghcGxheWluZykgcmV0dXJuXG4gICAgc2hvd0Jhbm5lcihtZXNzYWdlKVxuICB9LFxuICBvbkNsb3NlOiAoKSA9PiB7XG4gICAgaWYgKCFwbGF5aW5nKSB7XG4gICAgICBzZXRUaXRsZUJ1c3koZmFsc2UpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgdGl0bGVTdGF0dXMudGV4dENvbnRlbnQgPSAnRGlzY29ubmVjdGVkIGZyb20gbG9iYnkuJ1xuICAgIHNob3dCYW5uZXIoJ0Rpc2Nvbm5lY3RlZCcpXG4gIH0sXG59KVxuXG5mdW5jdGlvbiBzZXRUaXRsZUJ1c3koYnVzeTogYm9vbGVhbik6IHZvaWQge1xuICB0aXRsZUJ1c3kgPSBidXN5XG4gIGNyZWF0ZUJ0bi5kaXNhYmxlZCA9IGJ1c3lcbiAgcmVmcmVzaEJ0bi5kaXNhYmxlZCA9IGJ1c3lcbiAgbG9iYnlMaXN0RWwucXVlcnlTZWxlY3RvckFsbDxIVE1MQnV0dG9uRWxlbWVudD4oJ2J1dHRvbicpLmZvckVhY2goKGIpID0+IHtcbiAgICBiLmRpc2FibGVkID0gYnVzeVxuICB9KVxufVxuXG5hc3luYyBmdW5jdGlvbiByZWZyZXNoTG9iYnlMaXN0KCk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAocGxheWluZyB8fCB0aXRsZUJ1c3kpIHJldHVyblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBmZXRjaExvYmJpZXMoKVxuICBsb2JieUxpc3RFbC5pbm5lckhUTUwgPSAnJ1xuICBpZiAoIXJlc3VsdC5vaykge1xuICAgIGNyZWF0ZUJ0bi5kaXNhYmxlZCA9IHRydWVcbiAgICB0aXRsZVN0YXR1cy50ZXh0Q29udGVudCA9XG4gICAgICAnQ2Fubm90IHJlYWNoIHRoZSBsb2JieSBzZXJ2ZXIuIFJlbG9hZCB0aGUgZGVza3RvcCBpbmRleCAodjQgcHVibGljKSwgb3Igb3BlbiB0aGUgR0FNRV9VUkwgZnJvbSBBcnRpZmFjdHMuIERvIG5vdCB1c2UgYnJvd3NlciDigJxTYXZlIHdlYnBhZ2UgYXPigJ0uJ1xuICAgIGNvbnN0IGVtcHR5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgncCcpXG4gICAgZW1wdHkuY2xhc3NOYW1lID0gJ2xvYmJ5LWVtcHR5J1xuICAgIGVtcHR5LnRleHRDb250ZW50ID0gJ0Nhbm5vdCBsb2FkIGxvYmJpZXMg4oCUIGRvd25sb2FkIGEgZnJlc2ggaW5kZXguaHRtbCBmcm9tIHRoZSBhZ2VudC4nXG4gICAgbG9iYnlMaXN0RWwuYXBwZW5kQ2hpbGQoZW1wdHkpXG4gICAgcmV0dXJuXG4gIH1cbiAgY29uc3Qgb3BlbiA9IHJlc3VsdC5sb2JiaWVzLmZpbHRlcigobCkgPT4gbC5qb2luYWJsZSlcbiAgY3JlYXRlQnRuLmRpc2FibGVkID0gZmFsc2VcbiAgaWYgKHRpdGxlU3RhdHVzLnRleHRDb250ZW50LmluY2x1ZGVzKCdHYW1lIHNlcnZlciBpcyBub3QgcnVubmluZycpKSB7XG4gICAgdGl0bGVTdGF0dXMudGV4dENvbnRlbnQgPSAnJ1xuICB9XG4gIGlmIChvcGVuLmxlbmd0aCA9PT0gMCkge1xuICAgIGNvbnN0IGVtcHR5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgncCcpXG4gICAgZW1wdHkuY2xhc3NOYW1lID0gJ2xvYmJ5LWVtcHR5J1xuICAgIGVtcHR5LnRleHRDb250ZW50ID0gJ05vIG9wZW4gbG9iYmllcy4gQ3JlYXRlIG9uZSB0byBzdGFydC4nXG4gICAgbG9iYnlMaXN0RWwuYXBwZW5kQ2hpbGQoZW1wdHkpXG4gICAgcmV0dXJuXG4gIH1cbiAgZm9yIChjb25zdCBpdGVtIG9mIG9wZW4pIHtcbiAgICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxuICAgIHJvdy5jbGFzc05hbWUgPSAnbG9iYnktcm93J1xuICAgIGNvbnN0IGluZm8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJylcbiAgICBpbmZvLnRleHRDb250ZW50ID0gYCR7aXRlbS5pZH0gwrcgaG9zdCAke2l0ZW0uaG9zdE5hbWV9IMK3ICR7aXRlbS5wbGF5ZXJzfS8ke2l0ZW0ubWF4UGxheWVyc31gXG4gICAgY29uc3Qgam9pbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpXG4gICAgam9pbi50eXBlID0gJ2J1dHRvbidcbiAgICBqb2luLmNsYXNzTmFtZSA9ICdqb2luLWJ0bidcbiAgICBqb2luLnRleHRDb250ZW50ID0gJ0pvaW4nXG4gICAgam9pbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgIGNvbnN0IG5hbWUgPSBuYW1lSW5wdXQudmFsdWUudHJpbSgpIHx8ICdLbmlnaHQnXG4gICAgICBzZXRUaXRsZUJ1c3kodHJ1ZSlcbiAgICAgIHRpdGxlU3RhdHVzLnRleHRDb250ZW50ID0gYEpvaW5pbmcgJHtpdGVtLmlkfeKApmBcbiAgICAgIGxvYmJ5LmNvbm5lY3QobmFtZSwgJ2pvaW4nLCBpdGVtLmlkKVxuICAgIH0pXG4gICAgcm93LmFwcGVuZENoaWxkKGluZm8pXG4gICAgcm93LmFwcGVuZENoaWxkKGpvaW4pXG4gICAgbG9iYnlMaXN0RWwuYXBwZW5kQ2hpbGQocm93KVxuICB9XG59XG5cbmZ1bmN0aW9uIHNob3dHYW1lKCk6IHZvaWQge1xuICBwbGF5aW5nID0gdHJ1ZVxuICB0aXRsZVNjcmVlbi5oaWRkZW4gPSB0cnVlXG4gIGNhbnZhcy5oaWRkZW4gPSBmYWxzZVxuICBodWQuaGlkZGVuID0gZmFsc2Vcbn1cblxuZnVuY3Rpb24gc2hvd0Jhbm5lcih0ZXh0OiBzdHJpbmcpOiB2b2lkIHtcbiAgYmFubmVyLmhpZGRlbiA9IGZhbHNlXG4gIGJhbm5lci50ZXh0Q29udGVudCA9IHRleHRcbiAgYmFubmVyVGltZXIgPSAyLjRcbn1cblxuZnVuY3Rpb24gdXBkYXRlTWF0Y2hMaW5lKCk6IHZvaWQge1xuICBjb25zdCBjb2RlID0gbG9iYnlJZCA/IGAgJHtsb2JieUlkfWAgOiAnJ1xuICBpZiAocGhhc2UgPT09ICdsb2JieScpIHtcbiAgICBtYXRjaExpbmUudGV4dENvbnRlbnQgPVxuICAgICAgbmV0UGxheWVycy5sZW5ndGggPCAyXG4gICAgICAgID8gYExvYmJ5JHtjb2RlfSDCtyAke25ldFBsYXllcnMubGVuZ3RofS81IMK3IG5lZWQgMiB0byBzdGFydGBcbiAgICAgICAgOiBgTG9iYnkke2NvZGV9IMK3ICR7bmV0UGxheWVycy5sZW5ndGh9LzUgwrcgc3RhcnRpbmfigKZgXG4gIH0gZWxzZSBpZiAocGhhc2UgPT09ICdwbGF5aW5nJykge1xuICAgIG1hdGNoTGluZS50ZXh0Q29udGVudCA9IGBMb2JieSR7Y29kZX0gwrcgTWF0Y2ggJHttYXRjaE51bWJlcn0gwrcgTGl2ZWBcbiAgfSBlbHNlIHtcbiAgICBtYXRjaExpbmUudGV4dENvbnRlbnQgPSBgTG9iYnkke2NvZGV9IMK3IE1hdGNoICR7bWF0Y2hOdW1iZXJ9IG92ZXIgwrcgbmV4dCBzb29uYFxuICB9XG59XG5cbmZ1bmN0aW9uIHJlbmRlclJvc3RlcigpOiB2b2lkIHtcbiAgcm9zdGVyRWwuaW5uZXJIVE1MID0gJydcbiAgZm9yIChjb25zdCBwIG9mIG5ldFBsYXllcnMpIHtcbiAgICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxuICAgIHJvdy5jbGFzc05hbWUgPSAncm9zdGVyLXJvdycgKyAocC5hbGl2ZSA/ICcnIDogJyBkZWFkJylcbiAgICBjb25zdCBzdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2knKVxuICAgIHN3LmNsYXNzTmFtZSA9IGBzd2F0Y2ggJHtwLmNvbG9yfWBcbiAgICBjb25zdCBtZXRhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcbiAgICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpXG4gICAgbGFiZWwudGV4dENvbnRlbnQgPSBgJHtwLm5hbWV9JHtwLmlkID09PSBteUlkID8gJyAoeW91KScgOiAnJ31gXG4gICAgY29uc3QgYmFyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcbiAgICBiYXIuY2xhc3NOYW1lID0gJ2hwLWJhcidcbiAgICBjb25zdCBmaWxsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcbiAgICBmaWxsLmNsYXNzTmFtZSA9ICdocC1maWxsJ1xuICAgIGZpbGwuc3R5bGUud2lkdGggPSBgJHtNYXRoLm1heCgwLCAocC5ocCAvIG1heEhwKSAqIDEwMCl9JWBcbiAgICBmaWxsLnN0eWxlLmJhY2tncm91bmQgPSBQQUxFVFRFU1twLmNvbG9yXS5qYWNrZXRcbiAgICBiYXIuYXBwZW5kQ2hpbGQoZmlsbClcbiAgICBtZXRhLmFwcGVuZENoaWxkKGxhYmVsKVxuICAgIG1ldGEuYXBwZW5kQ2hpbGQoYmFyKVxuICAgIGNvbnN0IGhwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcbiAgICBocC50ZXh0Q29udGVudCA9IGAke3AuaHB9LyR7bWF4SHB9YFxuICAgIHJvdy5hcHBlbmRDaGlsZChzdylcbiAgICByb3cuYXBwZW5kQ2hpbGQobWV0YSlcbiAgICByb3cuYXBwZW5kQ2hpbGQoaHApXG4gICAgcm9zdGVyRWwuYXBwZW5kQ2hpbGQocm93KVxuICB9XG59XG5cbmZ1bmN0aW9uIG5ldFRvS25pZ2h0KHA6IE5ldFBsYXllcik6IEtuaWdodFN0YXRlIHtcbiAgcmV0dXJuIHtcbiAgICB4OiBwLngsXG4gICAgeTogcC55LFxuICAgIHZ4OiAwLFxuICAgIHZ5OiAwLFxuICAgIGZhY2luZzogcC5mYWNpbmcsXG4gICAgb25Hcm91bmQ6IGZhbHNlLFxuICAgIGNhbkRvdWJsZUp1bXA6IGZhbHNlLFxuICAgIHdhbGxEaXI6IDAsXG4gICAgY2FuV2FsbEp1bXA6IGZhbHNlLFxuICAgIGFuaW1UaW1lOiBwLmFuaW1UaW1lLFxuICAgIHBvc2U6IHAucG9zZSxcbiAgICBkb3VibGVKdW1wVDogMCxcbiAgICBqdW1wRmxhc2hUOiAwLFxuICAgIGxhbmRGbGFzaFQ6IDAsXG4gICAgd2FsbEp1bXBBbmltVDogMCxcbiAgICB3YWxsSnVtcExvY2tUOiAwLFxuICAgIGxhc3RXYWxsS2ljazogMCxcbiAgICBzbGFzaFQ6IHAuc2xhc2hULFxuICAgIGRhc2hUOiBwLmRhc2hULFxuICB9XG59XG5cbmZ1bmN0aW9uIGxvY2FsQWxpdmUoKTogYm9vbGVhbiB7XG4gIGNvbnN0IG1lID0gbmV0UGxheWVycy5maW5kKChwKSA9PiBwLmlkID09PSBteUlkKVxuICByZXR1cm4gIW1lIHx8IG1lLmFsaXZlXG59XG5cbmZ1bmN0aW9uIGZyYW1lKG5vdzogbnVtYmVyKTogdm9pZCB7XG4gIGNvbnN0IGR0ID0gTWF0aC5taW4oMC4wMzMsIChub3cgLSBsYXN0KSAvIDEwMDApXG4gIGxhc3QgPSBub3dcblxuICBpZiAoYmFubmVyVGltZXIgPiAwKSB7XG4gICAgYmFubmVyVGltZXIgLT0gZHRcbiAgICBpZiAoYmFubmVyVGltZXIgPD0gMCkgYmFubmVyLmhpZGRlbiA9IHRydWVcbiAgfVxuXG4gIGlmIChwbGF5aW5nICYmIGxvY2FsQWxpdmUoKSAmJiAocGhhc2UgPT09ICdwbGF5aW5nJyB8fCBwaGFzZSA9PT0gJ2xvYmJ5JykpIHtcbiAgICB1cGRhdGVLbmlnaHQoXG4gICAgICBrbmlnaHQsXG4gICAgICBtYXAsXG4gICAgICBpbnB1dC5heGlzWCgpLFxuICAgICAgaW5wdXQuanVtcFByZXNzZWQoKSxcbiAgICAgIGlucHV0LnNsYXNoUHJlc3NlZCgpLFxuICAgICAgaW5wdXQuZGFzaFByZXNzZWQoKSxcbiAgICAgIGR0LFxuICAgIClcbiAgICBpZiAoc2xhc2hKdXN0U3RhcnRlZCAmJiBwaGFzZSA9PT0gJ3BsYXlpbmcnKSBsb2JieS5zZW5kU2xhc2goKVxuICAgIGxvYmJ5LnNlbmRVcGRhdGUoe1xuICAgICAgeDoga25pZ2h0LngsXG4gICAgICB5OiBrbmlnaHQueSxcbiAgICAgIGZhY2luZzoga25pZ2h0LmZhY2luZyxcbiAgICAgIHBvc2U6IGtuaWdodC5wb3NlLFxuICAgICAgYW5pbVRpbWU6IGtuaWdodC5hbmltVGltZSxcbiAgICAgIHNsYXNoVDoga25pZ2h0LnNsYXNoVCxcbiAgICAgIGRhc2hUOiBrbmlnaHQuZGFzaFQsXG4gICAgfSlcbiAgfVxuXG4gIC8vIEFsd2F5cyBmb2xsb3cgdGhlIGxvY2FsIGtuaWdodCDigJQgbmV2ZXIgdGhlIGxhZ2dlZCBuZXR3b3JrIGNvcHkgKHRoYXQgc2hvb2sgdGhlIHNjcmVlbilcbiAgdXBkYXRlQ2FtZXJhKGNhbWVyYSwga25pZ2h0LnggKyBLTklHSFRfVyAvIDIsIGtuaWdodC55ICsgS05JR0hUX0ggLyAyKVxuICBpbnB1dC5lbmRGcmFtZSgpXG5cbiAgaWYgKHBsYXlpbmcpIHtcbiAgICBjdHguc2V0VHJhbnNmb3JtKFNDQUxFLCAwLCAwLCBTQ0FMRSwgMCwgMClcbiAgICBjdHguaW1hZ2VTbW9vdGhpbmdFbmFibGVkID0gZmFsc2VcbiAgICBkcmF3U2t5KGN0eCwgVklFV19XLCBWSUVXX0gpXG4gICAgY3R4LnNhdmUoKVxuICAgIGN0eC50cmFuc2xhdGUoLU1hdGgucm91bmQoY2FtZXJhLngpLCAtTWF0aC5yb3VuZChjYW1lcmEueSkpXG4gICAgZHJhd01hcChjdHgsIG1hcClcblxuICAgIC8vIERyYXcgb3RoZXJzIGZpcnN0LCB0aGVuIGxvY2FsIG9uIHRvcCDigJQgSFAgYmFycyBmbG9hdCBhYm92ZSBldmVyeSBrbmlnaHRcbiAgICBmb3IgKGNvbnN0IHAgb2YgbmV0UGxheWVycykge1xuICAgICAgaWYgKHAuaWQgPT09IG15SWQpIGNvbnRpbnVlXG4gICAgICBpZiAoIXAuYWxpdmUgJiYgcGhhc2UgPT09ICdwbGF5aW5nJykgY29udGludWVcbiAgICAgIGRyYXdLbmlnaHQoY3R4LCBuZXRUb0tuaWdodChwKSwgUEFMRVRURVNbcC5jb2xvcl0pXG4gICAgICBkcmF3SGVhbHRoQmFyKGN0eCwgcC54LCBwLnksIEtOSUdIVF9XLCBwLmhwLCBtYXhIcCwgUEFMRVRURVNbcC5jb2xvcl0uamFja2V0KVxuICAgIH1cbiAgICBpZiAobG9jYWxBbGl2ZSgpIHx8IHBoYXNlICE9PSAncGxheWluZycpIHtcbiAgICAgIGRyYXdLbmlnaHQoY3R4LCBrbmlnaHQsIFBBTEVUVEVTW215Q29sb3JdKVxuICAgICAgY29uc3QgbWUgPSBuZXRQbGF5ZXJzLmZpbmQoKHApID0+IHAuaWQgPT09IG15SWQpXG4gICAgICBjb25zdCBocCA9IG1lPy5ocCA/PyBtYXhIcFxuICAgICAgZHJhd0hlYWx0aEJhcihjdHgsIGtuaWdodC54LCBrbmlnaHQueSwgS05JR0hUX1csIGhwLCBtYXhIcCwgUEFMRVRURVNbbXlDb2xvcl0uamFja2V0KVxuICAgIH1cbiAgICBjdHgucmVzdG9yZSgpXG4gIH1cblxuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZnJhbWUpXG59XG5cbmNyZWF0ZUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgY29uc3QgbmFtZSA9IG5hbWVJbnB1dC52YWx1ZS50cmltKCkgfHwgJ0tuaWdodCdcbiAgc2V0VGl0bGVCdXN5KHRydWUpXG4gIHRpdGxlU3RhdHVzLnRleHRDb250ZW50ID0gJ0NyZWF0aW5nIGxvYmJ54oCmJ1xuICBsb2JieS5jb25uZWN0KG5hbWUsICdjcmVhdGUnKVxufSlcblxucmVmcmVzaEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgdm9pZCByZWZyZXNoTG9iYnlMaXN0KClcbn0pXG5cbm5hbWVJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgKGUpID0+IHtcbiAgaWYgKGUua2V5ID09PSAnRW50ZXInKSBjcmVhdGVCdG4uY2xpY2soKVxufSlcblxudm9pZCByZWZyZXNoTG9iYnlMaXN0KClcbnNldEludGVydmFsKCgpID0+IHtcbiAgaWYgKCFwbGF5aW5nKSB2b2lkIHJlZnJlc2hMb2JieUxpc3QoKVxufSwgMjUwMClcblxucmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZyYW1lKVxudm9pZCBNQVBfV1xuIl0sIm1hcHBpbmdzIjoiQUFBQSxPQUFPO0FBQ1AsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsT0FBTyxPQUFPLFdBQVcsU0FBUyxlQUFlO0FBQzFEO0FBQUEsRUFDRTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsT0FFSztBQUNQLFNBQVMsWUFBWTtBQUNyQixTQUFTLGFBQWEsYUFBYSxjQUFjLG9CQUFvQjtBQUNyRSxTQUFTLGdCQUFvQztBQUM3QyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGNBQWMsbUJBQW9EO0FBRTNFLFNBQVMsaUJBQWlCLGtEQUFrRCxFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQzdGLE1BQUksT0FBTztBQUNiLENBQUM7QUFFRCxNQUFNLFFBQVE7QUFFZCxNQUFNLGNBQWMsU0FBUyxjQUEyQixlQUFlO0FBQ3ZFLE1BQU0sWUFBWSxTQUFTLGNBQWdDLGFBQWE7QUFDeEUsTUFBTSxZQUFZLFNBQVMsY0FBaUMsYUFBYTtBQUN6RSxNQUFNLGFBQWEsU0FBUyxjQUFpQyxjQUFjO0FBQzNFLE1BQU0sY0FBYyxTQUFTLGNBQTJCLGFBQWE7QUFDckUsTUFBTSxjQUFjLFNBQVMsY0FBMkIsZUFBZTtBQUN2RSxNQUFNLFNBQVMsU0FBUyxjQUFpQyxPQUFPO0FBQ2hFLE1BQU0sTUFBTSxTQUFTLGNBQTJCLE1BQU07QUFDdEQsTUFBTSxXQUFXLFNBQVMsY0FB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