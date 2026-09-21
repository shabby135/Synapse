import {
  createHash,
} from "node:crypto";

export const TRIGGER_LEASE_MS =
  55_000;

export function stableConfigurationHash(
  configuration: Record<
    string,
    unknown
  >
): string {
  const stable =
    Object.fromEntries(
      Object.entries(
        configuration
      ).sort(
        ([left], [right]) =>
          left.localeCompare(right)
      )
    );

  return createHash("sha256")
    .update(
      JSON.stringify(stable),
      "utf8"
    )
    .digest("hex");
}

export function createPayloadHash(
  input: Record<string, unknown>
): string {
  return createHash("sha256")
    .update(
      JSON.stringify(input),
      "utf8"
    )
    .digest("hex");
}

export function nextPollDate(
  minutes: number,
  from = new Date()
): Date {
  const safeMinutes = Math.min(
    60,
    Math.max(
      1,
      Math.trunc(minutes)
    )
  );

  return new Date(
    from.getTime() +
      safeMinutes * 60_000
  );
}

export function failureRetryDate(
  failures: number,
  from = new Date()
): Date {
  const delayMinutes = Math.min(
    60,
    2 **
      Math.min(
        6,
        Math.max(
          0,
          failures - 1
        )
      )
  );

  return new Date(
    from.getTime() +
      delayMinutes * 60_000
  );
}