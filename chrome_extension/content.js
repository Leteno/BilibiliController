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
function performMouseEnter(element) {
  const mouseenter = new MouseEvent("mouseenter", {
    bubbles: true,
    cancelable: true,
    view: window
  });
  element.dispatchEvent(mouseenter);
}

function performMouseOut(element) {
  const mouseleave = new MouseEvent("mouseleave", {
    bubbles: true,
    cancelable: true,
    view: window
  });
  element.dispatchEvent(mouseleave);
}

class Panel {
  constructor(selector, orientation) {
    this.selector = selector;
    this.orientation = orientation;
    this.directions = { up: null, down: null, left: null, right: null };
  }
}

class ElementStackRecord {
  constructor(element, direction) {
    this.element = element;
    this.direction = direction;
  }
}

class ElementNavigator {
  constructor() {
    this._panels = [];
    this.selectedElement = null;
    this.highlightBox = this._createHighlightBox();
    this.neighborMap = new Map();
    this.stackRecord = [];
    this.visible = true;

    console.log("ElementNavigator initialized");
  }

  handleKeyDown() {
    // keyboard listener
    document.addEventListener("keydown", (e) => this._handleKey(e));
  }

  // --- API methods you can override/inherit ---

  get panels() {
    return this._panels;
  }

  set panels(list) {
    if (!Array.isArray(list)) {
      throw new Error("panels must be an array of Panel objects");
    }
    this._panels = list;
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
        performMouseEnter(this.selectedElement);
        this.rebuildNeighborMap();
        this.selectedElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
        this._updateHighlightBox();
      }
      return;
    }
    const next = this._findNextElementO1(this.selectedElement, direction);
    if (next) {
      // reset hover state
      if (this.shouldPerformMouseOut(this.selectedElement, next)) {
        performMouseOut(this.selectedElement);
      }

      performMouseEnter(next);
      this.rebuildNeighborMap();
      this.selectedElement = next;
      this.selectedElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
      this._updateHighlightBox();
    }
  }

  shouldPerformMouseOut(previousElement, nextElement) {
    // Bilibili 动态栏特殊处理
    if (nextElement.closest(".dynamic-info-content")) {
      return false;
    }
    return true;
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
    return this.panels.map(p => p.selector).flatMap(sel => Array.from(document.querySelectorAll(sel)))
      .filter(el => {
        const r = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && style.visibility !== "hidden";
      });
  }

  showAllCandidates() {
    const cands = this._getCandidates();
    cands.forEach(el => {
      el.style.outline = "2px solid red";
      el.style.fontStyle = "italic";
    });
  }

  unshowAllCandidates() {
    const cands = this._getCandidates();
    cands.forEach(el => {
      el.style.outline = "";
      el.style.fontStyle = "";
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

  // simple implementation: linear neighbor map
  rebuildNeighborMap() {
    this.neighborMap.clear();
  }

  _getPanelElements() {
    return this.panels.map(p => p.selector).map(sel => Array.from(document.querySelectorAll(sel)).filter(el => {
      const r = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && style.visibility !== "hidden";
    }));
  }

  _findNextElementO1(current, direction) {
    // const neighbors = this.neighborMap.get(current);
    // return neighbors ? neighbors[direction] : null;
    // 1. find which panel current belongs to
    // 2. if orientation matches, move within panel
    //   1. if beyond the boundary, move to next panel in that direction
    // 3. if orientation does not match, do nothing for now.
    const panelElements = this._getPanelElements();
    var index = panelElements.findIndex(group => group.includes(current));
    if (index === -1) return null;
    const panelChildren = panelElements[index];
    if ((direction === "up" || direction === "down") && this.panels[index].orientation === "vertical" ||
        (direction === "left" || direction === "right") && this.panels[index].orientation === "horizontal") {
      // move within panel
      var elemIndex = panelChildren.indexOf(current);
      if ((direction == "right" || direction == "down")) {
        if (elemIndex < panelChildren.length - 1) {
          return panelChildren[elemIndex + 1];
        }
      } else if ((direction == "left" || direction == "up")) {
        if (elemIndex > 0) {
          return panelChildren[elemIndex - 1];
        }
      }
    }
    // find from stack record
    if (this.stackRecord.length > 0) {
      const lastRecord = this.stackRecord[this.stackRecord.length - 1];
      if (lastRecord.direction === this._oppositeDirection(direction)) {
        this.stackRecord.pop();
        return lastRecord.element;
      }
    }
    if (direction === "right" || direction === "down") {
      var nextNeighborPanel = this.panels[index].directions[direction];
      if (nextNeighborPanel) {
        // bug: possibly chain lookup needed, e.g. A.right -> B.right -> C, when B is empty, A.right should go to C
        const neighborChildren = panelElements[this.panels.indexOf(nextNeighborPanel)];
        if (neighborChildren && neighborChildren.length > 0) {
          this.stackRecord.push(new ElementStackRecord(current, direction));
          return neighborChildren[0];
        }
      }
    } else if (direction === "left" || direction === "up") {
      var nextNeighborPanel = this.panels[index].directions[direction];
      if (nextNeighborPanel) {
        // bug: possibly chain lookup needed, e.g. A.left -> B.left -> C, when B is empty, A.left should go to C
        const neighborChildren = panelElements[this.panels.indexOf(nextNeighborPanel)];
        if (neighborChildren && neighborChildren.length > 0) {
          this.stackRecord.push(new ElementStackRecord(current, direction));
          return neighborChildren[neighborChildren.length - 1];
        }
      }
    }
    return null;
  }

  _oppositeDirection(direction) {
    switch (direction) {
      case "up": return "down";
      case "down": return "up";
      case "left": return "right";
      case "right": return "left";
    }
    throw new Error("Invalid direction: " + direction);
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
var leftHeaders = new Panel("div#biliMainHeader ul.left-entry li.v-popover-wrap a.default-entry span", "horizontal");
var rightHeaders = new Panel("div#biliMainHeader ul.right-entry li.v-popover-wrap a.right-entry__outside", "horizontal");
var dynamicContents = new Panel("#biliHeaderDynScrollCon div.header-content-panel div.header-dynamic__box--center div.dynamic-info-content div", "vertical");
var videoCards = new Panel("div.video-page-card-small a[href^=\"/video\"]:has(.title)", "vertical");
leftHeaders.directions.right = rightHeaders;
rightHeaders.directions.left = leftHeaders;
rightHeaders.directions.down = dynamicContents;
dynamicContents.directions.up = rightHeaders;
picker.panels = [
  leftHeaders,
  rightHeaders,
  dynamicContents,
  videoCards
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
  } else if (msg.type == "bilibili_fullscreen") {
    document.querySelector(".bpx-player-ctrl-btn.bpx-player-ctrl-full").click();
    console.log("juzhen fullscreen button clicked");
  } else {
    console.log("Unknown message type in content script:", msg.type);
  }
});