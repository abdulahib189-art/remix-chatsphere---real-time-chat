import React from 'react';
import { X, Download } from 'lucide-react';
import { useChat } from '../context/ChatContext';

export const MediaLightbox: React.FC = () => {
  const { lightboxMedia, setLightboxMedia } = useChat();

  if (!lightboxMedia) return null;

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-between p-4 select-none animate-fade-in"
      onClick={() => setLightboxMedia(null)}
    >
      {/* Header */}
      <div
        className="w-full flex items-center justify-between text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs font-semibold">{lightboxMedia.name || 'Media Preview'}</span>
        <div className="flex items-center gap-2">
          <a
            href={lightboxMedia.url}
            download={lightboxMedia.name || 'media'}
            className="p-2 hover:bg-white/20 rounded-full transition text-white"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </a>
          <button
            onClick={() => setLightboxMedia(null)}
            className="p-2 hover:bg-white/20 rounded-full transition text-white"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Image or Video */}
      <div
        className="max-w-4xl max-h-[80vh] flex items-center justify-center overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {lightboxMedia.type === 'video' ? (
          <video
            src={lightboxMedia.url}
            controls
            autoPlay
            className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl"
          />
        ) : (
          <img
            src={lightboxMedia.url}
            alt={lightboxMedia.name || 'Preview'}
            className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
          />
        )}
      </div>

      <div />
    </div>
  );
};
