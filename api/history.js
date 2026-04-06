const YAHOO_MAP = {
  'DXY':'DX-Y.NYB','SOX':'^SOX','XAU/USD':'GC=F','XCU/USD':'HG=F',
  'WTI/USD':'CL=F',
  'JNK':'JNK','TLT':'TLT','SHY':'SHY','LQD':'LQD','XLK':'XLK','XLF':'XLF',
  'XLE':'XLE','XLU':'XLU','IWF':'IWF','MTUM':'MTUM','EWJ':'EWJ','DXJ':'DXJ',
  'IWM':'IWM','QUAL':'QUAL','USMV':'USMV',
  'USD/JPY':'USDJPY=X','AUD/JPY':'AUDJPY=X','EUR/JPY':'EURJPY=X',
  'CHF/JPY':'CHFJPY=X',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const yahooSymbol = YAHOO_MAP[symbol] ?? symbol;
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=3mo&includePrePost=false`;

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
    if (!result) throw new Error('no result');

    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;

    // 日付と終値をペアにして null を除外
    const data = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      value: closes[i]
    })).filter(d => d.value != null);

    return res.status(200).json({ symbol, data });
  } catch (e) {
    console.error(`history error [${symbol}]: ${e.message}`);
    return res.status(502).json({ error: e.message });
  }
}
