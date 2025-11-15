import {config} from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  var img = document.getElementById("qrcode");
  img.src = `http://${config.ip}:${config.port}/qrcode`;
});