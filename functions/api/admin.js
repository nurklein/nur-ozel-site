
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
  return (await sign(value, secret)) === signature;
}

export async function onRequest({ request, env }) {
  const secret = env.ADMINPASSWORD;

  if (!secret) {
    return new Response("Admin şifresi ayarlanmamış.", { status: 500 });
  }

  if (request.method === "POST") {
    const body = await request.json();

    if (body.username !== "admin" || body.password !== secret) {
      return Response.json(
        { error: "Kullanıcı adı veya şifre yanlış." },
        { status: 401 }
      );
    }

    const expires = Date.now() + 8 * 60 * 60 * 1000;
    const value = String(expires);
    const signature = await sign(value, secret);

    return Response.json(
      { success: true },
      {
        headers: {
          "Set-Cookie": `admin_session=${value}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=28800`
        }
      }
    );
  }

  if (request.method === "GET") {
    const cookie = request.headers.get("Cookie") || "";
    const match = cookie.match(/admin_session=([^;]+)/);

    if (!match) {
      return Response.json({ error: "Giriş gerekli." }, { status: 401 });
    }

    const [expires, signature] = match[1].split(".");
    const expiry = Number(expires);

    if (
      !expiry ||
      expiry < Date.now() ||
      !(await verify(expires, signature, secret))
    ) {
      return Response.json({ error: "Oturum geçersiz." }, { status: 401 });
    }

    const result = await env.DB.prepare(
      "SELECT * FROM answers ORDER BY id DESC LIMIT 200"
    ).all();

    return Response.json({ answers: result.results });
  }

  return new Response("Method not allowed", { status: 405 });
}
