import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AdminProvider } from "../../../contexts/AdminContext";
import { AdminLogin } from "../Login";

vi.mock("../../../api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../../api")>();
  return {
    ...mod,
    adminMe: vi.fn(),
    adminLogin: vi.fn(),
  };
});

import { adminMe, adminLogin } from "../../../api";

const mockedMe = vi.mocked(adminMe);
const mockedLogin = vi.mocked(adminLogin);

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/admin/login"]}>
      <AdminProvider>
        <AdminLogin />
      </AdminProvider>
    </MemoryRouter>
  );
}

describe("AdminLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedMe.mockRejectedValue(new Error("Not authenticated"));
  });

  it("renders email and password fields", async () => {
    renderLogin();
    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("calls adminLogin on submit and shows server errors", async () => {
    const user = userEvent.setup();
    mockedLogin.mockRejectedValue(new Error("Invalid email or password"));
    renderLogin();

    await user.type(await screen.findByLabelText(/email/i), "admin@x.co");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(mockedLogin).toHaveBeenCalledWith("admin@x.co", "wrong"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
  });

  it("redirects to /admin on successful login", async () => {
    const user = userEvent.setup();
    mockedLogin.mockResolvedValue({ email: "admin@x.co", role: "admin", csrf_token: "abc" });
    renderLogin();

    await user.type(await screen.findByLabelText(/email/i), "admin@x.co");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(mockedLogin).toHaveBeenCalled());
    // Logged in: the login form unmounts (Navigate to /admin outside test routes).
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /sign in/i })).not.toBeInTheDocument()
    );
  });
});
