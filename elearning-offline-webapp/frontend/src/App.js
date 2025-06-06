import React, { useState, useEffect } from 'react';
import './App.css';

const DB_NAME = "offlineVideosDB";
const STORE_NAME = "videos";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => reject("Error opening DB: " + event.target.errorCode);
    request.onsuccess = (event) => resolve(event.target.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

async function saveVideo(videoObject) { // videoObject should include id, title, blob
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(videoObject);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject("Error saving video: " + event.target.errorCode);
  });
}

async function getDownloadedVideo(videoId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(videoId);
    request.onsuccess = () => resolve(request.result); // result will be the videoObject or undefined
    request.onerror = (event) => reject("Error getting video: " + event.target.errorCode);
  });
}

function App() {
  const [videos, setVideos] = useState([]);
  const [error, setError] = useState(null);
  const [downloadedStatus, setDownloadedStatus] = useState({});
  const [currentPlayingVideo, setCurrentPlayingVideo] = useState(null);

  useEffect(() => {
    fetch('http://localhost/elearning-offline-webapp/backend/index.php')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        setVideos(data);
        data.forEach(video => {
          checkIfDownloaded(video.id);
        });
      })
      .catch(error => {
        console.error('Error fetching videos:', error);
        setError(error.message);
      });
  }, []);

  // Cleanup object URLs when component unmounts or currentPlayingVideo changes
  useEffect(() => {
    return () => {
      if (currentPlayingVideo && currentPlayingVideo.blob && currentPlayingVideo.objectURL) {
        URL.revokeObjectURL(currentPlayingVideo.objectURL);
      }
    };
  }, [currentPlayingVideo]);

  const checkIfDownloaded = async (videoId) => {
    try {
      const videoData = await getDownloadedVideo(videoId);
      setDownloadedStatus(prevStatus => ({ ...prevStatus, [videoId]: !!videoData }));
    } catch (err) {
      console.error('Error checking download status for video ID ' + videoId + ':', err);
      setDownloadedStatus(prevStatus => ({ ...prevStatus, [videoId]: false }));
    }
  };

  const handleDownload = async (video) => {
    console.log(`Attempting to download: ${video.title} from ${video.url}`);
    try {
      if (downloadedStatus[video.id]) {
        alert(`${video.title} is already downloaded.`);
        return;
      }
      const response = await fetch(video.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`);
      }
      const blob = await response.blob();
      console.log(`Video fetched as blob: ${video.title}`, blob);
      await saveVideo({ id: video.id, title: video.title, blob: blob, originalUrl: video.url });
      alert(`${video.title} downloaded and saved successfully!`);
      setDownloadedStatus(prevStatus => ({ ...prevStatus, [video.id]: true }));
    } catch (err) {
      console.error(`Error during download process for ${video.title}:`, err);
      alert(`Failed to download ${video.title}.`);
    }
  };

  const handlePlayVideo = async (video) => {
    // If there's an existing object URL, revoke it before playing a new one or switching to online
    if (currentPlayingVideo && currentPlayingVideo.blob && currentPlayingVideo.objectURL) {
      URL.revokeObjectURL(currentPlayingVideo.objectURL);
    }

    try {
      const downloadedVideo = await getDownloadedVideo(video.id);
      if (downloadedVideo && downloadedVideo.blob) {
        const objectURL = URL.createObjectURL(downloadedVideo.blob);
        setCurrentPlayingVideo({ ...downloadedVideo, objectURL: objectURL });
        console.log(`Playing offline: ${video.title}`, objectURL);
      } else {
        setCurrentPlayingVideo({ ...video, objectURL: video.url }); // Use original URL (ensure video object has .url)
        console.log(`Playing online: ${video.title}`, video.url);
      }
    } catch (err) {
      console.error('Error preparing video for playback:', err);
      alert('Could not prepare video for playback. Playing online if possible.');
      setCurrentPlayingVideo({ ...video, objectURL: video.url });
    }
  };

  const handleClosePlayer = () => {
    if (currentPlayingVideo && currentPlayingVideo.blob && currentPlayingVideo.objectURL) {
      URL.revokeObjectURL(currentPlayingVideo.objectURL);
    }
    setCurrentPlayingVideo(null);
  };

  if (error) {
    return <div className="App">Error: {error}</div>;
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Available Videos</h1>
      </header>

      {currentPlayingVideo && currentPlayingVideo.objectURL && (
        <div className="video-player-section">
          <h3>Now Playing: {currentPlayingVideo.title}</h3>
          <video key={currentPlayingVideo.objectURL} controls autoPlay src={currentPlayingVideo.objectURL} width="600">
            Your browser does not support the video tag.
          </video>
          <button onClick={handleClosePlayer}>Close Player</button>
        </div>
      )}

      {videos.length > 0 ? (
        <ul>
          {videos.map(video => (
            <li key={video.id}>
              <h2>{video.title}</h2>
              <p>
                <a href={video.url} target="_blank" rel="noopener noreferrer" onClick={(e) => {
                  // Prevent direct navigation if we are going to play it in our player
                  if (currentPlayingVideo && currentPlayingVideo.id === video.id) e.preventDefault();
                }}>
                  Watch Video Online (Link)
                </a>
              </p>
              <button onClick={() => handlePlayVideo(video)}>Play</button>
              <button
                onClick={() => handleDownload(video)}
                disabled={downloadedStatus[video.id] === true}
              >
                {downloadedStatus[video.id] === true ? 'Downloaded' : 'Download for Offline'}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>Loading videos... or no videos available.</p>
      )}
    </div>
  );
}

export default App;
