// Service worker для браузерных push-уведомлений чата.
// Показывает уведомление о новом ответе и по клику открывает сайт с открытым чатом.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* не JSON — покажем дефолт */
  }
  const title = data.title || "Sochifornia — новый ответ";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "Вам ответили в чате",
      icon: "/LogoSochi.png",
      badge: "/LogoSochi.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
