const assert = require("node:assert/strict");
const { describe, test } = require("node:test");
const {
	ERROR_CODES
} = require("@bigfootds/bigfootds-shared-data");
const {
	createServiceError,
	requestIdMiddleware,
	serviceTokenMiddleware,
	standardErrorHandler
} = require("@bigfootds/bigfootds-service-utils");

function createResponse() {
	return {
		headers: {},
		body: undefined,
		statusCode: undefined,
		setHeader(name, value) {
			this.headers[name] = value;
		},
		status(statusCode) {
			this.statusCode = statusCode;
			return this;
		},
		json(body) {
			this.body = body;
			return this;
		}
	};
}

describe("Express adapters", () => {
	test("requestIdMiddleware attaches context and returns the request ID header", () => {
		const request = {
			headers: {
				"x-request-id": "req_123456"
			}
		};
		const response = createResponse();
		let nextCalled = false;

		requestIdMiddleware({ nowMs: 123 })(request, response, () => {
			nextCalled = true;
		});

		assert.equal(nextCalled, true);
		assert.equal(request.bigfootds.requestId, "req_123456");
		assert.equal(request.bigfootds.startedAtMs, 123);
		assert.equal(response.headers["x-request-id"], "req_123456");
	});

	test("serviceTokenMiddleware attaches an authenticated service caller", () => {
		const request = {
			headers: {
				authorization: "Bearer auth-token",
				productname: "@bigfootds/ms-auth"
			},
			bigfootds: {
				requestId: "req_123456",
				generated: false,
				inboundRequestId: "req_123456",
				startedAtMs: 123
			}
		};
		const response = createResponse();
		let nextCalled = false;

		serviceTokenMiddleware({
			acceptedCallers: [{ serviceId: "ms-auth", token: "auth-token" }],
			allowedServiceIds: ["ms-auth"]
		})(request, response, () => {
			nextCalled = true;
		});

		assert.equal(nextCalled, true);
		assert.deepEqual(request.bigfootds.serviceCaller, {
			serviceId: "ms-auth",
			declaredServiceId: "@bigfootds/ms-auth"
		});
	});

	test("serviceTokenMiddleware returns standard JSON errors for rejected callers", () => {
		const request = {
			headers: {
				authorization: "Bearer wrong-token",
				productname: "ms-auth"
			},
			bigfootds: {
				requestId: "req_123456",
				generated: false,
				inboundRequestId: "req_123456",
				startedAtMs: 123
			}
		};
		const response = createResponse();

		serviceTokenMiddleware({
			acceptedCallers: [{ serviceId: "ms-auth", token: "auth-token" }]
		})(request, response, () => {
			throw new Error("next should not be called");
		});

		assert.equal(response.statusCode, 401);
		assert.deepEqual(response.body, {
			error: {
				code: "service_token_invalid",
				message: "The service token is invalid.",
				requestId: "req_123456"
			}
		});
	});

	test("standardErrorHandler serializes service errors", () => {
		const request = {
			bigfootds: {
				requestId: "req_123456",
				generated: false,
				inboundRequestId: "req_123456",
				startedAtMs: 123
			}
		};
		const response = createResponse();

		standardErrorHandler()(
			createServiceError(ERROR_CODES.NOT_FOUND, { message: "Missing thing." }),
			request,
			response,
			() => {
				throw new Error("next should not be called");
			}
		);

		assert.equal(response.statusCode, 404);
		assert.deepEqual(response.body, {
			error: {
				code: "not_found",
				message: "Missing thing.",
				requestId: "req_123456"
			}
		});
	});

	test("standardErrorHandler delegates when headers were already sent", () => {
		const request = {};
		const response = {
			headersSent: true
		};
		const error = new Error("already sent");
		let delegatedError;

		standardErrorHandler()(error, request, response, (nextError) => {
			delegatedError = nextError;
		});

		assert.equal(delegatedError, error);
	});
});
