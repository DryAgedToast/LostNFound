/**
 * Unit tests for src/components/ClaimStatusBadge.tsx
 */

import { render } from "@testing-library/react-native";
import React from "react";
import ClaimStatusBadge from "../../components/ClaimStatusBadge";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ClaimStatusBadge", () => {
  it("renders 'Pending' text for status 'pending'", () => {
    const { getByText } = render(<ClaimStatusBadge status="pending" />);
    expect(getByText("Pending")).toBeTruthy();
  });

  it("applies background color #EAB308 for status 'pending'", () => {
    const { getByText } = render(<ClaimStatusBadge status="pending" />);
    const badge = getByText("Pending").parent;
    // The badge View has a style with backgroundColor
    const flatStyle = badge?.props?.style;
    const styles = Array.isArray(flatStyle) ? flatStyle : [flatStyle];
    const bgColor = styles.find(
      (s: Record<string, unknown>) => s && s.backgroundColor,
    )?.backgroundColor;
    expect(bgColor).toBe("#EAB308");
  });

  it("renders 'Approved' text for status 'approved'", () => {
    const { getByText } = render(<ClaimStatusBadge status="approved" />);
    expect(getByText("Approved")).toBeTruthy();
  });

  it("applies background color #10B981 for status 'approved'", () => {
    const { getByText } = render(<ClaimStatusBadge status="approved" />);
    const badge = getByText("Approved").parent;
    const flatStyle = badge?.props?.style;
    const styles = Array.isArray(flatStyle) ? flatStyle : [flatStyle];
    const bgColor = styles.find(
      (s: Record<string, unknown>) => s && s.backgroundColor,
    )?.backgroundColor;
    expect(bgColor).toBe("#10B981");
  });

  it("renders 'Rejected' text for status 'rejected'", () => {
    const { getByText } = render(<ClaimStatusBadge status="rejected" />);
    expect(getByText("Rejected")).toBeTruthy();
  });

  it("applies background color #EF4444 for status 'rejected'", () => {
    const { getByText } = render(<ClaimStatusBadge status="rejected" />);
    const badge = getByText("Rejected").parent;
    const flatStyle = badge?.props?.style;
    const styles = Array.isArray(flatStyle) ? flatStyle : [flatStyle];
    const bgColor = styles.find(
      (s: Record<string, unknown>) => s && s.backgroundColor,
    )?.backgroundColor;
    expect(bgColor).toBe("#EF4444");
  });

  it("renders 'In-Person Required' text for status 'awaiting_in_person'", () => {
    const { getByText } = render(
      <ClaimStatusBadge status="awaiting_in_person" />,
    );
    expect(getByText("In-Person Required")).toBeTruthy();
  });

  it("applies background color #F59E0B for status 'awaiting_in_person'", () => {
    const { getByText } = render(
      <ClaimStatusBadge status="awaiting_in_person" />,
    );
    const badge = getByText("In-Person Required").parent;
    const flatStyle = badge?.props?.style;
    const styles = Array.isArray(flatStyle) ? flatStyle : [flatStyle];
    const bgColor = styles.find(
      (s: Record<string, unknown>) => s && s.backgroundColor,
    )?.backgroundColor;
    expect(bgColor).toBe("#F59E0B");
  });
});
