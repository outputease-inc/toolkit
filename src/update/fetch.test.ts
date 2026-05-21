import { describe, expect, test } from "bun:test";
import { FetchError, type FetchFn, fetchTarball } from "./fetch";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function tarballResponse(payload: string, status = 200): Response {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(payload));
      controller.close();
    },
  });
  return new Response(stream, { status, headers: { "content-type": "application/octet-stream" } });
}

describe("fetchTarball (npm registry)", () => {
  test("two-step: fetches metadata then tarball, returns shasum + version", async () => {
    const calls: string[] = [];
    const fakeFetch: FetchFn = async (url) => {
      const u = url.toString();
      calls.push(u);
      if (u.endsWith("/latest")) {
        return jsonResponse({
          version: "0.2.0",
          dist: {
            tarball: "https://registry.example.com/pkg-0.2.0.tgz",
            shasum: "abcdef1234567890abcdef1234567890abcdef12",
          },
        });
      }
      return tarballResponse("fake tarball bytes");
    };

    const result = await fetchTarball("https://registry.example.com/@x/y/latest", fakeFetch);
    expect(calls).toEqual([
      "https://registry.example.com/@x/y/latest",
      "https://registry.example.com/pkg-0.2.0.tgz",
    ]);
    expect(result.version).toBe("0.2.0");
    expect(result.sha).toBe("abcdef1234567890abcdef1234567890abcdef12");
    expect(result.shortSha).toBe("abcdef1");
    expect(result.body).toBeDefined();
  });

  test("throws FetchError(http) on registry metadata 404", async () => {
    const fakeFetch: FetchFn = async () => new Response("not found", { status: 404 });
    await expect(fetchTarball("https://x/latest", fakeFetch)).rejects.toBeInstanceOf(FetchError);
    try {
      await fetchTarball("https://x/latest", fakeFetch);
    } catch (err) {
      expect((err as FetchError).kind).toBe("http");
    }
  });

  test("throws FetchError(network) when metadata fetch throws", async () => {
    const fakeFetch: FetchFn = async () => {
      throw new Error("DNS lookup failed");
    };
    try {
      await fetchTarball("https://x/latest", fakeFetch);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).kind).toBe("network");
    }
  });

  test("throws FetchError(no-sha) when metadata missing dist.shasum", async () => {
    const fakeFetch: FetchFn = async () =>
      jsonResponse({ version: "0.2.0", dist: { tarball: "https://x/y.tgz" } });
    try {
      await fetchTarball("https://x/latest", fakeFetch);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).kind).toBe("no-sha");
    }
  });

  test("throws FetchError(http) on malformed metadata JSON", async () => {
    const fakeFetch: FetchFn = async () =>
      new Response("{not json", { status: 200, headers: { "content-type": "application/json" } });
    try {
      await fetchTarball("https://x/latest", fakeFetch);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).kind).toBe("http");
    }
  });

  test("throws FetchError(http) when tarball fetch returns non-2xx", async () => {
    const fakeFetch: FetchFn = async (url) => {
      const u = url.toString();
      if (u.endsWith("/latest")) {
        return jsonResponse({
          version: "0.2.0",
          dist: {
            tarball: "https://registry.example.com/pkg.tgz",
            shasum: "0".repeat(40),
          },
        });
      }
      return new Response("gone", { status: 410 });
    };
    try {
      await fetchTarball("https://x/latest", fakeFetch);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).kind).toBe("http");
    }
  });
});
