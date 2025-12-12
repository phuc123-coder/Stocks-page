// ------------------------
// script.home.js (FIXED)
// ------------------------

// ------------------------
// API Keys - REPLACE THESE
// ------------------------
const MARKET_AUX_KEY = "YOUR_MARKETAUX_API_KEY";
const YAHOO_KEY = "YOUR_RAPIDAPI_KEY";
const ALPHA_KEY = "YOUR_ALPHA_KEY";

let chart = null; // Chart.js instance


// -----------------------------------------------------
// 0. HELPER: Ensure canvas height before drawing chart
// -----------------------------------------------------
function prepareChartCanvas() {
  const canvas = document.getElementById("stockChart");
  if (!canvas) return;

  // RESET canvas so Chart.js does not stretch infinitely
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = 350;            // Fixed height avoids infinite vertical growth
  canvas.style.height = "350px";  // Enforce pixel height
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
    if (!Array.isArray(news) || news.length === 0) throw new Error("No MarketAux news");

    const featured = news[Math.floor(Math.random() * news.length)];
    const featuredEl = document.getElementById("featured");

    if (featuredEl) {
      featuredEl.innerHTML = `
        <img src="${featured.image_url || "https://via.placeholder.com/800x400"}">
        <h2>${escapeHtml(featured.title)}</h2>
        <p>${escapeHtml(featured.description)}</p>
        <p><a href="#" onclick="openArticle('${encodeURIComponent(featured.url)}');return false;">Read full article</a></p>
      `;
    }

    const grid = document.getElementById("newsGrid");
    if (grid) {
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
    }

  } catch (err) {
    console.warn("MarketAux failed → switching to AlphaVantage");
    loadNewsAlphaVantage();
  }
}



// ------------------------------
// 1B. Fallback News (AlphaVantage)
// ------------------------------
async function loadNewsAlphaVantage() {
  try {
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=finance&apikey=${ALPHA_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    const articles = data?.feed;
    if (!articles || articles.length === 0) return;

    const featured = articles[0];
    const featuredEl = document.getElementById("featured");

    if (featuredEl) {
      featuredEl.innerHTML = `
        <img src="${featured.banner_image || "https://via.placeholder.com/800x400"}">
        <h2>${escapeHtml(featured.title)}</h2>
        <p>${escapeHtml(featured.summary)}</p>
        <p><a href="#" onclick="openArticle('${encodeURIComponent(featured.url)}');return false;">Read full article</a></p>
      `;
    }

    const grid = document.getElementById("newsGrid");
    if (grid) {
      grid.innerHTML = "";
      articles.slice(1, 7).forEach(a => {
        const summary = (a.summary || "").split(" ").slice(0, 20).join(" ") + "...";
        grid.innerHTML += `
          <div class="news-card" onclick="openArticle('${encodeURIComponent(a.url)}')">
            <h4>${escapeHtml(a.title)}</h4>
            <p>${escapeHtml(summary)}</p>
          </div>
        `;
      });
    }

  } catch (err) {
    console.warn("AlphaVantage news fallback also failed");
  }
}



// ------------------------
// 2. Load Market Movers
// ------------------------
async function loadMovers() {
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

    fillList("gainers", movers.slice(0, 5));
    fillList("losers", movers.slice(5, 10));
    fillList("active", movers.slice(10, 15));

  } catch (err) {
    console.warn("Yahoo movers failed → fallback");
    loadMoversAlphaVantage();
  }
}



// ------------------------------
// 2B. Fallback Market Movers
// ------------------------------
async function loadMoversAlphaVantage() {
  try {
    const url = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    fillList("gainers", data?.top_gainers || []);
    fillList("losers", data?.top_losers || []);
    fillList("active", data?.most_actively_traded || []);

  } catch (err) {
    console.warn("AlphaVantage mover fallback failed");
  }
}



// ------------------------
// Sidebar List Coloring
// ------------------------
function fillList(id, arr) {
  const el = document.getElementById(id);
  if (!el) return;

  el.innerHTML = "";

  arr.slice(0, 5).forEach(item => {
    const symbol = item.symbol || item.ticker || item.shortName || "???";

    let changeRaw = item.regularMarketChangePercent?.fmt ||
                    item.change_percentage ||
                    item.changesPercentage || "";

    let changeNum = parseFloat(changeRaw.replace("%","")) || 0;
    const cls = changeNum >= 0 ? "green-text" : "red";

    const li = document.createElement("li");
    li.className = cls;
    li.innerHTML = `<strong>${escapeHtml(symbol)}</strong> ${escapeHtml(changeRaw)}`;
    el.appendChild(li);
  });
}



// ------------------------
// 3. SEARCH + CHART FIXED
// ------------------------
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("searchBtn")?.addEventListener("click", getStock);

  document.getElementById("symbol")?.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      getStock();
    }
  });
});


async function getStock() {
  const symbol = document.getElementById("symbol").value.trim().toUpperCase();
  if (!symbol) return;

  // Hide news
  const ns1 = document.getElementById("news-section");     // your wrapper
  const ns2 = document.getElementById("homepage");         // fallback wrapper
  if (ns1) ns1.style.display = "none";
  if (ns2) ns2.style.display = "none";

  // Show results panel
  const results = document.getElementById("searchResultPanel");
  if (results) results.style.display = "block";

  const info = document.getElementById("info");
  info.innerHTML = "Loading...";

  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${ALPHA_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    const daily = data["Time Series (Daily)"];
    if (!daily) {
      info.innerHTML = "No data found.";
      return;
    }

    const dates = Object.keys(daily).slice(0, 30).reverse();
    const prices = dates.map(d => parseFloat(daily[d]["4. close"]));

    // Render text info
    info.innerHTML = `
      <b>${symbol}</b><br>
      Today: $${prices.at(-1)}<br>
      Yesterday: $${prices.at(-2)}<br>
    `;

    // FIX chart canvas before drawing
    prepareChartCanvas();

    const ctx = document.getElementById("stockChart");

    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: dates,
        datasets: [{
          label: `${symbol} (30 days)`,
          data: prices,
          borderColor: "#24b36b",
          borderWidth: 2,
          fill: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
      }
    });

  } catch (err) {
    info.innerHTML = "Error fetching data.";
    console.error(err);
  }
}



// ------------------------
// utils
// ------------------------
function openArticle(encoded) {
  const raw = decodeURIComponent(encoded);
  window.location.href = "article.html?url=" + encodeURIComponent(raw);
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}



// ------------------------
// INIT
// ------------------------
(function init() {
  loadNews();
  loadMovers();
})();
