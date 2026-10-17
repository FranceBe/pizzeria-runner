// Draws the end-of-day receipt as a PNG, to share or save. Browser only (canvas).

export interface ReceiptRow {
  label: string;
  value: string;
  /** Bigger and bold, like the day's profit. */
  isTotal?: boolean;
}

const WIDTH = 420;
const PADDING = 28;
const ROW_HEIGHT = 26;
const PAPER = "#fffdf6";
const INK = "#2a2620";
const RULE = "#cfc6b4";
const ACCENT = "#c63a21";

function rule(context: CanvasRenderingContext2D, y: number): void {
  context.strokeStyle = RULE;
  context.setLineDash([6, 5]);
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(PADDING, y);
  context.lineTo(WIDTH - PADDING, y);
  context.stroke();
  context.setLineDash([]);
}

export function drawReceipt(name: string, title: string, rows: readonly ReceiptRow[], thanks: string): Promise<Blob | null> {
  const scale = 2;
  const height = PADDING * 2 + 70 + rows.length * ROW_HEIGHT + 60;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);
  context.scale(scale, scale);
  context.fillStyle = PAPER;
  context.fillRect(0, 0, WIDTH, height);

  context.textAlign = "center";
  context.fillStyle = ACCENT;
  context.font = "28px Shrikhand, Georgia, serif";
  context.fillText(name, WIDTH / 2, PADDING + 26);
  context.fillStyle = INK;
  context.font = "600 13px Figtree, system-ui, sans-serif";
  context.fillText(title.toUpperCase(), WIDTH / 2, PADDING + 50);
  let y = PADDING + 70;
  rule(context, y);
  y += 10;

  rows.forEach((row) => {
    y += ROW_HEIGHT;
    context.font = row.isTotal ? "800 17px Figtree, system-ui, sans-serif" : "15px Figtree, system-ui, sans-serif";
    context.textAlign = "left";
    context.fillStyle = INK;
    context.fillText(row.label, PADDING, y);
    context.textAlign = "right";
    context.font = row.isTotal ? "bold 17px Menlo, monospace" : "bold 14px Menlo, monospace";
    context.fillText(row.value, WIDTH - PADDING, y);
  });

  y += 18;
  rule(context, y);
  context.textAlign = "center";
  context.font = "600 12px Figtree, system-ui, sans-serif";
  context.fillStyle = INK;
  context.fillText(thanks.toUpperCase(), WIDTH / 2, y + 30);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

// Shares the image where the device can (phones), otherwise downloads it.
export async function shareOrDownload(blob: Blob, fileName: string): Promise<void> {
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] });
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
