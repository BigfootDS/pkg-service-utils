const assert = require("node:assert/strict");
const { describe, test } = require("node:test");
const {
	ERROR_CODES
} = require("@bigfootds/bigfootds-shared-data");
const {
	ServiceError,
	createErrorResponse,
	createServiceError,
	normalizeServiceError,
	serializeServiceError
} = require("@bigfootds/bigfootds-service-utils");

describe("standard service error helpers", () => {
	test("create errors from the shared global error catalogue", () => {
		const error = createServiceError(ERROR_CODES.RATE_LIMITED, {
			requestId: "req_123456"
		});

		assert.ok(error instanceof ServiceError);
		assert.equal(error.code, "rate_limited");
		assert.equal(error.httpStatus, 429);
		assert.equal(error.message, "Too many requests. Try again later.");
	});

	test("serialize standard service errors without stack or cause leakage", () => {
		const cause = new Error("database password leaked here would be bad");
		const error = createServiceError(ERROR_CODES.VALIDATION_FAILED, {
			cause,
			message: "Invalid request.",
			requestId: "req_123456",
			safeDetails: { field: "displayName" }
		});
		const serialized = serializeServiceError(error);

		assert.deepEqual(serialized, {
			httpStatus: 400,
			body: {
				error: {
					code: "validation_failed",
					message: "Invalid request.",
					requestId: "req_123456",
					details: { field: "displayName" }
				}
			}
		});
		assert.equal("stack" in serialized.body.error, false);
		assert.equal("cause" in serialized.body.error, false);
	});

	test("normalizes unknown errors into internal_error responses", () => {
		const error = normalizeServiceError(new Error("private implementation detail"), {
			requestId: "req_123456"
		});
		const serialized = serializeServiceError(error);

		assert.equal(serialized.httpStatus, 500);
		assert.deepEqual(serialized.body, {
			error: {
				code: "internal_error",
				message: "Something went wrong.",
				requestId: "req_123456"
			}
		});
	});

	test("creates a serialised response directly from a global error code", () => {
		assert.deepEqual(createErrorResponse(ERROR_CODES.AUTH_USER_BANNED), {
			httpStatus: 403,
			body: {
				error: {
					code: "auth_user_banned",
					message: "This account cannot be used."
				}
			}
		});
	});
});
