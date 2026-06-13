import { ERROR_CODES } from "@bigfootds/bigfootds-shared-data";
import {
	createErrorResponse,
	normalizeServiceError,
	serializeServiceError,
	type ServiceErrorOptions,
	type SerializedServiceError
} from "./errors";
import {
	createActiveRequestMetadata,
	writeRequestIdHeader,
	type ActiveRequestMetadata,
	type HeaderRecord
} from "./requestIds";
import {
	verifyServiceTokenFromHeaders,
	type ServiceCaller,
	type ServiceCallerPolicy
} from "./serviceTokens";

/**
 * Request context attached by BigfootDS Express adapters.
 */
export interface BigfootDSRequestContext extends ActiveRequestMetadata {
	readonly serviceCaller?: ServiceCaller;
}

/**
 * Minimal Express-like request shape used by the adapters.
 */
export interface ExpressLikeRequest {
	readonly headers?: HeaderRecord;
	readonly method?: string;
	readonly originalUrl?: string;
	readonly url?: string;
	bigfootds?: BigfootDSRequestContext;
}

/**
 * Minimal Express-like response shape used by the adapters.
 */
export interface ExpressLikeResponse {
	statusCode?: number;
	readonly headersSent?: boolean;
	set?(name: string, value: string): unknown;
	setHeader?(name: string, value: string): unknown;
	status?(statusCode: number): ExpressLikeResponse;
	json?(body: unknown): unknown;
	send?(body: unknown): unknown;
	end?(body?: unknown): unknown;
}

export type ExpressLikeNextFunction = (error?: unknown) => void;

export type ExpressLikeMiddleware = (
	request: ExpressLikeRequest,
	response: ExpressLikeResponse,
	next: ExpressLikeNextFunction
) => void;

export type ExpressLikeErrorMiddleware = (
	error: unknown,
	request: ExpressLikeRequest,
	response: ExpressLikeResponse,
	next: ExpressLikeNextFunction
) => void;

export interface RequestIdMiddlewareOptions {
	readonly generateRequestId?: () => string;
	readonly nowMs?: number;
}

/**
 * Creates middleware that resolves, stores, and returns the standard request ID.
 */
export function requestIdMiddleware(
	options: RequestIdMiddlewareOptions = {}
): ExpressLikeMiddleware {
	return (request, response, next) => {
		const metadata = createActiveRequestMetadata(request.headers, options);
		request.bigfootds = {
			...request.bigfootds,
			...metadata
		};
		writeRequestIdHeader(response, metadata.requestId);
		next();
	};
}

/**
 * Creates middleware that verifies bearer service-token callers.
 */
export function serviceTokenMiddleware(
	policy: ServiceCallerPolicy
): ExpressLikeMiddleware {
	return (request, response, next) => {
		const context = ensureRequestContext(request, response);
		const result = verifyServiceTokenFromHeaders(request.headers, policy);

		if (!result.ok) {
			sendSerializedError(
				response,
				createErrorResponse(result.errorCode, {
					requestId: context.requestId,
					httpStatus: result.httpStatus
				})
			);
			return;
		}

		request.bigfootds = {
			...context,
			serviceCaller: result.caller
		};
		next();
	};
}

/**
 * Creates Express-style error middleware for standard service responses.
 */
export function standardErrorHandler(
	options: ServiceErrorOptions = {}
): ExpressLikeErrorMiddleware {
	return (error, request, response, next) => {
		if (response.headersSent === true) {
			next(error);
			return;
		}

		const serviceError = normalizeServiceError(error, {
			...options,
			requestId: options.requestId ?? request.bigfootds?.requestId
		});
		sendSerializedError(
			response,
			serializeServiceError(serviceError, {
				requestId: options.requestId ?? request.bigfootds?.requestId
			})
		);
	};
}

/**
 * Sends a standard unauthenticated error response.
 */
export function sendUnauthorizedResponse(
	response: ExpressLikeResponse,
	requestId?: string
): void {
	sendSerializedError(
		response,
		createErrorResponse(ERROR_CODES.UNAUTHORIZED, {
			requestId
		})
	);
}

function ensureRequestContext(
	request: ExpressLikeRequest,
	response: ExpressLikeResponse
): BigfootDSRequestContext {
	if (request.bigfootds !== undefined) {
		return request.bigfootds;
	}

	const metadata = createActiveRequestMetadata(request.headers);
	const context: BigfootDSRequestContext = metadata;
	request.bigfootds = context;
	writeRequestIdHeader(response, metadata.requestId);
	return context;
}

function sendSerializedError(
	response: ExpressLikeResponse,
	serializedError: SerializedServiceError
): void {
	const statusResponse = response.status?.(serializedError.httpStatus) ?? response;

	if (response.status === undefined) {
		response.statusCode = serializedError.httpStatus;
	}

	if (typeof response.json === "function") {
		response.json(serializedError.body);
		return;
	}

	const body = JSON.stringify(serializedError.body);

	if (typeof response.setHeader === "function") {
		response.setHeader("content-type", "application/json");
	} else if (typeof response.set === "function") {
		response.set("content-type", "application/json");
	}

	if (typeof statusResponse.send === "function") {
		statusResponse.send(body);
		return;
	}

	statusResponse.end?.(body);
}
