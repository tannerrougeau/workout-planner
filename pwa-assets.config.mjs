// Generates the app icons from public/icon.svg: npx @vite-pwa/assets-generator@2.0.0
// The icon is a full-bleed square, so maskable and Apple icons need no padding.
export default {
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, "favicon.ico"]] },
    maskable: { sizes: [512], padding: 0 },
    apple: { sizes: [180], padding: 0 },
  },
  images: ["public/icon.svg"],
};
