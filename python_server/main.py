from aiohttp import web
import aiohttp
import aiohttp_jinja2
import jinja2
import os

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.TEXT:
            await ws.send_str(f"Echo: {msg.data}")
        elif msg.type == aiohttp.WSMsgType.ERROR:
            print(f"WebSocket error: {ws.exception()}")

    return ws

@aiohttp_jinja2.template('index.html')
async def index(request):
    return {}

worker_ws = None  # Global reference to the worker WebSocket
controller_ws_list = []  # Global reference to the controller WebSocket

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

if __name__ == '__main__':
    app = web.Application()
    aiohttp_jinja2.setup(app, loader=jinja2.FileSystemLoader('./templates'))
    app.router.add_get('/', index)
    app.router.add_get('/ws', websocket_handler)
    app.router.add_get('/worker', worker_handler)
    app.router.add_get('/controller', controller_handler)
    app.router.add_static('/static/', path='./static', name='static')

    port = int(os.environ.get('PORT', 8080))
    web.run_app(app, port=port)