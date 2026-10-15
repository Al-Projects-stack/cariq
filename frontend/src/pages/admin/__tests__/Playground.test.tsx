import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AdminPlayground } from "../Playground";

vi.mock("../../../api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../../api")>();
  return { ...mod, adminTestQuery: vi.fn() };
});

import { adminTestQuery } from "../../../api";

const mockedTest = vi.mocked(adminTestQuery);

function baseResult(over: Record<string, unknown> = {}) {
  return {
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
    ...over,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminPlayground />
    </MemoryRouter>
  );
}

async function ask(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByLabelText(/test question/i), text);
  await user.click(screen.getByRole("button", { name: /^send$/i }));
}

describe("AdminPlayground chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedTest.mockResolvedValue(baseResult());
  });

  it("runs a test question and shows answer, score, and chunks", async () => {
    const user = userEvent.setup();
    renderPage();

    await ask(user, "bmw faults?");

    await waitFor(() => expect(mockedTest).toHaveBeenCalledWith("bmw faults?", []));
    expect(await screen.findByText("Test answer.")).toBeInTheDocument();
    expect(screen.getByText(/top score 0.820/i)).toBeInTheDocument();
    expect(screen.getByText(/bmw_3_series_fault_0/)).toBeInTheDocument();
  });

  it("sends thread history on follow-ups", async () => {
    const user = userEvent.setup();
    renderPage();

    await ask(user, "bmw faults?");
    await screen.findByText("Test answer.");
    await ask(user, "what about diesel?");

    await waitFor(() => expect(mockedTest).toHaveBeenCalledTimes(2));
    const [, history] = mockedTest.mock.calls[1];
    expect(history).toEqual([
      { role: "user", content: "bmw faults?" },
      { role: "assistant", content: "Test answer." },
    ]);
  });

  it("offers suggestion chips on an empty thread", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText(/known faults on a polo vivo/i));

    await waitFor(() =>
      expect(mockedTest).toHaveBeenCalledWith("What are the known faults on a Polo Vivo?", [])
    );
  });

  it("shows the refusal badge when the model refuses", async () => {
    const user = userEvent.setup();
    mockedTest.mockResolvedValue(baseResult({
      answer: "I don't have enough data.",
      refused: true,
      top_score: 0.1,
      chunks: [],
    }));
    renderPage();

    await ask(user, "spaceship faults?");

    expect(await screen.findByText(/refused \(out of kb\)/i)).toBeInTheDocument();
  });

  it("starts a fresh thread with New test chat", async () => {
    const user = userEvent.setup();
    renderPage();

    await ask(user, "bmw faults?");
    await screen.findByText("Test answer.");
    await user.click(screen.getByRole("button", { name: /new test chat/i }));

    expect(screen.queryByText("bmw faults?")).not.toBeInTheDocument();
    const thread = screen.getByRole("log", { hidden: true });
    expect(within(thread).queryByText("Test answer.")).not.toBeInTheDocument();
  });
});
