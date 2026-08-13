import { exportBackup, getCounts } from "./store.js";
import { h, clear } from "./dom.js";

export async function renderExportView(container) {
  const counts = await getCounts();
  clear(container);

  const downloadBtn = h("button", { type: "button", id: "download-backup" }, "Baixar backup (.json)");

  container.appendChild(
    h(
      "section",
      { class: "card-section" },
      h("h2", {}, "Exportar backup"),
      h(
        "p",
        { class: "hint" },
        `${counts.people} pessoas e ${counts.families} famílias salvas neste dispositivo. ` +
          "Os dados ficam só no navegador deste celular — baixe um backup de vez em quando " +
          "(por exemplo, salvando no Google Drive) para não correr risco de perder o trabalho " +
          "de validação se limpar os dados do navegador ou trocar de aparelho."
      ),
      downloadBtn
    )
  );

  downloadBtn.addEventListener("click", async () => {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `genealogia-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}
