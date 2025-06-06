// Simplified IndexedDB helpers for Service Worker
const DB_NAME_SW = "offlineVideosDB";
const STORE_NAME_SW = "videos";
const DB_VERSION_SW = 1;

function openDB_SW() {
  return new Promise((resolve, reject) => {
    const request = self.indexedDB.open(DB_NAME_SW, DB_VERSION_SW);
    request.onerror = (event) => reject("Error opening DB in SW: " + event.target.errorCode);
    request.onsuccess = (event) => resolve(event.target.result);
    // SW can't create/upgrade schema if App.js does it, versioning must be careful.
    // Assume App.js handles onupgradeneeded.
  });
}

async function getDownloadedVideo_SW(videoId) { // videoId here is likely the original URL if SW intercepts based on that
  try {
    const db = await openDB_SW();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(STORE_NAME_SW)) {
        // This can happen if App.js hasn't run yet to create the store
        console.warn(`SW: Object store ${STORE_NAME_SW} not found. App might need to initialize DB first.`);
        reject(`Store ${STORE_NAME_SW} not found.`);
        return;
      }
      const transaction = db.transaction([STORE_NAME_SW], "readonly");
      const store = transaction.objectStore(STORE_NAME_SW);
      // Assuming video 'id' in IndexedDB is the unique identifier (e.g. video.id from API)
      // The SW fetch interceptor might get the full URL. We need a way to map this URL to the ID
      // or store videos by URL in IDB, or parse ID from URL if possible.
      // For simplicity, let's assume we stored videos with their original URL as their ID in IDB for this example.
      // Or that App.js stores by ID, and SW can derive ID from URL.
      // For this example, let's assume the ID passed to getDownloadedVideo_SW is the one used in IDB.
      const request = store.get(videoId); // This 'videoId' needs to be the keyPath value.
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject("SW: Error getting video: " + event.target.errorCode);
    });
  } catch (error) {
      console.error("SW: Error in getDownloadedVideo_SW:", error);
      return Promise.reject(error);
  }
}

// Regex to identify our video URLs (adjust as needed)
// This is a placeholder; actual URLs are http://example.com/videoX.mp4
const videoUrlPattern = /http:\/\/example\.com\/video\d+\.mp4$/;

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Check if it's a request for one of our videos
  // And it's a GET request
  if (event.request.method === 'GET' && videoUrlPattern.test(url.href)) {
    event.respondWith(
      (async () => {
        try {
          // The ID stored in IndexedDB is video.id (e.g., 1, 2, 3)
          // We need to extract this ID from the URL.
          const match = url.pathname.match(/video(\d+)\.mp4$/);
          if (match && match[1]) {
            const videoId = parseInt(match[1], 10);
            const videoData = await getDownloadedVideo_SW(videoId);
            if (videoData && videoData.blob) {
              console.log(`SW: Serving video '${videoData.title}' from IndexedDB for URL: ${url.href}`);
              // Ensure correct Content-Type for the blob response
              // The blob itself should have its type, but we can be explicit.
              // Common video types: 'video/mp4', 'video/webm', etc.
              // Assuming MP4 for this example.
              const headers = {
                'Content-Type': videoData.blob.type || 'video/mp4',
                'Content-Length': videoData.blob.size,
              };
              return new Response(videoData.blob, { headers });
            }
          }
        } catch (error) {
          console.error(`SW: Error fetching video ${url.href} from IDB:`, error);
          // Fall through to network if IDB access fails or video not found
        }

        console.log(`SW: Video ${url.href} not in IDB or error, fetching from network.`);
        return fetch(event.request);
      })()
    );
  } else {
    // For non-video requests, or if the pattern doesn't match,
    // fall back to network. If using Workbox for precaching other assets,
    // this simple SW would need to be integrated with it, or ensure Workbox
    // generated SW doesn't also try to handle these video requests, or that this SW
    // correctly passes through requests not handled by it.
    // For this example, we assume this SW is primary for video URLs and other
    // requests should go to network if not caught by another SW rule (e.g. from CRA/Workbox)
    // To ensure other parts of the app work, especially if this SW replaces the default one,
    // it's safer to explicitly return fetch for unhandled requests if this is the *only* SW.
    // However, the prompt implies this might be *added* or *modifies* a CRA setup.
    // If this is the only fetch listener active, it should pass through:
    // return; // or return fetch(event.request); if it's the sole controller.
    // For safety in a standalone scenario:
    // if (!videoUrlPattern.test(url.href)) {
    //   return fetch(event.request);
    // }
    // But given CRA context, often the Workbox SW handles other things.
    // The current structure implies only video URLs are intercepted by *this* logic.
  }
});

// Add basic install/activate listeners for SW lifecycle
self.addEventListener('install', (event) => {
  console.log('SW: Install event');
  // event.waitUntil(self.skipWaiting()); // Optional: activate new SW faster
});

self.addEventListener('activate', (event) => {
  console.log('SW: Activate event');
  // event.waitUntil(self.clients.claim()); // Optional: take control of open clients faster
});
