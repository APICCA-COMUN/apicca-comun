// RF-10 (004) · 10.1–10.4; RF-11 (004) · 11.1–11.2; RF-8 (004) · 8.1, 8.3; RF-17 (004) · 17.1: acciones sobre una propuesta abierta (§4.3).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../data/api";
import { expectOnePrimary } from "../testing/expectActions";
import { expectBlocks } from "../testing/expectBlocks";
import { StanceBar } from "./StanceBar";

describe("StanceBar", () => {
  it("RF-11 (004) · 11.1: quien no abrió y no acordó ve «Acordar» como única acción azul", async () => {
    const onAgree = vi.fn();
    const { container } = render(
      <StanceBar isAuthor={false} hasAgreed={false} onAgree={onAgree} />,
    );
    expectOnePrimary(container, "Acordar");
    expectBlocks(container);
    expect(
      screen.queryByRole("button", { name: "Revocar acuerdo" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Objetar" }).className).toContain(
      "action-destructive",
    );
    await userEvent.click(screen.getByRole("button", { name: "Acordar" }));
    expect(onAgree).toHaveBeenCalledTimes(1);
  });

  it("RF-11 (004) · 11.1: quien ya acordó no ve botón azul y puede «Revocar acuerdo» (secundaria)", async () => {
    const onRevoke = vi.fn();
    const { container } = render(
      <StanceBar isAuthor={false} hasAgreed onRevoke={onRevoke} />,
    );
    expectOnePrimary(container, null);
    const revoke = screen.getByRole("button", { name: "Revocar acuerdo" });
    expect(revoke.className).toContain("action-secondary");
    expect(screen.queryByRole("button", { name: "Acordar" })).toBeNull();
    await userEvent.click(revoke);
    expect(onRevoke).toHaveBeenCalledTimes(1);
  });

  it("RF-11 (004) · 11.2: con una objeción abierta propia no ofrece «Acordar» y explica por qué", () => {
    const { container } = render(
      <StanceBar isAuthor={false} hasAgreed={false} hasOpenObjection />,
    );
    expectOnePrimary(container, null);
    expect(screen.queryByRole("button", { name: "Acordar" })).toBeNull();
    expect(screen.getByText(/objeción abierta/i)).toBeTruthy();
  });

  it("RF-10 (004) · 10.1: «Objetar» pide un motivo y envía la objeción sin añadir botón azul", async () => {
    const onObject = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <StanceBar isAuthor={false} hasAgreed={false} onObject={onObject} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Objetar" }));
    expectOnePrimary(container, "Acordar");
    await userEvent.type(
      screen.getByLabelText("Motivo de la objeción"),
      "Excluye a quienes no tienen red",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Enviar objeción" }),
    );
    expect(onObject).toHaveBeenCalledWith("Excluye a quienes no tienen red");
  });

  it("RF-10 (004) · 10.1: no envía una objeción sin motivo ni con solo espacios", async () => {
    const onObject = vi.fn();
    render(
      <StanceBar isAuthor={false} hasAgreed={false} onObject={onObject} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Objetar" }));
    await userEvent.type(screen.getByLabelText("Motivo de la objeción"), "   ");
    await userEvent.click(
      screen.getByRole("button", { name: "Enviar objeción" }),
    );
    expect(onObject).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/vacío/i);
  });

  it("RF-10 (004) · 10.3: quien tiene un acuerdo vigente recibe el aviso de revocarlo antes de objetar", async () => {
    const onObject = vi
      .fn()
      .mockRejectedValue(new ApiClientError("object-with-agreement"));
    render(<StanceBar isAuthor={false} hasAgreed onObject={onObject} />);
    await userEvent.click(screen.getByRole("button", { name: "Objetar" }));
    await userEvent.type(
      screen.getByLabelText("Motivo de la objeción"),
      "Tengo dudas",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Enviar objeción" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "revócalo antes de objetar",
    );
  });

  it("RF-17 (004) · 17.1: si la objeción falla muestra el motivo en español y conserva lo escrito", async () => {
    const onObject = vi
      .fn()
      .mockRejectedValue(new ApiClientError("amendment-closed"));
    render(
      <StanceBar isAuthor={false} hasAgreed={false} onObject={onObject} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Objetar" }));
    await userEvent.type(
      screen.getByLabelText("Motivo de la objeción"),
      "Mi motivo largo",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Enviar objeción" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "La propuesta ya cerró",
    );
    expect(
      (screen.getByLabelText("Motivo de la objeción") as HTMLTextAreaElement)
        .value,
    ).toBe("Mi motivo largo");
  });

  it("RF-17 (004) · 17.1: un motivo que excede el máximo dice cuántos caracteres sobran y no se envía", async () => {
    const onObject = vi.fn();
    render(
      <StanceBar isAuthor={false} hasAgreed={false} onObject={onObject} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Objetar" }));
    const area = screen.getByLabelText("Motivo de la objeción");
    await userEvent.click(area);
    await userEvent.paste("a".repeat(2003));
    expect(screen.getByText(/sobran 3 caracteres/)).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Enviar objeción" }),
    );
    expect(onObject).not.toHaveBeenCalled();
  });

  it("RF-8 (004) · 8.1: quien abrió ve «Revisar» secundaria y ninguna acción azul", async () => {
    const onRevise = vi.fn();
    const { container } = render(
      <StanceBar isAuthor hasAgreed={false} onRevise={onRevise} />,
    );
    expectOnePrimary(container, null);
    expectBlocks(container);
    const revise = screen.getByRole("button", { name: "Revisar" });
    expect(revise.className).toContain("action-secondary");
    expect(screen.queryByRole("button", { name: "Acordar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Objetar" })).toBeNull();
    await userEvent.click(revise);
    expect(onRevise).toHaveBeenCalledTimes(1);
  });

  it("RF-8 (004) · 8.3: «Retirar» es destructiva y pide confirmación antes de llamar", async () => {
    const onWithdraw = vi.fn();
    const { container } = render(
      <StanceBar isAuthor hasAgreed={false} onWithdraw={onWithdraw} />,
    );
    const withdraw = screen.getByRole("button", { name: "Retirar" });
    expect(withdraw.className).toContain("action-destructive");
    await userEvent.click(withdraw);
    expect(onWithdraw).not.toHaveBeenCalled();
    expectOnePrimary(container, null);
    await userEvent.click(
      screen.getByRole("button", { name: "Confirmar retiro" }),
    );
    expect(onWithdraw).toHaveBeenCalledTimes(1);
  });

  it("RF-8 (004) · 8.3: «Cancelar» deshace la confirmación del retiro", async () => {
    const onWithdraw = vi.fn();
    render(<StanceBar isAuthor hasAgreed={false} onWithdraw={onWithdraw} />);
    await userEvent.click(screen.getByRole("button", { name: "Retirar" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Retirar" })).toBeTruthy();
    expect(onWithdraw).not.toHaveBeenCalled();
  });

  it("RF-10 (004) · 10.4: con «Revisar» y «Retirar» ocultos (autora suspendida) no queda ninguna acción", () => {
    const { container } = render(
      <StanceBar isAuthor authorSuspended hasAgreed={false} />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expectOnePrimary(container, null);
  });
});
