jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn().mockReturnValue({
    channel: jest.fn(() => {
      throw new Error("offline");
    }),
    removeChannel: jest.fn(() => {
      throw new Error("offline");
    }),
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
    auth: { getUser: jest.fn() },
  }),
}));

import {
  subscribeToMessages,
  unsubscribeAll,
  unsubscribeFromClaim,
} from "../../lib/realtime";

describe("realtime offline safety", () => {
  it("subscribe does not throw without Supabase realtime", () => {
    expect(() => subscribeToMessages("claim-1", jest.fn())).not.toThrow();
  });

  it("unsubscribe does not throw without Supabase realtime", () => {
    expect(() => unsubscribeFromClaim("claim-1")).not.toThrow();
    expect(() => unsubscribeAll()).not.toThrow();
  });
});
