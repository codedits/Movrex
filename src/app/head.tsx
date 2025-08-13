export default function Head() {
  return (
    <>
      <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://image.tmdb.org" />
      <link rel="preconnect" href="https://api.bk9.dev" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://api.bk9.dev" />
      {/* Increase image priority by hinting fetch of common sizes */}
      <link rel="preload" as="image" href="https://image.tmdb.org/t/p/w1280" />
      <meta name="format-detection" content="telephone=no" />
      <meta name="mobile-web-app-capable" content="yes" />
    </>
  );
}



