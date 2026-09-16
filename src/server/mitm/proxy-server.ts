import https from "node:https";
import http from "node:http";
import net from "node:net";
import { getSecureContextForDomain } from "./ca.js";

interface MitmOptions {
	port?: number;
	mnrouterBaseUrl?: string;
	apiKey?: string;
}

export function startMitmServer(opts: MitmOptions = {}) {
	const port = opts.port ?? (process.getuid && process.getuid() === 0 ? 443 : 8443);
	const targetBase = (opts.mnrouterBaseUrl || "http://127.0.0.1:8787").replace(/\/+$/, "");
	const apiKey = opts.apiKey || process.env.MNROUTER_API_KEY || "";

	const server = https.createServer({
		SNICallback(serverName, cb) {
			try {
				const ctx = getSecureContextForDomain(serverName || "localhost");
				cb(null, ctx);
			} catch (err) {
				cb(err as Error);
			}
		},
	}, (clientReq, clientRes) => {
		const host = (clientReq.headers.host || "").split(":")[0] || "";
		const url = clientReq.url || "/";
		const isAntigravity = host.includes("cloudcode-pa.googleapis.com");
		const isCopilot = host.includes("githubcopilot.com");
		const isKiro = host.includes("kiro.dev") || host.includes("amazonaws.com");

		let targetPath = "/v1/chat/completions";
		if (isCopilot) {
			if (url.includes("/messages")) targetPath = "/v1/messages";
			else if (url.includes("/responses")) targetPath = "/v1/responses";
			else targetPath = "/v1/chat/completions";
		}

		const proxyUrl = new URL(targetPath, targetBase);
		const headers: Record<string, string> = {
			"content-type": clientReq.headers["content-type"] || "application/json",
			"authorization": apiKey ? `Bearer ${apiKey}` : (clientReq.headers["authorization"] || ""),
			"user-agent": clientReq.headers["user-agent"] || "mnrouter-mitm",
		};

		const proxyReq = http.request(proxyUrl, {
			method: clientReq.method,
			headers,
		}, (proxyRes) => {
			clientRes.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
			proxyRes.pipe(clientRes);
		});

		proxyReq.on("error", (err) => {
			if (!clientRes.headersSent) {
				clientRes.writeHead(502, { "content-type": "application/json" });
				clientRes.end(JSON.stringify({ error: "mitm_gateway_error", message: err.message }));
			}
		});

		clientReq.pipe(proxyReq);
	});

	// Support HTTP CONNECT proxy tunnel
	server.on("connect", (req, clientSocket, head) => {
		const [destHost, destPort] = (req.url || "").split(":");
		const targetP = Number(destPort) || 443;
		const srvSocket = net.connect(targetP, destHost, () => {
			clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
			srvSocket.write(head);
			srvSocket.pipe(clientSocket);
			clientSocket.pipe(srvSocket);
		});
		srvSocket.on("error", () => clientSocket.destroy());
	});

	server.listen(port, () => {
		console.log(`\x1b[1;32m[mnRouter MITM]\x1b[0m HTTPS Interception Proxy listening on port ${port}`);
		console.log(`\x1b[1;30mTarget router:\x1b[0m ${targetBase}`);
	});

	return server;
}
