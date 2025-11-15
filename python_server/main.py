#!/usr/bin/env python
from aiohttp import web
import aiohttp
import aiohttp_jinja2
import io
import json
import jinja2
import os
import keyboard
import qrcode
import socket

script_dir = os.path.dirname(os.path.abspath(__file__))

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.TEXT:
            await ws.send_str(f"Echo: {msg.data}")
        elif msg.type == aiohttp.WSMsgType.ERROR:
            print(f"WebSocket error: {ws.exception()}")

    return ws

worker_ws = None  # Global reference to the worker WebSocket
controller_ws_list = []  # Global reference to the controller WebSocket

@aiohttp_jinja2.template('index.html')
async def index(request):
    if 'from' in request.rel_url.query and request.rel_url.query['from'] == 'qrcode':
        print("[Index] Accessed from QR code.")
        global worker_ws
        if worker_ws and not worker_ws.closed:
            command = {
                "type": "close-popup"
            }
            await worker_ws.send_str(json.dumps(command))
        else:
            print("[Index] No worker connected to handle QR code request.")
    return {}

async def controller_handler(request):
    global worker_ws
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    controller_ws_list.append(ws)

    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.TEXT:
            command = msg.data
            print(f"[Controller] Received command: {command}")
            if worker_ws and not worker_ws.closed:
                if "bilibili_fullscreen" in command:
                    keyboard.send("f")
                    print("[Controller] Fullscreen command executed via keyboard.")
                    break
                await worker_ws.send_str(command)
            else:
                await ws.send_str("No worker connected.")
        elif msg.type == aiohttp.WSMsgType.ERROR:
            print(f"[Controller] Error: {ws.exception()}")

    print("[Controller] Disconnected.")
    controller_ws_list.remove(ws)
    return ws

async def worker_handler(request):
    global worker_ws
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    worker_ws = ws
    print("[Worker] Connected.")

    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.TEXT:
            print(f"[Worker] Executing: {msg.data}")
            for controller_ws in controller_ws_list:
                if not controller_ws.closed:
                    await controller_ws.send_str(msg.data)
        elif msg.type == aiohttp.WSMsgType.ERROR:
            print(f"[Worker] Error: {ws.exception()}")

    print("[Worker] Disconnected.")
    worker_ws = None
    return ws

def get_qrcode(request):
    port = int(os.environ.get('PORT', 5000))
    url = f"http://{get_local_ip()}:{port}/?from=qrcode"
    print(f"Generating QR code for URL: {url}")
    try:
        qr = qrcode.make(url)
        out = io.BytesIO()
        qr.save(out, format="PNG")
        out.seek(0)
        return web.Response(body=out.getvalue(), content_type="image/png")
    except Exception as e:
        return web.Response(text=f"Error generating QR code: {e}", status=500)

def get_local_ip():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(('8.8.8.8', 80))
            return s.getsockname()[0]
        except Exception:
            return '127.0.0.1'

if __name__ == '__main__':
    app = web.Application()
    aiohttp_jinja2.setup(app, loader=jinja2.FileSystemLoader(os.path.join(script_dir, 'templates')))
    app.router.add_get('/', index)
    app.router.add_get('/ws', websocket_handler)
    app.router.add_get('/worker', worker_handler)
    app.router.add_get('/controller', controller_handler)
    app.router.add_get('/qrcode', get_qrcode)
    app.router.add_static('/static/', path=os.path.join(script_dir, 'static'), name='static')

    port = int(os.environ.get('PORT', 5000))
    web.run_app(app, port=port)