export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();

    if (!Array.isArray(data.answers) || data.answers.length !== 10) {
      return Response.json({ error: "Eksik cevap" }, { status: 400 });
    }

    const questions = [
      "İlk buluşmamız nasıldı?",
      "Sana nasıl çıkma teklifi ettim?",
      "İlk buluşmamızda ne yaptık?",
      "İlk mesajı attığımda ne oldu?",
      "Sana aldığım ilk hediye neydi?",
      "En büyük hayalim nedir?",
      "En sevdiğim yemek nedir?",
      "En sevdiğim renk nedir?",
      "En çok gitmek istediğim şehir hangisi?",
      "Gelecekte nasıl bir hayat yaşamak istiyorum?"
    ];

    const statements = data.answers.map((answer, i) =>
      env.DB.prepare(
        "INSERT INTO answers (name, question, answer) VALUES (?, ?, ?)"
      ).bind("Nur", questions[i], answer)
    );

    await env.DB.batch(statements);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: "Kayıt başarısız" }, { status: 500 });
  }
}
