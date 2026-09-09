export const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Acme Widgets — Quality widgets for everyone</title>
  <meta name="description" content="Acme sells the best widgets in the world, hand crafted with love and shipped worldwide within 24 hours.">
  <link rel="canonical" href="https://acme.test/">
  <link rel="icon" href="/favicon.ico">
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
  <link rel="preload" as="font" href="/fonts/inter.woff2" crossorigin>
  <meta property="og:title" content="Acme Widgets">
  <meta property="og:description" content="Best widgets">
  <meta property="og:image" content="https://acme.test/og.png">
  <meta property="og:url" content="https://acme.test/">
  <meta name="twitter:card" content="summary_large_image">
  <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-ABCDEF1234"></script>
  <script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('config', 'G-ABCDEF1234');</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme"}</script>
  <style>@font-face { font-family: Inter; src: url(/fonts/inter.woff2); } @media (max-width: 600px) { .hero { padding: 0 !important; } }</style>
</head>
<body>
  <header id="top" class="site-header">
    <img src="/logo.svg" alt="Acme logo" width="120" height="40">
    <nav class="main-nav">
      <a href="/">Home</a>
      <a href="/products">Products</a>
      <a href="/about">About</a>
      <a href="https://twitter.com/acme" target="_blank">Twitter</a>
      <a href="#features">Features</a>
      <a href="mailto:hi@acme.test">Email</a>
      <a href="tel:+123456789">Call</a>
    </nav>
  </header>
  <main>
    <section id="hero" class="hero container">
      <h1>Widgets you can trust</h1>
      <p>We make widgets.</p>
      <a href="/signup" class="btn btn-primary">Get started</a>
      <a href="/docs">Click here</a>
    </section>
    <section id="features">
      <h3>Feature list</h3>
      <div class="row">
        <div class="card col-md-4"><h4>Fast</h4><p>Very fast.</p></div>
        <div class="card col-md-4"><h4>Cheap</h4><p>Very cheap.</p></div>
        <div class="card col-md-4"><h4>Good</h4><p>Very good.</p></div>
      </div>
      <img src="/photo.jpg" loading="lazy">
      <img src="/deco.png" alt="">
    </section>
    <form action="/subscribe" method="post">
      <label for="email">Email</label>
      <input id="email" type="email" name="email">
      <input type="text" name="name" placeholder="Name">
      <button type="submit">Subscribe</button>
      <button type="button"><svg viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg></button>
    </form>
  </main>
  <footer>
    <p>&copy; Acme</p>
    <a href="javascript:void(0)">Legacy</a>
    <iframe src="https://www.youtube.com/embed/xyz"></iframe>
  </footer>
  <script src="/js/app.js" defer></script>
  <script type="module" src="/js/module.js"></script>
</body>
</html>`;

export const MINIMAL_HTML = `<html><head></head><body><div><div><div><span>deep</span></div></div></div><img src="a.png"></body></html>`;
