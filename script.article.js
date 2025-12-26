// ------------------------
// script.article.js (CLEAN)
// ------------------------

// ------------------------
// Utils
// ------------------------
function escapeHtml(s) {
  if (!s && s !== 0) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ------------------------
// On load: display article
// ------------------------
document.addEventListener("DOMContentLoaded", () => {
  const q = new URLSearchParams(window.location.search);
  const url = q.get("url");

  const articlePanel = document.querySelector(".article-panel");
  const titleEl = document.getElementById("articleTitle");
  const contentEl = document.getElementById("articleContent");

  if (url && articlePanel) {
    const iframe = document.createElement("iframe");
    iframe.src = decodeURIComponent(url);
    iframe.style.width = "100%";
    iframe.style.height = "85vh";
    iframe.style.border = "none";

    articlePanel.innerHTML = "";
    articlePanel.appendChild(iframe);
  } else {
    if (titleEl) titleEl.textContent = "Article";
    if (contentEl) contentEl.textContent = "No article URL supplied.";
  }
});
