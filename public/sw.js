// Service worker do PetCamp: recebe Web Push e mostra notificações mesmo com o app fechado.
self.addEventListener("push", (event) => {
  let data = { title: "PetCamp", body: "Você tem uma atualização de promoção." }
  try {
    if (event.data) data = event.data.json()
  } catch (e) {
    if (event.data) data.body = event.data.text()
  }
  const options = {
    body: data.body,
    icon: "/petcamp-logo.png",
    badge: "/petcamp-logo.png",
    vibrate: [120, 60, 120],
    data: { url: data.url || "/painel" },
    tag: data.tag || undefined,
  }
  event.waitUntil(self.registration.showNotification(data.title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || "/painel"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})
