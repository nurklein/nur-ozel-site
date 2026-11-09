
async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function verify(value, signature, secret) {
  const expected = await sign(value, secret);

  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(signature);

  if (a.length !== b.length) return false;

  return crypto.subtle.timingSafeEqual
    ? crypto.subtle.timingSafeEqual(a, b)
    : expected === signature;
}

export async function onRequest({ request, env }) {
  const secret = env.ADMINPASSWORD;

  if (!secret) {
    return Response.json(
      { error: "Admin şifresi ayarlanmamış. Cloudflare ayarlarını kontrol et." },
      { status: 500 }
    );
  }

  if (request.method === "POST") {
    let body;

    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Geçersiz istek." }, { status: 400 });
    }

    if (body.username !== "admin" || body.password !== secret) {
      return Response.json(
        { error: "Kullanıcı adı veya şifre yanlış." },
        { status: 401 }
      );
    }

    const expires = String(Date.now() + 8 * 60 * 60 * 1000);
    const signature = await sign(expires, secret);

    return Response.json(
      { success: true },
      {
        headers: {
          "Set-Cookie": `admin_session=${expires}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=28800`
        }
      }
    );
  }

  if (request.method === "GET") {
    const cookie = request.headers.get("Cookie") || "";
    const match = cookie.match(/admin_session=([^;]+)/);

    if (!match) {
      return Response.json({ error: "Giriş yapman gerekiyor." }, { status: 401 });
    }

    const [expires, signature] = match[1].split(".");
    const expiry = Number(expires);

    if (
      !expiry ||
      expiry < Date.now() ||
      !(await verify(expires, signature, secret))
    ) {
      return Response.json({ error: "Oturum süresi dolmuş." }, { status: 401 });
    }

    try {
      const result = await env.DB.prepare(
        "SELECT * FROM answers ORDER BY id DESC LIMIT 200"
      ).all();

      return Response.json({ answers: result.results || [] });
    } catch {
      return Response.json(
        { error: "Cevaplar veritabanından alınamadı." },
        { status: 500 }
      );
    }
  }

  return Response.json({ error: "İzin verilmeyen işlem." }, { status: 405 });
}

