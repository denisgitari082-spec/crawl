"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../src/lib/supabaseClient";

// ... (keep your existing types)

export default function MessagesPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [chats, setChats] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  
  // New States for "Start Chat" feature
  const [showSearch, setShowSearch] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState<ChatUser | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setCurrentUser(data.user);
        fetchChatList(data.user.id);
      }
    };
    getUser();
  }, []);

  // 1. Fetch Chat List (Existing logic is fine)
  const fetchChatList = async (userId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("sender_id, receiver_id")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    if (data) {
      const chatIds = Array.from(new Set(data.flatMap(m => [m.sender_id, m.receiver_id])))
        .filter(id => id !== userId);
      
      const { data: users } = await supabase.from("profiles").select("id, email").in("id", chatIds);
      setChats(users || []);
    }
  };

  // 2. SEARCH for a new user by email
  const handleSearchUser = async () => {
    if (!searchEmail) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", searchEmail)
      .single();

    if (data) {
      setSearchResult(data);
    } else {
      alert("User not found");
    }
  };

  // 3. START the chat
  const startNewChat = (user: ChatUser) => {
    // Add to sidebar if not already there
    if (!chats.find(c => c.id === user.id)) {
      setChats([user, ...chats]);
    }
    setSelectedUser(user);
    setShowSearch(false);
    setSearchEmail("");
    setSearchResult(null);
  };

  // ... (keep your existing fetchMessages and sendMessage logic)

  return (
    <div className="messenger-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>My Chats</h3>
          <button className="add-btn" onClick={() => setShowSearch(true)}>+</button>
        </div>

        {/* Start New Chat Modal/UI */}
        {showSearch && (
          <div className="search-box">
            <input 
              placeholder="Friend's email..." 
              value={searchEmail} 
              onChange={(e) => setSearchEmail(e.target.value)} 
            />
            <button onClick={handleSearchUser}>Search</button>
            {searchResult && (
              <div className="result-item" onClick={() => startNewChat(searchResult)}>
                Connect with {searchResult.email}
              </div>
            )}
            <button className="close-link" onClick={() => setShowSearch(false)}>Cancel</button>
          </div>
        )}

        {chats.map(user => (
          <div key={user.id} className={`user-item ${selectedUser?.id === user.id ? 'active' : ''}`} onClick={() => setSelectedUser(user)}>
            {user.email.split('@')[0]}
          </div>
        ))}
      </div>

      {/* Chat Window logic remains the same */}
      <div className="chat-window">
         {/* ... (rest of your chat window JSX) */}
      </div>

      <style jsx>{`
        /* ... existing styles ... */
        .sidebar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .add-btn { background: #3b82f6; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; font-weight: bold; }
        .search-box { background: #1e293b; padding: 10px; border-radius: 8px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }
        .search-box input { padding: 8px; border-radius: 4px; border: none; background: #0f172a; color: white; }
        .result-item { background: #3b82f6; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 5px; text-align: center; }
        .close-link { background: none; border: none; color: #94a3b8; font-size: 12px; cursor: pointer; }
      `}</style>
    </div>
  );
}
