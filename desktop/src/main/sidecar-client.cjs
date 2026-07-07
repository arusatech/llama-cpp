/**
 * HTTP client for the llama-cpp cap-native-server sidecar.
 * Targets OpenAI-compatible endpoints on 127.0.0.1:{port}.
 */

const http = require('http');

function createSidecarClient(port, deps) {
  const _http = (deps && deps.http) || http;

  function request(method, urlPath, body, timeoutMs) {
    return new Promise((resolve, reject) => {
      const payload = body != null ? JSON.stringify(body) : null;
      const opts = {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: { 'Content-Type': 'application/json' },
        timeout: timeoutMs,
      };
      if (payload != null) {
        opts.headers['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = _http.request(opts, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode >= 400) {
            reject(new Error(`Sidecar HTTP ${res.statusCode}: ${raw.slice(0, 300)}`));
            return;
          }
          if (!raw) {
            resolve({});
            return;
          }
          try {
            resolve(JSON.parse(raw));
          } catch (_) {
            resolve({ raw });
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Sidecar timeout: ${method} ${urlPath}`));
      });
      req.on('error', (err) => reject(err));
      if (payload != null) req.write(payload);
      req.end();
    });
  }

  return {
    health: () => request('GET', '/health', null, 5000),
    chatCompletion: (body, timeoutMs = 120000) =>
      request('POST', '/v1/chat/completions', body, timeoutMs),
    completion: (body, timeoutMs = 120000) =>
      request('POST', '/v1/completions', body, timeoutMs),
    embeddings: (body, timeoutMs = 60000) =>
      request('POST', '/v1/embeddings', body, timeoutMs),
    models: () => request('GET', '/v1/models', null, 5000),
  };
}

module.exports = { createSidecarClient };
