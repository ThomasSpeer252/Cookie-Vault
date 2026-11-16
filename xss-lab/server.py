#!/usr/bin/env python3
import secrets
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

SESSION_ID = secrets.token_hex(8)


class LabHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Set-Cookie', f'PHPSESSID={SESSION_ID}; Path=/')
        self.send_header('Set-Cookie', 'user=lab-user; Path=/')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 8080), LabHandler)
    print(f'XSS Lab http://127.0.0.1:8080/  PHPSESSID={SESSION_ID}')
    server.serve_forever()
