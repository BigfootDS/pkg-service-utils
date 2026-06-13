const assert = require("node:assert/strict");
const { describe, test } = require("node:test");
const {
	BIGFOOTDS_MORGAN_FORMAT,
	createBigfootDSMorganLogger,
	getMorganRequestIdToken,
	shouldLogRequests
} = require("@bigfootds/bigfootds-service-utils");

describe("Morgan logging helpers", () => {
	test("provides a single-line BigfootDS Morgan format", () => {
		assert.equal(BIGFOOTDS_MORGAN_FORMAT.includes("\n"), false);
		assert.match(BIGFOOTDS_MORGAN_FORMAT, /Method :method/);
		assert.match(BIGFOOTDS_MORGAN_FORMAT, /URL :url/);
		assert.match(BIGFOOTDS_MORGAN_FORMAT, /Status :status/);
		assert.match(BIGFOOTDS_MORGAN_FORMAT, /ResponseTime :response-time ms/);
		assert.match(BIGFOOTDS_MORGAN_FORMAT, /UserAgent :user-agent/);
	});

	test("disables request logging in test environments by default", () => {
		assert.equal(shouldLogRequests("test"), false);
		assert.equal(shouldLogRequests("development"), true);
		assert.equal(shouldLogRequests("production"), true);
	});

	test("returns a no-op middleware when disabled", () => {
		const logger = createBigfootDSMorganLogger({ enabled: false });
		let nextCalled = false;

		logger({}, {}, () => {
			nextCalled = true;
		});

		assert.equal(nextCalled, true);
	});

	test("resolves request IDs from BigfootDS context before headers", () => {
		assert.equal(
			getMorganRequestIdToken({
				bigfootds: { requestId: "req_context" },
				headers: { "x-request-id": "req_header" }
			}),
			"req_context"
		);
		assert.equal(
			getMorganRequestIdToken({
				headers: { "x-request-id": "req_header" }
			}),
			"req_header"
		);
		assert.equal(getMorganRequestIdToken({}), "-");
	});
});
