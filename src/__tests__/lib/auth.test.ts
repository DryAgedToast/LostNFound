jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn().mockReturnValue({
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
      getSession: jest.fn(),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}));

import {
  devBypassLogin,
  getCurrentProfile,
  getSession,
  signOut,
} from "../../lib/auth";

describe("auth DEV_MODE behavior", () => {
  it("returns mock user on devBypassLogin/getCurrentProfile", async () => {
    const result = await devBypassLogin();
    const profile = await getCurrentProfile();

    expect(result.profile.email).toBe("test@example.com");
    expect(result.role).toBe("student");
    expect(profile?.display_name).toBe("Test User");
  });

  it("signOut clears local DEV_MODE session", async () => {
    await devBypassLogin();
    expect(await getSession()).not.toBeNull();

    await signOut();

    expect(await getSession()).toBeNull();
    expect(await getCurrentProfile()).toBeNull();
  });
});
