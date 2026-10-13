const allowedNoteTags = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "STRIKE",
  "A",
  "UL",
  "OL",
  "LI",
  "BR",
  "P",
  "DIV",
  "IMG",
  "FONT",
]);

export function sanitizeNoteHtml(value: string) {
  if (typeof document === "undefined") return value;
  const wrapper = document.createElement("div");
  const containsRichHtml =
    /<\/?(?:b|strong|i|em|u|s|strike|a|ul|ol|li|br|p|div|img|font)(?:\s|>|\/)/i.test(
      value,
    ) || /&(?:nbsp|amp|lt|gt|quot|#39|#\d+|#x[a-f\d]+);/i.test(value);

  if (!containsRichHtml) {
    wrapper.textContent = value;
    return wrapper.innerHTML.replace(/\r?\n/g, "<br>");
  }

  wrapper.innerHTML = value;
  wrapper.querySelectorAll("*").forEach((element) => {
    if (!allowedNoteTags.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent || ""));
      return;
    }
    const sourceHref =
      element instanceof HTMLAnchorElement
        ? element.getAttribute("href")?.trim() || ""
        : "";
    const sourceSrc =
      element instanceof HTMLImageElement
        ? element.getAttribute("src")?.trim() || ""
        : "";
    const textAlign =
      element instanceof HTMLElement ? element.style.textAlign : "";
    const fontFace =
      element.tagName === "FONT"
        ? element.getAttribute("face")?.trim() || ""
        : "";
    const fontSize =
      element.tagName === "FONT"
        ? element.getAttribute("size")?.trim() || ""
        : "";
    const fontColor =
      element.tagName === "FONT"
        ? element.getAttribute("color")?.trim() || ""
        : "";

    [...element.attributes].forEach((attribute) =>
      element.removeAttribute(attribute.name),
    );
    if (
      element instanceof HTMLElement &&
      ["left", "center", "right", "justify"].includes(textAlign)
    )
      element.style.textAlign = textAlign;
    if (element.tagName === "FONT") {
      if (/^[a-zA-Z0-9 ,'-]{1,60}$/.test(fontFace))
        element.setAttribute("face", fontFace);
      if (/^[1-7]$/.test(fontSize)) element.setAttribute("size", fontSize);
      if (/^(#[0-9a-f]{3,8}|rgb\([0-9 ,.]+\))$/i.test(fontColor))
        element.setAttribute("color", fontColor);
    }
    if (
      element instanceof HTMLAnchorElement &&
      (/^https?:\/\//i.test(sourceHref) || /^mailto:/i.test(sourceHref))
    ) {
      element.href = sourceHref;
      element.target = "_blank";
      element.rel = "noreferrer noopener";
    }
    if (element instanceof HTMLImageElement) {
      if (/^https?:\/\//i.test(sourceSrc)) {
        element.src = sourceSrc;
        element.alt = "Note attachment";
      } else {
        element.remove();
      }
    }
  });

  return wrapper.innerHTML;
}
