// RF-6 (004) · 6.1–6.2, 6.5; RF-8 (004) · 8.1; RF-16 (004) · 16.2, 16.4; RF-17 (004) · 17.1: formulario de abrir y revisar propuestas.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../data/api";
import { expectOnePrimary } from "../testing/expectActions";
import { expectBlocks } from "../testing/expectBlocks";
import { AmendmentForm, type AmendmentFormValues } from "./AmendmentForm";

const sections = [
  { id: "s1", title: "Preámbulo" },
  { id: "s2", title: "Cuidados" },
];

describe("AmendmentForm", () => {
  it("RF-6 (004) · 6.1: al abrir muestra tipo, sección, título, texto y motivo con «Enviar propuesta» como única acción azul", () => {
    const { container } = render(
      <AmendmentForm mode="open" sections={sections} onSubmit={vi.fn()} />,
    );
    expectOnePrimary(container, "Enviar propuesta");
    expectBlocks(container);
    expect(screen.getByLabelText("Tipo de cambio")).toBeTruthy();
    expect(screen.getByLabelText("Sección")).toBeTruthy();
    expect(screen.getByLabelText("Título")).toBeTruthy();
    expect(screen.getByLabelText("Texto")).toBeTruthy();
    expect(screen.getByLabelText("Motivo")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Cancelar" }).className,
    ).toContain("action-secondary");
  });

  it("RF-6 (004) · 6.1: al abrir desde una sección llega con el tipo y el lugar ya elegidos", () => {
    const { unmount } = render(
      <AmendmentForm mode="open" sections={sections} kind="remove" sectionId="s2" onSubmit={vi.fn()} />,
    );
    expect((screen.getByLabelText("Tipo de cambio") as HTMLSelectElement).value).toBe("remove");
    expect((screen.getByLabelText("Sección") as HTMLSelectElement).value).toBe("s2");
    unmount();
    render(<AmendmentForm mode="open" sections={sections} kind="add" after="s1" onSubmit={vi.fn()} />);
    expect((screen.getByLabelText("Tipo de cambio") as HTMLSelectElement).value).toBe("add");
    expect((screen.getByLabelText("Lugar") as HTMLSelectElement).value).toBe("s1");
  });

  it("RF-6 (004) · 6.2: «añadir» pide el lugar («al principio» o «después de» una sección) en vez de una sección", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, id: "a1" });
    render(
      <AmendmentForm mode="open" sections={sections} onSubmit={onSubmit} />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Tipo de cambio"),
      "add",
    );
    expect(screen.queryByLabelText("Sección")).toBeNull();
    const place = screen.getByLabelText("Lugar");
    await userEvent.selectOptions(place, "s2");
    await userEvent.type(screen.getByLabelText("Título"), "Nueva");
    await userEvent.type(screen.getByLabelText("Texto"), "Texto nuevo");
    await userEvent.type(screen.getByLabelText("Motivo"), "Porque sí");
    await userEvent.click(
      screen.getByRole("button", { name: "Enviar propuesta" }),
    );
    expect(onSubmit).toHaveBeenCalledWith({
      kind: "add",
      after: "s2",
      title: "Nueva",
      text: "Texto nuevo",
      motive: "Porque sí",
    } satisfies AmendmentFormValues);
  });

  it("RF-6 (004) · 6.2: «al principio» envía after nulo", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, id: "a1" });
    render(
      <AmendmentForm mode="open" sections={sections} onSubmit={onSubmit} />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Tipo de cambio"),
      "add",
    );
    await userEvent.type(screen.getByLabelText("Título"), "T");
    await userEvent.type(screen.getByLabelText("Texto"), "X");
    await userEvent.type(screen.getByLabelText("Motivo"), "M");
    await userEvent.click(
      screen.getByRole("button", { name: "Enviar propuesta" }),
    );
    expect(onSubmit.mock.calls[0]![0].after).toBeNull();
  });

  it("RF-6 (004) · 6.1: «quitar» no pide título ni texto, solo sección y motivo", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, id: "a1" });
    render(
      <AmendmentForm mode="open" sections={sections} onSubmit={onSubmit} />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Tipo de cambio"),
      "remove",
    );
    expect(screen.queryByLabelText("Título")).toBeNull();
    expect(screen.queryByLabelText("Texto")).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText("Sección"), "s1");
    await userEvent.type(screen.getByLabelText("Motivo"), "Ya no aplica");
    await userEvent.click(
      screen.getByRole("button", { name: "Enviar propuesta" }),
    );
    expect(onSubmit).toHaveBeenCalledWith({
      kind: "remove",
      sectionId: "s1",
      motive: "Ya no aplica",
    });
  });

  it("RF-8 (004) · 8.1: al revisar no deja cambiar tipo ni sección y el botón azul es «Guardar revisión»", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, revisionNo: 2 });
    const { container } = render(
      <AmendmentForm
        mode="revise"
        sections={sections}
        kind="change"
        sectionId="s1"
        initial={{
          title: "Viejo",
          text: "Texto viejo",
          motive: "Motivo viejo",
        }}
        onSubmit={onSubmit}
      />,
    );
    expectOnePrimary(container, "Guardar revisión");
    expect(screen.queryByLabelText("Tipo de cambio")).toBeNull();
    expect(screen.queryByLabelText("Sección")).toBeNull();
    await userEvent.clear(screen.getByLabelText("Título"));
    await userEvent.type(screen.getByLabelText("Título"), "Nuevo");
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar revisión" }),
    );
    expect(onSubmit).toHaveBeenCalledWith({
      title: "Nuevo",
      text: "Texto viejo",
      motive: "Motivo viejo",
    });
  });

  it("RF-16 (004) · 16.2: un texto que excede el máximo muestra cuántos caracteres sobran y no se envía", async () => {
    const onSubmit = vi.fn();
    render(
      <AmendmentForm mode="open" sections={sections} onSubmit={onSubmit} />,
    );
    await userEvent.selectOptions(screen.getByLabelText("Sección"), "s1");
    await userEvent.click(screen.getByLabelText("Título"));
    await userEvent.paste("t".repeat(122));
    await userEvent.type(screen.getByLabelText("Texto"), "x");
    await userEvent.type(screen.getByLabelText("Motivo"), "m");
    expect(screen.getByText(/sobran 2 caracteres/)).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Enviar propuesta" }),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("RF-16 (004) · 16.4: si el máximo de 100 abiertas se alcanzó, muestra el aviso y conserva lo escrito", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new ApiClientError("amendment-limit"));
    render(
      <AmendmentForm mode="open" sections={sections} onSubmit={onSubmit} />,
    );
    await userEvent.selectOptions(screen.getByLabelText("Sección"), "s1");
    await userEvent.type(screen.getByLabelText("Título"), "Mi título");
    await userEvent.type(screen.getByLabelText("Texto"), "Mi texto");
    await userEvent.type(screen.getByLabelText("Motivo"), "Mi motivo");
    await userEvent.click(
      screen.getByRole("button", { name: "Enviar propuesta" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "máximo de 100 propuestas abiertas",
    );
    expect((screen.getByLabelText("Texto") as HTMLTextAreaElement).value).toBe(
      "Mi texto",
    );
  });

  it("RF-16 (004) · 16.4: con openCount de 100 avisa de antemano y no deja enviar", async () => {
    const onSubmit = vi.fn();
    render(
      <AmendmentForm
        mode="open"
        sections={sections}
        openCount={100}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "máximo de 100 propuestas abiertas",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Enviar propuesta",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("RF-6 (004) · 6.5: si ya hay una propuesta abierta en ese lugar enlaza a ella y conserva lo escrito", async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValue({ ok: false, taken: true, amendmentId: "abierta-7" });
    render(
      <AmendmentForm mode="open" sections={sections} onSubmit={onSubmit} />,
    );
    await userEvent.selectOptions(screen.getByLabelText("Sección"), "s1");
    await userEvent.type(screen.getByLabelText("Título"), "T");
    await userEvent.type(screen.getByLabelText("Texto"), "Mi texto");
    await userEvent.type(screen.getByLabelText("Motivo"), "M");
    await userEvent.click(
      screen.getByRole("button", { name: "Enviar propuesta" }),
    );
    const link = await screen.findByRole("link", {
      name: /propuesta abierta/i,
    });
    expect(link.getAttribute("href")).toBe(
      "/constitucion/propuestas/abierta-7",
    );
    expect((screen.getByLabelText("Texto") as HTMLTextAreaElement).value).toBe(
      "Mi texto",
    );
  });

  it("RF-17 (004) · 17.1: si el envío falla muestra el motivo en español y conserva lo escrito", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new ApiClientError("amendment-unchanged"));
    render(
      <AmendmentForm mode="open" sections={sections} onSubmit={onSubmit} />,
    );
    await userEvent.selectOptions(screen.getByLabelText("Sección"), "s1");
    await userEvent.type(screen.getByLabelText("Título"), "Igual");
    await userEvent.type(screen.getByLabelText("Texto"), "Mismo texto");
    await userEvent.type(screen.getByLabelText("Motivo"), "Motivo escrito");
    await userEvent.click(
      screen.getByRole("button", { name: "Enviar propuesta" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "deja la sección igual",
    );
    expect((screen.getByLabelText("Motivo") as HTMLTextAreaElement).value).toBe(
      "Motivo escrito",
    );
    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe(
      "Igual",
    );
  });

  it("RF-17 (004) · 17.2: un conflicto de versión muestra lo vigente y conserva lo escrito", async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      ok: false,
      conflict: true,
      current: {
        revisionNo: 3,
        title: "Vigente",
        text: "Texto vigente",
        motive: "Motivo vigente",
      },
    });
    render(
      <AmendmentForm
        mode="revise"
        sections={sections}
        kind="change"
        sectionId="s1"
        initial={{ title: "A", text: "B", motive: "C" }}
        onSubmit={onSubmit}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar revisión" }),
    );
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("revisión 3");
    expect(alert.textContent).toContain("Texto vigente");
    expect((screen.getByLabelText("Texto") as HTMLTextAreaElement).value).toBe(
      "B",
    );
  });

  it("RF-6 (004) · 6.1: «Cancelar» llama a onCancel sin enviar", async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(
      <AmendmentForm
        mode="open"
        sections={sections}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
