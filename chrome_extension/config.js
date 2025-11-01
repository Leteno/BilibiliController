const _config = {
  no_tls: {
    ws_protocol: "ws",
    ip: "localhost",
    port: 5000
  }
}

let env = "no_tls";

export const config = _config[env];
