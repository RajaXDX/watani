/* =========================================================================
   اكتشف وطنك مع رجا — عامل الخدمة (Service Worker)
   يخلّي اللعبة تشتغل بدون إنترنت بعد أول فتحة:
   - الصفحة نفسها: الشبكة أولاً (عشان التحديثات توصل)، والنسخة المحفوظة لو ما فيه نت.
   - باقي الملفات: المحفوظ أولاً. ملفات css/js تحمل ?v= فأي تعديل = رابط جديد.
   - الصفحة ترسل قائمة ملفاتها وصور الأسئلة (رسالة precache) فتنحفظ كلها من البداية.
   ========================================================================= */

const CACHE = 'watani-v1';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.add('./')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put('./', res.clone());
        return res;
      } catch (e) {
        return (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  })());
});

/* الصفحة ترسل روابط ملفاتها الحالية: نحفظ الناقص، ونحذف النسخ القديمة
   لنفس الملف (نفس المسار برقم ?v= مختلف) حتى ما يكبر التخزين بلا داعي. */
self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type !== 'precache' || !Array.isArray(data.urls)) return;

  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const wanted = new Set(data.urls.map(u => new URL(u, self.location).href));
    const byPath = new Map([...wanted].map(h => [new URL(h).pathname, h]));

    for (const req of await cache.keys()) {
      const current = byPath.get(new URL(req.url).pathname);
      if (current && current !== req.url) await cache.delete(req);
    }
    for (const href of wanted) {
      if (await cache.match(href)) continue;
      try {
        const res = await fetch(href);
        if (res.ok) await cache.put(href, res);
      } catch (e) { /* بدون نت الحين — ينحفظ في المرة الجاية */ }
    }
  })());
});
