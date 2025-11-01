
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
  }
});