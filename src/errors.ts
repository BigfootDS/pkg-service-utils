import {
	ERROR_CODES,
	getErrorCodeDefinition,
	type GlobalErrorCode,
	type GlobalErrorHttpStatusCode,
	type SharedErrorData,
	type SharedErrorResponse
} from "@bigfootds/bigfootds-shared-data";

/**
 * Options for constructing a standard service error.
 */
export interface ServiceErrorOptions {
	/**
	 * Safe message override. Defaults to the shared catalogue message.
	 */
	readonly message?: string;

	/**
	 * Safe structured context to include in the response payload.
	 */
	readonly safeDetails?: unknown;

	/**
	 * Request correlation ID to include in the response payload.
	 */
	readonly requestId?: string;

	/**
	 * HTTP status override for this response.
	 */
	readonly httpStatus?: GlobalErrorHttpStatusCode;

	/**
	 * Lower-level cause retained on the Error object but never serialised.
	 */
	readonly cause?: unknown;
}

/**
 * Options for serialising a standard service error.
 */
export interface SerializeServiceErrorOptions {
	/**
	 * Request correlation ID to include when the error did not already carry one.
	 */
	readonly requestId?: string;
}

/**
 * Status/body pair ready for an HTTP adapter.
 */
export interface SerializedServiceError {
	readonly httpStatus: GlobalErrorHttpStatusCode;
	readonly body: SharedErrorResponse;
}

/**
 * Error class backed by the shared global error catalogue.
 */
export class ServiceError extends Error {
	readonly code: GlobalErrorCode;
	readonly httpStatus: GlobalErrorHttpStatusCode;
	readonly requestId?: string;
	readonly safeDetails?: unknown;

	constructor(code: GlobalErrorCode, options: ServiceErrorOptions = {}) {
		const definition = getErrorCodeDefinition(code);
		const message = options.message ?? definition?.defaultMessage ?? "Something went wrong.";
		const errorOptions = options.cause === undefined ? undefined : { cause: options.cause };

		super(message, errorOptions);

		this.name = "ServiceError";
		this.code = code;
		this.httpStatus = options.httpStatus ?? definition?.defaultHttpStatus ?? 500;

		if (options.requestId !== undefined) {
			this.requestId = options.requestId;
		}

		if (options.safeDetails !== undefined) {
			this.safeDetails = options.safeDetails;
		}

		Object.setPrototypeOf(this, new.target.prototype);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}
}

/**
 * Creates a standard service error.
 */
export function createServiceError(
	code: GlobalErrorCode,
	options: ServiceErrorOptions = {}
): ServiceError {
	return new ServiceError(code, options);
}

/**
 * Checks whether a value is a standard service error.
 */
export function isServiceError(value: unknown): value is ServiceError {
	return value instanceof ServiceError;
}

/**
 * Serialises a standard service error without leaking stack traces or causes.
 */
export function serializeServiceError(
	error: ServiceError,
	options: SerializeServiceErrorOptions = {}
): SerializedServiceError {
	const errorData: SharedErrorData = {
		code: error.code,
		message: error.message
	};
	const requestId = error.requestId ?? options.requestId;

	if (requestId !== undefined) {
		Object.assign(errorData, { requestId });
	}

	if (error.safeDetails !== undefined) {
		Object.assign(errorData, { details: error.safeDetails });
	}

	return {
		httpStatus: error.httpStatus,
		body: {
			error: errorData
		}
	};
}

/**
 * Converts unknown thrown values into a standard service error.
 */
export function normalizeServiceError(
	error: unknown,
	options: ServiceErrorOptions = {}
): ServiceError {
	if (isServiceError(error)) {
		return error;
	}

	return createServiceError(ERROR_CODES.INTERNAL_ERROR, {
		...options,
		cause: options.cause ?? error
	});
}

/**
 * Builds a serialised response directly from a global error code.
 */
export function createErrorResponse(
	code: GlobalErrorCode,
	options: ServiceErrorOptions = {}
): SerializedServiceError {
	return serializeServiceError(createServiceError(code, options));
}
