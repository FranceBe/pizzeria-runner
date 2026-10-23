import { describe, it, expect } from "vitest";
import { makeState, play, serviceOf } from "../test/helpers";
import { MAX_SECONDS_BETWEEN_ARRIVALS, MIN_SECONDS_BETWEEN_ARRIVALS } from "./actions/serviceActions";
import { AVERAGE_ARRIVAL_SECONDS, EVENING_MINUTES, OPENING_MINUTES, eveningMinutes, expectedEveningSeconds, formatEveningTime } from "./clock";

describe("the evening's clock", () => {
  it("opens at 19:00 and brings a usual evening to 23:00", () => {
    const opened = play(makeState(), { type: "openRestaurant" });
    const service = serviceOf(opened);
    expect(formatEveningTime(eveningMinutes(service))).toBe("19:00");
    const expected = service.expectedSeconds ?? 0;
    expect(eveningMinutes({ ...service, elapsed: expected })).toBe(OPENING_MINUTES + EVENING_MINUTES);
    expect(eveningMinutes({ ...service, elapsed: expected / 2 })).toBe(21 * 60);
  });

  it("goes past 23:00 on an evening that drags on, and past midnight", () => {
    expect(formatEveningTime(23 * 60 + 47)).toBe("23:45");
    expect(formatEveningTime(24 * 60 + 32)).toBe("0:30");
  });

  it("only moves on with the service's own time (a pause stops it)", () => {
    const opened = play(makeState(), { type: "openRestaurant" }, { type: "tick", seconds: 10 });
    const paused = play(opened, { type: "togglePause" }, { type: "tick", seconds: 30 });
    expect(eveningMinutes(serviceOf(paused))).toBe(eveningMinutes(serviceOf(opened)));
  });

  it("counts customers coming as often as they do", () => {
    expect(AVERAGE_ARRIVAL_SECONDS).toBe((MIN_SECONDS_BETWEEN_ARRIVALS + MAX_SECONDS_BETWEEN_ARRIVALS) / 2);
    expect(expectedEveningSeconds(10)).toBeGreaterThan(expectedEveningSeconds(5));
  });
});
