// Vercel Serverless Function — envia o evento Lead para a API de Conversões da Meta.
// O token fica em variável de ambiente, nunca no código do site.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const PIXEL_ID = process.env.META_PIXEL_ID;
  const TOKEN    = process.env.META_CAPI_TOKEN;
  const TEST     = process.env.META_TEST_EVENT_CODE; // opcional, só para testar

  if (!PIXEL_ID || !TOKEN) {
    console.error('META_PIXEL_ID ou META_CAPI_TOKEN não configurados');
    return res.status(500).json({ error: 'Config ausente' });
  }

  try {
    const { event_id, cidade, regiao, event_source_url, fbp, fbc } = req.body || {};

    // IP real do visitante atrás do proxy da Vercel
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();

    const payload = {
      data: [{
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        event_id,                          // mesma id do pixel -> deduplicação
        action_source: 'website',
        event_source_url,
        user_data: {
          client_ip_address: ip,
          client_user_agent: req.headers['user-agent'],
          ...(fbp && { fbp }),
          ...(fbc && { fbc })
        },
        custom_data: {
          content_name: cidade,
          content_category: regiao
        }
      }],
      ...(TEST && { test_event_code: TEST })
    };

    const r = await fetch(
      `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${TOKEN}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    );

    const json = await r.json();
    if (!r.ok) {
      console.error('Erro da Meta:', json);
      return res.status(502).json({ error: 'Meta rejeitou o evento', detail: json });
    }
    return res.status(200).json({ ok: true, ...json });

  } catch (e) {
    console.error('Falha ao enviar evento:', e);
    return res.status(500).json({ error: 'Falha interna' });
  }
}
