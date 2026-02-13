import { expect, test } from "@playwright/test";

const API = "https://music-api.gdstudio.xyz/api.php";

test("music api search returns list-like payload", async ({ request }) => {
  const response = await request.get(API, {
    params: {
      types: "search",
      source: "netease",
      name: "春节",
      count: 3,
      pages: 1
    }
  });

  expect(response.ok()).toBeTruthy();

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }

  const isArray = Array.isArray(payload);
  const hasList = !!payload && typeof payload === "object" && (
    Array.isArray((payload as { data?: unknown[] }).data) ||
    Array.isArray((payload as { result?: unknown[] }).result) ||
    Array.isArray((payload as { list?: unknown[] }).list)
  );

  expect(isArray || hasList).toBeTruthy();
});

