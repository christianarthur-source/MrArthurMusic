import React, { useState } from 'react';
import { Mic, Square, Play, Sparkles, X, Volume2, AlertTriangle } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { containsProfanity } from '../utils/profanityFilter';

interface VoiceRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSampleSaved: (buffer: AudioBuffer, pitch: number, sampleName: string) => void;
}

export const VoiceRecorderModal: React.FC<VoiceRecorderModalProps> = ({
  isOpen,
  onClose,
  onSampleSaved,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBuffer, setRecordedBuffer] = useState<AudioBuffer | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<number>(1.0);
  const [voiceName, setVoiceName] = useState('My Silly Voice');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleStartRecord = async () => {
    setErrorMsg(null);
    setNameError(null);
    try {
      setIsRecording(true);
      setCountdown(2);

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev && prev > 1) return prev - 1;
          clearInterval(timer);
          return null;
        });
      }, 1000);

      const buffer = await soundEngine.recordMicSample(2);
      setRecordedBuffer(buffer);
      setIsRecording(false);
      setCountdown(null);
    } catch (err: unknown) {
      console.error(err);
      setIsRecording(false);
      setCountdown(null);
      setErrorMsg('Could not access microphone. Make sure microphone permission is allowed in your browser!');
    }
  };

  const handlePreview = (pitch = selectedPitch) => {
    if (!recordedBuffer) return;
    soundEngine.playSound('custom-mic', 0, 1.0, pitch, recordedBuffer);
  };

  const handleSave = () => {
    if (!recordedBuffer) return;

    // Check profanity filter
    if (containsProfanity(voiceName)) {
      setNameError('Please keep names school-friendly and kind! Inappropriate language is blocked.');
      return;
    }

    const trimmed = voiceName.trim() || 'My Voice';
    onSampleSaved(recordedBuffer, selectedPitch, trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-3xl border-4 border-pink-400 bg-slate-900 p-6 text-white shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 text-2xl shadow-lg">
            🎤
          </div>
          <div>
            <h2 className="text-2xl font-black text-pink-400">Record Your Own Sound!</h2>
            <p className="text-sm font-medium text-slate-300">
              Make a silly noise, say your name, roar like a dinosaur, or beatbox!
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-2xl bg-rose-500/20 p-3 text-sm text-rose-300 border border-rose-500/50">
            {errorMsg}
          </div>
        )}

        {/* Big Record Center Button */}
        <div className="my-6 flex flex-col items-center justify-center">
          <button
            onClick={handleStartRecord}
            disabled={isRecording}
            className={`group relative flex h-32 w-32 flex-col items-center justify-center rounded-full border-4 transition-all duration-200 active:scale-95 ${
              isRecording
                ? 'animate-pulse border-red-500 bg-red-600 shadow-[0_0_40px_rgba(239,68,68,0.8)]'
                : 'border-pink-300 bg-gradient-to-b from-pink-500 to-rose-600 shadow-[0_10px_30px_rgba(244,63,94,0.5)] hover:scale-105'
            }`}
          >
            {isRecording ? (
              <>
                <Square className="h-10 w-10 text-white" />
                <span className="mt-1 text-xs font-black uppercase tracking-wider text-white">
                  {countdown !== null ? `${countdown}s...` : 'Recording!'}
                </span>
              </>
            ) : (
              <>
                <Mic className="h-10 w-10 text-white group-hover:scale-110 transition-transform" />
                <span className="mt-1 text-xs font-black uppercase tracking-wider text-white">
                  {recordedBuffer ? 'Re-Record' : 'Tap to Record'}
                </span>
              </>
            )}
          </button>
          <span className="mt-3 text-sm font-bold text-slate-400">
            {isRecording ? 'Speak or make sound now! (2 seconds)' : 'Tap button to start 2-second capture'}
          </span>
        </div>

        {/* If Sample recorded, show Modifiers */}
        {recordedBuffer && (
          <div className="space-y-4 rounded-2xl bg-slate-800/80 p-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                Choose Voice Filter:
              </span>
              <button
                onClick={() => handlePreview()}
                className="flex items-center gap-1.5 rounded-full bg-pink-500 px-3 py-1 text-xs font-extrabold text-white hover:bg-pink-400"
              >
                <Play className="h-3 w-3 fill-white" />
                Listen
              </button>
            </div>

            {/* Pitch / Character Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setSelectedPitch(1.6);
                  handlePreview(1.6);
                }}
                className={`flex flex-col items-center rounded-xl p-3 border-2 transition-all ${
                  selectedPitch === 1.6
                    ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300 font-black scale-102'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <span className="text-2xl">🐿️</span>
                <span className="mt-1 text-xs font-bold">Chipmunk</span>
                <span className="text-[10px] text-slate-400">High & Fast</span>
              </button>

              <button
                onClick={() => {
                  setSelectedPitch(1.0);
                  handlePreview(1.0);
                }}
                className={`flex flex-col items-center rounded-xl p-3 border-2 transition-all ${
                  selectedPitch === 1.0
                    ? 'border-pink-400 bg-pink-500/20 text-pink-300 font-black scale-102'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <span className="text-2xl">🧒</span>
                <span className="mt-1 text-xs font-bold">Normal You</span>
                <span className="text-[10px] text-slate-400">Original Sound</span>
              </button>

              <button
                onClick={() => {
                  setSelectedPitch(0.68);
                  handlePreview(0.68);
                }}
                className={`flex flex-col items-center rounded-xl p-3 border-2 transition-all ${
                  selectedPitch === 0.68
                    ? 'border-purple-400 bg-purple-500/20 text-purple-300 font-black scale-102'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <span className="text-2xl">👾</span>
                <span className="mt-1 text-xs font-bold">Giant Monster</span>
                <span className="text-[10px] text-slate-400">Deep & Heavy</span>
              </button>
            </div>

            {/* Label input */}
            <div>
              <label className="text-xs font-bold text-slate-400">Name this sound:</label>
              <input
                type="text"
                value={voiceName}
                onChange={(e) => {
                  setVoiceName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                maxLength={18}
                className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm font-bold text-white focus:outline-none ${
                  nameError || containsProfanity(voiceName)
                    ? 'border-rose-500 bg-rose-950/40 focus:border-rose-400 ring-2 ring-rose-500/30'
                    : 'border-slate-700 bg-slate-900 focus:border-pink-500'
                }`}
              />
              {(nameError || containsProfanity(voiceName)) && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-rose-400 animate-fadeIn">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {nameError || 'Please keep sound names school-appropriate! Profanity is blocked.'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-2xl bg-slate-800 px-5 py-2.5 font-bold text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!recordedBuffer}
            className={`flex items-center gap-2 rounded-2xl px-6 py-2.5 font-black text-white shadow-lg transition-transform active:scale-95 ${
              recordedBuffer
                ? 'bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500'
                : 'cursor-not-allowed bg-slate-800 text-slate-500'
            }`}
          >
            <Volume2 className="h-5 w-5" />
            Add To Beat!
          </button>
        </div>
      </div>
    </div>
  );
};
