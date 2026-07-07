/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../lib/api";
import { SearchBox } from "./SearchBox";

vi.mock("../lib/api", () => ({
  api: {
    search: vi.fn()
  }
}));

const mockedSearch = vi.mocked(api.search);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("SearchBox", () => {
  afterEach(() => {
    cleanup();
    mockedSearch.mockReset();
  });

  test("does not let an older search response replace newer results", async () => {
    const user = userEvent.setup();
    const first = deferred<Awaited<ReturnType<typeof api.search>>>();
    const second = deferred<Awaited<ReturnType<typeof api.search>>>();

    mockedSearch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    render(<SearchBox onOpenPath={vi.fn()} />);

    await user.type(screen.getByRole("searchbox"), "dock");
    await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(1));
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "git");
    await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(2));

    second.resolve([{ title: "Git", path: "学习记录/git", type: "directory" }]);
    await waitFor(() => expect(screen.getByText("Git")).not.toBeNull());

    await act(async () => {
      first.resolve([{ title: "Docker", path: "学习记录/docker", type: "directory" }]);
      await first.promise;
    });

    expect(screen.queryByText("Docker")).toBeNull();
    expect(screen.getByText("Git")).not.toBeNull();
  });

  test("clearing the query invalidates an in-flight search response", async () => {
    const user = userEvent.setup();
    const first = deferred<Awaited<ReturnType<typeof api.search>>>();
    mockedSearch.mockReturnValueOnce(first.promise);

    render(<SearchBox onOpenPath={vi.fn()} />);

    await user.type(screen.getByRole("searchbox"), "dock");
    await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(1));
    await user.clear(screen.getByRole("searchbox"));

    await act(async () => {
      first.resolve([{ title: "Docker", path: "学习记录/docker", type: "directory" }]);
      await first.promise;
    });

    expect(screen.queryByText("没有找到匹配结果")).toBeNull();
    expect(screen.queryByText("Docker")).toBeNull();
  });
});
