jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: "x" }, error: null }),
    }),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: "https://example.com/a.jpg" },
        }),
      }),
    },
    auth: { getUser: jest.fn() },
  }),
}));

jest.mock("expo-crypto", () => ({
  digestStringAsync: jest.fn().mockResolvedValue("hash"),
  CryptoDigestAlgorithm: { SHA256: "SHA256" },
}));

import { scanId } from "../../lib/idanalyzer";

describe("idanalyzer graceful failures", () => {
  const originalKey = process.env.EXPO_PUBLIC_IDANALYZER_KEY;

  afterEach(() => {
    process.env.EXPO_PUBLIC_IDANALYZER_KEY = originalKey;
    jest.resetAllMocks();
  });

  it("returns graceful error when API key is missing", async () => {
    delete process.env.EXPO_PUBLIC_IDANALYZER_KEY;

    const result = await scanId("file://front.jpg", "file://back.jpg");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("ID verification not configured");
    }
  });

  it("returns graceful error on network failure", async () => {
    process.env.EXPO_PUBLIC_IDANALYZER_KEY = "test-key";
    (global as unknown as { fetch: jest.Mock }).fetch = jest
      .fn()
      .mockRejectedValue(new Error("network down"));

    const result = await scanId("file://front.jpg", "file://back.jpg");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Unable to verify ID");
    }
  });
});
