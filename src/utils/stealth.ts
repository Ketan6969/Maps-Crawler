export const stealthScript = `
  // Overwrite the navigator.webdriver property
  Object.defineProperty(navigator, 'webdriver', {
    get: () => false,
  });

  // Mock plugins to mimic a real browser
  Object.defineProperty(navigator, 'plugins', {
    get: () => [
      {
        0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: Plugin },
        description: "Portable Document Format",
        filename: "internal-pdf-viewer",
        length: 1,
        name: "Chrome PDF Plugin"
      },
      {
        0: { type: "application/pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: Plugin },
        description: "Portable Document Format",
        filename: "internal-pdf-viewer",
        length: 1,
        name: "Chrome PDF Viewer"
      },
      {
        0: { type: "application/x-nacl", suffixes: "", description: "Native Client Executable", enabledPlugin: Plugin },
        1: { type: "application/x-pnacl", suffixes: "", description: "Portable Native Client Executable", enabledPlugin: Plugin },
        description: "",
        filename: "internal-nacl-plugin",
        length: 2,
        name: "Native Client"
      }
    ],
  });

  // Overwrite languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-IN', 'en-US', 'en'],
  });

  // Prevent generic headless User-Agent behavior if queried
  const originalUserAgent = navigator.userAgent;
  Object.defineProperty(navigator, 'userAgent', {
    get: () => originalUserAgent.replace('HeadlessChrome', 'Chrome'),
  });
  
  // Hardware concurrency
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    get: () => 8,
  });
  
  // Platform
  Object.defineProperty(navigator, 'platform', {
    get: () => 'Win32',
  });
`;
