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
      } else {
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
