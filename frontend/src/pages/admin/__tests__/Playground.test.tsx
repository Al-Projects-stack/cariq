import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AdminPlayground } from "../Playground";

vi.mock("../../../api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../../api")>();
  return { ...mod, adminTestQuery: vi.fn() };
});

import { adminTestQuery } from "../../../api";

const mockedTest = vi.mocked(adminTestQuery);

describe("AdminPlayground", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs a test question and shows answer, score, and chunks", async () => {
    const user = userEvent.setup();
    mockedTest.mockResolvedValue({
      answer: "Test answer.",
      price_intelligence: null,
      known_faults: [],
      sources: ["X"],
      rewritten_question: null,
      refused: false,
      top_score: 0.82,
      latency_ms: 1500,
      chunks: [
        { id: "bmw_3_series_fault_0", score: 0.82, chunk_type: "fault", make: "BMW", model: "3 Series", text: "chunk text" },
      ],
    });
    render(
      <MemoryRouter>
        <AdminPlayground />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/test question/i), "bmw faults?");
    await user.click(screen.getByRole("button", { name: /^test$/i }));

    await waitFor(() => expect(mockedTest).toHaveBeenCalledWith("bmw faults?"));
    expect(await screen.findByText("Test answer.")).toBeInTheDocument();
    expect(screen.getByText(/top score 0.820/i)).toBeInTheDocument();
    expect(screen.getByText(/bmw_3_series_fault_0/)).toBeInTheDocument();
  });

  it("shows the refusal badge when the model refuses", async () => {
    const user = userEvent.setup();
    mockedTest.mockResolvedValue({
      answer: "I don't have enough data.",
      price_intelligence: null,
      known_faults: [],
      sources: [],
      rewritten_question: null,
      refused: true,
      top_score: 0.1,
      latency_ms: 900,
      chunks: [],
    });
    render(
      <MemoryRouter>
        <AdminPlayground />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/test question/i), "spaceship faults?");
    await user.click(screen.getByRole("button", { name: /^test$/i }));

    expect(await screen.findByText(/refused \(out of kb\)/i)).toBeInTheDocument();
  });
});
