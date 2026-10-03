import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { api } from '../services/api';
import { X, Image as ImageIcon, Type, Mic, Video, Square, Play, Pause, Upload, Loader2, AlertCircle, Check } from 'lucide-react';

type StatusType = 'text' | 'image' | 'audio' | 'video';

const BG_GRADIENTS = [
  { name: 'Indigo Purple', value: 'from-indigo-600 to-purple-700' },
  { name: 'Rose Pink', value: 'from-pink-500 to-rose-600' },
  { name: 'Sunset Amber', value: 'from-amber-500 to-orange-600' },
  { name: 'Emerald Teal', value: 'from-emerald-600 to-teal-700' },
  { name: 'Ocean Cyan', value: 'from-blue-600 to-cyan-700' },
  { name: 'Dark Velvet', value: 'from-purple-900 via-slate-900 to-black' },
];

export const StatusCreateModal: React.FC = () => {
  const { createStatusOpen, setCreateStatusOpen, createStatus } = useChat();

  const [activeType, setActiveType] = useState<StatusType>('text');
  const [textContent, setTextContent] = useState('');
  const [selectedBg, setSelectedBg] = useState(BG_GRADIENTS[0].value);

  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [duration, setDuration] = useState<number>(0);

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset modal state
  useEffect(() => {
    if (createStatusOpen) {
      setActiveType('text');
      setTextContent('');
      setMediaUrl('');
      setCaption('');
      setDuration(0);
      setErrorMessage('');
      setAudioBlobUrl(null);
      setIsRecording(false);
      setRecordingSeconds(0);
    }
  }, [createStatusOpen]);

  // Handle recording timer & 60s limit auto-stop
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 59) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  if (!createStatusOpen) return null;

  const startRecording = async () => {
    setErrorMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlobUrl(url);

        // Upload recorded audio file
        const file = new File([blob], `voice_status_${Date.now()}.webm`, { type: 'audio/webm' });
        uploadFile(file, 'audio');
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingSeconds(0);
    } catch (err) {
      console.error('Microphone access error:', err);
      setErrorMessage('Microphone access denied or unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
  };

  const uploadFile = async (file: File, expectedType: 'image' | 'audio' | 'video') => {
    setErrorMessage('');
    setIsUploading(true);

    try {
      // Validate video / audio duration using HTML media elements before upload
      if (expectedType === 'video') {
        const videoEl = document.createElement('video');
        videoEl.preload = 'metadata';
        const fileUrl = URL.createObjectURL(file);

        await new Promise((resolve, reject) => {
          videoEl.onloadedmetadata = () => {
            URL.revokeObjectURL(fileUrl);
            if (videoEl.duration > 60.5) {
              reject(new Error(`Video duration is ${Math.round(videoEl.duration)}s. Maximum allowed duration is 60 seconds.`));
            } else {
              setDuration(Math.round(videoEl.duration));
              resolve(true);
            }
          };
          videoEl.onerror = () => reject(new Error('Failed to load video metadata.'));
          videoEl.src = fileUrl;
        });
      } else if (expectedType === 'audio') {
        const audioEl = document.createElement('audio');
        audioEl.preload = 'metadata';
        const fileUrl = URL.createObjectURL(file);

        await new Promise((resolve, reject) => {
          audioEl.onloadedmetadata = () => {
            URL.revokeObjectURL(fileUrl);
            if (audioEl.duration > 60.5) {
              reject(new Error(`Audio duration is ${Math.round(audioEl.duration)}s. Maximum allowed duration is 60 seconds.`));
            } else {
              setDuration(Math.round(audioEl.duration));
              resolve(true);
            }
          };
          audioEl.onerror = () => resolve(true); // fall through if webm duration is missing
          audioEl.src = fileUrl;
        });
      }

      const res = await api.uploadFile(file);
      setMediaUrl(res.url);
    } catch (err: any) {
      console.error('Upload error:', err);
      setErrorMessage(err.message || 'File upload failed');
      setMediaUrl('');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (activeType === 'image') {
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Please select a valid image file.');
        return;
      }
      uploadFile(file, 'image');
    } else if (activeType === 'video') {
      if (!file.type.startsWith('video/')) {
        setErrorMessage('Please select a valid video file.');
        return;
      }
      uploadFile(file, 'video');
    } else if (activeType === 'audio') {
      if (!file.type.startsWith('audio/')) {
        setErrorMessage('Please select a valid audio file.');
        return;
      }
      uploadFile(file, 'audio');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (activeType === 'text') {
      if (!textContent.trim()) {
        setErrorMessage('Please enter status text.');
        return;
      }
    } else {
      if (!mediaUrl) {
        setErrorMessage('Please upload or record media first.');
        return;
      }
    }

    if ((activeType === 'audio' || activeType === 'video') && duration > 60) {
      setErrorMessage('Media exceeds 60 seconds limit.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createStatus({
        type: activeType,
        content: activeType === 'text' ? textContent.trim() : mediaUrl,
        caption: activeType !== 'text' ? caption.trim() : undefined,
        bgColor: activeType === 'text' ? selectedBg : undefined,
        duration: activeType === 'audio' || activeType === 'video' ? (duration || recordingSeconds) : undefined,
      });

      setCreateStatusOpen(false);
    } catch (err: any) {
      console.error('Status create failed:', err);
      setErrorMessage(err.message || 'Failed to post status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            Create Status
          </h2>
          <button
            onClick={() => setCreateStatusOpen(false)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type Tabs */}
        <div className="grid grid-cols-4 p-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-sm font-medium">
          <button
            onClick={() => setActiveType('text')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
              activeType === 'text'
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Type className="w-4 h-4" />
            Text
          </button>
          <button
            onClick={() => setActiveType('image')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
              activeType === 'image'
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Image
          </button>
          <button
            onClick={() => setActiveType('audio')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
              activeType === 'audio'
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Mic className="w-4 h-4" />
            Voice
          </button>
          <button
            onClick={() => setActiveType('video')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
              activeType === 'video'
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Video className="w-4 h-4" />
            Video
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TEXT TAB */}
          {activeType === 'text' && (
            <div className="space-y-3">
              <div
                className={`w-full min-h-[180px] p-6 rounded-2xl bg-gradient-to-br ${selectedBg} flex items-center justify-center text-center shadow-inner transition-all`}
              >
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Type your status message..."
                  className="w-full bg-transparent text-white font-semibold text-lg sm:text-xl placeholder-white/70 text-center border-none outline-none resize-none focus:ring-0 max-h-[140px]"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                  Background Color
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {BG_GRADIENTS.map((bg) => (
                    <button
                      key={bg.value}
                      type="button"
                      onClick={() => setSelectedBg(bg.value)}
                      className={`w-8 h-8 rounded-full bg-gradient-to-br ${bg.value} shrink-0 border-2 transition-transform ${
                        selectedBg === bg.value ? 'border-white dark:border-gray-900 scale-110 ring-2 ring-indigo-500' : 'border-transparent hover:scale-105'
                      }`}
                      title={bg.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* IMAGE TAB */}
          {activeType === 'image' && (
            <div className="space-y-3">
              <div className="relative min-h-[180px] rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 flex flex-col items-center justify-center p-4 overflow-hidden">
                {mediaUrl ? (
                  <div className="relative w-full max-h-[220px] rounded-xl overflow-hidden group">
                    <img src={mediaUrl} alt="Status Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setMediaUrl('')}
                      className="absolute top-2 right-2 p-1.5 bg-black/70 text-white rounded-full hover:bg-black transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    {isUploading ? (
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                    ) : (
                      <>
                        <ImageIcon className="w-10 h-10 text-gray-400 mx-auto" />
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            Upload an image
                          </button>{' '}
                          or paste URL below
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="space-y-2">
                <input
                  type="text"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="Or enter image URL directly..."
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption (optional)..."
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* AUDIO / VOICE TAB */}
          {activeType === 'audio' && (
            <div className="space-y-4">
              <div className="p-6 bg-gradient-to-br from-indigo-900 to-purple-950 text-white rounded-2xl flex flex-col items-center justify-center text-center gap-4">
                <div className="text-sm font-medium text-indigo-200">
                  Maximum Audio Duration: <span className="font-bold text-white">60 seconds</span>
                </div>

                {isRecording ? (
                  <div className="space-y-3">
                    <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center animate-pulse mx-auto shadow-lg">
                      <Mic className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-2xl font-mono font-bold">
                      00:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds} / 00:60
                    </div>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-5 py-2 bg-white text-red-600 hover:bg-red-50 rounded-xl font-semibold text-sm flex items-center gap-2 mx-auto transition-colors shadow-md"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      Stop Recording
                    </button>
                  </div>
                ) : mediaUrl ? (
                  <div className="space-y-3 w-full">
                    <div className="p-3 bg-white/10 rounded-xl flex items-center justify-between">
                      <span className="text-xs text-indigo-200">Audio Recorded ({duration || recordingSeconds}s)</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (audioPreviewRef.current) {
                            if (isPlayingPreview) {
                              audioPreviewRef.current.pause();
                              setIsPlayingPreview(false);
                            } else {
                              audioPreviewRef.current.play();
                              setIsPlayingPreview(true);
                            }
                          }
                        }}
                        className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-full text-white transition-colors"
                      >
                        {isPlayingPreview ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <audio
                        ref={audioPreviewRef}
                        src={audioBlobUrl || mediaUrl}
                        onEnded={() => setIsPlayingPreview(false)}
                        className="hidden"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMediaUrl('');
                        setAudioBlobUrl(null);
                        setRecordingSeconds(0);
                      }}
                      className="text-xs text-indigo-300 hover:text-white underline"
                    >
                      Re-record or change audio
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={startRecording}
                      className="w-16 h-16 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center mx-auto shadow-lg transition-transform hover:scale-105"
                    >
                      <Mic className="w-8 h-8 text-white" />
                    </button>
                    <div className="text-sm font-semibold">Click to Record Voice Status</div>
                    <div className="text-xs text-indigo-300">or upload audio file below (max 60s)</div>
                  </div>
                )}
              </div>

              {!isRecording && !mediaUrl && (
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Audio File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          )}

          {/* VIDEO TAB */}
          {activeType === 'video' && (
            <div className="space-y-3">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-xl text-xs text-indigo-700 dark:text-indigo-300">
                🎥 <strong>Video Requirement:</strong> Maximum duration is <strong>60 seconds</strong>. Videos longer than 60 seconds will be rejected automatically.
              </div>

              <div className="relative min-h-[180px] rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 flex flex-col items-center justify-center p-4 overflow-hidden">
                {mediaUrl ? (
                  <div className="relative w-full max-h-[220px] rounded-xl overflow-hidden group bg-black">
                    <video src={mediaUrl} controls className="w-full max-h-[220px] object-contain" />
                    <button
                      type="button"
                      onClick={() => setMediaUrl('')}
                      className="absolute top-2 right-2 p-1.5 bg-black/70 text-white rounded-full hover:bg-black transition-colors z-10"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    {isUploading ? (
                      <div className="space-y-2">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                        <div className="text-xs text-gray-500">Checking duration & uploading...</div>
                      </div>
                    ) : (
                      <>
                        <Video className="w-10 h-10 text-gray-400 mx-auto" />
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            Upload video
                          </button>{' '}
                          (max 60 seconds)
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="space-y-2">
                <input
                  type="text"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="Or enter video URL directly..."
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption (optional)..."
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setCreateStatusOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || isSubmitting || isRecording}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-sm flex items-center gap-2 transition-colors"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Post Status
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
