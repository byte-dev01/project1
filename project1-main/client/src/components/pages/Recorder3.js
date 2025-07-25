
import React, { useState, useRef } from "react";

const MedicalAudioTranscriber = ({ userId = "Rachel" }) => {
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
  const [hasRecorded, setHasRecorded] = useState(false);
  const [activeTab, setActiveTab] = useState("record");
  
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
        setHasRecorded(true);
        
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

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: `Server error: ${response.status} - ${response.statusText}` };
        }
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setTranscription(data.transcription || "No transcription received.");
      setSummary(data.summary || "No summary received.");
      setTimestamp(data.timestamp || new Date().toISOString());
      
    } catch (error) {
      console.error("Transcription error:", error);
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
    setRecordingTime(0);
    setHasRecorded(false);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FAF7F0' }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#FAF7F0',
        borderBottom: '1px solid #000',
        padding: '24px 80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#000',
            margin: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}>
            Medical Transcription
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <span style={{ color: '#171717', fontSize: '16px' }}>{userId}</span>
          <button style={{
            backgroundColor: 'transparent',
            border: 'none',
            padding: '8px 16px',
            fontSize: '16px',
            color: '#171717',
            cursor: 'pointer',
            borderRadius: '8px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#fff'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}>
            About
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 20px',
        gap: '20px'
      }}>
        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: '#EF4444',
            color: 'white',
            padding: '8px 16px 8px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            maxWidth: '400px',
            position: 'relative',
            paddingRight: '48px'
          }}>
            {error}
            <button
              onClick={() => setError("")}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          backgroundColor: 'white',
          padding: '4px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          gap: '4px'
        }}>
          <button
            onClick={() => setActiveTab('upload')}
            style={{
              padding: '8px 24px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'upload' ? 'rgba(77, 100, 255, 0.1)' : 'transparent',
              color: activeTab === 'upload' ? '#4D64FF' : '#6B7280',
              fontSize: '15px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: '164px'
            }}
          >
            Upload
          </button>
          <button
            onClick={() => setActiveTab('record')}
            style={{
              padding: '8px 24px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'record' ? 'rgba(77, 100, 255, 0.1)' : 'transparent',
              color: activeTab === 'record' ? '#4D64FF' : '#6B7280',
              fontSize: '15px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: '164px'
            }}
          >
            Record
          </button>
          <button
            onClick={() => setActiveTab('link')}
            style={{
              padding: '8px 24px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'link' ? 'rgba(77, 100, 255, 0.1)' : 'transparent',
              color: activeTab === 'link' ? '#4D64FF' : '#6B7280',
              fontSize: '15px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: '164px'
            }}
          >
            From link
          </button>
        </div>

        {/* Main Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '24px',
          padding: '40px',
          minHeight: '608px',
          width: '90%',
          maxWidth: '1180px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          position: 'relative',
          textAlign: 'center'
        }}>
          {/* AI Powered Badge */}
          <div style={{
            position: 'absolute',
            right: '40px',
            top: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{
              fontSize: '14px',
              fontWeight: '500',
              background: 'linear-gradient(20deg, rgb(77, 200, 105), rgb(77, 100, 255))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              AI powered
            </span>
          </div>

          {activeTab === 'record' && !hasRecorded && !processing && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: '96px',
              minHeight: '568px'
            }}>
              <div style={{ marginBottom: '24px' }}>
                <svg width="240" height="74" viewBox="0 0 240 74" fill="none">
                  <rect x="20" y="10" width="200" height="54" rx="27" fill="#E5E7EB"/>
                  <circle cx="120" cy="37" r="20" fill="#6B7280"/>
                  {recording && (
                    <circle cx="120" cy="37" r="30" fill="none" stroke="#EF4444" strokeWidth="2" opacity="0.5">
                      <animate attributeName="r" from="20" to="40" dur="1.5s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite"/>
                    </circle>
                  )}
                </svg>
              </div>

              <h1 style={{
                fontSize: '50px',
                fontWeight: '400',
                color: '#000',
                margin: '0 0 24px 0',
                letterSpacing: '-2px',
                lineHeight: '60px'
              }}>
                Record medical consultation
              </h1>

              <div style={{
                display: 'flex',
                gap: '24px',
                marginBottom: '32px'
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '16px',
                  color: '#6B7280',
                  cursor: 'pointer'
                }}>
                  <input type="checkbox" defaultChecked />
                  Record live microphone
                </label>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '16px',
                  color: '#6B7280',
                  cursor: 'pointer'
                }}>
                  <input type="checkbox" defaultChecked />
                  Include medical summary
                </label>
              </div>

              {recording && (
                <div style={{
                  fontSize: '24px',
                  fontWeight: '600',
                  color: '#EF4444',
                  marginBottom: '24px'
                }}>
                  {formatTime(recordingTime)}
                </div>
              )}

              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={processing}
                style={{
                  backgroundColor: '#EF4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '16px 32px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: processing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  minWidth: '256px',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s',
                  opacity: processing ? 0.7 : 1
                }}
                onMouseEnter={(e) => !processing && (e.target.style.backgroundColor = '#DC2626')}
                onMouseLeave={(e) => !processing && (e.target.style.backgroundColor = '#EF4444')}
              >
                {processing ? (
                  <>Processing...</>
                ) : recording ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <rect x="6" y="6" width="3" height="8" rx="1"/>
                      <rect x="11" y="6" width="3" height="8" rx="1"/>
                    </svg>
                    Stop recording
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a3 3 0 100-6 3 3 0 000 6z"/>
                      <path d="M10 14c-2.21 0-4-1.79-4-4V6a4 4 0 118 0v4c0 2.21-1.79 4-4 4z"/>
                      <path d="M10 18v-3m-5-5.5a5 5 0 0010 0M10 18h2m-2 0H8"/>
                    </svg>
                    Start recording
                  </>
                )}
              </button>

              <p style={{
                fontSize: '12px',
                color: '#999',
                marginTop: '12px'
              }}>
                Max 1 hour recording
              </p>
            </div>
          )}

          {/* Processing State */}
          {processing && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '400px'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                border: '3px solid #E5E7EB',
                borderTopColor: '#4D64FF',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '24px'
              }}></div>
              <h2 style={{
                fontSize: '24px',
                color: '#171717',
                marginBottom: '8px'
              }}>Processing your recording...</h2>
              <p style={{
                fontSize: '16px',
                color: '#6B7280'
              }}>Transcribing audio and generating clinical summary</p>
            </div>
          )}

          {/* Transcription Results */}
          {hasRecorded && !processing && transcription && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              textAlign: 'left',
              width: '100%'
            }}>
              {/* Audio Player */}
              {audioUrl && (
                <div style={{
                  backgroundColor: '#F3F4F6',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} style={{ display: 'none' }} />
                    <button
                      onClick={playAudio}
                      style={{
                        backgroundColor: '#4D64FF',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '12px 24px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '16px',
                        fontWeight: '500'
                      }}
                    >
                      {isPlaying ? '⏸' : '▶'} {isPlaying ? 'Pause' : 'Play'}
                    </button>
                    <span style={{ color: '#6B7280', fontSize: '14px' }}>
                      Duration: {formatTime(recordingTime)}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={downloadAudio}
                      style={{
                        backgroundColor: '#6B7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '12px 24px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: '500'
                      }}
                    >
                      📥 Download
                    </button>
                    <button
                      onClick={clearRecording}
                      style={{
                        backgroundColor: '#EF4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '12px 24px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: '500'
                      }}
                    >
                      🗑️ Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Transcription */}
              <div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  marginBottom: '16px',
                  color: '#171717'
                }}>
                  Transcription
                </h3>
                <div style={{
                  backgroundColor: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  padding: '20px',
                  minHeight: '150px',
                  whiteSpace: 'pre-wrap',
                  color: '#374151',
                  fontSize: '15px',
                  lineHeight: '1.6',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  {transcription}
                </div>
                {timestamp && (
                  <div style={{
                    fontSize: '12px',
                    color: '#6B7280',
                    marginTop: '8px'
                  }}>
                    Generated: {new Date(timestamp).toLocaleString()}
                  </div>
                )}
              </div>

              {/* Medical Summary */}
              {summary && (
                <div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    marginBottom: '16px',
                    color: '#171717'
                  }}>
                    Clinical Summary
                  </h3>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {summary.split('###').filter(s => s.trim()).map((section, index) => {
                      const lines = section.trim().split('\n').filter(l => l.trim());
                      if (!lines.length) return null;
                      
                      const title = lines[0].replace(/#+/g, '').trim();
                      const content = lines.slice(1).join('\n').trim();
                      
                      return (
                        <div key={index} style={{
                          backgroundColor: '#F3F4F6',
                          borderRadius: '8px',
                          padding: '16px',
                          borderLeft: '4px solid #4D64FF'
                        }}>
                          <h4 style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#1E3A8A',
                            marginBottom: '8px'
                          }}>{title}</h4>
                          <p style={{
                            fontSize: '14px',
                            color: '#374151',
                            margin: 0,
                            whiteSpace: 'pre-wrap'
                          }}>{content}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Text */}
        <div style={{
          fontSize: '12px',
          color: '#6B7280',
          textAlign: 'center',
          marginTop: '24px'
        }}>
          By using this product, you agree to our Terms of Service and Privacy Policy.
        </div>
      </div>
      
      {/* Spin animation */}
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default MedicalAudioTranscriber;