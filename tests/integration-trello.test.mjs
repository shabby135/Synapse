import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyTrelloStatus,
  createTrelloConnectionRequest,
  parseTrelloMember,
  TrelloConnectionError,
} from "../src/features/integration/trello-connection.ts";

test("builds a header-authenticated Trello member request", () => {
  const request =
    createTrelloConnectionRequest({
      apiKey:
        "1234567890abcdef1234567890abcdef",
      apiToken:
        "abcdef1234567890abcdef1234567890",
    });
  const url = new URL(request.url);
  const headers = new Headers(
    request.init.headers
  );

  assert.equal(
    url.origin,
    "https://api.trello.com"
  );
  assert.equal(
    url.pathname,
    "/1/members/me"
  );
  assert.equal(url.searchParams.has("key"), false);
  assert.equal(
    url.searchParams.has("token"),
    false
  );
  assert.equal(
    headers.get("Authorization"),
    'OAuth oauth_consumer_key="1234567890abcdef1234567890abcdef", oauth_token="abcdef1234567890abcdef1234567890"'
  );
});

test("parses a safe Trello account profile", () => {
  assert.deepEqual(
    parseTrelloMember(
      JSON.stringify({
        id: "member-123",
        username: "shubham",
        fullName: "Shubham Shaw",
        email: "must-not-be-retained@example.com",
      })
    ),
    {
      id: "member-123",
      username: "shubham",
      fullName: "Shubham Shaw",
    }
  );
});

test("rejects malformed Trello member responses", () => {
  assert.throws(
    () => parseTrelloMember("not-json"),
    TrelloConnectionError
  );
  assert.throws(
    () =>
      parseTrelloMember(
        JSON.stringify({ id: "member-123" })
      ),
    TrelloConnectionError
  );
});

test("classifies rejected and unavailable Trello responses", () => {
  assert.equal(
    classifyTrelloStatus(401).status,
    "INVALID_CREDENTIALS"
  );
  assert.equal(
    classifyTrelloStatus(403).status,
    "INVALID_CREDENTIALS"
  );
  assert.equal(
    classifyTrelloStatus(429).status,
    "PROVIDER_UNAVAILABLE"
  );
  assert.equal(
    classifyTrelloStatus(500).status,
    "PROVIDER_UNAVAILABLE"
  );
});
