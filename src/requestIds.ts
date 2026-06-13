import { randomUUID } from "node:crypto";

/**
 * Standard request correlation header used by BigfootDS services.
 */
export const REQUEST_ID_HEADER_NAME = "x-request-id";

/**
 * Minimum accepted inbound request ID length.
 */
export const REQUEST_ID_MIN_LENGTH = 8;

/**
 * Maximum accepted inbound request ID length.
 */
export const REQUEST_ID_MAX_LENGTH = 64;

/**
 * Safe ASCII inbound request ID pattern.
 */
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,64}$/;

/**
 * Minimal request-header object shape used by Node and Express.
 */
export type HeaderRecord = Readonly<Record<string, string | readonly string[] | undefined>>;

/**
 * Minimal response-header writer shape used by Node and Express.
 */
export interface HeaderWriter {
	set?(name: string, value: string): unknown;
	setHeader?(name: string, value: string): unknown;
}

/**
 * Request ID resolution result.
 */
export interface RequestIdResolution {
	/**
	 * Request ID that should be used for logs, responses, and downstream calls.
	 */
	readonly requestId: string;

	/**
	 * Whether the request ID was generated locally instead of accepted from inbound headers.
	 */
	readonly generated: boolean;

	/**
	 * Inbound header value, when one was present.
	 */
	readonly inboundRequestId?: string;
}

/**
 * Active request metadata shared by middleware and helper code.
 */
export interface ActiveRequestMetadata extends RequestIdResolution {
	/**
	 * Milliseconds since Unix epoch when request handling started.
	 */
	readonly startedAtMs: number;
}

export interface ResolveRequestIdOptions {
	/**
	 * Optional generator used by tests or services that need a custom ID source.
	 */
	readonly generateRequestId?: () => string;
}

export interface CreateRequestMetadataOptions extends ResolveRequestIdOptions {
	/**
	 * Millisecond timestamp to use for the metadata.
	 */
	readonly nowMs?: number;
}

/**
 * Generates a new request ID using Node's UUID implementation.
 */
export function generateRequestId(): string {
	return randomUUID();
}

/**
 * Checks whether a raw value is safe to accept as an inbound request ID.
 */
export function isValidRequestId(value: unknown): value is string {
	return typeof value === "string" && REQUEST_ID_PATTERN.test(value);
}

/**
 * Reads a header value from a header record using case-insensitive matching.
 */
export function getHeaderValue(
	headers: HeaderRecord | undefined,
	headerName: string
): string | undefined {
	if (headers === undefined) {
		return undefined;
	}

	const directValue = readSingleHeaderValue(headers[headerName]);

	if (directValue !== undefined) {
		return directValue;
	}

	const lowerHeaderName = headerName.toLowerCase();

	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === lowerHeaderName) {
			return readSingleHeaderValue(value);
		}
	}

	return undefined;
}

/**
 * Resolves an accepted inbound request ID or generates a replacement.
 */
export function resolveRequestId(
	inboundRequestId?: unknown,
	options: ResolveRequestIdOptions = {}
): RequestIdResolution {
	const headerValue = readSingleHeaderValue(inboundRequestId);

	if (isValidRequestId(headerValue)) {
		return {
			requestId: headerValue,
			generated: false,
			inboundRequestId: headerValue
		};
	}

	return {
		requestId: options.generateRequestId?.() ?? generateRequestId(),
		generated: true,
		inboundRequestId: headerValue
	};
}

/**
 * Resolves the standard request ID from a header record.
 */
export function resolveRequestIdFromHeaders(
	headers: HeaderRecord | undefined,
	options: ResolveRequestIdOptions = {}
): RequestIdResolution {
	return resolveRequestId(getHeaderValue(headers, REQUEST_ID_HEADER_NAME), options);
}

/**
 * Creates active request metadata from inbound headers.
 */
export function createActiveRequestMetadata(
	headers: HeaderRecord | undefined,
	options: CreateRequestMetadataOptions = {}
): ActiveRequestMetadata {
	return {
		...resolveRequestIdFromHeaders(headers, options),
		startedAtMs: options.nowMs ?? Date.now()
	};
}

/**
 * Writes the request ID to a response-like object.
 */
export function writeRequestIdHeader(
	response: HeaderWriter,
	requestId: string,
	headerName = REQUEST_ID_HEADER_NAME
): void {
	if (typeof response.setHeader === "function") {
		response.setHeader(headerName, requestId);
		return;
	}

	if (typeof response.set === "function") {
		response.set(headerName, requestId);
	}
}

function readSingleHeaderValue(value: unknown): string | undefined {
	if (Array.isArray(value)) {
		return typeof value[0] === "string" ? value[0] : undefined;
	}

	return typeof value === "string" ? value : undefined;
}
