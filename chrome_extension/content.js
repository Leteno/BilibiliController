// interval to update video status
function getVideoStatus() {
  const video = document.querySelector(".bpx-player-video-wrap video");
  return {
    paused: video.paused,
    currentTime: video.currentTime,
    duration: video.duration,
    playbackRate: video.playbackRate,
    volume: video.volume
  };
}
const interval = setInterval(() => {
  if (document.hidden) return;
  chrome.runtime.sendMessage({
    type: "bilibili_playing_status",
    data: JSON.stringify(getVideoStatus())
  });
}, 500);

const allowedCommands = {
  "playbackRate": (video, value) => video.playbackRate = parseFloat(value),
  "volume": (video, value) => video.volume = parseFloat(value),
  "pause": (video) => video.pause(),
  "play": (video) => video.play(),
  "currentTime": (video, value) => video.currentTime = parseFloat(value)
};

function parseAndApplyScript(video, script) {
  const lines = script.split(";").map(line => line.trim()).filter(Boolean);

  for (const line of lines) {
    // Match compound assignment
    const plusEqMatch = line.match(/^video\.(\w+)\s*\+=\s*(.+)$/);
    if (plusEqMatch) {
      const [, prop, value] = plusEqMatch;
      if (prop in video) {
        const current = video[prop];
        const delta = parseFloat(value);
        if (!isNaN(current) && !isNaN(delta)) {
          video[prop] = current + delta;
        }
      }
      continue;
    }

    const minusEqMatch = line.match(/^video\.(\w+)\s*-\=\s*(.+)$/);
    if (minusEqMatch) {
      const [, prop, value] = minusEqMatch;
      if (prop in video) {
        const current = video[prop];
        const delta = parseFloat(value);
        if (!isNaN(current) && !isNaN(delta)) {
          video[prop] = current - delta;
        }
      }
      continue;
    }

    // Match simple assignment
    const assignMatch = line.match(/^video\.(\w+)\s*=\s*(.+)$/);
    if (assignMatch) {
      const [, prop, value] = assignMatch;
      if (prop in video) {
        const parsed = parseFloat(value);
        video[prop] = isNaN(parsed) ? value : parsed;
      }
      continue;
    }

    // Match method calls like video.pause()
    const callMatch = line.match(/^video\.(\w+)\(\)$/);
    if (callMatch) {
      const [, method] = callMatch;
      if (typeof video[method] === "function") {
        video[method]();
      }
    }
  }
}

// Picker.js
class ElementNavigator {
  constructor() {
    this._selectors = [];
    this.selectedElement = null;
    this.highlightBox = this._createHighlightBox();
    this.neighborMap = new Map();
    this.visible = true;

    console.log("ElementNavigator initialized");
  }

  handleKeyDown() {
    // keyboard listener
    document.addEventListener("keydown", (e) => this._handleKey(e));
  }

  // --- API methods you can override/inherit ---

  get selectors() {
    return this._selectors;
  }

  set selectors(list) {
    if (!Array.isArray(list)) {
      throw new Error("selectors must be an array of strings");
    }
    this._selectors = list;
    this.rebuildNeighborMap();
  }

  /** Hide the highlight box */
  hide() {
    this.visible = false;
    this.highlightBox.style.display = "none";
  }

  /** Show the highlight box */
  show() {
    this.visible = true;
    this._updateHighlightBox();
  }

  /** Move to next element in given direction */
  moveNext(direction) {
    if (!this.selectedElement) {
      this.rebuildNeighborMap();
      const cands = this._getCandidates();
      if (cands.length) {
        this.selectedElement = cands[0];
        this.selectedElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
        this._updateHighlightBox();
      }
      return;
    }
    const next = this._findNextElementO1(this.selectedElement, direction);
    if (next) {
      this.selectedElement = next;
      this.selectedElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
      this._updateHighlightBox();
    }
  }

  /** Perform click on current element */
  enterHit() {
  if (!this.selectedElement) return;

  if (this.selectedElement.tagName === "A" && this.selectedElement.href) {
    // Force navigation for links
    window.location.href = this.selectedElement.href;
  } else {
    // Simulate full click sequence
    ["mousedown", "mouseup", "click"].forEach(type => {
      this.selectedElement.dispatchEvent(
        new MouseEvent(type, { bubbles: true, cancelable: true, view: window })
      );
    });
  }
  this.rebuildNeighborMap();
}


  // --- Internal helpers ---

  _createHighlightBox() {
    const box = document.createElement("div");
    box.style.position = "absolute";
    box.style.border = "2px solid red";
    box.style.pointerEvents = "none";
    box.style.zIndex = "999999";
    document.body.appendChild(box);
    return box;
  }

  _getCandidates() {
    return Array.from(document.querySelectorAll(this.selectors.join(",")))
      .filter(el => {
        const r = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && style.visibility !== "hidden";
      });
  }

  _rectOf(el) {
    const r = el.getBoundingClientRect();
    return {
      top: r.top + window.scrollY,
      left: r.left + window.scrollX,
      right: r.right + window.scrollX,
      bottom: r.bottom + window.scrollY,
      width: r.width,
      height: r.height,
      cx: r.left + window.scrollX + r.width / 2,
      cy: r.top + window.scrollY + r.height / 2
    };
  }

