import morgan, { type Options as MorganOptions } from "morgan";
import type { IncomingMessage, ServerResponse } from "node:http";
import { REQUEST_ID_HEADER_NAME, getHeaderValue, type HeaderRecord } from "./requestIds";

/**
 * Morgan token name for BigfootDS request IDs.
 */
export const MORGAN_REQUEST_ID_TOKEN_NAME = "bigfootds-request-id";

/**
 * Single-line Morgan format for BigfootDS microservice console logs.
 */
export const BIGFOOTDS_MORGAN_FORMAT = [
	":date[iso]",
	"RequestId :bigfootds-request-id,",
	"Method :method,",
	"URL :url,",
	"Status :status,",
	"ResponseBytes :res[content-length],",
	"ResponseTime :response-time ms,",
	"Referrer :referrer,",
	"UserAgent :user-agent"
].join(" ");

/**
 * Minimal request shape used by the request ID Morgan token.
 */
export interface MorganRequestIdSource {
	readonly headers?: HeaderRecord;
	readonly bigfootds?: {
		readonly requestId?: string;
	};
}

/**
 * Options for creating the BigfootDS Morgan request logger.
 */
export interface BigfootDSMorganOptions<
	Request extends IncomingMessage,
	Response extends ServerResponse
> extends MorganOptions<Request, Response> {
	/**
	 * Whether to create an active Morgan logger. Defaults to disabled in `NODE_ENV=test`.
	 */
	readonly enabled?: boolean;

	/**
	 * Morgan format string. Defaults to the BigfootDS single-line format.
	 */
	readonly format?: string;

	/**
	 * Whether to register BigfootDS custom Morgan tokens before creating the logger.
	 */
	readonly registerTokens?: boolean;
}

/**
 * Returns whether request logging should be active for an environment.
 */
export function shouldLogRequests(nodeEnv = process.env.NODE_ENV): boolean {
	return nodeEnv !== "test";
}

/**
 * Gets the request ID value used by the BigfootDS Morgan token.
 */
export function getMorganRequestIdToken(request: MorganRequestIdSource): string {
	return request.bigfootds?.requestId
		?? getHeaderValue(request.headers, REQUEST_ID_HEADER_NAME)
		?? "-";
}

/**
 * Registers BigfootDS custom Morgan tokens on a Morgan-compatible instance.
 */
export function registerBigfootDSMorganTokens(morganInstance = morgan): void {
	morganInstance.token(MORGAN_REQUEST_ID_TOKEN_NAME, (request) => {
		return getMorganRequestIdToken(request as MorganRequestIdSource);
	});
}

/**
 * Creates a Morgan request logger configured for BigfootDS microservices.
 */
export function createBigfootDSMorganLogger<
	Request extends IncomingMessage = IncomingMessage,
	Response extends ServerResponse = ServerResponse
>(
	options: BigfootDSMorganOptions<Request, Response> = {}
): ReturnType<typeof morgan<Request, Response>> {
	const {
		enabled = shouldLogRequests(),
		format = BIGFOOTDS_MORGAN_FORMAT,
		registerTokens = true,
		...morganOptions
	} = options;

	if (!enabled) {
		return ((_request: Request, _response: Response, next: (error?: unknown) => void) => {
			next();
		}) as ReturnType<typeof morgan<Request, Response>>;
	}

	if (registerTokens) {
		registerBigfootDSMorganTokens();
	}

	return morgan<Request, Response>(format, morganOptions);
}
