let socket = null;

document.getElementById("prevBtn").addEventListener("click", () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "bilibili_previous"
    }));
  }
});

document.getElementById("nextBtn").addEventListener("click", () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "bilibili_next"
    }));
  }
});

document.getElementById("pausePlayBtn").addEventListener("click", () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "bilibili_pause_and_play"
    }));
  }
});

document.getElementById("progressSlider").addEventListener("input", (event) => {
  const newTime = event.target.value;
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "bilibili_seek",
      data: JSON.stringify({time: parseFloat(newTime)})
    }));
  }
});

document.getElementById("rewindBtn").addEventListener("click", () => {
  const newTime = Math.max(0, document.getElementById("progressSlider").value - 10);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "bilibili_seek",
      data: JSON.stringify({time: parseFloat(newTime)})
    }));
  }
});

document.getElementById("forwardBtn").addEventListener("click", () => {
  const progressSlider = document.getElementById("progressSlider");
  const newTime = Math.min(progressSlider.max, parseFloat(progressSlider.value) + 10);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "bilibili_seek",
      data: JSON.stringify({time: parseFloat(newTime)})
    }));
  }
});

document.getElementById("fullscreenBtn").addEventListener("click", () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "bilibili_fullscreen"
    }));
  }
});

document.getElementById("playbackRate").addEventListener("change", (event) => {
  const rate = parseFloat(event.target.value);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "update_video_status",
      data: JSON.stringify({
        playbackRate: rate
      })
    }));
  }
});

document.getElementById("volumeSlider").addEventListener("input", (event) => {
  const volume = parseFloat(event.target.value) / 100;
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "update_video_status",
      data: JSON.stringify({
        volume: volume
      })
    }));
  }
});

document.querySelectorAll(".remote-btn").forEach(btn => {
  btn.addEventListener("click", () => {

    console.log(`Pressed: ${btn.id}`);
    var command = "ArrowDown";
    switch (btn.id) {
      case "btn-up":
        command = "ArrowUp";
        break;
      case "btn-down":
        command = "ArrowDown";
        break;
      case "btn-left":
        command = "ArrowLeft";
        break;
      case "btn-right":
        command = "ArrowRight";
        break;
      case "btn-enter":
        command = "Enter";
        break;
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "remote_control_key",
        data: command
      }));
    }
  });
});

function onReceiveMessage(line) {
  const box = document.getElementById("messageBox");
  const msg = document.createElement("div");
  msg.className = "message";
  msg.textContent = line;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight; // Auto-scroll to bottom
}

async function recordInit() {
  let mediaRecorder;
  let audioChunks = [];
  var recordBtn = document.getElementById("recordBtn");
  recordBtn.addEventListener("click", async () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      stopRecording();
      return;
    }
    await startRecording();

    recordBtn.innerText = "Stop";
  });
}

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.start();
  mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
  mediaRecorder.onstop = () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.wav');
    fetch('/ask', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      console.log('Success:', JSON.stringify(data));
    })
    .catch((error) => {
      console.error('Error:', JSON.stringify(error));
    });
  };
}

function stopRecording() {
  mediaRecorder.stop();
  mediaRecorder = null;
  audioChunks = [];
  recordBtn.innerText = "Record";
}

function connectWebSocket() {
  socket = new WebSocket("ws://" + window.location.host + "/controller");
  socket.onopen = () => {
    console.log("WebSocket connected");
    socket.send(JSON.stringify({type: "bilibili_playing_status_request"}));
  };

  socket.onmessage = (event) => {
    console.log("Received from server:", event.data);
    const message = JSON.parse(event.data);
    if (message.type === "bilibili_playing_status") {
      const status = JSON.parse(message.data);
      const isPlaying = status.paused === false;
      document.getElementById("pausePlayBtn").innerText = isPlaying ? "Pause" : "Play";
      document.getElementById("progressSlider").max = status.duration;
      document.getElementById("progressSlider").value = status.currentTime;
      function formatTime(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = Math.round(seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
      }
      document.getElementById("progressLabel").innerText = `${formatTime(status.currentTime)}/${formatTime(status.duration)}`;
      document.getElementById("playbackRate").value = status.playbackRate;
      document.getElementById("volumeSlider").value = status.volume * 100;
      document.getElementById("volumeLabel").innerText = `${Math.round(status.volume * 100)}%`;
    }
    else if (message.type === "message_update") {
      onReceiveMessage(message.data);
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

connectWebSocket();