  _updateHighlightBox() {
    if (!this.visible || !this.selectedElement) {
      this.highlightBox.style.display = "none";
      return;
    }
    const r = this.selectedElement.getBoundingClientRect();
    this.highlightBox.style.top = r.top + window.scrollY - 5 + "px";
    this.highlightBox.style.left = r.left + window.scrollX - 5 + "px";
    this.highlightBox.style.width = r.width + 10 + "px";
    this.highlightBox.style.height = r.height + 10 + "px";
    this.highlightBox.style.display = "block";
  }

  // Build neighbor map for O(1) navigation
  rebuildNeighborMap() {
    this.neighborMap.clear();
    const cands = this._getCandidates();
    const rects = new Map(cands.map(el => [el, this._rectOf(el)]));

    for (const from of cands) {
      const rf = rects.get(from);
      let best = { up: null, down: null, left: null, right: null };
      let scoreBest = { up: Infinity, down: Infinity, left: Infinity, right: Infinity };

      for (const to of cands) {
        if (to === from) continue;
        const rt = rects.get(to);

        const horizOverlap = !(rf.right < rt.left || rt.right < rf.left);
        const vertOverlap = !(rf.bottom < rt.top || rt.bottom < rf.top);

        const scoreRight = (rt.left - rf.right) * 1000 + Math.abs(rt.cy - rf.cy);
        const scoreLeft  = (rf.left - rt.right) * 1000 + Math.abs(rt.cy - rf.cy);
        const scoreDown  = (rt.top - rf.bottom) * 1000 + Math.abs(rt.cx - rf.cx);
        const scoreUp    = (rf.top - rt.bottom) * 1000 + Math.abs(rt.cx - rf.cx);

        if (rt.left >= rf.right && scoreRight < scoreBest.right) {
          scoreBest.right = scoreRight + (vertOverlap ? 0 : 500000);
          best.right = to;
        }
        if (rt.right <= rf.left && scoreLeft < scoreBest.left) {
          scoreBest.left = scoreLeft + (vertOverlap ? 0 : 500000);
          best.left = to;
        }
        if (rt.top >= rf.bottom && scoreDown < scoreBest.down) {
          scoreBest.down = scoreDown + (horizOverlap ? 0 : 500000);
          best.down = to;
        }
        if (rt.bottom <= rf.top && scoreUp < scoreBest.up) {
          scoreBest.up = scoreUp + (horizOverlap ? 0 : 500000);
          best.up = to;
        }
      }
      this.neighborMap.set(from, best);
    }
  }

  _findNextElementO1(current, direction) {
    const neighbors = this.neighborMap.get(current);
    return neighbors ? neighbors[direction] : null;
  }

  _handleKey(e) {
    switch (e.key) {
      case "ArrowUp": this.moveNext("up"); break;
      case "ArrowDown": this.moveNext("down"); break;
      case "ArrowLeft": this.moveNext("left"); break;
      case "ArrowRight": this.moveNext("right"); break;
      case "Enter": this.enterHit(); break;
    }
  }
}
var picker = new ElementNavigator();
picker.selectors = [
  "div.video-page-card-small a[href^=\"/video\"]:has(.title)"
];
picker.show();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("Received message in content script:", msg);
  if (msg.type === "run_video_script") {
    const video = document.querySelector(".bpx-player-video-wrap video");
    if (video) {
      parseAndApplyScript(video, msg.script);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "No video element found" });
    }
  } else if (msg.type == "update_video_status") {
    const video = document.querySelector(".bpx-player-video-wrap video");
    if (video) {
      let newConfig = JSON.parse(msg.data);
      if (newConfig.volume)
      {
        video.volume = newConfig.volume;
      }
      if (newConfig.playbackRate)
      {
        video.playbackRate = newConfig.playbackRate;
      }
    }
  } else if (msg.type == "remote_control_key") {
    let command = msg.data;
    if (command === "Enter") {
      picker.enterHit();
    } else if (command == "ArrowUp") {
      picker.moveNext("up");
    } else if (command == "ArrowDown") {
      picker.moveNext("down");
    } else if (command == "ArrowLeft") {
      picker.moveNext("left");
    } else if (command == "ArrowRight") {
      picker.moveNext("right");
    }
  } else if (msg.type == "bilibili_next") {
    document.querySelector(".bpx-player-ctrl-btn.bpx-player-ctrl-next").click();
  } else if (msg.type == "bilibili_previous") {
    document.querySelector(".bpx-player-ctrl-btn.bpx-player-ctrl-prev").click();
  } else if (msg.type == "bilibili_fullscreen") {
    document.querySelector(".bpx-player-ctrl-btn.bpx-player-ctrl-full").click();
  } else if (msg.type == "bilibili_pause_and_play") {
    document.querySelector(".bpx-player-ctrl-btn.bpx-player-ctrl-play").click();
    chrome.runtime.sendMessage({
      type: "bilibili_playing_status",
      data: JSON.stringify(getVideoStatus())
    });
  } else if (msg.type == "bilibili_seek") {
    const video = document.querySelector(".bpx-player-video-wrap video");
    if (!video) return;
    var seekData = JSON.parse(msg.data);
    video.currentTime = seekData.time;
  } else if (msg.type == "bilibili_playing_status_request") {
    chrome.runtime.sendMessage({
      type: "bilibili_playing_status",
      data: JSON.stringify(getVideoStatus())
    });
  } else {
    console.log("Unknown message type in content script:", msg.type);
  }
});