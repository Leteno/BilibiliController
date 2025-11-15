import {config} from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  var img = document.getElementById("qrcode");
  img.src = `http://${config.ip}:${config.port}/qrcode`;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Popup received message:", message);
  if (message.type === "close-popup") {
    console.log("Closing popup");
    window.close();
  }
});