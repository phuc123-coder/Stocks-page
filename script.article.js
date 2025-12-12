// ------------------------
// script.article.js
// ------------------------

// ------------------------
// API Keys - REPLACE THESE
// ------------------------
const YAHOO_KEY = "YOUR_RAPIDAPI_KEY";
const ALPHA_KEY = "YOUR_ALPHA_KEY";
const MARKET_AUX_KEY = "YOUR_MARKETAUX_API_KEY"; // optional if you want to fetch article text (usually impossible due to CORS)

// We'll reuse the same fillList + movers loader from homepage for sidebar
async function loadMoversForArticle() {
  const url = "https://apidojo-yahoo-finance-v1.p.rapidapi.com/market/v2/get-summary?region=US";
  try {
    const res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": YAHOO_KEY,
        "X-RapidAPI-Host": "apidojo-yahoo-finance-v1.p.rapidapi.com",
      },
    });
    const data = await res.json();
    const movers = data?.marketSummaryAndSparkResponse?.result;
    fillListSimple("gainers", movers?.slice(0,5) || []);
    fillListSimple("losers", movers?.slice(5,10) || []);
    fillListSimple("active", movers?.slice(10,15) || []);
  } catch (err) {
    console.warn("Article page movers load failed:", err);
    // no fallback here to keep file small
  }
}

function fillListSimple(elementId, arr) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = "";

  arr.slice(0,5).forEach(item => {
    const symbol = item?.symbol || item?.shortName || item?.ticker || (typeof item === "string" ? item : "???");
    let changeRaw = item?.regularMarketChangePercent?.fmt || item?.change_percentage || item?.changesPercentage || "";
    let changeNum = 0;
    if (changeRaw) {
      const digits = changeRaw.replace("%","").replace(/[^\d\.\-]/g,"");
      changeNum = parseFloat(digits) || 0;
    }
    const cls = (changeNum >= 0) ? "green-text" : "red";
    const li = document.createElement("li");
    li.className = cls;
    li.innerHTML = `<strong>${escapeHtml(symbol)}</strong> ${escapeHtml(changeRaw)}`;
    el.appendChild(li);
  });
}

function escapeHtml(s) {
  if (!s && s !== 0) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// On load: parse URL param `url` and embed it in an iframe
document.addEventListener("DOMContentLoaded", () => {
  // populate movers sidebar
  loadMoversForArticle();

  const q = new URLSearchParams(window.location.search);
  const url = q.get("url");
  const articlePanel = document.querySelector(".article-panel");
  const imgEl = document.getElementById("articleImage");
  const titleEl = document.getElementById("articleTitle");
  const contentEl = document.getElementById("articleContent");

  if (url) {
    // Put an iframe to show the full article (most reliable cross-site)
    const iframe = document.createElement("iframe");
    iframe.src = decodeURIComponent(url);
    iframe.style.width = "100%";
    iframe.style.height = "85vh";
    iframe.style.border = "none";

    // clear the article panel and append iframe
    if (articlePanel) {
      articlePanel.innerHTML = "";
      articlePanel.appendChild(iframe);
    }
  } else {
    // if no url param, try to show whatever is in the DOM (fallback)
    if (titleEl && contentEl) {
      titleEl.textContent = titleEl.textContent || "Article";
      contentEl.textContent = contentEl.textContent || "No article URL supplied.";
    }
  }
});
