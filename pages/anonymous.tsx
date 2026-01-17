"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from "../src/lib/supabaseClient";

// Icons
const AnonymousIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C7.03 2 3 6.03 3 11V14.5C3 15.33 3.67 16 4.5 16H5V11C5 7.13 8.13 4 12 4C15.87 4 19 7.13 19 11V16H19.5C20.33 16 21 15.33 21 14.5V11C21 6.03 16.97 2 12 2Z" fill="#64748b"/>
    <path d="M9 14C9 15.6569 7.65685 17 6 17C4.34315 17 3 15.6569 3 14V11H9V14Z" fill="#64748b"/>
    <path d="M15 14C15 15.6569 16.3431 17 18 17C19.6569 17 21 15.6569 21 14V11H15V14Z" fill="#64748b"/>
    <path d="M12 13C10.9 13 10 13.9 10 15V18C10 19.1 10.9 20 12 20C13.1 20 14 19.1 14 18V15C14 13.9 13.1 13 12 13Z" fill="#64748b"/>
  </svg>
);
const MicIcon = ({ isListening }: { isListening: boolean }) => (
  <svg 
    width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isListening ? "#ef4444" : "currentColor"} 
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className={isListening ? "animate-pulse" : ""}
  >
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>
  </svg>
);
// Add these to your Icons section
const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
);

const AddIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg 
    width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" 
    style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)', transition: '0.3s' }}
  >
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);



const LikeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
  </svg>
);

const CommentIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const ShareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m17 2 4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

const AnonymousRoom = () => {
  const [stories, setStories] = useState<any[]>([]);
  const [newStory, setNewStory] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeConfession, setActiveConfession] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  // Inside AnonymousRoom component, add this state:
const [isFormOpen, setIsFormOpen] = useState(false);

const [deviceId, setDeviceId] = useState<string>("");
// New states for Audio
const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
const [isRecording, setIsRecording] = useState(false);

const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const newRecorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];

  newRecorder.ondataavailable = (e) => chunks.push(e.data);
  newRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    setAudioBlob(blob);
  };

  newRecorder.start();
  setRecorder(newRecorder);
  setIsRecording(true);
};

const stopRecording = () => {
  recorder?.stop();
  setIsRecording(false);
  recorder?.stream.getTracks().forEach(track => track.stop());
};

// Updated HandleSubmit to handle Audio Upload
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  let audioUrl = null;

  if (audioBlob) {
    // 1. Create a unique filename
    const fileName = `vn-${Date.now()}.webm`;

    // 2. Upload directly to Supabase Storage
    // Passing the Blob directly avoids the multipart/form-data error
    const { data, error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(fileName, audioBlob, {
        contentType: 'audio/webm', // Correct MIME type
        upsert: false
      });

    if (uploadError) {
      console.error("Upload Error Details:", uploadError);
      alert("Audio upload failed: " + uploadError.message);
      setLoading(false);
      return;
    }

    // 3. Get the public URL for the database
    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(fileName);
      
    audioUrl = urlData.publicUrl;
  }

  // 4. Save to the database table
  const { error: dbError } = await supabase
    .from('confession')
    .insert([{ 
      content: newStory.trim(), 
      audio_url: audioUrl 
    }]);

  if (dbError) {
    alert("Database save failed: " + dbError.message);
  } else {
    // Reset everything on success
    setNewStory("");
    setAudioBlob(null);
    setIsFormOpen(false);
    fetchConfessions();
  }
  setLoading(false);
};
useEffect(() => {
  // Generate or retrieve a unique ID for this browser
  let id = localStorage.getItem('user_device_id');
  if (!id) {
    id = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('user_device_id', id);
  }
  setDeviceId(id);
  fetchConfessions(); // Pass it to fetcher
}, []);

const [isListening, setIsListening] = useState(false);

const startListening = () => {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    alert("Voice typing is not supported in this browser.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-KE'; 
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => setIsListening(true);
  
  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    // We use the functional update to ensure we have the latest text
    setNewStory(prev => {
      const updatedText = prev + (prev ? " " : "") + transcript;
      return updatedText;
    });
    setIsListening(false);
  };

  recognition.onerror = (event: any) => {
    console.error("Speech Error:", event.error);
    setIsListening(false);
  };
  
  recognition.onend = () => setIsListening(false);
  recognition.start();
};

