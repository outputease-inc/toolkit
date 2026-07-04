import { Readable } from "node:stream";

/**
 * npm registry metadata endpoint for the `@latest` dist-tag of the toolkit
 * package. Used to discover the canonical tarball URL + shasum without
 * embedding a per-version URL in this source file.
 *
 * Override via `OUTPUTEASE_TOOLKIT_PACKAGE` env var for testing against a
 * private registry, mirror, or alternate package name.
 */
/**
 * Canonical published package name. Single source of truth so the scaffold
 * dependency builder (`getAutomationDeps`) and the update fetcher agree without
 * drifting two string literals. Plain const (not env-derived) so scaffold deps
 * never become env-sensitive.
 */
const TOOLKIT_PACKAGE_NAME = "@outputease/toolkit";
const PACKAGE_NAME = process.env.OUTPUTEASE_TOOLKIT_PACKAGE ?? TOOLKIT_PACKAGE_NAME;
const REGISTRY_BASE = process.env.OUTPUTEASE_NPM_REGISTRY ?? "https://registry.npmjs.org";
const METADATA_URL = `${REGISTRY_BASE}/${PACKAGE_NAME}/latest`;

export type FetchResult = {
  body: NodeJS.ReadableStream;
  /** Tarball SHA (npm registry returns SHA-1). */
  sha: string;
  shortSha: string;
  /** Published version of the fetched tarball. */
  version: string;
};

/**
 * Minimal fetch shape needed for `fetchTarball` DI — only the call signature,
 * not the full `typeof fetch` (which carries `preconnect` etc. that test
 * stubs don't need to satisfy).
 */
export type FetchFn = (url: string | URL, init?: RequestInit) => Promise<Response>;

export class FetchError extends Error {
  readonly kind: "network" | "http" | "no-sha";
  constructor(message: string, kind: "network" | "http" | "no-sha") {
    super(message);
    this.kind = kind;
    this.name = "FetchError";
  }
}

type RegistryMetadata = {
  version: string;
  dist: {
    tarball: string;
    shasum: string;
  };
};

/**
 * Fetch the latest published toolkit tarball from the npm registry.
 *
 * Two-step protocol:
 *   1. GET registry metadata to discover `dist.tarball` + `dist.shasum`.
 *   2. GET the tarball stream.
 *
 * Both fetches go through the optional `fetchImpl` so tests can inject
 * canned responses.
 */
export async function fetchTarball(
  metadataUrl: string = METADATA_URL,
  fetchImpl: FetchFn = fetch,
): Promise<FetchResult> {
  let metaResponse: Response;
  try {
    metaResponse = await fetchImpl(metadataUrl, {
      redirect: "follow",
      headers: {
        accept: "application/json",
        "user-agent": "outputease-toolkit-update",
      },
    });
  } catch (err) {
    throw new FetchError(
      `Network error fetching ${metadataUrl}: ${(err as Error).message}`,
      "network",
    );
  }

  if (!metaResponse.ok) {
    throw new FetchError(`HTTP ${metaResponse.status} fetching ${metadataUrl}`, "http");
  }

  let meta: RegistryMetadata;
  try {
    meta = (await metaResponse.json()) as RegistryMetadata;
  } catch (err) {
    throw new FetchError(
      `Malformed registry metadata at ${metadataUrl}: ${(err as Error).message}`,
      "http",
    );
  }

  if (!meta.dist?.tarball || !meta.dist?.shasum) {
    throw new FetchError(
      `Registry metadata at ${metadataUrl} missing dist.tarball or dist.shasum`,
      "no-sha",
    );
  }

  let tarballResponse: Response;
  try {
    tarballResponse = await fetchImpl(meta.dist.tarball, {
      redirect: "follow",
      headers: { "user-agent": "outputease-toolkit-update" },
    });
  } catch (err) {
    throw new FetchError(
      `Network error fetching ${meta.dist.tarball}: ${(err as Error).message}`,
      "network",
    );
  }

  if (!tarballResponse.ok) {
    throw new FetchError(`HTTP ${tarballResponse.status} fetching ${meta.dist.tarball}`, "http");
  }
  if (!tarballResponse.body) {
    throw new FetchError("Tarball response had no body", "http");
  }

  const body = Readable.fromWeb(tarballResponse.body as never);
  return {
    body,
    sha: meta.dist.shasum,
    shortSha: meta.dist.shasum.slice(0, 7),
    version: meta.version,
  };
}

export { METADATA_URL, PACKAGE_NAME, REGISTRY_BASE, TOOLKIT_PACKAGE_NAME };
