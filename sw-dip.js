// The service worker the app registers: the Angular service worker, unchanged,
// plus `Document-Isolation-Policy: isolate-and-credentialless` on every
// navigation response. GitHub Pages cannot send headers, and the header makes the
// page cross-origin isolated, which multithreaded WASM inference needs
// (SharedArrayBuffer). A document is isolated only when its own load went
// through this worker: the first visit and a hard reload are not.
//
// COOP + COEP would isolate too, but they block the iframes of Stripe's embedded
// checkout; this policy does not.
//
// To retire it, publish Angular's `safety-worker.js` under this name: the
// browser only ever updates the script URL it registered.

const POLICY = 'isolate-and-credentialless';
const answered = new WeakSet();

function withPolicy(response) {
  // Redirects and network errors must reach the browser untouched.
  if (!response || response.type === 'opaqueredirect' || response.type === 'error') return response;
  try {
    const headers = new Headers(response.headers);
    headers.set('Document-Isolation-Policy', POLICY);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch {
    return response;
  }
}

// Registered before ngsw, so it runs first.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.mode === 'navigate') {
    const respondWith = event.respondWith.bind(event);
    event.respondWith = (response) => {
      answered.add(event);
      respondWith(Promise.resolve(response).then(withPolicy));
    };
    return;
  }
  // Another origin's subresources (js.stripe.com, the API, gtag) load straight
  // from the page. Fetched by this worker, which is not isolated, they carry
  // credentials and the credentialless page refuses them (Stripe.js fails with
  // ERR_FAILED). Stopping here also keeps ngsw from sending its own copy of
  // the request, which it would otherwise do even for a POST.
  if (new URL(request.url).origin !== self.location.origin) {
    event.stopImmediatePropagation();
  }
});

importScripts('ngsw-worker.js');

// Registered after ngsw: navigations it leaves to the browser (safe mode,
// `ngsw-bypass`) still get the policy.
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate' && !answered.has(event)) event.respondWith(fetch(event.request));
});