async function fetchConfessions() {
  setLoading(true);
  
  const { data, error } = await supabase
    .from('confession')
    .select(`
      *,
      comment!confession_id(count),
      likev!confession_id(count)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("API Error:", error.message);
    setLoading(false);
    return;
  }

  if (data) {
    const storiesProcessed = data.map(story => ({
      ...story,
      // Note: Supabase returns an array for counts, so we access [0].count
      comment_count: story.comment?.[0]?.count || 0,
      display_likes: story.likev?.[0]?.count || 0,
      // Optional: Add logic here later to check if deviceId is in likev
      hasLiked: false 
    }));
    setStories(storiesProcessed);
  }
  setLoading(false);
}

 

  const fetchComments = async (storyId: string) => {
    if (activeConfession === storyId) {
        setActiveConfession(null); // Toggle close
        return;
    }
    const { data } = await supabase
      .from('comment')
      .select('*')
      .eq('confession_id', storyId)
      .order('created_at', { ascending: true });
    setComments(data || []);
    setActiveConfession(storyId);
  };

  const handlePostComment = async (e: React.FormEvent, storyId: string) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const { error } = await supabase
      .from('comment')
      .insert([{ confession_id: storyId, content: newComment }]);
if (!error) {
  setNewComment("");
  // Refresh comments list
  const { data } = await supabase
    .from('comment')
    .select('*')
    .eq('confession_id', storyId)
    .order('created_at', { ascending: true });
  setComments(data || []);

  // UPDATE THE COUNT IN THE LOCAL STATE
  setStories(prevStories => 
    prevStories.map(s => 
      s.id === storyId ? { ...s, comment_count: (s.comment_count || 0) + 1 } : s
    )
  );
}
  };

const handleLike = async (storyId: string, hasLiked: boolean) => {
  // Optimistic UI: Update the screen instantly
  setStories(prev => prev.map(s => {
    if (s.id === storyId) {
      return {
        ...s,
        hasLiked: !hasLiked,
        display_likes: hasLiked ? Math.max(0, s.display_likes - 1) : s.display_likes + 1
      };
    }
    return s;
  }));

  if (hasLiked) {
    // REMOVE like from the table
    await supabase.from('likev')
      .delete()
      .match({ confession_id: storyId, user_device_id: deviceId });
  } else {
    // ADD like to the table
    const { error } = await supabase.from('likev')
      .insert([{ confession_id: storyId, user_device_id: deviceId }]);
      
    // If someone else already liked it while we were clicking, ignore the 409
    if (error && error.code !== '23505') console.error(error);
  }
  
  // Final sync with database
  fetchConfessions();
};
  const handleShare = async (content: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Anonymous Confession', text: content, url: window.location.href });
      } catch (err) { console.log('Error sharing', err); }
    } else {
      navigator.clipboard.writeText(content);
      alert("Copied to clipboard!");
    }
  };

return (
  <div className="page-container">
    {/* 1. FIXED APP BAR */}
    <nav className="app-bar">
      <div className="app-bar-content">
        <button className="icon-btn" onClick={() => window.location.href = '/'}>
          <BackIcon />
        </button>
        <span className="app-title">Anonymous Room</span>
        <button 
          className={`icon-btn add-btn ${isFormOpen ? 'active' : ''}`} 
          onClick={() => setIsFormOpen(!isFormOpen)}
        >
          <AddIcon isOpen={isFormOpen} />
        </button>
      </div>
    </nav>

    <div className="content-wrapper">
      <header className="page-header">
        <p className="subtitle">Share your story|confession anonymously.</p>
      </header>
      
      {/* 2. COLLAPSIBLE FORM */}
{isFormOpen && (
  <form onSubmit={handleSubmit} className="confession-form">
    <textarea
      className="confession-textarea"
      placeholder="Type your story or record a voice note..."
      value={newStory}
      onChange={(e) => setNewStory(e.target.value)}
      rows={3}
    />
    
    {audioBlob && <p className="audio-ready">🎤 Voice note recorded!</p>}

    <div className="form-footer">
      <button 
        type="button" 
        className={`mic-btn ${isRecording ? 'recording' : ''}`}
        onClick={isRecording ? stopRecording : startRecording}
      >
        <MicIcon isListening={isRecording} />
        <span>{isRecording ? "Stop Recording" : "Record Voice"}</span>
      </button>
      
      <button type="submit" className="submit-btn" disabled={loading}>
        {loading ? "Posting..." : "Post"}
      </button>
    </div>
  </form>
)}
        {/* 3. FEED OF CONFESSIONS */}

      <div className="feed">
        {loading ? (
          <div className="loading-state">Loading confessions...</div>
        ) : (
          stories.map((story) => (
            <div key={story.id} className="story-card">
              <div className="anonymous-meta">
                <div className="avatar-placeholder"><AnonymousIcon /></div>
                <div>
                  <span className="user-name">Anonymous</span>
                  <span className="timestamp">{new Date(story.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <p className="story-text">"{story.content}"</p>

              {/* If there is a voice note, show the player */}
{story.audio_url && (
  <div className="audio-player-container">
    <audio controls src={story.audio_url} className="custom-audio">
      Your browser does not support the audio element.
    </audio>
  </div>
)}

              <div className="card-actions">
<button 
  className={`action-btn like ${story.hasLiked ? 'active' : ''}`} 
  onClick={() => handleLike(story.id, story.hasLiked)}
>
  <LikeIcon/> 
  <span>
    {/* Corrected to use display_likes instead of story.likes */}
    {story.display_likes || 0}
  </span>
</button>
<button className="action-btn" onClick={() => fetchComments(story.id)}>
  <CommentIcon /> 
  <span>
    {story.comment_count > 0 ? `${story.comment_count} Comments` : 'Comment'}
  </span>
</button>
                <button className="action-btn" onClick={() => handleShare(story.content)}>
                  <ShareIcon /> <span>Share</span>
                </button>
              </div>

              {/* COMMENT SECTION IS NOW INSIDE THE MAP LOOP */}
              {activeConfession === story.id && (
                <div className="comment-section">
                  <div className="comment-list">
                    {comments.length === 0 && <p className="no-comments">No comments yet. Be the first!</p>}
                    {comments.map((c) => (
                      <div key={c.id} className="comment-item">
                        <strong>Unknown:</strong> {c.content}
                      </div>
                    ))}
                  </div>
                  <form onSubmit={(e) => handlePostComment(e, story.id)} className="comment-input-area">
                    <input 
                      type="text" 
                      placeholder="Write a comment..." 
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                    />
                    <button type="submit">Send</button>
                  </form>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      </div>

      <style jsx>{`

      .mic-btn.recording {
  background: #ff0000;
  color: white;
  border-color: #000;
}

.audio-ready {
  font-size: 0.8rem;
  color: #10b981;
  margin: 10px 0;
  font-weight: bold;
}

.audio-player-container {
  margin-top: 15px;
  background: #f1f5f9;
  padding: 10px;
  border-radius: 30px;
}

.custom-audio {
  width: 100%;
  height: 40px;
}

      .voice-actions {
  display: flex;
  align-items: center;
}

.mic-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 8px 15px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.85rem;
  color: #475569;
}

.mic-btn.listening {
  background: #fee2e2;
  border-color: #ef4444;
  color: #ef4444;
}

.animate-pulse {
  animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .5; }
}
      /* NEW APP BAR STYLES */
      .app-bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 60px;
        background: white;
        border-bottom: 1px solid #060606;
        display: flex;
        align-items: center;
        z-index: 1000;
        padding: 0 15px;
      }
      .app-bar-content {
        max-width: 650px;
        width: 100%;
        margin: 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .app-title { font-weight: 700; font-size: 1.1rem; }
      .icon-btn { background: none; border: 1px solid black; cursor: pointer; padding: 8px; border-radius: 50%; display: flex; align-items: center; }
      .icon-btn:hover { background: #f1f5f9; }
      .add-btn.active { color: #ef4444; }
      .add-btn{ border: 1px solid black; }

      .page-container { padding-top: 80px; } /* Space for fixed bar */
      .content-wrapper { max-width: 650px; margin: 0 auto; padding: 0 20px; }
      
      /* Keep your existing styles below, just update these: */
      .confession-form { 
        animation: slideDown 0.3s ease-out;
        background: white;
      }
      @keyframes slideDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
        .page-container { max-width: 650px; margin: 0 auto; padding: 40px 20px; min-height: 100vh; font-family: sans-serif; }
        .page-header { text-align: center; margin-bottom: 40px; }
        .page-header h1 { display: flex; align-items: center; justify-content: center; gap: 10px; color: #070707; }
        .subtitle { color: #2402ff; }
        .confession-form { border: 1px solid #fd0404; border-radius: 16px; padding: 20px; margin-bottom: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .confession-textarea { width: 90%; padding: 15px; background: #f8fafc; border: 1px solid #080808; border-radius: 12px; outline: none; overflow: hidden ; resize: none; }
        .form-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
        .submit-btn { background: #fbfbfd; color: black; padding: 10px 20px; border-radius: 30px; border: 1px solid black; font-weight: 600; cursor: pointer; }
        .story-card { border: 1px solid #060606; color:black; border-radius: 50px; padding: 20px; margin-bottom: 20px; border-bottom: 1px solid #060606;}
        .anonymous-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
        .avatar-placeholder { width: 35px; height: 35px; background: #03f748; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #f90808; }
        .user-name { font-weight: 700; font-size: 0.9rem; color: #050505; }
        .timestamp { font-size: 0.75rem; color: #060606; display: block; }
        .story-text { color: #475569; font-style: italic; line-height: 1.6; }
        .card-actions { display: flex; gap: 20px; margin-top: 15px; padding-top: 15px; border-top: 1px solid #0a0a0a; color: #060606; }
        .action-btn { background: none; border: none; display: flex; align-items: center; gap: 5px; color: #050505; cursor: pointer; font-size: 0.85rem; }
        .action-btn:hover { color: #090909; }
        .comment-section { margin-top: 15px; background: #f8fafc; padding: 15px; border-radius: 12px; }
        .comment-item { font-size: 0.85rem; margin-bottom: 8px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px; }
        .comment-input-area { display: flex; gap: 10px; margin-top: 10px; }
        .comment-input-area input { flex: 1; padding: 8px 15px; border-radius: 20px; border: 1px solid #e2e8f0; outline: none; font-size: 0.85rem; }
        .comment-input-area button { background: #6366f1; color: white; border: none; padding: 5px 15px; border-radius: 20px; cursor: pointer; }
        .no-comments { font-size: 0.8rem; color: #94a3b8; text-align: center; }
      `}</style>
    </div>
  );
};

export default AnonymousRoom;