document.getElementById("searchBtn").addEventListener("click", getStock);

let chart; // Store chart instance

async function getStock() {
  const symbol = document.getElementById("symbol").value.trim().toUpperCase();
  const info = document.getElementById("info");

  const API_KEY = "YOUR_API_KEY";

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const daily = data["Time Series (Daily)"];
    if (!daily) {
      info.innerHTML = "No data found or API limit reached.";
      return;
    }

    // Extract dates & prices
    const dates = Object.keys(daily).slice(0, 30).reverse(); // last 30 days
    const prices = dates.map(d => parseFloat(daily[d]["4. close"]));

    // Today, yesterday, 30 days ago
    const priceToday = prices[prices.length - 1];
    const priceYesterday = prices[prices.length - 2];
    const price30days = prices[0];

    // % change from yesterday -> today
    const percentChange = ((priceToday - priceYesterday) / priceYesterday * 100).toFixed(2);

    info.innerHTML = `
      <b>${symbol}</b><br><br>
      Today: $${priceToday}<br>
      Yesterday: $${priceYesterday}<br>
      30 days ago: $${price30days}<br><br>
      <b>Change today: ${percentChange}%</b>
    `;

    // If a chart already exists, destroy before creating new
    if (chart) chart.destroy();

    // Create Chart.js graph
    const ctx = document.getElementById("stockChart");

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          label: `${symbol} - Last 30 Days`,
          data: prices,
          borderColor: '#007BFF',
          borderWidth: 2,
          fill: false,
          tension: 0.1
        }]
      },
      options: {
        scales: {
          x: { display: true },
          y: { display: true }
        }
      }
    });

  } catch (err) {
    info.innerHTML = "Error fetching data.";
    console.error(err);
  }
}
