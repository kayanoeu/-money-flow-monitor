export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const { scores, metrics } = body;

    const prompt = buildPrompt(scores, metrics);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`Anthropic API HTTP ${response.status}`);
    const data = await response.json();
    const text = data.content?.[0]?.text ?? '';
    return res.status(200).json({ comment: text });

  } catch (e) {
    console.error('comment error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

function buildPrompt(scores, metrics) {
  return `あなたは日本株トレーダーを支援するマクロアナリストです。
以下のグローバルマネーフロー指標データを分析し、日本株トレーダー向けの市場環境コメントを生成してください。

## レジームスコア
${JSON.stringify(scores, null, 2)}

## 主要指標データ
${JSON.stringify(metrics, null, 2)}

## 出力形式（必ずこの形式で出力）

【本日のマクロ環境】スコア${scores.normalized > 0 ? '+' : ''}${scores.normalized?.toFixed(1)} （${scores.regime}）

**L1 流動性バイアス**
（Fed BS・ECB BS・日銀BSの方向性と流動性環境を2〜3文で）

**L2 金利・クレジット環境**
（VIX水準・スプレッドの状況・債券市場の読み方を2〜3文で）

**L3 クロスアセット**
（銅・BTCの方向性からリスク選好の読み方を1〜2文で）

**L4 セクターローテーション**
（上昇セクター・下落セクターのパターンと日本株への示唆を2〜3文で）

**L5 日本フロー**
（円キャリー・日経・ETFフローの状況を2〜3文で）

**→ 本日の戦略示唆**
（具体的なセクター・戦略・注意点を箇条書き3〜5点で）

※金融ドメイン知識が浅い人でも理解できるよう、専門用語には簡単な説明を括弧で補足すること。
※データが取得できていない指標（null・undefined）はコメントから除外すること。
※200〜400文字程度で簡潔にまとめること。`;
}
