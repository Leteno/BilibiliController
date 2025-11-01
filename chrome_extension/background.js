import { config } from "./config.js";

let socket = null;

function connectWebSocket() {
  socket = new WebSocket(`${config.ws_protocol}://${config.ip}:${config.port}/worker`);

  socket.onopen = () => {
    console.log("WebSocket connected");
    startKeepAlive();
  };

  socket.onmessage = (event) => {
    console.log("Socket received:", event.data);

    let data = JSON.parse(event.data);
    if (data) {
      if (data.type == "tool_call") {
        const toolData = JSON.parse(data.data);
        console.log("Toolcall:", toolData);
        if (toolData.tool === "run_video_script" && toolData.script) {
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs.length == 0) return;
            const tab = tabs[0];
            const url = new URL(tab.url);
            if (!url.hostname.endsWith("bilibili.com")) return;
            chrome.tabs.sendMessage(tab.id, {
              type: "run_video_script",
              script: toolData.script
            });
          });
        }
        return;
      } else if (data.type == "update_video_status") {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs.length == 0) return;
            const tab = tabs[0];
            const url = new URL(tab.url);
            if (!url.hostname.endsWith("bilibili.com")) return;
            chrome.tabs.sendMessage(tab.id, {
              type: data.type,
              data: data.data
            });
          });
        return;
      }
    }

    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs.length == 0) return;
      const tab = tabs[0];
      const url = new URL(tab.url);
      if (!url.hostname.endsWith("bilibili.com")) return;

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (data) => {
          console.log("Message from background:", data);
          data = JSON.parse(data);
          if (!data || !data.type) return;
          function getVideoStatus() {
            const video = document.querySelector(".bpx-player-video-wrap video");
            return {
              paused: video.paused,
              currentTime: video.currentTime,
              duration: video.duration
            };
          }
          function videoSeek(data) {
            const video = document.querySelector(".bpx-player-video-wrap video");
            if (!video) return;
            var seekData = JSON.parse(data);
            if (seekData) {
              if (seekData.time !== undefined) {
                video.currentTime = seekData.time;
              } else if (seekData.offset !== undefined) {
                newTime = video.currentTime + seekData.offset;
                if (newTime < 0) newTime = 0;
                if (newTime > video.duration) newTime = video.duration - 1;
                video.currentTime = newTime;
              }
            }
          }
          switch (data.type) {
            case "bilibili_next":
              document.querySelector(".bpx-player-ctrl-btn.bpx-player-ctrl-next").click();
              break;
            case "bilibili_previous":
              document.querySelector(".bpx-player-ctrl-btn.bpx-player-ctrl-prev").click();
              break;
            case "bilibili_fullscreen":
              document.querySelector(".bpx-player-ctrl-btn.bpx-player-ctrl-full").click();
              break;
            case "bilibili_pause_and_play":
              document.querySelector(".bpx-player-ctrl-btn.bpx-player-ctrl-play").click();
              chrome.runtime.sendMessage({
                type: "bilibili_playing_status",
                data: JSON.stringify(getVideoStatus())
              });
              break;
            case "bilibili_playing_status_request":
              chrome.runtime.sendMessage({
                type: "bilibili_playing_status",
                data: JSON.stringify(getVideoStatus())
              });
              break;
            case "bilibili_seek":
              videoSeek(data.data);
              break;
            default:
              console.log("Unknown command:", data);
          }
        },
        args: [event.data]
      });
    });
  };

  socket.onclose = () => {
    console.log("WebSocket closed");
    socket = null;
    setTimeout(() => {
      console.log("Reconnecting WebSocket...");
      connectWebSocket();
    }, 2000);
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "bilibili_playing_status" && socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
});

function startKeepAlive() {
  const interval = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({"type": "echo", "data": "keepalive"}));
    } else {
      clearInterval(interval);
    }
  }, 20000); // 20 seconds to keep service worker alive
}

connectWebSocket();
