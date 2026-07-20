import http from "http";

export class KeepWarm {
  private url: string;
  private intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(url: string, intervalMs = 5 * 60 * 1000) {
    this.url = url;
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (!this.url) return;
    console.log(`[keepwarm] Pinging ${this.url} every ${this.intervalMs / 1000}s`);
    this.timer = setInterval(() => this.ping(), this.intervalMs);
    this.ping();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private ping(): void {
    const start = Date.now();
    http
      .get(this.url, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          console.log(`[keepwarm] ${res.statusCode} — ${Date.now() - start}ms`);
        });
      })
      .on("error", (err) => {
        console.log(`[keepwarm] Error: ${err.message}`);
      });
  }
}
