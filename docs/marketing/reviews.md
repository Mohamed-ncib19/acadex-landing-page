# Asking a pilot customer for a review

Send it after the school has used Acadex for a few weeks, to the person who
uses it every day. One message, no reminder more than once.

A review is only published with the person's written agreement (a WhatsApp
reply is enough — keep it), with the name and the school they agreed to show.
Nothing is edited except spelling. No review is written for them.

## French

```
Bonjour [prénom],

Vous utilisez Acadex depuis [durée] à [nom de l'établissement]. Accepteriez-vous de me dire en deux ou trois phrases ce que le logiciel a changé dans votre travail, et ce qui manque encore ?

Si vous êtes d'accord, je publierais votre avis sur le site d'Acadex, avec votre prénom, votre fonction et le nom de l'établissement. Dites-moi simplement si vous préférez rester anonyme, ou ne pas être publié.

Merci,
Mohamed
```

## Arabic

```
مرحباً [الاسم]،

تستعملون Acadex منذ [المدة] في [اسم المؤسسة]. هل تقبلون أن تكتبوا لي في جملتين أو ثلاث ما الذي غيّره البرنامج في عملكم، وما الذي ينقصه بعد؟

إن وافقتم، أنشر رأيكم على موقع Acadex مع الاسم والصفة واسم المؤسسة. أخبروني فقط إن كنتم تفضّلون عدم ذكر الاسم، أو عدم النشر.

شكراً،
محمد
```

## Where the answer goes

1. **On the site** — the testimonials block exists and is hidden: `src/page.html`, `id="testimonials"`, marked `TODO_OWNER`. Give the text, the name, the role and the school, and it is switched on in the three languages.
2. **On Google** — once a Google Business Profile exists, the same person can be sent its review link.
3. **On Facebook** — a recommendation on the page.

Until a real review exists, the site shows none, and its structured data carries no rating.
