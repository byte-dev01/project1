import React, { useState, useRef } from "react";
import { Mic, MicOff, Play, Pause, Download, Trash2, FileText, Clock, User, Stethoscope } from "lucide-react";




const MedicalAudioTranscriber = ({ userId = "Dr. Smith" }) => {
  const [transcription, setTranscription] = useState("");
  const [summary, setSummary] = useState("");
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState("");
  const [timestamp, setTimestamp] = useState("");
  
  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);

  
  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      const recorder = new MediaRecorder(stream, { 
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4"
      });
      
      chunksRef.current = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      recorder.onstop = async () => {
        setProcessing(true);
        
        const mimeType = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(audioBlob);
        
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        await transcribeAudio(audioBlob);
        
        setProcessing(false);
        
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setTranscription("");
      setSummary("");
      setTimestamp("");
      setRecordingTime(0);
      startTimer();
      
    } catch (error) {
      console.error("Error accessing microphone:", error);
      setError("Could not access microphone. Please check permissions and try again.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecording(false);
      stopTimer();
    }
  };


const transcribeAudio = async (audioBlob) => {
  try {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    console.log('🎤 Sending transcription request...');
    console.log('📊 Audio blob size:', audioBlob.size, 'bytes');
    console.log('📡 Request URL: /api/transcribe');

    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });

    console.log('📥 Response status:', response.status);
    console.log('✅ Response ok:', response.ok);
    console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response text:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: `Server error: ${response.status} - ${response.statusText}` };
      }
      
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('🎉 Success response:', data);
    
    // Validate response structure
    if (!data.transcription && !data.summary) {
      console.warn('⚠️ Response missing expected fields:', data);
    }
    
    setTranscription(data.transcription || "No transcription received.");
    setSummary(data.summary || "No summary received.");
    setTimestamp(data.timestamp || new Date().toISOString());
    
  } catch (error) {
    console.error("💥 Transcription error:", error);
    console.error("💥 Error message:", error.message);
    console.error("💥 Error stack:", error.stack);
    
    if (error.message.includes('Failed to fetch')) {
      setError("Network error. Check if backend is running and proxy is configured.");
    } else {
      setError(`Transcription failed: ${error.message}`);
    }
  }
};

  const playAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const downloadAudio = () => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consultation-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const clearRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setAudioBlob(null);
    setTranscription("");
    setSummary("");
    setTimestamp("");
    setIsPlaying(false);
    setError("");
  };

  const renderSummary = (summaryText) => {
    if (!summaryText) return null;
    
    const sections = summaryText.split('###').filter(section => section.trim());
    
    return (
      <div className="space-y-3">
        {sections.map((section, index) => {
          const lines = section.trim().split('\n').filter(line => line.trim());
          if (lines.length === 0) return null;
          
          const title = lines[0].replace(/#+/g, '').trim();
          const content = lines.slice(1).join('\n').trim();
          
          let bgColor = "bg-blue-50";
          let borderColor = "border-blue-200";
          let textColor = "text-blue-800";
          
          if (title.includes('Chief Complaint')) {
            bgColor = "bg-red-50";
            borderColor = "border-red-200";
            textColor = "text-red-800";
          } else if (title.includes('Plan') || title.includes('Assessment')) {
            bgColor = "bg-green-50";
            borderColor = "border-green-200";
            textColor = "text-green-800";
          } else if (title.includes('Follow-up')) {
            bgColor = "bg-amber-50";
            borderColor = "border-amber-200";
            textColor = "text-amber-800";
          }
          
          return (
            <div key={index} className={`p-3 rounded-lg border ${bgColor} ${borderColor}`}>
              <h4 className={`font-semibold ${textColor} mb-2 text-sm`}>{title}</h4>
              {content && (
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {content}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx>{`
        @keyframes pulse-ring {
          0% {
            transform: scale(0.8);
            opacity: 1;
          }
          100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }
        
      `}</style>
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Medical Transcription</h1>
              <p className="text-sm text-gray-600">Patient Consultation Recording</p>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">{userId}</span> • {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recording Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-6">Recording</h2>
              
              <div className="text-center">
                <div className="relative inline-block mb-6">
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    disabled={processing}
                  >
                    {processing ? (
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                    ) : recording ? (
                      <MicOff className="w-8 h-8 text-white mx-auto" />
                    ) : (
                      <Mic className="w-8 h-8 text-white mx-auto" />
                    )}
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    {processing ? "Processing..." : recording ? "Recording..." : "Ready to record"}
                  </p>
                  {recording && (
                    <div className="text-2xl font-mono text-red-600">
                      {formatTime(recordingTime)}
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-500">
                  {recording ? "Click to stop recording" : "Click to start recording"}
                </p>
              </div>
            </div>

            {/* Audio Controls */}
            {audioUrl && (
              <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Audio Controls</h3>
                <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />
                
                <div className="flex space-x-2">
                  <button
                    onClick={playAudio}
                    className="flex items-center px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                  
                  <button
                    onClick={downloadAudio}
                    className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Save
                  </button>
                  
                  <button
                    onClick={clearRecording}
                    className="flex items-center px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Transcription and Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Transcription */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Transcription
                </h3>
              </div>
              <div className="p-6">
                <div className="min-h-[120px] max-h-[300px] overflow-y-auto">
                  {processing ? (
                    <div className="flex items-center text-gray-500">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mr-2"></div>
                      Processing audio transcription...
                    </div>
                  ) : (
                    <p className="text-gray-700 leading-relaxed">
                      {transcription || "Start recording to generate transcription..."}
                    </p>
                  )}
                </div>
                {timestamp && (
                  <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date(timestamp).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* Medical Summary */}
            {summary && (
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    Clinical Summary
                  </h3>
                </div>
                <div className="p-6">
                  <div className="max-h-[500px] overflow-y-auto">
                    {renderSummary(summary)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicalAudioTranscriber;