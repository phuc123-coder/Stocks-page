// ------------------------
// script.home.js (UPDATED & SAFE)
// ------------------------

// ------------------------
// API Keys - REPLACE THESE
// ------------------------
const MARKET_AUX_KEY = "YOUR_MARKETAUX_API_KEY";
const YAHOO_KEY = "YOUR_RAPIDAPI_KEY";
const ALPHA_KEY = "YOUR_ALPHA_KEY";

let chart = null; // Chart.js instance


// -----------------------------------------------------
// Helper: Fix canvas height to prevent infinite growth
// -----------------------------------------------------
function prepareChartCanvas() {
  const canvas = document.getElementById("stockChart");
  if (!canvas) return;

  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = 350;
  canvas.style.height = "350px";
  canvas.style.maxHeight = "350px";
}


// ------------------------
// 1. Load News (MarketAux)
// ------------------------
async function loadNews() {
  const url = `https://api.marketaux.com/v1/news/all?filter_entities=true&language=en&api_token=${MARKET_AUX_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();

    const news = data?.data;
    if (!Array.isArray(news) || news.length === 0) throw new Error();

    const featured = news[Math.floor(Math.random() * news.length)];
    document.getElementById("featured").innerHTML = `
      <img src="${featured.image_url || "https://via.placeholder.com/800x400"}">
      <h2>${escapeHtml(featured.title)}</h2>
      <p>${escapeHtml(featured.description)}</p>
      <p>
        <a href="#" onclick="openArticle('${encodeURIComponent(featured.url)}');return false;">
          Read full article
        </a>
      </p>
    `;

    const grid = document.getElementById("newsGrid");
    grid.innerHTML = "";
    news.slice(0, 6).forEach(a => {
      const summary = (a.description || "").split(" ").slice(0, 20).join(" ") + "...";
      grid.innerHTML += `
        <div class="news-card" onclick="openArticle('${encodeURIComponent(a.url)}')">
          <h4>${escapeHtml(a.title)}</h4>
          <p>${escapeHtml(summary)}</p>
        </div>
      `;
    });

  } catch {
    loadNewsAlphaVantage();
  }
}


// ------------------------------
// Fallback News (AlphaVantage)
// ------------------------------
async function loadNewsAlphaVantage() {
  try {
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=finance&apikey=${ALPHA_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    const articles = data?.feed;
    if (!articles?.length) return;

    document.getElementById("featured").innerHTML = `
      <img src="${articles[0].banner_image || "https://via.placeholder.com/800x400"}">
      <h2>${escapeHtml(articles[0].title)}</h2>
      <p>${escapeHtml(articles[0].summary)}</p>
      <p>
        <a href="#" onclick="openArticle('${encodeURIComponent(articles[0].url)}');return false;">
          Read full article
        </a>
      </p>
    `;

    const grid = document.getElementById("newsGrid");
    grid.innerHTML = "";
    articles.slice(1, 7).forEach(a => {
      grid.innerHTML += `
        <div class="news-card" onclick="openArticle('${encodeURIComponent(a.url)}')">
          <h4>${escapeHtml(a.title)}</h4>
          <p>${escapeHtml(a.summary.split(" ").slice(0, 20).join(" "))}...</p>
        </div>
      `;
    });
  } catch {}
}


// ------------------------
// 2. Market Movers (FIXED)
// ------------------------
async function loadMovers() {
  try {
    const res = await fetch(
      "https://apidojo-yahoo-finance-v1.p.rapidapi.com/market/v2/get-summary?region=US",
      {
        headers: {
          "X-RapidAPI-Key": YAHOO_KEY,
          "X-RapidAPI-Host": "apidojo-yahoo-finance-v1.p.rapidapi.com",
        }
      }
    );

    const data = await res.json();
    const m = data?.marketSummaryAndSparkResponse?.result || [];

    fillList("gainers", m.slice(0, 5));
    fillList("losers", m.slice(5, 10));
    fillList("active", m.slice(10, 15));
  } catch {
    loadMoversAlphaVantage();
  }
}

async function loadMoversAlphaVantage() {
  try {
    const res = await fetch(
      `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_KEY}`
    );
    const data = await res.json();

    fillList("gainers", data.top_gainers || []);
    fillList("losers", data.top_losers || []);
    fillList("active", data.most_actively_traded || []);
  } catch {}
}

function fillList(id, arr) {
  const el = document.getElementById(id);
  if (!el) return;

  el.innerHTML = "";

  arr.slice(0, 5).forEach(item => {
    const symbol = item.symbol || item.ticker || "—";

    const price =
      item.regularMarketPrice?.raw ??
      item.price ??
      item.close ??
      null;

    const rawPercent =
      item.regularMarketChangePercent?.raw ??
      parseFloat(
        (item.regularMarketChangePercent?.fmt ||
         item.change_percentage ||
         item.changesPercentage ||
         "0").replace("%", "")
      );

    const percent = Number(rawPercent) || 0;
    const up = percent >= 0;
    const arrow = up ? "▲" : "▼";
    const cls = up ? "green-text" : "red";

    el.innerHTML += `
      <li class="${cls}">
        <strong>${symbol}</strong>
        ${price ? `$${Number(price).toLocaleString()}` : ""}
        (${arrow} ${Math.abs(percent).toFixed(2)}%)
      </li>
    `;
  });
}


// ------------------------
// 3. SEARCH (UNCHANGED – ALREADY CORRECT)
// ------------------------
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("searchBtn").addEventListener("click", getStock);
  document.getElementById("symbol").addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      getStock();
    }
  });
});

async function getStock() {
  const symbol = document.getElementById("symbol").value.trim().toUpperCase();
  if (!symbol) return;

  document.getElementById("news-section").style.display = "none";
  document.getElementById("searchResultPanel").style.display = "block";

  const info = document.getElementById("info");
  info.innerHTML = "Loading...";

  try {
    const res = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${ALPHA_KEY}`
    );
    const data = await res.json();

    const daily = data["Time Series (Daily)"];
    if (!daily) {
      info.innerHTML = "No data found.";
      return;
    }

    const dates = Object.keys(daily).slice(0, 30).reverse();
    const prices = dates.map(d => +daily[d]["4. close"]);

    info.innerHTML = `
      <b>${symbol}</b><br>
      Today: $${prices.at(-1)}<br>
      Yesterday: $${prices.at(-2)}
    `;

    if (chart) chart.destroy();
    prepareChartCanvas();

    chart = new Chart(document.getElementById("stockChart"), {
      type: "line",
      data: {
        labels: dates,
        datasets: [{
          label: `${symbol} (30 days)`,
          data: prices,
          borderColor: "#24b36b",
          borderWidth: 2,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false
      }
    });

  } catch (err) {
    info.innerHTML = "Error fetching data.";
    console.error(err);
  }
}


// ------------------------
// Utils
// ------------------------
function openArticle(encoded) {
  window.location.href = "article.html?url=" + encoded;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


// ------------------------
// INIT
// ------------------------
loadNews();
loadMovers();
  