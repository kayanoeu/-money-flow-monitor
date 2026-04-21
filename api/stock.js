export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { code, range = '3mo' } = req.query;
  if (!code) return res.status(400).json({ error: 'code required' });

  // 日本株：4桁コード → Yahoo Finance形式（例: 7203 → 7203.T）
  const symbol = `${code}.T`;
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}&includePrePost=false`;

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://finance.yahoo.com',
        'Referer': 'https://finance.yahoo.com/',
      }
    });
    if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
    const text = await r.text();
    if (!text || text.length < 10) throw new Error('empty response');
    const json = JSON.parse(text);
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error(`銘柄コード ${code} が見つかりません`);

    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    const closes = quote.close;
    const volumes = quote.volume;
    const highs = quote.high;
    const lows = quote.low;
    const opens = quote.open;
    const meta = result.meta;

    // null除去してデータ整形
    const data = timestamps.map((ts, i) => ({
      date:   new Date(ts * 1000).toISOString().slice(0, 10),
      open:   opens[i],
      high:   highs[i],
      low:    lows[i],
      close:  closes[i],
      volume: volumes[i],
    })).filter(d => d.close != null);

    return res.status(200).json({
      symbol,
      name: meta.longName ?? meta.shortName ?? code,
      currency: meta.currency,
      data,
    });

  } catch(e) {
    console.error(`stock error [${code}]: ${e.message}`);
    return res.status(502).json({ error: e.message });
  }
}
