import React, { useState, useRef } from "react";
import { Mic, MicOff, Play, Pause, Download, Trash2, FileText, Clock, User, Stethoscope } from "lucide-react";

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
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: `Server error: ${response.status} - ${response.statusText}` };
        }
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
    if (!data.transcription && !data.summary) {
      console.warn('⚠️ Response missing expected fields:', data);
    }

      console.log('🎉 Success response:', data);
      setTranscription(data.transcription || "No transcription received.");
      setSummary(data.summary || "No summary received.");
      setTimestamp(data.timestamp || new Date().toISOString());

    } catch (error) {
      console.error("Transcription error:", error);
      console.error("Error message:", error.message);
      console.error(" Error stack:", error.stack);

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

  // UCLA Health styles
  const styles = {
    root: {
      '--ucla-primary': '#2774AE',
      '--ucla-primary-dark': '#216394',
      '--ucla-primary-light': '#eef4f9',
      '--ucla-primary-lightest': '#f2f8fd',
      '--text-primary': '#363636',
      '--text-secondary': '#565656',
      '--text-subtle': '#767676',
      '--success': '#0f784a',
      '--warning': '#d80000',
      '--info': '#00a1db',
      '--bg-primary': '#ffffff',
      '--bg-secondary': '#f5f5f5',
      '--bg-hover': '#eef4f9',
      '--border-primary': '#dbdbdb',
      '--border-secondary': '#eaeaea',
      '--shadow-light': '0 1px 3px rgba(0,0,0,0.1)',
      '--shadow-medium': '0 2px 5px 0 rgba(0,0,0,0.2)',
      '--shadow-heavy': '0 4px 8px rgba(0,0,0,0.1)'
    },
    body: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      lineHeight: 1.6,
      minHeight: '100vh',
      margin: 0
    },
    header: {
      backgroundColor: 'var(--bg-primary)',
      boxShadow: 'var(--shadow-medium)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    },
    headerContent: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.5rem 2rem',
      maxWidth: '1400px',
      margin: '0 auto'
    },
    navLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '1.5rem'
    },
    menuButton: {
      background: 'var(--ucla-primary)',
      color: 'white',
      border: 'none',
      padding: '0.5rem 1rem',
      borderRadius: '4px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.9rem',
      transition: 'background-color 0.2s'
    },
    logo: {
      fontSize: '1.3rem',
      fontWeight: '600',
      color: 'var(--ucla-primary)',
      textDecoration: 'none'
    },
    headerRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    userMenu: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.25rem 0.75rem',
      background: 'transparent',
      borderRadius: '20px',
      cursor: 'pointer',
      transition: 'background-color 0.2s'
    },
    userAvatar: {
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      background: 'var(--ucla-primary)',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold',
      fontSize: '0.9rem'
    },
    mainContainer: {
      maxWidth: '1400px',
      margin: '1.5rem auto',
      padding: '0 2rem'
    },
    welcomeSection: {
      marginBottom: '1.5rem'
    },
    welcomeTitle: {
      color: 'var(--ucla-primary)',
      fontSize: '1.8rem',
      fontWeight: 'normal',
      marginBottom: '1.5rem'
    },
    feedItem: {
      background: 'var(--bg-primary)',
      borderRadius: '4px',
      padding: '1.25rem',
      marginBottom: '0.75rem',
      boxShadow: 'var(--shadow-medium)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      transition: 'box-shadow 0.2s'
    },
    feedContent: {
      flex: 1,
      display: 'flex',
      alignItems: 'center'
    },
    feedIcon: {
      width: '48px',
      height: '48px',
      background: 'var(--ucla-primary-lightest)',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: '1rem',
      color: 'var(--ucla-primary)',
      flexShrink: 0,
      fontSize: '24px'
    },
    feedHeader: {
      flex: 1
    },
    feedTitle: {
      fontWeight: '600',
      color: 'var(--text-primary)',
      marginBottom: '0.25rem',
      fontSize: '0.95rem'
    },
    feedDescription: {
      color: 'var(--text-subtle)',
      fontSize: '0.85rem',
      lineHeight: 1.4
    },
    feedActions: {
      display: 'flex',
      gap: '0.5rem',
      flexShrink: 0
    },
    btnPrimary: {
      background: 'var(--ucla-primary)',
      color: 'white',
      border: 'none',
      padding: '0.625rem 1.25rem',
      borderRadius: '4px',
      cursor: 'pointer',
      textDecoration: 'none',
      display: 'inline-block',
      fontSize: '0.875rem',
      fontWeight: '500',
      transition: 'background-color 0.2s'
    },
    btnSecondary: {
      background: 'var(--bg-primary)',
      color: 'var(--ucla-primary)',
      border: '1px solid var(--ucla-primary)',
      padding: '0.625rem 1.25rem',
      borderRadius: '4px',
      cursor: 'pointer',
      textDecoration: 'none',
      display: 'inline-block',
      fontSize: '0.875rem',
      fontWeight: '500',
      transition: 'all 0.2s'
    },
    alertItem: {
      borderLeft: '4px solid var(--warning)'
    },
    recordingCard: {
      background: 'var(--bg-primary)',
      borderRadius: '4px',
      padding: '2rem',
      boxShadow: 'var(--shadow-medium)',
      textAlign: 'center',
      minHeight: '300px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    },
    recordButton: {
      width: '120px',
      height: '120px',
      borderRadius: '50%',
      background: recording ? 'var(--warning)' : 'var(--ucla-primary)',
      color: 'white',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      fontSize: '48px',
      transition: 'all 0.3s ease',
      boxShadow: 'var(--shadow-heavy)',
      marginBottom: '1.5rem',
      position: 'relative'
    },
    pulseRing: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: '50%',
      border: '3px solid var(--warning)',
      animation: recording ? 'pulse 1.5s ease-out infinite' : 'none'
    },
    summarySection: {
      background: 'var(--bg-primary)',
      borderRadius: '4px',
      padding: '1.5rem',
      marginTop: '1rem',
      boxShadow: 'var(--shadow-light)'
    },
    sectionTitle: {
      fontSize: '1.1rem',
      color: 'var(--ucla-primary)',
      marginBottom: '1rem',
      fontWeight: '600'
    }
  };

  const pulseKeyframes = `
    @keyframes pulse {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      100% {
        transform: scale(1.3);
        opacity: 0;
      }
    }
  `;

  return (
    <div style={styles.root}>
      <style>{pulseKeyframes}</style>
      <div style={styles.body}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerContent}>
            <div style={styles.navLeft}>
              <button style={styles.menuButton}>
                <span>☰</span>
                <span>Menu</span>
              </button>
              <a href="#" style={styles.logo}>HealthBridge</a>
            </div>
            <div style={styles.headerRight}>
              <div style={styles.userMenu}>
                <div style={styles.userAvatar}>{userId.charAt(0).toUpperCase()}</div>
                <span>{userId}</span>
                <span style={{ fontSize: '0.7rem', marginLeft: '0.25rem' }}>▼</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div style={styles.mainContainer}>
          {/* Welcome Section */}
          <div style={styles.welcomeSection}>
            <h1 style={styles.welcomeTitle}>Clinical Notes - Audio Transcription</h1>
          </div>

          {/* Error Alert */}
          {error && (
            <div style={{ ...styles.feedItem, ...styles.alertItem, marginBottom: '1.5rem' }}>
              <div style={styles.feedContent}>
                <div style={{ ...styles.feedIcon, background: 'rgba(216, 0, 0, 0.1)', color: 'var(--warning)' }}>⚠️</div>
                <div style={styles.feedHeader}>
                  <div style={styles.feedTitle}>Recording Error</div>
                  <div style={styles.feedDescription}>{error}</div>
                </div>
              </div>
              <div style={styles.feedActions}>
                <button 
                  onClick={() => setError("")} 
                  style={styles.btnSecondary}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Recording Interface - Show only when not recorded yet or cleared */}
          {!hasRecorded && !processing && (
            <div style={styles.recordingCard}>
              <button
                onClick={recording ? stopRecording : startRecording}
                style={styles.recordButton}
                disabled={processing}
              >
                {recording ? <Square fill="currentColor" /> : <Mic />}                 <div style={styles.pulseRing}></div>
              </button>
              
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {recording ? 'Recording in progress...' : 'Click to start recording'}
                </div>
                {recording && (
                  <div style={{ fontSize: '2rem', color: 'var(--warning)', marginTop: '0.5rem', fontFamily: 'monospace' }}>
                    {formatTime(recordingTime)}
                  </div>
                )}
              </div>
              
              <div style={{ fontSize: '0.85rem', color: 'var(--text-subtle)' }}>
                {recording ? 'Click the button to stop recording' : 'Record your clinical consultation'}
              </div>
            </div>
          )}

          {/* Processing State */}
          {processing && (
            <div style={styles.feedItem}>
              <div style={styles.feedContent}>
                <div style={styles.feedIcon}>⏳</div>
                <div style={styles.feedHeader}>
                  <div style={styles.feedTitle}>Processing Recording</div>
                  <div style={styles.feedDescription}>Transcribing audio and generating clinical summary...</div>
                </div>
              </div>
            </div>
          )}

          {/* Results - Show after recording is complete */}
          {hasRecorded && !processing && (
            <>
              {/* Audio Playback Controls */}
              {audioUrl && (
                <div style={styles.feedItem}>
                  <div style={styles.feedContent}>
                    <div style={styles.feedIcon}>🎵</div>
                    <div style={styles.feedHeader}>
                      <div style={styles.feedTitle}>Audio Recording</div>
                      <div style={styles.feedDescription}>
                        Recorded on {new Date(timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div style={styles.feedActions}>
                    <audio ref={audioRef} src={audioUrl} style={{ display: 'none' }} onEnded={() => setIsPlaying(false)} />
                    <button onClick={playAudio} style={styles.btnPrimary}>
                      {isPlaying ? 'Pause' : 'Play'}
                    </button>
                    <button onClick={downloadAudio} style={styles.btnSecondary}>
                      Download
                    </button>
                    <button onClick={clearRecording} style={{ ...styles.btnSecondary, borderColor: 'var(--warning)', color: 'var(--warning)' }}>
                      Clear & New Recording
                    </button>
                  </div>
                </div>
              )}

              {/* Transcription */}
              <div style={styles.feedItem}>
                <div style={styles.feedContent}>
                  <div style={styles.feedIcon}>📝</div>
                  <div style={styles.feedHeader}>
                    <div style={styles.feedTitle}>Transcription</div>
                    <div style={styles.feedDescription}>Full text transcript of the consultation</div>
                  </div>
                </div>
              </div>
              
              <div style={styles.summarySection}>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  {transcription}
                </div>
              </div>

              {/* Clinical Summary */}
              {summary && (
                <>
                  <div style={{ ...styles.feedItem, marginTop: '1.5rem' }}>
                    <div style={styles.feedContent}>
                      <div style={styles.feedIcon}>🏥</div>
                      <div style={styles.feedHeader}>
                        <div style={styles.feedTitle}>Clinical Summary</div>
                        <div style={styles.feedDescription}>AI-generated medical summary</div>
                      </div>
                    </div>
                  </div>

                  <div style={styles.summarySection}>
                    {summary.split('###').filter(s => s.trim()).map((section, index) => {
                      const lines = section.trim().split('\n').filter(l => l.trim());
                      if (!lines.length) return null;
                      
                      const title = lines[0].replace(/#+/g, '').trim();
                      const content = lines.slice(1).join('\n').trim();
                      
                      return (
                        <div key={index} style={{ marginBottom: '1.5rem' }}>
                          <h3 style={styles.sectionTitle}>{title}</h3>
                          <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                            {content}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicalAudioTranscriber;
