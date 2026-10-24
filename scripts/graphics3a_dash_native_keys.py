"""Direct first-party Chromium DevTools *trusted native* keyboard edges.
Reason: separate ChromeDriver W3C action ticks on underpowered quad browser
machine can exceed the authentic 240ms double-tap window. No DOM dispatch,
no protocol mocks, no alteration to the server/player/game or frame timing.
Python stdlib RFC6455 socket implementation, no connector or library secrets.
"""
import base64
import json
import os
import socket
import time
import urllib.parse
import urllib.request

def _frame(payload: bytes) -> bytes:
    mask = os.urandom(4)
    n = len(payload)
    if n <= 125:
        hdr = bytes([0x81,0x80 | n])
    elif n <= 65535:
        hdr = bytes([0x81,0x80 | 126])+n.to_bytes(2,"big")
    else:
        hdr = bytes([0x81,0x80 | 127])+n.to_bytes(8,"big")
    return hdr+mask+bytes(v ^ mask[i%4] for i,v in enumerate(payload))

def _connect(debugger_addr, page_url_substr):
    with urllib.request.urlopen("http://"+debugger_addr+"/json/list",timeout=12) as r:
        targets=json.load(r)
    t=next((t for t in targets if t.get("type")=="page" and page_url_substr in t.get("url","")),None)
    assert t and t.get("webSocketDebuggerUrl"),("No actual Chromium first party target",[(t.get("type"),t.get("url","")[:90]) for t in targets])
    url=urllib.parse.urlparse(t["webSocketDebuggerUrl"])
    assert url.scheme=="ws" and url.hostname in ("127.0.0.1","localhost")
    conn=socket.create_connection((url.hostname,url.port),timeout=12)
    conn.settimeout(12)
    key=base64.b64encode(os.urandom(16)).decode()
    request=(
        f"GET {url.path} HTTP/1.1\r\nHost: {url.netloc}\r\n"
        "Upgrade: websocket\r\nConnection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n"
        "Origin: http://localhost\r\n\r\n"
    )
    conn.sendall(request.encode("ascii"))
    response=b""
    while b"\r\n\r\n" not in response and len(response)<8192:
        part=conn.recv(2048)
        if not part:break
        response+=part
    assert response.startswith(b"HTTP/1.1 101"),response[:350]
    return conn

def trusted_double_tap(debugger_addr):
    c=_connect(debugger_addr,"/web/?")
    try:
        events=[
          ("rawKeyDown", 0.028),
          ("keyUp",0.044),
          ("rawKeyDown",0.36),
          ("keyUp",0)
        ]
        for i,(etype,pause) in enumerate(events):
            msg={"id":i+1,"method":"Input.dispatchKeyEvent",
              "params":{"type":etype,"key":"w","code":"KeyW",
                        "windowsVirtualKeyCode":87,"nativeVirtualKeyCode":87}}
            c.sendall(_frame(json.dumps(msg,separators=(",",":")).encode("utf8")))
            if pause:time.sleep(pause)
        return True
    finally:
        c.close()
