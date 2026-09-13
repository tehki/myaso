# M7 Browser Support Basis

M7 treats WebTransport as a real cross-browser requirement rather than a Chromium-only optimization.

Current web-platform guidance marks the WebTransport API Baseline 2026 across current browser engines, while individual optional properties may still vary in availability. The M7 gate therefore verifies the exact subset myaso.io depends on in real browsers:

- `WebTransport` construction in a secure loopback context;
- dedicated HTTP/3 connection;
- `serverCertificateHashes` with SHA-256 for short-lived development certificates;
- unreliable datagrams;
- bidirectional streams required by the transport adapter;
- authoritative snapshot/ACK exchange through the existing M6 protocol.

The GitHub Ubuntu 24.04 runner image used when this milestone was authored includes Google Chrome 152, ChromeDriver 152, Mozilla Firefox 155, and Geckodriver 0.37.1. CI discovers the installed versions at run time and records them in the job log before executing the flight.

The browser versions above are evidence about the CI image used for this milestone, not a permanent minimum-supported-version policy. A future browser support policy must be driven by actual player telemetry and explicit compatibility decisions.
